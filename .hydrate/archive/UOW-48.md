Implement UOW-48: Role Route Separation, Admin PIN Lockout, and Dealer Profile Roster UI

Context & Objectives:
Clean up the navigation experience so public sellers only see the submission form, dealer users access operations tools, and dealership administrative settings are protected behind a Manager PIN.

Requirements:

1. Route & Navigation Decoupling:
   - Public Seller Route (/ or ?view=seller):
     - Strip the dealer tab bar (Dealer Studio, Buyer Search, Map, Lead Inbox, Admin, Analytics, Simulation, Test Harness).
     - Display only the dealership branding header and the Sell Your Car intake form.
   - Dealer Portal Route (/dealer or ?view=dealer):
     - Display dealer operations tabs: Lead Inbox, Dealer Studio, Buyer Search, Map, Analytics, Simulation, Admin.
     - Provide a subtle link or toggle in the footer/header to view the public seller intake without cluttering the operational nav.

2. Admin PIN Protection (AdminView.js / AdminController.js):
   - Add a lightweight PIN gate over the Admin tab.
   - Add default adminPin: "1234" to TenantConfig / createTenantConfig defaults.
   - When the user selects the Admin tab:
     - If unlocked for this browser session, render Admin controls normally.
     - If locked, render a clean PIN challenge modal/screen: 4-digit input with numeric keypad support, auto-submit on 4th digit, and clear error state on invalid entry.
   - Provide an explicit "Lock Admin" button inside the unlocked Admin view to clear session authorization.

3. Dealer Team Roster UI (Inside Admin View):
   - Add a "Dealership Team & Notifications" section to AdminView (visible only when unlocked).
   - Support listing, adding, and deleting team members with:
     - id (auto-generated)
     - name (string, required)
     - phone (string, formatted US 10-digit or E.164, required)
     - role ("MANAGER" | "SALES_REP")
     - notifyOnPending (boolean toggle, default true)
   - Store team members via a new or extended tenant storage collection (e.g., DealerProfileService or TenantConfigService) with a default seed member for CarBoyZ desk.

4. Quality Gates & Architecture:
   - Zero-dependency client-side vanilla JS architecture matching repo precedents.
   - Add unit tests for:
     - Navigation routing/visibility based on view param/route.
     - PIN challenge logic, invalid attempt handling, and session lock/unlock states.
     - Team roster CRUD actions and phone format normalization.
   - Ensure all 663+ existing tests pass without regressions.
   - Update .hydrate/PROJECT_JOURNAL.md upon completion.
   - Commit with: "feat(auth): add role route separation, admin pin lockout, and dealer roster UI"
