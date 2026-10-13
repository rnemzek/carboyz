---
description: Zero-touch launch — reconcile session state, then ingest a UOW payload from the clipboard.
---

Run `hydrate lfg --yes` in the project root using the Bash tool to reconcile
current session state (the same checkup `hydrate checkup` runs) and then apply
the clipboard payload non-interactively (archiving any active UOW first).
Treat the freshly written `.hydrate/CURRENT_UOW.md` as your active Lead
Developer execution scope for this session.
