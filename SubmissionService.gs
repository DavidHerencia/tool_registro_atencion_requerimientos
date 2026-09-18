function submitRequest(formData) {
  formData = formData || {};
  var typeId = formData.request_type_id, idempotencyKey = formData.idempotency_key;
  if (!idempotencyKey) throw new Error('Falta la clave de idempotencia. Recargue el formulario e inténtelo nuevamente.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var existing = findLedger_(idempotencyKey);
    if (existing && existing.status === 'CONFIRMED' && existing.response_json) return JSON.parse(existing.response_json);
    var validation = validateSubmission(typeId, formData);
    if (!validation.valid) return { ok: false, validation: validation };
    var config = getPublishedConfiguration(validation.configVersion);
    var type = config.leafTypes.filter(function(item) { return item.type_id === typeId; })[0];
    var workspace = existing && existing.response_json ? JSON.parse(existing.response_json) : null;
    var requestId = workspace && workspace.requestId || Utilities.getUuid();
    var ticket = workspace && workspace.ticket || nextTicket_();
    var now = new Date();
    var requester = Session.getActiveUser().getEmail();
    var requesterSource = requester ? 'active_user' : 'provided_fallback';
    if (!requester) requester = validation.normalized.requester_email;
    if (!requester) return { ok: false, validation: { valid: false, errors: { requester_email: 'Ingrese su correo corporativo para identificar la solicitud.' }, warnings: [] } };
    var maintenanceId = workspace && workspace.maintenanceId || (type.destination === 'maintenance' ? 'MNT-' + Utilities.getUuid() : '');
    if (!existing) {
      appendObjectRow_(getAppSpreadsheet_().getSheetByName(SHEETS.LEDGER), HEADERS[SHEETS.LEDGER], { idempotency_key: idempotencyKey, request_id: requestId, ticket: ticket, status: 'PENDING', created_at: now, response_json: JSON.stringify({ pending: true, requestId: requestId, ticket: ticket, maintenanceId: maintenanceId, evidence: { links: [], byField: {} } }) });
    }
    var evidence = workspace && workspace.evidence ? workspace.evidence : { links: [], byField: {} };
    evidence = collectEvidence_(formData, requestId, ticket, config, evidence, function(partialEvidence) {
      updateLedger_(idempotencyKey, 'PENDING', JSON.stringify({ pending: true, requestId: requestId, ticket: ticket, maintenanceId: maintenanceId, evidence: partialEvidence }));
    });
    updateLedger_(idempotencyKey, 'PENDING', JSON.stringify({ pending: true, requestId: requestId, ticket: ticket, maintenanceId: maintenanceId, evidence: evidence }));
    applyEvidenceToNormalizedData_(validation.normalized, evidence);
    var maintenance = null;
    if (type.destination === 'maintenance') maintenance = buildMaintenanceRow_(requestId, type, validation.normalized, evidence, maintenanceId);
    var record = buildRegistryRecord_(requestId, ticket, now, requester, requesterSource, type, validation.normalized, maintenance, idempotencyKey, validation.configVersion);
    if (!findRegistry_(requestId)) appendObjectRow_(getAppSpreadsheet_().getSheetByName(SHEETS.REGISTRY), HEADERS[SHEETS.REGISTRY], record);
    if (maintenance && !findMaintenance_(requestId)) getAppSpreadsheet_().getSheetByName(SHEETS.MAINTENANCE).appendRow(maintenance.row);
    SpreadsheetApp.flush();
    var response = { ok: true, requestId: requestId, ticket: ticket, submittedAt: now.toISOString(), maintenanceId: maintenance && maintenance.maintenanceId, warnings: validation.warnings || [] };
    var confirmed = findRegistry_(requestId);
    if (!confirmed || (maintenance && !findMaintenance_(requestId))) throw new Error('No se pudo confirmar la escritura de la solicitud. Inténtelo nuevamente con la misma solicitud.');
    response.automation = findOutbox_(requestId) || appendAutomationOutbox_({ requestId: requestId, ticket: ticket, typeId: typeId, typeCode: type.code, payload: validation.normalized });
    updateLedger_(idempotencyKey, 'CONFIRMED', JSON.stringify(response));
    return response;
  } finally { lock.releaseLock(); }
}

function buildRegistryRecord_(requestId, ticket, now, email, emailSource, type, data, maintenance, idempotencyKey, configVersion) {
  var entity = resolveProcess_(data.source_entity || data.target_entity || data.existing_diagram || data.process_taxonomy);
  var parts = splitProcessVariant_(entity), process = parts.process, variant = parts.variant;
  return {
    request_id: requestId, ticket: ticket, submitted_at: now, year: now.getFullYear(), requester_name: data.requester_name || '', requester_email: email, requester_email_source: emailSource, status: 'NUEVA',
    type_id: type.type_id, type_code: type.code, type_label: type.label, flow_key: type.flow_key,
    subject_p_registro: data.p_registro || '', subject_first_names: data.first_names || '', subject_last_names: data.last_names || '', aris_url: data.aris_folder_url || data.aris_diagram_url || '', reason_summary: data.access_reason || data.reason || data.need_detail || data.feedback_detail || data.question || '', evidence_links: (data.evidence_links || []).join('\n'),
    process_id: process && process.process_id || '', process_taxonomy: process && process.taxonomy || '', process_name: process && process.name || '',
    variant_id: variant && variant.process_id || '', variant_taxonomy: variant && variant.taxonomy || '', variant_name: variant && variant.name || '',
    user_id: resolveUser_(data.new_owner) && resolveUser_(data.new_owner).user_id || '', user_name: resolveUser_(data.new_owner) && resolveUser_(data.new_owner).full_name || '',
    operations: type.flow_key, related_entity_ids: JSON.stringify(data.merge_entities || []), maintenance_id: maintenance && maintenance.maintenanceId || '',
    payload_json: JSON.stringify(data), payload_version: '1', config_version: configVersion, idempotency_key: idempotencyKey, assigned_to: '', internal_notes: ''
  };
}
function applyEvidenceToNormalizedData_(data, evidence) {
  Object.keys(evidence.byField || {}).forEach(function(key) { data[key] = evidence.byField[key].join('\n'); });
  data.evidence_links = evidence.links || [];
  delete data._uploads;
}
function appendObjectRow_(sheet, headers, object) { sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([headers.map(function(header) { return object[header] === undefined ? '' : object[header]; })]); }
function findLedger_(idempotencyKey) { return sheetObjects_(getAppSpreadsheet_().getSheetByName(SHEETS.LEDGER)).filter(function(row) { return row.idempotency_key === idempotencyKey; })[0] || null; }
function findRegistry_(requestId) { return sheetObjects_(getAppSpreadsheet_().getSheetByName(SHEETS.REGISTRY)).filter(function(row) { return row.request_id === requestId; })[0] || null; }
function findMaintenance_(requestId) { return sheetObjects_(getAppSpreadsheet_().getSheetByName(SHEETS.MAINTENANCE)).filter(function(row) { return row.request_id === requestId; })[0] || null; }
function findOutbox_(requestId) { var found = sheetObjects_(getAppSpreadsheet_().getSheetByName(SHEETS.OUTBOX)).filter(function(row) { return row.request_id === requestId; })[0]; return found ? { queued: true, existing: true } : null; }
function updateLedger_(idempotencyKey, status, responseJson) {
  var sheet = getAppSpreadsheet_().getSheetByName(SHEETS.LEDGER), rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) if (rows[i][0] === idempotencyKey) { sheet.getRange(i + 1, 4).setValue(status); sheet.getRange(i + 1, 6).setValue(responseJson); return; }
  throw new Error('No se encontró el registro de idempotencia de la solicitud.');
}
function nextTicket_() {
  var year = new Date().getFullYear(), key = 'request-intake:sequence:' + year, properties = PropertiesService.getScriptProperties();
  var sequence = Number(properties.getProperty(key) || '0') + 1;
  properties.setProperty(key, String(sequence));
  return 'REQ-' + year + '-' + ('000000' + sequence).slice(-6);
}
