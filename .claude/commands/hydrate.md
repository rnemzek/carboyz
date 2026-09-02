---
description: Unified Hydrate master command — checkup, auto-archive, and clipboard sync in one shot.
---

Run `hydrate checkup` in the project root using the Bash tool.

1. If the reported state is `unarchived-done`, immediately run `hydrate complete`
   to archive the finished UOW and reset `.hydrate/CURRENT_UOW.md`.
2. Run `hydrate context --clip` to compile the latest Architect Context payload
   and copy it to the OS clipboard.
3. Summarize the checkup state, any auto-archive action taken, and confirm the
   Architect Context is ready on the clipboard for the Product Owner.
