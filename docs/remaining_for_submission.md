# Remaining Submission Checklist

These are the only pieces still left because they require a live run, your screen, or hackathon portal access.

## Required

- Record a 60-90 second demo video.
- Create/export the required 3-6 slide pitch deck as PDF or Figma link.
- Add the demo video link to the hackathon submission form.
- Add the pitch deck link/file to the hackathon submission form.
- Add one dashboard screenshot or GIF to the README.
- Add Solana Explorer devnet transaction links from a settled demo payment.
- Submit the repo link: `https://github.com/Mfoniso-Jackson/omniquantai-coralos`.
- Submit team names.

## Strongly Recommended

- Build the deck from `docs/pitch_deck_outline.md`.
- Run the full local demo once before recording:

```sh
docker compose up -d coral
bash build-agents.sh
npm run marketplace
npm run marketplace:web
```

- Capture these moments in the video:
  - buyer sends the NVDA research request,
  - four seller agents bid,
  - buyer chooses best value,
  - Solana devnet escrow deposit appears,
  - winning seller delivers the report,
  - escrow release appears,
  - dashboard shows the final intelligence panel.

## Nice To Have

- Add the best Solana Explorer transaction links from your demo run.
- Add a short Loom/YouTube title: `OmniQuantAI: Financial research agents that earn via Solana escrow`.
- Pin the GitHub repo on your profile during judging.

## Do Not Add Before Submission

- Live trading.
- Mainnet settlement.
- Complex auth.
- Too many live data APIs.
- Anything that can make the demo flaky.
