/** Entradas del proyecto vinculado a la hoja de cálculo. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Configuración de solicitudes')
    .addItem('Configurar hojas del proyecto', 'setupProject')
    .addItem('Validar configuración', 'validateConfiguration')
    .addItem('Publicar configuración', 'publishConfiguration')
    .addSeparator()
    .addItem('Ejecutar pruebas internas', 'runSelfTests')
    .addToUi();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Registro de solicitudes');
}

function bootstrapApp() {
  var config = getPublishedConfiguration();
  var users = getCatalogRows_(SHEETS.USERS).filter(function(row) { return asBool_(row.active); });
  var processes = getCatalogRows_(SHEETS.PROCESSES).filter(function(row) { return asBool_(row.active); });
  var team = getCatalogRows_(SHEETS.TEAM).filter(function(row) { return asBool_(row.active); });
  return {
    config: config,
    configVersion: config.version,
    identity: { email: Session.getActiveUser().getEmail() || '' },
    settings: config.settings,
    types: config.types,
    leafTypes: config.leafTypes,
    fields: config.fields,
    users: users,
    processes: processes,
    teamContacts: team
  };
}

function runSelfTests() {
  setupProject();
  var validation = validateConfiguration();
  if (!validation.valid) throw new Error('La validación de configuración falló: ' + validation.errors.join('; '));
  var published = publishConfiguration();
  var config = getPublishedConfiguration();
  var checks = [
    ['la configuración publicada carga', !!config && config.types.length >= config.leafTypes.length],
    ['existe al menos un tipo hoja publicado', config.leafTypes.length > 0],
    ['existe configuración de campos', config.fields.length > 0],
    ['existe versión publicada', !!published.version]
  ];
  var failures = checks.filter(function(check) { return !check[1]; }).map(function(check) { return check[0]; });
  if (failures.length) throw new Error('La prueba interna falló: ' + failures.join(', '));
  return { ok: true, checks: checks, version: published.version };
}
