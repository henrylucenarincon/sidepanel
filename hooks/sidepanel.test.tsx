// SPDX-FileCopyrightText: 2026 Henry Lucena
// SPDX-License-Identifier: MIT

import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'sidepanel',
  component: 'Pane',
  requestId: 'sidepanel',
  props: {
    title: 'sidepanel',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// What each command prints on a demo Mac with 8 GB of RAM and a 245 GB disk.
const OUTPUT: Record<string, string> = {
  '/bin/df': 'Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted on\n/dev/disk3s5 239362496 173831436 25478904 88% 1 1 1% /System/Volumes/Data\n',
  '/usr/sbin/sysctl': '8589934592\n',
  '/usr/bin/vm_stat': 'Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages active: 97677.\nPages wired down: 132288.\nPages occupied by compressor: 154411.\n',
  '/usr/bin/top': 'CPU usage: 1.00% user, 1.00% sys, 98.00% idle\nCPU usage: 10.00% user, 8.00% sys, 82.00% idle\n',
  git: '# branch.oid 0123456789abcdef\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +2 -0\n1 .M N... 100644 100644 100644 a b src/app.ts\n1 .M N... 100644 100644 100644 a b README.md\n? notes.txt\n',
}

function engine(on: any, platform: 'macos' | 'linux' = 'macos') {
  on('command.register', () => ({ value: { command: 'sidepanel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('session.redact', (_: unknown, e: { text: string }) => ({ value: e.text.replace(/sk-[A-Za-z0-9]+/g, '[REDACTED]') }))
  on('env.get', () => ({ value: '/Users/dev' }))
  on('session.info', () => ({ value: { transcriptPath: '', platform, isHosted: false } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.cwd', () => ({ value: '/Users/dev/demo' }))
  on('session.repo', () => ({ value: { root: '/Users/dev/demo', remote: 'git@github.com:octocat/demo.git', internal: false, name: null } }))
  on('session.usage', () => ({
    value: {
      startedAt: Date.now() - 23 * 60000 - 5000,
      context: { window: 200000, tokens: 26000, percent: 13 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 6 },
        { kind: 'seven_day', percentUsed: 86.2 },
      ],
      cost: { usd: 2.05 },
    },
  }))
  on('process.run', (_: unknown, e: { argv: string[] }) => ({
    value: { exitCode: 0, stdout: OUTPUT[e.argv[0] ?? ''] ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
}

async function work($: any) {
  await $.session.start({ cwd: '/Users/dev/demo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/Users/dev/demo/src/app.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
}

test('in English it shows the session, the edited file, the command and the system', async ($, on) => {
  engine(on)
  await work($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
    expect(await text(/^Opus/)).toBe('Opus 5.5')
    expect(await text(/demo\/src/)).toBe('~/demo/src')
    expect(await text(/app\.ts/)).toContain('✎ app.ts')
    expect(await text(/npm test/)).toBe('$ npm test')
    expect(await text(/octocat/)).toBe('repo octocat/demo branch main')
    expect(await text(/unpushed/)).toBe('2 unpushed · 3 uncommitted files')
    expect(await text(/^Week/)).toContain('86%')
    expect(await text(/list price/)).toBe('Session 23 min · ~$2.05 at list price')
    expect(await text(/GB free/)).toContain('26 GB free of 245')
    expect(await text(/^RAM/)).toContain('5.9 of 8 GB')
    expect(await text(/^CPU/)).toContain('18%')
    await ui.unmount()
  }
})

test('en español usa sus palabras y la coma decimal', { options: { language: 'es' } }, async ($, on) => {
  engine(on)
  await work($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
  expect(await text(/octocat/)).toBe('repo octocat/demo rama main')
  expect(await text(/sin subir/)).toBe('2 sin subir · 3 archivos sin commit')
  expect(await text(/precio de lista/)).toBe('Sesión 23 min · ~US$ 2,05 a precio de lista')
  expect(await text(/GB libres/)).toContain('26 GB libres de 245')
  expect(await text(/^RAM/)).toContain('5,9 de 8 GB')
  await ui.unmount()
})

test('outside macOS the system section is left out', async ($, on) => {
  engine(on, 'linux')
  await work($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^SYSTEM$/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /octocat/ }))?.text).toBe('repo octocat/demo branch main')
  await ui.unmount()
})

test('a key in a command is masked before it is shown', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/Users/dev/demo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'curl -H "x-api-key: sk-abc123" https://example.com' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const row = (await ui.find({ type: 'Text', text: /curl/ }))?.text
  expect(row?.startsWith('$ curl -H "x-api-key: [REDACTED]"')).toBe(true)
  expect(row).not.toContain('sk-abc123')
  await ui.unmount()
})
