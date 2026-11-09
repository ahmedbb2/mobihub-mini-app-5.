(() => {
  'use strict';
  const tg = window.Telegram?.WebApp;
  const API_URL = 'https://mobihub-telegram-proxy-v2.ahmedmtarek20.workers.dev/';
  const $ = (id) => document.getElementById(id);
  const titles = { requests: 'الطلبات العامة', leaves: 'طلبات الأذونات', complaints: 'شكاوي', cash: 'السلف والعهد', deductions: 'خصوماتي', devices: 'حالة الأجهزة', attendance: 'سجل الحضور والانصراف' };
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
    OUTSIDE_ALLOWED_GEOFENCE: 'أنت خارج نطاق موقع العمل المسموح. اقترب من المركز وحاول مرة أخرى.',
    GPS_ACCURACY_NOT_ACCEPTED: 'دقة تحديد الموقع غير كافية. حاول في مكان مفتوح ثم أعد المحاولة.',
    INVALID_GPS_COORDINATES: 'تعذر قراءة موقعك بشكل صحيح. فعّل خدمات الموقع وحاول مرة أخرى.',
    DEVICE_NOT_FOUND: 'الجهاز أو رقم الطلب غير موجود.',
    INVALID_INSPECTION_TYPE: 'نوع الجهاز غير صحيح. ارجع واختر نوع الجهاز مرة أخرى.',
    INVALID_INSPECTION_ITEMS: 'بيانات الاختبارات غير صحيحة. راجع النتائج وحاول الحفظ مرة أخرى.',
    INVALID_INSPECTION_RESULT: 'نتيجة أحد الاختبارات غير صحيحة. اختر سليم أو مشكلة أو لم يختبر.',
    FORBIDDEN: 'ليس لديك صلاحية للوصول إلى هذا الجهاز أو تنفيذ هذا الإجراء.',
    INTERNAL_ERROR: 'حدث خطأ أثناء تنفيذ الطلب. حاول مرة أخرى، وإذا تكرر أبلغ المسؤول.',
    GPS_ACCURACY_NOT_ACCEPTED: 'دقة الموقع الحالية غير كافية. حاول من مكان مفتوح وأعد المحاولة.',
    NO_ACTIVE_SHIFT_ASSIGNED: 'لا توجد وردية نشطة مسجلة لك اليوم. راجع المسؤول.',
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
    NO_ACTIVE_SHIFT_ASSIGNED: 'لا توجد وردية نشطة لك في هذا التاريخ.', LEAVE_OUTSIDE_SHIFT: 'وقت أو مدة الإذن خارج حدود ورديتك.',
    LEAVE_START_NOT_FUTURE: 'بداية الإذن يجب أن تكون في وقت قادم.', FULL_DAY_LEAVE_AFTER_SHIFT_START: 'لا يمكن طلب إذن يوم كامل بعد بداية الوردية.',
    LEAVE_CONFLICT_CONFIRMED_ABSENCE: 'لا يمكن اعتماد الإذن بعد تأكيد الغياب لهذا التاريخ.', REQUEST_ALREADY_REVIEWED: 'تمت مراجعة الطلب بالفعل.', LEAVE_ALREADY_REVIEWED: 'تمت مراجعة الإذن بالفعل.', INVALID_REQUEST_TYPE: 'نوع الطلب غير صحيح.', INVALID_LEAVE_TYPE: 'نوع الإذن غير صحيح.', INVALID_LEAVE_DAYS: 'عدد الأيام غير متاح.', INVALID_LEAVE_HOURS: 'مدة الإذن غير متاحة.', INVALID_LEAVE_TIME: 'وقت الإذن غير صحيح.', REQUEST_NOT_FOUND: 'الطلب غير موجود.', LEAVE_NOT_FOUND: 'طلب الإذن غير موجود.', INVALID_DECISION: 'القرار أو رقم السجل غير صحيح.', INVALID_CASH_AMOUNT: '⚠️ المبلغ غير صحيح. اكتب مبلغًا موجبًا بالجنيه، مثال: 750.', INVALID_CASH_PURPOSE: 'اكتب الغرض بشكل أوضح، أو اضغط إلغاء.', CASH_ALREADY_REVIEWED: 'تمت مراجعة طلب السلفة بالفعل.', CASH_PAYOUT_NOT_ALLOWED: 'لا يمكن تسجيل الصرف قبل الموافقة أو تم تسجيل الصرف بالفعل.', CASH_REQUEST_NOT_FOUND: 'طلب السلفة غير موجود.', OPEN_CASH_CUSTODY: 'لا يمكن تسجيل الانصراف قبل إغلاق العهدة المفتوحة وتسوية المبلغ المتبقي.', SHEET_SCHEMA_MISMATCH: 'أعمدة الشيت لا تطابق النسخة المطلوبة. أوقف الاختبار وراجع الأعمدة.',
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
    INVALID_DEDUCTION: 'راجع نوع الخصم والسبب والمبلغ.',
    INVALID_DECISION: 'قرار المراجعة غير صحيح.',
    DEDUCTION_NOT_FOUND: 'الخصم غير موجود.',
    DEDUCTION_ALREADY_REVIEWED: 'تمت مراجعة الخصم بالفعل.',
    INVALID_REWARD_REASON: 'اكتب سبب المكافأة من 3 إلى 250 حرفًا.',
    INVALID_HYGIENE_RATING: 'بيانات تقييم النظافة غير صحيحة.',
    HYGIENE_ALREADY_RATED: 'تم تسجيل تقييم النظافة لهذا المهندس في هذا اليوم بالفعل.',
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
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ initData, workspaceRole, action, ...extra })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      const code = result.error || 'تعذر تنفيذ الطلب';
      const geofence = /^OUTSIDE_ALLOWED_GEOFENCE(?::(\d+))?$/.exec(code);
      const friendly = geofence
        ? `أنت خارج نطاق موقع العمل المسموح. المسافة الحالية ${geofence[1] || 'غير محددة'} متر، والمسموح 50 متر. اقترب من المركز وحاول مرة أخرى.`
        : (errorMessages[code] || (code === 'INTERNAL_ERROR'
          ? 'حدث خطأ أثناء تنفيذ الطلب. حاول مرة أخرى، وإذا تكرر أبلغ المسؤول.'
          : code));
      const err = new Error(friendly);
      err.code = code;
      err.requestId = result.requestId;
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
    $('attendanceStateText').textContent = open ? `وقت الحضور: ${data.openAttendance?.time || '—'}` : 'تأكد من تفعيل الموقع قبل تسجيل الحضور أو الانصراف.';
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
        showAttendanceMessage(`تم تسجيل الانصراف بنجاح · ${result.time || ''} · المسافة ${result.distanceMeters} متر.${otNote}`);
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
      $('stats').classList.add('hidden');
      $('attendance').classList.add('hidden');
    }
    if (isManager) {
      // The manager dashboard is the only default landing surface. Operational
      // panels open on demand in the modal sheet, never below the dashboard.
      nav.innerHTML = '';
      nav.classList.add('hidden');
    }
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
    const roleNames = { employee: 'مهندس', supervisor: 'مشرف', admin: 'مدير', finance: 'مالية', super_admin: 'مدير النظام' };
    $('userRole').textContent = roleNames[currentRole] || currentRole;
    $('workspaceSwitch').classList.toggle('hidden', !(availableWorkspaces.includes('employee') && availableWorkspaces.includes('manager')));
    $('workspaceSwitch').textContent = workspaceRole === 'manager' ? 'لوحة المهندس' : 'لوحة المدير';
    $('workspaceSwitch').setAttribute('aria-label', workspaceRole === 'manager' ? 'التحويل إلى لوحة المهندس' : 'التحويل إلى لوحة المدير');

    renderStats(data.summary || {});
    buildWorkspace(currentRole, data.permissions || {});
    // Manager panels stay hidden on the landing page and are moved into a modal only when opened.
    if (workspaceRole === 'manager') {
      if (data.managerDashboard) renderManagerDashboard(data.managerDashboard);
      else loadManagerDashboard();
    }
  }

  const managerModuleTitles = {
    daily:'المتابعة اليومية', staff:'شؤون المهندسين', shifts:'إدارة الورديات', requests:'طلبات المهندسين والتواصل',
    finance:'الإدارة المالية', overtime:'الأوفر تايم', devices:'الأجهزة والصيانة', system:'التقارير والنظام', notifications:'مركز الإشعارات', managers:'إدارة المديرين'
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
  async function loadManagerDashboard() {
    if (workspaceRole !== 'manager') return;
    const box=$('managerMetrics'); if(box) box.innerHTML='<div class="manager-loading">جاري تحديث مؤشرات الإدارة...</div>';
    try { const data=await api('manager_dashboard'); renderManagerDashboard(data); }
    catch(e) { if(box) box.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`; }
  }
  function managerPanel(title, html) {
    const panel=document.createElement('section'); panel.className='manager-module-panel';
    panel.innerHTML=`<div class="manager-module-heading"><div><small>${workspaceRole==='manager'?'MOBIHUB MANAGEMENT':'MOBIHUB WORKSPACE'}</small><h3>${escapeHtml(title)}</h3></div><button type="button" class="modal-close" data-manager-panel-close aria-label="إغلاق">×</button></div><div class="manager-module-content">${html}</div>`;
    panel.querySelector('[data-manager-panel-close]').addEventListener('click',closeModal);
    document.body.appendChild(panel); openModal(title,panel); return panel;
  }
  async function openManagerModule(module) {
    const permitted=managerDashboardCache?.modules?.[module];
    if(!permitted) { if(tg?.showAlert) tg.showAlert('هذه الخدمة غير متاحة حسب صلاحية حسابك.'); return; }
    const title=managerModuleTitles[module] || 'الإدارة';
    if(module==='requests') {
      const panel=managerPanel(title,'<button type="button" class="manager-action-card" id="managerOpenPendingRequests"><b>مراجعة الطلبات والأذونات</b><small>مراجعة الطلبات المقدمة من المهندسين</small></button><button type="button" class="manager-action-card" id="managerOpenComplaints"><b>شكاوى المهندسين</b><small>فتح الشكاوى ومتابعة الردود والحالات</small></button>');
      panel.querySelector('#managerOpenPendingRequests').addEventListener('click',async()=>{closeModal();openModal('مراجعة الطلبات والأذونات',$('reviewCenter'));await loadReviews();});
      panel.querySelector('#managerOpenComplaints').addEventListener('click',()=>{closeModal();showList('complaints');});
      return;
    }
    if(module==='finance') {
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
        content.innerHTML=`${sendForm}<h4>إعدادات التنبيه</h4>${settings.map(r=>{const enabled=String(r['القيمة']||'').toUpperCase()==='TRUE';return `<article class="manager-row"><div><b>${escapeHtml(r['الإعداد']||'')}</b><small>${escapeHtml(r['الوصف']||'')}</small></div>${canManageNotifications?`<label class="manager-switch"><input type="checkbox" data-notification-setting="${escapeHtml(r['الإعداد'])}" ${enabled?'checked':''}><span>${enabled?'مفعل':'متوقف'}</span></label>`:`<span class="status-pill">${enabled?'مفعل':'متوقف'}</span>`}</article>`;}).join('')||'<p class="muted">لا توجد إعدادات مسجلة.</p>'}<h4>سجل الإشعارات — آخر 30</h4>${logs.slice(-30).reverse().map(r=>`<article class="manager-row"><b>${escapeHtml(r['نوع الإشعار']||'إشعار')}</b><span class="status-pill">${escapeHtml(r['الحالة']||'')}</span><small>${escapeHtml(r['المستلم']||'')} · ${escapeHtml(r['التاريخ والوقت']||'')}</small></article>`).join('')||'<p class="muted">لا توجد سجلات إشعارات.</p>'}`;
        if(canManageNotifications) {
          content.querySelector('#managerNoticeForm').addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget,btn=form.querySelector('button[type=submit]'),result=form.querySelector('#managerNoticeResult');btn.disabled=true;result.classList.add('hidden');try{const fd=new FormData(form);const res=await api('notification_send',{recipient:fd.get('recipient'),message:fd.get('message')});result.textContent=`تم الإرسال إلى ${res.sent} مهندس، وتعذر الإرسال إلى ${res.failed}.`;result.classList.remove('hidden');form.elements.message.value='';}catch(e){result.textContent=e.message;result.classList.remove('hidden');}finally{btn.disabled=false;}});
          content.querySelectorAll('[data-notification-setting]').forEach(input=>input.addEventListener('change',async()=>{input.disabled=true;try{await api('notification_setting',{key:input.dataset.notificationSetting,enabled:input.checked});input.nextElementSibling.textContent=input.checked?'مفعل':'متوقف';}catch(e){input.checked=!input.checked;if(tg?.showAlert)tg.showAlert(e.message);}finally{input.disabled=false;}}));
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
        const day=dash.date; const today=rows.filter(r=>String(r['التاريخ']||'').slice(0,10)===day).reverse();
        const latest={}; today.forEach(r=>{const id=String(r['Chat ID']||'');if(id&&!latest[id])latest[id]=r;});
        const records=Object.values(latest);
        const canReviewAbsence=['super_admin','admin','supervisor'].includes(currentRole);
        content.innerHTML=`<div class="manager-mini-kpis"><div><b>${records.filter(r=>String(r['النوع'])==='حضور').length}</b><small>حضور مفتوح حسب آخر حركة</small></div><div><b>${absences.filter(r=>/انتظار|مراجعة|معلق/.test(String(r['الحالة']||r['قرار المدير']||''))).length}</b><small>حالات غياب للمراجعة</small></div><div><b>${overtimeRows.filter(r=>String(r['الحالة']||'')==='بانتظار موافقة المدير').length}</b><small>طلبات أوفر تايم معلقة</small></div></div><h4>حركات اليوم</h4>${records.length?records.map(r=>`<article class="manager-row"><b>${escapeHtml(r['اسم الموظف']||'مهندس')}</b><span>${escapeHtml(r['النوع']||'')}</span><small>${escapeHtml(r['الوقت']||'')} · ${escapeHtml(r['حالة الحضور']||'')}</small></article>`).join(''):'<p class="muted">لا توجد حركات حضور مسجلة اليوم.</p>'}<h4>مراجعة الغياب</h4>${absences.slice(-20).reverse().map(r=>{const pending=String(r['الحالة']||'').trim()==='بانتظار مراجعة المدير';return `<article class="manager-row"><b>${escapeHtml(r['اسم الموظف']||'مهندس')}</b><span>${escapeHtml(r['الحالة']||r['قرار المدير']||'غير محدد')}</span><small>${escapeHtml(r['التاريخ']||'')} · موعد الحضور: ${escapeHtml(r['موعد الحضور']||'—')} · اكتشاف: ${escapeHtml(r['وقت اكتشاف الحالة']||'—')}</small>${pending&&canReviewAbsence?`<div class="manager-row-actions"><button type="button" class="primary-btn" data-absence-decision="confirm" data-absence-chat="${escapeHtml(r['Chat ID']||'')}" data-absence-date="${escapeHtml(String(r['التاريخ']||'').slice(0,10))}">تأكيد الغياب</button><button type="button" class="secondary-btn" data-absence-decision="excuse" data-absence-chat="${escapeHtml(r['Chat ID']||'')}" data-absence-date="${escapeHtml(String(r['التاريخ']||'').slice(0,10))}">ليس غائبًا</button></div>`:''}</article>`;}).join('')||'<p class="muted">لا توجد سجلات غياب.</p>'}<h4>آخر طلبات الأوفر تايم</h4>${overtimeRows.slice(-10).reverse().map(r=>`<article class="manager-row"><b>${escapeHtml(r['اسم المهندس']||'مهندس')}</b><span>${escapeHtml(r['الحالة']||'')}</span><small>${escapeHtml(r['تاريخ الوردية']||'')} · ${Number(r['دقائق الأوفر تايم'])||0} دقيقة · ${Number(r['المبلغ بالجنيه'])||0} جنيه</small></article>`).join('')||'<p class="muted">لا توجد طلبات أوفر تايم.</p>'}`;
        content.querySelectorAll('[data-absence-decision]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;try{await api('absence_decide',{chatId:btn.dataset.absenceChat,date:btn.dataset.absenceDate,decision:btn.dataset.absenceDecision});if(tg?.showAlert)tg.showAlert(btn.dataset.absenceDecision==='confirm'?'تم تأكيد الغياب وإبلاغ الموظف.':'تم تسجيل القرار: ليس غائبًا.');closeModal();await loadManagerDashboard();openManagerModule('daily');}catch(e){if(tg?.showAlert)tg.showAlert(e.message);btn.disabled=false;}}));
      } else if(module==='shifts') {
        const renderShifts = async () => {
          const [shifts,assignments] = await Promise.all([api('list',{entity:'shifts'}),api('list',{entity:'assignments'})]);
          const today = managerDashboardCache?.date || new Date().toISOString().slice(0,10);
          const activeCount = id => assignments.filter(a => String(a['Shift ID']||'').trim()===id && String(a['الحالة']||'نشط').trim()==='نشط' && (!String(a['تاريخ النهاية']||'').trim() || String(a['تاريخ النهاية']).slice(0,10)>=today)).length;
          content.innerHTML = `<button type="button" class="primary-btn" id="managerAddShift">＋ إضافة وردية</button><p class="manager-note">إدارة الورديات الثابتة والمرنة. لا يمكن إيقاف وردية مرتبطة بتعيينات سارية أو مستقبلية.</p><div class="manager-list-head"><b>${shifts.length} وردية مسجلة</b></div>${shifts.map(r=>{const id=String(r['Shift ID']||'');const active=String(r['الحالة']||'نشط').trim()==='نشط';const flex=id==='FLEX_NO_FIXED_TIME'||(!String(r['موعد الحضور']||'').trim()&&!String(r['موعد الانصراف']||'').trim());return `<article class="manager-row"><div><b>${escapeHtml(r['اسم الوردية']||id)}</b><small>المعرّف: ${escapeHtml(id)}<br>${flex?'بدون موعد ثابت':`${escapeHtml(r['موعد الحضور']||'—')} إلى ${escapeHtml(r['موعد الانصراف']||'—')}`} · سماح ${Number(r['فترة السماح بالدقائق'])||0} دقيقة<br>التعيينات النشطة: ${activeCount(id)}</small></div><span class="status-pill">${active?'نشط':'غير نشط'}</span><div class="manager-row-actions"><button type="button" class="secondary-btn" data-shift-edit="${escapeHtml(id)}">تعديل</button><button type="button" class="secondary-btn" data-shift-toggle="${escapeHtml(id)}" data-next-status="${active?'غير نشط':'نشط'}">${active?'إيقاف':'تفعيل'}</button></div></article>`;}).join('')||'<p class="muted">لا توجد ورديات مسجلة بعد.</p>'}`;
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

        content.querySelectorAll('[data-device-inspection]').forEach(btn=>btn.addEventListener('click',()=>{
          const r=rows[Number(btn.dataset.deviceInspection)];
          openEmployeeDeviceInspection(r,content);
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
      html=`<form id="managerStaffForm" class="manager-staff-form"><label>الوردية<select name="shiftId" required>${activeShifts.map(x=>`<option value="${escapeHtml(x['Shift ID'])}">${escapeHtml(x['اسم الوردية']||x['Shift ID'])} · ${escapeHtml(x['موعد الحضور']||'مرن')} - ${escapeHtml(x['موعد الانصراف']||'')}</option>`).join('')}</select></label><label>تاريخ البداية<input name="startDate" type="date" value="${escapeHtml(managerDashboardCache?.date || new Date().toISOString().slice(0,10))}" required></label><label>تاريخ النهاية (اختياري)<input name="endDate" type="date"></label><fieldset class="manager-workdays"><legend>أيام العمل</legend><div>${dayOptions.map(([v,n])=>`<label><input type="checkbox" name="workDays" value="${v}" ${v!=='5'?'checked':''}> ${n}</label>`).join('')}</div><small>الوردية الثابتة لا تُسند يوم الجمعة. الوردية المرنة يمكن إسنادها لأي يوم.</small></fieldset><button class="primary-btn" type="submit">حفظ تعيين الوردية</button></form>`;
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
      $('connection').textContent = 'متصل'; $('connection').style.color = '#8be0aa';

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
        $('resultBody').innerHTML=rows.map(row=>`<article class="record complaint-card"><strong>${escapeHtml(row['رقم الشكوى']||'شكوى')} · ${escapeHtml(row['نوع الشكوى']||'')}</strong><small class="record-meta">${escapeHtml(row['الحالة']||'جديدة')} · ${escapeHtml(row['التاريخ والوقت']||'')}</small><p>${escapeHtml(row['تفاصيل الشكوى']||'')}</p><button class="secondary-btn" data-open-complaint="${escapeHtml(row['رقم الشكوى']||'')}">فتح المحادثة</button></article>`).join('');
        $('resultBody').querySelectorAll('[data-open-complaint]').forEach(b=>b.addEventListener('click',()=>openComplaint(b.dataset.openComplaint)));
        return;
      }
      $('resultBody').innerHTML = rows.map(row => {
        const title = row['رقم الطلب'] || row['رقم الخصم'] || row['رقم الشكوى'] || row['نوع الطلب'] || row['نوع الإذن'] || row['اسم الجهاز'] || 'سجل';
        const status = row['حالة العهدة'] || row['حالة التسوية'] || row['حالة الصرف'] || row['الحالة'] || row['القرار'] || 'قيد المراجعة';
        const date = row['التاريخ والوقت'] || row['تاريخ الإرسال'] || row['تاريخ الواقعة'] || row['تاريخ الإذن'] || row['تاريخ الاستلام'] || '';
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
    if(action==='devices'){await openEmployeeDevices();return;}
    if(action==='inspection'){await openStandaloneDeviceInspection();return;}
    if(action==='repair-prices'){await openRepairPriceBook();return;}
    if(action==='device-register'){openDeviceRegistration();return;}
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
      renderStats(data.summary||{});
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
      content.querySelectorAll('[data-my-device-inspect]').forEach(btn=>btn.addEventListener('click',()=>openEmployeeDeviceInspection(rows[Number(btn.dataset.myDeviceInspect)],content)));
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

  async function openStandaloneDeviceInspection(){
    const panel=managerPanel('فحص الجهاز','<div class="manager-loading">جاري تحميل قوائم فحص الأجهزة...</div>');
    const content=panel.querySelector('.manager-module-content');
    try{
      const catalog=await api('device_inspection_catalog');
      renderInspectionTypePicker(content,{orderId:'',deviceName:'فحص مستقل'},catalog,null);
    }catch(e){content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`;}
  }

  async function openEmployeeDeviceInspection(row, content){
    const panel=content.closest('.manager-module-panel');
    if(panel){
      const heading=panel.querySelector('.manager-module-heading h3');
      const brand=panel.querySelector('.manager-module-heading small');
      if(heading) heading.textContent='فحص الجهاز';
      if(brand) brand.textContent=workspaceRole==='manager'?'MOBIHUB MANAGEMENT':'MOBIHUB WORKSPACE';
    }
    content.innerHTML='<div class="manager-loading">جاري تحميل قوائم فحص الأجهزة...</div>';
    try{
      const catalog=await api('device_inspection_catalog');
      const guess=(name)=>{
        const v=String(name||'').toLowerCase();
        if(/ipad|ايباد|آيباد/.test(v))return 'ipad';
        if(/mac|ماك/.test(v))return 'macbook';
        if(/watch|ساعة/.test(v))return 'watch';
        if(/airpods|airpod|ايربودز|إيربودز/.test(v))return 'airpods';
        return 'iphone';
      };
      renderInspectionTypePicker(content,row,catalog,guess(row.deviceName));
    }catch(e){content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}</div>`;}
  }

  function renderInspectionTypePicker(content,row,catalog,suggestedType){
    const icons={iphone:'📱',ipad:'📲',macbook:'💻',watch:'⌚',airpods:'🎧'};
    const order=['iphone','ipad','macbook','watch','airpods'];
    content.innerHTML=`
      <div class="inspection-wizard">
        <div class="inspection-wizard-device">
          <span class="inspection-wizard-kicker">40-POINT DEVICE INSPECTION</span>
          <h4>اختيار نوع الجهاز</h4>
          <p>${row.orderId?`طلب رقم <b>${escapeHtml(row.orderId)}</b> · `:''}${escapeHtml(row.deviceName||'جهاز غير محدد')}</p>
          <small>اختر نوع الجهاز لعرض قائمة الفحص المطابقة للبوت.</small>
        </div>
        <div class="inspection-type-grid">
          ${order.map(key=>`<button type="button" class="inspection-type-card ${key===suggestedType?'is-suggested':''}" data-inspection-type="${key}">
            <span>${icons[key]}</span><b>${escapeHtml(catalog[key].name)}</b><small>${catalog[key].items.length} اختبار</small>
            ${key===suggestedType?'<em>النوع المتوقع</em>':''}
          </button>`).join('')}
        </div>
        <p class="manager-note">الاختيار المقترح مبني على اسم الجهاز المسجل، ويمكنك تغييره قبل بدء الفحص.</p>
        <button type="button" class="secondary-btn inspection-cancel" id="cancelInspectionWizard">رجوع للأجهزة</button>
      </div>`;
    content.querySelectorAll('[data-inspection-type]').forEach(btn=>btn.addEventListener('click',()=>{
      startInspectionWizard(content,row,catalog,btn.dataset.inspectionType);
    }));
    content.querySelector('#cancelInspectionWizard').addEventListener('click',()=>openEmployeeDevices());
  }

  async function startInspectionWizard(content,row,catalog,type){
    const device=catalog[type];
    if(!device)return;
    content.innerHTML='<div class="manager-loading">جاري استرجاع نتائج الفحص السابق...</div>';
    try{
      const saved=await api('device_inspection_get',{orderId:row.orderId,deviceType:type});
      const results=Array(device.items.length).fill('');
      const notes=Array(device.items.length).fill('');
      (saved.items||[]).forEach(x=>{
        const i=Number(x.index);
        if(i>=0&&i<results.length){results[i]=x.result||'';notes[i]=x.note||'';}
      });
      const state={row,catalog,type,index:0,results,notes,startedAt:new Date().toLocaleString('ar-EG'),savedAt:saved.updatedAt||''};
      renderInspectionWizardStep(content,state);
    }catch(e){content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}<button type="button" class="secondary-btn" id="inspectionTypeBack">رجوع لاختيار النوع</button></div>`;content.querySelector('#inspectionTypeBack').addEventListener('click',()=>renderInspectionTypePicker(content,row,catalog,type));}
  }

  function inspectionResultLabel(value){
    return value==='سليم'?'سليم':value==='مشكلة'?'به مشكلة':value==='لم يختبر'?'لم يتم الاختبار':'لم يتم التقييم';
  }
  function renderInspectionWizardStep(content,state){
    const d=state.catalog[state.type],total=d.items.length,idx=state.index,item=d.items[idx];
    const result=state.results[idx]||'';
    const good=state.results.filter(x=>x==='سليم').length;
    const bad=state.results.filter(x=>x==='مشكلة').length;
    const untested=state.results.filter(x=>x==='لم يختبر').length;
    const pending=total-good-bad-untested;
    const pct=Math.round(((idx+1)/total)*100);
    const progress=state.results.filter(Boolean).length;
    const nav=(label,action,disabled=false)=>`<button type="button" class="secondary-btn" data-inspection-nav="${action}" ${disabled?'disabled':''}>${label}</button>`;
    content.innerHTML=`
      <div class="inspection-wizard">
        <div class="inspection-wizard-top">
          <button type="button" class="secondary-btn" id="inspectionBackToTypes">تغيير نوع الجهاز</button>
          <span>${state.row.orderId?`طلب ${escapeHtml(state.row.orderId)}`:'فحص مستقل'}</span>
        </div>
        <div class="inspection-progress-card">
          <div class="inspection-progress-head"><div><small>فحص ${escapeHtml(d.name)}</small><b>الاختبار ${idx+1} من ${total}</b></div><strong>${pct}%</strong></div>
          <div class="inspection-progress-track"><span style="width:${pct}%"></span></div>
          <div class="inspection-progress-stats"><span>تم تقييم ${progress}</span><span>متبقي ${pending}</span></div>
        </div>
        <article class="inspection-current-test">
          <span class="inspection-test-number">الاختبار ${String(idx+1).padStart(2,'0')}</span>
          <h4>${escapeHtml(item.name)}</h4>
          <div class="inspection-instruction"><b>🛠️ طريقة الاختبار</b><p>${escapeHtml(item.instruction||'نفّذ الاختبار وسجّل النتيجة بعد التأكد.')}</p></div>
          <div class="inspection-result-label">حدد نتيجة الاختبار</div>
          <div class="inspection-result-options">
            <button type="button" data-inspection-result="سليم" class="${result==='سليم'?'selected good':''}">✅<span>سليم</span></button>
            <button type="button" data-inspection-result="مشكلة" class="${result==='مشكلة'?'selected bad':''}">❌<span>مشكلة</span></button>
            <button type="button" data-inspection-result="لم يختبر" class="${result==='لم يختبر'?'selected skip':''}">⚪<span>لم يختبر</span></button>
          </div>
          <label class="inspection-note-field">ملاحظات الاختبار
            <textarea id="inspectionCurrentNote" rows="3" maxlength="500" placeholder="اكتب تفاصيل المشكلة أو ملاحظات الفني...">${escapeHtml(state.notes[idx]||'')}</textarea>
          </label>
        </article>
        <div class="inspection-summary-strip">
          <span>✅ ${good} سليم</span><span>❌ ${bad} مشكلة</span><span>⚪ ${untested} لم يختبر</span>
        </div>
        <div class="inspection-navigation">
          ${nav('⏮ البداية','first',idx===0)}
          ${nav('السابق','prev',idx===0)}
          ${nav('التالي','next',idx===total-1)}
          <button type="button" class="primary-btn" id="inspectionReviewBtn">مراجعة وإنهاء 📋</button>
        </div>
      </div>`;
    content.querySelector('#inspectionBackToTypes').addEventListener('click',()=>renderInspectionTypePicker(content,state.row,state.catalog,state.type));
    content.querySelectorAll('[data-inspection-result]').forEach(btn=>btn.addEventListener('click',()=>{
      state.results[idx]=btn.dataset.inspectionResult;
      if(state.results[idx]!=='مشكلة' && !state.notes[idx]) state.notes[idx]='';
      renderInspectionWizardStep(content,state);
    }));
    content.querySelector('#inspectionCurrentNote').addEventListener('input',ev=>{state.notes[idx]=ev.target.value;});
    content.querySelectorAll('[data-inspection-nav]').forEach(btn=>btn.addEventListener('click',()=>{
      const action=btn.dataset.inspectionNav;
      state.notes[idx]=content.querySelector('#inspectionCurrentNote').value;
      if(action==='first')state.index=0;
      if(action==='prev')state.index=Math.max(0,idx-1);
      if(action==='next')state.index=Math.min(total-1,idx+1);
      renderInspectionWizardStep(content,state);
    }));
    content.querySelector('#inspectionReviewBtn').addEventListener('click',()=>{
      state.notes[idx]=content.querySelector('#inspectionCurrentNote').value;
      renderInspectionWizardReview(content,state);
    });
  }

  function renderInspectionWizardReview(content,state){
    const d=state.catalog[state.type];
    const good=state.results.filter(x=>x==='سليم').length;
    const bad=state.results.filter(x=>x==='مشكلة').length;
    const untested=state.results.filter(x=>x==='لم يختبر').length;
    const missing=state.results.filter(x=>!x).length;
    content.innerHTML=`
      <div class="inspection-wizard">
        <div class="inspection-review-head"><button type="button" class="secondary-btn" id="inspectionReviewBack">رجوع للفحص</button><h4>مراجعة نتائج ${escapeHtml(d.name)}</h4><p>${state.row.orderId?`طلب رقم ${escapeHtml(state.row.orderId)}`:'فحص مستقل'}</p></div>
        <div class="inspection-summary-strip"><span>✅ ${good} سليم</span><span>❌ ${bad} مشكلة</span><span>⚪ ${untested} لم يختبر</span></div>
        ${missing?`<div class="inspection-review-warning">متبقي ${missing} اختبار بدون نتيجة. أكملها قبل الحفظ.</div>`:''}
        <div class="inspection-review-list">
          ${d.items.map((it,i)=>`<button type="button" class="inspection-review-item" data-review-index="${i}"><span>${i+1}. ${escapeHtml(it.name)}</span><b class="${state.results[i]==='سليم'?'good':state.results[i]==='مشكلة'?'bad':state.results[i]==='لم يختبر'?'skip':''}">${escapeHtml(inspectionResultLabel(state.results[i]))}</b>${state.notes[i]?`<small>${escapeHtml(state.notes[i])}</small>`:''}</button>`).join('')}
        </div>
        <button type="button" class="primary-btn inspection-save-btn" id="saveDeviceInspection" ${missing?'disabled':''}>حفظ تقرير الفحص</button>
      </div>`;
    content.querySelector('#inspectionReviewBack').addEventListener('click',()=>renderInspectionWizardStep(content,state));
    content.querySelectorAll('[data-review-index]').forEach(btn=>btn.addEventListener('click',()=>{
      state.index=Number(btn.dataset.reviewIndex);renderInspectionWizardStep(content,state);
    }));
    content.querySelector('#saveDeviceInspection').addEventListener('click',async()=>{
      const btn=content.querySelector('#saveDeviceInspection');btn.disabled=true;btn.textContent='جاري حفظ التقرير...';
      try{
        const items=d.items.map((it,index)=>({index,result:state.results[index],note:state.notes[index]||''}));
        const result=await api('device_inspection_save',{orderId:state.row.orderId,deviceType:state.type,items});
        content.innerHTML=`<div class="inspection-success"><div>✅</div><h4>تم حفظ فحص الجهاز بنجاح</h4><p>${state.row.orderId?`طلب ${escapeHtml(state.row.orderId)} · `:''}${escapeHtml(d.name)}</p><div class="inspection-summary-strip"><span>✅ ${result.completed} سليم/مكتمل</span><span>❌ ${result.issues} مشكلة</span><span>⚪ ${result.untested} لم يختبر</span></div><button type="button" class="primary-btn" id="inspectionBackDevices">العودة إلى أجهزتي</button></div>`;
        content.querySelector('#inspectionBackDevices').addEventListener('click',()=>state.row.orderId?openEmployeeDevices():openStandaloneDeviceInspection());
        if(tg?.HapticFeedback?.notificationOccurred)tg.HapticFeedback.notificationOccurred('success');
      }catch(e){if(tg?.showAlert)tg.showAlert(e.message);btn.disabled=false;btn.textContent='حفظ تقرير الفحص';}
    });
  }

  async function openRepairPriceBook(){
    const panel=managerPanel('أسعار الإصلاح','<div class="manager-loading">جاري تحميل أقسام الأسعار...</div>');
    const content=panel.querySelector('.manager-module-content');
    await renderRepairPriceHome(content);
  }
  async function renderRepairPriceHome(content){
    content.innerHTML='<div class="manager-loading">جاري تحميل الأقسام...</div>';
    try{
      const d=await api('repair_price_categories');
      content.innerHTML=`<p class="manager-note">الأسعار معروضة كما هي من ملف الأسعار المرتبط. لا يتم تعديل ملف الأسعار من التطبيق.</p><form id="repairPriceSearchForm" class="manager-module-toolbar"><input name="query" minlength="2" maxlength="100" placeholder="ابحث عن موديل في كل الأقسام" required><button type="submit" class="primary-btn">بحث</button></form><h4>الأقسام</h4><div class="repair-price-categories">${d.categories.map(c=>`<button type="button" class="manager-action-card" data-price-category="${c.key}"><b>${escapeHtml(c.label)}</b><small>عرض الموديلات والأسعار</small></button>`).join('')}</div>`;
      content.querySelector('#repairPriceSearchForm').addEventListener('submit',ev=>{ev.preventDefault();const q=new FormData(ev.currentTarget).get('query');renderRepairPriceSearch(content,q,0);});
      content.querySelectorAll('[data-price-category]').forEach(b=>b.addEventListener('click',()=>renderRepairPriceModels(content,b.dataset.priceCategory,0)));
    }catch(e){content.innerHTML=`<div class="manager-load-error">${escapeHtml(e.message)}<p>تأكد من إتاحة ملف الأسعار لحساب Google Apps Script وتشغيل إعداد ربط الأسعار في بيئة TEST.</p></div>`;}
  }
  async function renderRepairPriceModels(content,category,page){
    content.innerHTML='<div class="manager-loading">جاري تحميل الموديلات...</div>';
    try{
      const d=await api('repair_price_models',{category,page});
      content.innerHTML=`<button type="button" class="secondary-btn" id="priceBackHome">الأقسام الرئيسية</button><h4>${escapeHtml(d.label)}</h4><p class="manager-note">الصفحة ${d.page+1} من ${d.totalPages} · ${d.total} موديل</p>${d.models.map(m=>`<button type="button" class="manager-action-card repair-price-model" data-price-row="${m.row}" data-price-category="${category}"><b>${escapeHtml(m.name)}</b><small>عرض الأعطال والأسعار</small></button>`).join('')||'<p class="muted">لا توجد موديلات بأسعار مسجلة في هذا القسم.</p>'}<div class="manager-row-actions">${d.page>0?'<button type="button" class="secondary-btn" id="pricePrev">السابق</button>':''}${d.page+1<d.totalPages?'<button type="button" class="secondary-btn" id="priceNext">التالي</button>':''}</div>`;
      content.querySelector('#priceBackHome').addEventListener('click',()=>renderRepairPriceHome(content));
      if(content.querySelector('#pricePrev'))content.querySelector('#pricePrev').addEventListener('click',()=>renderRepairPriceModels(content,category,d.page-1));
      if(content.querySelector('#priceNext'))content.querySelector('#priceNext').addEventListener('click',()=>renderRepairPriceModels(content,category,d.page+1));
      content.querySelectorAll('[data-price-row]').forEach(b=>b.addEventListener('click',()=>renderRepairPriceIssues(content,category,Number(b.dataset.priceRow))));
    }catch(e){content.innerHTML=`<button type="button" class="secondary-btn" id="priceBackHome">الأقسام الرئيسية</button><p class="manager-load-error">${escapeHtml(e.message)}</p>`;content.querySelector('#priceBackHome').addEventListener('click',()=>renderRepairPriceHome(content));}
  }
  async function renderRepairPriceSearch(content,query,page){
    content.innerHTML='<div class="manager-loading">جاري البحث في جميع الأقسام...</div>';
    try{
      const d=await api('repair_price_search',{query,page});
      content.innerHTML=`<button type="button" class="secondary-btn" id="priceBackHome">الأقسام الرئيسية</button><h4>نتائج البحث: ${escapeHtml(d.query)}</h4><p class="manager-note">${d.total} نتيجة · الصفحة ${d.page+1} من ${d.totalPages}</p>${d.results.map(r=>`<button type="button" class="manager-action-card repair-price-model" data-price-row="${r.row}" data-price-category="${r.category}"><b>${escapeHtml(r.name)}</b><small>${escapeHtml(r.categoryLabel)}</small></button>`).join('')||'<p class="muted">لا توجد نتائج مطابقة. جرّب جزءًا مختلفًا من اسم الموديل.</p>'}<div class="manager-row-actions">${d.page>0?'<button type="button" class="secondary-btn" id="pricePrev">السابق</button>':''}${d.page+1<d.totalPages?'<button type="button" class="secondary-btn" id="priceNext">التالي</button>':''}</div>`;
      content.querySelector('#priceBackHome').addEventListener('click',()=>renderRepairPriceHome(content));
      if(content.querySelector('#pricePrev'))content.querySelector('#pricePrev').addEventListener('click',()=>renderRepairPriceSearch(content,query,d.page-1));
      if(content.querySelector('#priceNext'))content.querySelector('#priceNext').addEventListener('click',()=>renderRepairPriceSearch(content,query,d.page+1));
      content.querySelectorAll('[data-price-row]').forEach(b=>b.addEventListener('click',()=>renderRepairPriceIssues(content,b.dataset.priceCategory,Number(b.dataset.priceRow))));
    }catch(e){content.innerHTML=`<button type="button" class="secondary-btn" id="priceBackHome">الأقسام الرئيسية</button><p class="manager-load-error">${escapeHtml(e.message)}</p>`;content.querySelector('#priceBackHome').addEventListener('click',()=>renderRepairPriceHome(content));}
  }
  async function renderRepairPriceIssues(content,category,row){
    content.innerHTML='<div class="manager-loading">جاري تحميل الأسعار...</div>';
    try{
      const d=await api('repair_price_issues',{category,row});
      content.innerHTML=`<button type="button" class="secondary-btn" id="priceBackModels">رجوع للموديلات</button><div class="manager-device-detail"><h4>${escapeHtml(d.model)}</h4><p>${escapeHtml(d.label)}</p></div><div class="repair-price-list">${d.issues.map(i=>`<article class="manager-row"><b>${escapeHtml(i.issue)}</b><strong>${escapeHtml(i.price)}</strong></article>`).join('')||'<p class="muted">لا توجد أسعار مسجلة لهذا الموديل.</p>'}</div>`;
      content.querySelector('#priceBackModels').addEventListener('click',()=>renderRepairPriceModels(content,category,0));
    }catch(e){content.innerHTML=`<button type="button" class="secondary-btn" id="priceBackModels">رجوع للموديلات</button><p class="manager-load-error">${escapeHtml(e.message)}</p>`;content.querySelector('#priceBackModels').addEventListener('click',()=>renderRepairPriceModels(content,category,0));}
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
          التاريخ: ${escapeHtml(r['التاريخ والوقت']||'')}<br>الحالة: ${escapeHtml(r['القرار']||'قيد الانتظار')}</p>
          <div class="review-actions">
            <button class="primary-btn" data-advance-row="${r.__row}" data-decision="مقبول">موافقة على السلفة</button>
            <button class="secondary-btn" data-advance-row="${r.__row}" data-decision="مرفوض">رفض السلفة</button>
          </div>
        </article>`).join('');
      const custodyCards=[];
      custodyRows.forEach(r=>{
        const status=String(r['الحالة']||''), payout=String(r['حالة الصرف']||'');
        const custody=String(r['حالة العهدة']||''), settlement=String(r['حالة التسوية']||'');
        const base=`<p>${escapeHtml(r['اسم الموظف']||'')} · ${escapeHtml(r['المبلغ المطلوب بالجنيه']||'—')} جنيه<br>${escapeHtml(r['التاريخ والوقت']||'')}<br>الغرض: ${escapeHtml(r['الغرض']||'—')}</p>`;
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
      pendingR.forEach(r=>cards.push(`<article class="review-item"><strong>طلب مهندس · ${escapeHtml(r['نوع الطلب']||'')}</strong><p>${escapeHtml(r['اسم الموظف']||'')}\n${escapeHtml(r['التفاصيل']||'')}\n${escapeHtml(r['التاريخ والوقت']||'')}</p><div class="review-actions"><button class="primary-btn" data-decide-request="${r.__row||''}" data-decision="مقبول">موافقة</button><button class="secondary-btn" data-decide-request="${r.__row||''}" data-decision="مرفوض">رفض</button></div></article>`));
      pendingL.forEach(r=>cards.push(`<article class="review-item"><strong>إذن · ${escapeHtml(r['نوع الإذن']||'')}</strong><p>${escapeHtml(r['اسم الموظف']||'')} · ${escapeHtml(r['تاريخ الإذن']||'')} ${escapeHtml(r['تاريخ نهاية الإذن']||'')}\n${escapeHtml(r['من الساعة']||'')} إلى ${escapeHtml(r['إلى الساعة']||'')}\n${escapeHtml(r['السبب']||'')}\n${escapeHtml(r['رقم الطلب']||'')}</p><div class="review-actions"><button class="primary-btn" data-decide-leave="${r.__row||''}" data-decision="مقبول">موافقة</button><button class="secondary-btn" data-decide-leave="${r.__row||''}" data-decision="مرفوض">رفض</button></div></article>`));
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

  $('workspaceSwitch').addEventListener('click', switchWorkspace);
  $('refreshManagerDashboard').addEventListener('click',loadManagerDashboard);
  document.querySelectorAll('[data-manager-module]').forEach(btn=>btn.addEventListener('click',()=>openManagerModule(btn.dataset.managerModule)));
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
  start();
})();
