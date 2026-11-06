# MobiHub Mini App V1.9.1 — Devices & Reports UI Fix

## Changes
- Hidden legacy service and finance panels on initial workspace load; they open from their relevant workspace actions/navigation instead of duplicating the home tiles.
- Split **الأجهزة** and **التقارير** into separate workspace groups.
- Added a permission-gated **تسجيل جهاز** action for admin/supervisor and active employees whose job title includes استلام/مدير/مشرف.
- Added device intake form: external intake order ID + assigned technician.
- Added server-side device registration, duplicate order protection, sheet header validation, lock protection, and initial movement history entry.
- Device list now includes records where the current employee is either the assigned technician or intake owner; manager roles retain broader visibility.
- API version: 1.9.1.

## Deployment
1. Deploy `Code.gs` to the **TEST Apps Script project** and create a new deployment version.
2. Deploy `index.html`, `styles.css`, and `app.js` to the same Cloudflare Pages branch used by the current Mini App.
3. Keep the existing Cloudflare Worker proxy unchanged.
4. Do not modify the production bot or production spreadsheet during acceptance testing.

## Device registration behavior
- Registration follows the existing V40 rule: available only to admin/supervisor or active intake staff.
- The order ID must already exist in the external intake system. This Mini App records the ID, intake owner, assigned technician, initial status/location, and movement history. It does not import customer/device details from the external intake system.
- The assigned technician receives the record in **حالة الأجهزة**.

## Validation
- `app.js` and `Code.gs` passed Node syntax checks.
- HTML IDs checked for duplicates.
- Live Telegram, Cloudflare, Apps Script deployment, and Google Sheets writes have not been tested from this environment.
