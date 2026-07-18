import anchor from "@coral-xyz/anchor";
import { z } from "zod";

import type { TxlineCredentials } from "./config.js";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const byteSchema = z.number().int().min(0).max(255);
const hashSchema = z.union([
  z.array(byteSchema).length(32),
  z.string().min(1),
]);
const proofNodeSchema = z
  .object({
    hash: hashSchema.optional(),
    Hash: hashSchema.optional(),
    isRightSibling: z.boolean().optional(),
    IsRightSibling: z.boolean().optional(),
  })
  .passthrough()
  .superRefine((node, context) => {
    if ((node.hash ?? node.Hash) === undefined) {
      context.addIssue({ code: "custom", message: "Proof node hash is required" });
    }
    if ((node.isRightSibling ?? node.IsRightSibling) === undefined) {
      context.addIssue({ code: "custom", message: "Proof node direction is required" });
    }
  });
const proofSchema = z
  .object({
    summary: z
      .object({
        fixtureId: z.coerce.number().int().positive().safe(),
        updateStats: z
          .object({
            updateCount: z.number().int(),
            minTimestamp: z.coerce.number().int().nonnegative().safe(),
            maxTimestamp: z.coerce.number().int().nonnegative().safe(),
          })
          .passthrough(),
        eventStatsSubTreeRoot: hashSchema,
      })
      .passthrough(),
    subTreeProof: z.array(proofNodeSchema),
    mainTreeProof: z.array(proofNodeSchema),
    eventStatRoot: hashSchema,
    statToProve: z
      .object({
        key: z.number().int(),
        value: z.number().int(),
        period: z.number().int(),
      })
      .passthrough(),
    statProof: z.array(proofNodeSchema),
  })
  .passthrough();

type TxlineProof = z.infer<typeof proofSchema>;

function bytes32(value: z.infer<typeof hashSchema>): number[] {
  const bytes = Array.isArray(value)
    ? Uint8Array.from(value)
    : Buffer.from(
        value.startsWith("0x") ? value.slice(2) : value,
        value.startsWith("0x") ? "hex" : "base64",
      );
  if (bytes.length !== 32) throw new Error("TxLINE proof hash must contain 32 bytes");
  return [...bytes];
}

function proofNodes(nodes: readonly z.infer<typeof proofNodeSchema>[]) {
  return nodes.map((node) => ({
    hash: bytes32((node.hash ?? node.Hash) as z.infer<typeof hashSchema>),
    isRightSibling: (node.isRightSibling ?? node.IsRightSibling) as boolean,
  }));
}

function sameHash(left: z.infer<typeof hashSchema>, right: z.infer<typeof hashSchema>) {
  return Buffer.from(bytes32(left)).equals(Buffer.from(bytes32(right)));
}

async function fetchProof(input: {
  readonly credentials: TxlineCredentials;
  readonly fixtureId: string;
  readonly providerSequence: number;
  readonly statKey: 1 | 2;
  readonly signal: AbortSignal;
  readonly fetchImpl: typeof fetch;
}): Promise<TxlineProof> {
  const url = new URL(`${input.credentials.apiOrigin}/api/scores/stat-validation`);
  url.searchParams.set("fixtureId", input.fixtureId);
  url.searchParams.set("seq", String(input.providerSequence));
  url.searchParams.set("statKey", String(input.statKey));
  const response = await input.fetchImpl(url, {
    signal: input.signal,
    headers: {
      Authorization: `Bearer ${input.credentials.jwt}`,
      "X-Api-Token": input.credentials.apiToken,
    },
  });
  if (!response.ok) {
    throw new Error(`TxLINE proof request failed with status ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_PROOF_BYTES) {
    throw new Error("TxLINE proof response exceeds 5 MB");
  }
  return proofSchema.parse(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
}

export async function fetchTerminalProofPayload(input: {
  readonly credentials: TxlineCredentials;
  readonly fixtureId: string;
  readonly providerSequence: number;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly signal: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const [home, away] = await Promise.all([
    fetchProof({ ...input, statKey: 1, fetchImpl }),
    fetchProof({ ...input, statKey: 2, fetchImpl }),
  ]);
  const fixtureId = Number(input.fixtureId);
  if (
    !Number.isSafeInteger(fixtureId) ||
    home.summary.fixtureId !== fixtureId ||
    away.summary.fixtureId !== fixtureId ||
    home.statToProve.key !== 1 ||
    away.statToProve.key !== 2 ||
    home.statToProve.period !== 5 ||
    away.statToProve.period !== 5 ||
    home.statToProve.value !== input.homeScore ||
    away.statToProve.value !== input.awayScore ||
    home.summary.updateStats.updateCount !== away.summary.updateStats.updateCount ||
    home.summary.updateStats.minTimestamp !== away.summary.updateStats.minTimestamp ||
    home.summary.updateStats.maxTimestamp !== away.summary.updateStats.maxTimestamp ||
    !sameHash(home.summary.eventStatsSubTreeRoot, away.summary.eventStatsSubTreeRoot) ||
    !sameHash(home.eventStatRoot, away.eventStatRoot)
  ) {
    throw new Error("TxLINE terminal proofs do not match canonical final evidence");
  }

  const targetTimestamp = home.summary.updateStats.minTimestamp;
  const epochDay = Math.floor(targetTimestamp / 86_400_000);
  if (epochDay < 0 || epochDay > 65_535) {
    throw new Error("TxLINE proof epoch day exceeds PDA seed range");
  }

  return Object.freeze({
    epochDay,
    payload: {
      ts: new anchor.BN(targetTimestamp),
      fixtureSummary: {
        fixtureId: new anchor.BN(fixtureId),
        updateStats: {
          updateCount: home.summary.updateStats.updateCount,
          minTimestamp: new anchor.BN(home.summary.updateStats.minTimestamp),
          maxTimestamp: new anchor.BN(home.summary.updateStats.maxTimestamp),
        },
        eventsSubTreeRoot: bytes32(home.summary.eventStatsSubTreeRoot),
      },
      fixtureProof: proofNodes(home.subTreeProof),
      mainTreeProof: proofNodes(home.mainTreeProof),
      eventStatRoot: bytes32(home.eventStatRoot),
      stats: [home, away].map((proof) => ({
        stat: {
          key: proof.statToProve.key,
          value: proof.statToProve.value,
          period: proof.statToProve.period,
        },
        statProof: proofNodes(proof.statProof),
      })),
    },
  });
}
