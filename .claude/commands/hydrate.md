---
description: Router — with no arguments, lists the Hydrate slash commands; with a subcommand, delegates to it.
---

Directory of Hydrate slash commands, each running one `hydrate` CLI verb:
- `/hydrate-ingest` — apply a clipboard UOW payload to `.hydrate/CURRENT_UOW.md`.
- `/hydrate-checkup` — reconcile session state (active UOW / archive / git status).
- `/hydrate-context` — compile and clip a token-dense context payload.
- `/hydrate-arch-sync` — regenerate `docs/ARCHITECTURE.md`.
- `/hydrate-uow` — inspect UOWs (list / last / by ID).
- `/hydrate-artifacts` — print the `.hydrate/`/`.claude/commands/` artifact map.
- `/hydrate-check` — validate journal/archive consistency.
- `/hydrate-complete` — close out the active UOW.
- `/hydrate-export-portfolio` — export `tech-overview.json`.
- `/hydrate-digest` — Architecture Journal Digest reminder.
- `/hydrate-help` — full Triad Workflow Guide and CLI reference.
- `/hydrate-lfg` — zero-touch checkup + clipboard ingest launch.

If `$ARGUMENTS` is empty, `help`, or `-h`: print the directory above to the
Product Owner and stop there — do not run any Bash commands for this case.

Otherwise, treat `$ARGUMENTS` as a Hydrate CLI verb (plus any of its own
flags) and delegate directly: run `hydrate $ARGUMENTS` in the project root
using the Bash tool — e.g. `/hydrate ingest` runs `hydrate ingest`, the same
workflow `/hydrate-ingest` follows — then summarize the result for the
Product Owner exactly as that verb's own dedicated slash command would.
