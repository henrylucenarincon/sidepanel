// SPDX-FileCopyrightText: 2026 Henry Lucena
// SPDX-License-Identifier: MIT

// sidepanel: a live panel beside the Claude Code conversation.
// Top to bottom: the session (model, repo and branch, context, usage limits),
// what Claude is doing right now, the files it touched grouped by folder, the
// last commands, and the machine's disk, RAM and CPU (macOS).
// Everything stays on your machine: it only runs local, read-only commands
// (git, df, sysctl, vm_stat, top) and makes no network requests.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Command, Limit, Now, Repo, Session, System, Touch } from '../types'

const PANE = 'sidepanel'
const touches = atom({ plugin: 'sidepanel', key: 'touches' } as const, [] as Touch[], { shape: 'touches-1' })
const commands = atom({ plugin: 'sidepanel', key: 'commands' } as const, [] as Command[], { shape: 'commands-1' })
const now = atom({ plugin: 'sidepanel', key: 'now' } as const, null as Now, { shape: 'now-1' })
const system = atom({ plugin: 'sidepanel', key: 'system' } as const, null as System, { shape: 'system-1' })
const session = atom({ plugin: 'sidepanel', key: 'session' } as const, null as Session, { shape: 'session-1' })

// ---------------------------------------------------------------- language

const TEXT = {
  en: {
    session: 'SESSION', now: 'NOW', files: 'FILES THIS SESSION', commands: 'COMMANDS', system: 'SYSTEM',
    waiting: 'Waiting for the first reading…', idle: 'Idle', none: 'None yet', measuring: 'Measuring…',
    legend: '+ created  ✎ edited  · read  ⌕ search',
    actions: { read: 'Reading', edit: 'Editing', write: 'Writing', search: 'Searching', command: 'Running', tool: '' },
    repo: 'repo', branch: 'branch', detached: 'detached HEAD', notInRepo: '(not in a repo)',
    neverPushed: 'branch never pushed', unpushed: (n: number) => `${n} unpushed`,
    changed: (n: number) => `${n} uncommitted file${n === 1 ? '' : 's'}`,
    context: 'Context ', fiveHour: '5 hours ', week: 'Week    ', until: 'until',
    elapsed: (d: string) => `Session ${d}`, cost: (usd: string) => `~$${usd} at list price`,
    disk: 'Disk', ram: 'RAM ', cpu: 'CPU ',
    diskLine: (free: string, total: string) => `${free} GB free of ${total}`,
    ramLine: (used: string, total: string) => `${used} of ${total} GB`,
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    min: 'min', h: 'h',
    decimal: '.',
    opened: 'Panel open. To see it beside the conversation: /tui fullscreen.',
    commandHelp: 'Open the side panel: files, commands, session and system',
  },
  es: {
    session: 'SESIÓN', now: 'AHORA', files: 'ARCHIVOS DE ESTA SESIÓN', commands: 'COMANDOS', system: 'SISTEMA',
    waiting: 'Esperando la primera lectura…', idle: 'En espera', none: 'Todavía ninguno', measuring: 'Midiendo…',
    legend: '+ creado  ✎ editado  · leído  ⌕ búsqueda',
    actions: { read: 'Leyendo', edit: 'Editando', write: 'Escribiendo', search: 'Buscando', command: 'Comando', tool: '' },
    repo: 'repo', branch: 'rama', detached: 'sin rama (commit suelto)', notInRepo: '(fuera de un repo)',
    neverPushed: 'rama nunca subida', unpushed: (n: number) => `${n} sin subir`,
    changed: (n: number) => `${n} archivo${n === 1 ? '' : 's'} sin commit`,
    context: 'Contexto', fiveHour: '5 horas ', week: 'Semana  ', until: 'hasta',
    elapsed: (d: string) => `Sesión ${d}`, cost: (usd: string) => `~US$ ${usd} a precio de lista`,
    disk: 'Disco', ram: 'RAM  ', cpu: 'CPU  ',
    diskLine: (free: string, total: string) => `${free} GB libres de ${total}`,
    ramLine: (used: string, total: string) => `${used} de ${total} GB`,
    days: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    min: 'min', h: 'h',
    decimal: ',',
    opened: 'Panel abierto. Para verlo al costado: /tui fullscreen.',
    commandHelp: 'Abre el panel lateral: archivos, comandos, sesión y sistema',
  },
}
type Strings = (typeof TEXT)['en']

// ---------------------------------------------------------------- helpers

function folderOf(path: string) {
  const i = path.lastIndexOf('/')
  return i > 0 ? path.slice(0, i) : path
}

function nameOf(path: string) {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(i + 1) : path
}

function bar(pct: number, width = 10) {
  const full = Math.max(0, Math.min(width, Math.round((pct * width) / 100)))
  return '▓'.repeat(full) + '░'.repeat(width - full)
}

function levelColor(pct: number) {
  if (pct >= 80) return 'error'
  if (pct >= 50) return 'warning'
  return 'success'
}

const firstLine = (s: string) => (s.split('\n')[0] ?? '').slice(0, 200)

// A command can carry a key or a token (a curl with a header, an export):
// the engine masks those before the panel keeps or shows the command. If it
// cannot mask it, the panel does not show it.
async function masked($: EngineInterface, command: string) {
  try {
    return await $.session.redact(firstLine(command))
  } catch {
    return '…'
  }
}

const num = (s: Strings, n: number, decimals = 1) => n.toFixed(decimals).replace('.', s.decimal)

function resetTime(s: Strings, iso: string) {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  const hhmm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
  return t.toDateString() === new Date().toDateString() ? hhmm : `${s.days[t.getDay()]} ${hhmm}`
}

function elapsed(s: Strings, ms: number) {
  const min = Math.max(0, Math.floor(ms / 60000))
  return min < 60 ? `${min} ${s.min}` : `${Math.floor(min / 60)} ${s.h} ${String(min % 60).padStart(2, '0')} ${s.min}`
}

// "git@github.com:owner/name.git" or "https://host/owner/name" → "owner/name".
function repoName(remote: string | null, root: string) {
  const m = remote ? /[:/]([^/:]+\/[^/]+?)(?:\.git)?\/?$/.exec(remote) : null
  return m?.[1] ?? nameOf(root.replace(/\/$/, ''))
}

// "claude-opus-5-5" → "Opus 5.5"; anything else is shown as the engine gives it.
function modelName(id: string) {
  const m = /^claude-([a-z]+)-(\d+)-(\d+)(.*)$/.exec(id)
  if (!m) return id
  const [, family = '', major, minor, rest] = m
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}.${minor}${rest ? ' ' + rest.replace(/^[-\[]|\]$/g, '') : ''}`
}

// What the tool is doing, and on which path.
function describe(e: { tool: string } & Record<string, unknown>): {
  action: NonNullable<Now>['action']
  path?: string
  op?: Touch['op']
  command?: string
} {
  const str = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : undefined)
  switch (e.tool) {
    case 'Read':
      return { action: 'read', path: str('file_path'), op: 'read' }
    case 'Edit':
      return { action: 'edit', path: str('file_path'), op: 'edited' }
    case 'Write':
      return { action: 'write', path: str('file_path'), op: 'created' }
    case 'NotebookEdit':
      return { action: 'edit', path: str('notebook_path'), op: 'edited' }
    case 'Glob':
    case 'Grep':
      return { action: 'search', path: str('path'), op: 'searched' }
    case 'Bash':
      return { action: 'command', command: str('command') }
    default:
      return { action: 'tool' }
  }
}

function recordTouch(list: Touch[], path: string, op: Touch['op']): Touch[] {
  const prev = list.find(t => t.path === path)
  // An edit or a creation outweighs a later read: a read does not hide it.
  const weight = { searched: 0, read: 1, edited: 2, created: 3 }
  if (prev) {
    const nextOp = weight[op] > weight[prev.op] ? op : prev.op
    return [...list.filter(t => t !== prev), { ...prev, op: nextOp, count: prev.count + 1, t: Date.now() }]
  }
  return [...list, { path, op, count: 1, t: Date.now() }].slice(-300)
}

// ---------------------------------------------------------------- readings

// Disk, RAM and CPU on macOS, from the system's own commands.
async function measureMac($: EngineInterface): Promise<System> {
  const [df, mem, vm, top] = await Promise.all([
    $.process.run(['/bin/df', '-k', '/System/Volumes/Data'], { timeoutMs: 5000 }),
    $.process.run(['/usr/sbin/sysctl', '-n', 'hw.memsize'], { timeoutMs: 5000 }),
    $.process.run(['/usr/bin/vm_stat'], { timeoutMs: 5000 }),
    $.process.run(['/usr/bin/top', '-l', '2', '-n', '0', '-s', '1'], { timeoutMs: 10000 }),
  ])

  const dfRow = df.stdout.trim().split('\n').pop()?.trim().split(/\s+/) ?? []
  const totalKB = Number(dfRow[1])
  const freeKB = Number(dfRow[3])

  const page = Number(/page size of (\d+)/.exec(vm.stdout)?.[1] ?? 16384)
  const pages = (label: string) => Number(new RegExp(label + ':\\s+(\\d+)').exec(vm.stdout)?.[1] ?? 0)
  // Close to Activity Monitor's "Memory Used": active + wired + compressed.
  const used = (pages('Pages active') + pages('Pages wired down') + pages('Pages occupied by compressor')) * page

  // The first sample counts since boot; the second is the last second.
  const cpuLines = top.stdout.split('\n').filter((l: string) => l.startsWith('CPU usage'))
  const idle = Number(/([\d.]+)% idle/.exec(cpuLines[cpuLines.length - 1] ?? '')?.[1] ?? NaN)

  return {
    // Disk in decimal GB, as Finder shows it.
    diskFreeGB: (freeKB * 1024) / 1e9,
    diskTotalGB: (totalKB * 1024) / 1e9,
    // RAM in binary GB, as "About This Mac" shows it (8 GB = 8 × 1024³ bytes).
    ramUsedGB: used / 2 ** 30,
    ramTotalGB: Number(mem.stdout.trim()) / 2 ** 30,
    cpuPct: Number.isNaN(idle) ? -1 : 100 - idle,
    t: Date.now(),
  }
}

// Branch, commits not pushed and files not committed; local only, never fetches.
async function gitState($: EngineInterface, cwd: string): Promise<Repo> {
  const found = await $.session.repo()
  if (!found) return null
  // --no-optional-locks: never touches the index, so it cannot collide with
  // another git process working in the same repository.
  const st = await $.process.run(['git', '--no-optional-locks', '-C', cwd, 'status', '--porcelain=v2', '--branch'], {
    timeoutMs: 3000,
  })
  const repo: NonNullable<Repo> = { name: repoName(found.remote, found.root), branch: null, hasUpstream: false, ahead: 0, changed: 0 }
  if (st.exitCode !== 0) return repo
  for (const line of st.stdout.split('\n')) {
    if (line.startsWith('# branch.head ')) {
      const b = line.slice('# branch.head '.length)
      repo.branch = b === '(detached)' ? null : b
    } else if (line.startsWith('# branch.upstream ')) {
      repo.hasUpstream = true
    } else if (line.startsWith('# branch.ab ')) {
      // "# branch.ab +3 -0": ahead / behind the upstream, as of the last fetch.
      repo.ahead = Number(line.split(' ')[2]?.replace('+', '') ?? 0) || 0
    } else if (line && !line.startsWith('#')) {
      repo.changed++
    }
  }
  return repo
}

async function readSession($: EngineInterface): Promise<Session> {
  const [usage, model, cwd] = await Promise.all([$.session.usage(), $.session.model(), $.session.cwd()])
  let repo: Repo = null
  try {
    repo = await gitState($, cwd)
  } catch {
    // git missing or too slow: the repo line waits for the next reading.
  }
  const limit = (kind: string): Limit => {
    const r = usage.rateLimits.find(l => l.kind === kind)
    return r ? { percentUsed: r.percentUsed, resetsAt: r.resetsAt } : null
  }
  return {
    model: model ? modelName(model) : null,
    folder: nameOf(cwd.replace(/\/$/, '')) || cwd,
    repo,
    contextPct: usage.context.percent ?? null,
    fiveHour: limit('five_hour'),
    week: limit('seven_day'),
    startedAt: usage.startedAt ?? null,
    costUsd: usage.cost?.usd ?? null,
    t: Date.now(),
  }
}

// ---------------------------------------------------------------- the mod

export const register: Register = (on, options) => {
  const s: Strings = options.language === 'es' ? TEXT.es : TEXT.en
  let home = ''
  const short = (path: string) => (home && path.startsWith(home + '/') ? '~' + path.slice(home.length) : path)

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    home = (await $.env.get('HOME')) ?? ''
    await $.command.register({ name: 'sidepanel', description: s.commandHelp })
    // With no terminal (claude -p) there is nowhere to draw it: ignore.
    void $.ui.open({ id: PANE, title: 'sidepanel' }).catch(() => undefined)

    const { platform } = await $.session.info()
    const measure = async () => {
      if (platform === 'macos') {
        try {
          const m = await measureMac($)
          await update($, system, () => m)
        } catch {
          // A failed reading keeps the previous one.
        }
      }
      try {
        const ses = await readSession($)
        await update($, session, () => ses)
      } catch {
        // Keeps the previous reading.
      }
    }
    void measure()
    $.clock.every(5000, () => void measure())

    return started
  })

  on('command.run', { command: 'sidepanel' }, async $ => {
    await $.ui.open({ id: PANE, title: 'sidepanel' })
    return { text: s.opened }
  })

  // The panel only watches: a failure here must never stop or change a tool call.
  on('tool.call', async ($, e, next) => {
    const d = describe(e as unknown as { tool: string } & Record<string, unknown>)
    const shown = d.command ? await masked($, d.command) : ''
    try {
      const detail = d.path ? short(d.path) : shown
      await update($, now, () => ({ action: d.action, detail, tool: e.tool }))
    } catch {
      // Nothing to show this time.
    }

    const ran = await next(e)

    try {
      if (d.path && d.op) {
        const path = d.path
        const op = d.op
        await update($, touches, list => recordTouch(list, path, op))
      }
      if (d.command) {
        const text = shown
        const failed = ran.deny === undefined && ran.isError === true
        await update($, commands, list => [...list, { text, t: Date.now(), failed }].slice(-50))
      }
      await update($, now, () => null)
    } catch {
      // The tool's result goes back unchanged either way.
    }

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const width = Math.max(20, (e.viewport?.columns ?? 40) - 2)
    const height = Math.max(10, e.viewport?.rows ?? 30)
    const clip = (str: string, n = width) => (str.length > n ? '…' + str.slice(str.length - n + 1) : str)  // paths: keep the end
    const clipEnd = (str: string, n = width) => (str.length > n ? str.slice(0, n - 1) + '…' : str)  // commands: keep the start

    const [list, cmds, current, sys, ses] = await Promise.all([
      read($, touches), read($, commands), read($, now), read($, system), read($, session),
    ])

    // Files grouped by folder, the most recently touched folder first.
    const groups = new Map<string, Touch[]>()
    for (const t of [...list].sort((a, b) => b.t - a.t)) {
      const f = folderOf(t.path)
      groups.set(f, [...(groups.get(f) ?? []), t])
    }
    const mark = { created: '+', edited: '✎', read: '·', searched: '⌕' } as const
    const opColor = { created: 'success', edited: 'warning', read: 'subtle', searched: 'subtle' } as const

    // Rows for files: what is left after the other sections.
    let fileRows = Math.max(4, height - (sys ? 31 : 26))
    const fileLines: any[] = []
    for (const [folder, ts] of groups) {
      if (fileRows <= 1) break
      fileLines.push(<Text bold>{clip(short(folder))}</Text>)
      fileRows--
      for (const t of ts) {
        if (fileRows <= 0) break
        fileLines.push(
          <Text color={opColor[t.op]}>
            {'  '}
            {mark[t.op]} {clip(nameOf(t.path), width - 4)}
          </Text>,
        )
        fileRows--
      }
    }

    const label = current ? s.actions[current.action] || current.tool : ''

    return (
      <Box flexDirection="column">
        <Text bold color="claude">{s.session}</Text>
        {ses ? sessionLines(Text, s, ses, width, clip) : <Text dimColor>{s.waiting}</Text>}
        <Text> </Text>

        <Text bold color="claude">{s.now}</Text>
        {current ? (
          <Text>
            <Text color="warning">{label}</Text> {(current.action === 'command' ? clipEnd : clip)(current.detail, width - label.length - 1)}
          </Text>
        ) : (
          <Text dimColor>{s.idle}</Text>
        )}
        <Text> </Text>

        <Text bold color="claude">{s.files}</Text>
        {list.length === 0 ? <Text dimColor>{s.none}</Text> : fileLines}
        <Text dimColor>{s.legend}</Text>
        <Text> </Text>

        <Text bold color="claude">{s.commands}</Text>
        {cmds.length === 0 ? (
          <Text dimColor>{s.none}</Text>
        ) : (
          cmds.slice(-5).reverse().map(c => (
            <Text color={c.failed ? 'error' : undefined} dimColor={!c.failed}>
              $ {clipEnd(c.text, width - 2)}
            </Text>
          ))
        )}

        {sys ? (
          <Box flexDirection="column">
            <Text> </Text>
            <Text bold color="claude">{s.system}</Text>
            {systemLines(Text, s, sys)}
          </Box>
        ) : null}
      </Box>
    )
  })
}

function sessionLines(Text: any, s: Strings, ses: NonNullable<Session>, width: number, clip: (str: string, n?: number) => string) {
  const rows: any[] = []
  if (ses.model) rows.push(<Text bold>{ses.model}</Text>)
  if (ses.repo) {
    rows.push(
      <Text>
        {s.repo} <Text bold>{clip(ses.repo.name, Math.max(10, width - 20))}</Text>
        {ses.repo.branch ? (
          <Text>
            {' '}<Text dimColor>{s.branch}</Text> <Text bold>{ses.repo.branch}</Text>
          </Text>
        ) : (
          <Text color="warning"> {s.detached}</Text>
        )}
      </Text>,
    )
    const notes: string[] = []
    if (ses.repo.branch && !ses.repo.hasUpstream) notes.push(s.neverPushed)
    else if (ses.repo.ahead) notes.push(s.unpushed(ses.repo.ahead))
    if (ses.repo.changed) notes.push(s.changed(ses.repo.changed))
    if (notes.length) rows.push(<Text color="warning">{notes.join(' · ')}</Text>)
  } else {
    rows.push(<Text>{ses.folder} <Text dimColor>{s.notInRepo}</Text></Text>)
  }
  if (ses.contextPct != null) {
    rows.push(
      <Text>
        {s.context} <Text color={levelColor(ses.contextPct)}>{bar(ses.contextPct)} {Math.round(ses.contextPct)}%</Text>
      </Text>,
    )
  }
  for (const [name, lim] of [[s.fiveHour, ses.fiveHour], [s.week, ses.week]] as const) {
    if (!lim) continue
    const when = lim.resetsAt ? resetTime(s, lim.resetsAt) : ''
    rows.push(
      <Text>
        {name} <Text color={levelColor(lim.percentUsed)}>{bar(lim.percentUsed)} {Math.round(lim.percentUsed)}%</Text>
        {when ? <Text dimColor> {s.until} {when}</Text> : null}
      </Text>,
    )
  }
  const foot: string[] = []
  if (ses.startedAt) foot.push(s.elapsed(elapsed(s, ses.t - ses.startedAt)))
  if (ses.costUsd) foot.push(s.cost(num(s, ses.costUsd, 2)))
  if (foot.length) rows.push(<Text dimColor>{foot.join(' · ')}</Text>)
  return rows
}

function systemLines(Text: any, s: Strings, m: NonNullable<System>) {
  const diskPct = 100 - (m.diskFreeGB / m.diskTotalGB) * 100
  const ramPct = (m.ramUsedGB / m.ramTotalGB) * 100
  return [
    <Text>
      {s.disk} <Text color={levelColor(diskPct)}>{bar(diskPct)}</Text> {s.diskLine(num(s, m.diskFreeGB, 0), num(s, m.diskTotalGB, 0))}
    </Text>,
    <Text>
      {s.ram} <Text color={levelColor(ramPct)}>{bar(ramPct)}</Text> {s.ramLine(num(s, m.ramUsedGB), num(s, m.ramTotalGB, 0))}
    </Text>,
    m.cpuPct >= 0 ? (
      <Text>
        {s.cpu} <Text color={levelColor(m.cpuPct)}>{bar(m.cpuPct)}</Text> {num(s, m.cpuPct, 0)}%
      </Text>
    ) : null,
  ]
}
