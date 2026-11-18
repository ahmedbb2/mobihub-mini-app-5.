(() => {
  'use strict';
  const tg = window.Telegram?.WebApp;
  const API_URL = 'https://mobihub-telegram-proxy-v2.ahmedmtarek20.workers.dev/miniapp';
  const $ = (id) => document.getElementById(id);
  const titles = { requests: 'الطلبات العامة', leaves: 'طلبات الأذونات', complaints: 'شكاوي', cash: 'السلف والعهد', deductions: 'خصوماتي', devices: 'حالة الأجهزة', attendance: 'سجل الحضور والانصراف' };
  // عرض 12 ساعة (AM/PM) — للعرض فقط؛ التخزين والمقارنات تظل 24 ساعة.
  function formatTime12(value) {
    const s = String(value || '').trim();
    const m = s.match(/(\d{1,2}):(\d{2})/);
    if (!m) return s;
    let h = Number(m[1]); const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return ('0' + h).slice(-2) + ':' + m[2] + ' ' + suffix;
  }
  // عرض تاريخ+وقت بصيغة 12 ساعة؛ خلية وقت فقط (1899-12-30) تظهر كوقت فقط.
  function formatDateTime12(value) {
    const s = String(value || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
    if (!m) return formatTime12(s);
    if (m[1] === '1899' && m[2] === '12' && m[3] === '30') return formatTime12(m[4] + ':' + m[5]);
    return m[1] + '-' + m[2] + '-' + m[3] + ' ' + formatTime12(m[4] + ':' + m[5]);
  }
  let initData = '';
  let currentAttendance = null;
  let pendingUniform = false;
  let currentRole = 'employee';
  let workspaceRole = '';
  let availableWorkspaces = [];
  let switchingWorkspace = false;
  let modalRestore = null;

  function openModal(title, element) {
    const modal = $('appModal'), body = $('modalBody');
    if (modalRestore) closeModal();
    $('modalTitle').textContent = title || 'التفاصيل';
    const modalBrand = $('appModal').querySelector('.modal-header small');
    if (modalBrand) modalBrand.textContent = 'MOBIHUB · مركز الصيانة';
    $('modalMessage').classList.add('hidden');
    if (element) {
      const placeholder = document.createComment('modal-origin');
      element.parentNode.insertBefore(placeholder, element);
      modalRestore = { element, placeholder };
      body.appendChild(element);
      element.classList.remove('hidden');
    }
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    $('modalClose').focus();
  }
  function closeModal() {
    const modal = $('appModal');
    if (modalRestore) {
      const { element, placeholder } = modalRestore;
      if (placeholder.parentNode) placeholder.parentNode.insertBefore(element, placeholder);
      placeholder.remove();
      element.classList.add('hidden');
      // Dynamic manager panels are disposable; keeping them in <body> caused
      // stale hidden panels to accumulate and contributed to layered dialogs.
      if (element.classList.contains('manager-module-panel')) element.remove();
      modalRestore = null;
    }
    $('modalBody').innerHTML = '';
    $('withdrawForm').classList.add('hidden');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }
  function openRequestForm(which) {
    switchRequestForm(which);
    const ids = { leave: ['leaveForm','طلب إذن جديد'], cash: ['cashForm','طلب سلفة / عهدة'], complaint: ['complaintForm','تقديم شكوى'] };
    const item = ids[which];
    if (item) openModal(item[1], $(item[0]));
  }

  const errorMessages = {
    UNAUTHORIZED: 'تعذر التحقق من هوية Telegram. أغلق التطبيق وافتحه مرة أخرى.',
    ACCOUNT_INACTIVE: 'الحساب غير نشط أو غير مصرح له باستخدام النظام.',
    INVALID_GPS_COORDINATES: 'تعذر قراءة موقعك بشكل صحيح. فعّل خدمات الموقع وحاول مرة أخرى.',
    GPS_ACCURACY_NOT_ACCEPTED: 'دقة الموقع الحالية غير كافية. حاول من مكان مفتوح وأعد المحاولة.',
    OPEN_ATTENDANCE_EXISTS: 'لديك حضور مفتوح بالفعل ولم يتم تسجيل الانصراف.',
    ALREADY_CHECKED_IN_TODAY: 'تم تسجيل حضورك اليوم بالفعل.',
    ALREADY_CHECKED_IN: 'تم تسجيل حضورك بالفعل. حدّث حالة الحضور.',
    CHECKIN_CONFIRMATION_EXPIRED: 'انتهت مهلة تأكيد اليونيفورم. ابدأ تسجيل الحضور من جديد.',
    SHIFT_NOT_AVAILABLE: 'بيانات الوردية لم تعد متاحة. راجع المسؤول.',
    NO_OPEN_ATTENDANCE: 'لا يوجد تسجيل حضور مفتوح لتسجيل الانصراف.',
    INVALID_UNIFORM_STATUS: 'اختيار حالة اليونيفورم غير صحيح.',
    FORBIDDEN: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.', EMPLOYEE_ONLY: 'الخدمة متاحة لحسابات المهندسين فقط.',
    INVALID_REQUEST_DETAILS: 'اكتب تفاصيل الطلب (من 5 إلى 1500 حرف).', INVALID_LEAVE_REASON: 'اكتب سبب الإذن (من 5 إلى 1000 حرف).',
    INVALID_LEAVE_DATE: 'اختر تاريخ اليوم أو تاريخًا قادمًا صحيحًا.', DUPLICATE_LEAVE_OVERLAP: 'لديك طلب إذن معلق أو معتمد يتعارض مع هذه الفترة.',
    NO_ACTIVE_SHIFT_ASSIGNED: 'لا توجد وردية نشطة مسجلة لك في هذا التاريخ. راجع المسؤول.', LEAVE_OUTSIDE_SHIFT: 'وقت أو مدة الإذن خارج حدود ورديتك.',
    LEAVE_START_NOT_FUTURE: 'بداية الإذن يجب أن تكون في وقت قادم.', FULL_DAY_LEAVE_AFTER_SHIFT_START: 'لا يمكن طلب إذن يوم كامل بعد بداية الوردية.',
    LEAVE_CONFLICT_CONFIRMED_ABSENCE: 'لا يمكن اعتماد الإذن بعد تأكيد الغياب لهذا التاريخ.', REQUEST_ALREADY_REVIEWED: 'تمت مراجعة الطلب بالفعل.', LEAVE_ALREADY_REVIEWED: 'تمت مراجعة الإذن بالفعل.', INVALID_REQUEST_TYPE: 'نوع الطلب غير صحيح.', INVALID_LEAVE_TYPE: 'نوع الإذن غير صحيح.', INVALID_LEAVE_DAYS: 'عدد الأيام غير متاح.', INVALID_LEAVE_HOURS: 'مدة الإذن غير متاحة.', INVALID_LEAVE_TIME: 'وقت الإذن غير صحيح.', REQUEST_NOT_FOUND: 'الطلب غير موجود.', LEAVE_NOT_FOUND: 'طلب الإذن غير موجود.', INVALID_CASH_AMOUNT: '⚠️ المبلغ غير صحيح. اكتب مبلغًا موجبًا بالجنيه، مثال: 750.', INVALID_CASH_PURPOSE: 'اكتب الغرض بشكل أوضح، أو اضغط إلغاء.', CASH_ALREADY_REVIEWED: 'تمت مراجعة طلب السلفة بالفعل.', CASH_PAYOUT_NOT_ALLOWED: 'لا يمكن تسجيل الصرف قبل الموافقة أو تم تسجيل الصرف بالفعل.', CASH_REQUEST_NOT_FOUND: 'طلب السلفة غير موجود.', OPEN_CASH_CUSTODY: 'لا يمكن تسجيل الانصراف قبل إغلاق العهدة المفتوحة وتسوية المبلغ المتبقي.', SHEET_SCHEMA_MISMATCH: 'أعمدة الشيت لا تطابق النسخة المطلوبة. أوقف الاختبار وراجع الأعمدة.',
    INVALID_COMPLAINT: 'راجع تصنيف الشكوى والتفاصيل؛ التفاصيل مطلوبة من 10 إلى 3000 حرف.',
    COMPLAINT_NOT_FOUND: 'الشكوى غير موجودة.',
    COMPLAINT_CLOSED: 'الشكوى مغلقة ولا يمكن إضافة رد جديد.',
    INVALID_COMPLAINT_MESSAGE: 'اكتب رسالة من حرفين إلى 2000 حرف.',
    INVALID_AMOUNT: 'اكتب مبلغًا صحيحًا أكبر من صفر.',
    INVALID_DEDUCTION: 'راجع نوع الخصم والسبب والمبلغ.',
    DEDUCTION_NOT_FOUND: 'الخصم غير موجود.',
    DEDUCTION_ALREADY_REVIEWED: 'تمت مراجعة الخصم بالفعل.',
    INVALID_REWARD_REASON: 'اكتب سبب المكافأة من 3 إلى 250 حرفًا.',
    INVALID_HYGIENE_RATING: 'بيانات تقييم النظافة غير صحيحة.',
    HYGIENE_ALREADY_RATED: 'تم تسجيل تقييم النظافة لهذا المهندس في هذا اليوم بالفعل.',
    OVERTIME_UNAVAILABLE: 'خدمة الأوفر تايم غير جاهزة حاليًا. تم الحفاظ على تسجيل الحضور والانصراف.',
    EMPLOYEE_NOT_FOUND: 'المهندس غير موجود أو حسابه غير نشط.',
    INVALID_MONTH: 'صيغة الشهر غير صحيحة.',
    INVALID_DECISION: 'قرار المراجعة غير صحيح.',
    OVERTIME_WINDOW_NOT_OPEN: 'طلب الأوفر تايم متاح فقط من وقت نهاية الوردية.',
    OVERTIME_WINDOW_EXPIRED: 'انتهت مهلة طلب الأوفر تايم بعد مرور 30 دقيقة من نهاية الوردية.',
    OVERTIME_FIXED_SHIFT_ONLY: 'طلب الأوفر تايم متاح للورديات ذات موعد الانصراف المحدد فقط.',
    OVERTIME_ALREADY_REQUESTED: 'يوجد طلب أوفر تايم مسجل لهذه الوردية بالفعل.',
    OVERTIME_APPROVAL_EXPIRED: 'انتهت مهلة موافقة المدير؛ لا يمكن اعتماد أوفر تايم بأثر رجعي.',
    OVERTIME_ALREADY_REVIEWED: 'تمت مراجعة طلب الأوفر تايم بالفعل.',
    ABSENCE_ALREADY_REVIEWED: 'تمت مراجعة حالة الغياب بالفعل.',
    ABSENCE_NOT_FOUND: 'حالة الغياب غير موجودة.',
    OVERTIME_SHIFT_TIME_INVALID: 'تعذر تحديد وقت نهاية الوردية. راجع إعدادات الوردية.',
    OVERTIME_NOT_FOUND: 'طلب الأوفر تايم غير موجود.',
    INVALID_SHIFT_ID: 'معرّف الوردية غير صحيح.', INVALID_SHIFT_NAME: 'اسم الوردية مطلوب وبحد أقصى 60 حرفًا.', INVALID_SHIFT_TIME: 'أدخل وقت حضور وانصراف صحيحًا بصيغة HH:mm.', INVALID_SHIFT_GRACE: 'فترة السماح يجب أن تكون من 0 إلى 180 دقيقة.', SHIFT_ALREADY_EXISTS: 'معرّف الوردية مستخدم بالفعل.', FLEX_SHIFT_ALREADY_EXISTS: 'وردية بدون ميعاد ثابت موجودة بالفعل.', SHIFT_NOT_FOUND: 'الوردية غير موجودة.', INVALID_SHIFT_STATUS: 'حالة الوردية غير صحيحة.', SHIFT_HAS_ACTIVE_ASSIGNMENTS: 'لا يمكن إيقاف الوردية قبل إنهاء التعيينات النشطة المرتبطة بها.', INVALID_SHIFT_DAYS: 'أيام العمل غير صحيحة.'
  };

  function fail(message) {
    $('error').textContent = message;
    $('error').classList.remove('hidden');
    $('connection').textContent = 'تعذر الاتصال';
  }

  async function api(action, extra = {}) {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let response;
    let result;

    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        // Keep authentication and routing fields authoritative; caller data
        // must never be able to replace initData, workspaceRole or action.
        body: JSON.stringify({ ...extra, initData, workspaceRole, action }),
        signal: controller.signal
      });

      const raw = await response.text();
      try {
        result = raw ? JSON.parse(raw) : null;
      } catch (parseError) {
        const elapsedMs = Math.round(performance.now() - startedAt);
        const err = new Error('استجابة الخادم غير مفهومة. تحقق من اتصال الخدمة وحاول مرة أخرى.');
        err.code = 'INVALID_SERVER_RESPONSE';
        err.httpStatus = response.status;
        err.elapsedMs = elapsedMs;
        throw err;
      }
    } catch (networkError) {
      if (networkError && networkError.name === 'AbortError') {
        const err = new Error('استغرق الاتصال أكثر من 30 ثانية. تحقق من الإنترنت وحاول مرة أخرى.');
        err.code = 'API_TIMEOUT';
        throw err;
      }
      throw networkError;
    } finally {
      clearTimeout(timeoutId);
    }

    const elapsedMs = Math.round(performance.now() - startedAt);
    if (elapsedMs >= 700) console.info(`[MobiHub API] ${action}: ${elapsedMs}ms`);

    if (!response.ok || !result || result.ok !== true) {
      const code = result && result.error ? String(result.error) : `HTTP_${response.status || 0}`;
      const err = new Error(errorMessages[code] || (result && result.error) || 'تعذر تنفيذ الطلب. حاول مرة أخرى.');
      err.code = code;
      err.requestId = result && result.requestId;
      err.httpStatus = response.status;
      err.elapsedMs = elapsedMs;
      throw err;
    }
    return result.data;
  }

  function renderStats(summary) {
    const items = [['طلباتي', summary.myRequests], ['الأذونات', summary.myLeaves], ['شكاواي', summary.myComplaints], ['الشكاوى المفتوحة', summary.openComplaints]];
    $('stats').innerHTML = items.map(([label, value]) => `<div class="stat"><b>${Number(value) || 0}</b><span>${label}</span></div>`).join('');
  }

  function showAttendanceMessage(message, isError = false) {
    const el = $('attendanceMessage');
    el.textContent = message;
    el.classList.toggle('is-error', isError);
    el.classList.remove('hidden');
  }

  function renderAttendance(data) {
    currentAttendance = data;
    $('attendance').classList.remove('hidden');
    $('attendanceDate').textContent = data.date || 'اليوم';
    const open = !!data.hasOpenAttendance;
    $('attendanceStateTitle').textContent = open ? 'حضورك مسجل — لم تسجل الانصراف' : (data.checkedInToday ? 'تم تسجيل حضورك اليوم' : 'لم يتم تسجيل الحضور اليوم');
    $('attendanceStateText').textContent = open ? `وقت الحضور: ${formatTime12(data.openAttendance?.time) || '—'}` : 'تأكد من تفعيل الموقع قبل تسجيل الحضور أو الانصراف.';
    const shift = data.shift;
    $('shiftInfo').textContent = shift ? `الوردية: ${shift.name || shift.id}${shift.isFlexible ? ' · بدون موعد ثابت' : ` · ${shift.startTime || '--:--'} إلى ${shift.endTime || '--:--'} · سماح ${shift.graceMinutes} دقيقة`}` : 'لا توجد وردية محددة لليوم.';
    $('checkinBtn').disabled = open || !!data.checkedInToday || !data.assignment || !shift;
    $('checkoutBtn').disabled = !open;
    const overtime=data.overtime||null;
    const overtimePanel=$('overtimePanel');
    const overtimeButton=$('requestOvertimeBtn');
    if(overtimePanel&&overtimeButton){
      const existing=overtime?.existing;
      const canRequest=!!overtime?.canRequest;
      overtimePanel.classList.toggle('hidden',!canRequest&&!existing);
      overtimeButton.classList.toggle('hidden',!canRequest);
      overtimeButton.disabled=false;
      $('overtimeMessage').textContent=existing?`حالة الطلب: ${existing.status} · الدقائق: ${existing.minutes||0} · المستحق: ${existing.amount||0} جنيه`:canRequest?`متاح الآن. يجب اعتماد الطلب خلال ${overtime.graceMinutes||30} دقيقة من نهاية الوردية، ثم يبدأ الحساب بحد أقصى ${overtime.maxPaidMinutes||120} دقيقة.`:'';
    }
    if (open) $('checkinBtn').textContent = 'تم تسجيل الحضور';
    else $('checkinBtn').textContent = data.checkedInToday ? 'الحضور مسجل اليوم' : 'تسجيل حضور';
  }

  function getLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('جهازك لا يدعم تحديد الموقع.'));
      navigator.geolocation.getCurrentPosition(
        p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
        e => reject(new Error(e.code === 1 ? 'اسمح لتطبيق Telegram بالوصول إلى الموقع من إعدادات الهاتف.' : e.code === 2 ? 'تعذر تحديد موقعك. تأكد من تشغيل GPS.' : 'انتهت مهلة تحديد الموقع. حاول مرة أخرى.')),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    });
  }

  async function withLocation(action, button) {
    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = 'جارٍ تحديد الموقع...';
    $('attendanceMessage').classList.add('hidden');
    try {
      const location = await getLocation();
      if (action === 'attendance_checkin') {
        const result = await api(action, { location });
        pendingUniform = !!result.requiresUniformConfirmation;
        $('uniformBox').classList.toggle('hidden', !pendingUniform);
        if (pendingUniform) showAttendanceMessage(`تم التحقق من الموقع: ${result.distanceMeters} متر · الدقة ${result.accuracyMeters} متر. أكّد حالة اليونيفورم لإتمام الحضور.`);
      } else {
        const result = await api(action, { location });
        const ot=result.overtime;
        const otNote=ot&&Number(ot.amount)>0?` · أوفر تايم ${ot.minutes} دقيقة / ${ot.amount} جنيه`:ot?.status?` · ${ot.status}`:'';
        showAttendanceMessage(`تم تسجيل الانصراف بنجاح · ${formatTime12(result.time) || ''} · المسافة ${result.distanceMeters} متر.${otNote}`);
        $('uniformBox').classList.add('hidden');
        await refreshAttendance();
      }
    } catch (e) {
      showAttendanceMessage(e.message, true);
    } finally {
      button.disabled = false;
      button.textContent = oldText;
      if (currentAttendance) renderAttendance(currentAttendance);
      if (pendingUniform) $('checkinBtn').disabled = true;
    }
  }

  async function confirmUniform(status) {
    const buttons = document.querySelectorAll('[data-uniform]');
    buttons.forEach(b => b.disabled = true);
    try {
      const result = await api('attendance_confirm_uniform', { uniformStatus: status });
      pendingUniform = false;
      $('uniformBox').classList.add('hidden');
      showAttendanceMessage(`تم تسجيل الحضور بنجاح · ${result.time} · ${result.attendanceStatus}${result.lateMinutes ? ` · التأخير ${result.lateMinutes} دقيقة` : ''}.`);
      await refreshAttendance();
    } catch (e) {
      showAttendanceMessage(e.message, true);
    } finally {
      buttons.forEach(b => b.disabled = false);
    }
  }

  async function refreshAttendance() {
    const data = await api('attendance_status');
    renderAttendance(data);
    return data;
  }

  async function showAttendanceHistory() {
    $('results').classList.remove('hidden');
    $('resultTitle').textContent = titles.attendance;
    $('resultBody').textContent = 'جاري تحميل السجل...';
    openModal(titles.attendance, $('results'));
    try {
      const rows = await api('attendance_history', { limit: 30 });
      if (!rows.length) { $('resultBody').textContent = 'لا توجد سجلات حضور حتى الآن.'; return; }
      $('resultBody').innerHTML = rows.map(row => `<article class="record"><strong>${escapeHtml(row['النوع'] || 'حركة حضور')}</strong><small class="record-meta">${escapeHtml(row['التاريخ'] || '')} · ${escapeHtml(row['الوقت'] || '')}<br>${escapeHtml(row['حالة الحضور'] || '')}${row['دقائق التأخير'] ? ` · التأخير ${escapeHtml(row['دقائق التأخير'])} دقيقة` : ''}<br>المسافة: ${escapeHtml(row['المسافة بالمتر'] ?? '—')} متر · دقة GPS: ${escapeHtml(row['دقة GPS بالمتر'] ?? '—')} متر</small></article>`).join('');
    } catch (e) { $('resultBody').textContent = e.message; }
  }


  const MANAGER_ROLES = ['super_admin','admin','finance','supervisor'];
  function buildWorkspace(role, permissions) {
    // Workspace selection is authoritative for the visible shell. The role
    // still controls server permissions; it must not decide which shell renders.
    const isManager = workspaceRole === 'manager' && availableWorkspaces.includes('manager');
    const employee = $('employeeWorkspace'), manager = $('managerWorkspace'), nav = $('workspaceNav');
    const sections = {
      attendance: $('attendance'),
      requests: $('requestCenter'),
      finance: $('financeCenter'),
      stats: $('stats'),
      reviews: $('reviewCenter'),
      cashReviews: $('cashReviewCenter'),
      services: document.querySelector('main > section:not(#attendance):not(#requestCenter):not(#reviewCenter):not(#cashReviewCenter):not(#financeCenter):not(#stats):not(#management):not(#results):not(.welcome)')
    };
    // Both workspaces are distinct DOM roots. Only the sections allowed for this role are mounted.
    const mount = (root, ids) => ids.forEach(id => { const node=$(id); if(node) root.appendChild(node); });
    if(isManager) {
      $('welcomeEyebrow').textContent = 'لوحة الإدارة والتشغيل';
      manager.classList.remove('hidden'); employee.classList.add('hidden');
      mount(manager, ['reviewCenter','cashReviewCenter','financeCenter','deviceRegisterPanel','results','management']);
      $('stats').classList.add('hidden');
      $('managerDashboard').classList.remove('hidden');
      $('attendance').classList.add('hidden');
      $('homeActions').classList.add('hidden');
      $('financeCenter').classList.add('hidden');
      $('deviceRegisterPanel').classList.add('hidden');
      $('requestCenter').classList.add('hidden');
      $('reviewCenter').classList.add('hidden');
      $('cashReviewCenter').classList.add('hidden');
      $('management').classList.add('hidden');
      $('results').classList.add('hidden');
      if(role==='supervisor') {
        $('deductionAdminTab').classList.add('hidden');
        $('rewardAdminTab').classList.remove('hidden');
      } else if(['admin','super_admin','finance'].includes(role)) {
        $('deductionAdminTab').classList.remove('hidden');
        $('rewardAdminTab').classList.remove('hidden');
      }
      if(!permissions.reviewRequests) $('reviewCenter').classList.add('hidden');
      if(!permissions.finance) $('cashReviewCenter').classList.add('hidden');
      if(role==='finance') $('attendance').classList.add('hidden');
      nav.innerHTML = [
        ['stats','نظرة عامة','▦'],['reviewCenter','مراجعة الطلبات','✓'],
        ['cashReviewCenter','السلف والعهد','ج.م'],['financeCenter','الخصومات والمكافآت','★']
      ].filter(([id])=>{const n=$(id);return n&&!n.classList.contains('hidden')}).map(([id,label,icon])=>`<button type="button" data-nav-target="${id}"><span>${icon}</span>${label}</button>`).join('');
    } else {
      $('welcomeEyebrow').textContent = 'مساحة المهندس';
      employee.classList.remove('hidden'); manager.classList.add('hidden');
      mount(employee, ['stats','homeActions','attendance','requestCenter','financeCenter','deviceRegisterPanel','results']);
      $('managerDashboard').classList.add('hidden');
      // The manager workspace hides #stats; restore it for the engineer view.
      $('stats').classList.remove('hidden');
      // The manager workspace hides this card grid. Always restore it when returning
      // to the engineer workspace (especially for dual-role Telegram accounts).
      $('homeActions').classList.remove('hidden');
      $('requestCenter').classList.add('hidden');
      $('financeCenter').classList.add('hidden');
      $('deviceRegisterPanel').classList.add('hidden');
      $('reviewCenter').classList.add('hidden'); $('cashReviewCenter').classList.add('hidden'); $('management').classList.add('hidden');
      $('deductionAdminTab').classList.add('hidden'); $('rewardAdminTab').classList.add('hidden');
      $('deductionAdminView').classList.add('hidden'); $('rewardAdminView').classList.add('hidden');
      // Employee navigation mirrors the legacy bot keyboard; no secondary scroll navigation.
      nav.innerHTML = '';
      nav.classList.add('hidden');
      // #stats holds the personal overview; never hide it in the employee view.
      $('stats').classList.remove('hidden');
      $('attendance').classList.add('hidden');
    }
    if (isManager) {
      // The manager dashboard is the only default landing surface. Operational
      // panels open on demand in the modal sheet, never below the dashboard.
      nav.innerHTML = '';
      nav.classList.add('hidden');
    }
  }
  /* Tiles hidden by the Super Admin are removed from the home grid.
   * A missing list means "no restrictions" so old hubs keep working. */
  function applyVisibleButtons(list) {
    const all = document.querySelectorAll('[data-home-action]');
    if (!Array.isArray(list) || !list.length) {
      all.forEach(el => el.classList.remove('is-hidden-by-admin'));
      return;
    }
    const allowed = new Set(list);
    all.forEach(el => {
      const key = el.getAttribute('data-home-action');
      // device-register keeps its own permission logic, never force-shown.
      if (key === 'device-register') return;
      el.classList.toggle('is-hidden-by-admin', !allowed.has(key));
    });
  }

  function applyWorkspaceProfile(data) {
    currentRole = data.profile.role || 'employee';
    const roleDefaultWorkspace = MANAGER_ROLES.includes(currentRole) ? 'manager' : 'employee';
    availableWorkspaces = Array.isArray(data.profile.availableWorkspaces)
      ? data.profile.availableWorkspaces : [data.profile.workspace || roleDefaultWorkspace];
    const requestedWorkspace = data.profile.workspace || workspaceRole || roleDefaultWorkspace;
    workspaceRole = availableWorkspaces.includes(requestedWorkspace)
      ? requestedWorkspace : roleDefaultWorkspace;

    $('userName').textContent = data.profile.name;
    // Show the real job title from the employees sheet (e.g. «مهندس هارد وير»,
    // «مسئول استلام», «محاسب») instead of a generic role word.
    const roleNames = { employee: 'فني', supervisor: 'مشرف', admin: 'مدير', finance: 'مالية', super_admin: 'مدير النظام' };
    const jobTitle = String(data.profile.job || '').trim();
    $('userRole').textContent = jobTitle || roleNames[currentRole] || currentRole;
    $('userRole').classList.toggle('is-job', !!jobTitle);
    applyVisibleButtons(data.visibleButtons);
    $('workspaceSwitch').classList.toggle('hidden', !(availableWorkspaces.includes('employee') && availableWorkspaces.includes('manager')));
    $('workspaceSwitch').textContent = workspaceRole === 'manager' ? 'لوحة المهندس' : 'لوحة المدير';
    $('workspaceSwitch').setAttribute('aria-label', workspaceRole === 'manager' ? 'التحويل إلى لوحة المهندس' : 'التحويل إلى لوحة المدير');

    // The overview owns #stats; legacy counters are hidden by CSS.
    renderEmployeeOverview();
    // Task badge comes from bootstrap so it is correct on first paint.
    refreshTasksBadge(data.tasks || { open: 0, overdue: 0 });
    buildWorkspace(currentRole, data.permissions || {});
    // Manager panels stay hidden on the landing page and are moved into a modal only when opened.
    if (workspaceRole === 'manager') {
      // The console is the only dashboard. Never paint the legacy tiles first:
      // that caused a visible flash of the old layout before the new one loaded.
      loadManagerDashboard();
    }
  }

  const managerModuleTitles = {
    daily:'المتابعة اليومية', staff:'شؤون المهندسين', shifts:'إدارة الورديات', requests:'طلبات المهندسين والتواصل',
    tasks:'المهام والتسكات', parts:'قطع الغيار', procurement:'المشتريات والمخزون',
    finance:'الإدارة المالية', overtime:'الأوفر تايم', devices:'الأجهزة والصيانة', delivery:'الجودة والتسليم', system:'التقارير والنظام', notifications:'مركز الإشعارات', notificationMatrix:'التحكم في الإشعارات', buttonsMatrix:'التحكم في الأزرار', managers:'إدارة المديرين'
  };
  let managerDashboardCache = null;
  function renderManagerDashboard(data) {
    managerDashboardCache = data;
    $('managerDashboardDate').textContent = `اليوم ${data.date || ''} · تقرير الشهر ${data.month || ''}`;
    const m = data.metrics || {};
    const tiles = [
      ['المهندسون النشطون',m.activeEmployees,'users','staff'],['الموجودون الآن',m.presentNow,'user-check','daily'],
      ['طلبات معلقة',m.pendingRequests + m.pendingLeaves,'inbox','requests'],['طلبات مالية معلقة',m.pendingCash,'wallet','finance'],
      ['أوفر تايم بانتظار الموافقة',m.pendingOvertime,'hourglass','overtime'],['شكاوى مفتوحة',m.openComplaints,'message-circle','requests'],['أجهزة تحت المتابعة',m.activeDevices,'smartphone','devices']
    ].filter(item => data.modules?.[item[3]] === true);
    $('managerMetrics').innerHTML = tiles.map(([label,value,ico])=>`<article class="manager-metric"><span class="manager-metric-icon">${({users:'♙','user-check':'✓',inbox:'▤',wallet:'ج.م','message-circle':'✉',hourglass:'◷',smartphone:'▣'})[ico]}</span><b>${Number(value)||0}</b><small>${label}</small></article>`).join('');
    const allowed = data.modules || {};
    $('managerModules').querySelectorAll('[data-manager-module]').forEach(btn=>{
      const permitted = allowed[btn.dataset.managerModule] === true;
      // Keep the complete module map visible; unavailable modules are clearly
      // disabled instead of silently disappearing from the manager dashboard.
      btn.disabled = !permitted;
      btn.classList.toggle('is-unavailable', !permitted);
      btn.setAttribute('aria-disabled', String(!permitted));
      btn.title = permitted ? '' : 'هذه الوحدة غير متاحة حسب صلاحية الحساب';
    });
    const complaints = data.recentComplaints || [];
    $('managerComplaintSection').classList.toggle('hidden', data.modules?.requests !== true);
    const warningBox=$('managerDashboardMessage');
    if(Array.isArray(data.dataWarnings)&&data.dataWarnings.length){warningBox.textContent='تنبيه: تعذر قراءة بعض أوراق البيانات: '+data.dataWarnings.join('، ');warningBox.classList.remove('hidden');}else{warningBox.classList.add('hidden');}
    $('managerRecentComplaints').innerHTML = complaints.length ? complaints.map(c=>`<article class="manager-complaint"><div><b>${escapeHtml(c.id || 'شكوى')} · ${escapeHtml(c.type || 'شكوى')}</b><small>${escapeHtml(c.employee || 'مهندس')} · ${escapeHtml(c.date || '')}</small></div><span class="status-pill">${escapeHtml(c.status || 'جديدة')}</span><p>${escapeHtml(c.details || '')}</p><button type="button" class="secondary-btn" data-manager-complaint="${escapeHtml(c.id)}">فتح الشكوى</button></article>`).join('') : '<p class="muted">لا توجد شكاوى مفتوحة حاليًا.</p>';
    $('managerRecentComplaints').querySelectorAll('[data-manager-complaint]').forEach(b=>b.addEventListener('click',()=>{ $('results').classList.remove('hidden'); $('resultTitle').textContent='محادثة الشكوى'; openModal('محادثة الشكوى',$('results')); openComplaint(b.dataset.managerComplaint); }));
  }
  function initManagerEnterpriseShell() {
    document.body.classList.add('manager-enterprise');
    const workspace = $('managerWorkspace');
    if (workspace) workspace.setAttribute('data-admin-layout', 'enterprise');
    const dashboard = $('managerDashboard');
    if (dashboard) dashboard.setAttribute('aria-label', 'مركز إدارة MobiHub');
    const grid = $('managerModules');
    if (grid && !grid.dataset.enterpriseReady) {
      grid.dataset.enterpriseReady = 'true';
      grid.setAttribute('aria-label', 'التنقل بين أقسام الإدارة');
    }
  }

  async function loadManagerDashboard() {
    if (workspaceRole !== 'manager') return;
    // Enterprise shell is presentation-only: existing module handlers,
    // permission checks, API contracts and data sources remain unchanged.
    initManagerEnterpriseShell();
    const host = $('managerDashboard');
    if (!host) return;
    await renderConsoleInto(host);
  }

  async function renderConsoleInto(host) {
    if (!host) return;

    // The console owns its own slot so the module grid below survives.
    let slot = host.querySelector('#consoleSlot');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'consoleSlot';
      // Insert before the module grid when present, otherwise append.
      const modules = host.querySelector('#managerModules');
      if (modules && modules.parentNode === host) host.insertBefore(slot, modules);
      else host.appendChild(slot);
    }
    slot.innerHTML = '<div class="manager-loading">جاري تحميل اللوحة...</div>';

    try {
      const data = await api('console_overview');
      consoleState.data = data;

      // openManagerModule() reads this cache for permission checks. The legacy
      // renderer used to be its only writer; without this every button failed.
      managerDashboardCache = {
        date: data.date,
        month: data.month,
        role: data.role,
        modules: data.modules || {},
        metrics: {
          activeEmployees: data.staff ? data.staff.active : null,
          presentNow: data.attendance ? data.attendance.presentNow : null,
          checkedInToday: data.attendance ? data.attendance.checkedInToday : null,
          pendingRequests: data.requests ? data.requests.pendingRequests : null,
          pendingLeaves: data.requests ? data.requests.pendingLeaves : null,
          pendingCash: data.money ? data.money.pendingAdvances : null,
          openComplaints: data.requests ? data.requests.openComplaints : null,
          activeDevices: data.operations ? data.operations.activeDevices : null,
          pendingAbsences: data.requests ? data.requests.pendingAbsences : null,
          pendingOvertime: data.requests ? data.requests.pendingOvertime : null
        },
        monthlyReport: data.monthlyReport || null
      };

      drawConsoleInto(slot);
      groupModuleGrid();
      applyModulePermissions();
      // Hide the legacy dashboard chrome: the hero, the "نظرة عامة" header and
      // the old metric tiles. They would otherwise stack above the console.
      const legacyHero = host.querySelector('.manager-hero');
      if (legacyHero) legacyHero.classList.add('hidden');
      const legacyHead = host.querySelector('.manager-dashboard-head');
      if (legacyHead) legacyHead.classList.add('hidden');
      const metrics = $('managerMetrics');
      if (metrics) metrics.classList.add('hidden');
      const sectionHead = host.querySelector('.manager-section-head');
      if (sectionHead) sectionHead.classList.add('hidden');
      // Keep the legacy date line in sync (it is hidden but useful if shown later).
      const dateEl = $('managerDashboardDate');
      if (dateEl) dateEl.textContent = 'اليوم ' + (data.date || '') + ' · ' + (data.month || '');
    } catch (e) {
      slot.innerHTML = '<div class="manager-load-error">' + escapeHtml(e.message) + '</div>';
    }
  }

  async function loadManagerDashboardLegacy() {
    if (workspaceRole !== 'manager') return;
    const box=$('managerMetrics'); if(box) box.innerHTML='<div class="manager-loading">جاري تحديث مؤشرات الإدارة...</div>';
    try { const data=await api('manager_dashboard'); renderManagerDashboard(data); }
    catch(e) { if(box) box.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`; }
  }
  function managerPanel(title, html) {
    const panel=document.createElement('section'); panel.className='manager-module-panel';
    panel.innerHTML=`<div class="manager-module-heading"><div><small>MOBIHUB MANAGEMENT</small><h3>${escapeHtml(title)}</h3></div><button type="button" class="modal-close" data-manager-panel-close aria-label="إغلاق">×</button></div><div class="manager-module-content">${html}</div>`;
    panel.querySelector('[data-manager-panel-close]').addEventListener('click',closeModal);
    document.body.appendChild(panel); openModal(title,panel); return panel;
  }
  async function openManagerModule(module) {
    const permitted=managerDashboardCache?.modules?.[module];
    if(!permitted) { if(tg?.showAlert) tg.showAlert('هذه الخدمة غير متاحة حسب صلاحية حسابك.'); return; }
    const title=managerModuleTitles[module] || 'الإدارة';
    if(module==='tasks') { closeModal(); await openTaskAdminPanel(); return; }
    if(module==='parts') { closeModal(); await openPartAdminPanel(); return; }
    if(module==='procurement') { closeModal(); await openProcurementPanel(); return; }
    if(module==='notificationMatrix') { closeModal(); await openNotificationMatrix(); return; }
    if(module==='buttonsMatrix') { closeModal(); await openButtonsMatrix(); return; }
    if(module==='requests') {
      const panel=managerPanel(title,'<button type="button" class="manager-action-card" id="managerOpenPendingRequests"><b>مراجعة الطلبات والأذونات</b><small>مراجعة الطلبات المقدمة من المهندسين</small></button><button type="button" class="manager-action-card" id="managerOpenComplaints"><b>شكاوى المهندسين</b><small>فتح الشكاوى ومتابعة الردود والحالات</small></button>');
      panel.querySelector('#managerOpenPendingRequests').addEventListener('click',async()=>{closeModal();openModal('مراجعة الطلبات والأذونات',$('reviewCenter'));await loadReviews();});
      panel.querySelector('#managerOpenComplaints').addEventListener('click',()=>{closeModal();showList('complaints');});
      return;
    }
    if(module==='finance') { closeModal(); await openFinanceCenter(); return; }
    if(module==='financeLegacy') {
      const panel=managerPanel(title,'<button type="button" class="manager-action-card" id="managerOpenCash"><b>السلف والعهد</b><small>الموافقة والصرف ومراجعة التسويات</small></button><button type="button" class="manager-action-card" id="managerOpenFinance"><b>الخصومات والمكافآت</b><small>إضافة ومراجعة الخصومات والمكافآت وتقييم النظافة</small></button>');
      panel.querySelector('#managerOpenCash').addEventListener('click',async()=>{closeModal();openModal('مراجعة السلف والعهد',$('cashReviewCenter'));await loadCashReviews();});
      panel.querySelector('#managerOpenFinance').addEventListener('click',async()=>{closeModal();$('financeCenter').classList.remove('hidden');openModal('الخصومات والمكافآت',$('financeCenter'));$('deductionAdminTab').click();});
      return;
    }
    if(module==='overtime') {
      const panel=managerPanel(title,'<p class="muted">جاري تحميل سجل الأوفر تايم...</p>');
      const content=panel.querySelector('.manager-module-content');
      try {
        const rows=await api('list',{entity:'overtime'});
        const canDecide=['super_admin','admin'].includes(currentRole);
        content.innerHTML=`<div class="manager-mini-kpis"><div><b>${rows.filter(r=>String(r['الحالة']||'')==='بانتظار موافقة المدير').length}</b><small>طلبات بانتظار الموافقة</small></div><div><b>${rows.reduce((sum,r)=>sum+(Number(r['المبلغ بالجنيه'])||0),0)}</b><small>إجمالي المبالغ المسجلة بالجنيه</small></div></div><p class="manager-note">حسب قواعد V46: أول 30 دقيقة بعد نهاية الوردية غير مدفوعة، ثم 1 جنيه لكل دقيقة، بحد أقصى 120 دقيقة. الاعتماد يجب أن يتم قبل بداية احتساب الوقت الإضافي.</p><h4>سجل الأوفر تايم</h4>${rows.slice().reverse().map(r=>{const pending=String(r['الحالة']||'')==='بانتظار موافقة المدير';return `<article class="manager-row"><div><b>${escapeHtml(r['اسم المهندس']||'مهندس')} · ${escapeHtml(r['رقم الطلب']||'')}</b><small>${escapeHtml(r['تاريخ الوردية']||'')} · نهاية الوردية ${escapeHtml(r['موعد نهاية الوردية']||'—')}</small></div><span class="status-pill">${escapeHtml(r['الحالة']||'غير محدد')}</span><small>الدقائق: ${Number(r['دقائق الأوفر تايم'])||0} · المبلغ: ${Number(r['المبلغ بالجنيه'])||0} جنيه</small>${pending&&canDecide?`<div class="manager-row-actions"><button type="button" class="primary-btn" data-overtime-decision="approve" data-overtime-id="${escapeHtml(r['رقم الطلب']||'')}">موافقة</button><button type="button" class="secondary-btn" data-overtime-decision="reject" data-overtime-id="${escapeHtml(r['رقم الطلب']||'')}">رفض</button></div>`:''}</article>`;}).join('')||'<p class="muted">لا توجد طلبات أوفر تايم مسجلة.</p>'}`;
        content.querySelectorAll('[data-overtime-decision]').forEach(btn=>btn.addEventListener('click',async()=>{
          btn.disabled=true;
          try { await api('overtime_decide',{requestId:btn.dataset.overtimeId,decision:btn.dataset.overtimeDecision}); if(tg?.showAlert)tg.showAlert(btn.dataset.overtimeDecision==='approve'?'تم اعتماد طلب الأوفر تايم.':'تم رفض طلب الأوفر تايم.'); closeModal(); await loadManagerDashboard(); openManagerModule('overtime'); }
          catch(e){if(tg?.showAlert)tg.showAlert(e.message);btn.disabled=false;}
        }));
      } catch(e) { content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`; }
      return;
    }
    if(module==='notifications') {
      const canManageNotifications=['super_admin','admin'].includes(currentRole);
      const panel=managerPanel(title,'<p class="muted">جاري تحميل سجل الإشعارات والإعدادات...</p>'); const content=panel.querySelector('.manager-module-content');
      try {
        const [logs,settings,employees]=await Promise.all([api('list',{entity:'notifications'}),api('list',{entity:'notificationSettings'}),canManageNotifications?api('list',{entity:'employees'}):Promise.resolve([])]);
        const sendForm=canManageNotifications?`<form id="managerNoticeForm" class="manager-staff-form"><h4>إرسال إشعار للمهندسين</h4><label>المستلم<select name="recipient"><option value="all">جميع المهندسين النشطين</option>${employees.filter(e=>String(e['حالة الحساب']||'نشط')==='نشط'&&String(e['الحالة']||'نشط')==='نشط').map(e=>`<option value="${escapeHtml(e['Chat ID'])}">${escapeHtml(e['اسم الموظف']||e['Chat ID'])}</option>`).join('')}</select></label><label>نص الإشعار<textarea name="message" rows="4" maxlength="3900" required placeholder="اكتب التنبيه الذي تريد إرساله..."></textarea></label><button class="primary-btn" type="submit">إرسال الإشعار</button><p class="manager-form-error hidden" id="managerNoticeResult"></p></form>`:'<p class="manager-note">صلاحية المشرف تتيح الاطلاع على السجل والإعدادات فقط. إرسال الإشعارات وتغيير الإعدادات متاحان للمدير وSuper Admin.</p>';
        content.innerHTML=`${sendForm}${canManageNotifications?`<div class="notification-tools"><button type="button" class="primary-btn" id="notificationsEnableAll">تفعيل كل الإشعارات</button><button type="button" class="secondary-btn" id="notificationsTest">إرسال رسالة اختبار</button></div>`:''}<h4>إعدادات التنبيه</h4>${settings.map(r=>{const enabled=String(r['القيمة']||'').toUpperCase()==='TRUE';return `<article class="manager-row"><div><b>${escapeHtml(r['الإعداد']||'')}</b><small>${escapeHtml(r['الوصف']||'')}</small></div>${canManageNotifications?`<label class="manager-switch"><input type="checkbox" data-notification-setting="${escapeHtml(r['الإعداد'])}" ${enabled?'checked':''}><span>${enabled?'مفعل':'متوقف'}</span></label>`:`<span class="status-pill">${enabled?'مفعل':'متوقف'}</span>`}</article>`;}).join('')||'<p class="muted">لا توجد إعدادات مسجلة.</p>'}<h4>سجل الإشعارات — آخر 30</h4>${logs.slice(-30).reverse().map(r=>`<article class="manager-row"><b>${escapeHtml(r['نوع الإشعار']||'إشعار')}</b><span class="status-pill">${escapeHtml(r['الحالة']||'')}</span><small>${escapeHtml(r['المستلم']||'')} · ${escapeHtml(r['التاريخ والوقت']||'')}</small></article>`).join('')||'<p class="muted">لا توجد سجلات إشعارات.</p>'}`;
        if(canManageNotifications) {
          content.querySelector('#managerNoticeForm').addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget,btn=form.querySelector('button[type=submit]'),result=form.querySelector('#managerNoticeResult');btn.disabled=true;result.classList.add('hidden');try{const fd=new FormData(form);const res=await api('notification_send',{recipient:fd.get('recipient'),message:fd.get('message')});result.textContent=`تم الإرسال إلى ${res.sent} مهندس، وتعذر الإرسال إلى ${res.failed}.`;result.classList.remove('hidden');form.elements.message.value='';}catch(e){result.textContent=e.message;result.classList.remove('hidden');}finally{btn.disabled=false;}});
          content.querySelectorAll('[data-notification-setting]').forEach(input=>input.addEventListener('change',async()=>{input.disabled=true;try{await api('notification_setting',{key:input.dataset.notificationSetting,enabled:input.checked});input.nextElementSibling.textContent=input.checked?'مفعل':'متوقف';}catch(e){input.checked=!input.checked;if(tg?.showAlert)tg.showAlert(e.message);}finally{input.disabled=false;}}));
          const enableAll=content.querySelector('#notificationsEnableAll');
          if(enableAll) enableAll.addEventListener('click',async()=>{
            enableAll.disabled=true;
            try{
              const res=await api('notifications_enable_all');
              if(tg?.showAlert) tg.showAlert(`تم تفعيل ${res.enabled} نوع إشعار.`);
              content.querySelectorAll('[data-notification-setting]').forEach(i=>{i.checked=true;if(i.nextElementSibling)i.nextElementSibling.textContent='مفعل';});
            }catch(e){if(tg?.showAlert)tg.showAlert(e.message);}
            finally{enableAll.disabled=false;}
          });
          const testBtn=content.querySelector('#notificationsTest');
          if(testBtn) testBtn.addEventListener('click',async()=>{
            testBtn.disabled=true;
            try{
              const res=await api('notifications_test');
              if(tg?.showAlert) tg.showAlert(res.message||(res.delivered?'تم الإرسال.':'تعذر الإرسال.'));
            }catch(e){if(tg?.showAlert)tg.showAlert(e.message);}
            finally{testBtn.disabled=false;}
          });
        }
      } catch(e) { content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`; } return;
    }
    if(module==='managers') {
      const panel=managerPanel(title,'<p class="muted">جاري تحميل حسابات المديرين...</p>'); const content=panel.querySelector('.manager-module-content');
      try {
        const rows=await api('list',{entity:'managers'});
        content.innerHTML=`<form id="managerAdminForm" class="manager-staff-form"><h4>إضافة مدير</h4><label>Telegram Chat ID<input name="chatId" inputmode="numeric" pattern="[0-9]{5,20}" required></label><label>اسم المدير<input name="name" maxlength="80" required></label><label>الصلاحية<select name="role"><option>Admin</option><option>Finance</option><option>Supervisor</option></select></label><button type="submit" class="primary-btn">إضافة المدير</button></form><h4>المديرون الحاليون</h4>${rows.map(r=>`<article class="manager-row"><div><b>${escapeHtml(r['اسم المدير']||'مدير')}</b><small>Chat ID: ${escapeHtml(r['Chat ID']||'')} · ${escapeHtml(r['الصلاحية']||'')}</small></div><span class="status-pill">${escapeHtml(r['الحالة']||'')}</span><div class="manager-row-actions"><select data-manager-role="${escapeHtml(r['Chat ID'])}"><option ${r['الصلاحية']==='Admin'?'selected':''}>Admin</option><option ${r['الصلاحية']==='Finance'?'selected':''}>Finance</option><option ${r['الصلاحية']==='Supervisor'?'selected':''}>Supervisor</option></select><button type="button" class="secondary-btn" data-manager-status="${escapeHtml(r['Chat ID'])}" data-next-status="${r['الحالة']==='نشط'?'موقوف':'نشط'}">${r['الحالة']==='نشط'?'إيقاف':'تفعيل'}</button></div></article>`).join('')||'<p class="muted">لا يوجد مديرون إضافيون.</p>'}`;
        content.querySelector('#managerAdminForm').addEventListener('submit',async ev=>{ev.preventDefault();const f=ev.currentTarget,b=f.querySelector('button');b.disabled=true;try{const fd=new FormData(f);await api('manager_create',Object.fromEntries(fd.entries()));closeModal();await loadManagerDashboard();openManagerModule('managers');if(tg?.showAlert)tg.showAlert('تمت إضافة المدير.');}catch(e){if(tg?.showAlert)tg.showAlert(e.message);b.disabled=false;}});
        content.querySelectorAll('[data-manager-role]').forEach(sel=>sel.addEventListener('change',async()=>{sel.disabled=true;try{await api('manager_update',{chatId:sel.dataset.managerRole,role:sel.value});}catch(e){if(tg?.showAlert)tg.showAlert(e.message);}finally{sel.disabled=false;}}));
        content.querySelectorAll('[data-manager-status]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;try{await api('manager_update',{chatId:btn.dataset.managerStatus,status:btn.dataset.nextStatus});closeModal();openManagerModule('managers');}catch(e){if(tg?.showAlert)tg.showAlert(e.message);btn.disabled=false;}}));
      } catch(e) { content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`; } return;
    }
    const panel=managerPanel(title,'<p class="muted">جاري تحميل البيانات من Google Sheets...</p>');
    const content=panel.querySelector('.manager-module-content');
    try {
      if(module==='daily') {
        const dash=managerDashboardCache||{}; const [rows,absences,overtimeRows]=await Promise.all([api('list',{entity:'attendance'}),api('list',{entity:'absences'}),api('list',{entity:'overtime'})]);
        const day=dash.date; const today=rows.filter(r=>String(r['التاريخ']||'').slice(0,10)===day);
        const latest={}; today.forEach(r=>{const id=String(r['Chat ID']||'');if(id&&!latest[id])latest[id]=r;});
        const records=Object.values(latest);
        const canReviewAbsence=['super_admin','admin','supervisor'].includes(currentRole);
        content.innerHTML=`<div class="manager-mini-kpis"><div><b>${records.filter(r=>String(r['النوع'])==='حضور').length}</b><small>حضور مفتوح حسب آخر حركة</small></div><div><b>${absences.filter(r=>/انتظار|مراجعة|معلق/.test(String(r['الحالة']||r['قرار المدير']||''))).length}</b><small>حالات غياب للمراجعة</small></div><div><b>${overtimeRows.filter(r=>String(r['الحالة']||'')==='بانتظار موافقة المدير').length}</b><small>طلبات أوفر تايم معلقة</small></div></div><h4>حركات اليوم</h4>${records.length?records.map(r=>`<article class="manager-row"><b>${escapeHtml(r['اسم الموظف']||'مهندس')}</b><span>${escapeHtml(r['النوع']||'')}</span><small>${escapeHtml(formatTime12(r['الوقت'])||'')} · ${escapeHtml(r['حالة الحضور']||'')}</small></article>`).join(''):'<p class="muted">لا توجد حركات حضور مسجلة اليوم.</p>'}<h4>مراجعة الغياب</h4>${absences.slice(-20).reverse().map(r=>{const pending=String(r['الحالة']||'').trim()==='بانتظار مراجعة المدير';return `<article class="manager-row"><b>${escapeHtml(r['اسم الموظف']||'مهندس')}</b><span>${escapeHtml(r['الحالة']||r['قرار المدير']||'غير محدد')}</span><small>${escapeHtml(r['التاريخ']||'')} · موعد الحضور: ${escapeHtml(formatTime12(r['موعد الحضور'])||'—')} · اكتشاف: ${escapeHtml(formatTime12(r['وقت اكتشاف الحالة'])||'—')}</small>${pending&&canReviewAbsence?`<div class="manager-row-actions"><button type="button" class="primary-btn" data-absence-decision="confirm" data-absence-chat="${escapeHtml(r['Chat ID']||'')}" data-absence-date="${escapeHtml(String(r['التاريخ']||'').slice(0,10))}">تأكيد الغياب</button><button type="button" class="secondary-btn" data-absence-decision="excuse" data-absence-chat="${escapeHtml(r['Chat ID']||'')}" data-absence-date="${escapeHtml(String(r['التاريخ']||'').slice(0,10))}">ليس غائبًا</button></div>`:''}</article>`;}).join('')||'<p class="muted">لا توجد سجلات غياب.</p>'}<h4>آخر طلبات الأوفر تايم</h4>${overtimeRows.slice(-10).reverse().map(r=>`<article class="manager-row"><b>${escapeHtml(r['اسم المهندس']||'مهندس')}</b><span>${escapeHtml(r['الحالة']||'')}</span><small>${escapeHtml(r['تاريخ الوردية']||'')} · ${Number(r['دقائق الأوفر تايم'])||0} دقيقة · ${Number(r['المبلغ بالجنيه'])||0} جنيه</small></article>`).join('')||'<p class="muted">لا توجد طلبات أوفر تايم.</p>'}`;
        content.querySelectorAll('[data-absence-decision]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;try{await api('absence_decide',{chatId:btn.dataset.absenceChat,date:btn.dataset.absenceDate,decision:btn.dataset.absenceDecision});if(tg?.showAlert)tg.showAlert(btn.dataset.absenceDecision==='confirm'?'تم تأكيد الغياب وإبلاغ الموظف.':'تم تسجيل القرار: ليس غائبًا.');closeModal();await loadManagerDashboard();openManagerModule('daily');}catch(e){if(tg?.showAlert)tg.showAlert(e.message);btn.disabled=false;}}));
      } else if(module==='shifts') {
        const renderShifts = async () => {
          const [shifts,assignments] = await Promise.all([api('list',{entity:'shifts'}),api('list',{entity:'assignments'})]);
          const today = managerDashboardCache?.date || new Date().toISOString().slice(0,10);
          const activeCount = id => assignments.filter(a => String(a['Shift ID']||'').trim()===id && String(a['الحالة']||'نشط').trim()==='نشط' && (!String(a['تاريخ النهاية']||'').trim() || String(a['تاريخ النهاية']).slice(0,10)>=today)).length;
          content.innerHTML = `<button type="button" class="primary-btn" id="managerAddShift">＋ إضافة وردية</button><p class="manager-note">إدارة الورديات الثابتة والمرنة. لا يمكن إيقاف وردية مرتبطة بتعيينات سارية أو مستقبلية.</p><div class="manager-list-head"><b>${shifts.length} وردية مسجلة</b></div>${shifts.map(r=>{const id=String(r['Shift ID']||'');const active=String(r['الحالة']||'نشط').trim()==='نشط';const flex=id==='FLEX_NO_FIXED_TIME'||(!String(r['موعد الحضور']||'').trim()&&!String(r['موعد الانصراف']||'').trim());return `<article class="manager-row"><div><b>${escapeHtml(r['اسم الوردية']||id)}</b><small>المعرّف: ${escapeHtml(id)}<br>${flex?'بدون موعد ثابت':`${escapeHtml(formatTime12(r['موعد الحضور'])||'—')} إلى ${escapeHtml(formatTime12(r['موعد الانصراف'])||'—')}`} · سماح ${Number(r['فترة السماح بالدقائق'])||0} دقيقة<br>التعيينات النشطة: ${activeCount(id)}</small></div><span class="status-pill">${active?'نشط':'غير نشط'}</span><div class="manager-row-actions"><button type="button" class="secondary-btn" data-shift-edit="${escapeHtml(id)}">تعديل</button><button type="button" class="secondary-btn" data-shift-toggle="${escapeHtml(id)}" data-next-status="${active?'غير نشط':'نشط'}">${active?'إيقاف':'تفعيل'}</button></div></article>`;}).join('')||'<p class="muted">لا توجد ورديات مسجلة بعد.</p>'}`;
          const reopenShiftCenter = async () => { closeModal(); await loadManagerDashboard(); openManagerModule('shifts'); };
          content.querySelector('#managerAddShift').addEventListener('click',()=>openManagerShiftForm('create',null,reopenShiftCenter));
          content.querySelectorAll('[data-shift-edit]').forEach(btn=>btn.addEventListener('click',()=>openManagerShiftForm('edit',shifts.find(x=>String(x['Shift ID'])===btn.dataset.shiftEdit),reopenShiftCenter))); 
          content.querySelectorAll('[data-shift-toggle]').forEach(btn=>btn.addEventListener('click',async()=>{
            const next=btn.dataset.nextStatus;
            if(next==='غير نشط'&&!confirm('تأكيد إيقاف الوردية؟ لن يمكن إيقافها إذا كان لها تعيين ساري.')) return;
            btn.disabled=true;
            try { await api('shift_status',{shiftId:btn.dataset.shiftToggle,status:next}); await renderShifts(); if(tg?.showAlert)tg.showAlert(next==='نشط'?'تم تفعيل الوردية.':'تم إيقاف الوردية.'); }
            catch(e){if(tg?.showAlert)tg.showAlert(e.message);btn.disabled=false;}
          }));
        };
        await renderShifts();
      } else if(module==='staff') {
        const [rows,assignments,shifts]=await Promise.all([api('list',{entity:'employees'}),api('list',{entity:'assignments'}),api('list',{entity:'shifts'})]);
        const shiftNames=Object.fromEntries(shifts.map(x=>[String(x['Shift ID']||''),String(x['اسم الوردية']||x['اسم الشيفت']||x['الاسم']||'وردية')]));
        content.innerHTML=`<button type="button" class="primary-btn" id="managerAddEmployee">＋ إضافة مهندس</button><div class="manager-list-head"><b>${rows.length} حساب ظاهر (حتى آخر 100 سجل)</b><input id="managerEmployeeSearch" type="search" placeholder="ابحث بالاسم أو Chat ID"></div><div id="managerEmployeeRows">${rows.map(r=>{const id=String(r['Chat ID']||'');const active=String(r['حالة الحساب']||r['الحالة']||'نشط')==='نشط';const assigned=assignments.filter(a=>String(a['Chat ID']||'')===id&&String(a['الحالة']||'نشط')==='نشط').map(a=>shiftNames[String(a['Shift ID']||'')]||a['Shift ID']).join('، ');return `<article class="manager-row manager-employee-row"><div><b>${escapeHtml(r['اسم الموظف']||'بدون اسم')}</b><small>${escapeHtml(r['الوظيفة']||'مهندس')} · ${escapeHtml(r['رقم الهاتف']||'')}<br>Chat ID: ${escapeHtml(id)}<br>${escapeHtml(assigned||'لا يوجد تعيين وردية ظاهر')}</small></div><span class="status-pill">${active?'نشط':'موقوف'}</span><div class="manager-row-actions"><button type="button" class="secondary-btn" data-edit-employee="${escapeHtml(id)}">تعديل</button><button type="button" class="secondary-btn" data-assign-employee="${escapeHtml(id)}">تعيين وردية</button><button type="button" class="secondary-btn" data-toggle-employee="${escapeHtml(id)}" data-next-status="${active?'موقوف':'نشط'}">${active?'إيقاف':'تفعيل'}</button></div></article>`;}).join('')||'<p class="muted">لا يوجد مهندسون مسجلون.</p>'}</div>`;
        content.querySelector('#managerAddEmployee').addEventListener('click',()=>openManagerEmployeeForm('create',null,shifts));
        content.querySelectorAll('[data-edit-employee]').forEach(b=>b.addEventListener('click',()=>openManagerEmployeeForm('edit',rows.find(r=>String(r['Chat ID'])===b.dataset.editEmployee),shifts)));
        content.querySelectorAll('[data-assign-employee]').forEach(b=>b.addEventListener('click',()=>openManagerEmployeeForm('assign',rows.find(r=>String(r['Chat ID'])===b.dataset.assignEmployee),shifts)));
        content.querySelectorAll('[data-toggle-employee]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm(`تأكيد ${b.dataset.nextStatus==='موقوف'?'إيقاف':'تفعيل'} حساب المهندس؟`))return;b.disabled=true;try{await api('employee_status',{employeeId:b.dataset.toggleEmployee,status:b.dataset.nextStatus});await loadManagerDashboard();closeModal();openManagerModule('staff');}catch(e){if(tg?.showAlert)tg.showAlert(e.message);b.disabled=false;}}));
        const search=content.querySelector('#managerEmployeeSearch'); search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();content.querySelectorAll('.manager-employee-row').forEach(row=>row.classList.toggle('hidden',!row.textContent.toLowerCase().includes(q)));});
      } else if(module==='delivery') {
        closeModal(); await openDeliveryPanel(); return;
      } else if(module==='devices') {
        const [rows,employees]=await Promise.all([api('device_list'),api('device_staff')]);
        const statuses=['تم الاستلام','قيد الفحص','يحتاج قطعة غيار','يحتاج التواصل مع العميل','بانتظار رد العميل','لم يتم الرد','قيد الإصلاح','مراجعة الجودة','يحتاج إعادة فحص','جاهز للتسليم','تم التسليم'];
        const locations=['قسم الاستلام','ترابيزة الهاردوير','درج الفحص 1','درج الفحص 2','درج مراجعة الجودة','درج انتظار قطع الغيار','درج انتظار العميل','درج جاهز للتسليم','مكان آخر'];
        content.innerHTML=`<div class="manager-mini-kpis"><div><b>${rows.length}</b><small>أجهزة ظاهرة حسب الصلاحية</small></div><div><b>${employees.length}</b><small>فنيون نشطون</small></div></div><div class="manager-module-toolbar"><input id="deviceModuleSearch" type="search" placeholder="ابحث برقم الطلب أو الجهاز أو الفني"><button type="button" class="secondary-btn" id="deviceInspectionCatalog">كتالوج الفحص</button><button type="button" class="secondary-btn" id="managerRepairPrices">أسعار الإصلاح</button></div><h4>الأجهزة وسجل المتابعة</h4>`+(rows.length?rows.map((r,i)=>`<article class="manager-row"><div><b>${escapeHtml(r.orderId||'جهاز')}</b><small>${escapeHtml(r.deviceName||'')} · العميل: ${escapeHtml(r.customerName||'')}</small></div><span class="status-pill">${escapeHtml(r.status||'غير محدد')}</span><small>المسؤول: ${escapeHtml(r.employeeName||'—')} · المكان: ${escapeHtml(r.location||'—')}</small><div class="manager-row-actions"><button class="secondary-btn" type="button" data-device-detail="${i}">التفاصيل والسجل</button><button class="secondary-btn" type="button" data-device-edit="${i}">تحديث الحالة</button><button class="secondary-btn" type="button" data-device-transfer="${i}">تحويل لفني</button><button class="secondary-btn" type="button" data-device-inspection="${i}">فحص الجهاز</button></div></article>`).join(''):'<p class="muted">لا توجد أجهزة مسجلة أو لا توجد أجهزة ضمن صلاحيات حسابك.</p>') ;
        content.querySelector('#managerRepairPrices').addEventListener('click',()=>openRepairPriceBook());
        const search=content.querySelector('#deviceModuleSearch');
        search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();content.querySelectorAll('.manager-row').forEach(row=>row.classList.toggle('hidden',!row.textContent.toLowerCase().includes(q)));});
        content.querySelector('#deviceInspectionCatalog').addEventListener('click',async()=>{
          try {
            const catalog=await api('device_inspection_catalog');
            const html=Object.entries(catalog).map(([key,d])=>`<section class="inspection-device-group"><h4>${escapeHtml(d.name)} (${d.items.length})</h4>${d.items.map((it,i)=>`<details class="inspection-item"><summary>${i+1}. ${escapeHtml(it.name)}</summary><p>${escapeHtml(it.instruction||'')}</p></details>`).join('')}</section>`).join('');
            managerPanel('كتالوج فحص الأجهزة',html);
          } catch(e) { if(tg?.showAlert) tg.showAlert(e.message); }
        });
        content.querySelectorAll('[data-device-detail]').forEach(btn=>btn.addEventListener('click',async()=>{
          const r=rows[Number(btn.dataset.deviceDetail)];
          try {
            const d=await api('device_detail',{orderId:r.orderId});
            const x=d.device;
            const history=(d.history||[]).map(h=>`<article class="manager-row"><b>${escapeHtml(h['نوع الحركة']||'حركة')}</b><small>${escapeHtml(h['التاريخ والوقت']||'')} · ${escapeHtml(h['من الموظف']||'')} ← ${escapeHtml(h['إلى الموظف']||'')}</small><small>${escapeHtml(h['الحالة']||'')} · ${escapeHtml(h['المكان']||'')}</small><small>${escapeHtml(h['ملاحظات']||'')}</small></article>`).join('')||'<p class="muted">لا يوجد سجل حركة لهذا الجهاز.</p>';
            managerPanel('تفاصيل الجهاز',`<div class="manager-device-detail"><h4>${escapeHtml(x.orderId)}</h4><p><b>الجهاز:</b> ${escapeHtml(x.deviceName||'—')}</p><p><b>العميل:</b> ${escapeHtml(x.customerName||'—')}</p><p><b>المشكلة:</b> ${escapeHtml(x.issue||'—')}</p><p><b>الحالة:</b> ${escapeHtml(x.status||'—')}</p><p><b>المكان:</b> ${escapeHtml(x.location||'—')}</p><p><b>المهندس:</b> ${escapeHtml(x.employeeName||'—')}</p><h4>سجل الحركة</h4>${history}</div>`);
          } catch(e) { if(tg?.showAlert) tg.showAlert(e.message); }
        }));
        content.querySelectorAll('[data-device-edit]').forEach(btn=>btn.addEventListener('click',()=>{
          const r=rows[Number(btn.dataset.deviceEdit)];
          const formHtml=`<form id="managerDeviceForm" class="manager-staff-form"><label>رقم الطلب<input value="${escapeHtml(r.orderId||'')}" disabled></label><label>حالة الجهاز<select name="status">${statuses.map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select></label><label>مكان الجهاز<select name="location">${locations.map(s=>`<option ${s===r.location?'selected':''}>${s}</option>`).join('')}</select></label><label>ملاحظات الحركة<textarea name="note" rows="3" maxlength="500"></textarea></label><button type="submit" class="primary-btn">حفظ التحديث</button></form>`;
          const p=managerPanel('تحديث حالة الجهاز',formHtml);p.querySelector('form').addEventListener('submit',async ev=>{ev.preventDefault();const f=ev.currentTarget,b=f.querySelector('button');b.disabled=true;try{const fd=new FormData(f);await api('device_status_update',{orderId:r.orderId,...Object.fromEntries(fd.entries())});closeModal();openManagerModule('devices');}catch(e){if(tg?.showAlert)tg.showAlert(e.message);b.disabled=false;}});
        }));
        content.querySelectorAll('[data-device-transfer]').forEach(btn=>btn.addEventListener('click',()=>{
          const r=rows[Number(btn.dataset.deviceTransfer)];
          const formHtml=`<form id="deviceTransferForm" class="manager-staff-form"><label>رقم الطلب<input value="${escapeHtml(r.orderId)}" disabled></label><label>المهندس الجديد<select name="employeeId" required><option value="">اختر المهندس</option>${employees.map(e=>`<option value="${escapeHtml(e.chatId)}">${escapeHtml(e.name)} — ${escapeHtml(e.job)}</option>`).join('')}</select></label><button type="submit" class="primary-btn">تأكيد التحويل</button></form>`;
          const p=managerPanel('تحويل مسؤولية الجهاز',formHtml);p.querySelector('form').addEventListener('submit',async ev=>{ev.preventDefault();const f=ev.currentTarget,b=f.querySelector('button');b.disabled=true;try{const fd=new FormData(f);await api('device_transfer',{orderId:r.orderId,...Object.fromEntries(fd.entries())});closeModal();openManagerModule('devices');}catch(e){if(tg?.showAlert)tg.showAlert(e.message);b.disabled=false;}});
        }));

        content.querySelectorAll('[data-device-inspection]').forEach(btn=>btn.addEventListener('click',async()=>{
          const r=rows[Number(btn.dataset.deviceInspection)];
          try {
            const catalog=await api('device_inspection_catalog');
            const guess=(name)=>{
              const n=String(name||'').toLowerCase();
              if(/iphone|ايفون|آيفون/.test(n))return 'iphone';
              if(/ipad|ايباد|آيباد/.test(n))return 'ipad';
              if(/macbook|ماك/.test(n))return 'macbook';
              if(/watch|ساعة/.test(n))return 'watch';
              if(/airpods|ايربودز|إيربودز/.test(n))return 'airpods';
              return 'iphone';
            };
            const initialType=guess(r.deviceName);
            const renderForm=async(type)=>{
              const saved=await api('device_inspection_get',{orderId:r.orderId,deviceType:type});
              const d=catalog[type];
              const previous=new Map((saved.items||[]).map(x=>[Number(x.index),x]));
              const items=d.items.map((it,i)=>{
                const old=previous.get(i)||{};
                return `<article class="inspection-form-item"><div class="inspection-form-title"><b>${i+1}. ${escapeHtml(it.name)}</b><details><summary>تعليمات الاختبار</summary><p>${escapeHtml(it.instruction||'')}</p></details></div><label>النتيجة<select name="result_${i}"><option value="" ${!old.result?'selected':''}>لم يتم التقييم</option><option value="سليم" ${old.result==='سليم'?'selected':''}>سليم</option><option value="مشكلة" ${old.result==='مشكلة'?'selected':''}>مشكلة</option><option value="لم يختبر" ${old.result==='لم يختبر'?'selected':''}>لم يختبر</option></select></label><label>ملاحظات<textarea name="note_${i}" rows="2" maxlength="500">${escapeHtml(old.note||'')}</textarea></label></article>`;
              }).join('');
              return `<form id="deviceInspectionForm" class="device-inspection-form"><div class="inspection-form-meta"><b>طلب رقم ${escapeHtml(r.orderId)}</b><span>${escapeHtml(d.name)} · ${d.items.length} اختبار</span>${saved.updatedAt?`<small>آخر حفظ: ${escapeHtml(saved.updatedAt)}</small>`:''}</div><label>نوع الجهاز<select name="deviceType" id="inspectionDeviceType">${Object.entries(catalog).map(([k,v])=>`<option value="${k}" ${k===type?'selected':''}>${escapeHtml(v.name)}</option>`).join('')}</select></label><div class="inspection-form-items">${items}</div><button type="submit" class="primary-btn">حفظ نتائج الفحص</button></form>`;
            };
            const first=await renderForm(initialType);
            const p=managerPanel('فحص الجهاز',first);
            p.querySelector('#inspectionDeviceType').addEventListener('change',async ev=>{
              try {
                const h=await renderForm(ev.target.value);
                const tmp=document.createElement('div');tmp.innerHTML=h;
                p.querySelector('#deviceInspectionForm').replaceWith(tmp.firstElementChild);
                bindTypeSelector();
                bindForm();
              } catch(e){if(tg?.showAlert)tg.showAlert(e.message);}
            });
            const bindTypeSelector=()=>{
              const selector=p.querySelector('#inspectionDeviceType');
              if(selector) selector.addEventListener('change',async ev=>{
                try {
                  const h=await renderForm(ev.target.value);
                  const tmp=document.createElement('div');tmp.innerHTML=h;
                  p.querySelector('#deviceInspectionForm').replaceWith(tmp.firstElementChild);
                  bindTypeSelector();bindForm();
                } catch(e){if(tg?.showAlert)tg.showAlert(e.message);}
              });
            };
            const bindForm=()=>{
              const form=p.querySelector('#deviceInspectionForm');
              if(!form)return;
              form.addEventListener('submit',async ev=>{
                ev.preventDefault();const b=form.querySelector('button[type="submit"]');b.disabled=true;
                const type=form.elements.deviceType.value;const count=catalog[type].items.length;
                const items=Array.from({length:count},(_,i)=>({index:i,result:form.elements[`result_${i}`].value,note:form.elements[`note_${i}`].value}));
                try {
                  const saved=await api('device_inspection_save',{orderId:r.orderId,deviceType:type,items});
                  if(tg?.showAlert)tg.showAlert(`تم حفظ الفحص. تم تقييم ${saved.completed} اختبار، ومشكلات مسجلة: ${saved.issues}.`);
                  closeModal();openManagerModule('devices');
                } catch(e){if(tg?.showAlert)tg.showAlert(e.message);b.disabled=false;}
              });
            };
            bindForm();
          } catch(e) { if(tg?.showAlert) tg.showAlert(e.message); }
        }));
      } else if(module==='system') {
        const d=managerDashboardCache||await api('manager_dashboard'); const r=d.monthlyReport||{};
        content.innerHTML=`<div class="manager-mini-kpis"><div><b>${Number(r.checkins)||0}</b><small>مرات تسجيل الحضور</small></div><div><b>${Number(r.checkouts)||0}</b><small>مرات تسجيل الانصراف</small></div><div><b>${Number(r.lateDays)||0}</b><small>أيام بها تأخير</small></div><div><b>${Number(r.lateMinutes)||0}</b><small>دقائق التأخير</small></div><div><b>${Number(r.confirmedAbsences)||0}</b><small>غياب مؤكد</small></div><div><b>${Number(r.pendingAbsences)||0}</b><small>غياب قيد المراجعة</small></div><div><b>${Number(r.leaveCount)||0}</b><small>طلبات أذونات خلال الشهر</small></div></div><p class="manager-note">تقرير تشغيلي عام لشهر ${escapeHtml(r.month||d.month||'')}، مجمع من سجلات الحضور والغياب والأذونات في Google Sheets، وليس تقريرًا فرديًا لمهندس واحد.</p>`;
      }
    } catch(e) { content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`; }
  }

  function openManagerShiftForm(mode, shift, onSaved) {
    const r = shift || {};
    const id = String(r['Shift ID'] || '');
    const flexible = id === 'FLEX_NO_FIXED_TIME' || (!String(r['موعد الحضور'] || '').trim() && !String(r['موعد الانصراف'] || '').trim());
    const title = mode === 'create' ? 'إضافة وردية جديدة' : 'تعديل بيانات الوردية';
    const html = `<form id="managerShiftForm" class="manager-staff-form">
      ${mode==='create'?`<label>نوع الوردية<select name="shiftType" id="managerShiftType"><option value="fixed">وردية بمواعيد ثابتة</option><option value="flexible">وردية بدون موعد ثابت</option></select></label><label>معرّف الوردية<input name="shiftId" id="managerShiftId" maxlength="30" pattern="[A-Za-z0-9_-]{2,30}" placeholder="مثال MORNING" required></label>`:`<div class="manager-note">معرّف الوردية: ${escapeHtml(id)}</div>`}
      <label>اسم الوردية<input name="name" maxlength="60" value="${escapeHtml(r['اسم الوردية']||'')}" required></label>
      <div id="managerShiftTimes" ${mode==='edit'&&flexible?'class="hidden"':''}><label>موعد الحضور<input name="startTime" type="time" value="${escapeHtml(r['موعد الحضور']||'09:00')}" ${mode==='create'?'required':''}></label><label>موعد الانصراف<input name="endTime" type="time" value="${escapeHtml(r['موعد الانصراف']||'17:00')}" ${mode==='create'?'required':''}></label></div>
      <label>فترة السماح بالدقائق<input name="graceMinutes" type="number" min="0" max="180" step="1" value="${escapeHtml(r['فترة السماح بالدقائق'] ?? 15)}" required></label>
      <button type="submit" class="primary-btn">${mode==='create'?'إنشاء الوردية':'حفظ التعديلات'}</button>
    </form>`;
    const panel = managerPanel(title, html);
    const form = panel.querySelector('#managerShiftForm');
    if (mode === 'create') {
      const type = form.querySelector('#managerShiftType'), idField = form.querySelector('#managerShiftId'), times = form.querySelector('#managerShiftTimes');
      const updateType = () => {
        const flex = type.value === 'flexible';
        if (flex) { idField.value = 'FLEX_NO_FIXED_TIME'; idField.readOnly = true; times.classList.add('hidden'); form.elements.startTime.required=false; form.elements.endTime.required=false; if(form.elements.graceMinutes.value==='15')form.elements.graceMinutes.value='0'; }
        else { if(idField.value==='FLEX_NO_FIXED_TIME')idField.value=''; idField.readOnly=false; times.classList.remove('hidden'); form.elements.startTime.required=true; form.elements.endTime.required=true; if(form.elements.graceMinutes.value==='0')form.elements.graceMinutes.value='15'; }
      };
      type.addEventListener('change',updateType); updateType();
    }
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const button=form.querySelector('button[type="submit"]'); button.disabled=true;
      const data=Object.fromEntries(new FormData(form).entries());
      try {
        if (mode==='create') {
          const flexible=data.shiftType==='flexible';
          await api('shift_create',{shiftId:flexible?'FLEX_NO_FIXED_TIME':data.shiftId,name:data.name,flexible:flexible,startTime:data.startTime||'',endTime:data.endTime||'',graceMinutes:data.graceMinutes});
        } else {
          const payload={shiftId:id,name:data.name,graceMinutes:data.graceMinutes};
          if(!flexible){payload.startTime=data.startTime;payload.endTime=data.endTime;}
          await api('shift_update',payload);
        }
        closeModal();
        if(typeof onSaved==='function') await onSaved();
        if(tg?.HapticFeedback)tg.HapticFeedback.notificationOccurred('success');
        if(tg?.showAlert)tg.showAlert(mode==='create'?'تم إنشاء الوردية بنجاح.':'تم تحديث الوردية بنجاح.');
      } catch(e) { if(tg?.showAlert)tg.showAlert(e.message); else {let msg=form.querySelector('.manager-form-error');if(!msg){msg=document.createElement('p');msg.className='manager-form-error';form.appendChild(msg);}msg.textContent=e.message;} button.disabled=false; }
    });
  }

  function openManagerEmployeeForm(mode, employee, shifts) {
    const e=employee||{}; const id=String(e['Chat ID']||'');
    const title=mode==='create'?'إضافة مهندس جديد':mode==='edit'?'تعديل بيانات المهندس':'تعيين وردية للمهندس';
    let html='';
    if(mode==='assign') {
      const activeShifts=shifts.filter(x=>String(x['الحالة']||'نشط')==='نشط');
      const dayOptions=[['0','الأحد'],['1','الاثنين'],['2','الثلاثاء'],['3','الأربعاء'],['4','الخميس'],['5','الجمعة'],['6','السبت']];
      html=`<form id="managerStaffForm" class="manager-staff-form"><label>الوردية<select name="shiftId" required>${activeShifts.map(x=>`<option value="${escapeHtml(x['Shift ID'])}">${escapeHtml(x['اسم الوردية']||x['Shift ID'])} · ${escapeHtml(formatTime12(x['موعد الحضور'])||'مرن')} - ${escapeHtml(formatTime12(x['موعد الانصراف'])||'')}</option>`).join('')}</select></label><label>تاريخ البداية<input name="startDate" type="date" value="${escapeHtml(managerDashboardCache?.date || new Date().toISOString().slice(0,10))}" required></label><label>تاريخ النهاية (اختياري)<input name="endDate" type="date"></label><fieldset class="manager-workdays"><legend>أيام العمل</legend><div>${dayOptions.map(([v,n])=>`<label><input type="checkbox" name="workDays" value="${v}" ${v!=='5'?'checked':''}> ${n}</label>`).join('')}</div><small>الوردية الثابتة لا تُسند يوم الجمعة. الوردية المرنة يمكن إسنادها لأي يوم.</small></fieldset><button class="primary-btn" type="submit">حفظ تعيين الوردية</button></form>`;
    } else {
      html=`<form id="managerStaffForm" class="manager-staff-form">${mode==='create'?'<label>Telegram Chat ID<input name="chatId" inputmode="numeric" pattern="[0-9]{5,20}" required></label>':''}<label>اسم المهندس<input name="name" maxlength="80" value="${escapeHtml(e['اسم الموظف']||'')}" required></label><label>الوظيفة<input name="job" maxlength="80" value="${escapeHtml(e['الوظيفة']||'مهندس')}" required></label><label>رقم الهاتف<input name="phone" maxlength="30" value="${escapeHtml(e['رقم الهاتف']||'')}"></label><button class="primary-btn" type="submit">${mode==='create'?'إضافة الحساب':'حفظ التعديلات'}</button></form>`;
    }
    const panel=managerPanel(title,html); const form=panel.querySelector('#managerStaffForm');
    form.addEventListener('submit',async ev=>{ev.preventDefault();const b=form.querySelector('button[type="submit"]');b.disabled=true;
      try { const fd=new FormData(form), data=Object.fromEntries(fd.entries());
        if(mode==='create') await api('employee_create',data);
        else if(mode==='edit') await api('employee_update',{employeeId:id,...data});
        else { const selectedDays=fd.getAll('workDays'); if(!selectedDays.length) throw new Error('اختار يوم عمل واحدًا على الأقل.'); data.days=selectedDays.join(','); await api('shift_assign',{employeeId:id,...data}); }
        closeModal(); if(tg?.HapticFeedback)tg.HapticFeedback.notificationOccurred('success');
        await loadManagerDashboard();
        openManagerModule('staff');
        if(tg?.showAlert)tg.showAlert(mode==='create'?'تمت إضافة المهندس.':mode==='edit'?'تم تحديث بيانات المهندس.':'تم تعيين الوردية بنجاح.');
      } catch(err) { if(tg?.showAlert)tg.showAlert(err.message); else {let msg=form.querySelector('.manager-form-error');if(!msg){msg=document.createElement('p');msg.className='manager-form-error';form.appendChild(msg);}msg.textContent=err.message;} b.disabled=false; }
    });
  }

  async function switchWorkspace() {
    if (switchingWorkspace || availableWorkspaces.length < 2) return;
    const previousWorkspace = workspaceRole;
    const nextWorkspace = previousWorkspace === 'manager' ? 'employee' : 'manager';
    if (!availableWorkspaces.includes(nextWorkspace)) return;

    switchingWorkspace = true;
    $('workspaceSwitch').disabled = true;
    $('workspaceSwitch').textContent = 'جارٍ التحويل...';
    $('connection').textContent = 'جارٍ التحويل';
    try {
      workspaceRole = nextWorkspace;
      const data = await api('bootstrap');
      applyWorkspaceProfile(data);

      // Manager aggregates are included in bootstrap; review queues load only when opened.
      $('connection').textContent = 'متصل';
      if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      workspaceRole = previousWorkspace;
      $('workspaceSwitch').textContent = previousWorkspace === 'manager' ? 'لوحة المهندس' : 'لوحة المدير';
      $('connection').textContent = 'تعذر التحويل';
      fail(e.message);
    } finally {
      switchingWorkspace = false;
      $('workspaceSwitch').disabled = false;
    }
  }

  async function start() {
    if (!tg) return fail('افتح التطبيق من زر Mini App داخل بوت MobiHub.');
    tg.ready(); tg.expand();
    initData = tg.initData || '';
    if (!initData) return fail('بيانات Telegram غير متاحة. افتح التطبيق من داخل Telegram.');
    try {
      const data = await api('bootstrap');
      applyWorkspaceProfile(data);
      $('connection').textContent = 'متصل'; $('connection').classList.add('is-online');

      // Secondary data is non-blocking: the dashboard appears as soon as bootstrap
      // completes, while permitted review queues and device options load in background.
      const backgroundJobs = [];
      if (workspaceRole === 'employee') backgroundJobs.push((async () => {
        try {
          const deviceOptions = await api('device_registration_options');
          $('registerDeviceCard').classList.toggle('hidden', !deviceOptions.allowed);
        } catch (_) {
          $('registerDeviceCard').classList.add('hidden');
        }
      })());
      Promise.allSettled(backgroundJobs);
      // Attendance is deliberately lazy-loaded when the engineer opens the attendance action.
      $('attendance').classList.add('hidden');
    } catch (e) { fail(e.message); }
  }

  async function showList(entity) {
    $('results').classList.remove('hidden');
    $('resultTitle').textContent = titles[entity] || 'السجلات';
    $('resultBody').textContent = 'جاري التحميل...';
    openModal(titles[entity] || 'السجلات', $('results'));
    try {
      const rows = await api('list', { entity });
      if (!rows.length) { $('resultBody').textContent = 'لا توجد سجلات.'; return; }
      if(entity==='complaints'){
        $('resultBody').innerHTML=rows.map(row=>`<article class="record complaint-card"><strong>${escapeHtml(row['رقم الشكوى']||'شكوى')} · ${escapeHtml(row['نوع الشكوى']||'')}</strong><small class="record-meta">${escapeHtml(row['الحالة']||'جديدة')} · ${escapeHtml(formatDateTime12(row['التاريخ والوقت'])||'')}</small><p>${escapeHtml(row['تفاصيل الشكوى']||'')}</p><button class="secondary-btn" data-open-complaint="${escapeHtml(row['رقم الشكوى']||'')}">فتح المحادثة</button></article>`).join('');
        $('resultBody').querySelectorAll('[data-open-complaint]').forEach(b=>b.addEventListener('click',()=>openComplaint(b.dataset.openComplaint)));
        return;
      }
      $('resultBody').innerHTML = rows.map(row => {
        const title = row['رقم الطلب'] || row['رقم الخصم'] || row['رقم الشكوى'] || row['نوع الطلب'] || row['نوع الإذن'] || row['اسم الجهاز'] || 'سجل';
        const status = row['حالة العهدة'] || row['حالة التسوية'] || row['حالة الصرف'] || row['الحالة'] || row['القرار'] || 'قيد المراجعة';
        const date = formatDateTime12(row['التاريخ والوقت'] || row['تاريخ الإرسال'] || row['تاريخ الواقعة'] || row['تاريخ الإذن'] || row['تاريخ الاستلام'] || '');
        const amount = row['المبلغ المعتمد بالجنيه'] || row['المبلغ المطلوب بالجنيه'] || row['المبلغ بالجنيه'];
        const details = row['التفاصيل'] || row['السبب'] || row['الغرض'] || row['تفاصيل الشكوى'] || row['المشكلة المسجلة'] || '';
        const canSettle = entity === 'cash' && row['حالة الصرف'] === 'تم الصرف' && ['عهدة مفتوحة','مرفوضة - تحتاج مراجعة'].includes(String(row['حالة العهدة']||''));
        const settlement = canSettle ? `<div class="cash-settlement"><strong>تسوية العهدة</strong><label>إجمالي المصروف الفعلي بالجنيه<input type="number" min="0" step="0.01" id="spent-${Number(row.__row)}" placeholder="مثال: 650"></label><label>تفاصيل المصروفات<textarea id="settle-note-${Number(row.__row)}" rows="2" maxlength="1500" placeholder="اكتب تفاصيل المصروفات"></textarea></label><button class="primary-btn" data-settle-row="${Number(row.__row)}">إرسال التسوية</button></div>` : '';
        const fields = [];
        if(date) fields.push(['التاريخ',date]);
        if(amount!==undefined && amount!=='') fields.push(['المبلغ',`${amount} جنيه`]);
        if(row['المصروف الفعلي بالجنيه']!==undefined) fields.push(['المصروف الفعلي',`${row['المصروف الفعلي بالجنيه']||'—'} جنيه`]);
        if(row['المبلغ المطلوب إرجاعه بالجنيه']!==undefined) fields.push(['المطلوب إرجاعه',`${row['المبلغ المطلوب إرجاعه بالجنيه']||'—'} جنيه`]);
        if(row['نوع الإذن']) fields.push(['نوع الإذن',row['نوع الإذن']]);
        if(row['نوع الخصم']) fields.push(['نوع الخصم',row['نوع الخصم']]);
        if(row['حالة الجهاز']) fields.push(['حالة الجهاز',row['حالة الجهاز']]);
        return `<article class="record record-rich"><div class="record-top"><strong>${escapeHtml(title)}</strong><span class="status-pill">${escapeHtml(status)}</span></div>${fields.length?`<div class="record-grid">${fields.map(([k,v])=>`<div class="record-field"><small>${escapeHtml(k)}</small><b>${escapeHtml(v)}</b></div>`).join('')}</div>`:''}${details?`<div class="record-details"><small>التفاصيل</small><p>${escapeHtml(details)}</p></div>`:''}${settlement}</article>`;
      }).join('');
      $('resultBody').querySelectorAll('[data-settle-row]').forEach(b => b.addEventListener('click', async () => {
        const row=Number(b.dataset.settleRow), spent=$(`spent-${row}`).value, notes=$(`settle-note-${row}`).value;
        b.disabled=true;
        try { const r=await api('cash_settlement_submit',{row,actualSpent:spent,notes}); messageRequest(`تم إرسال التسوية. المتبقي المطلوب إرجاعه: ${r.amountToReturn} جنيه.`); await showList('cash'); }
        catch(e){messageRequest(e.message,true);b.disabled=false;}
      }));
    } catch (e) { $('resultBody').textContent = e.message; }
  }

  function showRequestPicker(){
    $('requestPicker').classList.remove('hidden');
    ['leaveForm','cashForm','complaintForm','complaintThread'].forEach(id=>$(id).classList.add('hidden'));
    $('requestMessage').classList.add('hidden');
    $('results').classList.add('hidden');
    openModal('طلباتي', $('requestPicker'));
  }
  async function openHomeAction(action){
    if(action==='attendance' || action==='checkout'){
      const title = action === 'attendance' ? 'تسجيل حضور' : 'تسجيل انصراف';
      const card = document.querySelector(`[data-home-action="${action}"]`);
      if (card) { card.disabled = true; card.dataset.previousText = card.innerHTML; card.innerHTML = '<span class="home-icon">…</span><b>جاري التحميل</b>'; }
      try {
        await refreshAttendance();
        openModal(title, $('attendance'));
        if(action==='attendance' && !$('checkinBtn').disabled) $('checkinBtn').click();
        if(action==='checkout' && !$('checkoutBtn').disabled) $('checkoutBtn').click();
      } catch (e) {
        if (tg && typeof tg.showAlert === 'function') tg.showAlert(e.message);
        else fail(e.message);
      } finally {
        if (card) { card.disabled = false; if (card.dataset.previousText) card.innerHTML = card.dataset.previousText; delete card.dataset.previousText; }
      }
      return;
    }
    if(action==='history'){showAttendanceHistory();return;}
    if(action==='my-shifts'){await showMyShifts();return;}
    if(action==='leave'){openRequestForm('leave');return;}
    if(action==='cash'){openRequestForm('cash');return;}
    if(action==='withdraw'){openModal('طلب سحب مبلغ', $('withdrawForm')); return;}
    if(action==='requests'){showRequestPicker();return;}
    if(action==='settlement'){showList('cash');return;}
    if(action==='complaint-new'){openRequestForm('complaint');return;}
    if(action==='complaint-list'){showList('complaints');return;}
    if(action==='deductions'){showList('deductions');return;}
    if(action==='rewards'){ $('financeCenter').classList.remove('hidden'); openModal('مكافآتي', $('financeCenter')); loadFinanceSummary(); return;}
    if(action==='monthly'){loadMonthlySummary();return;}
    if(action==='tasks'){await openTasksPanel();return;}
    if(action==='part-request'){await openPartRequestPanel();return;}
    if(action==='devices'){await openEmployeeDevices();return;}
    if(action==='inspection'){await openStandaloneDeviceInspection();return;}
    if(action==='repair-prices'){await openRepairPriceBook();return;}
    if(action==='device-register'){await openDeviceIntake();return;}
    if(action==='refresh'){refreshEmployeeWorkspace();return;}
  }

  async function showMyShifts() {
    const panel = managerPanel('جدول الورديات','<div class="manager-loading">جاري تحميل جدولك...</div>');
    const content = panel.querySelector('.manager-module-content');
    try {
      const data = await api('my_shifts');
      const rows = data.assignments || [];
      content.innerHTML = `<p class="manager-note">اليوم: ${escapeHtml(data.today||'')} · يعرض الجدول جميع التعيينات النشطة المسجلة لحسابك.</p>${rows.map(r=>`<article class="manager-row"><div><b>${escapeHtml(r.name||r.shiftId)}</b><small>${r.flexible?'بدون موعد ثابت':`${escapeHtml(r.startTime||'—')} إلى ${escapeHtml(r.endTime||'—')} · سماح ${Number(r.graceMinutes)||0} دقيقة`}<br>أيام العمل: ${escapeHtml((r.dayNames||[]).join('، ')||'غير محددة')}<br>من ${escapeHtml(r.startDate||'بلا تاريخ بداية')} إلى ${escapeHtml(r.endDate||'مفتوح')}</small></div><span class="status-pill">${r.current?'ساري اليوم':'تعيين نشط'}</span></article>`).join('')||'<div class="manager-empty-state"><b>لا يوجد جدول ورديات مسجل لك</b><p>راجع الإدارة لتعيين ورديتك.</p></div>'}`;
    } catch(e) { content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`; }
  }

  async function refreshEmployeeWorkspace(){
    const btn=document.querySelector('[data-home-action="refresh"]');
    if(btn){btn.disabled=true;}
    try{
      const data=await api('bootstrap');
      renderEmployeeOverview();
      refreshTasksBadge(data.tasks || { open: 0, overdue: 0 });
      if (currentRole === 'employee' && currentAttendance) await refreshAttendance();
      $('attendance').classList.add('hidden');
      if(tg&&typeof tg.showAlert==='function') tg.showAlert('تم تحديث لوحة المهندس بنجاح.');
    }catch(e){if(tg&&typeof tg.showAlert==='function') tg.showAlert(e.message);else fail(e.message);}
    finally{if(btn)btn.disabled=false;}
  }
  const DEVICE_STATUS_OPTIONS = ['تم الاستلام','قيد الفحص','يحتاج قطعة غيار','يحتاج التواصل مع العميل','بانتظار رد العميل','لم يتم الرد','قيد الإصلاح','مراجعة الجودة','يحتاج إعادة فحص','جاهز للتسليم','تم التسليم'];
  const DEVICE_LOCATION_OPTIONS = ['قسم الاستلام','ترابيزة الهاردوير','درج الفحص 1','درج الفحص 2','درج مراجعة الجودة','درج انتظار قطع الغيار','درج انتظار العميل','درج جاهز للتسليم','مكان آخر'];

  async function openEmployeeDevices(){
    const panel=managerPanel('أجهزتي','<div class="manager-loading">جاري تحميل الأجهزة المسندة إليك...</div>');
    const content=panel.querySelector('.manager-module-content');
    try{
      const rows=await api('device_list');
      if(!rows.length){content.innerHTML='<div class="manager-empty-state"><b>لا توجد أجهزة مسندة لحسابك حاليًا</b><p>ستظهر هنا الأجهزة التي تم إسنادها إليك أو استلامها بواسطة حسابك.</p></div>';return;}
      content.innerHTML=`<p class="manager-note">تعرض هذه القائمة الأجهزة المسندة إليك أو المسجلة بواسطة حساب الاستلام الخاص بك فقط.</p><div class="manager-module-toolbar"><input id="myDeviceSearch" type="search" placeholder="ابحث برقم الطلب أو الحالة أو المكان"><button type="button" class="secondary-btn" id="refreshMyDevices">تحديث</button></div>${rows.map((r,i)=>`<article class="manager-row my-device-row"><div><b>${escapeHtml(r.orderId)}</b><small>${escapeHtml(r.deviceName||'جهاز مسجل برقم طلب')} · آخر تحديث: ${escapeHtml(r.updatedAt||'—')}</small></div><span class="status-pill">${escapeHtml(r.status||'غير محدد')}</span><small>المكان: ${escapeHtml(r.location||'—')} · مسؤول الجهاز: ${escapeHtml(r.employeeName||'—')}</small><div class="manager-row-actions"><button type="button" class="secondary-btn" data-my-device-detail="${i}">التفاصيل والحركة</button><button type="button" class="secondary-btn" data-my-device-status="${i}">تحديث الحالة</button><button type="button" class="primary-btn" data-my-device-inspect="${i}">فحص الجهاز</button></div></article>`).join('')}`;
      content.querySelector('#refreshMyDevices').addEventListener('click',()=>openEmployeeDevices());
      content.querySelector('#myDeviceSearch').addEventListener('input',ev=>{const q=ev.target.value.toLowerCase();content.querySelectorAll('.my-device-row').forEach(el=>el.classList.toggle('hidden',!el.textContent.toLowerCase().includes(q)));});
      content.querySelectorAll('[data-my-device-detail]').forEach(btn=>btn.addEventListener('click',()=>showEmployeeDeviceDetail(content,rows[Number(btn.dataset.myDeviceDetail)])));
      content.querySelectorAll('[data-my-device-status]').forEach(btn=>btn.addEventListener('click',()=>showEmployeeDeviceStatus(content,rows[Number(btn.dataset.myDeviceStatus)])));
      content.querySelectorAll('[data-my-device-inspect]').forEach(btn=>btn.addEventListener('click',()=>openEmployeeDeviceInspection(rows[Number(btn.dataset.myDeviceInspect)])));
    }catch(e){content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`;}
  }

  async function showEmployeeDeviceDetail(content,row){
    content.innerHTML='<div class="manager-loading">جاري تحميل تفاصيل الجهاز وسجل الحركة...</div>';
    try{
      const d=await api('device_detail',{orderId:row.orderId}),x=d.device||{};
      content.innerHTML=`<button type="button" class="secondary-btn" id="backMyDevices">رجوع للأجهزة</button><div class="manager-device-detail"><h4>طلب ${escapeHtml(x.orderId||row.orderId)}</h4><p><b>الجهاز:</b> ${escapeHtml(x.deviceName||'غير محدد')}</p><p><b>المشكلة المسجلة:</b> ${escapeHtml(x.issue||'—')}</p><p><b>الحالة:</b> ${escapeHtml(x.status||'—')}</p><p><b>المكان:</b> ${escapeHtml(x.location||'—')}</p><p><b>مسؤول الاستلام:</b> ${escapeHtml(x.intakeName||'—')}</p><p><b>الفني المسؤول:</b> ${escapeHtml(x.employeeName||'—')}</p><p><b>تاريخ الاستلام:</b> ${escapeHtml(x.receivedAt||'—')}</p><h4>سجل الحركة</h4>${(d.history||[]).map(h=>`<article class="manager-row"><b>${escapeHtml(h['نوع الحركة']||'حركة')}</b><small>${escapeHtml(h['التاريخ والوقت']||'')} · ${escapeHtml(h['منفذ الحركة']||'')}</small><small>الحالة: ${escapeHtml(h['الحالة']||'—')} · المكان: ${escapeHtml(h['المكان']||'—')}</small>${h['ملاحظات']?`<p>${escapeHtml(h['ملاحظات'])}</p>`:''}</article>`).join('')||'<p class="muted">لا توجد حركات مسجلة حتى الآن.</p>'}</div>`;
      content.querySelector('#backMyDevices').addEventListener('click',()=>openEmployeeDevices());
    }catch(e){content.innerHTML=`<button type="button" class="secondary-btn" id="backMyDevices">رجوع للأجهزة</button><p class="manager-load-error">${escapeHtml(e.message)}</p>`;content.querySelector('#backMyDevices').addEventListener('click',()=>openEmployeeDevices());}
  }

  function showEmployeeDeviceStatus(content,row){
    content.innerHTML=`<button type="button" class="secondary-btn" id="backMyDevices">رجوع للأجهزة</button><form id="myDeviceStatusForm" class="manager-staff-form"><h4>تحديث حالة الجهاز ${escapeHtml(row.orderId)}</h4><label>الحالة<select name="status">${DEVICE_STATUS_OPTIONS.map(x=>`<option ${x===row.status?'selected':''}>${x}</option>`).join('')}</select></label><label>المكان<select name="location">${DEVICE_LOCATION_OPTIONS.map(x=>`<option ${x===row.location?'selected':''}>${x}</option>`).join('')}</select></label><label>ملاحظات الحركة<textarea name="note" rows="3" maxlength="500" placeholder="اكتب ملاحظة مختصرة"></textarea></label><button type="submit" class="primary-btn">حفظ التحديث</button></form>`;
    content.querySelector('#backMyDevices').addEventListener('click',()=>openEmployeeDevices());
    content.querySelector('#myDeviceStatusForm').addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget,btn=form.querySelector('button[type=submit]');btn.disabled=true;try{const fd=new FormData(form);await api('device_status_update',{orderId:row.orderId,...Object.fromEntries(fd.entries())});if(tg?.showAlert)tg.showAlert('تم تحديث حالة الجهاز وتسجيل الحركة.');await openEmployeeDevices();}catch(e){if(tg?.showAlert)tg.showAlert(e.message);btn.disabled=false;}});
  }

  async function openEmployeeDeviceInspection(row){
    const panel=managerPanel('فحص الجهاز','<div class="manager-loading">جاري تحميل كتالوج الفحص...</div>');
    const content=panel.querySelector('.manager-module-content');
    try{
      const catalog=await api('device_inspection_catalog');
      const guess=(name)=>{const v=String(name||'').toLowerCase();if(v.includes('ipad'))return 'ipad';if(v.includes('mac'))return 'macbook';if(v.includes('watch'))return 'watch';if(v.includes('airpods')||v.includes('airpod'))return 'airpods';return 'iphone';};
      const initial=guess(row.deviceName);
      await renderEmployeeInspectionForm(content,row,catalog,initial);
    }catch(e){content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`;}
  }

  /* Standalone 40-point inspection (the "فحص الجهاز" home tile).
   * Mirrors the Telegram bot: pick a device family first, then run its
   * checklist. No device record or order number is required — the backend
   * authorises order-less sessions through mhDeviceInspectionAccessV106_.
   */
  async function openStandaloneDeviceInspection(){
    const panel=managerPanel('فحص الجهاز','<div class="manager-loading">جاري تحميل قوائم الفحص...</div>');
    const content=panel.querySelector('.manager-module-content');
    try{
      const catalog=await api('device_inspection_catalog');
      renderInspectionTypePicker(content,catalog);
    }catch(e){
      content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  function renderInspectionTypePicker(content,catalog){
    const icons={iphone:'📱',ipad:'📲',macbook:'💻',watch:'⌚',airpods:'🎧'};
    const order=['iphone','ipad','macbook','watch','airpods'].filter(k=>catalog[k]);
    content.innerHTML=`<div class="inspection-wizard">
      <div class="inspection-wizard-head">
        <span class="inspection-wizard-kicker">DEVICE INSPECTION</span>
        <h4>اختيار نوع الجهاز</h4>
        <small>اختر نوع الجهاز لعرض قائمة الفحص الخاصة به.</small>
      </div>
      <div class="inspection-type-grid">
        ${order.map(key=>`<button type="button" class="inspection-type-card" data-inspection-type="${key}">
          <span>${icons[key]||'📱'}</span>
          <b>${escapeHtml(catalog[key].name)}</b>
          <small>${catalog[key].items.length} اختبار</small>
        </button>`).join('')}
      </div>
      <p class="manager-note">يمكنك حفظ الفحص بدون رقم طلب، أو فتح فحص مرتبط بجهاز من بطاقة «حالة الجهاز».</p>
    </div>`;
    content.querySelectorAll('[data-inspection-type]').forEach(btn=>btn.addEventListener('click',()=>{
      startInspectionWizard(content,{orderId:'',deviceName:''},catalog,btn.dataset.inspectionType);
    }));
  }

  async function startInspectionWizard(content,row,catalog,type){
    content.innerHTML='<div class="manager-loading">جاري تحميل نتائج الفحص السابقة...</div>';
    try{
      await renderEmployeeInspectionForm(content,row,catalog,type);
    }catch(e){
      content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  /* One-test-at-a-time inspection (mirrors the Telegram bot journey).
   * Works for both order-linked and standalone inspections.
   */
  async function renderEmployeeInspectionForm(content,row,catalog,type){
    return renderInspectionWizard(content,row,catalog,type);
  }

  async function renderInspectionWizard(content,row,catalog,type){
    const device = catalog[type];
    if (!device) { content.innerHTML = '<div class="manager-load-error">نوع الجهاز غير معروف.</div>'; return; }

    content.innerHTML = '<div class="manager-loading">جاري تحميل نتائج الفحص السابقة...</div>';
    let previous = { items: [] };
    try {
      previous = await api('device_inspection_get', { orderId: row.orderId || '', deviceType: type }) || previous;
    } catch (_) {
      // A failed restore must never block starting a fresh inspection.
    }

    const total = device.items.length;
    const answers = device.items.map((_, i) => {
      const found = (previous.items || []).find(x => Number(x.index) === i) || {};
      return { index: i, result: String(found.result || ''), note: String(found.note || '') };
    });

    let step = answers.findIndex(a => !a.result);
    if (step < 0) step = 0;

    const draw = () => {
      const item = device.items[step];
      const current = answers[step];
      const answered = answers.filter(a => a.result).length;
      const percent = total ? Math.round((answered / total) * 100) : 0;
      const choices = [['سليم', 'ok'], ['مشكلة', 'bad'], ['لم يختبر', 'skip']];

      content.innerHTML = `<div class="inspection-wizard">
        <div class="inspection-wizard-head">
          <span class="inspection-wizard-kicker">${row.orderId ? 'طلب ' + escapeHtml(row.orderId) : 'فحص مستقل'}</span>
          <h4>${escapeHtml(device.name)} · ${total} اختبار</h4>
          <small>تم تقييم ${answered} من ${total}</small>
        </div>
        <div class="inspection-progress"><span style="width:${percent}%"></span></div>
        <div class="inspection-step">
          <div class="inspection-step-index">اختبار ${step + 1} من ${total}</div>
          <b>${escapeHtml(item.name)}</b>
          ${item.instruction ? `<p class="inspection-step-instruction">${escapeHtml(item.instruction)}</p>` : ''}
          <div class="inspection-result-group">
            ${choices.map(([value, kind]) => `<button type="button" class="inspection-result-btn is-${kind}${current.result === value ? ' is-selected' : ''}" data-result="${value}">${value}</button>`).join('')}
          </div>
          <label>ملاحظات<textarea id="inspectionNote" rows="2" maxlength="500" placeholder="ملاحظة اختيارية">${escapeHtml(current.note)}</textarea></label>
        </div>
        <div class="inspection-nav">
          <button type="button" class="secondary-btn" id="inspectionPrev"${step === 0 ? ' disabled' : ''}>السابق</button>
          <button type="button" class="secondary-btn" id="inspectionNext"${step === total - 1 ? ' disabled' : ''}>التالي</button>
        </div>
        <button type="button" class="primary-btn" id="inspectionSave">حفظ نتائج الفحص</button>
        <p class="manager-note">تُحفظ النتائج كجلسة جديدة في سجل الفحص، ويمكنك الحفظ في أي وقت.</p>
      </div>`;

      content.querySelectorAll('[data-result]').forEach(button => button.addEventListener('click', () => {
        answers[step].result = button.dataset.result;
        answers[step].note = content.querySelector('#inspectionNote').value;
        const pending = answers.findIndex((a, i) => i > step && !a.result);
        step = pending >= 0 ? pending : Math.min(step + 1, total - 1);
        draw();
      }));

      content.querySelector('#inspectionNote').addEventListener('input', event => {
        answers[step].note = event.target.value;
      });
      content.querySelector('#inspectionPrev').addEventListener('click', () => { if (step > 0) { step--; draw(); } });
      content.querySelector('#inspectionNext').addEventListener('click', () => { if (step < total - 1) { step++; draw(); } });
      content.querySelector('#inspectionSave').addEventListener('click', () => saveInspectionWizard(content, row, catalog, type, answers));
    };

    draw();
  }

  async function saveInspectionWizard(content, row, catalog, type, answers){
    const button = content.querySelector('#inspectionSave');
    if (button) button.disabled = true;
    try {
      const result = await api('device_inspection_save', {
        orderId: row.orderId || '',
        deviceType: type,
        items: answers.map(a => ({ index: a.index, result: a.result, note: a.note }))
      });
      if (tg?.showAlert) tg.showAlert(`تم حفظ الفحص. مكتمل: ${result.completed} · مشاكل: ${result.issues} · لم يختبر: ${result.untested}`);
      if (row.orderId) { closeModal(); await openEmployeeDevices(); }
      else { renderInspectionTypePicker(content, catalog); }
    } catch (e) {
      if (tg?.showAlert) tg.showAlert(e.message);
      if (button) button.disabled = false;
    }
  }

  /* ============================================================
   * REPAIR PRICE BOOK
   * Same mental model as the device inspection: pick the device
   * family first, then drill straight into a part and its price.
   * Search accepts either a model name ("iPhone 13") or a part
   * ("شاشة") and returns the cheapest matching prices first.
   * ============================================================ */

  const PRICE_FAMILY_ICONS = { iphone: '📱', board: '🧩', watch: '⌚', airpods: '🎧', airpods_commercial: '🏷️' };

  function priceMoney(value) {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (!isFinite(n)) return String(value);
    return n.toLocaleString('en-US');
  }

  function priceRange(min, max) {
    if (min === null && max === null) return 'لا توجد أسعار مسجلة';
    if (min === null) return priceMoney(max) + ' جنيه';
    if (max === null || min === max) return priceMoney(min) + ' جنيه';
    return priceMoney(min) + ' – ' + priceMoney(max) + ' جنيه';
  }

  async function openRepairPriceBook() {
    const panel = managerPanel('أسعار الإصلاح', '<div class="manager-loading">جاري تحميل أقسام الأسعار...</div>');
    const content = panel.querySelector('.manager-module-content');
    await renderRepairPriceHome(content);
  }

  async function renderRepairPriceHome(content) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل الأقسام...</div>';
    try {
      const data = await api('repair_price_categories');
      const categories = data.categories || [];
      content.innerHTML = `<div class="price-home">
        <form id="repairPriceSearchForm" class="price-search">
          <div class="price-search-field">
            <input name="query" minlength="2" maxlength="100" placeholder="ابحث باسم الموديل أو القطعة… مثال: شاشة، بطارية، iPhone 13" required autocomplete="off">
            <button type="submit" class="primary-btn" aria-label="بحث">بحث</button>
          </div>
          <p class="price-search-hint">ابحث عن أي قطعة وتظهر أسعارها لكل موديل، الأرخص أولًا.</p>
        </form>

        <div class="price-family-head">
          <h4>اختر نوع الجهاز</h4>
          <small>لكل نوع قائمة الموديلات وأسعار القطع الخاصة به</small>
        </div>
        <div class="price-family-grid">
          ${categories.map(c => `<button type="button" class="price-family-card" data-price-category="${escapeHtml(c.key)}">
            <span class="price-family-icon">${PRICE_FAMILY_ICONS[c.key] || '📦'}</span>
            <b>${escapeHtml(c.label)}</b>
            <small>عرض الموديلات</small>
          </button>`).join('')}
        </div>

        <p class="manager-note">الأسعار تُعرض كما هي من ملف الأسعار المرتبط. التطبيق لا يعدّل ملف الأسعار.</p>
      </div>`;

      content.querySelector('#repairPriceSearchForm').addEventListener('submit', ev => {
        ev.preventDefault();
        const query = String(new FormData(ev.currentTarget).get('query') || '').trim();
        if (query.length < 2) return;
        renderRepairPriceSearch(content, query, 0);
      });
      content.querySelectorAll('[data-price-category]').forEach(btn =>
        btn.addEventListener('click', () => renderRepairPriceModels(content, btn.dataset.priceCategory, 0))
      );
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}
        <p>تأكد من إتاحة ملف الأسعار لحساب Google Apps Script وتشغيل إعداد ربط الأسعار.</p></div>`;
    }
  }

  function repairPriceGeneration(name) {
    const text = String(name || '').toLowerCase().replace(/iphone\s*/g, '').trim();
    if (/\bse\s*\d*\b/.test(text)) return 'SE';
    if (/\bx(?:r|s)?\b/.test(text)) return 'X / XS / XR';
    const number = text.match(/\b(\d{1,2})(?=\s|plus|pro|max|mini|air|e\b|$)/);
    if (!number) return 'أخرى';
    const generation = Number(number[1]);
    return generation === 7 || generation === 8 ? '7 / 8' : String(generation);
  }

  async function renderRepairPriceGenerations(content, category) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل فئات الموديلات...</div>';
    try {
      const first = await api('repair_price_catalog', { category });
      const models = first.models || [];
      const groups = new Map();
      models.forEach(model => {
        const group = repairPriceGeneration(model.name);
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(model);
      });
      const keys = [...groups.keys()].sort((a, b) => {
        const rank = key => key === '7 / 8' ? 7 : key === 'X / XS / XR' ? 10 : /^\d+$/.test(key) ? Number(key) : key === 'SE' ? 100 : 101;
        return rank(a) - rank(b);
      });
      const drawModels = group => {
        const selected = group ? groups.get(group) : models;
        content.innerHTML = `<div class="price-screen">
          <div class="price-screen-head"><button type="button" class="price-back" id="priceGenerationBack">رجوع للفئات</button>
          <div><h4>${escapeHtml(group ? 'iPhone ' + group : first.label)}</h4><small>${selected.length} موديل · اختر الجهاز</small></div></div>
          <div class="price-list">${selected.map(model => `<button type="button" class="price-model-row" data-generation-row="${model.row}"><span class="price-model-main"><b>${escapeHtml(model.name)}</b><small>${model.issueCount} قطعة مسعّرة</small></span></button>`).join('') || '<p class="manager-empty-state">لا توجد موديلات مسجلة.</p>'}</div></div>`;
        content.querySelector('#priceGenerationBack').addEventListener('click', group ? drawGroups : () => renderRepairPriceHome(content));
        content.querySelectorAll('[data-generation-row]').forEach(button => button.addEventListener('click', () =>
          renderRepairPriceIssues(content, category, Number(button.dataset.generationRow), null, () => drawModels(group))));
      };
      const drawGroups = () => {
        content.innerHTML = `<div class="price-screen"><div class="price-screen-head">
          <button type="button" class="price-back" id="priceGenerationHome">رجوع للأنواع</button>
          <div><h4>${escapeHtml(first.label)}</h4><small>اختر جيل الجهاز، ثم الموديل</small></div></div>
          <div class="price-generation-grid">${keys.map((key, index) => `<button type="button" class="price-family-card" data-generation="${index}"><b dir="ltr">${escapeHtml(key === 'أخرى' ? key : 'iPhone ' + key)}</b><small>${groups.get(key).length} موديل</small></button>`).join('')}</div></div>`;
        content.querySelector('#priceGenerationHome').addEventListener('click', () => renderRepairPriceHome(content));
        content.querySelectorAll('[data-generation]').forEach(button => button.addEventListener('click', () => drawModels(keys[Number(button.dataset.generation)])));
      };
      if (category === 'iphone' || category === 'board') drawGroups();
      else drawModels(null);
    } catch (error) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(error.message)}</div><button type="button" class="price-back">رجوع للأنواع</button>`;
      content.querySelector('.price-back').addEventListener('click', () => renderRepairPriceHome(content));
    }
  }

  async function renderRepairPriceModels(content, category, page, part) {
    if (!part) return renderRepairPriceGenerations(content, category);

    content.innerHTML = '<div class="manager-loading">جاري تحميل الموديلات...</div>';
    try {
      const data = await api('repair_price_models', { category, part, page: page || 0 });
      const models = data.models || [];
      content.innerHTML = `<div class="price-screen">
        <div class="price-screen-head">
          <button type="button" class="price-back" id="priceBackParts">← الفئات</button>
          <div>
            <h4>${escapeHtml(data.part)}</h4>
            <small>${escapeHtml(data.label)} · ${data.total} موديل · صفحة ${data.page + 1} من ${data.totalPages}</small>
          </div>
        </div>
        <div class="price-list">
          ${models.map(m => `<button type="button" class="price-part-model-row" data-price-row="${m.row}" data-price-category="${escapeHtml(category)}">
            <span class="price-model-main"><b>${escapeHtml(m.name)}</b></span>
            <span class="price-model-range"><b>${escapeHtml(m.price)}</b></span>
          </button>`).join('') || '<p class="manager-empty-state">لا توجد موديلات مسعّرة لهذه الفئة.</p>'}
        </div>
        <div class="price-pager">
          ${data.page > 0 ? '<button type="button" class="secondary-btn" id="pricePrev">الصفحة السابقة</button>' : ''}
          ${data.page + 1 < data.totalPages ? '<button type="button" class="secondary-btn" id="priceNext">الصفحة التالية</button>' : ''}
        </div>
      </div>`;

      content.querySelector('#priceBackParts').addEventListener('click', () => renderRepairPriceParts(content, category));
      const prev = content.querySelector('#pricePrev');
      const next = content.querySelector('#priceNext');
      if (prev) prev.addEventListener('click', () => renderRepairPriceModels(content, category, data.page - 1, part));
      if (next) next.addEventListener('click', () => renderRepairPriceModels(content, category, data.page + 1, part));
      content.querySelectorAll('[data-price-row]').forEach(btn =>
        btn.addEventListener('click', () => renderRepairPriceIssues(content, category, Number(btn.dataset.priceRow)))
      );
    } catch (e) {
      content.innerHTML = `<div class="price-screen">
        <button type="button" class="price-back" id="priceBackParts">← الفئات</button>
        <p class="manager-load-error">${escapeHtml(e.message)}</p></div>`;
      content.querySelector('#priceBackParts').addEventListener('click', () => renderRepairPriceParts(content, category));
    }
  }

  async function renderRepairPriceParts(content, category) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل الفئات...</div>';
    try {
      const data = await api('repair_price_parts', { category });
      const parts = data.parts || [];
      content.innerHTML = `<div class="price-screen">
        <div class="price-screen-head">
          <button type="button" class="price-back" id="priceBackHome">← الأنواع</button>
          <div>
            <h4>${escapeHtml(data.label)}</h4>
            <small>${parts.length} فئة · ${data.modelCount} موديل</small>
          </div>
        </div>
        <h5 class="price-group-title">اختر الفئة لعرض أسعارها</h5>
        <div class="price-part-grid">
          ${parts.map(p => `<button type="button" class="price-part-card" data-price-part="${escapeHtml(p.name)}">
            <span class="price-part-card-main">
              <b>${escapeHtml(p.name)}</b>
              <small>${p.modelCount} موديل</small>
            </span>
            <span class="price-part-card-range">${priceRange(p.minPrice, p.maxPrice)}</span>
          </button>`).join('') || '<p class="manager-empty-state">لا توجد فئات مسعّرة لهذا النوع.</p>'}
        </div>
        <p class="manager-note">الأسعار تُعرض كما هي من ملف الأسعار المرتبط.</p>
      </div>`;

      content.querySelector('#priceBackHome').addEventListener('click', () => renderRepairPriceHome(content));
      content.querySelectorAll('[data-price-part]').forEach(btn =>
        btn.addEventListener('click', () => renderRepairPriceModels(content, category, 0, btn.dataset.pricePart))
      );
    } catch (e) {
      content.innerHTML = `<div class="price-screen">
        <button type="button" class="price-back" id="priceBackHome">← الأنواع</button>
        <p class="manager-load-error">${escapeHtml(e.message)}</p></div>`;
      content.querySelector('#priceBackHome').addEventListener('click', () => renderRepairPriceHome(content));
    }
  }

  async function renderRepairPriceIssues(content, category, row, fromQuery, returnToModels) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل الأسعار...</div>';
    try {
      const data = await api('repair_price_issues', { category, row });
      const issues = data.issues || [];
      const numbers = issues.map(i => Number(String(i.price).replace(/[^\d.]/g, ''))).filter(n => isFinite(n) && n > 0);
      const cheapest = numbers.length ? Math.min.apply(null, numbers) : null;

      content.innerHTML = `<div class="price-screen">
        <div class="price-screen-head">
          <button type="button" class="price-back" id="priceBack${fromQuery ? 'Search' : 'Models'}">← ${fromQuery ? 'نتائج البحث' : 'الموديلات'}</button>
          <div>
            <h4>${escapeHtml(data.model)}</h4>
            <small>${escapeHtml(data.label)} · ${issues.length} قطعة مسعّرة</small>
          </div>
        </div>
        <div class="price-parts">
          ${issues.map(item => `<article class="price-part-row${cheapest !== null && Number(String(item.price).replace(/[^\d.]/g, '')) === cheapest ? ' is-cheapest' : ''}">
            <b>${escapeHtml(item.issue)}</b>
            <strong>${escapeHtml(item.price)}</strong>
          </article>`).join('') || '<p class="manager-empty-state">لا توجد أسعار مسجلة لهذا الموديل.</p>'}
        </div>
      </div>`;

      const back = content.querySelector('#priceBackModels') || content.querySelector('#priceBackSearch');
      if (back) {
        back.addEventListener('click', () => {
          if (returnToModels) returnToModels();
          else if (fromQuery) renderRepairPriceSearch(content, fromQuery.query, fromQuery.page);
          else renderRepairPriceModels(content, category, 0);
        });
      }
    } catch (e) {
      content.innerHTML = `<div class="price-screen">
        <button type="button" class="price-back" id="priceBackModels">← الموديلات</button>
        <p class="manager-load-error">${escapeHtml(e.message)}</p></div>`;
      content.querySelector('#priceBackModels').addEventListener('click', () => returnToModels ? returnToModels() : renderRepairPriceModels(content, category, 0));
    }
  }

  async function renderRepairPriceSearch(content, query, page) {
    content.innerHTML = '<div class="manager-loading">جاري البحث في كل الأقسام...</div>';
    try {
      const data = await api('repair_price_search_all', { query, mode: 'all', page: page || 0, pageSize: 20 });
      const groups = data.partGroups || [];
      const results = data.results || [];
      const models = results.filter(r => r.kind === 'model');
      const showRows = page > 0 || !groups.length;

      const groupRow = g => `<button type="button" class="price-part-card" data-price-group="${escapeHtml(g.issue)}">
          <span class="price-part-card-main">
            <b>${escapeHtml(g.issue)}</b>
            <small>${g.modelCount} موديل</small>
          </span>
          <span class="price-part-card-range">${priceRange(g.minPrice, g.maxPrice)}</span>
        </button>`;

      const partRow = r => `<button type="button" class="price-result-row is-part"
          data-price-row="${r.row}" data-price-category="${escapeHtml(r.category)}"
          data-query="${escapeHtml(data.query)}" data-page="${data.page}">
          <span class="price-result-main">
            <b>${escapeHtml(r.issue)}</b>
            <small>${escapeHtml(r.model)}</small>
          </span>
          <span class="price-result-price">
            <b>${escapeHtml(r.price)}</b>
            <small>${escapeHtml(r.categoryLabel)}</small>
          </span>
        </button>`;

      const modelRow = r => `<button type="button" class="price-result-row"
          data-price-row="${r.row}" data-price-category="${escapeHtml(r.category)}">
          <span class="price-result-main">
            <b>${escapeHtml(r.model)}</b>
            <small>${escapeHtml(r.categoryLabel)} · ${r.issueCount} قطعة</small>
          </span>
          <span class="price-result-price">
            <b>${priceRange(r.minPrice, r.maxPrice)}</b>
            <small>يبدأ من</small>
          </span>
        </button>`;

      content.innerHTML = `<div class="price-screen">
        <div class="price-screen-head">
          <button type="button" class="price-back" id="priceBackHome">← الأنواع</button>
          <div>
            <h4>نتائج: ${escapeHtml(data.query)}</h4>
            <small>${groups.length} فئة · ${data.partCount} قطعة · ${data.modelCount} موديل</small>
          </div>
        </div>

        ${!groups.length && !models.length ? `<p class="manager-empty-state"><b>لا توجد نتائج مطابقة</b><p>جرّب كلمة أقصر مثل «شاشة» أو اسم موديل مثل «iPhone 12».</p></p>` : ''}

        ${groups.length && !showRows ? `<h5 class="price-group-title">الفئات المطابقة — اختر فئة لعرض أسعارها</h5>
          <div class="price-part-grid">${groups.map(groupRow).join('')}</div>` : ''}

        ${showRows ? `<h5 class="price-group-title">${groups.length ? 'كل النتائج' : 'الموديلات'}</h5>
          <div class="price-list">${results.map(r => r.kind === 'part' ? partRow(r) : modelRow(r)).join('')}</div>` : ''}

        ${(!showRows && models.length) ? `<h5 class="price-group-title">موديلات مطابقة</h5>
          <div class="price-list">${models.map(modelRow).join('')}</div>` : ''}

        ${groups.length && !showRows ? `<button type="button" class="secondary-btn" id="priceShowAll">عرض كل النتائج (${data.total})</button>` : ''}

        <div class="price-pager">
          ${data.page > 0 ? '<button type="button" class="secondary-btn" id="pricePrev">الصفحة السابقة</button>' : ''}
          ${data.page + 1 < data.totalPages ? '<button type="button" class="secondary-btn" id="priceNext">الصفحة التالية</button>' : ''}
        </div>
      </div>`;

      content.querySelector('#priceBackHome').addEventListener('click', () => renderRepairPriceHome(content));

      content.querySelectorAll('[data-price-group]').forEach(btn =>
        btn.addEventListener('click', () => openPartGroupFromSearch(content, data.query, btn.dataset.priceGroup))
      );

      const showAll = content.querySelector('#priceShowAll');
      if (showAll) showAll.addEventListener('click', () => renderRepairPriceSearch(content, query, 1));

      const prev = content.querySelector('#pricePrev');
      const next = content.querySelector('#priceNext');
      if (prev) prev.addEventListener('click', () => renderRepairPriceSearch(content, query, data.page - 1));
      if (next) next.addEventListener('click', () => renderRepairPriceSearch(content, query, data.page + 1));

      content.querySelectorAll('.price-result-row.is-part').forEach(btn =>
        btn.addEventListener('click', () => renderRepairPriceIssues(
          content, btn.dataset.priceCategory, Number(btn.dataset.priceRow),
          { query: btn.dataset.query, page: Number(btn.dataset.page) }
        ))
      );
      content.querySelectorAll('.price-result-row:not(.is-part)').forEach(btn =>
        btn.addEventListener('click', () => renderRepairPriceIssues(content, btn.dataset.priceCategory, Number(btn.dataset.priceRow)))
      );
    } catch (e) {
      content.innerHTML = `<div class="price-screen">
        <button type="button" class="price-back" id="priceBackHome">← الأنواع</button>
        <p class="manager-load-error">${escapeHtml(e.message)}</p></div>`;
      content.querySelector('#priceBackHome').addEventListener('click', () => renderRepairPriceHome(content));
    }
  }

  /* A part group in the search results opens the models that price it. */
  async function openPartGroupFromSearch(content, query, issue) {
    const data = await api('repair_price_search_all', { query, mode: 'parts', pageSize: 50 });
    const target = (data.results || []).filter(r => r.kind === 'part' && r.issue === issue)[0];
    if (!target) return renderRepairPriceSearch(content, query, 0);
    renderRepairPriceModels(content, target.category, 0, issue);
  }


  async function openDeviceRegistration(){
    const panel=$('deviceRegisterPanel');
    panel.classList.remove('hidden');
    $('deviceRegisterMessage').classList.add('hidden');
    $('deviceTechnician').innerHTML='<option value="">جاري تحميل الفنيين...</option>';
    openModal('تسجيل جهاز جديد', panel);
    try{
      const data=await api('device_registration_options');
      if(!data.allowed){$('registerDeviceCard').classList.add('hidden');$('deviceRegisterMessage').textContent='تسجيل الأجهزة متاح لمسؤول الاستلام أو الإدارة فقط.';$('deviceRegisterMessage').classList.remove('hidden');return;}
      const technicians=data.technicians||[];
      $('deviceTechnician').innerHTML='<option value="">اختر الفني المسؤول</option>'+technicians.map(e=>`<option value="${escapeHtml(e.id)}">${escapeHtml(e.name)}${e.job?` — ${escapeHtml(e.job)}`:''}</option>`).join('');
      if(!technicians.length){$('deviceRegisterMessage').textContent=data.message||'لا يوجد مهندسون نشطون متاحون للإسناد. راجع شيت الموظفين.';$('deviceRegisterMessage').classList.remove('hidden');}
    }catch(e){$('deviceRegisterMessage').textContent=e.message;$('deviceRegisterMessage').classList.remove('hidden');}
  }
  async function submitDeviceRegistration(){
    const b=$('submitDeviceRegister');b.disabled=true;$('deviceRegisterMessage').classList.add('hidden');
    try{
      const result=await api('device_register',{orderId:$('deviceOrderId').value,technicianId:$('deviceTechnician').value});
      $('deviceOrderId').value='';$('deviceTechnician').value='';
      $('deviceRegisterMessage').textContent=`تم تسجيل الطلب ${result.orderId} وإسناده إلى ${result.technicianName}.`;
      $('deviceRegisterMessage').classList.remove('hidden');
      await showList('devices');
    }catch(e){$('deviceRegisterMessage').textContent=e.message;$('deviceRegisterMessage').classList.remove('hidden');}
    finally{b.disabled=false;}
  }

  async function loadMonthlySummary(){
    $('results').classList.remove('hidden');$('resultTitle').textContent='ملخص الشهر';$('resultBody').textContent='جاري تحميل التقرير...';
    openModal('ملخص الشهر', $('results'));
    try{
      const d=await api('monthly_summary');
      $('resultBody').innerHTML=`<div class="monthly-report"><div class="report-month">تقرير شهر <b>${escapeHtml(d.month)}</b></div><div class="report-grid">
        <div class="report-stat"><b>${Number(d.checkins)||0}</b><small>مرات تسجيل الحضور</small></div>
        <div class="report-stat"><b>${Number(d.checkouts)||0}</b><small>مرات تسجيل الانصراف</small></div>
        <div class="report-stat"><b>${Number(d.lateDays)||0}</b><small>أيام بها تأخير</small></div>
        <div class="report-stat"><b>${Number(d.lateMinutes)||0}</b><small>إجمالي دقائق التأخير</small></div>
        <div class="report-stat"><b>${Number(d.confirmedAbsences)||0}</b><small>حالات غياب مؤكدة</small></div>
        <div class="report-stat"><b>${Number(d.pendingAbsences)||0}</b><small>غياب تحت المراجعة</small></div>
        <div class="report-stat"><b>${Number(d.leaveCount)||0}</b><small>طلبات أذونات هذا الشهر</small></div>
      </div><p class="report-note">الأرقام تعكس السجلات والقرارات الموجودة حاليًا في النظام.</p></div>`;
    }catch(e){$('resultBody').textContent=e.message;}
  }


  async function submitWithdraw(){
    const b=$('submitWithdraw'); b.disabled=true; $('withdrawMessage').classList.add('hidden');
    try{
      const result=await api('cash_withdraw_create',{amount:$('withdrawAmount').value,purpose:$('withdrawPurpose').value});
      $('withdrawAmount').value=''; $('withdrawPurpose').value='';
      const text=result.employeeMessage || `تم تسجيل طلب سحب المبلغ. رقم الطلب: ${result.requestId}`;
      $('withdrawMessage').textContent=text; $('withdrawMessage').classList.remove('hidden');
      if(tg&&typeof tg.showAlert==='function') tg.showAlert(text);
    }catch(e){$('withdrawMessage').textContent=e.message;$('withdrawMessage').classList.remove('hidden');}
    finally{b.disabled=false;}
  }

  async function submitLeave() {
    const b=$('submitLeave'); b.disabled=true; $('requestMessage').classList.add('hidden');
    const type=$('leaveType').value, payload={leaveType:type,date:$('leaveDate').value,reason:$('leaveReason').value};
    if(type==='يوم كامل') payload.days=Number($('leaveDays').value); else {payload.from=$('leaveFrom').value;payload.hours=Number($('leaveHours').value);}
    try { const result=await api('leave_create',payload); $('leaveReason').value=''; messageRequest(`${result.message} · رقم الطلب ${result.requestId}`); await showList('leaves'); }
    catch(e){messageRequest(e.message,true);} finally{b.disabled=false;}
  }
  async function submitCash(){
    const b=$('submitCash'); b.disabled=true; $('requestMessage').classList.add('hidden');
    try { const result=await api('cash_create',{amount:$('cashAmount').value}); $('cashAmount').value=''; messageRequest(`${result.message} رقم الطلب: ${result.requestId}`); await showList('requests'); }
    catch(e){messageRequest(e.message,true);} finally{b.disabled=false;}
  }
  async function loadCashReviews(){
    const box=$('cashReviewBody');
    box.textContent='جاري تحميل طلبات السلف والعهد كلٌ في قسم مستقل...';
    try {
      const [advanceRows,custodyRows]=await Promise.all([
        api('list',{entity:'requests'}), api('list',{entity:'cash'})
      ]);
      const advances=advanceRows.filter(r=>String(r['نوع الطلب']||'').trim()==='سلفة');
      const pendingAdvances=advances.filter(r=>String(r['القرار']||'').trim()==='قيد الانتظار');
      const advanceCards=pendingAdvances.map(r=>`
        <article class="review-item">
          <strong>💵 طلب سلفة · ${escapeHtml(r['اسم الموظف']||'')}</strong>
          <p>المبلغ: ${escapeHtml(r['مبلغ السلفة بالجنيه']||r['التفاصيل']||'—')} جنيه<br>
          التاريخ: ${escapeHtml(formatDateTime12(r['التاريخ والوقت'])||'')}<br>الحالة: ${escapeHtml(r['القرار']||'قيد الانتظار')}</p>
          <div class="review-actions">
            <button class="primary-btn" data-advance-row="${r.__row}" data-decision="مقبول">موافقة على السلفة</button>
            <button class="secondary-btn" data-advance-row="${r.__row}" data-decision="مرفوض">رفض السلفة</button>
          </div>
        </article>`).join('');
      const custodyCards=[];
      custodyRows.forEach(r=>{
        const status=String(r['الحالة']||''), payout=String(r['حالة الصرف']||'');
        const custody=String(r['حالة العهدة']||''), settlement=String(r['حالة التسوية']||'');
        const base=`<p>${escapeHtml(r['اسم الموظف']||'')} · ${escapeHtml(r['المبلغ المطلوب بالجنيه']||'—')} جنيه<br>${escapeHtml(formatDateTime12(r['التاريخ والوقت'])||'')}<br>الغرض: ${escapeHtml(r['الغرض']||'—')}</p>`;
        if(status==='قيد المراجعة') custodyCards.push(`<article class="review-item"><strong>🧾 طلب سحب / عهدة · ${escapeHtml(r['رقم الطلب']||'')}</strong>${base}<div class="review-actions"><button class="primary-btn" data-cash-row="${r.__row}" data-cash-decision="مقبول">موافقة</button><button class="secondary-btn" data-cash-row="${r.__row}" data-cash-decision="مرفوض">رفض</button></div></article>`);
        if(status==='تمت الموافقة'&&payout!=='تم الصرف') custodyCards.push(`<article class="review-item"><strong>🧾 عهدة بانتظار الصرف · ${escapeHtml(r['رقم الطلب']||'')}</strong>${base}<div class="review-actions"><button class="primary-btn" data-cash-row="${r.__row}" data-cash-decision="تم الصرف">تأكيد صرف العهدة</button></div></article>`);
        if(settlement==='بانتظار مراجعة التسوية') custodyCards.push(`<article class="review-item"><strong>🧾 مراجعة تسوية عهدة · ${escapeHtml(r['رقم الطلب']||'')}</strong><p>${escapeHtml(r['اسم الموظف']||'')}<br>المعتمد: ${escapeHtml(r['المبلغ المعتمد بالجنيه']||'—')} جنيه<br>المصروف: ${escapeHtml(r['المصروف الفعلي بالجنيه']||'—')} جنيه<br>المطلوب إرجاعه: ${escapeHtml(r['المبلغ المطلوب إرجاعه بالجنيه']||'—')} جنيه<br>ملاحظات: ${escapeHtml(r['ملاحظات التسوية']||'—')}</p><div class="review-actions"><button class="primary-btn" data-settle-review="${r.__row}" data-settle-decision="مقبول">اعتماد التسوية</button><button class="secondary-btn" data-settle-review="${r.__row}" data-settle-decision="مرفوض">إرجاع للتصحيح</button></div></article>`);
        if(custody==='بانتظار تأكيد استلام المتبقي') custodyCards.push(`<article class="review-item"><strong>🧾 تأكيد استلام المتبقي · ${escapeHtml(r['رقم الطلب']||'')}</strong><p>${escapeHtml(r['اسم الموظف']||'')}<br>المبلغ المطلوب استلامه: ${escapeHtml(r['المبلغ المطلوب إرجاعه بالجنيه']||'—')} جنيه</p><div class="review-actions"><button class="primary-btn" data-return-confirm="${r.__row}">تأكيد استلام المبلغ</button></div></article>`);
      });
      box.innerHTML=`
        <section class="finance-queue"><h3>💵 طلبات السلف (${pendingAdvances.length} معلّق)</h3>
          ${advanceCards||'<p class="muted">لا توجد طلبات سلف معلقة.</p>'}</section>
        <section class="finance-queue"><h3>🧾 طلبات السحب والعهد والتسويات (${custodyCards.length} إجراء معلق)</h3>
          ${custodyCards.join('')||'<p class="muted">لا توجد طلبات سحب أو تسويات معلقة.</p>'}</section>`;
      box.querySelectorAll('[data-advance-row]').forEach(b=>b.addEventListener('click',()=>decide('request_decide',b.dataset.advanceRow,b.dataset.decision)));
      box.querySelectorAll('[data-cash-row]').forEach(b=>b.addEventListener('click',()=>decideCash(b.dataset.cashRow,b.dataset.cashDecision)));
      box.querySelectorAll('[data-settle-review]').forEach(b=>b.addEventListener('click',()=>reviewCashSettlement(b.dataset.settleReview,b.dataset.settleDecision)));
      box.querySelectorAll('[data-return-confirm]').forEach(b=>b.addEventListener('click',()=>confirmCashReturn(b.dataset.returnConfirm)));
    } catch(e){box.textContent=e.message;}
  }

  async function reviewCashSettlement(row,decision){
    const note=prompt(decision==='مقبول'?'ملاحظات اعتماد التسوية (اختياري):':'سبب إرجاع التسوية للتصحيح:')||'';
    if(decision==='مرفوض'&&!note.trim()){messageRequest('اكتب سبب إرجاع التسوية للتصحيح.',true);return;}
    if(!confirm(`تأكيد ${decision==='مقبول'?'اعتماد':'إرجاع'} التسوية؟`))return;
    try{await api('cash_settlement_decide',{row:Number(row),decision,note});await loadCashReviews();messageRequest('تم تحديث التسوية.');}
    catch(e){messageRequest(e.message,true);}
  }
  async function confirmCashReturn(row){
    if(!confirm('هل تم استلام المبلغ المتبقي فعليًا؟'))return;
    try{await api('cash_return_confirm',{row:Number(row)});await loadCashReviews();messageRequest('تم إغلاق العهدة.');}
    catch(e){messageRequest(e.message,true);}
  }
  async function decideCash(row,decision){ const note=decision==='مرفوض'?prompt('سبب الرفض (اختياري):')||'':''; if(!confirm(`تأكيد إجراء «${decision}»؟`))return; try{await api('cash_decide',{row:Number(row),decision,note});await loadCashReviews();messageRequest('تم تحديث طلب السلفة.');}catch(e){messageRequest(e.message,true);} }


  async function submitComplaint(){
    const b=$('submitComplaint'); b.disabled=true;
    try{
      const r=await api('complaint_create',{type:$('complaintType').value,person:$('complaintPerson').value,details:$('complaintDetails').value});
      $('complaintDetails').value=''; $('complaintPerson').value='';
      messageRequest(`تم تسجيل الشكوى بنجاح. رقم الشكوى: ${r.complaintId}`);
      await showList('complaints');
    }catch(e){messageRequest(e.message,true);}finally{b.disabled=false;}
  }
  async function openComplaint(id){
    const box=$('resultBody'); box.textContent='جاري تحميل المحادثة...';
    try{
      const d=await api('complaint_thread',{complaintId:id});
      const msgs=(d.messages||[]).map(m=>`<div class="record"><strong>${escapeHtml(m.senderName||m.senderRole)}</strong><small class="record-meta">${escapeHtml(m.createdAt||'')}</small><p>${escapeHtml(m.message||'')}</p></div>`).join('');
      box.innerHTML=`<article class="record"><strong>${escapeHtml(d.complaint.id)} · ${escapeHtml(d.complaint.type)}</strong><small class="record-meta">${escapeHtml(d.complaint.status)} · ${escapeHtml(d.complaint.createdAt)}</small><p>${escapeHtml(d.complaint.details)}</p></article><div class="complaint-messages">${msgs||'<p class="muted">لا توجد ردود حتى الآن.</p>'}</div>${d.complaint.status==='مغلقة'?'':`<label>اكتب ردك<textarea id="complaintReply" rows="3" maxlength="2000" placeholder="اكتب رسالتك..."></textarea></label><button class="primary-btn" id="sendComplaintReply">إرسال الرد</button>`}${['super_admin','admin','supervisor'].includes(currentRole)?`<div class="review-actions"><button class="secondary-btn" data-cstatus="قيد التحقيق">قيد التحقيق</button><button class="secondary-btn" data-cstatus="تم الحل">تم الحل</button><button class="secondary-btn" data-cstatus="مغلقة">إغلاق الشكوى</button></div>`:''}`;
      const send=$('sendComplaintReply'); if(send) send.addEventListener('click',async()=>{send.disabled=true;try{await api('complaint_message',{complaintId:id,message:$('complaintReply').value});await openComplaint(id);}catch(e){messageRequest(e.message,true);send.disabled=false;}});
      box.querySelectorAll('[data-cstatus]').forEach(btn=>btn.addEventListener('click',async()=>{const status=btn.dataset.cstatus;const note=status==='مغلقة'?(prompt('ملاحظة الإغلاق (اختياري):')||''):'';if(!confirm(`تأكيد تغيير حالة الشكوى إلى «${status}»؟`))return;btn.disabled=true;try{await api('complaint_status',{complaintId:id,status,note});await openComplaint(id);}catch(e){messageRequest(e.message,true);btn.disabled=false;}}));
      $('resultTitle').textContent='محادثة الشكوى';
    }catch(e){box.textContent=e.message;}
  }
  function messageRequest(text,isError=false){const el=$('requestMessage');el.textContent=text;el.classList.toggle('is-error',isError);el.classList.remove('hidden');const modalMsg=$('modalMessage');if(modalMsg){modalMsg.textContent=text;modalMsg.classList.toggle('is-error',isError);modalMsg.classList.remove('hidden');}}
  function switchRequestForm(which){
    $('requestPicker').classList.add('hidden');
    $('leaveForm').classList.toggle('hidden',which!=='leave');
    $('cashForm').classList.toggle('hidden',which!=='cash');
    $('complaintForm').classList.toggle('hidden',which!=='complaint');
    $('complaintsTab').classList.toggle('active',which==='complaint');
    $('newLeaveTab').classList.toggle('active',which==='leave');
    $('newCashTab').classList.toggle('active',which==='cash');
    $('myRequestsTab').classList.remove('active');
    $('requestMessage').classList.add('hidden');
  }
  function syncLeaveFields(){const hourly=$('leaveType').value==='بالساعات';$('leaveDaysWrap').classList.toggle('hidden',hourly);$('leaveHoursWrap').classList.toggle('hidden',!hourly);}
  async function loadReviews(){
    const box=$('reviewBody'); box.textContent='جاري تحميل الطلبات المعلقة...';
    try { const [requests,leaves]=await Promise.all([api('list',{entity:'requests'}),api('list',{entity:'leaves'})]);
      const pendingR=requests.filter(r=>(r['القرار']||'')==='قيد الانتظار'); const pendingL=leaves.filter(r=>(r['الحالة']||'')==='بانتظار مراجعة المدير');
      const cards=[];
      pendingR.forEach(r=>cards.push(`<article class="review-item"><strong>طلب مهندس · ${escapeHtml(r['نوع الطلب']||'')}</strong><p>${escapeHtml(r['اسم الموظف']||'')}\n${escapeHtml(r['التفاصيل']||'')}\n${escapeHtml(formatDateTime12(r['التاريخ والوقت'])||'')}</p><div class="review-actions"><button class="primary-btn" data-decide-request="${r.__row||''}" data-decision="مقبول">موافقة</button><button class="secondary-btn" data-decide-request="${r.__row||''}" data-decision="مرفوض">رفض</button></div></article>`));
      pendingL.forEach(r=>cards.push(`<article class="review-item"><strong>إذن · ${escapeHtml(r['نوع الإذن']||'')}</strong><p>${escapeHtml(r['اسم الموظف']||'')} · ${escapeHtml(r['تاريخ الإذن']||'')} ${escapeHtml(r['تاريخ نهاية الإذن']||'')}\n${escapeHtml(formatTime12(r['من الساعة'])||'')} إلى ${escapeHtml(formatTime12(r['إلى الساعة'])||'')}\n${escapeHtml(r['السبب']||'')}\n${escapeHtml(r['رقم الطلب']||'')}</p><div class="review-actions"><button class="primary-btn" data-decide-leave="${r.__row||''}" data-decision="مقبول">موافقة</button><button class="secondary-btn" data-decide-leave="${r.__row||''}" data-decision="مرفوض">رفض</button></div></article>`));
      box.innerHTML=cards.length?cards.join(''):'لا توجد طلبات أو أذونات معلقة.';
      box.querySelectorAll('[data-decide-request]').forEach(b=>b.addEventListener('click',()=>decide('request_decide',b.dataset.decideRequest,b.dataset.decision)));
      box.querySelectorAll('[data-decide-leave]').forEach(b=>b.addEventListener('click',()=>decide('leave_decide',b.dataset.decideLeave,b.dataset.decision)));
    } catch(e){box.textContent=e.message;}
  }
  async function decide(action,row,decision){if(!row){messageRequest('تعذر تحديد رقم السجل. حدّث القائمة. ',true);return;} if(!confirm(`تأكيد ${decision}؟`))return;try{await api(action,{row:Number(row),decision});await loadReviews();messageRequest('تم تسجيل القرار.');}catch(e){messageRequest(e.message,true);}}


  function financeMessage(text,isError=false){
    const el=$('financeMessage'); el.textContent=text; el.classList.toggle('is-error',isError); el.classList.remove('hidden');
  }
  function switchFinance(which){
    ['financeEmployeeView','deductionAdminView','rewardAdminView'].forEach(id=>$(id).classList.add('hidden'));
    ['myFinanceTab','deductionAdminTab','rewardAdminTab'].forEach(id=>$(id).classList.remove('active'));
    const map={mine:['financeEmployeeView','myFinanceTab'],deductions:['deductionAdminView','deductionAdminTab'],rewards:['rewardAdminView','rewardAdminTab']};
    if(map[which]){ $(map[which][0]).classList.remove('hidden'); $(map[which][1]).classList.add('active');}
    $('financeMessage').classList.add('hidden');
  }
  async function loadFinanceSummary(){
    switchFinance('mine');
    const summary = $('financeSummary');
    const deductions = $('myDeductionRows');
    summary.innerHTML = '<div class="loading-state">جاري تحميل تقرير المكافآت من سجلات الحضور والورديات...</div>';
    deductions.innerHTML = '';
    try{
      const d=await api('reward_summary',{});
      const money=n=>`${Number(n||0).toLocaleString('en-EG',{minimumFractionDigits:2,maximumFractionDigits:2})} جنيه`;
      const pct=Math.max(0,Math.min(100,Math.round(Number(d.ratio||0)*100)));
      const pointsLabel=`${Number(d.earned||0)} / ${Number(d.scoredEligible||0)}`;
      const noShift=Number(d.shifts||0)===0;
      summary.innerHTML=`
        <section class="reward-report">
          <header class="reward-report-head">
            <div><span class="reward-kicker">MOBIHUB REWARDS</span><h3>🏆 مكافآتي | ${escapeHtml(d.month||'')}</h3><small>${escapeHtml(d.employeeName||'')}</small></div>
            <span class="reward-month-chip">${escapeHtml(d.month||'')}</span>
          </header>
          <div class="reward-main-amount">
            <small>المكافأة الأساسية التقديرية</small>
            <strong>${money(d.base)} <i>/ 500.00 جنيه</i></strong>
            <div class="reward-progress"><span style="width:${pct}%"></span></div>
            <small>${pct}% من المكافأة الأساسية</small>
          </div>
          <div class="reward-score-grid">
            <article><small>النقاط المحققة / المحسومة</small><b>${pointsLabel}</b></article>
            <article><small>إجمالي نقاط الشهر المجدولة</small><b>${Number(d.eligible||0)}</b></article>
            <article><small>الورديات المحتسبة</small><b>${Number(d.shifts||0)}</b></article>
            <article><small>الورديات المستبعدة</small><b>${Number(d.excluded||0)}</b></article>
          </div>
          <h4>📌 تفاصيل النقاط</h4>
          <div class="reward-detail-row"><span>🤝 الالتزام (الحضور في الموعد + اليونيفورم)</span><b>${Number(d.commitment||0)} نقطة</b></div>
          <div class="reward-detail-row"><span>✅ الحضور في الموعد</span><b>${Number(d.onTime||0)}</b></div>
          <div class="reward-detail-row"><span>👕 الالتزام باليونيفورم</span><b>${Number(d.uniform||0)}</b></div>
          <div class="reward-detail-row"><span>🧹 نظافة المكان</span><b>${Number(d.hygienePoints||0)} نقطة</b></div>
          <div class="reward-detail-row"><span>⏳ تقييمات النظافة المعلقة</span><b>${Number(d.hygienePending||0)} يوم</b></div>
          <div class="reward-detail-row"><span>🧽 تقييمات نظافة معتمدة (نظيف / غير ملتزم)</span><b>${Number(d.clean||0)} / ${Number(d.notClean||0)}</b></div>
          <h4>💰 ملخص المستحقات</h4>
          <div class="reward-detail-row"><span>🎁 مكافآت إضافية معتمدة</span><b>${money(d.bonus)}</b></div>
          <div class="reward-detail-row reward-total"><span>💵 إجمالي المكافآت التقديري</span><b>${money(d.total)}</b></div>
          ${noShift?'<div class="reward-notice warning">لا توجد ورديات مرتبطة بحسابك في جدول الورديات لهذا الشهر. لذلك لا توجد نقاط محسوبة. راجع الإدارة للتأكد من تعيين الوردية.</div>':''}
          <div class="reward-notice">💡 نقطة الالتزام لا تُحسب إلا عند الجمع بين الحضور في الموعد والالتزام باليونيفورم. نقطة النظافة تُحتسب بعد تقييم المدير. التقييمات المعلقة لا تدخل في النسبة حتى لا تُحسب كنقاط صفرية. النسبة الحالية تخص الورديات المكتملة قبل اليوم، والورديات القادمة تظهر في إجمالي الشهر المجدول.</div>
        </section>`;
      deductions.innerHTML=(d.deductionRows||[]).length
        ? '<h3>آخر الخصومات المعتمدة والمعلقة</h3>'+d.deductionRows.map(r=>`<article class="record"><strong>${escapeHtml(r['نوع الخصم']||'خصم')} · ${escapeHtml(r['الحالة']||'')}</strong><small class="record-meta">${escapeHtml(r['تاريخ الواقعة']||'')} · ${money(r['المبلغ بالجنيه'])}</small><p>${escapeHtml(r['السبب']||'')}</p></article>`).join('')
        : '<p class="muted">لا توجد خصومات مسجلة لهذا الشهر.</p>';
    }catch(e){
      summary.innerHTML='';
      financeMessage(e.message || 'تعذر تحميل تقرير المكافآت. راجع اتصال التطبيق ونسخة Apps Script المنشورة.',true);
    }
  }

  async function loadFinanceEmployees(){
    const rows=await api('active_employees',{});
    const options=rows.map(r=>`<option value="${escapeHtml(r['Chat ID'])}">${escapeHtml(r['اسم الموظف'])}</option>`).join('');
    $('deductionEmployee').innerHTML=options; $('rewardEmployee').innerHTML=options;
  }
  async function loadPendingDeductions(){
    const box=$('pendingDeductions'); box.textContent='جاري تحميل الخصومات المعلقة...';
    try{
      const rows=await api('list',{entity:'deductions'});
      const pending=rows.filter(r=>String(r['الحالة'])==='بانتظار اعتماد المدير');
      box.innerHTML=pending.length?pending.map(r=>`<article class="review-item"><strong>${escapeHtml(r['اسم الموظف'])} · ${escapeHtml(r['نوع الخصم'])}</strong><p>${escapeHtml(r['السبب'])}<br>${escapeHtml(r['المبلغ بالجنيه'])} جنيه · ${escapeHtml(r['تاريخ الواقعة'])}</p><div class="review-actions"><button class="primary-btn" data-ded-row="${r.__row}" data-ded-decision="معتمد">اعتماد</button><button class="secondary-btn" data-ded-row="${r.__row}" data-ded-decision="مرفوض">رفض</button></div></article>`).join(''):'لا توجد خصومات معلقة.';
      box.querySelectorAll('[data-ded-row]').forEach(b=>b.addEventListener('click',async()=>{const note=b.dataset.dedDecision==='مرفوض'?(prompt('سبب الرفض:')||''):'';if(b.dataset.dedDecision==='مرفوض'&&!note.trim())return;try{await api('deduction_decide',{row:Number(b.dataset.dedRow),decision:b.dataset.dedDecision,note});await loadPendingDeductions();}catch(e){financeMessage(e.message,true);}}));
    }catch(e){box.textContent=e.message;}
  }
  async function submitDeduction(){
    const b=$('submitDeduction');b.disabled=true;
    try{const r=await api('deduction_create',{employeeId:$('deductionEmployee').value,type:$('deductionType').value,amount:$('deductionAmount').value,reason:$('deductionReason').value});$('deductionAmount').value='';$('deductionReason').value='';financeMessage(`تم تسجيل الخصم ${r.deductionId} وإرساله للمراجعة.`);await loadPendingDeductions();}
    catch(e){financeMessage(e.message,true);}finally{b.disabled=false;}
  }
  async function saveHygiene(){
    const b=$('saveHygiene');b.disabled=true;
    try{await api('reward_hygiene_set',{employeeId:$('rewardEmployee').value,date:$('hygieneDate').value,rating:$('hygieneRating').value,note:$('hygieneNote').value});financeMessage('تم حفظ تقييم النظافة.');$('hygieneNote').value='';}
    catch(e){financeMessage(e.message,true);}finally{b.disabled=false;}
  }
  async function submitBonus(){
    const b=$('submitBonus');b.disabled=true;
    try{const r=await api('reward_bonus_create',{employeeId:$('rewardEmployee').value,amount:$('bonusAmount').value,reason:$('bonusReason').value});$('bonusAmount').value='';$('bonusReason').value='';financeMessage(`تمت إضافة المكافأة واعتمادها بقيمة ${r.amount} جنيه.`);}
    catch(e){financeMessage(e.message,true);}finally{b.disabled=false;}
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ============ Theme (dark / light) ============
   * The palette lives entirely in CSS variables, so switching the
   * data-theme attribute on <html> restyles every component at once.
   * The choice is remembered per device and also seeds from the
   * Telegram client theme on first open.
   */
  function applyTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('mobihub-theme', next); } catch (_) {}
    const toggle = $('themeToggle');
    if (toggle) {
      const isLight = next === 'light';
      toggle.textContent = isLight ? '☾' : '☀';
      toggle.setAttribute('aria-pressed', String(isLight));
      toggle.setAttribute('aria-label', isLight ? 'التبديل إلى الوضع الداكن' : 'التبديل إلى الوضع الفاتح');
    }
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', next === 'light' ? '#F4F7FA' : '#080D12');
    if (tg?.setHeaderColor) {
      try { tg.setHeaderColor(next === 'light' ? '#F4F7FA' : '#080D12'); } catch (_) {}
    }
    if (tg?.setBackgroundColor) {
      try { tg.setBackgroundColor(next === 'light' ? '#F4F7FA' : '#080D12'); } catch (_) {}
    }
  }

  function initTheme() {
    let stored = '';
    try { stored = localStorage.getItem('mobihub-theme') || ''; } catch (_) {}
    const telegramLight = tg?.colorScheme === 'light';
    applyTheme(stored || (telegramLight ? 'light' : 'dark'));
    $('themeToggle')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'light' ? 'dark' : 'light');
      if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    });
  }

  /* ============================================================
   * TASKS — «تسكاتي»
   * Employees see only their own tasks; progress moves forward and
   * completion is approved by a manager.
   * ============================================================ */

  const TASK_STATUS_LABEL = {
    'جديدة': 'جديدة',
    'قيد التنفيذ': 'قيد التنفيذ',
    'بانتظار المراجعة': 'بانتظار المراجعة',
    'مكتملة': 'مكتملة',
    'ملغاة': 'ملغاة'
  };
  const TASK_STATUS_CLASS = {
    'جديدة': 'is-new',
    'قيد التنفيذ': 'is-progress',
    'بانتظار المراجعة': 'is-review',
    'مكتملة': 'is-done',
    'ملغاة': 'is-cancelled'
  };

  function taskStatusBadge(status) {
    return `<span class="task-status ${TASK_STATUS_CLASS[status] || 'is-new'}">${escapeHtml(TASK_STATUS_LABEL[status] || status)}</span>`;
  }

  function taskDueLabel(task) {
    if (!task.dueDate) return 'بدون تاريخ استحقاق';
    if (task.overdue) return `متأخرة · ${task.dueDate}`;
    return `الاستحقاق ${task.dueDate}`;
  }

  /** Refresh the home badge with open/overdue task counts. */
  async function refreshTasksBadge(counts) {
    const badge = $('tasksBadge');
    if (!badge) return;
    let data = counts;
    if (!data) {
      try { data = (await api('tasks_list')).summary; } catch (_) { return; }
    }
    const open = Number(data.open || 0);
    const overdue = Number(data.overdue || 0);
    if (!open) { badge.classList.add('hidden'); badge.textContent = '0'; return; }
    badge.textContent = open > 99 ? '99+' : String(open);
    badge.classList.toggle('is-urgent', overdue > 0);
    badge.classList.remove('hidden');
  }

  async function openTasksPanel() {
    const panel = managerPanel('تسكاتي', '<div class="manager-loading">جاري تحميل مهامك...</div>');
    const content = panel.querySelector('.manager-module-content');
    await renderTasksList(content);
  }

  /* Replacing innerHTML resets the panel scroll position, which made the
   * "إرسال للمراجعة" button jump out of reach while scrolling. Every task
   * re-render now restores the previous scroll offset. */
  /* Restores the panel scroll offset after an async re-render.
   * The previous version restored synchronously, before renderTasksList had
   * finished its API call, so the list reset to the top and the action
   * buttons jumped out of reach. This waits for the render promise. */
  async function keepScroll(content, render) {
    const top = content ? content.scrollTop : 0;
    await render();
    if (!content) return;
    content.scrollTop = top;
    await new Promise(resolve => requestAnimationFrame(resolve));
    content.scrollTop = top;
  }

  async function renderTasksList(content, filter) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل مهامك...</div>';
    try {
      const data = await api('tasks_list');
      const tasks = data.tasks || [];
      const summary = data.summary || {};
      const current = filter || 'open';
      const visible = current === 'all' ? tasks
        : current === 'done' ? tasks.filter(t => t.status === 'مكتملة')
        : tasks.filter(t => ['جديدة', 'قيد التنفيذ', 'بانتظار المراجعة'].indexOf(t.status) >= 0);

      content.innerHTML = `<div class="tasks-screen">
        <div class="tasks-summary">
          <div class="tasks-summary-item"><b>${summary.open || 0}</b><small>مفتوحة</small></div>
          <div class="tasks-summary-item${summary.overdue ? ' is-urgent' : ''}"><b>${summary.overdue || 0}</b><small>متأخرة</small></div>
          <div class="tasks-summary-item"><b>${summary.done || 0}</b><small>مكتملة</small></div>
        </div>

        <div class="tasks-tabs">
          <button type="button" class="tasks-tab${current === 'open' ? ' active' : ''}" data-task-filter="open">المفتوحة</button>
          <button type="button" class="tasks-tab${current === 'done' ? ' active' : ''}" data-task-filter="done">المكتملة</button>
          <button type="button" class="tasks-tab${current === 'all' ? ' active' : ''}" data-task-filter="all">الكل</button>
        </div>

        <div class="tasks-list">
          ${visible.length ? visible.map(task => `<button type="button" class="task-row${task.overdue ? ' is-overdue' : ''}" data-task-id="${escapeHtml(task.id)}">
            <span class="task-row-main">
              <b>${escapeHtml(task.title)}</b>
              <small>${escapeHtml(task.type || 'مهمة')} · ${escapeHtml(task.priority)} · ${escapeHtml(taskDueLabel(task))}</small>
              <span class="task-progress"><span style="width:${Math.max(0, Math.min(100, Number(task.progress) || 0))}%"></span></span>
            </span>
            ${taskStatusBadge(task.status)}
          </button>`).join('') : `<p class="manager-empty-state"><b>لا توجد مهام هنا</b><p>${current === 'done' ? 'لم تُكمل أي مهمة بعد.' : 'لا توجد مهام مفتوحة حاليًا. أحسنت!'}</p></p>`}
        </div>
      </div>`;

      content.querySelectorAll('[data-task-filter]').forEach(btn =>
        btn.addEventListener('click', async () => { await keepScroll(content, () => renderTasksList(content, btn.dataset.taskFilter)); })
      );
      content.querySelectorAll('[data-task-id]').forEach(btn =>
        btn.addEventListener('click', async () => { await keepScroll(content, () => openTaskDetail(content, btn.dataset.taskId)); })
      );
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  async function openTaskDetail(content, taskId) {
    const data = await api('tasks_list');
    const task = (data.tasks || []).find(t => t.id === taskId);
    if (!task) { renderTasksList(content); return; }

    const canSubmit = ['جديدة', 'قيد التنفيذ'].indexOf(task.status) >= 0;
    const waiting = task.status === 'بانتظار المراجعة';
    const done = task.status === 'مكتملة';

    content.innerHTML = `<div class="tasks-screen">
      <div class="price-screen-head">
        <button type="button" class="price-back" id="taskBackList">← المهام</button>
        <div><h4>${escapeHtml(task.title)}</h4><small>${escapeHtml(task.type || 'مهمة')} · ${escapeHtml(task.priority)}</small></div>
      </div>

      <div class="task-detail-card">
        <div class="task-detail-row"><span>الحالة</span><b>${taskStatusBadge(task.status)}</b></div>
        <div class="task-detail-row"><span>الاستحقاق</span><b class="${task.overdue ? 'is-late' : ''}">${escapeHtml(task.dueDate || '—')}${task.overdue ? ' (متأخرة)' : ''}</b></div>
        <div class="task-detail-row"><span>نسبة الإنجاز</span><b>${Number(task.progress) || 0}%</b></div>
        ${task.proofUrl ? `<div class="task-detail-row"><span>الدليل</span><a href="${escapeHtml(task.proofUrl)}" target="_blank" rel="noopener">فتح الرابط</a></div>` : ''}
      </div>

      ${task.details ? `<div class="task-details-text">${escapeHtml(task.details)}</div>` : ''}

      ${done ? `<p class="task-done-note">تم اعتماد هذه المهمة. شكرًا لالتزامك.</p>` : ''}
      ${waiting ? `<p class="task-waiting-note">أُرسلت للمراجعة. سيتم إبلاغك بعد اعتماد المدير.</p>` : ''}

      ${canSubmit ? `<div class="task-edit">
        <label>نسبة الإنجاز
          <input id="taskProgressRange" type="range" min="0" max="100" step="5" value="${Number(task.progress) || 0}">
          <output id="taskProgressValue">${Number(task.progress) || 0}%</output>
        </label>
        <label>رابط الدليل (اختياري)<input id="taskProofInput" type="url" maxlength="500" placeholder="رابط صورة أو فيديو أو منشور" value="${escapeHtml(task.proofUrl || '')}"></label>
        <label>ملاحظتك<textarea id="taskNoteInput" rows="3" maxlength="1000" placeholder="اكتب ما تم إنجازه...">${escapeHtml(task.employeeNote || '')}</textarea></label>
      </div>
      <div class="task-actions-sticky">
        <button type="button" class="primary-btn" id="taskSubmitReview">إرسال للمراجعة</button>
        <button type="button" class="secondary-btn" id="taskSaveDraft">حفظ التقدم فقط</button>
      </div>` : ''}
    </div>`;

    content.querySelector('#taskBackList').addEventListener('click', () => renderTasksList(content));

    if (canSubmit) {
      const range = content.querySelector('#taskProgressRange');
      const output = content.querySelector('#taskProgressValue');
      range.addEventListener('input', () => { output.textContent = range.value + '%'; });

      const collect = status => ({
        taskId: task.id,
        status,
        progress: Number(range.value),
        proofUrl: content.querySelector('#taskProofInput').value.trim(),
        note: content.querySelector('#taskNoteInput').value.trim()
      });

      content.querySelector('#taskSaveDraft').addEventListener('click', async ev => {
        const btn = ev.currentTarget;
        btn.disabled = true;
        try {
          const res = await api('task_update', collect('قيد التنفيذ'));
          if (tg?.showAlert) tg.showAlert(res.message || 'تم حفظ التقدم.');
          refreshTasksBadge();
          await keepScroll(content, () => renderTasksList(content));
        } catch (e) {
          if (tg?.showAlert) tg.showAlert(e.message);
          btn.disabled = false;
        }
      });

      content.querySelector('#taskSubmitReview').addEventListener('click', async ev => {
        const btn = ev.currentTarget;
        btn.disabled = true;
        try {
          const res = await api('task_update', collect('بانتظار المراجعة'));
          if (tg?.showAlert) tg.showAlert(res.message || 'تم إرسال المهمة للمراجعة.');
          refreshTasksBadge();
          await keepScroll(content, () => renderTasksList(content));
        } catch (e) {
          if (tg?.showAlert) tg.showAlert(e.message);
          btn.disabled = false;
        }
      });
    }
  }

  /* ---------- Manager side: create and review tasks ---------- */

  async function openTaskAdminPanel() {
    const panel = managerPanel('المهام والتسكات', '<div class="manager-loading">جاري تحميل المهام...</div>');
    const content = panel.querySelector('.manager-module-content');
    await renderTaskAdmin(content);
  }

  async function renderTaskAdmin(content) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل المهام...</div>';
    try {
      const data = await api('tasks_list', { scope: 'all' });
      const tasks = data.tasks || [];
      const review = tasks.filter(t => t.status === 'بانتظار المراجعة');
      const open = tasks.filter(t => ['جديدة', 'قيد التنفيذ'].indexOf(t.status) >= 0);

      content.innerHTML = `<div class="tasks-screen">
        <div class="tasks-summary">
          <div class="tasks-summary-item"><b>${open.length}</b><small>قيد العمل</small></div>
          <div class="tasks-summary-item${review.length ? ' is-urgent' : ''}"><b>${review.length}</b><small>بانتظار المراجعة</small></div>
          <div class="tasks-summary-item"><b>${data.summary.done || 0}</b><small>مكتملة</small></div>
        </div>

        <button type="button" class="primary-btn" id="taskCreateOpen">+ إنشاء مهمة جديدة</button>
        <button type="button" class="secondary-btn" id="taskSeedMarketing">إضافة مهام الدعاية لكل الفنيين</button>
        <button type="button" class="secondary-btn" id="taskRepairBtn">إصلاح صفوف المهام</button>

        ${review.length ? `<h5 class="price-group-title">تحتاج مراجعتك</h5>
          <div class="tasks-list">${review.map(t => `<div class="task-row is-review" data-task-open="${escapeHtml(t.id)}">
            <span class="task-row-main"><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.employeeName)} · ${escapeHtml(t.dueDate || '')}</small></span>
            <span class="task-row-actions">
              <button type="button" class="task-mini-btn is-approve" data-task-approve="${escapeHtml(t.id)}">اعتماد</button>
              <button type="button" class="task-mini-btn" data-task-return="${escapeHtml(t.id)}">إعادة</button>
            </span>
          </div>`).join('')}</div>` : ''}

        <h5 class="price-group-title">كل المهام</h5>
        <div class="tasks-list">
          ${tasks.length ? tasks.map(t => `<button type="button" class="task-row" data-task-open="${escapeHtml(t.id)}">
            <span class="task-row-main"><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.employeeName)} · ${escapeHtml(t.type)} · ${escapeHtml(taskDueLabel(t))}</small></span>
            ${taskStatusBadge(t.status)}
          </button>`).join('') : '<p class="manager-empty-state">لا توجد مهام بعد.</p>'}
        </div>
      </div>`;

            content.querySelector('#taskCreateOpen').addEventListener('click', () => renderTaskCreateForm(content));
      const repairBtn = content.querySelector('#taskRepairBtn');
      if (repairBtn) repairBtn.addEventListener('click', async function() {
        const ok = tg?.showConfirm ? await new Promise(function(res) { tg.showConfirm('فحص صفوف المهام وإصلاح التالف منها؟', res); }) : window.confirm('فحص صفوف المهام وإصلاح التالف منها؟');
        if (!ok) return;
        repairBtn.disabled = true;
        repairBtn.textContent = 'جارٍ الفحص...';
        try {
          const res = await api('tasks_repair');
          if (tg?.showAlert) tg.showAlert(res.message || 'تم الفحص.');
          renderTaskAdmin(content);
        } catch (e) {
          if (tg?.showAlert) tg.showAlert(e.message);
          repairBtn.disabled = false;
          repairBtn.textContent = 'إصلاح صفوف المهام';
        }
      });
      content.querySelector('#taskSeedMarketing').addEventListener('click', async ev => {
        const btn = ev.currentTarget;
        btn.disabled = true;
        try {
          const res = await api('task_seed_marketing');
          if (tg?.showAlert) tg.showAlert(res.seeded ? `تمت إضافة ${res.seeded} مهمة لـ ${res.technicians} فني.` : (res.message || 'لا توجد مهام جديدة.'));
          renderTaskAdmin(content);
        } catch (e) {
          if (tg?.showAlert) tg.showAlert(e.message);
          btn.disabled = false;
        }
      });
      content.querySelectorAll('[data-task-approve]').forEach(btn =>
        btn.addEventListener('click', () => reviewTask(content, btn.dataset.taskApprove, 'اعتماد'))
      );
      content.querySelectorAll('[data-task-return]').forEach(btn =>
        btn.addEventListener('click', () => reviewTask(content, btn.dataset.taskReturn, 'إعادة'))
      );
      content.querySelectorAll('[data-task-open]').forEach(el =>
        el.addEventListener('click', ev => {
          if (ev.target.closest('[data-task-approve],[data-task-return]')) return;
          openTaskReview(content, el.dataset.taskOpen);
        })
      );
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  /* ---------- Manager: detailed review of one task ---------- */
  async function openTaskReview(content, taskId) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل تفاصيل المهمة...</div>';
    try {
      const data = await api('tasks_list', { scope: 'all' });
      const task = (data.tasks || []).find(t => t.id === taskId);
      if (!task) { renderTaskAdmin(content); return; }

      const proof = String(task.proofUrl || '').trim();
      const isLink = /^https?:\/\//i.test(proof);

      content.innerHTML = `<div class="tasks-screen">
        <div class="price-screen-head">
          <button type="button" class="price-back" id="taskReviewBack">← المهام</button>
          <div><h4>${escapeHtml(task.title)}</h4><small>${escapeHtml(task.employeeName)} · ${escapeHtml(task.type)}</small></div>
        </div>

        <div class="task-detail-card">
          <div class="task-detail-row"><span>الحالة</span><b>${taskStatusBadge(task.status)}</b></div>
          <div class="task-detail-row"><span>الأولوية</span><b>${escapeHtml(task.priority)}</b></div>
          <div class="task-detail-row"><span>الاستحقاق</span><b class="${task.overdue ? 'is-late' : ''}">${escapeHtml(task.dueDate || '—')}${task.overdue ? ' (متأخرة)' : ''}</b></div>
          <div class="task-detail-row"><span>نسبة الإنجاز</span><b>${Number(task.progress) || 0}%</b></div>
          <div class="task-detail-row"><span>أنشأها</span><b>${escapeHtml(task.createdBy || '—')}</b></div>
          <div class="task-detail-row"><span>تاريخ الإنشاء</span><b>${escapeHtml(task.createdAt || '—')}</b></div>
          <div class="task-detail-row"><span>آخر تحديث</span><b>${escapeHtml(task.updatedAt || '—')}</b></div>
        </div>

        ${task.details ? `<div class="task-details-text">${escapeHtml(task.details)}</div>` : ''}

        <h5 class="price-group-title">ما رفعه الفني</h5>
        <div class="task-proof-box">
          ${proof
            ? (isLink
              ? `<a href="${escapeHtml(proof)}" target="_blank" rel="noopener" class="task-proof-link">🔗 فتح الدليل</a><small>${escapeHtml(proof)}</small>`
              : `<div class="task-proof-text">${escapeHtml(proof)}</div>`)
            : '<p class="manager-empty-state">لم يُرفع دليل بعد.</p>'}
          ${task.employeeNote ? `<div class="task-note-label">ملاحظة الفني</div><div class="task-proof-text">${escapeHtml(task.employeeNote)}</div>` : ''}
        </div>

        ${task.reviewNote ? `<div class="task-review-note"><b>ملاحظة المراجعة السابقة</b><p>${escapeHtml(task.reviewNote)}</p></div>` : ''}

        ${['بانتظار المراجعة','قيد التنفيذ','جديدة'].indexOf(task.status) >= 0 ? `<div class="task-edit">
          <label>ملاحظة المراجعة<textarea id="taskReviewNote" rows="3" maxlength="1000" placeholder="ملاحظاتك للفني (اختياري)"></textarea></label>
        </div>
        <div class="task-actions-sticky">
          ${task.status === 'بانتظار المراجعة'
            ? '<button type="button" class="primary-btn" id="taskApprove">اعتماد المهمة</button><button type="button" class="secondary-btn" id="taskReturn">إعادة للفني</button>'
            : '<button type="button" class="secondary-btn" id="taskReturn">إعادة للفني</button>'}
          <button type="button" class="secondary-btn" id="taskEditOpen">تعديل المهمة</button>
          <button type="button" class="danger-btn" id="taskDelete">حذف المهمة</button>
        </div>` : `<div class="task-actions-sticky"><button type="button" class="secondary-btn" id="taskEditOpen">تعديل المهمة</button><button type="button" class="danger-btn" id="taskDelete">حذف المهمة</button></div>`}
      </div>`;

      content.querySelector('#taskReviewBack').addEventListener('click', () => renderTaskAdmin(content));
      content.querySelector('#taskEditOpen').addEventListener('click', () => openTaskEditForm(content, task));
      content.querySelector('#taskDelete').addEventListener('click', async () => {
        const ok = tg?.showConfirm
          ? await new Promise(res => tg.showConfirm('حذف المهمة نهائيًا؟ لا يمكن التراجع.', res))
          : window.confirm('حذف المهمة نهائيًا؟');
        if (!ok) return;
        try {
          const res = await api('task_delete', { taskId: task.id });
          if (tg?.showAlert) tg.showAlert(res.message || 'تم حذف المهمة.');
          renderTaskAdmin(content);
        } catch (e) {
          if (tg?.showAlert) tg.showAlert(e.message);
        }
      });

      const noteValue = () => {
        const box = content.querySelector('#taskReviewNote');
        return box ? box.value.trim() : '';
      };

      const approve = content.querySelector('#taskApprove');
      if (approve) approve.addEventListener('click', async () => {
        approve.disabled = true;
        try {
          await api('task_review', { taskId: task.id, decision: 'اعتماد', note: noteValue() });
          if (tg?.showAlert) tg.showAlert('تم اعتماد المهمة.');
          renderTaskAdmin(content);
        } catch (e) {
          if (tg?.showAlert) tg.showAlert(e.message);
          approve.disabled = false;
        }
      });

      const ret = content.querySelector('#taskReturn');
      if (ret) ret.addEventListener('click', async () => {
        ret.disabled = true;
        try {
          if (task.status === 'بانتظار المراجعة') {
            await api('task_review', { taskId: task.id, decision: 'إعادة', note: noteValue() });
          } else {
            await api('task_edit', { taskId: task.id, status: 'قيد التنفيذ' });
          }
          if (tg?.showAlert) tg.showAlert('أُعيدت المهمة للفني.');
          renderTaskAdmin(content);
        } catch (e) {
          if (tg?.showAlert) tg.showAlert(e.message);
          ret.disabled = false;
        }
      });
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  /* ---------- Manager: edit any task, including reassignment ---------- */
  async function openTaskEditForm(content, task) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل بيانات التعديل...</div>';
    try {
      const assignees = (await api('task_assignees')).employees || [];
      content.innerHTML = `<div class="tasks-screen">
        <div class="price-screen-head">
          <button type="button" class="price-back" id="taskEditBack">← رجوع</button>
          <div><h4>تعديل المهمة</h4><small>${escapeHtml(task.id)}</small></div>
        </div>

        <label>عنوان المهمة<input id="editTaskTitle" maxlength="120" value="${escapeHtml(task.title)}"></label>
        <label>التفاصيل<textarea id="editTaskDetails" rows="4" maxlength="1500">${escapeHtml(task.details || '')}</textarea></label>
        <label>النوع<select id="editTaskType">
          ${['دعاية','صيانة','تدريب','جودة','أخرى'].map(x => `<option${x === task.type ? ' selected' : ''}>${x}</option>`).join('')}
        </select></label>
        <label>الأولوية<select id="editTaskPriority">
          ${['عادية','مهمة','عاجلة'].map(x => `<option${x === task.priority ? ' selected' : ''}>${x}</option>`).join('')}
        </select></label>
        <label>تاريخ الاستحقاق<input id="editTaskDue" type="date" value="${escapeHtml(task.dueDate || '')}"></label>
        <label>الفني المسؤول<select id="editTaskEmployee">
          ${assignees.map(e => `<option value="${escapeHtml(e.id)}"${e.id === task.employeeId ? ' selected' : ''}>${escapeHtml(e.name)}</option>`).join('')}
        </select></label>
        <label>الحالة<select id="editTaskStatus">
          ${['جديدة','قيد التنفيذ','بانتظار المراجعة','مكتملة','ملغاة'].map(x => `<option${x === task.status ? ' selected' : ''}>${x}</option>`).join('')}
        </select></label>

        <div class="task-actions-sticky">
          <button type="button" class="primary-btn" id="editTaskSave">حفظ التعديلات</button>
        </div>
        <p class="manager-note">تغيير الفني ينقل المهمة كاملة (بلا دليل أو ملاحظات) ويُرسل إشعارًا للفني القديم والجديد.</p>
      </div>`;

      content.querySelector('#taskEditBack').addEventListener('click', () => openTaskReview(content, task.id));

      content.querySelector('#editTaskSave').addEventListener('click', async ev => {
        const btn = ev.currentTarget;
        btn.disabled = true;
        try {
          const res = await api('task_edit', {
            taskId: task.id,
            title: content.querySelector('#editTaskTitle').value.trim(),
            details: content.querySelector('#editTaskDetails').value.trim(),
            type: content.querySelector('#editTaskType').value,
            priority: content.querySelector('#editTaskPriority').value,
            dueDate: content.querySelector('#editTaskDue').value,
            employeeId: content.querySelector('#editTaskEmployee').value,
            status: content.querySelector('#editTaskStatus').value
          });
          if (tg?.showAlert) tg.showAlert(res.message || 'تم تحديث المهمة.');
          renderTaskAdmin(content);
        } catch (e) {
          if (tg?.showAlert) tg.showAlert(e.message);
          btn.disabled = false;
        }
      });
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }


  async function reviewTask(content, taskId, decision) {
    try {
      const res = await api('task_review', { taskId, decision });
      if (tg?.showAlert) tg.showAlert(decision === 'اعتماد' ? 'تم اعتماد المهمة.' : 'أُعيدت المهمة للفني.');
      renderTaskAdmin(content);
    } catch (e) {
      if (tg?.showAlert) tg.showAlert(e.message);
    }
  }

  /* ============================================================
   * CREATE TASK — rebuilt picker
   * The old markup nested <label> inside <label>, so a click was
   * swallowed by the outer label and the checkbox never toggled.
   * This version uses plain rows, an explicit hit area, a search
   * box, and visible selected chips.
   * ============================================================ */

  let taskPickerState = { selected: [], query: '', employees: [] };

  async function renderTaskCreateForm(content) {
    taskPickerState = { selected: [], query: '', employees: [] };
    content.innerHTML = '<div class="manager-loading">جاري تحميل الفنيين...</div>';
    try {
      const employees = (await api('active_employees')) || [];
      taskPickerState.employees = employees;
      drawTaskCreateForm(content);
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  function drawTaskCreateForm(content) {
    const employees = taskPickerState.employees;

    content.innerHTML = `<div class="tasks-screen">
      <div class="price-screen-head">
        <button type="button" class="price-back" id="taskCreateBack">← المهام</button>
        <div><h4>مهمة جديدة</h4><small>يصل إشعار لكل فني معيّن</small></div>
      </div>

      <label>عنوان المهمة<input id="taskTitleInput" maxlength="120" placeholder="مثال: ٥ ستوريات دعائية"></label>
      <label>التفاصيل<textarea id="taskDetailsInput" rows="3" maxlength="1500" placeholder="اشرح المطلوب بدقة..."></textarea></label>

      <div class="task-form-row">
        <label>النوع<select id="taskTypeInput"><option>دعاية</option><option>صيانة</option><option>تدريب</option><option>جودة</option><option>أخرى</option></select></label>
        <label>الأولوية<select id="taskPriorityInput"><option>عادية</option><option>مهمة</option><option>عاجلة</option></select></label>
      </div>

      <label>تاريخ الاستحقاق<input id="taskDueInput" type="date"></label>

      <section class="task-assign">
        <div class="task-assign-head">
          <b>الفنيون المسؤولون</b>
          <span id="taskAssignCount">لم يتم اختيار أحد</span>
        </div>

        <div id="taskSelectedChips" class="task-chips"></div>

        <div class="task-assign-tools">
          <input id="taskEmpSearch" type="search" placeholder="ابحث بالاسم…" autocomplete="off">
          <button type="button" class="task-mini-btn" id="taskPickAll">اختيار الكل</button>
          <button type="button" class="task-mini-btn" id="taskPickNone">مسح</button>
        </div>

        <div id="taskEmpList" class="task-emp-list"></div>
      </section>

      <div class="task-actions-sticky">
        <button type="button" class="primary-btn" id="taskCreateSubmit">إنشاء المهمة</button>
      </div>
      <p id="taskCreateMsg" class="inline-message hidden" aria-live="polite"></p>
    </div>`;

    content.querySelector('#taskDueInput').value = new Date().toISOString().slice(0, 10);
    content.querySelector('#taskCreateBack').addEventListener('click', () => renderTaskAdmin(content));

    drawTaskEmpList(content);
    drawTaskChips(content);

    content.querySelector('#taskEmpSearch').addEventListener('input', ev => {
      taskPickerState.query = ev.target.value;
      drawTaskEmpList(content);
    });
    content.querySelector('#taskPickAll').addEventListener('click', () => {
      const visible = filteredTaskEmployees();
      const set = new Set(taskPickerState.selected);
      visible.forEach(e => set.add(String(e['Chat ID'])));
      taskPickerState.selected = [...set];
      drawTaskEmpList(content);
      drawTaskChips(content);
    });
    content.querySelector('#taskPickNone').addEventListener('click', () => {
      taskPickerState.selected = [];
      drawTaskEmpList(content);
      drawTaskChips(content);
    });

    content.querySelector('#taskCreateSubmit').addEventListener('click', () => submitTaskCreate(content));
  }

  function filteredTaskEmployees() {
    const q = String(taskPickerState.query || '').trim().toLowerCase();
    const list = taskPickerState.employees || [];
    if (!q) return list;
    return list.filter(function(e) {
      return String(e['اسم الموظف'] || '').toLowerCase().indexOf(q) >= 0 ||
        String(e['Chat ID'] || '').indexOf(q) >= 0;
    });
  }

  function drawTaskEmpList(content) {
    const holder = content.querySelector('#taskEmpList');
    if (!holder) return;
    const list = filteredTaskEmployees();
    if (!list.length) {
      holder.innerHTML = '<p class="console-empty">لا يوجد فني مطابق.</p>';
      return;
    }
    const selected = new Set(taskPickerState.selected);
    holder.innerHTML = list.map(function(e) {
      const id = String(e['Chat ID'] || '');
      const on = selected.has(id);
      return `<button type="button" class="task-emp-row${on ? ' is-on' : ''}" data-emp-id="${escapeHtml(id)}">
        <span class="task-emp-check">${on ? '✓' : ''}</span>
        <span class="task-emp-name">${escapeHtml(String(e['اسم الموظف'] || 'فني'))}</span>
      </button>`;
    }).join('');

    // A real button per row: no nested labels, so the tap always lands.
    holder.querySelectorAll('[data-emp-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const id = btn.dataset.empId;
        const set = new Set(taskPickerState.selected);
        if (set.has(id)) set.delete(id); else set.add(id);
        taskPickerState.selected = [...set];
        drawTaskEmpList(content);
        drawTaskChips(content);
      });
    });
  }

  function drawTaskChips(content) {
    const chips = content.querySelector('#taskSelectedChips');
    const counter = content.querySelector('#taskAssignCount');
    const byId = {};
    (taskPickerState.employees || []).forEach(function(e) { byId[String(e['Chat ID'])] = String(e['اسم الموظف'] || 'فني'); });

    const selected = taskPickerState.selected || [];
    if (!selected.length) {
      chips.innerHTML = '<span class="task-chips-empty">لم يتم اختيار فني بعد</span>';
      counter.textContent = 'لم يتم اختيار أحد';
      return;
    }
    counter.textContent = selected.length + ' فني مختار';
    chips.innerHTML = selected.map(function(id) {
      return `<span class="task-chip">${escapeHtml(byId[id] || id)}<button type="button" data-chip-remove="${escapeHtml(id)}" aria-label="إزالة">×</button></span>`;
    }).join('');
    chips.querySelectorAll('[data-chip-remove]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        taskPickerState.selected = taskPickerState.selected.filter(function(x) { return x !== btn.dataset.chipRemove; });
        drawTaskEmpList(content);
        drawTaskChips(content);
      });
    });
  }

  async function submitTaskCreate(content) {
    const btn = content.querySelector('#taskCreateSubmit');
    const msg = content.querySelector('#taskCreateMsg');
    const fail = function(text) {
      msg.textContent = text;
      msg.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'إنشاء المهمة';
      msg.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    const title = content.querySelector('#taskTitleInput').value.trim();
    const details = content.querySelector('#taskDetailsInput').value.trim();
    const dueDate = content.querySelector('#taskDueInput').value;
    const ids = taskPickerState.selected.slice();

    if (title.length < 3) return fail('اكتب عنوان المهمة (٣ أحرف على الأقل).');
    if (!ids.length) return fail('اختر فنيًا واحدًا على الأقل.');
    if (!dueDate) return fail('حدد تاريخ الاستحقاق.');

    btn.disabled = true;
    btn.textContent = 'جارٍ الإنشاء...';
    msg.classList.add('hidden');

    try {
      const res = await api('task_create', {
        title: title,
        details: details,
        type: content.querySelector('#taskTypeInput').value,
        priority: content.querySelector('#taskPriorityInput').value,
        dueDate: dueDate,
        employeeIds: ids
      });
      if (tg?.showAlert) tg.showAlert('تم إنشاء ' + res.created + ' مهمة · إشعارات: ' + res.notified + '/' + res.total);
      renderTaskAdmin(content);
    } catch (e) {
      fail(e.message || 'تعذر إنشاء المهمة.');
    }
  }


  /* ============================================================
   * SPARE PART REQUESTS — «طلب قطعة غيار»
   * The technician states the part, the purpose (repair or test),
   * and why. The part is bound to that technician once approved.
   * ============================================================ */

  const PART_STATUS_CLASS = {
    'بانتظار الموافقة': 'is-review',
    'معتمد': 'is-progress',
    'مرفوض': 'is-cancelled',
    'تم الصرف': 'is-done'
  };

  function partStatusBadge(status) {
    return `<span class="task-status ${PART_STATUS_CLASS[status] || 'is-new'}">${escapeHtml(status)}</span>`;
  }

  async function openPartRequestPanel() {
    const panel = managerPanel('طلب قطعة غيار', '<div class="manager-loading">جاري تحميل طلباتك...</div>');
    const content = panel.querySelector('.manager-module-content');
    await renderPartRequestHome(content);
  }

  async function renderPartRequestHome(content) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل طلباتك...</div>';
    try {
      const data = await api('part_requests_mine');
      const requests = data.requests || [];
      const pending = requests.filter(r => r.status === 'بانتظار الموافقة').length;

      content.innerHTML = `<div class="tasks-screen">
        <div class="part-intro">
          <b>اطلب القطعة قبل استخدامها</b>
          <p>القطعة تُصرف باسمك، ويجب أن تكون مطابقة لما طلبته بالضبط. لا تستخدم قطعة لم تُعتمد.</p>
        </div>

        <div class="tasks-summary">
          <div class="tasks-summary-item${pending ? ' is-urgent' : ''}"><b>${pending}</b><small>بانتظار الموافقة</small></div>
          <div class="tasks-summary-item"><b>${requests.filter(r => r.status === 'معتمد').length}</b><small>معتمدة</small></div>
          <div class="tasks-summary-item"><b>${requests.filter(r => r.status === 'تم الصرف').length}</b><small>تم صرفها</small></div>
        </div>

        <button type="button" class="primary-btn" id="partNewBtn">+ طلب قطعة جديدة</button>

        <h5 class="price-group-title">طلباتي</h5>
        <div class="tasks-list">
          ${requests.length ? requests.map(r => `<article class="task-row">
            <span class="task-row-main">
              <b>${escapeHtml(r.partName)} <span class="part-qty">×${r.quantity}</span></b>
              <small>${escapeHtml(r.purpose)}${r.deviceRef ? ' · ' + escapeHtml(r.deviceRef) : ''}</small>
              <small class="part-id">${escapeHtml(r.id)} · ${escapeHtml(String(r.createdAt).slice(0, 10))}</small>
            </span>
            ${partStatusBadge(r.status)}
          </article>`).join('') : '<p class="manager-empty-state"><b>لا توجد طلبات</b><p>اطلب أول قطعة غيار من الزر أعلاه.</p></p>'}
        </div>
      </div>`;

      content.querySelector('#partNewBtn').addEventListener('click', () => renderPartRequestForm(content));
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  async function renderPartRequestForm(content) {
    content.innerHTML = `<div class="tasks-screen">
      <div class="price-screen-head">
        <button type="button" class="price-back" id="partFormBack">← رجوع</button>
        <div><h4>طلب قطعة غيار</h4><small>يُرسل للإدارة للموافقة</small></div>
      </div>

      <label>القطعة المطلوبة<input id="partName" maxlength="120" placeholder="مثال: شاشة iPhone 13"></label>
      <label>الغرض من الاستخدام<select id="partPurpose">
        <option>إصلاح جهاز عميل</option>
        <option>تجربة وفحص</option>
      </select></label>
      <label>رقم الطلب / الجهاز (اختياري)<input id="partDevice" maxlength="60" placeholder="مثال: ORD-1234"></label>
      <label>الكمية<input id="partQty" type="number" min="1" max="20" step="1" value="1" inputmode="numeric"></label>
      <label>سبب الاستخدام<textarea id="partReason" rows="3" maxlength="500" placeholder="اشرح لماذا تحتاج هذه القطعة تحديدًا..."></textarea></label>

      <div class="task-actions-sticky">
        <button type="button" class="primary-btn" id="partSubmit">إرسال الطلب للموافقة</button>
      </div>
      <p class="manager-note">لا تُصرف أي قطعة قبل الاعتماد. القطعة المعتمدة تُسجّل باسمك.</p>
    </div>`;

    content.querySelector('#partFormBack').addEventListener('click', () => renderPartRequestHome(content));

    content.querySelector('#partSubmit').addEventListener('click', async ev => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = 'جارٍ الإرسال...';
      try {
        const res = await api('part_request_create', {
          partName: content.querySelector('#partName').value.trim(),
          purpose: content.querySelector('#partPurpose').value,
          deviceRef: content.querySelector('#partDevice').value.trim(),
          quantity: Number(content.querySelector('#partQty').value),
          reason: content.querySelector('#partReason').value.trim()
        });
        if (tg?.showAlert) tg.showAlert(`تم إرسال الطلب ${res.requestId}\n${res.message}`);
        renderPartRequestHome(content);
      } catch (e) {
        if (tg?.showAlert) tg.showAlert(e.message);
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  /* ---------- Manager: review part requests ---------- */

  async function openPartAdminPanel() {
    const panel = managerPanel('طلبات قطع الغيار', '<div class="manager-loading">جاري تحميل الطلبات...</div>');
    const content = panel.querySelector('.manager-module-content');
    await renderPartAdmin(content);
  }

  async function renderPartAdmin(content) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل الطلبات...</div>';
    try {
      const data = await api('part_requests_all');
      const requests = data.requests || [];
      const summary = data.summary || {};

      content.innerHTML = `<div class="tasks-screen">
        <div class="tasks-summary">
          <div class="tasks-summary-item${summary.pending ? ' is-urgent' : ''}"><b>${summary.pending || 0}</b><small>بانتظار الموافقة</small></div>
          <div class="tasks-summary-item"><b>${summary.approved || 0}</b><small>معتمدة</small></div>
          <div class="tasks-summary-item"><b>${summary.rejected || 0}</b><small>مرفوضة</small></div>
        </div>

        <div class="tasks-list">
          ${requests.length ? requests.map(r => `<article class="task-row part-admin-row">
            <span class="task-row-main">
              <b>${escapeHtml(r.partName)} <span class="part-qty">×${r.quantity}</span></b>
              <small>${escapeHtml(r.employeeName)} · ${escapeHtml(r.purpose)}${r.deviceRef ? ' · ' + escapeHtml(r.deviceRef) : ''}</small>
              <small class="part-reason">${escapeHtml(r.reason)}</small>
              <small class="part-id">${escapeHtml(r.id)}</small>
            </span>
            <span class="task-row-actions">
              ${partStatusBadge(r.status)}
              ${r.status === 'بانتظار الموافقة'
                ? `<button type="button" class="task-mini-btn is-approve" data-part-approve="${escapeHtml(r.id)}">اعتماد</button>
                   <button type="button" class="task-mini-btn" data-part-reject="${escapeHtml(r.id)}">رفض</button>`
                : r.status === 'معتمد'
                  ? `<button type="button" class="task-mini-btn is-approve" data-part-issue="${escapeHtml(r.id)}">تم الصرف</button>`
                  : ''}
            </span>
          </article>`).join('') : '<p class="manager-empty-state">لا توجد طلبات قطع غيار.</p>'}
        </div>
      </div>`;

      const decide = async (id, decision) => {
        try {
          await api('part_request_decide', { requestId: id, decision });
          if (tg?.showAlert) tg.showAlert('تم تحديث الطلب.');
          renderPartAdmin(content);
        } catch (e) {
          if (tg?.showAlert) tg.showAlert(e.message);
        }
      };
      content.querySelectorAll('[data-part-approve]').forEach(b =>
        b.addEventListener('click', () => decide(b.dataset.partApprove, 'معتمد')));
      content.querySelectorAll('[data-part-reject]').forEach(b =>
        b.addEventListener('click', () => decide(b.dataset.partReject, 'مرفوض')));
      content.querySelectorAll('[data-part-issue]').forEach(b =>
        b.addEventListener('click', () => decide(b.dataset.partIssue, 'تم الصرف')));
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }


  /* ============================================================
   * NOTIFICATION CONTROL (Super Admin)
   * One row per technician, two switches per event:
   *   داخل التطبيق  |  على البوت
   * ============================================================ */

  let notifyMatrixCache = null;

  async function openNotificationMatrix() {
    const panel = managerPanel('التحكم في الإشعارات', '<div class="manager-loading">جاري تحميل قواعد الإشعارات...</div>');
    const content = panel.querySelector('.manager-module-content');
    await renderNotificationMatrix(content);
  }

  async function renderNotificationMatrix(content, selectedId) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل قواعد الإشعارات...</div>';
    try {
      const data = await api('notify_matrix_get');
      notifyMatrixCache = data;
      const employees = data.employees || [];
      const events = data.events || [];

      // Group events by area so the matrix reads like the workflow.
      const groups = {};
      events.forEach(ev => {
        if (!groups[ev.group]) groups[ev.group] = [];
        groups[ev.group].push(ev);
      });

      const current = employees.find(e => e.employeeId === selectedId) || employees[0];

      content.innerHTML = `<div class="notify-matrix">
        <div class="notify-intro">
          <b>تحكم كامل لكل فني على حدة</b>
          <p>أوقف أي إشعار عن أي فني، في التطبيق أو على البوت. الإيقاف يمنع الوصول فعليًا — لا يخفي الشكل فقط.</p>
        </div>

        <label class="notify-picker">الفني
          <select id="notifyPickEmployee">
            ${employees.map(e => `<option value="${escapeHtml(e.employeeId)}"${current && e.employeeId === current.employeeId ? ' selected' : ''}>${escapeHtml(e.name)}${e.job ? ' — ' + escapeHtml(e.job) : ''}</option>`).join('')}
          </select>
        </label>

        ${current ? `
          <div class="notify-bulk">
            <button type="button" class="secondary-btn" id="notifyAllOn">تفعيل الكل</button>
            <button type="button" class="danger-btn" id="notifyAllOff">إيقاف الكل</button>
          </div>

          ${Object.keys(groups).map(group => `<div class="notify-group">
            <h5 class="price-group-title">${escapeHtml(group)}</h5>
            <div class="notify-head">
              <span>الإشعار</span><span>التطبيق</span><span>البوت</span>
            </div>
            ${groups[group].map(ev => {
              const s = current.settings[ev.key] || { inApp: true, bot: true };
              return `<div class="notify-row">
                <span class="notify-label">${escapeHtml(ev.label)}</span>
                <label class="notify-switch">
                  <input type="checkbox" data-notify-toggle data-emp="${escapeHtml(current.employeeId)}" data-event="${escapeHtml(ev.key)}" data-channel="inApp"${s.inApp ? ' checked' : ''}>
                  <i></i>
                </label>
                <label class="notify-switch">
                  <input type="checkbox" data-notify-toggle data-emp="${escapeHtml(current.employeeId)}" data-event="${escapeHtml(ev.key)}" data-channel="bot"${s.bot ? ' checked' : ''}>
                  <i></i>
                </label>
              </div>`;
            }).join('')}
          </div>`).join('')}
        ` : '<p class="manager-empty-state">لا يوجد فنيون نشطون.</p>'}
      </div>`;

      content.querySelector('#notifyPickEmployee')?.addEventListener('change', ev => {
        renderNotificationMatrix(content, ev.target.value);
      });

      content.querySelector('#notifyAllOn')?.addEventListener('click', () => bulkNotify(content, current.employeeId, true));
      content.querySelector('#notifyAllOff')?.addEventListener('click', () => bulkNotify(content, current.employeeId, false));

      content.querySelectorAll('[data-notify-toggle]').forEach(box => {
        box.addEventListener('change', async () => {
          const target = box.dataset;
          box.disabled = true;
          try {
            await api('notify_matrix_set', {
              employeeId: target.emp,
              event: target.event,
              channel: target.channel,
              enabled: box.checked
            });
            const label = box.closest('.notify-row');
            if (label) label.classList.toggle('is-muted', !box.checked);
          } catch (e) {
            box.checked = !box.checked;
            if (tg?.showAlert) tg.showAlert(e.message);
          } finally { box.disabled = false; }
        });
      });

      // Reflect initial muted state visually.
      content.querySelectorAll('[data-notify-toggle]').forEach(box => {
        if (!box.checked) {
          const row = box.closest('.notify-row');
          if (row) row.classList.add('is-muted');
        }
      });
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  async function bulkNotify(content, employeeId, enabled) {
    try {
      const res = await api('notify_matrix_bulk', { employeeId, enabled });
      if (tg?.showAlert) tg.showAlert(enabled ? 'تم تفعيل كل الإشعارات لهذا الفني.' : 'تم إيقاف كل الإشعارات لهذا الفني.');
      renderNotificationMatrix(content, employeeId);
    } catch (e) {
      if (tg?.showAlert) tg.showAlert(e.message);
    }
  }


  /* ============================================================
   * DEVICE INTAKE — guided 4-step flow
   *   1) ابحث بالهاتف  → إن لم يوجد، سجّل الاسم
   *   2) عائلة الجهاز   → iPhone / iPad / MacBook / Watch / AirPods
   *   3) الموديل        → من نفس فئات أسعار الإصلاح
   *   4) الفحص          → قائمة الفحص حسب الموديل المختار
   * ============================================================ */

  let intake = null;

  function intakeReset() {
    intake = {
      step: 1,
      customer: null,          // {id, name, phone, address, visits}
      family: '',
      familyLabel: '',
      model: '',
      accessories: [],
      powersOn: '',
      checklist: [],
      parts: [],
      technicians: []
    };
  }

  async function openDeviceIntake() {
    intakeReset();
    const panel = managerPanel('بطاقة صيانة جديدة', '<div class="manager-loading">جاري تحميل النموذج...</div>');
    const content = panel.querySelector('.manager-module-content');
    try {
      const opts = await api('device_intake_options');
      if (!opts.allowed) {
        content.innerHTML = `<div class="manager-load-error">${escapeHtml(opts.message || 'غير مسموح')}</div>`;
        return;
      }
      intake.technicians = opts.technicians || [];
      renderIntakeStep(content);
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  /* ============================================================
   * INTAKE INSPECTION — the real checklist experience
   * One test at a time with its instruction and a note box,
   * exactly like «فحص الجهاز», but running inside the intake card
   * so the answers travel with the new job card.
   * ============================================================ */
  function openIntakeInspection(content) {
    if (!intake.checklist.length) {
      if (tg?.showAlert) tg.showAlert('لا توجد قائمة فحص لهذا الموديل.');
      return;
    }
    intake.inspectIndex = intake.checklist.findIndex(c => !c.result);
    if (intake.inspectIndex < 0) intake.inspectIndex = 0;
    drawIntakeInspection(content);
  }

  function drawIntakeInspection(content) {
    const list = intake.checklist;
    const total = list.length;
    const step = Math.min(Math.max(intake.inspectIndex, 0), total - 1);
    const item = list[step];
    const answered = list.filter(c => c.result).length;
    const percent = total ? Math.round((answered / total) * 100) : 0;
    const issues = list.filter(c => c.result === 'مشكلة').length;

    content.innerHTML = `<div class="inspection-wizard">
      <div class="inspection-wizard-head">
        <span class="inspection-wizard-kicker">فحص عند الاستلام · ${escapeHtml(intake.model)}</span>
        <h4>${escapeHtml(item.name)}</h4>
        <small>تم تقييم ${answered} من ${total}${issues ? ' · مشاكل: ' + issues : ''}</small>
      </div>
      <div class="inspection-progress"><span style="width:${percent}%"></span></div>

      <div class="inspection-step">
        <div class="inspection-step-index">اختبار ${step + 1} من ${total}</div>
        <b>${escapeHtml(item.name)}</b>
        ${item.instruction ? `<p class="inspection-step-instruction">${escapeHtml(item.instruction)}</p>` : ''}
        <div class="inspection-result-group">
          ${[['سليم','ok'],['مشكلة','bad'],['لم يختبر','skip']].map(([value, kind]) =>
            `<button type="button" class="inspection-result-btn is-${kind}${item.result === value ? ' is-selected' : ''}" data-result="${value}">${value}</button>`).join('')}
        </div>
        <label>ملاحظات
          <textarea id="intakeInspectNote" rows="2" maxlength="500" placeholder="ملاحظة اختيارية على هذا الاختبار">${escapeHtml(item.note || '')}</textarea>
        </label>
      </div>

      <div class="inspection-nav">
        <button type="button" class="secondary-btn" id="intakeInspectPrev"${step === 0 ? ' disabled' : ''}>السابق</button>
        <button type="button" class="secondary-btn" id="intakeInspectNext"${step === total - 1 ? ' disabled' : ''}>التالي</button>
      </div>
      <button type="button" class="primary-btn" id="intakeInspectDone">إنهاء الفحص والرجوع للبطاقة</button>
    </div>`;

    content.querySelectorAll('[data-result]').forEach(btn => {
      btn.addEventListener('click', () => {
        item.result = btn.dataset.result;
        item.note = content.querySelector('#intakeInspectNote').value;
        // Jump to the next untested item, like the standalone inspection.
        const next = list.findIndex((c, i) => i > step && !c.result);
        intake.inspectIndex = next >= 0 ? next : Math.min(step + 1, total - 1);
        drawIntakeInspection(content);
      });
    });

    content.querySelector('#intakeInspectNote').addEventListener('input', ev => {
      item.note = ev.target.value;
    });
    content.querySelector('#intakeInspectPrev').addEventListener('click', () => {
      item.note = content.querySelector('#intakeInspectNote').value;
      if (step > 0) { intake.inspectIndex = step - 1; drawIntakeInspection(content); }
    });
    content.querySelector('#intakeInspectNext').addEventListener('click', () => {
      item.note = content.querySelector('#intakeInspectNote').value;
      if (step < total - 1) { intake.inspectIndex = step + 1; drawIntakeInspection(content); }
    });
    content.querySelector('#intakeInspectDone').addEventListener('click', () => {
      item.note = content.querySelector('#intakeInspectNote').value;
      intake.step = 4;
      renderIntakeStep(content);
    });
  }

  function intakeStepsBar(step) {
    const labels = ['العميل', 'نوع الجهاز', 'الموديل', 'الفحص والبيانات'];
    return `<div class="intake-steps">
      ${labels.map((label, i) => `<div class="intake-step${i + 1 === step ? ' is-current' : ''}${i + 1 < step ? ' is-done' : ''}">
        <span>${i + 1 < step ? '✓' : i + 1}</span><small>${label}</small>
      </div>`).join('')}
    </div>`;
  }

  function renderIntakeStep(content) {
    if (intake.step === 1) return renderIntakeCustomer(content);
    if (intake.step === 2) return renderIntakeFamily(content);
    if (intake.step === 3) return renderIntakeModel(content);
    return renderIntakeDetails(content);
  }

  /* ---------- Step 1: customer lookup ---------- */
  function renderIntakeCustomer(content) {
    content.innerHTML = `<div class="intake-form">
      ${intakeStepsBar(1)}

      <section class="intake-card">
        <header class="intake-card-head"><span>🔍</span><h4>ابحث عن العميل برقم الهاتف</h4></header>
        <label>رقم الهاتف
          <input id="intakePhone" type="tel" inputmode="numeric" maxlength="15" placeholder="01xxxxxxxxx" autocomplete="off">
        </label>
        <div id="intakeSearchResult" class="intake-result"></div>
      </section>

      <section class="intake-card hidden" id="intakeNewCustomer">
        <header class="intake-card-head"><span>👤</span><h4>عميل جديد</h4></header>
        <label>اسم العميل *
          <input id="intakeCustomerName" maxlength="80" placeholder="الاسم الكامل">
        </label>
        <label>العنوان (اختياري)
          <input id="intakeCustomerAddress" maxlength="120" placeholder="المنطقة / الشارع">
        </label>
        <button type="button" class="primary-btn" id="intakeSaveCustomer">حفظ العميل والمتابعة</button>
      </section>

      <div class="intake-actions single">
        <button type="button" class="secondary-btn" id="intakeCancel1">إلغاء</button>
      </div>
    </div>`;

    const phone = content.querySelector('#intakePhone');
    const result = content.querySelector('#intakeSearchResult');
    const newCard = content.querySelector('#intakeNewCustomer');
    let timer = null;

    phone.focus();
    phone.addEventListener('input', () => {
      phone.value = phone.value.replace(/[^\d]/g, '');
      clearTimeout(timer);
      const value = phone.value;
      if (value.length < 7) {
        result.innerHTML = '';
        newCard.classList.add('hidden');
        return;
      }
      result.innerHTML = '<p class="intake-searching">جارٍ البحث...</p>';
      timer = setTimeout(async () => {
        try {
          const res = await api('customers_search', { query: value });
          const hits = res.customers || [];
          if (hits.length) {
            newCard.classList.add('hidden');
            result.innerHTML = hits.map(c => `<button type="button" class="intake-customer-hit" data-customer='${escapeHtml(JSON.stringify(c))}'>
              <span><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.phone)} · ${c.visits} زيارة</small></span>
              <span class="intake-hit-arrow">←</span>
            </button>`).join('');
            result.querySelectorAll('[data-customer]').forEach(btn => {
              btn.addEventListener('click', () => {
                intake.customer = JSON.parse(btn.dataset.customer);
                intake.step = 2;
                renderIntakeStep(content);
              });
            });
          } else {
            result.innerHTML = '<p class="intake-empty">لا يوجد عميل بهذا الرقم.</p>';
            newCard.classList.remove('hidden');
            content.querySelector('#intakeCustomerName').focus();
          }
        } catch (e) {
          result.innerHTML = `<p class="manager-load-error">${escapeHtml(e.message)}</p>`;
        }
      }, 400);
    });

    content.querySelector('#intakeSaveCustomer').addEventListener('click', () => {
      const name = content.querySelector('#intakeCustomerName').value.trim();
      const address = content.querySelector('#intakeCustomerAddress').value.trim();
      if (name.length < 2) {
        if (tg?.showAlert) tg.showAlert('اكتب اسم العميل.');
        return;
      }
      intake.customer = {
        id: '',
        name: name,
        phone: phone.value,
        address: address,
        visits: 0,
        isNew: true
      };
      intake.step = 2;
      renderIntakeStep(content);
    });

    content.querySelector('#intakeCancel1').addEventListener('click', closeModal);
  }

  /* ---------- Step 2: device family ---------- */
  async function renderIntakeFamily(content) {
    content.innerHTML = `<div class="intake-form">
      ${intakeStepsBar(2)}
      <section class="intake-card">
        <header class="intake-card-head"><span>📱</span><h4>اختر نوع الجهاز</h4></header>
        <p class="intake-note">العميل: <b>${escapeHtml(intake.customer.name)}</b> · ${escapeHtml(intake.customer.phone)}</p>
        <div class="intake-family-grid" id="intakeFamilies">
          <div class="manager-loading">جاري تحميل الأنواع...</div>
        </div>
      </section>
      <div class="intake-actions single">
        <button type="button" class="secondary-btn" id="intakeBack1">← رجوع</button>
      </div>
    </div>`;

    content.querySelector('#intakeBack1').addEventListener('click', () => { intake.step = 1; renderIntakeStep(content); });

    try {
      const data = await api('device_families');
      const families = data.families || [];
      content.querySelector('#intakeFamilies').innerHTML = families.map(f => `
        <button type="button" class="intake-family-card" data-family="${escapeHtml(f.key)}" data-label="${escapeHtml(f.label)}">
          <span class="intake-family-icon">${f.icon}</span>
          <b>${escapeHtml(f.label)}</b>
        </button>`).join('');
      content.querySelectorAll('[data-family]').forEach(btn => {
        btn.addEventListener('click', () => {
          intake.family = btn.dataset.family;
          intake.familyLabel = btn.dataset.label;
          intake.step = 3;
          renderIntakeStep(content);
        });
      });
    } catch (e) {
      content.querySelector('#intakeFamilies').innerHTML = `<p class="manager-load-error">${escapeHtml(e.message)}</p>`;
    }
  }

  /* ---------- Step 3: model, grouped by generation like the price book ---------- */
  async function renderIntakeModel(content) {
    content.innerHTML = `<div class="intake-form">
      ${intakeStepsBar(3)}
      <section class="intake-card">
        <header class="intake-card-head"><span>🧩</span><h4>موديل ${escapeHtml(intake.familyLabel)}</h4></header>
        <label>ابحث في الموديلات
          <input id="intakeModelSearch" placeholder="مثال: 13 Pro، XR…" autocomplete="off">
        </label>
        <div id="intakeGenerationList"><div class="manager-loading">جاري تحميل الفئات...</div></div>
      </section>
      <div class="intake-actions single">
        <button type="button" class="secondary-btn" id="intakeBack2">← رجوع</button>
      </div>
    </div>`;

    content.querySelector('#intakeBack2').addEventListener('click', () => { intake.step = 2; renderIntakeStep(content); });

    try {
      const data = await api('device_family_models', { family: intake.family });
      const models = data.models || [];
      const list = content.querySelector('#intakeGenerationList');

      const choose = name => {
        intake.model = name;
        intake.step = 4;
        renderIntakeStep(content);
      };

      // Group by generation exactly like «أسعار الإصلاح», so the two sections
      // feel like one system.
      const groups = new Map();
      models.forEach(m => {
        const g = repairPriceGeneration(m.name);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(m.name);
      });
      const rank = key => key === '7 / 8' ? 7 : key === 'X / XS / XR' ? 10 : /^\d+$/.test(key) ? Number(key) : key === 'SE' ? 100 : 101;
      const keys = [...groups.keys()].sort((a, b) => rank(a) - rank(b));

      const drawGenerations = () => {
        if (!models.length) {
          list.innerHTML = `<p class="intake-empty">لا توجد موديلات مسعّرة لهذا النوع بعد.</p>
            <label>اسم الموديل يدويًا<input id="intakeManualModel" maxlength="60" placeholder="مثال: iPad Pro 11"></label>
            <button type="button" class="primary-btn" id="intakeManualGo">متابعة</button>`;
          list.querySelector('#intakeManualGo').addEventListener('click', () => {
            const value = list.querySelector('#intakeManualModel').value.trim();
            if (value.length < 2) { if (tg?.showAlert) tg.showAlert('اكتب اسم الموديل.'); return; }
            choose(value);
          });
          return;
        }
        list.innerHTML = `<div class="intake-gen-grid">
          ${keys.map((key, i) => `<button type="button" class="intake-gen-card" data-gen="${i}">
            <b dir="ltr">${escapeHtml(key === 'أخرى' ? key : intake.familyLabel + ' ' + key)}</b>
            <small>${groups.get(key).length} موديل</small>
          </button>`).join('')}
        </div>`;
        list.querySelectorAll('[data-gen]').forEach(btn => {
          btn.addEventListener('click', () => drawModels(keys[Number(btn.dataset.gen)]));
        });
      };

      const drawModels = group => {
        const names = groups.get(group) || [];
        list.innerHTML = `<button type="button" class="price-back" id="intakeGenBack">← الفئات</button>
          <div class="intake-model-list">
            ${names.map(n => `<button type="button" class="intake-model-row" data-model="${escapeHtml(n)}">
              <b>${escapeHtml(n)}</b><small>اختيار</small></button>`).join('')}
          </div>`;
        list.querySelector('#intakeGenBack').addEventListener('click', drawGenerations);
        list.querySelectorAll('[data-model]').forEach(btn => {
          btn.addEventListener('click', () => choose(btn.dataset.model));
        });
      };

      const drawSearch = needleText => {
        const needle = String(needleText || '').toLowerCase().trim();
        const shown = models.filter(m => m.name.toLowerCase().indexOf(needle) >= 0);
        list.innerHTML = shown.length
          ? `<div class="intake-model-list">${shown.map(m => `<button type="button" class="intake-model-row" data-model="${escapeHtml(m.name)}">
              <b>${escapeHtml(m.name)}</b><small>اختيار</small></button>`).join('')}</div>`
          : '<p class="intake-empty">لا يوجد موديل مطابق.</p>';
        list.querySelectorAll('[data-model]').forEach(btn => {
          btn.addEventListener('click', () => choose(btn.dataset.model));
        });
      };

      drawGenerations();
      content.querySelector('#intakeModelSearch').addEventListener('input', ev => {
        const value = ev.target.value.trim();
        if (value.length >= 1) drawSearch(value);
        else drawGenerations();
      });
    } catch (e) {
      content.querySelector('#intakeGenerationList').innerHTML = `<p class="manager-load-error">${escapeHtml(e.message)}</p>`;
    }
  }

  /* ---------- Step 4: inspection (only when the device powers on) ---------- */
  async function renderIntakeDetails(content) {
    content.innerHTML = `<div class="intake-form">
      ${intakeStepsBar(4)}
      <div class="manager-loading">جاري تحميل البيانات...</div>
    </div>`;

    try {
      const detail = await api('device_model_detail', { family: intake.family, model: intake.model });
      intake.checklist = detail.checklist || [];
      intake.parts = detail.parts || [];

      content.innerHTML = `<div class="intake-form">
        ${intakeStepsBar(4)}

        <section class="intake-card intake-summary">
          <div><small>العميل</small><b>${escapeHtml(intake.customer.name)}</b></div>
          <div><small>الجهاز</small><b>${escapeHtml(intake.model)}</b></div>
        </section>

        <section class="intake-card">
          <header class="intake-card-head"><span>🔌</span><h4>هل الجهاز يفتح ويعمل؟</h4></header>
          <div class="intake-toggle">
            <button type="button" class="intake-choice" data-power="يعمل"><span>✓</span> يعمل</button>
            <button type="button" class="intake-choice" data-power="لا يعمل"><span>✕</span> لا يعمل</button>
          </div>
          <p class="intake-note" id="intakePowerHint">اختر حالة الجهاز — تظهر قائمة الفحص فقط إذا كان يعمل.</p>
        </section>

        <section class="intake-card hidden" id="intakeInspectionCard">
          <header class="intake-card-head"><span>✅</span><h4>فحص الجهاز عند الاستلام</h4></header>
          <p class="intake-note" id="intakeInspectionSummary">الجهاز يعمل — ابدأ الفحص خطوة بخطوة بالشرح والملاحظات.</p>
          <button type="button" class="primary-btn" id="intakeStartInspection">بدء فحص الجهاز</button>
        </section>

        <section class="intake-card">
          <header class="intake-card-head"><span>🔐</span><h4>بيانات الجهاز</h4></header>
          <div class="intake-row">
            <label>رقم IMEI
              <input id="intakeImei" maxlength="40" inputmode="numeric" placeholder="15 رقم">
            </label>
            <label>الرقم السري / PIN
              <input id="intakePin" maxlength="40" placeholder="كلمة المرور">
            </label>
          </div>
        </section>

        <section class="intake-card">
          <header class="intake-card-head"><span>🔧</span><h4>وصف المشكلة</h4></header>
          <textarea id="intakeProblem" rows="3" maxlength="1000" placeholder="ما الشكوى التي أبلغ عنها العميل؟"></textarea>
          <div class="intake-chips">
            ${['شاشة مكسورة','لا يشحن','بطارية تفضي بسرعة','لا يعمل','كاميرا','سماعة','شبكة','مياه'].map(p =>
              `<button type="button" class="intake-chip" data-problem="${p}">${p}</button>`).join('')}
          </div>
        </section>

        <section class="intake-card">
          <header class="intake-card-head"><span>🎒</span><h4>الإكسسوارات المستلمة</h4></header>
          <div class="intake-chips">
            ${['شاحن','علبة','جراب','درج SIM','سماعة','كابل'].map(a =>
              `<button type="button" class="intake-chip" data-accessory="${a}">${a}</button>`).join('')}
          </div>
        </section>

        <section class="intake-card">
          <header class="intake-card-head"><span>💰</span><h4>التكلفة والتواريخ</h4></header>
          <div class="intake-row">
            <label>تكلفة تقديرية<input id="intakeEstimate" type="number" min="0" max="1000000" value="0" inputmode="numeric"></label>
            <label>عربون مدفوع<input id="intakeDeposit" type="number" min="0" max="1000000" value="0" inputmode="numeric"></label>
          </div>
          <div class="intake-row">
            <label>تاريخ الاستلام *<input id="intakeDate" type="date"></label>
            <label>موعد التسليم<input id="intakeDue" type="date"></label>
          </div>
          ${intake.parts.length ? `<div class="intake-parts-hint">
            <b>قطع مسعّرة لهذا الموديل</b>
            <div class="intake-part-chips">${intake.parts.slice(0, 10).map(p =>
              `<button type="button" class="intake-part-chip" data-part-price="${escapeHtml(p.price)}">${escapeHtml(p.issue)} · ${escapeHtml(p.price)}</button>`).join('')}</div>
          </div>` : ''}
        </section>

        <section class="intake-card">
          <header class="intake-card-head"><span>🛠️</span><h4>الفني المسؤول</h4></header>
          <select id="intakeTechnician">
            <option value="">— اختر المسؤول —</option>
            ${intake.technicians.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}${t.job ? ' — ' + escapeHtml(t.job) : ''}</option>`).join('')}
          </select>
        </section>

        <div class="intake-actions">
          <button type="button" class="primary-btn" id="intakeSubmit">+ إنشاء البطاقة</button>
          <button type="button" class="secondary-btn" id="intakeBack3">← رجوع</button>
        </div>
        <p id="intakeMessage" class="inline-message hidden" aria-live="polite"></p>
      </div>`;

      content.querySelector('#intakeDate').value = new Date().toISOString().slice(0, 10);
      content.querySelector('#intakeBack3').addEventListener('click', () => { intake.step = 3; renderIntakeStep(content); });

      wireIntakeDetails(content);
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  function wireIntakeDetails(content) {
    content.querySelectorAll('[data-problem]').forEach(chip => {
      chip.addEventListener('click', () => {
        const box = content.querySelector('#intakeProblem');
        const text = chip.dataset.problem;
        box.value = box.value.trim() ? box.value.trim() + ' · ' + text : text;
        chip.classList.toggle('is-on');
      });
    });

    content.querySelectorAll('[data-accessory]').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('is-on');
        const set = new Set(intake.accessories);
        if (chip.classList.contains('is-on')) set.add(chip.dataset.accessory);
        else set.delete(chip.dataset.accessory);
        intake.accessories = [...set];
      });
    });

    // Inspection stays hidden until the technician confirms the device powers on.
    content.querySelectorAll('[data-power]').forEach(btn => {
      btn.addEventListener('click', () => {
        intake.powersOn = btn.dataset.power;
        content.querySelectorAll('[data-power]').forEach(b => b.classList.toggle('is-on', b === btn));
        const card = content.querySelector('#intakeInspectionCard');
        const hint = content.querySelector('#intakePowerHint');

        if (intake.powersOn === 'يعمل') {
          card.classList.remove('hidden');
          hint.textContent = 'الجهاز يعمل — يمكنك فحصه الآن.';
          updateInspectionSummary(content);
        } else {
          card.classList.add('hidden');
          hint.textContent = 'الجهاز لا يعمل — لا حاجة لقائمة الفحص.';
          intake.checklist.forEach(item => { item.result = ''; item.note = ''; });
        }
      });
    });

    content.querySelector('#intakeStartInspection').addEventListener('click', () => openIntakeInspection(content));

    content.querySelectorAll('[data-part-price]').forEach(chip => {
      chip.addEventListener('click', () => {
        // A price cell may hold a range like "700/1300". Taking every digit
        // produced 7001300 and failed the amount limit; use the first value.
        const match = String(chip.dataset.partPrice).replace(/[٬,]/g, '').match(/\d+(?:\.\d+)?/);
        if (match) content.querySelector('#intakeEstimate').value = Number(match[0]);
        content.querySelectorAll('[data-part-price]').forEach(c => c.classList.toggle('is-on', c === chip));
      });
    });

    content.querySelector('#intakeSubmit').addEventListener('click', async ev => {
      const btn = ev.currentTarget;
      const message = content.querySelector('#intakeMessage');
      const fail = text => {
        message.textContent = text;
        message.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = '+ إنشاء البطاقة';
        message.scrollIntoView({ block: 'center', behavior: 'smooth' });
      };

      const problem = content.querySelector('#intakeProblem').value.trim();
      const technicianId = content.querySelector('#intakeTechnician').value;
      if (!intake.powersOn) return fail('حدد هل الجهاز يعمل أم لا.');
      if (problem.length < 3) return fail('اكتب وصف المشكلة.');
      if (!technicianId) return fail('اختر الفني المسؤول.');

      const estimateRaw = content.querySelector('#intakeEstimate').value;
      const depositRaw = content.querySelector('#intakeDeposit').value;
      const estimate = estimateRaw === '' ? 0 : Number(estimateRaw);
      const deposit = depositRaw === '' ? 0 : Number(depositRaw);
      if (!isFinite(estimate) || estimate < 0 || estimate > 1000000) return fail('التكلفة التقديرية غير صحيحة.');
      if (!isFinite(deposit) || deposit < 0 || deposit > 1000000) return fail('العربون غير صحيح.');

      // Carry the real inspection outcome into the card: failed items plus
      // any note the technician wrote on a specific test.
      const failedItems = intake.powersOn === 'يعمل'
        ? intake.checklist.filter(c => c.result === 'مشكلة')
        : [];
      const notedItems = intake.powersOn === 'يعمل'
        ? intake.checklist.filter(c => c.note && c.note.trim())
        : [];
      let fullProblem = problem;
      if (failedItems.length) {
        fullProblem += '\n\nمشاكل الفحص: ' + failedItems.map(c => c.name).join(' · ');
      }
      if (notedItems.length) {
        fullProblem += '\n\nملاحظات الفحص: ' + notedItems.map(c => c.name + ' — ' + c.note.trim()).join(' | ');
      }
      const inspectedCount = intake.powersOn === 'يعمل'
        ? intake.checklist.filter(c => c.result).length
        : 0;

      btn.disabled = true;
      btn.textContent = 'جارٍ الإنشاء...';
      message.classList.add('hidden');

      try {
        const res = await api('device_intake_create', {
          customerName: intake.customer.name,
          customerPhone: intake.customer.phone,
          customerAddress: intake.customer.address || '',
          family: intake.family,
          brand: intake.familyLabel,
          model: intake.model,
          imei: content.querySelector('#intakeImei').value.trim(),
          pin: content.querySelector('#intakePin').value.trim(),
          problem: fullProblem,
          accessories: intake.accessories,
          powersOn: intake.powersOn,
          inspectedCount: inspectedCount,
          estimate: estimate,
          deposit: deposit,
          dueDate: content.querySelector('#intakeDue').value,
          technicianId
        });
        if (tg?.showAlert) tg.showAlert(`تم إنشاء البطاقة\nرقم الطلب: ${res.orderId}\nالفني: ${res.technicianName}`);
        closeModal();
        await openEmployeeDevices();
      } catch (e) {
        fail(e.message);
      }
    });
  }

  /* Summarises the inspection state on the intake card. */
  function updateInspectionSummary(content) {
    const summary = content.querySelector('#intakeInspectionSummary');
    const button = content.querySelector('#intakeStartInspection');
    if (!summary) return;
    const total = intake.checklist.length;
    if (!total) {
      summary.textContent = 'لا توجد قائمة فحص مسجّلة لهذا النوع.';
      if (button) button.classList.add('hidden');
      return;
    }
    const done = intake.checklist.filter(c => c.result).length;
    const issues = intake.checklist.filter(c => c.result === 'مشكلة').length;
    summary.textContent = done
      ? `تم تقييم ${done} من ${total}${issues ? ' · مشاكل: ' + issues : ''}`
      : `${total} اختبار — بالشرح والملاحظات لكل اختبار.`;
    if (button) {
      button.classList.remove('hidden');
      button.textContent = done ? 'متابعة فحص الجهاز' : 'بدء فحص الجهاز';
    }
  }

  /* ============================================================
   * BUTTON VISIBILITY CONTROL (Super Admin)
   * Choose which home tiles each technician sees.
   * ============================================================ */

  async function openButtonsMatrix() {
    const panel = managerPanel('التحكم في أزرار الفنيين', '<div class="manager-loading">جاري تحميل الأزرار...</div>');
    const content = panel.querySelector('.manager-module-content');
    await renderButtonsMatrix(content);
  }

  async function renderButtonsMatrix(content, selectedId) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل الأزرار...</div>';
    try {
      const data = await api('buttons_matrix_get');
      const employees = data.employees || [];
      const buttons = data.buttons || [];

      const groups = {};
      buttons.forEach(b => {
        if (!groups[b.group]) groups[b.group] = [];
        groups[b.group].push(b);
      });

      const current = employees.find(e => e.employeeId === selectedId) || employees[0];
      const visibleCount = current ? buttons.filter(b => current.visible[b.key] !== false).length : 0;

      content.innerHTML = `<div class="notify-matrix">
        <div class="notify-intro">
          <b>تحكم في أزرار كل فني</b>
          <p>أخفِ أي زر عن أي فني. الإخفاء يمنع الزر من الظهور في تطبيقه فقط، ولا يغيّر صلاحيات الخادم.</p>
        </div>

        <label class="notify-picker">الفني
          <select id="btnPickEmployee">
            ${employees.map(e => `<option value="${escapeHtml(e.employeeId)}"${current && e.employeeId === current.employeeId ? ' selected' : ''}>${escapeHtml(e.name)}${e.job ? ' — ' + escapeHtml(e.job) : ''}</option>`).join('')}
          </select>
        </label>

        ${current ? `
          <div class="btn-matrix-summary">
            <span>${visibleCount} من ${buttons.length} زر ظاهر</span>
          </div>

          <div class="notify-bulk">
            <button type="button" class="secondary-btn" id="btnShowAll">إظهار الكل</button>
            <button type="button" class="danger-btn" id="btnHideAll">إخفاء الكل</button>
          </div>

          ${Object.keys(groups).map(group => `<div class="notify-group">
            <h5 class="price-group-title">${escapeHtml(group)}</h5>
            <div class="btn-matrix-list">
              ${groups[group].map(b => {
                const isVisible = current.visible[b.key] !== false;
                return `<label class="btn-matrix-row${isVisible ? '' : ' is-hidden'}">
                  <span>${escapeHtml(b.label)}</span>
                  <span class="notify-switch">
                    <input type="checkbox" data-btn-toggle data-emp="${escapeHtml(current.employeeId)}" data-button="${escapeHtml(b.key)}"${isVisible ? ' checked' : ''}>
                    <i></i>
                  </span>
                </label>`;
              }).join('')}
            </div>
          </div>`).join('')}
        ` : '<p class="manager-empty-state">لا يوجد فنيون نشطون.</p>'}
      </div>`;

      content.querySelector('#btnPickEmployee')?.addEventListener('change', ev => {
        renderButtonsMatrix(content, ev.target.value);
      });
      content.querySelector('#btnShowAll')?.addEventListener('click', () => bulkButtons(content, current.employeeId, true));
      content.querySelector('#btnHideAll')?.addEventListener('click', () => bulkButtons(content, current.employeeId, false));

      content.querySelectorAll('[data-btn-toggle]').forEach(box => {
        box.addEventListener('change', async () => {
          const d = box.dataset;
          box.disabled = true;
          try {
            await api('buttons_matrix_set', {
              employeeId: d.emp, button: d.button, visible: box.checked
            });
            const row = box.closest('.btn-matrix-row');
            if (row) row.classList.toggle('is-hidden', !box.checked);
            updateBtnSummary(content, buttons.length);
          } catch (e) {
            box.checked = !box.checked;
            if (tg?.showAlert) tg.showAlert(e.message);
          } finally { box.disabled = false; }
        });
      });
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  function updateBtnSummary(content, total) {
    const el = content.querySelector('.btn-matrix-summary span');
    if (!el) return;
    const on = content.querySelectorAll('[data-btn-toggle]:checked').length;
    el.textContent = `${on} من ${total} زر ظاهر`;
  }

  async function bulkButtons(content, employeeId, visible) {
    try {
      await api('buttons_matrix_bulk', { employeeId, visible });
      if (tg?.showAlert) tg.showAlert(visible ? 'تم إظهار كل الأزرار.' : 'تم إخفاء كل الأزرار.');
      renderButtonsMatrix(content, employeeId);
    } catch (e) {
      if (tg?.showAlert) tg.showAlert(e.message);
    }
  }


  /* ============================================================
   * MANAGEMENT CONSOLE — the new dashboard
   * Five tabs: overview, team, money, operations, reports.
   * One request loads the whole console.
   * ============================================================ */

  let consoleState = { tab: 'overview', data: null, report: null, reportType: 'summary' };

  const CONSOLE_TABS = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'team', label: 'الفريق' },
    { key: 'money', label: 'المالية' },
    { key: 'operations', label: 'التشغيل' },
    { key: 'reports', label: 'التقارير' }
  ];

  async function openManagementConsole() {
    const panel = managerPanel('لوحة الإدارة', '<div class="manager-loading">جاري تحميل اللوحة...</div>');
    const content = panel.querySelector('.manager-module-content');
    await renderConsole(content);
  }

  async function renderConsole(content) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل بيانات اللوحة...</div>';
    try {
      const data = await api('console_overview');
      consoleState.data = data;
      drawConsole(content);
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  /* Renders the console directly into the dashboard section (no modal). */
  /* ============================================================
   * DASHBOARD MODULE GRID — permission aware
   * Hides modules the role cannot use, and groups them into four
   * clear sections instead of one flat list.
   * ============================================================ */

  const MODULE_GROUPS = [
    { key: 'ops', title: 'التشغيل اليومي', icon: '◷', modules: ['daily', 'shifts', 'requests'] },
    { key: 'team', title: 'الفريق والمهام', icon: '♙', modules: ['staff', 'tasks', 'parts', 'procurement'] },
    { key: 'money', title: 'المالية', icon: 'ج.م', modules: ['finance', 'overtime'] },
    { key: 'system', title: 'الأجهزة والتقارير', icon: '▥', modules: ['devices', 'delivery', 'system'] },
    { key: 'control', title: 'الإشعارات والصلاحيات', icon: '🎛', modules: ['notifications', 'notificationMatrix', 'buttonsMatrix', 'managers'] }
  ];

  function applyModulePermissions() {
    const modules = (managerDashboardCache && managerDashboardCache.modules) || {};
    const grid = $('managerModules');
    if (!grid) return;

    // 1. Hide every module the current role cannot open.
    grid.querySelectorAll('[data-manager-module]').forEach(function(btn) {
      const key = btn.getAttribute('data-manager-module');
      const allowed = modules[key] === true;
      btn.classList.toggle('hidden', !allowed);
    });

    // 2. Hide group headings that have no visible button left.
    grid.querySelectorAll('.manager-module-group').forEach(function(group) {
      const anyVisible = [...group.querySelectorAll('[data-manager-module]')].some(b => !b.classList.contains('hidden'));
      group.classList.toggle('hidden', !anyVisible);
    });
  }

  /** Rebuilds the grid into grouped sections (runs once per dashboard load). */
  function groupModuleGrid() {
    const grid = $('managerModules');
    if (!grid || grid.dataset.grouped === 'true') return;

    const buttons = {};
    grid.querySelectorAll('[data-manager-module]').forEach(function(btn) {
      buttons[btn.getAttribute('data-manager-module')] = btn;
    });
    if (!Object.keys(buttons).length) return;

    const frag = document.createDocumentFragment();
    MODULE_GROUPS.forEach(function(group) {
      const present = group.modules.filter(function(m) { return buttons[m]; });
      if (!present.length) return;

      const section = document.createElement('div');
      section.className = 'manager-module-group';

      const heading = document.createElement('div');
      heading.className = 'manager-module-group-label';
      heading.textContent = group.title;
      section.appendChild(heading);

      const row = document.createElement('div');
      row.className = 'manager-module-group-grid';
      present.forEach(function(m) { row.appendChild(buttons[m]); });
      section.appendChild(row);
      frag.appendChild(section);
    });

    grid.innerHTML = '';
    grid.appendChild(frag);
    grid.dataset.grouped = 'true';
  }


  function drawConsoleInto(host) {
    drawConsoleShell(host);
  }

  function drawConsole(content) {
    drawConsoleShell(content);
  }

  function drawConsoleShell(content) {
    const d = consoleState.data || {};
    const tabs = CONSOLE_TABS.filter(function(t) {
      const m = d.modules || {};
      if (t.key === 'team') return !!(m.staff || m.daily || m.shifts || m.tasks || m.buttonsMatrix || m.managers || m.notificationMatrix || m.notifications);
      if (t.key === 'money') return !!(m.finance || m.overtime);
      if (t.key === 'operations') return !!(m.requests || m.devices || m.tasks || m.parts || m.procurement || m.delivery);
      return true;
    });

    content.innerHTML = `<div class="console">
      <header class="console-head">
        <div>
          <span class="console-kicker">MobiHub Console</span>
          <h3>لوحة الإدارة</h3>
          <small>${escapeHtml(d.date || '')} · ${escapeHtml(d.role || '')}</small>
        </div>
        <button type="button" class="console-refresh" id="consoleRefresh">تحديث</button>
      </header>

      <nav class="console-tabs">
        ${tabs.map(t => `<button type="button" class="console-tab${consoleState.tab === t.key ? ' is-active' : ''}" data-console-tab="${t.key}">${escapeHtml(t.label)}</button>`).join('')}
      </nav>

      <div id="consoleBody"></div>
    </div>`;

    content.querySelector('#consoleRefresh').addEventListener('click', async function() {
      this.disabled = true;
      await renderConsole(content);
    });
    content.querySelectorAll('[data-console-tab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        consoleState.tab = btn.dataset.consoleTab;
        drawConsole(content);
      });
    });

    const body = content.querySelector('#consoleBody');
    if (consoleState.tab === 'overview') drawOverview(body, d);
    else if (consoleState.tab === 'team') drawTeam(body, d);
    else if (consoleState.tab === 'money') drawMoney(body, d);
    else if (consoleState.tab === 'operations') drawOperations(body, d);
    else drawReports(body, d);
  }

  /* ---------------- Tab: overview ---------------- */
  function drawOverview(body, d) {
    const alerts = d.alerts || [];
    const critical = alerts.filter(a => a.urgency === 'high');
    const m = d.money || {};
    const at = d.attendance || {};
    const req = d.requests || {};

    body.innerHTML = `
      ${critical.length ? `<div class="console-critical">
        <b>⚠️ يحتاج تدخلك الآن</b>
        ${critical.map(a => `<button type="button" class="console-critical-row" data-goto="${escapeHtml(a.screen)}">
          <span>${escapeHtml(a.label)}</span><b>${a.count}</b></button>`).join('')}
      </div>` : ''}

      <div class="console-kpis">
        ${d.modules.staff ? kpi('الموظفون النشطون', d.staff.active, 'من ' + d.staff.total) : ''}
        ${d.modules.daily ? kpi('الموجودون الآن', at.presentNow, 'حضور ' + at.checkedInToday + ' اليوم') : ''}
        ${d.modules.requests ? kpi('طلبات معلقة', (req.pendingRequests || 0) + (req.pendingLeaves || 0), 'أذونات: ' + (req.pendingLeaves || 0)) : ''}
        ${d.modules.finance ? kpi('عهد مفتوحة', m.openCustody, formatMoney(m.custodyAmount) + ' جنيه') : ''}
        ${d.modules.finance ? kpi('تسويات معلقة', m.settlementsPending, 'بانتظار المراجعة') : ''}
        ${d.modules.tasks ? kpi('مهام مفتوحة', d.operations.openTasks, 'مراجعة: ' + d.operations.tasksInReview) : ''}
        ${d.modules.devices ? kpi('أجهزة تحت المتابعة', d.operations.activeDevices, 'جاهزة: ' + d.operations.readyDevices) : ''}
      </div>

      ${(function(){
              const rest = alerts.filter(function(a){ return a.urgency !== 'high'; });
              if (!alerts.length) return '<section class="console-card"><p class="console-empty">✅ لا توجد عناصر معلقة — كل شيء تحت السيطرة.</p></section>';
              if (!rest.length) return '';
              return '<section class="console-card"><h4>بقية البنود المعلقة</h4><div class="console-alerts">' +
                rest.map(function(a){ return '<button type="button" class="console-alert" data-goto="' + escapeHtml(a.screen) + '"><span>' + escapeHtml(a.label) + '</span><b>' + a.count + '</b></button>'; }).join('') +
                '</div></section>';
            })()}

      ${(d.feed || []).length ? `<section class="console-card">
        <h4>آخر النشاط</h4>
        <div class="console-feed">
          ${d.feed.map(f => `<div class="console-feed-row">
            <span class="console-feed-kind is-${escapeHtml(f.kind)}">${feedIcon(f.kind)}</span>
            <div><b>${escapeHtml(f.title)}</b><small>${escapeHtml(f.detail || '')}</small></div>
            <time>${escapeHtml(String(f.at || '').slice(5, 16))}</time>
          </div>`).join('')}
        </div>
      </section>` : ''}
    `;
    wireGoto(body);
  }

  function kpi(label, value, sub) {
    const v = (value === null || value === undefined) ? '—' : value;
    return `<article class="console-kpi">
      <small>${escapeHtml(label)}</small>
      <b>${escapeHtml(String(v))}</b>
      ${sub ? `<span>${escapeHtml(String(sub))}</span>` : ''}
    </article>`;
  }

  function feedIcon(kind) {
    return ({ attendance: '✓', deduction: '−', task: '◆', cash: 'ج.م', device: '▣' })[kind] || '•';
  }

  function formatMoney(value) {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  /* Finds the element the console is currently rendered inside. */
  function consoleHost(el) {
    if (!el) return $('managerDashboard');
    return el.closest('.manager-module-content') || el.closest('#managerDashboard') || $('managerDashboard');
  }

  function wireGoto(root) {
    root.querySelectorAll('[data-goto]').forEach(function(btn) {
      btn.addEventListener('click', function() { openConsoleScreen(btn.dataset.goto); });
    });
  }

  /* ---------------- Tab: team ---------------- */
  function drawTeam(body, d) {
    const at = d.attendance || {};
    body.innerHTML = `
      <div class="console-kpis">
        ${d.modules.staff ? kpi('الموظفون النشطون', d.staff.active, 'الإجمالي ' + d.staff.total) : ''}
        ${d.modules.daily ? kpi('حضور اليوم', at.checkedInToday, 'حاضرون الآن ' + at.presentNow) : ''}
        ${d.modules.daily ? kpi('أيام التأخير بالشهر', at.lateDays, at.lateMinutes + ' دقيقة') : ''}
        ${d.modules.daily ? kpi('غياب بانتظار المراجعة', d.requests.pendingAbsences, 'يحتاج قرارك') : ''}
      </div>

      <section class="console-card">
        <h4>إدارة الفريق</h4>
        <div class="console-actions">
          ${d.modules.staff ? action('الموظفون', 'staff') : ''}
          ${d.modules.daily ? action('المتابعة اليومية', 'daily') : ''}
          ${d.modules.shifts ? action('الورديات', 'shifts') : ''}
          ${d.modules.tasks ? action('المهام والتسكات', 'tasks') : ''}
        </div>
      </section>

      ${(d.modules.buttonsMatrix || d.modules.managers || d.modules.notificationMatrix || d.modules.notifications) ? `<section class="console-card">
        <h4>إدارة النظام والصلاحيات</h4>
        <div class="console-actions">
          ${d.modules.buttonsMatrix ? action('التحكم في الأزرار', 'buttonsMatrix') : ''}
          ${d.modules.managers ? action('إدارة المديرين', 'managers') : ''}
          ${d.modules.notificationMatrix ? action('التحكم في الإشعارات', 'notificationMatrix') : ''}
          ${d.modules.notifications ? action('مركز الإشعارات', 'notifications') : ''}
        </div>
      </section>` : ''}

      <section class="console-card">
        <h4>تقارير الفريق</h4>
        <div class="console-actions">
          <button type="button" class="console-action" data-report="attendance">تقرير الحضور</button>
          <button type="button" class="console-action" data-report="tasks">تقرير المهام</button>
        </div>
      </section>
    `;
    wireActions(body);
  }

  /* ---------------- Tab: money ---------------- */
  function drawMoney(body, d) {
    const m = d.money || {};
    body.innerHTML = `
      <div class="console-kpis">
        ${kpi('خصومات الشهر', formatMoney(m.monthDeductionsApproved) + ' ج', 'معلقة ' + formatMoney(m.monthDeductionsPending))}
        ${kpi('أوفر تايم الشهر', formatMoney(m.monthOvertimeAmount) + ' ج', m.monthOvertimeMinutes + ' دقيقة')}
        ${kpi('عهد مفتوحة', m.openCustody, formatMoney(m.custodyAmount) + ' ج مستحقة')}
        ${kpi('بإنتظار الصرف', m.awaitingPayout, 'سلف معتمدة')}
      </div>

      <section class="console-card">
        <h4>الإدارة المالية</h4>
        <div class="console-actions">
          ${action('السلف والعهد', 'finance')}
          ${action('الأوفر تايم', 'overtime')}
        </div>
      </section>

      <section class="console-card">
        <h4>التقارير المالية</h4>
        <div class="console-actions">
          <button type="button" class="console-action" data-report="finance">التقرير المالي</button>
          <button type="button" class="console-action" data-report="custody">تقرير العهد</button>
        </div>
      </section>
    `;
    wireActions(body);
  }

  /* ---------------- Tab: operations ---------------- */
  function drawOperations(body, d) {
    const o = d.operations || {};
    body.innerHTML = `
      <div class="console-kpis">
        ${d.modules.devices ? kpi('أجهزة تحت المتابعة', o.activeDevices, 'جاهزة ' + o.readyDevices) : ''}
        ${d.modules.devices ? kpi('قطع غيار معلقة', o.partsPending, 'بانتظار الموافقة') : ''}
        ${d.modules.tasks ? kpi('مهام مفتوحة', o.openTasks, 'مراجعة ' + o.tasksInReview) : ''}
        ${d.modules.tasks ? kpi('مهام متأخرة', o.tasksOverdue, 'تجاوزت الاستحقاق') : ''}
      </div>

      <section class="console-card">
        <h4>إدارة التشغيل</h4>
        <div class="console-actions">
          ${d.modules.requests ? action('طلبات المهندسين والشكاوى', 'requests') : ''}
          ${d.modules.devices ? action('الأجهزة والصيانة', 'devices') : ''}
          ${d.modules.delivery ? action('الجودة والتسليم', 'delivery') : ''}
          ${d.modules.parts ? action('قطع الغيار', 'parts') : ''}
          ${d.modules.procurement ? action('المشتريات والمخزون', 'procurement') : ''}
        </div>
      </section>

      <section class="console-card">
        <h4>تقارير التشغيل</h4>
        <div class="console-actions">
          ${d.modules.devices ? '<button type="button" class="console-action" data-report="devices">تقرير الأجهزة</button>' : ''}
        </div>
      </section>
    `;
    wireActions(body);
  }

  function action(label, module) {
    return `<button type="button" class="console-action" data-module="${escapeHtml(module)}">${escapeHtml(label)}</button>`;
  }

  function wireActions(root) {
    root.querySelectorAll('[data-module]').forEach(function(btn) {
      btn.addEventListener('click', function() { openConsoleScreen(btn.dataset.module); });
    });
    root.querySelectorAll('[data-report]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        consoleState.tab = 'reports';
        consoleState.reportType = btn.dataset.report;
        consoleState.report = null;
        drawConsole(consoleHost(btn));
      });
    });
  }

  /* Panels that the console can open, mapped to their existing openers. */
  function openConsoleScreen(key) {
    const map = {
      staff: function() { openManagerModule('staff'); },
      daily: function() { openManagerModule('daily'); },
      shifts: function() { openManagerModule('shifts'); },
      tasks: function() { openTaskAdminPanel(); },
      finance: function() { openManagerModule('finance'); },
      overtime: function() { openManagerModule('overtime'); },
      devices: function() { openManagerModule('devices'); },
      delivery: function() { openDeliveryPanel(); },
      parts: function() { openPartAdminPanel(); },
      procurement: function() { openProcurementPanel(); },
      managers: function() { openManagerModule('managers'); },
      buttonsMatrix: function() { openButtonsMatrix(); },
      requests: function() { openManagerModule('requests'); },
      notifications: function() { openManagerModule('notifications'); },
      notificationMatrix: function() { openManagerModule('notificationMatrix'); },
      system: function() { openManagerModule('system'); }
    };
    const fn = map[key];
    if (fn) fn();
  }

  /* ---------------- Tab: reports ---------------- */
  const REPORT_DEFS = [
    { key: 'summary', label: 'ملخص عام' },
    { key: 'finance', label: 'مالي' },
    { key: 'attendance', label: 'الحضور' },
    { key: 'tasks', label: 'المهام' },
    { key: 'custody', label: 'العهد' },
    { key: 'devices', label: 'الأجهزة' }
  ];

  function drawReports(body, d) {
    const types = REPORT_DEFS.filter(function(r) {
      if (r.key === 'finance' || r.key === 'custody') return d.modules && d.modules.finance;
      if (r.key === 'devices') return d.modules && d.modules.devices;
      if (r.key === 'tasks') return d.modules && d.modules.tasks;
      return true;
    });
    if (!types.some(t => t.key === consoleState.reportType)) consoleState.reportType = types[0].key;

    body.innerHTML = `<div class="console-report">
      <div class="console-report-head">
        <label>الشهر
          <input id="reportMonth" type="month" value="${escapeHtml(d.month || '')}">
        </label>
        <div class="console-report-types">
          ${types.map(t => `<button type="button" class="console-chip${consoleState.reportType === t.key ? ' is-active' : ''}" data-report-type="${t.key}">${escapeHtml(t.label)}</button>`).join('')}
        </div>
      </div>
      <div id="reportBody"><div class="manager-loading">جاري تجهيز التقرير...</div></div>
      ${d.modules.system ? `<section class="console-card console-report-tools"><h4>تقارير النظام</h4><div class="console-actions">${action('ملخص الحضور والتشغيل', 'system')}</div></section>` : ''}
    </div>`;

    body.querySelectorAll('[data-report-type]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        consoleState.reportType = btn.dataset.reportType;
        consoleState.report = null;
        drawConsole(consoleHost(btn));
      });
    });
    body.querySelector('#reportMonth').addEventListener('change', function(ev) {
      loadReport(consoleHost(ev.target), ev.target.value);
    });
    wireActions(body);

    loadReport(consoleHost(body), (d.month || ''));
  }

  async function loadReport(content, month) {
    const holder = content.querySelector('#reportBody');
    if (!holder) return;
    holder.innerHTML = '<div class="manager-loading">جاري تجهيز التقرير...</div>';
    try {
      const data = await api('console_report', { type: consoleState.reportType, month: month });
      consoleState.report = data;
      holder.innerHTML = renderReport(data);
    } catch (e) {
      holder.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  function renderReport(data) {
    const t = data.totals || {};
    const rows = data.rows || [];

    if (data.type === 'summary') {
      return `<div class="report-totals">
        ${reportTotal('مرات الحضور', t.checkins, '')}
        ${reportTotal('دقائق التأخير', t.lateMinutes, 'دقيقة')}
        ${reportTotal('خصومات معتمدة', formatMoney(t.deductions), 'جنيه')}
        ${reportTotal('أوفر تايم', formatMoney(t.overtime), 'جنيه')}
        ${reportTotal('عهد مصروفة', formatMoney(t.custodyPaid), 'جنيه')}
      </div>
      <p class="console-empty">اختر تقريرًا محددًا من الأعلى لعرض التفاصيل لكل موظف.</p>`;
    }

    if (data.type === 'finance') {
      return `<div class="report-totals">
        ${reportTotal('سلف مصروفة', formatMoney(t.advances), 'جنيه')}
        ${reportTotal('خصومات معتمدة', formatMoney(t.deductions), 'جنيه')}
        ${reportTotal('أوفر تايم', formatMoney(t.overtime), 'جنيه')}
        ${reportTotal('الإجمالي', formatMoney(data.grandTotal), 'جنيه')}
      </div>
      ${reportTable(rows, [
        { key: 'name', label: 'الموظف' },
        { key: 'advances', label: 'سلف', money: true },
        { key: 'deductions', label: 'خصومات', money: true },
        { key: 'overtime', label: 'أوفر تايم', money: true },
        { key: 'total', label: 'الإجمالي', money: true, strong: true }
      ])}`;
    }

    if (data.type === 'attendance') {
      return `<div class="report-totals">
        ${reportTotal('مرات الحضور', t.checkins, '')}
        ${reportTotal('مرات الانصراف', t.checkouts, '')}
        ${reportTotal('أيام تأخير', t.lateDays, '')}
        ${reportTotal('دقائق التأخير', t.lateMinutes, 'دقيقة')}
      </div>
      ${reportTable(rows, [
        { key: 'name', label: 'الموظف' },
        { key: 'checkins', label: 'حضور' },
        { key: 'checkouts', label: 'انصراف' },
        { key: 'lateDays', label: 'أيام تأخير' },
        { key: 'lateMinutes', label: 'دقائق', strong: true }
      ])}`;
    }

    if (data.type === 'tasks') {
      return `<div class="report-totals">
        ${reportTotal('إجمالي المهام', t.total, '')}
        ${reportTotal('مكتملة', t.done, '')}
        ${reportTotal('مفتوحة', t.open, '')}
        ${reportTotal('بانتظار مراجعة', t.review, '')}
      </div>
      ${reportTable(rows, [
        { key: 'name', label: 'الفني' },
        { key: 'total', label: 'الكل' },
        { key: 'done', label: 'مكتملة' },
        { key: 'open', label: 'مفتوحة' },
        { key: 'overdue', label: 'متأخرة', strong: true }
      ])}`;
    }

    if (data.type === 'custody') {
      return `<div class="report-totals">
        ${reportTotal('عهد مفتوحة', t.openCount, '')}
        ${reportTotal('المعتمد', formatMoney(t.approved), 'جنيه')}
        ${reportTotal('المصروف', formatMoney(t.spent), 'جنيه')}
        ${reportTotal('المتبقي', formatMoney(t.outstanding), 'جنيه')}
      </div>
      ${reportTable(rows, [
        { key: 'name', label: 'الموظف' },
        { key: 'count', label: 'عدد' },
        { key: 'approved', label: 'معتمد', money: true },
        { key: 'spent', label: 'مصروف', money: true },
        { key: 'outstanding', label: 'متبقي', money: true, strong: true }
      ])}`;
    }

    if (data.type === 'devices') {
      const statusRows = Object.keys(data.byStatus || {}).map(function(k) {
        return { name: k, count: data.byStatus[k] };
      }).sort(function(a, b) { return b.count - a.count; });
      return `<div class="report-totals">
        ${reportTotal('إجمالي الأجهزة', t.total, '')}
        ${reportTotal('تحت المتابعة', t.open, '')}
        ${reportTotal('تم التسليم', t.delivered, '')}
      </div>
      <h5 class="price-group-title">حسب الحالة</h5>
      ${reportTable(statusRows, [
        { key: 'name', label: 'الحالة' },
        { key: 'count', label: 'العدد', strong: true }
      ])}
      <h5 class="price-group-title">حسب الفني</h5>
      ${reportTable(rows, [
        { key: 'name', label: 'الفني' },
        { key: 'total', label: 'الكل' },
        { key: 'open', label: 'مفتوح', strong: true },
        { key: 'delivered', label: 'مسلّم' }
      ])}`;
    }

    return '<p class="console-empty">لا توجد بيانات.</p>';
  }

  function reportTotal(label, value, unit) {
    // Values arrive either raw (numbers) or pre-formatted strings; only
    // format numbers, never a string that is already display-ready.
    let v;
    if (value === null || value === undefined || value === '') v = '—';
    else if (typeof value === 'number') v = formatMoney(value);
    else v = String(value);
    return `<div class="report-total"><small>${escapeHtml(label)}</small><b>${escapeHtml(String(v))}</b>${unit ? `<span>${escapeHtml(unit)}</span>` : ''}</div>`;
  }

  function reportTable(rows, cols) {
    if (!rows || !rows.length) return '<p class="console-empty">لا توجد بيانات لهذا الشهر.</p>';
    return `<div class="report-table">
      <div class="report-table-head">
        ${cols.map(c => `<span>${escapeHtml(c.label)}</span>`).join('')}
      </div>
      ${rows.map(r => `<div class="report-table-row">
        ${cols.map(c => {
          let v = r[c.key];
          if (v === null || v === undefined) v = '—';
          else if (c.money) v = formatMoney(v);
          return `<span${c.strong ? ' class="is-strong"' : ''}>${escapeHtml(String(v))}</span>`;
        }).join('')}
      </div>`).join('')}
    </div>`;
  }


  /* ============================================================
   * PROCUREMENT — «المشتريات والمخزون»
   * Purchasing officers approve part requests and keep stock.
   * ============================================================ */

  async function openProcurementPanel() {
    const panel = managerPanel('المشتريات والمخزون', '<div class="manager-loading">جاري تحميل البيانات...</div>');
    const content = panel.querySelector('.manager-module-content');
    await renderProcurement(content);
  }

  async function renderProcurement(content, tab) {
    const current = tab || 'requests';
    content.innerHTML = '<div class="manager-loading">جاري تحميل البيانات...</div>';
    try {
      const data = await api('inventory_overview');
      const c = data.counts || {};

      content.innerHTML = `<div class="console">
        <div class="console-kpis">
          ${procKpi('طلبات بانتظار الموافقة', c.pendingRequests, 'تحتاج قرارك')}
          ${procKpi('معتمدة بانتظار الصرف', c.awaitingIssue, 'جاهزة للتسليم')}
          ${procKpi('أصناف في المخزون', c.totalItems, 'إجمالي')}
          ${procKpi('تحت الحد الأدنى', c.lowStock, 'تحتاج توريد')}
        </div>

        <nav class="console-tabs">
          <button type="button" class="console-tab${current === 'requests' ? ' is-active' : ''}" data-proc-tab="requests">الطلبات</button>
          <button type="button" class="console-tab${current === 'stock' ? ' is-active' : ''}" data-proc-tab="stock">المخزون</button>
        </nav>

        <div id="procBody"></div>
      </div>`;

      content.querySelectorAll('[data-proc-tab]').forEach(function(btn) {
        btn.addEventListener('click', function() { renderProcurement(content, btn.dataset.procTab); });
      });

      const body = content.querySelector('#procBody');
      if (current === 'requests') drawProcRequests(body, data);
      else drawProcStock(body, data);
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  function procKpi(label, value, sub) {
    const v = (value === null || value === undefined) ? '—' : value;
    return `<article class="console-kpi"><small>${escapeHtml(label)}</small><b>${escapeHtml(String(v))}</b><span>${escapeHtml(sub || '')}</span></article>`;
  }

  function drawProcRequests(body, data) {
    const pending = data.pending || [];
    const awaiting = data.approvedAwaitingIssue || [];
    const demand = data.demand || [];

    body.innerHTML = `
      ${demand.length ? `<section class="console-card">
        <h4>القطع المطلوبة — مجمّعة</h4>
        <div class="proc-demand">
          ${demand.map(function(d) {
            return `<div class="proc-demand-row"><b>${escapeHtml(d.name)}</b><span>${d.quantity} قطعة · ${d.count} طلب</span></div>`;
          }).join('')}
        </div>
      </section>` : ''}

      <section class="console-card">
        <h4>بانتظار قرارك (${pending.length})</h4>
        ${pending.length ? `<div class="tasks-list">
          ${pending.map(function(p) {
            return `<article class="task-row proc-row">
              <span class="task-row-main">
                <b>${escapeHtml(p.partName)} <span class="part-qty">×${p.quantity}</span></b>
                <small>${escapeHtml(p.employeeName)} · ${escapeHtml(p.purpose)}${p.deviceRef ? ' · ' + escapeHtml(p.deviceRef) : ''}</small>
                <small class="part-reason">${escapeHtml(p.reason)}</small>
              </span>
              <span class="task-row-actions">
                <button type="button" class="task-mini-btn is-approve" data-proc-approve="${escapeHtml(p.id)}">اعتماد</button>
                <button type="button" class="task-mini-btn" data-proc-reject="${escapeHtml(p.id)}">رفض</button>
              </span>
            </article>`;
          }).join('')}
        </div>` : '<p class="console-empty">لا توجد طلبات بانتظار الموافقة.</p>'}
      </section>

      <section class="console-card">
        <h4>معتمدة بانتظار الصرف (${awaiting.length})</h4>
        ${awaiting.length ? `<div class="tasks-list">
          ${awaiting.map(function(p) {
            return `<article class="task-row proc-row">
              <span class="task-row-main">
                <b>${escapeHtml(p.partName)} <span class="part-qty">×${p.quantity}</span></b>
                <small>${escapeHtml(p.employeeName)} · ${escapeHtml(p.purpose)}</small>
              </span>
              <span class="task-row-actions">
                <button type="button" class="task-mini-btn is-approve" data-proc-issue="${escapeHtml(p.id)}">تم الصرف</button>
              </span>
            </article>`;
          }).join('')}
        </div>` : '<p class="console-empty">لا توجد قطع معتمدة بانتظار الصرف.</p>'}
      </section>`;

    const decide = async function(id, decision) {
      try {
        await api('part_request_decide', { requestId: id, decision: decision });
        if (tg?.showAlert) tg.showAlert(decision === 'تم الصرف' ? 'تم صرف القطعة وتحديث المخزون.' : 'تم تحديث الطلب.');
        renderProcurement(body.closest('.manager-module-content'), 'requests');
      } catch (e) {
        if (tg?.showAlert) tg.showAlert(e.message);
      }
    };
    body.querySelectorAll('[data-proc-approve]').forEach(function(b) { b.addEventListener('click', function() { decide(b.dataset.procApprove, 'معتمد'); }); });
    body.querySelectorAll('[data-proc-reject]').forEach(function(b) { b.addEventListener('click', function() { decide(b.dataset.procReject, 'مرفوض'); }); });
    body.querySelectorAll('[data-proc-issue]').forEach(function(b) { b.addEventListener('click', function() { decide(b.dataset.procIssue, 'تم الصرف'); }); });
  }

  function drawProcStock(body, data) {
    const items = data.inventory || [];
    const low = items.filter(function(i) { return i.low; });

    body.innerHTML = `
      <section class="console-card">
        <div class="proc-stock-head">
          <h4>المخزون (${items.length})</h4>
          <button type="button" class="task-mini-btn" id="procAddItem">+ إضافة قطعة</button>
        </div>
        <input id="procStockSearch" type="search" placeholder="ابحث بالاسم أو الكود…" autocomplete="off">
        ${low.length ? `<p class="proc-low-note">⚠️ ${low.length} صنف تحت الحد الأدنى</p>` : ''}
        <div id="procStockList" class="proc-stock-list"></div>
      </section>`;

    const draw = function(filter) {
      const q = String(filter || '').toLowerCase().trim();
      const shown = items.filter(function(i) {
        return !q || i.name.toLowerCase().indexOf(q) >= 0 || i.code.toLowerCase().indexOf(q) >= 0;
      });
      const holder = body.querySelector('#procStockList');
      if (!shown.length) {
        holder.innerHTML = '<p class="console-empty">لا توجد أصناف. أضف أول قطعة.</p>';
        return;
      }
      holder.innerHTML = shown.map(function(i) {
        return `<button type="button" class="proc-stock-row${i.low ? ' is-low' : ''}" data-stock-code="${escapeHtml(i.code)}">
          <span class="proc-stock-main">
            <b>${escapeHtml(i.name)}</b>
            <small>${escapeHtml(i.code)}${i.category ? ' · ' + escapeHtml(i.category) : ''}${i.location ? ' · ' + escapeHtml(i.location) : ''}</small>
          </span>
          <span class="proc-stock-qty">
            <b>${i.quantity}</b>
            <small>الحد ${i.minimum}</small>
          </span>
        </button>`;
      }).join('');
      holder.querySelectorAll('[data-stock-code]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          const item = items.find(function(x) { return x.code === btn.dataset.stockCode; });
          if (item) openStockEditor(body, item);
        });
      });
    };

    draw('');
    body.querySelector('#procStockSearch').addEventListener('input', function(ev) { draw(ev.target.value); });
    body.querySelector('#procAddItem').addEventListener('click', function() { openStockEditor(body, null); });
  }

  function openStockEditor(body, item) {
    const isNew = !item;
    const holder = body.querySelector('#procStockList');
    const editor = document.createElement('div');
    editor.className = 'proc-editor';
    editor.innerHTML = `
      <div class="proc-editor-head">
        <b>${isNew ? 'قطعة جديدة' : 'تعديل: ' + escapeHtml(item.name)}</b>
        <button type="button" class="task-mini-btn" data-editor-close>إغلاق</button>
      </div>
      <label>اسم القطعة<input id="stkName" maxlength="120" value="${isNew ? '' : escapeHtml(item.name)}"></label>
      <div class="task-form-row">
        <label>الكود<input id="stkCode" maxlength="60" value="${isNew ? '' : escapeHtml(item.code)}" ${isNew ? 'placeholder="تلقائي"' : 'readonly'}></label>
        <label>الفئة<input id="stkCat" maxlength="60" value="${isNew ? '' : escapeHtml(item.category)}"></label>
      </div>
      <div class="task-form-row">
        <label>الكمية<input id="stkQty" type="number" min="0" max="100000" value="${isNew ? 0 : item.quantity}"></label>
        <label>الحد الأدنى<input id="stkMin" type="number" min="0" max="100000" value="${isNew ? 0 : item.minimum}"></label>
      </div>
      <div class="task-form-row">
        <label>سعر الشراء<input id="stkPrice" type="number" min="0" step="0.01" value="${isNew ? 0 : item.price}"></label>
        <label>الموقع<input id="stkLoc" maxlength="60" value="${isNew ? '' : escapeHtml(item.location)}"></label>
      </div>
      <label>المورد<input id="stkSup" maxlength="80" value="${isNew ? '' : escapeHtml(item.supplier)}"></label>
      <button type="button" class="primary-btn" id="stkSave">${isNew ? 'إضافة القطعة' : 'حفظ التعديل'}</button>`;

    holder.parentNode.insertBefore(editor, holder);

    editor.querySelector('[data-editor-close]').addEventListener('click', function() { editor.remove(); });
    editor.querySelector('#stkSave').addEventListener('click', async function() {
      const btn = this;
      btn.disabled = true;
      try {
        const res = await api('inventory_save', {
          code: editor.querySelector('#stkCode').value.trim(),
          name: editor.querySelector('#stkName').value.trim(),
          category: editor.querySelector('#stkCat').value.trim(),
          quantity: Number(editor.querySelector('#stkQty').value || 0),
          minimum: Number(editor.querySelector('#stkMin').value || 0),
          price: Number(editor.querySelector('#stkPrice').value || 0),
          location: editor.querySelector('#stkLoc').value.trim(),
          supplier: editor.querySelector('#stkSup').value.trim()
        });
        if (tg?.showAlert) tg.showAlert(res.created ? 'تمت إضافة القطعة للمخزون.' : 'تم تحديث بيانات القطعة.');
        renderProcurement(body.closest('.manager-module-content'), 'stock');
      } catch (e) {
        if (tg?.showAlert) tg.showAlert(e.message);
        btn.disabled = false;
      }
    });
  }


  /* ============================================================
   * FINANCE CENTER — four tabs
   *   الخصومات · المكافآت · مستحقات المهندسين · التقارير
   * ============================================================ */

  let financeState = { tab: 'deductions', data: null, month: '' };

  const FINANCE_TABS = [
    { key: 'deductions', label: 'الخصومات' },
    { key: 'rewards', label: 'المكافآت' },
    { key: 'dues', label: 'مستحقات المهندسين' },
    { key: 'reports', label: 'التقارير' }
  ];

  async function openFinanceCenter() {
    const panel = managerPanel('الإدارة المالية', '<div class="manager-loading">جاري تحميل البيانات المالية...</div>');
    const content = panel.querySelector('.manager-module-content');
    await renderFinanceCenter(content);
  }

  async function renderFinanceCenter(content) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل البيانات المالية...</div>';
    try {
      const data = await api('finance_center', { month: financeState.month || '' });
      financeState.data = data;
      financeState.month = data.month;
      drawFinanceCenter(content);
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  function drawFinanceCenter(content) {
    const d = financeState.data || {};
    const t = d.totals || {};
    const c = d.counts || {};

    content.innerHTML = `<div class="console">
      <div class="console-kpis">
        ${finKpi('خصومات معتمدة', formatMoney(t.deductionsApproved) + ' ج', c.approvedDeductions + ' سجل')}
        ${finKpi('خصومات معلقة', formatMoney(t.deductionsPending) + ' ج', c.pendingDeductions + ' بانتظار')}
        ${finKpi('مكافآت الشهر', formatMoney(t.bonuses) + ' ج', c.bonuses + ' مكافأة')}
        ${finKpi('الصافي', formatMoney(t.net) + ' ج', t.net >= 0 ? 'لصالح الفريق' : 'خصومات أعلى')}
      </div>

      <nav class="console-tabs">
        ${FINANCE_TABS.map(function(tab) {
          return `<button type="button" class="console-tab${financeState.tab === tab.key ? ' is-active' : ''}" data-fin-tab="${tab.key}">${escapeHtml(tab.label)}</button>`;
        }).join('')}
      </nav>

      <div id="finBody"></div>
    </div>`;

    content.querySelectorAll('[data-fin-tab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        financeState.tab = btn.dataset.finTab;
        drawFinanceCenter(content);
      });
    });

    const body = content.querySelector('#finBody');
    if (financeState.tab === 'deductions') drawFinDeductions(body, d, content);
    else if (financeState.tab === 'rewards') drawFinRewards(body, d, content);
    else if (financeState.tab === 'dues') drawFinDues(body, d);
    else drawFinReports(body, d);
  }

  function finKpi(label, value, sub) {
    return `<article class="console-kpi"><small>${escapeHtml(label)}</small><b>${escapeHtml(String(value))}</b><span>${escapeHtml(sub || '')}</span></article>`;
  }

  /* ---------------- Tab: deductions ---------------- */
  function drawFinDeductions(body, d, content) {
    const pending = d.pendingDeductions || [];
    const recent = d.recentDeductions || [];
    const t = d.totals || {};

    body.innerHTML = `
      <section class="console-card">
        <div class="fin-head">
          <h4>خصومات بانتظار الاعتماد (${pending.length})</h4>
          <button type="button" class="task-mini-btn" id="finAddDeduction">+ خصم جديد</button>
        </div>
        ${pending.length ? `<div class="tasks-list">
          ${pending.map(function(x) {
            return `<article class="task-row fin-row">
              <span class="task-row-main">
                <b>${escapeHtml(x.employeeName)} · ${escapeHtml(x.type)}</b>
                <small>${escapeHtml(x.reason)}</small>
                <small class="fin-meta">${escapeHtml(x.date)} · ${x.automatic ? 'تلقائي' : 'يدوي'}</small>
              </span>
              <span class="fin-amount">${formatMoney(x.amount)} ج</span>
              <span class="task-row-actions">
                <button type="button" class="task-mini-btn is-approve" data-ded-approve="${x.row}">اعتماد</button>
                <button type="button" class="task-mini-btn" data-ded-reject="${x.row}">رفض</button>
              </span>
            </article>`;
          }).join('')}
        </div>` : '<p class="console-empty">لا توجد خصومات بانتظار الاعتماد.</p>'}
      </section>

      <section class="console-card">
        <h4>خصومات الشهر (${recent.length})</h4>
        <div class="fin-split">
          <div class="fin-split-item"><small>تلقائية</small><b>${formatMoney(t.deductionsAutomatic)} ج</b></div>
          <div class="fin-split-item"><small>يدوية</small><b>${formatMoney(t.deductionsManual)} ج</b></div>
        </div>
        ${recent.length ? `<div class="tasks-list">
          ${recent.map(function(x) {
            return `<article class="task-row fin-row">
              <span class="task-row-main">
                <b>${escapeHtml(x.employeeName)} · ${escapeHtml(x.type)}</b>
                <small>${escapeHtml(x.reason)}</small>
                <small class="fin-meta">${escapeHtml(x.date)} · ${x.automatic ? 'تلقائي' : 'يدوي'}</small>
              </span>
              <span class="fin-amount">${formatMoney(x.amount)} ج</span>
              <span class="task-status ${x.status === 'معتمد' ? 'is-done' : x.status === 'مرفوض' ? 'is-cancelled' : 'is-review'}">${escapeHtml(x.status)}</span>
            </article>`;
          }).join('')}
        </div>` : '<p class="console-empty">لا توجد خصومات هذا الشهر.</p>'}
      </section>`;

    body.querySelector('#finAddDeduction').addEventListener('click', function() { openDeductionForm(content); });

    const decide = async function(row, decision) {
      try {
        await api('deduction_decide', { row: row, decision: decision });
        if (tg?.showAlert) tg.showAlert(decision === 'معتمد' ? 'تم اعتماد الخصم.' : 'تم رفض الخصم.');
        renderFinanceCenter(content);
      } catch (e) {
        if (tg?.showAlert) tg.showAlert(e.message);
      }
    };
    body.querySelectorAll('[data-ded-approve]').forEach(function(b) { b.addEventListener('click', function() { decide(Number(b.dataset.dedApprove), 'معتمد'); }); });
    body.querySelectorAll('[data-ded-reject]').forEach(function(b) { b.addEventListener('click', function() { decide(Number(b.dataset.dedReject), 'مرفوض'); }); });
  }

  function openDeductionForm(content) {
    const d = financeState.data || {};
    const employees = d.employees || [];
    const types = ['التأخير', 'عدم الالتزام باليونيفورم', 'عدم التسجيل على السيستم', 'نظافة المكان', 'خصم آخر'];

    const panel = managerPanel('خصم جديد', `<form id="finDeductionForm" class="manager-staff-form">
      <label>الموظف<select name="employeeId" required>
        <option value="">— اختر الموظف —</option>
        ${employees.map(function(e) { return `<option value="${escapeHtml(e.id)}">${escapeHtml(e.name)}${e.job ? ' — ' + escapeHtml(e.job) : ''}</option>`; }).join('')}
      </select></label>
      <label>نوع الخصم<select name="type">${types.map(function(t) { return `<option>${escapeHtml(t)}</option>`; }).join('')}</select></label>
      <label>المبلغ بالجنيه<input name="amount" type="number" min="1" max="1000000" step="0.01" required></label>
      <label>السبب<textarea name="reason" rows="3" maxlength="500" required placeholder="اشرح سبب الخصم..."></textarea></label>
      <button type="submit" class="primary-btn">تسجيل الخصم</button>
      <p id="finDedMsg" class="inline-message hidden"></p>
    </form>`);

    const form = panel.querySelector('#finDeductionForm');
    form.addEventListener('submit', async function(ev) {
      ev.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const msg = form.querySelector('#finDedMsg');
      btn.disabled = true;
      btn.textContent = 'جارٍ التسجيل...';
      try {
        const fd = new FormData(form);
        const res = await api('deduction_create', {
          employeeId: fd.get('employeeId'),
          type: fd.get('type'),
          amount: fd.get('amount'),
          reason: fd.get('reason'),
          // One key per submission: a double tap cannot create two rows.
          requestKey: 'ded-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
        });
        if (tg?.showAlert) tg.showAlert(res.duplicate ? 'هذا الخصم مسجل بالفعل.' : 'تم تسجيل الخصم وإرساله للمراجعة.');
        closeModal();
        renderFinanceCenter(content);
      } catch (e) {
        msg.textContent = e.message;
        msg.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'تسجيل الخصم';
      }
    });
  }

  /* ---------------- Tab: rewards ---------------- */
  function drawFinRewards(body, d, content) {
    const bonuses = d.recentBonuses || [];
    const c = d.counts || {};

    body.innerHTML = `
      <section class="console-card">
        <div class="fin-head">
          <h4>مكافآت الشهر (${bonuses.length})</h4>
          <button type="button" class="task-mini-btn" id="finAddBonus">+ مكافأة جديدة</button>
        </div>
        <div class="fin-split">
          <div class="fin-split-item"><small>تقييم نظافة — نظيف</small><b>${c.hygieneClean || 0}</b></div>
          <div class="fin-split-item"><small>تقييم نظافة — غير ملتزم</small><b>${c.hygieneNotClean || 0}</b></div>
        </div>
        ${bonuses.length ? `<div class="tasks-list">
          ${bonuses.map(function(x) {
            return `<article class="task-row fin-row">
              <span class="task-row-main">
                <b>${escapeHtml(x.employeeName)}</b>
                <small>${escapeHtml(x.reason)}</small>
                <small class="fin-meta">${escapeHtml(x.date)}</small>
              </span>
              <span class="fin-amount is-positive">${formatMoney(x.amount)} ج</span>
            </article>`;
          }).join('')}
        </div>` : '<p class="console-empty">لا توجد مكافآت هذا الشهر.</p>'}
      </section>

      <section class="console-card">
        <h4>تقييم النظافة</h4>
        <p class="console-empty">تقييم النظافة يُسجَّل من تبويب المتابعة اليومية، ويظهر أثره هنا وفي مستحقات المهندس.</p>
      </section>`;

    body.querySelector('#finAddBonus').addEventListener('click', function() { openBonusForm(content); });
  }

  function openBonusForm(content) {
    const d = financeState.data || {};
    const employees = d.employees || [];

    const panel = managerPanel('مكافأة جديدة', `<form id="finBonusForm" class="manager-staff-form">
      <label>الموظف<select name="employeeId" required>
        <option value="">— اختر الموظف —</option>
        ${employees.map(function(e) { return `<option value="${escapeHtml(e.id)}">${escapeHtml(e.name)}${e.job ? ' — ' + escapeHtml(e.job) : ''}</option>`; }).join('')}
      </select></label>
      <label>المبلغ بالجنيه<input name="amount" type="number" min="1" max="100000" step="0.01" required></label>
      <label>سبب المكافأة<textarea name="reason" rows="3" maxlength="250" required placeholder="اشرح سبب المكافأة..."></textarea></label>
      <button type="submit" class="primary-btn">تسجيل المكافأة</button>
      <p id="finBonusMsg" class="inline-message hidden"></p>
    </form>`);

    const form = panel.querySelector('#finBonusForm');
    form.addEventListener('submit', async function(ev) {
      ev.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const msg = form.querySelector('#finBonusMsg');
      btn.disabled = true;
      btn.textContent = 'جارٍ التسجيل...';
      try {
        const fd = new FormData(form);
        const res = await api('reward_bonus_create', {
          employeeId: fd.get('employeeId'),
          amount: fd.get('amount'),
          reason: fd.get('reason'),
          requestKey: 'bon-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
        });
        if (tg?.showAlert) tg.showAlert(res.duplicate ? 'هذه المكافأة مسجلة بالفعل.' : 'تم تسجيل المكافأة.');
        closeModal();
        renderFinanceCenter(content);
      } catch (e) {
        msg.textContent = e.message;
        msg.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'تسجيل المكافأة';
      }
    });
  }

  /* ---------------- Tab: employee dues ---------------- */
  function drawFinDues(body, d) {
    const rows = d.dues || [];
    body.innerHTML = `<section class="console-card">
      <h4>مستحقات المهندسين — ${escapeHtml(d.month || '')}</h4>
      ${rows.length ? `<div class="report-table">
        <div class="report-table-head">
          <span>الموظف</span><span>مكافآت</span><span>خصومات</span><span>معلقة</span><span>الصافي</span>
        </div>
        ${rows.map(function(r) {
          return `<div class="report-table-row">
            <span>${escapeHtml(r.name)}</span>
            <span>${formatMoney(r.bonuses)}</span>
            <span>${formatMoney(r.deductions)}</span>
            <span>${formatMoney(r.pendingDeductions)}</span>
            <span class="is-strong">${formatMoney(r.net)}</span>
          </div>`;
        }).join('')}
      </div>` : '<p class="console-empty">لا توجد حركات مالية هذا الشهر.</p>'}
      <p class="manager-note">الصافي = المكافآت − الخصومات المعتمدة. الخصومات المعلقة معروضة للمتابعة ولا تدخل في الصافي.</p>
    </section>`;
  }

  /* ---------------- Tab: reports ---------------- */
  function drawFinReports(body, d) {
    const t = d.totals || {};
    const c = d.counts || {};
    body.innerHTML = `<section class="console-card">
      <h4>ملخص مالي — ${escapeHtml(d.month || '')}</h4>
      <div class="report-totals">
        ${reportTotal('خصومات معتمدة', formatMoney(t.deductionsApproved), 'جنيه')}
        ${reportTotal('منها تلقائية', formatMoney(t.deductionsAutomatic), 'جنيه')}
        ${reportTotal('منها يدوية', formatMoney(t.deductionsManual), 'جنيه')}
        ${reportTotal('مكافآت', formatMoney(t.bonuses), 'جنيه')}
        ${reportTotal('الصافي', formatMoney(t.net), 'جنيه')}
      </div>
      <div class="fin-split">
        <div class="fin-split-item"><small>خصومات معلقة</small><b>${c.pendingDeductions || 0}</b></div>
        <div class="fin-split-item"><small>مكافآت مسجلة</small><b>${c.bonuses || 0}</b></div>
        <div class="fin-split-item"><small>تقييمات نظافة</small><b>${(c.hygieneClean || 0) + (c.hygieneNotClean || 0)}</b></div>
      </div>
      <p class="manager-note">نظام النقاط (٥٢ نقطة) مستقل تمامًا عن هذه الأرقام المالية ولا يتأثر بها.</p>
    </section>`;
  }


  /* ============================================================
   * EMPLOYEE HOME — personal summary + tidy sections
   * The technician sees their own state at a glance instead of
   * scrolling 22 tiles to find out what needs doing.
   * ============================================================ */

  async function renderEmployeeOverview() {
    const host = $('stats');
    if (!host) return;
    // The manager workspace hides #stats; the employee view must show it again.
    host.classList.remove('hidden');
    try {
      const d = await api('employee_overview');
      host.innerHTML = `
        <div class="emp-overview">
          <div class="emp-state">
            <span class="emp-state-dot ${d.attendance.state === 'حاضر الآن' ? 'is-in' : d.attendance.state === 'انتهى دوامك' ? 'is-done' : 'is-off'}"></span>
            <div>
              <b>${escapeHtml(d.attendance.state)}</b>
              <small>${d.attendance.checkinTime ? 'حضور ' + escapeHtml(d.attendance.checkinTime) : 'لم تسجل حضور اليوم'}</small>
            </div>
          </div>

          <div class="emp-quick">
            ${empQuick('مهام مفتوحة', d.tasks.open, d.tasks.overdue ? d.tasks.overdue + ' متأخرة' : '', 'tasks')}
            ${empQuick('طلبات معلقة', (d.requests.pending || 0) + (d.requests.pendingLeaves || 0), 'بانتظار القرار', 'requests')}
            ${empQuick('عهد مفتوحة', d.money.openCustody, 'تحتاج تسوية', 'settlement')}
            ${empQuick('قطع غيار', d.money.partsPending, 'بانتظار الموافقة', 'part-request')}
          </div>

          ${d.tasks.next && d.tasks.next.length ? `<div class="emp-next">
            <small>أقرب مهامك</small>
            ${d.tasks.next.map(function(t) {
              return `<button type="button" class="emp-next-row" data-go="tasks">
                <span>${escapeHtml(t.title)}</span>
                <b>${t.due ? escapeHtml(t.due) : ''}</b>
              </button>`;
            }).join('')}
          </div>` : ''}
        </div>`;

      host.querySelectorAll('[data-go]').forEach(function(btn) {
        btn.addEventListener('click', function() { openHomeAction(btn.dataset.go); });
      });
    } catch (e) {
      // Fall back to the simple counters if the overview fails.
      host.innerHTML = '';
    }
  }

  function empQuick(label, value, sub, go) {
    return `<button type="button" class="emp-quick-item" data-go="${escapeHtml(go)}">
      <b>${Number(value) || 0}</b>
      <span>${escapeHtml(label)}</span>
      ${sub ? `<small>${escapeHtml(sub)}</small>` : ''}
    </button>`;
  }


  /* ============================================================
   * QUALITY & DELIVERY — «الجودة والتسليم»
   * Quality review before handover, then a recorded delivery.
   * ============================================================ */

  async function openDeliveryPanel() {
    const panel = managerPanel('الجودة والتسليم', '<div class="manager-loading">جاري تحميل الأجهزة...</div>');
    const content = panel.querySelector('.manager-module-content');
    await renderDeliveryPanel(content);
  }

  async function renderDeliveryPanel(content) {
    content.innerHTML = '<div class="manager-loading">جاري تحميل الأجهزة...</div>';
    try {
      const data = await api('device_delivery_options');
      const c = data.counts || {};

      content.innerHTML = `<div class="console">
        <div class="console-kpis">
          ${finKpi('جاهزة للتسليم', c.ready, 'يمكن تسليمها الآن')}
          ${finKpi('بانتظار الجودة', c.awaitingQuality, 'تحتاج مراجعة')}
        </div>

        <nav class="console-tabs">
          <button type="button" class="console-tab is-active" data-del-tab="quality">مراجعة الجودة</button>
          <button type="button" class="console-tab" data-del-tab="deliver">التسليم</button>
        </nav>

        <div id="delBody"></div>
      </div>`;

      const body = content.querySelector('#delBody');
      const tabs = content.querySelectorAll('[data-del-tab]');

      const draw = function(key) {
        tabs.forEach(function(t) { t.classList.toggle('is-active', t.dataset.delTab === key); });
        if (key === 'quality') drawQualityTab(body, data, content);
        else drawDeliverTab(body, data, content);
      };

      tabs.forEach(function(t) {
        t.addEventListener('click', function() { draw(t.dataset.delTab); });
      });
      draw('quality');
    } catch (e) {
      content.innerHTML = `<div class="manager-load-error">${escapeHtml(e.message)}</div>`;
    }
  }

  /* ---------------- Quality review ---------------- */
  function drawQualityTab(body, data, content) {
    const list = data.awaitingQuality || [];

    body.innerHTML = `<section class="console-card">
      <h4>أجهزة بانتظار مراجعة الجودة (${list.length})</h4>
      ${list.length ? `<div class="tasks-list">
        ${list.map(function(d) {
          return `<article class="task-row fin-row">
            <span class="task-row-main">
              <b>${escapeHtml(d.deviceName || d.orderId)}</b>
              <small>${escapeHtml(d.orderId)} · ${escapeHtml(d.technician)}</small>
            </span>
            <span class="task-status ${d.status === 'يحتاج إعادة فحص' ? 'is-review' : 'is-progress'}">${escapeHtml(d.status)}</span>
            <span class="task-row-actions">
              <button type="button" class="task-mini-btn is-approve" data-qc-pass="${escapeHtml(d.orderId)}">اجتاز</button>
              <button type="button" class="task-mini-btn" data-qc-fail="${escapeHtml(d.orderId)}">إعادة فحص</button>
            </span>
          </article>`;
        }).join('')}
      </div>` : '<p class="console-empty">لا توجد أجهزة بانتظار المراجعة.</p>'}
      <p class="manager-note">لا يمكن تسليم أي جهاز قبل اجتيازه مراجعة الجودة.</p>
    </section>`;

    const review = async function(orderId, passed) {
      let note = '';
      if (!passed) {
        note = window.prompt('سبب إعادة الفحص؟') || '';
        if (note.trim().length < 3) return;
      }
      try {
        await api('device_quality_review', { orderId: orderId, passed: passed, note: note });
        if (tg?.showAlert) tg.showAlert(passed ? 'الجهاز جاهز للتسليم.' : 'أُعيد الجهاز للفحص.');
        renderDeliveryPanel(content);
      } catch (e) {
        if (tg?.showAlert) tg.showAlert(e.message);
      }
    };

    body.querySelectorAll('[data-qc-pass]').forEach(function(b) {
      b.addEventListener('click', function() { review(b.dataset.qcPass, true); });
    });
    body.querySelectorAll('[data-qc-fail]').forEach(function(b) {
      b.addEventListener('click', function() { review(b.dataset.qcFail, false); });
    });
  }

  /* ---------------- Delivery ---------------- */
  function drawDeliverTab(body, data, content) {
    const list = data.ready || [];

    body.innerHTML = `<section class="console-card">
      <h4>أجهزة جاهزة للتسليم (${list.length})</h4>
      ${list.length ? `<div class="tasks-list">
        ${list.map(function(d) {
          return `<article class="task-row fin-row">
            <span class="task-row-main">
              <b>${escapeHtml(d.deviceName || d.orderId)}</b>
              <small>${escapeHtml(d.orderId)} · ${escapeHtml(d.customerName || 'بدون عميل')}</small>
              <small class="fin-meta">تقديري ${formatMoney(d.estimate)} ج · عربون ${formatMoney(d.deposit)} ج</small>
            </span>
            <span class="task-row-actions">
              <button type="button" class="task-mini-btn is-approve" data-deliver="${escapeHtml(d.orderId)}">تسليم</button>
            </span>
          </article>`;
        }).join('')}
      </div>` : '<p class="console-empty">لا توجد أجهزة جاهزة للتسليم. أكمل مراجعة الجودة أولًا.</p>'}
    </section>`;

    body.querySelectorAll('[data-deliver]').forEach(function(b) {
      b.addEventListener('click', function() {
        const item = list.find(function(x) { return x.orderId === b.dataset.deliver; });
        if (item) openDeliveryForm(content, item, data);
      });
    });
  }

  function openDeliveryForm(content, item, options) {
    const methods = options.paymentMethods || ['نقدي'];
    const warranties = options.warrantyOptions || ['بدون ضمان'];

    const panel = managerPanel('تسليم جهاز', `<form id="deliveryForm" class="manager-staff-form">
      <div class="inspection-form-meta">
        <b>${escapeHtml(item.orderId)}</b>
        <span>${escapeHtml(item.deviceName)} · ${escapeHtml(item.customerName || '')}</span>
        <small>تقديري ${formatMoney(item.estimate)} ج · عربون ${formatMoney(item.deposit)} ج</small>
      </div>

      <label>اسم المستلم *<input name="recipient" maxlength="80" required value="${escapeHtml(item.customerName || '')}"></label>
      <label>رقم الهاتف<input name="phone" maxlength="20" inputmode="numeric" value="${escapeHtml(item.customerPhone || '')}"></label>
      <label>صلة القرابة<input name="relation" maxlength="60" placeholder="العميل نفسه / أخ / زوجة…"></label>

      <div class="task-form-row">
        <label>المبلغ المحصل<input name="amount" type="number" min="0" step="0.01" value="${Math.max(0, (Number(item.estimate) || 0) - (Number(item.deposit) || 0))}"></label>
        <label>طريقة الدفع<select name="method">${methods.map(function(m) { return `<option>${escapeHtml(m)}</option>`; }).join('')}</select></label>
      </div>

      <div class="task-form-row">
        <label>الضمان<select name="warranty">${warranties.map(function(w) { return `<option>${escapeHtml(w)}</option>`; }).join('')}</select></label>
        <label>مدة الضمان (أيام)<input name="warrantyDays" type="number" min="0" max="3650" value="0"></label>
      </div>

      <label>رقم الإيصال<input name="receipt" maxlength="60" placeholder="اختياري"></label>
      <label>ملاحظات<textarea name="note" rows="2" maxlength="500" placeholder="اختياري"></textarea></label>

      <label class="task-pick-all" style="display:flex;gap:8px;align-items:center">
        <input type="checkbox" name="checkedInFront" value="1" required>
        <span>تم فحص الجهاز أمام العميل</span>
      </label>

      <button type="submit" class="primary-btn">تأكيد التسليم</button>
      <p id="deliveryMsg" class="inline-message hidden"></p>
    </form>`);

    const form = panel.querySelector('#deliveryForm');
    form.addEventListener('submit', async function(ev) {
      ev.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const msg = form.querySelector('#deliveryMsg');
      btn.disabled = true;
      btn.textContent = 'جارٍ التسليم...';
      try {
        const fd = new FormData(form);
        const res = await api('device_deliver', {
          orderId: item.orderId,
          recipient: fd.get('recipient'),
          phone: fd.get('phone'),
          relation: fd.get('relation'),
          amount: fd.get('amount'),
          method: fd.get('method'),
          warranty: fd.get('warranty'),
          warrantyDays: fd.get('warrantyDays'),
          receipt: fd.get('receipt'),
          note: fd.get('note'),
          checkedInFront: fd.get('checkedInFront') === '1'
        });
        if (tg?.showAlert) tg.showAlert('تم تسليم الجهاز لـ ' + res.recipient);
        closeModal();
        renderDeliveryPanel(content);
      } catch (e) {
        msg.textContent = e.message;
        msg.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'تأكيد التسليم';
      }
    });
  }


  $('workspaceSwitch').addEventListener('click', switchWorkspace);
  $('refreshManagerDashboard').addEventListener('click',loadManagerDashboard);
  document.querySelectorAll('[data-manager-module]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-manager-module]').forEach(item=>item.classList.toggle('is-current', item===btn));
    openManagerModule(btn.dataset.managerModule);
  }));
  $('modalClose').addEventListener('click',closeModal);
  $('appModal').querySelectorAll('[data-modal-close]').forEach(el=>el.addEventListener('click',closeModal));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('appModal').classList.contains('hidden'))closeModal();});

  $('newLeaveTab').addEventListener('click',()=>openRequestForm('leave'));
  $('newCashTab').addEventListener('click',()=>openRequestForm('cash'));
  $('myRequestsTab').addEventListener('click',()=>{
    $('requestCenter').classList.remove('hidden');
    $('leaveForm').classList.add('hidden');$('cashForm').classList.add('hidden');
    $('newLeaveTab').classList.remove('active');$('newCashTab').classList.remove('active');
    $('myRequestsTab').classList.add('active');$('requestMessage').classList.add('hidden');
    showRequestPicker();
  });
  $('submitCash').addEventListener('click',submitCash);
  $('submitWithdraw').addEventListener('click',submitWithdraw);
  $('submitDeviceRegister').addEventListener('click',submitDeviceRegistration);
  document.querySelectorAll('[data-request-entity]').forEach(b=>b.addEventListener('click',()=>showList(b.dataset.requestEntity)));
  document.querySelectorAll('[data-home-action]').forEach(b=>b.addEventListener('click',()=>openHomeAction(b.dataset.homeAction)));
  $('myFinanceTab').addEventListener('click',()=>{$('financeCenter').classList.remove('hidden');loadFinanceSummary();});
  $('deductionAdminTab').addEventListener('click',async()=>{switchFinance('deductions');try{await loadFinanceEmployees();await loadPendingDeductions();}catch(e){financeMessage(e.message,true);}});
  $('rewardAdminTab').addEventListener('click',async()=>{switchFinance('rewards');try{await loadFinanceEmployees();}catch(e){financeMessage(e.message,true);}});
  $('submitDeduction').addEventListener('click',submitDeduction);
  $('saveHygiene').addEventListener('click',saveHygiene);
  $('submitBonus').addEventListener('click',submitBonus);
  $('hygieneDate').value=new Date().toISOString().slice(0,10);
  $('submitComplaint').addEventListener('click',submitComplaint);
  $('complaintsTab').addEventListener('click',()=>openRequestForm('complaint'));
  $('complaintHistoryTab').addEventListener('click',()=>{ $('requestCenter').classList.remove('hidden');$('requestPicker').classList.add('hidden'); $('complaintForm').classList.add('hidden'); showList('complaints'); });
  $('leaveType').addEventListener('change',syncLeaveFields);
  $('submitLeave').addEventListener('click',submitLeave);
  $('refreshReviews').addEventListener('click',loadReviews);
  $('refreshCashReviews').addEventListener('click',loadCashReviews);
  $('checkinBtn').addEventListener('click', () => withLocation('attendance_checkin', $('checkinBtn')));
  $('checkoutBtn').addEventListener('click', () => withLocation('attendance_checkout', $('checkoutBtn')));
  $('requestOvertimeBtn').addEventListener('click', async () => {
    const btn=$('requestOvertimeBtn'); btn.disabled=true; btn.textContent='جارٍ إرسال الطلب...';
    try { const result=await api('overtime_request'); if(tg?.showAlert)tg.showAlert(result.message||'تم إرسال الطلب.'); await refreshAttendance(); }
    catch(e){ if(tg?.showAlert)tg.showAlert(e.message); else showAttendanceMessage(e.message,true); }
    finally { btn.disabled=false; btn.textContent='طلب موافقة أوفر تايم'; }
  });
  $('historyBtn').addEventListener('click', showAttendanceHistory);
  document.querySelectorAll('[data-uniform]').forEach(btn => btn.addEventListener('click', () => confirmUniform(btn.dataset.uniform)));
  document.querySelectorAll('[data-entity]').forEach(btn => btn.addEventListener('click', () => showList(btn.dataset.entity)));
  $('backBtn').addEventListener('click', () => { const title=$('resultTitle').textContent; $('results').classList.add('hidden'); if(['الطلبات العامة','طلبات الأذونات','السلف والعهد'].includes(title)) showRequestPicker(); else closeModal(); });
  // Exposed for automated UI previews; never used by app logic.
  window.__mhConsole = { render: renderConsoleInto, setTab: function(t){ consoleState.tab = t; }, taskForm: renderTaskCreateForm, taskAdmin: openTaskAdminPanel, procurement: openProcurementPanel, finance: openFinanceCenter, delivery: openDeliveryPanel };
  initTheme();
  start();
})();
