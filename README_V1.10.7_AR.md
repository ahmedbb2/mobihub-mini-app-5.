# MobiHub Mini App V1.10.7 — TEST build

## Base
This package is based on the provided V1.10.6 TEST bundle. It does not replace or modify the currently working deployment.

## Added in V1.10.7

### 1. Absence review
- Manager/Super Admin/Supervisor can confirm an absence or mark the case as not an absence.
- Decisions are written to the existing `مراجعة الغياب` sheet using the V46 statuses and decision labels.
- The employee is notified through the existing Telegram bot token configured in Apps Script.
- API action: `absence_decide`.

### 2. Overtime lifecycle
- Employee can request approval only while the attendance session is open and from scheduled shift end until 30 minutes after shift end.
- Fixed-time shifts only; flexible shifts are rejected, matching V46. Overnight shift end is supported.
- Duplicate requests for the same employee/shift date are blocked.
- Only Admin/Super Admin can approve or reject; approval after the deadline is rejected and marked expired.
- At checkout, approved overtime is finalized automatically: 1 EGP per whole minute after the first 30 minutes, capped at 120 paid minutes / 120 EGP. Pending requests close as not approved before checkout.
- Finance/Admin/Super Admin can view the overtime register. Only Admin/Super Admin can decide.
- APIs: `overtime_status`, `overtime_request`, `overtime_decide`; checkout now finalizes an approved request.

## Preserved
- Existing V1.10.6 device registry, device inspection save/restore, roles, manager/employee workspaces, requests, leave, finance, rewards, and notification modules remain as the base.
- `app.js` uses the current v2 Cloudflare API proxy URL.

## Version note
- Apps Script `MH.VERSION`: 1.10.7.
- HTML workspace title: V1.10.7.
- Build manifest: 1.10.7.

## Important TEST limitations
- This is a source package only. It has not been deployed to Apps Script, Cloudflare, GitHub, Telegram, or the live spreadsheet.
- Live sheet schemas, notification delivery, approvals and calculations must be tested against a duplicate/test workbook before production.
- No live state or user data was changed.

## Suggested TEST cases
1. Employee on fixed shift: request before shift end (must reject), exactly after shift end (must allow), and after 30 minutes (must reject).
2. Duplicate overtime request for same shift date (must reject).
3. Admin approval before deadline and after deadline (first succeeds; second expires).
4. Checkout after approval: verify minutes, amount, 120-minute cap and finance notification.
5. Checkout while pending: status becomes `لم تتم الموافقة قبل الانصراف`; no payment is computed.
6. Flexible shift: overtime request must be rejected.
7. Supervisor absence decision: confirm and not-absent paths, verify V46 labels and employee notice.
8. Wrong role: employee must not approve/reject overtime or absence; Finance must not approve overtime.
9. Already reviewed absence/overtime rows must reject repeated decisions.

## Deployment warning
Do not replace the working production Apps Script or Cloudflare Static Assets with this TEST package until all test cases above pass. Back up the current deployment and spreadsheet before testing.
