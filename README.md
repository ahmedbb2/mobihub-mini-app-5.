# MobiHub Mini App — V1.10.0 Manager Workspace

## What this release adds

This release replaces the manager placeholder with a distinct, role-scoped management workspace. The manager landing page no longer displays the engineer's personal attendance/check-out controls or personal summary tiles. Manager tools open in modal sheets instead of being appended below the home dashboard.

### Manager dashboard
- Live aggregate cards from Google Sheets: active engineers, present now, pending requests/leaves, pending cash actions, open complaints, and active devices (each card is shown only to roles allowed to see that domain).
- Daily follow-up: today's latest attendance movement per engineer and absence review records.
- Staff: engineer directory, search, add/edit engineer details, activate/deactivate an account, and assign an active shift with workdays and date range.
- Requests: existing request/leave approval flow and complaint thread/status workflow.
- Finance: existing cash/custody review and the existing deductions/rewards management screens for Finance and Super Admin.
- Devices: registered devices and movement-log count.
- Reports: general monthly attendance, checkout, lateness, absence and leave summary.
- Notifications: read-only log and settings view; controls and test-send are not included yet.

## Role policy

- `Super Admin`: all dashboard modules.
- `Admin`: daily follow-up, staff, devices, requests and reports.
- `Finance`: finance module only.
- `Supervisor`: daily follow-up, requests and read-only notification history/settings.

New staff and shift write endpoints revalidate the role on Apps Script. Engineer create/edit/status and shift assignment are restricted to Super Admin and Admin. The requested workspace is revalidated from Telegram identity and active Google Sheets records on every API request.

## Files

- `index.html`, `styles.css`, `app.js`: Mini App frontend.
- `Code.gs`: Apps Script API V1.10.0.
- `assets/`: MobiHub logo PNG/WebP.
- `MobiHub_Attendance_v40_REFERENCE.gs`: read-only reference copy of the legacy V40 bot. Do not deploy this file over the active bot project.
- `_headers`: Cloudflare Pages security headers.

## Deploy to TEST first

1. Back up the current Cloudflare Pages deployment and the current TEST Apps Script project.
2. Upload `index.html`, `styles.css`, `app.js`, `_headers`, and the complete `assets/` folder to the existing Cloudflare Pages project.
3. Replace `Code.gs` in the TEST Apps Script project and deploy a new Web App version. Keep the same API endpoint so the existing Cloudflare Worker proxy does not need to change.
4. Keep the legacy Telegram bot webhook and production spreadsheet unchanged during testing.
5. Test with at least one account for each role. For dual-role accounts, test both workspace directions.

## Validation performed in this build

- `node --check app.js`: passed.
- Apps Script source syntax checked with Node parser: passed.
- HTML duplicate-ID check: passed.
- `manager_dashboard` aggregate/role-scope tests with mocked sheet rows: passed.

Live Telegram, Cloudflare, Apps Script deployment and real Google Sheets write tests have not been performed from this build environment. Deploy to the TEST project and verify before production.

## Still pending from V40

This is the first functional manager-workspace foundation, not a claim that all 233 legacy functions have migrated. Still to port/test: notification setting mutation and test-send, full notification delivery parity, full device status/movement actions, advanced shift CRUD, manager directory CRUD, deeper employee performance/reward drill-down, and full V40 monthly/financial reports.
