/**
 * MobiHub V1.10.4 — LEGACY BOT WEBHOOK REPAIR
 * Add these functions to the ACTIVE legacy bot Apps Script project only.
 * Never paste them into the Mini App API project.
 *
 * Deploy legacy bot as Web App (Execute as Me; access Anyone).
 * Run mobihubCheckTelegramWebhook(), then mobihubRestoreTelegramWebhook().
 */
function mobihubCheckTelegramWebhook() {
  var token=getBotToken_();
  if(!token) throw new Error("BOT_TOKEN is missing in the legacy bot project.");
  var response=UrlFetchApp.fetch("https://api.telegram.org/bot"+token+"/getWebhookInfo",{muteHttpExceptions:true});
  var result=JSON.parse(response.getContentText()||"{}");
  Logger.log(JSON.stringify(result,null,2));
  return result;
}
function mobihubRestoreTelegramWebhook() {
  var token=getBotToken_(), url=ScriptApp.getService().getUrl();
  if(!token) throw new Error("BOT_TOKEN is missing in the legacy bot project.");
  if(!url||url.indexOf("/exec")<0) throw new Error("Deploy the legacy bot as a Web App first (Anyone access).");
  var response=UrlFetchApp.fetch("https://api.telegram.org/bot"+token+"/setWebhook",{
    method:"post",contentType:"application/json",
    payload:JSON.stringify({url:url,drop_pending_updates:false}),muteHttpExceptions:true
  });
  var result=JSON.parse(response.getContentText()||"{}");
  Logger.log(JSON.stringify({url:url,result:result},null,2));
  if(!result.ok) throw new Error("setWebhook failed: "+response.getContentText());
  return {ok:true,url:url,description:result.description||"Webhook restored"};
}
function mobihubRemoveLegacyKeyboard(chatId) {
  if(!chatId) throw new Error("Provide Chat ID.");
  sendMessage_(String(chatId),"تم تحديث واجهة MobiHub. استخدم زر Open App لفتح خدمات الموظفين.",{remove_keyboard:true});
}


/**
 * Optional one-time broadcast: send ReplyKeyboardRemove to all active staff.
 * Run only when you intentionally want to remove the old persistent keyboard
 * from every employee chat. Telegram requires a message per chat to remove it.
 */
function mobihubRemoveLegacyKeyboardForAllEmployees() {
  var sheets=getSheets_();
  var employees=getSheetObjects_(sheets.emp);
  var sent=0,failed=0,skipped=0;
  employees.forEach(function(row) {
    var id=String(row["Chat ID"]||"").trim();
    var status=String(row["حالة الحساب"]||"نشط").trim();
    if(!/^\\d{5,20}$/.test(id)||status!=="نشط"){skipped++;return;}
    try {
      sendMessage_(id,
        "تم تحديث نظام MobiHub. استخدم زر Open App لفتح خدمات الموظفين.",
        {remove_keyboard:true});
      sent++;
    } catch(e) {
      failed++;
      console.error("Keyboard removal failed for "+id+": "+e);
    }
  });
  var result={sent:sent,failed:failed,skipped:skipped};
  Logger.log(JSON.stringify(result));
  return result;
}
