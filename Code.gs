/**
 * MobiHub Mini App API — V1.3 attendance + requests + leave migration build
 * Separate Apps Script project for the TEST spreadsheet.
 *
 * Required Script Properties:
 *   BOT_TOKEN       = Telegram bot token (never expose to browser)
 *   SPREADSHEET_ID  = ID of the TEST Google Spreadsheet
 *
 * This TEST API reads dashboard data and writes only approved Mini App actions.
 */

const MH = Object.freeze({
  VERSION: '1.8.0',
  TZ: 'Africa/Cairo',
  AUTH_MAX_AGE_SECONDS: 300,
  SHEETS: {
    employees: 'الموظفين',
    managers: 'المديرين',
    attendance: 'الحضور والانصراف',
    requests: 'الطلبات',
    leaves: 'طلبات الأذونات',
    cash: 'طلبات السحب',
    complaints: 'شكاوى الموظفين',
    complaintMessages: 'سجل رسائل الشكاوى',
    devices: 'الأجهزة',
    shifts: 'الورديات',
    assignments: 'جدول الورديات',
    absences: 'مراجعة الغياب',
    leaves: 'طلبات الأذونات',
    deductions: 'سجل الخصومات',
    deductionSettings: 'إعدادات الخصومات',
    rewardBonus: 'المكافآت الإضافية',
    rewardHygiene: 'تقييم نظافة المكافآت',
    overtime: 'سجل الأوفر تايم'
  }
});

/**
 * Health check only. Does not expose spreadsheet or credential details.
 */
function doGet() {
  return json_({
    ok: true,
    service: 'MobiHub Mini App API',
    version: MH.VERSION
  });
}

/**
 * Main API entry point.
 */
function doPost(e) {
  const requestId = Utilities.getUuid();

  try {
    const rawBody = e && e.postData && e.postData.contents
      ? e.postData.contents
      : '';

    if (!rawBody) {
      return json_({ ok: false, error: 'EMPTY_REQUEST', requestId: requestId });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      logApiError_('INVALID_JSON', parseError, requestId);
      return json_({ ok: false, error: 'INVALID_JSON', requestId: requestId });
    }

    const initData = String(body.initData || '');
    const telegramUser = validateTelegramInitData_(initData);

    if (!telegramUser || !telegramUser.id) {
      return json_({
        ok: false,
        error: 'UNAUTHORIZED',
        requestId: requestId
      });
    }

    const profile = resolveProfile_(String(telegramUser.id));

    if (!profile || profile.status !== 'نشط') {
      return json_({
        ok: false,
        error: 'ACCOUNT_INACTIVE',
        requestId: requestId
      });
    }

    const action = String(body.action || 'bootstrap');
    let data;

    switch (action) {
      case 'bootstrap':
        data = bootstrap_(profile);
        break;

      case 'list':
        data = listData_(profile, String(body.entity || ''));
        break;

      case 'attendance_status':
        data = attendanceStatus_(profile);
        break;

      case 'attendance_history':
        data = attendanceHistory_(profile, body.limit);
        break;

      case 'attendance_checkin':
        data = attendanceCheckin_(profile, body.location || {});
        break;

      case 'attendance_confirm_uniform':
        data = attendanceConfirmUniform_(profile, String(body.uniformStatus || ''));
        break;

      case 'attendance_checkout':
        data = attendanceCheckout_(profile, body.location || {});
        break;

      case 'request_create':
        data = createEmployeeRequest_(profile, body);
        break;

      case 'leave_create':
        data = createLeaveRequest_(profile, body);
        break;

      case 'request_decide':
        data = decideEmployeeRequest_(profile, body);
        break;

      case 'leave_decide':
        data = decideLeaveRequest_(profile, body);
        break;

      case 'cash_create':
        data = createCashRequest_(profile, body);
        break;
      case 'deduction_create':
        data = createManualDeduction_(profile, body);
        break;
      case 'deduction_decide':
        data = decideDeduction_(profile, body);
        break;
      case 'reward_bonus_create':
        data = createRewardBonus_(profile, body);
        break;
      case 'reward_hygiene_set':
        data = setRewardHygiene_(profile, body);
        break;
      case 'reward_summary':
        data = rewardSummary_(profile, body);
        break;
      case 'active_employees':
        data = activeEmployeesMini_(profile);
        break;

      case 'complaint_create':
        data = createComplaint_(profile, body);
        break;
      case 'complaint_thread':
        data = complaintThread_(profile, body);
        break;
      case 'complaint_message':
        data = complaintMessage_(profile, body);
        break;
      case 'complaint_status':
        data = complaintStatus_(profile, body);
        break;

      case 'cash_decide':
        data = decideCashRequest_(profile, body);
        break;
      case 'cash_settlement_submit':
        data = submitCashSettlement_(profile, body);
        break;

      case 'cash_settlement_decide':
        data = decideCashSettlement_(profile, body);
        break;

      case 'cash_return_confirm':
        data = confirmCashReturn_(profile, body);
        break;

      default:
        return json_({
          ok: false,
          error: 'ACTION_NOT_ALLOWED',
          requestId: requestId
        });
    }

    return json_({
      ok: true,
      data: data,
      requestId: requestId
    });

  } catch (err) {
    logApiError_('MINI_APP_API_ERROR', err, requestId);

    const safeMessage = err && err.message ? String(err.message) : '';
    const safeCode = /^[A-Z][A-Z0-9_:-]{2,120}$/.test(safeMessage) ? safeMessage : 'INTERNAL_ERROR';
    return json_({
      ok: false,
      error: safeCode,
      requestId: requestId
    });
  }
}

/**
 * Logs enough detail to diagnose the failure in Apps Script > Executions.
 * Never logs initData, bot token, spreadsheet contents, or employee data.
 */
function logApiError_(label, err, requestId) {
  const message = err && err.message ? err.message : String(err);
  const stack = err && err.stack ? err.stack : 'No stack trace available';
  const details = [
    label,
    'requestId=' + requestId,
    'message=' + message,
    'stack=' + stack
  ].join('\n');

  console.error(details);
  Logger.log(details);
}

/**
 * Telegram Mini App initData validation.
 *
 * Telegram algorithm:
 * secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)
 * calculated_hash = HMAC_SHA256(key=secret_key, message=data_check_string)
 *
 * Apps Script signature is computeHmacSha256Signature(value, key),
 * therefore the arguments below are intentionally (token, 'WebAppData').
 */
function validateTelegramInitData_(initData) {
  if (!initData) return null;

  const token = PropertiesService.getScriptProperties()
    .getProperty('BOT_TOKEN');

  if (!token) {
    throw new Error('Missing BOT_TOKEN Script Property');
  }

  const params = {};
  initData.split('&').forEach(function(part) {
    if (!part) return;

    const i = part.indexOf('=');
    if (i < 0) return;

    const key = decodeURIComponent(part.slice(0, i).replace(/\+/g, ' '));
    const value = decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
    params[key] = value;
  });

  const receivedHash = String(params.hash || '');
  if (!receivedHash) return null;

  delete params.hash;

  const keys = Object.keys(params).sort();
  const checkString = keys.map(function(key) {
    return key + '=' + params[key];
  }).join('\n');

  
  const secretKey = Utilities.computeHmacSha256Signature(
    token,
    'WebAppData'
  );

  const checkStringBytes = Utilities.newBlob(checkString).getBytes();

  const calculatedSignature = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_256,
    checkStringBytes,
    secretKey
  );

  const calculatedHash = calculatedSignature.map(function(byte) {
    return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join('');


  if (!constantTimeEqual_(calculatedHash, receivedHash)) {
    return null;
  }

  const authDate = Number(params.auth_date || 0);
  const now = Math.floor(Date.now() / 1000);

  if (!authDate || Math.abs(now - authDate) > MH.AUTH_MAX_AGE_SECONDS) {
    return null;
  }

  try {
    const user = JSON.parse(params.user || '{}');
    return user && user.id ? user : null;
  } catch (err) {
    return null;
  }
}

function constantTimeEqual_(a, b) {
  a = String(a);
  b = String(b);

  if (a.length !== b.length) return false;

  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

/**
 * Resolve the Telegram user against the TEST workbook.
 * Manager records take precedence over employee records.
 */
function resolveProfile_(chatId) {
  const ss = spreadsheet_();

  const managerRows = rowsAsObjects_(ss, MH.SHEETS.managers);
  const manager = managerRows.find(function(row) {
    return String(row['Chat ID']).trim() === chatId &&
      String(row['الحالة']).trim() === 'نشط';
  });

  if (manager) {
    return {
      chatId: chatId,
      name: String(manager['اسم المدير'] || ''),
      role: normalizeRole_(String(manager['الصلاحية'] || 'Admin')),
      status: 'نشط'
    };
  }

  const employeeRows = rowsAsObjects_(ss, MH.SHEETS.employees);
  const employee = employeeRows.find(function(row) {
    return String(row['Chat ID']).trim() === chatId &&
      String(row['الحالة']).trim() === 'نشط' &&
      String(row['حالة الحساب'] || 'نشط').trim() === 'نشط';
  });

  if (!employee) return null;

  return {
    chatId: chatId,
    name: String(employee['اسم الموظف'] || ''),
    role: normalizeRole_(String(employee['الوظيفة'] || 'Employee')),
    status: 'نشط'
  };
}

function normalizeRole_(role) {
  const value = String(role || '').trim();
  const lower = value.toLowerCase();

  if (value === 'Super Admin' || lower.indexOf('super') >= 0) {
    return 'super_admin';
  }
  if (value === 'Admin' || lower.indexOf('مدير') >= 0) {
    return 'admin';
  }
  if (value === 'Finance' || lower.indexOf('مالية') >= 0) {
    return 'finance';
  }
  if (value === 'Supervisor' || lower.indexOf('مشرف') >= 0) {
    return 'supervisor';
  }
  return 'employee';
}

/**
 * Initial read-only dashboard summary.
 */
function bootstrap_(profile) {
  const ss = spreadsheet_();

  const mine = function(sheetName, chatIdHeader) {
    return rowsAsObjects_(ss, sheetName).filter(function(row) {
      return String(row[chatIdHeader]).trim() === profile.chatId;
    });
  };

  const isManagement = [
    'super_admin', 'admin', 'finance', 'supervisor'
  ].indexOf(profile.role) >= 0;

  const complaints = rowsAsObjects_(ss, MH.SHEETS.complaints);

  return {
    profile: profile,
    permissions: {
      viewManagement: isManagement,
      reviewRequests: [
        'super_admin', 'admin', 'supervisor'
      ].indexOf(profile.role) >= 0,
      finance: [
        'super_admin', 'admin', 'finance'
      ].indexOf(profile.role) >= 0
    },
    summary: {
      myRequests: mine(MH.SHEETS.requests, 'Chat ID').length,
      myLeaves: mine(MH.SHEETS.leaves, 'Chat ID').length,
      myComplaints: mine(MH.SHEETS.complaints, 'Chat ID').length,
      openComplaints: complaints.filter(function(row) {
        const status = String(row['الحالة'] || '');
        return status.indexOf('مغلق') < 0 &&
          status.indexOf('تم الحل') < 0;
      }).length
    }
  };
}

/**
 * Read-only list endpoint.
 * Employees see their own records.
 * Admin/Super Admin/Supervisor can review requests, leaves and complaints.
 * Finance/Admin/Super Admin can review cash records.
 */
function listData_(profile, entity) {
  const definitions = {
    requests: { sheet: MH.SHEETS.requests, owner: 'Chat ID' },
    leaves: { sheet: MH.SHEETS.leaves, owner: 'Chat ID' },
    complaints: { sheet: MH.SHEETS.complaints, owner: 'Chat ID' },
    cash: { sheet: MH.SHEETS.cash, owner: 'Chat ID' },
    deductions: { sheet: MH.SHEETS.deductions, owner: 'Chat ID' },
    overtime: { sheet: MH.SHEETS.overtime, owner: 'Chat ID' },
    rewards: { sheet: MH.SHEETS.rewardBonus, owner: 'Chat ID' },
    employees: { sheet: MH.SHEETS.employees, owner: 'Chat ID' }
  };

  const definition = definitions[entity];
  if (!definition) {
    throw new Error('Unsupported entity: ' + entity);
  }

  const role = profile.role;
  if (entity === 'employees' && ['super_admin','admin','finance'].indexOf(role) < 0) throw new Error('FORBIDDEN');
  const canReviewGeneral = [
    'super_admin', 'admin', 'supervisor'
  ].indexOf(role) >= 0;

  const canReviewCash = [
    'super_admin', 'admin', 'finance'
  ].indexOf(role) >= 0;

  let canViewAll = false;

  if (entity === 'employees') {
    canViewAll = true;
  } else if (entity === 'cash' || entity === 'deductions' || entity === 'overtime' || entity === 'rewards') {
    canViewAll = canReviewCash;
  } else {
    canViewAll = canReviewGeneral;
  }

  const rows = rowsAsObjects_(spreadsheet_(), definition.sheet).map(function(row, index) { row.__row = index + 2; return row; });

  const visibleRows = canViewAll
    ? rows
    : rows.filter(function(row) {
        return String(row[definition.owner]).trim() === profile.chatId;
      });

  return visibleRows.slice(-100).reverse();
}

/**
 * ATTENDANCE MODULE V1.2
 * Uses the V40 attendance sheet schema and existing GPS policy.
 * No Telegram messages are sent from this API; the Mini App displays results.
 */
const MH_ATTENDANCE = Object.freeze({
  CENTER_LAT: 30.041124,
  CENTER_LONG: 31.204098,
  MAX_DISTANCE_METERS: 50,
  MAX_ACCURACY_METERS: 50,
  UNIFORM_CACHE_SECONDS: 600,
  FLEX_SHIFT_ID: 'FLEX_NO_FIXED_TIME',
  DEFAULT_GRACE_MINUTES: 15,
  HEADERS: ['التاريخ','الوقت','Chat ID','اسم الموظف','النوع','المسافة بالمتر','دقة GPS بالمتر','Latitude','Longitude','حالة الحضور','دقائق التأخير','Shift ID','اليونيفورم']
});

function attendanceStatus_(profile) {
  const ss = spreadsheet_();
  const date = mhToday_();
  const attendance = mhRows_(ss, MH.SHEETS.attendance);
  const mine = attendance.filter(r => String(r['Chat ID']).trim() === profile.chatId);
  const open = mhFindOpenAttendance_(mine);
  const assignment = mhAssignmentForDate_(ss, profile.chatId, date);
  const shift = assignment ? mhShiftById_(ss, assignment.shiftId) : null;
  return {
    date: date,
    hasOpenAttendance: !!open,
    openAttendance: open,
    checkedInToday: mine.some(r => mhDate_(r['التاريخ']) === date && String(r['النوع']) === 'حضور'),
    checkedOutToday: mine.some(r => mhDate_(r['التاريخ']) === date && String(r['النوع']) === 'انصراف'),
    assignment: assignment,
    shift: shift,
    gpsPolicy: { allowedDistanceMeters: MH_ATTENDANCE.MAX_DISTANCE_METERS, maxAccuracyMeters: MH_ATTENDANCE.MAX_ACCURACY_METERS }
  };
}

function attendanceHistory_(profile, requestedLimit) {
  const limit = Math.max(1, Math.min(60, Number(requestedLimit) || 30));
  const rows = mhRows_(spreadsheet_(), MH.SHEETS.attendance)
    .filter(r => String(r['Chat ID']).trim() === profile.chatId)
    .slice(-limit).reverse();
  return rows;
}

function attendanceCheckin_(profile, location) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = spreadsheet_();
    const sheet = ss.getSheetByName(MH.SHEETS.attendance);
    const gps = mhValidateLocation_(location);
    const date = mhToday_();
    const rows = mhRows_(ss, MH.SHEETS.attendance);
    const mine = rows.filter(r => String(r['Chat ID']).trim() === profile.chatId);
    if (mhFindOpenAttendance_(mine)) throw new Error('OPEN_ATTENDANCE_EXISTS');
    if (mine.some(r => mhDate_(r['التاريخ']) === date && String(r['النوع']) === 'حضور')) throw new Error('ALREADY_CHECKED_IN_TODAY');
    const assignment = mhAssignmentForDate_(ss, profile.chatId, date);
    const shift = assignment ? mhShiftById_(ss, assignment.shiftId) : null;
    if (!assignment || !shift) throw new Error('NO_ACTIVE_SHIFT_ASSIGNED');
    const pending = { date: date, time: mhNow_('HH:mm:ss'), lat: gps.lat, lon: gps.lon, accuracy: gps.accuracy, distance: gps.distance, shiftId: shift.id };
    CacheService.getScriptCache().put(mhUniformKey_(profile.chatId), JSON.stringify(pending), MH_ATTENDANCE.UNIFORM_CACHE_SECONDS);
    return { requiresUniformConfirmation: true, distanceMeters: Math.round(gps.distance), accuracyMeters: gps.accuracy, shift: shift, message: 'أكد حالة اليونيفورم لإتمام تسجيل الحضور.' };
  } finally { lock.releaseLock(); }
}

function attendanceConfirmUniform_(profile, uniformStatus) {
  if (uniformStatus !== 'ملتزم' && uniformStatus !== 'غير ملتزم') throw new Error('INVALID_UNIFORM_STATUS');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const cache = CacheService.getScriptCache();
    const key = mhUniformKey_(profile.chatId);
    const raw = cache.get(key);
    if (!raw) throw new Error('CHECKIN_CONFIRMATION_EXPIRED');
    const pending = JSON.parse(raw);
    const ss = spreadsheet_();
    const sheet = ss.getSheetByName(MH.SHEETS.attendance);
    const mine = mhRows_(ss, MH.SHEETS.attendance).filter(r => String(r['Chat ID']).trim() === profile.chatId);
    if (mhFindOpenAttendance_(mine) || mine.some(r => mhDate_(r['التاريخ']) === pending.date && String(r['النوع']) === 'حضور')) throw new Error('ALREADY_CHECKED_IN');
    const shift = mhShiftById_(ss, pending.shiftId);
    if (!shift) throw new Error('SHIFT_NOT_AVAILABLE');
    let lateMinutes = 0;
    if (!shift.isFlexible) {
      const rawLate = Math.max(0, mhMinutes_(pending.time) - mhMinutes_(shift.startTime) - shift.graceMinutes);
      lateMinutes = Math.max(0, rawLate - mhApprovedLeaveOverlap_(ss, profile.chatId, pending.date, shift.startTime, pending.time, shift.graceMinutes));
    }
    sheet.appendRow([pending.date, pending.time, profile.chatId, profile.name, 'حضور', Math.round(pending.distance), pending.accuracy, pending.lat, pending.lon, lateMinutes > 0 ? 'متأخر' : 'في الموعد', lateMinutes, pending.shiftId, uniformStatus]);
    cache.remove(key);
    return { recorded: true, type: 'حضور', date: pending.date, time: pending.time, distanceMeters: Math.round(pending.distance), accuracyMeters: pending.accuracy, uniformStatus: uniformStatus, lateMinutes: lateMinutes, attendanceStatus: lateMinutes > 0 ? 'متأخر' : 'في الموعد' };
  } finally { lock.releaseLock(); }
}

function attendanceCheckout_(profile, location) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = spreadsheet_();
    const sheet = ss.getSheetByName(MH.SHEETS.attendance);
    const gps = mhValidateLocation_(location);
    const rows = mhRows_(ss, MH.SHEETS.attendance).filter(r => String(r['Chat ID']).trim() === profile.chatId);
    const open = mhFindOpenAttendance_(rows);
    if (!open) throw new Error('NO_OPEN_ATTENDANCE');
    const openCustody = mhRows_(ss, MH.SHEETS.cash).some(r =>
      String(r['Chat ID']).trim() === profile.chatId &&
      String(r['حالة الصرف']).trim() === 'تم الصرف' &&
      ['عهدة مفتوحة','بانتظار مراجعة التسوية','بانتظار تأكيد استلام المتبقي','بانتظار صرف التعويض'].includes(String(r['حالة العهدة'] || '').trim())
    );
    if (openCustody) throw new Error('OPEN_CASH_CUSTODY');
    const date = mhToday_();
    const time = mhNow_('HH:mm:ss');
    sheet.appendRow([date, time, profile.chatId, profile.name, 'انصراف', Math.round(gps.distance), gps.accuracy, gps.lat, gps.lon, 'تم تسجيل الانصراف', 0, open.shiftId || '', '']);
    return { recorded: true, type: 'انصراف', date: date, time: time, distanceMeters: Math.round(gps.distance), accuracyMeters: gps.accuracy, checkinDate: open.date, checkinTime: open.time };
  } finally { lock.releaseLock(); }
}

function mhValidateLocation_(location) {
  const lat = Number(location.latitude), lon = Number(location.longitude);
  const accuracy = location.accuracy == null ? null : Number(location.accuracy);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('INVALID_GPS_COORDINATES');
  if (accuracy === null || !isFinite(accuracy) || accuracy <= 0 || accuracy > MH_ATTENDANCE.MAX_ACCURACY_METERS) throw new Error('GPS_ACCURACY_NOT_ACCEPTED');
  const distance = mhDistance_(MH_ATTENDANCE.CENTER_LAT, MH_ATTENDANCE.CENTER_LONG, lat, lon);
  if (distance > MH_ATTENDANCE.MAX_DISTANCE_METERS) throw new Error('OUTSIDE_ALLOWED_GEOFENCE:' + Math.round(distance));
  return { lat: lat, lon: lon, accuracy: accuracy, distance: distance };
}

function mhRows_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('MISSING_SHEET:' + sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(v => String(v).trim());
  return values.slice(1).filter(row => row.some(v => v !== '' && v !== null)).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] instanceof Date ? Utilities.formatDate(row[i], MH.TZ, 'yyyy-MM-dd HH:mm:ss') : row[i]);
    return obj;
  });
}

function mhFindOpenAttendance_(rows) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i]['النوع']).trim() === 'حضور') return { date: mhDate_(rows[i]['التاريخ']), time: mhTime_(rows[i]['الوقت']), shiftId: String(rows[i]['Shift ID'] || '') };
    if (String(rows[i]['النوع']).trim() === 'انصراف') return null;
  }
  return null;
}

function mhAssignmentForDate_(ss, chatId, date) {
  const day = new Date(date + 'T12:00:00').getDay();
  const rows = mhRows_(ss, MH.SHEETS.assignments);
  const found = rows.filter(r => String(r['Chat ID']).trim() === chatId && String(r['الحالة'] || 'نشط').trim() === 'نشط' && (!r['تاريخ البداية'] || mhDate_(r['تاريخ البداية']) <= date) && (!r['تاريخ النهاية'] || mhDate_(r['تاريخ النهاية']) >= date) && String(r['أيام العمل'] || '0,1,2,3,4,6').split(',').map(x => Number(x.trim())).includes(day));
  if (!found.length) return null;
  return { shiftId: String(found[found.length - 1]['Shift ID'] || '').trim() };
}

function mhShiftById_(ss, shiftId) {
  const row = mhRows_(ss, MH.SHEETS.shifts).find(r => String(r['Shift ID']).trim() === String(shiftId) && String(r['الحالة'] || 'نشط').trim() === 'نشط');
  if (!row) return null;
  const flexible = String(shiftId) === MH_ATTENDANCE.FLEX_SHIFT_ID || String(row['اسم الوردية']).trim() === 'بدون ميعاد ثابت';
  return { id: String(shiftId), name: String(row['اسم الوردية'] || ''), startTime: flexible ? '' : mhTime_(row['موعد الحضور']), endTime: flexible ? '' : mhTime_(row['موعد الانصراف']), graceMinutes: flexible ? 0 : Number(row['فترة السماح بالدقائق'] || MH_ATTENDANCE.DEFAULT_GRACE_MINUTES), isFlexible: flexible };
}

function mhApprovedLeaveOverlap_(ss, chatId, date, shiftStart, checkinTime, grace) {
  const start = mhMinutes_(shiftStart) + Number(grace || 0), actual = mhMinutes_(checkinTime);
  if (actual <= start) return 0;
  let overlap = 0;
  mhRows_(ss, MH.SHEETS.leaves).forEach(r => {
    if (String(r['Chat ID']).trim() === chatId && mhDate_(r['تاريخ الإذن']) === date && String(r['نوع الإذن']) === 'بالساعات' && String(r['الحالة']) === 'مقبول') {
      overlap += Math.max(0, Math.min(actual, mhMinutes_(r['إلى الساعة'])) - Math.max(start, mhMinutes_(r['من الساعة'])));
    }
  });
  return Math.min(actual - start, overlap);
}

function mhDistance_(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180, dLat = (lat2-lat1)*rad, dLon = (lon2-lon1)*rad;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function mhToday_() { return Utilities.formatDate(new Date(), MH.TZ, 'yyyy-MM-dd'); }
function mhNow_(format) { return Utilities.formatDate(new Date(), MH.TZ, format); }
function mhDate_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, MH.TZ, 'yyyy-MM-dd');
  const s = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? m[3] + '-' + ('0'+m[2]).slice(-2) + '-' + ('0'+m[1]).slice(-2) : s;
}
function mhTime_(value) { const s = String(value || '').trim(); const m=s.match(/(\d{1,2}):(\d{2})/); return m ? ('0'+m[1]).slice(-2)+':'+m[2] : s; }
function mhMinutes_(value) { const p=mhTime_(value).split(':'); return p.length<2 ? 0 : Number(p[0])*60+Number(p[1]); }
function mhUniformKey_(chatId) { return 'MH_MINI_UNIFORM_' + String(chatId); }

/**
 * Spreadsheet access helpers.
 */
function spreadsheet_() {
  const id = PropertiesService.getScriptProperties()
    .getProperty('SPREADSHEET_ID');

  if (!id) {
    throw new Error('Missing SPREADSHEET_ID Script Property');
  }

  return SpreadsheetApp.openById(id);
}

function rowsAsObjects_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Missing sheet: ' + sheetName);
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function(header) {
    return String(header).trim();
  });

  return values.slice(1)
    .filter(function(row) {
      return row.some(function(value) {
        return value !== '' && value !== null;
      });
    })
    .map(function(row) {
      const object = {};

      headers.forEach(function(header, index) {
        const value = row[index];
        object[header] = value instanceof Date
          ? Utilities.formatDate(
              value,
              MH.TZ,
              "yyyy-MM-dd'T'HH:mm:ss"
            )
          : value;
      });

      return object;
    });
}

/**
 * Diagnostic: checks required sheet existence without logging employee data.
 */
function testMiniAppConnection() {
  const ss = spreadsheet_();

  const requiredSheets = [
    MH.SHEETS.employees,
    MH.SHEETS.managers,
    MH.SHEETS.attendance,
    MH.SHEETS.requests,
    MH.SHEETS.leaves,
    MH.SHEETS.cash,
    MH.SHEETS.complaints,
    MH.SHEETS.complaintMessages,
    MH.SHEETS.devices,
    MH.SHEETS.shifts
  ];

  const existing = ss.getSheets().map(function(sheet) {
    return sheet.getName();
  });

  const report = requiredSheets.map(function(name) {
    const exists = existing.indexOf(name) >= 0;
    return {
      sheet: name,
      exists: exists,
      rows: exists ? ss.getSheetByName(name).getLastRow() : null
    };
  });

  Logger.log('Spreadsheet connection: ' + ss.getName());
  Logger.log(JSON.stringify(report, null, 2));

  const missing = report.filter(function(item) {
    return !item.exists;
  });

  if (missing.length) {
    throw new Error(
      'Missing sheets: ' +
      missing.map(function(item) { return item.sheet; }).join(', ')
    );
  }

  Logger.log('SUCCESS: all required sheets found.');
}

/**
 * Diagnostic: logs only row counts and column names, not personal values.
 */
function testMiniAppProfiles() {
  const ss = spreadsheet_();
  const employees = rowsAsObjects_(ss, MH.SHEETS.employees);
  const managers = rowsAsObjects_(ss, MH.SHEETS.managers);

  Logger.log('Employee rows: ' + employees.length);
  Logger.log('Manager rows: ' + managers.length);
  Logger.log('Employee headers: ' + JSON.stringify(
    employees.length ? Object.keys(employees[0]) : []
  ));
  Logger.log('Manager headers: ' + JSON.stringify(
    managers.length ? Object.keys(managers[0]) : []
  ));
  Logger.log('SUCCESS: profile tables readable.');
}

/**
 * Diagnostic: verifies that active rows can be resolved.
 * Does not log names or Telegram IDs.
 */
function testMiniAppRoleResolution() {
  const ss = spreadsheet_();
  const employees = rowsAsObjects_(ss, MH.SHEETS.employees);
  const managers = rowsAsObjects_(ss, MH.SHEETS.managers);

  const report = {
    employees: { total: employees.length, active: 0, recognized: 0, unrecognized: 0 },
    managers: { total: managers.length, active: 0, recognized: 0, unrecognized: 0 }
  };

  employees.forEach(function(row) {
    if (
      String(row['الحالة']).trim() !== 'نشط' ||
      String(row['حالة الحساب'] || 'نشط').trim() !== 'نشط'
    ) return;

    report.employees.active++;
    const profile = resolveProfile_(String(row['Chat ID']).trim());

    if (profile) report.employees.recognized++;
    else report.employees.unrecognized++;
  });

  managers.forEach(function(row) {
    if (String(row['الحالة']).trim() !== 'نشط') return;

    report.managers.active++;
    const profile = resolveProfile_(String(row['Chat ID']).trim());

    if (profile) report.managers.recognized++;
    else report.managers.unrecognized++;
  });

  Logger.log(JSON.stringify(report, null, 2));
  Logger.log('Role resolution test completed.');
}

/**
 * Diagnostic: checks Script Properties without printing their values.
 */
function testMiniAppConfiguration() {
  const properties = PropertiesService.getScriptProperties();
  const hasToken = !!properties.getProperty('BOT_TOKEN');
  const hasSpreadsheetId = !!properties.getProperty('SPREADSHEET_ID');

  const report = {
    BOT_TOKEN_configured: hasToken,
    SPREADSHEET_ID_configured: hasSpreadsheetId
  };

  Logger.log(JSON.stringify(report, null, 2));

  if (!hasToken || !hasSpreadsheetId) {
    throw new Error('One or more required Script Properties are missing.');
  }

  Logger.log('SUCCESS: required Script Properties are configured.');
}

/**
 * JSON response helper.
 */
function json_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}


/* =========================================
 * REQUESTS + LEAVE MODULE — V1.3
 * Mirrors V40 sheet schemas and decision rules.
 * All authorization is enforced here, never by UI visibility alone.
 * ========================================= */
const MH_REQUESTS = Object.freeze({
  REQUEST_HEADERS: ['التاريخ والوقت','Chat ID','اسم الموظف','نوع الطلب','التفاصيل','القرار','مبلغ السلفة بالجنيه','سبب السلفة','نوع مدة الإذن','عدد الأيام','عدد الساعات','سبب الإذن'],
  LEAVE_HEADERS: ['رقم الطلب','تاريخ الإرسال','Chat ID','اسم الموظف','نوع الإذن','تاريخ الإذن','من الساعة','إلى الساعة','السبب','الحالة','قرار المدير','تاريخ القرار','ملاحظات المدير','عدد الأيام','تاريخ نهاية الإذن','Chat ID المدير','اسم المدير'],
  PENDING_REQUEST: 'قيد الانتظار',
  PENDING_LEAVE: 'بانتظار مراجعة المدير'
});

function mhRequireRole_(profile, allowed) {
  if (allowed.indexOf(profile.role) < 0) throw new Error('FORBIDDEN');
}
function mhSheet_(name) {
  const sh = spreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('SHEET_NOT_FOUND:' + name);
  return sh;
}
function mhHeaderMap_(sh) {
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
  const map = {};
  headers.forEach((h,i) => { if (h) map[String(h).trim()] = i+1; });
  return map;
}
function mhAssertHeaders_(sh, expected) {
  const map = mhHeaderMap_(sh);
  const missing = expected.filter(h => !map[h]);
  if (missing.length) throw new Error('SHEET_SCHEMA_MISMATCH:' + sh.getName() + ':' + missing.join(','));
  return map;
}
function mhNow_() { return Utilities.formatDate(new Date(), MH.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function mhToday_() { return Utilities.formatDate(new Date(), MH.TZ, 'yyyy-MM-dd'); }
function mhIsoDate_(value) {
  const s = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(s + 'T12:00:00Z');
  return !isNaN(d.getTime()) && Utilities.formatDate(d,'UTC','yyyy-MM-dd') === s ? s : '';
}
function mhAddDays_(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0],p[1]-1,p[2]+n,12));
  return Utilities.formatDate(d,'UTC','yyyy-MM-dd');
}
function mhTimeMinutes_(s) {
  const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) return -1;
  return +m[1]*60 + +m[2];
}
function mhRowsObjects_(sh) {
  const values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0].map(x => String(x).trim());
  return values.slice(1).map((row,i) => {
    const o = {__row:i+2}; headers.forEach((h,j) => { if(h) o[h]=row[j]; }); return o;
  });
}
function mhManagerName_(profile) { return profile.name || profile.chatId; }

/* CASH ADVANCE / CUSTODY MODULE — V1.4 */
const MH_CASH = Object.freeze({
  HEADERS: ['رقم الطلب','التاريخ والوقت','Chat ID','اسم الموظف','المبلغ المطلوب بالجنيه','الغرض','الحالة','المبلغ المعتمد بالجنيه','حالة الصرف','المسؤول عن الصرف','تاريخ الصرف','حالة العهدة','ملاحظات المدير','تاريخ آخر تحديث','المصروف الفعلي بالجنيه','المبلغ المطلوب إرجاعه بالجنيه','المبلغ الإضافي المستحق للموظف بالجنيه','حالة التسوية','تاريخ تقديم التسوية','تاريخ تأكيد استلام المتبقي','المسؤول عن استلام المتبقي','حالة التعويض','تاريخ اعتماد التعويض','تاريخ صرف التعويض','ملاحظات التسوية','Chat ID آخر مدير قرار','اسم آخر مدير قرار'],
  REVIEW_ROLES: ['super_admin','admin','finance']
});
function createCashRequest_(profile, body) {
  if (profile.role !== 'employee') throw new Error('EMPLOYEE_ONLY');
  const amountRaw = String(body.amount ?? '').replace(/[٬,]/g, '').trim();
  const amount = Number(amountRaw);
  if (!/^\d+(?:\.\d{1,2})?$/.test(amountRaw) || !Number.isFinite(amount) || amount <= 0 || amount > 1000000) throw new Error('INVALID_CASH_AMOUNT');
  const sh = mhSheet_(MH.SHEETS.cash); mhAssertHeaders_(sh, MH_CASH.HEADERS);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const id = 'CASH-' + Utilities.formatDate(new Date(), MH.TZ, 'yyyyMMdd-HHmmss') + '-' + String(profile.chatId).slice(-4);
    const row = new Array(MH_CASH.HEADERS.length).fill('');
    const set = (h,v) => row[MH_CASH.HEADERS.indexOf(h)] = v;
    set('رقم الطلب',id); set('التاريخ والوقت',mhNow_()); set('Chat ID',profile.chatId); set('اسم الموظف',profile.name);
    set('المبلغ المطلوب بالجنيه',amount); set('الغرض',''); set('الحالة','قيد المراجعة'); set('حالة الصرف','لم يصرف');
    set('حالة العهدة','غير مطلوبة بعد'); set('تاريخ آخر تحديث',mhNow_()); sh.appendRow(row);
    return {submitted:true,requestId:id,status:'قيد المراجعة',message:'تم إرسال طلب السلفة/العهدة إلى الإدارة للمراجعة.'};
  } finally { lock.releaseLock(); }
}
function decideCashRequest_(profile, body) {
  mhRequireRole_(profile, MH_CASH.REVIEW_ROLES);
  const rowNum=Number(body.row), decision=String(body.decision||'').trim(), note=String(body.note||'').trim();
  if (!Number.isInteger(rowNum)||rowNum<2||!['مقبول','مرفوض','تم الصرف'].includes(decision)) throw new Error('INVALID_DECISION');
  const sh=mhSheet_(MH.SHEETS.cash), map=mhAssertHeaders_(sh,MH_CASH.HEADERS);
  if(rowNum>sh.getLastRow()) throw new Error('CASH_REQUEST_NOT_FOUND');
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const current=String(sh.getRange(rowNum,map['الحالة']).getDisplayValue()).trim();
    const payout=String(sh.getRange(rowNum,map['حالة الصرف']).getDisplayValue()).trim();
    if(decision==='تم الصرف') {
      if(current!=='تمت الموافقة'||payout==='تم الصرف') throw new Error('CASH_PAYOUT_NOT_ALLOWED');
      sh.getRange(rowNum,map['حالة الصرف']).setValue('تم الصرف'); sh.getRange(rowNum,map['تاريخ الصرف']).setValue(mhNow_());
      sh.getRange(rowNum,map['المسؤول عن الصرف']).setValue(mhManagerName_(profile)); sh.getRange(rowNum,map['حالة العهدة']).setValue('عهدة مفتوحة');
    } else {
      if(current!=='قيد المراجعة') throw new Error('CASH_ALREADY_REVIEWED');
      sh.getRange(rowNum,map['الحالة']).setValue(decision==='مقبول'?'تمت الموافقة':'مرفوض');
      if(decision==='مقبول') {
        const requested=Number(sh.getRange(rowNum,map['المبلغ المطلوب بالجنيه']).getValue())||0;
        sh.getRange(rowNum,map['المبلغ المعتمد بالجنيه']).setValue(requested);
        sh.getRange(rowNum,map['حالة الصرف']).setValue('بانتظار الصرف'); sh.getRange(rowNum,map['حالة العهدة']).setValue('بانتظار صرف العهدة');
      }
    }
    if(note&&map['ملاحظات المدير']) sh.getRange(rowNum,map['ملاحظات المدير']).setValue(note);
    if(map['تاريخ آخر تحديث']) sh.getRange(rowNum,map['تاريخ آخر تحديث']).setValue(mhNow_());
    if(map['Chat ID آخر مدير قرار']) sh.getRange(rowNum,map['Chat ID آخر مدير قرار']).setValue(profile.chatId);
    if(map['اسم آخر مدير قرار']) sh.getRange(rowNum,map['اسم آخر مدير قرار']).setValue(mhManagerName_(profile));
    return {decided:true,status:decision};
  } finally { lock.releaseLock(); }
}

function submitCashSettlement_(profile, body) {
  if (profile.role !== 'employee') throw new Error('EMPLOYEE_ONLY');
  const rowNum = Number(body.row);
  const spentRaw = String(body.actualSpent ?? '').replace(/[٬,]/g, '').trim();
  const spent = Number(spentRaw);
  const notes = String(body.notes || '').trim();
  if (!Number.isInteger(rowNum) || rowNum < 2) throw new Error('CASH_REQUEST_NOT_FOUND');
  if (!/^\d+(?:\.\d{1,2})?$/.test(spentRaw) || !Number.isFinite(spent) || spent < 0 || spent > 1000000) throw new Error('INVALID_CASH_AMOUNT');
  if (notes.length > 1500) throw new Error('INVALID_REQUEST_DETAILS');
  const sh = mhSheet_(MH.SHEETS.cash), map = mhAssertHeaders_(sh, MH_CASH.HEADERS);
  if (rowNum > sh.getLastRow()) throw new Error('CASH_REQUEST_NOT_FOUND');
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const values = sh.getRange(rowNum,1,1,sh.getLastColumn()).getValues()[0];
    const get = h => values[map[h]-1];
    if (String(get('Chat ID')).trim() !== profile.chatId) throw new Error('FORBIDDEN');
    if (String(get('حالة الصرف')).trim() !== 'تم الصرف') throw new Error('CASH_PAYOUT_NOT_ALLOWED');
    if (String(get('حالة التسوية') || '').trim() === 'بانتظار مراجعة التسوية' ||
        String(get('حالة التسوية') || '').trim() === 'تم اعتماد التسوية') throw new Error('CASH_ALREADY_REVIEWED');
    const approved = Number(get('المبلغ المعتمد بالجنيه') || get('المبلغ المطلوب بالجنيه')) || 0;
    if (spent > 1000000) throw new Error('INVALID_CASH_AMOUNT');
    const returned = Math.max(0, approved - spent);
    const extra = Math.max(0, spent - approved);
    sh.getRange(rowNum,map['المصروف الفعلي بالجنيه']).setValue(spent);
    sh.getRange(rowNum,map['المبلغ المطلوب إرجاعه بالجنيه']).setValue(returned);
    sh.getRange(rowNum,map['المبلغ الإضافي المستحق للموظف بالجنيه']).setValue(extra);
    sh.getRange(rowNum,map['حالة التسوية']).setValue('بانتظار مراجعة التسوية');
    sh.getRange(rowNum,map['تاريخ تقديم التسوية']).setValue(mhNow_());
    sh.getRange(rowNum,map['ملاحظات التسوية']).setValue(notes);
    sh.getRange(rowNum,map['حالة العهدة']).setValue('بانتظار مراجعة التسوية');
    sh.getRange(rowNum,map['تاريخ آخر تحديث']).setValue(mhNow_());
    return {submitted:true, approvedAmount:approved, actualSpent:spent, amountToReturn:returned, extraDue:extra, status:'بانتظار مراجعة التسوية'};
  } finally { lock.releaseLock(); }
}

function decideCashSettlement_(profile, body) {
  mhRequireRole_(profile, MH_CASH.REVIEW_ROLES);
  const rowNum = Number(body.row), decision = String(body.decision || '').trim(), note = String(body.note || '').trim();
  if (!Number.isInteger(rowNum) || rowNum < 2 || !['مقبول','مرفوض'].includes(decision)) throw new Error('INVALID_DECISION');
  const sh = mhSheet_(MH.SHEETS.cash), map = mhAssertHeaders_(sh, MH_CASH.HEADERS);
  if (rowNum > sh.getLastRow()) throw new Error('CASH_REQUEST_NOT_FOUND');
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const get = h => sh.getRange(rowNum,map[h]).getDisplayValue().trim();
    if (get('حالة التسوية') !== 'بانتظار مراجعة التسوية') throw new Error('CASH_ALREADY_REVIEWED');
    if (decision === 'مرفوض') {
      sh.getRange(rowNum,map['حالة التسوية']).setValue('مرفوضة - تحتاج مراجعة');
      sh.getRange(rowNum,map['حالة العهدة']).setValue('عهدة مفتوحة');
    } else {
      const returned = Number(sh.getRange(rowNum,map['المبلغ المطلوب إرجاعه بالجنيه']).getValue()) || 0;
      const extra = Number(sh.getRange(rowNum,map['المبلغ الإضافي المستحق للموظف بالجنيه']).getValue()) || 0;
      sh.getRange(rowNum,map['حالة التسوية']).setValue('تم اعتماد التسوية');
      if (returned > 0) sh.getRange(rowNum,map['حالة العهدة']).setValue('بانتظار تأكيد استلام المتبقي');
      else if (extra > 0) sh.getRange(rowNum,map['حالة العهدة']).setValue('بانتظار صرف التعويض');
      else sh.getRange(rowNum,map['حالة العهدة']).setValue('مغلقة');
    }
    if (map['ملاحظات المدير']) sh.getRange(rowNum,map['ملاحظات المدير']).setValue(note);
    if (map['تاريخ آخر تحديث']) sh.getRange(rowNum,map['تاريخ آخر تحديث']).setValue(mhNow_());
    if (map['Chat ID آخر مدير قرار']) sh.getRange(rowNum,map['Chat ID آخر مدير قرار']).setValue(profile.chatId);
    if (map['اسم آخر مدير قرار']) sh.getRange(rowNum,map['اسم آخر مدير قرار']).setValue(mhManagerName_(profile));
    return {decided:true,status:decision};
  } finally { lock.releaseLock(); }
}

function confirmCashReturn_(profile, body) {
  mhRequireRole_(profile, MH_CASH.REVIEW_ROLES);
  const rowNum = Number(body.row);
  if (!Number.isInteger(rowNum) || rowNum < 2) throw new Error('CASH_REQUEST_NOT_FOUND');
  const sh = mhSheet_(MH.SHEETS.cash), map = mhAssertHeaders_(sh, MH_CASH.HEADERS);
  if (rowNum > sh.getLastRow()) throw new Error('CASH_REQUEST_NOT_FOUND');
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (sh.getRange(rowNum,map['حالة العهدة']).getDisplayValue().trim() !== 'بانتظار تأكيد استلام المتبقي') throw new Error('CASH_ALREADY_REVIEWED');
    sh.getRange(rowNum,map['تاريخ تأكيد استلام المتبقي']).setValue(mhNow_());
    sh.getRange(rowNum,map['المسؤول عن استلام المتبقي']).setValue(mhManagerName_(profile));
    sh.getRange(rowNum,map['حالة العهدة']).setValue('مغلقة');
    sh.getRange(rowNum,map['تاريخ آخر تحديث']).setValue(mhNow_());
    return {confirmed:true,status:'مغلقة'};
  } finally { lock.releaseLock(); }
}

function createEmployeeRequest_(profile, body) {
  if (profile.role !== 'employee') throw new Error('EMPLOYEE_ONLY');
  const type = String(body.requestType || '').trim();
  const details = String(body.details || '').trim();
  const allowed = ['طلب إداري','طلب تغيير وردية','طلب مراجعة','طلب آخر'];
  if (allowed.indexOf(type) < 0) throw new Error('INVALID_REQUEST_TYPE');
  if (details.length < 5 || details.length > 1500) throw new Error('INVALID_REQUEST_DETAILS');
  const sh = mhSheet_(MH.SHEETS.requests);
  mhAssertHeaders_(sh, MH_REQUESTS.REQUEST_HEADERS);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const id = sh.getLastRow();
    sh.appendRow([mhNow_(),profile.chatId,profile.name,type,details,MH_REQUESTS.PENDING_REQUEST,'','','','','','']);
    return {submitted:true, row:id+1, status:MH_REQUESTS.PENDING_REQUEST, message:'تم إرسال طلبك للإدارة'};
  } finally { lock.releaseLock(); }
}
function mhGetAssignment_(chatId, date) {
  const sh = mhSheet_(MH.SHEETS.assignments); const rows = mhRowsObjects_(sh);
  const row = rows.find(r => String(r['Chat ID']).trim()===String(chatId) && String(r['الحالة']).trim()==='نشط' &&
    mhIsoDate_(r['تاريخ البداية']) <= date && (!mhIsoDate_(r['تاريخ النهاية']) || mhIsoDate_(r['تاريخ النهاية']) >= date) &&
    String(r['أيام العمل'] || '0,1,2,3,4,6').split(/[،,]/).map(x=>x.trim()).includes(String(new Date(date+'T12:00:00Z').getUTCDay())));
  if (!row) return null;
  const shifts = mhRowsObjects_(mhSheet_(MH.SHEETS.shifts));
  const shift = shifts.find(s => String(s['Shift ID']).trim()===String(row['Shift ID']).trim() && String(s['الحالة']).trim()==='نشط');
  return shift ? {assignment:row, shift:shift} : null;
}
function createLeaveRequest_(profile, body) {
  if (profile.role !== 'employee') throw new Error('EMPLOYEE_ONLY');
  const type = String(body.leaveType || '').trim();
  const date = mhIsoDate_(body.date);
  const reason = String(body.reason || '').trim();
  if (['يوم كامل','بالساعات'].indexOf(type)<0) throw new Error('INVALID_LEAVE_TYPE');
  if (!date || date < mhToday_()) throw new Error('INVALID_LEAVE_DATE');
  if (reason.length < 5 || reason.length > 1000) throw new Error('INVALID_LEAVE_REASON');
  let from='',to='',days=0,endDate=date;
  if (type==='يوم كامل') {
    days = Number(body.days || 1);
    if (![1,2,3].includes(days)) throw new Error('INVALID_LEAVE_DAYS');
    endDate = mhAddDays_(date,days-1);
    if (date===mhToday_()) {
      const ass=mhGetAssignment_(profile.chatId,date);
      if (ass && mhTimeMinutes_(Utilities.formatDate(new Date(),MH.TZ,'HH:mm')) > mhTimeMinutes_(ass.shift['موعد الحضور'])) throw new Error('FULL_DAY_LEAVE_AFTER_SHIFT_START');
    }
  } else {
    const ass=mhGetAssignment_(profile.chatId,date);
    if (!ass) throw new Error('NO_ACTIVE_SHIFT_ASSIGNED');
    from=String(body.from || '').trim();
    const hours=Number(body.hours);
    if (![1,2,3].includes(hours)) throw new Error('INVALID_LEAVE_HOURS');
    const start=mhTimeMinutes_(from), shiftStart=mhTimeMinutes_(ass.shift['موعد الحضور']), shiftEnd0=mhTimeMinutes_(ass.shift['موعد الانصراف']);
    if (start<0 || shiftStart<0 || shiftEnd0<0) throw new Error('INVALID_LEAVE_TIME');
    let end=shiftEnd0; if(end<=shiftStart) end+=1440;
    let actualStart=start; if(actualStart<shiftStart) actualStart+=1440;
    if (actualStart < shiftStart || actualStart + hours*60 > end) throw new Error('LEAVE_OUTSIDE_SHIFT');
    if (date===mhToday_() && start <= mhTimeMinutes_(Utilities.formatDate(new Date(),MH.TZ,'HH:mm'))) throw new Error('LEAVE_START_NOT_FUTURE');
    to=('0'+Math.floor((start+hours*60)%1440/60)).slice(-2)+':'+('0'+((start+hours*60)%60)).slice(-2);
  }
  const sh=mhSheet_(MH.SHEETS.leaves); mhAssertHeaders_(sh,MH_REQUESTS.LEAVE_HEADERS);
  const rows=mhRowsObjects_(sh);
  const overlap=rows.some(r=>String(r['Chat ID']).trim()===profile.chatId && [MH_REQUESTS.PENDING_LEAVE,'مقبول'].includes(String(r['الحالة'])) &&
    date <= (mhDate_(r['تاريخ نهاية الإذن']) || mhDate_(r['تاريخ الإذن'])) && endDate >= mhDate_(r['تاريخ الإذن']));
  if(overlap) throw new Error('DUPLICATE_LEAVE_OVERLAP');
  const id='LV-'+Utilities.getUuid().substring(0,8).toUpperCase();
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    sh.appendRow([id,mhNow_(),profile.chatId,profile.name,type,date,from,to,reason,MH_REQUESTS.PENDING_LEAVE,'','','',days,endDate,'','']);
  } finally { lock.releaseLock(); }
  return {submitted:true, requestId:id, status:MH_REQUESTS.PENDING_LEAVE, message:'تم إرسال طلب الإذن. لا يعتبر معتمدًا قبل موافقة الإدارة.'};
}
function decideEmployeeRequest_(profile, body) {
  mhRequireRole_(profile,['super_admin','admin','supervisor']);
  const rowNum=Number(body.row), decision=String(body.decision || '');
  if (!Number.isInteger(rowNum)||rowNum<2||!['مقبول','مرفوض'].includes(decision)) throw new Error('INVALID_DECISION');
  const sh=mhSheet_(MH.SHEETS.requests); const map=mhAssertHeaders_(sh,MH_REQUESTS.REQUEST_HEADERS);
  if(rowNum>sh.getLastRow()) throw new Error('REQUEST_NOT_FOUND');
  const current=String(sh.getRange(rowNum,map['القرار']).getDisplayValue());
  if(current!==MH_REQUESTS.PENDING_REQUEST) throw new Error('REQUEST_ALREADY_REVIEWED');
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try { sh.getRange(rowNum,map['القرار']).setValue(decision); } finally { lock.releaseLock(); }
  return {decided:true,status:decision};
}
function decideLeaveRequest_(profile, body) {
  mhRequireRole_(profile,['super_admin','admin','supervisor']);
  const rowNum=Number(body.row), decision=String(body.decision || ''), note=String(body.note || '').trim();
  if(!Number.isInteger(rowNum)||rowNum<2||!['مقبول','مرفوض'].includes(decision)) throw new Error('INVALID_DECISION');
  const sh=mhSheet_(MH.SHEETS.leaves); const map=mhAssertHeaders_(sh,MH_REQUESTS.LEAVE_HEADERS);
  if(rowNum>sh.getLastRow()) throw new Error('LEAVE_NOT_FOUND');
  const vals=sh.getRange(rowNum,1,1,sh.getLastColumn()).getDisplayValues()[0];
  const get=h=>vals[map[h]-1] || '';
  if(get('الحالة')!==MH_REQUESTS.PENDING_LEAVE) throw new Error('LEAVE_ALREADY_REVIEWED');
  if(decision==='مقبول' && get('نوع الإذن')==='يوم كامل') {
    const abs=mhRowsObjects_(mhSheet_(MH.SHEETS.absences));
    const start=mhIsoDate_(get('تاريخ الإذن')), end=mhIsoDate_(get('تاريخ نهاية الإذن'))||start;
    const confirmed=abs.some(a=>String(a['Chat ID']).trim()===String(get('Chat ID')).trim() && mhIsoDate_(a['التاريخ'])>=start && mhIsoDate_(a['التاريخ'])<=end && (String(a['الحالة'])==='غياب مؤكد'||String(a['قرار المدير'])==='تأكيد الغياب'));
    if(confirmed) throw new Error('LEAVE_CONFLICT_CONFIRMED_ABSENCE');
  }
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    sh.getRange(rowNum,map['الحالة']).setValue(decision);
    sh.getRange(rowNum,map['قرار المدير']).setValue(decision==='مقبول'?'موافقة':'رفض');
    sh.getRange(rowNum,map['تاريخ القرار']).setValue(mhNow_());
    if(map['ملاحظات المدير']) sh.getRange(rowNum,map['ملاحظات المدير']).setValue(note);
    if(map['Chat ID المدير']) sh.getRange(rowNum,map['Chat ID المدير']).setValue(profile.chatId);
    if(map['اسم المدير']) sh.getRange(rowNum,map['اسم المدير']).setValue(mhManagerName_(profile));
    if(decision==='مقبول' && get('نوع الإذن')==='يوم كامل') {
      const absSh=mhSheet_(MH.SHEETS.absences), absMap=mhHeaderMap_(absSh), absRows=mhRowsObjects_(absSh);
      absRows.forEach(a=>{const d=mhIsoDate_(a['التاريخ']); if(String(a['Chat ID']).trim()===String(get('Chat ID')).trim() && d>=mhIsoDate_(get('تاريخ الإذن')) && d<=(mhIsoDate_(get('تاريخ نهاية الإذن'))||mhIsoDate_(get('تاريخ الإذن'))) && String(a['الحالة'])==='بانتظار مراجعة المدير') { if(absMap['الحالة']) absSh.getRange(a.__row,absMap['الحالة']).setValue('مغلق - إذن معتمد'); if(absMap['قرار المدير']) absSh.getRange(a.__row,absMap['قرار المدير']).setValue('إذن يوم كامل معتمد'); if(absMap['تاريخ القرار']) absSh.getRange(a.__row,absMap['تاريخ القرار']).setValue(mhNow_()); }});
    }
  } finally { lock.releaseLock(); }
  return {decided:true,status:decision,requestId:get('رقم الطلب')};
}


/* COMPLAINTS + TWO-WAY THREAD — V1.7 */
const MH_COMPLAINT = Object.freeze({
  HEADERS: ['رقم الشكوى','التاريخ والوقت','Chat ID','اسم الموظف','نوع الشكوى','الشخص المعني','تفاصيل الشكوى','الحالة','ملاحظات المدير','تاريخ آخر تحديث','نتيجة التعامل'],
  MESSAGE_HEADERS: ['رقم الرسالة','رقم الشكوى','Chat ID المرسل','صفة المرسل','اسم المرسل','نص الرسالة','التاريخ والوقت'],
  REVIEW_ROLES: ['super_admin','admin','supervisor']
});
function createComplaint_(profile, body) {
  if (profile.role !== 'employee') throw new Error('EMPLOYEE_ONLY');
  const type=String(body.type||'').trim(), person=String(body.person||'').trim(), details=String(body.details||'').trim();
  if (!['شكوى إدارية','شكوى بخصوص موظف','شكوى بخصوص العمل','اقتراح','أخرى'].includes(type) || details.length<10 || details.length>3000 || person.length>120) throw new Error('INVALID_COMPLAINT');
  const sh=mhSheet_(MH.SHEETS.complaints); mhAssertHeaders_(sh,MH_COMPLAINT.HEADERS);
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const now=mhNow_(), id='CMP-'+Utilities.formatDate(new Date(),MH.TZ,'yyyyMMdd-HHmmss')+'-'+String(profile.chatId).slice(-4);
    const row=new Array(MH_COMPLAINT.HEADERS.length).fill('');
    const set=(h,v)=>row[MH_COMPLAINT.HEADERS.indexOf(h)]=v;
    set('رقم الشكوى',id);set('التاريخ والوقت',now);set('Chat ID',profile.chatId);set('اسم الموظف',profile.name);
    set('نوع الشكوى',type);set('الشخص المعني',person);set('تفاصيل الشكوى',details);set('الحالة','جديدة');set('تاريخ آخر تحديث',now);
    sh.appendRow(row);
    return {submitted:true,complaintId:id,status:'جديدة',message:'تم تسجيل الشكوى.'};
  } finally {lock.releaseLock();}
}
function complaintRecord_(profile, complaintId) {
  const sh=mhSheet_(MH.SHEETS.complaints); mhAssertHeaders_(sh,MH_COMPLAINT.HEADERS);
  const vals=sh.getDataRange().getValues(), headers=vals[0].map(String);
  const idx=headers.indexOf('رقم الشكوى'), owner=headers.indexOf('Chat ID');
  for(let i=1;i<vals.length;i++) if(String(vals[i][idx])===String(complaintId)) {
    const isReviewer=MH_COMPLAINT.REVIEW_ROLES.includes(profile.role);
    if(!isReviewer && String(vals[i][owner])!==profile.chatId) throw new Error('FORBIDDEN');
    const o={};headers.forEach((h,j)=>o[h]=vals[i][j]);
    return {sheet:sh,row:i+1,data:o};
  }
  throw new Error('COMPLAINT_NOT_FOUND');
}
function complaintThread_(profile, body) {
  const c=complaintRecord_(profile,String(body.complaintId||''));
  const ms=mhSheet_(MH.SHEETS.complaintMessages); mhAssertHeaders_(ms,MH_COMPLAINT.MESSAGE_HEADERS);
  const rows=ms.getDataRange().getValues(), h=rows[0].map(String), out=[];
  for(let i=1;i<rows.length;i++) if(String(rows[i][h.indexOf('رقم الشكوى')])===String(body.complaintId)) {
    const m={};h.forEach((k,j)=>m[k]=rows[i][j]);
    out.push({senderRole:m['صفة المرسل'],senderName:m['اسم المرسل'],message:m['نص الرسالة'],createdAt:m['التاريخ والوقت']});
  }
  const d=c.data;
  return {complaint:{id:d['رقم الشكوى'],type:d['نوع الشكوى'],status:d['الحالة'],createdAt:d['التاريخ والوقت'],details:d['تفاصيل الشكوى'],employeeName:d['اسم الموظف']},messages:out.slice(-100)};
}
function complaintMessage_(profile, body) {
  const id=String(body.complaintId||''), message=String(body.message||'').trim();
  if(message.length<2||message.length>2000) throw new Error('INVALID_COMPLAINT_MESSAGE');
  const c=complaintRecord_(profile,id);
  if(String(c.data['الحالة'])==='مغلقة') throw new Error('COMPLAINT_CLOSED');
  const sh=mhSheet_(MH.SHEETS.complaintMessages); mhAssertHeaders_(sh,MH_COMPLAINT.MESSAGE_HEADERS);
  const role=profile.role==='employee'?'موظف':'مدير', now=mhNow_();
  sh.appendRow(['MSG-'+Utilities.getUuid(),id,profile.chatId,role,profile.name,message,now]);
  c.sheet.getRange(c.row,10).setValue(now);
  c.sheet.getRange(c.row,8).setValue(role==='موظف'?'بانتظار رد الإدارة':'بانتظار رد الموظف');
  return {sent:true,createdAt:now};
}
function complaintStatus_(profile, body) {
  mhRequireRole_(profile,MH_COMPLAINT.REVIEW_ROLES);
  const c=complaintRecord_(profile,String(body.complaintId||''));
  const next=String(body.status||''), note=String(body.note||'').trim();
  const allowed=['قيد التحقيق','تم الحل','مغلقة'];
  const current=String(c.data['الحالة']||'');
  const transitions={'جديدة':['قيد التحقيق','تم الحل','مغلقة'],'قيد التحقيق':['تم الحل','مغلقة'],'بانتظار رد الإدارة':['قيد التحقيق','تم الحل','مغلقة'],'بانتظار رد الموظف':['قيد التحقيق','تم الحل','مغلقة'],'تم الحل':['مغلقة']};
  if(!allowed.includes(next)||!(transitions[current]||[]).includes(next)) throw new Error('INVALID_COMPLAINT_STATUS');
  const now=mhNow_();c.sheet.getRange(c.row,8).setValue(next);c.sheet.getRange(c.row,9).setValue(note);c.sheet.getRange(c.row,10).setValue(now);
  return {updated:true,status:next};
}


/* =========================================
 * DEDUCTIONS + REWARDS MODULE — V1.8
 * Sheet headers are aligned to the supplied TEST workbook and V40.
 * ========================================= */
const MH_FINANCE = Object.freeze({
  DEDUCTION_HEADERS: ['رقم الخصم','تاريخ الواقعة','Chat ID','اسم الموظف','نوع الخصم','السبب','المبلغ بالجنيه','المصدر','الحالة','مرجع الواقعة','تاريخ التسجيل','تاريخ الاعتماد','منفذ الإجراء','ملاحظات','سبب الرفض/الإلغاء'],
  DEDUCTION_SETTINGS_HEADERS: ['الإعداد','القيمة','الوصف'],
  REWARD_BONUS_HEADERS: ['رقم المكافأة','التاريخ','الشهر','Chat ID','اسم الموظف','المبلغ بالجنيه','السبب','المسجل بواسطة','الحالة'],
  REWARD_HYGIENE_HEADERS: ['التاريخ','Chat ID','اسم الموظف','التقييم','ملاحظات','قيّم بواسطة','وقت التقييم'],
  BASE_REWARD: 500,
  DAILY_POINTS: 2,
  REVIEW_ROLES: ['super_admin','admin','finance']
});

function financeEmployee_(chatId) {
  const rows = rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees);
  const e = rows.find(r => String(r['Chat ID']).trim() === String(chatId) &&
    String(r['الحالة']).trim() === 'نشط' &&
    String(r['حالة الحساب'] || 'نشط').trim() === 'نشط');
  if (!e) throw new Error('EMPLOYEE_NOT_FOUND');
  return {chatId:String(chatId), name:String(e['اسم الموظف'] || '')};
}
function financeMonth_(value) {
  const m = String(value || mhToday_().slice(0,7));
  if (!/^\\d{4}-\\d{2}$/.test(m)) throw new Error('INVALID_MONTH');
  return m;
}
function financeNumber_(value, max) {
  const raw=String(value ?? '').replace(/[٬,]/g,'').trim();
  const n=Number(raw);
  if (!/^\\d+(?:\\.\\d{1,2})?$/.test(raw) || !Number.isFinite(n) || n<=0 || n>(max||1000000)) throw new Error('INVALID_AMOUNT');
  return Math.round(n*100)/100;
}
function createManualDeduction_(profile, body) {
  mhRequireRole_(profile, MH_FINANCE.REVIEW_ROLES);
  const employee=financeEmployee_(String(body.employeeId||''));
  const type=String(body.type||'خصم آخر').trim();
  const reason=String(body.reason||'').trim();
  const amount=financeNumber_(body.amount,1000000);
  const allowed=['التأخير','عدم الالتزام باليونيفورم','عدم التسجيل على السيستم','خصم آخر','نظافة المكان'];
  if (!allowed.includes(type) || reason.length<3 || reason.length>500) throw new Error('INVALID_DEDUCTION');
  const sh=mhSheet_(MH.SHEETS.deductions); mhAssertHeaders_(sh,MH_FINANCE.DEDUCTION_HEADERS);
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const now=mhNow_(), id='DD-'+Utilities.getUuid().slice(0,8).toUpperCase();
    sh.appendRow([id,mhToday_(),employee.chatId,employee.name,type,reason,amount,'يدوي','بانتظار اعتماد المدير','MANUAL|'+id,now,'',profile.chatId,'من Mini App','']);
    return {created:true,deductionId:id,status:'بانتظار اعتماد المدير',message:'تم تسجيل الخصم وإرساله للمراجعة.'};
  } finally {lock.releaseLock();}
}
function decideDeduction_(profile, body) {
  mhRequireRole_(profile,MH_FINANCE.REVIEW_ROLES);
  const rowNum=Number(body.row), decision=String(body.decision||'').trim(), note=String(body.note||'').trim();
  if (!Number.isInteger(rowNum)||rowNum<2||!['معتمد','مرفوض'].includes(decision)||note.length>500) throw new Error('INVALID_DECISION');
  const sh=mhSheet_(MH.SHEETS.deductions), map=mhAssertHeaders_(sh,MH_FINANCE.DEDUCTION_HEADERS);
  if(rowNum>sh.getLastRow()) throw new Error('DEDUCTION_NOT_FOUND');
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if(sh.getRange(rowNum,map['الحالة']).getDisplayValue().trim()!=='بانتظار اعتماد المدير') throw new Error('DEDUCTION_ALREADY_REVIEWED');
    const now=mhNow_();
    sh.getRange(rowNum,map['الحالة']).setValue(decision);
    sh.getRange(rowNum,map['تاريخ الاعتماد']).setValue(decision==='معتمد'?now:'');
    sh.getRange(rowNum,map['منفذ الإجراء']).setValue(profile.chatId);
    sh.getRange(rowNum,map['ملاحظات']).setValue(note);
    if(decision==='مرفوض') sh.getRange(rowNum,map['سبب الرفض/الإلغاء']).setValue(note||'مرفوض من الإدارة');
    return {decided:true,status:decision};
  } finally {lock.releaseLock();}
}
function createRewardBonus_(profile, body) {
  mhRequireRole_(profile,MH_FINANCE.REVIEW_ROLES);
  const employee=financeEmployee_(String(body.employeeId||''));
  const amount=financeNumber_(body.amount,100000);
  const reason=String(body.reason||'').trim();
  if(reason.length<3||reason.length>250) throw new Error('INVALID_REWARD_REASON');
  const sh=mhSheet_(MH.SHEETS.rewardBonus); mhAssertHeaders_(sh,MH_FINANCE.REWARD_BONUS_HEADERS);
  const id='RB-'+Utilities.getUuid().slice(0,8).toUpperCase(), now=mhToday_();
  sh.appendRow([id,now,now.slice(0,7),employee.chatId,employee.name,amount,reason,profile.chatId,'معتمد']);
  return {created:true,rewardId:id,amount:amount,status:'معتمد'};
}
function setRewardHygiene_(profile, body) {
  mhRequireRole_(profile,['super_admin','admin','supervisor']);
  const employee=financeEmployee_(String(body.employeeId||''));
  const date=mhIsoDate_(body.date)||mhToday_();
  const rating=String(body.rating||'').trim(), note=String(body.note||'').trim();
  if(date>mhToday_()||!['نظيف','غير ملتزم'].includes(rating)||note.length>300) throw new Error('INVALID_HYGIENE_RATING');
  const sh=mhSheet_(MH.SHEETS.rewardHygiene); mhAssertHeaders_(sh,MH_FINANCE.REWARD_HYGIENE_HEADERS);
  const rows=mhRowsObjects_(sh);
  const existing=rows.find(r=>String(r['Chat ID']).trim()===employee.chatId&&mhDate_(r['التاريخ'])===date);
  if(existing) throw new Error('HYGIENE_ALREADY_RATED');
  sh.appendRow([date,employee.chatId,employee.name,rating,note,profile.name,mhNow_()]);
  return {saved:true,rating:rating,date:date};
}
function rewardIsApprovedLeaveMini_(chatId,date) {
  return mhRowsObjects_(mhSheet_(MH.SHEETS.leaves)).some(r=>{
    if(String(r['Chat ID']).trim()!==String(chatId)||String(r['الحالة']).trim()!=='مقبول') return false;
    const start=mhDate_(r['تاريخ الإذن']), end=mhDate_(r['تاريخ نهاية الإذن'])||start;
    if(String(r['نوع الإذن']).trim()==='يوم كامل') return !!start&&date>=start&&date<=end;
    const ass=mhAssignmentForDate_(spreadsheet_(),chatId,date);
    const shift=ass?mhShiftById_(spreadsheet_(),ass.shiftId):null;
    return !!(start===date&&shift&&!shift.isFlexible&&mhTimeMinutes_(r['من الساعة'])<=mhTimeMinutes_(shift.startTime));
  });
}
function rewardSummary_(profile, body) {
  const month=financeMonth_(body.month);
  const employeeId=String(body.employeeId||profile.chatId);
  if(employeeId!==profile.chatId) mhRequireRole_(profile,MH_FINANCE.REVIEW_ROLES);
  const employee=employeeId===profile.chatId?{chatId:employeeId,name:profile.name}:financeEmployee_(employeeId);
  const assignments=mhRowsObjects_(mhSheet_(MH.SHEETS.assignments));
  const attendance=mhRowsObjects_(mhSheet_(MH.SHEETS.attendance));
  const hygiene=mhRowsObjects_(mhSheet_(MH.SHEETS.rewardHygiene));
  const bonuses=mhRowsObjects_(mhSheet_(MH.SHEETS.rewardBonus));
  let eligible=0,elapsedEligible=0,earned=0,commitment=0,hygienePoints=0,excluded=0,shifts=0,hygienePending=0;
  const daysInMonth=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate(), today=mhToday_();
  for(let day=1;day<=daysInMonth;day++){
    const date=month+'-'+String(day).padStart(2,'0');
    const ass=mhAssignmentForDate_(spreadsheet_(),employeeId,date); if(!ass) continue;
    const shift=mhShiftById_(spreadsheet_(),ass.shiftId); if(!shift) continue;
    shifts++;
    if(rewardIsApprovedLeaveMini_(employeeId,date)){excluded++;continue;}
    eligible+=MH_FINANCE.DAILY_POINTS;
    if(date>=today) continue;
    elapsedEligible+=MH_FINANCE.DAILY_POINTS;
    const recs=attendance.filter(r=>String(r['Chat ID']).trim()===employeeId&&mhDate_(r['التاريخ'])===date&&String(r['النوع'])==='حضور');
    const attended=recs.length?recs[recs.length-1]:null;
    const onTime=!!(attended&&String(attended['حالة الحضور'])==='في الموعد'&&Number(attended['دقائق التأخير']||0)===0);
    const uniform=!!(attended&&String(attended['اليونيفورم'])==='ملتزم');
    if(onTime&&uniform){commitment++;earned++;}
    const hygieneRecord=hygiene.filter(r=>String(r['Chat ID']).trim()===employeeId&&mhDate_(r['التاريخ'])===date).slice(-1)[0];
    if(hygieneRecord&&String(hygieneRecord['التقييم'])==='نظيف'){hygienePoints++;earned++;}
    else if(!hygieneRecord||!String(hygieneRecord['التقييم']||'')){hygienePending++;}
  }
  const scoredEligible=Math.max(0,elapsedEligible-hygienePending);
  const ratio=scoredEligible?Math.min(1,earned/scoredEligible):0;
  const bonus=bonuses.filter(r=>String(r['Chat ID']).trim()===employeeId&&String(r['الشهر'])===month&&String(r['الحالة']||'معتمد')==='معتمد').reduce((s,r)=>s+Number(r['المبلغ بالجنيه']||0),0);
  const deductionRows=mhRowsObjects_(mhSheet_(MH.SHEETS.deductions)).filter(r=>String(r['Chat ID']).trim()===employeeId&&String(mhDate_(r['تاريخ الواقعة'])).startsWith(month));
  const approved=deductionRows.filter(r=>String(r['الحالة'])==='معتمد');
  const pending=deductionRows.filter(r=>String(r['الحالة'])==='بانتظار اعتماد المدير');
  return {
    employeeName:employee.name,month,shifts,excluded,eligible,elapsedEligible,scoredEligible,earned,commitment,hygienePoints,hygienePending,
    ratio,base:Math.round(MH_FINANCE.BASE_REWARD*ratio*100)/100,bonus,total:Math.round((MH_FINANCE.BASE_REWARD*ratio+bonus)*100)/100,
    deductionsApproved:approved.reduce((s,r)=>s+Number(r['المبلغ بالجنيه']||0),0),
    deductionsPending:pending.reduce((s,r)=>s+Number(r['المبلغ بالجنيه']||0),0),
    deductionRows:deductionRows.slice(-30).reverse(),
    hygieneRows:hygiene.filter(r=>String(r['Chat ID']).trim()===employeeId&&String(mhDate_(r['التاريخ'])).startsWith(month)).slice(-31).reverse()
  };
}

function activeEmployeesMini_(profile) {
  mhRequireRole_(profile,['super_admin','admin','finance','supervisor']);
  return rowsAsObjects_(spreadsheet_(),MH.SHEETS.employees)
    .filter(r=>String(r['الحالة']||'').trim()==='نشط'&&String(r['حالة الحساب']||'نشط').trim()==='نشط'&&String(r['Chat ID']||'').trim())
    .map(r=>({ 'Chat ID':String(r['Chat ID']).trim(), 'اسم الموظف':String(r['اسم الموظف']||'') }));
}
