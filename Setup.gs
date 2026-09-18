var SHEETS = {
  CONFIG: 'Config', TYPES: 'Tipos_solicitudes', FIELDS: 'Detalle_informacion_solicitudes',
  PROCESSES: 'Catalogo_procesos', USERS: 'Catalogo_usuarios', TEAM: 'Equipo_atencion',
  REGISTRY: 'Registro_solicitudes', MAINTENANCE: 'Solicitudes_mantenimiento', OUTBOX: 'Automation_outbox',
  PUBLISHED: 'Configuracion_publicada', LEDGER: 'Submission_ledger'
};
var APP_SPREADSHEET_ID_PROPERTY = 'request-intake:spreadsheet-id';

var HEADERS = {};
HEADERS[SHEETS.CONFIG] = ['key', 'value', 'description'];
HEADERS[SHEETS.TYPES] = ['type_id', 'parent_id', 'code', 'label', 'short_help', 'long_help', 'sort_order', 'active', 'is_leaf', 'flow_key', 'destination'];
HEADERS[SHEETS.FIELDS] = ['request_type_id', 'field_key', 'step_key', 'label', 'field_type', 'required', 'placeholder', 'help_text', 'options', 'source_ref', 'validator', 'validation_arg', 'show_when_field', 'show_when_operator', 'show_when_value', 'target_column', 'sort_order', 'active'];
HEADERS[SHEETS.PROCESSES] = ['process_id', 'taxonomy', 'name', 'description', 'level', 'parent_process_id', 'process_owner_id', 'process_owner_name', 'perimeter', 'active'];
HEADERS[SHEETS.USERS] = ['user_id', 'p_registro', 'full_name', 'email', 'team', 'active'];
HEADERS[SHEETS.TEAM] = ['team_id', 'full_name', 'email', 'specialty', 'active'];
HEADERS[SHEETS.REGISTRY] = ['request_id', 'ticket', 'submitted_at', 'year', 'requester_name', 'requester_email', 'requester_email_source', 'status', 'type_id', 'type_code', 'type_label', 'flow_key', 'subject_p_registro', 'subject_first_names', 'subject_last_names', 'aris_url', 'reason_summary', 'evidence_links', 'process_id', 'process_taxonomy', 'process_name', 'variant_id', 'variant_taxonomy', 'variant_name', 'user_id', 'user_name', 'operations', 'related_entity_ids', 'maintenance_id', 'payload_json', 'payload_version', 'config_version', 'idempotency_key', 'assigned_to', 'internal_notes'];
HEADERS[SHEETS.MAINTENANCE] = ['maintenance_id', 'request_id', 'submitted_at', 'action', 'source_process_id', 'source_process_taxonomy', 'source_process_name', 'source_process_description', 'source_variant_id', 'source_variant_taxonomy', 'source_variant_name', 'source_variant_description', 'source_process_owner', 'target_process_id', 'target_process_taxonomy', 'target_process_name', 'target_process_description', 'target_variant_id', 'target_variant_taxonomy', 'target_variant_name', 'target_variant_description', 'target_process_owner', 'source_snapshot_json', 'requested_changes_json', 'evidence_text', 'evidence_links', 'reason'];
HEADERS[SHEETS.OUTBOX] = ['outbox_id', 'created_at', 'event_type', 'request_id', 'ticket', 'payload_json', 'status', 'attempts', 'last_error'];
HEADERS[SHEETS.PUBLISHED] = ['slot', 'version', 'published_at', 'checksum', 'chunk_index', 'chunk_count', 'json_chunk'];
HEADERS[SHEETS.LEDGER] = ['idempotency_key', 'request_id', 'ticket', 'status', 'created_at', 'response_json'];

function setupProject() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No se encontró la hoja de cálculo activa. Abra la hoja contenedora y ejecute la configuración desde su menú.');
  PropertiesService.getScriptProperties().setProperty(APP_SPREADSHEET_ID_PROPERTY, ss.getId());
  Object.keys(HEADERS).forEach(function(name) { ensureSheet_(ss, name, HEADERS[name]); });
  seedIfEmpty_(ss.getSheetByName(SHEETS.CONFIG), [
    ['schema_version', '1', 'Versión del esquema de configuración publicada'],
    ['drive_root_folder_id', '', 'ID opcional de la carpeta raíz para la custodia de evidencias'],
    ['aris_base_url', '', 'URL de acceso a ARIS que se muestra como ayuda en solicitudes R1 y R2'],
    ['corporate_email_hint', 'Ingrese su correo corporativo', 'Se usa cuando el correo de la cuenta activa no está disponible'],
    ['max_catalog_results', '12', 'Máximo de resultados de autocompletado'],
    ['max_upload_mb', '10', 'Tamaño máximo de archivo en MB']
  ]);
  seedIfEmpty_(ss.getSheetByName(SHEETS.TYPES), requestTypes_());
  seedIfEmpty_(ss.getSheetByName(SHEETS.FIELDS), requestFields_());
  seedIfEmpty_(ss.getSheetByName(SHEETS.PROCESSES), sampleProcesses_());
  seedIfEmpty_(ss.getSheetByName(SHEETS.USERS), sampleUsers_());
  seedIfEmpty_(ss.getSheetByName(SHEETS.TEAM), sampleTeam_());
  [SHEETS.PUBLISHED, SHEETS.LEDGER].forEach(function(name) { ss.getSheetByName(name).hideSheet(); });
  return { ok: true, spreadsheetId: ss.getId() };
}

function getAppSpreadsheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty(APP_SPREADSHEET_ID_PROPERTY);
  if (!spreadsheetId) throw new Error('La aplicación no está vinculada a una hoja de cálculo. Abra la hoja contenedora y ejecute "Configuración de solicitudes > Configurar hojas del proyecto".');
  try { return SpreadsheetApp.openById(spreadsheetId); }
  catch (error) { throw new Error('No se pudo abrir la hoja de cálculo configurada. Verifique el acceso y vuelva a ejecutar la configuración desde la hoja contenedora.'); }
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  else if (sheet.getRange(1, 1, 1, headers.length).getValues()[0].join('|') !== headers.join('|')) throw new Error('Los encabezados no coinciden en ' + name + '. Los datos existentes no fueron modificados.');
  sheet.setFrozenRows(1);
  return sheet;
}

function seedIfEmpty_(sheet, rows) { if (sheet.getLastRow() <= 1 && rows.length) sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows); }

function requestTypes_() {
  var rows = [], order = 0;
  function add(id, parent, code, label, shortHelp, leaf, flow, destination, longHelp) { rows.push([id, parent, code, label, shortHelp, longHelp || shortHelp, ++order, true, leaf, flow || '', destination || 'registry']); }
  add('R1', '', 'R1', 'Accesos de usuario en ARIS', 'Solicite acceso a ARIS o permisos para una carpeta.', false);
  add('R1_1', 'R1', 'R1.1', 'Acceso de diagramación', 'Elija acceso para personal externo o interno.', false, '', '', 'El personal interno ya dispone de visualización. El personal externo debe solicitar acceso. Los permisos de edición sin uso durante tres meses se retiran y deben solicitarse nuevamente.');
  add('R1_1_1', 'R1_1', 'R1.1.1', 'Acceso de diagramación para personal externo', 'El personal externo requiere evidencia de aprobación de su jefe.', true, 'access_external');
  add('R1_1_2', 'R1_1', 'R1.1.2', 'Acceso de diagramación para personal interno', 'El personal interno solicita acceso de diagramación.', true, 'access_internal');
  add('R1_2', 'R1', 'R1.2', 'Permiso de edición en carpeta', 'Solo las carpetas de la base de proyectos pueden recibir permisos de edición.', true, 'folder_access', '', 'Los permisos de edición se asignan únicamente sobre carpetas existentes en la base de proyectos. Abra la carpeta en ARIS y copie la URL del navegador.');
  add('R2', '', 'R2', 'Transferencia de diagramas ARIS', 'Suba, publique o descargue diagramas.', false, '', '', 'Use Subir a proyectos si el diagrama aún no está listo para producción. Use Publicar para llevarlo a producción. Use Descargar para copiar un diagrama existente a proyectos y editarlo.');
  add('R2_1', 'R2', 'R2.1', 'Subir a proyectos', 'Mantenga el diagrama en proyectos antes de publicarlo.', false);
  add('R2_1_1', 'R2_1', 'R2.1.1', 'Subir XML a proyectos', 'Suba un diagrama XML a proyectos.', true, 'xml_upload');
  add('R2_2', 'R2', 'R2.2', 'Publicar en producción', 'Publique desde XML o desde un diagrama ARIS existente.', false);
  add('R2_2_1', 'R2_2', 'R2.2.1', 'Publicar desde XML', 'Publique un diagrama proporcionado como XML.', true, 'xml_publish');
  add('R2_2_2', 'R2_2', 'R2.2.2', 'Publicar diagrama ARIS existente', 'Publique un diagrama existente desde proyectos.', true, 'aris_publish');
  add('R2_3', 'R2', 'R2.3', 'Descargar a proyectos', 'Copie a proyectos un diagrama de producción o de otro perímetro.', true, 'diagram_download');
  add('R3', '', 'R3', 'Mantenimiento de procesos y variantes', 'Modifique datos de procesos o variantes con sustento del Process Owner.', false, '', 'maintenance');
  add('R3_1', 'R3', 'R3.1', 'Cambiar Process Owner', 'Cambie el responsable de un proceso N4 o una variante.', true, 'maint_owner', 'maintenance');
  add('R3_2', 'R3', 'R3.2', 'Modificar nombre o descripción de N4', 'Modifique un proceso N4 existente.', true, 'maint_n4', 'maintenance');
  add('R3_3', 'R3', 'R3.3', 'Modificar nombre o descripción de variante', 'Modifique una variante existente.', true, 'maint_variant', 'maintenance');
  add('R3_4', 'R3', 'R3.4', 'Nueva variante', 'Cree una variante bajo un proceso N4 existente.', true, 'maint_new_variant', 'maintenance');
  add('R3_5', 'R3', 'R3.5', 'Eliminar variante', 'Elimine una variante existente.', true, 'maint_delete_variant', 'maintenance');
  add('R3_6', 'R3', 'R3.6', 'Fusionar variantes', 'Fusione dos o más variantes existentes.', true, 'maint_merge_variants', 'maintenance');
  add('R3_7', 'R3', 'R3.7', 'Mover variante', 'Mueva una variante a otro proceso N4.', true, 'maint_move_variant', 'maintenance');
  add('R3_8', 'R3', 'R3.8', 'Ingresar a perímetro', 'Ingrese un proceso N4 al perímetro.', true, 'maint_enter_perimeter', 'maintenance');
  add('R3_9', 'R3', 'R3.9', 'Salir de perímetro', 'Retire un proceso N4 del perímetro.', true, 'maint_leave_perimeter', 'maintenance');
  add('R4', '', 'R4', 'Servicio Wizard', 'Solicite una implementación o envíe comentarios.', false);
  add('R4_1', 'R4', 'R4.1', 'Implementar Wizard', 'Solicite un Wizard para un nuevo servicio.', true, 'wizard_implementation');
  add('R4_2', 'R4', 'R4.2', 'Comentarios sobre Wizard', 'Comparta comentarios sobre un Wizard implementado.', true, 'wizard_feedback');
  add('R5', '', 'R5', 'Otras consultas', 'Realice una consulta o encuentre al equipo correspondiente.', false);
  add('R5_1', 'R5', 'R5.1', 'Consulta sobre ARIS', 'Realice una consulta sobre ARIS.', true, 'inquiry_aris');
  add('R5_2', 'R5', 'R5.2', 'Consulta sobre madurez', 'Realice una consulta sobre madurez.', true, 'inquiry_maturity');
  add('R5_3', 'R5', 'R5.3', 'Consulta sobre gobierno de procesos', 'Realice una consulta sobre gobierno de procesos.', true, 'inquiry_governance');
  add('R5_4', 'R5', 'R5.4', 'Otra consulta', 'Realice otra consulta.', true, 'inquiry_other');
  return rows;
}

function requestFields_() {
  var rows = [], order = 0;
  function add(typeIds, key, step, label, type, required, placeholder, help, options, source, validator, target, showField, showOp, showValue) {
    typeIds.split(',').forEach(function(typeId) { rows.push([typeId, key, step || 'details', label, type, !!required, placeholder || '', help || '', options || '', source || '', validator || '', '', showField || '', showOp || '', showValue || '', target || key, ++order, true]); });
  }
  var all = 'R1_1_1,R1_1_2,R1_2,R2_1_1,R2_2_1,R2_2_2,R2_3,R3_1,R3_2,R3_3,R3_4,R3_5,R3_6,R3_7,R3_8,R3_9,R4_1,R4_2,R5_1,R5_2,R5_3,R5_4';
  add(all, 'requester_name', 'contact', 'Nombre completo del solicitante', 'text', true, 'Ingrese sus nombres y apellidos', 'Se registra junto con la solicitud.', '', '', '', 'requester_name');
  add(all, 'requester_email', 'contact', 'Correo corporativo', 'text', false, 'nombre@empresa.com', 'Se usa solo si el correo de la cuenta activa no está disponible.', '', '', 'corporate_email', 'requester_email');
  add('R1_1_1,R1_1_2', 'p_registro', 'details', 'P-registro', 'text', true, 'P123456', '', '', '', 'p_registro', 'p_registro');
  add('R1_1_1,R1_1_2', 'first_names', 'details', 'Nombres', 'text', true, '', '', '', '', '', 'first_names');
  add('R1_1_1,R1_1_2', 'last_names', 'details', 'Apellidos', 'text', true, '', '', '', '', '', 'last_names');
  add('R1_1_1,R1_1_2', 'access_reason', 'details', 'Motivo del acceso a ARIS', 'textarea', true, 'Explique la necesidad en dos o tres líneas.', 'Mantenga la explicación breve.', '', '', 'max_lines', 'access_reason');
  add('R1_1_1', 'manager_evidence', 'details', 'Sustento de aprobación del jefe', 'file_link', true, 'Pegue una URL de Drive o seleccione un archivo.', 'Para personal externo se requiere un correo simple de aprobación del jefe.', '', '', 'evidence', 'evidence_links');
  add('R1_2', 'aris_folder_url', 'details', 'URL de la carpeta ARIS', 'url', true, 'https://...', 'Abra la carpeta en ARIS y pegue la URL del navegador.', '', '', 'url', 'folder_url');
  add('R2_1_1,R2_2_1', 'process_taxonomy', 'details', 'Taxonomía del proceso o variante', 'autocomplete_process', true, 'Busque por taxonomía o nombre del proceso', 'Seleccione un proceso o variante existente.', '', 'processes', 'catalog_required', 'process_taxonomy');
  add('R2_1_1,R2_2_1', 'xml_source', 'details', 'Contenido XML o archivo', 'xml_text_or_file', true, 'Pegue XML o seleccione un archivo XML.', 'Proporcione una fuente. Si selecciona un archivo, tendrá prioridad sobre el texto pegado.', '', '', 'xml', 'xml_source');
  add('R2_2_1,R2_2_2', 'role_map', 'details', 'Mapa de roles', 'textarea', true, 'Carril ** Equipo', 'Use una relación por línea: carril ** equipo.', '', '', 'role_map', 'role_map');
  add('R2_2_2', 'existing_diagram', 'details', 'Diagrama ARIS existente', 'autocomplete_process', true, 'Busque por taxonomía o nombre del diagrama', 'Seleccione el proceso o variante que ya está en proyectos.', '', 'processes', 'catalog_required', 'process_taxonomy');
  add('R2_3', 'p_registro', 'details', 'P-registro', 'text', true, 'P123456', '', '', '', 'p_registro', 'p_registro');
  add('R2_3', 'aris_diagram_url', 'details', 'URL del diagrama ARIS', 'url', true, 'https://...', 'Abra el diagrama o carpeta en ARIS y pegue su URL.', '', '', 'url', 'diagram_url');
  add('R2_3', 'process_taxonomy', 'details', 'Taxonomía del proceso', 'autocomplete_process', true, 'Busque por taxonomía o nombre del proceso', 'Seleccione el proceso existente.', '', 'processes', 'catalog_required', 'process_taxonomy');
  var maint = 'R3_1,R3_2,R3_3,R3_4,R3_5,R3_6,R3_7,R3_8,R3_9';
  add(maint, 'is_process_owner', 'authority', '¿Es usted el Process Owner?', 'radio', true, '', 'Seleccione sí solo si está verificado o si usted lo declara.', 'yes:Sí|no:No', '', '', 'is_process_owner');
  add(maint, 'owner_evidence', 'authority', 'Sustento de aprobación del Process Owner', 'file_link', false, 'Pegue una URL de Drive o seleccione un archivo.', 'Es obligatorio cuando usted no es el Process Owner.', '', '', 'evidence', 'evidence_links', 'is_process_owner', 'equals', 'no');
  add('R3_1', 'owner_scope', 'details', 'El cambio de responsable aplica a', 'radio', true, '', '', 'n4:Proceso N4|variant:Variante', '', '', 'owner_scope');
  add('R3_1', 'source_entity', 'details', 'Proceso o variante actual', 'autocomplete_process', true, 'Busque por taxonomía o nombre', 'Seleccione la entidad existente.', '', 'processes', 'catalog_required', 'source_process_id');
  add('R3_1', 'new_owner', 'changes', 'Nuevo Process Owner', 'autocomplete_user', true, 'Busque por persona o P-registro', 'Seleccione un usuario o elija Por asignar.', 'unassigned:Por asignar', 'users', 'user_or_unassigned', 'target_process_owner');
  add('R3_2', 'source_entity', 'details', 'Proceso N4', 'autocomplete_process', true, 'Busque por taxonomía o nombre', 'Seleccione un proceso N4 existente.', '', 'processes', 'catalog_required_n4', 'source_process_id');
  add('R3_2', 'change_name', 'changes', 'Cambiar nombre', 'checkbox', false, '', '', '', '', '', 'change_name');
  add('R3_2', 'target_name', 'changes', 'Nuevo nombre del N4', 'text', true, '', '', '', '', '', 'target_process_name', 'change_name', 'equals', 'true');
  add('R3_2', 'change_description', 'changes', 'Cambiar descripción', 'checkbox', false, '', '', '', '', '', 'change_description');
  add('R3_2', 'target_description', 'changes', 'Nueva descripción del N4', 'textarea', true, '', '', '', '', '', 'target_process_description', 'change_description', 'equals', 'true');
  add('R3_3', 'source_entity', 'details', 'Variante existente', 'autocomplete_process', true, 'Busque por taxonomía o nombre', 'Seleccione una variante existente.', '', 'processes', 'catalog_required_variant', 'source_variant_id');
  add('R3_3', 'change_name', 'changes', 'Cambiar nombre', 'checkbox', false, '', '', '', '', '', 'change_name');
  add('R3_3', 'target_name', 'changes', 'Nuevo nombre de la variante', 'text', true, '', '', '', '', '', 'target_variant_name', 'change_name', 'equals', 'true');
  add('R3_3', 'change_description', 'changes', 'Cambiar descripción', 'checkbox', false, '', '', '', '', '', 'change_description');
  add('R3_3', 'target_description', 'changes', 'Nueva descripción de la variante', 'textarea', true, '', '', '', '', '', 'target_variant_description', 'change_description', 'equals', 'true');
  add('R3_4', 'source_entity', 'details', 'Proceso N4 padre', 'autocomplete_process', true, 'Busque por taxonomía o nombre', 'Seleccione un proceso N4 existente. Las variantes hijas se muestran después de seleccionarlo.', '', 'processes', 'catalog_required_n4', 'source_process_id');
  add('R3_4', 'new_variant_taxonomy', 'changes', 'Nueva taxonomía de la variante', 'text', true, 'Ejemplo: 1.2.3.4_P05', 'Las taxonomías existentes se rechazan. Un sufijo que no sea el siguiente genera una advertencia.', '', '', 'new_variant_taxonomy', 'target_variant_taxonomy');
  add('R3_4', 'target_name', 'changes', 'Nuevo nombre de la variante', 'text', true, '', '', '', '', '', 'target_variant_name');
  add('R3_4', 'new_owner', 'changes', 'Process Owner', 'autocomplete_user', true, 'Busque por persona o P-registro', 'Seleccione un usuario o elija Por asignar.', 'unassigned:Por asignar', 'users', 'user_or_unassigned', 'target_process_owner');
  add('R3_4', 'same_as_n4_description', 'changes', 'Usar descripción del N4', 'checkbox', false, '', '', '', '', '', 'same_as_n4_description');
  add('R3_4', 'target_description', 'changes', 'Descripción de la variante', 'textarea', true, '', '', '', '', '', 'target_variant_description', 'same_as_n4_description', 'not_equals', 'true');
  add('R3_4', 'comment', 'changes', 'Comentario', 'textarea', false, '', '', '', '', '', 'comment');
  add('R3_5', 'source_entity', 'details', 'Variante a eliminar', 'autocomplete_process', true, 'Busque por taxonomía o nombre', 'Seleccione una variante existente.', '', 'processes', 'catalog_required_variant', 'source_variant_id');
  add('R3_5', 'reason', 'changes', 'Motivo de la eliminación', 'textarea', true, '', '', '', '', '', 'reason');
  add('R3_6', 'merge_entities', 'details', 'Variantes a fusionar', 'repeatable_entity_selector', true, 'Busque y agregue variantes', 'Agregue por lo menos dos variantes existentes.', '', 'processes', 'min_two_variants', 'related_entity_ids');
  add('R3_6', 'reason', 'changes', 'Motivo de la fusión', 'textarea', true, '', '', '', '', '', 'reason');
  add('R3_7', 'source_entity', 'details', 'Variante a mover', 'autocomplete_process', true, 'Busque por taxonomía o nombre', 'Seleccione una variante existente.', '', 'processes', 'catalog_required_variant', 'source_variant_id');
  add('R3_7', 'target_entity', 'details', 'Proceso N4 de destino', 'autocomplete_process', true, 'Busque por taxonomía o nombre', 'Seleccione el proceso N4 de destino existente.', '', 'processes', 'catalog_required_n4', 'target_process_id');
  add('R3_7', 'reason', 'changes', 'Motivo del traslado', 'textarea', true, '', '', '', '', '', 'reason');
  add('R3_8,R3_9', 'source_entity', 'details', 'Proceso N4', 'autocomplete_process', true, 'Busque por taxonomía o nombre', 'Seleccione un proceso N4 existente.', '', 'processes', 'catalog_required_n4', 'source_process_id');
  add('R3_8,R3_9', 'reason', 'changes', 'Motivo', 'textarea', true, '', '', '', '', '', 'reason');
  add('R4_1', 'need_detail', 'details', 'Necesidad a cubrir', 'textarea', true, '', '', '', '', '', 'need_detail');
  add('R4_1', 'source_entity', 'details', 'Proceso asociado', 'autocomplete_process', true, 'Busque por taxonomía o nombre del proceso', 'Seleccione un proceso existente.', '', 'processes', 'catalog_required', 'process_taxonomy');
  add('R4_1', 'case_count', 'details', 'Cantidad estimada de casos', 'number', true, '1', '', '', '', 'positive_integer', 'case_count');
  add('R4_1', 'impact', 'details', 'Impacto esperado', 'textarea', true, '', '', '', '', '', 'impact');
  add('R4_2', 'feedback_sentiment', 'details', 'Tipo de comentario', 'radio', true, '', '', 'positive:Positivo|negative:Negativo', '', '', 'feedback_sentiment');
  add('R4_2', 'feedback_detail', 'details', 'Detalle del comentario', 'textarea', true, '', '', '', '', '', 'feedback_detail');
  add('R5_1,R5_2,R5_3,R5_4', 'question', 'details', 'Su consulta', 'textarea', true, '', '', '', '', '', 'question');
  return rows;
}

function sampleProcesses_() { return [
  ['PR-100', '1.2.3.4', 'Incorporación de clientes', 'Registra y valida nuevos clientes.', 'N4', '', 'USR-001', 'Andrea Torres', 'IN', true],
  ['VR-100-01', '1.2.3.4_P01', 'Incorporación estándar', 'Ruta predeterminada de incorporación de clientes.', 'N5', 'PR-100', 'USR-001', 'Andrea Torres', 'IN', true],
  ['VR-100-02', '1.2.3.4_P02', 'Incorporación asistida', 'Incorporación con apoyo de un asesor.', 'N5', 'PR-100', 'USR-002', 'Luis Ramos', 'IN', true],
  ['PR-200', '2.4.1.3', 'Gestión de proveedores', 'Gestiona el ciclo de vida de proveedores.', 'N4', '', 'USR-003', 'Sofia Vega', 'OUT', true],
  ['VR-200-01', '2.4.1.3_P01', 'Registro de proveedores', 'Registro inicial de proveedores.', 'N5', 'PR-200', 'USR-003', 'Sofia Vega', 'OUT', true]
]; }
function sampleUsers_() { return [
  ['USR-001', 'P100001', 'Andrea Torres', 'andrea.torres@example.com', 'Gobierno de procesos', true],
  ['USR-002', 'P100002', 'Luis Ramos', 'luis.ramos@example.com', 'Operaciones', true],
  ['USR-003', 'P100003', 'Sofia Vega', 'sofia.vega@example.com', 'Gobierno de procesos', true],
  ['USR-004', 'P100004', 'Daniel Cruz', 'daniel.cruz@example.com', 'Arquitectura', true]
]; }
function sampleTeam_() { return [
  ['TEAM-001', 'Andrea Torres', 'andrea.torres@example.com', 'ARIS|Gobierno de procesos', true],
  ['TEAM-002', 'Sofia Vega', 'sofia.vega@example.com', 'Madurez|Gobierno de procesos', true],
  ['TEAM-003', 'Daniel Cruz', 'daniel.cruz@example.com', 'ARIS', true]
]; }
