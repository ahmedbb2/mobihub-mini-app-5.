# MobiHub Mini App — Attendance Frontend V1.3

This package combines the supplied current Mini App frontend with the attendance API backend V1.2.

## Files
- `Code.gs`: attendance API backend V1.2. Deploy this in the TEST Apps Script project first.
- `index.html`, `styles.css`, `app.js`, `_headers`: frontend files. Upload these to the existing Cloudflare Worker static-site project, replacing the matching frontend files only after backup.

## Attendance workflow
1. Mini App authenticates using Telegram `initData`.
2. It loads `attendance_status` and displays the assigned shift.
3. Check-in requests GPS coordinates from the device.
4. Backend validates the existing 50m geofence and maximum 50m GPS accuracy, then asks for uniform confirmation.
5. Employee confirms `ملتزم` or `غير ملتزم`; backend writes the attendance row.
6. Checkout obtains GPS again and records checkout.
7. Attendance history displays the employee's own rows.

## Deployment sequence — TEST only
1. Back up the current Apps Script `Code.gs` and current frontend files.
2. Deploy `Code.gs` from this package to the TEST Apps Script deployment as a new version.
3. Confirm the API deployment URL is unchanged and that the Cloudflare proxy still targets it.
4. Upload the frontend files to the existing UI host. Do not replace the proxy Worker with the static UI files.
5. Test on a real phone from inside Telegram, with location permission enabled, first using an employee test account.

## Important limitations
- The API and frontend have passed static JavaScript syntax validation only. They have NOT been run against the live test spreadsheet or a real GPS device from this environment.
- The UI only exposes employee attendance status/history/check-in/checkout. Manager attendance review and other bot modules remain to be migrated.
- Existing request, leave, complaint, and cash screens remain read-only.
- GPS and shift rules are server-validated; never rely on browser-side validation alone.
- If any sheet header differs from the expected V40 schema, stop and reconcile the schema before testing writes.
