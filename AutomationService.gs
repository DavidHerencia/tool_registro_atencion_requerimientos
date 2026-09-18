function appendAutomationOutbox_(record) {
  try {
    var sheet = getAppSpreadsheet_().getSheetByName(SHEETS.OUTBOX);
    var row = [Utilities.getUuid(), new Date(), 'request.captured', record.requestId, record.ticket, JSON.stringify(record), 'PENDING', 0, ''];
    sheet.appendRow(row);
    return { queued: true };
  } catch (error) {
    console.warn('No se pudo agregar el evento al buzón de automatización: ' + error.message);
    return { queued: false, error: error.message };
  }
}
