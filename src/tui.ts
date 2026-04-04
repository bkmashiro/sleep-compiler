import blessed from 'blessed';
import { format, isToday, parseISO } from 'date-fns';
import { getEntries, getStats } from './db.js';
import { formatDuration } from './formatter.js';
import { getGoalHours, getGoalSummary } from './goal.js';
import { calcConsistencyScore, classifySleepQuality } from './utils.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function qualityColor(minutes: number): string {
  const q = classifySleepQuality(minutes);
  if (q === 'good') return '{green-fg}';
  if (q === 'short') return '{yellow-fg}';
  if (q === 'long') return '{cyan-fg}';
  return '{red-fg}';
}

function qualityIcon(minutes: number): string {
  const q = classifySleepQuality(minutes);
  if (q === 'good') return '✓';
  if (q === 'short') return '⚠';
  if (q === 'long') return '○';
  return '✗';
}

function statusTag(status: 'hit' | 'near' | 'miss'): string {
  if (status === 'hit') return '{green-fg}●{/green-fg}';
  if (status === 'near') return '{yellow-fg}●{/yellow-fg}';
  return '{red-fg}●{/red-fg}';
}

// ─── panel builders ──────────────────────────────────────────────────────────

function buildGoalPanel(): string {
  const goalHours = getGoalHours();
  if (goalHours === null) {
    return [
      '{bold}Sleep Goal{/bold}',
      '',
      '{gray-fg}No goal set.{/gray-fg}',
      '{gray-fg}Run: sleep-compiler goal set <hours>{/gray-fg}',
    ].join('\n');
  }

  const summary = getGoalSummary(goalHours);
  const lines: string[] = [
    `{bold}Sleep Goal{/bold}  {cyan-fg}${goalHours}h target{/cyan-fg}`,
    '',
  ];

  for (const day of summary.days) {
    const today = isToday(parseISO(day.date));
    const prefix = today ? '{bold}' : '';
    const suffix = today ? '{/bold}' : '';
    const delta =
      day.deltaHours >= 0
        ? `{green-fg}+${day.deltaHours.toFixed(1)}h{/green-fg}`
        : `{red-fg}${day.deltaHours.toFixed(1)}h{/red-fg}`;
    const filled = Math.min(14, Math.max(0, Math.round(day.hours * 2)));
    const barStr = `{cyan-fg}${'█'.repeat(filled)}{/cyan-fg}${'░'.repeat(14 - filled)}`;
    lines.push(
      `${prefix}${day.label.padEnd(4)}${barStr} ${day.hours.toFixed(1)}h ${delta} ${statusTag(day.status)}${suffix}`
    );
  }

  lines.push('');
  lines.push(
    `Weekly avg {bold}${summary.weeklyAverage.toFixed(1)}h{/bold}  ` +
    `Hit rate {bold}${summary.hitCount}/${summary.totalDays}{/bold} (${summary.hitRate}%)`
  );

  return lines.join('\n');
}

function buildTodayPanel(): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const entries = getEntries(1);
  const todayEntry = entries.find((e) => e.date === today);
  const goalHours = getGoalHours();

  const lines: string[] = ['{bold}Today{/bold}  ' + `{gray-fg}${format(new Date(), 'EEE, MMM d')}{/gray-fg}`, ''];

  if (todayEntry) {
    const q = classifySleepQuality(todayEntry.duration_minutes);
    const qc = qualityColor(todayEntry.duration_minutes);
    lines.push(`Slept   {bold}${todayEntry.sleep_time}{/bold} → {bold}${todayEntry.wake_time}{/bold}`);
    lines.push(`Duration ${qc}{bold}${formatDuration(todayEntry.duration_minutes)}{/bold}{/${qc.slice(1)}`);
    lines.push(`Quality  ${qc}${qualityIcon(todayEntry.duration_minutes)} ${q}{/${qc.slice(1)}`);
    if (todayEntry.note) {
      lines.push('');
      lines.push(`Note: {italic}${todayEntry.note}{/italic}`);
    }
    if (goalHours !== null) {
      const deficit = goalHours * 60 - todayEntry.duration_minutes;
      lines.push('');
      if (deficit <= 0) {
        lines.push(`{green-fg}✓ Goal reached (+${formatDuration(Math.abs(deficit))}){/green-fg}`);
      } else {
        lines.push(`{yellow-fg}⚠ ${formatDuration(deficit)} under goal{/yellow-fg}`);
      }
    }
  } else {
    lines.push('{gray-fg}No entry for today.{/gray-fg}');
    lines.push('');
    lines.push('Log sleep:');
    lines.push('{cyan-fg}sleep-compiler log <sleep> <wake>{/cyan-fg}');
    lines.push('{gray-fg}e.g. sleep-compiler log 23:30 07:00{/gray-fg}');
  }

  // ─── suggested schedule ───
  lines.push('');
  lines.push('{bold}Suggested tonight{/bold}');
  const targetBed = '23:00';
  const targetWake = goalHours !== null ? (() => {
    const [bh, bm] = targetBed.split(':').map(Number);
    const wakeMinutes = (bh * 60 + bm + goalHours * 60) % (24 * 60);
    const wh = Math.floor(wakeMinutes / 60);
    const wm = wakeMinutes % 60;
    return `${wh.toString().padStart(2, '0')}:${wm.toString().padStart(2, '0')}`;
  })() : '07:00';
  lines.push(`Bed  {cyan-fg}${targetBed}{/cyan-fg}   Wake  {cyan-fg}${targetWake}{/cyan-fg}`);

  return lines.join('\n');
}

function buildHistoryPanel(): string {
  const entries = getEntries(14);
  const stats = getStats();

  const lines: string[] = ['{bold}History{/bold}  {gray-fg}last 14 days{/gray-fg}', ''];

  if (entries.length === 0) {
    lines.push('{gray-fg}No history yet.{/gray-fg}');
    return lines.join('\n');
  }

  lines.push(
    `{bold}${'Date'.padEnd(12)}${'Bed'.padEnd(7)}${'Wake'.padEnd(7)}${'Dur'.padEnd(9)}Q{/bold}`
  );

  for (const e of entries) {
    const qc = qualityColor(e.duration_minutes);
    const icon = qualityIcon(e.duration_minutes);
    const isT = isToday(parseISO(e.date));
    const datePart = isT ? `{bold}${e.date}{/bold}` : e.date;
    lines.push(
      `${datePart.padEnd(isT ? 12 + 13 : 12)}` +
      `${e.sleep_time.padEnd(7)}${e.wake_time.padEnd(7)}` +
      `${formatDuration(e.duration_minutes).padEnd(9)}` +
      `${qc}${icon}{/${qc.slice(1)}`
    );
  }

  lines.push('');
  if (stats.total > 0) {
    const consistency = calcConsistencyScore(entries.map((e) => e.sleep_time));
    lines.push(
      `Avg {bold}${formatDuration(Math.round(stats.avg_duration))}{/bold}  ` +
      `Best {bold}${formatDuration(stats.max_duration)}{/bold}  ` +
      `Consistency {bold}${consistency}%{/bold}`
    );
  }

  return lines.join('\n');
}

// ─── keybindings help ────────────────────────────────────────────────────────

function buildHelpLine(): string {
  return (
    ' {cyan-fg}[Tab]{/cyan-fg} Next panel  ' +
    '{cyan-fg}[1/2/3]{/cyan-fg} Jump  ' +
    '{cyan-fg}[r]{/cyan-fg} Refresh  ' +
    '{cyan-fg}[q/Esc]{/cyan-fg} Quit'
  );
}

// ─── main TUI ────────────────────────────────────────────────────────────────

export function launchTui(): void {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'sleep-compiler',
    fullUnicode: true,
  });

  // ── layout ────────────────────────────────────────────────────────────────
  const leftWidth = '40%';
  const rightWidth = '60%';

  const goalBox = blessed.box({
    top: 0,
    left: 0,
    width: leftWidth,
    height: '50%-1',
    border: { type: 'line' },
    label: ' 📅 Goal ',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    mouse: true,
    padding: { left: 1, right: 1 },
    style: { border: { fg: 'cyan' }, label: { fg: 'cyan', bold: true } },
  });

  const todayBox = blessed.box({
    top: '50%',
    left: 0,
    width: leftWidth,
    height: '50%',
    border: { type: 'line' },
    label: ' 🌙 Today ',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    mouse: true,
    padding: { left: 1, right: 1 },
    style: { border: { fg: 'blue' }, label: { fg: 'blue', bold: true } },
  });

  const historyBox = blessed.box({
    top: 0,
    left: leftWidth,
    width: rightWidth,
    height: '100%-2',
    border: { type: 'line' },
    label: ' 📊 History ',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    mouse: true,
    padding: { left: 1, right: 1 },
    style: { border: { fg: 'magenta' }, label: { fg: 'magenta', bold: true } },
  });

  const statusBar = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    style: { bg: 'black', fg: 'white' },
    content: buildHelpLine(),
  });

  screen.append(goalBox);
  screen.append(todayBox);
  screen.append(historyBox);
  screen.append(statusBar);

  // ── focus management ──────────────────────────────────────────────────────
  const panels = [goalBox, todayBox, historyBox];
  let focusIdx = 0;

  function focusPanel(idx: number): void {
    focusIdx = (idx + panels.length) % panels.length;
    panels[focusIdx].focus();
    screen.render();
  }

  function highlightFocused(): void {
    goalBox.style.border.fg = focusIdx === 0 ? 'white' : 'cyan';
    todayBox.style.border.fg = focusIdx === 1 ? 'white' : 'blue';
    historyBox.style.border.fg = focusIdx === 2 ? 'white' : 'magenta';
  }

  // ── data loading ──────────────────────────────────────────────────────────
  function refresh(): void {
    goalBox.setContent(buildGoalPanel());
    todayBox.setContent(buildTodayPanel());
    historyBox.setContent(buildHistoryPanel());
    highlightFocused();
    screen.render();
  }

  refresh();
  focusPanel(0);

  // ── keybindings ───────────────────────────────────────────────────────────
  screen.key(['q', 'escape', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.key('tab', () => focusPanel(focusIdx + 1));
  screen.key('S-tab', () => focusPanel(focusIdx - 1));
  screen.key('1', () => focusPanel(0));
  screen.key('2', () => focusPanel(1));
  screen.key('3', () => focusPanel(2));
  screen.key('r', () => refresh());

  // arrow scroll within focused panel
  screen.key(['up', 'k'], () => {
    panels[focusIdx].scroll(-1);
    screen.render();
  });
  screen.key(['down', 'j'], () => {
    panels[focusIdx].scroll(1);
    screen.render();
  });

  screen.render();
}
