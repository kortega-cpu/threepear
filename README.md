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
1. **Draft it early.** Save your 3 legs as a **draft** — either type them in yourself, or click "🔎 Research today's picks" to have Claude fill them in for you (see below). Drafts are fully editable and don't touch your stake progression.
2. **Refine if needed.** Once lineups/pitchers are confirmed, open the draft, hit **Edit**, update anything, and save again.
3. **Confirm & lock stake.** When you're ready to actually place the bet, hit **Confirm & lock stake**. This snapshots the stake shown at that moment and starts counting toward your streak. Confirmed entries can no longer be edited — discard a draft before confirming if you made a mistake.
4. **Grade it.** After the games finish, find the entry under History, mark each leg ✓ or ✗, then hit **Finalize day**.
5. The dashboard updates your streak, next stake, and lifetime win rate automatically.

**Why the draft/confirm split matters:** the $10 → $20 → $30 progression only advances off *confirmed* results. You can sketch out placeholder picks days in advance without accidentally messing up your stake math — nothing counts until you explicitly confirm it.

## AI-powered research (optional)

The **"🔎 Research today's picks"** button has Claude search the web for today's slate and auto-fill 3 legs for you to review — the same kind of research we've been doing together in chat, just automated.

**One-time setup:**
1. Create an API key at [console.anthropic.com](https://console.anthropic.com) (Settings → API Keys). This is separate from a Claude Pro subscription — it's pay-as-you-go billing, not a monthly plan.
2. Add a small amount of credit to the account (a few dollars covers a long stretch at this usage level).
3. In the `threepear` folder:
   ```
   cp .env.example .env
   ```
   Then open `.env` and paste your key in place of the placeholder.
4. Restart the app (`pm2 restart threepear` if you're using pm2) so it picks up the new environment variable.

**Cost:** each click does several web searches plus one Claude call — typically a few cents. Running it once a day for a month should only be a dollar or two total.

**How it fits the workflow:** clicking Research fills in the leg fields but does *not* save anything automatically — you still review, edit anything that looks off, and hit **Save as draft** yourself. Nothing gets confirmed (and nothing touches your stake progression) until you explicitly confirm it.

Your `.env` file is git-ignored, so your API key never ends up in your GitHub repo.

## Notes on the numbers
- The "payout" shown on a win is a rough estimate (stake × 2.5, roughly what 3 legs at ~-150 each pays out) — swap in your actual FanDuel payout if you want it to be exact. That logic lives in `server.js` in the `/api/entries/:id/finalize` route if you want to tune it.
- This is a local, single-user tool — no auth, no cloud sync. If you want it on your phone too, the easiest path later is running it on your Mac and hitting `http://<your-mac-ip>:3737` from your phone on the same wifi.

## Roadmap ideas (once the basics feel good)
- Auto-pull probable pitchers / weather via MLB Stats API (free, no key needed) instead of typing reasoning by hand
- A simple `/blog` route that turns finalized entries into shareable write-ups
- CSV export of `entries` + `legs` for deeper analysis later
