# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub instead: open the **Security** tab of this
repository and click **Report a vulnerability**. Only the maintainer can see
the report. You will get an answer as soon as possible, and you will be
credited in the fix unless you prefer not to be.

## What sidepanel does on your machine

sidepanel makes no network requests and writes no files. Every 5 seconds it
runs these local, read-only commands:

- `git --no-optional-locks status --porcelain=v2 --branch` in the session folder
- `df`, `sysctl -n hw.memsize`, `vm_stat` and `top` (macOS only)

Everything else it shows comes from Claude Code itself, through the plugin API.
Keys and tokens inside a command are masked with Claude Code's own redaction
before the panel keeps or shows it.

## Supported versions

Only the latest release gets security fixes.
