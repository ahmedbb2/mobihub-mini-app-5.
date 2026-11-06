(() => {
  'use strict';
  const tg = window.Telegram?.WebApp;
  const API_URL = 'https://mobihub-telegram-proxy.ahmedmtarek20.workers.dev/';
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
      placeholder.parentNode.insertBefore(element, placeholder);
      placeholder.remove();
      element.classList.add('hidden');
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
    EMPLOYEE_NOT_FOUND: 'المهندس غير موجود أو حسابه غير نشط.',
    INVALID_MONTH: 'صيغة الشهر غير صحيحة.',
    INVALID_DEDUCTION: 'راجع نوع الخصم والسبب والمبلغ.',
    INVALID_DECISION: 'قرار المراجعة غير صحيح.',
    DEDUCTION_NOT_FOUND: 'الخصم غير موجود.',
    DEDUCTION_ALREADY_REVIEWED: 'تمت مراجعة الخصم بالفعل.',
    INVALID_REWARD_REASON: 'اكتب سبب المكافأة من 3 إلى 250 حرفًا.',
    INVALID_HYGIENE_RATING: 'بيانات تقييم النظافة غير صحيحة.',
    HYGIENE_ALREADY_RATED: 'تم تسجيل تقييم النظافة لهذا المهندس في هذا اليوم بالفعل.'
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
      const err = new Error(errorMessages[code] || code);
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
        showAttendanceMessage(`تم تسجيل الانصراف بنجاح · ${result.time || ''} · المسافة ${result.distanceMeters} متر.`);
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
    const isManager = MANAGER_ROLES.includes(role);
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
      mount(manager, ['stats','reviewCenter','cashReviewCenter','financeCenter','deviceRegisterPanel','results','management']);
      $('attendance').classList.add('hidden');
      $('homeActions').classList.add('hidden');
      $('financeCenter').classList.add('hidden');
      $('deviceRegisterPanel').classList.add('hidden');
      $('requestCenter').classList.add('hidden');
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
      nav.classList.remove('hidden');
      nav.querySelectorAll('[data-nav-target]').forEach(btn=>btn.addEventListener('click',()=>{
        const target=$(btn.dataset.navTarget); if(target){target.classList.remove('hidden');target.scrollIntoView({behavior:'smooth',block:'start'});}
        nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));
      }));
    }
  }
  function applyWorkspaceProfile(data) {
    currentRole = data.profile.role || 'employee';
    workspaceRole = data.profile.workspace || (MANAGER_ROLES.includes(currentRole) ? 'manager' : 'employee');
    availableWorkspaces = Array.isArray(data.profile.availableWorkspaces)
      ? data.profile.availableWorkspaces : [workspaceRole];

    $('userName').textContent = data.profile.name;
    const roleNames = { employee: 'مهندس', supervisor: 'مشرف', admin: 'مدير', finance: 'مالية', super_admin: 'مدير النظام' };
    $('userRole').textContent = roleNames[currentRole] || currentRole;
    $('workspaceSwitch').classList.toggle('hidden', !(availableWorkspaces.includes('employee') && availableWorkspaces.includes('manager')));
    $('workspaceSwitch').textContent = workspaceRole === 'manager' ? 'لوحة المهندس' : 'لوحة المدير';
    $('workspaceSwitch').setAttribute('aria-label', workspaceRole === 'manager' ? 'التحويل إلى لوحة المهندس' : 'التحويل إلى لوحة المدير');

    renderStats(data.summary || {});
    buildWorkspace(currentRole, data.permissions || {});
    $('management').classList.toggle('hidden', !data.permissions?.viewManagement);
    $('reviewCenter').classList.toggle('hidden', !data.permissions?.reviewRequests);
    $('cashReviewCenter').classList.toggle('hidden', !data.permissions?.finance);
  }

  async function switchWorkspace() {
    if (switchingWorkspace || availableWorkspaces.length < 2) return;
    const previousWorkspace = workspaceRole;
    const nextWorkspace = previousWorkspace === 'manager' ? 'employee' : 'manager';
    if (!availableWorkspaces.includes(nextWorkspace)) return;

    switchingWorkspace = true;
    $('workspaceSwitch').disabled = true;
    $('workspaceSwitch').textContent = 'جارٍ التحويل...';
    try {
      workspaceRole = nextWorkspace;
      const data = await api('bootstrap');
      applyWorkspaceProfile(data);

      if (workspaceRole === 'manager') {
        if (data.permissions?.reviewRequests) await loadReviews();
        if (data.permissions?.finance) await loadCashReviews();
        $('attendance').classList.add('hidden');
      } else {
        try { await refreshAttendance(); } catch (e) { showAttendanceMessage(e.message, true); }
        $('attendance').classList.add('hidden');
        $('requestCenter').classList.add('hidden');
        $('financeCenter').classList.add('hidden');
        $('deviceRegisterPanel').classList.add('hidden');
      }
      $('connection').textContent = 'متصل';
      if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      workspaceRole = previousWorkspace;
      $('workspaceSwitch').textContent = previousWorkspace === 'manager' ? 'لوحة المهندس' : 'لوحة المدير';
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
      try { const deviceOptions=await api('device_registration_options'); if(deviceOptions.allowed) $('registerDeviceCard').classList.remove('hidden'); } catch (_) { /* hide intake action when not authorized */ }
      if (data.permissions.reviewRequests) await loadReviews();
      if (data.permissions.finance) await loadCashReviews();
      $('connection').textContent = 'متصل'; $('connection').style.color = '#8be0aa';
      if (workspaceRole === 'employee') {
        try { await refreshAttendance(); $('attendance').classList.add('hidden'); }
        catch (e) { $('attendance').classList.add('hidden'); showAttendanceMessage(e.message, true); }
      } else {
        $('attendance').classList.add('hidden');
      }
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
  function openHomeAction(action){
    if(action==='attendance'){ $('attendance').classList.remove('hidden'); openModal('تسجيل حضور', $('attendance')); if(!$('checkinBtn').disabled) $('checkinBtn').click(); return; }
    if(action==='checkout'){ $('attendance').classList.remove('hidden'); openModal('تسجيل انصراف', $('attendance')); if(!$('checkoutBtn').disabled) $('checkoutBtn').click(); return; }
    if(action==='history'){showAttendanceHistory();return;}
    if(action==='leave'){openRequestForm('leave');return;}
    if(action==='cash'){openRequestForm('cash');return;}
    if(action==='withdraw'){openModal('طلب سحب مبلغ', $('withdrawForm')); return;}
    if(action==='requests'){showRequestPicker();return;}
    if(action==='settlement'){showList('cash');return;}
    if(action==='complaint-new'){openRequestForm('complaint');return;}
    if(action==='complaint-list'){showList('complaints');return;}
    if(action==='deductions'){showList('deductions');return;}
    if(action==='rewards'){ $('financeCenter').classList.remove('hidden'); openModal('مكافآتي', $('financeCenter')); loadFinanceSummary(); return; }
    if(action==='monthly'){loadMonthlySummary();return;}
    if(action==='devices'){showList('devices');return;}
    if(action==='device-register'){openDeviceRegistration();return;}
    if(action==='refresh'){refreshEmployeeWorkspace();return;}
  }
  async function refreshEmployeeWorkspace(){
    const btn=document.querySelector('[data-home-action="refresh"]');
    if(btn){btn.disabled=true;}
    try{
      const data=await api('bootstrap');
      renderStats(data.summary||{});
      await refreshAttendance();
      if(!MANAGER_ROLES.includes(currentRole)) $('attendance').classList.add('hidden');
      if(tg&&typeof tg.showAlert==='function') tg.showAlert('تم تحديث لوحة المهندس بنجاح.');
    }catch(e){if(tg&&typeof tg.showAlert==='function') tg.showAlert(e.message);else fail(e.message);}
    finally{if(btn)btn.disabled=false;}
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
      $('deviceTechnician').innerHTML='<option value="">اختر الفني المسؤول</option>'+(data.technicians||[]).map(e=>`<option value="${escapeHtml(e.id)}">${escapeHtml(e.name)}${e.job?` — ${escapeHtml(e.job)}`:''}</option>`).join('');
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
    try { const result=await api('cash_create',{amount:$('cashAmount').value}); $('cashAmount').value=''; messageRequest(`${result.message} رقم الطلب: ${result.requestId}`); await showList('cash'); }
    catch(e){messageRequest(e.message,true);} finally{b.disabled=false;}
  }
  async function loadCashReviews(){
    const box=$('cashReviewBody'); box.textContent='جاري تحميل طلبات السلف والتسويات...';
    try {
      const rows=await api('list',{entity:'cash'});
      const cards=[];
      rows.forEach(r=>{
        const status=String(r['الحالة']||'');
        const payout=String(r['حالة الصرف']||'');
        const custody=String(r['حالة العهدة']||'');
        const settlement=String(r['حالة التسوية']||'');
        const base=`<p>${escapeHtml(r['اسم الموظف']||'')} · ${escapeHtml(r['المبلغ المطلوب بالجنيه']||'—')} جنيه<br>${escapeHtml(r['التاريخ والوقت']||'')}</p>`;
        if(status==='قيد المراجعة') cards.push(`<article class="review-item"><strong>${escapeHtml(r['رقم الطلب']||'طلب سلفة')} · طلب جديد</strong>${base}<div class="review-actions"><button class="primary-btn" data-cash-row="${r.__row}" data-cash-decision="مقبول">موافقة</button><button class="secondary-btn" data-cash-row="${r.__row}" data-cash-decision="مرفوض">رفض</button></div></article>`);
        if(status==='تمت الموافقة' && payout!=='تم الصرف') cards.push(`<article class="review-item"><strong>${escapeHtml(r['رقم الطلب']||'طلب سلفة')} · بانتظار الصرف</strong>${base}<div class="review-actions"><button class="primary-btn" data-cash-row="${r.__row}" data-cash-decision="تم الصرف">تأكيد صرف العهدة</button></div></article>`);
        if(settlement==='بانتظار مراجعة التسوية') cards.push(`<article class="review-item"><strong>${escapeHtml(r['رقم الطلب']||'عهدة')} · مراجعة التسوية</strong><p>${escapeHtml(r['اسم الموظف']||'')}<br>المعتمد: ${escapeHtml(r['المبلغ المعتمد بالجنيه']||'—')} جنيه<br>المصروف: ${escapeHtml(r['المصروف الفعلي بالجنيه']||'—')} جنيه<br>المطلوب إرجاعه: ${escapeHtml(r['المبلغ المطلوب إرجاعه بالجنيه']||'—')} جنيه<br>ملاحظات: ${escapeHtml(r['ملاحظات التسوية']||'—')}</p><div class="review-actions"><button class="primary-btn" data-settle-review="${r.__row}" data-settle-decision="مقبول">اعتماد التسوية</button><button class="secondary-btn" data-settle-review="${r.__row}" data-settle-decision="مرفوض">إرجاع للتصحيح</button></div></article>`);
        if(custody==='بانتظار تأكيد استلام المتبقي') cards.push(`<article class="review-item"><strong>${escapeHtml(r['رقم الطلب']||'عهدة')} · استلام المتبقي</strong><p>${escapeHtml(r['اسم الموظف']||'')}<br>المبلغ المطلوب استلامه: ${escapeHtml(r['المبلغ المطلوب إرجاعه بالجنيه']||'—')} جنيه</p><div class="review-actions"><button class="primary-btn" data-return-confirm="${r.__row}">تأكيد استلام المبلغ</button></div></article>`);
      });
      box.innerHTML=cards.length?cards.join(''):'لا توجد طلبات سلف أو تسويات معلقة.';
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
    try{
      const d=await api('reward_summary',{});
      $('rewardMonthLabel').textContent=`${d.month} · ${d.employeeName}`;
      $('financeSummary').innerHTML=`<div class="finance-grid">
        <div class="finance-stat"><b>${Number(d.base).toFixed(2)} ج</b><small>المكافأة الأساسية التقديرية</small></div>
        <div class="finance-stat"><b>${Number(d.bonus).toFixed(2)} ج</b><small>المكافآت الإضافية المعتمدة</small></div>
        <div class="finance-stat"><b>${Number(d.total).toFixed(2)} ج</b><small>إجمالي المكافآت التقديري</small></div>
        <div class="finance-stat"><b>${Number(d.deductionsApproved).toFixed(2)} ج</b><small>الخصومات المعتمدة</small></div>
        <div class="finance-stat"><b>${Number(d.deductionsPending).toFixed(2)} ج</b><small>خصومات قيد المراجعة</small></div>
        <div class="finance-stat"><b>${d.earned} / ${d.scoredEligible}</b><small>النقاط المحسومة</small></div>
      </div><p class="muted">نسبة المكافأة الأساسية: ${Math.round(d.ratio*100)}% · تقييمات النظافة المعلقة: ${d.hygienePending} · الورديات المستبعدة بإذن معتمد: ${d.excluded}</p>`;
      $('myDeductionRows').innerHTML=(d.deductionRows||[]).length?'<h3>آخر الخصومات</h3>'+d.deductionRows.map(r=>`<article class="record"><strong>${escapeHtml(r['نوع الخصم']||'خصم')} · ${escapeHtml(r['الحالة']||'')}</strong><small class="record-meta">${escapeHtml(r['تاريخ الواقعة']||'')} · ${escapeHtml(r['المبلغ بالجنيه']||0)} جنيه</small><p>${escapeHtml(r['السبب']||'')}</p></article>`).join(''):'<p class="muted">لا توجد خصومات مسجلة هذا الشهر.</p>';
    }catch(e){financeMessage(e.message,true);}
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
  $('historyBtn').addEventListener('click', showAttendanceHistory);
  document.querySelectorAll('[data-uniform]').forEach(btn => btn.addEventListener('click', () => confirmUniform(btn.dataset.uniform)));
  document.querySelectorAll('[data-entity]').forEach(btn => btn.addEventListener('click', () => showList(btn.dataset.entity)));
  $('backBtn').addEventListener('click', () => { const title=$('resultTitle').textContent; $('results').classList.add('hidden'); if(['الطلبات العامة','طلبات الأذونات','السلف والعهد'].includes(title)) showRequestPicker(); else closeModal(); });
  start();
})();
