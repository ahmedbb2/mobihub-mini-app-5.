# MobiHub Mini App V1.9.3 — Legacy Employee Board Parity

## Included
- Frontend: `index.html`, `styles.css`, `app.js`
- Apps Script API: `Code.gs`
- Original MobiHub logo: `assets/mobihub-logo.webp` and `.png` (also inlined in HTML to prevent broken paths)
- Legacy V40 source reference: `MobiHub_Attendance_v40_REFERENCE.gs` (REFERENCE ONLY; do not deploy this file beside Code.gs)

## Changes
- Employee home buttons follow the legacy keyboard order and 2-column arrangement.
- Employee-facing role label is `مهندس`.
- Attendance, leave, advance, withdrawal, settlement, device, deductions, rewards, requests, monthly report and complaints open in modal sheets instead of requiring page scrolling.
- Added a Mini App cash withdrawal endpoint using the V40 `طلبات السحب` row layout and the legacy `adm|cashact|...` callback contract.
- Cash withdrawal sends the legacy-style employee confirmation and finance/admin approval message through the existing bot token.
- Logo is embedded in HTML and also shipped as assets.

## Deployment
1. Deploy `index.html`, `styles.css`, `app.js`, and the `assets/` folder to the same Cloudflare Pages root.
2. Replace the Apps Script API source with `Code.gs` and deploy a new Web App version.
3. Keep the existing Cloudflare Worker URL and legacy Telegram webhook unchanged.
4. Ensure Apps Script properties include `BOT_TOKEN` (or `MOBIHUB_TELEGRAM_BOT_TOKEN`) and `SPREADSHEET_ID`.
5. Test using a TEST spreadsheet and test employee/admin accounts before production.

## Important limitations
- This release does not claim full V40 migration. Other bot flows and notification families still require parity work.
- The cash withdrawal approval buttons rely on the existing V40 bot webhook handler for `adm|cashact|approve|row`, `reject`, and `paid`. Keep that webhook active.
- Manager dashboard functionality is unchanged in this patch.
