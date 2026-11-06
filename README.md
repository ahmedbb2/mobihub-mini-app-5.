# MobiHub Mini App V1.7 — Complaints

Adds complaint creation, private ownership checks, two-way messages, and manager status changes.

## Sheets required
- `شكاوى الموظفين` with the 11 headers from the original V40 complaint schema.
- `سجل رسائل الشكاوى` with the 7 headers from the original V40 conversation schema.

The API validates headers exactly before writing. It does not create or rename sheets automatically.

## Deployment
1. Back up V1.6.
2. Deploy Code.gs to TEST Apps Script only, then publish a new version.
3. Upload index.html, app.js, styles.css and _headers to the GitHub branch used by Cloudflare Pages.
4. Do not change the API Proxy Worker.
5. Test employee complaint creation, employee thread access, employee reply, manager reply, and manager status transitions.
6. Do not move to production until all tests pass.

## Security
Employees can access only complaints where their Telegram Chat ID matches the owner column. Review access is limited to super_admin/admin/supervisor. Finance has no complaint-review permission. Closed complaints reject new messages.

## Test status
Syntax checks only. No live Google Sheets, Telegram notification, or runtime test has been performed. Telegram notifications are not yet wired from this Mini App API; the thread is refreshed when opened.
