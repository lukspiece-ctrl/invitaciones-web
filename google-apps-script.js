const SHEET_NAME = "Confirmados";

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["invitacionId", "nombre", "cantidad", "telefono", "fecha"]);
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = getSheet();
  const data = JSON.parse(e.postData.contents || "{}");
  sheet.appendRow([
    data.invitacionId || "",
    data.nombre || "",
    Number(data.cantidad) || 1,
    data.telefono || "",
    data.fecha || new Date().toISOString()
  ]);
  return jsonResponse({ ok: true });
}

function doGet(e) {
  const sheet = getSheet();
  const id = String(e.parameter.id || "");
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1)
    .filter((row) => String(row[0]) === id)
    .map((row) => ({
      invitacionId: row[0],
      nombre: row[1],
      cantidad: row[2],
      telefono: row[3],
      fecha: row[4]
    }));
  return jsonResponse(rows);
}
