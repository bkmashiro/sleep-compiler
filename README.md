# sleep-compiler

Your personal sleep schedule compiler — log, analyze, and improve your sleep.

Track your sleep habits from the command line. All data stored locally in `~/.sleep-compiler/sleep.db`.

## Install

```bash
npm install -g sleep-compiler
```

## Quick Start

```bash
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

Export all data as CSV.

```bash
sleep-compiler export --format csv
sleep-compiler export --format csv > sleep_data.csv
```

## Quality Thresholds

| Duration | Symbol | Label |
|----------|--------|-------|
| < 6h     | ✗      | poor  |
| 6h–7h    | ⚠      | short |
| 7h–9h    | ✓      | good  |
| > 9h     | ○      | long  |

## Data Storage

All data is stored locally in SQLite at `~/.sleep-compiler/sleep.db`. No cloud, no accounts.
