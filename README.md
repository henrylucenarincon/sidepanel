# sidepanel

A live side panel for [Claude Code](https://code.claude.com). While Claude works, the panel beside the
conversation shows which files it is reading and editing, the commands it runs, your repository and
branch, how much context and usage you have left, and your machine's disk, RAM and CPU.

[Español](README.es.md)

```
SESSION
Opus 5.5
repo octocat/demo branch main
2 unpushed · 3 uncommitted files
Context  ▓░░░░░░░░░ 13%
5 hours  ▓░░░░░░░░░ 6% until 21:00
Week     ▓▓▓▓▓▓▓▓▓░ 86% until Mon 00:00
Session 23 min · ~$2.05 at list price

NOW
Editing ~/demo/src/app.ts

FILES THIS SESSION
~/demo/src
  ✎ app.ts
  · utils.ts
~/demo
  + CHANGELOG.md
+ created  ✎ edited  · read  ⌕ search

COMMANDS
$ npm test
$ git status

SYSTEM
Disk ▓▓▓▓▓▓▓▓▓░ 26 GB free of 245
RAM  ▓▓▓▓▓▓▓░░░ 5.9 of 8 GB
CPU  ▓▓░░░░░░░░ 18%
```

Bars turn yellow from 50% and red from 80%.

## Install

At the prompt of a Claude Code session in a terminal:

```
/plugin install sidepanel --marketplace henrylucenarincon/sidepanel
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell:

```
claude plugin install sidepanel --marketplace henrylucenarincon/sidepanel
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with
`henrylucenarincon/sidepanel`, then **Add plugin**.

## Use

The panel sits beside the conversation in the fullscreen view. Turn it on once with:

```
/tui fullscreen
```

The panel opens by itself in a terminal 144 columns wide or more. In a narrower one (from 110
columns), open it with `/sidepanel`.

## Options

| Option     | Values       | Default |
| ---------- | ------------ | ------- |
| `language` | `en` or `es` | `en`    |

Choose it when you install, or later in `/config`.

## What it runs on your machine

sidepanel makes no network requests and writes no files. Every 5 seconds it runs these local,
read-only commands:

- `git --no-optional-locks status --porcelain=v2 --branch` in the session folder. It never fetches
  and never takes git's index lock, so it does not get in the way of other git work.
- `df`, `sysctl -n hw.memsize`, `vm_stat` and `top`, for the system section (macOS only).

The model, context, usage limits and cost come from Claude Code itself, through its plugin API.

Keys and tokens inside a command (a `curl` header, an `export`) are masked with Claude Code's own
redaction before the panel keeps or shows the command. It is best effort: the panel still shows file
paths and commands, so look at it before you share a screenshot.

## Requirements

- Claude Code 2.1.287 or later (tested on 2.1.331).
- The system section works on macOS. On Linux and Windows the panel works without it.

## Development

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

## License

[MIT](LICENSE) © 2026 Henry Lucena

sidepanel is an independent project. It is not made, endorsed or supported by Anthropic.
