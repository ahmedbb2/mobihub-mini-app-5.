# MobiHub Mini App — V1.10.2 Manager Operations

## What this release adds

This is a continuation of the V1.10.2 manager workspace. It keeps the existing V40 bot as the operational reference and uses the same Google Sheets workbook for manager operations.

### Device operations
- Device register list with current state, assigned engineer and storage location.
- Update device status and location from a modal form.
- Reassign a device to an active engineer.
- Append each update to `سجل حركة الأجهزة` with old/new assignee, state, location, actor and note.
- Send a Telegram message to the engineer when a device is newly assigned.

### Notification center
- View recent notification log rows and notification settings.
- Enable/disable existing notification settings by writing to `إعدادات الإشعارات`.
- Send an administrative Telegram message to one active engineer or all active engineers.
- Log successful and failed deliveries in `سجل الإشعارات`.
- The legacy V40 notification engine continues to own scheduled reminders; this Mini App changes the shared settings sheet rather than duplicating the scheduler.

### Manager directory
- Super Admin only: add manager accounts with `Admin`, `Finance` or `Supervisor` roles.
- Change an existing manager's role or activate/deactivate their account.
- Backend revalidates Super Admin permission on every mutation.
- The existing Super Admin cannot be changed through this endpoint.

## Role policy

- `Super Admin`: all dashboard modules, including manager directory.
- `Admin`: daily follow-up, staff, devices, requests, reports and notifications.
- `Finance`: finance module only.
- `Supervisor`: daily follow-up, requests and notification center.

## Files

- `index.html`, `styles.css`, `app.js`: Mini App frontend.
- `Code.gs`: Apps Script API V1.10.2.
- `assets/`: MobiHub logo PNG/WebP.
- `MobiHub_Attendance_v40_REFERENCE.gs`: read-only reference copy of the legacy V40 bot. Do not deploy this file over the active bot project.
- `_headers`: Cloudflare Pages security headers.

## Deploy to TEST first

1. Back up the current Cloudflare Pages deployment and TEST Apps Script project.
2. Upload `index.html`, `styles.css`, `app.js`, `_headers`, and the complete `assets/` folder to the existing Cloudflare Pages project.
3. Replace `Code.gs` in the TEST Apps Script project and deploy a new Web App version. Keep the same API endpoint so the existing Cloudflare Worker proxy does not need to change.
4. Confirm the Apps Script project has `SPREADSHEET_ID` and the Telegram token property (`BOT_TOKEN` or `MOBIHUB_TELEGRAM_BOT_TOKEN`). Never put the bot token in frontend files.
5. Keep the production bot webhook and production spreadsheet unchanged during testing.
6. Test with Super Admin, Admin, Finance and Supervisor accounts. For dual-role accounts, test both workspace directions.

## Validation

- `node --check app.js`: passed.
- Apps Script source syntax checked with Node parser: passed.
- HTML duplicate-ID check: pending in this release build.
- Live Telegram, Cloudflare, Apps Script deployment and real Google Sheets writes have not been performed from this environment. Test the actions in the TEST workbook before production.

## Explicit scope limits

This release adds manager-side device updates, notification setting mutation/manual sends and manager account controls. It does not claim full migration of every legacy V40 workflow. Scheduled notification delivery remains in the legacy V40 trigger engine. Advanced shift CRUD, detailed individual reward/performance drill-down and complete parity testing remain separate work items.
