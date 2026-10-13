---
description: Close out the active UOW once every task in .hydrate/CURRENT_UOW.md is checked off.
---

Run `hydrate complete` in the project root using the Bash tool. If it aborts
because unchecked tasks remain, report exactly which tasks are still open
instead of retrying with `--force` on your own judgment. On success, note the
archived UOW id, confirm `.hydrate/CURRENT_UOW.md` was reset, and surface the
suggested `git commit` command for the Product Owner to review.
