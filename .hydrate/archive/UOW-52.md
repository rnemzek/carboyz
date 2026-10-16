# Unit of Work: UOW-52
# Title: Acquisition Radar (Carto Dark Matter Map), Unlocated Leads Queue & Escalation Heartbeat

- [ ] Task 1: Activate Lead Escalation Heartbeat Poller (src/ui/App.js & src/services/LeadEscalationService.js)
  - Create an active interval runner (startEscalationTicker / stopEscalationTicker) executing every 60 seconds when operating in the `/dealer` view.
  - On each tick, execute LeadEscalationService.evaluatePendingLeads() and evaluateMorningDigest() using current Date.now().
  - Ensure the interval gracefully clears on window unload, route change, or component teardown to prevent memory leaks.

- [ ] Task 2: Dealer HQ Anchor & Range Rings Geometry (src/services/radarLayerBuilder.js)
  - Implement GeoJSON generation helpers for MapLibre GL:
    - Dealership HQ Center Pin: Plot from TenantConfig dealership coordinates (defaulting to CarBoyZ Leland HQ: -78.0383, 34.2526).
    - Radiating Acquisition Rings: Generate concentric GeoJSON circle polygons for 10-mile, 25-mile, and 50-mile radii centered on the dealership HQ.
    - Style specifically for Carto Dark Matter: subtle translucent amber/gold fills, crisp border strokes, and radius distance labels.

- [ ] Task 3: Lead Origins GeoJSON Source & Status Pinning (src/services/radarLayerBuilder.js)
  - Build GeoJSON FeatureCollection mapping submissions into radar targets:
    - Resolve coordinates from submission.zipCode (using offline gazetteer bridge) or explicit submission.lat / lng when present.
    - Exclude submissions with unresolvable or null zipCode from the map geometry (routed to Task 4's Unlocated Queue).
    - Map pin styling by submission status:
      - Bright Amber / Amber Pulse: PENDING_APPROVAL (Action needed immediately)
      - Green: AUTO_COUNTER_SENT / ACCEPTED / WON (Active counter out in territory)
      - Muted Gray: REJECTED / PASSED / LOST (Closed / Passed)
    - Embed feature properties: submission id, vehicle year/make/model, competitor, offer amount, status, and distance from HQ.

- [ ] Task 4: Acquisition Radar View, Lead Inspection Drawer & Unlocated Queue (src/ui/RadarMapView.js & src/ui/views/RadarMapView.js)
  - Update/replace the existing Map view with the Acquisition Radar layout:
    - Mount Carto Dark Matter base tiles with Dealership HQ pin and range rings.
    - Plot mapped leads with status-colored pins and click inspection popup/drawer showing vehicle specs, competitor amount, counter offer, and "Open in Lead Inbox" action link.
    - Add an "Unlocated Leads" dock/collapsible tray (e.g. bottom-right corner) listing submissions where zipCode is null or unresolvable:
      - Display vehicle summary, status badge, and offer amount.
      - Clicking any unlocated lead triggers the same inspection drawer with quick action to review in Lead Inbox.
    - Add top-level territorial metric pill: "Active Leads within 25mi: X | Awaiting Review: Y | Unlocated: Z".

- [ ] Task 5: Testing & Quality Gates
  - Unit tests for radarLayerBuilder.js: GeoJSON circle polygon generation, HQ anchor coordinates, and coordinate resolution from ZIP codes.
  - Assert submissions with null or invalid zipCodes are cleanly separated into an unlocated collection without throwing errors.
  - Lifecycle tests verifying escalation interval ticker starts/stops cleanly without leaking timers.
  - Ensure all 762+ existing tests pass without regressions.
  - Append completion records to .hydrate/PROJECT_JOURNAL.md, DEV_JOURNAL.md, and ARCHITECT_JOURNAL.md.
  - Archive active spec to .hydrate/archive/UOW-52.md.
  - Commit with: "feat(map): transform map into acquisition radar with unlocated queue and escalation ticker"
