# Architecture snippets, workflows, sequence diagrams, notes  - CarBoyZ

┌─────────────────────────────────────────────────────────┐
│ 1. Competitor Appraisal                                 │
│    Seller gets an offer from CarMax / Carvana / Hendrick │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Intake & Proof Capture                               │
│    Seller scans/inputs the competitor offer sheet       │
│    & VIN barcode into the CarBoyZ intake                │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Automated Counter-Offer Evaluation                   │
│    CarBoyZ Spread Engine evaluates competitor offer     │
│    against dealer margin tiers & wholesale rules        │
└────────────────────────────┬────────────────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        ▼                                         ▼
┌───────────────────────────┐         ┌───────────────────────────┐
│ Auto-Approved             │         │ Requires Human Review     │
│ Instantly issues guaranteed│        │ Routes to Dealer Inbox    │
│ counter-offer + SVG sheet │         │ for manager adjustment    │
└───────────────────────────┘         └───────────────────────────┘


┌─────────────────────────────────────────────────────────┐
│ UOW-CARBOYZ-24: Option A                                │
│ Mobile QR Session Stash & Desktop Inbox Relay Handoff    │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ UOW-CARBOYZ-25: Option C                                │
│ Offline Workbox PWA Service Worker & Sync Queue         │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ UOW-CARBOYZ-26: Option B                                │
│ Policy Versioning & Cryptographic Audit Ledger          │
└─────────────────────────────────────────────────────────┘

SCENARIO 1: Physical Lot / Showroom Intake
┌────────────────────────────────┐       QR Code Scan       ┌────────────────────────────────┐
│ Seller Phone (Mobile PWA)      ├─────────────────────────►│ Salesperson Tablet/Desktop     │
│ Scans VIN & submits trade-in   │  (Instant Session Stash) │ Opens lead inbox immediately   │
└────────────────────────────────┘                          └────────────────────────────────┘

SCENARIO 2: Remote / At-Home Intake
┌────────────────────────────────┐      WebSocket Relay     ┌────────────────────────────────┐
│ Remote Seller (Mobile)         ├─────────────────────────►│ Dealer Desk (Desktop Inbox)    │
│ Submits offer from home        │    (SyncAdapter / WS)    │ Desktop notification pops up   │
└────────────────────────────────┘                          └────────────────────────────────┘

---

## Strategic Milestone Summary
### 1.	Mobile-to-Desktop Handoff (UOW-24): Seamless QR code pairing and live SyncAdapter relay for instant customer intake on dealer desks.
###	2.	Offline Resilience (UOW-25): Workbox-style PWA caching and an auto-flushing offline submission sync queue.
###	3.	Enterprise Policy Governance (UOW-26): Semantic policy versioning (v1.0.0), hash-chained audit ledgers, and immutable submission policy pinning.
###	4.	Data Framework & Seeding (UOW-27): Parameterized synthetic submission generation and time-series historical policy timeline seeding.
###	5.	Interactive Analytics (UOW-28): Responsive time-series conversion/margin charts with policy deployment pin overlays and dynamic multi-variable filtering.
###	6.	Scenario Simulation (UOW-29): Counterfactual "what-if" policy replay engine computing conversion, gross margin, and volume deltas.



