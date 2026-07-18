import type { PublicApiErrorCodeV1 } from "./contracts";

export type ArenaTransportErrorCategory =
  | "INVALID_REQUEST"
  | "NETWORK_FAILURE"
  | "API_ERROR"
  | "INVALID_RESPONSE";

export class ArenaTransportError extends Error {
  readonly category: ArenaTransportErrorCategory;
  readonly status?: number;
  readonly apiCode?: PublicApiErrorCodeV1;

  constructor(
    category: ArenaTransportErrorCategory,
    options: { status?: number; apiCode?: PublicApiErrorCodeV1 } = {},
  ) {
    super("Arena runtime request failed");
    this.name = "ArenaTransportError";
    this.category = category;
    this.status = options.status;
    this.apiCode = options.apiCode;
  }
}
