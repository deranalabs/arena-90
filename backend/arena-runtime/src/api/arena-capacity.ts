export interface ArenaHttpCapacityClaim {
  readonly arenaId: string;
}

export type ArenaHttpCapacityClaimResult =
  | Readonly<{
      status: "ACQUIRED";
      claim: ArenaHttpCapacityClaim;
    }>
  | Readonly<{
      status: "CURRENT";
      waitForChange: Promise<void> | undefined;
    }>
  | Readonly<{
      status: "CAPACITY_REACHED";
    }>;

export interface ArenaHttpCapacityCoordinator {
  claim(arenaId: string): ArenaHttpCapacityClaimResult;
  settle(
    claim: ArenaHttpCapacityClaim,
    outcome: "APPLIED" | "NOT_APPLIED",
  ): void;
}

export interface CreateInMemoryArenaHttpCapacityCoordinatorConfig {
  readonly occupiedArenaId?: string;
}

export function createInMemoryArenaHttpCapacityCoordinator(
  config: CreateInMemoryArenaHttpCapacityCoordinatorConfig = {},
): ArenaHttpCapacityCoordinator {
  if (
    config.occupiedArenaId !== undefined &&
    (config.occupiedArenaId === "" ||
      config.occupiedArenaId.trim() !== config.occupiedArenaId)
  ) {
    throw new TypeError("Invalid Arena HTTP capacity configuration");
  }

  let occupiedArenaId = config.occupiedArenaId;
  let active:
    | Readonly<{
        claim: ArenaHttpCapacityClaim;
        settled: Promise<void>;
        resolve: () => void;
      }>
    | undefined;

  const coordinator: ArenaHttpCapacityCoordinator = {
    claim(arenaId) {
      if (arenaId === "" || arenaId.trim() !== arenaId) {
        throw new TypeError("Invalid Arena HTTP capacity claim");
      }
      if (occupiedArenaId === undefined) {
        let resolve: () => void = () => undefined;
        const settled = new Promise<void>((settle) => {
          resolve = settle;
        });
        const claim = Object.freeze({ arenaId });
        occupiedArenaId = arenaId;
        active = Object.freeze({ claim, settled, resolve });
        return Object.freeze({ status: "ACQUIRED" as const, claim });
      }
      if (occupiedArenaId !== arenaId) {
        return Object.freeze({ status: "CAPACITY_REACHED" as const });
      }
      return Object.freeze({
        status: "CURRENT" as const,
        waitForChange: active?.settled,
      });
    },
    settle(claim, outcome) {
      const completed = active;
      if (completed === undefined || completed.claim !== claim) return;
      active = undefined;
      if (outcome === "NOT_APPLIED") occupiedArenaId = undefined;
      completed.resolve();
    },
  };
  return Object.freeze(coordinator);
}
