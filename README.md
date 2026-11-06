# MobiHub Mini App V1.9.4 — Dual Workspace Switch

## What's new
- Accounts that have an active row in both `المديرين` and `الموظفين` can switch between Manager and Engineer workspaces without signing out.
- The selected workspace is sent with every API request and revalidated on the Apps Script server against the active rows in Google Sheets.
- Manager and employee profiles are resolved independently, so the manager row no longer permanently masks the employee identity.
- Accounts with only one active role do not see the switch control.
- The manager workspace no longer mounts the employee attendance/check-in panel. Employee attendance remains available from the Engineer workspace.

## Deploy (TEST first)
1. Back up the current Cloudflare Pages files and Apps Script `Code.gs`.
2. Upload `index.html`, `styles.css`, `app.js`, `_headers`, and `assets/` to the existing Mini App static host.
3. Replace `Code.gs` in the TEST Apps Script project and deploy a new Web App version. Keep the same API URL so the existing Cloudflare proxy remains unchanged.
4. Do not change the legacy Telegram bot webhook or production spreadsheet while testing.

## Role-switch rules
- A dual-role account must have an active manager row and an active employee row with the same Telegram Chat ID.
- Manager mode loads the manager profile and manager permissions from `المديرين`.
- Engineer mode loads the employee profile and employee permissions from `الموظفين`.
- The server rejects a requested workspace that is not registered and active for that Chat ID. Hiding a button in the browser is not treated as authorization.
- Each API request re-resolves the active workspace on the server; no client-only role escalation is possible.

## Validation
JavaScript and Apps Script syntax checks passed. Role-resolution logic was tested with mocked active/inactive manager and employee records. Live Telegram, Cloudflare, and Google Sheets deployment testing is still required.

## Important scope
This release implements dual-role workspace switching and removes the employee attendance panel from the manager workspace. It does not claim that all 233 legacy bot functions, the full manager dashboard, or the full notification system have been migrated.


## V1.9.5 — Workspace return and loading fix
- Restores the engineer home action grid after switching back from manager workspace.
- Defers attendance status loading until the engineer opens attendance or checkout.
- Makes device options and manager review queues non-blocking after bootstrap.
- Loads manager review queues concurrently.
- No Google Sheets schema or Apps Script API contract changes.

The Apps Script backend remains V1.9.4 because this release changes frontend workspace rendering and request timing only.
