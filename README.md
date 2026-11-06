# MobiHub Mini App — Requests & Cash V1.4

## Scope
- Main employee request center has only three clear actions: Request Leave, Request Cash Advance/Custody, and My Requests. The generic "New Request" workflow is not exposed.
- Existing attendance module remains included.
- Cash advance request, manager/finance approval, payout confirmation, employee settlement submission, manager settlement review, and confirmation of returned remaining cash.
- Attendance checkout is blocked while the employee has an open cash custody.

## Install in TEST only
1. Back up the currently working GitHub UI files and Apps Script `Code.gs`.
2. Replace the GitHub UI files (`index.html`, `app.js`, `styles.css`, `_headers`) with these files and deploy the same UI project.
3. Replace `Code.gs` in the TEST Apps Script project only.
4. Deploy a new Apps Script version. Keep the existing Worker proxy URL and do not modify its Worker code.
5. Confirm the Apps Script Script Properties still point to the TEST spreadsheet and the correct bot token.
6. Test using a test employee and test finance/admin account.

## Required workbook columns
The code validates the required headers before writing:
- `الطلبات`: 12 columns defined in `MH_REQUESTS.REQUEST_HEADERS`.
- `طلبات الأذونات`: 17 columns defined in `MH_REQUESTS.LEAVE_HEADERS`.
- `طلبات السحب`: 27 columns defined in `MH_CASH.HEADERS`.
- `الحضور والانصراف`: 13 columns defined in `MH_ATTENDANCE.HEADERS`.

## Important
- No production bot, production Apps Script, production spreadsheet, or live Telegram bot was changed.
- This package has static syntax validation only. Apps Script runtime, live spreadsheet writes, Telegram authorization, and GPS behavior still require test deployment.
- Settlement permits a recorded actual expense up to five times the approved amount to allow manager review of exceptional overspend; this is a temporary policy choice and should be adjusted if your written policy requires a strict cap.
- A rejected settlement reopens custody for correction and resubmission.
