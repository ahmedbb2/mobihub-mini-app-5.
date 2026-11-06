/**
 * MobiHub Mini App API — V1.2 attendance migration build
 * Separate Apps Script project for the TEST spreadsheet.
 *
 * Required Script Properties:
 *   BOT_TOKEN       = Telegram bot token (never expose to browser)
 *   SPREADSHEET_ID  = ID of the TEST Google Spreadsheet
 *
 * This API is read-only. It does not modify the spreadsheet.
 */

const MH = Object.freeze({
  VERSION: '1.2.0',
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
    deductionSettings: 'إعدادات الخصومات'
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

    return json_({
      ok: false,
      error: 'INTERNAL_ERROR',
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
    cash: { sheet: MH.SHEETS.cash, owner: 'Chat ID' }
  };

  const definition = definitions[entity];
  if (!definition) {
    throw new Error('Unsupported entity: ' + entity);
  }

  const role = profile.role;
  const canReviewGeneral = [
    'super_admin', 'admin', 'supervisor'
  ].indexOf(role) >= 0;

  const canReviewCash = [
    'super_admin', 'admin', 'finance'
  ].indexOf(role) >= 0;

  let canViewAll = false;

  if (entity === 'cash') {
    canViewAll = canReviewCash;
  } else {
    canViewAll = canReviewGeneral;
  }

  const rows = rowsAsObjects_(spreadsheet_(), definition.sheet);

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
