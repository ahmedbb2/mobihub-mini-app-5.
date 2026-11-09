/**
 * MobiHub Mini App API — V1.10.7 Overtime & Absence Review
 * Separate Apps Script project for the TEST spreadsheet.
 *
 * Required Script Properties:
 *   BOT_TOKEN       = Telegram bot token (never expose to browser)
 *   SPREADSHEET_ID  = ID of the TEST Google Spreadsheet
 *
 * This TEST API reads dashboard data and writes only approved Mini App actions.
 */

const MH = Object.freeze({
  VERSION: '1.10.9',
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

    const profile = resolveProfile_(String(telegramUser.id), String(body.workspaceRole || ''));

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

      case 'manager_dashboard':
        data = managerDashboard_(profile);
        break;

      case 'employee_create':
        data = managerCreateEmployee_(profile, body);
        break;

      case 'employee_update':
        data = managerUpdateEmployee_(profile, body);
        break;

      case 'employee_status':
        data = managerSetEmployeeStatus_(profile, body);
        break;

      case 'shift_assign':
        data = managerAssignShift_(profile, body);
        break;

      case 'shift_create':
        data = managerCreateShift_(profile, body);
        break;

      case 'shift_update':
        data = managerUpdateShift_(profile, body);
        break;

      case 'shift_status':
        data = managerSetShiftStatus_(profile, body);
        break;

      case 'my_shifts':
        data = employeeMyShifts_(profile);
        break;

      case 'device_update':
        data = managerUpdateDevice_(profile, body);
        break;
      case 'notification_setting':
        data = managerSetNotificationSetting_(profile, body);
        break;
      case 'notification_send':
        data = managerSendNotification_(profile, body);
        break;
      case 'manager_create':
        data = managerCreateAdmin_(profile, body);
        break;
      case 'manager_update':
        data = managerUpdateAdmin_(profile, body);
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

      case 'overtime_status':
        data = overtimeStatus_(profile);
        break;

      case 'overtime_request':
        data = createOvertimeRequest_(profile);
        break;

      case 'overtime_decide':
        data = decideOvertimeRequest_(profile, body);
        break;

      case 'absence_decide':
        data = decideAbsence_(profile, body);
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

      case 'cash_withdraw_create':
        data = createCashWithdrawalMini_(profile, body);
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

      case 'monthly_summary':
        data = monthlySummary_(profile);
        break;
      case 'active_employees':
        data = activeEmployeesMini_(profile);
        break;

      case 'device_registration_options':
        data = deviceRegistrationOptions_(profile);
        break;

      case 'device_register':
        data = registerDeviceMini_(profile, body);
        break;

      case 'device_list':
        data = deviceListMiniV105_(profile);
        break;
      case 'device_detail':
        data = deviceDetailMiniV105_(profile, body);
        break;
      case 'device_staff':
        data = deviceStaffMiniV105_(profile);
        break;
      case 'device_status_update':
        data = deviceStatusUpdateMiniV105_(profile, body);
        break;
      case 'device_transfer':
        data = deviceTransferMiniV105_(profile, body);
        break;
      case 'device_inspection_catalog':
        data = deviceInspectionCatalogMini_();
        break;
      case 'device_inspection_get':
        data = deviceInspectionGetMiniV106_(profile, body);
        break;
      case 'device_inspection_save':
        data = deviceInspectionSaveMiniV106_(profile, body);
        break;

      case 'repair_price_categories':
        data = repairPriceCategoriesMini_();
        break;
      case 'repair_price_models':
        data = repairPriceModelsMini_(body);
        break;
      case 'repair_price_search':
        data = repairPriceSearchMini_(body);
        break;
      case 'repair_price_issues':
        data = repairPriceIssuesMini_(body);
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
 * Resolve the Telegram user against the workbook.
 * A Telegram account may have both an active employee record and an active
 * manager record. The requested workspace is always revalidated server-side.
 *
 * workspaceRole: "employee" or "manager". If omitted, manager takes
 * precedence for backwards compatibility with the original Mini App.
 */
function resolveProfile_(chatId, requestedWorkspace) {
  const ss = spreadsheet_();
  const managerRows = rowsAsObjects_(ss, MH.SHEETS.managers);
  const employeeRows = rowsAsObjects_(ss, MH.SHEETS.employees);

  const manager = managerRows.find(function(row) {
    return String(row['Chat ID']).trim() === chatId &&
      String(row['الحالة']).trim() === 'نشط';
  });
  const employee = employeeRows.find(function(row) {
    return String(row['Chat ID']).trim() === chatId &&
      String(row['الحالة']).trim() === 'نشط' &&
      String(row['حالة الحساب'] || 'نشط').trim() === 'نشط';
  });

  const availableWorkspaces = [];
  if (employee) availableWorkspaces.push('employee');
  if (manager) availableWorkspaces.push('manager');
  if (!availableWorkspaces.length) return null;

  let workspace = String(requestedWorkspace || '').trim().toLowerCase();
  if (!workspace) workspace = manager ? 'manager' : 'employee';
  if (workspace !== 'employee' && workspace !== 'manager') {
    throw new Error('INVALID_WORKSPACE');
  }
  if (availableWorkspaces.indexOf(workspace) < 0) {
    throw new Error('WORKSPACE_NOT_ALLOWED');
  }

  if (workspace === 'manager') {
    return {
      chatId: chatId,
      name: String(manager['اسم المدير'] || ''),
      role: normalizeRole_(String(manager['الصلاحية'] || 'Admin')),
      status: 'نشط',
      workspace: 'manager',
      availableWorkspaces: availableWorkspaces
    };
  }

  return {
    chatId: chatId,
    name: String(employee['اسم الموظف'] || ''),
    role: 'employee',
    status: 'نشط',
    workspace: 'employee',
    availableWorkspaces: availableWorkspaces
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
    managerDashboard: isManagement ? managerDashboard_(profile) : null,
    permissions: {
      viewManagement: isManagement,
      reviewRequests: [
        'super_admin', 'admin', 'supervisor'
      ].indexOf(profile.role) >= 0,
      finance: [
        'super_admin', 'finance'
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
    devices: { sheet: MH.SHEETS.devices, owner: 'الموظف المسؤول Chat ID' },
    rewards: { sheet: MH.SHEETS.rewardBonus, owner: 'Chat ID' },
    employees: { sheet: MH.SHEETS.employees, owner: 'Chat ID' },
    attendance: { sheet: MH.SHEETS.attendance, owner: 'Chat ID' },
    absences: { sheet: MH.SHEETS.absences, owner: 'Chat ID' },
    shifts: { sheet: MH.SHEETS.shifts, owner: 'Shift ID' },
    assignments: { sheet: MH.SHEETS.assignments, owner: 'Chat ID' },
    deviceMovements: { sheet: 'سجل حركة الأجهزة', owner: 'منفذ الحركة Chat ID' },
    notifications: { sheet: 'سجل الإشعارات', owner: 'المستلم' },
    notificationSettings: { sheet: 'إعدادات الإشعارات', owner: 'الإعداد' },
    managers: { sheet: 'المديرين', owner: 'Chat ID' }
  };

  const definition = definitions[entity];
  if (!definition) {
    throw new Error('Unsupported entity: ' + entity);
  }

  const role = profile.role;
  const staffAdminEntities = ['employees','shifts','assignments','deviceMovements'];
  const dailySupervisorEntities = ['attendance','absences'];
  if (staffAdminEntities.indexOf(entity) >= 0 && ['super_admin','admin'].indexOf(role) < 0) throw new Error('FORBIDDEN');
  if (dailySupervisorEntities.indexOf(entity) >= 0 && ['super_admin','admin','supervisor'].indexOf(role) < 0) throw new Error('FORBIDDEN');
  const canUseDeviceIntake = entity === 'devices' && deviceIntakeAllowed_(profile);
  if (entity === 'devices' && ['super_admin','admin'].indexOf(role) < 0 && !canUseDeviceIntake) throw new Error('FORBIDDEN');
  if (entity === 'managers' && role !== 'super_admin') throw new Error('FORBIDDEN');
  if (['notifications','notificationSettings','complaints'].indexOf(entity) >= 0 && ['super_admin','admin','supervisor'].indexOf(role) < 0) throw new Error('FORBIDDEN');
  const canReviewGeneral = [
    'super_admin', 'admin', 'supervisor'
  ].indexOf(role) >= 0;

  const canReviewCash = [
    'super_admin', 'admin', 'finance'
  ].indexOf(role) >= 0;

  let canViewAll = false;

  if (entity === 'managers') canViewAll = role === 'super_admin';
  else if (staffAdminEntities.indexOf(entity) >= 0 || dailySupervisorEntities.indexOf(entity) >= 0 || ['notifications','notificationSettings'].indexOf(entity) >= 0) {
    canViewAll = true;
  } else if (entity === 'devices') {
    canViewAll = ['super_admin','admin'].indexOf(role) >= 0;
  } else if (entity === 'cash' || entity === 'deductions' || entity === 'overtime' || entity === 'rewards') {
    canViewAll = canReviewCash;
  } else {
    canViewAll = canReviewGeneral;
  }

  const rows = rowsAsObjects_(spreadsheet_(), definition.sheet).map(function(row, index) { row.__row = index + 2; return row; });

  // Finance role sees only personal-advance rows from the general requests sheet.
  if (entity === 'requests' && role === 'finance') {
    return rows.filter(r => String(r['نوع الطلب'] || '').trim() === 'سلفة').slice(-100).reverse();
  }

  const visibleRows = canViewAll
    ? rows
    : rows.filter(function(row) {
        if (entity === 'devices') return String(row['الموظف المسؤول Chat ID'] || '').trim() === profile.chatId || String(row['مسؤول الاستلام Chat ID'] || '').trim() === profile.chatId;
        return String(row[definition.owner]).trim() === profile.chatId;
      });

  return visibleRows.slice(-100).reverse();
}

/**
 * Manager dashboard aggregates. Reads only the V40 operational sheets and
 * returns counts + compact recent lists; every call is role-checked server-side.
 */
function managerDashboard_(profile) {
  const role = String(profile.role || '');
  mhRequireRole_(profile, ['super_admin','admin','finance','supervisor']);
  const ss = spreadsheet_();
  const today = mhToday_();
  const month = today.slice(0,7);
  const modules = {
    daily: ['super_admin','admin','supervisor'].includes(role),
    staff: ['super_admin','admin'].includes(role),
    shifts: ['super_admin','admin'].includes(role),
    devices: ['super_admin','admin'].includes(role),
    requests: ['super_admin','admin','supervisor'].includes(role),
    finance: ['super_admin','finance'].includes(role),
    overtime: ['super_admin','admin','finance'].includes(role),
    system: ['super_admin','admin'].includes(role),
    notifications: ['super_admin','admin','supervisor'].includes(role),
    managers: role === 'super_admin'
  };
  const dataWarnings = [];
  const safeRows = function(name, enabled) {
    if (!enabled) return [];
    try { return rowsAsObjects_(ss, name); }
    catch (e) { dataWarnings.push(name + ': ' + String(e.message||e)); return []; }
  };
  const employees = safeRows(MH.SHEETS.employees, modules.staff).filter(r =>
    String(r['Chat ID'] || '').trim() && String(r['الحالة'] || 'نشط').trim() === 'نشط' &&
    String(r['حالة الحساب'] || 'نشط').trim() === 'نشط'
  );
  const attendanceRows = safeRows(MH.SHEETS.attendance, modules.daily);
  const attendance = attendanceRows.filter(r => mhDate_(r['التاريخ']) === today);
  const monthAttendance = attendanceRows.filter(r => mhDate_(r['التاريخ']).indexOf(month) === 0);
  const latest = {};
  attendance.forEach(r => { const id=String(r['Chat ID']||'').trim(); if(id) latest[id]=r; });
  const presentNow = Object.keys(latest).filter(id => String(latest[id]['النوع']||'').trim() === 'حضور').length;
  const requests = safeRows(MH.SHEETS.requests, modules.requests || modules.finance);
  const leaves = safeRows(MH.SHEETS.leaves, modules.requests || modules.daily);
  const cash = safeRows(MH.SHEETS.cash, modules.finance);
  const complaints = safeRows(MH.SHEETS.complaints, modules.requests);
  const devices = safeRows(MH.SHEETS.devices, modules.devices);
  const absences = safeRows(MH.SHEETS.absences, modules.daily);
  const overtimeRows = safeRows(MH.SHEETS.overtime, modules.overtime);
  const pendingRequests = requests.filter(r => String(r['القرار']||'').trim() === 'قيد الانتظار').length;
  const pendingLeaves = leaves.filter(r => ['بانتظار مراجعة المدير','قيد الانتظار','معلق'].includes(String(r['الحالة']||'').trim()) && String(r['قرار المدير']||'').trim() !== 'مقبول').length;
  const pendingCustody = cash.filter(r => ['قيد المراجعة','طلب جديد','بانتظار مراجعة المدير','بانتظار الصرف','بانتظار مراجعة التسوية','بانتظار تأكيد استلام المتبقي'].includes(String(r['الحالة']||r['حالة التسوية']||'').trim()) || ['بانتظار الصرف','بانتظار مراجعة التسوية','بانتظار تأكيد استلام المتبقي'].includes(String(r['حالة الصرف']||r['حالة التسوية']||'').trim())).length;
  const pendingAdvances = requests.filter(r => String(r['نوع الطلب']||'').trim()==='سلفة' && String(r['القرار']||'').trim()==='قيد الانتظار').length;
  const pendingCash = pendingCustody + pendingAdvances;
  const openComplaints = complaints.filter(r => !['مغلقة','تم الحل'].includes(String(r['الحالة']||'').trim()));
  const activeDevices = devices.filter(r => String(r['حالة الجهاز']||'').trim() !== 'تم التسليم');
  const pendingAbsences = absences.filter(r => /انتظار|مراجعة|معلق/.test(String(r['الحالة']||r['قرار المدير']||'')));
  const monthCheckins=monthAttendance.filter(r=>String(r['النوع']||'').trim()==='حضور');
  const monthCheckouts=monthAttendance.filter(r=>String(r['النوع']||'').trim()==='انصراف');
  const lateRows=monthCheckins.filter(r=>Number(r['دقائق التأخير']||0)>0);
  const monthlyReport=modules.system?{
    month:month,checkins:monthCheckins.length,checkouts:monthCheckouts.length,lateDays:lateRows.length,
    lateMinutes:lateRows.reduce((sum,r)=>sum+(Number(r['دقائق التأخير'])||0),0),
    confirmedAbsences:absences.filter(r=>mhDate_(r['التاريخ']).indexOf(month)===0&&/مؤكد|تأكيد الغياب/.test(String(r['الحالة']||r['قرار المدير']||''))).length,
    pendingAbsences:pendingAbsences.filter(r=>mhDate_(r['التاريخ']).indexOf(month)===0).length,
    leaveCount:leaves.filter(r=>mhDate_(r['تاريخ الإذن']).indexOf(month)===0).length
  }:null;
  const recentComplaints = modules.requests ? openComplaints.slice(-5).reverse().map(r => ({
    id:String(r['رقم الشكوى']||''), employee:String(r['اسم الموظف']||''),
    type:String(r['نوع الشكوى']||''), status:String(r['الحالة']||''),
    date:String(r['التاريخ والوقت']||''), details:String(r['تفاصيل الشكوى']||'').slice(0,180)
  })) : [];
  const todayRows = modules.daily ? Object.keys(latest).map(id => ({
    chatId:id, name:String(latest[id]['اسم الموظف']||''),
    state:String(latest[id]['النوع']||''), time:String(latest[id]['الوقت']||''),
    attendanceStatus:String(latest[id]['حالة الحضور']||'')
  })) : [];
  return {
    date:today, month:month, role:role, modules:modules,
    metrics:{
      activeEmployees:modules.staff?employees.length:null,
      presentNow:modules.daily?presentNow:null,
      checkedInToday:modules.daily?Object.keys(latest).length:null,
      pendingRequests:modules.requests?pendingRequests:null,
      pendingLeaves:(modules.requests||modules.daily)?pendingLeaves:null,
      pendingCash:modules.finance?pendingCash:null, pendingAdvances:modules.finance?pendingAdvances:null, pendingCustody:modules.finance?pendingCustody:null,
      openComplaints:modules.requests?openComplaints.length:null,
      activeDevices:modules.devices?activeDevices.length:null,
      pendingAbsences:modules.daily?pendingAbsences.length:null,
      pendingOvertime:modules.overtime?overtimeRows.filter(r=>String(r['الحالة']||'').trim()==='بانتظار موافقة المدير').length:null
    },
    todayAttendance:todayRows.slice(0,30), recentComplaints:recentComplaints, monthlyReport:monthlyReport,
    dataWarnings:dataWarnings
  };
}

/* MANAGER STAFF OPERATIONS — V1.10 */
const MH_MANAGER_STAFF = Object.freeze({
  EMPLOYEE_HEADERS:['Chat ID','اسم الموظف','الوظيفة','رقم الهاتف','الحالة','حالة الحساب'],
  SHIFT_HEADERS:['Shift ID','اسم الوردية','موعد الحضور','موعد الانصراف','فترة السماح بالدقائق','الحالة'],
  ASSIGNMENT_HEADERS:['Chat ID','Shift ID','تاريخ البداية','تاريخ النهاية','أيام العمل','الحالة']
});
function managerCreateEmployee_(profile, body) {
  mhRequireRole_(profile,['super_admin','admin']);
  const id=String(body.chatId||'').trim(), name=String(body.name||'').trim();
  const job=String(body.job||'مهندس').trim(), phone=String(body.phone||'').trim();
  if(!/^\d{5,20}$/.test(id)||name.length<2||name.length>80||job.length<2||job.length>80||phone.length>30) throw new Error('INVALID_EMPLOYEE_DATA');
  const sh=mhSheet_(MH.SHEETS.employees); mhAssertHeaders_(sh,MH_MANAGER_STAFF.EMPLOYEE_HEADERS);
  const rows=mhRowsObjects_(sh);
  if(rows.some(r=>String(r['Chat ID']||'').trim()===id)) throw new Error('EMPLOYEE_ALREADY_EXISTS');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try { sh.appendRow([id,name,job,phone,'نشط','نشط']); return {created:true,chatId:id,name:name}; }
  finally {lock.releaseLock();}
}
function managerFindEmployeeRow_(chatId) {
  const sh=mhSheet_(MH.SHEETS.employees);mhAssertHeaders_(sh,MH_MANAGER_STAFF.EMPLOYEE_HEADERS);
  const values=sh.getDataRange().getDisplayValues(), headers=values[0].map(x=>String(x).trim()), idx=headers.indexOf('Chat ID');
  if(idx<0) throw new Error('SHEET_SCHEMA_MISMATCH');
  for(let i=1;i<values.length;i++) if(String(values[i][idx]).trim()===String(chatId)) return {sheet:sh,row:i+1,headers:headers,values:values[i]};
  throw new Error('EMPLOYEE_NOT_FOUND');
}
function managerUpdateEmployee_(profile, body) {
  mhRequireRole_(profile,['super_admin','admin']);
  const id=String(body.employeeId||'').trim(), name=String(body.name||'').trim(), job=String(body.job||'').trim(), phone=String(body.phone||'').trim();
  if(!/^\d{5,20}$/.test(id)||name.length<2||name.length>80||job.length<2||job.length>80||phone.length>30) throw new Error('INVALID_EMPLOYEE_DATA');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try { const found=managerFindEmployeeRow_(id); const map={};found.headers.forEach((h,i)=>map[h]=i+1);
    found.sheet.getRange(found.row,map['اسم الموظف']).setValue(name);
    found.sheet.getRange(found.row,map['الوظيفة']).setValue(job);
    found.sheet.getRange(found.row,map['رقم الهاتف']).setValue(phone);
    return {updated:true,chatId:id,name:name};
  } finally {lock.releaseLock();}
}
function managerSetEmployeeStatus_(profile, body) {
  mhRequireRole_(profile,['super_admin','admin']);
  const id=String(body.employeeId||'').trim(), status=String(body.status||'').trim();
  if(!/^\d{5,20}$/.test(id)||!['نشط','موقوف'].includes(status)) throw new Error('INVALID_EMPLOYEE_STATUS');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try { const found=managerFindEmployeeRow_(id); const map={};found.headers.forEach((h,i)=>map[h]=i+1);
    found.sheet.getRange(found.row,map['الحالة']).setValue(status);
    found.sheet.getRange(found.row,map['حالة الحساب']).setValue(status);
    return {updated:true,status:status,chatId:id};
  } finally {lock.releaseLock();}
}
function managerAssignShift_(profile, body) {
  mhRequireRole_(profile,['super_admin','admin']);
  const employeeId=String(body.employeeId||'').trim(), shiftId=String(body.shiftId||'').trim();
  const startRaw=String(body.startDate||'').trim(), endRaw=String(body.endDate||'').trim();
  const start=startRaw?mhIsoDate_(startRaw):mhToday_(), end=endRaw?mhIsoDate_(endRaw):'';
  const days=String(body.days||'0,1,2,3,4,6').split(',').map(x=>Number(x.trim()));
  if(!/^\d{5,20}$/.test(employeeId)||!shiftId||!/^\d{4}-\d{2}-\d{2}$/.test(start)|| (startRaw&&!mhIsoDate_(startRaw)) || (endRaw&&!end) || (end&&!/^\d{4}-\d{2}-\d{2}$/.test(end)) || (end&&end<start)) throw new Error('INVALID_SHIFT_ASSIGNMENT');
  if(!days.length||days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(days).size!==days.length) throw new Error('INVALID_SHIFT_DAYS');
  const employeeRow=managerFindEmployeeRow_(employeeId);
  const employeeMap={};employeeRow.headers.forEach((h,i)=>employeeMap[h]=i);
  if(String(employeeRow.values[employeeMap['الحالة']]||'نشط')!=='نشط'||String(employeeRow.values[employeeMap['حالة الحساب']]||'نشط')!=='نشط') throw new Error('ACCOUNT_INACTIVE');
  const ss=spreadsheet_(), shiftRows=rowsAsObjects_(ss,MH.SHEETS.shifts);
  const shift=shiftRows.find(r=>String(r['Shift ID']||'').trim()===shiftId&&String(r['الحالة']||'نشط').trim()==='نشط');
  if(!shift) throw new Error('SHIFT_NOT_FOUND');
  const isFlexible=shiftId==='FLEX_NO_FIXED_TIME';
  if(!isFlexible&&days.includes(5)) throw new Error('FRIDAY_FIXED_SHIFT_NOT_ALLOWED');
  const sh=mhSheet_(MH.SHEETS.assignments);mhAssertHeaders_(sh,MH_MANAGER_STAFF.ASSIGNMENT_HEADERS);
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    const values=sh.getDataRange().getDisplayValues();
    for(let i=1;i<values.length;i++) {
      const r=values[i]; if(String(r[0]).trim()!==employeeId||String(r[5]||'نشط').trim()!=='نشط') continue;
      const oldStart=mhIsoDate_(r[2])||'0000-01-01',oldEnd=mhIsoDate_(r[3])||'9999-12-31',newEnd=end||'9999-12-31';
      if(oldStart<=newEnd&&start<=oldEnd) sh.getRange(i+1,6).setValue('غير نشط');
    }
    sh.appendRow([employeeId,shiftId,start,end,days.join(','),'نشط']);
    return {assigned:true,employeeId:employeeId,shiftId:shiftId,startDate:start,endDate:end,days:days};
  } finally {lock.releaseLock();}
}

/* SHIFT MANAGEMENT + EMPLOYEE SCHEDULE — V1.10.8 */
function mhValidClock_(value) {
  const s = String(value || '').trim();
  const m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}
function mhShiftRow_(shiftId) {
  const sh = mhSheet_(MH.SHEETS.shifts);
  mhAssertHeaders_(sh, MH_MANAGER_STAFF.SHIFT_HEADERS);
  const rows = sh.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === String(shiftId || '').trim()) {
      return {sheet:sh, row:i + 1, values:rows[i]};
    }
  }
  throw new Error('SHIFT_NOT_FOUND');
}
function managerCreateShift_(profile, body) {
  mhRequireRole_(profile, ['super_admin','admin']);
  const shiftId = String(body.shiftId || '').trim();
  const name = String(body.name || '').trim();
  const flexible = body.flexible === true || body.flexible === 'true' || shiftId === 'FLEX_NO_FIXED_TIME';
  const start = flexible ? '' : mhValidClock_(body.startTime);
  const end = flexible ? '' : mhValidClock_(body.endTime);
  const graceRaw = String(body.graceMinutes == null ? '15' : body.graceMinutes).trim();
  const grace = Number(graceRaw);
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(shiftId) || (flexible && shiftId !== 'FLEX_NO_FIXED_TIME') || (!flexible && shiftId === 'FLEX_NO_FIXED_TIME')) throw new Error('INVALID_SHIFT_ID');
  if (!name || name.length > 60) throw new Error('INVALID_SHIFT_NAME');
  if (!flexible && (!start || !end)) throw new Error('INVALID_SHIFT_TIME');
  if (!/^\d{1,3}$/.test(graceRaw) || !Number.isInteger(grace) || grace < 0 || grace > 180) throw new Error('INVALID_SHIFT_GRACE');
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const sh = mhSheet_(MH.SHEETS.shifts);
    mhAssertHeaders_(sh, MH_MANAGER_STAFF.SHIFT_HEADERS);
    const existing = mhRowsObjects_(sh);
    if (flexible && existing.some(r => String(r['Shift ID'] || '').trim() === 'FLEX_NO_FIXED_TIME')) throw new Error('FLEX_SHIFT_ALREADY_EXISTS');
    if (existing.some(r => String(r['Shift ID'] || '').trim() === shiftId)) throw new Error('SHIFT_ALREADY_EXISTS');
    sh.appendRow([shiftId, name, start, end, grace, 'نشط']);
    return {created:true, shift:{id:shiftId,name:name,startTime:start,endTime:end,graceMinutes:grace,isFlexible:flexible,status:'نشط'}};
  } finally { lock.releaseLock(); }
}
function managerUpdateShift_(profile, body) {
  mhRequireRole_(profile, ['super_admin','admin']);
  const shiftId = String(body.shiftId || '').trim();
  if (!shiftId) throw new Error('SHIFT_NOT_FOUND');
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const found = mhShiftRow_(shiftId), vals = found.values;
    const flexible = shiftId === 'FLEX_NO_FIXED_TIME' || String(vals[2] || '').trim() === '' && String(vals[3] || '').trim() === '';
    const name = Object.prototype.hasOwnProperty.call(body,'name') ? String(body.name || '').trim() : String(vals[1] || '').trim();
    const graceRaw = Object.prototype.hasOwnProperty.call(body,'graceMinutes') ? String(body.graceMinutes).trim() : String(vals[4] || '15').trim();
    const grace = Number(graceRaw);
    if (!name || name.length > 60) throw new Error('INVALID_SHIFT_NAME');
    if (!/^\d{1,3}$/.test(graceRaw) || !Number.isInteger(grace) || grace < 0 || grace > 180) throw new Error('INVALID_SHIFT_GRACE');
    let start = String(vals[2] || '').trim(), end = String(vals[3] || '').trim();
    if (!flexible) {
      if (Object.prototype.hasOwnProperty.call(body,'startTime')) start = mhValidClock_(body.startTime);
      if (Object.prototype.hasOwnProperty.call(body,'endTime')) end = mhValidClock_(body.endTime);
      if (!start || !end) throw new Error('INVALID_SHIFT_TIME');
    } else {
      start = ''; end = '';
    }
    found.sheet.getRange(found.row,2,1,4).setValues([[name,start,end,grace]]);
    return {updated:true,shift:{id:shiftId,name:name,startTime:start,endTime:end,graceMinutes:grace,isFlexible:flexible}};
  } finally { lock.releaseLock(); }
}
function managerSetShiftStatus_(profile, body) {
  mhRequireRole_(profile, ['super_admin','admin']);
  const shiftId = String(body.shiftId || '').trim();
  const status = String(body.status || '').trim();
  if (!['نشط','غير نشط'].includes(status)) throw new Error('INVALID_SHIFT_STATUS');
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const found = mhShiftRow_(shiftId);
    if (status === 'غير نشط') {
      const assignmentRows = mhRowsObjects_(mhSheet_(MH.SHEETS.assignments));
      const today = mhToday_();
      const hasCurrentOrFutureAssignment = assignmentRows.some(r =>
        String(r['Shift ID'] || '').trim() === shiftId &&
        String(r['الحالة'] || 'نشط').trim() === 'نشط' &&
        (!mhIsoDate_(r['تاريخ النهاية']) || mhIsoDate_(r['تاريخ النهاية']) >= today)
      );
      if (hasCurrentOrFutureAssignment) throw new Error('SHIFT_HAS_ACTIVE_ASSIGNMENTS');
    }
    found.sheet.getRange(found.row,6).setValue(status);
    return {updated:true,shiftId:shiftId,status:status};
  } finally { lock.releaseLock(); }
}
function employeeMyShifts_(profile) {
  if (profile.role !== 'employee') throw new Error('EMPLOYEE_ONLY');
  const ss = spreadsheet_();
  const assignments = mhRows_(ss, MH.SHEETS.assignments)
    .filter(r => String(r['Chat ID'] || '').trim() === String(profile.chatId) && String(r['الحالة'] || 'نشط').trim() === 'نشط');
  const shifts = mhRows_(ss, MH.SHEETS.shifts);
  const today = mhToday_();
  const dayNames = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const items = assignments.map(a => {
    const id = String(a['Shift ID'] || '').trim();
    const shift = shifts.find(s => String(s['Shift ID'] || '').trim() === id && String(s['الحالة'] || 'نشط').trim() === 'نشط');
    if (!shift) return null;
    const flexible = id === 'FLEX_NO_FIXED_TIME' || String(shift['موعد الحضور'] || '').trim() === '' && String(shift['موعد الانصراف'] || '').trim() === '';
    const days = String(a['أيام العمل'] || '0,1,2,3,4,6').split(/[،,]/).map(x => Number(String(x).trim())).filter(x => Number.isInteger(x) && x >= 0 && x <= 6);
    const todayDay = new Date(today + 'T12:00:00').getDay();
    const startDate = mhIsoDate_(a['تاريخ البداية']) || '';
    const endDate = mhIsoDate_(a['تاريخ النهاية']) || '';
    return {
      shiftId:id, name:String(shift['اسم الوردية'] || id),
      startTime:flexible?'':mhTime_(shift['موعد الحضور']), endTime:flexible?'':mhTime_(shift['موعد الانصراف']),
      graceMinutes:flexible?0:Number(shift['فترة السماح بالدقائق'] || 15), flexible:flexible,
      startDate:startDate, endDate:endDate, days:days, dayNames:days.map(d=>dayNames[d]),
      current:(!startDate || startDate <= today) && (!endDate || endDate >= today) && days.includes(todayDay)
    };
  }).filter(Boolean).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)));
  const current = items.filter(x => x.current);
  return {today:today, assignments:items, current:current, dayNames:dayNames};
}

/* DEVICE INTAKE + ASSIGNMENT — V1.9
 * Mirrors the existing V40 intake policy and sheet layout.
 */
const MH_DEVICE = Object.freeze({
  DEVICE_HEADERS: ['رقم الطلب','تاريخ الاستلام','اسم الجهاز','اسم العميل','المشكلة المسجلة','مسؤول الاستلام Chat ID','مسؤول الاستلام','الموظف المسؤول Chat ID','الموظف المسؤول','القسم','حالة الجهاز','مكان الجهاز','آخر تحديث'],
  MOVEMENT_HEADERS: ['التاريخ والوقت','رقم الطلب','نوع الحركة','من Chat ID','من الموظف','إلى Chat ID','إلى الموظف','الحالة','المكان','ملاحظات','منفذ الحركة Chat ID','منفذ الحركة']
});
function mhEmployeeIsActive_(row) {
  const state = String(row['الحالة'] || '').trim().toLowerCase();
  const account = String(row['حالة الحساب'] || 'نشط').trim().toLowerCase();
  const activeValues = ['نشط','فعال','مفعل','active','enabled','true','1'];
  return activeValues.indexOf(state) >= 0 && activeValues.indexOf(account) >= 0;
}
function mhEmployeeJob_(row) {
  return String(row['الوظيفة'] || row['المسمى الوظيفي'] || row['الدور'] || '').trim();
}
function mhIsIntakeJob_(job) {
  // Accept common Arabic spellings and English job labels used in staff sheets.
  return /استلام|استقبال|مسئول\s*استلام|مسؤول\s*استلام|reception|intake/i.test(String(job || ''));
}
function deviceIntakeAllowed_(profile) {
  if (['super_admin','admin','supervisor'].includes(profile.role)) return true;
  const rows = rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees);
  const employee = rows.find(r => String(r['Chat ID'] || '').trim() === String(profile.chatId || '').trim());
  return !!employee && mhEmployeeIsActive_(employee) && mhIsIntakeJob_(mhEmployeeJob_(employee));
}
function deviceRegistrationOptions_(profile) {
  if (!deviceIntakeAllowed_(profile)) {
    return {allowed:false,technicians:[],message:'حسابك غير مسجل كمسؤول استلام. راجع عمود الوظيفة في شيت الموظفين، واكتب: مسؤول استلام.'};
  }
  const employees = rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees).filter(r => {
    const id = String(r['Chat ID'] || '').trim();
    const job = mhEmployeeJob_(r);
    return id && id !== String(profile.chatId || '').trim() &&
      mhEmployeeIsActive_(r) && !mhIsIntakeJob_(job) &&
      !/مدير|مشرف|إدارة|manager|supervisor/i.test(job);
  });
  const technicalEmployees = employees.filter(r => /مهندس|فني|صيانة|تقني|technician|engineer|repair|technical/i.test(mhEmployeeJob_(r)));
  const eligibleEmployees = technicalEmployees.length ? technicalEmployees : employees;
  const technicians = eligibleEmployees.slice(0,100).map(r=>({
    id:String(r['Chat ID']).trim(),
    name:String(r['اسم الموظف']||'').trim() || 'مهندس',
    job:mhEmployeeJob_(r)
  }));
  return {
    allowed:true,
    technicians:technicians,
    technicianCount:technicians.length,
    message:technicians.length ? '' : 'لا يوجد مهندسون نشطون متاحون للإسناد. راجع حالة الحساب والوظيفة في شيت الموظفين.'
  };
}
function registerDeviceMini_(profile, body) {
  if (!deviceIntakeAllowed_(profile)) throw new Error('FORBIDDEN');
  const orderId = String(body.orderId || '').trim();
  const technicianId = String(body.technicianId || '').trim();
  if (!/^[A-Za-z0-9_#-]{3,60}$/.test(orderId)) throw new Error('INVALID_DEVICE_ORDER');
  if (!technicianId) throw new Error('INVALID_DEVICE_TECHNICIAN');
  const ss = spreadsheet_(), sh = ss.getSheetByName(MH.SHEETS.devices), movement = ss.getSheetByName('سجل حركة الأجهزة');
  if (!sh || !movement) throw new Error('DEVICE_SHEETS_MISSING');
  mhAssertHeaders_(sh, MH_DEVICE.DEVICE_HEADERS);
  mhAssertHeaders_(movement, MH_DEVICE.MOVEMENT_HEADERS);
  const employees = rowsAsObjects_(ss, MH.SHEETS.employees);
  const intake = employees.find(r=>String(r['Chat ID']).trim()===profile.chatId && String(r['الحالة']).trim()==='نشط' && String(r['حالة الحساب']||'نشط').trim()==='نشط');
  const technician = employees.find(r=>String(r['Chat ID'] || '').trim()===technicianId && mhEmployeeIsActive_(r));
  if (!technician) throw new Error('INVALID_DEVICE_TECHNICIAN');
  if (mhIsIntakeJob_(mhEmployeeJob_(technician))) throw new Error('INVALID_DEVICE_TECHNICIAN');
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const existing = rowsAsObjects_(ss, MH.SHEETS.devices).some(r=>String(r['رقم الطلب']).trim()===orderId);
    if (existing) throw new Error('DEVICE_ORDER_EXISTS');
    const now=mhNow_();
    const intakeName = intake ? String(intake['اسم الموظف']||profile.name) : profile.name;
    sh.appendRow([orderId,now,'','','',profile.chatId,intakeName,technicianId,String(technician['اسم الموظف']||''),String(technician['الوظيفة']||''),'تم الاستلام','قسم الاستلام',now]);
    movement.appendRow([now,orderId,'استلام وإسناد الجهاز','', '',technicianId,String(technician['اسم الموظف']||''),'تم الاستلام','قسم الاستلام','تم التسجيل برقم الطلب فقط',profile.chatId,intakeName]);
  } finally { lock.releaseLock(); }
  return {registered:true,orderId,technicianName:String(technician['اسم الموظف']||'')};
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

/* =========================================
   V1.10.7 — OVERTIME + ABSENCE REVIEW
   Business rules are ported from the V46 Telegram bot.
   All decisions and calculations remain server-side.
========================================= */
const MH_OVERTIME = Object.freeze({
  HEADERS: ['رقم الطلب','تاريخ الوردية','Chat ID','اسم المهندس','Shift ID','موعد نهاية الوردية','بداية الأوفر تايم','آخر موعد للموافقة','وقت طلب الموافقة','الحالة','قرار المدير بواسطة','وقت القرار','وقت الانصراف الفعلي','دقائق الأوفر تايم','المبلغ بالجنيه','ملاحظات'],
  ABSENCE_HEADERS: ['التاريخ','Chat ID','اسم الموظف','Shift ID','موعد الحضور','وقت اكتشاف الحالة','الحالة','قرار المدير','وقت القرار'],
  GRACE_MINUTES: 30,
  RATE_PER_MINUTE: 1,
  MAX_PAID_MINUTES: 120,
  PENDING: 'بانتظار موافقة المدير'
});

function mhOvertimeDateTime_(date, time) {
  const normalized = mhTime_(time);
  if (!date || !normalized) return null;
  try { return Utilities.parseDate(String(date) + ' ' + normalized + ':00', MH.TZ, 'yyyy-MM-dd HH:mm:ss'); }
  catch (e) { return null; }
}
function mhOvertimeParseDateTime_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return new Date(value.getTime());
  const text = String(value || '').trim().replace('T', ' ');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (!match) return null;
  const time = match[2].length === 5 ? match[2] + ':00' : match[2];
  try { return Utilities.parseDate(match[1] + ' ' + time, MH.TZ, 'yyyy-MM-dd HH:mm:ss'); }
  catch (e) { return null; }
}
function mhFindOvertimeRecord_(ss, chatId, date) {
  const sh = mhSheet_(MH.SHEETS.overtime);
  mhAssertHeaders_(sh, MH_OVERTIME.HEADERS);
  const values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return null;
  const headers = values[0].map(x => String(x).trim());
  const chatIdx = headers.indexOf('Chat ID'), dateIdx = headers.indexOf('تاريخ الوردية');
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][chatIdx] || '').trim() === String(chatId) && mhDate_(values[i][dateIdx]) === String(date)) {
      const row = {}; headers.forEach((h,j) => row[h] = values[i][j]);
      return {row:row,rowNum:i+1,sheet:sh};
    }
  }
  return null;
}
function mhOvertimeContext_(profile) {
  if (profile.role !== 'employee') throw new Error('EMPLOYEE_ONLY');
  const ss = spreadsheet_();
  const attendanceRows = mhRows_(ss, MH.SHEETS.attendance).filter(r => String(r['Chat ID']).trim() === profile.chatId);
  const open = mhFindOpenAttendance_(attendanceRows);
  if (!open) return {canRequest:false,reason:'NO_OPEN_ATTENDANCE'};
  const shift = mhShiftById_(ss, open.shiftId) || (function(){
    const assignment = mhAssignmentForDate_(ss, profile.chatId, open.date);
    return assignment ? mhShiftById_(ss, assignment.shiftId) : null;
  })();
  if (!shift || shift.isFlexible || !shift.startTime || !shift.endTime) return {canRequest:false,reason:'OVERTIME_FIXED_SHIFT_ONLY',date:open.date};
  let shiftEnd = mhOvertimeDateTime_(open.date, shift.endTime);
  if (!shiftEnd) return {canRequest:false,reason:'OVERTIME_SHIFT_TIME_INVALID',date:open.date};
  if (mhTimeMinutes_(shift.endTime) <= mhTimeMinutes_(shift.startTime)) shiftEnd = mhOvertimeDateTime_(mhAddDays_(open.date,1), shift.endTime);
  if (!shiftEnd) return {canRequest:false,reason:'OVERTIME_SHIFT_TIME_INVALID',date:open.date};
  const overtimeStart = new Date(shiftEnd.getTime() + MH_OVERTIME.GRACE_MINUTES * 60000);
  const now = new Date();
  const existing = mhFindOvertimeRecord_(ss, profile.chatId, open.date);
  const fmt = d => Utilities.formatDate(d, MH.TZ, 'yyyy-MM-dd HH:mm:ss');
  const status = existing ? String(existing.row['الحالة'] || '') : '';
  return {
    canRequest: !existing && now >= shiftEnd && now < overtimeStart,
    date: open.date,
    shiftId: shift.id,
    shiftEnd: fmt(shiftEnd),
    overtimeStart: fmt(overtimeStart),
    approvalDeadline: fmt(overtimeStart),
    existing: existing ? {row:existing.rowNum,id:String(existing.row['رقم الطلب']||''),status:status,minutes:Number(existing.row['دقائق الأوفر تايم']||0),amount:Number(existing.row['المبلغ بالجنيه']||0)} : null,
    reason: existing ? 'OVERTIME_ALREADY_REQUESTED' : (now < shiftEnd ? 'OVERTIME_WINDOW_NOT_OPEN' : now >= overtimeStart ? 'OVERTIME_WINDOW_EXPIRED' : '')
  };
}
function overtimeStatus_(profile) {
  const context = mhOvertimeContext_(profile);
  return Object.assign(context, {
    graceMinutes:MH_OVERTIME.GRACE_MINUTES,
    ratePerMinute:MH_OVERTIME.RATE_PER_MINUTE,
    maxPaidMinutes:MH_OVERTIME.MAX_PAID_MINUTES
  });
}
function createOvertimeRequest_(profile) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = spreadsheet_();
    const context = mhOvertimeContext_(profile);
    if (!context.canRequest) throw new Error(context.reason || 'OVERTIME_WINDOW_NOT_OPEN');
    const sh = mhSheet_(MH.SHEETS.overtime);
    mhAssertHeaders_(sh, MH_OVERTIME.HEADERS);
    // Recheck while holding the lock to prevent duplicate requests.
    if (mhFindOvertimeRecord_(ss, profile.chatId, context.date)) throw new Error('OVERTIME_ALREADY_REQUESTED');
    const now = new Date();
    const stamp = Utilities.formatDate(now, MH.TZ, 'yyyy-MM-dd HH:mm:ss');
    const shiftEnd = mhOvertimeParseDateTime_(context.shiftEnd);
    const overtimeStart = new Date(shiftEnd.getTime() + MH_OVERTIME.GRACE_MINUTES * 60000);
    const fmt = d => Utilities.formatDate(d, MH.TZ, 'yyyy-MM-dd HH:mm:ss');
    const id = 'OT-' + Utilities.getUuid().slice(0,8).toUpperCase();
    sh.appendRow([id,context.date,profile.chatId,profile.name,context.shiftId,fmt(shiftEnd),fmt(overtimeStart),fmt(overtimeStart),stamp,MH_OVERTIME.PENDING,'','','',0,0,'']);
    const message = '⏱️ طلب موافقة على أوفر تايم\n\n👤 المهندس: ' + profile.name + '\n📅 تاريخ الوردية: ' + context.date + '\n🕒 نهاية الوردية: ' + fmt(shiftEnd) + '\n🟢 بداية احتساب الأوفر تايم: ' + fmt(overtimeStart) + '\n⏳ آخر موعد للموافقة: ' + fmt(overtimeStart) + '\n💵 السعر: 1 جنيه لكل دقيقة بعد أول 30 دقيقة.\n⛔ الحد الأقصى: ساعتان مدفوعتان (120 جنيهًا).\n\nيجب اعتماد الطلب قبل بداية احتساب الأوفر تايم.';
    let notification = {sent:0,failed:0};
    try { notification = mhNotifyOvertimeAdminsMini_(message,id); } catch(e) { console.error('Overtime request notification failed: '+e); }
    return {submitted:true,requestId:id,status:MH_OVERTIME.PENDING,message:'تم إرسال طلب الأوفر تايم إلى الإدارة. انتظر الموافقة قبل بداية الحساب.',adminNotificationsSent:notification.sent,adminNotificationsFailed:notification.failed};
  } finally { lock.releaseLock(); }
}
function mhNotifyOvertimeAdminsMini_(message, requestId) {
  const managers = rowsAsObjects_(spreadsheet_(), MH.SHEETS.managers);
  const recipients = [];
  const rootId = String(PropertiesService.getScriptProperties().getProperty('ADMIN_ID') || '9134455704').trim();
  if (/^\d{5,20}$/.test(rootId)) recipients.push(rootId);
  managers.forEach(r => {
    const id=String(r['Chat ID']||'').trim(), role=String(r['الصلاحية']||'').trim();
    if (id && String(r['الحالة']||'نشط').trim()==='نشط' && ['Super Admin','Admin'].includes(role) && !recipients.includes(id)) recipients.push(id);
  });
  let sent=0, failed=0;
  recipients.forEach(id => {
    try { mhSendTelegramMini_(id,message+'\n\nمرجع الطلب: '+requestId); sent++; mhAppendNotificationLog_(id,'طلب أوفر تايم','تم الإرسال',''); }
    catch(e) { failed++; try { mhAppendNotificationLog_(id,'طلب أوفر تايم','فشل',e.message); } catch(logErr) {} }
  });
  return {sent:sent,failed:failed};
}
function decideOvertimeRequest_(profile, body) {
  mhRequireRole_(profile, ['super_admin','admin']);
  const requestId=String(body.requestId||'').trim(), action=String(body.decision||'').trim();
  if (!requestId || !['approve','reject'].includes(action)) throw new Error('INVALID_DECISION');
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const sh=mhSheet_(MH.SHEETS.overtime); mhAssertHeaders_(sh,MH_OVERTIME.HEADERS);
    const all=sh.getDataRange().getDisplayValues();
    const headers=all[0].map(x=>String(x).trim());
    const idIndex=headers.indexOf('رقم الطلب');
    let rowNum=0, values=[];
    for(let i=all.length-1;i>=1;i--) if(String(all[i][idIndex]||'').trim()===requestId){rowNum=i+1;values=all[i];break;}
    if (!rowNum) throw new Error('OVERTIME_NOT_FOUND');
    const get=k=>values[headers.indexOf(k)];
    if (String(get('الحالة')||'').trim() !== MH_OVERTIME.PENDING) throw new Error('OVERTIME_ALREADY_REVIEWED');
    const now=new Date(), stamp=Utilities.formatDate(now,MH.TZ,'yyyy-MM-dd HH:mm:ss');
    if (action === 'approve') {
      const deadline=mhOvertimeParseDateTime_(get('آخر موعد للموافقة'));
      if (!deadline || isNaN(deadline.getTime()) || now >= deadline) {
        sh.getRange(rowNum,headers.indexOf('الحالة')+1).setValue('انتهت مهلة الموافقة');
        throw new Error('OVERTIME_APPROVAL_EXPIRED');
      }
    }
    const next=action==='approve'?'معتمد':'مرفوض';
    sh.getRange(rowNum,headers.indexOf('الحالة')+1).setValue(next);
    sh.getRange(rowNum,headers.indexOf('قرار المدير بواسطة')+1).setValue(profile.chatId);
    sh.getRange(rowNum,headers.indexOf('وقت القرار')+1).setValue(stamp);
    const employeeId=String(get('Chat ID')||'').trim();
    const note=action==='approve'
      ? '✅ وافق المدير على طلب الأوفر تايم. يبدأ الحساب من موعد نهاية الوردية +30 دقيقة، بسعر 1 جنيه للدقيقة، وبحد أقصى ساعتين مدفوعتين (120 جنيهًا)، بشرط استمرارك في العمل حتى تسجيل الانصراف.'
      : '❌ تم رفض طلب الأوفر تايم من الإدارة. لن يتم احتساب وقت إضافي لهذه الوردية.';
    let employeeNotified=false;
    if (employeeId) { try { mhSendTelegramMini_(employeeId,note); employeeNotified=true; mhAppendNotificationLog_(employeeId,'قرار أوفر تايم','تم الإرسال',''); } catch(e) { try { mhAppendNotificationLog_(employeeId,'قرار أوفر تايم','فشل',e.message); } catch(logErr) {} } }
    return {decided:true,status:next,employeeNotified:employeeNotified};
  } finally { lock.releaseLock(); }
}
function finalizeOvertimeAtCheckoutMini_(profile, openAttendance, checkoutAt) {
  if (!openAttendance || !openAttendance.date) return null;
  const ss=spreadsheet_(), found=mhFindOvertimeRecord_(ss,profile.chatId,openAttendance.date);
  if (!found) return null;
  const row=found.row, rowNum=found.rowNum, current=String(row['الحالة']||'');
  if (current === MH_OVERTIME.PENDING) {
    const map=mhHeaderMap_(found.sheet);
    found.sheet.getRange(rowNum,map['الحالة']).setValue('لم تتم الموافقة قبل الانصراف');
    return {status:'لم تتم الموافقة قبل الانصراف',minutes:0,amount:0};
  }
  if (current !== 'معتمد') return {status:current,minutes:0,amount:0};
  const startAt=mhOvertimeParseDateTime_(row['بداية الأوفر تايم']);
  if (!startAt || isNaN(startAt.getTime())) return null;
  const elapsed=Math.max(0,Math.floor((checkoutAt.getTime()-startAt.getTime())/60000));
  const minutes=Math.min(elapsed,MH_OVERTIME.MAX_PAID_MINUTES);
  const amount=minutes*MH_OVERTIME.RATE_PER_MINUTE;
  const stamp=Utilities.formatDate(checkoutAt,MH.TZ,'yyyy-MM-dd HH:mm:ss');
  const status=minutes>0?'معتمد - جاهز للتسوية':'معتمد دون وقت إضافي مستحق';
  const map=mhHeaderMap_(found.sheet);
  found.sheet.getRange(rowNum,map['الحالة']).setValue(status);
  found.sheet.getRange(rowNum,map['وقت الانصراف الفعلي']).setValue(stamp);
  found.sheet.getRange(rowNum,map['دقائق الأوفر تايم']).setValue(minutes);
  found.sheet.getRange(rowNum,map['المبلغ بالجنيه']).setValue(amount);
  if (minutes>0) {
    const capNote=elapsed>MH_OVERTIME.MAX_PAID_MINUTES?'\n⚠️ تم تطبيق الحد الأقصى: ساعتان مدفوعتان.':'';
    const summary='⏱️ تم إغلاق أوفر تايم معتمد\n\n👤 المهندس: '+profile.name+'\n📅 التاريخ: '+openAttendance.date+'\n⏱️ الدقائق المستحقة: '+minutes+'\n💰 المبلغ: '+amount+' جنيه'+capNote+'\n📌 الحالة: '+status+'.';
    try { mhNotifyFinanceAdminsMini_(summary,null,String(row['رقم الطلب']||'')); } catch(e) { console.error('Overtime settlement notification failed: '+e); }
  }
  return {status:status,minutes:minutes,amount:amount,capped:elapsed>MH_OVERTIME.MAX_PAID_MINUTES};
}
function decideAbsence_(profile, body) {
  mhRequireRole_(profile, ['super_admin','admin','supervisor']);
  const employeeId=String(body.chatId||'').trim(), date=mhIsoDate_(body.date), decision=String(body.decision||'').trim();
  if (!/^\d{5,20}$/.test(employeeId) || !date || !['confirm','excuse'].includes(decision)) throw new Error('INVALID_DECISION');
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const sh=mhSheet_(MH.SHEETS.absences); mhAssertHeaders_(sh,MH_OVERTIME.ABSENCE_HEADERS);
    const map=mhHeaderMap_(sh), values=sh.getDataRange().getDisplayValues();
    const idx=key=>map[key]-1;
    let rowNum=0, row=null, matched=false;
    for(let i=values.length-1;i>=1;i--) {
      if(String(values[i][idx('Chat ID')]||'').trim()===employeeId && mhDate_(values[i][idx('التاريخ')])===date) {
        matched=true;
        if(String(values[i][idx('الحالة')]||'').trim()==='بانتظار مراجعة المدير') {rowNum=i+1;row=values[i];break;}
      }
    }
    if(!rowNum) throw new Error(matched?'ABSENCE_ALREADY_REVIEWED':'ABSENCE_NOT_FOUND');
    const confirmed=decision==='confirm';
    const nextStatus=confirmed?'غياب مؤكد':'مغلق - ليس غيابًا';
    const decisionText=confirmed?'تأكيد الغياب':'ليس غائبًا';
    const stamp=mhNow_();
    sh.getRange(rowNum,map['الحالة']).setValue(nextStatus);
    sh.getRange(rowNum,map['قرار المدير']).setValue(decisionText);
    sh.getRange(rowNum,map['وقت القرار']).setValue(stamp);
    if (employeeId) {
      const message=confirmed?'تم تسجيل غيابك لهذا اليوم بعد مراجعة الإدارة. إذا كان هناك خطأ، تواصل مع المدير.':'تمت مراجعة حالة عدم الحضور، ولم يتم اعتمادها كغياب.';
      try { mhSendTelegramMini_(employeeId,message); mhAppendNotificationLog_(employeeId,'قرار مراجعة غياب','تم الإرسال',''); }
      catch(e) { try { mhAppendNotificationLog_(employeeId,'قرار مراجعة غياب','فشل',e.message); } catch(logErr) {} }
    }
    return {decided:true,status:nextStatus,decision:decisionText,employeeNotified:!!employeeId};
  } finally { lock.releaseLock(); }
}

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
    overtime: profile.role === 'employee' ? (function(){ try { return overtimeStatus_(profile); } catch(e) { console.error('Overtime status unavailable: '+e); return {canRequest:false,reason:'OVERTIME_UNAVAILABLE'}; } })() : null,
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
    const checkoutAt = new Date();
    const date = Utilities.formatDate(checkoutAt, MH.TZ, 'yyyy-MM-dd');
    const time = Utilities.formatDate(checkoutAt, MH.TZ, 'HH:mm:ss');
    sheet.appendRow([date, time, profile.chatId, profile.name, 'انصراف', Math.round(gps.distance), gps.accuracy, gps.lat, gps.lon, 'تم تسجيل الانصراف', 0, open.shiftId || '', '']);
    let overtime = null;
    try { overtime = finalizeOvertimeAtCheckoutMini_(profile, open, checkoutAt); }
    catch(overtimeError) { console.error('Overtime finalization failed after successful checkout: '+overtimeError); overtime = {status:'تعذر إغلاق سجل الأوفر تايم تلقائيًا',warning:true}; }
    return { recorded: true, type: 'انصراف', date: date, time: time, distanceMeters: Math.round(gps.distance), accuracyMeters: gps.accuracy, checkinDate: open.date, checkinTime: open.time, overtime: overtime };
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
    MH.SHEETS.shifts,
    MH.SHEETS.absences,
    MH.SHEETS.overtime
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

  // V40 schema: a personal advance is a request row of type "سلفة".
  // "طلبات السحب" remains exclusive to purchase cash/custody.
  const sh = mhSheet_(MH.SHEETS.requests);
  const map = mhAssertHeaders_(sh, MH_REQUESTS.REQUEST_HEADERS);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const rowNum = sh.getLastRow() + 1;
    const details = amount.toLocaleString('en-US',{maximumFractionDigits:2}) + ' جنيه';
    sh.appendRow([mhNow_(),profile.chatId,profile.name,'سلفة',details,MH_REQUESTS.PENDING_REQUEST,amount,'','','','','']);
    const requestId = 'ADV-' + Utilities.formatDate(new Date(),MH.TZ,'yyyyMMdd-HHmmss') + '-' + String(profile.chatId).slice(-4);
    const employeeMessage = '💵 تم تسجيل طلب السلفة بنجاح\n━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: '+requestId+'\n👤 الموظف: '+profile.name+'\n💰 المبلغ المطلوب: '+details+'\n⏳ الحالة: قيد مراجعة الإدارة';
    let employeeNotified = false;
    try { mhSendTelegramMini_(profile.chatId,employeeMessage,{remove_keyboard:true}); employeeNotified=true; }
    catch(e) { console.error('Advance employee confirmation failed: '+e); }
    const adminMessage = '💵 طلب سلفة جديد\n━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: '+requestId+'\n👤 الموظف: '+profile.name+'\n💰 المبلغ المطلوب: '+details+'\n📅 '+mhNow_()+'\n⏳ الحالة: قيد المراجعة\n\nافتح لوحة MobiHub لمراجعة الطلب.';
    const notification = mhNotifyRequestAdminsMini_(adminMessage,requestId);
    return {submitted:true,requestId:requestId,row:rowNum,status:MH_REQUESTS.PENDING_REQUEST,message:'تم إرسال طلب السلفة إلى الإدارة للمراجعة.',employeeNotified:employeeNotified,adminNotificationsSent:notification.sent,adminNotificationsFailed:notification.failed};
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
  mhRequireRole_(profile,['super_admin','admin','supervisor','finance']);
  const rowNum=Number(body.row), decision=String(body.decision || '');
  if (!Number.isInteger(rowNum)||rowNum<2||!['مقبول','مرفوض'].includes(decision)) throw new Error('INVALID_DECISION');
  const sh=mhSheet_(MH.SHEETS.requests); const map=mhAssertHeaders_(sh,MH_REQUESTS.REQUEST_HEADERS);
  if(rowNum>sh.getLastRow()) throw new Error('REQUEST_NOT_FOUND');
  const values=sh.getRange(rowNum,1,1,sh.getLastColumn()).getDisplayValues()[0];
  const get=h=>values[map[h]-1] || '';
  if(profile.role==='finance' && String(get('نوع الطلب')).trim()!=='سلفة') throw new Error('FORBIDDEN');
  const current=String(get('القرار')).trim();
  if(current!==MH_REQUESTS.PENDING_REQUEST) throw new Error('REQUEST_ALREADY_REVIEWED');
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try { sh.getRange(rowNum,map['القرار']).setValue(decision); } finally { lock.releaseLock(); }
  let employeeNotified=false;
  try {
    const isAdvance=String(get('نوع الطلب')).trim()==='سلفة';
    const resultText=isAdvance
      ? (decision==='مقبول'?'✅ تمت الموافقة على طلب السلفة.':'❌ تم رفض طلب السلفة.')
      : (decision==='مقبول'?'✅ تمت الموافقة على طلبك.':'❌ تم رفض طلبك.');
    const amountLine=isAdvance?'\n\n💰 المبلغ: '+String(get('مبلغ السلفة بالجنيه')||get('التفاصيل')||''):'';
    mhSendTelegramMini_(String(get('Chat ID')).trim(),resultText+amountLine+'\n👤 تمت المراجعة بواسطة: '+mhManagerName_(profile),{remove_keyboard:true});
    employeeNotified=true;
  } catch(notifyError) { console.error('Employee request decision notification failed: '+notifyError); }
  return {decided:true,status:decision,employeeNotified:employeeNotified};
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
  if (!/^\d{4}-\d{2}$/.test(m)) throw new Error('INVALID_MONTH');
  return m;
}
function financeNumber_(value, max) {
  const raw=String(value ?? '').replace(/[٬,]/g,'').trim();
  const n=Number(raw);
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || !Number.isFinite(n) || n<=0 || n>(max||1000000)) throw new Error('INVALID_AMOUNT');
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

function monthlySummary_(profile) {
  const ss = spreadsheet_();
  const month = mhToday_().slice(0, 7);
  const chatId = String(profile.chatId);
  const attendance = rowsAsObjects_(ss, MH.SHEETS.attendance).filter(r =>
    String(r['Chat ID']).trim() === chatId && mhDate_(r['التاريخ']).indexOf(month) === 0
  );
  const checkins = attendance.filter(r => String(r['النوع']).trim() === 'حضور');
  const checkouts = attendance.filter(r => String(r['النوع']).trim() === 'انصراف');
  const lateRows = checkins.filter(r => Number(r['دقائق التأخير'] || 0) > 0);
  const lateMinutes = lateRows.reduce((sum, r) => sum + Number(r['دقائق التأخير'] || 0), 0);
  const absences = rowsAsObjects_(ss, MH.SHEETS.absences).filter(r =>
    String(r['Chat ID']).trim() === chatId && mhDate_(r['التاريخ']).indexOf(month) === 0
  );
  const confirmedAbsences = absences.filter(r => /مؤكد|غياب/.test(String(r['قرار المدير'] || r['الحالة'] || ''))).length;
  const pendingAbsences = absences.filter(r => /انتظار|مراجعة/.test(String(r['الحالة'] || ''))).length;
  const leaveCount = rowsAsObjects_(ss, MH.SHEETS.leaves).filter(r =>
    String(r['Chat ID']).trim() === chatId && mhDate_(r['تاريخ الإذن']).indexOf(month) === 0
  ).length;
  return { month, checkins: checkins.length, checkouts: checkouts.length, lateDays: lateRows.length,
    lateMinutes, confirmedAbsences, pendingAbsences, leaveCount };
}

function rewardSummary_(profile, body) {
  const month = financeMonth_(body.month);
  const employeeId = String(body.employeeId || profile.chatId);
  if (employeeId !== profile.chatId) mhRequireRole_(profile, MH_FINANCE.REVIEW_ROLES);
  const employee = employeeId === profile.chatId
    ? { chatId: employeeId, name: profile.name }
    : financeEmployee_(employeeId);
  const ss = spreadsheet_();
  // Read each source sheet once. Avoid per-day Spreadsheet reads: they made
  // the old Mini App reward view slow and could exceed Apps Script quotas.
  const assignments = mhRowsObjects_(mhSheet_(MH.SHEETS.assignments));
  const shiftsData = mhRowsObjects_(mhSheet_(MH.SHEETS.shifts));
  const leaves = mhRowsObjects_(mhSheet_(MH.SHEETS.leaves));
  const attendance = mhRowsObjects_(mhSheet_(MH.SHEETS.attendance));
  const hygiene = mhRowsObjects_(mhSheet_(MH.SHEETS.rewardHygiene));
  const bonuses = mhRowsObjects_(mhSheet_(MH.SHEETS.rewardBonus));
  let eligible = 0, elapsedEligible = 0, earned = 0;
  let commitment = 0, onTime = 0, uniform = 0, hygienePoints = 0;
  let excluded = 0, shifts = 0, hygienePending = 0;
  const daysInMonth = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0).getDate();
  const today = mhToday_();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = month + '-' + String(day).padStart(2,'0');
    const dayOfWeek = new Date(date + 'T12:00:00').getDay();
    const assignmentRows = assignments.filter(r =>
      String(r['Chat ID'] || '').trim() === employeeId &&
      String(r['الحالة'] || 'نشط').trim() === 'نشط' &&
      (!mhDate_(r['تاريخ البداية']) || mhDate_(r['تاريخ البداية']) <= date) &&
      (!mhDate_(r['تاريخ النهاية']) || mhDate_(r['تاريخ النهاية']) >= date) &&
      String(r['أيام العمل'] || '0,1,2,3,4,6').split(',').map(x => Number(x.trim())).includes(dayOfWeek)
    );
    if (!assignmentRows.length) continue;
    const assignment = assignmentRows[assignmentRows.length - 1];
    const shiftId = String(assignment['Shift ID'] || '').trim();
    const shiftRow = shiftsData.find(r => String(r['Shift ID'] || '').trim() === shiftId && String(r['الحالة'] || 'نشط').trim() === 'نشط');
    if (!shiftRow) continue;
    const isFlexibleShift = shiftId === MH_ATTENDANCE.FLEX_SHIFT_ID || String(shiftRow['اسم الوردية'] || '').trim() === 'بدون ميعاد ثابت';
    const shiftStart = isFlexibleShift ? '' : mhTime_(shiftRow['موعد الحضور']);
    shifts++;
    const approvedLeave = leaves.some(r => {
      if (String(r['Chat ID'] || '').trim() !== employeeId || String(r['الحالة'] || '').trim() !== 'مقبول') return false;
      const leaveType = String(r['نوع الإذن'] || '').trim();
      const leaveStart = mhDate_(r['تاريخ الإذن']);
      const leaveEnd = mhDate_(r['تاريخ نهاية الإذن']) || leaveStart;
      if (leaveType === 'يوم كامل') return !!leaveStart && date >= leaveStart && date <= leaveEnd;
      return leaveType === 'بالساعات' && leaveStart === date && !isFlexibleShift && mhTimeMinutes_(r['من الساعة']) >= 0 && mhTimeMinutes_(r['من الساعة']) <= mhTimeMinutes_(shiftStart);
    });
    if (approvedLeave) { excluded++; continue; }

    // Match V40: two scheduled points per shift; future shifts remain in
    // the monthly denominator but are not scored before the shift ends.
    eligible += MH_FINANCE.DAILY_POINTS;
    if (date >= today) continue;
    elapsedEligible += MH_FINANCE.DAILY_POINTS;

    const records = attendance.filter(r =>
      String(r['Chat ID'] || '').trim() === employeeId &&
      mhDate_(r['التاريخ']) === date &&
      String(r['النوع'] || '').trim() === 'حضور'
    );
    const attended = records.length ? records[records.length - 1] : null;
    const isOnTime = !!(attended &&
      String(attended['حالة الحضور'] || '').trim() === 'في الموعد' &&
      Number(attended['دقائق التأخير'] || 0) === 0);
    const isUniform = !!(attended && String(attended['اليونيفورم'] || '').trim() === 'ملتزم');
    if (isOnTime) onTime++;
    if (isUniform) uniform++;
    if (isOnTime && isUniform) { commitment++; earned++; }

    const dayHygiene = hygiene.filter(r =>
      String(r['Chat ID'] || '').trim() === employeeId &&
      mhDate_(r['التاريخ']) === date
    ).slice(-1)[0];
    const rating = dayHygiene ? String(dayHygiene['التقييم'] || '').trim() : '';
    if (rating === 'نظيف') { hygienePoints++; earned++; }
    else if (!rating) hygienePending++;
  }

  const scoredEligible = Math.max(0, elapsedEligible - hygienePending);
  const ratio = scoredEligible ? Math.min(1, earned / scoredEligible) : 0;
  const monthHygiene = hygiene.filter(r =>
    String(r['Chat ID'] || '').trim() === employeeId &&
    String(mhDate_(r['التاريخ'])).startsWith(month)
  );
  const clean = monthHygiene.filter(r => String(r['التقييم'] || '').trim() === 'نظيف').length;
  const notClean = monthHygiene.filter(r => String(r['التقييم'] || '').trim() === 'غير ملتزم').length;
  const bonusRows = bonuses.filter(r =>
    String(r['Chat ID'] || '').trim() === employeeId &&
    String(r['الشهر'] || '').trim() === month &&
    String(r['الحالة'] || 'معتمد').trim() === 'معتمد'
  );
  const bonus = bonusRows.reduce((sum,r) => sum + Number(r['المبلغ بالجنيه'] || 0), 0);
  const deductionRows = mhRowsObjects_(mhSheet_(MH.SHEETS.deductions)).filter(r =>
    String(r['Chat ID'] || '').trim() === employeeId &&
    String(mhDate_(r['تاريخ الواقعة'])).startsWith(month)
  );
  const approved = deductionRows.filter(r => String(r['الحالة'] || '').trim() === 'معتمد');
  const pending = deductionRows.filter(r => String(r['الحالة'] || '').trim() === 'بانتظار اعتماد المدير');

  return {
    employeeName: employee.name, month, shifts, excluded, eligible, elapsedEligible,
    scoredEligible, earned, commitment, onTime, uniform, hygienePoints, hygienePending,
    clean, notClean, ratio,
    base: Math.round(MH_FINANCE.BASE_REWARD * ratio * 100) / 100,
    bonus: Math.round(bonus * 100) / 100,
    total: Math.round((MH_FINANCE.BASE_REWARD * ratio + bonus) * 100) / 100,
    deductionsApproved: approved.reduce((s,r) => s + Number(r['المبلغ بالجنيه'] || 0), 0),
    deductionsPending: pending.reduce((s,r) => s + Number(r['المبلغ بالجنيه'] || 0), 0),
    deductionRows: deductionRows.slice(-30).reverse(),
    hygieneRows: monthHygiene.slice(-31).reverse(),
    bonusRows: bonusRows.slice(-31).reverse()
  };
}

function activeEmployeesMini_(profile) {
  mhRequireRole_(profile,['super_admin','admin','finance','supervisor']);
  return rowsAsObjects_(spreadsheet_(),MH.SHEETS.employees)
    .filter(r=>String(r['الحالة']||'').trim()==='نشط'&&String(r['حالة الحساب']||'نشط').trim()==='نشط'&&String(r['Chat ID']||'').trim())
    .map(r=>({ 'Chat ID':String(r['Chat ID']).trim(), 'اسم الموظف':String(r['اسم الموظف']||'') }));
}


/* CASH WITHDRAWAL — ported to Mini App using V40 sheet layout and admin callback contract. */
function createCashWithdrawalMini_(profile, body) {
  if (profile.role !== 'employee') throw new Error('EMPLOYEE_ONLY');
  const amountRaw = String(body.amount ?? '').replace(/[٬,]/g, '').trim();
  const amount = Number(amountRaw);
  const purpose = String(body.purpose || '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(amountRaw) || !Number.isFinite(amount) || amount <= 0 || amount > 1000000) throw new Error('INVALID_CASH_AMOUNT');
  if (purpose.length < 3 || purpose.length > 1000) throw new Error('INVALID_REQUEST_DETAILS');
  const sh = mhSheet_(MH.SHEETS.cash), map = mhAssertHeaders_(sh, MH_CASH.HEADERS);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const id = 'CASH-' + Utilities.formatDate(new Date(), MH.TZ, 'yyyyMMdd-HHmmss') + '-' + String(profile.chatId).slice(-4);
    const row = new Array(MH_CASH.HEADERS.length).fill('');
    const set = (h,v) => row[MH_CASH.HEADERS.indexOf(h)] = v;
    set('رقم الطلب',id); set('التاريخ والوقت',mhNow_()); set('Chat ID',profile.chatId); set('اسم الموظف',profile.name);
    set('المبلغ المطلوب بالجنيه',amount); set('الغرض',purpose); set('الحالة','قيد المراجعة'); set('حالة الصرف','لم يصرف');
    set('حالة العهدة','غير مطلوبة بعد'); set('تاريخ آخر تحديث',mhNow_());
    sh.appendRow(row);
    const rowNum = sh.getLastRow();
    const employeeMessage = '💰 تم تسجيل طلب عهدة مالية\n━━━━━━━━━━━━━━━━━━\n' +
      '🆔 رقم الطلب: ' + id + '\n👤 الموظف: ' + profile.name + '\n' +
      '💵 المبلغ المطلوب: ' + mhCashMoneyMini_(amount) + ' جنيه\n📝 الغرض: ' + purpose + '\n' +
      '━━━━━━━━━━━━━━━━━━\n⏳ الحالة: بانتظار موافقة الإدارة';
    let employeeNotified = false;
    // Mini App migration: employee confirmations must never re-create the
    // retired persistent Reply Keyboard. The Mini App is the primary menu.
    try { mhSendTelegramMini_(profile.chatId, employeeMessage, { remove_keyboard: true }); employeeNotified = true; }
    catch (notifyError) { console.error('Unable to send V40-style employee confirmation for ' + id + ': ' + notifyError); }
    const adminMessage = '💰 طلب عهدة مالية جديد\n━━━━━━━━━━━━━━━━━━\n' +
      '🆔 رقم الطلب: ' + id + '\n👤 مقدم الطلب: ' + profile.name + '\n' +
      '💵 المبلغ المطلوب: ' + mhCashMoneyMini_(amount) + ' جنيه\n📝 الغرض: ' + purpose + '\n' +
      '━━━━━━━━━━━━━━━━━━\n⏳ الحالة: بانتظار موافقة الإدارة';
    const notification=mhNotifyFinanceAdminsMini_(adminMessage+'\nافتح لوحة MobiHub لمراجعة طلب العهدة والصرف والتسوية.',null,id);
    return {submitted:true,requestId:id,status:'قيد المراجعة',employeeMessage:employeeMessage,employeeNotified:employeeNotified,adminNotificationsSent:notification.sent,adminNotificationsFailed:notification.failed};
  } finally { lock.releaseLock(); }
}
function mhCashMoneyMini_(value) {
  return Number(value).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
}
function mhSendTelegramMini_(chatId, text, replyMarkup) {
  const token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN') || PropertiesService.getScriptProperties().getProperty('MOBIHUB_TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('Missing BOT_TOKEN Script Property');
  const payload = {chat_id:String(chatId),text:String(text)};
  if (replyMarkup) payload.reply_markup = replyMarkup;
  const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage',{
    method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true
  });
  const result = JSON.parse(response.getContentText() || '{}');
  if (!result.ok) throw new Error('TELEGRAM_SEND_FAILED');
  return result;
}
function mhNotifyFinanceAdminsMini_(message, keyboard, requestId) {
  const ss=spreadsheet_(), managers=rowsAsObjects_(ss,MH.SHEETS.managers), recipients=[];
  const rootId=String(PropertiesService.getScriptProperties().getProperty('ADMIN_ID')||'9134455704').trim();
  if(/^\d{5,20}$/.test(rootId)) recipients.push(rootId);
  managers.forEach(r=>{
    const id=String(r['Chat ID']||'').trim(), role=String(r['الصلاحية']||'').trim(), active=String(r['الحالة']||'نشط').trim()==='نشط';
    if(id&&active&&['Super Admin','Admin','Finance'].includes(role)&&!recipients.includes(id)) recipients.push(id);
  });
  let sent=0,failed=0;
  recipients.forEach(id=>{
    try { mhSendTelegramMini_(id,message+(requestId?'\n\nمرجع الإشعار: '+requestId:''),keyboard||{remove_keyboard:true}); sent++; }
    catch(e) { failed++; console.error('MobiHub finance notification failed for '+id+': '+e); }
  });
  return {sent:sent,failed:failed,recipients:recipients.length};
}


/* Telegram notification delivery for personal advance requests. */
function mhNotifyRequestAdminsMini_(message, requestId) {
  const ss=spreadsheet_();
  const managers=rowsAsObjects_(ss,MH.SHEETS.managers);
  const recipients=[];
  const rootId=String(PropertiesService.getScriptProperties().getProperty('ADMIN_ID')||'9134455704').trim();
  if(/^\d{5,20}$/.test(rootId)) recipients.push(rootId);
  managers.forEach(r=>{
    const id=String(r['Chat ID']||'').trim();
    const role=String(r['الصلاحية']||'').trim();
    const active=String(r['الحالة']||'نشط').trim()==='نشط';
    if(id&&active&&['Super Admin','Admin','Finance'].includes(role)&&!recipients.includes(id)) recipients.push(id);
  });
  let sent=0,failed=0;
  recipients.forEach(id=>{
    try { mhSendTelegramMini_(id,message+'\n\nمرجع الإشعار: '+requestId,{remove_keyboard:true}); sent++; }
    catch(e) { failed++; console.error('Advance admin notification failed for '+id+': '+e); }
  });
  return {sent:sent,failed:failed,recipients:recipients.length};
}


/* =========================================================
   V1.10.2 — DEVICE OPERATIONS, NOTIFICATIONS, ADMIN USERS
   All mutations are server-side role checked and audited.
========================================================= */
const MH_DEVICE_HEADERS = ['رقم الطلب','تاريخ الاستلام','اسم الجهاز','اسم العميل','المشكلة المسجلة','مسؤول الاستلام Chat ID','مسؤول الاستلام','الموظف المسؤول Chat ID','الموظف المسؤول','القسم','حالة الجهاز','مكان الجهاز','آخر تحديث'];
const MH_DEVICE_MOVEMENT_HEADERS = ['التاريخ والوقت','رقم الطلب','نوع الحركة','من Chat ID','من الموظف','إلى Chat ID','إلى الموظف','الحالة','المكان','ملاحظات','منفذ الحركة Chat ID','منفذ الحركة'];
const MH_NOTIFICATION_HEADERS = ['معرف الإشعار','التاريخ والوقت','المستلم','نوع الإشعار','مفتاح منع التكرار','الحالة','تفاصيل الخطأ'];
const MH_NOTIFICATION_SETTING_HEADERS = ['الإعداد','القيمة','الوصف'];
const MH_MANAGER_HEADERS = ['Chat ID','اسم المدير','الصلاحية','الحالة','أضيف بواسطة','تاريخ الإضافة','آخر تحديث'];
const MH_DEVICE_STATUSES = ['تم الاستلام','قيد الفحص','يحتاج قطعة غيار','يحتاج التواصل مع العميل','بانتظار رد العميل','لم يتم الرد','قيد الإصلاح','مراجعة الجودة','يحتاج إعادة فحص','جاهز للتسليم','تم التسليم'];
const MH_DEVICE_LOCATIONS = ['قسم الاستلام','ترابيزة الهاردوير','درج الفحص 1','درج الفحص 2','درج مراجعة الجودة','درج انتظار قطع الغيار','درج انتظار العميل','درج جاهز للتسليم','مكان آخر'];
const MH_ADMIN_ROLES = ['Admin','Finance','Supervisor'];

function mhEnsureSheet_(name, headers) {
  const ss=spreadsheet_(); let sh=ss.getSheetByName(name);
  if(!sh) sh=ss.insertSheet(name);
  if(sh.getLastRow()===0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  mhAssertHeaders_(sh,headers);
  return sh;
}
function mhStamp_(){return Utilities.formatDate(new Date(),MH.TZ,'yyyy-MM-dd HH:mm:ss');}
function mhAppendNotificationLog_(recipient,type,status,errorText) {
  const sh=mhEnsureSheet_('سجل الإشعارات',MH_NOTIFICATION_HEADERS);
  sh.appendRow([Utilities.getUuid(),mhStamp_(),String(recipient),String(type),'miniapp_'+Utilities.getUuid(),String(status),String(errorText||'')]);
}
function mhTelegramSend_(chatId,message) {
  const token=PropertiesService.getScriptProperties().getProperty('MOBIHUB_TELEGRAM_BOT_TOKEN') ||
    PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if(!token) throw new Error('BOT_TOKEN_NOT_CONFIGURED');
  const response=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/sendMessage',{
    method:'post',contentType:'application/json',muteHttpExceptions:true,
    payload:JSON.stringify({chat_id:String(chatId),text:String(message).slice(0,3900),disable_web_page_preview:true})
  });
  const result=JSON.parse(response.getContentText()||'{}');
  if(!result.ok) throw new Error('TELEGRAM_SEND_FAILED');
  return result;
}
function managerUpdateDevice_(profile,body) {
  mhRequireRole_(profile,['super_admin','admin']);
  const orderId=String(body.orderId||'').trim();
  const status=String(body.status||'').trim();
  const location=String(body.location||'').trim();
  const employeeId=String(body.employeeId||'').trim();
  const note=String(body.note||'').trim().slice(0,500);
  if(!orderId || MH_DEVICE_STATUSES.indexOf(status)<0 || MH_DEVICE_LOCATIONS.indexOf(location)<0) throw new Error('INVALID_DEVICE_UPDATE');
  const sh=mhEnsureSheet_('الأجهزة',MH_DEVICE_HEADERS), map=mhHeaderMap_(sh);
  const rows=mhRowsObjects_(sh), found=rows.find(r=>String(r['رقم الطلب']).trim()===orderId);
  if(!found) throw new Error('DEVICE_NOT_FOUND');
  let nextEmployeeId=String(found['الموظف المسؤول Chat ID']||'').trim();
  let nextEmployee=String(found['الموظف المسؤول']||'').trim();
  if(employeeId) {
    const emp=rowsAsObjects_(spreadsheet_(),MH.SHEETS.employees).find(r=>String(r['Chat ID']).trim()===employeeId && String(r['الحالة']||'نشط').trim()==='نشط' && String(r['حالة الحساب']||'نشط').trim()==='نشط');
    if(!emp) throw new Error('EMPLOYEE_NOT_FOUND_OR_INACTIVE');
    nextEmployeeId=employeeId; nextEmployee=String(emp['اسم الموظف']||'');
  }
  const row=found.__row, oldId=String(found['الموظف المسؤول Chat ID']||''), oldName=String(found['الموظف المسؤول']||'');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    sh.getRange(row,map['الموظف المسؤول Chat ID']).setValue(nextEmployeeId);
    sh.getRange(row,map['الموظف المسؤول']).setValue(nextEmployee);
    sh.getRange(row,map['حالة الجهاز']).setValue(status);
    sh.getRange(row,map['مكان الجهاز']).setValue(location);
    sh.getRange(row,map['آخر تحديث']).setValue(mhStamp_());
    const movement=mhEnsureSheet_('سجل حركة الأجهزة',MH_DEVICE_MOVEMENT_HEADERS);
    movement.appendRow([mhStamp_(),orderId,'تحديث من لوحة الإدارة',oldId,oldName,nextEmployeeId,nextEmployee,status,location,note,profile.chatId,profile.name]);
  } finally {lock.releaseLock();}
  if(employeeId && employeeId!==oldId) {
    try { mhTelegramSend_(employeeId,'📱 تم إسناد جهاز إليك من إدارة MobiHub\\nرقم الطلب: '+orderId+'\\nالجهاز: '+String(found['اسم الجهاز']||'')+'\\nالحالة: '+status+'\\nالمكان: '+location); mhAppendNotificationLog_(employeeId,'إسناد جهاز','تم الإرسال',''); }
    catch(e){mhAppendNotificationLog_(employeeId,'إسناد جهاز','فشل',e.message);}
  }
  return {updated:true,orderId:orderId,status:status,location:location,employeeId:nextEmployeeId,employee:nextEmployee};
}
function managerSetNotificationSetting_(profile,body) {
  mhRequireRole_(profile,['super_admin','admin']);
  const key=String(body.key||'').trim(), value=body.enabled===true?'TRUE':'FALSE';
  if(!key || key.length>120) throw new Error('INVALID_SETTING');
  const sh=mhEnsureSheet_('إعدادات الإشعارات',MH_NOTIFICATION_SETTING_HEADERS);
  const map=mhHeaderMap_(sh), rows=mhRowsObjects_(sh), found=rows.find(r=>String(r['الإعداد']).trim()===key);
  if(!found) throw new Error('SETTING_NOT_FOUND');
  sh.getRange(found.__row,map['القيمة']).setValue(value);
  return {key:key,value:value};
}
function managerSendNotification_(profile,body) {
  mhRequireRole_(profile,['super_admin','admin']);
  const recipient=String(body.recipient||'').trim(), message=String(body.message||'').trim();
  if(message.length<2 || message.length>3900) throw new Error('INVALID_NOTIFICATION_MESSAGE');
  const employees=rowsAsObjects_(spreadsheet_(),MH.SHEETS.employees).filter(r=>String(r['الحالة']||'نشط').trim()==='نشط' && String(r['حالة الحساب']||'نشط').trim()==='نشط' && String(r['Chat ID']||'').trim());
  const targets=recipient==='all'?employees:employees.filter(r=>String(r['Chat ID']).trim()===recipient);
  if(!targets.length) throw new Error('NOTIFICATION_RECIPIENT_NOT_FOUND');
  let sent=0,failed=0;
  targets.forEach(emp=>{
    const id=String(emp['Chat ID']).trim();
    try { mhTelegramSend_(id,message); mhAppendNotificationLog_(id,'رسالة إدارية','تم الإرسال',''); sent++; }
    catch(e){ mhAppendNotificationLog_(id,'رسالة إدارية','فشل',e.message); failed++; }
  });
  return {sent:sent,failed:failed,total:targets.length};
}
function managerCreateAdmin_(profile,body) {
  mhRequireRole_(profile,['super_admin']);
  const id=String(body.chatId||'').trim(), name=String(body.name||'').trim(), role=String(body.role||'Admin').trim();
  if(!/^\d{5,20}$/.test(id)||name.length<2||name.length>80||MH_ADMIN_ROLES.indexOf(role)<0) throw new Error('INVALID_MANAGER_DATA');
  const sh=mhEnsureSheet_('المديرين',MH_MANAGER_HEADERS), rows=mhRowsObjects_(sh);
  if(rows.some(r=>String(r['Chat ID']).trim()===id)) throw new Error('MANAGER_ALREADY_EXISTS');
  sh.appendRow([id,name,role,'نشط',profile.chatId,mhStamp_(),mhStamp_()]);
  try{mhTelegramSend_(id,'🛡️ تم تفعيل صلاحية '+role+' في نظام MobiHub. أرسل /start لفتح لوحة الإدارة.');}catch(e){}
  return {created:true,chatId:id,name:name,role:role};
}
function managerUpdateAdmin_(profile,body) {
  mhRequireRole_(profile,['super_admin']);
  const id=String(body.chatId||'').trim(), role=String(body.role||'').trim();
  const hasStatus=Object.prototype.hasOwnProperty.call(body,'status');
  const status=hasStatus?String(body.status||'').trim():'';
  if(!/^\d{5,20}$/.test(id)||id===String(profile.chatId)) throw new Error('INVALID_MANAGER_ID');
  if(role && MH_ADMIN_ROLES.indexOf(role)<0) throw new Error('INVALID_MANAGER_ROLE');
  if(hasStatus && ['نشط','موقوف'].indexOf(status)<0) throw new Error('INVALID_MANAGER_STATUS');
  const sh=mhEnsureSheet_('المديرين',MH_MANAGER_HEADERS), map=mhHeaderMap_(sh), found=mhRowsObjects_(sh).find(r=>String(r['Chat ID']).trim()===id);
  if(!found) throw new Error('MANAGER_NOT_FOUND');
  if(role) sh.getRange(found.__row,map['الصلاحية']).setValue(role);
  if(hasStatus) sh.getRange(found.__row,map['الحالة']).setValue(status);
  sh.getRange(found.__row,map['آخر تحديث']).setValue(mhStamp_());
  return {updated:true,chatId:id,role:role||String(found['الصلاحية']),status:hasStatus?status:String(found['الحالة'])};
}



/* V1.10.5 device detail, history, transfer and inspection catalog integration.
 * Uses the existing V1.10.4 sheet schema and authorization model.
 */
function deviceListMiniV105_(profile) {
  const ss = spreadsheet_();
  const rows = rowsAsObjects_(ss, MH.SHEETS.devices);
  const admin = ['super_admin','admin'].includes(profile.role);
  const intakeAllowed = deviceIntakeAllowed_(profile);
  return rows.filter(r => {
    const intakeId = String(r['مسؤول الاستلام Chat ID'] || '').trim();
    const employeeId = String(r['الموظف المسؤول Chat ID'] || '').trim();
    return admin || (intakeAllowed && intakeId === String(profile.chatId)) ||
      employeeId === String(profile.chatId);
  }).slice(-150).reverse().map(r => ({
    orderId:String(r['رقم الطلب'] || ''),
    receivedAt:String(r['تاريخ الاستلام'] || ''),
    deviceName:String(r['اسم الجهاز'] || ''),
    customerName:String(r['اسم العميل'] || ''),
    issue:String(r['المشكلة المسجلة'] || ''),
    intakeId:String(r['مسؤول الاستلام Chat ID'] || ''),
    intakeName:String(r['مسؤول الاستلام'] || ''),
    employeeId:String(r['الموظف المسؤول Chat ID'] || ''),
    employeeName:String(r['الموظف المسؤول'] || ''),
    department:String(r['القسم'] || ''),
    status:String(r['حالة الجهاز'] || ''),
    location:String(r['مكان الجهاز'] || ''),
    updatedAt:String(r['آخر تحديث'] || '')
  })).filter(r => r.orderId);
}

function deviceDetailMiniV105_(profile, body) {
  const orderId = String(body.orderId || '').trim();
  if (!orderId) throw new Error('DEVICE_NOT_FOUND');
  const ss = spreadsheet_();
  const rows = rowsAsObjects_(ss, MH.SHEETS.devices);
  const row = rows.find(r => String(r['رقم الطلب'] || '').trim() === orderId);
  if (!row) throw new Error('DEVICE_NOT_FOUND');
  const admin = ['super_admin','admin'].includes(profile.role);
  const intakeAllowed = deviceIntakeAllowed_(profile);
  const canView = admin ||
    (intakeAllowed && String(row['مسؤول الاستلام Chat ID'] || '').trim() === String(profile.chatId)) ||
    String(row['الموظف المسؤول Chat ID'] || '').trim() === String(profile.chatId);
  if (!canView) throw new Error('FORBIDDEN');
  const history = rowsAsObjects_(ss, 'سجل حركة الأجهزة')
    .filter(r => String(r['رقم الطلب'] || '').trim() === orderId)
    .slice(-30).reverse();
  return {
    device: {
      orderId:orderId,
      receivedAt:String(row['تاريخ الاستلام'] || ''),
      deviceName:String(row['اسم الجهاز'] || ''),
      customerName:String(row['اسم العميل'] || ''),
      issue:String(row['المشكلة المسجلة'] || ''),
      intakeName:String(row['مسؤول الاستلام'] || ''),
      employeeId:String(row['الموظف المسؤول Chat ID'] || ''),
      employeeName:String(row['الموظف المسؤول'] || ''),
      department:String(row['القسم'] || ''),
      status:String(row['حالة الجهاز'] || ''),
      location:String(row['مكان الجهاز'] || ''),
      updatedAt:String(row['آخر تحديث'] || '')
    },
    history:history
  };
}

function deviceStaffMiniV105_(profile) {
  if (!deviceIntakeAllowed_(profile) && !['super_admin','admin'].includes(profile.role)) {
    throw new Error('FORBIDDEN');
  }
  return rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees)
    .filter(r => String(r['Chat ID'] || '').trim() && mhEmployeeIsActive_(r))
    .filter(r => !mhIsIntakeJob_(mhEmployeeJob_(r)))
    .map(r => ({
      chatId:String(r['Chat ID']).trim(),
      name:String(r['اسم الموظف'] || ''),
      job:mhEmployeeJob_(r)
    })).slice(0,150);
}

function deviceStatusUpdateMiniV105_(profile, body) {
  const orderId = String(body.orderId || '').trim();
  const status = String(body.status || '').trim();
  const location = String(body.location || '').trim();
  const note = String(body.note || '').trim().slice(0,500);
  if (!orderId || MH_DEVICE_STATUSES.indexOf(status) < 0) throw new Error('INVALID_DEVICE_UPDATE');
  if (location && MH_DEVICE_LOCATIONS.indexOf(location) < 0) throw new Error('INVALID_DEVICE_LOCATION');
  const ss = spreadsheet_();
  const sh = ss.getSheetByName(MH.SHEETS.devices);
  if (!sh) throw new Error('DEVICE_SHEETS_MISSING');
  mhAssertHeaders_(sh, MH_DEVICE.DEVICE_HEADERS);
  const rows = mhRowsObjects_(sh);
  const found = rows.find(r => String(r['رقم الطلب'] || '').trim() === orderId);
  if (!found) throw new Error('DEVICE_NOT_FOUND');
  const admin = ['super_admin','admin'].includes(profile.role);
  const intakeAllowed = deviceIntakeAllowed_(profile);
  const assigned = String(found['الموظف المسؤول Chat ID'] || '').trim() === String(profile.chatId);
  if (!admin && !intakeAllowed && !assigned) throw new Error('FORBIDDEN');
  const movement = mhEnsureSheet_('سجل حركة الأجهزة', MH_DEVICE.MOVEMENT_HEADERS);
  const row = found.__row;
  const oldStatus = String(found['حالة الجهاز'] || '');
  const oldLocation = String(found['مكان الجهاز'] || '');
  const now = mhStamp_();
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const map = mhHeaderMap_(sh);
    sh.getRange(row, map['حالة الجهاز']).setValue(status);
    if (location) sh.getRange(row, map['مكان الجهاز']).setValue(location);
    sh.getRange(row, map['آخر تحديث']).setValue(now);
    movement.appendRow([now, orderId, 'تحديث حالة الجهاز', profile.chatId, profile.name, String(found['الموظف المسؤول Chat ID'] || ''), String(found['الموظف المسؤول'] || ''), status, location || oldLocation, note, profile.chatId, profile.name]);
  } finally { lock.releaseLock(); }
  return {orderId:orderId,status:status,location:location || oldLocation,previousStatus:oldStatus,updatedAt:now};
}

function deviceTransferMiniV105_(profile, body) {
  if (!['super_admin','admin'].includes(profile.role)) throw new Error('FORBIDDEN');
  const orderId = String(body.orderId || '').trim();
  const employeeId = String(body.employeeId || '').trim();
  if (!orderId || !employeeId) throw new Error('INVALID_DEVICE_TRANSFER');
  const ss = spreadsheet_();
  const sh = ss.getSheetByName(MH.SHEETS.devices);
  if (!sh) throw new Error('DEVICE_SHEETS_MISSING');
  mhAssertHeaders_(sh, MH_DEVICE.DEVICE_HEADERS);
  const rows = mhRowsObjects_(sh);
  const found = rows.find(r => String(r['رقم الطلب'] || '').trim() === orderId);
  if (!found) throw new Error('DEVICE_NOT_FOUND');
  const target = rowsAsObjects_(ss, MH.SHEETS.employees).find(r =>
    String(r['Chat ID'] || '').trim() === employeeId && mhEmployeeIsActive_(r) &&
    !mhIsIntakeJob_(mhEmployeeJob_(r)));
  if (!target) throw new Error('EMPLOYEE_NOT_FOUND_OR_INACTIVE');
  const movement = mhEnsureSheet_('سجل حركة الأجهزة', MH_DEVICE.MOVEMENT_HEADERS);
  const map = mhHeaderMap_(sh), row = found.__row, now = mhStamp_();
  const oldId = String(found['الموظف المسؤول Chat ID'] || '');
  const oldName = String(found['الموظف المسؤول'] || '');
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    sh.getRange(row, map['الموظف المسؤول Chat ID']).setValue(employeeId);
    sh.getRange(row, map['الموظف المسؤول']).setValue(String(target['اسم الموظف'] || ''));
    sh.getRange(row, map['القسم']).setValue(mhEmployeeJob_(target));
    sh.getRange(row, map['آخر تحديث']).setValue(now);
    movement.appendRow([now, orderId, 'تحويل مسؤولية الجهاز', oldId, oldName, employeeId, String(target['اسم الموظف'] || ''), String(found['حالة الجهاز'] || ''), String(found['مكان الجهاز'] || ''), 'تحويل من Mini App بواسطة ' + profile.name, profile.chatId, profile.name]);
  } finally { lock.releaseLock(); }
  const message = 'تم إسناد الجهاز رقم ' + orderId + ' إليك بواسطة ' + profile.name;
  try { mhTelegramSend_(employeeId, message); mhAppendNotificationLog_(employeeId, 'إسناد جهاز', 'تم الإرسال', ''); }
  catch (e) { mhAppendNotificationLog_(employeeId, 'إسناد جهاز', 'فشل الإرسال', String(e.message || e)); }
  return {orderId:orderId,from:oldName,to:String(target['اسم الموظف'] || ''),updatedAt:now};
}


const MH_DEVICE_INSPECTION_CATALOG_ = {"iphone": {"name": "iPhone", "items": ["الشاشة: الصورة والألوان والبقع والبيكسلات الميتة", "اللمس: الاستجابة في جميع أجزاء الشاشة", "سطوع الشاشة والسطوع التلقائي", "True Tone وNight Shift", "معدل تحديث الشاشة ProMotion إن وجد", "Face ID وفتح القفل", "الكاميرا الأمامية: الصورة والتركيز", "الكاميرا الأمامية: تسجيل الفيديو", "الكاميرا الخلفية الرئيسية: الصورة والتركيز", "الكاميرا الخلفية فائقة الاتساع إن وجدت", "كاميرا التقريب Telephoto إن وجدت", "الفلاش الخلفي", "وضع Portrait والعزل", "تثبيت الصورة والتركيز أثناء الفيديو", "سماعة المكالمات العلوية", "السماعة الخارجية ووضوح الصوت", "الميكروفون أثناء المكالمات", "الميكروفونات أثناء تصوير الفيديو", "الميكروفون وتسجيل Voice Memos", "زر رفع الصوت وخفضه", "زر التشغيل والقفل", "مفتاح الصامت أو Action Button حسب الموديل", "الاهتزاز وTaptic Engine", "الشحن السلكي ومنفذ Lightning أو USB-C", "الشحن اللاسلكي وMagSafe إن وجد", "صحة البطارية وعدد دورات الشحن إن أمكن", "ثبات الشحن وعدم وجود سخونة غير طبيعية", "إجراء واستقبال المكالمات عبر الشبكة الخلوية", "بيانات الهاتف المحمول 4G / 5G", "الاتصال بشبكة Wi-Fi وثباته", "Bluetooth والاتصال بالملحقات", "GPS وتحديد الموقع", "مستشعر القرب وإطفاء الشاشة أثناء المكالمة", "مستشعر الإضاءة التلقائية", "الجيروسكوب ومقياس التسارع", "البوصلة والاتجاهات", "NFC وApple Pay إن أمكن اختباره", "درج الشريحة وقراءة SIM أو eSIM حسب الموديل", "الأزرار والهيكل والإطار والزجاج وآثار الصدمات", "مؤشرات السوائل وآثار الرطوبة أو التآكل"]}, "ipad": {"name": "iPad", "items": ["الشاشة: الصورة والألوان والبقع", "اللمس والقلم إن وجد", "الكاميرا الأمامية", "الكاميرا الخلفية والفلاش", "السماعات", "الميكروفونات", "الشحن ومنفذ الشحن", "البطارية والشحن", "الأزرار", "Wi-Fi وBluetooth", "الشبكة الخلوية إن وجدت", "الحساسات والبصمة إن وجدت", "الهيكل وآثار الصدمات", "مؤشرات أو آثار السوائل"]}, "macbook": {"name": "MacBook", "items": ["الشاشة والإضاءة والبقع", "الكاميرا", "الميكروفونات", "السماعات", "لوحة المفاتيح", "Trackpad", "Touch ID إن وجد", "البطارية ودورة الشحن", "الشاحن ومنفذ الشحن", "منافذ USB / Thunderbolt / HDMI", "Wi-Fi وBluetooth", "المفصلات والهيكل", "المراوح ودرجة الحرارة", "آثار السوائل أو الصدمات"]}, "watch": {"name": "Apple Watch", "items": ["الشاشة واللمس", "Digital Crown", "الزر الجانبي", "البطارية والشحن المغناطيسي", "السماعة", "الميكروفون", "الاهتزاز", "الحساسات", "الاتصال والاقتران", "الهيكل والزجاج", "آثار السوائل أو الصدمات"]}, "airpods": {"name": "AirPods", "items": ["سماعة اليمين", "سماعة الشمال", "الميكروفونات", "علبة الشحن", "منفذ أو وسيلة الشحن", "البطارية لكل سماعة", "الاقتران والاتصال", "حساسات الأذن والإيقاف التلقائي", "إلغاء الضوضاء / الشفافية إن وجدت", "الهيكل وآثار السوائل"]}};

function getInspectionInstruction_(deviceType, index) {
  var iphoneInstructions = [
    'افتح تطبيق الصور واعرض صورًا فاتحة وداكنة وملونة. افحص وجود بقع ثابتة أو خطوط أو نقاط لا يتغير لونها.',
    'مرّر إصبعك على الشاشة بالكامل، وافتح لوحة الرسم أو الأيقونات وجرّب السحب والضغط والكتابة عند الحواف والزوايا.',
    'ارفع السطوع وخفّضه يدويًا، ثم فعّل السطوع التلقائي وجرّب تغيير الإضاءة المحيطة ولاحظ استجابة الشاشة.',
    'من الإعدادات > الشاشة والإضاءة، فعّل True Tone ثم أوقفه ولاحظ تغير حرارة الألوان. جرّب Night Shift أيضًا.',
    'إذا كان الموديل يدعم ProMotion، جرّب التمرير السريع بين الصفحات والقوائم ولاحظ سلاسة الحركة وعدم التقطيع غير الطبيعي.',
    'من الإعدادات > Face ID ورمز الدخول، اختبر إعداد Face ID وفتح القفل عدة مرات. لا تُعد ضبط بيانات العميل دون إذنه.',
    'افتح الكاميرا الأمامية وصوّر وجهًا ونصًا في إضاءة جيدة، ثم افحص وضوح الصورة والتركيز وعدم وجود ضباب أو بقع.',
    'سجّل فيديو بالكاميرا الأمامية مع التحدث وتحريك الجهاز، ثم شغّل التسجيل وافحص الصورة والصوت.',
    'افتح الكاميرا الرئيسية وصوّر جسمًا قريبًا ونصًا ومشهدًا بعيدًا. افحص التركيز والوضوح وتجانس الصورة.',
    'اختر العدسة فائقة الاتساع 0.5x إن كانت موجودة، وصوّر مشهدًا واسعًا وافحص الصورة والحواف وعدم وجود بقع.',
    'اختر عدسة التقريب Telephoto أو مستوى التقريب البصري المدعوم، وصوّر جسمًا بعيدًا وافحص التركيز والوضوح.',
    'فعّل الفلاش من تطبيق الكاميرا والتقط صورة، ثم اختبر تشغيل المصباح من مركز التحكم.',
    'صوّر شخصًا بوضع Portrait وجرّب تغيير مستوى العزل إن توفر. افحص فصل الشخص عن الخلفية وعدم قص أجزاء منه بشكل واضح.',
    'سجّل فيديو مع تحريك الهاتف ببطء ثم بالمشي، وجرّب التركيز على جسم قريب ثم بعيد. افحص ثبات الصورة وانتقال التركيز.',
    'أجرِ مكالمة اختبارية بموافقة العميل، وضع الهاتف على أذنك وافحص وضوح الصوت من سماعة المكالمات العلوية.',
    'شغّل مقطعًا صوتيًا وارفع مستوى الصوت تدريجيًا. افحص السماعتين إن كان الموديل يدعم صوتًا مجسمًا، وانتبه للتشويش.',
    'أجرِ مكالمة اختبارية وتحدث عبر ميكروفون الهاتف، واسأل الطرف الآخر عن وضوح صوتك وخلوه من التقطيع.',
    'سجّل فيديو بالكاميرا الأمامية ثم الخلفية مع التحدث، وشغّل التسجيل وافحص وضوح الصوت وعدم وجود طقطقة أو انقطاع.',
    'افتح تطبيق المذكرات الصوتية Voice Memos وسجّل عدة ثوانٍ، ثم استمع للتسجيل وافحص مستوى الصوت ونقاءه.',
    'اضغط زر رفع الصوت وخفضه عدة مرات أثناء ظهور مؤشر الصوت، وتأكد من استجابة كل زر وعدم تعليقه.',
    'اضغط زر التشغيل لقفل الشاشة ثم إيقاظها، واضغط مطولًا لاختبار الوظيفة المرتبطة به حسب إعدادات الجهاز دون تنفيذ إيقاف غير مقصود.',
    'جرّب مفتاح الصامت أو Action Button حسب الموديل والإعدادات. تأكد من تغير الحالة أو تنفيذ الوظيفة المعيّنة.',
    'فعّل الاهتزاز من إعدادات الأصوات أو استخدم اختبارًا آمنًا للتنبيه، وتأكد من وجود اهتزاز منتظم دون صوت ميكانيكي غير طبيعي.',
    'استخدم كابلًا وشاحنًا موثوقين ومتوافقين. افحص ثبات التوصيل وظهور علامة الشحن، وعاين المنفذ بصريًا دون إدخال أدوات معدنية.',
    'إذا كان الجهاز يدعم الشحن اللاسلكي أو MagSafe، ضعه على شاحن متوافق وتأكد من بدء الشحن وثبات الاتصال والمحاذاة.',
    'راجع الإعدادات > البطارية > صحة البطارية والشحن إن كانت متاحة. سجّل السعة القصوى ورسالة الخدمة، ولا تستنتج عدد الدورات إن لم يعرضه النظام.',
    'اترك الجهاز على الشاحن عدة دقائق وراقب استمرار الشحن وثبات النسبة ودرجة الحرارة. أوقف الاختبار إذا ظهرت سخونة شديدة أو انتفاخ.',
    'بموافقة العميل، أجرِ مكالمة واردة وصادرة قصيرة. تحقق من التسجيل على الشبكة ووضوح الصوت وعدم انقطاع الاتصال.',
    'أوقف Wi-Fi واتصل ببيانات الهاتف. افتح صفحة موثوقة أو نفّذ اختبار اتصال بسيط، وتحقق من ظهور 4G/5G حسب التغطية والباقه.',
    'اتصل بشبكة Wi-Fi مصرح بها، افتح صفحة أو تطبيقًا، وابتعد قليلًا عن نقطة الوصول للتأكد من ثبات الاتصال.',
    'فعّل Bluetooth وابحث عن ملحق متاح ومصرح به مثل سماعة اختبار. أتمم الاقتران وتأكد من استمرار الاتصال والصوت.',
    'افتح تطبيق الخرائط في مكان مفتوح وبموافقة العميل، وانتظر تحديد الموقع. قارن موضع المؤشر بالمكان الفعلي ولا تعتمد على اختبار داخل المبنى وحده.',
    'أثناء مكالمة اختبارية، قرّب الهاتف من الأذن ولاحظ انطفاء الشاشة، ثم أبعده وتأكد من عودتها للعمل.',
    'فعّل السطوع التلقائي وغطِّ مستشعر الإضاءة أعلى الشاشة ثم اكشفه تدريجيًا. لاحظ تغير السطوع بعد لحظات.',
    'افتح تطبيقًا يدعم تدوير الشاشة أو أداة اختبار حساسات موثوقة، ودوّر الجهاز وحرّكه في الاتجاهات المختلفة وتحقق من استجابة الاتجاه والحركة.',
    'افتح تطبيق البوصلة وحرّك الهاتف على شكل رقم 8 عند الحاجة للمعايرة. تحقق من تغير الاتجاه بصورة منطقية بعيدًا عن المعادن والمغناطيس.',
    'إذا كان NFC مدعومًا، اختبره بوسيلة اختبار آمنة ومصرح بها أو بطاقة اختبار متوافقة. لا تنفذ أي عملية دفع فعلية ولا تطلب بيانات العميل.',
    'افحص درج SIM بصريًا ثم أدخل شريحة اختبار بموافقة العميل وتحقق من تعرف الجهاز عليها. اختبر eSIM من الإعدادات فقط إذا كان متاحًا وبموافقة العميل دون حذف خط العميل.',
    'افحص الإطار والزجاج والظهر والأزرار والدرج تحت إضاءة جيدة. سجّل الخدوش والانبعاجات والكسور وآثار السقوط بالصور عند الحاجة.',
    'افحص مؤشر ملامسة السوائل الظاهر دون تفكيك، ومنافذ الجهاز ودرج الشريحة بحثًا عن ترسبات أو تآكل. لا تعتبر تغير اللون وحده دليلًا قاطعًا دون توثيق.'
  ];
  if (deviceType === "iphone" && iphoneInstructions[index]) return iphoneInstructions[index];

  var catalog = getInspectionCatalog_();
  var device = catalog[deviceType];
  var item = device && device.items ? String(device.items[index] || "") : "";
  if (/شاشة|لمس/.test(item)) return "افتح خلفيات فاتحة وداكنة وملونة، وافحص الصورة والبقع والخطوط. جرّب الضغط والسحب في جميع أجزاء الشاشة والحواف.";
  if (/كاميرا/.test(item)) return "افتح تطبيق الكاميرا، بدّل إلى الكاميرا المطلوبة، وصوّر صورة وفيديو في إضاءة جيدة. افحص الوضوح والتركيز والصوت إن كان الاختبار يتضمنه.";
  if (/سماعة|صوت/.test(item)) return "شغّل مقطعًا صوتيًا أو نفّذ مكالمة اختبارية بموافقة العميل. افحص وضوح الصوت ومستواه وعدم وجود تشويش أو تقطيع.";
  if (/ميكروفون/.test(item)) return "سجّل مقطعًا صوتيًا أو فيديو وتحدث بصوت طبيعي، ثم استمع للتسجيل وافحص وضوح الصوت وعدم انقطاعه.";
  if (/شحن|بطارية/.test(item)) return "استخدم شاحنًا وكابلًا متوافقين، وتأكد من بدء الشحن وثباته. راجع حالة البطارية من الإعدادات إذا كانت متاحة، ولاحظ السخونة غير الطبيعية.";
  if (/Wi-Fi|Bluetooth|اتصال|الشبكة/.test(item)) return "فعّل الوظيفة واتصل بشبكة أو ملحق اختبار مصرح به. جرّب نقل بيانات أو فتح صفحة وتأكد من ثبات الاتصال.";
  if (/زر|Digital Crown|Trackpad|لوحة المفاتيح/.test(item)) return "جرّب الزر أو الجزء عدة مرات أثناء استخدام الوظيفة المرتبطة به، وتأكد من الاستجابة وعدم التعليق أو التكرار.";
  if (/هيكل|زجاج|سوائل|صدمات/.test(item)) return "افحص الجهاز من جميع الجهات تحت إضاءة جيدة، وسجّل الخدوش والكسور والانبعاجات وآثار السوائل أو التآكل الظاهرة.";
  if (/حساس|مستشعر|بصمة|Face ID/.test(item)) return "افتح الوظيفة أو إعدادها المخصص، وجرّبها أكثر من مرة بالطريقة الطبيعية. لا تحذف بيانات العميل أو تعِد ضبطها دون إذنه.";
  return "نفّذ اختبارًا عمليًا للوظيفة المذكورة على الجهاز، وكرره أكثر من مرة. سجّل سليم فقط إذا عملت الوظيفة بصورة طبيعية، وإلا اختر مشكلة أو لم يُختبر.";
}

function deviceInspectionCatalogMini_(){
  const out={};Object.keys(MH_DEVICE_INSPECTION_CATALOG_).forEach(type=>{const d=MH_DEVICE_INSPECTION_CATALOG_[type];out[type]={name:d.name,items:d.items.map((item,index)=>({name:item,instruction:getInspectionInstruction_(type,index)}))};});return out;
}


/* V1.10.6 persistent device inspection sessions.
 * Every save is an immutable snapshot; the latest session is loaded for continuation.
 */
const MH_DEVICE_INSPECTION_HEADERS_V106_ = [
  'التاريخ والوقت','معرف جلسة الفحص','رقم الطلب','نوع الجهاز','ترتيب الاختبار',
  'اسم الاختبار','النتيجة','ملاحظات الاختبار','منفذ الفحص Chat ID','منفذ الفحص'
];

function mhDeviceInspectionAccessV106_(profile, orderId) {
  const rows = rowsAsObjects_(spreadsheet_(), MH.SHEETS.devices);
  const row = rows.find(r => String(r['رقم الطلب'] || '').trim() === String(orderId || '').trim());
  if (!row) throw new Error('DEVICE_NOT_FOUND');
  const admin = ['super_admin','admin'].includes(profile.role);
  const intake = deviceIntakeAllowed_(profile) &&
    String(row['مسؤول الاستلام Chat ID'] || '').trim() === String(profile.chatId);
  const assigned = String(row['الموظف المسؤول Chat ID'] || '').trim() === String(profile.chatId);
  if (!admin && !intake && !assigned) throw new Error('FORBIDDEN');
  return row;
}

function deviceInspectionGetMiniV106_(profile, body) {
  const orderId = String(body.orderId || '').trim();
  const type = String(body.deviceType || '').trim().toLowerCase();
  if (!orderId || !MH_DEVICE_INSPECTION_CATALOG_[type]) throw new Error('INVALID_INSPECTION_TYPE');
  mhDeviceInspectionAccessV106_(profile, orderId);
  const sh = spreadsheet_().getSheetByName('سجل فحص الأجهزة');
  if (!sh || sh.getLastRow() < 2) return {orderId,deviceType:type,sessionId:'',items:[]};
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const ix = {}; headers.forEach((h,i)=>ix[h]=i);
  const matches = values.slice(1).filter(r =>
    String(r[ix['رقم الطلب']] || '').trim() === orderId &&
    String(r[ix['نوع الجهاز']] || '').trim() === type
  );
  if (!matches.length) return {orderId,deviceType:type,sessionId:'',items:[]};
  const latest = matches[matches.length-1];
  const sessionId = String(latest[ix['معرف جلسة الفحص']] || '');
  const sessionRows = matches.filter(r=>String(r[ix['معرف جلسة الفحص']]||'')===sessionId);
  return {
    orderId,deviceType:type,sessionId,
    updatedAt:String(latest[ix['التاريخ والوقت']]||''),
    items:sessionRows.map(r=>({
      index:Number(r[ix['ترتيب الاختبار']]),
      name:String(r[ix['اسم الاختبار']]||''),
      result:String(r[ix['النتيجة']]||''),
      note:String(r[ix['ملاحظات الاختبار']]||'')
    }))
  };
}

function deviceInspectionSaveMiniV106_(profile, body) {
  const orderId = String(body.orderId || '').trim();
  const type = String(body.deviceType || '').trim().toLowerCase();
  const catalog = MH_DEVICE_INSPECTION_CATALOG_[type];
  if (!orderId || !catalog) throw new Error('INVALID_INSPECTION_TYPE');
  mhDeviceInspectionAccessV106_(profile, orderId);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length || items.length > catalog.items.length) throw new Error('INVALID_INSPECTION_ITEMS');
  const seen = {};
  const normalized = items.map(item => {
    const index = Number(item.index);
    const result = String(item.result || '').trim();
    if (!Number.isInteger(index) || index < 0 || index >= catalog.items.length || seen[index]) throw new Error('INVALID_INSPECTION_ITEMS');
    if (result && ['سليم','مشكلة','لم يختبر'].indexOf(result)<0) throw new Error('INVALID_INSPECTION_RESULT');
    seen[index] = true;
    return {
      index,
      name:catalog.items[index],
      result,
      note:String(item.note || '').trim().slice(0,500)
    };
  });
  const ss = spreadsheet_();
  let sh = ss.getSheetByName('سجل فحص الأجهزة');
  if (!sh) {
    sh = ss.insertSheet('سجل فحص الأجهزة');
    sh.getRange(1,1,1,MH_DEVICE_INSPECTION_HEADERS_V106_.length).setValues([MH_DEVICE_INSPECTION_HEADERS_V106_]);
    sh.setFrozenRows(1);
  }
  mhAssertHeaders_(sh, MH_DEVICE_INSPECTION_HEADERS_V106_);
  const sessionId = Utilities.getUuid();
  const now = mhStamp_();
  const rows = normalized.map(item => [
    now,sessionId,orderId,type,item.index,item.name,item.result,item.note,
    String(profile.chatId),String(profile.name || '')
  ]);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const start = sh.getLastRow()+1;
    sh.getRange(start,1,rows.length,MH_DEVICE_INSPECTION_HEADERS_V106_.length).setValues(rows);
  } finally { lock.releaseLock(); }
  return {
    saved:true,orderId,deviceType:type,sessionId,updatedAt:now,
    completed:normalized.filter(x=>x.result).length,
    issues:normalized.filter(x=>x.result==='مشكلة').length,
    untested:normalized.filter(x=>x.result==='لم يختبر').length,
    pending:normalized.filter(x=>!x.result).length
  };
}


/* REPAIR PRICE BOOK — Mini App parity port from V46.
 * Read-only access to the separate linked price workbook. It never writes prices.
 */
const MH_REPAIR_PRICE_SOURCE_ID_ = '1VgJBb-159r5J7oQB2Xt1Q_IMQOHiUBBAcYL5ekMQhEM';
const MH_REPAIR_PRICE_PROPERTY_ = 'MOBIHUB_REPAIR_PRICE_SPREADSHEET_ID';
const MH_REPAIR_PRICE_CATEGORIES_ = [
  {key:'iphone', label:'iPhone – قطع الغيار', sheet:'Price list', title:'iPhone – قطع الغيار', startRow:2, endRow:70, headerRow:1},
  {key:'board', label:'iPhone – أعطال البوردة', sheet:'Mother board', title:'iPhone – أعطال البوردة', startRow:2, endRow:40, headerRow:1},
  {key:'watch', label:'Apple Watch', sheet:'Apple Watch ', title:'Apple Watch', startRow:2, endRow:220, headerRow:1},
  {key:'airpods', label:'AirPods – أسعار الأفراد', sheet:'AirPods', title:'AirPods – أسعار الأفراد', startRow:2, endRow:10, headerRow:1},
  {key:'airpods_commercial', label:'AirPods – الأسعار التجارية', sheet:'AirPods', title:'AirPods – الأسعار التجارية', startRow:13, endRow:220, headerRow:12}
];
function repairPriceConfigMini_(category) {
  const cfg = MH_REPAIR_PRICE_CATEGORIES_.find(x => x.key === String(category || '').trim());
  if (!cfg) throw new Error('INVALID_REPAIR_PRICE_CATEGORY');
  return cfg;
}
function repairPriceBookMini_() {
  const id = PropertiesService.getScriptProperties().getProperty(MH_REPAIR_PRICE_PROPERTY_) || MH_REPAIR_PRICE_SOURCE_ID_;
  if (!id) throw new Error('REPAIR_PRICE_SOURCE_NOT_CONFIGURED');
  try { return SpreadsheetApp.openById(id); }
  catch (e) { console.error('Repair price workbook unavailable: ' + String(e && e.message || e)); throw new Error('REPAIR_PRICE_SOURCE_UNAVAILABLE'); }
}
function repairPriceSheetMini_(book, cfg) {
  const expected = String(cfg.sheet || '').trim().toLowerCase();
  const sh = book.getSheets().find(x => String(x.getName() || '').trim().toLowerCase() === expected);
  if (!sh) throw new Error('REPAIR_PRICE_SHEET_MISSING');
  return sh;
}
function repairPriceNormalizeMini_(value) {
  return String(value || '').toLowerCase().replace(/[\u200e\u200f\uFEFF]/g,'').replace(/[–—_.,،؛:()[\]{}]/g,' ').replace(/\s+/g,' ').trim();
}
function repairPriceModelsMiniForCategory_(book, cfg) {
  const sh = repairPriceSheetMini_(book, cfg);
  const last = Math.min(sh.getLastRow(), cfg.endRow);
  if (last < cfg.startRow) return [];
  const width = sh.getLastColumn();
  if (width < 2) return [];
  const headers = sh.getRange(cfg.headerRow,1,1,width).getDisplayValues()[0];
  const values = sh.getRange(cfg.startRow,1,last-cfg.startRow+1,width).getDisplayValues();
  const models=[];
  values.forEach((row,index)=>{
    const name=String(row[0]||'').replace(/[\u200e\u200f\uFEFF]/g,'').replace(/\uF8FF/g,'Apple').trim();
    if(!name || name.indexOf('device\\')===0 || name.indexOf('AirPod\\')===0 || name.indexOf('Watch\\')===0) return;
    const hasPrice=row.some((v,col)=>col>0 && String(headers[col]||'').trim()!=='' && String(v||'').trim()!=='');
    if(hasPrice) models.push({row:cfg.startRow+index,name:name});
  });
  return models;
}
function repairPriceCategoriesMini_() {
  return {categories:MH_REPAIR_PRICE_CATEGORIES_.map(c=>({key:c.key,label:c.label})),searchAvailable:true};
}
function repairPriceModelsMini_(body) {
  const cfg=repairPriceConfigMini_(body.category), book=repairPriceBookMini_();
  const models=repairPriceModelsMiniForCategory_(book,cfg);
  const pageSize=12, totalPages=Math.max(1,Math.ceil(models.length/pageSize));
  const page=Math.max(0,Math.min(Number(body.page)||0,totalPages-1));
  return {category:cfg.key,label:cfg.label,models:models.slice(page*pageSize,(page+1)*pageSize),page,total:models.length,totalPages,pageSize};
}
function repairPriceSearchMini_(body) {
  const query=String(body.query||'').trim();
  if(query.length<2 || query.length>100) throw new Error('INVALID_REPAIR_PRICE_QUERY');
  const needle=repairPriceNormalizeMini_(query);
  const book=repairPriceBookMini_(), results=[];
  MH_REPAIR_PRICE_CATEGORIES_.forEach(cfg=>repairPriceModelsMiniForCategory_(book,cfg).forEach(model=>{
    const hay=repairPriceNormalizeMini_(model.name);
    if(hay.indexOf(needle)!==-1 || needle.split(' ').every(part=>hay.indexOf(part)!==-1)) results.push({category:cfg.key,categoryLabel:cfg.label,row:model.row,name:model.name});
  }));
  const pageSize=10,totalPages=Math.max(1,Math.ceil(results.length/pageSize));
  const page=Math.max(0,Math.min(Number(body.page)||0,totalPages-1));
  return {query:query,results:results.slice(page*pageSize,(page+1)*pageSize),page,total:results.length,totalPages,pageSize};
}
function repairPriceIssuesMini_(body) {
  const cfg=repairPriceConfigMini_(body.category), rowNum=Number(body.row);
  if(!Number.isInteger(rowNum) || rowNum<cfg.startRow || rowNum>cfg.endRow) throw new Error('REPAIR_PRICE_MODEL_NOT_FOUND');
  const book=repairPriceBookMini_(), sh=repairPriceSheetMini_(book,cfg);
  const allowed=repairPriceModelsMiniForCategory_(book,cfg).some(x=>x.row===rowNum);
  if(!allowed) throw new Error('REPAIR_PRICE_MODEL_NOT_FOUND');
  const width=sh.getLastColumn();
  const headers=sh.getRange(cfg.headerRow,1,1,width).getDisplayValues()[0];
  const values=sh.getRange(rowNum,1,1,width).getDisplayValues()[0];
  const issues=[];
  for(let col=1;col<width;col++) {
    const issue=String(headers[col]||'').replace(/[\u200e\u200f\uFEFF]/g,'').trim();
    const price=String(values[col]||'').replace(/[\u200e\u200f\uFEFF]/g,'').trim();
    if(issue && price) issues.push({issue:issue,price:price});
  }
  return {category:cfg.key,label:cfg.label,row:rowNum,model:String(values[0]||'').replace(/\uF8FF/g,'Apple').trim(),issues:issues};
}
function configureRepairPriceSourceOnceMini_() {
  const book=SpreadsheetApp.openById(MH_REPAIR_PRICE_SOURCE_ID_);
  const required=['Price list','Mother board','Apple Watch','AirPods'];
  const names=book.getSheets().map(x=>String(x.getName()).trim().toLowerCase());
  const missing=required.filter(x=>names.indexOf(x.trim().toLowerCase())<0);
  if(missing.length) throw new Error('REPAIR_PRICE_SHEETS_MISSING:' + missing.join(','));
  PropertiesService.getScriptProperties().setProperty(MH_REPAIR_PRICE_PROPERTY_,MH_REPAIR_PRICE_SOURCE_ID_);
  return {configured:true,workbook:book.getName()};
}
