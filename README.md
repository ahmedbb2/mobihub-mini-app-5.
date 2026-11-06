# MobiHub Mini App — V1.3 Requests & Leave (TEST ONLY)

## Contents
- `Code.gs`: API V1.3, includes prior V1.2 attendance endpoints plus employee requests and structured leave requests/reviews.
- `index.html`, `styles.css`, `app.js`, `_headers`: complete Mini App front end.

## Important
This build is for the TEST Apps Script project and TEST spreadsheet only. Do not replace the production Telegram bot or production spreadsheet. Keep a backup of the currently working V1.2 test deployment and UI files.

## Deploy
1. In the separate TEST Apps Script project, replace `Code.gs` with this package's `Code.gs`; preserve Script Properties `BOT_TOKEN` and `SPREADSHEET_ID` pointing to test resources.
2. Deploy a new version of the TEST Web App. Confirm the Cloudflare API proxy still targets that test deployment.
3. Upload `index.html`, `styles.css`, `app.js`, `_headers` to the Mini App UI Worker/static hosting project. Do not upload these files to the API proxy Worker.
4. Open the Mini App in Telegram using test accounts.

## V1.3 behavior
- Employee can submit a general request (saved in `الطلبات`, V40 12-column schema).
- Employee can submit a full-day leave (1–3 days) or hourly leave (1–3 hours). Hourly leave requires active shift assignment and a valid start/end within the assigned shift.
- Prevents overlapping pending/approved leave periods.
- Managers with `super_admin`, `admin`, `supervisor` roles can review pending requests and leaves. Finance role cannot review these.
- Leave decision writes decision, time, manager ID/name and closes pending absence records for approved full-day leave, matching V40 rules.
- All actions re-check authorization in Apps Script.

## Schema assumptions checked against provided workbook copy
- `الطلبات`: 12 V40 headers.
- `طلبات الأذونات`: 17 V40 headers.
- `جدول الورديات`, `الورديات`, `مراجعة الغياب`: required for hourly leave and full-day approval conflict checks.
The API checks required request/leave headers before writes and fails closed if missing.

## Not yet verified
No Apps Script runtime, Telegram UI, notification delivery, or live GPS test has been performed. The API does not yet send Telegram notifications on new requests or decisions; the Mini App displays state and managers can refresh the review queue. Approval decision notes are supported by backend but the current UI does not collect a note.
