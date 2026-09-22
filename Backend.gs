/** Entradas y lógica de negocio genérica. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Registro de solicitudes');
}

function bootstrapApp() {
  var config = getAppConfiguration_();
  return {
    config: config,
    configVersion: config.version,
    identity: { email: Session.getActiveUser().getEmail() || '' },
    teamContacts: readAllRecords_(SHEETS.TEAM).filter(function(row) { return isTrue_(row.active); })
  };
}

/** Búsqueda bajo demanda. Evita enviar catálogos completos al navegador. */
function searchCatalog(sourceRef, query, level) {
  query = String(query || '').trim();
  if (query.length < Number(APP.settings.catalog_search_min_chars || 2)) return [];
  var max = Number(APP.settings.max_catalog_results || 12);

  if (sourceRef === 'users') {
    return searchSheet_(SHEETS.USERS, query, ['p_registro', 'full_name', 'email'], max, function(row) {
      return isTrue_(row.active);
    });
  }

  if (sourceRef === 'processes') {
    return searchSheet_(SHEETS.PROCESSES, query, ['taxonomy', 'name', 'description'], max, function(row) {
      return isTrue_(row.active) && (!level || String(row.level) === String(level));
    });
  }

  return [];
}

function validateSubmission_(typeId, rawData) {
  rawData = rawData || {};
  var config = getAppConfiguration_();
  if (rawData.config_version !== config.version) {
    return { valid: false, errors: { config_version: 'La configuración cambió. Recargue la página.' }, warnings: [] };
  }

  var type = getRequestType_(typeId);
  if (!type || type.status !== 'active' || type.kind !== 'request') {
    return { valid: false, errors: { request_type_id: 'Seleccione un tipo de solicitud válido.' }, warnings: [] };
  }

  var data = normalizeSubmissionData_(rawData);
  var fields = config.fields.filter(function(field) { return field.request_type_id === type.id; });
  var errors = {}, warnings = [];

  fields.forEach(function(field) {
    if (!isVisible_(field, data)) return;
    var required = field.required === true;
    if (field.validator === 'corporate_email' && Session.getActiveUser().getEmail()) required = false;
    if (required && !hasFieldValue_(data, field.field_key)) errors[field.field_key] = field.label + ' es obligatorio.';
    if (hasFieldValue_(data, field.field_key) && field.validator) validateField_(field, data[field.field_key], data, errors, warnings);
  });

  if (!Session.getActiveUser().getEmail() && isEmpty_(data.requester_email)) errors.requester_email = 'Ingrese su correo corporativo.';
  validateUploads_(rawData, config, fields, data, errors);
  validateSpecialFlow_(type, data, errors, warnings);

  return { valid: Object.keys(errors).length === 0, errors: errors, warnings: warnings, normalized: data, configVersion: config.version };
}

function normalizeSubmissionData_(raw) {
  var data = { _uploads: {} };
  Object.keys(raw || {}).forEach(function(key) {
    var value = raw[key];
    if (key.slice(-5) === '_file') {
      if (isBlob_(value)) data._uploads[key.slice(0, -5)] = value;
      return;
    }
    if (key === 'selected_entities') {
      try { data.merge_entities = JSON.parse(value || '[]'); } catch (error) { data.merge_entities = []; }
      return;
    }
    data[key] = value;
  });
  return data;
}

function isVisible_(field, data) {
  if (!field.show_when_field) return true;
  var value = data[field.show_when_field];
  if (field.show_when_operator === 'equals') return String(value) === String(field.show_when_value);
  if (field.show_when_operator === 'not_equals') return String(value) !== String(field.show_when_value);
  return true;
}

function isEmpty_(value) { return value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length); }
function hasFieldValue_(data, key) { return !isEmpty_(data[key]) || !!data._uploads[key]; }
function isBlob_(value) { return value && typeof value.getBytes === 'function' && typeof value.getName === 'function'; }
function isNonEmptyBlob_(value) { return isBlob_(value) && value.getBytes().length > 0; }

function validateUploads_(raw, config, fields, data, errors) {
  var maxBytes = Number(config.settings.max_upload_mb || 10) * 1024 * 1024;
  fields.forEach(function(field) {
    var blob = raw[field.field_key + '_file'];
    if (!blob || blob === '__archivo__') return;
    if (!isNonEmptyBlob_(blob)) { errors[field.field_key] = 'El archivo seleccionado está vacío.'; return; }
    if (blob.getBytes().length > maxBytes) { errors[field.field_key] = 'El archivo supera el límite permitido.'; return; }
    var name = String(blob.getName() || '').toLowerCase();
    if (field.field_type === 'xml_text_or_file' && !/\.xml$/.test(name)) errors[field.field_key] = 'Adjunte un archivo XML válido.';
  });
}

function validateField_(field, value, data, errors, warnings) {
  var key = field.field_key, validator = field.validator;
  if (validator === 'corporate_email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) errors[key] = 'Ingrese un correo válido.';
  if (validator === 'p_registro' && !/^P[0-9]{4,}$/i.test(String(value))) errors[key] = 'Ingrese un P-registro válido.';
  if (validator === 'url' && !/^https?:\/\//i.test(String(value))) errors[key] = 'Ingrese una URL válida.';
  if (validator === 'positive_integer' && (!/^\d+$/.test(String(value)) || Number(value) < 1)) errors[key] = 'Ingrese un entero positivo.';
  if (validator === 'max_lines' && String(value).split(/\r?\n/).length > 3) errors[key] = 'Use como máximo tres líneas.';
  if (validator === 'role_map' && String(value).split(/\r?\n/).some(function(line) { return line.trim() && line.indexOf('**') < 0; })) errors[key] = 'Use: carril ** equipo.';
  if (validator === 'xml' && !data._uploads[key] && String(value).trim().indexOf('<') < 0) errors[key] = 'Pegue XML válido o adjunte un archivo XML.';

  if (validator === 'catalog_required' || validator === 'catalog_required_n4' || validator === 'catalog_required_variant') {
    var process = resolveProcess_(value);
    if (!process) errors[key] = 'Seleccione un resultado existente del catálogo.';
    else if (validator === 'catalog_required_n4' && process.level !== 'N4') errors[key] = 'Seleccione un proceso N4.';
    else if (validator === 'catalog_required_variant' && process.level !== 'N5') errors[key] = 'Seleccione una variante.';
  }

  if (validator === 'user_or_unassigned' && value !== 'unassigned' && !resolveUser_(value)) errors[key] = 'Seleccione un usuario o Por asignar.';

  if (validator === 'min_two_variants') {
    var ids = Array.isArray(value) ? value : [];
    if (ids.length < 2) errors[key] = 'Agregue al menos dos variantes.';
    else if (ids.some(function(id) { var entity = resolveProcess_(id); return !entity || entity.level !== 'N5'; })) errors[key] = 'Todas deben ser variantes existentes.';
  }
}

/** Solo contiene reglas que realmente requieren lógica adicional al contrato declarativo. */
function validateSpecialFlow_(type, data, errors, warnings) {
  var flow = type.flow || '';
  if (flow.indexOf('maint_') === 0 && data.is_process_owner === 'no' && !hasFieldValue_(data, 'owner_evidence')) errors.owner_evidence = 'El sustento del Process Owner es obligatorio.';
  if ((flow === 'maint_n4' || flow === 'maint_variant') && !data.change_name && !data.change_description) errors.change_name = 'Seleccione un cambio.';
  if ((flow === 'maint_n4' || flow === 'maint_variant') && data.change_name && isEmpty_(data.target_name)) errors.target_name = 'Ingrese el nuevo nombre.';
  if ((flow === 'maint_n4' || flow === 'maint_variant') && data.change_description && isEmpty_(data.target_description)) errors.target_description = 'Ingrese la nueva descripción.';
  if (flow === 'maint_new_variant' && !data.same_as_n4_description && isEmpty_(data.target_description)) errors.target_description = 'Ingrese la descripción.';

  if (flow === 'maint_owner') {
    var ownerEntity = resolveProcess_(data.source_entity);
    if (ownerEntity && ((data.owner_scope === 'n4' && ownerEntity.level !== 'N4') || (data.owner_scope === 'variant' && ownerEntity.level !== 'N5'))) errors.owner_scope = 'El alcance no coincide con la entidad.';
  }

  if (flow === 'maint_enter_perimeter' || flow === 'maint_leave_perimeter') {
    var source = resolveProcess_(data.source_entity), expected = flow === 'maint_enter_perimeter' ? 'OUT' : 'IN';
    if (source && source.perimeter !== expected) errors.source_entity = 'El proceso no es elegible para esta acción.';
  }

  if (flow === 'maint_new_variant') validateNewVariant_(data, errors, warnings);
}

function resolveProcess_(value) {
  if (!value) return null;
  return findRecordByKey_(SHEETS.PROCESSES, 'process_id', value) || findRecordByKey_(SHEETS.PROCESSES, 'taxonomy', value);
}

function resolveUser_(value) {
  if (!value) return null;
  return findRecordByKey_(SHEETS.USERS, 'user_id', value) || findRecordByKey_(SHEETS.USERS, 'p_registro', value);
}

function validateNewVariant_(data, errors, warnings) {
  var parent = resolveProcess_(data.source_entity), proposed = String(data.new_variant_taxonomy || '').trim();
  if (!parent || !proposed) return;
  if (resolveProcess_(proposed)) { errors.new_variant_taxonomy = 'Esta taxonomía ya existe.'; return; }
  var match = proposed.match(/_P(\d+)$/i);
  if (!match || proposed.indexOf(parent.taxonomy + '_P') !== 0) {
    errors.new_variant_taxonomy = 'Use una taxonomía bajo el N4 seleccionado.';
    return;
  }
  var children = findRecordsByKey_(SHEETS.PROCESSES, 'parent_process_id', parent.process_id);
  var expected = children.reduce(function(maximum, row) {
    var suffix = String(row.taxonomy || '').match(/_P(\d+)$/i);
    return suffix ? Math.max(maximum, Number(suffix[1])) : maximum;
  }, 0) + 1;
  if (Number(match[1]) !== expected) warnings.push('El siguiente sufijo esperado es P' + ('0' + expected).slice(-2) + '.');
}

function submitRequest(formData) {
  formData = formData || {};
  var idempotencyKey = formData.idempotency_key;
  if (!idempotencyKey) throw new Error('Falta la clave de idempotencia. Recargue el formulario.');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var existing = findRecordByKey_(SHEETS.REGISTRY, 'idempotency_key', idempotencyKey);
    if (existing) return registryResponse_(existing);

    var validation = validateSubmission_(formData.request_type_id, formData);
    if (!validation.valid) return { ok: false, validation: validation };

    var type = getRequestType_(formData.request_type_id);
    var now = new Date(), requestId = Utilities.getUuid(), ticket = nextTicket_();
    var maintenanceId = type.destination === 'maintenance' ? 'MNT-' + Utilities.getUuid() : '';
    var evidence = collectEvidence_(formData, requestId, ticket, getAppConfiguration_());
    applyEvidence_(validation.normalized, evidence);

    var activeEmail = Session.getActiveUser().getEmail() || '';
    var requesterEmail = activeEmail || validation.normalized.requester_email || '';
    if (!requesterEmail) throw new Error('No se pudo identificar el correo de la persona solicitante.');

    var record = buildRegistryRecord_(requestId, ticket, now, type, validation.normalized, requesterEmail, activeEmail ? 'active_user' : 'provided_fallback', maintenanceId, idempotencyKey, validation.configVersion);
    appendRecord_(SHEETS.REGISTRY, record);

    if (type.destination === 'maintenance') {
      appendRecord_(SHEETS.MAINTENANCE, buildMaintenanceRecord_(maintenanceId, requestId, now, type, validation.normalized, evidence));
    }

    SpreadsheetApp.flush();
    var automation = appendAutomationOutbox_({ requestId: requestId, ticket: ticket });
    return { ok: true, requestId: requestId, ticket: ticket, submittedAt: now.toISOString(), maintenanceId: maintenanceId, warnings: validation.warnings || [], automation: automation };
  } finally {
    lock.releaseLock();
  }
}

function buildRegistryRecord_(requestId, ticket, now, type, data, email, emailSource, maintenanceId, idempotencyKey, configVersion) {
  var record = {
    request_id: requestId,
    ticket: ticket,
    submitted_at: now,
    year: now.getFullYear(),
    type_id: type.id,
    type_code: type.code,
    type_label: type.label,
    config_version: configVersion,
    status: 'Nueva',
    requester_email_source: emailSource,
    maintenance_id: maintenanceId || '',
    idempotency_key: idempotencyKey,
    assigned_to: '',
    internal_notes: ''
  };

  getRequestBindings_(type.id, false).forEach(function(binding) {
    var field = getFieldDefinition_(binding.field_id);
    if (!field || field.status !== 'active') return;
    var value = data[field.id];
    if (field.id === 'requester_email') value = email;
    record[field.id] = value === undefined ? '' : value;
  });
  return record;
}

function registryResponse_(row) {
  return { ok: true, requestId: row.request_id, ticket: row.ticket, submittedAt: String(row.submitted_at || ''), maintenanceId: row.maintenance_id || '', warnings: [], automation: findRecordByKey_(SHEETS.OUTBOX, 'request_id', row.request_id) ? { queued: true } : { queued: false } };
}

function nextTicket_() {
  var year = new Date().getFullYear(), key = 'request-intake:sequence:' + year;
  var properties = PropertiesService.getScriptProperties();
  var sequence = Number(properties.getProperty(key) || '0') + 1;
  properties.setProperty(key, String(sequence));
  return 'REQ-' + year + '-' + ('000000' + sequence).slice(-6);
}

function buildMaintenanceRecord_(maintenanceId, requestId, now, type, data, evidence) {
  var source = resolveProcess_(data.source_entity), target = resolveProcess_(data.target_entity);
  var sourceParts = splitProcessVariant_(source), targetParts = splitProcessVariant_(target);

  if (type.flow === 'maint_move_variant' && sourceParts.variant && target && target.level === 'N4') targetParts = { process: target, variant: sourceParts.variant };
  if (type.flow === 'maint_new_variant') targetParts = { process: sourceParts.process, variant: { taxonomy: data.new_variant_taxonomy || '', name: data.target_name || '', description: data.same_as_n4_description ? (sourceParts.process && sourceParts.process.description || '') : (data.target_description || '') } };
  if (!targetParts.process && sourceParts.process && ['maint_n4','maint_variant','maint_owner'].indexOf(type.flow) >= 0) targetParts = { process: sourceParts.process, variant: sourceParts.variant };

  var sp = sourceParts.process || {}, sv = sourceParts.variant || {}, tp = targetParts.process || {}, tv = targetParts.variant || {};
  var targetProcessName = tp.name || '', targetProcessDescription = tp.description || '', targetVariantName = tv.name || '', targetVariantDescription = tv.description || '';
  if (type.flow === 'maint_n4') { if (data.change_name) targetProcessName = data.target_name; if (data.change_description) targetProcessDescription = data.target_description; }
  if (type.flow === 'maint_variant') { if (data.change_name) targetVariantName = data.target_name; if (data.change_description) targetVariantDescription = data.target_description; }

  return {
    maintenance_id: maintenanceId,
    request_id: requestId,
    submitted_at: now,
    requester_name: data.requester_name || '',
    action: type.label,
    source_process_id: sp.process_id || '', source_process_taxonomy: sp.taxonomy || '', source_process_name: sp.name || '', source_process_description: sp.description || '',
    source_variant_id: sv.process_id || '', source_variant_taxonomy: sv.taxonomy || '', source_variant_name: sv.name || '', source_variant_description: sv.description || '', source_process_owner: sv.process_owner_name || sp.process_owner_name || '',
    target_process_id: tp.process_id || '', target_process_taxonomy: tp.taxonomy || '', target_process_name: targetProcessName, target_process_description: targetProcessDescription,
    target_variant_id: tv.process_id || '', target_variant_taxonomy: tv.taxonomy || data.new_variant_taxonomy || '', target_variant_name: targetVariantName, target_variant_description: targetVariantDescription,
    target_process_owner: ownerLabel_(data.new_owner) || tv.process_owner_name || tp.process_owner_name || '',
    comment: data.comment || '',
    evidence_text: data.is_process_owner === 'yes' ? 'La persona solicitante indicó ser Process Owner.' : '',
    evidence_links: evidence.links || [],
    reason: data.reason || ''
  };
}

function splitProcessVariant_(entity) {
  if (!entity) return { process: null, variant: null };
  if (entity.level === 'N5') return { process: resolveProcess_(entity.parent_process_id), variant: entity };
  return { process: entity, variant: null };
}

function ownerLabel_(ownerId) {
  if (!ownerId) return '';
  if (ownerId === 'unassigned') return 'Por asignar';
  var owner = resolveUser_(ownerId);
  return owner ? owner.full_name : ownerId;
}

function collectEvidence_(formData, requestId, ticket, config) {
  var result = { links: [], byField: {} };
  Object.keys(formData).forEach(function(key) {
    if (key.slice(-5) !== '_file') return;
    var fieldId = key.slice(0, -5), file = formData[key];
    if (!isNonEmptyBlob_(file)) return;
    var link = saveBlobToCustody_(file, fieldId, requestId, ticket, config);
    result.byField[fieldId] = link;
    result.links.push(link);
  });

  ['manager_evidence', 'owner_evidence'].forEach(function(fieldId) {
    var value = formData[fieldId];
    if (result.byField[fieldId] || !/^https?:\/\//i.test(String(value || ''))) return;
    var link = copyDriveLinkToCustody_(value, fieldId, requestId, ticket, config);
    result.byField[fieldId] = link;
    result.links.push(link);
  });

  if (!result.byField.xml_source && typeof formData.xml_source === 'string' && formData.xml_source.trim()) {
    var xmlLink = saveTextXmlToCustody_(formData.xml_source, requestId, ticket, config);
    result.byField.xml_source = xmlLink;
    result.links.push(xmlLink);
  }
  return result;
}

function applyEvidence_(data, evidence) {
  Object.keys(evidence.byField || {}).forEach(function(fieldId) { data[fieldId] = evidence.byField[fieldId]; });
  delete data._uploads;
}

function getCustodyFolder_(requestId, ticket, config) {
  var settings = config.settings || {};
  var root = settings.drive_root_folder_id ? DriveApp.getFolderById(settings.drive_root_folder_id) : DriveApp.getRootFolder();
  var year = String(new Date().getFullYear());
  var years = root.getFoldersByName(year), yearFolder = years.hasNext() ? years.next() : root.createFolder(year);
  var tickets = yearFolder.getFoldersByName(ticket);
  return tickets.hasNext() ? tickets.next() : yearFolder.createFolder(ticket);
}

function saveBlobToCustody_(blob, fieldId, requestId, ticket, config) {
  var folder = getCustodyFolder_(requestId, ticket, config), name = fieldId + '-' + (blob.getName() || requestId);
  var files = folder.getFilesByName(name);
  return files.hasNext() ? files.next().getUrl() : folder.createFile(blob.copyBlob()).setName(name).getUrl();
}

function saveTextXmlToCustody_(xml, requestId, ticket, config) {
  var folder = getCustodyFolder_(requestId, ticket, config), name = 'xml_source-' + requestId + '.xml';
  var files = folder.getFilesByName(name);
  return files.hasNext() ? files.next().getUrl() : folder.createFile(Utilities.newBlob(xml, 'application/xml', name)).getUrl();
}

function copyDriveLinkToCustody_(url, fieldId, requestId, ticket, config) {
  var match = String(url).match(/[-\w]{25,}/);
  if (!match) return url;
  try {
    var source = DriveApp.getFileById(match[0]), folder = getCustodyFolder_(requestId, ticket, config), name = fieldId + '-' + source.getName();
    var files = folder.getFilesByName(name);
    return files.hasNext() ? files.next().getUrl() : source.makeCopy(name, folder).getUrl();
  } catch (error) {
    return url;
  }
}

function appendAutomationOutbox_(record) {
  try {
    appendRecord_(SHEETS.OUTBOX, {
      outbox_id: Utilities.getUuid(),
      created_at: new Date(),
      event_type: 'request.captured',
      request_id: record.requestId,
      ticket: record.ticket,
      status: 'Pendiente',
      attempts: 0,
      last_attempt_at: '',
      last_error: '',
      processed_at: ''
    });
    return { queued: true };
  } catch (error) {
    console.warn('Automation_outbox: ' + error.message);
    return { queued: false, error: error.message };
  }
}
