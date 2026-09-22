/** Primitivas de Sheets y utilidades comunes. */

/** Ejecutar una vez al instalar esta base. No elimina ni reordena datos existentes. */
function initializeProject() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Abra el proyecto desde el Google Sheet que usará la aplicación.');
  PropertiesService.getScriptProperties().setProperty(APP.spreadsheet_property, ss.getId());

  Object.keys(SHEET_DEFINITIONS).forEach(function(sheetName) {
    ensureInitialSheet_(ss, sheetName);
  });

  return 'Proyecto inicializado.';
}

function getAppSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty(APP.spreadsheet_property);
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('No hay Spreadsheet configurado. Ejecute initializeProject() una vez.');
  return active;
}

/** Crea la hoja inicial o reutiliza su nombre legado. Agrega columnas faltantes, nunca borra. */
function ensureInitialSheet_(ss, sheetName) {
  var definition = getSheetDefinition_(sheetName);
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    for (var i = 0; i < definition.legacy_names.length; i++) {
      var legacy = ss.getSheetByName(definition.legacy_names[i]);
      if (legacy) {
        legacy.setName(sheetName);
        sheet = legacy;
        break;
      }
    }
  }

  if (!sheet) sheet = ss.insertSheet(sheetName);
  ensureColumns_(sheet, sheetName);
  return sheet;
}

/** Agrega columnas conocidas que no existan. No intenta resolver migraciones complejas. */
function ensureColumns_(sheet, sheetName) {
  var definition = getSheetDefinition_(sheetName);
  var lastColumn = sheet.getLastColumn();
  var headers = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];
  var normalized = {};
  headers.forEach(function(header, index) { normalized[normalizeHeader_(header)] = index + 1; });

  definition.columns.forEach(function(column) {
    var existing = findHeaderIndexFromList_(headers, column);
    if (existing) return;
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue(displayHeader_(column));
    headers.push(displayHeader_(column));
  });

  if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);
}

function displayHeader_(column) {
  return column.archived ? '[Archivado] ' + column.label : column.label;
}

function normalizeHeader_(value) {
  return String(value || '')
    .replace(/^\[Archivado\]\s*/i, '')
    .trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function findHeaderIndexFromList_(headers, column) {
  var names = [column.key, column.label].concat(column.aliases || []);
  for (var i = 0; i < headers.length; i++) {
    var header = normalizeHeader_(headers[i]);
    for (var j = 0; j < names.length; j++) {
      if (header === normalizeHeader_(names[j])) return i + 1;
    }
  }
  return 0;
}

function getHeaderMap_(sheetName) {
  var sheet = getAppSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('No existe la hoja: ' + sheetName);
  var lastColumn = sheet.getLastColumn();
  if (!lastColumn) return {};
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var definition = getSheetDefinition_(sheetName);
  var map = {};
  definition.columns.forEach(function(column) {
    var index = findHeaderIndexFromList_(headers, column);
    if (index) map[column.key] = index;
  });
  return map;
}

function appendRecord_(sheetName, record) {
  var sheet = getAppSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('No existe la hoja: ' + sheetName);
  var map = getHeaderMap_(sheetName);
  var width = sheet.getLastColumn();
  var row = new Array(width).fill('');
  Object.keys(record).forEach(function(key) {
    var column = map[key];
    if (column) row[column - 1] = serializeCellValue_(record[key]);
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, width).setValues([row]);
}

function serializeCellValue_(value) {
  if (Array.isArray(value)) return value.join('\n');
  if (value === undefined || value === null) return '';
  return value;
}

/** Busca por una sola columna; no recorre toda la hoja en memoria. */
function findRecordByKey_(sheetName, key, value) {
  if (value === undefined || value === null || value === '') return null;
  var sheet = getAppSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var map = getHeaderMap_(sheetName);
  var column = map[key];
  if (!column) throw new Error('Falta la columna "' + key + '" en "' + sheetName + '".');
  var match = sheet.getRange(2, column, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(value)).matchEntireCell(true).matchCase(false).findNext();
  return match ? readRecordAtRow_(sheetName, match.getRow()) : null;
}

function findRecordsByKey_(sheetName, key, value, limit) {
  var sheet = getAppSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var map = getHeaderMap_(sheetName), column = map[key];
  if (!column) return [];
  var matches = sheet.getRange(2, column, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(value)).matchEntireCell(true).matchCase(false).findAll();
  if (limit) matches = matches.slice(0, limit);
  return matches.map(function(cell) { return readRecordAtRow_(sheetName, cell.getRow()); });
}

function readRecordAtRow_(sheetName, rowNumber) {
  var sheet = getAppSpreadsheet_().getSheetByName(sheetName);
  var width = sheet.getLastColumn();
  var values = sheet.getRange(rowNumber, 1, 1, width).getValues()[0];
  var map = getHeaderMap_(sheetName), record = {};
  Object.keys(map).forEach(function(key) { record[key] = values[map[key] - 1]; });
  return record;
}

/** Búsqueda parcial de catálogo para autocompletados. */
function searchSheet_(sheetName, query, searchKeys, maxResults, predicate) {
  query = String(query || '').trim();
  if (!query) return [];
  var sheet = getAppSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var map = getHeaderMap_(sheetName), rows = {}, lastRow = sheet.getLastRow();

  searchKeys.forEach(function(key) {
    var column = map[key];
    if (!column || Object.keys(rows).length >= maxResults * 3) return;
    var found = sheet.getRange(2, column, lastRow - 1, 1)
      .createTextFinder(query).matchCase(false).matchEntireCell(false).findAll();
    for (var i = 0; i < found.length && Object.keys(rows).length < maxResults * 3; i++) rows[found[i].getRow()] = true;
  });

  var result = [];
  Object.keys(rows).map(Number).sort(function(a, b) { return a - b; }).some(function(rowNumber) {
    var record = readRecordAtRow_(sheetName, rowNumber);
    if (!predicate || predicate(record)) result.push(record);
    return result.length >= maxResults;
  });
  return result;
}

function readAllRecords_(sheetName) {
  var sheet = getAppSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var map = getHeaderMap_(sheetName), width = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  return values.map(function(row) {
    var record = {};
    Object.keys(map).forEach(function(key) { record[key] = row[map[key] - 1]; });
    return record;
  }).filter(function(record) {
    return Object.keys(record).some(function(key) { return record[key] !== ''; });
  });
}

function isTrue_(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

/** Helper para una migración futura: marca y opcionalmente oculta una columna ya archivada globalmente. */
function archiveFieldColumn_(fieldId, hideColumn) {
  if (isFieldGloballyActive_(fieldId)) throw new Error('El campo todavía está activo en al menos una solicitud.');
  var field = getFieldDefinition_(fieldId);
  if (!field) throw new Error('Campo desconocido: ' + fieldId);
  var sheet = getAppSpreadsheet_().getSheetByName(SHEETS.REGISTRY);
  var map = getHeaderMap_(SHEETS.REGISTRY), column = map[fieldId];
  if (!column) return;
  sheet.getRange(1, column).setValue('[Archivado] ' + field.column.label);
  if (hideColumn === true) sheet.hideColumns(column);
}
