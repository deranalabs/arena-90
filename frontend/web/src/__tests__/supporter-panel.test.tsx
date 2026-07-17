import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SupporterPanel } from "@/components/solana/SupporterPanel";
import { verifySupporterRecord } from "../lib/solana-actions/supporter-proof";

jest.mock("../lib/solana-actions/supporter-proof", () => ({
  parseSupporterRecord: jest.fn((value: string) => JSON.parse(value)),
  verifySupporterRecord: jest.fn(),
}));

const transactionFrom = jest.fn(() => ({}));

jest.mock("@solana/web3.js", () => ({
  Transaction: { from: (...args: unknown[]) => transactionFrom(...args) },
}));

const arenaAddress = "4Fch1s6fV1QTbBzLFxd5VUPq82oMdnE1SSpx28Md1Vz2";
const programId = "3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ";
const rpcUrl = "https://api.devnet.solana.com";

function actionResponse() {
  return {
    type: "action",
    title: "Back an Arena90 agent",
    label: "Choose an agent",
    disabled: false,
    links: {
      actions: [
        {
          type: "transaction",
          href: `https://arena90.xyz/actions/arena/${arenaAddress}/back/alpha?amount={amount}`,
          label: "Back Alpha",
        },
        {
          type: "transaction",
          href: `https://arena90.xyz/actions/arena/${arenaAddress}/back/beta?amount={amount}`,
          label: "Back Beta",
        },
        {
          type: "external-link",
          href: "https://arena90.xyz/arena/world-cup-final",
          label: "View Arena",
        },
      ],
    },
  };
}

describe("SupporterPanel", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    localStorage.clear();
    global.fetch = jest.fn();
    delete (window as typeof window & { solana?: unknown }).solana;
    jest.mocked(verifySupporterRecord).mockResolvedValue(false);
    jest.useFakeTimers({ now: new Date("2026-07-18T12:00:00.000Z") });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows canonical Blink backing without requiring a wallet to watch", async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => actionResponse(),
    } as Response);

    render(
      <SupporterPanel
        arenaAddress={arenaAddress}
        backingDeadlineUtc="2026-07-18T21:00:00.000Z"
        programId={programId}
        publicOrigin="https://arena90.xyz"
        rpcUrl={rpcUrl}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back Alpha" })).toBeEnabled();
    });
    expect(screen.getByRole("button", { name: "Back Beta" })).toBeEnabled();
    expect(screen.getByRole("link", { name: /share public blink/i })).toHaveAttribute(
      "href",
      "https://arena90.xyz/arena/world-cup-final",
    );
    expect(document.body).toHaveTextContent(/wallet-free watching/i);
  });

  it("shows wallet absence honestly only after a supporter chooses to back", async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => actionResponse(),
    } as Response);

    render(
      <SupporterPanel
        arenaAddress={arenaAddress}
        backingDeadlineUtc="2026-07-18T21:00:00.000Z"
        programId={programId}
        publicOrigin="https://arena90.xyz"
        rpcUrl={rpcUrl}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back Alpha" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Back Alpha" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/compatible solana wallet/i);
    });
  });

  it("rejects an invalid amount before connecting a wallet", async () => {
    const connect = jest.fn();
    Object.assign(window, { solana: { connect, signAndSendTransaction: jest.fn() } });
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => actionResponse(),
    } as Response);

    render(
      <SupporterPanel
        arenaAddress={arenaAddress}
        backingDeadlineUtc="2026-07-18T21:00:00.000Z"
        programId={programId}
        publicOrigin="https://arena90.xyz"
        rpcUrl={rpcUrl}
      />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Back Alpha" })).toBeEnabled());
    fireEvent.change(screen.getByRole("spinbutton", { name: /backing amount/i }), {
      target: { value: "1.000000001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Back Alpha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/0\.001 to 1/i);
    expect(connect).not.toHaveBeenCalled();
  });

  it("treats View Arena-only metadata as closed", async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ...actionResponse(),
        disabled: false,
        links: {
          actions: [{
            type: "external-link",
            href: "https://arena90.xyz/arena/demo",
            label: "View Arena",
          }],
        },
      }),
    } as Response);

    render(
      <SupporterPanel
        arenaAddress={arenaAddress}
        backingDeadlineUtc="2026-07-18T21:00:00.000Z"
        programId={programId}
        publicOrigin="https://arena90.xyz"
        rpcUrl={rpcUrl}
      />,
    );

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/closed/i));
    expect(screen.getByRole("button", { name: "Back Alpha" })).toBeDisabled();
    expect(document.body).not.toHaveTextContent(/backing is open/i);
  });

  it("closes locally at the immutable backing deadline", async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => actionResponse(),
    } as Response);

    render(
      <SupporterPanel
        arenaAddress={arenaAddress}
        backingDeadlineUtc="2026-07-18T12:00:01.000Z"
        programId={programId}
        publicOrigin="https://arena90.xyz"
        rpcUrl={rpcUrl}
      />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Back Alpha" })).toBeEnabled());

    act(() => jest.advanceTimersByTime(1_100));

    await waitFor(() => expect(screen.getByRole("button", { name: "Back Alpha" })).toBeDisabled());
    expect(screen.getByRole("status")).toHaveTextContent(/closed/i);
  });

  it("shows wallet, side, and amount for review before asking the wallet to sign", async () => {
    const signAndSendTransaction = jest.fn();
    Object.assign(window, {
      solana: {
        connect: jest.fn().mockResolvedValue({ publicKey: { toString: () => arenaAddress } }),
        signAndSendTransaction,
      },
    });
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => actionResponse(),
    } as Response);

    render(
      <SupporterPanel
        arenaAddress={arenaAddress}
        backingDeadlineUtc="2026-07-18T21:00:00.000Z"
        programId={programId}
        publicOrigin="https://arena90.xyz"
        rpcUrl={rpcUrl}
      />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Back Alpha" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Back Alpha" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm Back Alpha" })).toBeEnabled());
    expect(screen.getAllByText(/4Fch1s…Md1Vz2/i)).toHaveLength(2);
    expect(screen.getByText(/Alpha · 0\.01 SOL/i)).toBeInTheDocument();
    expect(signAndSendTransaction).not.toHaveBeenCalled();
  });

  it("persists submitted proof before network confirmation", async () => {
    const signature = "5".repeat(88);
    const signAndSendTransaction = jest.fn().mockResolvedValue({ signature });
    Object.assign(window, {
      solana: {
        connect: jest.fn().mockResolvedValue({ publicKey: { toString: () => arenaAddress } }),
        signAndSendTransaction,
      },
    });
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => actionResponse() } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transaction: Buffer.from("transaction").toString("base64") }),
      } as Response);

    render(
      <SupporterPanel
        arenaAddress={arenaAddress}
        backingDeadlineUtc="2026-07-18T21:00:00.000Z"
        programId={programId}
        publicOrigin="https://arena90.xyz"
        rpcUrl={rpcUrl}
      />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Back Beta" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Back Beta" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm Back Beta" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Confirm Back Beta" }));

    await waitFor(() => expect(signAndSendTransaction).toHaveBeenCalledTimes(1));
    const stored = JSON.parse(localStorage.getItem(`arena90:supporter:${arenaAddress}`) ?? "null");
    expect(stored).toMatchObject({ state: "SUBMITTED", signature, agent: "beta" });
    expect(screen.getByText(/SUBMITTED · BETA · 0\.01 SOL/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back Alpha" })).toBeDisabled();
  });

  it("never trusts a stored confirmation until Solana and the position account verify it", async () => {
    const signature = "5".repeat(88);
    localStorage.setItem(`arena90:supporter:${arenaAddress}`, JSON.stringify({
      agent: "alpha",
      amount: "0.01",
      signature,
      wallet: arenaAddress,
      state: "CONFIRMED",
    }));
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => actionResponse(),
    } as Response);

    render(
      <SupporterPanel
        arenaAddress={arenaAddress}
        backingDeadlineUtc="2026-07-18T21:00:00.000Z"
        programId={programId}
        publicOrigin="https://arena90.xyz"
        rpcUrl={rpcUrl}
      />,
    );

    await waitFor(() => expect(verifySupporterRecord).toHaveBeenCalled());
    expect(document.body).not.toHaveTextContent(/CONFIRMED · ALPHA/i);
    expect(screen.getByText(/SUBMITTED · ALPHA/i)).toBeInTheDocument();
  });

  it("keeps polling a submitted record and advances only after proof verifies", async () => {
    const signature = "5".repeat(88);
    localStorage.setItem(`arena90:supporter:${arenaAddress}`, JSON.stringify({
      agent: "alpha",
      amount: "0.01",
      signature,
      wallet: arenaAddress,
      state: "SUBMITTED",
    }));
    jest.mocked(verifySupporterRecord)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => actionResponse(),
    } as Response);

    render(
      <SupporterPanel
        arenaAddress={arenaAddress}
        backingDeadlineUtc="2026-07-18T21:00:00.000Z"
        programId={programId}
        publicOrigin="https://arena90.xyz"
        rpcUrl={rpcUrl}
      />,
    );
    await waitFor(() => expect(verifySupporterRecord).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/SUBMITTED · ALPHA/i)).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(5_000));

    await waitFor(() => expect(screen.getByText(/CONFIRMED · ALPHA/i)).toBeInTheDocument());
  });
});
