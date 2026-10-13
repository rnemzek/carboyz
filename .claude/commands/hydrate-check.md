---
description: Validate that archived UOWs are fully logged across the .hydrate/ journals.
---

Run `hydrate check` in the project root using the Bash tool, then summarize
the pass/fail report for the Product Owner — flag any archived UOW missing a
completion entry in PROJECT_JOURNAL.md, DEV_JOURNAL.md, or ARCHITECT_JOURNAL.md,
and any unarchived completed UOW warning.
