# MobiHub Mini App V1.9 — Workspace UX refresh

## Included
- Reorganized employee workspace into clear domains: attendance, requests, complaints, rewards/deductions, reports, and device status.
- Added a dedicated My Requests category picker (general requests, leave, cash/custody).
- Split complaint creation from complaint history.
- Added a dedicated monthly employee report endpoint based on V40 attendance/absence calculations.
- Added device status list support scoped to the assigned employee Chat ID (manager visibility follows existing role policy).
- Improved record cards and Liquid Glass styling with readable selected states and mobile layouts.
- Fixed escaped digit regexes in finance month and amount validation that caused valid YYYY-MM values to fail.

## API actions/entities added
- `monthly_summary`
- `devices` list entity

## Important
- This is a TEST package. Do not deploy to production before validation.
- Device registration, device movement writes, withdrawal request flow, and some legacy bot actions still require dedicated migration; this UI refresh does not claim those workflows are complete.
- Existing attendance, leave, cash, complaint, finance and reward API behavior is preserved.
- Backend authorization and row ownership remain server-side.

## Deploy
1. Back up the current test UI and Apps Script project.
2. Upload `index.html`, `styles.css`, `app.js`, `_headers` to the existing Mini App UI hosting branch.
3. Deploy `Code.gs` as a new version in the TEST Apps Script project only.
4. Keep the Cloudflare API proxy Worker unchanged.
5. Test with employee, supervisor, admin, super-admin and finance accounts before production.
