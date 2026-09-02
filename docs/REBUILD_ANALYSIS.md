1. Completed Core Capabilities & Features
From your surviving logs, architecture docs, and commit history, these key subsystems are fully implemented and verified with active test suites:
⚬	PWA & White-Label Canvas: Mobile-first command interface, dual-view demo mode (Mobile Intake vs. Desktop Inbox), customizable branding themes (e.g., StreamZilla dark/gold theme), and multi-tenant URL routing (/tenantA or tenantA.app).
⚬	Spatial & Mapping Infrastructure: MapLibre GL integration with CARTO Dark Matter basemap, GPS locate, ZIP/city auto-suggest search, procedural regional dealer/vehicle scattering, and dual-mode geocoding bridges (Google Places API + OpenStreetMap Nominatim fallback).
⚬	Ingest & Data Parsing Engine: Structured LLM query parsing, buyer search engine, competitor offer ingestion (CarMax/Carvana submission parsing), VIN scanning, and multi-channel input handling.
⚬	Multi-Tenant State Syncing: SyncAdapter UI bindings, cross-tab session broadcasting (BroadcastChannel), and local-first data isolation.
2. Capabilities & Features Needed for Minimum Viable Product (MVP)
To transition CarBoyZ from a feature-rich spatial frontend to a production-ready automotive trading engine, the following core backend and business logic gaps must be bridged:
⚬	Cellular Multi-Tenant Backend (Epic 1): Transition from browser-only BroadcastChannel syncing to an isolated backend container runtime per dealer cell with real-time WebSocket pub-sub.
⚬	QR Phone-to-Desktop Session Stashing: Physical mobile phone QR capture that immediately routes appraisal state to a desktop Lead Inbox session.
⚬	Offline Service Worker Queue (Epic 2): Workbox background sync to buffer appraisals taken in poor cell coverage areas and auto-resync upon network reconnect.
⚬	Spread & Pricing Policy Engine (In-Memory): In-memory evaluation of spread pricing tiers, margin factors, floor prices, and auto-approval thresholds against seller submissions.
⚬	Policy Versioning & Audit Logging (Epic 3): Immutable append-only audit trail capturing rule mutations with hash verification (userId, timestamp, diffPayload).
3. Alternative Approach: Turning CC Loose to Rebuild Project State
Using Claude Code to perform a full codebase audit is the fastest way to replace missing or corrupt .hydrate/ artifacts and establish ground truth.
Recommended Strategy
Instead of guessing what was built based on journal titles, let Claude Code inspect the source code directly:
	1.	Run a Synthetic Codebase Reconstruction Sweep:
Have Claude Code scan src/, tests/, and package.json to extract every exported domain model, route, service, and UI view.
	2.	Re-index Capabilities via Test Suites:
Claude Code can parse test files (e.g., tests/ui/syncIntegration.test.js, tests/locationAdapter.test.js) to generate a complete inventory of passing assertions and implicit feature specs.
	3.	Generate a Clean docs/RECONSTRUCTED_STATE.md:
CC will map existing files back to functional feature buckets without needing legacy UOW numbers.
The CC Prompt to Run in carboyz
"Perform a structural codebase audit across src/ and tests/. Generate a comprehensive inventory of all implemented domain models, services, UI components, and API adapters. Summarize what is fully implemented with test coverage versus what is stubbed or unintegrated. Write this inventory to docs/RECONSTRUCTED_STATE.md."
4. Consolidated Product Roadmap: Current State ‭$\rightarrow$‬ MVP ‭$\rightarrow$‬ Analytics Engine (MVP+)

                                CARBOYZ PRODUCT ROADMAP
┌───────────────────────────┐     ┌───────────────────────────┐     ┌───────────────────────────┐
│     CURRENT FOUNDATION    │ ──> │      MVP MILESTONES       │ ──> │    MVP+ ANALYTICS ENGINE  │
│  (Spatial & UI Canvas)    │     │  (Policy & Offline Ingest)│     │  (Simulation & Scenario)  │
└───────────────────────────┘     └───────────────────────────┘     └───────────────────────────┘

Phase 1: Current Foundation (Re-established)
⚬	Status: Complete.
⚬	Focus: Spatial mapping core, location resolution, white-label PWA shell, intake UI, and procedural dealer network.
Phase 2: MVP Completion (Cellular Backend & Policy Engine)
⚬	Milestone 2.1 — In-Memory Policy Evaluation Engine: Compute deal spreads, counter-offers, and margins dynamically based on active dealer rule sets.
⚬	Milestone 2.2 — Cellular Backend & Phone-to-Desktop Sync: Deploy isolated tenant runtimes with WebSockets for instant mobile QR scan-to-desktop inbox stashing.
⚬	Milestone 2.3 — Workbox Offline Service Worker: Enable background submission queueing for low-reception appraisals.
⚬	Milestone 2.4 — Policy Mutation Ledger & Versioning: Assign semantic versions (v1.1.0) to pricing changes and store append-only audit logs.
Phase 3: MVP+ Sticky Analytics & Scenario Engine (The "Dealer Magnet")
To make the platform indispensable to dealership general managers, the analytics engine must eliminate Excel spreadsheets and show point-and-click trade-off optimization:
⚬	Analytics Version Pinning (Epic 4): Plot win-rate and margin time-series graphs with vertical timeline pins indicating the exact policy version deployed (Policy v1.1 applied here).
⚬	Counterfactual "What-If" Simulation Engine (Epic 5): Replay historical seller submissions (‭$N$‬ months of past appraisals and competitor offers) against prospective spread tiers.
⚬	Visual Trade-Off Calculator: Directly demonstrate scenario trade-offs (e.g., showing how Config A won 50 counter-offers at $1,000 profit vs. Config B winning 40 counter-offers at $1,500 profit—instantly highlighting why winning fewer offers generated $10,000 more net profit).
Recommended Next Step
Run the Codebase Reconstruction Sweep prompt in Claude Code to establish the RECONSTRUCTED_STATE.md artifact. Once that is generated, drop the output into our chat, and we will author UOW-CARBOYZ-01 to kick off the In-Memory Policy Evaluation Engine.


