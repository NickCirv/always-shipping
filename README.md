# always-shipping 🚢

Your side project misses you.

Set it up once. Get guilt-tripped every evening you don't commit.
Track your streak. Never let it die.

---

## Install

```bash
# Clone and link globally
git clone https://github.com/NickCirv/always-shipping.git
cd always-shipping
chmod +x index.js
npm link

# Or run directly
node index.js setup
```

**Requires Node.js 18+**

---

## Setup (30 seconds)

```bash
always-shipping setup
```

You'll be asked for:
- Your GitHub username
- Telegram bot token + chat ID (optional but recommended)
- What hour to check (default: 8pm)
- Local repo paths to scan (optional)

Config is saved to `~/.always-shipping.json`.

---

## Cron Setup

Add to your crontab (`crontab -e`):

```
# Check every day at 8pm
0 20 * * * node /path/to/always-shipping/index.js check
```

Or use the exact command printed at the end of `setup`.

---

## Telegram Setup

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Create a new bot: `/newbot`
3. Copy the bot token (looks like `123456:ABC-DEF1234...`)
4. Message your bot once to start a chat
5. Get your chat ID: visit `https://api.telegram.org/bot<TOKEN>/getUpdates` after sending a message
6. Pass it as `BOT_TOKEN:CHAT_ID` during setup or with `--telegram`

---

## Commands

```bash
# Interactive setup wizard
always-shipping setup

# Run the check (sends message if configured)
always-shipping check

# Check with CLI args (overrides config)
always-shipping check --github octocat --telegram 123456:789 --hour 21

# View streak stats (no messages sent)
always-shipping streak
always-shipping streak --github octocat
```

---

## Streak Tracking

Your streak data lives in `~/.always-shipping.json`:

```json
{
  "github": "octocat",
  "telegram": "token:chatid",
  "current_streak": 7,
  "longest_streak": 12,
  "last_ship_date": "2026-03-02",
  "no_ship_days": 0,
  "check_hour": 20,
  "history": []
}
```

The tool tracks:
- **Current streak** — consecutive days with at least one commit
- **Longest streak** — your personal best
- **No-ship days** — how many days you've gone without committing (guilt multiplier)
- **History** — last 90 days of ship/no-ship records

---

## How It Detects Commits

1. GitHub Events API — checks `PushEvent`, `CreateEvent`, `PullRequestEvent`, `ReleaseEvent` for today
2. Local git repos — scans configured paths (or common defaults like `~/Desktop`, `~/dev`) for commits since midnight

If either source finds a commit, you shipped. Streak continues.

---

## The Messages

**When you ship:**
- "Shipped. Day 7. Keep going."
- "Commit detected at 20:14. Streak alive: 12 days. 🔥"
- "Another one. 21 days straight. You're the consistency guy now."

**When you don't:**
- "0 commits today. That project isn't going to ship itself."
- "You had a 9-day streak. Had. Past tense. Now you have: zero."
- "14 DAYS. Gone. I hope whatever you did instead was worth it."
- "Day 3 without a commit. Are you okay? Blink twice if you need help."

Messages escalate based on the streak you broke and how many days you've gone without committing.

---

## Why

Most productivity tools reward you when you do the work. This one punishes you when you don't.

Shipping consistently is the single biggest predictor of whether a side project survives. Not talent. Not the idea. Not the tech stack. Consistency.

One commit a day keeps the momentum alive. It doesn't have to be big. It just has to exist.

Set this up, add it to cron, and let it hold you accountable.

---

## License

MIT
