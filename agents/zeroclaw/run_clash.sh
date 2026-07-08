#!/usr/bin/env bash
set -euo pipefail

AGENT_DIR="/Users/derana/CodeDerana/arena-90/agents/zeroclaw"
CONFIG_SRC="${AGENT_DIR}/zeroclaw.toml"
READ_ODDS="${AGENT_DIR}/tools/read_odds.py"
ODDS_PATH="/Users/derana/CodeDerana/arena-90/backend/solana-actions/mock/txodds-mock.json"
OUTPUT_PATH="/Users/derana/CodeDerana/arena-90/backend/solana-actions/mock/clash-state.json"
RUNTIME_DIR="$(mktemp -d "${TMPDIR:-/tmp}/arena90-zeroclaw.XXXXXX")"
STUB_PID=""

cleanup() {
  if [ -n "${STUB_PID}" ]; then
    kill "${STUB_PID}" >/dev/null 2>&1 || true
    wait "${STUB_PID}" >/dev/null 2>&1 || true
  fi
  rm -rf "${RUNTIME_DIR}"
}
trap cleanup EXIT

mkdir -p "${RUNTIME_DIR}" "$(dirname "${OUTPUT_PATH}")"

STUB_PORT="$(python3 - <<'PY'
import socket

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PY
)"

python3 - "${STUB_PORT}" <<'PY' &
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Arena90Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("content-length", "0"))
        if length:
            self.rfile.read(length)

        content = json.dumps(
            {
                "agentRuntime": "zeroclaw",
                "status": "ack",
                "decisionSource": "tools/read_odds.py",
            },
            sort_keys=True,
        )
        body = json.dumps(
            {
                "id": "chatcmpl-arena90-local",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": "arena90-local",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": content},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 1,
                    "completion_tokens": 1,
                    "total_tokens": 2,
                },
            }
        ).encode("utf-8")

        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        return


port = int(sys.argv[1])
ThreadingHTTPServer(("127.0.0.1", port), Arena90Handler).serve_forever()
PY
STUB_PID="$!"

python3 - "${STUB_PORT}" <<'PY'
import socket
import sys
import time

port = int(sys.argv[1])
deadline = time.time() + 5
while time.time() < deadline:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        if sock.connect_ex(("127.0.0.1", port)) == 0:
            raise SystemExit(0)
    time.sleep(0.05)
raise SystemExit("Arena90 local ZeroClaw model stub did not start")
PY

python3 - "${CONFIG_SRC}" "${RUNTIME_DIR}/config.toml" "${STUB_PORT}" <<'PY'
import sys
from pathlib import Path

source = Path(sys.argv[1])
target = Path(sys.argv[2])
port = sys.argv[3]
text = source.read_text(encoding="utf-8")
text = text.replace(
    'uri = "http://127.0.0.1:18090/v1/chat/completions"',
    f'uri = "http://127.0.0.1:{port}/v1/chat/completions"',
)

target.write_text(text, encoding="utf-8")
target.chmod(0o600)
PY

run_agent() {
  local agent="$1"
  local prompt_file="${RUNTIME_DIR}/${agent}-prompt.txt"
  local stdout_file="${RUNTIME_DIR}/${agent}-stdout.txt"
  local stderr_file="${RUNTIME_DIR}/${agent}-stderr.txt"
  local status_file="${RUNTIME_DIR}/${agent}-status.txt"

  python3 "${READ_ODDS}" --path "${ODDS_PATH}" --agent "${agent}" --output prompt > "${prompt_file}"

  if command -v zeroclaw >/dev/null 2>&1; then
    set +e
    zeroclaw agent \
      --config-dir "${RUNTIME_DIR}" \
      -a "${agent}" \
      --temperature 0 \
      --message "$(cat "${prompt_file}")" \
      > "${stdout_file}" 2> "${stderr_file}"
    local status=$?
    set -e
    printf "%s" "${status}" > "${status_file}"
  else
    printf "" > "${stdout_file}"
    printf "%s" "zeroclaw CLI not found" > "${stderr_file}"
    printf "%s" "127" > "${status_file}"
  fi
}

run_agent "isagi"
run_agent "aiku"

python3 "${READ_ODDS}" --path "${ODDS_PATH}" --agent isagi --output decision --pretty > "${RUNTIME_DIR}/isagi-decision.json"
python3 "${READ_ODDS}" --path "${ODDS_PATH}" --agent aiku --output decision --pretty > "${RUNTIME_DIR}/aiku-decision.json"
python3 "${READ_ODDS}" --path "${ODDS_PATH}" --agent isagi --output odds --pretty > "${RUNTIME_DIR}/odds.json"

python3 - "${RUNTIME_DIR}" "${OUTPUT_PATH}" <<'PY'
import json
import re
import sys
from pathlib import Path

runtime_dir = Path(sys.argv[1])
output_path = Path(sys.argv[2])
SECRET_PATTERN = re.compile(r"sk-[A-Za-z0-9_-]{6,}")


def read_text(name: str, limit: int = 6000) -> str:
    path = runtime_dir / name
    if not path.exists():
        return ""
    value = path.read_text(encoding="utf-8", errors="replace")[:limit]
    return SECRET_PATTERN.sub("sk-REDACTED", value)


def read_json(name: str) -> dict:
    return json.loads((runtime_dir / name).read_text(encoding="utf-8"))


def zc_result(agent: str) -> dict:
    status_text = read_text(f"{agent}-status.txt") or "1"
    try:
        exit_code = int(status_text)
    except ValueError:
        exit_code = 1
    return {
        "command": f"zeroclaw agent --config-dir <runtime> -a {agent} --temperature 0 --message <arena-prompt>",
        "exitCode": exit_code,
        "stdout": read_text(f"{agent}-stdout.txt"),
        "stderr": read_text(f"{agent}-stderr.txt"),
        "usedDeterministicToolDecision": True,
    }


odds = read_json("odds.json")
isagi = read_json("isagi-decision.json")
aiku = read_json("aiku-decision.json")
isagi["zeroclaw"] = zc_result("isagi")
aiku["zeroclaw"] = zc_result("aiku")

state = {
    "schemaVersion": 1,
    "source": "zeroclaw",
    "generatedAtUtc": odds["generatedAtUtc"],
    "match": odds["match"],
    "market": odds["market"],
    "agents": [isagi, aiku],
    "clash": {
        "id": f"{odds['match']['matchId']}-total-goals-2-5",
        "status": "ready",
        "headline": f"{isagi['displayName']} {isagi['prediction']} vs {aiku['displayName']} {aiku['prediction']}",
        "isDeterministic": True,
        "mockSource": "txodds-mock",
    },
}

output_path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY

if [ "${ARENA90_ZEROCLAW_REQUIRE_SUCCESS:-0}" = "1" ]; then
  python3 - "${OUTPUT_PATH}" <<'PY'
import json
import sys
from pathlib import Path

state = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
failed = [
    agent["agentId"]
    for agent in state["agents"]
    if agent["zeroclaw"]["exitCode"] != 0
]
if failed:
    raise SystemExit(f"ZeroClaw failed for: {', '.join(failed)}")
PY
fi

python3 - "${OUTPUT_PATH}" <<'PY'
import json
import sys
from pathlib import Path

state = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
agents = ", ".join(f"{agent['displayName']}={agent['prediction']}" for agent in state["agents"])
print(f"wrote {sys.argv[1]}")
print(f"clash {state['clash']['id']}: {agents}")
PY
