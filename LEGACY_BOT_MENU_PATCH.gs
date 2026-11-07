/**
 * MobiHub legacy bot — replace the existing sendMainMenu_ function with this.
 * This removes the old persistent employee Reply Keyboard after /start or menu refresh.
 * Keep temporary keyboards for location, uniform confirmation and cancel flows.
 */
function sendMainMenu_(chatId, text, sheets) {
  return sendMessage_(
    chatId,
    String(text || "تم تحديث نظام MobiHub. افتح التطبيق من زر Open App في ملف البوت."),
    { remove_keyboard: true },
    sheets
  );
}
