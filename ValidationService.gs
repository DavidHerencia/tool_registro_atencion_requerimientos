function validateSubmission(typeId, rawData) {
  rawData = rawData || {};
  var requestedVersion = rawData.config_version;
  if (!requestedVersion) return { valid: false, errors: { config_version: 'La configuración de la solicitud no está disponible. Recargue la página.' }, warnings: [] };
  var config;
  try { config = getPublishedConfiguration(requestedVersion); }
  catch (error) { return { valid: false, errors: { config_version: error.message }, warnings: [] }; }
  var type = config.leafTypes.filter(function(item) { return item.type_id === typeId; })[0];
  if (!type) return { valid: false, errors: { request_type_id: 'Seleccione un tipo de solicitud válido.' }, warnings: [] };
  var data = normalizeSubmissionData_(rawData), fields = config.fields.filter(function(field) { return field.request_type_id === typeId; }), errors = {}, warnings = [];
  fields.forEach(function(field) {
    if (!isVisible_(field, data)) return;
    var value = data[field.field_key], required = asBool_(field.required);
    if (field.validator === 'corporate_email' && Session.getActiveUser().getEmail()) required = false;
    if (required && !hasFieldValue_(data, field.field_key)) errors[field.field_key] = field.label + ' es obligatorio.';
    if (hasFieldValue_(data, field.field_key) && field.validator) validateField_(field, value, data, errors, warnings);
  });
  if (!Session.getActiveUser().getEmail() && isEmpty_(data.requester_email)) errors.requester_email = 'Ingrese su correo corporativo para identificar la solicitud.';
  validateUploads_(rawData, config, fields, data, errors);
  validateFlow_(type, data, errors, warnings);
  return { valid: Object.keys(errors).length === 0, errors: errors, warnings: warnings, normalized: data, configVersion: config.version };
}

function normalizeSubmissionData_(raw) {
  var data = { _uploads: {} };
  Object.keys(raw || {}).forEach(function(key) {
    var value = raw[key];
    if (value === undefined || value === null) return;
    if (/_file$/.test(key)) {
      var fieldKey = key.replace(/_file$/, '');
      if (value === '__archivo__') data._uploads[fieldKey] = { client: true };
      else if (isNonEmptyBlob_(value)) data._uploads[fieldKey] = { name: value.getName(), contentType: value.getContentType(), size: value.getBytes().length };
      return;
    }
    if (typeof value === 'string') {
      try { data[key] = (key === 'selected_entities' || key === 'selected_entity_data') ? JSON.parse(value) : value.trim(); }
      catch (ignore) { data[key] = value.trim(); }
    } else if (!isBlob_(value)) data[key] = value;
  });
  if (data.selected_entities && !data.merge_entities) data.merge_entities = data.selected_entities;
  return data;
}

function isVisible_(field, data) {
  if (!field.show_when_field) return true;
  var actual = data[field.show_when_field];
  return field.show_when_operator === 'equals' ? String(actual) === String(field.show_when_value) : String(actual) !== String(field.show_when_value);
}
function isEmpty_(value) { return value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length); }
function hasFieldValue_(data, key) { return !isEmpty_(data[key]) || !!data._uploads[key]; }
function isNonEmptyBlob_(value) { return isBlob_(value) && value.getBytes().length > 0; }

function validateUploads_(raw, config, fields, data, errors) {
  var maxBytes = Number(config.settings.max_upload_mb || 10) * 1024 * 1024;
  fields.forEach(function(field) {
    var blob = raw[field.field_key + '_file'];
    if (!blob) return;
    if (blob === '__archivo__') return;
    if (!isNonEmptyBlob_(blob)) { errors[field.field_key] = 'El archivo seleccionado está vacío.'; return; }
    if (blob.getBytes().length > maxBytes) { errors[field.field_key] = 'El archivo supera el límite de ' + config.settings.max_upload_mb + ' MB.'; return; }
    var name = String(blob.getName() || '').toLowerCase(), contentType = String(blob.getContentType() || '').toLowerCase();
    if (field.field_type === 'xml_text_or_file' && !(/\.xml$/.test(name) || /xml/.test(contentType))) errors[field.field_key] = 'Adjunte un archivo XML válido.';
    if (field.field_type === 'file_link' && !(/\.(pdf|doc|docx|msg|eml|png|jpe?g)$/i.test(name) || /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|message\/rfc822|image\/)/.test(contentType))) errors[field.field_key] = 'Adjunte PDF, documento, correo o imagen como sustento.';
  });
}

function validateField_(field, value, data, errors, warnings) {
  var key = field.field_key, validator = field.validator;
  if (validator === 'corporate_email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) errors[key] = 'Ingrese un correo corporativo válido.';
  if (validator === 'p_registro' && !/^P[0-9]{4,}$/i.test(String(value))) errors[key] = 'Ingrese un P-registro válido.';
  if (validator === 'url' && !/^https?:\/\//i.test(String(value))) errors[key] = 'Ingrese una URL válida que empiece con http:// o https://.';
  if (validator === 'positive_integer' && (!/^\d+$/.test(String(value)) || Number(value) < 1)) errors[key] = 'Ingrese un número entero positivo.';
  if (validator === 'max_lines' && String(value).split(/\r?\n/).length > 3) errors[key] = 'Use como máximo tres líneas.';
  if (validator === 'role_map' && String(value).split(/\r?\n/).some(function(line) { return line.trim() && line.indexOf('**') < 0; })) errors[key] = 'Use una relación por línea con el formato: carril ** equipo.';
  if (validator === 'xml' && !data._uploads[key] && String(value).trim().indexOf('<') < 0) errors[key] = 'Pegue contenido XML válido o adjunte un archivo XML.';
  if (validator === 'catalog_required' || validator === 'catalog_required_n4' || validator === 'catalog_required_variant') {
    var process = resolveProcess_(value);
    if (!process) errors[key] = 'Seleccione un resultado existente del catálogo.';
    else if (validator === 'catalog_required_n4' && process.level !== 'N4') errors[key] = 'Seleccione un proceso N4.';
    else if (validator === 'catalog_required_variant' && process.level !== 'N5') errors[key] = 'Seleccione una variante.';
  }
  if (validator === 'user_or_unassigned' && value !== 'unassigned' && !resolveUser_(value)) errors[key] = 'Seleccione un usuario del catálogo o elija Por asignar.';
  if (validator === 'min_two_variants') {
    var ids = Array.isArray(value) ? value : [];
    if (ids.length < 2) errors[key] = 'Agregue al menos dos variantes.';
    else if (ids.some(function(id) { var entity = resolveProcess_(id); return !entity || entity.level !== 'N5'; })) errors[key] = 'Todas las entidades seleccionadas deben ser variantes existentes.';
  }
}

function validateFlow_(type, data, errors, warnings) {
  if (String(type.flow_key).indexOf('maint_') === 0 && data.is_process_owner === 'no' && !hasFieldValue_(data, 'owner_evidence')) errors.owner_evidence = 'El sustento de aprobación del Process Owner es obligatorio.';
  if ((type.flow_key === 'maint_n4' || type.flow_key === 'maint_variant') && !data.change_name && !data.change_description) errors.change_name = 'Seleccione un cambio de nombre o de descripción.';
  if ((type.flow_key === 'maint_n4' || type.flow_key === 'maint_variant') && data.change_name && isEmpty_(data.target_name)) errors.target_name = 'Ingrese el nuevo nombre.';
  if ((type.flow_key === 'maint_n4' || type.flow_key === 'maint_variant') && data.change_description && isEmpty_(data.target_description)) errors.target_description = 'Ingrese la nueva descripción.';
  if (type.flow_key === 'maint_new_variant' && !data.same_as_n4_description && isEmpty_(data.target_description)) errors.target_description = 'Ingrese la descripción de la variante o seleccione usar la descripción del N4.';
  if (type.flow_key === 'maint_owner') {
    var ownerEntity = resolveProcess_(data.source_entity);
    if (ownerEntity && ((data.owner_scope === 'n4' && ownerEntity.level !== 'N4') || (data.owner_scope === 'variant' && ownerEntity.level !== 'N5'))) errors.owner_scope = 'El alcance seleccionado no coincide con el nivel de la entidad elegida.';
  }
  if (type.flow_key === 'maint_enter_perimeter' || type.flow_key === 'maint_leave_perimeter') {
    var source = resolveProcess_(data.source_entity), expected = type.flow_key === 'maint_enter_perimeter' ? 'OUT' : 'IN';
    if (source && source.perimeter !== expected) errors.source_entity = 'El proceso seleccionado no es elegible para esta acción de perímetro.';
  }
  if (type.flow_key === 'maint_new_variant') validateNewVariant_(data, errors, warnings);
}

function resolveProcess_(value) { if (!value) return null; return getCatalogRows_(SHEETS.PROCESSES).filter(function(row) { return row.process_id === value || row.taxonomy === value; })[0] || null; }
function resolveUser_(value) { if (!value) return null; return getCatalogRows_(SHEETS.USERS).filter(function(row) { return row.user_id === value || row.p_registro === value; })[0] || null; }
function validateNewVariant_(data, errors, warnings) {
  var parent = resolveProcess_(data.source_entity), proposed = String(data.new_variant_taxonomy || '').trim();
  if (!parent || !proposed) return;
  var all = getCatalogRows_(SHEETS.PROCESSES);
  if (all.some(function(row) { return String(row.taxonomy).toLowerCase() === proposed.toLowerCase(); })) errors.new_variant_taxonomy = 'Esta taxonomía ya existe.';
  var match = proposed.match(/_P(\d+)$/i);
  if (!match || proposed.indexOf(parent.taxonomy + '_P') !== 0) errors.new_variant_taxonomy = 'Use una taxonomía bajo el N4 seleccionado, por ejemplo ' + parent.taxonomy + '_P01.';
  else {
    var expected = all.filter(function(row) { return row.parent_process_id === parent.process_id; }).reduce(function(maximum, row) {
      var suffix = String(row.taxonomy || '').match(/_P(\d+)$/i);
      return suffix ? Math.max(maximum, Number(suffix[1])) : maximum;
    }, 0) + 1;
    if (Number(match[1]) !== expected) warnings.push('El siguiente sufijo esperado es P' + ('0' + expected).slice(-2) + '. Puede continuar si el sufijo propuesto es intencional.');
  }
}
