# MobiHub Mini App V1.10.9 — Cloudflare deploy fix

هذه الحزمة مخصصة لنشر الواجهة فقط على Cloudflare Workers Static Assets.

## محتويات النشر
- `wrangler.jsonc`: يحدد Worker الحالي `mobihub-mini-app-5` ومجلد الأصول `dist/`.
- `dist/`: يحتوي فقط على ملفات الواجهة العامة (HTML/CSS/JS والصور و`_headers`).
- ملفات Apps Script (`Code.gs`) والمرجع القديم والاختبارات ليست داخل `dist` لتجنب نشرها كملفات عامة.

## لماذا هذا الإصلاح؟
1. تمت إزالة السطر الفارغ من بداية `dist/_headers`؛ يبدأ الملف مباشرةً بقاعدة المسار `/*`.
2. تم ضبط مجلد الأصول إلى `./dist` بدل `.` حتى لا تنشر ملفات المستودع غير العامة مثل ملفات `.gs` والوثائق والاختبارات.
3. عنوان API في `app.js` مضبوط على Cloudflare API Worker V2 الحالي.

## خطوات الاستخدام
1. خذ نسخة احتياطية من مستودع GitHub الحالي.
2. فك ضغط هذه الحزمة في مجلد مؤقت.
3. انقل `wrangler.jsonc` إلى جذر مستودع `mobihub-mini-app-5`.
4. انقل مجلد `dist` كاملًا إلى جذر المستودع.
5. تأكد أن Build/Deploy command ما زال `npx wrangler deploy`، ولا تضف خطوة build أخرى.
6. اعمل Commit وPush.
7. راقب سجل Cloudflare. المفروض يظهر `assets directory ./dist`، وعدد الملفات العامة سيكون ملفات الواجهة فقط وليس كل ملفات المستودع.

## لا تنفذ
- لا تنقل `Code.gs` إلى `dist`.
- لا تحذف أو تغيّر Apps Script API أو Worker API أو Telegram Webhook.
- لا تغيّر إعدادات Worker API أو أسرار Telegram.

## الاختبار بعد النشر
- افتح رابط Mini App وتأكد من تحميل اللوحة.
- افتح Developer Tools/Network وتأكد أن طلبات API تذهب إلى `mobihub-telegram-proxy-v2`.
- تحقق أن `/Code.gs` وملفات المرجع القديمة لا تُخدم من Worker الواجهة.
