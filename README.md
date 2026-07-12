# ThreePear 🍐

Daily 3-leg "Over 1.5 Hits+Runs+RBIs" parlay tracker with a paroli (win-progression) staking system.

## Staking logic
- Start at $10/day
- Win → next day's stake = last stake + $10 (10 → 20 → 30 → ...)
- Loss → reset to $10
- The dashboard's "Next stake" card calculates this automatically from your history — you don't have to do the math.

## Setup (on your Mac)

You said Homebrew, Git, Node, VS Code, and Claude Code are already set up — this should be quick.

1. Copy this whole `threepear` folder wherever you keep projects, e.g. `~/dev/threepear`
2. Open a terminal in that folder
3. Install dependencies:
   ```
   npm install
   ```
4. Start the app:
   ```
   npm start
   ```
5. Open **http://localhost:3737** in your browser

Your data lives in `threepear.db` (SQLite) right in the project folder — nothing leaves your machine.

## Daily workflow
1. **Draft it early.** The night before (or whenever you start research), save your 3 legs as a **draft** — player names, teams, reasoning, whatever you've got. Drafts are fully editable and don't touch your stake progression.
2. **Refine in the morning.** Once lineups/pitchers are confirmed, open the draft, hit **Edit**, update the legs, and save again.
3. **Confirm & lock stake.** When you're ready to actually place the bet, hit **Confirm & lock stake** on the draft card. This snapshots the stake shown at that moment and starts counting toward your streak. Confirmed entries can no longer be edited — if you made a mistake, discard a draft before confirming, or delete a confirmed entry via the API if needed.
4. **Grade it.** After the games finish, find the entry under History, mark each leg ✓ or ✗, then hit **Finalize day**.
5. The dashboard updates your streak, next stake, and lifetime win rate automatically.

**Why the draft/confirm split matters:** the $10 → $20 → $30 progression only advances off *confirmed* results. You can sketch out placeholder picks days in advance without accidentally messing up your stake math — nothing counts until you explicitly confirm it.

## Notes on the numbers
- The "payout" shown on a win is a rough estimate (stake × 2.5, roughly what 3 legs at ~-150 each pays out) — swap in your actual FanDuel payout if you want it to be exact. That logic lives in `server.js` in the `/api/entries/:id/finalize` route if you want to tune it.
- This is a local, single-user tool — no auth, no cloud sync. If you want it on your phone too, the easiest path later is running it on your Mac and hitting `http://<your-mac-ip>:3737` from your phone on the same wifi.

## Roadmap ideas (once the basics feel good)
- Auto-pull probable pitchers / weather via MLB Stats API (free, no key needed) instead of typing reasoning by hand
- A simple `/blog` route that turns finalized entries into shareable write-ups
- CSV export of `entries` + `legs` for deeper analysis later
