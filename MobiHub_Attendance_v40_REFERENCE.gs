/**
 * MobiHub Attendance System - V34 - V33
 * Telegram + Google Apps Script + Google Sheets
 * GPS Attendance / Check-out / Leave / Advance
 */
const WEBHOOK_SECRET = "MobiHub_Attendance_2026_Secure";
const BOT_TOKEN_PROPERTY = "MOBIHUB_TELEGRAM_BOT_TOKEN";
const ADMIN_ID = "9134455704"; // الحساب الرئيسي الحالي ويظل Super Admin افتراضيًا
const ADMINS_SHEET = "المديرين";
const ADMINS_HEADERS = ["Chat ID", "اسم المدير", "الصلاحية", "الحالة", "أضيف بواسطة", "تاريخ الإضافة", "آخر تحديث"];
const ADMIN_ROLES = { SUPER: "Super Admin", ADMIN: "Admin", FINANCE: "Finance", SUPERVISOR: "Supervisor" };
// Cache صلاحيات المديرين داخل تنفيذ الطلب الحالي فقط؛ يعاد ضبطه مع كل Webhook/Trigger.
var ADMIN_ROLE_REQUEST_CACHE_ = {};
function resetAdminRoleRequestCache_() { ADMIN_ROLE_REQUEST_CACHE_ = {}; }
const WEB_APP_URL = "https://mobihub-telegram-proxy.ahmedmtarek20.workers.dev/";
// إحداثيات مركز MobiHub
const CENTER_LAT = 30.041124;
const CENTER_LONG = 31.204098;

// أقصى مسافة مسموحة من المركز
const ALLOWED_DISTANCE_METERS = 50;

// أقصى دقة GPS مقبولة بالمتر
const MAX_GPS_ACCURACY_METERS = 50;

const TIME_ZONE = "Africa/Cairo";

const EMP_SHEET = "الموظفين";
const ATT_SHEET = "الحضور والانصراف";
const ATT_ARCHIVE_SHEET = "أرشيف الحضور والانصراف";
const REQ_SHEET = "الطلبات";
const SHIFT_SHEET = "الورديات";
const FLEX_SHIFT_ID = "FLEX_NO_FIXED_TIME";
const ASSIGNMENT_SHEET = "جدول الورديات";
const ABSENCE_SHEET = "مراجعة الغياب";
const LEAVE_SHEET = "طلبات الأذونات";
const LEAVE_HEADERS = ["رقم الطلب", "تاريخ الإرسال", "Chat ID", "اسم الموظف", "نوع الإذن", "تاريخ الإذن", "من الساعة", "إلى الساعة", "السبب", "الحالة", "قرار المدير", "تاريخ القرار", "ملاحظات المدير", "عدد الأيام", "تاريخ نهاية الإذن", "Chat ID المدير", "اسم المدير"];

const DEDUCTION_SHEET = "سجل الخصومات";
const DEDUCTION_HEADERS = ["رقم الخصم", "تاريخ الواقعة", "Chat ID", "اسم الموظف", "نوع الخصم", "السبب", "المبلغ بالجنيه", "المصدر", "الحالة", "مرجع الواقعة", "تاريخ التسجيل", "تاريخ الاعتماد", "منفذ الإجراء", "ملاحظات", "سبب الرفض/الإلغاء"];
const DEDUCTION_SETTINGS_SHEET = "إعدادات الخصومات";
const DEDUCTION_SETTINGS_HEADERS = ["الإعداد", "القيمة", "الوصف"];
const DEDUCTION_DEFAULTS = [["التأخير_للدقيقة", "1.5", "قيمة خصم الدقيقة"], ["خصم_اليونيفورم", "30", "خصم عدم الالتزام باليونيفورم"], ["خصم_عدم_التسجيل", "50", "خصم عدم التسجيل على السيستم"], ["التلقائي_بانتظار_الاعتماد", "TRUE", "الخصومات التلقائية تتطلب اعتماد المدير"]];
const CASH_SHEET = "طلبات السحب";
const COMPLAINT_SHEET = "شكاوى الموظفين";
const COMPLAINT_MESSAGES_SHEET = "سجل رسائل الشكاوى";
const COMPLAINT_MESSAGE_HEADERS = ["رقم الرسالة", "رقم الشكوى", "Chat ID المرسل", "صفة المرسل", "اسم المرسل", "نص الرسالة", "التاريخ والوقت"];
const NOTIFICATIONS_SHEET = "سجل الإشعارات";
const NOTIFICATIONS_ARCHIVE_SHEET = "أرشيف سجل الإشعارات";
const NOTIFICATION_SETTINGS_SHEET = "إعدادات الإشعارات";
const REWARD_HYGIENE_SHEET = "تقييم نظافة المكافآت";
const REWARD_HYGIENE_HEADERS = ["التاريخ", "Chat ID", "اسم الموظف", "التقييم", "ملاحظات", "قيّم بواسطة", "وقت التقييم"];
const REWARD_BONUS_SHEET = "المكافآت الإضافية";
const REWARD_BONUS_HEADERS = ["رقم المكافأة", "التاريخ", "الشهر", "Chat ID", "اسم الموظف", "المبلغ بالجنيه", "السبب", "المسجل بواسطة", "الحالة"];
const REWARD_BASE_AMOUNT = 500;
const REWARD_DAILY_POINTS = 2;
const REWARD_HYGIENE_PENALTY_AMOUNT = 50;
const OVERTIME_SHEET = "سجل الأوفر تايم";
const OVERTIME_HEADERS = ["رقم الطلب", "تاريخ الوردية", "Chat ID", "اسم المهندس", "Shift ID", "موعد نهاية الوردية", "بداية الأوفر تايم", "آخر موعد للموافقة", "وقت طلب الموافقة", "الحالة", "قرار المدير بواسطة", "وقت القرار", "وقت الانصراف الفعلي", "دقائق الأوفر تايم", "المبلغ بالجنيه", "ملاحظات"];
const OVERTIME_GRACE_MINUTES = 30;
const OVERTIME_RATE_PER_MINUTE = 1;
const OVERTIME_MAX_PAID_MINUTES = 120;

const BOT_UPDATES_SHEET = "تحديثات البوت";
const BOT_UPDATE_HEADERS = ["التاريخ", "الإصدار", "عنوان التحديث", "تفاصيل التحديث", "الحالة"];
const DEVICES_SHEET = "الأجهزة";
const DEVICE_MOVEMENTS_SHEET = "سجل حركة الأجهزة";
const DEVICE_HEADERS = ["رقم الطلب", "تاريخ الاستلام", "اسم الجهاز", "اسم العميل", "المشكلة المسجلة", "مسؤول الاستلام Chat ID", "مسؤول الاستلام", "الموظف المسؤول Chat ID", "الموظف المسؤول", "القسم", "حالة الجهاز", "مكان الجهاز", "آخر تحديث"];
const DEVICE_MOVEMENT_HEADERS = ["التاريخ والوقت", "رقم الطلب", "نوع الحركة", "من Chat ID", "من الموظف", "إلى Chat ID", "إلى الموظف", "الحالة", "المكان", "ملاحظات", "منفذ الحركة Chat ID", "منفذ الحركة"];
const DEVICE_STATUSES = ["تم الاستلام", "قيد الفحص", "يحتاج قطعة غيار", "يحتاج التواصل مع العميل", "بانتظار رد العميل", "لم يتم الرد", "قيد الإصلاح", "مراجعة الجودة", "يحتاج إعادة فحص", "جاهز للتسليم", "تم التسليم"];
const DEVICE_LOCATIONS = ["قسم الاستلام", "ترابيزة الهاردوير", "درج الفحص 1", "درج الفحص 2", "درج مراجعة الجودة", "درج انتظار قطع الغيار", "درج انتظار العميل", "درج جاهز للتسليم", "مكان آخر"];
const NOTIFICATION_HEADERS = ["معرف الإشعار", "التاريخ والوقت", "المستلم", "نوع الإشعار", "مفتاح منع التكرار", "الحالة", "تفاصيل الخطأ"];
const NOTIFICATION_SETTINGS_HEADERS = ["الإعداد", "القيمة", "الوصف"];
const DEFAULT_NOTIFICATION_SETTINGS = [
  ["تذكير_قبل_ساعة", "TRUE", "إرسال تذكير قبل بداية الوردية بساعة"],
  ["تذكير_قبل_نصف_ساعة", "TRUE", "إرسال تذكير قبل بداية الوردية بنصف ساعة"],
  ["تذكير_الانصراف_عند_النهاية", "TRUE", "تذكير الموظف عند انتهاء الوردية"],
  ["تذكير_الانصراف_بعد_15_دقيقة", "TRUE", "إعادة تذكير الموظف بعد 15 دقيقة"],
  ["تنبيه_المدير_بعد_30_دقيقة", "TRUE", "إشعار المدير إذا لم يسجل الموظف الانصراف بعد 30 دقيقة"],
  ["تنبيه_الموظف_بعد_السماح", "TRUE", "إشعار الموظف بعد تجاوز فترة السماح دون حضور"],
  ["تقرير_بعد_آخر_وردية", "TRUE", "إرسال التقرير بعد آخر وردية بـ15 دقيقة"],
  ["دقائق_تأخير_التقرير", "15", "عدد الدقائق بعد نهاية آخر وردية لإرسال التقرير"]
];
const GRACE_MINUTES_DEFAULT = 15;

const EMP_HEADERS = [
  "Chat ID",
  "اسم الموظف",
  "الوظيفة",
  "رقم الهاتف",
  "الحالة",
  "حالة الحساب"
];

const ATT_HEADERS = [
  "التاريخ",
  "الوقت",
  "Chat ID",
  "اسم الموظف",
  "النوع",
  "المسافة بالمتر",
  "دقة GPS بالمتر",
  "Latitude",
  "Longitude",
  "حالة الحضور",
  "دقائق التأخير",
  "Shift ID",
  "اليونيفورم"
];

const REQ_HEADERS = [
  "التاريخ والوقت",
  "Chat ID",
  "اسم الموظف",
  "نوع الطلب",
  "التفاصيل",
  "القرار",
  "مبلغ السلفة بالجنيه",
  "سبب السلفة",
  "نوع مدة الإذن",
  "عدد الأيام",
  "عدد الساعات",
  "سبب الإذن"
];

const SHIFT_HEADERS = ["Shift ID", "اسم الوردية", "موعد الحضور", "موعد الانصراف", "فترة السماح بالدقائق", "الحالة"];
const ASSIGNMENT_HEADERS = ["Chat ID", "Shift ID", "تاريخ البداية", "تاريخ النهاية", "أيام العمل", "الحالة"];
const ABSENCE_HEADERS = ["التاريخ", "Chat ID", "اسم الموظف", "Shift ID", "موعد الحضور", "وقت اكتشاف الحالة", "الحالة", "قرار المدير", "وقت القرار"];
const CASH_HEADERS = [
  "رقم الطلب", "التاريخ والوقت", "Chat ID", "اسم الموظف", "المبلغ المطلوب بالجنيه",
  "الغرض", "الحالة", "المبلغ المعتمد بالجنيه", "حالة الصرف", "المسؤول عن الصرف",
  "تاريخ الصرف", "حالة العهدة", "ملاحظات المدير", "تاريخ آخر تحديث",
  "المصروف الفعلي بالجنيه", "المبلغ المطلوب إرجاعه بالجنيه",
  "المبلغ الإضافي المستحق للموظف بالجنيه", "حالة التسوية", "تاريخ تقديم التسوية",
  "تاريخ تأكيد استلام المتبقي", "المسؤول عن استلام المتبقي",
  "حالة التعويض", "تاريخ اعتماد التعويض", "تاريخ صرف التعويض", "ملاحظات التسوية", "Chat ID آخر مدير قرار", "اسم آخر مدير قرار"
];
const COMPLAINT_HEADERS = [
  "رقم الشكوى", "التاريخ والوقت", "Chat ID", "اسم الموظف", "نوع الشكوى",
  "الشخص المعني", "تفاصيل الشكوى", "الحالة", "ملاحظات المدير", "تاريخ آخر تحديث", "نتيجة التعامل"
];

const STATE_ACTIVE = "نشط";
const STATE_CHECKIN = "انتظار_لوكيشن_حضور";
const STATE_CHECKOUT = "انتظار_لوكيشن_انصراف";
const STATE_LEAVE = "انتظار_اذن"; // توافق مع الحالات القديمة
const STATE_ADVANCE = "انتظار_سلفة"; // توافق مع الحالات القديمة
const STATE_LEAVE_TYPE = "انتظار_نوع_الاذن";
const STATE_LEAVE_AMOUNT = "انتظار_مدة_الاذن";
const STATE_LEAVE_REASON = "انتظار_سبب_الاذن";
const STATE_LEAVE_DATE = "انتظار_تاريخ_الاذن";
const STATE_LEAVE_FROM = "انتظار_بداية_الاذن";
const STATE_LEAVE_HOURS = "انتظار_مدة_اذن_الساعات";
const STATE_LEAVE_DAYS = "انتظار_عدد_ايام_الاذن";
const STATE_LEAVE_CUSTOM_DATE = "انتظار_تاريخ_مخصص_للاذن";
const STATE_LEAVE_TO = "انتظار_نهاية_الاذن";
const STATE_ADVANCE_AMOUNT = "انتظار_مبلغ_السلفة";
const STATE_ADVANCE_REASON = "انتظار_سبب_السلفة";
const STATE_UNIFORM = "انتظار_تأكيد_اليونيفورم";
const STATE_CASH_AMOUNT = "انتظار_مبلغ_السحب";
const STATE_CASH_PURPOSE = "انتظار_غرض_السحب";
const STATE_CASH_SETTLEMENT_AMOUNT = "انتظار_مبلغ_تسوية_العهدة";
const STATE_CASH_SETTLEMENT_PICK = "اختيار_عهدة_للتسوية";
const STATE_COMPLAINT_TYPE = "انتظار_نوع_الشكوى";
const STATE_COMPLAINT_PERSON = "انتظار_الشخص_المعني_بالشكوى";
const STATE_COMPLAINT_DETAILS = "انتظار_تفاصيل_الشكوى";


/* =========================================
   WEB APP
========================================= */

function doGet() {
  return ContentService
    .createTextOutput("MobiHub Attendance Bot is running.")
    .setMimeType(ContentService.MimeType.TEXT);
}


function doPost(e) {

  resetAdminRoleRequestCache_();
  let chatId = "";
  let lock = null;
  const perf = { started: Date.now(), lockWaitMs: 0, sheetsMs: 0, lockedAt: 0 };

  try {

    if (!e || !e.postData || !e.postData.contents) {
      return ok_();
    }

    const update = JSON.parse(e.postData.contents);

    // معالجة الأزرار تحت ScriptLock لمنع تنفيذ موافقتين متزامنتين من مديرين مختلفين.
    if (update.callback_query) {
      const callback = update.callback_query;
      const callbackChatId = String(callback.message && callback.message.chat && callback.message.chat.id || callback.from && callback.from.id || "");
      try {
        lock = LockService.getScriptLock();
        lock.waitLock(15000);
        handleCallback_(callback, getSheets_());
      } catch (callbackErr) {
        console.error("Callback lock/handle error: " + (callbackErr && callbackErr.stack || callbackErr));
        try { answerCallbackQuery_(callback.id, "⚠️ حصل خطأ أو النظام مشغول، حاول مرة تانية."); } catch (answerErr) { console.error("Callback answer failed: " + answerErr); }
        if (callbackChatId) {
          try { sendMessage_(callbackChatId, "⚠️ تعذر تنفيذ الاختيار حاليًا. لم يتم تأكيد العملية؛ حاول مرة أخرى."); } catch (notifyErr) { console.error("Callback user notice failed: " + notifyErr); }
        }
      }
      return ok_();
    }

    if (!update.message) {
      return ok_();
    }

    const message = update.message;

    chatId = String(
      message.chat && message.chat.id || ""
    );

    if (!chatId) {
      return ok_();
    }

    // النظام يعمل في المحادثات الخاصة فقط
    if (!message.chat || message.chat.type !== "private") {

      sendMessage_(
        chatId,
        "⚠️ من فضلك افتح محادثة خاصة مع بوت MobiHub لاستخدام نظام الحضور."
      );

      return ok_();
    }

    const text = String(message.text || "").trim();

    lock = LockService.getScriptLock();
    const lockStarted = Date.now();
    lock.waitLock(15000);
    perf.lockWaitMs = Date.now() - lockStarted;
    perf.lockedAt = Date.now();

    const sheetsStarted = Date.now();
    const sheets = getSheets_();
    perf.sheetsMs = Date.now() - sheetsStarted;

    // أمر احتياطي للحصول على Chat ID عند تسجيل موظف جديد (لا يظهر كزر في القائمة).
    if (isCommand_(text, "myid")) {
      sendMessage_(chatId, "🆔 Telegram Chat ID الخاص بك:\n" + chatId + "\n\nأرسل الرقم لمسؤول المركز لإضافتك.");
      return ok_();
    }

    const employee = findEmployee_(sheets.emp, chatId);

    // حسابات المديرين تدخل لوحة الإدارة افتراضيًا حتى لو كانت مسجلة أيضًا كموظفين.
    // يمكن للمدير الذي لديه سجل موظف فتح لوحة الموظف صراحةً باستخدام /employee.
    if (isAdmin_(chatId, sheets) && (isCommand_(text, "start") || text === "القائمة الرئيسية" || text === "🛡️ لوحة الإدارة")) {
      clearAdminWizard_(chatId);
      sendAdminMenu_(chatId);
      return ok_();
    }
    if (isAdmin_(chatId, sheets) && isCommand_(text, "employee")) {
      if (!employee) {
        sendMessage_(chatId, "هذا الحساب مدير فقط ولا يوجد له ملف موظف.");
        sendAdminMenu_(chatId);
      } else {
        setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
        sendMainMenu_(chatId, "👤 لوحة الموظف", sheets);
      }
      return ok_();
    }

    if (isAdmin_(chatId, sheets) && handleAdminMessage_(chatId, text, sheets)) {
      return ok_();
    }

    if (employee && getEmployeeAccountStatus_(sheets.emp, employee.row) !== "نشط") {
      sendMessage_(chatId, "⛔ حسابك موقوف حاليًا. يرجى مراجعة إدارة MobiHub.");
      return ok_();
    }

    // تحديث لوحة الموظف وعرض آخر تحديثات البوت
    if (employee && (text === "🔄 تحديث اللوحة" || text === "تحديث اللوحة")) {
      sendEmployeeRefresh_(chatId, employee, sheets);
      return ok_();
    }

    // بدء البوت أو إلغاء العملية
    if (
      isCommand_(text, "start") ||
      text === "❌ إلغاء" ||
      text === "القائمة الرئيسية"
    ) {
      PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
      PropertiesService.getScriptProperties().deleteProperty(uniformFlowKey_(chatId));

      if (!employee) {

        sendUnregisteredAccountMessage_(chatId, true);

      } else {

        setEmployeeState_(
          sheets.emp,
          employee.row,
          STATE_ACTIVE
        );

        sendMainMenu_(
          chatId,
          "أهلًا بك يا " +
          employee.name +
          " في نظام حضور وانصراف MobiHub.\n\n" +
          "اختر العملية المطلوبة:"
        , sheets);
      }

      return ok_();
    }

    if (!employee) {

      sendUnregisteredAccountMessage_(chatId, false);

      return ok_();
    }

    if (handleComplaintReplyText_(chatId, text, sheets, false)) return ok_();

    // إعادة تفعيل مسارات تتبع الأجهزة من القائمة الرئيسية ورسائل الموظف.
    if (handleDeviceText_(chatId, text, employee, sheets)) return ok_();

    const state = getEmployeeState_(
      sheets.emp,
      employee.row
    );

    const date = today_();

    // تسجيل حضور
    if (text === "✅ تسجيل حضور") {

      if (hasOpenAttendance_(sheets.att, chatId)) {
        sendMainMenu_(chatId, "⚠️ لديك حضور سابق لم يتم تسجيل انصرافه بعد. سجّل الانصراف أولًا أو راجع الإدارة إذا كان هناك خطأ.", sheets);
        return ok_();
      }

      if (
        hasAttendanceToday_(
          sheets.att,
          chatId,
          "حضور",
          date
        )
      ) {

        sendMainMenu_(
          chatId,
          "⚠️ تم تسجيل حضورك بالفعل اليوم."
        , sheets);

        return ok_();
      }

      setEmployeeState_(
        sheets.emp,
        employee.row,
        STATE_CHECKIN
      );

      sendLocationRequest_(
        chatId,
        "📍 لتسجيل الحضور، اضغط على زر إرسال موقعي الحالي بالأسفل.\n\n" +
        "تأكد من تفعيل GPS وأنك داخل المركز."
      );

      return ok_();
    }

    // تسجيل انصراف
    if (text === "🚪 تسجيل انصراف") {

      if (
        !hasOpenAttendance_(
          sheets.att,
          chatId
        )
      ) {

        sendMainMenu_(
          chatId,
          "⚠️ لا يوجد تسجيل حضور مفتوح اليوم.\n" +
          "يجب تسجيل الحضور أولًا."
        , sheets);

        return ok_();
      }

      // الانصراف لا يحتاج GPS؛ يمكن تسجيله حتى لو غادر الموظف نطاق المركز.
      completeCheckoutWithoutGps_(chatId, employee, sheets);
      return ok_();
    }

    // بيانات الوردية الحالية
    if (text === "🕒 ورديتي") {
      sendEmployeeShift_(chatId, employee, sheets);
      return ok_();
    }

    // سجل الحضور والانصراف
    if (text === "📋 سجل الحضور") {
      sendEmployeeAttendanceHistory_(chatId, sheets, 30);
      return ok_();
    }

    if (text === "🏆 مكافآتي") {
      sendEmployeeRewardsSummary_(chatId, employee, sheets);
      return ok_();
    }

    // ملخص الشهر الحالي
    if (text === "💰 خصوماتي") {
      sendEmployeeDeductionsSummary_(chatId, sheets);
      return ok_();
    }

    if (text === "📊 ملخص الشهر") {
      sendEmployeeMonthlySummary_(chatId, sheets);
      return ok_();
    }

    // طلباتي
    if (text === "📩 طلباتي") {
      sendEmployeeRequests_(chatId, sheets, 10);
      return ok_();
    }

    // بدء طلب إذن منظم: تحديد الوحدة أولًا
    if (text === "⏳ طلب إذن") {
      setEmployeeState_(sheets.emp, employee.row, STATE_LEAVE_TYPE);
      sendChoiceMenu_(chatId, "⏳ نوع الإذن المطلوب؟", [
        ["⏱ إذن بالساعات", "📅 إذن بالأيام"],
        ["❌ إلغاء"]
      ]);
      return ok_();
    }

    // بدء طلب سلفة منظم
    if (text === "💵 طلب سلفة") {
      PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify({kind:"سلفة"}));
      setEmployeeState_(sheets.emp, employee.row, STATE_ADVANCE_AMOUNT);
      sendCancelMenu_(chatId, "💵 اكتب مبلغ السلفة المطلوب بالجنيه المصري، بالأرقام فقط:");
      return ok_();
    }

    // بدء تسوية عهدة مالية مفتوحة
    if (text === "💰 تسوية عهدة") {
      startCashSettlement_(chatId, employee, sheets);
      return ok_();
    }

    // بدء طلب سحب مبلغ لمشتريات المركز
    if (text === "💰 طلب سحب مبلغ") {
      setEmployeeState_(sheets.emp, employee.row, STATE_CASH_AMOUNT);
      sendCancelMenu_(chatId, "💰 اكتب المبلغ المطلوب بالجنيه المصري بالأرقام فقط:");
      return ok_();
    }

    if (text === "📨 شكاويي") {
      sendEmployeeComplaints_(chatId, sheets);
      return ok_();
    }

    // بدء تقديم شكوى داخل المركز
    if (text === "📩 تقديم شكوى") {
      setEmployeeState_(sheets.emp, employee.row, STATE_COMPLAINT_TYPE);
      sendChoiceMenu_(chatId, "📩 اختر نوع الشكوى:", [
        ["👤 شكوى من موظف", "🧑‍💼 شكوى من مسؤول أو مدير"],
        ["🏢 مشكلة في بيئة العمل", "📋 مشكلة إدارية أو توزيع مهام"],
        ["📝 شكوى أخرى"],
        ["❌ إلغاء"]
      ]);
      return ok_();
    }

    // اختيار العهدة المطلوب تسويتها عند وجود أكثر من طلب مفتوح
    if (state === STATE_CASH_SETTLEMENT_PICK) {
      const flow = getRequestFlow_(chatId);
      if (!flow || flow.kind !== "اختيار تسوية عهدة") {
        setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
        sendMainMenu_(chatId, "انتهت صلاحية اختيار العهدة. ابدأ التسوية من جديد.", sheets);
        return ok_();
      }
      if (text === "➡️ التالي" || text === "⬅️ السابق") {
        const totalPages = Math.max(1, Math.ceil((flow.items || []).length / 8));
        flow.page = Math.max(0, Math.min(totalPages - 1, Number(flow.page || 0) + (text === "➡️ التالي" ? 1 : -1)));
        PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify(flow));
        sendCashSettlementPage_(chatId, flow);
        return ok_();
      }
      const selected = (flow.items || []).filter(function(x) { return x.label === text; })[0];
      if (!selected) {
        sendCashSettlementPage_(chatId, flow);
        return ok_();
      }
      flow.kind = "تسوية عهدة";
      flow.row = selected.row;
      delete flow.items;
      PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify(flow));
      setEmployeeState_(sheets.emp, employee.row, STATE_CASH_SETTLEMENT_AMOUNT);
      promptCashSettlementAmount_(chatId, flow.row, sheets);
      return ok_();
    }

    // استقبال إجمالي المصروفات الفعلية لتسوية العهدة
    if (state === STATE_CASH_SETTLEMENT_AMOUNT) {
      const rawAmount = normalizeNumericInput_(text);
      const spent = Number(rawAmount);
      if (!/^\d+(?:\.\d{1,2})?$/.test(rawAmount) || !isFinite(spent) || spent < 0 || spent > 1000000) {
        sendCancelMenu_(chatId, "⚠️ المبلغ غير صحيح. اكتب إجمالي المصروفات بالجنيه، ويمكن كتابة 0 إذا لم يتم الصرف.");
        return ok_();
      }
      const flow = getRequestFlow_(chatId);
      if (!flow || flow.kind !== "تسوية عهدة" || !flow.row) {
        setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
        PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
        sendMainMenu_(chatId, "انتهت صلاحية التسوية. افتح (تسوية عهدة) من جديد.", sheets);
        return ok_();
      }
      saveCashSettlement_(chatId, employee, Number(flow.row), spent, sheets);
      PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
      return ok_();
    }

    // مراحل طلب سحب مبلغ
    if (state === STATE_CASH_AMOUNT) {
      const rawAmount = normalizeNumericInput_(text);
      const amount = Number(rawAmount);
      if (!/^\d+(?:\.\d{1,2})?$/.test(rawAmount) || !isFinite(amount) || amount <= 0 || amount > 1000000) {
        sendCancelMenu_(chatId, "⚠️ المبلغ غير صحيح. اكتب مبلغًا موجبًا بالجنيه، مثال: 750");
        return ok_();
      }
      PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify({kind:"سحب مبلغ", amount:amount}));
      setEmployeeState_(sheets.emp, employee.row, STATE_CASH_PURPOSE);
      sendCancelMenu_(chatId, "اكتب الغرض من المبلغ، وما الذي تحتاج شراءه للمركز؟");
      return ok_();
    }

    if (state === STATE_CASH_PURPOSE) {
      if (!text || text.length < 3) {
        sendCancelMenu_(chatId, "اكتب الغرض بشكل أوضح، أو اضغط إلغاء.");
        return ok_();
      }
      const flow = getRequestFlow_(chatId);
      if (!flow || flow.kind !== "سحب مبلغ") {
        setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
        sendMainMenu_(chatId, "انتهت صلاحية الطلب. ابدأ طلب سحب المبلغ من جديد.", sheets);
        return ok_();
      }
      saveCashRequest_(chatId, employee, flow.amount, text, sheets);
      PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
      return ok_();
    }

    // مراحل تقديم الشكوى
    if (state === STATE_COMPLAINT_TYPE) {
      const allowedTypes = ["👤 شكوى من موظف", "🧑‍💼 شكوى من مسؤول أو مدير", "🏢 مشكلة في بيئة العمل", "📋 مشكلة إدارية أو توزيع مهام", "📝 شكوى أخرى"];
      if (allowedTypes.indexOf(text) === -1) {
        sendChoiceMenu_(chatId, "اختر نوع الشكوى من الأزرار:", [
          ["👤 شكوى من موظف", "🧑‍💼 شكوى من مسؤول أو مدير"],
          ["🏢 مشكلة في بيئة العمل", "📋 مشكلة إدارية أو توزيع مهام"],
          ["📝 شكوى أخرى"], ["❌ إلغاء"]
        ]);
        return ok_();
      }
      PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify({kind:"شكوى", complaintType:text.replace(/^[^ ]+ /, "")}));
      setEmployeeState_(sheets.emp, employee.row, STATE_COMPLAINT_PERSON);
      sendChoiceMenu_(chatId, "هل يوجد شخص معين مرتبط بالشكوى؟ يمكنك اختيار تخطي أو كتابة اسمه في رسالة.", [["⏭ تخطي"] , ["❌ إلغاء"]]);
      return ok_();
    }

    if (state === STATE_COMPLAINT_PERSON) {
      const flow = getRequestFlow_(chatId);
      if (!flow || flow.kind !== "شكوى") {
        setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
        sendMainMenu_(chatId, "انتهت صلاحية الشكوى. ابدأ تقديمها من جديد.", sheets);
        return ok_();
      }
      flow.person = text === "⏭ تخطي" ? "" : text;
      PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify(flow));
      setEmployeeState_(sheets.emp, employee.row, STATE_COMPLAINT_DETAILS);
      sendCancelMenu_(chatId, "اكتب تفاصيل الشكوى بوضوح: ماذا حدث؟ ومتى؟ وأي تفاصيل تساعد الإدارة على مراجعتها.");
      return ok_();
    }

    if (state === STATE_COMPLAINT_DETAILS) {
      if (!text || text.length < 5) {
        sendCancelMenu_(chatId, "من فضلك اكتب تفاصيل أوضح (5 أحرف على الأقل).");
        return ok_();
      }
      const flow = getRequestFlow_(chatId);
      if (!flow || flow.kind !== "شكوى") {
        setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
        sendMainMenu_(chatId, "انتهت صلاحية الشكوى. ابدأ تقديمها من جديد.", sheets);
        return ok_();
      }
      saveComplaint_(chatId, employee, flow.complaintType, flow.person || "", text, sheets);
      PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
      return ok_();
    }

    // اختيار نوع الإذن: ساعات أو أيام
    if (state === STATE_LEAVE_TYPE) {
      if (text === "⏱ إذن بالساعات" || text === "📅 إذن بالأيام") {
        const kind = text === "⏱ إذن بالساعات" ? "بالساعات" : "يوم كامل";
        PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify({kind:"إذن", leaveType:kind}));
        setEmployeeState_(sheets.emp, employee.row, STATE_LEAVE_DATE);
        sendChoiceMenu_(chatId, "📅 حدد يوم بداية الإذن:", [
          ["📅 اليوم", "📅 غدًا"],
          ["🗓️ اختيار تاريخ آخر"],
          ["❌ إلغاء"]
        ]);
      } else {
        sendChoiceMenu_(chatId, "اختر نوع الإذن من الأزرار:", [["⏱ إذن بالساعات", "📅 إذن بالأيام"], ["❌ إلغاء"]]);
      }
      return ok_();
    }

    if (state === STATE_LEAVE_DATE) {
      let requestedDate = "";
      if (text === "📅 اليوم") requestedDate = today_();
      else if (text === "📅 غدًا") requestedDate = addDaysIsoV19_(today_(), 1);
      else if (text === "🗓️ اختيار تاريخ آخر") {
        setEmployeeState_(sheets.emp, employee.row, STATE_LEAVE_CUSTOM_DATE);
        sendCancelMenu_(chatId, "🗓️ اكتب تاريخ بداية الإذن بصيغة YYYY-MM-DD:");
        return ok_();
      } else {
        requestedDate = normalizeDate_(text);
      }
      if (!isValidIsoDateV15_(requestedDate) || requestedDate < today_()) {
        sendChoiceMenu_(chatId, "⚠️ اختر اليوم أو غدًا أو تاريخًا قادمًا صحيحًا:", [
          ["📅 اليوم", "📅 غدًا"], ["🗓️ اختيار تاريخ آخر"], ["❌ إلغاء"]
        ]);
        return ok_();
      }
      const flow = getRequestFlow_(chatId) || {};
      flow.date = requestedDate;
      PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify(flow));
      if (flow.leaveType === "يوم كامل" && requestedDate === today_()) {
        const assignment = getAssignmentForDate_(sheets.assignments, chatId, requestedDate);
        const shift = assignment ? getShiftById_(sheets.shifts, assignment.shiftId) : null;
        if (shift && timeToMinutes_(Utilities.formatDate(new Date(), TIME_ZONE, "HH:mm")) > timeToMinutes_(shift.startTime)) {
          setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
          PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
          sendMainMenu_(chatId, "⚠️ لا يمكن طلب إذن يوم كامل بعد بداية الوردية. قدم الطلب قبل موعد الحضور.", sheets);
          return ok_();
        }
      }
      if (flow.leaveType === "بالساعات") {
        const assignment = getAssignmentForDate_(sheets.assignments, chatId, requestedDate);
        const shift = assignment ? getShiftById_(sheets.shifts, assignment.shiftId) : null;
        if (!shift) {
          setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
          PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
          sendMainMenu_(chatId, "⚠️ لا توجد وردية محددة لك في هذا التاريخ. راجع الإدارة لتحديد ورديتك أولًا.", sheets);
          return ok_();
        }
        const options = buildLeaveStartTimeOptionsV19_(shift, requestedDate);
        if (!options.length) {
          setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
          PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
          sendMainMenu_(chatId, "⚠️ لا توجد أوقات مستقبلية مناسبة لطلب الإذن داخل ورديتك في هذا اليوم.", sheets);
          return ok_();
        }
        flow.shiftStart = shift.startTime; flow.shiftEnd = shift.endTime; flow.startOptions = options;
        PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify(flow));
        setEmployeeState_(sheets.emp, employee.row, STATE_LEAVE_FROM);
        sendChoiceMenu_(chatId, "⏰ اختر وقت بداية الإذن من الأوقات المتاحة في ورديتك:", chunkButtonsV19_(options, 3).concat([["❌ إلغاء"]]));
      } else {
        setEmployeeState_(sheets.emp, employee.row, STATE_LEAVE_DAYS);
        sendChoiceMenu_(chatId, "📅 اختر عدد أيام الإذن:", [
          ["يوم واحد", "يومان", "3 أيام"],
          ["❌ إلغاء"]
        ]);
      }
      return ok_();
    }

    if (state === STATE_LEAVE_CUSTOM_DATE) {
      const requestedDate = normalizeDate_(text);
      if (!isValidIsoDateV15_(requestedDate) || requestedDate < today_()) {
        sendCancelMenu_(chatId, "⚠️ التاريخ غير صحيح أو سابق. اكتب تاريخ اليوم أو تاريخًا قادمًا بصيغة YYYY-MM-DD.");
        return ok_();
      }
      const flow = getRequestFlow_(chatId) || {};
      flow.date = requestedDate;
      PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify(flow));
      if (flow.leaveType === "يوم كامل" && requestedDate === today_()) {
        const assignment = getAssignmentForDate_(sheets.assignments, chatId, requestedDate);
        const shift = assignment ? getShiftById_(sheets.shifts, assignment.shiftId) : null;
        if (shift && timeToMinutes_(Utilities.formatDate(new Date(), TIME_ZONE, "HH:mm")) > timeToMinutes_(shift.startTime)) {
          setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
          PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
          sendMainMenu_(chatId, "⚠️ لا يمكن طلب إذن يوم كامل بعد بداية الوردية. قدم الطلب قبل موعد الحضور.", sheets);
          return ok_();
        }
      }
      if (flow.leaveType === "بالساعات") {
        const assignment = getAssignmentForDate_(sheets.assignments, chatId, requestedDate);
        const shift = assignment ? getShiftById_(sheets.shifts, assignment.shiftId) : null;
        if (!shift) {
          setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
          PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
          sendMainMenu_(chatId, "⚠️ لا توجد وردية محددة لك في هذا التاريخ. راجع الإدارة.", sheets);
          return ok_();
        }
        const options = buildLeaveStartTimeOptionsV19_(shift, requestedDate);
        if (!options.length) {
          setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
          PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
          sendMainMenu_(chatId, "⚠️ لا توجد أوقات متاحة داخل ورديتك لهذا التاريخ.", sheets);
          return ok_();
        }
        flow.shiftStart = shift.startTime; flow.shiftEnd = shift.endTime; flow.startOptions = options;
        PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify(flow));
        setEmployeeState_(sheets.emp, employee.row, STATE_LEAVE_FROM);
        sendChoiceMenu_(chatId, "⏰ اختر وقت بداية الإذن:", chunkButtonsV19_(options, 3).concat([["❌ إلغاء"]]));
      } else {
        setEmployeeState_(sheets.emp, employee.row, STATE_LEAVE_DAYS);
        sendChoiceMenu_(chatId, "📅 اختر عدد أيام الإذن:", [["يوم واحد", "يومان", "3 أيام"], ["❌ إلغاء"]]);
      }
      return ok_();
    }

    if (state === STATE_LEAVE_FROM) {
      const t = normalizeTime_(text);
      const flow = getRequestFlow_(chatId) || {};
      const validOptions = Array.isArray(flow.startOptions) ? flow.startOptions : [];
      if (validOptions.indexOf(t) === -1) {
        sendChoiceMenu_(chatId, "⚠️ اختر وقت البداية من الأزرار المتاحة:", chunkButtonsV19_(validOptions, 3).concat([["❌ إلغاء"]]));
        return ok_();
      }
      flow.from = t;
      PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify(flow));
      setEmployeeState_(sheets.emp, employee.row, STATE_LEAVE_HOURS);
      const durationLabels = [1, 2, 3].filter(function(h) { return leaveDurationFitsShiftV19_(flow, h); })
        .map(function(h) { return h === 1 ? "ساعة واحدة" : h === 2 ? "ساعتان" : "3 ساعات"; });
      sendChoiceMenu_(chatId, "⏱ اختر مدة الإذن:", chunkButtonsV19_(durationLabels, 3).concat([["❌ إلغاء"]]));
      return ok_();
    }

    if (state === STATE_LEAVE_HOURS) {
      const durationMap = {"ساعة واحدة":1, "ساعتان":2, "3 ساعات":3};
      const hours = durationMap[text];
      const flow = getRequestFlow_(chatId) || {};
      if (!hours || !leaveDurationFitsShiftV19_(flow, hours)) {
        sendChoiceMenu_(chatId, "⚠️ المدة غير متاحة في هذا الوقت. اختر مدة أخرى:", [["ساعة واحدة", "ساعتان", "3 ساعات"], ["❌ إلغاء"]]);
        return ok_();
      }
      flow.hours = hours;
      flow.to = minutesToTimeV19_((timeToMinutes_(flow.from) + hours * 60) % 1440);
      setEmployeeState_(sheets.emp, employee.row, STATE_LEAVE_REASON);
      PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify(flow));
      sendCancelMenu_(chatId, "📝 اكتب سبب طلب الإذن:");
      return ok_();
    }

    if (state === STATE_LEAVE_DAYS) {
      const durationMap = {"يوم واحد":1, "يومان":2, "3 أيام":3};
      const days = durationMap[text];
      if (!days) {
        sendChoiceMenu_(chatId, "اختر عدد أيام الإذن من الأزرار:", [["يوم واحد", "يومان", "3 أيام"], ["❌ إلغاء"]]);
        return ok_();
      }
      const flow = getRequestFlow_(chatId) || {};
      flow.days = days;
      flow.endDate = addDaysIsoV19_(flow.date, days - 1);
      setEmployeeState_(sheets.emp, employee.row, STATE_LEAVE_REASON);
      PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify(flow));
      sendCancelMenu_(chatId, "📝 اكتب سبب طلب الإذن:");
      return ok_();
    }

    // استقبال مبلغ السلفة فقط؛ لا يوجد حقل سبب للسلفة.
    if (state === STATE_ADVANCE_AMOUNT) {
      const normalizedAmount = String(text || "").replace(/,/g, "").trim();
      const amount = Number(normalizedAmount);
      if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedAmount) || !isFinite(amount) || amount <= 0 || amount > 1000000) {
        sendCancelMenu_(chatId, "⚠️ المبلغ غير صحيح. اكتب مبلغًا موجبًا بالجنيه، مثال: 1500");
        return ok_();
      }
      const flow = getRequestFlow_(chatId) || {kind:"سلفة"};
      flow.kind = "سلفة";
      flow.amount = amount;
      saveStructuredEmployeeRequest_(chatId, employee, flow, sheets);
      PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
      return ok_();
    }

    // حفظ سبب الإذن الجديد وإرساله للمراجعة في سجل مستقل
    if (state === STATE_LEAVE_REASON) {
      if (!text || text.length < 2) { sendCancelMenu_(chatId, "اكتب سبب الإذن بشكل أوضح."); return ok_(); }
      const flow = getRequestFlow_(chatId) || {};
      if (!flow.date || !flow.leaveType) { setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE); sendMainMenu_(chatId, "انتهت صلاحية طلب الإذن. ابدأ من جديد.", sheets); return ok_(); }
      flow.reason = text;
      saveLeaveRequestV15_(chatId, employee, flow, sheets);
      PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
      return ok_();
    }



    // تأكيد اليونيفورم بعد التحقق من GPS
    if (state === STATE_UNIFORM) {
      if (text !== "✅ لابس اليونيفورم" && text !== "❌ مش لابس اليونيفورم") {
        sendUniformMenu_(chatId, "من فضلك أكد حالة اليونيفورم قبل تسجيل الحضور.");
        return ok_();
      }
      const uniform = text === "✅ لابس اليونيفورم" ? "ملتزم" : "غير ملتزم";
      completeCheckinWithUniform_(chatId, employee, uniform, sheets);
      return ok_();
    }

    // استقبال الموقع الجغرافي
    if (state === STATE_CHECKOUT) {
      completeCheckoutWithoutGps_(chatId, employee, sheets);
      return ok_();
    }

    if (state === STATE_CHECKIN) {

      if (!message.location) {

        sendLocationRequest_(
          chatId,
          "⚠️ لم يصلني موقع جغرافي.\n\n" +
          "استخدم زر إرسال موقعي الحالي الموجود بالأسفل، " +
          "ولا ترسل الموقع كنص."
        );

        return ok_();
      }

      processAttendanceLocation_(
        chatId,
        employee,
        state,
        message.location,
        sheets
      );

      return ok_();
    }

    // استقبال تفاصيل الإذن أو السلفة
    if (
      state === STATE_LEAVE ||
      state === STATE_ADVANCE
    ) {

      if (!text) {

        sendCancelMenu_(
          chatId,
          "⚠️ اكتب تفاصيل الطلب في رسالة نصية أو اضغط إلغاء."
        );

        return ok_();
      }

      saveEmployeeRequest_(
        chatId,
        employee,
        state,
        text,
        sheets
      );

      return ok_();
    }

    // أي رسالة أخرى تعرض القائمة
    sendMainMenu_(
      chatId,
      "اختر عملية من الأزرار الموجودة بالأسفل 👇"
    , sheets);

    return ok_();

  } catch (err) {

    console.error(
      "doPost ERROR: " +
      (err && err.stack ? err.stack : err)
    );

    if (chatId) {

      try {

        sendMessage_(
          chatId,
          "⚠️ حصل خطأ أثناء تنفيذ العملية.\n" +
          "لم يتم تأكيد التسجيل. حاول مرة أخرى، وإذا تكرر الخطأ أبلغ مسؤول النظام."
        );

      } catch (sendErr) {

        console.error(
          "Error notification failed: " + sendErr
        );
      }
    }

    return ok_();

  } finally {

    if (lock) {
      try { lock.releaseLock(); } catch (e) {}
    }
    try {
      if (PropertiesService.getScriptProperties().getProperty("PERF_LOG_ENABLED") === "true") {
        Logger.log("MOBIHUB_PERF " + JSON.stringify({
          totalMs: Date.now() - perf.started,
          lockWaitMs: perf.lockWaitMs,
          sheetsMs: perf.sheetsMs,
          lockedWorkMs: perf.lockedAt ? Date.now() - perf.lockedAt : 0,
          updateType: chatId ? "private_message" : "callback_or_other"
        }));
      }
    } catch (perfErr) {}
  }
}
/* =========================================
   GPS ATTENDANCE
========================================= */

function completeCheckoutWithoutGps_(chatId, employee, sheets) {
  const checkoutDate = today_();
  const openAttendance = getOpenAttendanceInfo_(sheets.att, chatId);
  if (!openAttendance) {
    setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
    sendMainMenu_(chatId, "⚠️ لا يوجد حضور مفتوح لتسجيل الانصراف.");
    return;
  }
  const shiftDate = openAttendance.date || checkoutDate;
  const now = new Date();
  const time = Utilities.formatDate(now, TIME_ZONE, "HH:mm:ss");
  const shift = getShiftForOpenAttendance_(sheets, chatId, openAttendance);

  // أعمدة GPS تظل موجودة للتوافق مع التقارير القديمة، لكن الانصراف لا يجمع الموقع.
  sheets.att.appendRow([
    checkoutDate, time, chatId, employee.name, "انصراف",
    "غير مطلوب", "غير مطلوب", "", "", "انصراف بدون GPS", 0,
    shift ? shift.id : "", ""
  ]);

  const overtimeResult = finalizeOvertimeAtCheckout_(sheets, chatId, employee.name, shiftDate, now, shift);

  setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
  const hygienePendingKey = "MOBI_CHECKOUT_HYGIENE_PENDING_" + String(chatId);
  const hygieneRowsToday = getSheetObjects_(sheets.rewardHygiene).filter(function(r) {
    return String(r["Chat ID"] || "").trim() === String(chatId) && normalizeDate_(r["التاريخ"]) === checkoutDate;
  });
  const hygieneAlreadyAnswered = hygieneRowsToday.length > 0;
  const pendingDate = PropertiesService.getScriptProperties().getProperty(hygienePendingKey);
  const hygieneQuestionAlreadyPending = pendingDate === checkoutDate;
  sendMessage_(chatId,
    "✅ تم تسجيل الانصراف بنجاح.\n\n🕒 الوقت: " + time +
    "\n📍 تم تسجيل الانصراف بدون طلب الموقع الجغرافي." +
    (overtimeResult && overtimeResult.minutes > 0 ? "\n\n⏱️ الأوفر تايم المعتمد: " + overtimeResult.minutes + " دقيقة\n💰 المستحق: " + overtimeResult.amount + " جنيه (بانتظار التسوية المالية)." + (overtimeResult.capped ? "\n⛔ تم تطبيق الحد الأقصى: ساعتان مدفوعتان." : "") : ""));
  if (!hygieneAlreadyAnswered && !hygieneQuestionAlreadyPending) {
    PropertiesService.getScriptProperties().setProperty(hygienePendingKey, checkoutDate);
    sendMessage_(chatId,
      "🧹 سؤال سريع: هل تركت مكان العمل نظيفًا ومرتبًا؟\n" +
      "إجابتك تُسجل ضمن نقاط مكافأة الشهر. اختيار (لا) يرصد خصم 50 جنيهًا للمراجعة والاعتماد الإداري.",
      {inline_keyboard:[[{text:"✅ أيوه، المكان نظيف",callback_data:"hyg|clean|"+checkoutDate},{text:"❌ لا، المكان غير نظيف",callback_data:"hyg|notclean|"+checkoutDate}]]});
  }

  notifyAdmin_(
    "🔴 تسجيل انصراف جديد (بدون GPS)\n\n👤 الموظف: " + employee.name +
    "\n🕒 الوقت: " + time + "\n📍 طريقة التسجيل: بدون تحديد موقع"
  );
}


function processAttendanceLocation_(
  chatId,
  employee,
  state,
  location,
  sheets
) {

  const lat = Number(location.latitude);
  const lon = Number(location.longitude);

  const accuracy =
    location.horizontal_accuracy == null
      ? null
      : Number(location.horizontal_accuracy);

  // التحقق من صحة الإحداثيات
  if (
    !isFinite(lat) ||
    !isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {

    sendLocationRequest_(
      chatId,
      "⚠️ بيانات الموقع غير صحيحة.\n" +
      "أعد إرسال موقعك باستخدام زر الموقع الحالي."
    );

    return;
  }

  // لا نعتمد موقعًا لا يحتوي على قيمة دقة؛ هذا يمنع قبول بيانات موقع غير قابلة للتحقق.
  if (accuracy === null || !isFinite(accuracy) || accuracy <= 0 || accuracy > MAX_GPS_ACCURACY_METERS) {

    sendLocationRequest_(
      chatId,
      (accuracy === null ? "⚠️ لم تصل بيانات دقة GPS مع الموقع." : "⚠️ دقة GPS غير مناسبة (" + Math.round(accuracy) + " متر).") +
      "\n\nفعّل خدمات الموقع وحاول إرسال موقعك مرة أخرى من مكان مفتوح.\n" +
      "لم يتم التسجيل، والعملية ما زالت معلقة."
    );

    return;
  }

  // حساب المسافة من المركز
  const distance = calculateDistance_(
    CENTER_LAT,
    CENTER_LONG,
    lat,
    lon
  );

  if (distance > ALLOWED_DISTANCE_METERS) {

    sendLocationRequest_(
      chatId,
      "❌ لم يتم التسجيل.\n\n" +
      "المسافة من المركز: " +
      Math.round(distance) +
      " متر.\n" +
      "المسافة المسموحة: " +
      ALLOWED_DISTANCE_METERS +
      " متر.\n\n" +
      "إذا كنت داخل المركز، انتظر تحسن GPS ثم أعد إرسال موقعك."
    );

    return;
  }

  const date = today_();

  const time = Utilities.formatDate(
    new Date(),
    TIME_ZONE,
    "HH:mm:ss"
  );

  const type =
    state === STATE_CHECKIN
      ? "حضور"
      : "انصراف";

  // منع تسجيل الحضور أكثر من مرة
  if (
    type === "حضور" &&
    hasAttendanceToday_(
      sheets.att,
      chatId,
      "حضور",
      date
    )
  ) {

    setEmployeeState_(
      sheets.emp,
      employee.row,
      STATE_ACTIVE
    );

    sendMainMenu_(
      chatId,
      "⚠️ تم تسجيل حضورك بالفعل اليوم."
    );

    return;
  }

  // منع الانصراف دون وجود حضور مفتوح
  if (
    type === "انصراف" &&
    !hasOpenAttendanceToday_(
      sheets.att,
      chatId,
      date
    )
  ) {

    setEmployeeState_(
      sheets.emp,
      employee.row,
      STATE_ACTIVE
    );

    sendMainMenu_(
      chatId,
      "⚠️ لا يوجد حضور مفتوح لتسجيل الانصراف."
    );

    return;
  }

  // الحضور لا يُحفظ قبل أن يؤكد الموظف حالة اليونيفورم.
  if (type === "حضور") {
    const pending = {
      lat: lat, lon: lon, distance: Math.round(distance),
      accuracy: accuracy === null ? null : Math.round(accuracy),
      date: date, time: time
    };
    PropertiesService.getScriptProperties().setProperty(uniformFlowKey_(chatId), JSON.stringify(pending));
    setEmployeeState_(sheets.emp, employee.row, STATE_UNIFORM);
    sendUniformMenu_(chatId, "📍 تم التحقق من موقعك بنجاح.\n\nهل ترتدي يونيفورم MobiHub؟");
    return;
  }

  // احتساب التأخير وربط الحركة بالوردية الحالية
  const assignment = getAssignmentForDate_(sheets.assignments, chatId, date);
  const shift = assignment ? getShiftById_(sheets.shifts, assignment.shiftId) : null;
  let lateMinutes = 0;
  let attendanceStatus = type === "حضور" ? "في الموعد" : "";

  if (type === "حضور" && shift && !shift.isFlexible) {
    const grace = Number(shift.graceMinutes || GRACE_MINUTES_DEFAULT);
    const scheduledMinutes = timeToMinutes_(shift.startTime);
    const actualMinutes = timeToMinutes_(time);
    lateMinutes = Math.max(0, actualMinutes - scheduledMinutes - grace);
    attendanceStatus = lateMinutes > 0 ? "متأخر" : "في الموعد";
  }

  sheets.att.appendRow([
    date, time, chatId, employee.name, type,
    Math.round(distance),
    accuracy === null ? "غير متاحة" : Math.round(accuracy),
    lat, lon, attendanceStatus, lateMinutes, shift ? shift.id : "", ""
  ]);

  setEmployeeState_(
    sheets.emp,
    employee.row,
    STATE_ACTIVE
  );

  sendMainMenu_(
    chatId,
    "✅ تم تسجيل " +
    type +
    " بنجاح.\n\n" +
    "🕒 الوقت: " +
    time +
    (type === "حضور" && shift
      ? "\n⏱ الحالة: " + attendanceStatus +
        (lateMinutes > 0 ? " (" + lateMinutes + " دقيقة تأخير بعد السماح)" : "")
      : "") +
    "\n📍 المسافة من المركز: " +
    Math.round(distance) +
    " متر."
  );

  notifyAdmin_(
    (type === "حضور"
      ? "🟢 تسجيل حضور جديد"
      : "🔴 تسجيل انصراف جديد") +
    "\n\n👤 الموظف: " +
    employee.name +
    "\n🕒 الوقت: " +
    time +
    "\n📍 المسافة: " +
    Math.round(distance) +
    " متر" +
    "\n🎯 دقة GPS: " +
    (
      accuracy === null
        ? "غير متاحة"
        : Math.round(accuracy) + " متر"
    )
  );
}


// هل تم تسجيل حضور اليوم؟
function hasAttendanceToday_(
  sheet,
  chatId,
  type,
  date
) {

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return false;

  const rows = sheet.getRange(
    2,
    1,
    lastRow - 1,
    Math.max(5, sheet.getLastColumn())
  ).getDisplayValues();

  return rows.some(function(row) {

    return (
      String(row[0]).trim() === date &&
      String(row[2]).trim() === String(chatId) &&
      String(row[4]).trim() === type
    );

  });
}


// يرجع آخر حركة للموظف؛ إذا كانت حضورًا فهناك وردية مفتوحة حتى لو بدأت أمس.
function hasOpenAttendance_(sheet, chatId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const rows = sheet.getRange(2, 1, lastRow - 1, Math.max(5, sheet.getLastColumn())).getDisplayValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][2]).trim() === String(chatId)) {
      return String(rows[i][4]).trim() === "حضور";
    }
  }
  return false;
}

// يرجع بيانات آخر حركة حضور مفتوحة، بما فيها تاريخ بداية الوردية (قد يكون أمس).
function getOpenAttendanceInfo_(sheet, chatId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const rows = sheet.getRange(2, 1, lastRow - 1, Math.max(13, sheet.getLastColumn())).getDisplayValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][2] || "").trim() !== String(chatId)) continue;
    if (String(rows[i][4] || "").trim() !== "حضور") return null;
    return {
      date: normalizeDate_(rows[i][0]),
      time: normalizeTime_(rows[i][1]),
      shiftId: String(rows[i][11] || "").trim(),
      rowNum: i + 2
    };
  }
  return null;
}

function getShiftForOpenAttendance_(sheets, chatId, openAttendance) {
  if (!openAttendance) return null;
  const assignment = getAssignmentForDate_(sheets.assignments, chatId, openAttendance.date);
  const shiftId = openAttendance.shiftId || (assignment ? assignment.shiftId : "");
  return shiftId ? getShiftById_(sheets.shifts, shiftId) : null;
}

// توافق خلفي مع أي جزء قديم يستدعي الاسم السابق.
function hasOpenAttendanceToday_(sheet, chatId, date) {
  return hasOpenAttendance_(sheet, chatId);
}


/* =========================================
   LEAVE AND ADVANCE REQUESTS
========================================= */

function requestFlowKey_(chatId) { return "MOBIHUB_REQUEST_FLOW_" + String(chatId); }
function uniformFlowKey_(chatId) { return "MOBIHUB_UNIFORM_FLOW_" + String(chatId); }
function getRequestFlow_(chatId) {
  const raw = PropertiesService.getScriptProperties().getProperty(requestFlowKey_(chatId));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function saveStructuredEmployeeRequest_(chatId, employee, flow, sheets) {
  const type = flow.kind;
  const dateTime = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  let details = "";
  const extra = ["", "", "", "", "", ""];
  if (type === "سلفة") {
    details = Number(flow.amount) + " جنيه";
    extra[0] = Number(flow.amount);
    extra[1] = "";
  } else {
    const unit = flow.unit === "أيام" ? "أيام" : "ساعات";
    details = Number(flow.amount) + " " + unit + " — " + flow.reason;
    extra[2] = unit;
    if (unit === "أيام") extra[3] = Number(flow.amount);
    else extra[4] = Number(flow.amount);
    extra[5] = flow.reason;
  }
  const row = sheets.req.getLastRow() + 1;
  sheets.req.appendRow([dateTime, chatId, employee.name, type, details, "قيد الانتظار"].concat(extra));
  setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
  sendMainMenu_(chatId, "✅ تم إرسال طلب " + type + " للإدارة بنجاح.\n\n" +
    (type === "سلفة" ? "💵 المبلغ المطلوب: " + flow.amount + " جنيه" :
      "⏱ المدة: " + flow.amount + " " + flow.unit + "\n📝 السبب: " + (flow.reason || "")) +
    "\n\nسيتم إبلاغك بالقرار بعد المراجعة.");
  getActiveAdminIds_("Admin").forEach(function(aid){ sendAdminRequestWithButtons_(aid, row, type, employee.name, details); });
}

// توافق مع أي طلب قديم كان محفوظًا كنص واحد.
function saveEmployeeRequest_(chatId, employee, state, details, sheets) {
  const type = state === STATE_LEAVE ? "إذن" : "سلفة";
  const dateTime = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  const row = sheets.req.getLastRow() + 1;
  sheets.req.appendRow([dateTime, chatId, employee.name, type, details, "قيد الانتظار", "", "", "", "", "", ""]);
  setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
  sendMainMenu_(chatId, "✅ تم إرسال طلب " + type + " للإدارة بنجاح.\n\nسيتم إبلاغك بالقرار بعد المراجعة.");
  getActiveAdminIds_("Admin").forEach(function(aid){ sendAdminRequestWithButtons_(aid, row, type, employee.name, details); });
}
/* =========================================
   GOOGLE SHEETS
========================================= */

// ===== Multi-admin access control =====
function ensureAdminsSheet_(ss) {
  const sh = ensureSheet_(ss, ADMINS_SHEET, ADMINS_HEADERS);
  const rows = getSheetObjects_(sh);
  const root = rows.some(function(r) { return String(r["Chat ID"] || "").trim() === String(ADMIN_ID); });
  if (!root) sh.appendRow([String(ADMIN_ID), "المدير الرئيسي", ADMIN_ROLES.SUPER, "نشط", "SYSTEM", Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss"), ""]);
  return sh;
}
function getAdminRole_(chatId, sheets) {
  const id = String(chatId || "").trim();
  if (!id) return "";
  if (id === String(ADMIN_ID)) return ADMIN_ROLES.SUPER;
  if (Object.prototype.hasOwnProperty.call(ADMIN_ROLE_REQUEST_CACHE_, id)) return ADMIN_ROLE_REQUEST_CACHE_[id];
  let sh = sheets && sheets.admins;
  if (!sh) { const ss = SpreadsheetApp.getActiveSpreadsheet(); sh = ss && ss.getSheetByName(ADMINS_SHEET); }
  if (!sh || sh.getLastRow() < 2) { ADMIN_ROLE_REQUEST_CACHE_[id] = ""; return ""; }
  const rows = getSheetObjects_(sh);
  const row = rows.find(function(r) { return String(r["Chat ID"] || "").trim() === id && String(r["الحالة"] || "نشط").trim() === "نشط"; });
  const role = row ? String(row["الصلاحية"] || "") : "";
  ADMIN_ROLE_REQUEST_CACHE_[id] = role;
  return role;
}
function isAdmin_(chatId, sheets, requiredRole) {
  const role = getAdminRole_(chatId, sheets);
  if (!role) return false;
  if (!requiredRole) return true;
  if (role === ADMIN_ROLES.SUPER) return true;
  if (requiredRole === "Finance") return role === ADMIN_ROLES.FINANCE;
  if (requiredRole === "Supervisor") return role === ADMIN_ROLES.SUPERVISOR || role === ADMIN_ROLES.ADMIN;
  if (requiredRole === "Admin") return role === ADMIN_ROLES.ADMIN;
  if (requiredRole === "Super Admin") return false;
  return false;
}
function requireAdminRole_(chatId, sheets, requiredRole) {
  if (isAdmin_(chatId, sheets, requiredRole)) return true;
  sendMessage_(chatId, "⛔ ليس لديك صلاحية تنفيذ هذا الإجراء.");
  return false;
}
function adminCanPerform_(chatId, action, sheets) {
  const role = getAdminRole_(chatId, sheets);
  if (!role) return false;
  if (role === ADMIN_ROLES.SUPER) return true;
  const financeActions = ["overtime", "deductions", "dedadd", "dedview", "dedpending", "dedreport", "dedemployee", "cash", "cashact", "rewards", "rewardbonus", "rewardbonuse", "rewardreport"];
  const hygieneActions = ["rewardhygiene", "rewardhyginee", "rewardhygines"];
  const supervisorActions = ["current", "today", "absences", "leaves", "leaveview", "notifications", "ntoggle", "ntest", "nlogs", "home"].concat(hygieneActions);
  const adminActions = supervisorActions.concat(["employees", "employee", "emprewards", "empdeductions", "emphistory", "empadd", "empedit", "emptoggle", "empshift", "shiftpick", "flexday", "flexall", "flexsave", "empsearch", "empfilter", "emppage", "requests", "shifts", "shiftadd", "shiftedit", "shiftfield", "shifttoggle", "month", "complaints", "complaintact", "complaintreply"]);
  const categoryAccess = {
    cat_daily: [ADMIN_ROLES.SUPER, ADMIN_ROLES.ADMIN, ADMIN_ROLES.SUPERVISOR],
    cat_staff: [ADMIN_ROLES.SUPER, ADMIN_ROLES.ADMIN],
    cat_finance: [ADMIN_ROLES.SUPER, ADMIN_ROLES.FINANCE],
    cat_devices: [ADMIN_ROLES.SUPER, ADMIN_ROLES.ADMIN],
    cat_requests: [ADMIN_ROLES.SUPER, ADMIN_ROLES.ADMIN],
    cat_system: [ADMIN_ROLES.SUPER, ADMIN_ROLES.ADMIN]
  };
  if (categoryAccess[action]) return categoryAccess[action].indexOf(role) !== -1;
  if (role === ADMIN_ROLES.FINANCE) return financeActions.indexOf(action) !== -1 || action === "home";
  if (role === ADMIN_ROLES.SUPERVISOR) return supervisorActions.indexOf(action) !== -1;
  if (role === ADMIN_ROLES.ADMIN) return adminActions.indexOf(action) !== -1;
  return false;
}
function adminAddCommand_(actorId, raw, sheets) {
  if (!requireAdminRole_(actorId, sheets, "Super Admin")) return;
  const p = String(raw || "").split("|").map(function(x){return x.trim();});
  if (p.length < 3 || !/^\d{5,20}$/.test(p[0]) || p[0] === String(ADMIN_ID) || !p[1] || ["Super Admin","Admin","Finance","Supervisor"].indexOf(p[2]) < 0) {
    sendMessage_(actorId, "الصيغة:\n/admin_add CHAT_ID|اسم المدير|Super Admin أو Admin أو Finance أو Supervisor\n\nمثال:\n/admin_add 123456789|أحمد|Finance"); return;
  }
  const sh = sheets.admins, rows = getSheetObjects_(sh), now = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  const idx = rows.findIndex(function(r){return String(r["Chat ID"]||"").trim()===p[0];});
  const vals = [p[0],p[1],p[2],"نشط",String(actorId),now,now];
  if (idx >= 0) sh.getRange(idx+2,1,1,ADMINS_HEADERS.length).setValues([vals]); else sh.appendRow(vals);
  sendMessage_(actorId, "✅ تم تفعيل المدير " + p[1] + " بصلاحية " + p[2] + ".");
  sendMessage_(p[0], "🛡️ تم منحك صلاحية " + p[2] + " في نظام MobiHub. أرسل /start لفتح لوحة الإدارة.");
}
function adminRemoveCommand_(actorId, raw, sheets) {
  if (!requireAdminRole_(actorId, sheets, "Super Admin")) return;
  const id=String(raw||"").trim();
  if (!/^\d{5,20}$/.test(id) || id===String(ADMIN_ID)) { sendMessage_(actorId,"أرسل Chat ID صحيحًا. لا يمكن تعطيل المدير الرئيسي من هذا الأمر."); return; }
  const rows=getSheetObjects_(sheets.admins), idx=rows.findIndex(function(r){return String(r["Chat ID"]||"").trim()===id;});
  if(idx<0){sendMessage_(actorId,"المدير غير موجود في السجل.");return;}
  sheets.admins.getRange(idx+2,4).setValue("موقوف"); sheets.admins.getRange(idx+2,7).setValue(Utilities.formatDate(new Date(),TIME_ZONE,"yyyy-MM-dd HH:mm:ss"));
  sendMessage_(actorId,"✅ تم إيقاف صلاحية المدير " + id + ".");
}
function adminRoleCommand_(actorId, raw, sheets) {
  if (!requireAdminRole_(actorId, sheets, "Super Admin")) return;
  const p=String(raw||"").split("|").map(function(x){return x.trim();});
  if(p.length!==2 || !/^\d{5,20}$/.test(p[0]) || ["Super Admin","Admin","Finance","Supervisor"].indexOf(p[1])<0 || p[0]===String(ADMIN_ID)){sendMessage_(actorId,"الصيغة: /admin_role CHAT_ID|Super Admin أو Admin أو Finance أو Supervisor");return;}
  const rows=getSheetObjects_(sheets.admins), idx=rows.findIndex(function(r){return String(r["Chat ID"]||"").trim()===p[0];});
  if(idx<0){sendMessage_(actorId,"المدير غير موجود. أضفه أولًا باستخدام /admin_add.");return;}
  sheets.admins.getRange(idx+2,3).setValue(p[1]); sheets.admins.getRange(idx+2,4).setValue("نشط"); sheets.admins.getRange(idx+2,7).setValue(Utilities.formatDate(new Date(),TIME_ZONE,"yyyy-MM-dd HH:mm:ss"));
  sendMessage_(actorId,"✅ تم تحديث صلاحية " + p[0] + " إلى " + p[1] + ".");
}
function sendAdminManagersMenu_(chatId, sheets) {
  if (!requireAdminRole_(chatId, sheets, "Super Admin")) return;
  const rows=getSheetObjects_(sheets.admins), lines=["👑 إدارة المديرين والصلاحيات","","المستويات المتاحة:","• Super Admin: كل الصلاحيات وإدارة المديرين","• Admin: الموظفون والحضور والورديات والطلبات","• Finance: الخصومات والسحب والمكافآت","• Supervisor: المتابعة اليومية والغياب والأذونات وتقييم النظافة","","المديرون الحاليون:"];
  rows.forEach(function(r){lines.push("• "+r["اسم المدير"]+" — "+r["Chat ID"]+" — "+r["الصلاحية"]+" — "+r["الحالة"]);});
  lines.push("","إضافة: /admin_add CHAT_ID|الاسم|Super Admin أو Admin أو Finance أو Supervisor","تغيير الصلاحية: /admin_role CHAT_ID|Super Admin أو Admin أو Finance أو Supervisor","إيقاف: /admin_remove CHAT_ID");
  sendMessage_(chatId,lines.join("\n").slice(0,3900),{inline_keyboard:[[{text:"🔄 تحديث القائمة",callback_data:"adm|managers"}],[{text:"⬅️ رجوع",callback_data:"adm|home"}]]});
}

function setupSheets() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      "اربط مشروع Apps Script بملف Google Sheets أولًا."
    );
  }

  const emp = ensureSheet_(
    ss,
    EMP_SHEET,
    EMP_HEADERS
  );

  ensureEmployeeStateColumn_(emp);
  ensureEmployeeAccountStatusColumn_(emp);

  ensureSheet_(
    ss,
    ATT_SHEET,
    ATT_HEADERS
  );
  ensureArchiveSheet_(ss, ATT_SHEET, ATT_ARCHIVE_SHEET);

  ensureSheet_(ss, REQ_SHEET, REQ_HEADERS);
  const shiftSheet = ensureSheet_(ss, SHIFT_SHEET, SHIFT_HEADERS);
  ensureFlexibleShift_(shiftSheet);
  ensureSheet_(ss, ASSIGNMENT_SHEET, ASSIGNMENT_HEADERS);
  ensureSheet_(ss, ABSENCE_SHEET, ABSENCE_HEADERS);
  ensureSheet_(ss, LEAVE_SHEET, LEAVE_HEADERS);
  ensureSheet_(ss, DEDUCTION_SHEET, DEDUCTION_HEADERS);
  ensureDeductionSettingsSheet_(ss);
  ensureSheet_(ss, CASH_SHEET, CASH_HEADERS);
  ensureSheet_(ss, COMPLAINT_SHEET, COMPLAINT_HEADERS);
  ensureSheet_(ss, COMPLAINT_MESSAGES_SHEET, COMPLAINT_MESSAGE_HEADERS);
  ensureSheet_(ss, NOTIFICATIONS_SHEET, NOTIFICATION_HEADERS);
  ensureArchiveSheet_(ss, NOTIFICATIONS_SHEET, NOTIFICATIONS_ARCHIVE_SHEET);
  ensureNotificationSettingsSheet_(ss);
  ensureSheet_(ss, REWARD_HYGIENE_SHEET, REWARD_HYGIENE_HEADERS);
  ensureSheet_(ss, REWARD_BONUS_SHEET, REWARD_BONUS_HEADERS);
  ensureSheet_(ss, OVERTIME_SHEET, OVERTIME_HEADERS);
  ensureAdminsSheet_(ss);
  installMonthlyArchiveTrigger_();
  ensureSheet_(ss, BOT_UPDATES_SHEET, BOT_UPDATE_HEADERS);
  ensureSheet_(ss, DEVICES_SHEET, DEVICE_HEADERS);
  ensureSheet_(ss, DEVICE_MOVEMENTS_SHEET, DEVICE_MOVEMENT_HEADERS);

  Logger.log("تم تجهيز أوراق النظام بنجاح.");
}


// ===== Monthly archival for attendance and notification logs =====
function ensureArchiveSheet_(ss, sourceName, archiveName) {
  const source = ss.getSheetByName(sourceName);
  if (!source) throw new Error("ورقة المصدر غير موجودة: " + sourceName);
  let archive = ss.getSheetByName(archiveName);
  if (!archive) archive = ss.insertSheet(archiveName);
  if (archive.getLastRow() === 0) {
    const headers = source.getLastColumn() ? source.getRange(1,1,1,source.getLastColumn()).getDisplayValues()[0] : [];
    archive.getRange(1,1,1,headers.length+1).setValues([headers.concat(["تاريخ الأرشفة"])]);
    archive.setFrozenRows(1);
  }
  return archive;
}

function ensureFlexibleShift_(sheet) {
  const exists = getSheetObjects_(sheet).some(function(r) {
    return String(r["Shift ID"] || "").trim() === FLEX_SHIFT_ID;
  });
  if (!exists) sheet.appendRow([FLEX_SHIFT_ID, "بدون ميعاد ثابت", "", "", 0, "نشط"]);
}

function installMonthlyArchiveTrigger_() {
  const handler = "archiveOldAttendanceAndNotificationsMonthly_";
  const exists = ScriptApp.getProjectTriggers().some(function(t) {
    return t.getHandlerFunction() === handler;
  });
  if (!exists) {
    ScriptApp.newTrigger(handler).timeBased().onMonthDay(1).atHour(2).inTimezone(TIME_ZONE).create();
  }
}

function archiveOldAttendanceAndNotificationsMonthly_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error("ملف Google Sheets غير متاح.");
    const cutoff = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM") + "-01";
    const att = ss.getSheetByName(ATT_SHEET);
    const attArchive = ensureArchiveSheet_(ss, ATT_SHEET, ATT_ARCHIVE_SHEET);
    const notifications = ss.getSheetByName(NOTIFICATIONS_SHEET);
    const notificationsArchive = ensureArchiveSheet_(ss, NOTIFICATIONS_SHEET, NOTIFICATIONS_ARCHIVE_SHEET);
    archiveSheetRowsBeforeDate_(att, attArchive, 1, cutoff, true);
    archiveSheetRowsBeforeDate_(notifications, notificationsArchive, 2, cutoff, false);
    Logger.log("اكتملت الأرشفة الشهرية حتى ما قبل " + cutoff);
  } finally {
    lock.releaseLock();
  }
}

function archiveSheetRowsBeforeDate_(source, archive, dateColumn, cutoff, preserveOpenAttendance) {
  const lastRow = source.getLastRow();
  const lastCol = source.getLastColumn();
  if (lastRow < 2 || lastCol < dateColumn) return 0;
  const rows = source.getRange(2,1,lastRow-1,lastCol).getDisplayValues();
  const latestByEmployee = {};
  if (preserveOpenAttendance) {
    rows.forEach(function(r,i) {
      const id=String(r[2]||"").trim();
      if (!id) return;
      latestByEmployee[id] = {row:i+2, type:String(r[4]||"").trim()};
    });
  }
  const archiveLast = archive.getLastRow();
  const existingKeys = {};
  if (archiveLast >= 2) {
    archive.getRange(2,1,archiveLast-1,lastCol).getDisplayValues().forEach(function(r) {
      existingKeys[archiveRowKey_(r)] = true;
    });
  }
  const move=[], deleteRows=[];
  rows.forEach(function(r,i) {
    const rowNum=i+2;
    const date=normalizeDate_(r[dateColumn-1]);
    if (!date || date >= cutoff) return;
    if (preserveOpenAttendance) {
      const id=String(r[2]||"").trim();
      const latest=latestByEmployee[id];
      if (latest && latest.row===rowNum && latest.type==="حضور") return;
    }
    const key=archiveRowKey_(r);
    if (!existingKeys[key]) {
      move.push(r.concat([Utilities.formatDate(new Date(),TIME_ZONE,"yyyy-MM-dd HH:mm:ss")]));
      existingKeys[key]=true;
    }
    deleteRows.push(rowNum);
  });
  if (move.length) {
    archive.getRange(archive.getLastRow()+1,1,move.length,lastCol+1).setValues(move);
  }
  // Delete contiguous blocks bottom-up only after archive writes succeed.
  deleteRows.sort(function(a,b){return a-b;});
  const blocks = [];
  deleteRows.forEach(function(rowNum) {
    const last = blocks[blocks.length-1];
    if (last && rowNum === last.start + last.count) last.count++;
    else blocks.push({start:rowNum,count:1});
  });
  for (let i=blocks.length-1;i>=0;i--) {
    source.deleteRows(blocks[i].start, blocks[i].count);
  }
  return deleteRows.length;
}

function archiveRowKey_(row) {
  const raw = row.map(function(v){return String(v==null?"":v);}).join("\\u001f");
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(digest);
}

// Runtime-only sheet lookup: schema creation/validation belongs in setupSheets(),
// not on every Telegram update. This removes repeated header reads and writes.
function getSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("لم يتم العثور على ملف Google Sheets. اربط المشروع بالملف الصحيح.");

  const names = {
    emp: EMP_SHEET, att: ATT_SHEET, attArchive: ATT_ARCHIVE_SHEET, req: REQ_SHEET, shifts: SHIFT_SHEET,
    assignments: ASSIGNMENT_SHEET, absences: ABSENCE_SHEET, leaves: LEAVE_SHEET, deductions: DEDUCTION_SHEET, deductionSettings: DEDUCTION_SETTINGS_SHEET, cash: CASH_SHEET,
    complaints: COMPLAINT_SHEET, complaintMessages: COMPLAINT_MESSAGES_SHEET, notifications: NOTIFICATIONS_SHEET, notificationsArchive: NOTIFICATIONS_ARCHIVE_SHEET,
    notificationSettings: NOTIFICATION_SETTINGS_SHEET, rewardHygiene: REWARD_HYGIENE_SHEET, rewardBonus: REWARD_BONUS_SHEET, overtime: OVERTIME_SHEET, botUpdates: BOT_UPDATES_SHEET,
    devices: DEVICES_SHEET, deviceMovements: DEVICE_MOVEMENTS_SHEET, admins: ADMINS_SHEET
  };
  const result = {};
  Object.keys(names).forEach(function(key) {
    const sheet = ss.getSheetByName(names[key]);
    if (!sheet) throw new Error('ورقة النظام غير موجودة: ' + names[key] + '. شغّل setupSheets() مرة واحدة.');
    result[key] = sheet;
  });
  return result;
}


function ensureSheet_(
  ss,
  name,
  headers
) {

  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {

    sheet.getRange(
      1,
      1,
      1,
      headers.length
    ).setValues([headers]);

    sheet.setFrozenRows(1);

    return sheet;
  }

  const existing = sheet.getRange(
    1,
    1,
    1,
    Math.max(sheet.getLastColumn(), 1)
  )
  .getDisplayValues()[0]
  .map(function(value) {
    return String(value).trim();
  });

  headers.forEach(function(header) {

    if (existing.indexOf(header) === -1) {

      const col = sheet.getLastColumn() + 1;

      sheet.getRange(1, col).setValue(header);

      existing.push(header);
    }

  });

  sheet.setFrozenRows(1);

  return sheet;
}


// التأكد من وجود عمود الحالة
function ensureEmployeeStateColumn_(sheet) {

  const lastCol = Math.max(
    sheet.getLastColumn(),
    1
  );

  const headers = sheet.getRange(
    1,
    1,
    1,
    lastCol
  )
  .getDisplayValues()[0]
  .map(function(value) {
    return String(value).trim();
  });

  let index = headers.indexOf("الحالة");

  if (index === -1) {

    index = lastCol;

    sheet.getRange(
      1,
      index + 1
    ).setValue("الحالة");
  }

  return index + 1;
}


// عمود مستقل لتفعيل/إيقاف الحساب؛ لا نستخدم عمود "الحالة" لأنه مخصص لحالة خطوات البوت.
function ensureEmployeeAccountStatusColumn_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function(v) { return String(v).trim(); });
  let index = headers.indexOf("حالة الحساب");
  if (index === -1) { index = lastCol; sheet.getRange(1, index + 1).setValue("حالة الحساب"); }
  return index + 1;
}

function getEmployeeAccountStatus_(sheet, row) {
  const col = ensureEmployeeAccountStatusColumn_(sheet);
  return String(sheet.getRange(row, col).getDisplayValue() || "نشط").trim();
}

function setEmployeeAccountStatus_(sheet, row, status) {
  const col = ensureEmployeeAccountStatusColumn_(sheet);
  sheet.getRange(row, col).setValue(status);
}

function findEmployeeRowById_(sheet, chatId) {
  return findEmployee_(sheet, chatId);
}

// تحديد رقم عمود الحالة تلقائيًا
function getEmployeeStateColumn_(sheet) {

  const lastCol = Math.max(
    sheet.getLastColumn(),
    1
  );

  const headers = sheet.getRange(
    1,
    1,
    1,
    lastCol
  )
  .getDisplayValues()[0]
  .map(function(value) {
    return String(value).trim();
  });

  const index = headers.indexOf("الحالة");

  if (index === -1) {
    throw new Error(
      "عمود الحالة غير موجود في شيت الموظفين."
    );
  }

  return index + 1;
}


// البحث عن الموظف باستخدام Telegram Chat ID
function findEmployee_(sheet, chatId) {

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const values = sheet.getRange(
    2,
    1,
    lastRow - 1,
    Math.max(2, sheet.getLastColumn())
  ).getDisplayValues();

  for (let i = 0; i < values.length; i++) {

    if (
      String(values[i][0]).trim() ===
      String(chatId).trim()
    ) {

      return {
        row: i + 2,
        name: String(
          values[i][1] || "موظف"
        ).trim()
      };
    }
  }

  return null;
}


// قراءة حالة الموظف
function getEmployeeState_(sheet, row) {

  const col = getEmployeeStateColumn_(sheet);

  return String(
    sheet.getRange(row, col).getValue() ||
    STATE_ACTIVE
  ).trim();
}


// تعديل حالة الموظف
function setEmployeeState_(
  sheet,
  row,
  state
) {

  const col = getEmployeeStateColumn_(sheet);

  sheet.getRange(row, col).setValue(state);
}

function sendChoiceMenu_(chatId, text, rows) {
  return sendMessage_(chatId, text, {
    keyboard: rows.map(function(row) {
      return row.map(function(label) { return { text: label }; });
    }),
    resize_keyboard: true,
    one_time_keyboard: true,
    is_persistent: false
  });
}

function sendUniformMenu_(chatId, text) {
  return sendChoiceMenu_(chatId, text, [
    ["✅ لابس اليونيفورم", "❌ مش لابس اليونيفورم"],
    ["❌ إلغاء"]
  ]);
}

function completeCheckinWithUniform_(chatId, employee, uniformStatus, sheets) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(uniformFlowKey_(chatId));
  if (!raw) {
    setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
    sendMainMenu_(chatId, "انتهت صلاحية خطوة تأكيد اليونيفورم. ابدأ تسجيل الحضور من جديد.");
    return;
  }
  let pending;
  try { pending = JSON.parse(raw); } catch (e) { pending = null; }
  if (!pending || !isFinite(Number(pending.lat)) || !isFinite(Number(pending.lon))) {
    props.deleteProperty(uniformFlowKey_(chatId));
    setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
    sendMainMenu_(chatId, "تعذر استكمال بيانات الموقع. ابدأ تسجيل الحضور من جديد.");
    return;
  }
  if (hasAttendanceToday_(sheets.att, chatId, "حضور", pending.date)) {
    props.deleteProperty(uniformFlowKey_(chatId));
    setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
    sendMainMenu_(chatId, "⚠️ تم تسجيل حضورك بالفعل اليوم.");
    return;
  }

  const assignment = getAssignmentForDate_(sheets.assignments, chatId, pending.date);
  const shift = assignment ? getShiftById_(sheets.shifts, assignment.shiftId) : null;
  let lateMinutes = 0;
  let attendanceStatus = "في الموعد";
  if (shift && !shift.isFlexible) {
    const grace = Number(shift.graceMinutes || GRACE_MINUTES_DEFAULT);
    const rawLate = Math.max(0, timeToMinutes_(pending.time) - timeToMinutes_(shift.startTime) - grace);
    const authorizedMinutes = getApprovedLeaveOverlapMinutes_(sheets, chatId, pending.date, shift.startTime, pending.time, grace);
    lateMinutes = Math.max(0, rawLate - authorizedMinutes);
    attendanceStatus = lateMinutes > 0 ? "متأخر" : "في الموعد";
  }

  sheets.att.appendRow([
    pending.date, pending.time, chatId, employee.name, "حضور",
    pending.distance, pending.accuracy === null ? "غير متاحة" : pending.accuracy,
    pending.lat, pending.lon, attendanceStatus, lateMinutes,
    shift ? shift.id : "", uniformStatus
  ]);
  createAutomaticDeductionV15_(sheets, chatId, employee.name, pending.date, "التأخير", lateMinutes > 0 ? (lateMinutes + " دقيقة تأخير بعد فترة السماح") : "", lateMinutes > 0 ? lateMinutes * getDeductionSettingV15_(sheets, "التأخير_للدقيقة", 1.5) : 0, "ATT|" + pending.date + "|" + chatId + "|LATE");
  if (uniformStatus === "غير ملتزم") createAutomaticDeductionV15_(sheets, chatId, employee.name, pending.date, "اليونيفورم", "عدم الالتزام باليونيفورم", getDeductionSettingV15_(sheets, "خصم_اليونيفورم", 30), "ATT|" + pending.date + "|" + chatId + "|UNIFORM");
  closePendingAbsenceIfCheckedInV15_(sheets, chatId, pending.date);

  props.deleteProperty(uniformFlowKey_(chatId));
  setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
  sendMainMenu_(chatId,
    "✅ تم تسجيل حضورك بنجاح.\n\n🕒 الوقت: " + pending.time +
    "\n📍 المسافة من المركز: " + pending.distance + " متر" +
    "\n👕 اليونيفورم: " + (uniformStatus === "ملتزم" ? "✅ ملتزم" : "❌ غير ملتزم") +
    (shift ? "\n⏱ الحالة: " + attendanceStatus + (lateMinutes > 0 ? " (" + lateMinutes + " دقيقة تأخير بعد السماح)" : "") : "")
  );
  notifyAdmin_("🟢 تسجيل حضور جديد\n\n👤 الموظف: " + employee.name +
    "\n🕒 الوقت: " + pending.time + "\n📍 المسافة: " + pending.distance +
    " متر\n🎯 دقة GPS: " + (pending.accuracy === null ? "غير متاحة" : pending.accuracy + " متر") +
    "\n👕 اليونيفورم: " + (uniformStatus === "ملتزم" ? "ملتزم" : "غير ملتزم"));
}

/* =========================================
   TELEGRAM KEYBOARDS
========================================= */

// تفاصيل وردية الموظف في تاريخ اليوم.
function sendEmployeeShift_(chatId, employee, sheets) {
  const date = today_();
  const assignment = getAssignmentForDate_(sheets.assignments, chatId, date);
  if (!assignment) {
    sendMainMenu_(chatId, "🕒 لا توجد وردية مسجلة لك اليوم. إذا كان هذا غير صحيح، راجع الإدارة.");
    return;
  }
  const shift = getShiftById_(sheets.shifts, assignment.shiftId);
  if (!shift) {
    sendMainMenu_(chatId, "⚠️ الوردية المرتبطة بحسابك غير متاحة حاليًا. راجع الإدارة.");
    return;
  }
  sendMainMenu_(chatId,
    "🕒 نظام دوامك اليوم\n\n" +
    "👤 الموظف: " + employee.name + "\n" +
    "📅 التاريخ: " + date + "\n" +
    "🏷 النظام: " + (shift.name || shift.id) + "\n" +
    (shift.isFlexible
      ? "🟢 سجّل حضورك عند الوصول\n🔴 سجّل انصرافك عند المغادرة\n⏱ لا يوجد موعد ثابت أو احتساب تأخير."
      : "🟢 الحضور: " + shift.startTime + "\n🔴 الانصراف: " + shift.endTime + "\n⏱ فترة السماح: " + shift.graceMinutes + " دقيقة" +
        (timeToMinutes_(shift.endTime) <= timeToMinutes_(shift.startTime) ? "\n🌙 الوردية تمتد لليوم التالي." : "")) );
}

function sendEmployeeAttendanceHistory_(chatId, sheets, limit) {
  const rows = getSheetObjects_(sheets.att).filter(function(r) {
    return String(r["Chat ID"] || "").trim() === String(chatId);
  });
  if (!rows.length) {
    sendMainMenu_(chatId, "📋 لا توجد سجلات حضور مسجلة حتى الآن.");
    return;
  }
  const grouped = {};
  rows.forEach(function(r) {
    const d = normalizeDate_(r["التاريخ"]);
    if (!grouped[d]) grouped[d] = {in: "—", out: "—", status: "", late: 0};
    if (String(r["النوع"]).trim() === "حضور") {
      grouped[d].in = normalizeTime_(r["الوقت"]);
      grouped[d].status = String(r["حالة الحضور"] || "");
      grouped[d].late = Number(r["دقائق التأخير"] || 0);
    } else if (String(r["النوع"]).trim() === "انصراف") {
      grouped[d].out = normalizeTime_(r["الوقت"]);
    }
  });
  const dates = Object.keys(grouped).sort().reverse().slice(0, limit || 30);
  let msg = "📋 سجل حضورك وانصرافك (آخر " + dates.length + " يوم مسجل)\n\n";
  dates.forEach(function(d) {
    const x = grouped[d];
    msg += "📅 " + d + "\n🟢 حضور: " + x.in + " | 🔴 انصراف: " + x.out;
    if (x.status) msg += "\nالحالة: " + x.status + (x.late > 0 ? " – " + x.late + " دقيقة تأخير" : "");
    msg += "\n\n";
  });
  sendMainMenu_(chatId, msg.trim());
}

function sendEmployeeMonthlySummary_(chatId, sheets) {
  const now = new Date();
  const month = Utilities.formatDate(now, TIME_ZONE, "yyyy-MM");
  const records = getSheetObjects_(sheets.att).filter(function(r) {
    return String(r["Chat ID"] || "").trim() === String(chatId) && normalizeDate_(r["التاريخ"]).indexOf(month) === 0;
  });
  const checkins = records.filter(function(r) { return String(r["النوع"]).trim() === "حضور"; });
  const checkouts = records.filter(function(r) { return String(r["النوع"]).trim() === "انصراف"; });
  const late = checkins.filter(function(r) { return Number(r["دقائق التأخير"] || 0) > 0; });
  const lateMinutes = late.reduce(function(sum, r) { return sum + Number(r["دقائق التأخير"] || 0); }, 0);
  const confirmedAbsences = getSheetObjects_(sheets.absences).filter(function(r) {
    return String(r["Chat ID"] || "").trim() === String(chatId) && normalizeDate_(r["التاريخ"]).indexOf(month) === 0 && /مؤكد|غياب/.test(String(r["قرار المدير"] || r["الحالة"] || ""));
  }).length;
  const pendingAbsences = getSheetObjects_(sheets.absences).filter(function(r) {
    return String(r["Chat ID"] || "").trim() === String(chatId) && normalizeDate_(r["التاريخ"]).indexOf(month) === 0 && /انتظار|مراجعة/.test(String(r["الحالة"] || ""));
  }).length;
  sendMainMenu_(chatId,
    "📊 ملخص شهر " + month + "\n\n" +
    "🟢 مرات تسجيل الحضور: " + checkins.length + "\n" +
    "🔴 مرات تسجيل الانصراف: " + checkouts.length + "\n" +
    "⚠️ أيام بها تأخير: " + late.length + "\n" +
    "⏱ إجمالي دقائق التأخير: " + lateMinutes + "\n" +
    "❌ حالات غياب مؤكدة: " + confirmedAbsences + "\n" +
    "🕓 حالات غياب تحت المراجعة: " + pendingAbsences + "\n\n" +
    "ملاحظة: الأرقام تعكس السجلات والقرارات الموجودة حاليًا في النظام.");
}

function sendEmployeeRequests_(chatId, sheets, limit) {
  const rows = getSheetObjects_(sheets.req).filter(function(r) {
    return String(r["Chat ID"] || "").trim() === String(chatId);
  }).slice(- (limit || 10)).reverse();
  if (!rows.length) {
    sendMainMenu_(chatId, "📩 ليس لديك طلبات مسجلة حتى الآن.");
    return;
  }
  let msg = "📩 آخر طلباتك\n\n";
  rows.forEach(function(r) {
    msg += "• " + r["نوع الطلب"] + " | " + r["التاريخ والوقت"] + "\n" +
      "الحالة: " + (r["القرار"] || "قيد الانتظار") + "\n" +
      "التفاصيل: " + (r["التفاصيل"] || "—") + "\n\n";
  });
  sendMainMenu_(chatId, msg.trim());
}

// تحديث لوحة الموظف وعرض آخر إعلانات/تحديثات النظام المنشورة.
function sendUnregisteredAccountMessage_(chatId, welcome) {
  const key = "MOBIHUB_UNREGISTERED_NOTICE_" + String(chatId);
  const props = PropertiesService.getScriptProperties();
  const alreadyShown = props.getProperty(key) === "1";
  if (!alreadyShown) props.setProperty(key, "1");
  if (welcome && !alreadyShown) {
    sendMessage_(chatId, "أهلًا بك في نظام MobiHub.\n\n" +
      "⚠️ حسابك غير مسجل في النظام.\n" +
      "🆔 Telegram Chat ID: " + chatId + "\n\n" +
      "أرسل الرقم لمسؤول المركز لإضافتك.");
  } else if (!alreadyShown) {
    sendMessage_(chatId, "⚠️ حسابك غير مسجل في النظام.\n" +
      "🆔 Telegram Chat ID: " + chatId + "\n" +
      "أرسل الرقم لمسؤول المركز لإضافتك.");
  } else {
    sendMessage_(chatId, "⚠️ حسابك غير مسجل. تواصل مع مسؤول MobiHub لإضافتك للنظام.");
  }
}

function sendEmployeeRefresh_(chatId, employee, sheets) {
  const updates = getSheetObjects_(sheets.botUpdates).filter(function(row) {
    const status = String(row["الحالة"] || "نشط").trim().toLowerCase();
    return status !== "موقوف" && status !== "غير نشط" && status !== "false";
  }).slice(-5).reverse();

  let message = "🔄 تم تحديث لوحة الموظف بنجاح\n\n" +
    "أهلًا " + (employee.name || "بك") + "، دي أحدث نسخة من لوحة MobiHub.";

  if (updates.length) {
    message += "\n\n📢 آخر تحديثات البوت:";
    updates.forEach(function(update) {
      const date = update["التاريخ"] ? "\n📅 " + update["التاريخ"] : "";
      const version = update["الإصدار"] ? " | الإصدار " + update["الإصدار"] : "";
      message += "\n\n🔹 " + (update["عنوان التحديث"] || "تحديث جديد") + version + date;
      if (update["تفاصيل التحديث"]) message += "\n" + update["تفاصيل التحديث"];
    });
  } else {
    message += "\n\n✅ أنت تستخدم أحدث إصدار متاح حاليًا.\nلا توجد تحديثات جديدة معلنة.";
  }

  message += "\n\nلوحة الموظف جاهزة للاستخدام، اختار الخدمة المطلوبة من الأزرار.";
  sendMainMenu_(chatId, message);
}

// القائمة الرئيسية
function sendMainMenu_(chatId, text, sheets) {
  // The Telegram Mini App is the primary interface. Retire the old persistent
  // employee Reply Keyboard and send only the response text.
  return sendMessage_(
    chatId,
    String(text || "تم تحديث نظام MobiHub. افتح التطبيق من زر Open App في ملف البوت."),
    { remove_keyboard: true },
    sheets
  );
}


// زر إرسال الموقع
function sendLocationRequest_(chatId, text) {

  const keyboard = {

    keyboard: [

      [
        {
          text: "📍 إرسال موقعي الحالي",
          request_location: true
        }
      ],

      [
        { text: "❌ إلغاء" }
      ]

    ],

    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: false
  };

  return sendMessage_(
    chatId,
    text,
    keyboard
  );
}


// قائمة الإلغاء أثناء كتابة الطلب
function sendCancelMenu_(chatId, text) {

  const keyboard = {

    keyboard: [
      [
        { text: "❌ إلغاء" }
      ]
    ],

    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: false
  };

  return sendMessage_(
    chatId,
    text,
    keyboard
  );
}


// إرسال رسالة إلى Telegram
function sendMessage_(
  chatId,
  text,
  replyMarkup,
  sheets
) {

  // لا نغيّر نص الرسالة باستبدال عام؛ المصطلحات تُكتب من مصدرها لتجنب تغيير السياق.
  const payload = {
    chat_id: String(chatId),
    text: String(text)
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  return telegramApi_(
    "sendMessage",
    payload
  );
}


/* =========================================
   ADMIN REQUESTS
========================================= */

// إرسال طلب للمدير مع أزرار الموافقة والرفض
function sendAdminRequestWithButtons_(
  adminId,
  rowNum,
  type,
  employeeName,
  details
) {

  if (
    !adminId ||
    String(adminId).indexOf("PUT_") === 0
  ) {

    throw new Error(
      "ADMIN_ID غير مضبوط."
    );
  }

  const keyboard = {

    inline_keyboard: [

      [

        {
          text: "✅ موافقة",
          callback_data: "req|approve|" + rowNum
        },

        {
          text: "❌ رفض",
          callback_data: "req|reject|" + rowNum
        }

      ]

    ]
  };

  return sendTrackedNotification_(
    adminId, "طلب موظف جديد",
    "📥 طلب " + type + " جديد\n\n" +
    "👤 الموظف: " + employeeName + "\n" +
    "📝 التفاصيل: " +
    String(details).substring(0, 2500) +
    "\n\nرقم الطلب في الشيت: " + rowNum,
    "employee_request_" + rowNum + "_" + String(adminId), keyboard
  );
}


// استقبال ضغط المدير على موافقة أو رفض
function handleCallback_(
  callback,
  sheets
) {

  const actorId = String(
    callback.from && callback.from.id || ""
  );

  const callbackParts = String(callback.data || "").split("|");
  if (callbackParts[0] === "ot") {
    handleOvertimeCallback_(callback, sheets, callbackParts);
    return;
  }
  if (callbackParts[0] === "dev") {
    handleDeviceCallback_(callback, sheets, callbackParts);
    return;
  }
  if (callbackParts[0] === "hyg") {
    handleCheckoutHygieneCallback_(callback, sheets, callbackParts);
    return;
  }
  if (callbackParts[0] === "cmp") {
    handleEmployeeComplaintCallback_(callback, sheets, callbackParts);
    return;
  }

  // التحقق من صلاحية المدير حسب القسم، وليس الاكتفاء بكونه مديرًا.
  const callbackChatType = callback.message && callback.message.chat ? callback.message.chat.type : "";
  if (!isAdmin_(actorId, sheets) || (callbackChatType && callbackChatType !== "private")) {

    answerCallbackQuery_(
      callback.id,
      "غير مسموح لك باتخاذ القرار."
    );

    return;
  }

  const parts = String(callback.data || "").split("|");

  // أزرار لوحة المدير التفاعلية
  if (parts[0] === "ded" && !requireAdminRole_(actorId, sheets, "Finance")) { answerCallbackQuery_(callback.id, "غير مصرح."); return; }
  if (parts[0] === "ded") { handleDeductionCallbackV15_(callback, sheets, parts); return; }

  if (parts[0] === "adm") {
    handleAdminDashboardCallback_(callback, sheets, parts);
    return;
  }

  if (parts.length === 3 && parts[0] === "leave") {
    if (!isAdmin_(actorId, sheets, "Supervisor")) { answerCallbackQuery_(callback.id, "غير مصرح."); return; }
    handleLeaveDecisionV15_(callback, sheets, parts[1], Number(parts[2]));
    return;
  }

  if (parts.length === 3 && parts[0] === "abs") {
    if (!isAdmin_(actorId, sheets, "Supervisor")) { answerCallbackQuery_(callback.id, "غير مصرح."); return; }
    handleAbsenceCallback_(callback, sheets, parts[1], Number(parts[2]));
    return;
  }

  if (!isAdmin_(actorId, sheets, "Admin")) { answerCallbackQuery_(callback.id, "غير مصرح."); return; }
  if (
    parts.length !== 3 ||
    parts[0] !== "req"
  ) {

    answerCallbackQuery_(
      callback.id,
      "طلب غير معروف."
    );

    return;
  }

  const action = parts[1];

  const rowNum = Number(parts[2]);

  if (
    (action !== "approve" && action !== "reject") ||
    !Number.isInteger(rowNum) ||
    rowNum < 2 ||
    rowNum > sheets.req.getLastRow()
  ) {

    answerCallbackQuery_(
      callback.id,
      "بيانات الطلب غير صحيحة."
    );

    return;
  }

  const decisionCell = sheets.req.getRange(
    rowNum,
    6
  );

  // منع اتخاذ القرار أكثر من مرة
  if (
    String(decisionCell.getValue()).trim() !==
    "قيد الانتظار"
  ) {

    answerCallbackQuery_(
      callback.id,
      "تم اتخاذ قرار على هذا الطلب من قبل."
    );

    return;
  }

  const decision =
    action === "approve"
      ? "مقبول"
      : "مرفوض";

  decisionCell.setValue(decision);

  const data = sheets.req.getRange(
    rowNum,
    1,
    1,
    6
  ).getDisplayValues()[0];

  const employeeChatId = String(
    data[1]
  ).trim();

  const requestType = String(
    data[3]
  ).trim();

  answerCallbackQuery_(
    callback.id,
    "تم تسجيل القرار: " + decision
  );

  // إبلاغ الموظف بالقرار
  if (employeeChatId) {

    sendTrackedNotification_(
      employeeChatId, "قرار طلب موظف",
      (decision === "مقبول" ? "✅ تمت الموافقة على" : "❌ تم رفض") +
      " طلب " + requestType + " الخاص بك من الإدارة.",
      "employee_request_decision_" + rowNum
    );
  }

  // تحديث رسالة المدير
  if (
    callback.message &&
    callback.message.chat
  ) {

    editMessageText_(
      callback.message.chat.id,
      callback.message.message_id,

      String(callback.message.text || "") +
      "\n\n📌 القرار النهائي: " +
      decision
    );
  }
}


// الرد على الضغط على الزر
function answerCallbackQuery_(
  callbackId,
  text
) {

  return telegramApi_(
    "answerCallbackQuery",
    {
      callback_query_id: callbackId,
      text: text,
      show_alert: false
    }
  );
}


// تعديل رسالة المدير بعد اتخاذ القرار
function editMessageText_(
  chatId,
  messageId,
  text
) {

  return telegramApi_(
    "editMessageText",
    {
      chat_id: chatId,
      message_id: messageId,
      text: text
    }
  );
}
/* =========================================
   DEVICE TRACKING - PHASE 1
========================================= */
function deviceFlowKey_(chatId) { return "MOBIHUB_DEVICE_FLOW_" + String(chatId); }
function setDeviceFlow_(chatId, flow) { PropertiesService.getScriptProperties().setProperty(deviceFlowKey_(chatId), JSON.stringify(flow)); }
function getDeviceFlow_(chatId) {
  const raw = PropertiesService.getScriptProperties().getProperty(deviceFlowKey_(chatId));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
function clearDeviceFlow_(chatId) { PropertiesService.getScriptProperties().deleteProperty(deviceFlowKey_(chatId)); }
function deviceNow_() { return Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss"); }
function deviceIsIntake_(chatId, employee, sheets) {
  if (isAdmin_(chatId, sheets)) return true;
  const row = findEmployee_(sheets.emp, chatId);
  if (!row) return false;
  const job = String(sheets.emp.getRange(row.row, 3).getDisplayValue() || "");
  return /استلام|مدير|مشرف/i.test(job);
}
function deviceFindRow_(sheet, orderId) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const ids = sheet.getRange(2, 1, last - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === String(orderId).trim()) return i + 2;
  return 0;
}
function deviceEmployeeById_(sheets, id) {
  const e = findEmployee_(sheets.emp, id);
  if (!e || getEmployeeAccountStatus_(sheets.emp, e.row) !== "نشط") return null;
  return { chatId: String(id), name: e.name, job: String(sheets.emp.getRange(e.row, 3).getDisplayValue() || "") };
}
function deviceAppendMovement_(sheets, data) {
  sheets.deviceMovements.appendRow([deviceNow_(), data.orderId || "", data.type || "", data.fromId || "", data.fromName || "", data.toId || "", data.toName || "", data.status || "", data.location || "", data.notes || "", data.actorId || "", data.actorName || ""]);
}
function handleDeviceText_(chatId, text, employee, sheets) {
  const activeDeviceFlow = getDeviceFlow_(chatId);
  const explicitOrderId = /^#([A-Za-z0-9_-]{3,60})$/.exec(String(text || "").trim());
  const matchedDeviceRow = explicitOrderId ? deviceFindRow_(sheets.devices, explicitOrderId[1]) : 0;
  if (matchedDeviceRow && !activeDeviceFlow) { showDeviceDetails_(chatId, null, matchedDeviceRow, sheets); return true; }
  if (text === "📱 حالة الجهاز" || text === "حالة الجهاز") { showEmployeeDevices_(chatId, employee, sheets); return true; }
  if (text === "📥 تسجيل جهاز" || text === "تسجيل جهاز") {
    if (!deviceIsIntake_(chatId, employee, sheets)) { sendMainMenu_(chatId, "⛔ تسجيل الأجهزة متاح لمسؤول الاستلام فقط."); return true; }
    setDeviceFlow_(chatId, {step:"order", intakeId:String(chatId), intakeName:employee.name});
    sendCancelMenu_(chatId, "📥 تسجيل جهاز جديد\n\nأرسل رقم الطلب الصادر من سيستم الاستلام:");
    return true;
  }
  if (isAdmin_(chatId, sheets) && (text === "🛠️ إدارة الأجهزة" || text === "إدارة الأجهزة")) {
    sendMessage_(chatId, "🛠️ إدارة الأجهزة\nاختر العملية المطلوبة:", {inline_keyboard:[
      [{text:"📋 جميع الأجهزة",callback_data:"dev|list"}],
      [{text:"📢 إرسال إشعار لفني",callback_data:"dev|notifylist"}],
      [{text:"🏠 القائمة الرئيسية",callback_data:"dev|menu"}]
    ]});
    return true;
  }
  const flow = activeDeviceFlow;
  if (!flow) return false;
  if (text === "❌ إلغاء") { clearDeviceFlow_(chatId); sendMainMenu_(chatId, "تم إلغاء عملية الأجهزة."); return true; }
  if (flow.step === "order") {
    if (!text || text.length > 60 || /[\n\r]/.test(text)) { sendCancelMenu_(chatId, "رقم الطلب غير صحيح. أرسله مرة أخرى."); return true; }
    if (deviceFindRow_(sheets.devices, text)) { sendCancelMenu_(chatId, "رقم الطلب مسجل بالفعل في تتبع الأجهزة. أرسل رقمًا آخر أو ألغِ العملية."); return true; }
    flow.orderId = text; flow.step = "assign"; setDeviceFlow_(chatId, flow);
    const staff = getSheetObjects_(sheets.emp).filter(function(r) {
      const job = String(r["الوظيفة"] || "");
      return String(r["Chat ID"] || "").trim() && String(r["حالة الحساب"] || "نشط").trim() === "نشط" && !/استلام/i.test(job);
    });
    const rows = staff.slice(0, 50).map(function(r) { return [{text:String(r["اسم الموظف"] || "موظف").substring(0,45), callback_data:"dev|assign|" + String(r["Chat ID"]).trim()}]; });
    rows.push([{text:"❌ إلغاء",callback_data:"dev|cancel"}]);
    sendMessage_(chatId, "اختر الفني المسؤول عن الطلب #" + flow.orderId + ":", {inline_keyboard:rows}); return true;
  }
  if (flow.step === "notify_text") {
    if (!text || text.length < 2 || text.length > 3000) { sendCancelMenu_(chatId, "اكتب نص الإشعار (حتى 3000 حرف)، أو اضغط إلغاء."); return true; }
    const target = deviceEmployeeById_(sheets, flow.targetId);
    if (!target) { clearDeviceFlow_(chatId); sendMessage_(chatId, "الفني لم يعد متاحًا. أعد المحاولة من إدارة الأجهزة."); return true; }
    sendTrackedNotification_(target.chatId, "إشعار من إدارة MobiHub", "📢 رسالة من الإدارة\n\n" + text, "admin_device_notice_" + target.chatId + "_" + Date.now());
    clearDeviceFlow_(chatId);
    sendMessage_(chatId, "✅ تم إرسال الإشعار إلى " + target.name + ".");
    return true;
  }
  if (flow.step === "statusnote") {
    const row = deviceFindRow_(sheets.devices, flow.orderId);
    if (!row) { clearDeviceFlow_(chatId); sendMainMenu_(chatId,"تعذر العثور على الجهاز."); return true; }
    const rec = sheets.devices.getRange(row,1,1,DEVICE_HEADERS.length).getDisplayValues()[0];
    sheets.devices.getRange(row,11).setValue(flow.newStatus); sheets.devices.getRange(row,13).setValue(deviceNow_());
    deviceAppendMovement_(sheets,{orderId:flow.orderId,type:"تغيير حالة",fromId:chatId,fromName:employee.name,toId:rec[7],toName:rec[8],status:flow.newStatus,location:rec[11],notes:text === "-" ? "" : text,actorId:chatId,actorName:employee.name});
    clearDeviceFlow_(chatId);
    const alert = "📱 تحديث حالة جهاز\nرقم الطلب: " + flow.orderId + "\nالجهاز: " + rec[2] + "\nالحالة الجديدة: " + flow.newStatus + "\nالمكان: " + rec[11] + "\nالموظف: " + employee.name + (text === "-" ? "" : "\nملاحظات: " + text);
    notifyAdmin_(alert);
    const intakeId = String(rec[5] || "");
    if (intakeId && intakeId !== String(chatId)) sendTrackedNotification_(intakeId,"تحديث جهاز",alert,"device_status_"+flow.orderId+"_"+Date.now());
    if (flow.newStatus === "مراجعة الجودة" || flow.newStatus === "يحتاج إعادة فحص" || flow.newStatus === "لم يتم الرد" || flow.newStatus === "يحتاج التواصل مع العميل") {
      getSheetObjects_(sheets.emp).forEach(function(staff) {
        const job = String(staff["الوظيفة"] || "");
        const staffId = String(staff["Chat ID"] || "").trim();
        if (staffId && staffId !== String(chatId) && /جودة|QC|مراقب/i.test(job) && String(staff["حالة الحساب"] || "نشط").trim() === "نشط") {
          sendTrackedNotification_(staffId,"تنبيه متابعة جهاز",alert,"device_special_"+flow.orderId+"_"+flow.newStatus+"_"+staffId+"_"+Utilities.formatDate(new Date(),TIME_ZONE,"yyyyMMddHHmm"));
        }
      });
    }
    sendMessage_(chatId,"✅ تم تحديث حالة الجهاز " + flow.orderId + " إلى: " + flow.newStatus); return true;
  }
  return false;
}
function showEmployeeDevices_(chatId, employee, sheets) {
  const all = getSheetObjects_(sheets.devices);
  const isAdmin = isAdmin_(chatId, sheets);
  const rows = all.map(function(r,i){return {r:r,row:i+2};}).filter(function(x){return isAdmin || String(x.r["الموظف المسؤول Chat ID"]||"")===String(chatId) || String(x.r["مسؤول الاستلام Chat ID"]||"")===String(chatId);}).slice(-25).reverse();
  if (!rows.length) { sendMessage_(chatId,"📱 لا توجد أجهزة مرتبطة بك حاليًا. افتح Mini App من زر Open App لمتابعة خدماتك.", {remove_keyboard:true}); return; }
  const buttons = rows.map(function(x){return [{text:String(x.r["رقم الطلب"])+" · "+String(x.r["اسم الجهاز"]||"جهاز").substring(0,25),callback_data:"dev|open|"+x.row}];});
  buttons.push([{text:"🏠 القائمة الرئيسية",callback_data:"dev|menu"}]);
  sendMessage_(chatId,"📱 أجهزتك / الأجهزة المسندة إليك\nعدد الأجهزة: " + rows.length + "\nاختر رقم الطلب لعرض التفاصيل:",{inline_keyboard:buttons});
}
function showDeviceDetails_(chatId, messageId, row, sheets) {
  if (!Number.isInteger(row) || row < 2 || row > sheets.devices.getLastRow()) { sendMessage_(chatId, "رقم الجهاز غير صحيح."); return; }
  const v = sheets.devices.getRange(row,1,1,DEVICE_HEADERS.length).getDisplayValues()[0];
  const actor = String(chatId), admin = isAdmin_(actor, sheets);
  if (!admin && actor !== String(v[5]) && actor !== String(v[7])) { sendMessage_(chatId,"⛔ ليس لديك صلاحية عرض هذا الجهاز."); return; }
  const history = getSheetObjects_(sheets.deviceMovements).filter(function(x){return String(x["رقم الطلب"])===String(v[0]);}).slice(-6).reverse();
  let text = "📱 متابعة طلب الجهاز\n━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: #" + v[0] + "\n👨‍🔧 الفني المسؤول: " + v[8] + "\n📥 مسؤول الاستلام: " + v[6] + "\n📌 الحالة: " + v[10] + "\n📍 المكان الحالي: " + v[11] + "\n🕒 آخر تحديث: " + v[12] + "\n\nℹ️ بيانات العميل والجهاز التفصيلية تظل في موقع الصيانة الخارجي؛ غير متاحة تلقائيًا داخل البوت حاليًا.\n\n📜 آخر الحركات:";
  history.forEach(function(h){text += "\n• " + h["التاريخ والوقت"] + " — " + h["نوع الحركة"] + " — " + (h["ملاحظات"]||h["الحالة"]||"");});
  const kb = {inline_keyboard:[[{text:"🔄 تحديث الحالة",callback_data:"dev|statuses|"+row}],[{text:"🔁 تحويل لموظف",callback_data:"dev|transfer|"+row}],[{text:"⬅️ قائمة الأجهزة",callback_data:"dev|list"}]]};
  if (messageId) editMessageWithKeyboard_(chatId,messageId,text,kb); else sendMessage_(chatId,text,kb);
}
function handleDeviceCallback_(callback, sheets, parts) {
  const actorId = String(callback.from && callback.from.id || "");
  const chat = callback.message && callback.message.chat;
  if (!chat || chat.type !== "private" || String(chat.id) !== actorId) { answerCallbackQuery_(callback.id,"استخدم الأزرار من المحادثة الخاصة مع البوت."); return; }
  const emp = findEmployee_(sheets.emp,actorId);
  if (!isAdmin_(actorId, sheets) && (!emp || getEmployeeAccountStatus_(sheets.emp,emp.row) !== "نشط")) { answerCallbackQuery_(callback.id,"غير مسموح."); return; }
  const action = parts[1] || "", row = Number(parts[2]);
  answerCallbackQuery_(callback.id,"جارٍ تنفيذ الطلب.");
  if (action === "cancel") { clearDeviceFlow_(actorId); sendMainMenu_(actorId,"تم إلغاء تسجيل الجهاز."); return; }
  if (action === "menu") { sendMainMenu_(actorId,"القائمة الرئيسية"); return; }
  if (action === "list") { showEmployeeDevices_(actorId,emp || {name:"المدير"},sheets); return; }
  if (action === "notifylist") {
    if (!isAdmin_(actorId, sheets)) { sendMessage_(actorId,"⛔ هذه الخاصية للمدير فقط."); return; }
    const staff = getSheetObjects_(sheets.emp).filter(function(r) { return String(r["Chat ID"] || "").trim() && String(r["حالة الحساب"] || "نشط").trim() === "نشط"; });
    const rows = staff.slice(0,50).map(function(r) { return [{text:String(r["اسم الموظف"] || "موظف").substring(0,45),callback_data:"dev|notify|"+String(r["Chat ID"]).trim()}]; });
    rows.push([{text:"⬅️ رجوع",callback_data:"dev|adminmenu"}]);
    editMessageWithKeyboard_(actorId,callback.message.message_id,"اختر الفني الذي تريد إرسال إشعار إليه:",{inline_keyboard:rows}); return;
  }
  if (action === "adminmenu") {
    if (!isAdmin_(actorId, sheets)) return;
    sendMessage_(actorId,"🛠️ إدارة الأجهزة",{inline_keyboard:[[{text:"📋 جميع الأجهزة",callback_data:"dev|list"}],[{text:"📢 إرسال إشعار لفني",callback_data:"dev|notifylist"}]]}); return;
  }
  if (action === "notify") {
    if (!isAdmin_(actorId, sheets)) { sendMessage_(actorId,"⛔ هذه الخاصية للمدير فقط."); return; }
    const target = deviceEmployeeById_(sheets,parts[2]);
    if (!target) { sendMessage_(actorId,"الفني المحدد غير متاح."); return; }
    setDeviceFlow_(actorId,{step:"notify_text",targetId:target.chatId,targetName:target.name});
    sendCancelMenu_(actorId,"📢 اكتب الإشعار الذي تريد إرساله إلى " + target.name + ":"); return;
  }
  if (action === "assign") {
    const flow = getDeviceFlow_(actorId); const target = deviceEmployeeById_(sheets,parts[2]);
    if (!flow || flow.step !== "assign" || !target) { sendMessage_(actorId,"انتهت صلاحية التسجيل أو الموظف غير متاح. ابدأ من جديد."); clearDeviceFlow_(actorId); return; }
    if (deviceFindRow_(sheets.devices,flow.orderId)) { clearDeviceFlow_(actorId); sendMessage_(actorId,"رقم الطلب أصبح مسجلًا بالفعل."); return; }
    const now = deviceNow_();
    // لا توجد وصلة مع موقع الصيانة الخارجي؛ نخزن رقم الطلب والإسناد والمكان فقط.
    sheets.devices.appendRow([flow.orderId,now,"","", "",actorId,flow.intakeName,target.chatId,target.name,target.job,"تم الاستلام","قسم الاستلام",now]);
    deviceAppendMovement_(sheets,{orderId:flow.orderId,type:"استلام وإسناد الجهاز",fromId:"",fromName:"",toId:target.chatId,toName:target.name,status:"تم الاستلام",location:"قسم الاستلام",notes:"تم التسجيل برقم الطلب فقط",actorId:actorId,actorName:flow.intakeName});
    clearDeviceFlow_(actorId);
    const msg = "📥 تم استلام طلب جديد وإسناده إليك\n\n🆔 رقم الطلب: #" + flow.orderId + "\n📍 المكان المبدئي: قسم الاستلام\n\nافتح (📱 حالة الجهاز) في البوت لمتابعة حالة الطلب وتحديثها أو تحويله لموظف آخر.";
    sendTrackedNotification_(target.chatId,"طلب جديد مسند إليك",msg,"device_assigned_"+flow.orderId);
    sendMessage_(actorId,"✅ تم تسجيل الطلب وإسناده بنجاح.\nرقم الطلب: #" + flow.orderId + "\nالفني: " + target.name);
    notifyAdmin_("📥 تم تسجيل طلب جهاز جديد\nرقم الطلب: #" + flow.orderId + "\nالفني: " + target.name + "\nمسؤول الاستلام: " + flow.intakeName);
    return;
  }
  if (action === "open") { showDeviceDetails_(actorId,callback.message.message_id,row,sheets); return; }
  if (!Number.isInteger(row) || row < 2 || row > sheets.devices.getLastRow()) { sendMessage_(actorId,"رقم الجهاز غير صحيح."); return; }
  const v = sheets.devices.getRange(row,1,1,DEVICE_HEADERS.length).getDisplayValues()[0];
  if (!isAdmin_(actorId, sheets) && actorId !== String(v[5]) && actorId !== String(v[7])) { sendMessage_(actorId,"⛔ ليس لديك صلاحية تعديل هذا الجهاز."); return; }
  if (action === "statuses") {
    const rows = DEVICE_STATUSES.map(function(st){return [{text:st,callback_data:"dev|setstatus|"+row+"|"+DEVICE_STATUSES.indexOf(st)}];});
    rows.push([{text:"⬅️ رجوع",callback_data:"dev|open|"+row}]);
    editMessageWithKeyboard_(actorId,callback.message.message_id,"اختر الحالة الجديدة للجهاز " + v[0] + ":",{inline_keyboard:rows}); return;
  }
  if (action === "setstatus") {
    const status = DEVICE_STATUSES[Number(parts[3])]; if (!status) { sendMessage_(actorId,"الحالة غير معروفة."); return; }
    setDeviceFlow_(actorId,{step:"statusnote",orderId:String(v[0]),newStatus:status});
    sendCancelMenu_(actorId,"اكتب ملاحظة مختصرة عن التحديث، أو أرسل - بدون ملاحظات:"); return;
  }
  if (action === "transfer") {
    const staff = getSheetObjects_(sheets.emp).filter(function(r){return String(r["Chat ID"]||"") && String(r["حالة الحساب"]||"نشط")==="نشط" && String(r["Chat ID"])!==actorId;});
    const rows = staff.slice(0,50).map(function(r){return [{text:String(r["اسم الموظف"]||"موظف").substring(0,45),callback_data:"dev|move|"+row+"|"+String(r["Chat ID"])}];});
    rows.push([{text:"⬅️ رجوع",callback_data:"dev|open|"+row}]);
    editMessageWithKeyboard_(actorId,callback.message.message_id,"اختر الموظف الذي سيتسلم الجهاز " + v[0] + ":",{inline_keyboard:rows}); return;
  }
  if (action === "move") {
    const target = deviceEmployeeById_(sheets,parts[3]); if (!target || target.chatId===actorId) { sendMessage_(actorId,"الموظف المحدد غير متاح."); return; }
    const oldId = String(v[7]), oldName = String(v[8]); const now = deviceNow_();
    sheets.devices.getRange(row,8,1,2).setValues([[target.chatId,target.name]]); sheets.devices.getRange(row,10).setValue(target.job); sheets.devices.getRange(row,13).setValue(now);
    deviceAppendMovement_(sheets,{orderId:String(v[0]),type:"تحويل مسؤولية الجهاز",fromId:oldId,fromName:oldName,toId:target.chatId,toName:target.name,status:v[10],location:v[11],notes:"تم التحويل بموافقة الموظف المحوّل " + (emp ? emp.name : "المدير"),actorId:actorId,actorName:emp ? emp.name : "المدير"});
    const msg = "🔁 تم تحويل جهاز إليك\nرقم الطلب: " + v[0] + "\nالجهاز: " + v[2] + "\nالحالة: " + v[10] + "\nالمكان: " + v[11] + "\nتم التحويل بواسطة: " + (emp ? emp.name : "المدير");
    sendTrackedNotification_(target.chatId,"تحويل جهاز إليك",msg,"device_transfer_"+v[0]+"_"+Date.now());
    if (oldId && oldId!==actorId) sendMessage_(oldId,"📤 تم تحويل مسؤولية الجهاز " + v[0] + " إلى " + target.name + ".");
    notifyAdmin_("🔁 تحويل جهاز\nرقم الطلب: " + v[0] + "\nمن: " + oldName + "\nإلى: " + target.name + "\nبواسطة: " + (emp ? emp.name : "المدير"));
    showDeviceDetails_(actorId,callback.message.message_id,row,sheets); return;
  }
  sendMessage_(actorId,"إجراء غير معروف في تتبع الأجهزة.");
}

/* =========================================
   WEBHOOK AND TESTS
========================================= */

// ربط Telegram بالـ Web App
function setWebhookNow() {
  validateConfig_();

  const result = telegramApi_("setWebhook", {
    url: WEB_APP_URL,
    secret_token: WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// معرفة حالة الـ Webhook
function checkTelegramWebhook() {

  validateConfig_();

  const result = telegramApi_(
    "getWebhookInfo",
    {}
  );

  Logger.log(
    JSON.stringify(result, null, 2)
  );

  return result;
}


// حذف الـ Webhook
function deleteWebhook() {

  validateConfig_();

  const result = telegramApi_(
    "deleteWebhook",
    {
      drop_pending_updates: false
    }
  );

  Logger.log(
    JSON.stringify(result, null, 2)
  );

  return result;
}


// اختبار إرسال رسالة للمدير
function testTelegramMessage() {

  validateConfig_();

  return sendMessage_(
    ADMIN_ID,
    "✅ اختبار MobiHub\n\nالبوت يستطيع إرسال الرسائل بنجاح."
  );
}


// فحص إعدادات النظام
function diagnoseBot() {

  validateConfig_();

  const webhook = telegramApi_(
    "getWebhookInfo",
    {}
  );

  Logger.log(
    "WEBHOOK INFO:\n" +
    JSON.stringify(webhook, null, 2)
  );

  Logger.log(
    "CONFIGURED URL:\n" +
    WEB_APP_URL
  );

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {

    throw new Error(
      "المشروع غير مربوط بملف Google Sheets."
    );
  }

  Logger.log(
    "SPREADSHEET:\n" +
    ss.getUrl()
  );

  const sheets = getSheets_();

  Logger.log(
    "EMPLOYEE SHEET: " +
    sheets.emp.getName() +
    " | STATE COLUMN: " +
    getEmployeeStateColumn_(sheets.emp)
  );
}


/* =========================================
   CONFIGURATION VALIDATION
========================================= */

function validateConfig_() {

  if (!getBotToken_()) {
    throw new Error("لم يتم ضبط توكن البوت. أضف BOT_TOKEN في Script Properties.");
  }

  if (
    !ADMIN_ID ||
    ADMIN_ID.indexOf("PUT_") === 0
  ) {

    throw new Error(
      "ضع Telegram Chat ID الخاص بالمدير في ADMIN_ID."
    );
  }

if (
  !WEB_APP_URL ||
  !WEB_APP_URL.startsWith("https://") ||
  !WEB_APP_URL.includes(".workers.dev")
) {
  throw new Error("ضع رابط Cloudflare Worker الصحيح في WEB_APP_URL.");
}
  if (
    !isFinite(CENTER_LAT) ||
    !isFinite(CENTER_LONG) ||
    Math.abs(CENTER_LAT) > 90 ||
    Math.abs(CENTER_LONG) > 180
  ) {

    throw new Error(
      "إحداثيات المركز غير صحيحة."
    );
  }
}


/* =========================================
   TELEGRAM API
========================================= */

function telegramApi_(
  method,
  payload
) {

  const telegramStarted = Date.now();
  validateConfig_();

  const url =
    "https://api.telegram.org/bot" +
    getBotToken_() +
    "/" +
    method;

  const response = UrlFetchApp.fetch(
    url,
    {
      method: "post",

      contentType: "application/json",

      payload: JSON.stringify(
        payload || {}
      ),

      muteHttpExceptions: true
    }
  );

  const body = response.getContentText();
  if (PropertiesService.getScriptProperties().getProperty("PERF_LOG_ENABLED") === "true") {
    Logger.log("MOBIHUB_TELEGRAM_PERF " + JSON.stringify({method: method, durationMs: Date.now() - telegramStarted, httpCode: response.getResponseCode()}));
  }

  let result;

  try {

    result = JSON.parse(body);

  } catch (err) {

    throw new Error(
      "استجابة Telegram غير مفهومة: " +
      body
    );
  }

  if (!result.ok) {

    throw new Error(
      "Telegram API " +
      method +
      " error: " +
      body
    );
  }

  return result;
}


/* =========================================
   NOTIFICATIONS
========================================= */

function notifyAdmin_(text) {
  if (!ADMIN_ID || String(ADMIN_ID).indexOf("PUT_") === 0) return;
  notifyAdmins_("إشعار إداري", text, "");
}




/* =========================================
   PHASE 1 - SHIFTS, ATTENDANCE MONITORING
========================================= */

// أيام الأسبوع: 0=الأحد ... 6=السبت.
// يتم إعداد الورديات وربطها من خلال أوامر المدير في Telegram.

function getBotToken_() {
  return PropertiesService.getScriptProperties().getProperty(BOT_TOKEN_PROPERTY) || "";
}

function setupPhase1() {
  setupSheets();
  Logger.log("تم تجهيز جداول المرحلة الأولى.");
}

function installAttendanceTriggers() {
  const handlers = ["scanAttendanceAndNotifyAdmin", "sendDailyAttendanceReport", "runNotificationEngine"];
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers.indexOf(trigger.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(trigger);
  });
  // محرك واحد كل 5 دقائق: التذكيرات، متابعة الحضور/الانصراف، والتقرير بعد آخر وردية.
  ScriptApp.newTrigger("runNotificationEngine").timeBased().everyMinutes(5).create();
  Logger.log("تم تثبيت محرك الإشعارات ومتابعة الحضور كل 5 دقائق.");
}

function getSheetObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const headers = values[0].map(function(x) { return String(x).trim(); });
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return String(cell).trim() !== ""; });
  }).map(function(row) {
    const obj = {};
    headers.forEach(function(header, index) { obj[header] = row[index]; });
    return obj;
  });
}

function normalizeDate_(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? text : Utilities.formatDate(parsed, TIME_ZONE, "yyyy-MM-dd");
}

function normalizeTime_(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  return match ? ("0" + match[1]).slice(-2) + ":" + match[2] : text;
}

function timeToMinutes_(value) {
  const parts = normalizeTime_(value).split(":");
  return parts.length < 2 ? 0 : Number(parts[0]) * 60 + Number(parts[1]);
}

function getAssignmentForDate_(sheet, chatId, date) {
  const day = new Date(date + "T12:00:00").getDay();
  const matches = getSheetObjects_(sheet).filter(function(row) {
    const active = String(row["الحالة"] || "نشط").trim() === "نشط";
    const idMatches = String(row["Chat ID"] || "").trim() === String(chatId);
    const start = normalizeDate_(row["تاريخ البداية"]);
    const end = normalizeDate_(row["تاريخ النهاية"]);
    const days = String(row["أيام العمل"] || "0,1,2,3,4,6")
      .split(",").map(function(x) { return Number(x.trim()); });
    return active && idMatches && (!start || date >= start) &&
      (!end || date <= end) && days.indexOf(day) !== -1;
  });
  if (!matches.length) return null;
  const row = matches[matches.length - 1];
  return { shiftId: String(row["Shift ID"] || "").trim() };
}

function getShiftById_(sheet, shiftId) {
  const rows = getSheetObjects_(sheet);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]["Shift ID"] || "").trim() === String(shiftId) &&
        String(rows[i]["الحالة"] || "نشط").trim() === "نشط") {
      const id = String(rows[i]["Shift ID"]).trim();
      const flexible = id === FLEX_SHIFT_ID || String(rows[i]["اسم الوردية"] || "").trim() === "بدون ميعاد ثابت";
      return {
        id: id,
        name: String(rows[i]["اسم الوردية"] || "").trim(),
        startTime: flexible ? "" : normalizeTime_(rows[i]["موعد الحضور"]),
        endTime: flexible ? "" : normalizeTime_(rows[i]["موعد الانصراف"]),
        graceMinutes: flexible ? 0 : Number(rows[i]["فترة السماح بالدقائق"] || GRACE_MINUTES_DEFAULT),
        isFlexible: flexible
      };
    }
  }
  return null;
}

function isAbsenceAlreadyPending_(sheet, chatId, date) {
  return getSheetObjects_(sheet).some(function(row) {
    return normalizeDate_(row["التاريخ"]) === date &&
      String(row["Chat ID"]).trim() === String(chatId) &&
      String(row["الحالة"]).trim() === "بانتظار مراجعة المدير";
  });
}

function scanAttendanceAndNotifyAdmin(sheets) {
  sheets = sheets || getSheets_();
  const date = today_();
  const nowMinutes = timeToMinutes_(Utilities.formatDate(new Date(), TIME_ZONE, "HH:mm"));

  getSheetObjects_(sheets.emp).forEach(function(emp) {
    const chatId = String(emp["Chat ID"] || "").trim();
    const name = String(emp["اسم الموظف"] || "موظف").trim();
    if (!chatId || String(emp["حالة الحساب"] || "نشط").trim() !== "نشط") return;
    // الجمعة إجازة أسبوعية ولا تُنشأ لها حالات غياب.
    if (new Date(date + "T12:00:00").getDay() === 5) return;

    const assignment = getAssignmentForDate_(sheets.assignments, chatId, date);
    if (!assignment) return;
    const shift = getShiftById_(sheets.shifts, assignment.shiftId);
    if (!shift || shift.isFlexible || !shift.startTime) return;

    if (hasAttendanceToday_(sheets.att, chatId, "حضور", date)) return;
    if (hasApprovedFullDayLeave_(sheets, chatId, date)) return;

    const grace = Number(shift.graceMinutes || GRACE_MINUTES_DEFAULT);
    const baseDeadline = timeToMinutes_(shift.startTime) + grace;
    const authorizedEnd = getApprovedLeaveEndForDate_(sheets, chatId, date, baseDeadline);
    const effectiveDeadline = Math.max(baseDeadline, authorizedEnd || 0);
    if (nowMinutes <= effectiveDeadline) return;
    if (isAbsenceAlreadyPending_(sheets.absences, chatId, date)) return;

    const detectedAt = Utilities.formatDate(new Date(), TIME_ZONE, "HH:mm:ss");
    const rowNum = sheets.absences.getLastRow() + 1;
    sheets.absences.appendRow([
      date, chatId, name, shift.id, shift.startTime, detectedAt,
      "بانتظار مراجعة المدير", "", ""
    ]);

    if (notificationSettingEnabled_(sheets, "تنبيه_الموظف_بعد_السماح")) {
      sendTrackedNotification_(chatId, "تنبيه تأخير", "⏰ تنبيه بخصوص موعد حضورك\n\nأهلاً " + name + "، لم يتم تسجيل حضورك حتى الآن.\n🕒 موعد الحضور: " + shift.startTime + "\n⏳ فترة السماح: " + grace + " دقيقة\nيرجى تسجيل الحضور أو التواصل مع الإدارة إذا كان لديك عذر.", "late_employee|" + date + "|" + chatId);
    }

    const keyboard = {
      inline_keyboard: [[
        { text: "✅ تأكيد الغياب", callback_data: "abs|confirm|" + rowNum },
        { text: "↩️ ليس غائبًا", callback_data: "abs|excuse|" + rowNum }
      ]]
    };

    notifyAdmins_("حالة حضور تحتاج مراجعة",
      "⚠️ حالة حضور تحتاج مراجعة\n\n" +
      "👤 الموظف: " + name + "\n" +
      "📅 التاريخ: " + date + "\n" +
      "🕒 موعد الحضور: " + shift.startTime + "\n" +
      "⏱ فترة السماح: " + grace + " دقيقة\n" +
      "🔎 وقت اكتشاف الحالة: " + detectedAt +
      "\n\nلم يسجل الموظف حضورًا حتى الآن. راجع الحالة قبل اعتماد الغياب.",
      notificationKey_("absence_admin", date, chatId), keyboard, "Supervisor"
    );
  });
}

function handleAbsenceCallback_(callback, sheets, action, rowNum) {
  if (!Number.isInteger(rowNum) || rowNum < 2 || rowNum > sheets.absences.getLastRow()) {
    answerCallbackQuery_(callback.id, "رقم الحالة غير صحيح.");
    return;
  }
  const row = sheets.absences.getRange(rowNum, 1, 1, ABSENCE_HEADERS.length).getDisplayValues()[0];
  if (String(row[6]).trim() !== "بانتظار مراجعة المدير") {
    answerCallbackQuery_(callback.id, "تمت مراجعة هذه الحالة بالفعل.");
    return;
  }

  const confirmed = action === "confirm";
  if (!confirmed && action !== "excuse") {
    answerCallbackQuery_(callback.id, "اختيار غير معروف.");
    return;
  }

  const decision = confirmed ? "تأكيد الغياب" : "ليس غائبًا";
  const status = confirmed ? "غياب مؤكد" : "مغلق - ليس غيابًا";
  const decidedAt = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  sheets.absences.getRange(rowNum, 7, 1, 3).setValues([[status, decision, decidedAt]]);
  answerCallbackQuery_(callback.id, "تم تسجيل القرار.");

  const employeeChatId = String(row[1] || "").trim();
  if (employeeChatId) {
    sendMessage_(employeeChatId, confirmed
      ? "تم تسجيل غيابك لهذا اليوم بعد مراجعة الإدارة. إذا كان هناك خطأ، تواصل مع المدير."
      : "تمت مراجعة حالة عدم الحضور، ولم يتم اعتمادها كغياب.");
  }

  if (callback.message && callback.message.chat) {
    editMessageText_(callback.message.chat.id, callback.message.message_id,
      String(callback.message.text || "") + "\n\n📌 قرار المدير: " + decision);
  }
}

function handleAdminMessage_(chatId, text, sheets) {
  if (isAdmin_(chatId, sheets) && handleComplaintReplyText_(chatId, text, sheets, true)) return true;
  if (isAdmin_(chatId, sheets) && (text === "❌ إلغاء" || text === "/cancel")) {
    clearAdminWizard_(chatId);
    PropertiesService.getScriptProperties().deleteProperty(deductionFlowKey_(chatId));
    PropertiesService.getScriptProperties().deleteProperty(requestFlowKey_(chatId));
    PropertiesService.getScriptProperties().deleteProperty(uniformFlowKey_(chatId));
    clearDeviceFlow_(chatId);
    PropertiesService.getScriptProperties().deleteProperty("MOBI_REWARD_BONUS_FLOW_" + String(chatId));
    sendAdminMenu_(chatId);
    return true;
  }
  if (handleRewardBonusAdminText_(chatId, text, sheets)) return true;
  if (handleDeductionAdminTextV15_(chatId, text, sheets)) return true;
  if (handleEmployeeWizardMessage_(chatId, text, sheets)) return true;

  if (text.indexOf("/admin_add ") === 0) { adminAddCommand_(chatId, text.substring(11), sheets); return true; }
  if (text.indexOf("/admin_remove ") === 0) { adminRemoveCommand_(chatId, text.substring(14), sheets); return true; }
  if (text.indexOf("/admin_role ") === 0) { adminRoleCommand_(chatId, text.substring(12), sheets); return true; }

  if (text.indexOf("/shift_add ") === 0) {
    if (!requireAdminRole_(chatId, sheets, "Admin")) return true;
    const p = text.substring(11).split("|").map(function(x) { return x.trim(); });
    if (p.length < 4) {
      sendMessage_(chatId, "الصيغة:\n/shift_add ID|اسم الوردية|HH:mm|HH:mm|15");
    } else {
      try {
        sendMessage_(chatId, addShift(p[0], p[1], p[2], p[3], p[4] || GRACE_MINUTES_DEFAULT));
      } catch (e) { sendMessage_(chatId, "تعذر إضافة الوردية: " + e.message); }
    }
    return true;
  }

  if (text.indexOf("/assign_shift ") === 0) {
    if (!requireAdminRole_(chatId, sheets, "Admin")) return true;
    const p = text.substring(14).split("|").map(function(x) { return x.trim(); });
    if (p.length < 4) {
      sendMessage_(chatId, "الصيغة:\n/assign_shift CHAT_ID|SHIFT_ID|yyyy-MM-dd|yyyy-MM-dd أو فارغ|0,1,2,3,4,6");
    } else {
      try {
        sendMessage_(chatId, assignShift(p[0], p[1], p[2], p[3], p[4] || "0,1,2,3,4,6"));
      } catch (e) { sendMessage_(chatId, "تعذر ربط الوردية: " + e.message); }
    }
    return true;
  }

  const known = ["/start", "/admin", "📊 لوحة الإدارة", "👥 الموجودون الآن",
    "🕒 تقرير اليوم", "⚠️ مراجعة الغياب", "🗓 تعليمات الورديات", "👤 إدارة الموظفين",
    "📥 طلبات الموظفين", "🕒 إدارة الورديات", "📈 التقارير", "💸 إدارة الخصومات", "🏆 إدارة المكافآت", "👑 إدارة المديرين"];
  if (known.indexOf(text) === -1) return false;

  if (["👥 الموجودون الآن", "🕒 تقرير اليوم", "⚠️ مراجعة الغياب"].indexOf(text) !== -1 && !requireAdminRole_(chatId, sheets, "Supervisor")) return true;
  if (["📈 التقارير", "👤 إدارة الموظفين", "📥 طلبات الموظفين", "🕒 إدارة الورديات", "🗓 تعليمات الورديات"].indexOf(text) !== -1 && !requireAdminRole_(chatId, sheets, "Admin")) return true;
  if (["💸 إدارة الخصومات", "🏆 إدارة المكافآت"].indexOf(text) !== -1 && !requireAdminRole_(chatId, sheets, "Finance")) return true;
  if (text === "👥 الموجودون الآن") sendCurrentEmployees_(chatId, sheets);
  else if (text === "🕒 تقرير اليوم" || text === "📈 التقارير") sendTodayReport_(chatId, sheets);
  else if (text === "⚠️ مراجعة الغياب") sendPendingAbsences_(chatId, sheets);
  else if (text === "👤 إدارة الموظفين") sendEmployeeDirectory_(chatId, sheets);
  else if (text === "📥 طلبات الموظفين") sendPendingRequests_(chatId, sheets);
  else if (text === "🕒 إدارة الورديات" || text === "🗓 تعليمات الورديات") sendShiftDirectory_(chatId, sheets);
  else if (text === "💸 إدارة الخصومات") sendAdminDeductionsMenuV15_(chatId, null, sheets);
  else if (text === "🏆 إدارة المكافآت") { if (!requireAdminRole_(chatId, sheets, "Finance")) return true; sendAdminRewardsMenu_(chatId, null, sheets); }
  else if (text === "👑 إدارة المديرين") { if (!requireAdminRole_(chatId, sheets, "Super Admin")) return true; sendAdminManagersMenu_(chatId, sheets); }
  else sendAdminMenu_(chatId);

  return true;
}

// لوحة المدير الرئيسية: جميع الأزرار الإدارية لا تظهر إلا للمدير.
function adminHomeKeyboard_(chatId) {
  const role = getAdminRole_(chatId);
  const available = [];
  if (["Super Admin", "Admin", "Supervisor"].indexOf(role) !== -1) available.push({text:"🟢 المتابعة اليومية", callback_data:"adm|cat_daily"});
  if (["Super Admin", "Admin"].indexOf(role) !== -1) {
    available.push({text:"👥 شؤون الموظفين", callback_data:"adm|cat_staff"});
    available.push({text:"🛠️ الأجهزة والصيانة", callback_data:"adm|cat_devices"});
    available.push({text:"📩 طلبات الموظفين", callback_data:"adm|cat_requests"});
    available.push({text:"⚙️ التقارير والنظام", callback_data:"adm|cat_system"});
  }
  if (["Super Admin", "Finance"].indexOf(role) !== -1) available.push({text:"💰 الإدارة المالية", callback_data:"adm|cat_finance"});
  const rows=[];
  for(let i=0;i<available.length;i+=2) rows.push(available.slice(i,i+2));
  rows.push([{text:"🔄 تحديث اللوحة",callback_data:"adm|home"}]);
  return {inline_keyboard:rows};
}

function adminCategoryKeyboard_(chatId, category) {
  const role=getAdminRole_(chatId), items=[];
  function add(text,action){if(adminCanPerform_(chatId,action))items.push({text:text,callback_data:"adm|"+action});}
  if(category==="daily"){
    add("📋 لوحة المتابعة الآن","dailyboard"); add("🟢 الموجودون الآن","current"); add("📊 تقرير اليوم","today");
    add("⚠️ مراجعة الغياب","absences"); add("⏳ مراجعة الأذونات","leaves");
    add("🧹 تقييم نظافة اليوم","rewardhygiene");
  }else if(category==="staff"){
    add("👥 دليل الموظفين وإدارة الحسابات","employees"); add("➕ إضافة موظف","empadd");
    add("🕒 إدارة الورديات","shifts");
  }else if(category==="finance"){
    add("💰 طلبات العهد والسحب","cash"); add("💸 إدارة الخصومات","deductions");
    add("🏆 إدارة المكافآت","rewards"); add("⏱️ سجل الأوفر تايم","overtime");
  }else if(category==="devices"){
    if(role==="Super Admin"||role==="Admin")items.push({text:"📋 جميع الأجهزة",callback_data:"dev|list"},{text:"📢 إرسال إشعار لفني",callback_data:"dev|notifylist"});
  }else if(category==="requests"){
    add("📥 طلبات الموظفين","requests"); add("📩 شكاوى الموظفين","complaints");
  }else if(category==="system"){
    add("📈 التقرير الشهري","month"); add("🔔 مركز الإشعارات","notifications");
    if(role==="Super Admin")add("👑 إدارة المديرين","managers");
  }
  const rows=[]; for(let i=0;i<items.length;i+=2)rows.push(items.slice(i,i+2));
  rows.push([{text:"⬅️ رجوع للوحة الإدارة",callback_data:"adm|home"}]);
  return {inline_keyboard:rows};
}

function showAdminCategory_(chatId, messageId, category) {
  const titles = {
    daily: "🟢 المتابعة اليومية", staff: "👥 شؤون الموظفين",
    finance: "💰 الإدارة المالية", devices: "🛠️ الأجهزة والصيانة",
    requests: "📩 طلبات الموظفين والتواصل", system: "⚙️ التقارير وإدارة النظام"
  };
  const title = titles[category];
  if (!title) return;
  const markup = adminCategoryKeyboard_(chatId, category);
  const message = title + "\n\nاختر الخدمة المطلوبة:";
  if (messageId) editMessageWithKeyboard_(chatId, messageId, message, markup);
  else sendMessage_(chatId, message, markup);
}

function sendAdminMenu_(chatId) {
  // Inline keyboards do not replace a previously displayed employee Reply Keyboard.
  // Remove it explicitly before showing the administrator dashboard.
  sendMessage_(chatId, "🛡️ جاري فتح لوحة الإدارة...", { remove_keyboard: true });
  return sendMessage_(chatId, "🛡️ لوحة إدارة MobiHub\n\nاختر القسم المطلوب. ستظهر لك الخدمات المتاحة حسب صلاحيتك:", adminHomeKeyboard_(chatId));
}

function editMessageWithKeyboard_(chatId, messageId, text, replyMarkup) {
  return telegramApi_("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    reply_markup: replyMarkup
  });
}

function adminBackKeyboard_() {
  return { inline_keyboard: [[{ text: "⬅️ رجوع للوحة الإدارة", callback_data: "adm|home" }]] };
}

function handleAdminDashboardCallback_(callback, sheets, parts) {
  const chatId = String(callback.message && callback.message.chat ? callback.message.chat.id : ADMIN_ID);
  const messageId = callback.message ? callback.message.message_id : null;
  const action = parts[1] || "home";
  if (!adminCanPerform_(chatId, action, sheets)) { answerCallbackQuery_(callback.id, "⛔ صلاحيتك لا تسمح بفتح هذا القسم."); return; }
  answerCallbackQuery_(callback.id, "تم استلام الطلب.");

  if (action === "managers") { sendAdminManagersMenu_(chatId, sheets); return; }
  if (action.indexOf("cat_") === 0) {
    const category = action.substring(4);
    showAdminCategory_(chatId, messageId, category);
    return;
  }
  if (action === "dailyboard") { sendDailyOperationsBoard_(chatId, messageId, sheets); return; }
  if (action === "overtime") { sendOvertimeReport_(chatId, messageId, sheets); return; }
  if (action === "deductions") { sendAdminDeductionsMenuV15_(chatId, messageId, sheets); return; }
  if (action === "rewards") { sendAdminRewardsMenu_(chatId, messageId, sheets); return; }
  if (action === "rewardhygiene") { showRewardHygieneEmployees_(chatId, messageId, sheets); return; }
  if (action === "rewardhyginee") { showRewardHygieneChoice_(chatId, messageId, String(parts[2] || ""), sheets); return; }
  if (action === "rewardhygines") { saveRewardHygiene_(callback, sheets, parts); return; }
  if (action === "rewardbonus") { showRewardBonusEmployees_(chatId, messageId, sheets); return; }
  if (action === "rewardbonuse") { startRewardBonusWizard_(chatId, String(parts[2] || ""), sheets); return; }
  if (action === "rewardreport") { sendAdminRewardsReport_(chatId, sheets); return; }
  if (action === "dedadd") { startManualDeductionV15_(chatId, messageId, sheets); return; }
  if (action === "dedview") {
    const n = Number(parts[2]);
    const r = (n >= 2 && n <= sheets.deductions.getLastRow()) ? sheets.deductions.getRange(n, 1, 1, DEDUCTION_HEADERS.length).getDisplayValues()[0] : null;
    if (!r) { editMessageWithKeyboard_(chatId, messageId, "الخصم غير موجود.", adminBackKeyboard_()); return; }
    const detail = "💸 مراجعة خصم\n\nالموظف: " + r[3] + "\nالنوع: " + r[4] + "\nالتاريخ: " + r[1] + "\nالسبب: " + r[5] + "\nالمبلغ: " + r[6] + " جنيه";
    editMessageWithKeyboard_(chatId, messageId, detail, {inline_keyboard:[[ {text:"✅ اعتماد",callback_data:"ded|approve|"+n},{text:"❌ رفض",callback_data:"ded|reject|"+n} ],[{text:"⬅️ رجوع",callback_data:"adm|dedpending"}]]});
    return;
  }
  if (action === "dedpending") { showPendingDeductionsV15_(chatId, messageId, sheets); return; }
  if (action === "dedreport") { sendAdminDeductionReportV15_(chatId, sheets); return; }
  if (action === "dedemployee") { chooseManualDeductionTypeV15_(chatId, messageId, String(parts[2] || ""), sheets); return; }
  if (action === "leaves") {
    showPendingLeaveRequestsV15_(chatId, messageId, sheets);
    return;
  }

  if (action === "notifications") {
    showNotificationCenter_(chatId, messageId, sheets);
    return;
  }
  if (action === "ntoggle") {
    const settingIndex = Number(parts[2]);
    const settingRows = getSheetObjects_(sheets.notificationSettings);
    const key = settingRows[settingIndex] ? String(settingRows[settingIndex]["الإعداد"] || "") : "";
    if (key) toggleNotificationSetting_(sheets, key);
    showNotificationCenter_(chatId, messageId, sheets, "تم تحديث إعداد الإشعار.");
    return;
  }
  if (action === "ntest") {
    const ok = sendTrackedNotification_(chatId, "اختبار مركز الإشعارات", "🧪 اختبار الإشعارات\n\nيعمل مركز إشعارات MobiHub بصورة صحيحة.", "manual_test_" + Utilities.getUuid());
    answerCallbackQuery_(callback.id, ok.ok ? "تم إرسال رسالة الاختبار." : "تعذر إرسال الاختبار.");
    showNotificationCenter_(chatId, messageId, sheets);
    return;
  }
  if (action === "nlogs") {
    showRecentNotificationLogs_(chatId, messageId, sheets);
    return;
  }
  if (action === "home") {
    editMessageWithKeyboard_(chatId, messageId,
      "🛡️ لوحة إدارة MobiHub\n\nاختر القسم المطلوب. ستظهر لك الخدمات المتاحة حسب صلاحيتك:",
      adminHomeKeyboard_(chatId));
    return;
  }

  if (action === "leaveview") {
    const rowNum = Number(parts[2]);
    if (!Number.isInteger(rowNum) || rowNum < 2 || rowNum > sheets.leaves.getLastRow()) { editMessageWithKeyboard_(chatId, messageId, "طلب الإذن غير موجود.", adminBackKeyboard_()); return; }
    const r = sheets.leaves.getRange(rowNum, 1, 1, LEAVE_HEADERS.length).getDisplayValues()[0];
    const detail = "⏳ تفاصيل طلب الإذن\n\n👤 " + r[3] + "\n📅 من " + r[5] +
      (r[4] === "يوم كامل" && r[14] && r[14] !== r[5] ? " إلى " + r[14] : "") +
      "\n📌 " + r[4] +
      (r[4] === "بالساعات" ? "\n🕒 من " + r[6] + " إلى " + r[7] : "\n📆 عدد الأيام: " + (r[13] || 1)) +
      "\n📝 " + r[8] + "\nالحالة: " + r[9];
    editMessageWithKeyboard_(chatId, messageId, detail, {inline_keyboard:[[ {text:"✅ موافقة",callback_data:"leave|approve|"+rowNum},{text:"❌ رفض",callback_data:"leave|reject|"+rowNum} ],[{text:"⬅️ قائمة الأذونات",callback_data:"adm|leaves"}]]});
    return;
  }

  if (action === "employees") {
    PropertiesService.getScriptProperties().deleteProperty("MOBI_EMPLOYEE_SEARCH_" + chatId);
    sendEmployeeDirectory_(chatId, sheets, messageId, String(parts[2] || "all"), Number(parts[3] || 0), "");
    return;
  }
  if (action === "empfilter" || action === "emppage") {
    sendEmployeeDirectory_(chatId, sheets, messageId, String(parts[2] || "all"), Number(parts[3] || 0), "");
    return;
  }
  if (action === "empsearch") {
    setAdminWizard_(chatId, {step:"emp_search"});
    sendMessage_(chatId, "🔎 بحث عن موظف\n\nاكتب الاسم أو رقم الهاتف أو Chat ID.\nلإلغاء البحث أرسل /cancel.", {keyboard:[[{text:"❌ إلغاء"}]],resize_keyboard:true,one_time_keyboard:true});
    return;
  }

  if (action === "employee") {
    showEmployeeDetails_(chatId, messageId, String(parts[2] || ""), sheets);
    return;
  }
  if (action === "emprewards") { showEmployeeRewardDetails_(chatId,messageId,String(parts[2]||""),sheets); return; }
  if (action === "empdeductions") { showEmployeeDeductionDetails_(chatId,messageId,String(parts[2]||""),sheets); return; }
  if (action === "emphistory") { showEmployeeAttendanceHistory_(chatId,messageId,String(parts[2]||""),sheets); return; }

  if (action === "empadd") {
    startEmployeeWizard_(chatId);
    return;
  }
  if (action === "empedit") {
    const field = parts[2] || "";
    const employeeId = parts[3] || "";
    const employee = findEmployee_(sheets.emp, employeeId);
    if (!employee || ["name", "job", "phone"].indexOf(field) === -1) {
      editMessageWithKeyboard_(chatId, messageId, "تعذر تحديد الموظف أو الحقل المطلوب.", adminBackKeyboard_());
      return;
    }
    setAdminWizard_(chatId, { step: "edit_" + field, employeeId: employeeId });
    sendMessage_(chatId, field === "name" ? "اكتب الاسم الجديد للموظف:" : field === "job" ? "اكتب الوظيفة الجديدة:" : "اكتب رقم الهاتف الجديد:", { keyboard: [[{ text: "❌ إلغاء" }]], resize_keyboard: true, one_time_keyboard: true });
    return;
  }
  if (action === "emptoggle") {
    const employeeId = parts[2] || "";
    const employee = findEmployee_(sheets.emp, employeeId);
    if (!employee) { editMessageWithKeyboard_(chatId, messageId, "الموظف غير موجود.", adminBackKeyboard_()); return; }
    const current = getEmployeeAccountStatus_(sheets.emp, employee.row);
    const next = current === "نشط" ? "موقوف" : "نشط";
    setEmployeeAccountStatus_(sheets.emp, employee.row, next);
    showEmployeeDetails_(chatId, messageId, employeeId, sheets);
    return;
  }
  if (action === "empshift") {
    const employeeId = parts[2] || "";
    if (!findEmployee_(sheets.emp, employeeId)) { editMessageWithKeyboard_(chatId, messageId, "الموظف غير موجود.", adminBackKeyboard_()); return; }
    const shifts = getSheetObjects_(sheets.shifts).filter(function(x) { return String(x["الحالة"] || "نشط").trim() === "نشط"; });
    const rows = shifts.map(function(x) { return [{ text: String(x["اسم الوردية"] || x["Shift ID"]).substring(0, 45), callback_data: "adm|shiftpick|" + employeeId + "|" + String(x["Shift ID"]) }]; });
    rows.push([{ text: "⬅️ رجوع لبيانات الموظف", callback_data: "adm|employee|" + employeeId }]);
    editMessageWithKeyboard_(chatId, messageId, "🕒 اختر نظام الدوام الجديد للموظف. عند اختيار (بدون ميعاد ثابت) ستتمكن من تحديد أيام العمل بما فيها الجمعة:", { inline_keyboard: rows.length ? rows : [[{ text: "لا توجد ورديات نشطة", callback_data: "adm|employee|" + employeeId }]] });
    return;
  }
  if (action === "shiftpick") {
    const employeeId = parts[2] || "";
    const shiftId = parts[3] || "";
    try {
      const chosen = getShiftById_(sheets.shifts, shiftId);
      if (chosen && chosen.isFlexible) {
        showFlexibleDaysPicker_(chatId, messageId, employeeId, "0,1,2,3,4,6");
      } else {
        assignShiftFromDashboard_(sheets, employeeId, shiftId);
        showEmployeeDetails_(chatId, messageId, employeeId, sheets);
      }
    } catch (err) {
      editMessageWithKeyboard_(chatId, messageId, "تعذر تغيير الوردية: " + err.message, adminBackKeyboard_());
    }
    return;
  }
  if (action === "flexday") {
    showFlexibleDaysPicker_(chatId, messageId, String(parts[2] || ""), String(parts[3] || ""));
    return;
  }
  if (action === "flexall") {
    showFlexibleDaysPicker_(chatId, messageId, String(parts[2] || ""), "0,1,2,3,4,5,6");
    return;
  }
  if (action === "flexsave") {
    const employeeId = String(parts[2] || "");
    const days = String(parts[3] || "");
    if (!days) { editMessageWithKeyboard_(chatId,messageId,"اختر يوم عمل واحدًا على الأقل.",adminBackKeyboard_()); return; }
    try {
      assignShiftFromDashboard_(sheets, employeeId, FLEX_SHIFT_ID, days);
      showEmployeeDetails_(chatId, messageId, employeeId, sheets);
      sendMessage_(chatId, "✅ تم تعيين نظام بدون ميعاد ثابت للموظف. أيام العمل: " + days.split(",").map(function(d){return ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"][Number(d)];}).join("، "));
    } catch (err) {
      editMessageWithKeyboard_(chatId,messageId,"تعذر تعيين النظام: "+err.message,adminBackKeyboard_());
    }
    return;
  }

  if (action === "current") {
    sendCurrentEmployees_(chatId, sheets);
    return;
  }
  if (action === "today") {
    sendTodayReport_(chatId, sheets);
    return;
  }
  if (action === "month") {
    sendMonthlyReport_(chatId, sheets);
    return;
  }
  if (action === "absences") {
    sendPendingAbsences_(chatId, sheets);
    return;
  }
  if (action === "requests") {
    sendPendingRequests_(chatId, sheets);
    return;
  }
  if (action === "shifts") { sendShiftDirectory_(chatId, sheets, messageId); return; }
  if (action === "shiftadd") { startShiftWizard_(chatId); return; }
  if (action === "shiftedit") { startShiftEditWizard_(chatId, String(parts[2] || ""), sheets); return; }
  if (action === "shiftfield") { var sid=String(parts[2]||""), field=String(parts[3]||""); if(["name","start","end","grace"].indexOf(field)<0){sendMessage_(chatId,"حقل غير صالح.");return;} setAdminWizard_(chatId,{step:"shift_edit_"+field,shiftId:sid});sendMessage_(chatId,"أرسل القيمة الجديدة لـ"+({name:"اسم الوردية",start:"موعد الحضور HH:mm",end:"موعد الانصراف HH:mm",grace:"فترة السماح بالدقائق"}[field])+":",{keyboard:[[{text:"❌ إلغاء"}]],resize_keyboard:true,one_time_keyboard:true});return; }
  if (action === "shifttoggle") { toggleShiftStatus_(chatId, messageId, String(parts[2] || ""), sheets); return; }
  if (action === "cash") {
    sendPendingCashRequests_(chatId, sheets);
    return;
  }
  if (action === "cashact") {
    handleCashCallback_(callback, sheets, parts);
    return;
  }
  if (action === "complaints") {
    sendOpenComplaints_(chatId, sheets);
    return;
  }
  if (action === "complaintact") {
    handleComplaintCallback_(callback, sheets, parts);
    return;
  }
  if (action === "complaintreply") {
    startComplaintReply_(chatId, Number(parts[2]), sheets, true);
    answerCallbackQuery_(callback.id, "اكتب ردك على الشكوى في رسالة منفصلة.");
    return;
  }
  editMessageWithKeyboard_(chatId, messageId, "القسم المطلوب غير معروف.", adminBackKeyboard_());
}

// ===== MobiHub Rewards =====
function rewardMonth_() { return Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM"); }
function rewardDateInMonth_(d, month) { return String(d || "").indexOf(month) === 0; }
function rewardIsApprovedLeave_(sheets, chatId, date) {
  return getSheetObjects_(sheets.leaves).some(function(r) {
    if (String(r["Chat ID"] || "").trim() !== String(chatId) || String(r["الحالة"] || "").trim() !== "مقبول") return false;
    var type=String(r["نوع الإذن"] || "").trim(), start=normalizeDate_(r["تاريخ الإذن"]), end=normalizeDate_(r["تاريخ نهاية الإذن"] || r["تاريخ الإذن"]);
    if (type === "يوم كامل") return !!start && date >= start && date <= (end || start);
    // الإذن بالساعات لا يعفي اليوم كله من نقاط الحضور؛ لا يُستبعد إلا إذا غطى بداية الوردية.
    var a=getAssignmentForDate_(sheets.assignments,chatId,date), sh=a?getShiftById_(sheets.shifts,a.shiftId):null;
    // لا يمكن استبعاد يوم كامل بسبب إذن بالساعات في نظام بلا موعد ثابت.
    return !!(start===date && sh && !sh.isFlexible && timeToMinutes_(r["من الساعة"])<=timeToMinutes_(sh.startTime));
  });
}
function getRewardMonthlyData_(chatId, sheets, month) {
  month=month || rewardMonth_();
  var assignments=getSheetObjects_(sheets.assignments), attendance=getSheetObjects_(sheets.att), hygiene=getSheetObjects_(sheets.rewardHygiene);
  var eligible=0, elapsedEligible=0, scoredEligible=0, earned=0, commitment=0, onTime=0, uniform=0, hygienePoints=0, excluded=0, shifts=0, hygienePending=0;
  var daysInMonth=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
  var today=today_();
  for(var day=1;day<=daysInMonth;day++) {
    var date=month+"-"+(day<10?"0":"")+day;
    var assignment=getAssignmentForDate_(sheets.assignments,chatId,date); if(!assignment) continue;
    var shift=getShiftById_(sheets.shifts,assignment.shiftId); if(!shift) continue;
    shifts++;
    if(rewardIsApprovedLeave_(sheets,chatId,date)) { excluded++; continue; }
    // المقام يعكس إجمالي أيام العمل المجدولة للشهر بالكامل، بما فيها الأيام القادمة.
    // المقام الحالي والنقاط المحققة يقتصران على الورديات التي انتهت قبل اليوم؛ لا نحكم على وردية اليوم قبل اكتمالها.
    eligible+=REWARD_DAILY_POINTS;
    if(date>=today) continue;
    elapsedEligible+=REWARD_DAILY_POINTS;
    var records=attendance.filter(function(r){return String(r["Chat ID"]||"").trim()===String(chatId) && normalizeDate_(r["التاريخ"])===date && String(r["النوع"]||"")==="حضور";});
    var attended=records.length?records[records.length-1]:null;
    var isOnTime=!!(attended && String(attended["حالة الحضور"]||"")==="في الموعد" && Number(attended["دقائق التأخير"]||0)===0);
    var isUniform=!!(attended && String(attended["اليونيفورم"]||"")==="ملتزم");
    if(isOnTime) onTime++;
    if(isUniform) uniform++;
    // لا تُمنح نقطة الالتزام إلا باجتماع الحضور في الموعد واليونيفورم الملتزم.
    if(isOnTime && isUniform) { commitment++; earned++; }
    var dayHygiene=null;
    hygiene.forEach(function(r){
      if(String(r["Chat ID"]||"").trim()===String(chatId) && normalizeDate_(r["التاريخ"])===date) dayHygiene=String(r["التقييم"]||"");
    });
    if(dayHygiene==="نظيف") { hygienePoints++; earned++; }
    else if(dayHygiene!=="غير ملتزم") hygienePending++;
  }
  var hygieneRows=hygiene.filter(function(r){return String(r["Chat ID"]||"").trim()===String(chatId) && rewardDateInMonth_(normalizeDate_(r["التاريخ"]),month);});
  var clean=hygieneRows.filter(function(r){return String(r["التقييم"]||"")==="نظيف";}).length;
  var notClean=hygieneRows.filter(function(r){return String(r["التقييم"]||"")==="غير ملتزم";}).length;
  var bonus=getSheetObjects_(sheets.rewardBonus).filter(function(r){return String(r["Chat ID"]||"").trim()===String(chatId) && String(r["الشهر"]||"")===month && String(r["الحالة"]||"معتمد")==="معتمد";}).reduce(function(sum,r){return sum+Number(r["المبلغ بالجنيه"]||0);},0);
  // التقييمات المعلقة لا تدخل المقام حتى لا تُعامل كنقاط صفرية قبل تقييم المدير.
  scoredEligible=Math.max(0, elapsedEligible-hygienePending);
  var ratio=scoredEligible?Math.min(1,earned/scoredEligible):0;
  return {month:month,shifts:shifts,excluded:excluded,eligible:eligible,elapsedEligible:elapsedEligible,scoredEligible:scoredEligible,earned:earned,commitment:commitment,onTime:onTime,uniform:uniform,hygienePoints:hygienePoints,hygienePending:hygienePending,ratio:ratio,base:Math.round(REWARD_BASE_AMOUNT*ratio*100)/100,clean:clean,notClean:notClean,bonus:bonus,total:Math.round((REWARD_BASE_AMOUNT*ratio+bonus)*100)/100};
}
function handleCheckoutHygieneCallback_(callback, sheets, parts) {
  const chatId = String(callback.from && callback.from.id || "");
  const chat = callback.message && callback.message.chat;
  if (!chat || chat.type !== "private" || String(chat.id) !== chatId) {
    answerCallbackQuery_(callback.id, "افتح المحادثة الخاصة مع البوت لتسجيل الإجابة.");
    return;
  }
  const employee = findEmployee_(sheets.emp, chatId);
  const date = String(parts[2] || "");
  const pendingKey = "MOBI_CHECKOUT_HYGIENE_PENDING_" + chatId;
  const pendingDate = PropertiesService.getScriptProperties().getProperty(pendingKey);
  if (!employee || pendingDate !== date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    answerCallbackQuery_(callback.id, "انتهت صلاحية السؤال أو تم تسجيل الإجابة بالفعل.");
    return;
  }
  const choice = parts[1];
  if (choice !== "clean" && choice !== "notclean") {
    answerCallbackQuery_(callback.id, "اختيار غير صحيح.");
    return;
  }
  const score = choice === "clean" ? "نظيف" : "غير ملتزم";
  const sh = sheets.rewardHygiene;
  const rows = getSheetObjects_(sh);
  const existing = rows.find(function(r) {
    return String(r["Chat ID"] || "").trim() === chatId && normalizeDate_(r["التاريخ"]) === date;
  });
  if (existing) {
    PropertiesService.getScriptProperties().deleteProperty(pendingKey);
    answerCallbackQuery_(callback.id, "تم تسجيل تقييم النظافة لهذا اليوم بالفعل.");
    return;
  }
  const values = [date, chatId, employee.name, score, "إقرار الموظف عند تسجيل الانصراف", "إقرار الموظف", Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss")];
  sh.appendRow(values);
  PropertiesService.getScriptProperties().deleteProperty(pendingKey);
  answerCallbackQuery_(callback.id, choice === "clean" ? "تم تسجيل نقطة النظافة." : "تم تسجيل عدم الالتزام.");
  if (choice === "clean") {
    sendMainMenu_(chatId, "🌟 شكرًا لالتزامك! تم تسجيل نقطة نظافة المكان ضمن مكافآتك الشهرية.");
  } else {
    createAutomaticDeductionV15_(sheets, chatId, employee.name, date, "نظافة المكان", "أقر الموظف عند تسجيل الانصراف بأنه لم يترك مكان العمل نظيفًا ومرتبًا", REWARD_HYGIENE_PENALTY_AMOUNT, "HYGIENE|" + date + "|" + chatId);
    sendMainMenu_(chatId, "⚠️ تم تسجيل عدم الالتزام بنظافة المكان. تم رصد خصم 50 جنيه وإرساله للإدارة لاعتماده قبل إضافته إلى الخصومات المعتمدة.");
  }
}

function rewardProgressBar_(ratio) {
  var filled=Math.max(0,Math.min(10,Math.round((Number(ratio)||0)*10)));
  return "▰".repeat(filled)+"▱".repeat(10-filled);
}
function sendEmployeeRewardsSummary_(chatId, employee, sheets) {
  var d=getRewardMonthlyData_(chatId,sheets), pct=d.scoredEligible?Math.round(d.ratio*100):0;
  var msg="🏆 مكافآتي | "+d.month+"\n"+
    "━━━━━━━━━━━━━━━━\n"+
    "💰 المكافأة الأساسية\n"+
    ""+d.base.toFixed(2)+" / 500.00 جنيه\n"+
    "📊 "+rewardProgressBar_(d.ratio)+"  "+pct+"%\n\n"+
    "⭐ النقاط المحققة / النقاط التي تم حسمها: "+d.earned+" / "+d.scoredEligible+"\n"+
    "📅 إجمالي نقاط الشهر المجدولة: "+d.eligible+"\n"+
    "━━━━━━━━━━━━━━━━\n"+
    "📌 تفاصيل النقاط\n"+
    "🤝 الالتزام (حضور في الموعد + يونيفورم): "+d.commitment+" نقطة\n"+
    "🧹 نظافة المكان: "+d.hygienePoints+" نقطة\n"+
    "⏳ تقييمات نظافة معلّقة: "+d.hygienePending+" يوم (مستبعدة مؤقتًا من النسبة)\n\n"+
    "🎁 مكافآت إضافية معتمدة: "+d.bonus.toFixed(2)+" جنيه\n"+
    "💵 إجمالي المكافآت التقديري: "+d.total.toFixed(2)+" جنيه\n\n"+
    "📅 ورديات مستبعدة لإذن/إجازة معتمدة: "+d.excluded+"\n"+
    "🗓️ الورديات المحتسبة: "+d.shifts+"\n\n"+
    "💡 نقطة الالتزام لا تُحسب إلا عند الجمع بين الحضور في الموعد والالتزام باليونيفورم. ونقطة النظافة تُسجل بإقرار الموظف عند الانصراف، ويمكن للمدير مراجعتها وتعديلها.\n"+
    "النسبة الحالية محسوبة على الورديات المكتملة قبل اليوم؛ وردية اليوم لا تدخل في النسبة قبل انتهائها. إجمالي الشهر المجدول معروض بشكل منفصل، والتقييمات غير المسجلة تظل معلّقة.";
  sendMainMenu_(chatId,msg);
}
function sendAdminRewardsMenu_(chatId,messageId,sheets) {
  var msg="🏆 إدارة مكافآت MobiHub\n\nالمكافأة الأساسية: 500 جنيه شهريًا\nنقطتان لكل وردية: نقطة التزام واحدة (الحضور في الموعد + اليونيفورم معًا) ونقطة نظافة يقيّمها المدير.\nالإذن/الإجازة المعتمدان مستبعدان من النقاط المتاحة. التقييمات غير المسجلة تظهر كمعلّقة.";
  var kb={inline_keyboard:[[{text:"🧹 تقييم نظافة اليوم",callback_data:"adm|rewardhygiene"}],[{text:"🎁 إضافة مكافأة مالية",callback_data:"adm|rewardbonus"}],[{text:"📊 تقرير المكافآت للشهر",callback_data:"adm|rewardreport"}],[{text:"⬅️ رجوع",callback_data:"adm|home"}]]};
  if(messageId) editMessageWithKeyboard_(chatId,messageId,msg,kb); else sendMessage_(chatId,msg,kb);
}
function showRewardHygieneEmployees_(chatId,messageId,sheets) {
  var date=today_(), emps=getSheetObjects_(sheets.emp).filter(function(e){return String(e["Chat ID"]||"").trim() && String(e["حالة الحساب"]||"نشط")==="نشط";});
  var rows=emps.slice(0,40).map(function(e){return [{text:String(e["اسم الموظف"]||"موظف").slice(0,50),callback_data:"adm|rewardhyginee|"+String(e["Chat ID"]) }];});
  rows.push([{text:"⬅️ رجوع",callback_data:"adm|rewards"}]);
  var msg="🧹 تقييم نظافة المكان — "+date+"\nاختر الموظف لتسجيل تقييم نهاية الوردية. التقييم يسجل باسم المدير ووقته.";
  editMessageWithKeyboard_(chatId,messageId,msg,{inline_keyboard:rows});
}
function showRewardHygieneChoice_(chatId,messageId,employeeId,sheets) {
  var e=findEmployee_(sheets.emp,employeeId); if(!e){editMessageWithKeyboard_(chatId,messageId,"الموظف غير موجود.",adminBackKeyboard_());return;}
  var existing=getSheetObjects_(sheets.rewardHygiene).some(function(r){return String(r["Chat ID"])===employeeId && normalizeDate_(r["التاريخ"])===today_();});
  var msg="🧹 تقييم النظافة\n\nالموظف: "+e.name+"\nالتاريخ: "+today_()+"\n"+(existing?"يوجد تقييم مسجل لهذا الموظف اليوم؛ اختيار تقييم جديد سيحدّث السجل الحالي.":"اختر نتيجة التقييم:");
  editMessageWithKeyboard_(chatId,messageId,msg,{inline_keyboard:[[{text:"✅ المكان نظيف",callback_data:"adm|rewardhygines|"+employeeId+"|clean"},{text:"❌ غير ملتزم",callback_data:"adm|rewardhygines|"+employeeId+"|no"}],[{text:"⬅️ رجوع",callback_data:"adm|rewardhygiene"}]]});
}
function cancelPendingHygieneDeduction_(sheets, employeeId, date, actorId) {
  const reference = "HYGIENE|" + date + "|" + employeeId;
  const sh = sheets.deductions;
  const rows = getSheetObjects_(sh);
  rows.forEach(function(r, i) {
    if (String(r["مرجع الواقعة"] || "") === reference && String(r["الحالة"] || "") === "بانتظار اعتماد المدير") {
      const row = i + 2;
      sh.getRange(row, 9).setValue("ملغي");
      sh.getRange(row, 13).setValue(String(actorId || ""));
      sh.getRange(row, 14).setValue("أُلغي بعد مراجعة المدير وتأكيد نظافة المكان");
      sh.getRange(row, 15).setValue("تقييم المدير: نظيف");
      sendMessage_(employeeId, "✅ راجعت الإدارة تقييم نظافة المكان وأكدت الالتزام. تم إلغاء خصم النظافة المعلق لهذا اليوم.");
    }
  });
}

function saveRewardHygiene_(callback,sheets,parts) {
  var id=String(parts[2]||""), score=parts[3]==="clean"?"نظيف":"غير ملتزم", emp=findEmployee_(sheets.emp,id); if(!emp){answerCallbackQuery_(callback.id,"الموظف غير موجود");return;}
  var sh=sheets.rewardHygiene, rows=getSheetObjects_(sh), row=-1;
  rows.forEach(function(r,i){if(String(r["Chat ID"])===id && normalizeDate_(r["التاريخ"])===today_()) row=i+2;});
  var values=[today_(),id,emp.name,score,"",String(callback.from && callback.from.id || ""),Utilities.formatDate(new Date(),TIME_ZONE,"yyyy-MM-dd HH:mm:ss")];
  if(row>0) sh.getRange(row,1,1,REWARD_HYGIENE_HEADERS.length).setValues([values]); else sh.appendRow(values);
  if (score === "غير ملتزم") {
    createAutomaticDeductionV15_(sheets, id, emp.name, today_(), "نظافة المكان", "تقييم المدير: مكان العمل غير نظيف أو غير مرتب عند نهاية الوردية", REWARD_HYGIENE_PENALTY_AMOUNT, "HYGIENE|" + today_() + "|" + id);
  } else {
    cancelPendingHygieneDeduction_(sheets, id, today_(), String(callback.from && callback.from.id || ""));
  }
  answerCallbackQuery_(callback.id,"تم حفظ تقييم النظافة.");
  sendAdminRewardsMenu_(String(callback.message.chat.id),callback.message.message_id,sheets);
}
function showRewardBonusEmployees_(chatId,messageId,sheets) {
  var emps=getSheetObjects_(sheets.emp).filter(function(e){return String(e["Chat ID"]||"").trim();});
  var rows=emps.slice(0,40).map(function(e){return [{text:String(e["اسم الموظف"]||"موظف").slice(0,50),callback_data:"adm|rewardbonuse|"+String(e["Chat ID"])}];});
  rows.push([{text:"⬅️ رجوع",callback_data:"adm|rewards"}]);
  editMessageWithKeyboard_(chatId,messageId,"🎁 اختر الموظف لإضافة مكافأة مالية مستقلة:",{inline_keyboard:rows});
}
function startRewardBonusWizard_(chatId,employeeId,sheets) {
  var e=findEmployee_(sheets.emp,employeeId); if(!e){sendMessage_(chatId,"الموظف غير موجود.");return;}
  PropertiesService.getScriptProperties().setProperty("MOBI_REWARD_BONUS_FLOW_"+String(chatId),JSON.stringify({employeeId:employeeId,name:e.name,step:"amount"}));
  sendMessage_(chatId,"🎁 مكافأة إضافية للموظف: "+e.name+"\n\nاكتب قيمة المكافأة بالجنيه كرقم فقط:",{keyboard:[[{text:"❌ إلغاء"}]],resize_keyboard:true});
}
function handleRewardBonusAdminText_(chatId,text,sheets) {
  var props=PropertiesService.getScriptProperties(),flowKey="MOBI_REWARD_BONUS_FLOW_"+String(chatId),raw=props.getProperty(flowKey); if(!raw)return false;
  var f;try{f=JSON.parse(raw)}catch(e){props.deleteProperty(flowKey);return false;}
  if(!isAdmin_(chatId, sheets, "Finance"))return false;
  if(text==="❌ إلغاء"||text==="/cancel"){props.deleteProperty(flowKey);sendAdminMenu_(chatId);return true;}
  if(f.step==="amount") {var n=Number(String(text).replace(/,/g,"."));if(!isFinite(n)||n<=0||n>100000){sendMessage_(chatId,"المبلغ غير صحيح. اكتب رقمًا موجبًا حتى 100000 جنيه.");return true;}f.amount=Math.round(n*100)/100;f.step="reason";props.setProperty(flowKey,JSON.stringify(f));sendMessage_(chatId,"اكتب سبب المكافأة:");return true;}
  if(f.step==="reason") {if(!text||text.length>250){sendMessage_(chatId,"السبب مطلوب وبحد أقصى 250 حرفًا.");return true;}var id="RB-"+Utilities.getUuid().slice(0,8).toUpperCase();sheets.rewardBonus.appendRow([id,today_(),rewardMonth_(),f.employeeId,f.name,f.amount,text,String(chatId),"معتمد"]);props.deleteProperty(flowKey);sendMessage_(chatId,"✅ تم تسجيل المكافأة الإضافية.\nالموظف: "+f.name+"\nالمبلغ: "+f.amount+" جنيه\nالسبب: "+text);sendAdminRewardsMenu_(chatId,null,sheets);return true;}
  props.deleteProperty(flowKey);return false;
}
function sendAdminRewardsReport_(chatId,sheets) {
  var month=rewardMonth_(),emps=getSheetObjects_(sheets.emp).filter(function(e){return String(e["Chat ID"]||"").trim();}),lines=["📊 تقرير مكافآت MobiHub — "+month,"(تقديري حتى تاريخ اليوم)"];
  emps.forEach(function(e){var d=getRewardMonthlyData_(String(e["Chat ID"]),sheets,month);lines.push("\n👤 "+e["اسم الموظف"]+"\n⭐ "+d.earned+" / "+d.eligible+" نقطة — "+Math.round(d.ratio*100)+"%\n🤝 التزام: "+d.commitment+" | 🧹 نظافة: "+d.hygienePoints+" | ⏳ تقييم معلّق: "+d.hygienePending+"\n💵 أساسية: "+d.base.toFixed(2)+" | إضافية: "+d.bonus.toFixed(2));});
  sendMessage_(chatId,lines.join("\n").slice(0,3900),adminBackKeyboard_());
}

// ===== إدارة الموظفين التفاعلية =====
function adminWizardKey_(chatId) { return "MOBIHUB_ADMIN_EMPLOYEE_WIZARD_" + String(chatId || ""); }
function setAdminWizard_(chatId, state) { PropertiesService.getScriptProperties().setProperty(adminWizardKey_(chatId), JSON.stringify(state)); }
function getAdminWizard_(chatId) { const raw = PropertiesService.getScriptProperties().getProperty(adminWizardKey_(chatId)); if (!raw) return null; try { return JSON.parse(raw); } catch (e) { return null; } }
function clearAdminWizard_(chatId) { PropertiesService.getScriptProperties().deleteProperty(adminWizardKey_(chatId)); }

function startEmployeeWizard_(chatId) {
  setAdminWizard_(chatId, { step: "add_id" });
  sendMessage_(chatId, "➕ إضافة موظف جديد\n\nأرسل Telegram Chat ID الخاص بالموظف.\nيمكن للموظف الحصول عليه بإرسال /myid للبوت.", { keyboard: [[{ text: "❌ إلغاء" }]], resize_keyboard: true, one_time_keyboard: true });
}

function handleEmployeeWizardMessage_(chatId, text, sheets) {
  const state = getAdminWizard_(chatId);
  if (!state) return false;
  if (!isAdmin_(chatId, sheets, "Admin")) return false;
  if (text === "❌ إلغاء" || text === "/cancel") { clearAdminWizard_(chatId); sendEmployeeDirectory_(chatId, sheets, null, "all", 0, ""); return true; }
  if (state.step === "emp_search") {
    clearAdminWizard_(chatId);
    sendEmployeeDirectory_(chatId, sheets, null, "all", 0, text === "-" ? "" : text);
    return true;
  }
  if (state.step === "add_id") {
    if (!/^\d{5,20}$/.test(text)) { sendMessage_(chatId, "Chat ID غير صحيح. أرسل الرقم فقط أو اضغط إلغاء."); return true; }
    if (findEmployee_(sheets.emp, text)) { sendMessage_(chatId, "هذا الموظف مسجل بالفعل. أرسل Chat ID آخر أو اضغط إلغاء."); return true; }
    state.employeeId = text; state.step = "add_name"; setAdminWizard_(chatId, state); sendMessage_(chatId, "اكتب اسم الموظف:"); return true;
  }
  if (state.step === "add_name") { if (!text || text.length > 100) { sendMessage_(chatId, "الاسم مطلوب وبحد أقصى 100 حرف."); return true; } state.name = text; state.step = "add_job"; setAdminWizard_(chatId, state); sendMessage_(chatId, "اكتب الوظيفة:"); return true; }
  if (state.step === "add_job") { if (!text || text.length > 100) { sendMessage_(chatId, "الوظيفة مطلوبة وبحد أقصى 100 حرف."); return true; } state.job = text; state.step = "add_phone"; setAdminWizard_(chatId, state); sendMessage_(chatId, "اكتب رقم الهاتف، أو أرسل - إذا لم يتوفر:"); return true; }
  if (state.step === "add_phone") {
    const phone = text === "-" ? "" : text;
    if (phone && !/^[+0-9()\- ]{7,20}$/.test(phone)) { sendMessage_(chatId, "رقم الهاتف غير صحيح. أعد إرساله أو أرسل - للتخطي."); return true; }
    const duplicate = findEmployee_(sheets.emp, state.employeeId);
    if (duplicate) { clearAdminWizard_(chatId); sendMessage_(chatId, "لم تتم الإضافة لأن Chat ID أصبح مسجلًا بالفعل."); return true; }
    const row = sheets.emp.getLastRow() + 1;
    sheets.emp.getRange(row, 1, 1, 5).setValues([[state.employeeId, state.name, state.job, phone, STATE_ACTIVE]]);
    setEmployeeAccountStatus_(sheets.emp, row, "نشط");
    clearAdminWizard_(chatId);
    sendMessage_(chatId, "✅ تمت إضافة الموظف بنجاح.\n\nالاسم: " + state.name + "\nChat ID: " + state.employeeId + "\nالوظيفة: " + state.job + "\nالهاتف: " + (phone || "غير مسجل") + "\n\nيمكنك الآن فتح إدارة الموظفين وتعيين ورديته.");
    sendAdminMenu_(chatId); return true;
  }
  if (state.step === "shift_add_id") {
    if (!/^[A-Za-z0-9_-]{2,30}$/.test(text)) { sendMessage_(chatId, "معرّف الوردية يجب أن يكون من 2 إلى 30 حرفًا أو رقمًا أو - أو _. "); return true; }
    if (getShiftRowById_(sheets.shifts, text)) { sendMessage_(chatId, "المعرّف مستخدم بالفعل. أرسل معرّفًا آخر."); return true; }
    state.shiftId=text; state.step="shift_add_name"; setAdminWizard_(chatId,state); sendMessage_(chatId,"اكتب اسم الوردية:"); return true;
  }
  if (state.step === "shift_add_name") { if (!text || text.length>60) {sendMessage_(chatId,"اسم الوردية مطلوب وبحد أقصى 60 حرفًا.");return true;} state.name=text; state.step="shift_add_start";setAdminWizard_(chatId,state);sendMessage_(chatId,"اكتب موعد الحضور بصيغة HH:mm، أو FLEX إذا كانت بدون ميعاد ثابت:");return true; }
  if (state.step === "shift_add_start") { if (text.toUpperCase()==="FLEX") {state.flex=true;state.start="";state.step="shift_add_grace";setAdminWizard_(chatId,state);sendMessage_(chatId,"اكتب فترة السماح بالدقائق (0):");return true;} if(!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(text)){sendMessage_(chatId,"الوقت غير صحيح. مثال 09:00 أو أرسل FLEX.");return true;} state.start=text.length===4?"0"+text:text;state.step="shift_add_end";setAdminWizard_(chatId,state);sendMessage_(chatId,"اكتب موعد الانصراف بصيغة HH:mm:");return true; }
  if (state.step === "shift_add_end") { if(!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(text)){sendMessage_(chatId,"الوقت غير صحيح. مثال 17:00");return true;} state.end=text.length===4?"0"+text:text;state.step="shift_add_grace";setAdminWizard_(chatId,state);sendMessage_(chatId,"اكتب فترة السماح بالدقائق (مثال 15):");return true; }
  if (state.step === "shift_add_grace") {var g=Number(text);if(!/^\d{1,3}$/.test(text)||g<0||g>180){sendMessage_(chatId,"أدخل رقمًا من 0 إلى 180 دقيقة.");return true;} var sid=state.flex?FLEX_SHIFT_ID:state.shiftId;if(state.flex && getShiftRowById_(sheets.shifts,FLEX_SHIFT_ID)){clearAdminWizard_(chatId);sendMessage_(chatId,"وردية بدون ميعاد ثابت موجودة بالفعل؛ يمكنك تعديلها من القائمة.");return true;} sheets.shifts.appendRow([sid,state.name,state.start,state.end,g,"نشط"]);clearAdminWizard_(chatId);sendMessage_(chatId,"✅ تمت إضافة الوردية بنجاح.");sendShiftDirectory_(chatId,sheets);return true; }
  if (state.step.indexOf("shift_edit_")===0) {var sr=getShiftRowById_(sheets.shifts,state.shiftId);if(!sr){clearAdminWizard_(chatId);sendMessage_(chatId,"الوردية غير موجودة.");return true;}var f=state.step.substring(11), col={name:2,start:3,end:4,grace:5}[f];if(f==="name"){if(!text||text.length>60){sendMessage_(chatId,"اسم غير صالح.");return true;}sheets.shifts.getRange(sr, col).setValue(text);}else if(f==="grace"){var gv=Number(text);if(!/^\d{1,3}$/.test(text)||gv<0||gv>180){sendMessage_(chatId,"أدخل فترة سماح من 0 إلى 180.");return true;}sheets.shifts.getRange(sr,col).setValue(gv);}else{if(!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(text)){sendMessage_(chatId,"صيغة الوقت غير صحيحة. مثال 09:00");return true;}sheets.shifts.getRange(sr,col).setValue(text.length===4?"0"+text:text);}clearAdminWizard_(chatId);sendMessage_(chatId,"✅ تم تحديث بيانات الوردية.");sendShiftDetails_(chatId,state.shiftId,sheets);return true;}
  if (state.step.indexOf("edit_") === 0) {
    const employee = findEmployee_(sheets.emp, state.employeeId);
    if (!employee) { clearAdminWizard_(chatId); sendMessage_(chatId, "الموظف لم يعد موجودًا."); return true; }
    const field = state.step.substring(5);
    const col = field === "name" ? 2 : field === "job" ? 3 : 4;
    if (!text || text.length > 100) { sendMessage_(chatId, "القيمة غير صحيحة. أعد المحاولة أو اضغط إلغاء."); return true; }
    sheets.emp.getRange(employee.row, col).setValue(text);
    clearAdminWizard_(chatId);
    sendMessage_(chatId, "✅ تم تحديث بيانات الموظف.");
    sendEmployeeDetailsMessage_(chatId, state.employeeId, sheets); return true;
  }
  clearAdminWizard_(chatId); return false;
}

function deactivateOverlappingAssignments_(sheet, chatId, startDate, endDate) {
  const last = sheet.getLastRow();
  if (last < 2) return;
  const rows = sheet.getRange(2, 1, last - 1, ASSIGNMENT_HEADERS.length).getDisplayValues();
  rows.forEach(function(r, i) {
    if (String(r[0]).trim() !== String(chatId) || String(r[5] || "نشط").trim() !== "نشط") return;
    const oldStart = normalizeDate_(r[2]) || "0000-01-01";
    const oldEnd = normalizeDate_(r[3]) || "9999-12-31";
    const newEnd = endDate || "9999-12-31";
    const overlaps = oldStart <= newEnd && startDate <= oldEnd;
    if (overlaps) sheet.getRange(i + 2, 6).setValue("غير نشط");
  });
}

function assignShiftFromDashboard_(sheets, chatId, shiftId, workDays) {
  if (!findEmployee_(sheets.emp, chatId)) throw new Error("الموظف غير موجود.");
  const shift = getShiftById_(sheets.shifts, shiftId);
  if (!shift) throw new Error("الوردية غير نشطة أو غير موجودة.");
  const days = workDays || "0,1,2,3,4,6";
  return assignShift(chatId, shiftId, today_(), "", days);
}

function showFlexibleDaysPicker_(chatId, messageId, employeeId, daysCsv) {
  const selected = String(daysCsv || "0,1,2,3,4,6").split(",").filter(Boolean).map(Number);
  const names = [{d:6,n:"السبت"},{d:0,n:"الأحد"},{d:1,n:"الإثنين"},{d:2,n:"الثلاثاء"},{d:3,n:"الأربعاء"},{d:4,n:"الخميس"},{d:5,n:"الجمعة"}];
  const rows = [];
  names.forEach(function(x) {
    rows.push([{text:(selected.indexOf(x.d)!==-1?"✅ ":"⬜ ")+x.n,callback_data:"adm|flexday|"+employeeId+"|"+selected.concat([]).filter(function(d){return d!==x.d;}).concat(selected.indexOf(x.d)===-1?[x.d]:[]).sort().join(",")}]);
  });
  rows.push([{text:"📅 كل أيام الأسبوع",callback_data:"adm|flexall|"+employeeId}]);
  rows.push([{text:"💾 حفظ وتعيين الوردية",callback_data:"adm|flexsave|"+employeeId+"|"+selected.sort().join(",")}]);
  rows.push([{text:"⬅️ رجوع لبيانات الموظف",callback_data:"adm|employee|"+employeeId}]);
  editMessageWithKeyboard_(chatId,messageId,"🕒 تعيين وردية بدون ميعاد ثابت\n\nاختر أيام عمل الفني. الأيام المحددة عليها علامة ✅. يمكنك تفعيل الجمعة أو إلغاء أي يوم.\n\nأيام العمل المختارة: "+selected.length,{inline_keyboard:rows});
}

function getEmployeeCurrentAssignment_(sheets, employeeId) {
  const today=today_(), rows=getSheetObjects_(sheets.assignments);
  const matches=rows.filter(function(r){
    if(String(r["Chat ID"]||"").trim()!==String(employeeId)||String(r["الحالة"]||"نشط").trim()!=="نشط")return false;
    const start=normalizeDate_(r["تاريخ البداية"]), end=normalizeDate_(r["تاريخ النهاية"]);
    return (!start||today>=start)&&(!end||today<=end);
  });
  if(!matches.length)return null;
  const r=matches[matches.length-1], shift=getShiftById_(sheets.shifts,String(r["Shift ID"]||""));
  if(!shift)return null;
  const dayNames=["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const days=String(r["أيام العمل"]||"0,1,2,3,4,6").split(",").map(function(x){return dayNames[Number(x.trim())];}).filter(Boolean);
  return {shift:shift,days:days,start:normalizeDate_(r["تاريخ البداية"]),end:normalizeDate_(r["تاريخ النهاية"])};
}
function employeeDeductionStats_(sheets, employeeId, monthKey) {
  const rows=getSheetObjects_(sheets.deductions).filter(function(r){return String(r["Chat ID"]||"").trim()===String(employeeId)&&normalizeDate_(r["تاريخ الواقعة"]).indexOf(monthKey)===0;});
  const approved=rows.filter(function(r){return String(r["الحالة"]||"")==="معتمد";});
  const pending=rows.filter(function(r){return String(r["الحالة"]||"")==="بانتظار اعتماد المدير";});
  return {approved:approved,pending:pending,total:approved.reduce(function(a,r){return a+(Number(r["المبلغ بالجنيه"])||0);},0),pendingTotal:pending.reduce(function(a,r){return a+(Number(r["المبلغ بالجنيه"])||0);},0)};
}
function showEmployeeDetails_(chatId, messageId, employeeId, sheets) {
  const e=findEmployee_(sheets.emp,employeeId);
  if(!e){editMessageWithKeyboard_(chatId,messageId,"الموظف غير موجود.",adminBackKeyboard_());return;}
  const row=sheets.emp.getRange(e.row,1,1,sheets.emp.getLastColumn()).getDisplayValues()[0];
  const assignment=getEmployeeCurrentAssignment_(sheets,employeeId), sh=assignment?assignment.shift:null;
  const status=getEmployeeAccountStatus_(sheets.emp,e.row), monthKey=rewardMonth_();
  const attendance=getSheetObjects_(sheets.att).filter(function(x){return String(x["Chat ID"]||"").trim()===String(employeeId);});
  const monthAttendance=attendance.filter(function(x){return normalizeDate_(x["التاريخ"]).indexOf(monthKey)===0;});
  const lateRows=monthAttendance.filter(function(x){return String(x["حالة الحضور"]||"").trim()==="متأخر"||Number(x["دقائق التأخير"]||0)>0;});
  const lateMinutes=lateRows.reduce(function(sum,x){return sum+(Number(x["دقائق التأخير"])||0);},0);
  const absences=getSheetObjects_(sheets.absences).filter(function(x){return String(x["Chat ID"]||"").trim()===String(employeeId)&&String(x["الحالة"]||"").trim()==="غياب مؤكد"&&normalizeDate_(x["التاريخ"]).indexOf(monthKey)===0;});
  const requests=getSheetObjects_(sheets.req).filter(function(x){return String(x["Chat ID"]||"").trim()===String(employeeId);});
  const pendingRequests=requests.filter(function(x){return String(x["القرار"]||"").trim()==="قيد الانتظار";}).length;
  const lastEvent=attendance.length?attendance[attendance.length-1]:null;
  const lastText=lastEvent?normalizeDate_(lastEvent["التاريخ"])+" "+String(lastEvent["الوقت"]||"")+" — "+String(lastEvent["النوع"]||"") : "لا توجد حركات مسجلة";
  const reward=getRewardMonthlyData_(employeeId,sheets,monthKey), deductions=employeeDeductionStats_(sheets,employeeId,monthKey);
  const shiftText=sh?(sh.isFlexible?"بدون ميعاد ثابت":""+sh.name+" ("+sh.startTime+" - "+sh.endTime+")") : "لا يوجد تعيين نشط";
  const daysText=assignment?assignment.days.join("، "):"—";
  const text="👤 ملف الموظف — "+e.name+"\n━━━━━━━━━━━━━━━━━━\n"+
    "🪪 Chat ID: "+employeeId+"\n💼 الوظيفة: "+(row[2]||"غير محددة")+"\n📞 الهاتف: "+(row[3]||"غير مسجل")+"\n🔐 حالة الحساب: "+status+"\n\n"+
    "🕒 نظام الدوام\n• الوردية: "+shiftText+"\n• أيام العمل: "+daysText+"\n• فترة السماح: "+(sh?sh.graceMinutes+" دقيقة":"—")+"\n• بداية التعيين: "+(assignment.start||"—")+"\n• نهاية التعيين: "+(assignment.end||"مفتوح")+"\n\n"+
    "📊 ملخص الأداء — "+monthKey+"\n• الحركات المسجلة: "+monthAttendance.length+"\n• مرات التأخير: "+lateRows.length+"\n• دقائق التأخير: "+lateMinutes+"\n• الغياب المؤكد: "+absences.length+" يوم/حالة\n• آخر حركة: "+lastText+"\n\n"+
    "🏆 المكافآت\n• نقاط مكتسبة: "+reward.earned+" / "+reward.scoredEligible+" نقطة محسومة\n• تقييمات نظافة معلقة: "+reward.hygienePending+"\n• المكافأة الأساسية التقديرية: "+reward.base.toFixed(2)+" جنيه\n• مكافآت إضافية معتمدة: "+reward.bonus.toFixed(2)+" جنيه\n• إجمالي تقديري: "+reward.total.toFixed(2)+" جنيه\n\n"+
    "💸 الخصومات — "+monthKey+"\n• معتمدة: "+deductions.total.toFixed(2)+" جنيه ("+deductions.approved.length+")\n• معلقة: "+deductions.pendingTotal.toFixed(2)+" جنيه ("+deductions.pending.length+")\n\n"+
    "📨 الطلبات: "+requests.length+" (قيد الانتظار: "+pendingRequests+")";
  const kb={inline_keyboard:[
    [{text:"🏆 تفاصيل المكافآت",callback_data:"adm|emprewards|"+employeeId},{text:"💸 تفاصيل الخصومات",callback_data:"adm|empdeductions|"+employeeId}],
    [{text:"📋 سجل الحضور",callback_data:"adm|emphistory|"+employeeId}],
    [{text:"✏️ تعديل الاسم",callback_data:"adm|empedit|name|"+employeeId}],
    [{text:"✏️ الوظيفة",callback_data:"adm|empedit|job|"+employeeId},{text:"📞 الهاتف",callback_data:"adm|empedit|phone|"+employeeId}],
    [{text:"🕒 تعيين / تغيير الوردية",callback_data:"adm|empshift|"+employeeId}],
    [{text:status==="نشط"?"⛔ إيقاف الحساب":"✅ تفعيل الحساب",callback_data:"adm|emptoggle|"+employeeId},{text:"🔄 تحديث الملف",callback_data:"adm|employee|"+employeeId}],
    [{text:"⬅️ قائمة الموظفين",callback_data:"adm|employees"},{text:"🏠 لوحة الإدارة",callback_data:"adm|home"}]
  ]};
  if(messageId)editMessageWithKeyboard_(chatId,messageId,text,kb);else sendMessage_(chatId,text,kb);
}
function showEmployeeRewardDetails_(chatId,messageId,employeeId,sheets){
  const e=findEmployee_(sheets.emp,employeeId);if(!e){editMessageWithKeyboard_(chatId,messageId,"الموظف غير موجود.",adminBackKeyboard_());return;}
  const d=getRewardMonthlyData_(employeeId,sheets,rewardMonth_());
  const msg="🏆 مكافآت الموظف — "+e.name+"\nالشهر: "+d.month+"\n━━━━━━━━━━━━━━━━━━\n💰 الأساسية: "+d.base.toFixed(2)+" / 500 جنيه\n🎁 الإضافية المعتمدة: "+d.bonus.toFixed(2)+" جنيه\n💵 الإجمالي التقديري: "+d.total.toFixed(2)+" جنيه\n\n⭐ النقاط: "+d.earned+" / "+d.scoredEligible+" محسومة\n🤝 الالتزام: "+d.commitment+"\n🧹 النظافة: "+d.hygienePoints+"\n⏳ تقييمات معلقة: "+d.hygienePending+"\n📅 الورديات المجدولة: "+d.shifts+"\n🚫 المستبعدة بإذن/إجازة: "+d.excluded+"\n\nالنسبة تقديرية وفق الورديات المكتملة والتقييمات المحسومة فقط.";
  const rows=[];
  if(adminCanPerform_(chatId,"rewardhyginee",sheets))rows.push([{text:"🧹 تقييم النظافة",callback_data:"adm|rewardhyginee|"+employeeId}]);
  if(adminCanPerform_(chatId,"rewardbonuse",sheets))rows.push([{text:"🎁 إضافة مكافأة",callback_data:"adm|rewardbonuse|"+employeeId}]);
  rows.push([{text:"⬅️ ملف الموظف",callback_data:"adm|employee|"+employeeId}]);
  editMessageWithKeyboard_(chatId,messageId,msg,{inline_keyboard:rows});
}
function showEmployeeDeductionDetails_(chatId,messageId,employeeId,sheets){
  const e=findEmployee_(sheets.emp,employeeId);if(!e){editMessageWithKeyboard_(chatId,messageId,"الموظف غير موجود.",adminBackKeyboard_());return;}
  const month=rewardMonth_(),rows=getSheetObjects_(sheets.deductions).filter(function(r){return String(r["Chat ID"]||"").trim()===String(employeeId)&&normalizeDate_(r["تاريخ الواقعة"]).indexOf(month)===0;});
  const approved=rows.filter(function(r){return String(r["الحالة"]||"")==="معتمد";}),pending=rows.filter(function(r){return String(r["الحالة"]||"")==="بانتظار اعتماد المدير";});
  let msg="💸 خصومات الموظف — "+e.name+"\nالشهر: "+month+"\n━━━━━━━━━━━━━━━━━━\n";
  if(!rows.length)msg+="لا توجد خصومات مسجلة هذا الشهر.";
  rows.slice(-12).reverse().forEach(function(r){msg+="\n• "+normalizeDate_(r["تاريخ الواقعة"])+" — "+String(r["نوع الخصم"]||"خصم")+"\n  "+Number(r["المبلغ بالجنيه"]||0).toFixed(2)+" جنيه | "+String(r["الحالة"]||"غير محدد")+"\n  "+String(r["السبب"]||"").substring(0,130)+"\n";});
  msg+="\n━━━━━━━━━━━━━━━━━━\n✅ معتمد: "+approved.reduce(function(a,r){return a+(Number(r["المبلغ بالجنيه"])||0);},0).toFixed(2)+" جنيه\n⏳ معلق: "+pending.reduce(function(a,r){return a+(Number(r["المبلغ بالجنيه"])||0);},0).toFixed(2)+" جنيه\nℹ️ الغياب المؤكد يعرض منفصلًا ولا يُضاف هنا كمبلغ.";
  editMessageWithKeyboard_(chatId,messageId,msg,{inline_keyboard:[[{text:"⬅️ ملف الموظف",callback_data:"adm|employee|"+employeeId}]]});
}
function showEmployeeAttendanceHistory_(chatId,messageId,employeeId,sheets){
  const e=findEmployee_(sheets.emp,employeeId);if(!e){editMessageWithKeyboard_(chatId,messageId,"الموظف غير موجود.",adminBackKeyboard_());return;}
  const rows=getSheetObjects_(sheets.att).filter(function(r){return String(r["Chat ID"]||"").trim()===String(employeeId);}).slice(-15).reverse();
  let msg="📋 سجل الحضور — "+e.name+"\nآخر "+rows.length+" حركة\n━━━━━━━━━━━━━━━━━━\n";
  if(!rows.length)msg+="لا توجد حركات مسجلة.";
  rows.forEach(function(r){msg+="\n"+normalizeDate_(r["التاريخ"])+" | "+String(r["الوقت"]||"")+"\n"+String(r["النوع"]||"")+" — "+String(r["حالة الحضور"]||"—")+(Number(r["دقائق التأخير"]||0)>0?" ("+Number(r["دقائق التأخير"])+" دقيقة)":"")+"\n";});
  editMessageWithKeyboard_(chatId,messageId,msg,{inline_keyboard:[[{text:"⬅️ ملف الموظف",callback_data:"adm|employee|"+employeeId}]]});
}

function sendEmployeeDetailsMessage_(chatId, employeeId, sheets) { showEmployeeDetails_(chatId, null, employeeId, sheets); }

function sendEmployeeDirectory_(chatId, sheets, messageId, filter, page, query) {
  filter = filter || "all";
  page = Math.max(0, Number(page) || 0);
  query = String(query || "").trim().toLowerCase();
  const searchKey = "MOBI_EMPLOYEE_SEARCH_" + String(chatId);
  if (query) PropertiesService.getScriptProperties().setProperty(searchKey, query);
  else query = String(PropertiesService.getScriptProperties().getProperty(searchKey) || "").trim().toLowerCase();
  const all = getSheetObjects_(sheets.emp).filter(function(e) { return String(e["Chat ID"] || "").trim(); });
  const filtered = all.filter(function(e) {
    const id = String(e["Chat ID"] || "").trim();
    const name = String(e["اسم الموظف"] || "");
    const phone = String(e["رقم الهاتف"] || "");
    const status = String(e["حالة الحساب"] || "نشط").trim();
    if (filter === "active" && status !== "نشط") return false;
    if (filter === "inactive" && status === "نشط") return false;
    if (query && [id, name, phone].join(" ").toLowerCase().indexOf(query) === -1) return false;
    return true;
  });
  const pageSize = 8, pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, pages - 1);
  const rows = [
    [{text:"➕ إضافة موظف",callback_data:"adm|empadd"},{text:"🔎 بحث",callback_data:"adm|empsearch"}],
    [
      {text:(filter==="all"?"• ":"")+"الكل ("+all.length+")",callback_data:"adm|empfilter|all|0"},
      {text:(filter==="active"?"• ":"")+"نشط",callback_data:"adm|empfilter|active|0"},
      {text:(filter==="inactive"?"• ":"")+"موقوف",callback_data:"adm|empfilter|inactive|0"}
    ]
  ];
  filtered.slice(page*pageSize,(page+1)*pageSize).forEach(function(e) {
    const id=String(e["Chat ID"]||"").trim(), status=String(e["حالة الحساب"]||"نشط").trim();
    rows.push([{text:(status==="نشط"?"🟢 ":"⛔ ")+String(e["اسم الموظف"]||"موظف").substring(0,38)+" · "+String(e["الوظيفة"]||"بدون وظيفة").substring(0,18),callback_data:"adm|employee|"+id}]);
  });
  if (pages > 1) {
    const nav=[];
    if(page>0)nav.push({text:"⬅️ السابق",callback_data:"adm|emppage|"+filter+"|"+(page-1)});
    nav.push({text:"صفحة "+(page+1)+"/"+pages,callback_data:"adm|emppage|"+filter+"|"+page});
    if(page<pages-1)nav.push({text:"التالي ➡️",callback_data:"adm|emppage|"+filter+"|"+(page+1)});
    rows.push(nav);
  }
  rows.push([{text:"🕒 إدارة الورديات",callback_data:"adm|shifts"},{text:"⬅️ شؤون الموظفين",callback_data:"adm|cat_staff"}]);
  const title="👥 مركز إدارة الموظفين\n━━━━━━━━━━━━━━━━━━\nإجمالي الموظفين: "+all.length+"\nالمعروض: "+filtered.length+(query?"\nنتيجة البحث عن: "+query:"")+"\nاختر موظفًا لفتح ملفه وإدارة بياناته ودوامه وأدائه.";
  const markup={inline_keyboard:rows};
  if(messageId)editMessageWithKeyboard_(chatId,messageId,title,markup);else sendMessage_(chatId,title,markup);
}


function cashColumn_(sheet, header) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const index = headers.indexOf(header);
  if (index < 0) throw new Error("عمود غير موجود في ورقة طلبات السحب: " + header);
  return index + 1;
}

function cashSet_(sheet, row, header, value) {
  sheet.getRange(row, cashColumn_(sheet, header)).setValue(value);
}

function cashGet_(sheet, row, header) {
  return sheet.getRange(row, cashColumn_(sheet, header)).getValue();
}

function cashMoney_(value) {
  return Number(value || 0).toLocaleString("en-US", {maximumFractionDigits: 2});
}

function cashEmployeeOpenRows_(chatId, sheets) {
  const rows = getSheetObjects_(sheets.cash);
  const openStatuses = ["تمت الموافقة", "بانتظار صرف العهدة", "تم الصرف", "بانتظار مراجعة التسوية", "بانتظار إرجاع المتبقي", "بانتظار موافقة التعويض", "بانتظار صرف التعويض", "قيد المراجعة"];
  const out = [];
  rows.forEach(function(r, i) {
    const sameEmployee = String(r["Chat ID"] || "").trim() === String(chatId);
    const settlement = String(r["حالة التسوية"] || "").trim();
    const cashStatus = String(r["الحالة"] || "").trim();
    const custody = String(r["حالة العهدة"] || "").trim();
    const notSettled = settlement !== "مغلقة" && custody !== "مغلقة" && cashStatus !== "مرفوض";
    if (sameEmployee && notSettled && openStatuses.indexOf(cashStatus) !== -1) out.push({row:i+2, data:r});
  });
  return out;
}

function startCashSettlement_(chatId, employee, sheets) {
  const open = cashEmployeeOpenRows_(chatId, sheets).filter(function(x) {
    return String(x.data["حالة الصرف"] || "").trim() === "تم الصرف" &&
      !String(x.data["حالة التسوية"] || "").trim();
  });
  if (!open.length) {
    sendMainMenu_(chatId, "📋 لا توجد عهدة مستلمة ومفتوحة للتسوية حاليًا.\n\nإذا كانت الإدارة وافقت على طلبك ولم تسلمك المبلغ بعد، انتظر تأكيد الصرف أولًا.");
    return;
  }
  if (open.length > 1) {
    const items = open.slice().reverse().map(function(x) {
      const label = String(x.data["رقم الطلب"]) + " — " + cashMoney_(x.data["المبلغ المعتمد بالجنيه"] || x.data["المبلغ المطلوب بالجنيه"]) + " ج — " + String(x.data["الغرض"] || "بدون وصف").substring(0, 35);
      return {label:label, row:x.row};
    });
    const flow = {kind:"اختيار تسوية عهدة", items:items, page:0};
    PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify(flow));
    setEmployeeState_(sheets.emp, employee.row, STATE_CASH_SETTLEMENT_PICK);
    sendCashSettlementPage_(chatId, flow);
    return;
  }
  const item = open[0];
  PropertiesService.getScriptProperties().setProperty(requestFlowKey_(chatId), JSON.stringify({kind:"تسوية عهدة", row:item.row}));
  setEmployeeState_(sheets.emp, employee.row, STATE_CASH_SETTLEMENT_AMOUNT);
  promptCashSettlementAmount_(chatId, item.row, sheets);
}

function sendCashSettlementPage_(chatId, flow) {
  const items = flow && Array.isArray(flow.items) ? flow.items : [];
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.max(0, Math.min(totalPages - 1, Number(flow.page || 0)));
  const pageItems = items.slice(page * pageSize, (page + 1) * pageSize);
  const choices = [];
  for (let i = 0; i < pageItems.length; i += 2) {
    choices.push(pageItems.slice(i, i + 2).map(function(x) { return x.label; }));
  }
  const nav = [];
  if (page > 0) nav.push("⬅️ السابق");
  if (page < totalPages - 1) nav.push("➡️ التالي");
  if (nav.length) choices.push(nav);
  choices.push(["❌ إلغاء"]);
  sendChoiceMenu_(chatId, "لديك " + items.length + " عهدة مفتوحة. اختر العهدة المطلوب تسويتها (صفحة " + (page + 1) + " من " + totalPages + "):", choices);
}

function promptCashSettlementAmount_(chatId, row, sheets) {
  const r = sheets.cash.getRange(row, 1, 1, sheets.cash.getLastColumn()).getValues()[0];
  const approved = Number(r[7] || r[4] || 0);
  sendCancelMenu_(chatId,
    "📋 تسوية العهدة المالية\n━━━━━━━━━━━━━━━━━━\n" +
    "🆔 رقم الطلب: " + r[0] + "\n" +
    "💰 المبلغ المستلم: " + cashMoney_(approved) + " جنيه\n" +
    "📝 الغرض: " + (r[5] || "—") + "\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    "اكتب إجمالي المصروفات الفعلية بالجنيه.\nمثال: 400\n\nإذا لم تصرف أي مبلغ، اكتب 0.");
}

function saveCashRequest_(chatId, employee, amount, purpose, sheets) {
  const now = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  const id = "CASH-" + Utilities.formatDate(new Date(), TIME_ZONE, "yyyyMMdd-HHmmss") + "-" + String(chatId).slice(-4);
  const row = sheets.cash.getLastRow() + 1;
  sheets.cash.appendRow([id, now, chatId, employee.name, Number(amount), purpose, "قيد المراجعة", "", "لم يصرف", "", "", "غير مطلوبة بعد", "", now]);
  setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
  const employeeText =
    "💰 تم تسجيل طلب عهدة مالية\n━━━━━━━━━━━━━━━━━━\n" +
    "🆔 رقم الطلب: " + id + "\n👤 الموظف: " + employee.name + "\n" +
    "💵 المبلغ المطلوب: " + cashMoney_(amount) + " جنيه\n📝 الغرض: " + purpose + "\n" +
    "━━━━━━━━━━━━━━━━━━\n⏳ الحالة: بانتظار موافقة الإدارة";
  sendMainMenu_(chatId, employeeText);
  const kb = {inline_keyboard:[
    [{text:"✅ موافقة",callback_data:"adm|cashact|approve|" + row},{text:"❌ رفض",callback_data:"adm|cashact|reject|" + row}],
    [{text:"💸 تسجيل صرف العهدة",callback_data:"adm|cashact|paid|" + row}]
  ]};
  const adminText =
    "💰 طلب عهدة مالية جديد\n━━━━━━━━━━━━━━━━━━\n" +
    "🆔 رقم الطلب: " + id + "\n👤 مقدم الطلب: " + employee.name + "\n" +
    "💵 المبلغ المطلوب: " + cashMoney_(amount) + " جنيه\n📝 الغرض: " + purpose + "\n" +
    "━━━━━━━━━━━━━━━━━━\n⏳ الحالة: بانتظار موافقة الإدارة";
  notifyAdmins_("طلب عهدة مالية جديد", adminText, "cash_request_" + id, kb, "Finance");
}

function saveCashSettlement_(chatId, employee, row, spent, sheets) {
  const sh = sheets.cash;
  if (row < 2 || row > sh.getLastRow()) throw new Error("طلب العهدة غير موجود.");
  const vals = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  const owner = String(vals[2] || "").trim();
  const paidStatus = String(vals[8] || "").trim();
  const priorSettlement = String(cashGet_(sh, row, "حالة التسوية") || "").trim();
  if (owner !== String(chatId) || paidStatus !== "تم الصرف" || priorSettlement) {
    setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
    sendMainMenu_(chatId, "⚠️ لا يمكن تسجيل التسوية لهذا الطلب؛ قد يكون غير مصروف أو تمت تسويته بالفعل.");
    return;
  }
  const approved = Number(vals[7] || vals[4] || 0);
  const refund = Math.max(0, Math.round((approved - spent) * 100) / 100);
  const reimbursement = Math.max(0, Math.round((spent - approved) * 100) / 100);
  const now = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  cashSet_(sh, row, "المصروف الفعلي بالجنيه", spent);
  cashSet_(sh, row, "المبلغ المطلوب إرجاعه بالجنيه", refund);
  cashSet_(sh, row, "المبلغ الإضافي المستحق للموظف بالجنيه", reimbursement);
  cashSet_(sh, row, "تاريخ تقديم التسوية", now);
  cashSet_(sh, row, "تاريخ آخر تحديث", now);
  cashSet_(sh, row, "حالة التسوية", refund > 0 ? "بانتظار إرجاع المتبقي" : reimbursement > 0 ? "بانتظار موافقة التعويض" : "بانتظار مراجعة الإدارة");
  if (reimbursement > 0) cashSet_(sh, row, "حالة التعويض", "بانتظار الموافقة");
  if (refund > 0) cashSet_(sh, row, "حالة العهدة", "بانتظار استرداد المتبقي");
  else cashSet_(sh, row, "حالة العهدة", "قيد مراجعة التسوية");
  setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);

  const resultLine = refund > 0
    ? "💵 المبلغ المطلوب إرجاعه: " + cashMoney_(refund) + " جنيه\n📌 المطلوب: تسليم المتبقي للإدارة وانتظار تأكيد الاستلام."
    : reimbursement > 0
      ? "💸 المبلغ الإضافي الذي دفعته من جيبك: " + cashMoney_(reimbursement) + " جنيه\n📌 المطلوب: انتظار موافقة الإدارة على التعويض."
      : "✅ لا يوجد مبلغ متبقٍ أو مستحق.\n📌 التسوية بانتظار مراجعة الإدارة.";
  const summary = "📊 ملخص تسوية العهدة\n━━━━━━━━━━━━━━━━━━\n" +
    "🆔 رقم الطلب: " + vals[0] + "\n👤 الموظف: " + employee.name + "\n" +
    "💰 المبلغ المعتمد: " + cashMoney_(approved) + " جنيه\n🧾 المصروف الفعلي: " + cashMoney_(spent) + " جنيه\n" +
    "━━━━━━━━━━━━━━━━━━\n" + resultLine + "\n━━━━━━━━━━━━━━━━━━\n⏳ الحالة: " + cashGet_(sh, row, "حالة التسوية");
  sendMainMenu_(chatId, summary);

  let rows;
  if (refund > 0) {
    rows = [[{text:"💵 تأكيد استلام المتبقي",callback_data:"adm|cashact|return|"+row}]];
  } else if (reimbursement > 0) {
    rows = [[{text:"✅ اعتماد التعويض",callback_data:"adm|cashact|reimburseapprove|"+row},{text:"❌ رفض التعويض",callback_data:"adm|cashact|reimbursereject|"+row}]];
  } else {
    rows = [[{text:"✅ اعتماد التسوية وإغلاق العهدة",callback_data:"adm|cashact|settleapprove|"+row}]];
  }
  rows.push([{text:"📋 طلبات العهد والسحوبات",callback_data:"adm|cash"}]);
  notifyAdmins_("تسوية عهدة مقدمة", summary, "cash_settlement_" + String(vals[0]), {inline_keyboard:rows}, "Finance");
}

function saveComplaint_(chatId, employee, type, person, details, sheets) {
  const now = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  const id = "CMP-" + Utilities.formatDate(new Date(), TIME_ZONE, "yyyyMMdd-HHmmss") + "-" + String(chatId).slice(-4);
  const row = sheets.complaints.getLastRow() + 1;
  sheets.complaints.appendRow([id, now, chatId, employee.name, type, person, details, "جديدة", "", now, ""]);

  const employeeSummary =
    "✅ تم استلام شكواك وتسجيلها بنجاح\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    "📌 رقم الشكوى: " + id + "\n" +
    "📂 التصنيف: " + type + "\n" +
    "👤 الشخص المعني: " + (person || "لم يتم تحديد شخص") + "\n" +
    "🕒 تاريخ التقديم: " + now + "\n" +
    "📍 الحالة الحالية: جديدة\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    "📝 تفاصيل الشكوى:\n" + details + "\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    "🔒 تم إرسال الشكوى إلى الإدارة بشكل خاص.\n" +
    "سيتم إخطارك عند تحديث حالتها.";
  setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
  sendMainMenu_(chatId, employeeSummary);

  const adminSummary =
    "📩 شكوى موظف جديدة\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    "🆔 رقم الشكوى: " + id + "\n" +
    "👤 مقدم الشكوى: " + employee.name + "\n" +
    "📂 التصنيف: " + type + "\n" +
    "👥 الشخص المعني: " + (person || "لم يتم تحديد شخص") + "\n" +
    "🕒 تاريخ التقديم: " + now + "\n" +
    "📍 الحالة: جديدة\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    "📝 تفاصيل الشكوى:\n" + details + "\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    "🔐 بيانات الشكوى مخصصة للمدير فقط.";
  const kb = {inline_keyboard:[
    [{text:"💬 الرد على الشكوى",callback_data:"adm|complaintreply|" + row}],
    [{text:"🔵 بدء التحقيق",callback_data:"adm|complaintact|investigate|" + row}],
    [{text:"✅ تم الحل",callback_data:"adm|complaintact|resolved|" + row},{text:"🔒 إغلاق",callback_data:"adm|complaintact|close|" + row}]
  ]};
  notifyAdmins_("شكوى موظف جديدة", adminSummary, "complaint_new_" + id, kb, "Admin");
}

function normalizeNumericInput_(value) {
  return String(value == null ? "" : value)
    .trim()
    .replace(/[٠-٩]/g, function(d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); })
    .replace(/[۰-۹]/g, function(d) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)); })
    .replace(/[٬,،]/g, "")
    .replace(/٫/g, ".")
    .replace(/جنيه|جنيهات|EGP/gi, "")
    .replace(/\s+/g, "");
}

function sendPendingCashRequests_(chatId, sheets) {
  const rows = getSheetObjects_(sheets.cash);
  const pending = [];
  rows.forEach(function(r, i) {
    const status = String(r["الحالة"] || "").trim();
    const settlement = String(r["حالة التسوية"] || "").trim();
    const custody = String(r["حالة العهدة"] || "").trim();
    const payment = String(r["حالة الصرف"] || "").trim();
    if (status === "قيد المراجعة" ||
        (status === "تمت الموافقة" && (payment !== "تم الصرف" || custody !== "مغلقة")) ||
        (settlement && settlement !== "مغلقة") ||
        (["عهدة مفتوحة", "بانتظار استرداد المتبقي", "قيد مراجعة التسوية"].indexOf(custody) !== -1)) {
      pending.push({row:i+2,data:r});
    }
  });
  if (!pending.length) {
    sendMessage_(chatId, "💰 لا توجد طلبات عهد أو تسويات معلقة حاليًا.", adminBackKeyboard_());
    return;
  }
  let heldTotal = 0, refundTotal = 0, reimbursementTotal = 0;
  pending.forEach(function(item) {
    const r = item.data;
    const paid = String(r["حالة الصرف"] || "").trim() === "تم الصرف";
    const approvedAmount = Number(r["المبلغ المعتمد بالجنيه"] || r["المبلغ المطلوب بالجنيه"] || 0);
    const actual = r["المصروف الفعلي بالجنيه"] === "" || r["المصروف الفعلي بالجنيه"] == null ? null : Number(r["المصروف الفعلي بالجنيه"]);
    const custody = String(r["حالة العهدة"] || "").trim();
    if (paid && custody !== "مغلقة") heldTotal += Math.max(0, approvedAmount - (actual === null ? 0 : actual));
    if (String(r["حالة التسوية"] || "") === "بانتظار إرجاع المتبقي") refundTotal += Number(r["المبلغ المطلوب إرجاعه بالجنيه"] || 0);
    if (["بانتظار موافقة التعويض", "بانتظار صرف التعويض"].indexOf(String(r["حالة التسوية"] || "")) !== -1) reimbursementTotal += Number(r["المبلغ الإضافي المستحق للموظف بالجنيه"] || 0);
  });
  sendMessage_(chatId,
    "📊 ملخص العهد والسحوبات المفتوحة\n━━━━━━━━━━━━━━━━━━\n" +
    "📂 الطلبات قيد المتابعة: " + pending.length + "\n" +
    "💰 مبالغ عهدة لم تتم تسويتها: " + cashMoney_(heldTotal) + " جنيه\n" +
    "↩️ مبالغ بانتظار الاسترداد: " + cashMoney_(refundTotal) + " جنيه\n" +
    "💸 تعويضات موظفين معلقة: " + cashMoney_(reimbursementTotal) + " جنيه",
    adminBackKeyboard_());
  pending.slice(-20).reverse().forEach(function(item) {
    const r = item.data, row = item.row;
    const settlement = String(r["حالة التسوية"] || "").trim();
    let actions = [];
    if (String(r["الحالة"] || "") === "قيد المراجعة") {
      actions.push([{text:"✅ موافقة",callback_data:"adm|cashact|approve|"+row},{text:"❌ رفض",callback_data:"adm|cashact|reject|"+row}]);
    } else if (settlement === "بانتظار إرجاع المتبقي") {
      actions.push([{text:"💵 تأكيد استلام المتبقي",callback_data:"adm|cashact|return|"+row}]);
    } else if (settlement === "بانتظار موافقة التعويض") {
      actions.push([{text:"✅ اعتماد التعويض",callback_data:"adm|cashact|reimburseapprove|"+row},{text:"❌ رفض التعويض",callback_data:"adm|cashact|reimbursereject|"+row}]);
    } else if (settlement === "بانتظار صرف التعويض") {
      actions.push([{text:"💸 تأكيد صرف التعويض",callback_data:"adm|cashact|reimbursepaid|"+row}]);
    } else if (settlement === "بانتظار مراجعة الإدارة") {
      actions.push([{text:"✅ اعتماد التسوية وإغلاق العهدة",callback_data:"adm|cashact|settleapprove|"+row}]);
    } else if (String(r["الحالة"] || "") === "تمت الموافقة" && String(r["حالة الصرف"] || "") !== "تم الصرف") {
      actions.push([{text:"💸 تم صرف العهدة",callback_data:"adm|cashact|paid|"+row}]);
    }
    const approved = Number(r["المبلغ المعتمد بالجنيه"] || r["المبلغ المطلوب بالجنيه"] || 0);
    const text = "💰 ملف العهدة المالية\n━━━━━━━━━━━━━━━━━━\n" +
      "🆔 رقم الطلب: " + r["رقم الطلب"] + "\n👤 الموظف: " + r["اسم الموظف"] + "\n" +
      "💵 المطلوب: " + cashMoney_(r["المبلغ المطلوب بالجنيه"]) + " جنيه\n" +
      "✅ المعتمد: " + cashMoney_(approved) + " جنيه\n🧾 المصروف: " + (r["المصروف الفعلي بالجنيه"] === "" || r["المصروف الفعلي بالجنيه"] == null ? "لم يسجل" : cashMoney_(r["المصروف الفعلي بالجنيه"]) + " جنيه") + "\n" +
      "↩️ المطلوب إرجاعه: " + cashMoney_(r["المبلغ المطلوب إرجاعه بالجنيه"]) + " جنيه\n" +
      "💸 مستحق الموظف: " + cashMoney_(r["المبلغ الإضافي المستحق للموظف بالجنيه"]) + " جنيه\n" +
      "━━━━━━━━━━━━━━━━━━\n📌 حالة الطلب: " + (r["الحالة"] || "—") + "\n📍 حالة التسوية: " + (settlement || "لم تبدأ") + "\n📦 حالة الصرف: " + (r["حالة الصرف"] || "—");
    sendMessage_(chatId, text, {inline_keyboard:actions.length ? actions : [[{text:"⬅️ لوحة الإدارة",callback_data:"adm|home"}]]});
  });
  sendMessage_(chatId, "عرض آخر " + Math.min(20, pending.length) + " طلب/تسوية قيد المتابعة.", adminBackKeyboard_());
}

function handleCashCallback_(callback, sheets, parts) {
  const action = parts[2], row = Number(parts[3]);
  if (!Number.isInteger(row) || row < 2 || row > sheets.cash.getLastRow()) { answerCallbackQuery_(callback.id, "رقم الطلب غير صحيح."); return; }
  const sh = sheets.cash;
  const vals = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  const status = String(vals[6] || "").trim(), employeeId = String(vals[2] || "").trim();
  const now = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  const id = String(vals[0] || "");
  const employeeName = String(vals[3] || "الموظف");
  const approved = Number(vals[7] || vals[4] || 0);
  const spent = Number(cashGet_(sh, row, "المصروف الفعلي بالجنيه") || 0);
  const refund = Number(cashGet_(sh, row, "المبلغ المطلوب إرجاعه بالجنيه") || 0);
  const reimbursement = Number(cashGet_(sh, row, "المبلغ الإضافي المستحق للموظف بالجنيه") || 0);
  const settlement = String(cashGet_(sh, row, "حالة التسوية") || "").trim();

  if (action === "approve" || action === "reject") {
    if (status !== "قيد المراجعة") { answerCallbackQuery_(callback.id, "تمت مراجعة الطلب بالفعل."); return; }
    const decision = action === "approve" ? "تمت الموافقة" : "مرفوض";
    sh.getRange(row, 7).setValue(decision);
    if (action === "approve") {
      sh.getRange(row, 8).setValue(Number(vals[4]));
      sh.getRange(row, 12).setValue("بانتظار صرف العهدة");
    }
    cashSet_(sh, row, "تاريخ آخر تحديث", now);
    const actorId = String(callback.from && callback.from.id || "");
    const actorName = getAdminDisplayName_(actorId, sheets);
    const actorIdCol = getColumnByHeader_(sh, "Chat ID آخر مدير قرار");
    const actorNameCol = getColumnByHeader_(sh, "اسم آخر مدير قرار");
    if (actorIdCol) sh.getRange(row, actorIdCol).setValue(actorId);
    if (actorNameCol) sh.getRange(row, actorNameCol).setValue(actorName);
    if (employeeId) sendMessage_(employeeId, action === "approve"
      ? "✅ تمت الموافقة على طلب العهدة\n━━━━━━━━━━━━━━━━━━\n🆔 " + id + "\n💰 المبلغ المعتمد: " + cashMoney_(vals[4]) + " جنيه\n📌 الحالة: بانتظار استلام المبلغ من المسؤول. سيتم تفعيل التسوية بعد تأكيد الصرف."
      : "❌ تم رفض طلب العهدة رقم " + id + ". يمكنك مراجعة الإدارة.");
    answerCallbackQuery_(callback.id, "تم تسجيل القرار.");
    const decisionText = "📌 تم " + (action === "approve" ? "اعتماد" : "رفض") + " طلب العهدة " + id + "\n👤 الموظف: " + employeeName + "\n👨‍💼 القرار بواسطة: " + actorName + " (" + actorId + ")\n🕒 " + now;
    editAdminBroadcastCopies_("cash_request_" + id, decisionText);
    editMessageText_(callback.message.chat.id, callback.message.message_id, decisionText);
    return;
  }
  if (action === "paid") {
    if (status !== "تمت الموافقة" || String(vals[8] || "").trim() === "تم الصرف") { answerCallbackQuery_(callback.id, "لا يمكن تسجيل الصرف؛ تحقق من حالة الطلب."); return; }
    sh.getRange(row, 9).setValue("تم الصرف");
    sh.getRange(row, 10).setValue("المدير");
    sh.getRange(row, 11).setValue(now);
    sh.getRange(row, 12).setValue("عهدة مفتوحة");
    cashSet_(sh, row, "تاريخ آخر تحديث", now);
    if (employeeId) sendMessage_(employeeId, "💸 تم صرف العهدة\n━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: " + id + "\n💰 المبلغ المستلم: " + cashMoney_(approved) + " جنيه\n📌 بعد تنفيذ المشتريات، اختر (💰 تسوية عهدة) من القائمة الرئيسية لتسجيل المصروف الفعلي.");
    answerCallbackQuery_(callback.id, "تم تسجيل صرف العهدة.");
    editMessageText_(callback.message.chat.id, callback.message.message_id, String(callback.message.text || "") + "\n\n💸 حالة الصرف: تم الصرف");
    return;
  }
  if (action === "return") {
    if (settlement !== "بانتظار إرجاع المتبقي" || refund <= 0) { answerCallbackQuery_(callback.id, "لا يوجد مبلغ متبقٍ بانتظار الاستلام."); return; }
    cashSet_(sh, row, "تاريخ تأكيد استلام المتبقي", now);
    cashSet_(sh, row, "المسؤول عن استلام المتبقي", "المدير");
    cashSet_(sh, row, "حالة التسوية", "مغلقة");
    cashSet_(sh, row, "حالة العهدة", "مغلقة");
    cashSet_(sh, row, "تاريخ آخر تحديث", now);
    if (employeeId) sendMessage_(employeeId, "✅ تم تأكيد استلام المتبقي وإغلاق العهدة\n━━━━━━━━━━━━━━━━━━\n🆔 " + id + "\n↩️ المبلغ المسترد: " + cashMoney_(refund) + " جنيه\n🧾 المصروف الفعلي: " + cashMoney_(spent) + " جنيه\n📁 الحالة: مغلقة");
    answerCallbackQuery_(callback.id, "تم تأكيد استلام المتبقي وإغلاق العهدة.");
    editMessageText_(callback.message.chat.id, callback.message.message_id, String(callback.message.text || "") + "\n\n✅ تم تأكيد استلام " + cashMoney_(refund) + " جنيه وإغلاق العهدة.");
    return;
  }
  if (action === "settleapprove") {
    if (settlement !== "بانتظار مراجعة الإدارة" || refund > 0 || reimbursement > 0) { answerCallbackQuery_(callback.id, "التسوية لا تطابق إجراء الإغلاق المباشر."); return; }
    cashSet_(sh, row, "حالة التسوية", "مغلقة");
    cashSet_(sh, row, "حالة العهدة", "مغلقة");
    cashSet_(sh, row, "تاريخ آخر تحديث", now);
    if (employeeId) sendMessage_(employeeId, "✅ تمت مراجعة التسوية وإغلاق العهدة رقم " + id + ".\n💰 المعتمد: " + cashMoney_(approved) + " جنيه\n🧾 المصروف: " + cashMoney_(spent) + " جنيه.");
    answerCallbackQuery_(callback.id, "تم اعتماد التسوية وإغلاق العهدة.");
    editMessageText_(callback.message.chat.id, callback.message.message_id, String(callback.message.text || "") + "\n\n📁 التسوية معتمدة والعهدة مغلقة.");
    return;
  }
  if (action === "reimburseapprove") {
    if (settlement !== "بانتظار موافقة التعويض" || reimbursement <= 0) { answerCallbackQuery_(callback.id, "لا يوجد تعويض بانتظار الاعتماد."); return; }
    cashSet_(sh, row, "حالة التعويض", "معتمد - بانتظار الصرف");
    cashSet_(sh, row, "تاريخ اعتماد التعويض", now);
    cashSet_(sh, row, "حالة التسوية", "بانتظار صرف التعويض");
    cashSet_(sh, row, "تاريخ آخر تحديث", now);
    if (employeeId) sendMessage_(employeeId, "✅ وافقت الإدارة على تعويضك عن العهدة " + id + ".\n💸 المبلغ المعتمد للتعويض: " + cashMoney_(reimbursement) + " جنيه.\n⏳ بانتظار صرف المبلغ.");
    answerCallbackQuery_(callback.id, "تم اعتماد التعويض.");
    editMessageWithKeyboard_(callback.message.chat.id, callback.message.message_id, String(callback.message.text || "") + "\n\n✅ تم اعتماد التعويض: " + cashMoney_(reimbursement) + " جنيه.", {inline_keyboard:[[{text:"💸 تأكيد صرف التعويض",callback_data:"adm|cashact|reimbursepaid|"+row}]]});
    return;
  }
  if (action === "reimbursereject") {
    if (settlement !== "بانتظار موافقة التعويض" || reimbursement <= 0) { answerCallbackQuery_(callback.id, "لا يوجد تعويض بانتظار القرار."); return; }
    cashSet_(sh, row, "حالة التعويض", "مرفوض");
    cashSet_(sh, row, "ملاحظات التسوية", "رفضت الإدارة التعويض");
    cashSet_(sh, row, "حالة التسوية", "مغلقة");
    cashSet_(sh, row, "حالة العهدة", "مغلقة");
    cashSet_(sh, row, "تاريخ آخر تحديث", now);
    if (employeeId) sendMessage_(employeeId, "❌ رفضت الإدارة طلب التعويض عن العهدة " + id + ".\nالمبلغ الإضافي المسجل: " + cashMoney_(reimbursement) + " جنيه.\nيرجى مراجعة الإدارة إذا كنت ترغب في مناقشة القرار.");
    answerCallbackQuery_(callback.id, "تم رفض التعويض وإغلاق التسوية.");
    editMessageText_(callback.message.chat.id, callback.message.message_id, String(callback.message.text || "") + "\n\n❌ تم رفض التعويض وإغلاق التسوية.");
    return;
  }
  if (action === "reimbursepaid") {
    if (settlement !== "بانتظار صرف التعويض" || String(cashGet_(sh, row, "حالة التعويض") || "") !== "معتمد - بانتظار الصرف") { answerCallbackQuery_(callback.id, "يجب اعتماد التعويض أولًا."); return; }
    cashSet_(sh, row, "حالة التعويض", "تم الصرف");
    cashSet_(sh, row, "تاريخ صرف التعويض", now);
    cashSet_(sh, row, "حالة التسوية", "مغلقة");
    cashSet_(sh, row, "حالة العهدة", "مغلقة");
    cashSet_(sh, row, "تاريخ آخر تحديث", now);
    if (employeeId) sendMessage_(employeeId, "💸 تم صرف تعويضك وإغلاق العهدة رقم " + id + ".\nالمبلغ المصروف: " + cashMoney_(reimbursement) + " جنيه.");
    answerCallbackQuery_(callback.id, "تم تسجيل صرف التعويض وإغلاق العهدة.");
    editMessageText_(callback.message.chat.id, callback.message.message_id, String(callback.message.text || "") + "\n\n📁 تم صرف التعويض وإغلاق العهدة.");
    return;
  }
  answerCallbackQuery_(callback.id, "إجراء غير معروف.");
}

function complaintReplyKey_(chatId) { return "MOBI_COMPLAINT_REPLY_" + String(chatId); }
function getComplaintRowByNumber_(sheets, row) {
  if (!Number.isInteger(row) || row < 2 || row > sheets.complaints.getLastRow()) return null;
  const values = sheets.complaints.getRange(row, 1, 1, COMPLAINT_HEADERS.length).getValues()[0];
  return { row: row, values: values, id: String(values[0] || ""), employeeId: String(values[2] || ""), employeeName: String(values[3] || ""), status: String(values[7] || "").trim() };
}
function appendComplaintMessage_(sheets, complaint, senderId, senderRole, senderName, message) {
  const now = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  const messageId = "MSG-" + Utilities.getUuid();
  sheets.complaintMessages.appendRow([messageId, complaint.id, String(senderId), senderRole, senderName || "", message, now]);
  sheets.complaints.getRange(complaint.row, 10).setValue(now);
  return now;
}
function getComplaintConversation_(sheets, complaintId, limit) {
  const rows = getSheetObjects_(sheets.complaintMessages);
  return rows.filter(function(r) { return String(r["رقم الشكوى"] || "") === String(complaintId); }).slice(-(limit || 15));
}
function formatComplaintConversation_(sheets, complaint) {
  const v = complaint.values;
  const messages = getComplaintConversation_(sheets, complaint.id, 15);
  let out = "📩 الشكوى " + complaint.id + "\n👤 " + complaint.employeeName + "\n📍 الحالة: " + complaint.status + "\n━━━━━━━━━━━━━━━━━━\n📝 أصل الشكوى:\n" + String(v[6] || "") + "\n";
  if (messages.length) {
    out += "\n💬 المحادثة:\n";
    messages.forEach(function(m) { out += "\n" + (m["صفة المرسل"] === "مدير" ? "🛡️ الإدارة" : "👤 " + (m["اسم المرسل"] || "الموظف")) + " — " + m["التاريخ والوقت"] + "\n" + m["نص الرسالة"] + "\n"; });
  } else {
    out += "\nلا توجد ردود حتى الآن.\n";
  }
  return out.slice(0, 3900);
}
function sendEmployeeComplaints_(chatId, sheets) {
  const all = getSheetObjects_(sheets.complaints);
  const own = [];
  all.forEach(function(r, i) { if (String(r["Chat ID"] || "") === String(chatId)) own.push({row:i+2, values:sheets.complaints.getRange(i+2,1,1,COMPLAINT_HEADERS.length).getValues()[0], id:String(r["رقم الشكوى"]||""), employeeId:String(chatId), employeeName:String(r["اسم الموظف"]||""), status:String(r["الحالة"]||"").trim()}); });
  if (!own.length) { sendMessage_(chatId, "📨 لا توجد شكاوى مسجلة باسمك حتى الآن."); return; }
  own.slice(-10).reverse().forEach(function(c) {
    const kb = {inline_keyboard: c.status === "مغلقة" ? [] : [[{text:"💬 فتح المحادثة والرد",callback_data:"cmp|reply|"+c.row}]]};
    sendMessage_(chatId, formatComplaintConversation_(sheets, c), kb);
  });
}
function startComplaintReply_(chatId, row, sheets, isAdmin) {
  const c = getComplaintRowByNumber_(sheets, row);
  if (!c) { sendMessage_(chatId, "⚠️ الشكوى غير موجودة."); return false; }
  if (c.status === "مغلقة") { sendMessage_(chatId, "🔒 هذه الشكوى مغلقة ولا يمكن إضافة رد جديد."); return false; }
  sendMessage_(chatId, formatComplaintConversation_(sheets, c));
  PropertiesService.getScriptProperties().setProperty(complaintReplyKey_(chatId), JSON.stringify({row:row, complaintId:c.id, role:isAdmin?"مدير":"موظف"}));
  sendMessage_(chatId, "💬 اكتب ردك على الشكوى " + c.id + " في رسالة واحدة.\nسيتم إضافته إلى نفس المحادثة وإخطار الطرف الآخر.\n\nللإلغاء أرسل: ❌ إلغاء");
  return true;
}
function handleEmployeeComplaintCallback_(callback, sheets, parts) {
  const actorId = String(callback.from && callback.from.id || "");
  const row = Number(parts[2]);
  const c = getComplaintRowByNumber_(sheets, row);
  if (!c || c.employeeId !== actorId) { answerCallbackQuery_(callback.id, "هذه الشكوى غير مرتبطة بحسابك."); return; }
  if (parts[1] !== "reply") { answerCallbackQuery_(callback.id, "إجراء غير معروف."); return; }
  if (startComplaintReply_(actorId, row, sheets, false)) answerCallbackQuery_(callback.id, "اكتب ردك في رسالة منفصلة.");
}
function handleComplaintReplyText_(chatId, text, sheets, isAdmin) {
  const props = PropertiesService.getScriptProperties();
  const key = complaintReplyKey_(chatId);
  const raw = props.getProperty(key);
  if (!raw) return false;
  if (text === "❌ إلغاء" || text === "/cancel") { props.deleteProperty(key); sendMessage_(chatId, "تم إلغاء الرد."); return true; }
  if (!text || text.trim().length < 2) { sendMessage_(chatId, "اكتب ردًا أوضح، أو أرسل ❌ إلغاء."); return true; }
  let flow; try { flow = JSON.parse(raw); } catch (e) { props.deleteProperty(key); sendMessage_(chatId, "انتهت جلسة الرد. افتح الشكوى مرة أخرى."); return true; }
  const c = getComplaintRowByNumber_(sheets, Number(flow.row));
  if (!c || c.id !== String(flow.complaintId) || c.status === "مغلقة") { props.deleteProperty(key); sendMessage_(chatId, "تعذر إضافة الرد؛ الشكوى غير متاحة أو مغلقة."); return true; }
  if ((flow.role === "مدير") !== !!isAdmin || (isAdmin && !adminCanPerform_(chatId, "complaints", sheets)) || (!isAdmin && c.employeeId !== String(chatId))) { props.deleteProperty(key); sendMessage_(chatId, "⛔ غير مصرح بإضافة رد على هذه الشكوى."); return true; }
  const senderName = isAdmin ? (getAdminDisplayName_(chatId, sheets) || "الإدارة") : c.employeeName;
  const now = appendComplaintMessage_(sheets, c, chatId, flow.role, senderName, text.trim());
  const nextStatus = isAdmin ? "بانتظار رد الموظف" : "بانتظار رد الإدارة";
  sheets.complaints.getRange(c.row, 8).setValue(nextStatus);
  props.deleteProperty(key);
  const recipient = isAdmin ? c.employeeId : "";
  const notice = "💬 رد جديد على الشكوى " + c.id + "\n👤 " + senderName + "\n🕒 " + now + "\n\n" + text.trim();
  if (recipient) sendMessage_(recipient, notice, {inline_keyboard:[[ {text:"📨 فتح شكاويي",callback_data:"cmp|reply|"+c.row} ]]});
  else notifyAdmins_("رد جديد على شكوى", notice, "complaint_message_" + c.id + "_" + now, {inline_keyboard:[[ {text:"💬 الرد على الشكوى",callback_data:"adm|complaintreply|"+c.row} ]]}, "Admin");
  sendMessage_(chatId, "✅ تم إضافة ردك إلى المحادثة بنجاح.");
  return true;
}

function sendOpenComplaints_(chatId, sheets) {
  const rows=getSheetObjects_(sheets.complaints);
  const open=[];
  rows.forEach(function(r,i){if(["جديدة","قيد التحقيق","بانتظار رد الإدارة","بانتظار رد الموظف","تم الحل"].indexOf(String(r["الحالة"]||"").trim())!==-1)open.push({row:i+2,data:r});});
  if(!open.length){sendMessage_(chatId,"📩 لا توجد شكاوى مفتوحة حاليًا.",adminBackKeyboard_());return;}
  open.slice(-15).reverse().forEach(function(item){
    const r=item.data,row=item.row;
    const kb={inline_keyboard:[
      [{text:"💬 فتح المحادثة والرد",callback_data:"adm|complaintreply|"+row}],
      [{text:"🔵 قيد التحقيق",callback_data:"adm|complaintact|investigate|"+row}],
      [{text:"✅ تم الحل",callback_data:"adm|complaintact|resolved|"+row},{text:"🔒 إغلاق",callback_data:"adm|complaintact|close|"+row}]
    ]};
    const complaintCard =
      "📩 تفاصيل شكوى موظف — سرية\n" +
      "━━━━━━━━━━━━━━━━━━\n" +
      "🆔 رقم الشكوى: " + r["رقم الشكوى"] + "\n" +
      "👤 الموظف: " + r["اسم الموظف"] + "\n" +
      "📂 التصنيف: " + r["نوع الشكوى"] + "\n" +
      "👥 الشخص المعني: " + (r["الشخص المعني"] || "لم يتم تحديد شخص") + "\n" +
      "🕒 تاريخ التقديم: " + r["التاريخ والوقت"] + "\n" +
      "📍 الحالة: " + r["الحالة"] + "\n" +
      "━━━━━━━━━━━━━━━━━━\n" +
      "📝 تفاصيل الشكوى:\n" + r["تفاصيل الشكوى"] + "\n" +
      "━━━━━━━━━━━━━━━━━━";
    sendMessage_(chatId, complaintCard, kb);
  });
  sendMessage_(chatId,"عرض آخر "+Math.min(15,open.length)+" شكاوى مفتوحة.",adminBackKeyboard_());
}

function handleComplaintCallback_(callback, sheets, parts) {
  const action=parts[2], row=Number(parts[3]);
  if(!Number.isInteger(row)||row<2||row>sheets.complaints.getLastRow()){answerCallbackQuery_(callback.id,"رقم الشكوى غير صحيح.");return;}
  const sh=sheets.complaints, vals=sh.getRange(row,1,1,COMPLAINT_HEADERS.length).getValues()[0];
  const status=String(vals[7]||"").trim(), employeeId=String(vals[2]||"").trim();
  const now=Utilities.formatDate(new Date(),TIME_ZONE,"yyyy-MM-dd HH:mm:ss");
  let next="", message="";
  if(action==="investigate" && status==="جديدة"){next="قيد التحقيق";message="🔵 شكواك قيد المراجعة والتحقيق من الإدارة.";}
  else if(action==="resolved" && ["جديدة","قيد التحقيق","بانتظار رد الإدارة","بانتظار رد الموظف"].indexOf(status)!==-1){next="تم الحل";message="✅ أفادت الإدارة بأنه تم التعامل مع شكواك وحلها.";}
  else if(action==="close" && ["جديدة","قيد التحقيق","بانتظار رد الإدارة","بانتظار رد الموظف","تم الحل"].indexOf(status)!==-1){next="مغلقة";message="🔒 تم إغلاق الشكوى من الإدارة.";}
  else {answerCallbackQuery_(callback.id,"لا يمكن تغيير حالة الشكوى بهذا الإجراء.");return;}
  sh.getRange(row,8).setValue(next);
  sh.getRange(row,10).setValue(now);
  sh.getRange(row,11).setValue(message);
  if(employeeId) sendMessage_(employeeId,message+"\nرقم الشكوى: "+vals[0]);
  answerCallbackQuery_(callback.id,"تم تحديث حالة الشكوى.");
  editMessageText_(callback.message.chat.id,callback.message.message_id,String(callback.message.text||"")+"\n\n📌 الحالة الجديدة: "+next);
}

function sendPendingRequests_(chatId, sheets) {
  const requests = getSheetObjects_(sheets.req);
  const pending = [];
  requests.forEach(function(r, index) {
    if (String(r["القرار"] || "").trim() === "قيد الانتظار") pending.push({ row: index + 2, data: r });
  });
  if (!pending.length) {
    sendMessage_(chatId, "📥 لا توجد طلبات موظفين معلقة حاليًا.", adminBackKeyboard_());
    return;
  }
  pending.slice(-15).reverse().forEach(function(item) {
    const r = item.data;
    sendAdminRequestWithButtons_(chatId, item.row, r["نوع الطلب"], r["اسم الموظف"], r["التفاصيل"]);
  });
  sendMessage_(chatId, "📥 عرض آخر " + Math.min(15, pending.length) + " طلبات معلقة.", adminBackKeyboard_());
}

function getShiftRowById_(sheet, shiftId) {
  var last=sheet.getLastRow(); if(last<2)return 0;
  var vals=sheet.getRange(2,1,last-1,SHIFT_HEADERS.length).getDisplayValues();
  for(var i=0;i<vals.length;i++)if(String(vals[i][0]).trim()===String(shiftId))return i+2;
  return 0;
}
function startShiftWizard_(chatId) {
  setAdminWizard_(chatId, {step:"shift_add_id"});
  sendMessage_(chatId, "➕ إضافة وردية\n\nأرسل معرّفًا فريدًا للوردية (مثال MORNING):", {keyboard:[[{text:"❌ إلغاء"}]],resize_keyboard:true,one_time_keyboard:true});
}
function startShiftEditWizard_(chatId, shiftId, sheets) {
  var row=getShiftRowById_(sheets.shifts,shiftId);
  if(!row){sendMessage_(chatId,"الوردية غير موجودة.");return;}
  var r=sheets.shifts.getRange(row,1,1,SHIFT_HEADERS.length).getDisplayValues()[0];
  var flex=String(shiftId)===FLEX_SHIFT_ID;
  var opts=flex?[{text:"تعديل الاسم",callback_data:"adm|shiftfield|"+shiftId+"|name"},{text:"تعديل فترة السماح",callback_data:"adm|shiftfield|"+shiftId+"|grace"}]:[{text:"تعديل الاسم",callback_data:"adm|shiftfield|"+shiftId+"|name"},{text:"موعد الحضور",callback_data:"adm|shiftfield|"+shiftId+"|start"},{text:"موعد الانصراف",callback_data:"adm|shiftfield|"+shiftId+"|end"},{text:"فترة السماح",callback_data:"adm|shiftfield|"+shiftId+"|grace"}];
  var rows=[];for(var i=0;i<opts.length;i+=2)rows.push(opts.slice(i,i+2));
  rows.push([{text:"⬅️ رجوع",callback_data:"adm|shifts"}]);
  sendMessage_(chatId,"✏️ تعديل الوردية: "+r[1]+"\n\nاختر الحقل المطلوب تعديله:",{inline_keyboard:rows});
}
function sendShiftDetails_(chatId,shiftId,sheets){
  var row=getShiftRowById_(sheets.shifts,shiftId);if(!row){sendMessage_(chatId,"الوردية غير موجودة.");return;}
  var r=sheets.shifts.getRange(row,1,1,SHIFT_HEADERS.length).getDisplayValues()[0];
  var count=getSheetObjects_(sheets.assignments).filter(function(a){return String(a["Shift ID"]).trim()===String(shiftId)&&String(a["الحالة"]||"نشط").trim()==="نشط";}).length;
  var msg="🕒 تفاصيل الوردية\n\nالمعرّف: "+r[0]+"\nالاسم: "+r[1]+"\nالحضور: "+(r[2]||"بدون موعد")+"\nالانصراف: "+(r[3]||"بدون موعد")+"\nالسماح: "+r[4]+" دقيقة\nالحالة: "+r[5]+"\nالتعيينات النشطة: "+count;
  sendMessage_(chatId,msg,{inline_keyboard:[[{text:"✏️ تعديل",callback_data:"adm|shiftedit|"+shiftId},{text:(r[5]==="نشط"?"⛔ إيقاف":"✅ تفعيل"),callback_data:"adm|shifttoggle|"+shiftId}],[{text:"⬅️ قائمة الورديات",callback_data:"adm|shifts"}]]});
}
function toggleShiftStatus_(chatId,messageId,shiftId,sheets){
  var row=getShiftRowById_(sheets.shifts,shiftId);if(!row){sendMessage_(chatId,"الوردية غير موجودة.");return;}
  var current=String(sheets.shifts.getRange(row,6).getDisplayValue()||"نشط").trim(),next=current==="نشط"?"غير نشط":"نشط";
  if(next==="غير نشط"){
    var assigned=getSheetObjects_(sheets.assignments).some(function(a){return String(a["Shift ID"]).trim()===shiftId&&String(a["الحالة"]||"نشط").trim()==="نشط"&&(!normalizeDate_(a["تاريخ النهاية"])||normalizeDate_(a["تاريخ النهاية"])>=today_());});
    if(assigned){sendMessage_(chatId,"⚠️ لا يمكن إيقاف الوردية لأنها مرتبطة بتعيينات نشطة. غيّر ورديات الموظفين أولًا.");return;}
  }
  sheets.shifts.getRange(row,6).setValue(next);sendShiftDetails_(chatId,shiftId,sheets);
}
function sendShiftDirectory_(chatId, sheets) {
  var shifts=getSheetObjects_(sheets.shifts),allAssignments=getSheetObjects_(sheets.assignments),msg="🕒 مركز إدارة الورديات\n\n";
  if(!shifts.length)msg+="لا توجد ورديات مسجلة.\n";
  shifts.forEach(function(s){var id=String(s["Shift ID"]||""),active=String(s["الحالة"]||"نشط").trim()==="نشط";var count=allAssignments.filter(function(a){return String(a["Shift ID"]).trim()===id&&String(a["الحالة"]||"نشط").trim()==="نشط"&&(!normalizeDate_(a["تاريخ النهاية"])||normalizeDate_(a["تاريخ النهاية"])>=today_());}).length;msg+=(active?"🟢 ":"⚪ ")+String(s["اسم الوردية"]||id)+" — "+(id===FLEX_SHIFT_ID?"بدون موعد ثابت":String(s["موعد الحضور"]||"")+" إلى "+String(s["موعد الانصراف"]||""))+"\n👥 التعيينات النشطة: "+count+"\n";});
  var rows=shifts.map(function(s){return [{text:(String(s["الحالة"]||"نشط")==="نشط"?"🟢 ":"⚪ ")+String(s["اسم الوردية"]||s["Shift ID"]).substring(0,35),callback_data:"adm|shiftedit|"+String(s["Shift ID"])}];});
  rows.push([{text:"➕ إضافة وردية",callback_data:"adm|shiftadd"}]);rows.push([{text:"⬅️ شؤون الموظفين",callback_data:"adm|cat_staff"}]);
  sendMessage_(chatId,msg,{inline_keyboard:rows});
}

function sendMonthlyReport_(chatId, sheets) {
  const month = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM");
  const rows = sheets.att.getLastRow() >= 2
    ? sheets.att.getRange(2, 1, sheets.att.getLastRow() - 1, Math.max(12, sheets.att.getLastColumn())).getDisplayValues()
    : [];
  const monthRows = rows.filter(function(r) { return String(r[0] || "").indexOf(month) === 0; });
  const checkins = monthRows.filter(function(r) { return String(r[4]).trim() === "حضور"; });
  const checkouts = monthRows.filter(function(r) { return String(r[4]).trim() === "انصراف"; });
  const late = checkins.filter(function(r) { return Number(r[10] || 0) > 0; });
  const confirmedAbsences = getSheetObjects_(sheets.absences).filter(function(r) {
    return String(r["التاريخ"] || "").indexOf(month) === 0 && String(r["الحالة"] || "").trim() === "غياب مؤكد";
  });
  sendMessage_(chatId, "📈 التقرير الشهري — " + month + "\n\n" +
    "✅ مرات تسجيل الحضور: " + checkins.length + "\n" +
    "🚪 مرات تسجيل الانصراف: " + checkouts.length + "\n" +
    "⏰ مرات التأخير: " + late.length + "\n" +
    "⌛ إجمالي دقائق التأخير بعد السماح: " + late.reduce(function(sum, r) { return sum + Number(r[10] || 0); }, 0) + "\n" +
    "❌ حالات الغياب المؤكدة: " + confirmedAbsences.length, adminBackKeyboard_());
}


function sendDailyOperationsBoard_(chatId, messageId, sheets) {
  const date = today_();
  const yesterday = addDaysIsoV19_(date, -1);
  const employees = getSheetObjects_(sheets.emp).filter(function(r) {
    return String(r["حالة الحساب"] || "نشط").trim() === "نشط";
  });
  const attendanceRows = sheets.att.getLastRow() >= 2
    ? sheets.att.getRange(2, 1, sheets.att.getLastRow() - 1, Math.max(13, sheets.att.getLastColumn())).getDisplayValues()
    : [];
  const latest = {};
  attendanceRows.forEach(function(r) {
    const id = String(r[2] || "").trim();
    const d = normalizeDate_(r[0]);
    if (!id || (d !== date && d !== yesterday)) return;
    const stamp = d + " " + normalizeTime_(r[1]);
    if (!latest[id] || stamp > latest[id].stamp) {
      latest[id] = {name:String(r[3] || ""), type:String(r[4] || "").trim(),
        time:normalizeTime_(r[1]), date:d, stamp:stamp,
        status:String(r[9] || ""), late:Number(r[10] || 0)};
    }
  });
  const open = [];
  const checkedOut = [];
  const late = [];
  const notStarted = [];
  const nowMinutes = timeToMinutes_(Utilities.formatDate(new Date(), TIME_ZONE, "HH:mm"));
  employees.forEach(function(emp) {
    const id = String(emp["Chat ID"] || "").trim();
    const item = latest[id];
    if (item && item.type === "حضور") {
      const nightCarry = item.date === yesterday;
      if (!nightCarry || isEmployeeOnOvernightShiftNow_(sheets, id, item.date, nowMinutes)) {
        open.push({name:emp["اسم الموظف"] || item.name, time:item.time, date:item.date});
      }
      if (item.date === date && item.late > 0) late.push({name:emp["اسم الموظف"] || item.name, minutes:item.late});
    } else if (item && item.date === date && item.type === "انصراف") {
      checkedOut.push({name:emp["اسم الموظف"] || item.name, time:item.time});
    } else {
      const assignment = getAssignmentForDate_(sheets.assignments, id, date);
      const shift = assignment ? getShiftById_(sheets.shifts, assignment.shiftId) : null;
      if (shift && !shift.isFlexible) {
        const start = timeToMinutes_(shift.startTime);
        const grace = Number(shift.graceMinutes || GRACE_MINUTES_DEFAULT);
        if (nowMinutes > start + grace && nowMinutes < timeToMinutes_(shift.endTime)) {
          notStarted.push({name:emp["اسم الموظف"] || "", start:shift.startTime});
        }
      }
    }
  });
  const pendingAbsences = getSheetObjects_(sheets.absences).filter(function(r) {
    return normalizeDate_(r["التاريخ"]) === date &&
      String(r["الحالة"] || "").trim() === "بانتظار مراجعة المدير";
  });
  const pendingLeaves = getSheetObjects_(sheets.leaves).filter(function(r) {
    return String(r["الحالة"] || "").trim() === "قيد الانتظار";
  });
  const fmt = function(list, fn) {
    return list.length ? list.slice(0, 12).map(fn).join("\n") : "لا توجد حالات.";
  };
  let body = "📋 لوحة المتابعة اليومية — MobiHub\n📅 " + date +
    "\n━━━━━━━━━━━━━━━━━━\n" +
    "👥 الموظفون النشطون: " + employees.length +
    "\n🟢 حضور مفتوح: " + open.length +
    "\n🔴 سجلوا الانصراف: " + checkedOut.length +
    "\n⏰ متأخرون: " + late.length +
    "\n⚠️ لم يسجلوا حضورًا بعد موعد البداية والسماح: " + notStarted.length +
    "\n❗ غياب بانتظار مراجعتك: " + pendingAbsences.length +
    "\n📝 أذونات معلقة: " + pendingLeaves.length +
    "\n━━━━━━━━━━━━━━━━━━\n🟢 الحضور المفتوح\n" +
    fmt(open, function(x){return "• " + x.name + " — " + x.time + (x.date===yesterday ? " (وردية ليلية من أمس)" : "");}) +
    "\n\n⏰ التأخير المسجل\n" +
    fmt(late, function(x){return "• " + x.name + " — " + x.minutes + " دقيقة";}) +
    "\n\n⚠️ لم يسجلوا حضورًا بعد موعد الوردية\n" +
    fmt(notStarted, function(x){return "• " + x.name + " — موعده " + x.start;}) +
    "\n\nتنبيه: قائمة عدم التسجيل مؤشر متابعة فقط وليست إثبات غياب. اعتماد الغياب يتم من مراجعة الغياب.";
  const keyboard = {inline_keyboard:[
    [{text:"🟢 الموجودون الآن",callback_data:"adm|current"},{text:"⚠️ مراجعة الغياب",callback_data:"adm|absences"}],
    [{text:"📊 التقرير اليومي",callback_data:"adm|today"},{text:"⏳ مراجعة الأذونات",callback_data:"adm|leaves"}],
    [{text:"🔄 تحديث اللوحة",callback_data:"adm|dailyboard"},{text:"⬅️ رجوع للمتابعة اليومية",callback_data:"adm|cat_daily"}]
  ]};
  if (messageId) editMessageWithKeyboard_(chatId, messageId, body, keyboard);
  else sendMessage_(chatId, body, keyboard);
}

function isEmployeeOnOvernightShiftNow_(sheets, chatId, shiftDate, nowMinutes) {
  const assignment = getAssignmentForDate_(sheets.assignments, chatId, shiftDate);
  const shift = assignment ? getShiftById_(sheets.shifts, assignment.shiftId) : null;
  if (!shift || shift.isFlexible) return false;
  return timeToMinutes_(shift.endTime) <= timeToMinutes_(shift.startTime) &&
    nowMinutes <= timeToMinutes_(shift.endTime);
}

function sendCurrentEmployees_(chatId, sheets) {
  const today = today_();
  const yesterday = addDaysIsoV19_(today, -1);
  const lastRow = sheets.att.getLastRow();
  const rows = lastRow >= 2
    ? sheets.att.getRange(2, 1, lastRow - 1, Math.max(13, sheets.att.getLastColumn())).getDisplayValues()
    : [];
  const latest = {};
  rows.forEach(function(row) {
    const id = String(row[2] || "").trim();
    if (!id) return;
    const date = normalizeDate_(row[0]);
    if (date !== today && date !== yesterday) return;
    const current = latest[id];
    const stamp = date + " " + normalizeTime_(row[1]);
    if (!current || stamp > current.stamp) {
      latest[id] = {name:row[3], type:String(row[4] || "").trim(), time:row[1], date:date, stamp:stamp};
    }
  });
  const open = Object.keys(latest).filter(function(id) {
    const item = latest[id];
    if (item.type !== "حضور") return false;
    if (item.date === today) return true;
    const assignment = getAssignmentForDate_(sheets.assignments, id, yesterday);
    const shift = assignment ? getShiftById_(sheets.shifts, assignment.shiftId) : null;
    if (!shift) return false;
    return timeToMinutes_(shift.endTime) <= timeToMinutes_(shift.startTime) &&
      timeToMinutes_(Utilities.formatDate(new Date(), TIME_ZONE, "HH:mm")) <= timeToMinutes_(shift.endTime);
  });
  let message = "👥 المهندسون الموجودون الآن حسب آخر حركة مسجلة:\n\n";
  if (!open.length) message += "لا توجد حالات حضور مفتوحة حاليًا.";
  else open.forEach(function(id) {
    const item = latest[id];
    message += "🟢 " + item.name + " — حضور " + item.time +
      (item.date === yesterday ? " (وردية ليلية بدأت أمس)" : "") + "\n";
  });
  sendMessage_(chatId, message, adminBackKeyboard_());
}

function sendTodayReport_(chatId, sheets, dedupeKey) {
  const date = today_();
  const rows = sheets.att.getLastRow() >= 2
    ? sheets.att.getRange(2, 1, sheets.att.getLastRow() - 1, Math.max(12, sheets.att.getLastColumn())).getDisplayValues()
    : [];
  const todayRows = rows.filter(function(row) { return String(row[0]).trim() === date; });
  const checkins = todayRows.filter(function(row) { return String(row[4]).trim() === "حضور"; });
  const checkouts = todayRows.filter(function(row) { return String(row[4]).trim() === "انصراف"; });
  const late = checkins.filter(function(row) { return Number(row[10] || 0) > 0; });
  const pendingAbsences = getSheetObjects_(sheets.absences).filter(function(row) {
    return normalizeDate_(row["التاريخ"]) === date && String(row["الحالة"]).trim() === "بانتظار مراجعة المدير";
  });
  const pendingRequests = getSheetObjects_(sheets.req).filter(function(row) { return String(row["القرار"] || "").trim() === "قيد الانتظار"; });
  const openComplaints = getSheetObjects_(sheets.complaints).filter(function(row) {
    return ["تم الحل", "مغلقة", "مرفوضة"].indexOf(String(row["الحالة"] || "").trim()) === -1;
  });
  const cashRows = getSheetObjects_(sheets.cash);
  const openCash = cashRows.filter(function(row) {
    const state = String(row["حالة العهدة"] || row["الحالة"] || "").trim();
    return state && ["مغلقة", "مرفوض", "مرفوضة", "تم الإغلاق"].indexOf(state) === -1;
  });
  const refunds = openCash.reduce(function(sum, row) { return sum + (Number(row["المبلغ المطلوب إرجاعه بالجنيه"]) || 0); }, 0);
  const reimbursements = openCash.reduce(function(sum, row) {
    const status = String(row["حالة التعويض"] || "").trim();
    return sum + (["بانتظار موافقة الإدارة", "معتمد - بانتظار الصرف", "بانتظار الصرف"].indexOf(status) !== -1 ? (Number(row["المبلغ الإضافي المستحق للموظف بالجنيه"]) || 0) : 0);
  }, 0);
  const employees = getSheetObjects_(sheets.emp).filter(function(row) { return String(row["حالة الحساب"] || "نشط").trim() === "نشط"; });
  const message = "📊 التقرير اليومي — MobiHub\n📅 " + date + "\n━━━━━━━━━━━━━━━━━━\n" +
    "👥 الحضور والانصراف\n" +
    "• الموظفون النشطون: " + employees.length + "\n" +
    "• تسجيلات الحضور: " + checkins.length + "\n" +
    "• تسجيلات الانصراف: " + checkouts.length + "\n" +
    "• حالات التأخير: " + late.length + "\n" +
    "• غياب بانتظار المراجعة: " + pendingAbsences.length + "\n\n" +
    "📥 الطلبات والشكاوى\n" +
    "• طلبات إدارية معلقة: " + pendingRequests.length + "\n" +
    "• شكاوى مفتوحة: " + openComplaints.length + "\n\n" +
    "💰 العهد المالية\n" +
    "• عهد مفتوحة: " + openCash.length + "\n" +
    "• مبالغ مطلوب استردادها: " + cashMoney_(refunds) + " جنيه\n" +
    "• تعويضات بانتظار الإجراء: " + cashMoney_(reimbursements) + " جنيه\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    ((pendingAbsences.length || pendingRequests.length || openComplaints.length || openCash.length)
      ? "⚠️ توجد عناصر تحتاج إلى متابعة من الإدارة."
      : "✅ لا توجد عناصر معلقة حسب البيانات المسجلة.");
  return sendTrackedNotification_(chatId, "التقرير اليومي", message, dedupeKey || "");
}

function sendPendingAbsences_(chatId, sheets) {
  const allRows = getSheetObjects_(sheets.absences);
  const pending = [];
  allRows.forEach(function(row, index) {
    if (String(row["الحالة"]).trim() === "بانتظار مراجعة المدير") {
      pending.push({ rowNum: index + 2, data: row });
    }
  });
  if (!pending.length) {
    sendMessage_(chatId, "لا توجد حالات غياب معلقة للمراجعة.", adminBackKeyboard_());
    return;
  }
  pending.slice(-15).reverse().forEach(function(item) {
    const row = item.data;
    const keyboard = { inline_keyboard: [[
      { text: "✅ تأكيد الغياب", callback_data: "abs|confirm|" + item.rowNum },
      { text: "↩️ ليس غائبًا", callback_data: "abs|excuse|" + item.rowNum }
    ]] };
    sendMessage_(chatId,
      "⚠️ مراجعة حالة غياب\n\n" +
      "👤 الموظف: " + row["اسم الموظف"] + "\n" +
      "📅 التاريخ: " + row["التاريخ"] + "\n" +
      "🕒 موعد الحضور: " + row["موعد الحضور"] + "\n" +
      "🔎 وقت اكتشاف الحالة: " + row["وقت اكتشاف الحالة"], keyboard);
  });
  sendMessage_(chatId, "هذه هي الحالات المعلقة التي تحتاج قرارك.", adminBackKeyboard_());
}

function sendDailyAttendanceReport() {
  sendTodayReport_(ADMIN_ID, getSheets_());
}

/* =========================================
   ADMIN NOTIFICATION CENTER
========================================= */
function showNotificationCenter_(chatId, messageId, sheets, notice) {
  const settings = getSheetObjects_(sheets.notificationSettings);
  const logRows = getSheetObjects_(sheets.notifications);
  const sent = logRows.filter(function(r) { return String(r["الحالة"] || "") === "تم الإرسال"; }).length;
  const failed = logRows.filter(function(r) { return String(r["الحالة"] || "").indexOf("فشل") !== -1; }).length;
  const enabled = settings.filter(function(r) { return String(r["الإعداد"] || "").indexOf("دقائق_") !== 0 && notificationSettingEnabled_(sheets, String(r["الإعداد"])) ; }).length;
  let text = "🔔 مركز تحكم إشعارات MobiHub\n━━━━━━━━━━━━━━━━━━\n";
  if (notice) text += "✅ " + notice + "\n\n";
  text += "📨 إجمالي الإشعارات المسجلة: " + logRows.length + "\n✅ تم الإرسال: " + sent + "\n❌ فشل الإرسال: " + failed + "\n🟢 إعدادات مفعّلة: " + enabled + "\n\nاختر إعداداً لتفعيله أو إيقافه:";
  const rows = [];
  settings.forEach(function(r) {
    const key = String(r["الإعداد"] || "").trim();
    if (!key || key.indexOf("دقائق_") === 0) return;
    const on = notificationSettingEnabled_(sheets, key);
    const label = String(r["الوصف"] || key).replace(/^إرسال /, "");
    rows.push([{ text: (on ? "🟢 " : "⚪️ ") + label.substring(0, 42), callback_data: "adm|ntoggle|" + settings.indexOf(r) }]);
  });
  rows.push([{ text: "📜 آخر الإشعارات", callback_data: "adm|nlogs" }, { text: "🧪 اختبار الإرسال", callback_data: "adm|ntest" }]);
  rows.push([{ text: "🔄 تحديث", callback_data: "adm|notifications" }, { text: "⬅️ لوحة الإدارة", callback_data: "adm|home" }]);
  const markup = { inline_keyboard: rows };
  if (messageId) editMessageWithKeyboard_(chatId, messageId, text, markup);
  else sendMessage_(chatId, text, markup);
}

function toggleNotificationSetting_(sheets, key) {
  const sheet = sheets.notificationSettings;
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || "").trim() === key) {
      const current = String(values[i][1] || "TRUE").trim().toUpperCase();
      sheet.getRange(i + 1, 2).setValue(current === "TRUE" || current === "1" || current === "نعم" ? "FALSE" : "TRUE");
      return;
    }
  }
}

function showRecentNotificationLogs_(chatId, messageId, sheets) {
  const rows = getSheetObjects_(sheets.notifications).slice(-10).reverse();
  let text = "📜 آخر 10 إشعارات\n━━━━━━━━━━━━━━━━━━\n";
  if (!rows.length) text += "لا توجد إشعارات مسجلة حتى الآن.";
  rows.forEach(function(r) {
    text += "\n" + (String(r["الحالة"] || "").indexOf("فشل") !== -1 ? "❌" : "✅") + " " + String(r["نوع الإشعار"] || "إشعار") + "\n" +
      "👤 المستلم: " + String(r["المستلم"] || "-") + "\n🕒 " + String(r["التاريخ والوقت"] || "-") + "\n";
    if (r["تفاصيل الخطأ"]) text += "⚠️ " + String(r["تفاصيل الخطأ"]).substring(0, 160) + "\n";
  });
  const markup = { inline_keyboard: [[{ text: "⬅️ مركز الإشعارات", callback_data: "adm|notifications" }], [{ text: "🏠 لوحة الإدارة", callback_data: "adm|home" }]] };
  editMessageWithKeyboard_(chatId, messageId, text, markup);
}

/* =========================================
   SMART NOTIFICATION ENGINE
========================================= */

function ensureNotificationSettingsSheet_(ss) {
  const sheet = ensureSheet_(ss, NOTIFICATION_SETTINGS_SHEET, NOTIFICATION_SETTINGS_HEADERS);
  if (sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, DEFAULT_NOTIFICATION_SETTINGS.length, 3).setValues(DEFAULT_NOTIFICATION_SETTINGS);
  } else {
    const existing = getSheetObjects_(sheet);
    const keys = existing.map(function(x) { return String(x["الإعداد"] || "").trim(); });
    DEFAULT_NOTIFICATION_SETTINGS.forEach(function(row) {
      if (keys.indexOf(row[0]) === -1) sheet.appendRow(row);
    });
  }
  return sheet;
}

function notificationSettingEnabled_(sheets, key) {
  const rows = getSheetObjects_(sheets.notificationSettings);
  const item = rows.filter(function(x) { return String(x["الإعداد"] || "").trim() === key; })[0];
  if (!item) return true;
  return !(["FALSE", "0", "لا", "OFF", "معطل"].indexOf(String(item["القيمة"] || "TRUE").trim().toUpperCase()) !== -1);
}

function notificationSettingNumber_(sheets, key, fallback) {
  const rows = getSheetObjects_(sheets.notificationSettings);
  const item = rows.filter(function(x) { return String(x["الإعداد"] || "").trim() === key; })[0];
  const n = item ? Number(item["القيمة"]) : Number(fallback);
  return isFinite(n) && n >= 0 ? n : Number(fallback);
}

function notificationWasSent_(key) {
  if (!key) return false;
  return PropertiesService.getScriptProperties().getProperty("MOBI_NTF_" + key) === "SENT";
}

function getActiveAdminIds_(minimumRole) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss && ss.getSheetByName(ADMINS_SHEET);
  const ids = [String(ADMIN_ID)];
  if (sh && sh.getLastRow() > 1) {
    getSheetObjects_(sh).forEach(function(r) {
      const id = String(r["Chat ID"] || "").trim();
      const role = String(r["الصلاحية"] || "");
      const active = String(r["الحالة"] || "نشط") === "نشط";
      const eligible = !minimumRole || role === "Super Admin" || (minimumRole === "Admin" && role === "Admin") || (minimumRole === "Supervisor" && (role === "Supervisor" || role === "Admin")) || (minimumRole === "Finance" && role === "Finance");
      if (id && active && eligible && ids.indexOf(id) < 0) ids.push(id);
    });
  }
  return ids;
}

function notifyAdmins_(type, message, dedupeKey, replyMarkup, minimumRole) {
  const ids=getActiveAdminIds_(minimumRole);
  const results=[]; ids.forEach(function(id){results.push(sendTrackedNotification_(id,type,message,dedupeKey?dedupeKey+"_"+id:"",replyMarkup));});
  return results;
}

function sendTrackedNotification_(recipient, type, message, dedupeKey, replyMarkup) {
  try {
    // doPost يحتفظ بالفعل بقفل ScriptLock؛ لا نعيد طلب القفل هنا لتجنب التعارض المتداخل.
    if (dedupeKey && notificationWasSent_(dedupeKey)) return {ok:true, duplicate:true};
    const sent = sendMessage_(recipient, message, replyMarkup);
    if (dedupeKey) {
      PropertiesService.getScriptProperties().setProperty("MOBI_NTF_" + dedupeKey, "SENT");
      if (sent && sent.result && sent.result.message_id != null) {
        PropertiesService.getScriptProperties().setProperty("MOBI_NTF_MSG_" + dedupeKey, String(sent.result.message_id));
      }
    }
    appendNotificationLog_(recipient, type, dedupeKey, "تم الإرسال", "");
    return {ok:true};
  } catch (err) {
    appendNotificationLog_(recipient, type, dedupeKey, "فشل الإرسال", String(err && err.message || err));
    console.error("Notification failed [" + type + "]: " + err);
    return {ok:false, error:String(err)};
  }
}

function getAdminDisplayName_(chatId, sheets) {
  if (String(chatId) === String(ADMIN_ID)) return "المدير الرئيسي";
  const sh = sheets && sheets.admins;
  if (!sh || sh.getLastRow() < 2) return "مدير " + String(chatId);
  const row = getSheetObjects_(sh).find(function(r) {
    return String(r["Chat ID"] || "").trim() === String(chatId) && String(r["الحالة"] || "نشط") === "نشط";
  });
  return row ? String(row["اسم المدير"] || ("مدير " + chatId)) : ("مدير " + chatId);
}

function editAdminBroadcastCopies_(baseKey, text) {
  if (!baseKey) return;
  const ids = getActiveAdminIds_();
  ids.forEach(function(id) {
    const key = baseKey + "_" + id;
    const messageId = PropertiesService.getScriptProperties().getProperty("MOBI_NTF_MSG_" + key);
    if (!messageId) return;
    try {
      telegramApi_("editMessageText", {
        chat_id: String(id), message_id: Number(messageId), text: String(text),
        reply_markup: { inline_keyboard: [] }
      });
    } catch (e) { console.error("Unable to close admin notification " + key + ": " + e); }
  });
}

function getColumnByHeader_(sheet, header) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return 0;
  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const index = headers.indexOf(header);
  return index < 0 ? 0 : index + 1;
}

function appendNotificationLog_(recipient, type, key, status, error) {
  try {
    const sheet = getSheets_().notifications;
    const id = "NTF-" + Utilities.getUuid().slice(0, 8).toUpperCase();
    const stamp = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([id, stamp, String(recipient), String(type), String(key || ""), String(status), String(error || "").substring(0, 500)]);
  } catch (e) { console.error("Notification log failed: " + e); }
}

function notificationKey_(kind, date, chatId) {
  return [kind, date, String(chatId)].join("_").replace(/[^A-Za-z0-9_-]/g, "_");
}

function getShiftDateTimeMinutes_(date, time, startTime) {
  let mins = timeToMinutes_(time);
  if (!startTime && mins < 0) mins += 1440;
  return mins;
}

function sendShiftReminders_(sheets, now) {
  const date = Utilities.formatDate(now, TIME_ZONE, "yyyy-MM-dd");
  if (new Date(date + "T12:00:00").getDay() === 5) return;
  const nowMinutes = timeToMinutes_(Utilities.formatDate(now, TIME_ZONE, "HH:mm"));
  getSheetObjects_(sheets.emp).forEach(function(emp) {
    const chatId = String(emp["Chat ID"] || "").trim();
    const name = String(emp["اسم الموظف"] || "موظف").trim();
    if (!chatId || String(emp["حالة الحساب"] || "نشط").trim() !== "نشط") return;
    const assignment = getAssignmentForDate_(sheets.assignments, chatId, date);
    if (!assignment) return;
    const shift = getShiftById_(sheets.shifts, assignment.shiftId);
    if (!shift || !shift.startTime || hasApprovedFullDayLeave_(sheets, chatId, date)) return;
    if (hasAttendanceToday_(sheets.att, chatId, "حضور", date)) return;
    const start = timeToMinutes_(shift.startTime);
    const untilStart = start - nowMinutes;
    if (notificationSettingEnabled_(sheets, "تذكير_قبل_ساعة") && untilStart <= 60 && untilStart > 30) {
      const key = notificationKey_("shift60", date, chatId);
      sendTrackedNotification_(chatId, "تذكير حضور قبل ساعة", "🔔 تذكير بموعد العمل\n\nأهلاً " + name + "، متبقي ساعة على بداية ورديتك.\n🕒 موعد الحضور: " + shift.startTime + "\nنتمنى لك يوم عمل موفق في MobiHub.", key);
    }
    if (notificationSettingEnabled_(sheets, "تذكير_قبل_نصف_ساعة") && untilStart <= 30 && untilStart > 0) {
      const key = notificationKey_("shift30", date, chatId);
      sendTrackedNotification_(chatId, "تذكير حضور قبل نصف ساعة", "🔔 تذكير بموعد الحضور\n\nأهلاً " + name + "، متبقي 30 دقيقة على بداية ورديتك.\n🕒 موعد الحضور: " + shift.startTime + "\nيرجى الاستعداد والتوجه إلى المركز في الموعد المحدد.", key);
    }
  });
}

function overtimeDateTime_(date, time) {
  const normalized = normalizeTime_(time);
  if (!date || !normalized) return null;
  try { return Utilities.parseDate(String(date) + " " + normalized + ":00", TIME_ZONE, "yyyy-MM-dd HH:mm:ss"); }
  catch (e) { return null; }
}

function overtimeParseDateTime_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return new Date(value.getTime());
  const text = String(value || "").trim().replace("T", " ");
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (!match) return null;
  const time = match[2].length === 5 ? match[2] + ":00" : match[2];
  try { return Utilities.parseDate(match[1] + " " + time, TIME_ZONE, "yyyy-MM-dd HH:mm:ss"); }
  catch (e) { return null; }
}

function findOvertimeRequest_(sheet, chatId, date) {
  const rows = getSheetObjects_(sheet);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i]["Chat ID"] || "").trim() === String(chatId) && normalizeDate_(rows[i]["تاريخ الوردية"]) === String(date)) {
      return { row: rows[i], rowNum: i + 2 };
    }
  }
  return null;
}

function requestOvertimeApproval_(callback, sheets, date) {
  const chatId = String(callback.from && callback.from.id || "");
  const chat = callback.message && callback.message.chat;
  if (!chat || chat.type !== "private" || String(chat.id) !== chatId) { answerCallbackQuery_(callback.id, "افتح المحادثة الخاصة مع البوت."); return; }
  const employee = findEmployee_(sheets.emp, chatId);
  if (!employee || !hasOpenAttendance_(sheets.att, chatId)) { answerCallbackQuery_(callback.id, "لا يوجد حضور مفتوح لطلب أوفر تايم."); return; }
  const openAttendance = getOpenAttendanceInfo_(sheets.att, chatId);
  const shiftDate = openAttendance && openAttendance.date;
  if (!openAttendance || !/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || String(date) !== String(shiftDate)) {
    answerCallbackQuery_(callback.id, "تعذر ربط الطلب بتاريخ الوردية المفتوحة. أعد المحاولة من تذكير الانصراف."); return;
  }
  const shift = getShiftForOpenAttendance_(sheets, chatId, openAttendance);
  if (!shift || shift.isFlexible || !shift.endTime) { answerCallbackQuery_(callback.id, "الأوفر تايم التلقائي متاح للورديات ذات موعد انصراف محدد فقط."); return; }
  let shiftEnd = overtimeDateTime_(date, shift.endTime);
  const shiftStartMins = timeToMinutes_(shift.startTime), shiftEndMins = timeToMinutes_(shift.endTime);
  if (!shiftEnd) { answerCallbackQuery_(callback.id, "تعذر تحديد موعد نهاية الوردية."); return; }
  if (shiftEndMins <= shiftStartMins) shiftEnd = overtimeDateTime_(addDaysIsoV19_(shiftDate, 1), shift.endTime);
  if (!shiftEnd) { answerCallbackQuery_(callback.id, "تعذر تحديد تاريخ نهاية الوردية الليلية."); return; }
  const overtimeStart = new Date(shiftEnd.getTime() + OVERTIME_GRACE_MINUTES * 60000);
  const now = new Date();
  if (now < shiftEnd || now >= overtimeStart) { answerCallbackQuery_(callback.id, "طلب الموافقة متاح من موعد نهاية الوردية وحتى ما قبل بداية الأوفر تايم."); return; }
  const existing = findOvertimeRequest_(sheets.overtime, chatId, shiftDate);
  if (existing) {
    const status = String(existing.row["الحالة"] || "");
    answerCallbackQuery_(callback.id, status === "معتمد" ? "طلبك معتمد بالفعل." : status === "بانتظار موافقة المدير" ? "تم إرسال طلبك بالفعل." : "يوجد طلب سابق مسجل لهذه الوردية.");
    return;
  }
  const id = "OT-" + Utilities.getUuid().slice(0, 8).toUpperCase();
  const stamp = Utilities.formatDate(now, TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  const fmt = function(d) { return Utilities.formatDate(d, TIME_ZONE, "yyyy-MM-dd HH:mm:ss"); };
  const row = [id, shiftDate, chatId, employee.name, shift.id, fmt(shiftEnd), fmt(overtimeStart), fmt(overtimeStart), stamp, "بانتظار موافقة المدير", "", "", "", 0, 0, ""];
  sheets.overtime.appendRow(row);
  const rowNum = sheets.overtime.getLastRow();
  const message = "⏱️ طلب موافقة على أوفر تايم\n\n👤 المهندس: " + employee.name + "\n📅 تاريخ الوردية: " + shiftDate + "\n🕒 نهاية الوردية: " + shift.endTime + "\n🟢 بداية احتساب الأوفر تايم: " + Utilities.formatDate(overtimeStart, TIME_ZONE, "HH:mm:ss") + "\n⏳ آخر موعد للموافقة: " + Utilities.formatDate(overtimeStart, TIME_ZONE, "HH:mm:ss") + "\n💵 السعر: 1 جنيه لكل دقيقة بعد أول 30 دقيقة.\n⛔ الحد الأقصى: ساعتان مدفوعتان (120 جنيهًا).\n\nيجب اعتماد الطلب قبل بداية احتساب الأوفر تايم.";
  notifyAdmins_("طلب أوفر تايم جديد", message, "overtime_request_" + id, {inline_keyboard:[[{text:"✅ موافقة",callback_data:"ot|approve|"+rowNum},{text:"❌ رفض",callback_data:"ot|reject|"+rowNum}]]}, "Admin");
  answerCallbackQuery_(callback.id, "تم إرسال طلبك للمدير. لن يبدأ الحساب إلا بعد الموافقة قبل انتهاء أول 30 دقيقة.");
  sendMessage_(chatId, "📨 تم إرسال طلب الأوفر تايم إلى الإدارة. انتظر الموافقة؛ إذا تمت الموافقة قبل نهاية أول 30 دقيقة، سيبدأ الحساب من موعد نهاية الوردية +30 دقيقة، وبحد أقصى ساعتين مدفوعتين (120 جنيهًا).");
}

function handleOvertimeCallback_(callback, sheets, parts) {
  const action = String(parts[1] || "");
  if (action === "request") { requestOvertimeApproval_(callback, sheets, String(parts[2] || "")); return; }
  const actorId = String(callback.from && callback.from.id || "");
  const chat = callback.message && callback.message.chat;
  if (!chat || chat.type !== "private" || String(chat.id) !== actorId || !isAdmin_(actorId, sheets, "Admin")) {
    answerCallbackQuery_(callback.id, "هذه الموافقة متاحة للمديرين المخولين فقط."); return;
  }
  const rowNum = Number(parts[2]);
  if ((action !== "approve" && action !== "reject") || !Number.isInteger(rowNum) || rowNum < 2 || rowNum > sheets.overtime.getLastRow()) {
    answerCallbackQuery_(callback.id, "بيانات طلب الأوفر تايم غير صحيحة."); return;
  }
  const values = sheets.overtime.getRange(rowNum, 1, 1, OVERTIME_HEADERS.length).getValues()[0];
  const status = String(values[9] || "");
  if (status !== "بانتظار موافقة المدير") { answerCallbackQuery_(callback.id, "تم التعامل مع الطلب مسبقًا أو انتهت صلاحيته."); return; }
  const deadline = overtimeParseDateTime_(values[7]);
  const now = new Date();
  if (action === "approve" && (!deadline || isNaN(deadline.getTime()) || now >= deadline)) {
    sheets.overtime.getRange(rowNum, 10).setValue("انتهت مهلة الموافقة");
    answerCallbackQuery_(callback.id, "انتهت مهلة الموافقة؛ لا يمكن اعتماد أوفر تايم بأثر رجعي.");
    editMessageWithKeyboard_(chat.id, callback.message.message_id, "⌛ انتهت مهلة طلب الأوفر تايم ولم تتم الموافقة قبل موعد بدايته.", adminBackKeyboard_());
    return;
  }
  const decision = action === "approve" ? "معتمد" : "مرفوض";
  const stamp = Utilities.formatDate(now, TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  sheets.overtime.getRange(rowNum, 10, 1, 3).setValues([[decision, actorId, stamp]]);
  const actorName = getAdminDisplayName_(actorId, sheets);
  const employeeId = String(values[2] || "");
  sendMessage_(employeeId, action === "approve" ? "✅ وافق المدير على طلب الأوفر تايم. يبدأ الحساب من موعد نهاية ورديتك +30 دقيقة، بسعر 1 جنيه للدقيقة، وبحد أقصى ساعتين مدفوعتين (120 جنيهًا)، بشرط استمرارك في العمل حتى تسجيل الانصراف." : "❌ تم رفض طلب الأوفر تايم من الإدارة. لن يتم احتساب وقت إضافي لهذه الوردية.");
  answerCallbackQuery_(callback.id, action === "approve" ? "تم اعتماد الأوفر تايم." : "تم رفض الطلب.");
  const decisionText = (action === "approve" ? "✅ تمت الموافقة على طلب الأوفر تايم." : "❌ تم رفض طلب الأوفر تايم.") + "\n👤 المهندس: " + String(values[3] || "") + "\n🕒 يبدأ الحساب: " + String(values[6] || "") + "\n👨‍💼 القرار بواسطة: " + actorName + " (" + actorId + ")";
  editAdminBroadcastCopies_("overtime_request_" + String(values[0] || ""), decisionText);
  editMessageWithKeyboard_(chat.id, callback.message.message_id, decisionText, adminBackKeyboard_());
}

function finalizeOvertimeAtCheckout_(sheets, chatId, employeeName, date, checkoutAt, shift) {
  const found = findOvertimeRequest_(sheets.overtime, chatId, date);
  if (!found) return null;
  const row = found.row, rowNum = found.rowNum;
  const currentStatus = String(row["الحالة"] || "");
  if (currentStatus === "بانتظار موافقة المدير") {
    sheets.overtime.getRange(rowNum, 10).setValue("لم تتم الموافقة قبل الانصراف");
    return null;
  }
  if (currentStatus !== "معتمد") return null;
  const startAt = overtimeParseDateTime_(row["بداية الأوفر تايم"]);
  if (!startAt || isNaN(startAt.getTime())) return null;
  const elapsedPaidMinutes = Math.max(0, Math.floor((checkoutAt.getTime() - startAt.getTime()) / 60000));
  const minutes = Math.min(elapsedPaidMinutes, OVERTIME_MAX_PAID_MINUTES);
  const amount = minutes * OVERTIME_RATE_PER_MINUTE;
  const stamp = Utilities.formatDate(checkoutAt, TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  const status = minutes > 0 ? "معتمد - جاهز للتسوية" : "معتمد دون وقت إضافي مستحق";
  sheets.overtime.getRange(rowNum, 10).setValue(status);
  sheets.overtime.getRange(rowNum, 13, 1, 3).setValues([[stamp, minutes, amount]]);
  if (minutes > 0) {
    const capNote = elapsedPaidMinutes > OVERTIME_MAX_PAID_MINUTES ? "\n⚠️ تم تطبيق الحد الأقصى: ساعتان مدفوعتان." : "";
    const summary = "⏱️ تم إغلاق أوفر تايم معتمد\n\n👤 المهندس: " + employeeName + "\n📅 التاريخ: " + date + "\n⏱️ الدقائق المستحقة: " + minutes + "\n💰 المبلغ: " + amount + " جنيه" + capNote + "\n📌 الحالة: معتمد - جاهز للتسوية المالية.";
    notifyAdmins_("أوفر تايم جاهز للتسوية", summary, "overtime_completed_" + row["رقم الطلب"], null, "Finance");
    notifyAdmins_("إغلاق أوفر تايم معتمد", summary, "overtime_completed_admin_" + row["رقم الطلب"], null, "Admin");
  }
  return {minutes: minutes, amount: amount, capped: elapsedPaidMinutes > OVERTIME_MAX_PAID_MINUTES};
}

function sendOvertimeReport_(chatId, messageId, sheets) {
  const rows = getSheetObjects_(sheets.overtime).slice(-20).reverse();
  if (!rows.length) { const msg = "⏱️ لا توجد طلبات أوفر تايم مسجلة حتى الآن."; if (messageId) editMessageWithKeyboard_(chatId,messageId,msg,adminBackKeyboard_()); else sendMessage_(chatId,msg,adminBackKeyboard_()); return; }
  const lines = ["⏱️ سجل الأوفر تايم — آخر 20 طلبًا", ""];
  rows.forEach(function(r) {
    lines.push("👤 " + String(r["اسم المهندس"] || "") + " | " + String(r["تاريخ الوردية"] || ""));
    lines.push("الحالة: " + String(r["الحالة"] || "") + " | الدقائق: " + Number(r["دقائق الأوفر تايم"] || 0) + " | المبلغ: " + Number(r["المبلغ بالجنيه"] || 0) + " جنيه");
    lines.push("--------------------");
  });
  const msg = lines.join("\n");
  if (messageId) editMessageWithKeyboard_(chatId,messageId,msg,adminBackKeyboard_()); else sendMessage_(chatId,msg,adminBackKeyboard_());
}

function sendCheckoutReminders_(sheets, now) {
  const nowMs = now.getTime();
  getSheetObjects_(sheets.emp).forEach(function(emp) {
    const chatId = String(emp["Chat ID"] || "").trim();
    const name = String(emp["اسم الموظف"] || "موظف").trim();
    if (!chatId || String(emp["حالة الحساب"] || "نشط").trim() !== "نشط") return;

    const openAttendance = getOpenAttendanceInfo_(sheets.att, chatId);
    if (!openAttendance || !openAttendance.date) return;
    const shiftDate = openAttendance.date;
    const shift = getShiftForOpenAttendance_(sheets, chatId, openAttendance);
    if (!shift || !shift.startTime || !shift.endTime || shift.isFlexible) return;

    let shiftEnd = overtimeDateTime_(shiftDate, shift.endTime);
    if (!shiftEnd) return;
    if (timeToMinutes_(shift.endTime) <= timeToMinutes_(shift.startTime)) {
      shiftEnd = overtimeDateTime_(addDaysIsoV19_(shiftDate, 1), shift.endTime);
    }
    if (!shiftEnd) return;

    const elapsedMs = nowMs - shiftEnd.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    if (elapsedMs < 0) return;

    if (elapsedMinutes < OVERTIME_GRACE_MINUTES && notificationSettingEnabled_(sheets, "تذكير_الانصراف_عند_النهاية")) {
      const key = notificationKey_("checkout0", shiftDate, chatId);
      const text = "🚪 انتهت ورديتك يا " + name + ".\nيرجى تسجيل الانصراف قبل مغادرة المركز.\n\nإذا كنت تحتاج إلى الاستمرار في العمل، يمكنك طلب موافقة المدير على الأوفر تايم خلال أول 30 دقيقة بعد نهاية الوردية.";
      const keyboard = {inline_keyboard:[[{text:"⏱️ طلب موافقة أوفر تايم",callback_data:"ot|request|" + shiftDate}]]};
      sendTrackedNotification_(chatId, "تذكير تسجيل الانصراف", text, key, keyboard);
    }
    if (elapsedMinutes >= 15 && elapsedMinutes < 25 && notificationSettingEnabled_(sheets, "تذكير_الانصراف_بعد_15_دقيقة")) {
      sendTrackedNotification_(chatId, "تذكير الانصراف بعد 15 دقيقة", "🔔 تذكير: لم تسجل انصرافك بعد مرور 15 دقيقة على نهاية ورديتك. يرجى تسجيل الانصراف.", notificationKey_("checkout15", shiftDate, chatId));
    }
    if (elapsedMinutes >= 30 && elapsedMinutes < 40 && notificationSettingEnabled_(sheets, "تنبيه_المدير_بعد_30_دقيقة")) {
      notifyAdmins_("عدم تسجيل انصراف", "⚠️ لم يسجل الموظف انصرافه بعد انتهاء الوردية.\n\n👤 الموظف: " + name + "\n🕒 نهاية الوردية: " + shift.endTime + "\n📅 تاريخ بداية الوردية: " + shiftDate + "\n⏱ مرّ أكثر من 30 دقيقة على موعد الانصراف.", notificationKey_("admin_checkout30", shiftDate, chatId), null, "Supervisor");
    }
  });
}

function sendDynamicDailyReportIfDue_(sheets, now) {
  if (!notificationSettingEnabled_(sheets, "تقرير_بعد_آخر_وردية")) return;
  const date = Utilities.formatDate(now, TIME_ZONE, "yyyy-MM-dd");
  if (new Date(date + "T12:00:00").getDay() === 5) return;
  let latestEnd = null;
  getSheetObjects_(sheets.emp).forEach(function(emp) {
    const chatId = String(emp["Chat ID"] || "").trim();
    if (!chatId || String(emp["حالة الحساب"] || "نشط").trim() !== "نشط") return;
    const assignment = getAssignmentForDate_(sheets.assignments, chatId, date);
    if (!assignment) return;
    const shift = getShiftById_(sheets.shifts, assignment.shiftId);
    if (!shift || !shift.endTime) return;
    let end = timeToMinutes_(shift.endTime);
    if (end <= timeToMinutes_(shift.startTime)) end += 1440;
    if (latestEnd === null || end > latestEnd) latestEnd = end;
  });
  if (latestEnd === null) return;
  const delay = notificationSettingNumber_(sheets, "دقائق_تأخير_التقرير", 15);
  const nowMinutes = timeToMinutes_(Utilities.formatDate(now, TIME_ZONE, "HH:mm"));
  if (nowMinutes < latestEnd + delay) return;
  const key = notificationKey_("daily_report", date, ADMIN_ID);
  if (notificationWasSent_(key)) return;
  sendTodayReport_(ADMIN_ID, sheets, key);
}

function runNotificationEngine() {
  try {
    resetAdminRoleRequestCache_();
    const sheets = getSheets_();
    const now = new Date();
    sendShiftReminders_(sheets, now);
    scanAttendanceAndNotifyAdmin(sheets);
    sendCheckoutReminders_(sheets, now);
    sendDynamicDailyReportIfDue_(sheets, now);
  } catch (err) {
    console.error("Notification engine error: " + (err && err.stack || err));
    try { appendNotificationLog_(ADMIN_ID, "خطأ محرك الإشعارات", "engine_error_" + today_(), "فشل", String(err && err.message || err)); } catch (ignored) {}
  }
}

function testNotificationEngine() {
  const sheets = getSheets_();
  Logger.log("Notifications sheet rows: " + sheets.notifications.getLastRow());
  Logger.log("Notification settings rows: " + sheets.notificationSettings.getLastRow());
  Logger.log("Active triggers: " + ScriptApp.getProjectTriggers().map(function(t) { return t.getHandlerFunction(); }).join(", "));
}

function addShift(shiftId, name, startTime, endTime, graceMinutes) {
  const sheets = getSheets_();
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) ||
      timeToMinutes_(startTime) > 1439 || timeToMinutes_(endTime) > 1439) {
    throw new Error("اكتب الوقت بصيغة HH:mm مثل 10:00.");
  }
  const exists = getSheetObjects_(sheets.shifts).some(function(row) {
    return String(row["Shift ID"]).trim() === String(shiftId);
  });
  if (exists) throw new Error("Shift ID موجود بالفعل.");
  sheets.shifts.appendRow([String(shiftId), String(name), startTime, endTime,
    Number(graceMinutes == null ? GRACE_MINUTES_DEFAULT : graceMinutes), "نشط"]);
  return "تمت إضافة الوردية بنجاح.";
}

function assignShift(chatId, shiftId, startDate, endDate, workDays) {
  const sheets = getSheets_();
  chatId = String(chatId || "").trim();
  shiftId = String(shiftId || "").trim();
  startDate = normalizeDate_(startDate);
  endDate = endDate ? normalizeDate_(endDate) : "";
  if (!findEmployee_(sheets.emp, chatId)) throw new Error("الموظف غير موجود في شيت الموظفين.");
  if (!getShiftById_(sheets.shifts, shiftId)) throw new Error("الوردية غير موجودة أو غير نشطة.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || isNaN(new Date(startDate + "T12:00:00").getTime())) throw new Error("تاريخ البداية غير صحيح. استخدم yyyy-MM-dd.");
  if (endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || isNaN(new Date(endDate + "T12:00:00").getTime()))) throw new Error("تاريخ النهاية غير صحيح. استخدم yyyy-MM-dd.");
  if (endDate && endDate < startDate) throw new Error("تاريخ النهاية يجب ألا يسبق تاريخ البداية.");
  const selectedShift = getShiftById_(sheets.shifts, shiftId);
  const days = String(workDays || "0,1,2,3,4,6").split(",").map(function(x) { return Number(x.trim()); });
  if (!days.length || days.some(function(d) { return !Number.isInteger(d) || d < 0 || d > 6; })) throw new Error("أيام العمل غير صحيحة.");
  if (!selectedShift.isFlexible && days.indexOf(5) !== -1) throw new Error("الجمعة لا تُضاف للورديات الثابتة. استخدم وردية بدون ميعاد ثابت إذا كان الموظف يعمل يوم الجمعة.");
  if (new Set(days).size !== days.length) throw new Error("يوجد يوم مكرر في أيام العمل.");
  deactivateOverlappingAssignments_(sheets.assignments, chatId, startDate, endDate);
  sheets.assignments.appendRow([chatId, shiftId, startDate, endDate, days.join(","), "نشط"]);
  return "تم ربط الوردية بالموظف، وإيقاف أي إسناد سابق متداخل معها.";
}

function testPhase1Setup() {
  const sheets = getSheets_();
  Logger.log("Employees: " + Math.max(0, sheets.emp.getLastRow() - 1));
  Logger.log("Shifts: " + Math.max(0, sheets.shifts.getLastRow() - 1));
  Logger.log("Assignments: " + Math.max(0, sheets.assignments.getLastRow() - 1));
  Logger.log("Absence reviews: " + Math.max(0, sheets.absences.getLastRow() - 1));
}


/* =========================================
   GENERAL HELPERS
========================================= */

// فحص أوامر Telegram
function isCommand_(
  text,
  command
) {

  return (
    text === "/" + command ||
    text.indexOf("/" + command + "@") === 0
  );
}


// تاريخ اليوم بتوقيت مصر
function today_() {

  return Utilities.formatDate(
    new Date(),
    TIME_ZONE,
    "yyyy-MM-dd"
  );
}


// رد نجاح Telegram Webhook
function ok_() {

  return ContentService
    .createTextOutput("OK")
    .setMimeType(
      ContentService.MimeType.TEXT
    );
}


// حساب المسافة بين نقطتين باستخدام Haversine
function calculateDistance_(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const earthRadius = 6371000;

  const rad = Math.PI / 180;

  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;

  const a =
    Math.sin(dLat / 2) *
    Math.sin(dLat / 2) +

    Math.cos(lat1 * rad) *
    Math.cos(lat2 * rad) *

    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  return (
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

/* =========================================
   V15 — LEAVE MANAGEMENT / ABSENCE SUMMARY
========================================= */

function addDaysIsoV19_(isoDate, days) {
  const parts = String(isoDate).split("-").map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + Number(days || 0), 12, 0, 0));
  return Utilities.formatDate(d, "UTC", "yyyy-MM-dd");
}

function minutesToTimeV19_(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  return ("0" + Math.floor(value / 60)).slice(-2) + ":" + ("0" + (value % 60)).slice(-2);
}

function chunkButtonsV19_(items, size) {
  const rows = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function buildLeaveStartTimeOptionsV19_(shift, date) {
  const start = timeToMinutes_(shift.startTime);
  let end = timeToMinutes_(shift.endTime);
  if (end <= start) end += 24 * 60;
  let now = 0;
  if (date === today_()) now = timeToMinutes_(Utilities.formatDate(new Date(), TIME_ZONE, "HH:mm"));
  const first = Math.max(start, Math.ceil(now / 30) * 30);
  const options = [];
  for (let m = first; m + 60 <= end; m += 30) {
    const normalized = m >= 1440 ? m - 1440 : m;
    options.push(minutesToTimeV19_(normalized));
  }
  return options;
}

function leaveDurationFitsShiftV19_(flow, hours) {
  const start = timeToMinutes_(flow.from || "00:00");
  let end = timeToMinutes_(flow.shiftEnd || "00:00");
  if (end <= timeToMinutes_(flow.shiftStart || "00:00")) end += 1440;
  const actualStart = start < timeToMinutes_(flow.shiftStart || "00:00") ? start + 1440 : start;
  return actualStart + Number(hours) * 60 <= end;
}
function saveLeaveRequestV15_(chatId, employee, flow, sheets) {
  const sh = sheets.leaves;
  const duplicate = getSheetObjects_(sh).some(function(r) {
    const existingStart = normalizeDate_(r["تاريخ الإذن"]);
    const existingEnd = normalizeDate_(r["تاريخ نهاية الإذن"] || r["تاريخ الإذن"]);
    const newStart = flow.date;
    const newEnd = flow.endDate || flow.date;
    return String(r["Chat ID"]).trim() === String(chatId) &&
      newStart <= existingEnd && newEnd >= existingStart &&
      ["بانتظار مراجعة المدير", "مقبول"].indexOf(String(r["الحالة"])) !== -1;
  });
  if (duplicate) {
    setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
    sendMainMenu_(chatId, "⚠️ لديك بالفعل طلب إذن معلق أو معتمد في هذا التاريخ. راجع طلباتك أو الإدارة.");
    return;
  }
  const requestId = "LV-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  const submitted = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  const row = sh.getLastRow() + 1;
  sh.appendRow([requestId, submitted, String(chatId), employee.name, flow.leaveType, flow.date,
    flow.from || "", flow.to || "", flow.reason, "بانتظار مراجعة المدير", "", "", "",
    Number(flow.days || (flow.leaveType === "يوم كامل" ? 1 : 0)), flow.endDate || flow.date]);
  const details = "⏳ طلب إذن جديد\n\n👤 الموظف: " + employee.name +
    "\n📅 من: " + flow.date + (flow.leaveType === "يوم كامل" ? " إلى: " + (flow.endDate || flow.date) : "") +
    "\n📌 النوع: " + flow.leaveType +
    (flow.leaveType === "بالساعات" ? "\n🕒 من " + flow.from + " إلى " + flow.to + " (" + flow.hours + " ساعة)" :
      "\n📆 عدد الأيام: " + Number(flow.days || 1)) +
    "\n📝 السبب: " + flow.reason + "\n\nرقم الطلب: " + requestId;
  notifyAdmins_("طلب إذن جديد", details, "leave_request_" + requestId, {inline_keyboard:[[
    {text:"✅ موافقة", callback_data:"leave|approve|" + row},
    {text:"❌ رفض", callback_data:"leave|reject|" + row}
  ]]}, "Supervisor");
  setEmployeeState_(sheets.emp, employee.row, STATE_ACTIVE);
  sendMainMenu_(chatId, "✅ تم إرسال طلب الإذن للإدارة.\n\n📅 التاريخ: " + flow.date +
    "\n📌 النوع: " + flow.leaveType + "\nسيتم إشعارك بالقرار. لا يُعتبر الإذن معتمدًا قبل موافقة الإدارة.");
}

function handleLeaveDecisionV15_(callback, sheets, action, rowNum) {
  if (!Number.isInteger(rowNum) || rowNum < 2 || rowNum > sheets.leaves.getLastRow() || ["approve","reject"].indexOf(action) < 0) {
    answerCallbackQuery_(callback.id, "بيانات طلب الإذن غير صحيحة."); return;
  }
  const sh = sheets.leaves;
  const row = sh.getRange(rowNum, 1, 1, LEAVE_HEADERS.length).getDisplayValues()[0];
  if (row[9] !== "بانتظار مراجعة المدير") { answerCallbackQuery_(callback.id, "تمت مراجعة الطلب بالفعل."); return; }
  const approved = action === "approve";
  if (approved && row[4] === "يوم كامل") {
    const alreadyConfirmed = getSheetObjects_(sheets.absences).some(function(a) {
      const absenceDate = normalizeDate_(a["التاريخ"]);
      const startDate = normalizeDate_(row[5]);
      const endDate = normalizeDate_(row[14] || row[5]);
      return String(a["Chat ID"]).trim() === String(row[2]).trim() &&
        absenceDate >= startDate && absenceDate <= endDate &&
        (String(a["الحالة"]) === "غياب مؤكد" || String(a["قرار المدير"]) === "تأكيد الغياب");
    });
    if (alreadyConfirmed) { answerCallbackQuery_(callback.id, "لا يمكن اعتماد إذن يوم كامل بعد تأكيد الغياب لهذا التاريخ."); return; }
  }
  const now = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  const actorId = String(callback.from && callback.from.id || "");
  const actorName = getAdminDisplayName_(actorId, sheets);
  sh.getRange(rowNum, 10, 1, 3).setValues([[approved ? "مقبول" : "مرفوض", approved ? "موافقة" : "رفض", now]]);
  const actorIdCol = getColumnByHeader_(sh, "Chat ID المدير");
  const actorNameCol = getColumnByHeader_(sh, "اسم المدير");
  if (actorIdCol) sh.getRange(rowNum, actorIdCol).setValue(actorId);
  if (actorNameCol) sh.getRange(rowNum, actorNameCol).setValue(actorName);
  if (approved && row[4] === "يوم كامل") {
    getSheetObjects_(sheets.absences).forEach(function(a, i) {
      const absenceDate = normalizeDate_(a["التاريخ"]);
      const startDate = normalizeDate_(row[5]);
      const endDate = normalizeDate_(row[14] || row[5]);
      if (String(a["Chat ID"]).trim() === String(row[2]).trim() && absenceDate >= startDate && absenceDate <= endDate && String(a["الحالة"]) === "بانتظار مراجعة المدير") {
        sheets.absences.getRange(i + 2, 7, 1, 3).setValues([["مغلق - إذن معتمد", "إذن يوم كامل معتمد", now]]);
      }
    });
  }
  answerCallbackQuery_(callback.id, approved ? "تم اعتماد الإذن." : "تم رفض الإذن.");
  const msg = (approved ? "✅ تمت الموافقة على" : "❌ تم رفض") + " طلب الإذن الخاص بك.\n\n📅 التاريخ: " + row[5] +
    "\n📌 النوع: " + row[4] + (row[4] === "بالساعات" ? "\n🕒 من " + row[6] + " إلى " + row[7] : "") +
    (approved ? "\n\nسيتم استثناء المدة المعتمدة من حساب التأخير/الغياب وفق نوع الإذن." : "\n\nسيتم تطبيق قواعد الحضور المعتادة.");
  sendMessage_(row[2], msg);
  const decisionText = "📌 تم " + (approved ? "قبول" : "رفض") + " طلب الإذن رقم " + String(row[0] || "") + "\n👤 الموظف: " + String(row[3] || "") + "\n👨‍💼 القرار بواسطة: " + actorName + " (" + actorId + ")\n🕒 " + now;
  editAdminBroadcastCopies_("leave_request_" + String(row[0] || ""), decisionText);
  if (callback.message) editMessageText_(callback.message.chat.id, callback.message.message_id, decisionText);
}

function showPendingLeaveRequestsV15_(chatId, messageId, sheets) {
  const rows = getSheetObjects_(sheets.leaves).map(function(r, i) { r.__row = i + 2; return r; })
    .filter(function(r) { return String(r["الحالة"] || "") === "بانتظار مراجعة المدير"; }).slice(0, 30);
  if (!rows.length) { editMessageWithKeyboard_(chatId, messageId, "⏳ لا توجد طلبات أذونات بانتظار المراجعة.", adminBackKeyboard_()); return; }
  const buttons = rows.map(function(r) { return [{text:(r["اسم الموظف"] || "موظف").substring(0,25) + " | " + r["تاريخ الإذن"] + " | " + r["نوع الإذن"], callback_data:"adm|leaveview|" + r.__row}]; });
  buttons.push([{text:"⬅️ لوحة الإدارة", callback_data:"adm|home"}]);
  editMessageWithKeyboard_(chatId, messageId, "⏳ طلبات الأذونات المعلقة: " + rows.length + "\nاختر طلبًا لعرض تفاصيله.", {inline_keyboard:buttons});
}

function closePendingAbsenceIfCheckedInV15_(sheets, chatId, date) {
  const rows = getSheetObjects_(sheets.absences);
  rows.forEach(function(r, i) {
    if (String(r["Chat ID"]).trim() === String(chatId) && normalizeDate_(r["التاريخ"]) === date && String(r["الحالة"]) === "بانتظار مراجعة المدير") {
      const now = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
      sheets.absences.getRange(i + 2, 7, 1, 3).setValues([["مغلق - حضر بعد رصد الحالة", "تم تسجيل الحضور", now]]);
    }
  });
}

function hasApprovedFullDayLeave_(sheets, chatId, date) {
  return getSheetObjects_(sheets.leaves).some(function(r) {
    const start = normalizeDate_(r["تاريخ الإذن"]);
    const end = normalizeDate_(r["تاريخ نهاية الإذن"] || r["تاريخ الإذن"]);
    return String(r["Chat ID"]).trim() === String(chatId) && date >= start && date <= end &&
      String(r["نوع الإذن"]) === "يوم كامل" && String(r["الحالة"]) === "مقبول";
  });
}

function getApprovedLeaveEndForDate_(sheets, chatId, date, baseDeadline) {
  const ends = getSheetObjects_(sheets.leaves).filter(function(r) {
    return String(r["Chat ID"]).trim() === String(chatId) && normalizeDate_(r["تاريخ الإذن"]) === date &&
      String(r["نوع الإذن"]) === "بالساعات" && String(r["الحالة"]) === "مقبول" &&
      timeToMinutes_(r["من الساعة"]) <= Number(baseDeadline || 0);
  }).map(function(r) { return timeToMinutes_(r["إلى الساعة"]); });
  return ends.length ? Math.max.apply(null, ends) : 0;
}

function getApprovedLeaveOverlapMinutes_(sheets, chatId, date, shiftStart, checkinTime, grace) {
  const lateStart = timeToMinutes_(shiftStart) + Number(grace || 0);
  const actual = timeToMinutes_(checkinTime);
  if (actual <= lateStart) return 0;
  const intervals = getSheetObjects_(sheets.leaves).filter(function(r) {
    return String(r["Chat ID"]).trim() === String(chatId) && normalizeDate_(r["تاريخ الإذن"]) === date &&
      String(r["نوع الإذن"]) === "بالساعات" && String(r["الحالة"]) === "مقبول";
  });
  let overlap = 0;
  intervals.forEach(function(r) {
    const a = timeToMinutes_(r["من الساعة"]), b = timeToMinutes_(r["إلى الساعة"]);
    overlap += Math.max(0, Math.min(actual, b) - Math.max(lateStart, a));
  });
  return Math.min(actual - lateStart, overlap);
}

function isValidIsoDateV15_(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const d = new Date(String(value) + "T12:00:00");
  return !isNaN(d.getTime()) && Utilities.formatDate(d, TIME_ZONE, "yyyy-MM-dd") === String(value);
}

function sendEmployeeDeductionsSummary_(chatId, sheets) {
  const month = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM");
  const absences = getSheetObjects_(sheets.absences).filter(function(r) {
    return String(r["Chat ID"] || "").trim() === String(chatId) && normalizeDate_(r["التاريخ"]).indexOf(month) === 0 &&
      (String(r["الحالة"] || "").indexOf("غياب مؤكد") !== -1 || String(r["قرار المدير"] || "") === "تأكيد الغياب");
  });
  const pending = getSheetObjects_(sheets.absences).filter(function(r) {
    return String(r["Chat ID"] || "").trim() === String(chatId) && normalizeDate_(r["التاريخ"]).indexOf(month) === 0 && String(r["الحالة"] || "").indexOf("بانتظار") !== -1;
  });
  const lateRows = getSheetObjects_(sheets.att).filter(function(r) {
    return String(r["Chat ID"] || "").trim() === String(chatId) && normalizeDate_(r["التاريخ"]).indexOf(month) === 0 && String(r["النوع"]) === "حضور";
  });
  const lateMinutes = lateRows.reduce(function(sum, r) { return sum + Math.max(0, Number(r["دقائق التأخير"] || 0)); }, 0);
  const leaveRequests = getSheetObjects_(sheets.leaves).filter(function(r) {
    return String(r["Chat ID"] || "").trim() === String(chatId) && normalizeDate_(r["تاريخ الإذن"]).indexOf(month) === 0;
  });
  const deductionRows = getSheetObjects_(sheets.deductions).filter(function(r) {
    return String(r["Chat ID"] || "").trim() === String(chatId) && normalizeDate_(r["تاريخ الواقعة"]).indexOf(month) === 0;
  });
  const approvedDeductions = deductionRows.filter(function(r) { return String(r["الحالة"]) === "معتمد"; });
  const pendingDeductions = deductionRows.filter(function(r) { return String(r["الحالة"]) === "بانتظار اعتماد المدير"; });
  const approvedAmount = approvedDeductions.reduce(function(sum, r) { return sum + (Number(r["المبلغ بالجنيه"]) || 0); }, 0);
  let msg = "💰 خصوماتي — " + month + "\n\n" +
    "❌ أيام الغياب المؤكدة: " + absences.length + " يوم\n" +
    "🕓 حالات غياب بانتظار المراجعة: " + pending.length + "\n" +
    "⏱ إجمالي دقائق التأخير بعد احتساب الأذونات: " + lateMinutes + " دقيقة\n" +
    "📩 طلبات الأذونات هذا الشهر: " + leaveRequests.length + "\n" +
    "💸 الخصومات المالية المعتمدة: " + approvedAmount.toFixed(2) + " جنيه\n" +
    "⏳ خصومات بانتظار اعتماد الإدارة: " + pendingDeductions.length + "\n\n" +
    "ℹ️ قيمة خصم الغياب لا يحسبها البوت؛ يتم تسويتها مع المحاسب في نهاية الشهر.";
  if (absences.length) msg += "\n\nتواريخ الغياب المؤكد:\n" + absences.map(function(r) { return "• " + normalizeDate_(r["التاريخ"]); }).join("\n");
  if (approvedDeductions.length) msg += "\n\nتفاصيل الخصومات المعتمدة:\n" + approvedDeductions.map(function(r) { return "• " + r["نوع الخصم"] + " — " + Number(r["المبلغ بالجنيه"] || 0).toFixed(2) + " جنيه"; }).join("\n");
  sendMainMenu_(chatId, msg);
}


/* =========================================
   V15.1 — FINANCIAL DEDUCTIONS
========================================= */
function ensureDeductionSettingsSheet_(ss) {
  const sh = ensureSheet_(ss, DEDUCTION_SETTINGS_SHEET, DEDUCTION_SETTINGS_HEADERS);
  if (sh.getLastRow() < 2) sh.getRange(2, 1, DEDUCTION_DEFAULTS.length, 3).setValues(DEDUCTION_DEFAULTS);
  return sh;
}
function getDeductionSettingV15_(sheets, key, fallback) {
  const rows = getSheetObjects_(sheets.deductionSettings);
  const r = rows.filter(function(x) { return String(x["الإعداد"]) === key; })[0];
  const n = r ? Number(r["القيمة"]) : NaN;
  return isFinite(n) ? n : fallback;
}
function createAutomaticDeductionV15_(sheets, chatId, employeeName, date, type, reason, amount, reference) {
  if (!(Number(amount) > 0) || !reference) return false;
  const sh = sheets.deductions;
  const exists = getSheetObjects_(sh).some(function(r) { return String(r["مرجع الواقعة"] || "") === reference; });
  if (exists) return false;
  const id = "DD-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  const now = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
  sh.appendRow([id, date, String(chatId), employeeName, type, reason, Number(amount), "تلقائي", "بانتظار اعتماد المدير", reference, now, "", "", "", ""]);
  sendMessage_(chatId, "⚠️ تم رصد خصم يحتاج مراجعة الإدارة\n\nالنوع: " + type + "\nالتفاصيل: " + reason + "\nالمبلغ المقترح: " + Number(amount).toFixed(2) + " جنيه\n\nلن يُضاف إلى الخصومات المعتمدة إلا بعد مراجعة المدير.");
  notifyAdmins_("خصم تلقائي بانتظار الاعتماد", "💸 خصم تلقائي بانتظار الاعتماد\n\nالموظف: " + employeeName + "\nالنوع: " + type + "\nالتاريخ: " + date + "\nالسبب: " + reason + "\nالمبلغ: " + Number(amount).toFixed(2) + " جنيه", "deduction_pending_" + sh.getLastRow(), {inline_keyboard:[[{text:"✅ اعتماد",callback_data:"ded|approve|" + (sh.getLastRow())},{text:"❌ رفض",callback_data:"ded|reject|" + (sh.getLastRow())}]]}, "Finance");
  return true;
}
function sendAdminDeductionsMenuV15_(chatId, messageId, sheets) {
  const pending = getSheetObjects_(sheets.deductions).filter(function(r) { return String(r["الحالة"]) === "بانتظار اعتماد المدير"; }).length;
  const kb = {inline_keyboard:[[{text:"➕ خصم لموظف",callback_data:"adm|dedadd"}],[{text:"⏳ خصومات بانتظار الاعتماد (" + pending + ")",callback_data:"adm|dedpending"}],[{text:"📊 التقرير الشهري",callback_data:"adm|dedreport"}],[{text:"⬅️ لوحة الإدارة",callback_data:"adm|home"}]]};
  const t = "💸 إدارة الخصومات\n\nالخصومات المعلقة: " + pending + "\n\nاختر الإجراء المطلوب.";
  if (messageId) editMessageWithKeyboard_(chatId, messageId, t, kb); else sendMessage_(chatId, t, kb);
}
function startManualDeductionV15_(chatId, messageId, sheets) {
  const employees = getSheetObjects_(sheets.emp).filter(function(e) { return String(e["Chat ID"] || "").trim() && String(e["حالة الحساب"] || "نشط") !== "موقوف"; }).slice(0, 45);
  const rows = employees.map(function(e) { return [{text:String(e["اسم الموظف"] || "موظف").substring(0,35),callback_data:"adm|dedemployee|" + String(e["Chat ID"]).trim()}]; });
  rows.push([{text:"⬅️ رجوع",callback_data:"adm|deductions"}]);
  const t = "➕ خصم لموظف\n\nاختر الموظف المطلوب تسجيل الخصم عليه:";
  if (messageId) editMessageWithKeyboard_(chatId,messageId,t,{inline_keyboard:rows}); else sendMessage_(chatId,t,{inline_keyboard:rows});
}
function deductionFlowKey_(chatId) { return "MOBI_DED_FLOW_" + String(chatId); }
function chooseManualDeductionTypeV15_(chatId, messageId, employeeId, sheets) {
  const emp = findEmployee_(sheets.emp, employeeId);
  if (!emp) { editMessageWithKeyboard_(chatId,messageId,"الموظف غير موجود.",adminBackKeyboard_()); return; }
  PropertiesService.getScriptProperties().setProperty(deductionFlowKey_(chatId), JSON.stringify({employeeId:String(employeeId),employeeName:emp.name,step:"type"}));
  editMessageWithKeyboard_(chatId,messageId,"الموظف: " + emp.name + "\n\nاختر سبب الخصم:",{inline_keyboard:[[{text:"عدم التسجيل على السيستم — 50 جنيه",callback_data:"ded|manualfixed|"+employeeId}],[{text:"خصم آخر بمبلغ تحدده",callback_data:"ded|manualother|"+employeeId}],[{text:"⬅️ إلغاء",callback_data:"adm|deductions"}]]});
}
function handleDeductionAdminTextV15_(chatId, text, sheets) {
  if (!isAdmin_(chatId, sheets, "Finance")) return false;
  const flowKey = deductionFlowKey_(chatId);
  const raw = PropertiesService.getScriptProperties().getProperty(flowKey); if (!raw) return false;
  let f; try { f=JSON.parse(raw); } catch(e) { PropertiesService.getScriptProperties().deleteProperty(deductionFlowKey_(chatId)); return false; }
  if (text === "❌ إلغاء" || text === "/cancel") { PropertiesService.getScriptProperties().deleteProperty(deductionFlowKey_(chatId)); sendAdminMenu_(chatId); return true; }
  if (f.step === "amount") {
    const amount = Number(String(text).replace(/[٬,]/g,""));
    if (!isFinite(amount) || amount <= 0 || amount > 1000000) { sendMessage_(chatId,"المبلغ غير صحيح. اكتب مبلغًا موجبًا بالجنيه، مثال 250."); return true; }
    f.amount=amount; f.step="reason"; PropertiesService.getScriptProperties().setProperty(flowKey,JSON.stringify(f));
    sendMessage_(chatId,"اكتب سبب الخصم بالتفصيل:"); return true;
  }
  if (f.step === "reason") {
    if (!text || text.length < 3 || text.length > 500) { sendMessage_(chatId,"اكتب سببًا واضحًا من 3 إلى 500 حرف."); return true; }
    const date=today_(), now=Utilities.formatDate(new Date(),TIME_ZONE,"yyyy-MM-dd HH:mm:ss");
    sheets.deductions.appendRow(["DD-"+Utilities.getUuid().substring(0,8).toUpperCase(),date,f.employeeId,f.employeeName,"خصم آخر",text,Number(f.amount),"يدوي","معتمد","MANUAL|"+Utilities.getUuid(),now,now,String(chatId),"اعتماد مباشر من المدير",""]);
    PropertiesService.getScriptProperties().deleteProperty(deductionFlowKey_(chatId));
    sendMessage_(f.employeeId,"💸 تم تسجيل خصم على حسابك\n\nالنوع: خصم آخر\nالسبب: "+text+"\nالمبلغ: "+Number(f.amount).toFixed(2)+" جنيه\nالتاريخ: "+date);
    sendMessage_(chatId,"✅ تم تسجيل الخصم واعتماده وإشعار الموظف."); sendAdminDeductionsMenuV15_(chatId,null,sheets); return true;
  }
  return false;
}
function createManualFixedDeductionV15_(callback, employeeId, sheets) {
  const chatId = String(callback.from && callback.from.id || "");
  const emp=findEmployee_(sheets.emp,employeeId); if(!emp) {answerCallbackQuery_(callback.id,"الموظف غير موجود.");return;}
  const date=today_(),now=Utilities.formatDate(new Date(),TIME_ZONE,"yyyy-MM-dd HH:mm:ss"),amount=getDeductionSettingV15_(sheets,"خصم_عدم_التسجيل",50);
  sheets.deductions.appendRow(["DD-"+Utilities.getUuid().substring(0,8).toUpperCase(),date,String(employeeId),emp.name,"عدم التسجيل على السيستم","عدم تسجيل الحضور على النظام",amount,"يدوي","معتمد","MANUAL|NOSYS|"+Utilities.getUuid(),now,now,String(chatId),"اعتماد مباشر من المدير",""]);
  sendMessage_(employeeId,"💸 تم تسجيل خصم على حسابك\n\nالسبب: عدم التسجيل على السيستم\nالمبلغ: "+amount+" جنيه\nالتاريخ: "+date);
  answerCallbackQuery_(callback.id,"تم تسجيل الخصم وإشعار الموظف.");
}
function handleDeductionCallbackV15_(callback, sheets, parts) {
  const action=parts[1], rowNum=Number(parts[2]);
  if (action === "manualfixed") { createManualFixedDeductionV15_(callback,parts[2],sheets); return; }
  if (action === "manualother") {
    const actorId = String(callback.from && callback.from.id || "");
    const flowKey = deductionFlowKey_(actorId);
    const raw = PropertiesService.getScriptProperties().getProperty(flowKey);
    if (raw) { const f = JSON.parse(raw); f.step = "amount"; PropertiesService.getScriptProperties().setProperty(flowKey, JSON.stringify(f)); }
    answerCallbackQuery_(callback.id, "اكتب مبلغ الخصم في رسالة جديدة.");
    sendMessage_(actorId, "اكتب مبلغ الخصم بالجنيه للموظف المحدد.\nاضغط إلغاء للتراجع.");
    return;
  }
  if (["approve","reject"].indexOf(action)<0 || !Number.isInteger(rowNum) || rowNum<2 || rowNum>sheets.deductions.getLastRow()) {answerCallbackQuery_(callback.id,"بيانات الخصم غير صحيحة.");return;}
  const r=sheets.deductions.getRange(rowNum,1,1,DEDUCTION_HEADERS.length).getDisplayValues()[0];
  if(r[8]!=="بانتظار اعتماد المدير"){answerCallbackQuery_(callback.id,"تمت مراجعة الخصم بالفعل.");return;}
  const approved=action==="approve", now=Utilities.formatDate(new Date(),TIME_ZONE,"yyyy-MM-dd HH:mm:ss");
  sheets.deductions.getRange(rowNum,9).setValue(approved?"معتمد":"مرفوض"); sheets.deductions.getRange(rowNum,12).setValue(approved?now:""); sheets.deductions.getRange(rowNum,13).setValue(String(callback.from && callback.from.id || ""));
  answerCallbackQuery_(callback.id,approved?"تم اعتماد الخصم.":"تم رفض الخصم.");
  sendMessage_(r[2],approved?"✅ اعتمدت الإدارة الخصم التالي:\n"+r[4]+"\nالسبب: "+r[5]+"\nالمبلغ: "+Number(r[6]).toFixed(2)+" جنيه":"تمت مراجعة الخصم التالي ولم يتم اعتماده:\n"+r[4]+"\nالسبب: "+r[5]);
  if(callback.message) editMessageText_(callback.message.chat.id,callback.message.message_id,String(callback.message.text||"")+"\n\nالقرار: "+(approved?"معتمد":"مرفوض"));
}
function showPendingDeductionsV15_(chatId,messageId,sheets) {
  const rows=getSheetObjects_(sheets.deductions).map(function(r,i){r.__row=i+2;return r;}).filter(function(r){return String(r["الحالة"])==="بانتظار اعتماد المدير";}).slice(0,35);
  if(!rows.length){editMessageWithKeyboard_(chatId,messageId,"لا توجد خصومات معلقة.",adminBackKeyboard_());return;}
  const kb=rows.map(function(r){return [{text:String(r["اسم الموظف"])+" | "+String(r["نوع الخصم"])+" | "+Number(r["المبلغ بالجنيه"]).toFixed(2)+" ج",callback_data:"adm|dedview|"+r.__row}];});
  kb.push([{text:"⬅️ رجوع",callback_data:"adm|deductions"}]);
  editMessageWithKeyboard_(chatId,messageId,"⏳ الخصومات بانتظار الاعتماد:",{inline_keyboard:kb});
}
function sendAdminDeductionReportV15_(chatId,sheets) {
  const month=Utilities.formatDate(new Date(),TIME_ZONE,"yyyy-MM"), rows=getSheetObjects_(sheets.deductions).filter(function(r){return normalizeDate_(r["تاريخ الواقعة"]).indexOf(month)===0;});
  const approved=rows.filter(function(r){return String(r["الحالة"])==="معتمد";}), pending=rows.filter(function(r){return String(r["الحالة"])==="بانتظار اعتماد المدير";});
  const total=approved.reduce(function(a,r){return a+(Number(r["المبلغ بالجنيه"])||0);},0);
  const abs=getSheetObjects_(sheets.absences).filter(function(r){return normalizeDate_(r["التاريخ"]).indexOf(month)===0 && String(r["الحالة"])==="غياب مؤكد";});
  let msg="📊 تقرير الخصومات — "+month+"\n\nالخصومات المعتمدة: "+approved.length+"\nإجمالي المبالغ المعتمدة: "+total.toFixed(2)+" جنيه\nخصومات بانتظار الاعتماد: "+pending.length+"\n\nأيام الغياب المؤكدة (للمحاسب): "+abs.length+" يوم/حالة\nقيمة خصم الغياب غير محسوبة بالنظام.";
  sendMessage_(chatId,msg,{inline_keyboard:[[{text:"⬅️ إدارة الخصومات",callback_data:"adm|deductions"}]]});
}
