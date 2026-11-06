(() => {
  'use strict';
  const tg = window.Telegram?.WebApp;
  const API_URL = 'https://mobihub-telegram-proxy.ahmedmtarek20.workers.dev/';
  const $ = (id) => document.getElementById(id);
  const titles = { requests: 'طلباتي', leaves: 'طلبات الأذونات', complaints: 'الشكاوى', cash: 'العهد والسلف', attendance: 'سجل الحضور والانصراف' };
  let initData = '';
  let currentAttendance = null;
  let pendingUniform = false;

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
    FORBIDDEN: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.', EMPLOYEE_ONLY: 'الخدمة متاحة لحسابات الموظفين فقط.',
    INVALID_REQUEST_DETAILS: 'اكتب تفاصيل الطلب (من 5 إلى 1500 حرف).', INVALID_LEAVE_REASON: 'اكتب سبب الإذن (من 5 إلى 1000 حرف).',
    INVALID_LEAVE_DATE: 'اختر تاريخ اليوم أو تاريخًا قادمًا صحيحًا.', DUPLICATE_LEAVE_OVERLAP: 'لديك طلب إذن معلق أو معتمد يتعارض مع هذه الفترة.',
    NO_ACTIVE_SHIFT_ASSIGNED: 'لا توجد وردية نشطة لك في هذا التاريخ.', LEAVE_OUTSIDE_SHIFT: 'وقت أو مدة الإذن خارج حدود ورديتك.',
    LEAVE_START_NOT_FUTURE: 'بداية الإذن يجب أن تكون في وقت قادم.', FULL_DAY_LEAVE_AFTER_SHIFT_START: 'لا يمكن طلب إذن يوم كامل بعد بداية الوردية.',
    LEAVE_CONFLICT_CONFIRMED_ABSENCE: 'لا يمكن اعتماد الإذن بعد تأكيد الغياب لهذا التاريخ.', REQUEST_ALREADY_REVIEWED: 'تمت مراجعة الطلب بالفعل.', LEAVE_ALREADY_REVIEWED: 'تمت مراجعة الإذن بالفعل.', INVALID_REQUEST_TYPE: 'نوع الطلب غير صحيح.', INVALID_LEAVE_TYPE: 'نوع الإذن غير صحيح.', INVALID_LEAVE_DAYS: 'عدد الأيام غير متاح.', INVALID_LEAVE_HOURS: 'مدة الإذن غير متاحة.', INVALID_LEAVE_TIME: 'وقت الإذن غير صحيح.', REQUEST_NOT_FOUND: 'الطلب غير موجود.', LEAVE_NOT_FOUND: 'طلب الإذن غير موجود.', INVALID_DECISION: 'القرار أو رقم السجل غير صحيح.', SHEET_SCHEMA_MISMATCH: 'أعمدة الشيت لا تطابق النسخة المطلوبة. أوقف الاختبار وراجع الأعمدة.'
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
      body: JSON.stringify({ initData, action, ...extra })
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
    try {
      const rows = await api('attendance_history', { limit: 30 });
      if (!rows.length) { $('resultBody').textContent = 'لا توجد سجلات حضور حتى الآن.'; return; }
      $('resultBody').innerHTML = rows.map(row => `<article class="record"><strong>${escapeHtml(row['النوع'] || 'حركة حضور')}</strong><small class="record-meta">${escapeHtml(row['التاريخ'] || '')} · ${escapeHtml(row['الوقت'] || '')}<br>${escapeHtml(row['حالة الحضور'] || '')}${row['دقائق التأخير'] ? ` · التأخير ${escapeHtml(row['دقائق التأخير'])} دقيقة` : ''}<br>المسافة: ${escapeHtml(row['المسافة بالمتر'] ?? '—')} متر · دقة GPS: ${escapeHtml(row['دقة GPS بالمتر'] ?? '—')} متر</small></article>`).join('');
    } catch (e) { $('resultBody').textContent = e.message; }
  }

  async function start() {
    if (!tg) return fail('افتح التطبيق من زر Mini App داخل بوت MobiHub.');
    tg.ready(); tg.expand();
    initData = tg.initData || '';
    if (!initData) return fail('بيانات Telegram غير متاحة. افتح التطبيق من داخل Telegram.');
    try {
      const data = await api('bootstrap');
      $('userName').textContent = data.profile.name;
      const roleNames = { employee: 'موظف', supervisor: 'مشرف', admin: 'مدير', finance: 'مالية', super_admin: 'مدير النظام' };
      $('userRole').textContent = roleNames[data.profile.role] || data.profile.role;
      renderStats(data.summary);
      if (data.permissions.viewManagement) $('management').classList.remove('hidden');
      if (data.permissions.reviewRequests) { $('reviewCenter').classList.remove('hidden'); await loadReviews(); }
      $('connection').textContent = 'متصل'; $('connection').style.color = '#8be0aa';
      try { await refreshAttendance(); } catch (e) { $('attendance').classList.remove('hidden'); showAttendanceMessage(e.message, true); }
    } catch (e) { fail(e.message); }
  }

  async function showList(entity) {
    $('results').classList.remove('hidden');
    $('resultTitle').textContent = titles[entity] || 'السجلات';
    $('resultBody').textContent = 'جاري التحميل...';
    try {
      const rows = await api('list', { entity });
      if (!rows.length) { $('resultBody').textContent = 'لا توجد سجلات.'; return; }
      $('resultBody').innerHTML = rows.map(row => {
        const title = row['رقم الطلب'] || row['رقم الشكوى'] || row['نوع الطلب'] || row['نوع الإذن'] || 'سجل';
        const status = row['الحالة'] || row['القرار'] || '';
        const date = row['التاريخ والوقت'] || row['تاريخ الإرسال'] || '';
        return `<article class="record"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(status)} · ${escapeHtml(date)}</small></article>`;
      }).join('');
    } catch (e) { $('resultBody').textContent = e.message; }
  }

  async function submitRequest() {
    const b=$('submitRequest'); b.disabled=true; $('requestMessage').classList.add('hidden');
    try { const result=await api('request_create',{requestType:$('requestType').value,details:$('requestDetails').value}); $('requestDetails').value=''; messageRequest(result.message||'تم إرسال الطلب بنجاح'); await showList('requests'); }
    catch(e){messageRequest(e.message,true);} finally{b.disabled=false;}
  }
  async function submitLeave() {
    const b=$('submitLeave'); b.disabled=true; $('requestMessage').classList.add('hidden');
    const type=$('leaveType').value, payload={leaveType:type,date:$('leaveDate').value,reason:$('leaveReason').value};
    if(type==='يوم كامل') payload.days=Number($('leaveDays').value); else {payload.from=$('leaveFrom').value;payload.hours=Number($('leaveHours').value);}
    try { const result=await api('leave_create',payload); $('leaveReason').value=''; messageRequest(`${result.message} · رقم الطلب ${result.requestId}`); await showList('leaves'); }
    catch(e){messageRequest(e.message,true);} finally{b.disabled=false;}
  }
  function messageRequest(text,isError=false){const el=$('requestMessage');el.textContent=text;el.classList.toggle('is-error',isError);el.classList.remove('hidden');}
  function switchRequestForm(which){$('requestForm').classList.toggle('hidden',which!=='request');$('leaveForm').classList.toggle('hidden',which!=='leave');}
  function syncLeaveFields(){const hourly=$('leaveType').value==='بالساعات';$('leaveDaysWrap').classList.toggle('hidden',hourly);$('leaveHoursWrap').classList.toggle('hidden',!hourly);}
  async function loadReviews(){
    const box=$('reviewBody'); box.textContent='جاري تحميل الطلبات المعلقة...';
    try { const [requests,leaves]=await Promise.all([api('list',{entity:'requests'}),api('list',{entity:'leaves'})]);
      const pendingR=requests.filter(r=>(r['القرار']||'')==='قيد الانتظار'); const pendingL=leaves.filter(r=>(r['الحالة']||'')==='بانتظار مراجعة المدير');
      const cards=[];
      pendingR.forEach(r=>cards.push(`<article class="review-item"><strong>طلب موظف · ${escapeHtml(r['نوع الطلب']||'')}</strong><p>${escapeHtml(r['اسم الموظف']||'')}\n${escapeHtml(r['التفاصيل']||'')}\n${escapeHtml(r['التاريخ والوقت']||'')}</p><div class="review-actions"><button class="primary-btn" data-decide-request="${r.__row||''}" data-decision="مقبول">موافقة</button><button class="secondary-btn" data-decide-request="${r.__row||''}" data-decision="مرفوض">رفض</button></div></article>`));
      pendingL.forEach(r=>cards.push(`<article class="review-item"><strong>إذن · ${escapeHtml(r['نوع الإذن']||'')}</strong><p>${escapeHtml(r['اسم الموظف']||'')} · ${escapeHtml(r['تاريخ الإذن']||'')} ${escapeHtml(r['تاريخ نهاية الإذن']||'')}\n${escapeHtml(r['من الساعة']||'')} إلى ${escapeHtml(r['إلى الساعة']||'')}\n${escapeHtml(r['السبب']||'')}\n${escapeHtml(r['رقم الطلب']||'')}</p><div class="review-actions"><button class="primary-btn" data-decide-leave="${r.__row||''}" data-decision="مقبول">موافقة</button><button class="secondary-btn" data-decide-leave="${r.__row||''}" data-decision="مرفوض">رفض</button></div></article>`));
      box.innerHTML=cards.length?cards.join(''):'لا توجد طلبات أو أذونات معلقة.';
      box.querySelectorAll('[data-decide-request]').forEach(b=>b.addEventListener('click',()=>decide('request_decide',b.dataset.decideRequest,b.dataset.decision)));
      box.querySelectorAll('[data-decide-leave]').forEach(b=>b.addEventListener('click',()=>decide('leave_decide',b.dataset.decideLeave,b.dataset.decision)));
    } catch(e){box.textContent=e.message;}
  }
  async function decide(action,row,decision){if(!row){messageRequest('تعذر تحديد رقم السجل. حدّث القائمة. ',true);return;} if(!confirm(`تأكيد ${decision}؟`))return;try{await api(action,{row:Number(row),decision});await loadReviews();messageRequest('تم تسجيل القرار.');}catch(e){messageRequest(e.message,true);}}

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  $('newRequestTab').addEventListener('click',()=>switchRequestForm('request'));
  $('newLeaveTab').addEventListener('click',()=>switchRequestForm('leave'));
  $('leaveType').addEventListener('change',syncLeaveFields);
  $('submitRequest').addEventListener('click',submitRequest);
  $('submitLeave').addEventListener('click',submitLeave);
  $('refreshReviews').addEventListener('click',loadReviews);
  $('checkinBtn').addEventListener('click', () => withLocation('attendance_checkin', $('checkinBtn')));
  $('checkoutBtn').addEventListener('click', () => withLocation('attendance_checkout', $('checkoutBtn')));
  $('historyBtn').addEventListener('click', showAttendanceHistory);
  document.querySelectorAll('[data-uniform]').forEach(btn => btn.addEventListener('click', () => confirmUniform(btn.dataset.uniform)));
  document.querySelectorAll('[data-entity]').forEach(btn => btn.addEventListener('click', () => showList(btn.dataset.entity)));
  $('backBtn').addEventListener('click', () => $('results').classList.add('hidden'));
  start();
})();
