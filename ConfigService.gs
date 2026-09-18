var CONFIG_CACHE_KEY = 'request-intake:published:v2';

function validateConfiguration() {
  var ss = getAppSpreadsheet_(), errors = [];
  var types = sheetObjects_(ss.getSheetByName(SHEETS.TYPES)), fields = sheetObjects_(ss.getSheetByName(SHEETS.FIELDS)), ids = {}, fieldKeys = {};
  types.forEach(function(type) {
    if (!type.type_id || ids[type.type_id]) errors.push('Los ID de tipo deben ser únicos: ' + type.type_id);
    ids[type.type_id] = true;
    if (!type.label || !type.code) errors.push('La etiqueta y el código son obligatorios: ' + type.type_id);
    if (asBool_(type.is_leaf) && !type.flow_key) errors.push('El tipo hoja requiere flow_key: ' + type.type_id);
  });
  types.forEach(function(type) {
    if (type.parent_id && !ids[type.parent_id]) errors.push('El tipo ' + type.type_id + ' referencia un padre inexistente: ' + type.parent_id);
    if (type.parent_id === type.type_id) errors.push('El tipo ' + type.type_id + ' no puede ser su propio padre.');
  });
  var leaves = types.filter(function(type) { return asBool_(type.is_leaf) && asBool_(type.active); });
  if (!leaves.length) errors.push('Debe existir al menos un tipo hoja activo.');
  fields.forEach(function(field) {
    if (!ids[field.request_type_id]) errors.push('El campo referencia un tipo inexistente: ' + field.field_key);
    if (!field.field_key || !field.field_type) errors.push('La clave y el tipo de campo son obligatorios.');
    var compositeKey = field.request_type_id + ':' + field.field_key;
    if (fieldKeys[compositeKey]) errors.push('El campo está duplicado para el tipo ' + field.request_type_id + ': ' + field.field_key);
    fieldKeys[compositeKey] = true;
  });
  leaves.forEach(function(type) {
    var activeFields = fields.filter(function(field) { return field.request_type_id === type.type_id && asBool_(field.active); });
    if (!activeFields.length) errors.push('El tipo hoja activo no tiene campos configurados: ' + type.type_id);
  });
  return { valid: !errors.length, errors: errors, leafCount: leaves.length, fieldCount: fields.length };
}

function publishConfiguration() {
  var validation = validateConfiguration();
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  var snapshot = buildConfigurationSnapshot_();
  snapshot.version = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 8);
  var json = JSON.stringify(snapshot);
  var checksum = checksum_(json), chunks = chunkString_(json, 45000), ss = getAppSpreadsheet_(), sheet = ss.getSheetByName(SHEETS.PUBLISHED);
  var existing = sheetObjects_(sheet), lastRow = sheet.getLastRow();
  var priorVersion = latestPublishedVersion_(existing, 'current') || latestPublishedVersion_(existing, 'previous');
  var rows = chunks.map(function(chunk, index) { return ['candidate', snapshot.version, new Date(), checksum, index, chunks.length, chunk]; });
  var candidateStartRow = sheet.getLastRow() + 1;
  sheet.getRange(candidateStartRow, 1, rows.length, rows[0].length).setValues(rows);
  SpreadsheetApp.flush();
  sheet.getRange(candidateStartRow, 1, rows.length, 1).setValues(rows.map(function() { return ['current']; }));
  SpreadsheetApp.flush();
  if (lastRow > 1) {
    var slots = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    sheet.getRange(2, 1, slots.length, 1).setValues(slots.map(function(row) { return [row[0] === 'current' ? 'previous' : row[0]]; }));
  }
  SpreadsheetApp.flush();
  compactPublishedSnapshots_(sheet, snapshot.version, priorVersion);
  putConfigCacheSafely_(snapshot.version, json);
  return { version: snapshot.version, checksum: checksum, chunks: chunks.length };
}

function compactPublishedSnapshots_(sheet, currentVersion, previousVersion) {
  if (!previousVersion || previousVersion === currentVersion) return;
  try {
    var values = sheet.getDataRange().getValues(), header = values.shift();
    var keep = values.filter(function(row) { return row[1] === currentVersion || row[1] === previousVersion; }).map(function(row) { row[0] = row[1] === currentVersion ? 'current' : 'previous'; return row; });
    sheet.getRange(2, 1, sheet.getLastRow() - 1, header.length).clearContent();
    sheet.getRange(2, 1, keep.length, header.length).setValues(keep);
  } catch (error) { console.warn('No se pudo compactar las instantáneas antiguas: ' + error.message); }
}

function getPublishedConfiguration(requestedVersion) {
  var ss = getAppSpreadsheet_(), sheet = ss.getSheetByName(SHEETS.PUBLISHED), rows = sheetObjects_(sheet);
  if (!rows.length) throw new Error('No existe una configuración publicada. Ejecute la configuración, valide y publique antes de abrir la aplicación.');
  var byVersion = {};
  rows.forEach(function(row) { if (row.slot === 'current' || row.slot === 'previous') (byVersion[row.version] = byVersion[row.version] || []).push(row); });
  var version = requestedVersion || latestPublishedVersion_(rows, 'current');
  if (!version || !byVersion[version]) throw new Error('La versión de configuración ya no está disponible. Recargue la aplicación para obtener la versión publicada actual.');
  var chunks = byVersion[version].sort(function(a, b) { return Number(a.chunk_index) - Number(b.chunk_index); });
  if (chunks.length !== Number(chunks[0].chunk_count)) throw new Error('La configuración publicada está incompleta. Publíquela nuevamente.');
  var cachedVersion = CacheService.getScriptCache().get(CONFIG_CACHE_KEY + ':' + version);
  if (cachedVersion && checksum_(cachedVersion) === chunks[0].checksum) return JSON.parse(cachedVersion);
  var json = chunks.map(function(chunk) { return chunk.json_chunk; }).join('');
  if (checksum_(json) !== chunks[0].checksum) throw new Error('La suma de verificación de la configuración no coincide. Publíquela nuevamente.');
  putConfigCacheSafely_(version, json);
  return JSON.parse(json);
}

function buildConfigurationSnapshot_() {
  var ss = getAppSpreadsheet_(), config = {};
  sheetObjects_(ss.getSheetByName(SHEETS.CONFIG)).forEach(function(row) { config[row.key] = row.value; });
  var types = sheetObjects_(ss.getSheetByName(SHEETS.TYPES)).filter(function(row) { return asBool_(row.active); });
  var fields = sheetObjects_(ss.getSheetByName(SHEETS.FIELDS)).filter(function(row) { return asBool_(row.active); });
  return { schemaVersion: config.schema_version || '1', generatedAt: new Date().toISOString(), settings: config, types: types, fields: fields, leafTypes: types.filter(function(type) { return asBool_(type.is_leaf); }) };
}

function putConfigCacheSafely_(version, json) {
  if (json.length > 90000) return;
  try { CacheService.getScriptCache().put(CONFIG_CACHE_KEY + ':' + version, json, 21600); }
  catch (error) { console.warn('No se pudo guardar la configuración en caché: ' + error.message); }
}
function latestPublishedVersion_(rows, slot) {
  return rows.filter(function(row) { return row.slot === slot; }).sort(function(a, b) {
    return new Date(a.published_at).getTime() - new Date(b.published_at).getTime();
  }).map(function(row) { return row.version; }).pop();
}
function checksum_(text) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text)).slice(0, 24); }
function sheetObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues(), headers = values.shift();
  return values.filter(function(row) { return row.some(function(value) { return value !== ''; }); }).map(function(row) { var object = {}; headers.forEach(function(header, index) { object[header] = row[index]; }); return object; });
}
function asBool_(value) { return value === true || String(value).toLowerCase() === 'true'; }
function chunkString_(text, size) { var chunks = []; for (var i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size)); return chunks; }
