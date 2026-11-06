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
    LEAVE_CONFLICT_CONFIRMED_ABSENCE: 'لا يمكن اعتماد الإذن بعد تأكيد الغياب لهذا التاريخ.', REQUEST_ALREADY_REVIEWED: 'تمت مراجعة الطلب بالفعل.', LEAVE_ALREADY_REVIEWED: 'تمت مراجعة الإذن بالفعل.', INVALID_REQUEST_TYPE: 'نوع الطلب غير صحيح.', INVALID_LEAVE_TYPE: 'نوع الإذن غير صحيح.', INVALID_LEAVE_DAYS: 'عدد الأيام غير متاح.', INVALID_LEAVE_HOURS: 'مدة الإذن غير متاحة.', INVALID_LEAVE_TIME: 'وقت الإذن غير صحيح.', REQUEST_NOT_FOUND: 'الطلب غير موجود.', LEAVE_NOT_FOUND: 'طلب الإذن غير موجود.', INVALID_DECISION: 'القرار أو رقم السجل غير صحيح.', INVALID_CASH_AMOUNT: 'اكتب مبلغًا موجبًا صحيحًا بالجنيه.', INVALID_CASH_PURPOSE: 'اكتب الغرض من السلفة بوضوح (3 أحرف على الأقل).', CASH_ALREADY_REVIEWED: 'تمت مراجعة طلب السلفة بالفعل.', CASH_PAYOUT_NOT_ALLOWED: 'لا يمكن تسجيل الصرف قبل الموافقة أو تم تسجيل الصرف بالفعل.', CASH_REQUEST_NOT_FOUND: 'طلب السلفة غير موجود.', OPEN_CASH_CUSTODY: 'لا يمكن تسجيل الانصراف قبل إغلاق العهدة المفتوحة وتسوية المبلغ المتبقي.', SHEET_SCHEMA_MISMATCH: 'أعمدة الشيت لا تطابق النسخة المطلوبة. أوقف الاختبار وراجع الأعمدة.'
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
      if (data.permissions.finance) { $('cashReviewCenter').classList.remove('hidden'); await loadCashReviews(); }
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
        const status = row['حالة العهدة'] || row['حالة التسوية'] || row['حالة الصرف'] || row['الحالة'] || row['القرار'] || '';
        const date = row['التاريخ والوقت'] || row['تاريخ الإرسال'] || '';
        const canSettle = entity === 'cash' && row['حالة الصرف'] === 'تم الصرف' && ['عهدة مفتوحة','مرفوضة - تحتاج مراجعة'].includes(String(row['حالة العهدة']||''));
        const settlement = canSettle ? `<div class="cash-settlement"><strong>تسوية العهدة</strong><label>إجمالي المصروف الفعلي بالجنيه<input type="number" min="0" step="0.01" id="spent-${Number(row.__row)}" placeholder="مثال: 650"></label><label>تفاصيل المصروفات<textarea id="settle-note-${Number(row.__row)}" rows="2" maxlength="1500" placeholder="اكتب تفاصيل المصروفات"></textarea></label><button class="primary-btn" data-settle-row="${Number(row.__row)}">إرسال التسوية</button></div>` : '';
        return `<article class="record"><strong>${escapeHtml(title)}</strong><small class="record-meta">${escapeHtml(status)} · ${escapeHtml(date)}</small><small class="record-meta">المبلغ: ${escapeHtml(row['المبلغ المعتمد بالجنيه'] || row['المبلغ المطلوب بالجنيه'] || '—')} جنيه · المصروف: ${escapeHtml(row['المصروف الفعلي بالجنيه'] || 'لم يسجل')} · المطلوب إرجاعه: ${escapeHtml(row['المبلغ المطلوب إرجاعه بالجنيه'] || '—')}</small>${settlement}</article>`;
      }).join('');
      $('resultBody').querySelectorAll('[data-settle-row]').forEach(b => b.addEventListener('click', async () => {
        const row=Number(b.dataset.settleRow), spent=$(`spent-${row}`).value, notes=$(`settle-note-${row}`).value;
        b.disabled=true;
        try { const r=await api('cash_settlement_submit',{row,actualSpent:spent,notes}); messageRequest(`تم إرسال التسوية. المتبقي المطلوب إرجاعه: ${r.amountToReturn} جنيه.`); await showList('cash'); }
        catch(e){messageRequest(e.message,true);b.disabled=false;}
      }));
    } catch (e) { $('resultBody').textContent = e.message; }
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
    try { const result=await api('cash_create',{amount:$('cashAmount').value,purpose:$('cashPurpose').value}); $('cashAmount').value=''; $('cashPurpose').value=''; messageRequest(`${result.message} رقم الطلب: ${result.requestId}`); await showList('cash'); }
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
        const base=`<p>${escapeHtml(r['اسم الموظف']||'')} · ${escapeHtml(r['المبلغ المطلوب بالجنيه']||'—')} جنيه<br>${escapeHtml(r['الغرض']||'')}<br>${escapeHtml(r['التاريخ والوقت']||'')}</p>`;
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

  function messageRequest(text,isError=false){const el=$('requestMessage');el.textContent=text;el.classList.toggle('is-error',isError);el.classList.remove('hidden');}
  function switchRequestForm(which){
    $('leaveForm').classList.toggle('hidden',which!=='leave');
    $('cashForm').classList.toggle('hidden',which!=='cash');
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

  $('newLeaveTab').addEventListener('click',()=>switchRequestForm('leave'));
  $('newCashTab').addEventListener('click',()=>switchRequestForm('cash'));
  $('myRequestsTab').addEventListener('click',()=>{
    $('leaveForm').classList.add('hidden');$('cashForm').classList.add('hidden');
    $('newLeaveTab').classList.remove('active');$('newCashTab').classList.remove('active');
    $('myRequestsTab').classList.add('active');$('requestMessage').classList.add('hidden');
    showList('requests');
  });
  $('submitCash').addEventListener('click',submitCash);
  $('leaveType').addEventListener('change',syncLeaveFields);
  $('submitLeave').addEventListener('click',submitLeave);
  $('refreshReviews').addEventListener('click',loadReviews);
  $('refreshCashReviews').addEventListener('click',loadCashReviews);
  $('checkinBtn').addEventListener('click', () => withLocation('attendance_checkin', $('checkinBtn')));
  $('checkoutBtn').addEventListener('click', () => withLocation('attendance_checkout', $('checkoutBtn')));
  $('historyBtn').addEventListener('click', showAttendanceHistory);
  document.querySelectorAll('[data-uniform]').forEach(btn => btn.addEventListener('click', () => confirmUniform(btn.dataset.uniform)));
  document.querySelectorAll('[data-entity]').forEach(btn => btn.addEventListener('click', () => showList(btn.dataset.entity)));
  $('backBtn').addEventListener('click', () => $('results').classList.add('hidden'));
  start();
})();
