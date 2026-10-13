# CarBoyZ — Operating Rules, Stack Constraints & AI Execution Protocol

## 1. Operating Triad Contract
- **Product Owner (Human):** Final authority on scope, acceptance criteria, trade-offs, and repo commits.
- **Lead Architect (Gemini):** System design, stack boundaries, multi-file architectural consistency, and UOW payload specification. Writes `.hydrate/CURRENT_UOW.md` and `.hydrate/ROADMAP.md`.
- **Lead Developer (Claude Code):** Surgical file edits, unit testing, local execution, quality gate enforcement, and git commits upon verification. Appends execution summaries to `.hydrate/` journals upon task completion.

## 2. Technical Stack Constraints & Quality Gates
- **Primary Languages & Runtimes:** Vanilla JavaScript (ES Modules), Node.js, Web Browsers, Hono (backend server).
- **Test Command:** `npm test`
- **Coverage Quality Gate:**
  - Unit tests must pass via `npm test` before committing.
  - Core domain models and business logic services must maintain at least **80% line and branch test coverage**.
  - Claude Code must execute test coverage checks on new/modified modules prior to marking UOW tasks complete.
- **Dependency Boundary:** Client modules must maintain zero-dependency / ESM-first precedents unless explicitly authorized by the Lead Architect in `.hydrate/CURRENT_UOW.md`.

## 3. Tool Permissions & Autonomous Mode
- **Autonomous Execution:** You are authorized to execute all local file reads/writes, directory searches, npm test runs, git commands, and shell tools headlessly without requesting interactive human approval.
- **Non-Interactive Preference:** Execute all tool calls directly and sequentially to fulfill the active UOW payload without pausing for intermediate prompt confirmations.

## 4. Surgical Execution Boundaries & Hydration Artifact Protocol
- Focus ONLY on the scope defined in `.hydrate/CURRENT_UOW.md`.
- Do NOT rewrite unrelated modules, refactor untouched files, or introduce unrequested frameworks/dependencies.
- **File Access Rules:**
  - **READ-ONLY:** `.hydrate/CURRENT_UOW.md` and `.hydrate/ROADMAP.md` (managed strictly by PO/Lead Architect).
  - **APPEND-ONLY:** `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, and `.hydrate/ARCHITECT_JOURNAL.md`.
  - **MOVE/ARCHIVE:** Upon 100% completion and verification of a UOW, move `.hydrate/CURRENT_UOW.md` to `.hydrate/archive/UOW-XX.md`.
- **Completion Logging Protocols (Append-Only):**
  - **`PROJECT_JOURNAL.md`:** Append a single checklist line: `- [x] **[UOW-XX]** Title — YYYY-MM-DD | Pass: N/N tests`
  - **`DEV_JOURNAL.md`:** Append detailed implementation summary, files touched, bug fixes, edge cases handled, and test suite counts.
  - **`ARCHITECT_JOURNAL.md`:** Append architecture updates, modified contracts, pub/sub payload schemas, newly established abstractions, and technical trade-offs.

## 5. External Spatial Engine Boundary (`spatial-core`)
- **Dependency:** Map rendering and geospatial calculations defer to the sibling repository `spatial-core`.
- **CLI Launch Requirement:** Ensure Claude Code is launched with `--add-dir ../spatial-core` when cross-repository modifications are required.

## 6. Fast-Path Protocol & Autonomous Execution Rules

### 6.1 Auto-Commit Duty
- Upon completing and verifying a Unit of Work (all unit/E2E tests passing and quality gates met), the AI Lead Developer must automatically stage and commit the working tree:
  `git commit -m "<type>(<scope>): complete <UOW-ID> implementation and verification"`
- A clean git state is required before concluding any session or proposing new tasks.

### 6.2 Fast-Path Exception for Test Drive Polish (`[UOW-HOTFIX]`)
- **Scope Threshold:** Minor visual polish, UI layout tweaks, micro-bug fixes, or fallback adjustments (<50 lines, no breaking contract/schema changes) identified during live browser test drives do NOT require invoking `hydrate-architect` for a full re-planning cycle.
- **Execution Rule:** When the Product Owner requests a minor tweak during a test drive, append a concise `[UOW-HOTFIX]` bullet directly to `.hydrate/CURRENT_UOW.md`, implement immediately, verify with tests, and commit with `fix(ui):` or `refactor(ui):`.

### 6.3 One-Shot Context Transition & Autonomous Plan Execution
- When transitioning between completed work and new requests, combine uncommitted tree cleanup, logging to `.hydrate/*_JOURNAL.md` files, and task execution into a single seamless run without prompting through multi-step intermediate menus unless explicit ambiguity exists.
- When executing plan mode for a validated UOW, proceed immediately with implementation and verification without holding for secondary plan approvals if the spec in `.hydrate/CURRENT_UOW.md` fully defines the acceptance criteria.

### 6.4 Autonomous Fast-Start Triggers
- **Local to this repo only — deliberately excluded from `templates/CLAUDE.md.template` so downstream `hydrate init` users receive a clean baseline.**
- When prompted with **"LFG"**, **"Andiamo"**, **"Vámonos"**, **"Vamos"**, **"Allons-y"**, **"Lass uns gehen"**, **"Make it so"**, or **"Execute active UOW"**, immediately parse `.hydrate/CURRENT_UOW.md`, begin implementation, verify via `npm test`, log completions to `.hydrate/*_JOURNAL.md` files, and commit upon clean test pass without requesting intermediate setup approvals.

<!-- BEGIN HYDRATE MANAGED BLOCK v3.0.0 -->
# carboyz — Operating Rules, Stack Constraints & AI Execution Protocol

## 0. Fast-Start Boot Protocol
- On session boot, immediately run `hydrate checkup` to reconcile state from `.hydrate/CURRENT_UOW.md`, `.hydrate/archive/`, and `git status` before proposing or starting any work.
- Canonical context sources are `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`, and `.hydrate/ARCHITECT_JOURNAL.md`. A legacy `CONTEXT.md` lookup notice is suppressed — do not look for or request a project `CONTEXT.md`.
- Zero-touch slash commands are available for this workflow:
  - `/hydrate-checkup` — run the state reconciler.
  - `/hydrate-ingest` — ingest a UOW payload from the clipboard to `.hydrate/CURRENT_UOW.md`.
  - `/hydrate-context` — output/clip a token-dense context prompt.

## 1. Operating Triad Contract
- **Product Owner (Human):** Final authority on scope, acceptance criteria, trade-offs, and repo commits.
- **Lead Architect (Gemini):** System design, stack boundaries, multi-file architectural consistency, and UOW payload specification. Writes `.hydrate/CURRENT_UOW.md` and `.hydrate/ROADMAP.md`.
- **Lead Developer (Claude Code):** Surgical file edits, unit testing, local execution, quality gate enforcement, and git commits upon verification. Appends execution summaries to `.hydrate/` journals upon task completion.

## 2. Technical Stack Constraints & Quality Gates
- **Primary Languages & Runtimes:** Vanilla JavaScript (ES Modules), Node.js, Web Browsers, Hono (backend server).
- **Test Command:** `npm test`
- **Coverage Quality Gate:**
  - Unit tests must pass via `npm test` before committing.
  - Core domain models and business logic services must maintain at least **80% line and branch test coverage**.
  - Claude Code must execute test coverage checks on new/modified modules prior to marking UOW tasks complete.
- **Dependency Boundary:** Client modules must maintain zero-dependency / ESM-first precedents unless explicitly authorized by the Lead Architect in `.hydrate/CURRENT_UOW.md`.

## 3. Tool Permissions & Autonomous Mode
- **Autonomous Execution:** You are authorized to execute all local file reads/writes, directory searches, npm test runs, git commands, and shell tools headlessly without requesting interactive human approval.
- **Non-Interactive Preference:** Execute all tool calls directly and sequentially to fulfill the active UOW payload without pausing for intermediate prompt confirmations.

## 4. Surgical Execution Boundaries & Hydration Artifact Protocol
- Focus ONLY on the scope defined in `.hydrate/CURRENT_UOW.md`.
- Do NOT rewrite unrelated modules, refactor untouched files, or introduce unrequested frameworks/dependencies.
- **File Access Rules:**
  - **READ-ONLY:** `.hydrate/CURRENT_UOW.md` and `.hydrate/ROADMAP.md` (managed strictly by PO/Lead Architect).
  - **APPEND-ONLY:** `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, and `.hydrate/ARCHITECT_JOURNAL.md`.
  - **MOVE/ARCHIVE:** Upon 100% completion and verification of a UOW, move `.hydrate/CURRENT_UOW.md` to `.hydrate/archive/UOW-XX.md`.
- **Completion Logging Protocols (Append-Only):**
  - **`PROJECT_JOURNAL.md`:** Append a single checklist line: `- [x] **[UOW-XX]** Title — YYYY-MM-DD | Pass: N/N tests`
  - **`DEV_JOURNAL.md`:** Append detailed implementation summary, files touched, bug fixes, edge cases handled, and test suite counts.
  - **`ARCHITECT_JOURNAL.md`:** Append architecture updates, modified contracts, pub/sub payload schemas, newly established abstractions, and technical trade-offs.

## 5. Fast-Path Protocol & Autonomous Execution Rules

### 5.1 Auto-Commit Duty
- Upon completing and verifying a Unit of Work (all unit/E2E tests passing and quality gates met), the AI Lead Developer must automatically stage and commit the working tree:
  `git commit -m "<type>(<scope>): complete <UOW-ID> implementation and verification"`
- A clean git state is required before concluding any session or proposing new tasks.

### 5.2 Fast-Path Exception for Test Drive Polish (`[UOW-HOTFIX]`)
- **Scope Threshold:** Minor visual polish, UI layout tweaks, micro-bug fixes, or fallback adjustments (<50 lines, no breaking contract/schema changes) identified during live browser test drives do NOT require invoking `hydrate-architect` for a full re-planning cycle.
- **Execution Rule:** When the Product Owner requests a minor tweak during a test drive, append a concise `[UOW-HOTFIX]` bullet directly to `.hydrate/CURRENT_UOW.md`, implement immediately, verify with tests, and commit with `fix(ui):` or `refactor(ui):`.

### 5.3 One-Shot Context Transition & Zero-Assumptions Execution
- **Zero-Assumptions Duty:** Never make speculative assumptions. If a requirement, contract, or implementation detail presents a sticky point or ambiguity, pause immediately and ask the Product Owner for clarification.
- When transitioning between completed work and new requests, combine uncommitted tree cleanup, logging to `.hydrate/*_JOURNAL.md` files, and task execution into a single seamless run.
- Proceed immediately with implementation and verification without holding for secondary plan approvals if the spec in `.hydrate/CURRENT_UOW.md` fully defines the acceptance criteria.

### 5.4 Autonomous Fast-Start Triggers & Clipboard Ingestion
- **Trigger Words:** Prompted with **"Andiamo"**, **"Vámonos"**, **"Vamos"**, **"Allons-y"**, **"Lass uns gehen"**, **"Lets go"**, **"Execute"**, **"Make it so"**, or **"Execute active UOW"**.
- **Clipboard-First Protocol:** Inspect the OS clipboard first. If a UOW header (`**UOW` or `# Unit of Work`) is present, overwrite `.hydrate/CURRENT_UOW.md` with the clipboard payload before starting implementation.
- **Disk Resume Fallback:** If no UOW payload is detected on the clipboard, resume execution directly from the active `.hydrate/CURRENT_UOW.md`.
- **Execution Loop:** Implement scope, verify via `npm test`, append completion logs to `.hydrate/*_JOURNAL.md`, move `.hydrate/CURRENT_UOW.md` to `.hydrate/archive/UOW-XX.md`, and auto-commit upon clean test pass.

## 6. Architectural Logging & Journal Protocol
- When conducting design reviews, trade-off analyses, or sequence mapping, format outputs into **Architecture Journal Digest** blocks.
- Digest blocks must include:
  1. **Technology Decisions Log**: ADR-style table (`Decision` | `Selected` | `Alternative` | `Rationale`).
  2. **Workflow / Sequence Diagrams**: Mermaid diagrams for non-trivial execution paths.
  3. **Architectural Wisdom**: Key trade-offs and gotchas.
- When requested via prompt ("Generate Architecture Journal Digest"), output this pre-formatted block for appending directly into `docs/ARCHITECTURE_JOURNAL.md`.

## 7. System Architecture Maintenance Protocol (`docs/ARCHITECTURE.md`)
- **Ownership Scope**: Claude Code owns maintaining `docs/ARCHITECTURE.md` as a clean, high-level map of current system state.
- **Strict Two-Section Structure**:
  1. `## 1. Overall System Architecture` — High-level Mermaid / ASCII component diagram.
  2. `## 2. Technology Stack & Dependencies` — Core runtime, key frameworks, CLI engines, and primary auxiliary libraries.
- **Exclusions**: Do NOT put sequence diagrams, temporal decision logs, trade-off arguments, or ADR entries in `docs/ARCHITECTURE.md` (those belong in `docs/ARCHITECTURE_JOURNAL.md`).
- **Trigger — `/hydrate-arch-sync`**: When asked to "update architecture" or run `/hydrate-arch-sync`, inspect the workspace and regenerate `docs/ARCHITECTURE.md` strictly following this two-section layout.
- **Trigger — `/hydrate-digest`**: This is a reminder-only command. When run, print the reminder it outputs verbatim and take no further action — the actual digest is generated by prompting "Generate Architecture Journal Digest" per Section 6.
<!-- END HYDRATE MANAGED BLOCK -->
