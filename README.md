# sleep-compiler

[![npm](https://img.shields.io/npm/v/sleep-compiler)](https://www.npmjs.com/package/sleep-compiler) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Your personal sleep schedule compiler — log, analyze, and improve your sleep.

Track your sleep habits from the command line. All data stored locally in `~/.sleep-compiler/sleep.db`.

## Install

```bash
npm install -g sleep-compiler
```

## Quick Start

```bash
# Start sleeping now, then finish when you wake up
sleep-compiler sleep now
sleep-compiler wake now

# Log last night's sleep
sleep-compiler log --sleep "23:30" --wake "07:15"

# View the last 7 days
sleep-compiler report --days 7

# See all-time stats
sleep-compiler stats
```

## Commands

### `log`

Log a sleep entry.

```bash
sleep-compiler log --sleep "23:30" --wake "07:15"
sleep-compiler log --sleep "00:15" --wake "08:00" --date "2024-03-14"
sleep-compiler log --sleep "22:00" --wake "06:30" --note "Took melatonin"
```

Options:
- `--sleep <HH:MM>` — Bedtime in 24h format (**required**)
- `--wake <HH:MM>` — Wake time in 24h format (**required**)
- `--date <YYYY-MM-DD>` — Date to log (default: today)
- `--note <text>` — Optional note

### `sleep now`

Start a sleep session immediately and save it to `~/.sleep-compiler/pending-sleep.json`.

```bash
sleep-compiler sleep now
```

### `wake now`

Finish the active sleep session, log it to the database, and remove the pending file.

```bash
sleep-compiler wake now
```

If no pending sleep is active, the command prints:

```text
Error: No pending sleep found. Run `sleep-compiler sleep now` first.
```

### `status`

Show whether sleep tracking is currently active.

```bash
sleep-compiler status
```

### `report`

Show a sleep report for the last N days.

```bash
sleep-compiler report
sleep-compiler report --days 14
sleep-compiler report --days 30 --json
```

Options:
- `--days <n>` — Number of days to show (default: 7)
- `--json` — Output raw JSON

Example output:
```
── Sleep Report (last 7 days) ──────────────────────
Date         Bedtime  Wake    Duration  Quality
2024-03-15   23:30    07:15   7h 45m    ✓
2024-03-14   00:15    07:00   6h 45m    ⚠ (< 7h)
2024-03-13   22:00    06:30   8h 30m    ✓

Average duration: 7h 40m
Consistency score: 82% (bedtime variance)
```

### `stats`

Show all-time statistics.

```bash
sleep-compiler stats
```

Shows total entries, average/best/worst durations, best streak, worst week, and consistency score.

### `export`

Export all data as CSV or JSON.

```bash
sleep-compiler export --format csv
sleep-compiler export --format csv > sleep_data.csv
sleep-compiler export --format json
```

Options:
- `--format csv|json` — Output format (default: `csv`)
- `--days <n>` — Only include the last N days

## Quality Thresholds

| Duration | Symbol | Label |
|----------|--------|-------|
| < 6h     | ✗      | poor  |
| 6h–7h    | ⚠      | short |
| 7h–9h    | ✓      | good  |
| > 9h     | ○      | long  |

## Data Storage

All data is stored locally in SQLite at `~/.sleep-compiler/sleep.db`. No cloud, no accounts.
