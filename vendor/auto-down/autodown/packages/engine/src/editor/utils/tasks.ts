export type TaskMarker = 'TODO' | 'DOING' | 'DONE' | 'NOW' | 'LATER'
export type TaskWorkflow = 'todo' | 'now'

const TODO_CYCLE: TaskMarker[] = ['TODO', 'DOING', 'DONE']
const NOW_CYCLE: TaskMarker[] = ['NOW', 'LATER', 'DONE']

export const TASK_MARKERS: TaskMarker[] = ['TODO', 'DOING', 'DONE', 'NOW', 'LATER']

export const TASK_MARKER_RE = /^(\s*)- (TODO|DOING|DONE|NOW|LATER)\b(.*)$/
export const PRIORITY_RE = /\[#([ABC])\]/

const SCHEDULED_RE = /^(\s*)(SCHEDULED|DEADLINE):\s*<([^>]+)>\s*$/

export interface ScheduledInfo {
  keyword: 'SCHEDULED' | 'DEADLINE'
  date: Date
  rawDate: string
  repeater?: string
}

export function parseScheduled(line: string): ScheduledInfo | null {
  const match = line.match(SCHEDULED_RE)
  if (!match) return null
  const raw = match[3]
  // The raw text may contain a repeater like "2026-07-01 Wed +1w".
  // Date part is the first three space-separated tokens (YYYY-MM-DD DDD [+/-repeater?])
  // We try to parse the leading ISO date.
  const dateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (!dateMatch) return null
  const date = new Date(`${dateMatch[1]}T00:00:00`)
  if (isNaN(date.getTime())) return null
  const repeaterMatch = raw.match(/([.+]{1,2}\d+[dwmy])/)
  return {
    keyword: match[2] as 'SCHEDULED' | 'DEADLINE',
    date,
    rawDate: raw,
    repeater: repeaterMatch?.[1],
  }
}

function formatScheduledDate(date: Date, raw: string): string {
  // Preserve weekday if present, otherwise use ISO.
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const weekday = raw.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/)?.[0]
  return weekday ? `${iso} ${weekday}` : iso
}

function applyRepeater(date: Date, repeater: string): Date {
  const match = repeater.match(/([.+]{1,2})(\d+)([dwmy])/)
  if (!match) return date
  const kind = match[1]
  const n = parseInt(match[2], 10)
  const unit = match[3]
  const next = new Date(date)
  if (kind === '++' || kind === '+') {
    switch (unit) {
      case 'd': next.setDate(next.getDate() + n); break
      case 'w': next.setDate(next.getDate() + n * 7); break
      case 'm': next.setMonth(next.getMonth() + n); break
      case 'y': next.setFullYear(next.getFullYear() + n); break
    }
  } else if (kind === '.+') {
    const base = new Date()
    switch (unit) {
      case 'd': base.setDate(base.getDate() + n); break
      case 'w': base.setDate(base.getDate() + n * 7); break
      case 'm': base.setMonth(base.getMonth() + n); break
      case 'y': base.setFullYear(base.getFullYear() + n); break
    }
    next.setFullYear(base.getFullYear())
    next.setMonth(base.getMonth())
    next.setDate(base.getDate())
  }
  return next
}

export function cycleTaskMarker(
  lines: string[],
  lineIdx: number,
  workflow: TaskWorkflow = 'todo',
): string[] {
  if (lineIdx < 0 || lineIdx >= lines.length) return lines
  const line = lines[lineIdx]
  const match = line.match(TASK_MARKER_RE)
  const cycle = workflow === 'todo' ? TODO_CYCLE : NOW_CYCLE

  if (!match) {
    // If line is a plain list item, add the first marker.
    const plainList = line.match(/^(\s*)- (?!\[)(.*)$/)
    if (plainList) {
      const newLine = `${plainList[1]}- ${cycle[0]} ${plainList[2]}`
      lines[lineIdx] = newLine
    }
    return lines
  }

  const indent = match[1]
  const current = match[2] as TaskMarker
  const rest = match[3]
  const idx = cycle.indexOf(current)
  const nextIdx = idx === -1 ? 0 : (idx + 1) % cycle.length
  const nextMarker = cycle[nextIdx]

  if (nextMarker === 'DONE') {
    // Try to advance SCHEDULED/DEADLINE on following indented lines.
    const markerIndent = indent.length
    let i = lineIdx + 1
    while (i < lines.length) {
      const nextLine = lines[i]
      const nextIndent = nextLine.match(/^(\s*)/)?.[1].length ?? 0
      if (nextIndent <= markerIndent || nextLine.trim() === '') break
      const scheduled = parseScheduled(nextLine)
      if (scheduled?.repeater) {
        const newDate = applyRepeater(scheduled.date, scheduled.repeater)
        const newRaw = `${formatScheduledDate(newDate, scheduled.rawDate)} ${scheduled.repeater}`
        lines[i] = `${nextLine.match(/^(\s*)/)?.[1] ?? ''}${scheduled.keyword}: <${newRaw}>`
        // Reset marker to the start of the cycle instead of DONE.
        lines[lineIdx] = `${indent}- ${cycle[0]}${rest}`
        return lines
      }
      i += 1
    }
  }

  lines[lineIdx] = `${indent}- ${nextMarker}${rest}`
  return lines
}

export function setPriority(line: string, priority: 'A' | 'B' | 'C'): string {
  if (PRIORITY_RE.test(line)) {
    return line.replace(PRIORITY_RE, `[#${priority}]`)
  }
  // Insert after marker if present.
  return line.replace(/^(\s*- (?:TODO|DOING|DONE|NOW|LATER)\b)(.*)$/, `$1 [#${priority}]$2`)
}

export function removePriority(line: string): string {
  return line.replace(PRIORITY_RE, '').replace(/\s{2,}/g, ' ').trimEnd()
}
