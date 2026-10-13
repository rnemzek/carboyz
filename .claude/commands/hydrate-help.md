---
description: Show the Hydrate Triad Workflow Guide and full CLI command reference.
---

Run `hydrate help` in the project root using the Bash tool, then summarize
everything it prints for the Product Owner:

1. **🌱 Greenfield Repo Bootstrap (recommended for a brand-new project)** —
   the 6-step from-scratch sequence: `git init` → `hydrate init` → edit
   `.hydrate/ROADMAP.md` (seed the project vision and initial milestones) →
   `hydrate context --clip` → paste into the Lead Architect (Gemini) to
   generate `UOW-01` and copy it to the clipboard → launch Claude Code
   (`claude --dangerously-skip-permissions`) and run `/hydrate-lfg` (or
   `hydrate lfg --yes`) to ingest it zero-touch.
2. **⚙️ Triad Workflow Guide** — the 6-step boot sequence for resuming/
   continuing work across Product Owner, Lead Architect, and Lead Developer.
3. The available `hydrate` commands.
