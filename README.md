<div align="center">

# always-shipping

**Accountability bot that guilt-trips you every evening you don't commit**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue?labelColor=0B0A09)](LICENSE)
[![Node: >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen?labelColor=0B0A09)](https://nodejs.org)

</div>

## Install

```bash
npx github:NickCirv/always-shipping setup
```

No global install required. Config is saved to `~/.always-shipping.json`.

## Usage

```bash
# Interactive setup — GitHub username, Telegram bot, check hour
npx github:NickCirv/always-shipping setup

# Run the daily check (wire this into cron)
npx github:NickCirv/always-shipping check

# View streak stats without sending messages
npx github:NickCirv/always-shipping streak
```

| Flag | Description |
|------|-------------|
| `--github USERNAME` | GitHub username to check |
| `--telegram BOT_TOKEN:CHAT_ID` | Telegram delivery (overrides config) |
| `--hour N` | Hour to run the check, 0–23 (default: 20) |

## What it does

Set it up once, add it to cron, and it checks your GitHub Events API (plus local git repos) every evening. If you shipped something, you get a streak message. If you didn't, the guilt trip escalates based on how long the streak you just broke was and how many days in a row you've gone quiet.

Messages scale: a broken 3-day streak gets a nudge. A broken 14-day streak gets something worse. The no-ship-day counter tracks how long you've been silent and keeps piling on.

Streak data (current, longest, last 90 days) is stored locally in `~/.always-shipping.json`.

## Cron setup

Add to crontab (`crontab -e`) — the `setup` command prints the exact line:

```
0 20 * * * node /path/to/always-shipping/index.js check
```

## Telegram setup

1. Message [@BotFather](https://t.me/botfather) → `/newbot` → copy the token
2. Message your bot once to open a chat
3. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates` after sending a message to get your chat ID
4. Pass as `BOT_TOKEN:CHAT_ID` during setup or with `--telegram`

---

<sub>Zero dependencies · Node >=18 · MIT · by <a href="https://github.com/NickCirv">NickCirv</a></sub>
