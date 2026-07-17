"use client";

import { Buffer } from "buffer";
import type { Transaction } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";

import {
  parseSupporterRecord,
  type SupporterRecord,
  verifySupporterClaim,
  verifySupporterRecord,
} from "@/lib/solana-actions/supporter-proof";
import {
  readVerifiedSupporterSettlement,
  type VerifiedSupporterSettlement,
} from "@/lib/solana-actions/supporter-settlement-proof";

type ActionLink = {
  type: string;
  href: string;
  label: string;
};

type ActionMetadata = {
  disabled?: boolean;
  error?: { message?: string };
  links?: { actions?: ActionLink[] };
};

type WalletProvider = {
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey?: { toString(): string } }>;
  signAndSendTransaction(
    transaction: Transaction,
  ): Promise<{ signature: string } | string>;
};

type SupporterPanelProps = {
  arenaAddress: string;
  backingDeadlineUtc: string;
  finalResultHash?: string;
  programId: string;
  publicOrigin?: string;
  rpcUrl: string;
};

function walletProvider() {
  return (window as typeof window & { solana?: WalletProvider }).solana;
}

function shortened(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

function validAmount(value: string) {
  if (!/^(0|[1-9]\d*)(\.\d{1,9})?$/.test(value)) return false;
  const [whole = "0", fraction = ""] = value.split(".");
  const lamports = BigInt(whole) * BigInt("1000000000") + BigInt(fraction.padEnd(9, "0"));
  return lamports >= BigInt("1000000") && lamports <= BigInt("1000000000");
}

function validTransactionAction(
  link: ActionLink,
  actionUrl: string,
  side: "alpha" | "beta",
) {
  try {
    const href = new URL(link.href);
    const expected = new URL(`${actionUrl}/back/${side}`);
    return (
      link.type === "transaction" &&
      href.origin === expected.origin &&
      href.pathname === expected.pathname &&
      href.searchParams.get("amount") === "{amount}"
    );
  } catch {
    return false;
  }
}

function validClaimAction(link: ActionLink, actionUrl: string) {
  try {
    const href = new URL(link.href);
    const expected = new URL(`${actionUrl}/claim`);
    return (
      link.type === "transaction" &&
      href.origin === expected.origin &&
      href.pathname === expected.pathname &&
      href.search === ""
    );
  } catch {
    return false;
  }
}

function canonicalArenaPage(metadata: ActionMetadata | undefined, origin: string) {
  const link = metadata?.links?.actions?.find((candidate) => candidate.type === "external-link");
  if (!link) return undefined;
  try {
    const href = new URL(link.href);
    return href.origin === origin && href.pathname.startsWith("/arena/")
      ? href.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function SupporterPanel({
  arenaAddress,
  backingDeadlineUtc,
  finalResultHash,
  programId,
  publicOrigin,
  rpcUrl,
}: SupporterPanelProps) {
  const origin = publicOrigin ?? (typeof window === "undefined" ? "" : window.location.origin);
  const actionPath = `/actions/arena/${arenaAddress}`;
  const actionUrl = `${origin}${actionPath}`;
  const recordKey = `arena90:supporter:${arenaAddress}`;
  const [metadata, setMetadata] = useState<ActionMetadata>();
  const [amount, setAmount] = useState("0.01");
  const [status, setStatus] = useState<
    "LOADING" | "READY" | "CONNECTING" | "REVIEW" | "SUBMITTING" |
    "SUBMITTED" | "VERIFYING" | "CONFIRMED" | "ERROR"
  >("LOADING");
  const [message, setMessage] = useState("Loading on-chain backing state…");
  const [record, setRecord] = useState<SupporterRecord>();
  const [settlement, setSettlement] = useState<VerifiedSupporterSettlement>();
  const [review, setReview] = useState<{ side: "alpha" | "beta"; wallet: string }>();
  const deadlineMs = Date.parse(backingDeadlineUtc);
  const [deadlinePassed, setDeadlinePassed] = useState(() => Date.now() >= deadlineMs);

  useEffect(() => {
    const saved = localStorage.getItem(recordKey);
    if (saved) {
      const parsed = parseSupporterRecord(saved);
      if (!parsed) {
        localStorage.removeItem(recordKey);
      } else {
        const submitted = {
          ...parsed,
          state: "SUBMITTED" as const,
          ...(parsed.claim
            ? { claim: { ...parsed.claim, state: "SUBMITTED" as const } }
            : {}),
        } satisfies SupporterRecord;
        setRecord(submitted);
        setStatus("SUBMITTED");
        setMessage("Transaction submitted; checking Solana proof until confirmed.");
      }
    }
    const controller = new AbortController();
    void fetch(actionPath, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Action metadata unavailable");
        return response.json() as Promise<ActionMetadata>;
      })
      .then((value) => {
        setMetadata(value);
        const links = value.links?.actions ?? [];
        const open = Date.now() < deadlineMs &&
          links.some((link) => validTransactionAction(link, actionUrl, "alpha")) &&
          links.some((link) => validTransactionAction(link, actionUrl, "beta"));
        setStatus((current) => current === "LOADING" ? "READY" : current);
        setMessage((current) => current === "Loading on-chain backing state…"
          ? open
            ? "Backing is open on Solana devnet until canonical kickoff."
            : value.error?.message ?? "Backing is closed."
          : current);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("ERROR");
        setMessage("On-chain backing state is temporarily unavailable.");
      });
    return () => controller.abort();
  }, [actionPath, actionUrl, deadlineMs, recordKey]);

  useEffect(() => {
    if (!record || record.state !== "SUBMITTED") return;
    let active = true;
    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      const verified = await verifySupporterRecord(
        record,
        arenaAddress,
        programId,
        rpcUrl,
      );
      checking = false;
      if (!active || !verified) return;
      const confirmed = { ...record, state: "CONFIRMED" } satisfies SupporterRecord;
      localStorage.setItem(recordKey, JSON.stringify(confirmed));
      setRecord(confirmed);
      setStatus("CONFIRMED");
      setMessage("Supporter backing verified on Solana devnet.");
    };
    void check();
    const timer = window.setInterval(() => void check(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [arenaAddress, programId, record, recordKey, rpcUrl]);

  useEffect(() => {
    if (!record?.claim || record.state !== "CONFIRMED" || record.claim.state !== "SUBMITTED") {
      return;
    }
    const claim = record.claim;
    let active = true;
    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      const verified = await verifySupporterClaim(
        record,
        claim.signature,
        arenaAddress,
        programId,
        rpcUrl,
      );
      checking = false;
      if (!active || !verified) return;
      const confirmed = {
        ...record,
        claim: { ...claim, state: "CONFIRMED" as const },
      } satisfies SupporterRecord;
      localStorage.setItem(recordKey, JSON.stringify(confirmed));
      setRecord(confirmed);
      setStatus("CONFIRMED");
      setMessage("Supporter claim or refund verified on Solana devnet.");
    };
    void check();
    const timer = window.setInterval(() => void check(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [arenaAddress, programId, record, recordKey, rpcUrl]);

  useEffect(() => {
    if (!Number.isFinite(deadlineMs) || deadlinePassed) return;
    const delay = Math.min(deadlineMs - Date.now(), 2_147_483_647);
    const timer = window.setTimeout(() => {
      setDeadlinePassed(true);
      setReview(undefined);
      setStatus((current) => current === "READY" || current === "REVIEW" ? "READY" : current);
      setMessage("Backing is closed at canonical kickoff.");
    }, Math.max(0, delay));
    return () => window.clearTimeout(timer);
  }, [deadlineMs, deadlinePassed]);

  useEffect(() => {
    if (!finalResultHash) return;
    let active = true;
    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      const verified = await readVerifiedSupporterSettlement(
        finalResultHash,
        arenaAddress,
        programId,
        rpcUrl,
      );
      checking = false;
      if (active && verified) setSettlement(verified);
    };
    void check();
    const timer = window.setInterval(() => void check(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [arenaAddress, finalResultHash, programId, rpcUrl]);

  const actions = useMemo(() => {
    const links = metadata?.links?.actions ?? [];
    return {
      alpha: deadlinePassed
        ? undefined
        : links.find((link) => validTransactionAction(link, actionUrl, "alpha")),
      beta: deadlinePassed
        ? undefined
        : links.find((link) => validTransactionAction(link, actionUrl, "beta")),
      claim: links.find((link) => validClaimAction(link, actionUrl)),
    };
  }, [actionUrl, deadlinePassed, metadata]);

  async function prepareBack(side: "alpha" | "beta") {
    const action = actions[side];
    if (!action) {
      setStatus("ERROR");
      setMessage("Backing is not available for this agent.");
      return;
    }
    if (!validAmount(amount)) {
      setStatus("ERROR");
      setMessage("Enter 0.001 to 1 devnet SOL with at most 9 decimals.");
      return;
    }
    const provider = walletProvider();
    if (!provider) {
      setStatus("ERROR");
      setMessage("A compatible Solana wallet is required only to approve backing.");
      return;
    }
    try {
      setStatus("CONNECTING");
      setMessage("Connecting the wallet for supporter review…");
      const connected = await provider.connect();
      const wallet = connected.publicKey?.toString() ?? provider.publicKey?.toString();
      if (!wallet) throw new Error("Wallet did not provide an address");
      setReview({ side, wallet });
      setStatus("REVIEW");
      setMessage("Review the active wallet, strategy, and amount before signing.");
    } catch (error) {
      setStatus("ERROR");
      setMessage(error instanceof Error ? error.message : "Wallet connection failed");
    }
  }

  async function confirmBack() {
    if (!review || record || deadlinePassed) return;
    const action = actions[review.side];
    const provider = walletProvider();
    if (!action || !provider) {
      setStatus("ERROR");
      setMessage("Backing is no longer available.");
      return;
    }
    try {
      setStatus("SUBMITTING");
      setMessage("Approve the unsigned Arena90 transaction in your wallet.");
      const href = action.href.replace("{amount}", encodeURIComponent(amount));
      const response = await fetch(href, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: review.wallet }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => undefined) as { message?: string } | undefined;
        throw new Error(failure?.message ?? "Action transaction could not be created");
      }
      const payload = await response.json() as { transaction?: string };
      if (!payload.transaction) throw new Error("Action response did not include a transaction");
      const { Transaction } = await import("@solana/web3.js");
      const transaction = Transaction.from(Buffer.from(payload.transaction, "base64"));
      const submitted = await provider.signAndSendTransaction(transaction);
      const signature = typeof submitted === "string" ? submitted : submitted.signature;
      if (!signature) throw new Error("Wallet did not return a transaction signature");
      const nextRecord = {
        agent: review.side,
        amount,
        signature,
        wallet: review.wallet,
        state: "SUBMITTED",
      } satisfies SupporterRecord;
      localStorage.setItem(recordKey, JSON.stringify(nextRecord));
      setRecord(nextRecord);
      setReview(undefined);
      setStatus("SUBMITTED");
      setMessage("Transaction submitted; checking Solana proof until confirmed. Resubmission is disabled.");
    } catch (error) {
      setStatus("ERROR");
      setMessage(error instanceof Error ? error.message : "Supporter transaction failed");
    }
  }

  async function submitClaim() {
    const action = actions.claim;
    const provider = walletProvider();
    if (!record || record.state !== "CONFIRMED" || record.claim || !action) return;
    if (!provider) {
      setStatus("ERROR");
      setMessage("The supporter wallet is required to approve this claim or refund.");
      return;
    }
    try {
      setStatus("CONNECTING");
      setMessage("Connecting the original supporter wallet…");
      const connected = await provider.connect();
      const wallet = connected.publicKey?.toString() ?? provider.publicKey?.toString();
      if (wallet !== record.wallet) {
        throw new Error("Connect the same wallet that owns this supporter position.");
      }
      setStatus("SUBMITTING");
      setMessage("Approve the Arena90 claim or refund in your wallet.");
      const response = await fetch(action.href, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: record.wallet }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => undefined) as { message?: string } | undefined;
        throw new Error(failure?.message ?? "Claim transaction could not be created");
      }
      const payload = await response.json() as { transaction?: string };
      if (!payload.transaction) throw new Error("Action response did not include a transaction");
      const { Transaction } = await import("@solana/web3.js");
      const transaction = Transaction.from(Buffer.from(payload.transaction, "base64"));
      const submitted = await provider.signAndSendTransaction(transaction);
      const signature = typeof submitted === "string" ? submitted : submitted.signature;
      if (!signature) throw new Error("Wallet did not return a transaction signature");
      const nextRecord = {
        ...record,
        claim: { signature, state: "SUBMITTED" as const },
      } satisfies SupporterRecord;
      localStorage.setItem(recordKey, JSON.stringify(nextRecord));
      setRecord(nextRecord);
      setStatus("SUBMITTED");
      setMessage("Claim submitted; checking Solana proof until confirmed.");
    } catch (error) {
      setStatus("ERROR");
      setMessage(error instanceof Error ? error.message : "Supporter claim failed");
    }
  }

  const blinkUrl = canonicalArenaPage(metadata, origin);
  const busy = status === "CONNECTING" || status === "SUBMITTING" || status === "VERIFYING";
  const backingDisabled = busy || Boolean(record) || Boolean(review) || deadlinePassed;

  return (
    <section className="supporter-panel" aria-labelledby="supporter-panel-title">
      <header>
        <div>
          <p className="product-eyebrow">SOLANA SUPPORTER LAYER</p>
          <h2 id="supporter-panel-title">Back the strategy you trust.</h2>
        </div>
        <span>DEVNET SOL</span>
      </header>
      <p className="supporter-panel__boundary">
        Wallet-free watching. Your SOL stays separate from agent bankrolls and never changes strategy.
      </p>
      <dl className="supporter-panel__facts">
        <div><dt>Backing closes</dt><dd>{new Date(backingDeadlineUtc).toLocaleString()}</dd></div>
        <div><dt>On-chain arena</dt><dd>{shortened(arenaAddress)}</dd></div>
      </dl>
      <label className="supporter-panel__amount">
        <span>Amount</span>
        <input
          aria-label="Backing amount in devnet SOL"
          disabled={busy || Boolean(record)}
          inputMode="decimal"
          min="0.001"
          max="1"
          onChange={(event) => setAmount(event.target.value)}
          step="0.001"
          type="number"
          value={amount}
        />
        <strong>SOL</strong>
      </label>
      <div className="supporter-panel__actions">
        <button disabled={backingDisabled || !actions.alpha} onClick={() => void prepareBack("alpha")} type="button">
          Back Alpha
        </button>
        <button disabled={backingDisabled || !actions.beta} onClick={() => void prepareBack("beta")} type="button">
          Back Beta
        </button>
        {record?.state === "CONFIRMED" && actions.claim && !record.claim ? (
          <button onClick={() => void submitClaim()} type="button">Claim or refund</button>
        ) : null}
        {blinkUrl ? (
          <a href={blinkUrl} rel="noreferrer" target="_blank">Share public Blink ↗</a>
        ) : null}
      </div>
      {review ? (
        <div className="supporter-panel__review">
          <div>
            <span>ACTIVE WALLET</span>
            <strong>{shortened(review.wallet)}</strong>
          </div>
          <p>{review.side === "alpha" ? "Alpha" : "Beta"} · {amount} SOL</p>
          <button disabled={busy || deadlinePassed} onClick={() => void confirmBack()} type="button">
            Confirm Back {review.side === "alpha" ? "Alpha" : "Beta"}
          </button>
          <button disabled={busy} onClick={() => {
            setReview(undefined);
            setStatus("READY");
            setMessage("Backing selection cancelled before signing.");
          }} type="button">
            Change selection
          </button>
        </div>
      ) : null}
      <p
        className={`supporter-panel__status supporter-panel__status--${status.toLowerCase()}`}
        role={status === "ERROR" ? "alert" : "status"}
      >
        {message}
      </p>
      {record ? (
        <div className="supporter-panel__proof">
          <strong>{record.state} · {record.agent.toUpperCase()} · {record.amount} SOL</strong>
          <span>{shortened(record.wallet)}</span>
          <a
            href={`https://explorer.solana.com/tx/${record.signature}?cluster=devnet`}
            rel="noreferrer"
            target="_blank"
          >
            View transaction proof ↗
          </a>
        </div>
      ) : null}
      {record?.claim ? (
        <div className="supporter-panel__proof">
          <strong>{record.claim.state === "CONFIRMED" ? "CLAIMED" : "CLAIM SUBMITTED"}</strong>
          <span>{shortened(record.wallet)}</span>
          <a
            href={`https://explorer.solana.com/tx/${record.claim.signature}?cluster=devnet`}
            rel="noreferrer"
            target="_blank"
          >
            View claim proof ↗
          </a>
        </div>
      ) : null}
      {finalResultHash ? (
        settlement ? (
          <div className="supporter-panel__proof">
            <strong>SETTLEMENT VERIFIED</strong>
            <span>{settlement.result.toUpperCase()} · {settlement.finalScore.home}–{settlement.finalScore.away}</span>
            <code>{settlement.finalResultHash}</code>
            <span>TxLINE receipt slot {settlement.verificationSlot}</span>
            <a
              href={`https://explorer.solana.com/address/${arenaAddress}?cluster=devnet`}
              rel="noreferrer"
              target="_blank"
            >
              View arena account ↗
            </a>
          </div>
        ) : (
          <p className="supporter-panel__status" role="status">
            Runtime is final; matching on-chain settlement proof is pending.
          </p>
        )
      ) : null}
    </section>
  );
}
