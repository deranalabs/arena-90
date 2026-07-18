export type TxlineEnvironment = Readonly<Record<string, string | undefined>>;

function validExplicitPath(value: string): boolean {
  return (
    value !== "" &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

export async function resolveTxlineCredentialEnvironment(
  env: TxlineEnvironment,
  readFile: (path: string) => Promise<string>,
): Promise<TxlineEnvironment> {
  const path = env["TXLINE_CREDENTIALS_FILE"];
  if (path === undefined || path === "") return env;
  if (!validExplicitPath(path)) throw new TypeError("Invalid credential path");

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path)) as unknown;
  } catch {
    throw new TypeError("Invalid credential file");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("Invalid credential file");
  }

  const record = parsed as Record<string, unknown>;
  const mapped = [
    ["apiOrigin", "TXLINE_BASE_URL"],
    ["jwt", "TXLINE_JWT"],
    ["apiToken", "TXLINE_API_TOKEN"],
  ] as const;
  const resolved: Record<string, string | undefined> = { ...env };
  for (const [fileKey, environmentKey] of mapped) {
    const value = record[fileKey];
    if (typeof value !== "string" || value === "" || value.trim() !== value) {
      throw new TypeError("Invalid credential file");
    }
    if (resolved[environmentKey] === undefined || resolved[environmentKey] === "") {
      resolved[environmentKey] = value;
    }
  }
  return Object.freeze(resolved);
}
