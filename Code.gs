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
  VERSION: '1.12.0',
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
  const startedAt = Date.now();
  let actionForTiming = 'unknown';

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

    const action = String(body.action || 'bootstrap');
    actionForTiming = action;

    // Profit from the read cache while resolving the profile too: the two
    // sheets it reads are reused by the handler below. Mutating actions stay
    // uncached so a write is never masked by a stale copy.
    mhEnableReadCache_(action);

    const profile = resolveProfile_(String(telegramUser.id), String(body.workspaceRole || ''));

    if (!profile || profile.status !== 'نشط') {
      return json_({
        ok: false,
        error: 'ACCOUNT_INACTIVE',
        requestId: requestId
      });
    }

    // action is resolved above, before profile lookup.
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
      case 'repair_price_catalog':
        data = repairPriceCatalogMini_(body);
        break;
      case 'repair_price_parts':
        data = repairPricePartsMini_(body);
        break;
      case 'repair_price_search':
        data = repairPriceSearchMini_(body);
        break;
      case 'repair_price_search_all':
        data = repairPriceSearchAllMini_(body);
        break;
      case 'repair_price_issues':
        data = repairPriceIssuesMini_(body);
        break;

      case 'tasks_list':
        data = tasksListMini_(profile, body);
        break;
      case 'task_update':
        data = tasksUpdateMini_(profile, body);
        break;
      case 'task_create':
        data = tasksCreateMini_(profile, body);
        break;
      case 'task_review':
        data = tasksReviewMini_(profile, body);
        break;
      case 'task_edit':
        data = tasksEditMini_(profile, body);
        break;
      case 'task_assignees':
        data = tasksAssigneesMini_(profile);
        break;
      case 'inventory_overview':
        data = inventoryOverviewMini_(profile);
        break;
      case 'inventory_search':
        data = inventorySearchMini_(profile, body);
        break;
      case 'inventory_save':
        data = inventorySaveMini_(profile, body);
        break;
      case 'console_overview':
        data = consoleOverviewMini_(profile);
        break;
      case 'console_report':
        data = consoleReportMini_(profile, body);
        break;
      case 'customers_search':
        data = customersSearchMini_(profile, body);
        break;
      case 'device_families':
        data = deviceFamiliesMini_(profile);
        break;
      case 'device_family_models':
        data = deviceFamilyModelsMini_(profile, body);
        break;
      case 'device_model_detail':
        data = deviceModelDetailMini_(profile, body);
        break;
      case 'device_intake_options':
        data = deviceIntakeOptionsMini_(profile);
        break;
      case 'device_intake_create':
        data = deviceIntakeCreateMini_(profile, body);
        break;
      case 'buttons_matrix_get':
        data = buttonsMatrixGetMini_(profile);
        break;
      case 'buttons_matrix_set':
        data = buttonsMatrixSetMini_(profile, body);
        break;
      case 'buttons_matrix_bulk':
        data = buttonsMatrixBulkMini_(profile, body);
        break;
      case 'notify_matrix_get':
        data = notifyMatrixGetMini_(profile);
        break;
      case 'notify_matrix_set':
        data = notifyMatrixSetMini_(profile, body);
        break;
      case 'notify_matrix_bulk':
        data = notifyMatrixBulkMini_(profile, body);
        break;
      case 'tasks_repair':
        data = tasksRepairMini_(profile);
        break;
      case 'task_delete':
        data = tasksDeleteMini_(profile, body);
        break;
      case 'part_request_create':
        data = partRequestCreateMini_(profile, body);
        break;
      case 'part_requests_mine':
        data = partRequestsMineMini_(profile);
        break;
      case 'part_requests_all':
        data = partRequestsAllMini_(profile, body);
        break;
      case 'part_request_decide':
        data = partRequestDecideMini_(profile, body);
        break;
      case 'task_seed_marketing':
        data = tasksSeedMarketingMini_(profile);
        break;
      case 'notifications_enable_all':
        data = notificationsEnableAllMini_(profile);
        break;
      case 'notifications_test':
        data = notificationsTestMini_(profile);
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

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= 700) console.warn('MOBI_API_SLOW action=' + action + ' elapsedMs=' + elapsedMs + ' requestId=' + requestId);
    return json_({
      ok: true,
      data: data,
      requestId: requestId,
      elapsedMs: elapsedMs
    });

  } catch (err) {
    logApiError_('MINI_APP_API_ERROR', err, requestId);
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= 700) console.warn('MOBI_API_SLOW action=' + actionForTiming + ' elapsedMs=' + elapsedMs + ' requestId=' + requestId);

    const safeMessage = err && err.message ? String(err.message) : '';
    const safeCode = /^[A-Z][A-Z0-9_:-]{2,120}$/.test(safeMessage) ? safeMessage : 'INTERNAL_ERROR';
    return json_({
      ok: false,
      error: safeCode,
      requestId: requestId,
      elapsedMs: elapsedMs
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
      job: String(manager['الصلاحية'] || ''),
      role: normalizeRole_(String(manager['الصلاحية'] || 'Admin')),
      status: 'نشط',
      workspace: 'manager',
      availableWorkspaces: availableWorkspaces
    };
  }

  return {
    chatId: chatId,
    name: String(employee['اسم الموظف'] || ''),
    job: String(employee['الوظيفة'] || ''),
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
  if (value === 'Procurement' || /مشتريات|مورد|procurement/i.test(value)) {
    return 'procurement';
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
    // Tiles this technician is allowed to see, controlled from the dashboard.
    visibleButtons: mhVisibleButtons_(profile),
    managerDashboard: isManagement ? managerDashboard_(profile) : null,
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
    },
    tasks: (function() {
      try {
        var taskSheet = spreadsheet_().getSheetByName(MH_TASK_SHEET_);
        if (!taskSheet) return { open: 0, overdue: 0, review: 0 };
        var rows = rowsAsObjects_(spreadsheet_(), MH_TASK_SHEET_).filter(function(r) {
          return String(r['Chat ID'] || '').trim() === profile.chatId;
        });
        var today = mhToday_();
        return {
          open: rows.filter(function(r) {
            return ['جديدة', 'قيد التنفيذ', 'بانتظار المراجعة'].indexOf(String(r['الحالة'] || '').trim()) >= 0;
          }).length,
          overdue: rows.filter(function(r) {
            var due = mhDate_(r['تاريخ الاستحقاق']);
            return !!due && due < today && ['مكتملة', 'ملغاة'].indexOf(String(r['الحالة'] || '').trim()) < 0;
          }).length,
          review: rows.filter(function(r) {
            return String(r['الحالة'] || '').trim() === 'بانتظار المراجعة';
          }).length
        };
      } catch (e) {
        return { open: 0, overdue: 0, review: 0 };
      }
    })()
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

  // Employees only: honour "داخل التطبيق" toggles. A manager's own view is
  // never filtered, so administration stays complete.
  let filtered = visibleRows;
  if (!canViewAll) {
    const hiddenFor = function(eventKey) {
      const rule = mhNotifyAllowed_(profile.chatId, eventKey);
      return rule === false || rule.inApp === false;
    };
    if (entity === 'deductions' && hiddenFor('deduction.decided')) filtered = [];
    if (entity === 'cash' && hiddenFor('cash.decided') && hiddenFor('cash.settlement')) filtered = [];
    if (entity === 'leaves' && hiddenFor('leave.decided')) filtered = [];
  }

  return filtered.slice(-100).reverse();
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
    finance: ['super_admin','admin','finance'].includes(role),
    overtime: ['super_admin','admin','finance'].includes(role),
    tasks: ['super_admin','admin','supervisor'].includes(role),
    parts: ['super_admin','admin','finance','supervisor','procurement'].includes(role),
    procurement: ['super_admin','admin','procurement'].includes(role),
    notificationMatrix: ['super_admin','admin'].includes(role),
    buttonsMatrix: ['super_admin','admin'].includes(role),
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

    // The technician must get a Telegram confirmation, and management must know
    // the arrival immediately — the app alone was silent.
    const statusText = lateMinutes > 0 ? 'متأخر ' + lateMinutes + ' دقيقة' : 'في الموعد';
    mhNotifyEmployee_(profile.chatId,
      '✅ تم تسجيل حضورك بنجاح\n━━━━━━━━━━━━━━━━━━\n' +
      '🕒 الوقت: ' + pending.time + '\n' +
      '📅 التاريخ: ' + pending.date + '\n' +
      '👕 اليونيفورم: ' + uniformStatus + '\n' +
      '📍 المسافة من المركز: ' + Math.round(pending.distance) + ' متر\n' +
      '⏱ الحالة: ' + statusText + '\n' +
      '━━━━━━━━━━━━━━━━━━\nنتمنى لك يوم عمل موفق.',
      'تسجيل حضور', 'attendance.reminder');

    mhNotifyManagement_(
      '🟢 تسجيل حضور جديد\n━━━━━━━━━━━━━━━━━━\n' +
      '👤 ' + String(profile.name || '') + '\n' +
      '🕒 ' + pending.time + '\n' +
      '⏱ ' + statusText + '\n' +
      '👕 اليونيفورم: ' + uniformStatus + '\n' +
      '📍 ' + Math.round(pending.distance) + ' متر من المركز',
      'حضور جديد');

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

    const overtimeLine = (overtime && overtime.minutes > 0)
      ? '\n⏱ أوفر تايم: ' + overtime.minutes + ' دقيقة (' + overtime.amount + ' جنيه)'
      : '';

    mhNotifyEmployee_(profile.chatId,
      '🚪 تم تسجيل انصرافك بنجاح\n━━━━━━━━━━━━━━━━━━\n' +
      '🕒 الوقت: ' + time + '\n' +
      '📅 التاريخ: ' + date + '\n' +
      '📍 ' + Math.round(gps.distance) + ' متر من المركز' +
      overtimeLine +
      '\n━━━━━━━━━━━━━━━━━━\nشكرًا لمجهودك اليوم.',
      'تسجيل انصراف', 'attendance.reminder');

    mhNotifyManagement_(
      '🔴 تسجيل انصراف\n━━━━━━━━━━━━━━━━━━\n' +
      '👤 ' + String(profile.name || '') + '\n' +
      '🕒 ' + time + overtimeLine,
      'انصراف جديد');

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
  const values = mhReadSheetValues_(sheet);
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
// Single definition for mhNow_. The old build declared it twice (with and
// without a format argument); the later declaration won, so every
// mhNow_('HH:mm:ss') call silently returned a full datetime string.
function mhNow_(format) {
  return Utilities.formatDate(new Date(), MH.TZ, format || 'yyyy-MM-dd HH:mm:ss');
}
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

/**
 * Per-execution sheet read cache.
 *
 * The Mini App frequently reads the same sheet several times inside a single
 * request (bootstrap -> managerDashboard -> list/reward summary). Every
 * getDataRange().getValues() is a slow remote call, so re-reading the same
 * sheet dominated response time. Apps Script starts a fresh execution for
 * each doPost call, so this cache can never outlive a request and cannot
 * return stale data to a later request.
 *
 * Writes must call mhInvalidateSheetCache_() for that sheet.
 */
const MH_SHEET_CACHE_ = {};

// Caching is enabled only for actions that never write, so a cached sheet
// can never mask a write performed earlier in the same execution.
const MH_READ_ONLY_ACTIONS_ = [
  'bootstrap', 'manager_dashboard', 'list', 'attendance_status',
  'attendance_history', 'monthly_summary', 'active_employees',
  'device_registration_options', 'device_list', 'device_detail',
  'device_staff', 'device_inspection_catalog', 'device_inspection_get',
  'my_shifts', 'complaint_thread', 'reward_summary',
  'tasks_list', 'console_overview', 'console_report',
  'repair_price_categories', 'repair_price_models', 'repair_price_catalog', 'repair_price_parts',
  'repair_price_search', 'repair_price_search_all', 'repair_price_issues'
];
let MH_READ_CACHE_ENABLED_ = false;

function mhEnableReadCache_(action) {
  MH_READ_CACHE_ENABLED_ = MH_READ_ONLY_ACTIONS_.indexOf(String(action)) >= 0;
}

function mhReadSheetValues_(sheet) {
  if (!MH_READ_CACHE_ENABLED_) return sheet.getDataRange().getValues();
  const key = sheet.getName();
  if (!Object.prototype.hasOwnProperty.call(MH_SHEET_CACHE_, key)) {
    MH_SHEET_CACHE_[key] = sheet.getDataRange().getValues();
  }
  return MH_SHEET_CACHE_[key];
}

function rowsAsObjects_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Missing sheet: ' + sheetName);
  }

  const values = mhReadSheetValues_(sheet);
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

  let notifyChatId = '', notifyAmount = '';
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

    notifyChatId = String(sh.getRange(rowNum,map['Chat ID']).getDisplayValue()).trim();
    notifyAmount = String(sh.getRange(rowNum,map['المبلغ المطلوب بالجنيه']).getDisplayValue()).trim();
  } finally { lock.releaseLock(); }

  // Outside the lock: a Telegram failure must never undo a committed decision.
  mhNotifyCashDecision_(notifyChatId, decision, notifyAmount, note);
  return {decided:true,status:decision};
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

    // Finance must be told a settlement is waiting; the row alone was invisible.
    mhNotifyManagement_(
      '📋 تسوية عهدة جديدة بانتظار المراجعة\n━━━━━━━━━━━━━━━━━━\n' +
      '👤 ' + String(profile.name || '') + '\n' +
      '💰 المعتمد: ' + approved + ' جنيه\n' +
      '🧾 المصروف الفعلي: ' + spent + ' جنيه\n' +
      '↩️ المطلوب إرجاعه: ' + returned + ' جنيه\n' +
      (extra > 0 ? '💸 مستحق للموظف: ' + extra + ' جنيه\n' : '') +
      '━━━━━━━━━━━━━━━━━━\nافتح لوحة الإدارة ← السلف والعهد.',
      'تسوية عهدة');

    return {submitted:true, approvedAmount:approved, actualSpent:spent, amountToReturn:returned, extraDue:extra, status:'بانتظار مراجعة التسوية'};
  } finally { lock.releaseLock(); }
}

function decideCashSettlement_(profile, body) {
  mhRequireRole_(profile, MH_CASH.REVIEW_ROLES);
  const rowNum = Number(body.row), decision = String(body.decision || '').trim(), note = String(body.note || '').trim();
  if (!Number.isInteger(rowNum) || rowNum < 2 || !['مقبول','مرفوض'].includes(decision)) throw new Error('INVALID_DECISION');
  const sh = mhSheet_(MH.SHEETS.cash), map = mhAssertHeaders_(sh, MH_CASH.HEADERS);
  if (rowNum > sh.getLastRow()) throw new Error('CASH_REQUEST_NOT_FOUND');
  let notifyChatId = '', notifyReturned = 0, notifyExtra = 0;
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const get = h => sh.getRange(rowNum,map[h]).getDisplayValue().trim();
    if (get('حالة التسوية') !== 'بانتظار مراجعة التسوية') throw new Error('CASH_ALREADY_REVIEWED');
    notifyChatId = get('Chat ID');
    if (decision === 'مرفوض') {
      sh.getRange(rowNum,map['حالة التسوية']).setValue('مرفوضة - تحتاج مراجعة');
      sh.getRange(rowNum,map['حالة العهدة']).setValue('عهدة مفتوحة');
    } else {
      const returned = Number(sh.getRange(rowNum,map['المبلغ المطلوب إرجاعه بالجنيه']).getValue()) || 0;
      const extra = Number(sh.getRange(rowNum,map['المبلغ الإضافي المستحق للموظف بالجنيه']).getValue()) || 0;
      notifyReturned = returned; notifyExtra = extra;
      sh.getRange(rowNum,map['حالة التسوية']).setValue('تم اعتماد التسوية');
      if (returned > 0) sh.getRange(rowNum,map['حالة العهدة']).setValue('بانتظار تأكيد استلام المتبقي');
      else if (extra > 0) sh.getRange(rowNum,map['حالة العهدة']).setValue('بانتظار صرف التعويض');
      else sh.getRange(rowNum,map['حالة العهدة']).setValue('مغلقة');
    }
    if (map['ملاحظات المدير']) sh.getRange(rowNum,map['ملاحظات المدير']).setValue(note);
    if (map['تاريخ آخر تحديث']) sh.getRange(rowNum,map['تاريخ آخر تحديث']).setValue(mhNow_());
    if (map['Chat ID آخر مدير قرار']) sh.getRange(rowNum,map['Chat ID آخر مدير قرار']).setValue(profile.chatId);
    if (map['اسم آخر مدير قرار']) sh.getRange(rowNum,map['اسم آخر مدير قرار']).setValue(mhManagerName_(profile));
  } finally { lock.releaseLock(); }
  mhNotifySettlementDecision_(notifyChatId, decision, notifyReturned, notifyExtra);
  return {decided:true,status:decision};
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
  mhNotifyManagement_(
    '📩 طلب إذن جديد بانتظار المراجعة\n━━━━━━━━━━━━━━━━━━\n' +
    '👤 ' + profile.name + '\n' +
    '🏷 ' + type + ' · ' + date + '\n' +
    (reason ? '📝 ' + reason.slice(0, 200) + '\n' : '') +
    '━━━━━━━━━━━━━━━━━━\nافتح لوحة الإدارة ← طلبات المهندسين.',
    'طلب إذن جديد'
  );
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
  // Notify the employee of the leave decision. Notification failures are
  // logged to «سجل الإشعارات» and must not roll back the decision.
  mhNotifyLeaveDecision_(
    String(get('Chat ID')).trim(),
    decision,
    get('نوع الإذن'),
    mhIsoDate_(get('تاريخ الإذن')) || get('تاريخ الإذن'),
    note
  );
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
  } finally {lock.releaseLock();}
  mhNotifyManagement_(
    '🗒 شكوى جديدة من ' + profile.name + '\n━━━━━━━━━━━━━━━━━━\n' +
    '🏷 ' + type + '\n' +
    (person ? '👤 بخصوص: ' + person + '\n' : '') +
    '📝 ' + details.slice(0, 250) + '\n' +
    '━━━━━━━━━━━━━━━━━━\nافتح لوحة الإدارة ← شكاوى المهندسين.',
    'شكوى جديدة'
  );
  return {submitted:true,complaintId:id,status:'جديدة',message:'تم تسجيل الشكوى.'};
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
  // A manager reply must reach the employee on Telegram, not only in the app.
  if (role === 'مدير') {
    mhNotifyComplaintReply_(String(c.data['Chat ID'] || '').trim(), id, 'بانتظار رد الموظف');
  }
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
    let notifyChatId='', notifyAmount='', notifyReason='';
    const lock=LockService.getScriptLock(); lock.waitLock(15000);
    try {
      if(sh.getRange(rowNum,map['الحالة']).getDisplayValue().trim()!=='بانتظار اعتماد المدير') throw new Error('DEDUCTION_ALREADY_REVIEWED');
      const now=mhNow_();
      sh.getRange(rowNum,map['الحالة']).setValue(decision);
      sh.getRange(rowNum,map['تاريخ الاعتماد']).setValue(decision==='معتمد'?now:'');
      sh.getRange(rowNum,map['منفذ الإجراء']).setValue(profile.chatId);
      sh.getRange(rowNum,map['ملاحظات']).setValue(note);
      if(decision==='مرفوض') sh.getRange(rowNum,map['سبب الرفض/الإلغاء']).setValue(note||'مرفوض من الإدارة');
      notifyChatId=String(sh.getRange(rowNum,map['Chat ID']).getDisplayValue()).trim();
      notifyAmount=String(sh.getRange(rowNum,map['المبلغ بالجنيه']).getDisplayValue()).trim();
      notifyReason=String(sh.getRange(rowNum,map['السبب']).getDisplayValue()).trim();
    } finally {lock.releaseLock();}
    mhNotifyDeductionDecision_(notifyChatId, decision, notifyAmount, notifyReason, note);
    return {decided:true,status:decision};
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
const MH_ADMIN_ROLES = ['Admin','Finance','Supervisor','Procurement'];

function mhEnsureSheet_(name, headers) {
  const ss = spreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }

  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    return sh;
  }

  // Append only the missing columns so an older sheet keeps working.
  const width = Math.max(sh.getLastColumn(), 1);
  const existing = sh.getRange(1,1,1,width).getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  const missing = headers.filter(function(h) { return existing.indexOf(h) < 0; });
  if (missing.length) sh.getRange(1, width + 1, 1, missing.length).setValues([missing]);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
  return sh;
}
function mhStamp_(){return Utilities.formatDate(new Date(),MH.TZ,'yyyy-MM-dd HH:mm:ss');}
function mhAppendNotificationLog_(recipient,type,status,errorText) {
  // Logging must never break the caller. A legacy or malformed log sheet used
  // to throw from inside catch blocks, turning a caught notification failure
  // into a full INTERNAL_ERROR response.
  try {
    const sh = mhEnsureSheet_('سجل الإشعارات', MH_NOTIFICATION_HEADERS);
    sh.appendRow([Utilities.getUuid(),mhStamp_(),String(recipient),String(type),'miniapp_'+Utilities.getUuid(),String(status),String(errorText||'')]);
    return true;
  } catch (e) {
    try { console.error('Notification log failed: ' + (e && e.message || e)); } catch (ignored) {}
    return false;
  }
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
    try { mhTelegramSend_(employeeId,'📱 تم إسناد جهاز إليك من إدارة MobiHub\nرقم الطلب: '+orderId+'\nالجهاز: '+String(found['اسم الجهاز']||'')+'\nالحالة: '+status+'\nالمكان: '+location); mhAppendNotificationLog_(employeeId,'إسناد جهاز','تم الإرسال',''); }
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

  // Whoever owns the device must know its status changed — previously the
  // update was silent unless it also reassigned the device.
  const ownerId = String(found['الموظف المسؤول Chat ID'] || '').trim();
  if (ownerId && ownerId !== String(profile.chatId)) {
    mhNotifyEmployee_(ownerId,
      '📱 تحديث حالة جهاز\n━━━━━━━━━━━━━━━━━━\n' +
      '🆔 ' + orderId + '\n' +
      '📌 الحالة: ' + oldStatus + ' ← ' + status + '\n' +
      '📍 المكان: ' + (location || oldLocation) + '\n' +
      (note ? '📝 ' + note + '\n' : '') +
      '━━━━━━━━━━━━━━━━━━\nافتح التطبيق ← حالة الجهاز.',
      'تحديث جهاز', 'device.assigned');
  }

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

  // The catalog lives in MH_DEVICE_INSPECTION_CATALOG_ (type -> {name, items}).
  // The previous code called a helper that was never defined in this project,
  // which threw a ReferenceError on every non-iPhone item and surfaced to the
  // Mini App as INTERNAL_ERROR as soon as the inspection screen opened.
  var catalog = MH_DEVICE_INSPECTION_CATALOG_;
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


/**
 * Returns the inspection log sheet with a compatible header row.
 *
 * If the sheet already exists with a different/legacy header, the missing
 * columns are appended instead of throwing SHEET_SCHEMA_MISMATCH. Existing
 * rows are preserved: new columns stay empty for old records.
 */
function mhEnsureInspectionSheetV106_(ss) {
  const NAME = 'سجل فحص الأجهزة';
  const expected = MH_DEVICE_INSPECTION_HEADERS_V106_;
  let sh = ss.getSheetByName(NAME);

  if (!sh) {
    sh = ss.insertSheet(NAME);
    sh.getRange(1,1,1,expected.length).setValues([expected]);
    sh.setFrozenRows(1);
    return sh;
  }

  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,expected.length).setValues([expected]);
    return sh;
  }

  const existing = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });

  const missing = expected.filter(function(h) { return existing.indexOf(h) < 0; });
  if (!missing.length && existing.length === expected.length) return sh;

  // A partially-matching legacy header is dangerous: a column such as
  // 'النتيجة' may exist but in a completely different position, so appending
  // the "missing" columns would silently write values into the wrong column.
  // Rebuild the header row instead and keep old data in a backup sheet.
  const hasOldData = sh.getLastRow() > 1;
  if (hasOldData) {
    const backupName = NAME + ' - نسخة قديمة ' + Utilities.formatDate(new Date(), MH.TZ, 'yyyyMMdd-HHmmss');
    sh.copyTo(ss).setName(backupName);
  }
  sh.clear();
  sh.getRange(1,1,1,expected.length).setValues([expected]);
  sh.setFrozenRows(1);
  return sh;
}

/* V1.10.6 persistent device inspection sessions.
 * Every save is an immutable snapshot; the latest session is loaded for continuation.
 */
const MH_DEVICE_INSPECTION_HEADERS_V106_ = [
  'التاريخ والوقت','معرف جلسة الفحص','رقم الطلب','نوع الجهاز','ترتيب الاختبار',
  'اسم الاختبار','النتيجة','ملاحظات الاختبار','منفذ الفحص Chat ID','منفذ الفحص'
];

function mhDeviceInspectionAccessV106_(profile, orderId) {
  // Standalone inspection mirrors the original Telegram bot: choose a device
  // family first, then run its checklist. No device custody/order is required.
  if (!String(orderId || '').trim()) {
    if (!['employee','supervisor','admin','super_admin'].includes(String(profile.role || ''))) {
      throw new Error('FORBIDDEN');
    }
    return null;
  }
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
  // orderId may be empty for a standalone check; rows are then scoped to
  // the requesting Telegram account by the filter below.
  if (!MH_DEVICE_INSPECTION_CATALOG_[type]) throw new Error('INVALID_INSPECTION_TYPE');
  mhDeviceInspectionAccessV106_(profile, orderId);
  const sh = spreadsheet_().getSheetByName('سجل فحص الأجهزة');
  if (!sh || sh.getLastRow() < 2) return {orderId,deviceType:type,sessionId:'',items:[]};
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const ix = {}; headers.forEach((h,i)=>ix[h]=i);
  const matches = values.slice(1).filter(r =>
    String(r[ix['رقم الطلب']] || '').trim() === orderId &&
    String(r[ix['نوع الجهاز']] || '').trim() === type &&
    (orderId || String(r[ix['منفذ الفحص Chat ID']] || '').trim() === String(profile.chatId))
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
  // orderId is optional: the Telegram bot also allows a standalone check
  // that is not tied to a registered device. Access is still authorised.
  if (!catalog) throw new Error('INVALID_INSPECTION_TYPE');
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
  const sh = mhEnsureInspectionSheetV106_(ss);
  const sessionId = Utilities.getUuid();
  const now = mhStamp_();

  // Map by header name so a legacy sheet column order cannot corrupt rows.
  const headerRow = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  const columnIndex = {};
  headerRow.forEach(function(h, i) { if (h) columnIndex[h] = i; });

  const rows = normalized.map(function(item) {
    const row = new Array(headerRow.length).fill('');
    const set = function(header, value) {
      if (columnIndex[header] !== undefined) row[columnIndex[header]] = value;
    };
    set('التاريخ والوقت', now);
    set('معرف جلسة الفحص', sessionId);
    set('رقم الطلب', orderId);
    set('نوع الجهاز', type);
    set('ترتيب الاختبار', item.index);
    set('اسم الاختبار', item.name);
    set('النتيجة', item.result);
    set('ملاحظات الاختبار', item.note);
    set('منفذ الفحص Chat ID', String(profile.chatId));
    set('منفذ الفحص', String(profile.name || ''));
    return row;
  });

  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const start = sh.getLastRow()+1;
    sh.getRange(start,1,rows.length,headerRow.length).setValues(rows);
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

/**
 * Extracts the first numeric value from a price cell so results can be sorted
 * and ranges can be summarised. Returns null when the cell holds no number.
 */
function repairPriceNumberMini_(value) {
  const match = String(value || '').replace(/[٬,]/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function repairPriceCleanTextMini_(value) {
  return String(value || '')
    .replace(/[\u200e\u200f\uFEFF]/g, '')
    .replace(/\uF8FF/g, 'Apple')
    .trim();
}

/**
 * Reads one price category once and returns every model with its priced items.
 * This replaces the previous per-call scanning and gives the Mini App the
 * price ranges and part names it needs for a single unified search.
 */
function repairPriceCategoryDataMini_(book, cfg) {
  const sh = repairPriceSheetMini_(book, cfg);
  const last = Math.min(sh.getLastRow(), cfg.endRow);
  if (last < cfg.startRow) return { headers: [], models: [] };

  const width = sh.getLastColumn();
  if (width < 2) return { headers: [], models: [] };

  const headers = sh.getRange(cfg.headerRow, 1, 1, width).getDisplayValues()[0]
    .map(function(h) { return repairPriceCleanTextMini_(h); });
  const values = sh.getRange(cfg.startRow, 1, last - cfg.startRow + 1, width).getDisplayValues();

  const models = [];
  values.forEach(function(row, index) {
    const name = repairPriceCleanTextMini_(row[0]);
    if (!name) return;
    if (/^(device|AirPod|Watch)\\/i.test(name)) return;

    const issues = [];
    for (let col = 1; col < width; col++) {
      const issue = headers[col];
      const price = repairPriceCleanTextMini_(row[col]);
      if (!issue || !price) continue;
      issues.push({ issue: issue, price: price, value: repairPriceNumberMini_(price) });
    }
    if (!issues.length) return;

    const values_ = issues.map(function(i) { return i.value; }).filter(function(v) { return v !== null; });
    models.push({
      row: cfg.startRow + index,
      name: name,
      issues: issues,
      issueCount: issues.length,
      minPrice: values_.length ? Math.min.apply(null, values_) : null,
      maxPrice: values_.length ? Math.max.apply(null, values_) : null
    });
  });

  return { headers: headers, models: models };
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
  const data=repairPriceCategoryDataMini_(book,cfg);
  const part=String(body.part||'').trim();

  let models;
  if(part){
    // A part was chosen: show only models that actually price this part,
    // and expose that single price so the list answers one question.
    models=[];
    data.models.forEach(function(m){
      const hit=m.issues.filter(function(i){return i.issue===part;})[0];
      if(!hit) return;
      models.push({row:m.row,name:m.name,part:part,price:hit.price,priceValue:hit.value,
        issueCount:m.issueCount,minPrice:m.minPrice,maxPrice:m.maxPrice});
    });
    models.sort(function(a,b){
      const av=a.priceValue===null?Infinity:a.priceValue;
      const bv=b.priceValue===null?Infinity:b.priceValue;
      return av-bv || String(a.name).localeCompare(String(b.name),'ar');
    });
  }else{
    models=data.models.map(function(m){
      return {row:m.row,name:m.name,issueCount:m.issueCount,minPrice:m.minPrice,maxPrice:m.maxPrice};
    });
  }

  const pageSize=part?20:12, totalPages=Math.max(1,Math.ceil(models.length/pageSize));
  const page=Math.max(0,Math.min(Number(body.page)||0,totalPages-1));
  return {category:cfg.key,label:cfg.label,part:part,models:models.slice(page*pageSize,(page+1)*pageSize),page,total:models.length,totalPages,pageSize};
}

// One workbook read for the complete model picker; avoids fetching each page
// separately and rescanning the linked workbook several times.
function repairPriceCatalogMini_(body) {
  const cfg=repairPriceConfigMini_(body.category), book=repairPriceBookMini_();
  const data=repairPriceCategoryDataMini_(book,cfg);
  return {
    category:cfg.key,
    label:cfg.label,
    total:data.models.length,
    models:data.models.map(function(m){
      return {row:m.row,name:m.name,issueCount:m.issueCount,minPrice:m.minPrice,maxPrice:m.maxPrice};
    })
  };
}

/**
 * Part categories (the price columns) for one device family.
 * Lets the Mini App ask "which part?" before listing 36 models.
 */
function repairPricePartsMini_(body) {
  const cfg=repairPriceConfigMini_(body.category), book=repairPriceBookMini_();
  const data=repairPriceCategoryDataMini_(book,cfg);

  const byPart={};
  data.models.forEach(function(m){
    m.issues.forEach(function(item){
      const key=item.issue;
      if(!byPart[key]) byPart[key]={name:key,modelCount:0,minPrice:null,maxPrice:null};
      const rec=byPart[key];
      rec.modelCount++;
      if(item.value!==null){
        rec.minPrice=rec.minPrice===null?item.value:Math.min(rec.minPrice,item.value);
        rec.maxPrice=rec.maxPrice===null?item.value:Math.max(rec.maxPrice,item.value);
      }
    });
  });

  const parts=Object.keys(byPart).map(function(k){return byPart[k];});
  parts.sort(function(a,b){
    const av=a.minPrice===null?Infinity:a.minPrice;
    const bv=b.minPrice===null?Infinity:b.minPrice;
    return av-bv || String(a.name).localeCompare(String(b.name),'ar');
  });

  return {category:cfg.key,label:cfg.label,parts:parts,total:parts.length,modelCount:data.models.length};
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
  const data=repairPriceCategoryDataMini_(repairPriceBookMini_(),cfg);
  const model=data.models.find(function(item){return item.row===rowNum;});
  if(!model) throw new Error('REPAIR_PRICE_MODEL_NOT_FOUND');
  return {
    category:cfg.key,
    label:cfg.label,
    row:rowNum,
    model:model.name,
    issues:model.issues.map(function(item){return {issue:item.issue,price:item.price};})
  };
}

/**
 * Unified search used by the Mini App price screen.
 *
 * mode = 'models' : matches device model names (the old behaviour).
 * mode = 'parts'  : matches part/issue names across every model, so a
 *                   technician can type "شاشة" or "بطارية" and get the
 *                   actual price for a specific device.
 * mode = 'all'    : both, parts first.
 */
function repairPriceSearchAllMini_(body) {
  const query = String(body.query || '').trim();
  if (query.length < 2 || query.length > 100) throw new Error('INVALID_REPAIR_PRICE_QUERY');

  const mode = ['models', 'parts', 'all'].indexOf(String(body.mode || 'all')) >= 0
    ? String(body.mode || 'all')
    : 'all';
  const needle = repairPriceNormalizeMini_(query);
  const needleParts = needle.split(' ').filter(Boolean);
  const matches = function(text) {
    const hay = repairPriceNormalizeMini_(text);
    if (hay.indexOf(needle) !== -1) return true;
    return needleParts.length > 1 && needleParts.every(function(p) { return hay.indexOf(p) !== -1; });
  };

  const book = repairPriceBookMini_();
  const modelHits = [];
  const partHits = [];
  const partGroups = {};

  MH_REPAIR_PRICE_CATEGORIES_.forEach(function(cfg) {
    const data = repairPriceCategoryDataMini_(book, cfg);
    data.models.forEach(function(model) {
      if (mode !== 'parts' && matches(model.name)) {
        modelHits.push({
          kind: 'model',
          category: cfg.key,
          categoryLabel: cfg.label,
          row: model.row,
          model: model.name,
          name: model.name,
          issueCount: model.issueCount,
          minPrice: model.minPrice,
          maxPrice: model.maxPrice
        });
      }
      if (mode !== 'models') {
        model.issues.forEach(function(item) {
          if (!matches(item.issue)) return;
          // Aggregate the same part name across models so the user can open
          // one category instead of scrolling dozens of rows.
          if (!partGroups[item.issue]) {
            partGroups[item.issue] = { issue: item.issue, modelCount: 0, minPrice: null, maxPrice: null };
          }
          const group = partGroups[item.issue];
          group.modelCount++;
          if (item.value !== null) {
            group.minPrice = group.minPrice === null ? item.value : Math.min(group.minPrice, item.value);
            group.maxPrice = group.maxPrice === null ? item.value : Math.max(group.maxPrice, item.value);
          }
          partHits.push({
            kind: 'part',
            category: cfg.key,
            categoryLabel: cfg.label,
            row: model.row,
            model: model.name,
            name: item.issue,
            issue: item.issue,
            price: item.price,
            priceValue: item.value
          });
        });
      }
    });
  });

  // Cheapest matching part first: technicians usually ask "how much is X".
  partHits.sort(function(a, b) {
    const av = a.priceValue === null ? Infinity : a.priceValue;
    const bv = b.priceValue === null ? Infinity : b.priceValue;
    return av - bv || String(a.model).localeCompare(String(b.model), 'ar');
  });
  modelHits.sort(function(a, b) {
    const av = a.minPrice === null ? Infinity : a.minPrice;
    const bv = b.minPrice === null ? Infinity : b.minPrice;
    return av - bv || String(a.name).localeCompare(String(b.name), 'ar');
  });

  const results = partHits.concat(modelHits);
  const pageSize = Number(body.pageSize) > 0 && Number(body.pageSize) <= 50 ? Number(body.pageSize) : 20;
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const page = Math.max(0, Math.min(Number(body.page) || 0, totalPages - 1));

  const groups = Object.keys(partGroups).map(function(k) { return partGroups[k]; });
  groups.sort(function(a, b) {
    const av = a.minPrice === null ? Infinity : a.minPrice;
    const bv = b.minPrice === null ? Infinity : b.minPrice;
    return av - bv || String(a.issue).localeCompare(String(b.issue), 'ar');
  });

  return {
    query: query,
    mode: mode,
    results: results.slice(page * pageSize, (page + 1) * pageSize),
    partGroups: groups,
    partCount: partHits.length,
    modelCount: modelHits.length,
    total: results.length,
    page: page,
    totalPages: totalPages,
    pageSize: pageSize
  };
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

/* =========================================================
   V1.13 — TASKS (تسكاتي)
   Assignment-driven tasks for technicians, created from the
   manager dashboard or directly in the sheet. Read/write are
   role-checked server-side; employees only ever see their own.
========================================================= */
const MH_TASK_HEADERS = [
  'رقم المهمة','العنوان','التفاصيل','النوع','Chat ID','اسم الفني','الأولوية',
  'تاريخ الاستحقاق','الحالة','نسبة الإنجاز','رابط الدليل','ملاحظة الفني',
  'ملاحظة المراجعة','أنشأها Chat ID','أنشأها','تاريخ الإنشاء','تاريخ آخر تحديث','آخر تحديث بواسطة'
];
const MH_TASK_STATUSES = ['جديدة','قيد التنفيذ','بانتظار المراجعة','مكتملة','ملغاة'];
const MH_TASK_PRIORITIES = ['عادية','مهمة','عاجلة'];
const MH_TASK_TYPES = ['دعاية','صيانة','تدريب','جودة','أخرى'];
const MH_TASK_SHEET_ = 'المهام';

function mhTaskSheet_() {
  const ss = spreadsheet_();
  let sh = ss.getSheetByName(MH_TASK_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(MH_TASK_SHEET_);
    sh.getRange(1, 1, 1, MH_TASK_HEADERS.length).setValues([MH_TASK_HEADERS]);
    sh.setFrozenRows(1);
    return sh;
  }
  // An older task sheet may predate a column (e.g. ملاحظة المراجعة).
  // Append only the missing headers so existing rows are never disturbed.
  const width = Math.max(sh.getLastColumn(), 1);
  const existing = sh.getRange(1, 1, 1, width).getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  const missing = MH_TASK_HEADERS.filter(function(h) { return existing.indexOf(h) < 0; });
  if (missing.length) {
    sh.getRange(1, width + 1, 1, missing.length).setValues([missing]);
  }
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
  return sh;
}

function mhTaskRows_(sh) {
  return mhRowsObjects_(sh);
}

function mhTaskRequireStaff_(profile) {
  mhRequireRole_(profile, ['super_admin','admin','supervisor']);
}

/** Tasks visible to the caller: employees see only their own. */
function tasksListMini_(profile, body) {
  const includeAll = String(body.scope || '') === 'all';
  if (includeAll) mhTaskRequireStaff_(profile);

  const sh = mhTaskSheet_();
  const rows = mhTaskRows_(sh);
  const mine = String(profile.chatId);
  const statusFilter = String(body.status || '').trim();

  let items = rows.filter(function(r) {
    if (!includeAll && String(r['Chat ID'] || '').trim() !== mine) return false;
    if (statusFilter && String(r['الحالة'] || '').trim() !== statusFilter) return false;
    return true;
  });

  // Open work first, then by due date, newest last.
  const weight = function(r) {
    const s = String(r['الحالة'] || '').trim();
    if (s === 'جديدة') return 0;
    if (s === 'قيد التنفيذ') return 1;
    if (s === 'بانتظار المراجعة') return 2;
    if (s === 'مكتملة') return 4;
    return 5;
  };
  items.sort(function(a, b) {
    const w = weight(a) - weight(b);
    if (w) return w;
    const da = String(a['تاريخ الاستحقاق'] || '');
    const db = String(b['تاريخ الاستحقاق'] || '');
    return da.localeCompare(db);
  });

  const today = mhToday_();
  const mapped = items.slice(0, 200).map(function(r) {
    const due = mhDate_(r['تاريخ الاستحقاق']);
    return {
      id: String(r['رقم المهمة'] || ''),
      title: String(r['العنوان'] || ''),
      details: String(r['التفاصيل'] || ''),
      type: String(r['النوع'] || ''),
      employeeId: String(r['Chat ID'] || ''),
      employeeName: String(r['اسم الفني'] || ''),
      priority: String(r['الأولوية'] || 'عادية'),
      dueDate: due,
      status: String(r['الحالة'] || 'جديدة'),
      progress: Number(r['نسبة الإنجاز'] || 0),
      proofUrl: String(r['رابط الدليل'] || ''),
      employeeNote: String(r['ملاحظة الفني'] || ''),
      reviewNote: String(r['ملاحظة المراجعة'] || ''),
      createdBy: String(r['أنشأها'] || ''),
      createdAt: String(r['تاريخ الإنشاء'] || ''),
      updatedAt: String(r['تاريخ آخر تحديث'] || ''),
      overdue: !!due && due < today && !['مكتملة','ملغاة'].includes(String(r['الحالة'] || '').trim())
    };
  });

  const summary = {
    total: mapped.length,
    open: mapped.filter(function(t) { return ['جديدة','قيد التنفيذ','بانتظار المراجعة'].indexOf(t.status) >= 0; }).length,
    done: mapped.filter(function(t) { return t.status === 'مكتملة'; }).length,
    overdue: mapped.filter(function(t) { return t.overdue; }).length
  };

  return { tasks: mapped, summary: summary, today: today, statuses: MH_TASK_STATUSES, priorities: MH_TASK_PRIORITIES, types: MH_TASK_TYPES };
}

/** Update progress / status / proof from the technician side. */
function tasksUpdateMini_(profile, body) {
  const id = String(body.taskId || '').trim();
  if (!id) throw new Error('TASK_NOT_FOUND');

  const sh = mhTaskSheet_();
  mhAssertHeaders_(sh, MH_TASK_HEADERS);
  const map = mhHeaderMap_(sh);
  const rows = mhTaskRows_(sh);
  const found = rows.find(function(r) { return String(r['رقم المهمة'] || '').trim() === id; });
  if (!found) throw new Error('TASK_NOT_FOUND');

  const isStaff = ['super_admin','admin','supervisor','finance'].indexOf(profile.role) >= 0;
  if (!isStaff && String(found['Chat ID'] || '').trim() !== String(profile.chatId)) throw new Error('FORBIDDEN');

  const currentStatus = String(found['الحالة'] || 'جديدة').trim();
  const nextStatus = String(body.status || currentStatus).trim();
  if (MH_TASK_STATUSES.indexOf(nextStatus) < 0) throw new Error('INVALID_TASK_STATUS');
  // Only a reviewer may close or cancel; the assignee may move work forward.
  if (['مكتملة','ملغاة'].indexOf(nextStatus) >= 0 && !isStaff && nextStatus !== currentStatus) {
    if (currentStatus !== 'بانتظار المراجعة') throw new Error('TASK_REVIEW_REQUIRED');
  }

  let progress = body.progress === undefined ? Number(found['نسبة الإنجاز'] || 0) : Number(body.progress);
  if (!isFinite(progress) || progress < 0 || progress > 100) throw new Error('INVALID_TASK_PROGRESS');
  progress = Math.round(progress);

  const proofUrl = body.proofUrl === undefined ? String(found['رابط الدليل'] || '') : String(body.proofUrl || '').trim();
  if (proofUrl.length > 500) throw new Error('INVALID_TASK_PROOF');
  const note = body.note === undefined ? String(found['ملاحظة الفني'] || '') : String(body.note || '').trim();
  if (note.length > 1000) throw new Error('INVALID_TASK_NOTE');

  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const set = function(header, value) {
      if (map[header]) sh.getRange(found.__row, map[header]).setValue(value);
    };
    set('الحالة', nextStatus);
    set('نسبة الإنجاز', progress);
    set('رابط الدليل', proofUrl);
    set('ملاحظة الفني', note);
    set('تاريخ آخر تحديث', mhStamp_());
    set('آخر تحديث بواسطة', String(profile.name || profile.chatId));
    if (nextStatus === 'مكتملة') set('نسبة الإنجاز', 100);
  } finally { lock.releaseLock(); }

  // Alert the reviewers when the technician submits work, and confirm to the
  // technician otherwise. Previously this function sent nothing at all, so a
  // submitted task never reached a manager.
  if (nextStatus === 'بانتظار المراجعة' && currentStatus !== 'بانتظار المراجعة') {
    mhNotifyManagement_(
      '📥 مهمة جاهزة للمراجعة\n━━━━━━━━━━━━━━━━━━\n' +
      '📝 ' + String(found['العنوان'] || '') + '\n' +
      '👤 ' + String(profile.name || '') + '\n' +
      (proofUrl ? '🔗 دليل مرفق\n' : '⚠️ بدون رابط دليل\n') +
      (note ? '💬 ' + note.slice(0, 200) + '\n' : '') +
      '━━━━━━━━━━━━━━━━━━\nافتح لوحة الإدارة ← المهام والتسكات.',
      'مراجعة مهمة'
    );
  }

  return {
    updated: true,
    taskId: id,
    status: nextStatus,
    progress: nextStatus === 'مكتملة' ? 100 : progress,
    message: nextStatus === 'بانتظار المراجعة'
      ? 'تم إرسال المهمة للمراجعة. سيتم إبلاغك بعد الاعتماد.'
      : 'تم تحديث المهمة.'
  };
}

/** Create one task, or many at once for a whole team. */
function tasksCreateMini_(profile, body) {
  mhTaskRequireStaff_(profile);
  const sh = mhTaskSheet_();
  mhAssertHeaders_(sh, MH_TASK_HEADERS);

  const title = String(body.title || '').trim();
  const details = String(body.details || '').trim();
  const type = String(body.type || 'دعاية').trim();
  const priority = String(body.priority || 'عادية').trim();
  const dueDate = mhIsoDate_(body.dueDate) || mhToday_();
  if (title.length < 3 || title.length > 120) throw new Error('INVALID_TASK_TITLE');
  if (details.length > 1500) throw new Error('INVALID_TASK_DETAILS');
  if (MH_TASK_TYPES.indexOf(type) < 0) throw new Error('INVALID_TASK_TYPE');
  if (MH_TASK_PRIORITIES.indexOf(priority) < 0) throw new Error('INVALID_TASK_PRIORITY');

  const employees = rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees).filter(function(r) {
    return String(r['Chat ID'] || '').trim() &&
      String(r['الحالة'] || 'نشط').trim() === 'نشط' &&
      String(r['حالة الحساب'] || 'نشط').trim() === 'نشط';
  });
  const byId = {};
  employees.forEach(function(r) { byId[String(r['Chat ID']).trim()] = String(r['اسم الموظف'] || ''); });

  // Normalise incoming ids: the UI may send numbers or padded strings.
  const requested = Array.isArray(body.employeeIds)
    ? body.employeeIds.map(function(v) { return String(v == null ? '' : v).trim(); }).filter(Boolean)
    : [];
  const wantsAll = requested.indexOf('all') >= 0;
  const targets = wantsAll
    ? Object.keys(byId)
    : requested.filter(function(id) { return byId[id]; });
  if (!targets.length) throw new Error('TASK_TARGET_REQUIRED');

  const now = mhStamp_();
  const created = [];
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const startRow = sh.getLastRow() + 1;

    // Map the header row once so sets are positional-safe. An older sheet may
    // have extra or reordered columns; writing by name can never shift data.
    const headerRow = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0]
      .map(function(h) { return String(h).trim(); });
    const colIndex = {};
    headerRow.forEach(function(h, i) { if (h) colIndex[h] = i; });

    const rows = targets.map(function(id, index) {
      const taskId = 'TSK-' + Utilities.formatDate(new Date(), MH.TZ, 'yyyyMMdd') + '-' +
        String(startRow + index).padStart(3, '0');
      created.push(taskId);

      const row = new Array(headerRow.length).fill('');
      const set = function(header, value) {
        if (colIndex[header] !== undefined) row[colIndex[header]] = value;
      };
      set('رقم المهمة', taskId);
      set('العنوان', title);
      set('التفاصيل', details);
      set('النوع', type);
      set('Chat ID', id);
      set('اسم الفني', byId[id] || '');
      set('الأولوية', priority);
      set('تاريخ الاستحقاق', dueDate);
      set('الحالة', 'جديدة');
      set('نسبة الإنجاز', 0);
      set('رابط الدليل', '');
      set('ملاحظة الفني', '');
      set('ملاحظة المراجعة', '');
      set('أنشأها Chat ID', String(profile.chatId));
      set('أنشأها', String(profile.name || ''));
      set('تاريخ الإنشاء', now);
      set('تاريخ آخر تحديث', now);
      set('آخر تحديث بواسطة', String(profile.name || ''));
      return row;
    });

    sh.getRange(startRow, 1, rows.length, headerRow.length).setValues(rows);
  } finally { lock.releaseLock(); }

  // Notify each assignee in Telegram; failures are logged, never fatal.
  // Guarded end-to-end: a notification problem must not undo created tasks.
  let notified = 0;
  try {
  targets.forEach(function(id) {
    try {
      mhTelegramSend_(id,
        '📌 مهمة جديدة من إدارة MobiHub\n' +
        '━━━━━━━━━━━━━━━━━━\n' +
        '📝 ' + title + '\n' +
        (details ? '📄 ' + details + '\n' : '') +
        '🏷 النوع: ' + type + ' · الأولوية: ' + priority + '\n' +
        '📅 الاستحقاق: ' + dueDate + '\n' +
        '━━━━━━━━━━━━━━━━━━\n' +
        'افتح التطبيق ← تسكاتي لمتابعتها.');
      mhAppendNotificationLog_(id, 'مهمة جديدة', 'تم الإرسال', '');
      notified++;
    } catch (e) {
      mhAppendNotificationLog_(id, 'مهمة جديدة', 'فشل', String(e && e.message || e));
    }
  });
  } catch (notifyErr) {
    try { console.error('Task notification block failed: ' + (notifyErr && notifyErr.message || notifyErr)); } catch (ignored) {}
  }

  return { created: created.length, taskIds: created, notified: notified, total: targets.length };
}

/** Manager review: approve a submitted task or send it back. */
function tasksReviewMini_(profile, body) {
  mhTaskRequireStaff_(profile);
  const id = String(body.taskId || '').trim();
  const decision = String(body.decision || '').trim();
  if (['اعتماد','إعادة'].indexOf(decision) < 0) throw new Error('INVALID_TASK_DECISION');

  const sh = mhTaskSheet_();
  mhAssertHeaders_(sh, MH_TASK_HEADERS);
  const map = mhHeaderMap_(sh);
  const found = mhTaskRows_(sh).find(function(r) { return String(r['رقم المهمة'] || '').trim() === id; });
  if (!found) throw new Error('TASK_NOT_FOUND');
  if (String(found['الحالة'] || '').trim() !== 'بانتظار المراجعة') throw new Error('TASK_NOT_SUBMITTED');

  const note = String(body.note || '').trim();
  if (note.length > 1000) throw new Error('INVALID_TASK_NOTE');

  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    sh.getRange(found.__row, map['الحالة']).setValue(decision === 'اعتماد' ? 'مكتملة' : 'قيد التنفيذ');
    if (decision === 'اعتماد') sh.getRange(found.__row, map['نسبة الإنجاز']).setValue(100);
    sh.getRange(found.__row, map['تاريخ آخر تحديث']).setValue(mhStamp_());
    sh.getRange(found.__row, map['آخر تحديث بواسطة']).setValue(String(profile.name || profile.chatId));
    // Review notes get their own column; the technician's note must survive.
    if (note) {
      if (map['ملاحظة المراجعة']) sh.getRange(found.__row, map['ملاحظة المراجعة']).setValue(note);
    }
  } finally { lock.releaseLock(); }

  try {
    mhTelegramSend_(String(found['Chat ID'] || '').trim(),
      decision === 'اعتماد'
        ? '✅ تم اعتماد مهمتك: ' + String(found['العنوان'] || '') + '\nشكرًا لالتزامك.'
        : '🔄 أُعيدت مهمتك للمتابعة: ' + String(found['العنوان'] || '') + (note ? '\nملاحظة المدير: ' + note : ''));
  } catch (e) { /* notification failure must not block the decision */ }

  return { updated: true, taskId: id, status: decision === 'اعتماد' ? 'مكتملة' : 'قيد التنفيذ' };
}

/**
 * Seeds the advertising starter tasks for every active technician.
 * Idempotent: skips technicians who already have an advertising task.
 */
function tasksSeedMarketingMini_(profile) {
  mhTaskRequireStaff_(profile);
  const employees = rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees).filter(function(r) {
    return String(r['Chat ID'] || '').trim() &&
      String(r['الحالة'] || 'نشط').trim() === 'نشط' &&
      String(r['حالة الحساب'] || 'نشط').trim() === 'نشط';
  });
  const existing = mhTaskRows_(mhTaskSheet_());
  const already = {};
  existing.forEach(function(r) {
    if (String(r['النوع'] || '').trim() === 'دعاية') already[String(r['Chat ID'] || '').trim()] = true;
  });

  const seed = [
    { title: '٥ ستوريات دعائية للمركز', details: 'صوّر ٥ ستوريات داخل المركز: واجهة المحل، جهاز أثناء الإصلاح، فريق العمل، قبل/بعد لإصلاح، وسعر إصلاح مميز. أضف هاشتاج MobiHub.', priority: 'مهمة' },
    { title: 'بوست واحد على فيسبوك', details: 'انشر بوستًا يضم صورة الجهاز مع وصف مشكلة وحل، واذكر السعر يبدأ من كام؟ واسم المركز ورقم التواصل.', priority: 'مهمة' },
    { title: 'فيديو قصير (ريلز/تيك توك)', details: 'فيديو ٢٠–٤٠ ثانية يوضح إصلاح سريع أو نصيحة صيانة. اكتب تعليقًا يذكر MobiHub.', priority: 'عادية' }
  ];

  const due = mhAddDays_(mhToday_(), 7);
  const now = mhStamp_();
  const sh = mhTaskSheet_();
  mhAssertHeaders_(sh, MH_TASK_HEADERS);

  const targets = employees.filter(function(r) { return !already[String(r['Chat ID']).trim()]; });
  if (!targets.length) return { seeded: 0, skipped: employees.length, message: 'كل الفنيين لديهم مهام دعاية بالفعل.' };

  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let rowPointer = sh.getLastRow() + 1;
  let created = 0;
  try {
    targets.forEach(function(emp) {
      const chatId = String(emp['Chat ID']).trim();
      const name = String(emp['اسم الموظف'] || '');
      // Write by header name so the column count can never drift again.
      const headerRow = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0]
        .map(function(h) { return String(h).trim(); });
      const colIndex = {};
      headerRow.forEach(function(h, i) { if (h) colIndex[h] = i; });

      const rows = seed.map(function(task) {
        const taskId = 'TSK-' + Utilities.formatDate(new Date(), MH.TZ, 'yyyyMMdd') + '-' + String(rowPointer).padStart(3, '0');
        rowPointer++;
        created++;

        const row = new Array(headerRow.length).fill('');
        const set = function(header, value) {
          if (colIndex[header] !== undefined) row[colIndex[header]] = value;
        };
        set('رقم المهمة', taskId);
        set('العنوان', task.title);
        set('التفاصيل', task.details);
        set('النوع', 'دعاية');
        set('Chat ID', chatId);
        set('اسم الفني', name);
        set('الأولوية', task.priority);
        set('تاريخ الاستحقاق', due);
        set('الحالة', 'جديدة');
        set('نسبة الإنجاز', 0);
        set('رابط الدليل', '');
        set('ملاحظة الفني', '');
        set('ملاحظة المراجعة', '');
        set('أنشأها Chat ID', String(profile.chatId));
        set('أنشأها', String(profile.name || ''));
        set('تاريخ الإنشاء', now);
        set('تاريخ آخر تحديث', now);
        set('آخر تحديث بواسطة', String(profile.name || ''));
        return row;
      });
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, headerRow.length).setValues(rows);
    });
  } finally { lock.releaseLock(); }

  return { seeded: created, technicians: targets.length, dueDate: due };
}

/* =========================================================
   V1.13 — OUTBOUND NOTIFICATIONS
   Every decision made in the dashboard now notifies the
   affected employee on Telegram. Failures are logged to
   «سجل الإشعارات» and never block the decision itself.
========================================================= */

function mhNotifyEmployee_(chatId, text, eventType, eventKey) {
  const id = String(chatId || '').trim();
  if (!id) return false;

  // Respect the Super Admin matrix: a muted event must not reach the device.
  if (eventKey) {
    const allowed = mhNotifyAllowed_(id, eventKey);
    if (allowed === false || allowed.bot === false) return false;
  }

  try {
    mhTelegramSend_(id, text);
    mhAppendNotificationLog_(id, eventType || 'إشعار', 'تم الإرسال', '');
    return true;
  } catch (e) {
    mhAppendNotificationLog_(id, eventType || 'إشعار', 'فشل', String(e && e.message || e));
    return false;
  }
}

/** Leave / permission decision → assignee. */
function mhNotifyLeaveDecision_(chatId, decision, leaveType, date, note) {
  const head = decision === 'مقبول' ? '✅ تمت الموافقة على طلب إذنك' : '❌ تم رفض طلب إذنك';
  return mhNotifyEmployee_(chatId,
    head + '\n━━━━━━━━━━━━━━━━━━\n' +
    '📅 التاريخ: ' + (date || '—') + '\n' +
    '🏷 النوع: ' + (leaveType || '—') + '\n' +
    (note ? '📝 ملاحظة المدير: ' + note + '\n' : '') +
    '━━━━━━━━━━━━━━━━━━\n' +
    (decision === 'مقبول' ? 'يمكنك متابعة التفاصيل من التطبيق ← طلباتي.' : 'يمكنك تقديم طلب جديد إن لزم.'),
    'قرار إذن',
    'leave.decided'
  );
}

/** Cash advance / custody decision → requester. */
function mhNotifyCashDecision_(chatId, decision, amount, note) {
  const head = decision === 'مرفوض' ? '❌ تم رفض طلب السلفة'
    : decision === 'تم الصرف' ? '💸 تم صرف مبلغ السلفة'
    : '✅ تمت الموافقة على طلب السلفة';
  return mhNotifyEmployee_(chatId,
    head + '\n━━━━━━━━━━━━━━━━━━\n' +
    (amount ? '💵 المبلغ: ' + amount + ' جنيه\n' : '') +
    (note ? '📝 ملاحظة المدير: ' + note + '\n' : '') +
    '━━━━━━━━━━━━━━━━━━\n' +
    (decision === 'تم الصرف' ? 'لا تنسَ تقديم التسوية من التطبيق بعد انتهاء العهدة.' : 'افتح التطبيق ← السلف والعهد للمتابعة.'),
    'قرار سلفة',
    'cash.decided'
  );
}

/** Deduction decision → employee. */
function mhNotifyDeductionDecision_(chatId, decision, amount, reason, note) {
  const head = decision === 'معتمد' ? '⚠️ تم اعتماد خصم على حسابك' : '✅ تم رفض الخصم المقترح';
  return mhNotifyEmployee_(chatId,
    head + '\n━━━━━━━━━━━━━━━━━━\n' +
    (amount ? '💵 المبلغ: ' + amount + ' جنيه\n' : '') +
    (reason ? '📄 السبب: ' + reason + '\n' : '') +
    (note ? '📝 ملاحظات: ' + note + '\n' : '') +
    '━━━━━━━━━━━━━━━━━━\n' +
    'افتح التطبيق ← خصوماتي للتفاصيل.',
    'قرار خصم',
    'deduction.decided'
  );
}

/** Cash settlement decision → employee. */
function mhNotifySettlementDecision_(chatId, decision, returned, extra) {
  return mhNotifyEmployee_(chatId,
    (decision === 'مقبول' ? '✅ تم اعتماد تسوية العهدة' : '🔄 تحتاج تسوية عهدتك للمراجعة مرة أخرى') +
    '\n━━━━━━━━━━━━━━━━━━\n' +
    (returned > 0 ? '💵 المطلوب إرجاعه: ' + returned + ' جنيه\n' : '') +
    (extra > 0 ? '➕ المستحق لك: ' + extra + ' جنيه\n' : '') +
    '━━━━━━━━━━━━━━━━━━\nافتح التطبيق ← السلف والعهد.',
    'قرار تسوية',
    'cash.settlement'
  );
}

/** A new complaint replied to by management → complainant. */
function mhNotifyComplaintReply_(chatId, complaintId, status) {
  return mhNotifyEmployee_(chatId,
    '💬 رد جديد على شكواك\n━━━━━━━━━━━━━━━━━━\n' +
    (complaintId ? '🆔 رقم الشكوى: ' + complaintId + '\n' : '') +
    (status ? '📌 الحالة الآن: ' + status + '\n' : '') +
    '━━━━━━━━━━━━━━━━━━\nافتح التطبيق ← شكاويي للرد.',
    'رد على شكوى',
    'complaint.reply'
  );
}

/** Request submitted by an employee → notify the management team. */
function mhNotifyManagement_(message, eventType) {
  let recipients = [];

  // Always include the root admin (ADMIN_ID), even when that account is not
  // listed in the managers sheet. Without this, alerts for new tasks, part
  // requests and complaints could reach nobody.
  try {
    const rootId = String(PropertiesService.getScriptProperties().getProperty('ADMIN_ID') || '9134455704').trim();
    if (/^\d{5,20}$/.test(rootId)) recipients.push(rootId);
  } catch (e) { /* properties unavailable */ }

  try {
    const managers = rowsAsObjects_(spreadsheet_(), MH.SHEETS.managers);
    managers.forEach(function(r) {
      const id = String(r['Chat ID'] || '').trim();
      const role = String(r['الصلاحية'] || '').trim();
      if (!id) return;
      if (String(r['الحالة'] || 'نشط').trim() !== 'نشط') return;
      if (['Super Admin', 'Admin', 'Supervisor'].indexOf(role) < 0) return;
      if (recipients.indexOf(id) < 0) recipients.push(id);
    });
  } catch (e) { /* managers sheet missing must not break submission */ }

  recipients.forEach(function(id) { mhNotifyEmployee_(id, message, eventType || 'إشعار إدارة'); });
  return recipients.length;
}

/* =========================================================
   V1.13 — NOTIFICATION DIAGNOSTICS
   Lets a manager verify Telegram delivery and switch every
   notification flag on in one action.
========================================================= */

/** Every notification toggle the system understands. */
const MH_NOTIFICATION_KEYS_ = [
  'tasks.assign','tasks.review','requests.new','leaves.decide','cash.decide',
  'cash.settlement','deduction.decide','complaints.reply','complaints.new'
];

function mhEnsureNotificationSettings_() {
  const sh = mhEnsureSheet_('إعدادات الإشعارات', MH_NOTIFICATION_SETTING_HEADERS);
  const map = mhHeaderMap_(sh);
  const rows = mhRowsObjects_(sh);
  const existing = {};
  rows.forEach(function(r) { existing[String(r['الإعداد'] || '').trim()] = r.__row; });

  const descriptions = {
    'tasks.assign': 'إشعار الفني عند إسناد مهمة جديدة',
    'tasks.review': 'إشعار الفني عند اعتماد أو إعادة مهمة',
    'requests.new': 'إشعار الإدارة عند وصول طلب أو إذن جديد',
    'leaves.decide': 'إشعار الموظف بقرار طلب الإذن',
    'cash.decide': 'إشعار الموظف بقرار السلفة أو الصرف',
    'cash.settlement': 'إشعار الموظف بقرار تسوية العهدة',
    'deduction.decide': 'إشعار الموظف بقرار الخصم',
    'complaints.reply': 'إشعار الموظف عند رد الإدارة على الشكوى',
    'complaints.new': 'إشعار الإدارة عند شكوى جديدة'
  };

  MH_NOTIFICATION_KEYS_.forEach(function(key) {
    if (existing[key]) return;
    sh.appendRow([key, 'TRUE', descriptions[key] || '']);
  });
  return sh;
}

/** Reads all flags; missing flags default to enabled. */
function mhNotificationFlags_() {
  const flags = {};
  MH_NOTIFICATION_KEYS_.forEach(function(k) { flags[k] = true; });
  try {
    const rows = mhRowsObjects_(mhEnsureSheet_('إعدادات الإشعارات', MH_NOTIFICATION_SETTING_HEADERS));
    rows.forEach(function(r) {
      const key = String(r['الإعداد'] || '').trim();
      if (!key) return;
      flags[key] = String(r['القيمة'] || '').toUpperCase() !== 'FALSE';
    });
  } catch (e) { /* missing sheet means everything stays enabled */ }
  return flags;
}

/** Manager action: turn every notification on. */
function notificationsEnableAllMini_(profile) {
  mhRequireRole_(profile, ['super_admin','admin']);
  const sh = mhEnsureNotificationSettings_();
  const map = mhHeaderMap_(sh);
  mhRowsObjects_(sh).forEach(function(r) {
    const key = String(r['الإعداد'] || '').trim();
    if (MH_NOTIFICATION_KEYS_.indexOf(key) < 0) return;
    sh.getRange(r.__row, map['القيمة']).setValue('TRUE');
  });
  return { enabled: MH_NOTIFICATION_KEYS_.length, keys: MH_NOTIFICATION_KEYS_ };
}

/**
 * Manager action: send a real Telegram message to the caller so the
 * notification path can be verified end to end.
 */
function notificationsTestMini_(profile) {
  mhRequireRole_(profile, ['super_admin','admin','supervisor','finance']);
  const ok = mhNotifyEmployee_(
    profile.chatId,
    '✅ اختبار الإشعارات\n━━━━━━━━━━━━━━━━━━\n' +
    'وصلتك هذه الرسالة من MobiHub، أي أن قناة الإشعارات تعمل.\n' +
    '⏱ ' + mhStamp_(),
    'اختبار إشعار'
  );
  return {
    delivered: ok,
    chatId: String(profile.chatId),
    botConfigured: !!(PropertiesService.getScriptProperties().getProperty('BOT_TOKEN') ||
      PropertiesService.getScriptProperties().getProperty('MOBIHUB_TELEGRAM_BOT_TOKEN')),
    message: ok
      ? 'تم إرسال رسالة اختبار إلى تلجرام.'
      : 'تعذر الإرسال. تأكد أنك بدأت محادثة مع البوت (/start) ثم أعد المحاولة.'
  };
}

/**
 * Manager edit of an existing task: text, type, priority, due date,
 * reassignment to another technician, and status override.
 * Assignment changes notify both the old and the new technician.
 */
function tasksEditMini_(profile, body) {
  mhTaskRequireStaff_(profile);
  const id = String(body.taskId || '').trim();
  if (!id) throw new Error('TASK_NOT_FOUND');

  const sh = mhTaskSheet_();
  mhAssertHeaders_(sh, MH_TASK_HEADERS);
  const map = mhHeaderMap_(sh);
  const found = mhTaskRows_(sh).find(function(r) { return String(r['رقم المهمة'] || '').trim() === id; });
  if (!found) throw new Error('TASK_NOT_FOUND');

  const oldChatId = String(found['Chat ID'] || '').trim();
  const oldName = String(found['اسم الفني'] || '');

  const title = body.title === undefined ? String(found['العنوان'] || '') : String(body.title || '').trim();
  const details = body.details === undefined ? String(found['التفاصيل'] || '') : String(body.details || '').trim();
  const type = body.type === undefined ? String(found['النوع'] || '') : String(body.type || '').trim();
  const priority = body.priority === undefined ? String(found['الأولوية'] || 'عادية') : String(body.priority || '').trim();
  const dueDate = body.dueDate === undefined ? mhDate_(found['تاريخ الاستحقاق']) : (mhIsoDate_(body.dueDate) || '');
  const status = body.status === undefined ? String(found['الحالة'] || 'جديدة') : String(body.status || '').trim();
  const targetChatId = body.employeeId === undefined ? oldChatId : String(body.employeeId || '').trim();

  if (title.length < 3 || title.length > 120) throw new Error('INVALID_TASK_TITLE');
  if (details.length > 1500) throw new Error('INVALID_TASK_DETAILS');
  if (MH_TASK_TYPES.indexOf(type) < 0) throw new Error('INVALID_TASK_TYPE');
  if (MH_TASK_PRIORITIES.indexOf(priority) < 0) throw new Error('INVALID_TASK_PRIORITY');
  if (MH_TASK_STATUSES.indexOf(status) < 0) throw new Error('INVALID_TASK_STATUS');

  // Resolve the assignee (allows moving a task to a different technician).
  let targetName = oldName;
  if (targetChatId !== oldChatId) {
    const emp = rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees).find(function(r) {
      return String(r['Chat ID'] || '').trim() === targetChatId &&
        String(r['الحالة'] || 'نشط').trim() === 'نشط' &&
        String(r['حالة الحساب'] || 'نشط').trim() === 'نشط';
    });
    if (!emp) throw new Error('EMPLOYEE_NOT_FOUND_OR_INACTIVE');
    targetName = String(emp['اسم الموظف'] || '');
  }

  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const set = function(header, value) {
      if (map[header]) sh.getRange(found.__row, map[header]).setValue(value);
    };
    set('العنوان', title);
    set('التفاصيل', details);
    set('النوع', type);
    set('الأولوية', priority);
    set('تاريخ الاستحقاق', dueDate);
    set('الحالة', status);
    if (status === 'مكتملة') set('نسبة الإنجاز', 100);
    if (targetChatId !== oldChatId) {
      set('Chat ID', targetChatId);
      set('اسم الفني', targetName);
      set('نسبة الإنجاز', 0);
      set('رابط الدليل', '');
      set('ملاحظة الفني', '');
      set('الحالة', 'جديدة');
    }
    set('تاريخ آخر تحديث', mhStamp_());
    set('آخر تحديث بواسطة', String(profile.name || profile.chatId));
  } finally { lock.releaseLock(); }

  // Notify the new assignee; tell the previous one when the task moved away.
  if (targetChatId !== oldChatId) {
    mhNotifyEmployee_(targetChatId,
      '📌 أُسندت إليك مهمة\n━━━━━━━━━━━━━━━━━━\n' +
      '📝 ' + title + '\n' +
      '🏷 ' + type + ' · ' + priority + '\n' +
      '📅 الاستحقاق: ' + (dueDate || 'بدون تاريخ') + '\n' +
      '━━━━━━━━━━━━━━━━━━\nافتح التطبيق ← تسكاتي.',
      'إسناد مهمة', 'task.assigned');
    if (oldChatId) {
      mhNotifyEmployee_(oldChatId,
        '↩️ نُقلت المهمة إلى فني آخر\n━━━━━━━━━━━━━━━━━━\n📝 ' + title + '\nلم تعد مطلوبة منك.',
        'إلغاء إسناد', 'task.cancelled');
    }
  }

  return {
    updated: true,
    taskId: id,
    reassigned: targetChatId !== oldChatId,
    employeeId: targetChatId,
    employeeName: targetName,
    status,
    message: targetChatId !== oldChatId
      ? 'تم تحديث المهمة وإسنادها إلى ' + targetName
      : 'تم تحديث المهمة.'
  };
}

/** Technicians eligible for assignment (used by the edit form). */
function tasksAssigneesMini_(profile) {
  mhTaskRequireStaff_(profile);
  return {
    employees: rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees)
      .filter(function(r) {
        return String(r['Chat ID'] || '').trim() &&
          String(r['الحالة'] || 'نشط').trim() === 'نشط' &&
          String(r['حالة الحساب'] || 'نشط').trim() === 'نشط';
      })
      .map(function(r) {
        return { id: String(r['Chat ID']).trim(), name: String(r['اسم الموظف'] || '') };
      })
  };
}

/** Manager deletes one task (or several) after confirmation. */
function tasksDeleteMini_(profile, body) {
  mhRequireRole_(profile, ['super_admin','admin']);
  const ids = (Array.isArray(body.taskIds) ? body.taskIds : [body.taskId])
    .map(function(v) { return String(v || '').trim(); })
    .filter(Boolean);
  if (!ids.length) throw new Error('TASK_NOT_FOUND');

  const sh = mhTaskSheet_();
  mhAssertHeaders_(sh, MH_TASK_HEADERS);
  const rows = mhTaskRows_(sh);
  const targets = rows.filter(function(r) {
    return ids.indexOf(String(r['رقم المهمة'] || '').trim()) >= 0;
  });
  if (!targets.length) throw new Error('TASK_NOT_FOUND');

  const deleted = [];
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    // Delete from the bottom up so earlier row numbers stay valid.
    targets
      .slice()
      .sort(function(a, b) { return b.__row - a.__row; })
      .forEach(function(t) { sh.deleteRow(t.__row); deleted.push(String(t['رقم المهمة'] || '')); });
  } finally { lock.releaseLock(); }

  // Tell the assignee their task was withdrawn (they must not keep working).
  targets.forEach(function(t) {
    const chatId = String(t['Chat ID'] || '').trim();
    if (!chatId) return;
    mhNotifyEmployee_(chatId,
      '🗑 أُلغيت مهمة كانت مسندة إليك\n━━━━━━━━━━━━━━━━━━\n' +
      '📝 ' + String(t['العنوان'] || '') + '\n' +
      'لم تعد مطلوبة منك. راجع قائمة مهامك.',
      'حذف مهمة', 'task.cancelled');
  });

  return { deleted: deleted.length, taskIds: deleted, message: 'تم حذف ' + deleted.length + ' مهمة.' };
}

/* =========================================================
   V1.14 — SPARE PART REQUESTS (طلب قطعة غيار)
   A technician requests a part with a stated purpose, either for
   repairing a customer device or for testing. The request is
   committed to the technician, so the part is bound to them.
========================================================= */
const MH_PART_HEADERS = [
  'رقم الطلب','التاريخ والوقت','Chat ID','اسم الفني','القطعة المطلوبة','الغرض',
  'سبب الاستخدام','جهاز مرتبط','الكمية','الحالة','ملاحظات المدير','تاريخ القرار','قرار بواسطة','تاريخ آخر تحديث'
];
const MH_PART_SHEET_ = 'طلبات قطع الغيار';
const MH_PART_STATUSES = ['بانتظار الموافقة','معتمد','مرفوض','تم الصرف'];
const MH_PART_PURPOSES = ['إصلاح جهاز عميل','تجربة وفحص'];

function mhPartSheet_() {
  const ss = spreadsheet_();
  let sh = ss.getSheetByName(MH_PART_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(MH_PART_SHEET_);
    sh.getRange(1, 1, 1, MH_PART_HEADERS.length).setValues([MH_PART_HEADERS]);
    sh.setFrozenRows(1);
    return sh;
  }
  const width = Math.max(sh.getLastColumn(), 1);
  const existing = sh.getRange(1, 1, 1, width).getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  const missing = MH_PART_HEADERS.filter(function(h) { return existing.indexOf(h) < 0; });
  if (missing.length) sh.getRange(1, width + 1, 1, missing.length).setValues([missing]);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
  return sh;
}

/** Technician submits a part request. */
function partRequestCreateMini_(profile, body) {
  if (profile.role !== 'employee') throw new Error('EMPLOYEE_ONLY');

  const partName = String(body.partName || '').trim();
  const purpose = String(body.purpose || '').trim();
  const reason = String(body.reason || '').trim();
  const deviceRef = String(body.deviceRef || '').trim();
  const quantity = Number(body.quantity || 1);

  if (partName.length < 3 || partName.length > 120) throw new Error('INVALID_PART_NAME');
  if (MH_PART_PURPOSES.indexOf(purpose) < 0) throw new Error('INVALID_PART_PURPOSE');
  if (reason.length < 5 || reason.length > 500) throw new Error('INVALID_PART_REASON');
  if (deviceRef.length > 60) throw new Error('INVALID_PART_DEVICE');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('INVALID_PART_QUANTITY');

  const sh = mhPartSheet_();
  mhAssertHeaders_(sh, MH_PART_HEADERS);

  const id = 'PRT-' + Utilities.formatDate(new Date(), MH.TZ, 'yyyyMMdd') + '-' +
    String(sh.getLastRow()).padStart(3, '0');
  const now = mhStamp_();

  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    sh.appendRow([
      id, now, String(profile.chatId), String(profile.name || ''),
      partName, purpose, reason, deviceRef, quantity,
      'بانتظار الموافقة', '', '', '', now
    ]);
  } finally { lock.releaseLock(); }

  const partMessage =
    '🔧 طلب قطعة غيار جديد\n━━━━━━━━━━━━━━━━━━\n' +
    '🆔 ' + id + '\n' +
    '⚙️ القطعة: ' + partName + ' × ' + quantity + '\n' +
    '🎯 الغرض: ' + purpose + '\n' +
    (deviceRef ? '📱 الجهاز: ' + deviceRef + '\n' : '') +
    '👤 ' + String(profile.name || '') + '\n' +
    '📝 ' + reason.slice(0, 200) + '\n' +
    '━━━━━━━━━━━━━━━━━━\n';

  // Management decides, purchasing follows the stock.
  mhNotifyManagement_(partMessage + 'افتح لوحة الإدارة ← قطع الغيار.', 'طلب قطعة غيار');

  // The purchasing officer owns parts and inventory, so they must know first.
  mhNotifyProcurement_(
    partMessage + 'أنت مسئول المشتريات: راجع التوفر في المخزون ثم اعتمد الصرف.',
    'طلب قطعة غيار');

  // Warn the officer immediately if stock cannot cover the request.
  try {
    const stockItem = mhInventoryRows_().find(function(i) {
      return i.name.trim().toLowerCase() === partName.trim().toLowerCase();
    });
    if (stockItem && stockItem.quantity < quantity) {
      mhNotifyProcurement_(
        '⚠️ المخزون غير كافٍ لطلب قطعة\n━━━━━━━━━━━━━━━━━━\n' +
        '⚙️ ' + partName + '\n' +
        '📦 المتاح: ' + stockItem.quantity + ' · المطلوب: ' + quantity + '\n' +
        '🆔 ' + id + '\n' +
        '━━━━━━━━━━━━━━━━━━\nيلزم توفير القطعة أو رفض الطلب.',
        'نقص مخزون');
    }
  } catch (e) { /* inventory is optional */ }

  return {
    submitted: true,
    requestId: id,
    status: 'بانتظار الموافقة',
    message: 'تم إرسال طلب القطعة للإدارة. لن تُصرف القطعة قبل الموافقة.'
  };
}

/** Technician's own part requests. */
function partRequestsMineMini_(profile) {
  const sh = mhPartSheet_();
  const rows = mhTaskLikePartRows_(sh).filter(function(r) {
    // mhTaskLikePartRows_ maps the owner column to employeeId.
    return String(r.employeeId || '').trim() === String(profile.chatId);
  });
  // Respect "داخل التطبيق" toggles: a muted event stays hidden from the app.
  const allowed = mhNotifyAllowed_(profile.chatId, 'part.decided');
  return { requests: allowed === false || allowed.inApp === false ? [] : rows };
}

/** Manager view of all part requests. */
function partRequestsAllMini_(profile, body) {
  mhRequireRole_(profile, ['super_admin','admin','finance','supervisor']);
  const sh = mhPartSheet_();
  const status = String(body.status || '').trim();
  let rows = mhTaskLikePartRows_(sh);
  if (status) rows = rows.filter(function(r) { return r.status === status; });

  const summary = {
    pending: rows.filter(function(r) { return r.status === 'بانتظار الموافقة'; }).length,
    approved: rows.filter(function(r) { return r.status === 'معتمد'; }).length,
    rejected: rows.filter(function(r) { return r.status === 'مرفوض'; }).length
  };
  return { requests: rows, summary: summary, statuses: MH_PART_STATUSES, purposes: MH_PART_PURPOSES };
}

function mhTaskLikePartRows_(sh) {
  return mhRowsObjects_(sh).map(function(r) {
    return {
      id: String(r['رقم الطلب'] || ''),
      createdAt: String(r['التاريخ والوقت'] || ''),
      employeeId: String(r['Chat ID'] || ''),
      employeeName: String(r['اسم الفني'] || ''),
      partName: String(r['القطعة المطلوبة'] || ''),
      purpose: String(r['الغرض'] || ''),
      reason: String(r['سبب الاستخدام'] || ''),
      deviceRef: String(r['جهاز مرتبط'] || ''),
      quantity: Number(r['الكمية'] || 1),
      status: String(r['الحالة'] || 'بانتظار الموافقة'),
      managerNote: String(r['ملاحظات المدير'] || ''),
      decidedAt: String(r['تاريخ القرار'] || ''),
      decidedBy: String(r['قرار بواسطة'] || '')
    };
  }).sort(function(a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
}

/** Manager approves / rejects / marks a part as handed over. */
function partRequestDecideMini_(profile, body) {
  // Purchasing officers approve and issue parts for their own stock.
  mhRequireRole_(profile, ['super_admin','admin','finance','procurement']);
  const id = String(body.requestId || '').trim();
  const decision = String(body.decision || '').trim();
  if (['معتمد','مرفوض','تم الصرف'].indexOf(decision) < 0) throw new Error('INVALID_DECISION');

  const sh = mhPartSheet_();
  mhAssertHeaders_(sh, MH_PART_HEADERS);
  const map = mhHeaderMap_(sh);
  const found = mhRowsObjects_(sh).find(function(r) { return String(r['رقم الطلب'] || '').trim() === id; });
  if (!found) throw new Error('PART_REQUEST_NOT_FOUND');

  const current = String(found['الحالة'] || '').trim();
  if (decision === 'تم الصرف' && current !== 'معتمد') throw new Error('PART_NOT_APPROVED');
  if (decision !== 'تم الصرف' && current !== 'بانتظار الموافقة') throw new Error('PART_ALREADY_REVIEWED');

  const note = String(body.note || '').trim();
  if (note.length > 500) throw new Error('INVALID_PART_REASON');

  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    sh.getRange(found.__row, map['الحالة']).setValue(decision);
    sh.getRange(found.__row, map['ملاحظات المدير']).setValue(note);
    sh.getRange(found.__row, map['تاريخ القرار']).setValue(mhStamp_());
    sh.getRange(found.__row, map['قرار بواسطة']).setValue(String(profile.name || profile.chatId));
    sh.getRange(found.__row, map['تاريخ آخر تحديث']).setValue(mhStamp_());
  } finally { lock.releaseLock(); }

  const label = decision === 'معتمد' ? '✅ تمت الموافقة على طلب القطعة'
    : decision === 'تم الصرف' ? '📦 تم صرف القطعة المطلوبة'
    : '❌ تم رفض طلب القطعة';

  // Issuing a part moves stock. Keep the inventory honest automatically.
  if (decision === 'تم الصرف') {
    const adjustment = mhAdjustStock_(
      String(found['القطعة المطلوبة'] || ''),
      -Number(found['الكمية'] || 1),
      String(profile.name || profile.chatId)
    );
    if (adjustment) {
      found.__stock = adjustment;
      if (adjustment.low) {
        mhNotifyProcurement_(
          '📉 المخزون وصل للحد الأدنى\n━━━━━━━━━━━━━━━━━━\n' +
          '⚙️ ' + adjustment.name + '\n' +
          '📦 المتاح الآن: ' + adjustment.current + ' · الحد الأدنى: ' + adjustment.minimum + '\n' +
          '━━━━━━━━━━━━━━━━━━\nأعد التوريد قبل نفاد القطعة.',
          'نقص مخزون');
      }
    }
  }

  mhNotifyEmployee_(String(found['Chat ID'] || '').trim(),
    label + '\n━━━━━━━━━━━━━━━━━━\n' +
    '⚙️ ' + String(found['القطعة المطلوبة'] || '') + ' × ' + String(found['الكمية'] || 1) + '\n' +
    '🎯 ' + String(found['الغرض'] || '') + '\n' +
    (note ? '📝 ملاحظة المدير: ' + note + '\n' : '') +
    '━━━━━━━━━━━━━━━━━━\nافتح التطبيق ← طلب قطعة غيار.',
    'قرار قطعة غيار', 'part.decided');

  return { updated: true, requestId: id, status: decision };
}

/* =========================================================
   V1.15 — PER-EMPLOYEE NOTIFICATION CONTROL
   Super Admin controls, for every technician and every event:
     - inApp : whether the event appears in the Mini App
     - bot   : whether a Telegram message is sent
   Rules are stored in «إعدادات إشعارات الفنيين» keyed by
   chatId + event. Absence of a row means "allowed" so the
   system keeps working without configuration.
========================================================= */
const MH_NOTIFY_MATRIX_HEADERS = ['Chat ID','اسم الفني','نوع الإشعار','داخل التطبيق','على البوت','آخر تحديث','بواسطة'];
const MH_NOTIFY_MATRIX_SHEET_ = 'إعدادات إشعارات الفنيين';

/** Every event type that can reach a technician. */
const MH_EMPLOYEE_EVENTS_ = [
  { key: 'task.assigned', label: 'إسناد مهمة جديدة', group: 'المهام' },
  { key: 'task.reviewed', label: 'نتيجة مراجعة المهمة', group: 'المهام' },
  { key: 'task.cancelled', label: 'إلغاء مهمة', group: 'المهام' },
  { key: 'leave.decided', label: 'قرار طلب الإذن', group: 'الأذونات' },
  { key: 'cash.decided', label: 'قرار السلفة أو الصرف', group: 'المالية' },
  { key: 'cash.settlement', label: 'قرار تسوية العهدة', group: 'المالية' },
  { key: 'deduction.decided', label: 'خصم معتمد أو مرفوض', group: 'المالية' },
  { key: 'part.decided', label: 'قرار طلب قطعة غيار', group: 'قطع الغيار' },
  { key: 'complaint.reply', label: 'رد الإدارة على شكوى', group: 'الشكاوى' },
  { key: 'device.assigned', label: 'إسناد جهاز', group: 'الأجهزة' },
  { key: 'attendance.reminder', label: 'تنبيه الحضور والانصراف', group: 'الدوام' }
];

function mhNotifyMatrixSheet_() {
  const ss = spreadsheet_();
  let sh = ss.getSheetByName(MH_NOTIFY_MATRIX_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(MH_NOTIFY_MATRIX_SHEET_);
    sh.getRange(1, 1, 1, MH_NOTIFY_MATRIX_HEADERS.length).setValues([MH_NOTIFY_MATRIX_HEADERS]);
    sh.setFrozenRows(1);
    return sh;
  }
  const width = Math.max(sh.getLastColumn(), 1);
  const existing = sh.getRange(1, 1, 1, width).getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  const missing = MH_NOTIFY_MATRIX_HEADERS.filter(function(h) { return existing.indexOf(h) < 0; });
  if (missing.length) sh.getRange(1, width + 1, 1, missing.length).setValues([missing]);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
  return sh;
}

/**
 * Reads the full matrix as { chatId: { eventKey: {inApp, bot} } }.
 * Missing pairs default to allowed.
 */
function mhNotifyRules_() {
  const rules = {};
  let rows = [];
  try { rows = mhRowsObjects_(mhNotifyMatrixSheet_()); } catch (e) { return rules; }
  rows.forEach(function(r) {
    const chatId = String(r['Chat ID'] || '').trim();
    const event = String(r['نوع الإشعار'] || '').trim();
    if (!chatId || !event) return;
    if (!rules[chatId]) rules[chatId] = {};
    rules[chatId][event] = {
      inApp: String(r['داخل التطبيق'] || 'TRUE').toUpperCase() !== 'FALSE',
      bot: String(r['على البوت'] || 'TRUE').toUpperCase() !== 'FALSE'
    };
  });
  return rules;
}

function mhNotifyAllowed_(chatId, event) {
  const rules = mhNotifyRules_();
  const forUser = rules[String(chatId || '').trim()];
  const rule = forUser && forUser[event];
  if (!rule) return true; // unconfigured = allowed
  return { inApp: rule.inApp, bot: rule.bot };
}

/** Super Admin reads the matrix for every technician. */
function notifyMatrixGetMini_(profile) {
  mhRequireRole_(profile, ['super_admin','admin']);
  const employees = rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees)
    .filter(function(r) {
      return String(r['Chat ID'] || '').trim() &&
        String(r['الحالة'] || 'نشط').trim() === 'نشط' &&
        String(r['حالة الحساب'] || 'نشط').trim() === 'نشط';
    })
    .map(function(r) {
      return {
        id: String(r['Chat ID']).trim(),
        name: String(r['اسم الموظف'] || ''),
        job: String(r['الوظيفة'] || '')
      };
    });

  const rules = mhNotifyRules_();
  const matrix = employees.map(function(e) {
    const settings = {};
    MH_EMPLOYEE_EVENTS_.forEach(function(ev) {
      const rule = (rules[e.id] || {})[ev.key];
      settings[ev.key] = rule ? { inApp: rule.inApp, bot: rule.bot } : { inApp: true, bot: true };
    });
    return { employeeId: e.id, name: e.name, job: e.job, settings: settings };
  });

  return { employees: matrix, events: MH_EMPLOYEE_EVENTS_ };
}

/** Super Admin toggles one switch for one technician. */
function notifyMatrixSetMini_(profile, body) {
  mhRequireRole_(profile, ['super_admin','admin']);
  const chatId = String(body.employeeId || '').trim();
  const event = String(body.event || '').trim();
  const channel = String(body.channel || '').trim(); // 'inApp' | 'bot'
  const enabled = body.enabled === true;

  if (!/^\d{5,20}$/.test(chatId)) throw new Error('INVALID_EMPLOYEE');
  const known = MH_EMPLOYEE_EVENTS_.some(function(e) { return e.key === event; });
  if (!known) throw new Error('INVALID_NOTIFICATION_EVENT');
  if (['inApp','bot'].indexOf(channel) < 0) throw new Error('INVALID_NOTIFICATION_CHANNEL');

  const emp = rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees).find(function(r) {
    return String(r['Chat ID'] || '').trim() === chatId;
  });
  const name = emp ? String(emp['اسم الموظف'] || '') : '';

  const sh = mhNotifyMatrixSheet_();
  mhAssertHeaders_(sh, MH_NOTIFY_MATRIX_HEADERS);
  const map = mhHeaderMap_(sh);
  const found = mhRowsObjects_(sh).find(function(r) {
    return String(r['Chat ID'] || '').trim() === chatId &&
      String(r['نوع الإشعار'] || '').trim() === event;
  });

  const locks = LockService.getScriptLock(); locks.waitLock(15000);
  try {
    if (!found) {
      sh.appendRow([chatId, name, event, 'TRUE', 'TRUE', mhStamp_(), String(profile.name || '')]);
    }
    const row = found ? found.__row : sh.getLastRow();
    sh.getRange(row, map['Chat ID']).setValue(chatId);
    if (map['اسم الفني']) sh.getRange(row, map['اسم الفني']).setValue(name);
    sh.getRange(row, map['نوع الإشعار']).setValue(event);
    sh.getRange(row, map[channel === 'inApp' ? 'داخل التطبيق' : 'على البوت']).setValue(enabled ? 'TRUE' : 'FALSE');
    sh.getRange(row, map['آخر تحديث']).setValue(mhStamp_());
    sh.getRange(row, map['بواسطة']).setValue(String(profile.name || profile.chatId));
  } finally { locks.releaseLock(); }

  return { updated: true, employeeId: chatId, event: event, channel: channel, enabled: enabled };
}

/** Convenience: enable or mute everything for one technician. */
function notifyMatrixBulkMini_(profile, body) {
  mhRequireRole_(profile, ['super_admin','admin']);
  const chatId = String(body.employeeId || '').trim();
  const enabled = body.enabled === true;
  if (!/^\d{5,20}$/.test(chatId)) throw new Error('INVALID_EMPLOYEE');

  const emp = rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees).find(function(r) {
    return String(r['Chat ID'] || '').trim() === chatId;
  });
  const name = emp ? String(emp['اسم الموظف'] || '') : '';

  const sh = mhNotifyMatrixSheet_();
  mhAssertHeaders_(sh, MH_NOTIFY_MATRIX_HEADERS);
  const map = mhHeaderMap_(sh);
  const rows = mhRowsObjects_(sh).filter(function(r) {
    return String(r['Chat ID'] || '').trim() === chatId;
  });
  const byEvent = {};
  rows.forEach(function(r) { byEvent[String(r['نوع الإشعار'] || '').trim()] = r.__row; });

  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    MH_EMPLOYEE_EVENTS_.forEach(function(ev) {
      let row = byEvent[ev.key];
      if (!row) {
        sh.appendRow([chatId, name, ev.key, 'TRUE', 'TRUE', mhStamp_(), String(profile.name || '')]);
        row = sh.getLastRow();
      }
      sh.getRange(row, map['داخل التطبيق']).setValue(enabled ? 'TRUE' : 'FALSE');
      sh.getRange(row, map['على البوت']).setValue(enabled ? 'TRUE' : 'FALSE');
      sh.getRange(row, map['آخر تحديث']).setValue(mhStamp_());
      sh.getRange(row, map['بواسطة']).setValue(String(profile.name || profile.chatId));
    });
  } finally { lock.releaseLock(); }

  return { updated: true, employeeId: chatId, events: MH_EMPLOYEE_EVENTS_.length, enabled: enabled };
}

/* =========================================================
   V1.16 — CUSTOMERS + FULL DEVICE INTAKE
   The intake card now captures the customer, the device, its
   condition and the accessories received, exactly like the
   paper/desktop form. Customers can be looked up by phone so
   repeat visits do not retype data.
========================================================= */
const MH_CUSTOMER_HEADERS = ['رقم العميل','اسم العميل','رقم الهاتف','رقم الهاتف 2','العنوان','ملاحظات','تاريخ الإضافة','آخر زيارة','عدد الزيارات'];
const MH_CUSTOMER_SHEET_ = 'العملاء';

const MH_DEVICE_EXTRA_HEADERS = [
  'رقم العميل','اسم العميل','رقم الهاتف','الماركة','عائلة الجهاز','رقم IMEI','الرقم السري',
  'الإكسسوارات','يفتح ويعمل','التكلفة التقديرية','العربون المدفوع','موعد التسليم','اسم المستلم'
];

function mhCustomerSheet_() {
  const ss = spreadsheet_();
  let sh = ss.getSheetByName(MH_CUSTOMER_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(MH_CUSTOMER_SHEET_);
    sh.getRange(1, 1, 1, MH_CUSTOMER_HEADERS.length).setValues([MH_CUSTOMER_HEADERS]);
    sh.setFrozenRows(1);
    return sh;
  }
  const width = Math.max(sh.getLastColumn(), 1);
  const existing = sh.getRange(1, 1, 1, width).getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  const missing = MH_CUSTOMER_HEADERS.filter(function(h) { return existing.indexOf(h) < 0; });
  if (missing.length) sh.getRange(1, width + 1, 1, missing.length).setValues([missing]);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
  return sh;
}

/** Adds the intake columns to the devices sheet without disturbing data. */
function mhEnsureDeviceExtraColumns_() {
  const ss = spreadsheet_();
  const sh = ss.getSheetByName(MH.SHEETS.devices);
  if (!sh) return null;
  const width = Math.max(sh.getLastColumn(), 1);
  const existing = sh.getRange(1, 1, 1, width).getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  const missing = MH_DEVICE_EXTRA_HEADERS.filter(function(h) { return existing.indexOf(h) < 0; });
  if (missing.length) sh.getRange(1, width + 1, 1, missing.length).setValues([missing]);
  return sh;
}

/** First number in a value, tolerating "700/1300" and Arabic digits. */
function mhFirstNumber_(value) {
  const text = String(value === null || value === undefined ? '' : value)
    .replace(/[٠-٩]/g, function(d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
    .replace(/[٬,]/g, '');
  const match = text.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function mhNormalizePhone_(value) {
  let digits = String(value || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (digits.indexOf('0020') === 0) digits = digits.slice(4);
  if (digits.indexOf('20') === 0 && digits.length === 12) digits = '0' + digits.slice(2);
  return digits;
}

function mhCustomerRow_(r) {
  return {
    id: String(r['رقم العميل'] || ''),
    name: String(r['اسم العميل'] || ''),
    phone: String(r['رقم الهاتف'] || ''),
    phone2: String(r['رقم الهاتف 2'] || ''),
    address: String(r['العنوان'] || ''),
    visits: Number(r['عدد الزيارات'] || 0)
  };
}

/** Search customers by name or phone (used by the intake form). */
function customersSearchMini_(profile, body) {
  if (['employee','supervisor','admin','finance','super_admin'].indexOf(profile.role) < 0) throw new Error('FORBIDDEN');
  const query = String(body.query || '').trim();
  if (query.length < 2) return { customers: [], total: 0 };

  const needle = mhNormalizePhone_(query) || query.toLowerCase();
  const rows = mhRowsObjects_(mhCustomerSheet_());
  const hits = rows.map(mhCustomerRow_).filter(function(c) {
    const name = c.name.toLowerCase();
    const phone = mhNormalizePhone_(c.phone);
    const phone2 = mhNormalizePhone_(c.phone2);
    return name.indexOf(query.toLowerCase()) >= 0 ||
      (needle && phone.indexOf(needle) >= 0) ||
      (needle && phone2.indexOf(needle) >= 0);
  });
  return { customers: hits.slice(0, 20), total: hits.length };
}

/** Creates or updates a customer and returns the stored record. */
function mhUpsertCustomer_(data) {
  const sh = mhCustomerSheet_();
  mhAssertHeaders_(sh, MH_CUSTOMER_HEADERS);
  const map = mhHeaderMap_(sh);
  const phone = mhNormalizePhone_(data.phone);
  const rows = mhRowsObjects_(sh);
  const existing = phone ? rows.find(function(r) { return mhNormalizePhone_(r['رقم الهاتف']) === phone; }) : null;

  if (existing) {
    if (data.name && map['اسم العميل']) sh.getRange(existing.__row, map['اسم العميل']).setValue(data.name);
    if (data.address && map['العنوان']) sh.getRange(existing.__row, map['العنوان']).setValue(data.address);
    if (data.phone2 && map['رقم الهاتف 2']) sh.getRange(existing.__row, map['رقم الهاتف 2']).setValue(data.phone2);
    if (map['آخر زيارة']) sh.getRange(existing.__row, map['آخر زيارة']).setValue(mhStamp_());
    if (map['عدد الزيارات']) sh.getRange(existing.__row, map['عدد الزيارات']).setValue(Number(existing['عدد الزيارات'] || 0) + 1);
    return mhCustomerRow_(existing);
  }

  const id = 'CUS-' + Utilities.formatDate(new Date(), MH.TZ, 'yyyyMMdd') + '-' + String(rows.length + 1).padStart(4, '0');
  const now = mhStamp_();
  sh.appendRow([id, data.name || '', phone, mhNormalizePhone_(data.phone2 || ''), data.address || '', data.notes || '', now, now, 1]);
  return { id: id, name: data.name || '', phone: phone, phone2: mhNormalizePhone_(data.phone2 || ''), address: data.address || '', visits: 1 };
}

/**
 * Full device intake: customer + device + condition + accessories.
 * Replaces the order-number-only registration.
 */
function deviceIntakeCreateMini_(profile, body) {
  if (!deviceIntakeAllowed_(profile)) throw new Error('FORBIDDEN');

  const customer = {
    name: String(body.customerName || '').trim(),
    phone: String(body.customerPhone || '').trim(),
    phone2: String(body.customerPhone2 || '').trim(),
    address: String(body.customerAddress || '').trim()
  };
  const device = {
    brand: String(body.brand || '').trim(),
    family: String(body.family || '').trim().toLowerCase(),
    model: String(body.model || '').trim(),
    imei: String(body.imei || '').trim(),
    pin: String(body.pin || '').trim(),
    problem: String(body.problem || '').trim(),
    accessories: Array.isArray(body.accessories) ? body.accessories.map(String) : [],
    powersOn: String(body.powersOn || '').trim(),
    // Prices may arrive as "700/1300" or "٤٢٠٠". Take the first number and
    // clamp so a range can never trip the amount limits.
    estimate: mhFirstNumber_(body.estimate),
    deposit: mhFirstNumber_(body.deposit),
    dueDate: mhIsoDate_(body.dueDate) || '',
    technicianId: String(body.technicianId || '').trim()
  };

  if (customer.name.length < 2 || customer.name.length > 80) throw new Error('INVALID_CUSTOMER_NAME');
  if (mhNormalizePhone_(customer.phone).length < 7) throw new Error('INVALID_CUSTOMER_PHONE');
  if (!device.brand) throw new Error('INVALID_DEVICE_BRAND');
  if (device.family && !MH_DEVICE_FAMILIES_.some(function(f) { return f.key === device.family; })) {
    throw new Error('INVALID_DEVICE_FAMILY');
  }
  // The intake form appends inspection results and notes to the description,
  // so allow a longer field while still rejecting an empty one.
  if (device.problem.length < 3) throw new Error('INVALID_DEVICE_PROBLEM');
  if (device.problem.length > 4000) device.problem = device.problem.slice(0, 4000);
  if (device.pin.length > 40 || device.imei.length > 40) throw new Error('INVALID_DEVICE_IDENTITY');
  if (!Number.isFinite(device.estimate) || device.estimate < 0 || device.estimate > 1000000) throw new Error('INVALID_ESTIMATE');
  if (!Number.isFinite(device.deposit) || device.deposit < 0 || device.deposit > 1000000) throw new Error('INVALID_DEPOSIT');
  if (['يعمل','لا يعمل'].indexOf(device.powersOn) < 0) throw new Error('INVALID_POWER_STATE');

  const ss = spreadsheet_();
  const employees = rowsAsObjects_(ss, MH.SHEETS.employees);
  const technician = employees.find(function(r) {
    return String(r['Chat ID'] || '').trim() === device.technicianId && mhEmployeeIsActive_(r) &&
      !mhIsIntakeJob_(mhEmployeeJob_(r));
  });
  if (!technician) throw new Error('INVALID_DEVICE_TECHNICIAN');

  const sh = mhEnsureDeviceExtraColumns_();
  if (!sh) throw new Error('DEVICE_SHEETS_MISSING');
  const movement = ss.getSheetByName('سجل حركة الأجهزة');
  mhAssertHeaders_(sh, MH_DEVICE.DEVICE_HEADERS);
  // The movement log is an audit trail: missing or legacy headers must not
  // block a customer's intake. Create/repair it instead of throwing.
  const movementSheet = movement || ss.insertSheet('سجل حركة الأجهزة');
  if (movementSheet.getLastRow() === 0) {
    movementSheet.getRange(1, 1, 1, MH_DEVICE.MOVEMENT_HEADERS.length).setValues([MH_DEVICE.MOVEMENT_HEADERS]);
    movementSheet.setFrozenRows(1);
  }

  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let orderId = '';
  let savedCustomer = null;
  try {
    savedCustomer = mhUpsertCustomer_(customer);

    const today = Utilities.formatDate(new Date(), MH.TZ, 'yyyyMMdd');
    const seq = String(sh.getLastRow()).padStart(4, '0');
    orderId = 'MH-' + today + '-' + seq;

    const now = mhStamp_();
    const intakeName = String(profile.name || '');

    // Write by header name so a legacy column order cannot corrupt the row.
    const headerRow = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0]
      .map(function(h) { return String(h).trim(); });
    const idx = {};
    headerRow.forEach(function(h, i) { if (h) idx[h] = i; });
    const row = new Array(headerRow.length).fill('');
    const set = function(header, value) { if (idx[header] !== undefined) row[idx[header]] = value; };

    set('رقم الطلب', orderId);
    set('تاريخ الاستلام', now);
    set('اسم الجهاز', device.brand + (device.model ? ' ' + device.model : ''));
    set('اسم العميل', customer.name);
    set('المشكلة المسجلة', device.problem);
    set('مسؤول الاستلام Chat ID', String(profile.chatId));
    set('مسؤول الاستلام', intakeName);
    set('الموظف المسؤول Chat ID', device.technicianId);
    set('الموظف المسؤول', String(technician['اسم الموظف'] || ''));
    set('القسم', String(technician['الوظيفة'] || ''));
    set('حالة الجهاز', 'تم الاستلام');
    set('مكان الجهاز', 'قسم الاستلام');
    set('آخر تحديث', now);
    set('رقم العميل', savedCustomer.id);
    set('اسم العميل', customer.name);
    set('رقم الهاتف', mhNormalizePhone_(customer.phone));
    set('الماركة', device.brand);
    set('عائلة الجهاز', device.family);
    set('رقم IMEI', device.imei);
    set('الرقم السري', device.pin);
    set('الإكسسوارات', device.accessories.join('، '));
    set('يفتح ويعمل', device.powersOn);
    set('التكلفة التقديرية', device.estimate);
    set('العربون المدفوع', device.deposit);
    set('موعد التسليم', device.dueDate);
    set('اسم المستلم', intakeName);

    sh.appendRow(row);
    movementSheet.appendRow([
      now, orderId, 'استلام وإسناد الجهاز', '', '', device.technicianId,
      String(technician['اسم الموظف'] || ''), 'تم الاستلام', 'قسم الاستلام',
      'إكسسوارات: ' + (device.accessories.join('، ') || 'لا يوجد') + ' · يفتح: ' + device.powersOn,
      String(profile.chatId), intakeName
    ]);
  } finally { lock.releaseLock(); }

  // Notify the assigned technician with the essentials.
  mhNotifyEmployee_(device.technicianId,
    '📱 جهاز جديد أُسند إليك\n━━━━━━━━━━━━━━━━━━\n' +
    '🆔 ' + orderId + '\n' +
    '📱 ' + device.brand + (device.model ? ' ' + device.model : '') + '\n' +
    '👤 ' + customer.name + '\n' +
    '🔧 ' + device.problem.slice(0, 160) + '\n' +
    (device.dueDate ? '📅 التسليم: ' + device.dueDate + '\n' : '') +
    '━━━━━━━━━━━━━━━━━━\nافتح التطبيق ← حالة الجهاز.',
    'إسناد جهاز', 'device.assigned');

  return {
    registered: true,
    orderId: orderId,
    customerId: savedCustomer.id,
    customerName: customer.name,
    technicianName: String(technician['اسم الموظف'] || ''),
    message: 'تم تسجيل الجهاز برقم الطلب ' + orderId
  };
}

/** Device registration form metadata: brands + technicians. */
function deviceIntakeOptionsMini_(profile) {
  if (!deviceIntakeAllowed_(profile)) {
    return { allowed: false, technicians: [], brands: [], message: 'تسجيل الأجهزة متاح لمسؤول الاستلام أو الإدارة فقط.' };
  }
  const ss = spreadsheet_();
  const employees = rowsAsObjects_(ss, MH.SHEETS.employees);
  const technicians = employees.filter(function(r) {
    const job = mhEmployeeJob_(r);
    return String(r['Chat ID'] || '').trim() && mhEmployeeIsActive_(r) &&
      !mhIsIntakeJob_(job) && !/مدير|مشرف|إدارة|manager|supervisor/i.test(job);
  }).map(function(r) {
    return { id: String(r['Chat ID']).trim(), name: String(r['اسم الموظف'] || ''), job: mhEmployeeJob_(r) };
  });

  // Brands come from the price book, which already lists every model family.
  let brands = [];
  try {
    const book = repairPriceBookMini_();
    const seen = {};
    MH_REPAIR_PRICE_CATEGORIES_.forEach(function(cfg) {
      repairPriceCategoryDataMini_(book, cfg).models.forEach(function(m) {
        const brand = String(m.name).split(' ')[0];
        if (brand && !seen[brand]) { seen[brand] = true; brands.push(brand); }
      });
    });
  } catch (e) { /* price book optional */ }

  if (!brands.length) brands = ['Apple', 'Samsung', 'Huawei', 'Xiaomi', 'Oppo', 'Realme', 'Other'];

  return { allowed: true, technicians: technicians, brands: brands, message: '' };
}

/* =========================================================
   V1.16 — PER-EMPLOYEE UI VISIBILITY
   Super Admin chooses which home tiles each technician sees.
   Stored in «إعدادات أزرار الفنيين»: chatId + buttonKey = TRUE/FALSE.
   Missing row means visible, so the app works before configuration.
========================================================= */
const MH_UI_BUTTON_HEADERS = ['Chat ID','اسم الفني','الزر','ظاهر','آخر تحديث','بواسطة'];
const MH_UI_BUTTON_SHEET_ = 'إعدادات أزرار الفنيين';

/** Every home tile that can be shown or hidden per technician. */
const MH_HOME_BUTTONS_ = [
  { key: 'attendance', label: 'تسجيل حضور', group: 'الدوام' },
  { key: 'checkout', label: 'تسجيل انصراف', group: 'الدوام' },
  { key: 'my-shifts', label: 'ورديتي', group: 'الدوام' },
  { key: 'history', label: 'سجل الحضور', group: 'الدوام' },
  { key: 'inspection', label: 'فحص الجهاز', group: 'الصيانة' },
  { key: 'repair-prices', label: 'أسعار الإصلاح', group: 'الصيانة' },
  { key: 'devices', label: 'حالة الجهاز', group: 'الصيانة' },
  { key: 'device-register', label: 'تسجيل جهاز', group: 'الصيانة' },
  { key: 'part-request', label: 'طلب قطعة غيار', group: 'الصيانة' },
  { key: 'leave', label: 'طلب إذن', group: 'الطلبات' },
  { key: 'cash', label: 'طلب سلفة', group: 'الطلبات' },
  { key: 'withdraw', label: 'طلب سحب مبلغ', group: 'الطلبات' },
  { key: 'settlement', label: 'تسوية عهدة', group: 'الطلبات' },
  { key: 'requests', label: 'طلباتي', group: 'الأداء' },
  { key: 'rewards', label: 'مكافآتي', group: 'الأداء' },
  { key: 'deductions', label: 'خصوماتي', group: 'الأداء' },
  { key: 'monthly', label: 'ملخص الشهر', group: 'الأداء' },
  { key: 'tasks', label: 'تسكاتي', group: 'الأداء' },
  { key: 'complaint-new', label: 'تقديم شكوى', group: 'التواصل' },
  { key: 'complaint-list', label: 'شكاويي', group: 'التواصل' }
];

function mhUiButtonSheet_() {
  const ss = spreadsheet_();
  let sh = ss.getSheetByName(MH_UI_BUTTON_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(MH_UI_BUTTON_SHEET_);
    sh.getRange(1, 1, 1, MH_UI_BUTTON_HEADERS.length).setValues([MH_UI_BUTTON_HEADERS]);
    sh.setFrozenRows(1);
    return sh;
  }
  const width = Math.max(sh.getLastColumn(), 1);
  const existing = sh.getRange(1, 1, 1, width).getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  const missing = MH_UI_BUTTON_HEADERS.filter(function(h) { return existing.indexOf(h) < 0; });
  if (missing.length) sh.getRange(1, width + 1, 1, missing.length).setValues([missing]);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
  return sh;
}

/** { chatId: { buttonKey: visible } } */
function mhUiRules_() {
  const rules = {};
  let rows = [];
  try { rows = mhRowsObjects_(mhUiButtonSheet_()); } catch (e) { return rules; }
  rows.forEach(function(r) {
    const chatId = String(r['Chat ID'] || '').trim();
    const key = String(r['الزر'] || '').trim();
    if (!chatId || !key) return;
    if (!rules[chatId]) rules[chatId] = {};
    rules[chatId][key] = String(r['ظاهر'] || 'TRUE').toUpperCase() !== 'FALSE';
  });
  return rules;
}

/** Hidden button keys for one technician. */
function mhHiddenButtons_(chatId) {
  const forUser = mhUiRules_()[String(chatId || '').trim()] || {};
  return Object.keys(forUser).filter(function(k) { return forUser[k] === false; });
}

/** Returned inside bootstrap so the app can hide tiles instantly. */
function mhVisibleButtons_(profile) {
  if (profile.role !== 'employee') {
    return MH_HOME_BUTTONS_.map(function(b) { return b.key; });
  }
  const hidden = mhHiddenButtons_(profile.chatId);
  return MH_HOME_BUTTONS_
    .map(function(b) { return b.key; })
    .filter(function(k) { return hidden.indexOf(k) < 0; });
}

/** Super Admin reads the visibility matrix. */
function buttonsMatrixGetMini_(profile) {
  mhRequireRole_(profile, ['super_admin','admin']);
  const employees = rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees)
    .filter(function(r) {
      return String(r['Chat ID'] || '').trim() &&
        String(r['الحالة'] || 'نشط').trim() === 'نشط' &&
        String(r['حالة الحساب'] || 'نشط').trim() === 'نشط';
    })
    .map(function(r) {
      return {
        id: String(r['Chat ID']).trim(),
        name: String(r['اسم الموظف'] || ''),
        job: String(r['الوظيفة'] || '')
      };
    });

  const rules = mhUiRules_();
  return {
    employees: employees.map(function(e) {
      const visible = {};
      MH_HOME_BUTTONS_.forEach(function(b) {
        const v = (rules[e.id] || {})[b.key];
        visible[b.key] = v === undefined ? true : v;
      });
      return { employeeId: e.id, name: e.name, job: e.job, visible: visible };
    }),
    buttons: MH_HOME_BUTTONS_
  };
}

/** Super Admin toggles one button for one technician. */
function buttonsMatrixSetMini_(profile, body) {
  mhRequireRole_(profile, ['super_admin','admin']);
  const chatId = String(body.employeeId || '').trim();
  const key = String(body.button || '').trim();
  const visible = body.visible === true;
  if (!/^\d{5,20}$/.test(chatId)) throw new Error('INVALID_EMPLOYEE');
  if (!MH_HOME_BUTTONS_.some(function(b) { return b.key === key; })) throw new Error('INVALID_BUTTON');

  const emp = rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees).find(function(r) {
    return String(r['Chat ID'] || '').trim() === chatId;
  });
  const name = emp ? String(emp['اسم الموظف'] || '') : '';

  const sh = mhUiButtonSheet_();
  mhAssertHeaders_(sh, MH_UI_BUTTON_HEADERS);
  const map = mhHeaderMap_(sh);
  const found = mhRowsObjects_(sh).find(function(r) {
    return String(r['Chat ID'] || '').trim() === chatId && String(r['الزر'] || '').trim() === key;
  });

  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (!found) sh.appendRow([chatId, name, key, 'TRUE', mhStamp_(), String(profile.name || '')]);
    const row = found ? found.__row : sh.getLastRow();
    sh.getRange(row, map['Chat ID']).setValue(chatId);
    if (map['اسم الفني']) sh.getRange(row, map['اسم الفني']).setValue(name);
    sh.getRange(row, map['الزر']).setValue(key);
    sh.getRange(row, map['ظاهر']).setValue(visible ? 'TRUE' : 'FALSE');
    sh.getRange(row, map['آخر تحديث']).setValue(mhStamp_());
    sh.getRange(row, map['بواسطة']).setValue(String(profile.name || profile.chatId));
  } finally { lock.releaseLock(); }

  return { updated: true, employeeId: chatId, button: key, visible: visible };
}

/** Show or hide every tile for one technician. */
function buttonsMatrixBulkMini_(profile, body) {
  mhRequireRole_(profile, ['super_admin','admin']);
  const chatId = String(body.employeeId || '').trim();
  const visible = body.visible === true;
  if (!/^\d{5,20}$/.test(chatId)) throw new Error('INVALID_EMPLOYEE');

  const emp = rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees).find(function(r) {
    return String(r['Chat ID'] || '').trim() === chatId;
  });
  const name = emp ? String(emp['اسم الموظف'] || '') : '';

  const sh = mhUiButtonSheet_();
  mhAssertHeaders_(sh, MH_UI_BUTTON_HEADERS);
  const map = mhHeaderMap_(sh);
  const rows = mhRowsObjects_(sh).filter(function(r) {
    return String(r['Chat ID'] || '').trim() === chatId;
  });
  const byKey = {};
  rows.forEach(function(r) { byKey[String(r['الزر'] || '').trim()] = r.__row; });

  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    MH_HOME_BUTTONS_.forEach(function(b) {
      let row = byKey[b.key];
      if (!row) {
        sh.appendRow([chatId, name, b.key, 'TRUE', mhStamp_(), String(profile.name || '')]);
        row = sh.getLastRow();
      }
      sh.getRange(row, map['ظاهر']).setValue(visible ? 'TRUE' : 'FALSE');
      sh.getRange(row, map['آخر تحديث']).setValue(mhStamp_());
      sh.getRange(row, map['بواسطة']).setValue(String(profile.name || profile.chatId));
    });
  } finally { lock.releaseLock(); }

  return { updated: true, employeeId: chatId, buttons: MH_HOME_BUTTONS_.length, visible: visible };
}

/* =========================================================
   V1.17 — DEVICE FAMILY ↔ PRICE CATEGORY ↔ INSPECTION
   One source of truth for "what kind of device is this sheet row",
   so the intake form can reuse the price book models and the
   inspection checklist for the exact model the user picked.
========================================================= */

/** Maps a price category key to the inspection/device family. */
const MH_CATEGORY_FAMILY_ = {
  iphone: 'iphone',
  board: 'iphone',
  watch: 'watch',
  airpods: 'airpods',
  airpods_commercial: 'airpods'
};

/** Human labels for the intake family picker. */
const MH_DEVICE_FAMILIES_ = [
  { key: 'iphone', label: 'iPhone', icon: '📱', categories: ['iphone'] },
  { key: 'ipad', label: 'iPad', icon: '📲', categories: [] },
  { key: 'macbook', label: 'MacBook', icon: '💻', categories: [] },
  { key: 'watch', label: 'Apple Watch', icon: '⌚', categories: ['watch'] },
  { key: 'airpods', label: 'AirPods', icon: '🎧', categories: ['airpods', 'airpods_commercial'] }
];

/**
 * Model list for one device family, grouped by generation the same way the
 * price book groups them. Falls back to an empty list for families that are
 * not in the price sheet yet (iPad / MacBook).
 */
function deviceFamilyModelsMini_(profile, body) {
  const family = String(body.family || '').trim().toLowerCase();
  const known = MH_DEVICE_FAMILIES_.some(function(f) { return f.key === family; });
  if (!known) throw new Error('INVALID_DEVICE_FAMILY');

  const models = [];
  const seen = {};
  try {
    const book = repairPriceBookMini_();
    MH_REPAIR_PRICE_CATEGORIES_.forEach(function(cfg) {
      if (MH_CATEGORY_FAMILY_[cfg.key] !== family) return;
      repairPriceCategoryDataMini_(book, cfg).models.forEach(function(m) {
        const key = String(m.name).toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        models.push({ name: m.name, category: cfg.key });
      });
    });
  } catch (e) { /* price book optional: the family picker still works */ }

  return {
    family: family,
    models: models,
    hasPriceData: models.length > 0
  };
}

/**
 * Everything the intake form needs after a model is chosen:
 * the inspection checklist for that family and the part prices.
 */
function deviceModelDetailMini_(profile, body) {
  const family = String(body.family || '').trim().toLowerCase();
  const model = String(body.model || '').trim();
  if (!MH_DEVICE_FAMILIES_.some(function(f) { return f.key === family; })) throw new Error('INVALID_DEVICE_FAMILY');

  const inspection = MH_DEVICE_INSPECTION_CATALOG_[family] || null;
  const checklist = inspection
    ? inspection.items.map(function(item, index) {
        return { index: index, name: item, instruction: getInspectionInstruction_(family, index) };
      })
    : [];

  // Find the model's part prices by scanning the linked categories.
  const parts = [];
  if (model) {
    try {
      const book = repairPriceBookMini_();
      MH_REPAIR_PRICE_CATEGORIES_.forEach(function(cfg) {
        if (MH_CATEGORY_FAMILY_[cfg.key] !== family) return;
        const hit = repairPriceCategoryDataMini_(book, cfg).models.find(function(m) {
          return String(m.name).trim().toLowerCase() === model.toLowerCase();
        });
        if (!hit) return;
        hit.issues.forEach(function(item) { parts.push({ issue: item.issue, price: item.price }); });
      });
    } catch (e) { /* price book optional */ }
  }

  return {
    family: family,
    model: model,
    inspectionFamily: family,
    checklist: checklist,
    parts: parts,
    hasChecklist: checklist.length > 0
  };
}

/** Families + models for the intake picker, in one round trip. */
function deviceFamiliesMini_(profile) {
  return {
    families: MH_DEVICE_FAMILIES_.map(function(f) {
      return { key: f.key, label: f.label, icon: f.icon };
    })
  };
}

/* =========================================================
   V1.18 — MANAGEMENT CONSOLE (لوحة الإدارة الجديدة)
   One endpoint feeds the whole dashboard so the UI never
   fires a dozen sequential requests. Every figure is computed
   from a single read of each sheet (per-execution cache).
========================================================= */

/** Money helper: always returns a number rounded to 2 decimals. */
function mhMoney_(value) {
  const n = Number(value);
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function mhSum_(rows, header) {
  return rows.reduce(function(sum, r) { return sum + mhMoney_(r[header]); }, 0);
}

function mhDateInMonth_(value, month) {
  return String(mhDate_(value) || '').indexOf(month) === 0;
}

/**
 * Everything the console needs, in one round trip.
 * Sections are gated by the same module map the old dashboard used.
 */
function consoleOverviewMini_(profile) {
  const role = String(profile.role || '');
  mhRequireRole_(profile, ['super_admin','admin','finance','supervisor','procurement']);

  const ss = spreadsheet_();
  const today = mhToday_();
  const month = today.slice(0, 7);

  // Every module key the dashboard can render must exist here, otherwise
  // openManagerModule() treats it as forbidden.
  const modules = {
    // التشغيل اليومي
    daily: ['super_admin','admin','supervisor'].includes(role),
    shifts: ['super_admin','admin'].includes(role),
    requests: ['super_admin','admin','supervisor'].includes(role),
    // الفريق
    staff: ['super_admin','admin'].includes(role),
    tasks: ['super_admin','admin','supervisor'].includes(role),
    parts: ['super_admin','admin','finance','supervisor','procurement'].includes(role),
    procurement: ['super_admin','admin','procurement'].includes(role),
    // المالية
    finance: ['super_admin','finance','admin'].includes(role),
    overtime: ['super_admin','finance','admin'].includes(role),
    // الأجهزة والتقارير
    devices: ['super_admin','admin'].includes(role),
    system: ['super_admin','admin','supervisor','finance'].includes(role),
    // الإشعارات والصلاحيات
    notifications: ['super_admin','admin','supervisor'].includes(role),
    notificationMatrix: ['super_admin','admin'].includes(role),
    buttonsMatrix: ['super_admin','admin'].includes(role),
    managers: ['super_admin'].includes(role),
    management: ['super_admin','admin'].includes(role)
  };

  const read = function(name, enabled) {
    if (!enabled) return [];
    try { return rowsAsObjects_(ss, name); } catch (e) { return []; }
  };

  /* ---------------- Staff ---------------- */
  const employees = read(MH.SHEETS.employees, modules.staff);
  const activeEmployees = employees.filter(function(r) {
    return String(r['Chat ID'] || '').trim() &&
      String(r['الحالة'] || 'نشط').trim() === 'نشط' &&
      String(r['حالة الحساب'] || 'نشط').trim() === 'نشط';
  });

  /* ---------------- Attendance ---------------- */
  const attendanceRows = read(MH.SHEETS.attendance, modules.daily);
  const todayAttendance = attendanceRows.filter(function(r) { return mhDate_(r['التاريخ']) === today; });
  const monthAttendance = attendanceRows.filter(function(r) { return mhDateInMonth_(r['التاريخ'], month); });

  const latestByEmployee = {};
  todayAttendance.forEach(function(r) {
    const id = String(r['Chat ID'] || '').trim();
    if (!id) return;
    const stamp = String(r['الوقت'] || '');
    if (!latestByEmployee[id] || stamp > String(latestByEmployee[id]['الوقت'] || '')) {
      latestByEmployee[id] = r;
    }
  });
  const presentNow = Object.keys(latestByEmployee).filter(function(id) {
    return String(latestByEmployee[id]['النوع'] || '').trim() === 'حضور';
  }).length;

  const monthIn = monthAttendance.filter(function(r) { return String(r['النوع'] || '').trim() === 'حضور'; });
  const monthOut = monthAttendance.filter(function(r) { return String(r['النوع'] || '').trim() === 'انصراف'; });
  const lateRows = monthIn.filter(function(r) { return Number(r['دقائق التأخير'] || 0) > 0; });

  /* ---------------- Requests ---------------- */
  const requests = read(MH.SHEETS.requests, modules.requests);
  const leaves = read(MH.SHEETS.leaves, modules.requests || modules.daily);
  const complaints = read(MH.SHEETS.complaints, modules.requests);
  const absences = read(MH.SHEETS.absences, modules.daily);

  const pendingRequests = requests.filter(function(r) {
    return String(r['القرار'] || '').trim() === 'قيد الانتظار';
  });
  const pendingLeaves = leaves.filter(function(r) {
    return String(r['الحالة'] || '').trim() === 'بانتظار مراجعة المدير';
  });
  const openComplaints = complaints.filter(function(r) {
    const s = String(r['الحالة'] || '').trim();
    return ['مغلقة','تم الحل'].indexOf(s) < 0;
  });
  const pendingAbsences = absences.filter(function(r) {
    return /انتظار|مراجعة|معلق/.test(String(r['الحالة'] || ''));
  });

  /* ---------------- Money ---------------- */
  const cash = read(MH.SHEETS.cash, modules.finance);
  const deductions = read(MH.SHEETS.deductions, modules.finance);
  const overtime = read(MH.SHEETS.overtime, modules.finance);

  const cashPendingReview = cash.filter(function(r) {
    return String(r['الحالة'] || '').trim() === 'قيد المراجعة';
  });
  const cashAwaitingPayout = cash.filter(function(r) {
    return String(r['حالة الصرف'] || '').trim() === 'بانتظار الصرف';
  });
  const openCustody = cash.filter(function(r) {
    const c = String(r['حالة العهدة'] || '').trim();
    return ['عهدة مفتوحة','بانتظار مراجعة التسوية','بانتظار تأكيد استلام المتبقي','بانتظار صرف التعويض'].indexOf(c) >= 0;
  });
  const settlementsPending = cash.filter(function(r) {
    return String(r['حالة التسوية'] || '').trim() === 'بانتظار مراجعة التسوية';
  });

  const monthDeductions = deductions.filter(function(r) { return mhDateInMonth_(r['تاريخ الواقعة'], month); });
  const approvedDeductions = monthDeductions.filter(function(r) { return String(r['الحالة'] || '').trim() === 'معتمد'; });
  const pendingDeductions = monthDeductions.filter(function(r) { return String(r['الحالة'] || '').trim() === 'بانتظار اعتماد المدير'; });

  const monthOvertime = overtime.filter(function(r) { return mhDateInMonth_(r['تاريخ الوردية'], month); });
  const pendingOvertime = overtime.filter(function(r) {
    return String(r['الحالة'] || '').trim() === 'بانتظار موافقة المدير';
  });

  /* ---------------- Devices ---------------- */
  const devices = read(MH.SHEETS.devices, modules.devices);
  const activeDevices = devices.filter(function(r) {
    return String(r['حالة الجهاز'] || '').trim() !== 'تم التسليم';
  });
  const readyDevices = devices.filter(function(r) {
    return String(r['حالة الجهاز'] || '').trim() === 'جاهز للتسليم';
  });

  /* ---------------- Tasks ---------------- */
  let tasks = [];
  if (modules.tasks) {
    try { tasks = mhRowsObjects_(mhTaskSheet_()); } catch (e) { tasks = []; }
  }
  const openTasks = tasks.filter(function(r) {
    return ['جديدة','قيد التنفيذ','بانتظار المراجعة'].indexOf(String(r['الحالة'] || '').trim()) >= 0;
  });
  const reviewTasks = tasks.filter(function(r) {
    return String(r['الحالة'] || '').trim() === 'بانتظار المراجعة';
  });
  const overdueTasks = tasks.filter(function(r) {
    const due = mhDate_(r['تاريخ الاستحقاق']);
    return !!due && due < today && ['مكتملة','ملغاة'].indexOf(String(r['الحالة'] || '').trim()) < 0;
  });

  /* ---------------- Parts ---------------- */
  let partsPending = 0;
  if (modules.devices) {
    try {
      partsPending = mhRowsObjects_(mhPartSheet_()).filter(function(r) {
        return String(r['الحالة'] || '').trim() === 'بانتظار الموافقة';
      }).length;
    } catch (e) { partsPending = 0; }
  }

  /* ---------------- Alerts: what actually needs a decision today ---------------- */
  const alerts = [];
  const pushAlert = function(kind, label, count, screen, urgency) {
    if (!count) return;
    alerts.push({ kind: kind, label: label, count: count, screen: screen, urgency: urgency || 'normal' });
  };
  if (modules.requests) {
    pushAlert('requests', 'طلبات عامة بانتظار القرار', pendingRequests.length, 'requests', 'normal');
    pushAlert('leaves', 'أذونات بانتظار المراجعة', pendingLeaves.length, 'requests', 'normal');
    pushAlert('complaints', 'شكاوى مفتوحة', openComplaints.length, 'requests', openComplaints.length > 3 ? 'high' : 'normal');
  }
  if (modules.daily) {
    pushAlert('absences', 'حالات غياب بانتظار المراجعة', pendingAbsences.length, 'daily', 'high');
  }
  if (modules.finance) {
    pushAlert('cash', 'طلبات سلف بانتظار القرار', cashPendingReview.length, 'finance', 'normal');
    pushAlert('payout', 'سلف معتمدة بانتظار الصرف', cashAwaitingPayout.length, 'finance', 'normal');
    pushAlert('settlements', 'تسويات عهد بانتظار المراجعة', settlementsPending.length, 'finance', 'high');
    pushAlert('deductions', 'خصومات بانتظار الاعتماد', pendingDeductions.length, 'finance', 'normal');
    pushAlert('overtime', 'أوفر تايم بانتظار الموافقة', pendingOvertime.length, 'overtime', 'normal');
  }
  if (modules.tasks) {
    pushAlert('tasks', 'مهام بانتظار مراجعتك', reviewTasks.length, 'tasks', 'normal');
    pushAlert('overdue', 'مهام متأخرة', overdueTasks.length, 'tasks', 'high');
  }
  if (modules.devices) {
    pushAlert('parts', 'قطع غيار بانتظار الموافقة', partsPending, 'parts', 'normal');
    pushAlert('ready', 'أجهزة جاهزة للتسليم', readyDevices.length, 'devices', 'normal');
  }

  /* ---------------- Recent activity (one merged feed) ---------------- */
  const feed = [];
  if (modules.daily) {
    todayAttendance.slice(-40).forEach(function(r) {
      feed.push({
        at: today + ' ' + String(r['الوقت'] || ''),
        kind: 'attendance',
        title: String(r['اسم الموظف'] || '') + ' — ' + String(r['النوع'] || ''),
        detail: String(r['حالة الحضور'] || '') + (Number(r['دقائق التأخير'] || 0) > 0 ? ' · ' + r['دقائق التأخير'] + ' دقيقة' : '')
      });
    });
  }
  if (modules.finance) {
    monthDeductions.slice(-15).forEach(function(r) {
      feed.push({
        at: String(r['تاريخ التسجيل'] || '').slice(0, 16),
        kind: 'deduction',
        title: 'خصم — ' + String(r['اسم الموظف'] || ''),
        detail: mhMoney_(r['المبلغ بالجنيه']) + ' جنيه · ' + String(r['الحالة'] || '')
      });
    });
  }
  if (modules.tasks) {
    tasks.slice(-15).forEach(function(r) {
      feed.push({
        at: String(r['تاريخ آخر تحديث'] || '').slice(0, 16),
        kind: 'task',
        title: 'مهمة — ' + String(r['اسم الفني'] || ''),
        detail: String(r['العنوان'] || '') + ' · ' + String(r['الحالة'] || '')
      });
    });
  }
  feed.sort(function(a, b) { return String(b.at).localeCompare(String(a.at)); });

  return {
    date: today,
    month: month,
    role: role,
    modules: modules,
    staff: {
      active: modules.staff ? activeEmployees.length : null,
      total: modules.staff ? employees.length : null
    },
    attendance: {
      presentNow: modules.daily ? presentNow : null,
      checkedInToday: modules.daily ? Object.keys(latestByEmployee).length : null,
      monthCheckins: modules.daily ? monthIn.length : null,
      monthCheckouts: modules.daily ? monthOut.length : null,
      lateDays: modules.daily ? lateRows.length : null,
      lateMinutes: modules.daily ? lateRows.reduce(function(s, r) { return s + Number(r['دقائق التأخير'] || 0); }, 0) : null
    },
    money: {
      pendingAdvances: modules.finance ? cashPendingReview.length : null,
      awaitingPayout: modules.finance ? cashAwaitingPayout.length : null,
      openCustody: modules.finance ? openCustody.length : null,
      custodyAmount: modules.finance ? mhMoney_(openCustody.reduce(function(s, r) {
        return s + (Number(r['المبلغ المعتمد بالجنيه'] || r['المبلغ المطلوب بالجنيه'] || 0) - Number(r['المصروف الفعلي بالجنيه'] || 0));
      }, 0)) : null,
      settlementsPending: modules.finance ? settlementsPending.length : null,
      monthDeductionsApproved: modules.finance ? mhMoney_(mhSum_(approvedDeductions, 'المبلغ بالجنيه')) : null,
      monthDeductionsPending: modules.finance ? mhMoney_(mhSum_(pendingDeductions, 'المبلغ بالجنيه')) : null,
      monthOvertimeMinutes: modules.finance ? monthOvertime.reduce(function(s, r) { return s + Number(r['دقائق الأوفر تايم'] || 0); }, 0) : null,
      monthOvertimeAmount: modules.finance ? mhMoney_(mhSum_(monthOvertime.filter(function(r) {
        return String(r['الحالة'] || '').indexOf('معتمد') === 0;
      }), 'المبلغ بالجنيه')) : null
    },
    operations: {
      activeDevices: modules.devices ? activeDevices.length : null,
      readyDevices: modules.devices ? readyDevices.length : null,
      partsPending: modules.devices ? partsPending : null,
      openTasks: modules.tasks ? openTasks.length : null,
      tasksInReview: modules.tasks ? reviewTasks.length : null,
      tasksOverdue: modules.tasks ? overdueTasks.length : null
    },
    requests: {
      pendingRequests: modules.requests ? pendingRequests.length : null,
      pendingLeaves: modules.requests ? pendingLeaves.length : null,
      openComplaints: modules.requests ? openComplaints.length : null,
      pendingAbsences: modules.daily ? pendingAbsences.length : null,
      pendingOvertime: modules.finance ? pendingOvertime.length : null
    },
    alerts: alerts,
    feed: feed.slice(0, 25)
  };
}

/* =========================================================
   V1.18 — REPORTS ENGINE
   Every report reads each sheet once and returns totals plus
   per-employee breakdown, so the console can print real
   numbers instead of raw rows.
========================================================= */

function consoleReportMini_(profile, body) {
  const role = String(profile.role || '');
  mhRequireRole_(profile, ['super_admin','admin','finance','supervisor']);

  const type = String(body.type || 'finance').trim();
  const month = /^\d{4}-\d{2}$/.test(String(body.month || '')) ? String(body.month) : mhToday_().slice(0, 7);

  const ss = spreadsheet_();
  const read = function(name) {
    try { return rowsAsObjects_(ss, name); } catch (e) { return []; }
  };
  const employees = read(MH.SHEETS.employees);
  const nameOf = {};
  employees.forEach(function(r) {
    const id = String(r['Chat ID'] || '').trim();
    if (id) nameOf[id] = String(r['اسم الموظف'] || '');
  });

  if (type === 'finance') {
    mhRequireRole_(profile, ['super_admin','admin','finance']);
    const cash = read(MH.SHEETS.cash).filter(function(r) { return mhDateInMonth_(r['التاريخ والوقت'] || r['تاريخ آخر تحديث'], month); });
    const deductions = read(MH.SHEETS.deductions).filter(function(r) { return mhDateInMonth_(r['تاريخ الواقعة'], month); });
    const overtime = read(MH.SHEETS.overtime).filter(function(r) { return mhDateInMonth_(r['تاريخ الوردية'], month); });

    const approvedDed = deductions.filter(function(r) { return String(r['الحالة'] || '').trim() === 'معتمد'; });
    const paidCash = cash.filter(function(r) { return String(r['حالة الصرف'] || '').trim() === 'تم الصرف'; });
    const paidOvertime = overtime.filter(function(r) { return String(r['الحالة'] || '').indexOf('معتمد') === 0; });

    const perEmployee = {};
    const add = function(id, key, amount) {
      if (!id) return;
      if (!perEmployee[id]) perEmployee[id] = { id: id, name: nameOf[id] || id, advances: 0, deductions: 0, overtime: 0, total: 0 };
      perEmployee[id][key] += mhMoney_(amount);
      if (key !== 'total') perEmployee[id].total += mhMoney_(amount);
    };
    paidCash.forEach(function(r) { add(String(r['Chat ID'] || '').trim(), 'advances', r['المبلغ المعتمد بالجنيه'] || r['المبلغ المطلوب بالجنيه']); });
    approvedDed.forEach(function(r) { add(String(r['Chat ID'] || '').trim(), 'deductions', r['المبلغ بالجنيه']); });
    paidOvertime.forEach(function(r) { add(String(r['Chat ID'] || '').trim(), 'overtime', r['المبلغ بالجنيه']); });

    const rows = Object.keys(perEmployee).map(function(k) { return perEmployee[k]; })
      .sort(function(a, b) { return b.total - a.total; });

    return {
      type: 'finance',
      month: month,
      totals: {
        advances: mhMoney_(mhSum_(paidCash, 'المبلغ المعتمد بالجنيه') || paidCash.reduce(function(s, r) { return s + Number(r['المبلغ المعتمد بالجنيه'] || r['المبلغ المطلوب بالجنيه'] || 0); }, 0)),
        deductions: mhMoney_(mhSum_(approvedDed, 'المبلغ بالجنيه')),
        overtime: mhMoney_(mhSum_(paidOvertime, 'المبلغ بالجنيه')),
        transfers: paidCash.length = paidCash.length
      },
      counts: {
        advancesPaid: paidCash.length,
        deductionsApproved: approvedDed.length,
        overtimeEntries: paidOvertime.length
      },
      rows: rows,
      grandTotal: mhMoney_(rows.reduce(function(s, r) { return s + r.total; }, 0))
    };
  }

  if (type === 'attendance') {
    const att = read(MH.SHEETS.attendance).filter(function(r) { return mhDateInMonth_(r['التاريخ'], month); });
    const perEmployee = {};
    att.forEach(function(r) {
      const id = String(r['Chat ID'] || '').trim();
      if (!id) return;
      if (!perEmployee[id]) perEmployee[id] = { id: id, name: nameOf[id] || String(r['اسم الموظف'] || ''), checkins: 0, checkouts: 0, lateDays: 0, lateMinutes: 0 };
      const e = perEmployee[id];
      if (String(r['النوع'] || '').trim() === 'حضور') {
        e.checkins++;
        const late = Number(r['دقائق التأخير'] || 0);
        if (late > 0) { e.lateDays++; e.lateMinutes += late; }
      } else if (String(r['النوع'] || '').trim() === 'انصراف') {
        e.checkouts++;
      }
    });
    const rows = Object.keys(perEmployee).map(function(k) { return perEmployee[k]; })
      .sort(function(a, b) { return b.lateMinutes - a.lateMinutes; });

    return {
      type: 'attendance',
      month: month,
      totals: {
        checkins: att.filter(function(r) { return String(r['النوع'] || '').trim() === 'حضور'; }).length,
        checkouts: att.filter(function(r) { return String(r['النوع'] || '').trim() === 'انصراف'; }).length,
        lateDays: att.filter(function(r) { return Number(r['دقائق التأخير'] || 0) > 0; }).length,
        lateMinutes: att.reduce(function(s, r) { return s + Number(r['دقائق التأخير'] || 0); }, 0)
      },
      rows: rows
    };
  }

  if (type === 'tasks') {
    const tasks = (function() { try { return mhRowsObjects_(mhTaskSheet_()); } catch (e) { return []; } })();
    const perEmployee = {};
    tasks.forEach(function(r) {
      const id = String(r['Chat ID'] || '').trim();
      if (!id) return;
      if (!perEmployee[id]) perEmployee[id] = { id: id, name: String(r['اسم الفني'] || nameOf[id] || id), total: 0, done: 0, open: 0, review: 0, overdue: 0 };
      const e = perEmployee[id];
      const st = String(r['الحالة'] || '').trim();
      e.total++;
      if (st === 'مكتملة') e.done++;
      else if (st === 'بانتظار المراجعة') e.review++;
      else if (st !== 'ملغاة') e.open++;
      const due = mhDate_(r['تاريخ الاستحقاق']);
      if (due && due < mhToday_() && ['مكتملة','ملغاة'].indexOf(st) < 0) e.overdue++;
    });
    const rows = Object.keys(perEmployee).map(function(k) { return perEmployee[k]; })
      .sort(function(a, b) { return b.open - a.open; });

    return {
      type: 'tasks',
      month: month,
      totals: {
        total: tasks.length,
        done: tasks.filter(function(r) { return String(r['الحالة'] || '').trim() === 'مكتملة'; }).length,
        open: tasks.filter(function(r) { return ['جديدة','قيد التنفيذ'].indexOf(String(r['الحالة'] || '').trim()) >= 0; }).length,
        review: tasks.filter(function(r) { return String(r['الحالة'] || '').trim() === 'بانتظار المراجعة'; }).length
      },
      rows: rows
    };
  }

  if (type === 'devices') {
    mhRequireRole_(profile, ['super_admin','admin']);
    const devices = read(MH.SHEETS.devices);
    const byStatus = {};
    devices.forEach(function(r) {
      const s = String(r['حالة الجهاز'] || 'غير محدد').trim();
      byStatus[s] = (byStatus[s] || 0) + 1;
    });
    const perTech = {};
    devices.forEach(function(r) {
      const id = String(r['الموظف المسؤول Chat ID'] || '').trim();
      if (!id) return;
      if (!perTech[id]) perTech[id] = { id: id, name: String(r['الموظف المسؤول'] || nameOf[id] || id), total: 0, open: 0, delivered: 0 };
      perTech[id].total++;
      if (String(r['حالة الجهاز'] || '').trim() === 'تم التسليم') perTech[id].delivered++;
      else perTech[id].open++;
    });
    return {
      type: 'devices',
      month: month,
      totals: {
        total: devices.length,
        open: devices.filter(function(r) { return String(r['حالة الجهاز'] || '').trim() !== 'تم التسليم'; }).length,
        delivered: devices.filter(function(r) { return String(r['حالة الجهاز'] || '').trim() === 'تم التسليم'; }).length
      },
      byStatus: byStatus,
      rows: Object.keys(perTech).map(function(k) { return perTech[k]; }).sort(function(a, b) { return b.open - a.open; })
    };
  }

  if (type === 'custody') {
    mhRequireRole_(profile, ['super_admin','admin','finance']);
    const cash = read(MH.SHEETS.cash);
    const open = cash.filter(function(r) {
      const c = String(r['حالة العهدة'] || '').trim();
      return ['عهدة مفتوحة','بانتظار مراجعة التسوية','بانتظار تأكيد استلام المتبقي','بانتظار صرف التعويض'].indexOf(c) >= 0;
    });
    const perEmployee = {};
    open.forEach(function(r) {
      const id = String(r['Chat ID'] || '').trim();
      if (!id) return;
      if (!perEmployee[id]) perEmployee[id] = { id: id, name: nameOf[id] || String(r['اسم الموظف'] || ''), count: 0, approved: 0, spent: 0, outstanding: 0 };
      const e = perEmployee[id];
      const approved = mhMoney_(r['المبلغ المعتمد بالجنيه'] || r['المبلغ المطلوب بالجنيه']);
      const spent = mhMoney_(r['المصروف الفعلي بالجنيه']);
      e.count++;
      e.approved += approved;
      e.spent += spent;
      e.outstanding += Math.max(0, approved - spent);
    });
    const rows = Object.keys(perEmployee).map(function(k) { return perEmployee[k]; })
      .sort(function(a, b) { return b.outstanding - a.outstanding; });
    return {
      type: 'custody',
      month: month,
      totals: {
        openCount: open.length,
        approved: mhMoney_(rows.reduce(function(s, r) { return s + r.approved; }, 0)),
        spent: mhMoney_(rows.reduce(function(s, r) { return s + r.spent; }, 0)),
        outstanding: mhMoney_(rows.reduce(function(s, r) { return s + r.outstanding; }, 0))
      },
      rows: rows
    };
  }

  if (type === 'summary') {
    // Cross-area executive summary for the opening tab of the reports screen.
    const att = read(MH.SHEETS.attendance).filter(function(r) { return mhDateInMonth_(r['التاريخ'], month); });
    const ded = read(MH.SHEETS.deductions).filter(function(r) {
      return mhDateInMonth_(r['تاريخ الواقعة'], month) && String(r['الحالة'] || '').trim() === 'معتمد';
    });
    const ot = read(MH.SHEETS.overtime).filter(function(r) {
      return mhDateInMonth_(r['تاريخ الوردية'], month) && String(r['الحالة'] || '').indexOf('معتمد') === 0;
    });
    const cash = read(MH.SHEETS.cash).filter(function(r) { return String(r['حالة الصرف'] || '').trim() === 'تم الصرف'; });
    return {
      type: 'summary',
      month: month,
      totals: {
        checkins: att.filter(function(r) { return String(r['النوع'] || '').trim() === 'حضور'; }).length,
        lateMinutes: att.reduce(function(s, r) { return s + Number(r['دقائق التأخير'] || 0); }, 0),
        deductions: mhMoney_(mhSum_(ded, 'المبلغ بالجنيه')),
        overtime: mhMoney_(mhSum_(ot, 'المبلغ بالجنيه')),
        custodyPaid: mhMoney_(cash.reduce(function(s, r) { return s + Number(r['المبلغ المعتمد بالجنيه'] || 0); }, 0))
      },
      rows: []
    };
  }

  throw new Error('INVALID_REPORT_TYPE');
}

/* =========================================================
   V1.20 — PURCHASING OFFICER + INVENTORY
   A dedicated role that owns spare parts and stock:
     - receives every part request immediately
     - approves / rejects and issues parts
     - maintains stock levels per part
   Role value in «المديرين»: Procurement / مشتريات / مسئول مشتريات
========================================================= */
const MH_INVENTORY_HEADERS = [
  'كود القطعة','اسم القطعة','الفئة','الكمية المتاحة','الحد الأدنى','سعر الشراء',
  'المورد','الموقع','آخر تحديث','آخر تحديث بواسطة','ملاحظات'
];
const MH_INVENTORY_SHEET_ = 'المخزون';
const MH_PROCUREMENT_ROLES_ = ['super_admin', 'procurement'];

/** True when this profile owns purchasing. */
function mhIsProcurement_(profile) {
  return !!profile && MH_PROCUREMENT_ROLES_.indexOf(String(profile.role || '')) >= 0;
}

/** True for anyone allowed to see procurement screens (procurement + admin). */
function mhCanProcure_(profile) {
  return !!profile && ['super_admin','admin','procurement'].indexOf(String(profile.role || '')) >= 0;
}

function mhInventorySheet_() {
  const ss = spreadsheet_();
  let sh = ss.getSheetByName(MH_INVENTORY_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(MH_INVENTORY_SHEET_);
    sh.getRange(1, 1, 1, MH_INVENTORY_HEADERS.length).setValues([MH_INVENTORY_HEADERS]);
    sh.setFrozenRows(1);
    return sh;
  }
  const width = Math.max(sh.getLastColumn(), 1);
  const existing = sh.getRange(1, 1, 1, width).getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  const missing = MH_INVENTORY_HEADERS.filter(function(h) { return existing.indexOf(h) < 0; });
  if (missing.length) sh.getRange(1, width + 1, 1, missing.length).setValues([missing]);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
  return sh;
}

/**
 * Every account that belongs to purchasing, resolved from the managers sheet.
 * Falls back to the employees sheet so a technician can also be appointed by job.
 */
function mhProcurementRecipients_() {
  const ids = [];
  try {
    rowsAsObjects_(spreadsheet_(), MH.SHEETS.managers).forEach(function(r) {
      const id = String(r['Chat ID'] || '').trim();
      const role = String(r['الصلاحية'] || '').trim();
      const active = String(r['الحالة'] || 'نشط').trim() === 'نشط';
      if (!id || !active) return;
      if (/procurement|مشتريات|مورد/i.test(role) && ids.indexOf(id) < 0) ids.push(id);
    });
  } catch (e) { /* managers sheet optional */ }

  // Also accept an employee whose job title is a purchasing role.
  try {
    rowsAsObjects_(spreadsheet_(), MH.SHEETS.employees).forEach(function(r) {
      const id = String(r['Chat ID'] || '').trim();
      const job = String(r['الوظيفة'] || '');
      const active = mhEmployeeIsActive_(r);
      if (!id || !active) return;
      if (/مشتريات|مسئول\s*مشتريات|procurement/i.test(job) && ids.indexOf(id) < 0) ids.push(id);
    });
  } catch (e) { /* employees sheet always exists, but stay safe */ }

  return ids;
}

/** Sends a message to every purchasing officer (never throws). */
function mhNotifyProcurement_(message, eventType) {
  const ids = mhProcurementRecipients_();
  ids.forEach(function(id) { mhNotifyEmployee_(id, message, eventType || 'المشتريات'); });
  return ids.length;
}

/* ---------------- Inventory reads ---------------- */

function mhInventoryRows_() {
  return mhRowsObjects_(mhInventorySheet_()).map(function(r) {
    const qty = Number(r['الكمية المتاحة'] || 0);
    const min = Number(r['الحد الأدنى'] || 0);
    return {
      code: String(r['كود القطعة'] || ''),
      name: String(r['اسم القطعة'] || ''),
      category: String(r['الفئة'] || ''),
      quantity: isFinite(qty) ? qty : 0,
      minimum: isFinite(min) ? min : 0,
      price: mhMoney_(r['سعر الشراء']),
      supplier: String(r['المورد'] || ''),
      location: String(r['الموقع'] || ''),
      updatedAt: String(r['آخر تحديث'] || ''),
      note: String(r['ملاحظات'] || ''),
      low: (isFinite(qty) ? qty : 0) <= (isFinite(min) ? min : 0)
    };
  });
}

/** Procurement dashboard: pending requests + stock alerts. */
function inventoryOverviewMini_(profile) {
  if (!mhCanProcure_(profile)) throw new Error('FORBIDDEN');

  let parts = [];
  try { parts = mhRowsObjects_(mhPartSheet_()); } catch (e) { parts = []; }
  const inventory = mhInventoryRows_();

  const pending = parts.filter(function(r) { return String(r['الحالة'] || '').trim() === 'بانتظار الموافقة'; });
  const approved = parts.filter(function(r) { return String(r['الحالة'] || '').trim() === 'معتمد'; });
  const low = inventory.filter(function(i) { return i.low; });

  // Requests grouped by part name so the officer sees demand at a glance.
  const demand = {};
  pending.forEach(function(r) {
    const key = String(r['القطعة المطلوبة'] || '').trim();
    if (!key) return;
    if (!demand[key]) demand[key] = { name: key, count: 0, quantity: 0 };
    demand[key].count++;
    demand[key].quantity += Number(r['الكمية'] || 1);
  });

  const toList = function(r) {
    return {
      id: String(r['رقم الطلب'] || ''),
      employeeName: String(r['اسم الفني'] || ''),
      employeeId: String(r['Chat ID'] || ''),
      partName: String(r['القطعة المطلوبة'] || ''),
      quantity: Number(r['الكمية'] || 1),
      purpose: String(r['الغرض'] || ''),
      reason: String(r['سبب الاستخدام'] || ''),
      deviceRef: String(r['جهاز مرتبط'] || ''),
      status: String(r['الحالة'] || ''),
      createdAt: String(r['التاريخ والوقت'] || '')
    };
  };

  return {
    pending: pending.slice(-40).map(toList),
    approvedAwaitingIssue: approved.slice(-40).map(toList),
    demand: Object.keys(demand).map(function(k) { return demand[k]; }).sort(function(a, b) { return b.quantity - a.quantity; }),
    inventory: inventory,
    counts: {
      pendingRequests: pending.length,
      awaitingIssue: approved.length,
      lowStock: low.length,
      totalItems: inventory.length
    }
  };
}

/** Search inventory by name or code. */
function inventorySearchMini_(profile, body) {
  if (!mhCanProcure_(profile)) throw new Error('FORBIDDEN');
  const q = String(body.query || '').trim().toLowerCase();
  const stock = mhInventoryRows_();
  if (!q) return { items: stock.slice(0, 100), total: stock.length };
  const hits = stock.filter(function(i) {
    return i.name.toLowerCase().indexOf(q) >= 0 || i.code.toLowerCase().indexOf(q) >= 0;
  });
  return { items: hits.slice(0, 100), total: hits.length };
}

/** Create or update one inventory item (procurement + admin). */
function inventorySaveMini_(profile, body) {
  if (!mhCanProcure_(profile)) throw new Error('FORBIDDEN');

  const code = String(body.code || '').trim();
  const name = String(body.name || '').trim();
  if (name.length < 2 || name.length > 120) throw new Error('INVALID_INVENTORY_NAME');
  if (code.length > 60) throw new Error('INVALID_INVENTORY_CODE');

  const quantity = mhFirstNumber_(body.quantity);
  const minimum = mhFirstNumber_(body.minimum);
  const price = mhFirstNumber_(body.price);
  if (quantity < 0 || quantity > 100000) throw new Error('INVALID_INVENTORY_QUANTITY');
  if (minimum < 0 || minimum > 100000) throw new Error('INVALID_INVENTORY_MINIMUM');
  if (price < 0 || price > 1000000) throw new Error('INVALID_INVENTORY_PRICE');

  const sh = mhInventorySheet_();
  mhAssertHeaders_(sh, MH_INVENTORY_HEADERS);
  const map = mhHeaderMap_(sh);
  const rows = mhRowsObjects_(sh);

  const found = rows.find(function(r) {
    if (code) return String(r['كود القطعة'] || '').trim() === code;
    return String(r['اسم القطعة'] || '').trim().toLowerCase() === name.toLowerCase();
  });

  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (found) {
      if (map['اسم القطعة']) sh.getRange(found.__row, map['اسم القطعة']).setValue(name);
      if (map['الكمية المتاحة']) sh.getRange(found.__row, map['الكمية المتاحة']).setValue(quantity);
      if (map['الحد الأدنى']) sh.getRange(found.__row, map['الحد الأدنى']).setValue(minimum);
      if (map['سعر الشراء']) sh.getRange(found.__row, map['سعر الشراء']).setValue(price);
      if (body.category !== undefined && map['الفئة']) sh.getRange(found.__row, map['الفئة']).setValue(String(body.category || ''));
      if (body.supplier !== undefined && map['المورد']) sh.getRange(found.__row, map['المورد']).setValue(String(body.supplier || ''));
      if (body.location !== undefined && map['الموقع']) sh.getRange(found.__row, map['الموقع']).setValue(String(body.location || ''));
      if (body.note !== undefined && map['ملاحظات']) sh.getRange(found.__row, map['ملاحظات']).setValue(String(body.note || '').slice(0, 300));
      sh.getRange(found.__row, map['آخر تحديث']).setValue(mhStamp_());
      if (map['آخر تحديث بواسطة']) sh.getRange(found.__row, map['آخر تحديث بواسطة']).setValue(String(profile.name || profile.chatId));
      return { saved: true, updated: true, code: code || String(found['كود القطعة'] || ''), name: name, quantity: quantity };
    }

    const newCode = code || ('ITM-' + Utilities.getUuid().slice(0, 6).toUpperCase());
    sh.appendRow([
      newCode, name, String(body.category || ''), quantity, minimum, price,
      String(body.supplier || ''), String(body.location || ''), mhStamp_(),
      String(profile.name || profile.chatId), String(body.note || '').slice(0, 300)
    ]);
    return { saved: true, created: true, code: newCode, name: name, quantity: quantity };
  } finally { lock.releaseLock(); }
}

/**
 * Adjusts stock by a delta (issue on approval, restock on delivery).
 * Negative delta is clamped so stock never goes below zero.
 */
function mhAdjustStock_(partName, delta, actorName) {
  const name = String(partName || '').trim();
  if (!name || !delta) return null;
  let sh;
  try { sh = mhInventorySheet_(); } catch (e) { return null; }
  const map = mhHeaderMap_(sh);
  const row = mhRowsObjects_(sh).find(function(r) {
    return String(r['اسم القطعة'] || '').trim().toLowerCase() === name.toLowerCase();
  });
  if (!row) return null;

  const current = Number(row['الكمية المتاحة'] || 0);
  const next = Math.max(0, current + Number(delta));
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    sh.getRange(row.__row, map['الكمية المتاحة']).setValue(next);
    sh.getRange(row.__row, map['آخر تحديث']).setValue(mhStamp_());
    if (map['آخر تحديث بواسطة']) sh.getRange(row.__row, map['آخر تحديث بواسطة']).setValue(String(actorName || ''));
  } finally { lock.releaseLock(); }

  const minimum = Number(row['الحد الأدنى'] || 0);
  return { code: String(row['كود القطعة'] || ''), name: name, previous: current, current: next, minimum: minimum, low: next <= minimum };
}

/* =========================================================
   V1.21 — TASK SHEET REPAIR
   Older builds wrote 17 values into an 18-column sheet, which
   shifted every cell one column to the left. Task IDs landed in
   the wrong place and the row looked corrupted.

   This repairs existing rows in place. It is safe to run more
   than once: rows that already match their headers are skipped.
========================================================= */

/**
 * Detects and realigns task rows written with the old 17-value layout.
 * Returns a summary so the caller can report what changed.
 */
function tasksRepairSheet_(profile) {
  mhRequireRole_(profile, ['super_admin','admin']);

  const sh = mhTaskSheet_();
  mhAssertHeaders_(sh, MH_TASK_HEADERS);

  const lastRow = sh.getLastRow();
  const lastCol = Math.max(sh.getLastColumn(), 1);
  if (lastRow < 2) return { repaired: 0, checked: 0, message: 'لا توجد صفوف لفحصها.' };

  const headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  const colIndex = {};
  headers.forEach(function(h, i) { if (h) colIndex[h] = i; });

  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  const repairs = [];

  values.forEach(function(row, i) {
    const rowNum = i + 2;

    const getId = function(header) {
      const idx = colIndex[header];
      return idx === undefined ? '' : String(row[idx] || '').trim();
    };

    const taskId = getId('رقم المهمة');
    if (!/^TSK-/.test(taskId)) return; // no identifier: nothing to repair

    // The old bug kept the id in place and shifted the REST one column left.
    // Detect impossible values in typed columns, which is unambiguous:
    //   • «ملاحظة المراجعة» must never hold a pure number (chat id)
    //   • «أنشأها Chat ID» must be numeric, never a person's name
    //   • «أنشأها» must be text, never a timestamp
    const cell = function(header) {
      const idx = colIndex[header];
      return idx === undefined ? '' : String(row[idx] || '').trim();
    };

    const reviewNote = cell('ملاحظة المراجعة');
    const creatorId  = cell('أنشأها Chat ID');
    const creatorName = cell('أنشأها');
    const created = cell('تاريخ الإنشاء');

    const shifted =
      /^\d{5,20}$/.test(reviewNote) ||
      (creatorId !== '' && !/^\d{5,20}$/.test(creatorId)) ||
      (/^\d{4}-\d{2}-\d{2}/.test(creatorName) && creatorName !== '');

    if (!shifted) return;
    repairs.push({ rowNum: rowNum, raw: row.slice() });
  });

  if (!repairs.length) {
    return { repaired: 0, checked: values.length, message: 'كل الصفوف سليمة — لا حاجة لإصلاح.' };
  }

  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    repairs.forEach(function(item) {
      // Recover what we can from the shifted row and rebuild it by name.
      const raw = item.raw;
      const findId = function() {
        for (let c = 0; c < raw.length; c++) {
          if (/^TSK-/.test(String(raw[c] || '').trim())) return String(raw[c]).trim();
        }
        return '';
      };
      const recoveredId = findId();
      if (!recoveredId) return; // cannot repair without an identifier

      // Columns before «ملاحظة المراجعة» are correct; everything from the
      // missing-column position onward is one place to the left. Move that
      // tail right by one cell and blank the now-duplicated slot.
      const pivot = colIndex['ملاحظة المراجعة'];
      const fixed = raw.slice();
      if (pivot !== undefined) {
        for (let c = fixed.length - 1; c >= pivot; c--) {
          fixed[c] = c === pivot ? '' : fixed[c - 1];
        }
        // «ملاحظة المراجعة» is a free-text column that was absent in the old
        // layout, so it starts empty for repaired rows.
        fixed[pivot] = '';
      }
      sh.getRange(item.rowNum, 1, 1, fixed.length).setValues([fixed]);
    });
  } finally { lock.releaseLock(); }

  return {
    repaired: repairs.length,
    checked: values.length,
    message: 'تم إصلاح ' + repairs.length + ' صفًا من ' + values.length + '.'
  };
}

/** API entry: repair task rows from the dashboard. */
function tasksRepairMini_(profile) {
  return tasksRepairSheet_(profile);
}

