# MobiHub Mini App V1.8 — Deductions & Rewards

This release uses the user's latest uploaded V1.7 files as its base.

## Added
- Employee monthly reward/deduction summary.
- Manager/Finance manual deduction entry with pending approval.
- Manager/Finance approval or rejection of pending deductions.
- Manager/Supervisor hygiene evaluation for an employee and date.
- Manager/Finance additional reward entry (saved as approved, matching the existing V40 reward-bonus workflow).
- Server-side role enforcement for all write actions and employee-list access.

## Existing business rules retained from V40
- Monthly base reward: EGP 500.
- Two points per scheduled shift: one punctuality+uniform point and one hygiene point.
- Approved full-day leave excludes the shift; approved hourly leave excludes only when it covers the shift start.
- Pending hygiene evaluations are excluded from the scored denominator.
- Additional approved rewards are added to the monthly reward total.
- Deduction settings remain in the existing `إعدادات الخصومات` sheet and are not changed by this release.

## Sheets and headers
- `سجل الخصومات`: exact 15-column V40 headers.
- `إعدادات الخصومات`: `الإعداد`, `القيمة`, `الوصف`.
- `المكافآت الإضافية`: exact 9-column headers.
- `تقييم نظافة المكافآت`: exact 7-column headers.
- Existing sheets: `الموظفين`, `الحضور والانصراف`, `طلبات الأذونات`, `جدول الورديات`, `الورديات`.

The backend validates the expected headers before writing. It does not create, rename, or reorder sheets.

## Important scope note
This release does NOT yet migrate automatic attendance-generated deductions (late/attendance/uniform) or overtime request/approval/checkout calculation. Those are the next dedicated phase because they must be integrated with attendance lifecycle and tested carefully.

## Deploy
1. Back up the latest V1.7 files and Apps Script project.
2. Upload `index.html`, `styles.css`, `app.js`, `_headers` to the same GitHub branch used by Cloudflare Pages.
3. Replace `Code.gs` in the TEST Apps Script project only, then deploy a new version.
4. Do not modify the API Proxy Worker.
5. Do not touch production bot or production spreadsheet.

## Validation status
- JavaScript syntax checked.
- Apps Script syntax checked with Node parser (syntax only).
- Not tested against live Google Sheets, Telegram, or real role accounts.
- Test using employee, supervisor, admin and finance accounts before any production rollout.
