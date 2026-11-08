# MobiHub Mini App V1.10.5 — Device Integration (TEST Draft)

## Base release
Built on the supplied MobiHub V1.10.4 package. V1.10.4 remains the base so its finance separation, notification fixes, manager workspace, dual-workspace behavior, and legacy bot webhook repair guidance are retained.

## Changes in V1.10.5
### Apps Script API
Added:
- `device_list`: role-filtered device list (administrators see all; intake staff see devices they received; employees see devices assigned to them).
- `device_detail`: device details plus up to 30 latest movement rows, with server-side visibility checks.
- `device_staff`: active eligible employees for assignment/transfer, available to administrators and authorized intake staff.
- `device_status_update`: updates status and optional location, appends a movement row, and checks administrator/intake/assigned-engineer access.
- `device_transfer`: administrator-only reassignment, movement logging, Telegram notification attempt, and notification log.
- `device_inspection_catalog`: returns the existing inspection catalog and per-item instructions from the V1.9 module.

Existing V1.10.4 actions are preserved. Existing `device_register` and `device_update` remain the intake and manager update routes; no duplicate `doPost` or replacement API entry point was introduced.

### Cloudflare Pages frontend
Expanded the existing manager `devices` module with:
- Search over visible devices.
- Device details and movement history.
- Status update form.
- Reassignment form.
- Inspection catalog viewer with the item-level instructions.

### Styling
Added only the CSS needed for the new controls and inspection catalog.

## Important scope limits
- The inspection catalog is displayed, but **inspection results are not yet persisted**. This release does not claim a complete inspection lifecycle or a resumable inspection session.
- Employee-facing assigned-device screen is not yet added; the API is ready to return the employee's assigned devices, but this UI is a follow-up task.
- No live connection to the user's Google Sheets, Telegram, Cloudflare Pages, or Worker was performed from this build environment.
- No production deployment or production data mutation was performed.
- The supplied V1.10.4 `Code.gs` expects the existing `الأجهزة` and `سجل حركة الأجهزة` headers. Do not run against a workbook with a different schema without reviewing it first.

## Files
- `Code.gs`
- `index.html`
- `app.js`
- `styles.css`
- `_headers`
- `assets/`
- `README_V1.10.5_AR.md`
- `LEGACY_BOT_MENU_PATCH.gs` and other V1.10.4 reference files are retained.

## Validation performed
- Node syntax check: `Code.gs` copied to `.js` — passed.
- Node syntax check: `app.js` — passed.
- HTML duplicate-ID check — no duplicate IDs found.
- Runtime API, authorization, Sheets writes, Telegram notification delivery, and browser interaction tests remain pending in TEST.

## TEST deployment sequence
1. Back up the current TEST Apps Script project and Cloudflare Pages project.
2. Confirm TEST workbook contains:
   - `الأجهزة` with the exact 13 columns defined by `MH_DEVICE.DEVICE_HEADERS`.
   - `سجل حركة الأجهزة` with the exact 12 columns defined by `MH_DEVICE.MOVEMENT_HEADERS`.
3. Replace the TEST Apps Script `Code.gs` with this package's `Code.gs`; deploy a new Web App version.
4. Upload `index.html`, `app.js`, `styles.css`, `_headers`, and `assets/` to a separate TEST Cloudflare Pages project (or TEST branch).
5. Keep the existing Cloudflare Worker route only if it already proxies the request body to the TEST Apps Script endpoint. Otherwise configure a separate TEST Worker; do not change the production Worker.
6. Test with separate Super Admin, Admin, intake-staff, and assigned-engineer accounts.
7. Verify each operation in both sheets and Telegram logs before considering production deployment.

## Rollback
Restore the backed-up TEST `Code.gs` deployment and the previous TEST Pages deployment. Production remains untouched by this package.
