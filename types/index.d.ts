// SPDX-FileCopyrightText: 2026 Henry Lucena
// SPDX-License-Identifier: MIT

export type Touch = { path: string; op: 'read' | 'edited' | 'created' | 'searched'; count: number; t: number }
export type Command = { text: string; t: number; failed: boolean }
export type Now = { action: 'read' | 'edit' | 'write' | 'search' | 'command' | 'tool'; detail: string; tool: string } | null

export type System = {
  diskFreeGB: number
  diskTotalGB: number
  ramUsedGB: number
  ramTotalGB: number
  cpuPct: number
  t: number
} | null

export type Limit = { percentUsed: number; resetsAt?: string } | null

export type Repo = {
  name: string
  branch: string | null
  hasUpstream: boolean
  ahead: number
  changed: number
} | null

export type Session = {
  model: string | null
  folder: string
  repo: Repo
  contextPct: number | null
  fiveHour: Limit
  week: Limit
  startedAt: number | null
  costUsd: number | null
  t: number
} | null

declare module 'claude-code' {
  interface PluginState {
    sidepanel: {
      touches: Shaped<Touch[]>
      commands: Shaped<Command[]>
      now: Shaped<Now>
      system: Shaped<System>
      session: Shaped<Session>
    }
  }
}
