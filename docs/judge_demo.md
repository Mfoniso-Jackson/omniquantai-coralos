# One-Command Judge Demo

The fastest way to record or judge the full OmniQuantAI loop is:

```sh
npm run demo:omniquant
```

If your shell does not have `npm`, use:

```sh
pnpm run demo:omniquant
```

## What It Does

The command:

1. creates `.env` and devnet wallets if missing,
2. reminds you which buyer wallet needs devnet SOL,
3. checks Docker,
4. starts CoralOS,
5. builds the buyer/seller agent images,
6. starts the marketplace feed,
7. starts the React dashboard,
8. launches one OmniQuantAI market round,
9. prints a presentation URL.

The presentation URL looks like:

```text
http://localhost:5173/?session=<session-id>&presentation=1
```

## Before Running

Fund the buyer wallet with devnet SOL:

```text
https://faucet.solana.com
```

Add an LLM key to `.env` if you want richer bid reasoning. The demo has deterministic safeguards so the core market can still be explained reliably.

## What To Record

In the presentation page, show:

- the research request,
- four seller agents,
- buyer best-value selection,
- escrow deposit link,
- delivered intelligence report,
- escrow release link.

Copy the Solana Explorer links from the settlement badges after the round settles.

## Stop The Demo

Press `Ctrl+C` in the terminal running `npm run demo:omniquant`.
