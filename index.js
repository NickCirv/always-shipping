#!/usr/bin/env node

import { createInterface } from 'readline'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { execFileSync } from 'child_process'
import { join } from 'path'

const CONFIG_PATH = join(homedir(), '.always-shipping.json')

// ─── Config ───────────────────────────────────────────────────────────────────

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return {}
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

// ─── Messages ─────────────────────────────────────────────────────────────────

function getGuiltMessage(streak, noShipDays) {
  if (noShipDays >= 2) {
    const msgs = [
      `Day ${noShipDays} without a commit. Are you okay? Blink twice if you need help.`,
      `It's been ${noShipDays} days. Your repos have cobwebs. Metaphorical cobwebs.`,
      `${noShipDays} days of silence. Your GitHub profile is starting to look abandoned.`,
      `${noShipDays} days. The grass is growing over your codebase.`
    ]
    return msgs[noShipDays % msgs.length]
  }

  if (streak >= 15) {
    const msgs = [
      `${streak} DAYS. Gone. I hope whatever you did instead was worth it.`,
      `You built something every day for ${streak} days and today you couldn't find 5 minutes. Interesting choice.`,
      `${streak}-day streak. Evaporated. Just like that. Your future self is disappointed.`
    ]
    return msgs[Math.floor(Math.random() * msgs.length)]
  }

  if (streak >= 6) {
    const msgs = [
      `You had a ${streak}-day streak. Had. Past tense. Now you have: zero.`,
      `${streak} days of consistency. Gone. In one day. For what?`,
      `The streak is dead. ${streak} days. Moment of silence. Now open your editor.`,
      `${streak} days of momentum, cancelled by one evening of nothing.`
    ]
    return msgs[Math.floor(Math.random() * msgs.length)]
  }

  // streak 0-5
  const msgs = [
    `0 commits today. That project isn't going to ship itself.`,
    `Another quiet day on GitHub. Your side project called — went to voicemail.`,
    `No commits. Even your localhost is judging you.`,
    `Your repos are waiting. They're very patient. You're testing that patience.`,
    `Somewhere, a developer committed 47 times today. You committed zero.`
  ]
  return msgs[Math.floor(Math.random() * msgs.length)]
}

function getSuccessMessage(streak, time) {
  const msgs = [
    `Shipped. Day ${streak}. Keep going.`,
    `Commit detected at ${time}. Streak alive: ${streak} days. 🔥`,
    `Another one. ${streak} days straight. You're the consistency guy now.`,
    `Day ${streak}. Still going. Don't stop.`,
    `${streak}-day streak intact. Respect.`
  ]
  return msgs[streak % msgs.length]
}

// ─── GitHub ───────────────────────────────────────────────────────────────────

async function fetchGitHubEvents(username) {
  const url = `https://api.github.com/users/${encodeURIComponent(username)}/events?per_page=100`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'always-shipping-cli'
    },
    signal: AbortSignal.timeout(15000)
  })

  if (!res.ok) {
    if (res.status === 404) throw new Error(`GitHub user '${username}' not found.`)
    if (res.status === 403) throw new Error('GitHub rate limit hit. Try again later.')
    throw new Error(`GitHub API error: ${res.status}`)
  }

  return res.json()
}

function todayString() {
  return new Date().toISOString().split('T')[0]
}

function hasShippedOnGitHub(events) {
  const today = todayString()
  const shippableTypes = ['PushEvent', 'CreateEvent', 'PullRequestEvent', 'ReleaseEvent']

  return events.some(event => {
    const eventDate = event.created_at?.split('T')[0]
    return eventDate === today && shippableTypes.includes(event.type)
  })
}

// ─── Local Git ────────────────────────────────────────────────────────────────

function hasGitCommitToday(dirPath) {
  const today = todayString()
  try {
    const result = execFileSync('git', [
      '-C', dirPath,
      'log', '--oneline',
      `--since=${today} 00:00:00`
    ], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
    return result.length > 0
  } catch {
    return false
  }
}

function listSubdirs(dirPath) {
  try {
    return readdirSync(dirPath)
      .map(name => join(dirPath, name))
      .filter(p => {
        try { return statSync(p).isDirectory() } catch { return false }
      })
      .slice(0, 25) // cap scan depth
  } catch {
    return []
  }
}

function findLocalCommits(repoPaths) {
  const searchPaths = repoPaths && repoPaths.length > 0
    ? repoPaths
    : [
        join(homedir(), 'Desktop'),
        join(homedir(), 'dev'),
        join(homedir(), 'projects'),
        join(homedir(), 'code'),
        join(homedir(), 'work')
      ]

  for (const searchPath of searchPaths) {
    if (!existsSync(searchPath)) continue

    // Check if the path itself is a git repo
    if (hasGitCommitToday(searchPath)) return true

    // Check one level deep
    for (const subdir of listSubdirs(searchPath)) {
      if (hasGitCommitToday(subdir)) return true
    }
  }

  return false
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(telegramConfig, message) {
  const colonIdx = telegramConfig.indexOf(':')
  if (colonIdx === -1) throw new Error('Invalid Telegram config. Format: BOT_TOKEN:CHAT_ID')

  const token = telegramConfig.slice(0, colonIdx)
  const chatId = telegramConfig.slice(colonIdx + 1)

  if (!token || !chatId) throw new Error('Invalid Telegram config. Format: BOT_TOKEN:CHAT_ID')

  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
    signal: AbortSignal.timeout(10000)
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Telegram error: ${body.description || res.status}`)
  }

  return res.json()
}

// ─── Streak ───────────────────────────────────────────────────────────────────

function updateStreakShipped(config) {
  const today = todayString()
  const lastShip = config.last_ship_date

  let newStreak = config.current_streak || 0

  if (lastShip === today) {
    // Already counted today — no change
  } else {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    if (lastShip === yesterdayStr) {
      newStreak += 1
    } else {
      newStreak = 1
    }
  }

  const longestStreak = Math.max(config.longest_streak || 0, newStreak)

  return {
    ...config,
    current_streak: newStreak,
    longest_streak: longestStreak,
    last_ship_date: today,
    no_ship_days: 0,
    history: addHistory(config.history || [], { date: today, shipped: true, streak: newStreak })
  }
}

function updateStreakMissed(config) {
  const today = todayString()
  const noShipDays = (config.no_ship_days || 0) + 1

  return {
    ...config,
    current_streak: 0,
    no_ship_days: noShipDays,
    history: addHistory(config.history || [], { date: today, shipped: false, streak: 0 })
  }
}

function addHistory(history, entry) {
  const today = todayString()
  const filtered = history.filter(h => h.date !== today)
  return [...filtered, entry].slice(-90) // keep last 90 days
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function cmdCheck(args) {
  const config = loadConfig()

  const github = args.github || config.github
  const telegram = args.telegram || config.telegram
  const hour = parseInt(args.hour ?? config.check_hour ?? 20, 10)
  const repoPaths = config.repo_paths || []

  if (!github) {
    console.error('Error: --github USERNAME required (or run `always-shipping setup`)')
    process.exit(1)
  }

  const currentHour = new Date().getHours()
  if (currentHour < hour) {
    console.log(`Too early, check back at ${hour}:00`)
    process.exit(0)
  }

  console.log(`Checking GitHub activity for @${github}...`)

  let shipped = false

  try {
    const events = await fetchGitHubEvents(github)
    shipped = hasShippedOnGitHub(events)
    console.log(`  GitHub: ${shipped ? 'commit found.' : 'no commits today.'}`)
  } catch (err) {
    console.warn(`  GitHub check failed: ${err.message}`)
  }

  if (!shipped) {
    console.log('  Checking local git repos...')
    shipped = findLocalCommits(repoPaths)
    console.log(`  Local git: ${shipped ? 'commit found.' : 'nothing.'}`)
  }

  const now = new Date()
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`

  const updatedConfig = { ...config, github, check_hour: hour }
  if (telegram) updatedConfig.telegram = telegram

  if (shipped) {
    const updated = updateStreakShipped(updatedConfig)
    saveConfig(updated)
    const msg = getSuccessMessage(updated.current_streak, timeStr)
    console.log(`\n${msg}`)

    if (telegram) {
      try {
        await sendTelegram(telegram, msg)
        console.log('Telegram: sent.')
      } catch (err) {
        console.warn(`Telegram failed: ${err.message}`)
      }
    }
  } else {
    const previousStreak = config.current_streak || 0
    const updated = updateStreakMissed(updatedConfig)
    saveConfig(updated)
    const msg = getGuiltMessage(previousStreak, updated.no_ship_days)
    console.log(`\n${msg}`)

    if (telegram) {
      try {
        await sendTelegram(telegram, msg)
        console.log('Telegram: guilt trip sent.')
      } catch (err) {
        console.warn(`Telegram failed: ${err.message}`)
      }
    }
  }
}

async function cmdStreak(args) {
  const config = loadConfig()
  const github = args.github || config.github

  if (!github) {
    console.error('Error: --github USERNAME required (or run `always-shipping setup`)')
    process.exit(1)
  }

  const streak = config.current_streak || 0
  const longest = config.longest_streak || 0
  const lastShip = config.last_ship_date || 'never'
  const noShipDays = config.no_ship_days || 0
  const today = todayString()
  const shippedToday = config.last_ship_date === today

  console.log(`\n── Streak Stats for @${github} ──`)
  console.log(`Current streak : ${streak} day${streak !== 1 ? 's' : ''}`)
  console.log(`Longest streak : ${longest} day${longest !== 1 ? 's' : ''}`)
  console.log(`Last shipped   : ${lastShip}`)
  console.log(`Shipped today  : ${shippedToday ? 'yes' : 'no'}`)
  if (noShipDays > 0) {
    console.log(`Days without   : ${noShipDays}`)
  }

  if (config.history && config.history.length > 0) {
    const last7 = config.history.slice(-7)
    const dots = last7.map(h => h.shipped ? '✓' : '✗').join(' ')
    console.log(`Last 7 days    : ${dots}`)
  }

  console.log('')
}

async function cmdSetup() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const ask = (q) => new Promise(resolve => rl.question(q, resolve))

  console.log('\n── always-shipping setup ──\n')

  const existing = loadConfig()

  const github = (await ask(`GitHub username [${existing.github || ''}]: `)).trim() || existing.github || ''
  const telegramInput = (await ask(`Telegram (BOT_TOKEN:CHAT_ID) [${existing.telegram ? '***configured***' : 'skip'}]: `)).trim()
  const telegram = telegramInput || existing.telegram || ''
  const hourInput = (await ask(`Check hour in 24h (default 20 = 8pm) [${existing.check_hour ?? 20}]: `)).trim()
  const checkHour = parseInt(hourInput || String(existing.check_hour ?? 20), 10)
  const repoPathsInput = (await ask(`Comma-separated local repo paths to scan [optional, Enter to skip]: `)).trim()
  const repoPaths = repoPathsInput
    ? repoPathsInput.split(',').map(p => p.trim()).filter(Boolean)
    : existing.repo_paths || []

  rl.close()

  if (!github) {
    console.error('\nGitHub username is required.')
    process.exit(1)
  }

  const config = {
    ...existing,
    github,
    ...(telegram && { telegram }),
    check_hour: checkHour,
    ...(repoPaths.length > 0 && { repo_paths: repoPaths }),
    current_streak: existing.current_streak || 0,
    longest_streak: existing.longest_streak || 0,
    last_ship_date: existing.last_ship_date || null,
    no_ship_days: existing.no_ship_days || 0,
    history: existing.history || []
  }

  saveConfig(config)

  const indexPath = new URL(import.meta.url).pathname

  console.log(`\nSaved to ${CONFIG_PATH}`)
  console.log('\n── Add to crontab (crontab -e): ──')
  console.log(`0 ${checkHour} * * * node ${indexPath} check\n`)
  console.log('Run `always-shipping check` to test it now.')
}

// ─── CLI Parse ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
    }
  }
  return args
}

function printHelp() {
  console.log(`
always-shipping — accountability bot for developers

COMMANDS:
  setup                        Interactive setup wizard
  check [options]              Run the daily check
  streak [options]             Show streak stats (no messages sent)

OPTIONS:
  --github USERNAME            GitHub username
  --telegram BOT_TOKEN:CHATID  Telegram delivery
  --hour N                     Hour to check (0-23, default: 20)

EXAMPLES:
  always-shipping setup
  always-shipping check --github octocat --telegram 123:456 --hour 21
  always-shipping streak --github octocat

Config saved to: ~/.always-shipping.json
`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [,, command, ...rest] = process.argv
const args = parseArgs(rest)

switch (command) {
  case 'check':
    await cmdCheck(args)
    break
  case 'streak':
    await cmdStreak(args)
    break
  case 'setup':
    await cmdSetup()
    break
  default:
    printHelp()
    break
}
