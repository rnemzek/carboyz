---
description: Scan the workspace and regenerate docs/ARCHITECTURE.md as a clean, high-level system map.
---

Inspect the current workspace (package.json, directory layout, and key source
entry points) to understand its present component structure and dependency
set, then regenerate `docs/ARCHITECTURE.md` strictly following the two-section
layout defined in CLAUDE.md Section 7:

1. `## 1. Overall System Architecture` — a high-level Mermaid or ASCII
   component diagram.
2. `## 2. Technology Stack & Dependencies` — core runtime, key frameworks,
   CLI engines, and primary auxiliary libraries.

Do not add sequence diagrams, decision logs, trade-off narratives, or ADR
entries — those belong in `docs/ARCHITECTURE_JOURNAL.md`, not here.
