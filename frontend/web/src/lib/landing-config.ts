export type TxLineMode = "mock" | "live";

const GITHUB_URL = "https://github.com/deranalabs/arena-90";

function validHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getLandingConfig() {
  const mode: TxLineMode =
    process.env.NEXT_PUBLIC_TXLINE_MODE === "live" ? "live" : "mock";

  return {
    githubUrl: GITHUB_URL,
    isLive: mode === "live",
    mode,
    status: {
      agent: mode === "live" ? "Autonomous agents online" : "Deterministic test run",
      escrow: mode === "live" ? "Devnet escrow armed" : "Devnet escrow",
      txline: mode === "live" ? "Live TxLINE" : "TxLINE simulation",
    },
    xBlinkUrl: validHttpsUrl(process.env.NEXT_PUBLIC_X_BLINK_URL),
  } as const;
}

