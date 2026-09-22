/** Contrato funcional del formulario. Cambios habituales: aquí. */
var APP = {
  version: '1.0.0',
  spreadsheet_property: 'request-intake:spreadsheet-id',
  drive_property: 'request-intake:drive-root-folder-id',
  settings: {
    aris_base_url: '',
    corporate_email_hint: 'Ingrese su correo corporativo',
    max_catalog_results: 12,
    max_upload_mb: 10,
    catalog_search_min_chars: 2
  }
};

var SHEETS = {
  REGISTRY: 'Solicitudes',
  MAINTENANCE: 'Detalle Solicitudes de Mantenimiento',
  TEAM: 'Equipo',
  PROCESSES: 'BD Procesos',
  USERS: 'BD T&C',
  OUTBOX: 'Automation_outbox'
};

// Identidad permanente. code y label pueden cambiar; id no se reutiliza.
var REQUEST_TYPES = [
  {"id":"aris_access","legacy_ids":["R1"],"code":"R1","parent_id":"","label":"Accesos de usuario en ARIS","status":"active","kind":"category","short_help":"Solicite acceso a ARIS o permisos para una carpeta.","long_help":"Solicite acceso a ARIS o permisos para una carpeta.","order":1,"flow":"","destination":"registry"},
  {"id":"aris_diagramming_access","legacy_ids":["R1_1"],"code":"R1.1","parent_id":"aris_access","label":"Acceso de diagramación","status":"active","kind":"group","short_help":"Elija acceso para personal externo o interno.","long_help":"El personal interno ya dispone de visualización. El personal externo debe solicitar acceso. Los permisos de edición sin uso durante tres meses se retiran y deben solicitarse nuevamente.","order":2,"flow":"","destination":"registry"},
  {"id":"access_external","legacy_ids":["R1_1_1"],"code":"R1.1.1","parent_id":"aris_diagramming_access","label":"Acceso de diagramación para personal externo","status":"active","kind":"request","short_help":"El personal externo requiere evidencia de aprobación de su jefe.","long_help":"El personal externo requiere evidencia de aprobación de su jefe.","order":3,"flow":"access_external","destination":"registry"},
  {"id":"access_internal","legacy_ids":["R1_1_2"],"code":"R1.1.2","parent_id":"aris_diagramming_access","label":"Acceso de diagramación para personal interno","status":"active","kind":"request","short_help":"El personal interno solicita acceso de diagramación.","long_help":"El personal interno solicita acceso de diagramación.","order":4,"flow":"access_internal","destination":"registry"},
  {"id":"folder_access","legacy_ids":["R1_2"],"code":"R1.2","parent_id":"aris_access","label":"Permiso de edición en carpeta","status":"active","kind":"request","short_help":"Solo las carpetas de la base de proyectos pueden recibir permisos de edición.","long_help":"Los permisos de edición se asignan únicamente sobre carpetas existentes en la base de proyectos. Abra la carpeta en ARIS y copie la URL del navegador.","order":5,"flow":"folder_access","destination":"registry"},
  {"id":"aris_diagram_transfer","legacy_ids":["R2"],"code":"R2","parent_id":"","label":"Transferencia de diagramas ARIS","status":"active","kind":"category","short_help":"Suba, publique o descargue diagramas.","long_help":"Use Subir a proyectos si el diagrama aún no está listo para producción. Use Publicar para llevarlo a producción. Use Descargar para copiar un diagrama existente a proyectos y editarlo.","order":6,"flow":"","destination":"registry"},
  {"id":"upload_to_projects","legacy_ids":["R2_1"],"code":"R2.1","parent_id":"aris_diagram_transfer","label":"Subir a proyectos","status":"active","kind":"group","short_help":"Mantenga el diagrama en proyectos antes de publicarlo.","long_help":"Mantenga el diagrama en proyectos antes de publicarlo.","order":7,"flow":"","destination":"registry"},
  {"id":"xml_upload","legacy_ids":["R2_1_1"],"code":"R2.1.1","parent_id":"upload_to_projects","label":"Subir XML a proyectos","status":"active","kind":"request","short_help":"Suba un diagrama XML a proyectos.","long_help":"Suba un diagrama XML a proyectos.","order":8,"flow":"xml_upload","destination":"registry"},
  {"id":"publish_to_production","legacy_ids":["R2_2"],"code":"R2.2","parent_id":"aris_diagram_transfer","label":"Publicar en producción","status":"active","kind":"group","short_help":"Publique desde XML o desde un diagrama ARIS existente.","long_help":"Publique desde XML o desde un diagrama ARIS existente.","order":9,"flow":"","destination":"registry"},
  {"id":"xml_publish","legacy_ids":["R2_2_1"],"code":"R2.2.1","parent_id":"publish_to_production","label":"Publicar desde XML","status":"active","kind":"request","short_help":"Publique un diagrama proporcionado como XML.","long_help":"Publique un diagrama proporcionado como XML.","order":10,"flow":"xml_publish","destination":"registry"},
  {"id":"aris_publish","legacy_ids":["R2_2_2"],"code":"R2.2.2","parent_id":"publish_to_production","label":"Publicar diagrama ARIS existente","status":"active","kind":"request","short_help":"Publique un diagrama existente desde proyectos.","long_help":"Publique un diagrama existente desde proyectos.","order":11,"flow":"aris_publish","destination":"registry"},
  {"id":"diagram_download","legacy_ids":["R2_3"],"code":"R2.3","parent_id":"aris_diagram_transfer","label":"Descargar a proyectos","status":"active","kind":"request","short_help":"Copie a proyectos un diagrama de producción o de otro perímetro.","long_help":"Copie a proyectos un diagrama de producción o de otro perímetro.","order":12,"flow":"diagram_download","destination":"registry"},
  {"id":"process_maintenance","legacy_ids":["R3"],"code":"R3","parent_id":"","label":"Mantenimiento de procesos y variantes","status":"active","kind":"category","short_help":"Modifique datos de procesos o variantes con sustento del Process Owner.","long_help":"Modifique datos de procesos o variantes con sustento del Process Owner.","order":13,"flow":"","destination":"maintenance"},
  {"id":"maint_owner","legacy_ids":["R3_1"],"code":"R3.1","parent_id":"process_maintenance","label":"Cambiar Process Owner","status":"active","kind":"request","short_help":"Cambie el responsable de un proceso N4 o una variante.","long_help":"Cambie el responsable de un proceso N4 o una variante.","order":14,"flow":"maint_owner","destination":"maintenance"},
  {"id":"maint_n4","legacy_ids":["R3_2"],"code":"R3.2","parent_id":"process_maintenance","label":"Modificar nombre o descripción de N4","status":"active","kind":"request","short_help":"Modifique un proceso N4 existente.","long_help":"Modifique un proceso N4 existente.","order":15,"flow":"maint_n4","destination":"maintenance"},
  {"id":"maint_variant","legacy_ids":["R3_3"],"code":"R3.3","parent_id":"process_maintenance","label":"Modificar nombre o descripción de variante","status":"active","kind":"request","short_help":"Modifique una variante existente.","long_help":"Modifique una variante existente.","order":16,"flow":"maint_variant","destination":"maintenance"},
  {"id":"maint_new_variant","legacy_ids":["R3_4"],"code":"R3.4","parent_id":"process_maintenance","label":"Nueva variante","status":"active","kind":"request","short_help":"Cree una variante bajo un proceso N4 existente.","long_help":"Cree una variante bajo un proceso N4 existente.","order":17,"flow":"maint_new_variant","destination":"maintenance"},
  {"id":"maint_delete_variant","legacy_ids":["R3_5"],"code":"R3.5","parent_id":"process_maintenance","label":"Eliminar variante","status":"active","kind":"request","short_help":"Elimine una variante existente.","long_help":"Elimine una variante existente.","order":18,"flow":"maint_delete_variant","destination":"maintenance"},
  {"id":"maint_merge_variants","legacy_ids":["R3_6"],"code":"R3.6","parent_id":"process_maintenance","label":"Fusionar variantes","status":"active","kind":"request","short_help":"Fusione dos o más variantes existentes.","long_help":"Fusione dos o más variantes existentes.","order":19,"flow":"maint_merge_variants","destination":"maintenance"},
  {"id":"maint_move_variant","legacy_ids":["R3_7"],"code":"R3.7","parent_id":"process_maintenance","label":"Mover variante","status":"active","kind":"request","short_help":"Mueva una variante a otro proceso N4.","long_help":"Mueva una variante a otro proceso N4.","order":20,"flow":"maint_move_variant","destination":"maintenance"},
  {"id":"maint_enter_perimeter","legacy_ids":["R3_8"],"code":"R3.8","parent_id":"process_maintenance","label":"Ingresar a perímetro","status":"active","kind":"request","short_help":"Ingrese un proceso N4 al perímetro.","long_help":"Ingrese un proceso N4 al perímetro.","order":21,"flow":"maint_enter_perimeter","destination":"maintenance"},
  {"id":"maint_leave_perimeter","legacy_ids":["R3_9"],"code":"R3.9","parent_id":"process_maintenance","label":"Salir de perímetro","status":"active","kind":"request","short_help":"Retire un proceso N4 del perímetro.","long_help":"Retire un proceso N4 del perímetro.","order":22,"flow":"maint_leave_perimeter","destination":"maintenance"},
  {"id":"wizard_service","legacy_ids":["R4"],"code":"R4","parent_id":"","label":"Servicio Wizard","status":"active","kind":"category","short_help":"Solicite una implementación o envíe comentarios.","long_help":"Solicite una implementación o envíe comentarios.","order":23,"flow":"","destination":"registry"},
  {"id":"wizard_implementation","legacy_ids":["R4_1"],"code":"R4.1","parent_id":"wizard_service","label":"Implementar Wizard","status":"active","kind":"request","short_help":"Solicite un Wizard para un nuevo servicio.","long_help":"Solicite un Wizard para un nuevo servicio.","order":24,"flow":"wizard_implementation","destination":"registry"},
  {"id":"wizard_feedback","legacy_ids":["R4_2"],"code":"R4.2","parent_id":"wizard_service","label":"Comentarios sobre Wizard","status":"active","kind":"request","short_help":"Comparta comentarios sobre un Wizard implementado.","long_help":"Comparta comentarios sobre un Wizard implementado.","order":25,"flow":"wizard_feedback","destination":"registry"},
  {"id":"other_inquiries","legacy_ids":["R5"],"code":"R5","parent_id":"","label":"Otras consultas","status":"active","kind":"category","short_help":"Realice una consulta o encuentre al equipo correspondiente.","long_help":"Realice una consulta o encuentre al equipo correspondiente.","order":26,"flow":"","destination":"registry"},
  {"id":"inquiry_aris","legacy_ids":["R5_1"],"code":"R5.1","parent_id":"other_inquiries","label":"Consulta sobre ARIS","status":"active","kind":"request","short_help":"Realice una consulta sobre ARIS.","long_help":"Realice una consulta sobre ARIS.","order":27,"flow":"inquiry_aris","destination":"registry"},
  {"id":"inquiry_maturity","legacy_ids":["R5_2"],"code":"R5.2","parent_id":"other_inquiries","label":"Consulta sobre madurez","status":"active","kind":"request","short_help":"Realice una consulta sobre madurez.","long_help":"Realice una consulta sobre madurez.","order":28,"flow":"inquiry_maturity","destination":"registry"},
  {"id":"inquiry_governance","legacy_ids":["R5_3"],"code":"R5.3","parent_id":"other_inquiries","label":"Consulta sobre gobierno de procesos","status":"active","kind":"request","short_help":"Realice una consulta sobre gobierno de procesos.","long_help":"Realice una consulta sobre gobierno de procesos.","order":29,"flow":"inquiry_governance","destination":"registry"},
  {"id":"inquiry_other","legacy_ids":["R5_4"],"code":"R5.4","parent_id":"other_inquiries","label":"Otra consulta","status":"active","kind":"request","short_help":"Realice otra consulta.","long_help":"Realice otra consulta.","order":30,"flow":"inquiry_other","destination":"registry"},
];

// Catálogo global de campos. Un campo se archiva globalmente solo cuando deja de usarse en todas las solicitudes activas.
var FIELDS = [
  {"id":"requester_name","status":"active","column":{"key":"requester_name","label":"Nombre del solicitante","aliases":[]}},
  {"id":"requester_email","status":"active","column":{"key":"requester_email","label":"Correo del solicitante","aliases":[]}},
  {"id":"p_registro","status":"active","column":{"key":"p_registro","label":"P-registro","aliases":[]}},
  {"id":"first_names","status":"active","column":{"key":"first_names","label":"Nombres","aliases":[]}},
  {"id":"last_names","status":"active","column":{"key":"last_names","label":"Apellidos","aliases":[]}},
  {"id":"access_reason","status":"active","column":{"key":"access_reason","label":"Motivo del acceso a ARIS","aliases":[]}},
  {"id":"manager_evidence","status":"active","column":{"key":"manager_evidence","label":"Sustento de aprobación del jefe","aliases":[]}},
  {"id":"aris_folder_url","status":"active","column":{"key":"aris_folder_url","label":"URL de la carpeta ARIS","aliases":[]}},
  {"id":"process_taxonomy","status":"active","column":{"key":"process_taxonomy","label":"Taxonomía del proceso o variante","aliases":[]}},
  {"id":"xml_source","status":"active","column":{"key":"xml_source","label":"XML","aliases":[]}},
  {"id":"role_map","status":"active","column":{"key":"role_map","label":"Mapa de roles","aliases":[]}},
  {"id":"existing_diagram","status":"active","column":{"key":"existing_diagram","label":"Diagrama ARIS existente","aliases":[]}},
  {"id":"aris_diagram_url","status":"active","column":{"key":"aris_diagram_url","label":"URL del diagrama ARIS","aliases":[]}},
  {"id":"is_process_owner","status":"active","column":{"key":"is_process_owner","label":"Es Process Owner","aliases":[]}},
  {"id":"owner_evidence","status":"active","column":{"key":"owner_evidence","label":"Sustento del Process Owner","aliases":[]}},
  {"id":"owner_scope","status":"active","column":{"key":"owner_scope","label":"Alcance del cambio de Process Owner","aliases":[]}},
  {"id":"source_entity","status":"active","column":{"key":"source_entity","label":"Entidad origen","aliases":[]}},
  {"id":"new_owner","status":"active","column":{"key":"new_owner","label":"Nuevo Process Owner","aliases":[]}},
  {"id":"change_name","status":"active","column":{"key":"change_name","label":"Cambiar nombre","aliases":[]}},
  {"id":"target_name","status":"active","column":{"key":"target_name","label":"Nuevo nombre","aliases":[]}},
  {"id":"change_description","status":"active","column":{"key":"change_description","label":"Cambiar descripción","aliases":[]}},
  {"id":"target_description","status":"active","column":{"key":"target_description","label":"Nueva descripción","aliases":[]}},
  {"id":"new_variant_taxonomy","status":"active","column":{"key":"new_variant_taxonomy","label":"Nueva taxonomía de variante","aliases":[]}},
  {"id":"same_as_n4_description","status":"active","column":{"key":"same_as_n4_description","label":"Usar descripción del N4","aliases":[]}},
  {"id":"comment","status":"active","column":{"key":"comment","label":"Comentario","aliases":[]}},
  {"id":"reason","status":"active","column":{"key":"reason","label":"Motivo","aliases":[]}},
  {"id":"merge_entities","status":"active","column":{"key":"merge_entities","label":"Variantes a fusionar","aliases":[]}},
  {"id":"target_entity","status":"active","column":{"key":"target_entity","label":"Entidad destino","aliases":[]}},
  {"id":"need_detail","status":"active","column":{"key":"need_detail","label":"Necesidad a cubrir","aliases":[]}},
  {"id":"case_count","status":"active","column":{"key":"case_count","label":"Cantidad estimada de casos","aliases":[]}},
  {"id":"impact","status":"active","column":{"key":"impact","label":"Impacto esperado","aliases":[]}},
  {"id":"feedback_sentiment","status":"active","column":{"key":"feedback_sentiment","label":"Tipo de comentario","aliases":[]}},
  {"id":"feedback_detail","status":"active","column":{"key":"feedback_detail","label":"Detalle del comentario","aliases":[]}},
  {"id":"question","status":"active","column":{"key":"question","label":"Consulta","aliases":[]}},
];

// Relación solicitud-campo. Se puede archivar una relación sin archivar el campo global.
var REQUEST_FIELDS = {
  "access_external": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"p_registro","status":"active","step":"details","label":"P-registro","type":"text","required":true,"placeholder":"P123456","validator":"p_registro"},
    {"field_id":"first_names","status":"active","step":"details","label":"Nombres","type":"text","required":true},
    {"field_id":"last_names","status":"active","step":"details","label":"Apellidos","type":"text","required":true},
    {"field_id":"access_reason","status":"active","step":"details","label":"Motivo del acceso a ARIS","type":"textarea","required":true,"placeholder":"Explique la necesidad en dos o tres líneas.","help":"Mantenga la explicación breve.","validator":"max_lines"},
    {"field_id":"manager_evidence","status":"active","step":"details","label":"Sustento de aprobación del jefe","type":"file_link","required":true,"placeholder":"Pegue una URL de Drive o seleccione un archivo.","help":"Para personal externo se requiere un correo simple de aprobación del jefe.","validator":"evidence"},
  ],
  "access_internal": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"p_registro","status":"active","step":"details","label":"P-registro","type":"text","required":true,"placeholder":"P123456","validator":"p_registro"},
    {"field_id":"first_names","status":"active","step":"details","label":"Nombres","type":"text","required":true},
    {"field_id":"last_names","status":"active","step":"details","label":"Apellidos","type":"text","required":true},
    {"field_id":"access_reason","status":"active","step":"details","label":"Motivo del acceso a ARIS","type":"textarea","required":true,"placeholder":"Explique la necesidad en dos o tres líneas.","help":"Mantenga la explicación breve.","validator":"max_lines"},
  ],
  "folder_access": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"aris_folder_url","status":"active","step":"details","label":"URL de la carpeta ARIS","type":"url","required":true,"placeholder":"https://...","help":"Abra la carpeta en ARIS y pegue la URL del navegador.","validator":"url"},
  ],
  "xml_upload": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"process_taxonomy","status":"active","step":"details","label":"Taxonomía del proceso o variante","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre del proceso","help":"Seleccione un proceso o variante existente.","source":"processes","validator":"catalog_required"},
    {"field_id":"xml_source","status":"active","step":"details","label":"Contenido XML o archivo","type":"xml_text_or_file","required":true,"placeholder":"Pegue XML o seleccione un archivo XML.","help":"Proporcione una fuente. Si selecciona un archivo, tendrá prioridad sobre el texto pegado.","validator":"xml"},
  ],
  "xml_publish": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"process_taxonomy","status":"active","step":"details","label":"Taxonomía del proceso o variante","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre del proceso","help":"Seleccione un proceso o variante existente.","source":"processes","validator":"catalog_required"},
    {"field_id":"xml_source","status":"active","step":"details","label":"Contenido XML o archivo","type":"xml_text_or_file","required":true,"placeholder":"Pegue XML o seleccione un archivo XML.","help":"Proporcione una fuente. Si selecciona un archivo, tendrá prioridad sobre el texto pegado.","validator":"xml"},
    {"field_id":"role_map","status":"active","step":"details","label":"Mapa de roles","type":"textarea","required":true,"placeholder":"Carril ** Equipo","help":"Use una relación por línea: carril ** equipo.","validator":"role_map"},
  ],
  "aris_publish": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"role_map","status":"active","step":"details","label":"Mapa de roles","type":"textarea","required":true,"placeholder":"Carril ** Equipo","help":"Use una relación por línea: carril ** equipo.","validator":"role_map"},
    {"field_id":"existing_diagram","status":"active","step":"details","label":"Diagrama ARIS existente","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre del diagrama","help":"Seleccione el proceso o variante que ya está en proyectos.","source":"processes","validator":"catalog_required"},
  ],
  "diagram_download": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"p_registro","status":"active","step":"details","label":"P-registro","type":"text","required":true,"placeholder":"P123456","validator":"p_registro"},
    {"field_id":"aris_diagram_url","status":"active","step":"details","label":"URL del diagrama ARIS","type":"url","required":true,"placeholder":"https://...","help":"Abra el diagrama o carpeta en ARIS y pegue su URL.","validator":"url"},
    {"field_id":"process_taxonomy","status":"active","step":"details","label":"Taxonomía del proceso","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre del proceso","help":"Seleccione el proceso existente.","source":"processes","validator":"catalog_required"},
  ],
  "maint_owner": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"is_process_owner","status":"active","step":"authority","label":"¿Es usted el Process Owner?","type":"radio","required":true,"help":"Seleccione sí solo si está verificado o si usted lo declara.","options":"yes:Sí|no:No"},
    {"field_id":"owner_evidence","status":"active","step":"authority","label":"Sustento de aprobación del Process Owner","type":"file_link","required":false,"placeholder":"Pegue una URL de Drive o seleccione un archivo.","help":"Es obligatorio cuando usted no es el Process Owner.","validator":"evidence","show_when":{"field":"is_process_owner","operator":"equals","value":"no"}},
    {"field_id":"owner_scope","status":"active","step":"details","label":"El cambio de responsable aplica a","type":"radio","required":true,"options":"n4:Proceso N4|variant:Variante"},
    {"field_id":"source_entity","status":"active","step":"details","label":"Proceso o variante actual","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre","help":"Seleccione la entidad existente.","source":"processes","validator":"catalog_required"},
    {"field_id":"new_owner","status":"active","step":"changes","label":"Nuevo Process Owner","type":"autocomplete_user","required":true,"placeholder":"Busque por persona o P-registro","help":"Seleccione un usuario o elija Por asignar.","options":"unassigned:Por asignar","source":"users","validator":"user_or_unassigned"},
  ],
  "maint_n4": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"is_process_owner","status":"active","step":"authority","label":"¿Es usted el Process Owner?","type":"radio","required":true,"help":"Seleccione sí solo si está verificado o si usted lo declara.","options":"yes:Sí|no:No"},
    {"field_id":"owner_evidence","status":"active","step":"authority","label":"Sustento de aprobación del Process Owner","type":"file_link","required":false,"placeholder":"Pegue una URL de Drive o seleccione un archivo.","help":"Es obligatorio cuando usted no es el Process Owner.","validator":"evidence","show_when":{"field":"is_process_owner","operator":"equals","value":"no"}},
    {"field_id":"source_entity","status":"active","step":"details","label":"Proceso N4","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre","help":"Seleccione un proceso N4 existente.","source":"processes","validator":"catalog_required_n4"},
    {"field_id":"change_name","status":"active","step":"changes","label":"Cambiar nombre","type":"checkbox","required":false},
    {"field_id":"target_name","status":"active","step":"changes","label":"Nuevo nombre del N4","type":"text","required":true,"show_when":{"field":"change_name","operator":"equals","value":"true"}},
    {"field_id":"change_description","status":"active","step":"changes","label":"Cambiar descripción","type":"checkbox","required":false},
    {"field_id":"target_description","status":"active","step":"changes","label":"Nueva descripción del N4","type":"textarea","required":true,"show_when":{"field":"change_description","operator":"equals","value":"true"}},
  ],
  "maint_variant": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"is_process_owner","status":"active","step":"authority","label":"¿Es usted el Process Owner?","type":"radio","required":true,"help":"Seleccione sí solo si está verificado o si usted lo declara.","options":"yes:Sí|no:No"},
    {"field_id":"owner_evidence","status":"active","step":"authority","label":"Sustento de aprobación del Process Owner","type":"file_link","required":false,"placeholder":"Pegue una URL de Drive o seleccione un archivo.","help":"Es obligatorio cuando usted no es el Process Owner.","validator":"evidence","show_when":{"field":"is_process_owner","operator":"equals","value":"no"}},
    {"field_id":"source_entity","status":"active","step":"details","label":"Variante existente","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre","help":"Seleccione una variante existente.","source":"processes","validator":"catalog_required_variant"},
    {"field_id":"change_name","status":"active","step":"changes","label":"Cambiar nombre","type":"checkbox","required":false},
    {"field_id":"target_name","status":"active","step":"changes","label":"Nuevo nombre de la variante","type":"text","required":true,"show_when":{"field":"change_name","operator":"equals","value":"true"}},
    {"field_id":"change_description","status":"active","step":"changes","label":"Cambiar descripción","type":"checkbox","required":false},
    {"field_id":"target_description","status":"active","step":"changes","label":"Nueva descripción de la variante","type":"textarea","required":true,"show_when":{"field":"change_description","operator":"equals","value":"true"}},
  ],
  "maint_new_variant": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"is_process_owner","status":"active","step":"authority","label":"¿Es usted el Process Owner?","type":"radio","required":true,"help":"Seleccione sí solo si está verificado o si usted lo declara.","options":"yes:Sí|no:No"},
    {"field_id":"owner_evidence","status":"active","step":"authority","label":"Sustento de aprobación del Process Owner","type":"file_link","required":false,"placeholder":"Pegue una URL de Drive o seleccione un archivo.","help":"Es obligatorio cuando usted no es el Process Owner.","validator":"evidence","show_when":{"field":"is_process_owner","operator":"equals","value":"no"}},
    {"field_id":"source_entity","status":"active","step":"details","label":"Proceso N4 padre","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre","help":"Seleccione un proceso N4 existente. Las variantes hijas se muestran después de seleccionarlo.","source":"processes","validator":"catalog_required_n4"},
    {"field_id":"new_variant_taxonomy","status":"active","step":"changes","label":"Nueva taxonomía de la variante","type":"text","required":true,"placeholder":"Ejemplo: 1.2.3.4_P05","help":"Las taxonomías existentes se rechazan. Un sufijo que no sea el siguiente genera una advertencia.","validator":"new_variant_taxonomy"},
    {"field_id":"target_name","status":"active","step":"changes","label":"Nuevo nombre de la variante","type":"text","required":true},
    {"field_id":"new_owner","status":"active","step":"changes","label":"Process Owner","type":"autocomplete_user","required":true,"placeholder":"Busque por persona o P-registro","help":"Seleccione un usuario o elija Por asignar.","options":"unassigned:Por asignar","source":"users","validator":"user_or_unassigned"},
    {"field_id":"same_as_n4_description","status":"active","step":"changes","label":"Usar descripción del N4","type":"checkbox","required":false},
    {"field_id":"target_description","status":"active","step":"changes","label":"Descripción de la variante","type":"textarea","required":true,"show_when":{"field":"same_as_n4_description","operator":"not_equals","value":"true"}},
    {"field_id":"comment","status":"active","step":"changes","label":"Comentario","type":"textarea","required":false},
  ],
  "maint_delete_variant": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"is_process_owner","status":"active","step":"authority","label":"¿Es usted el Process Owner?","type":"radio","required":true,"help":"Seleccione sí solo si está verificado o si usted lo declara.","options":"yes:Sí|no:No"},
    {"field_id":"owner_evidence","status":"active","step":"authority","label":"Sustento de aprobación del Process Owner","type":"file_link","required":false,"placeholder":"Pegue una URL de Drive o seleccione un archivo.","help":"Es obligatorio cuando usted no es el Process Owner.","validator":"evidence","show_when":{"field":"is_process_owner","operator":"equals","value":"no"}},
    {"field_id":"source_entity","status":"active","step":"details","label":"Variante a eliminar","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre","help":"Seleccione una variante existente.","source":"processes","validator":"catalog_required_variant"},
    {"field_id":"reason","status":"active","step":"changes","label":"Motivo de la eliminación","type":"textarea","required":true},
  ],
  "maint_merge_variants": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"is_process_owner","status":"active","step":"authority","label":"¿Es usted el Process Owner?","type":"radio","required":true,"help":"Seleccione sí solo si está verificado o si usted lo declara.","options":"yes:Sí|no:No"},
    {"field_id":"owner_evidence","status":"active","step":"authority","label":"Sustento de aprobación del Process Owner","type":"file_link","required":false,"placeholder":"Pegue una URL de Drive o seleccione un archivo.","help":"Es obligatorio cuando usted no es el Process Owner.","validator":"evidence","show_when":{"field":"is_process_owner","operator":"equals","value":"no"}},
    {"field_id":"merge_entities","status":"active","step":"details","label":"Variantes a fusionar","type":"repeatable_entity_selector","required":true,"placeholder":"Busque y agregue variantes","help":"Agregue por lo menos dos variantes existentes.","source":"processes","validator":"min_two_variants"},
    {"field_id":"reason","status":"active","step":"changes","label":"Motivo de la fusión","type":"textarea","required":true},
  ],
  "maint_move_variant": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"is_process_owner","status":"active","step":"authority","label":"¿Es usted el Process Owner?","type":"radio","required":true,"help":"Seleccione sí solo si está verificado o si usted lo declara.","options":"yes:Sí|no:No"},
    {"field_id":"owner_evidence","status":"active","step":"authority","label":"Sustento de aprobación del Process Owner","type":"file_link","required":false,"placeholder":"Pegue una URL de Drive o seleccione un archivo.","help":"Es obligatorio cuando usted no es el Process Owner.","validator":"evidence","show_when":{"field":"is_process_owner","operator":"equals","value":"no"}},
    {"field_id":"source_entity","status":"active","step":"details","label":"Variante a mover","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre","help":"Seleccione una variante existente.","source":"processes","validator":"catalog_required_variant"},
    {"field_id":"target_entity","status":"active","step":"details","label":"Proceso N4 de destino","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre","help":"Seleccione el proceso N4 de destino existente.","source":"processes","validator":"catalog_required_n4"},
    {"field_id":"reason","status":"active","step":"changes","label":"Motivo del traslado","type":"textarea","required":true},
  ],
  "maint_enter_perimeter": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"is_process_owner","status":"active","step":"authority","label":"¿Es usted el Process Owner?","type":"radio","required":true,"help":"Seleccione sí solo si está verificado o si usted lo declara.","options":"yes:Sí|no:No"},
    {"field_id":"owner_evidence","status":"active","step":"authority","label":"Sustento de aprobación del Process Owner","type":"file_link","required":false,"placeholder":"Pegue una URL de Drive o seleccione un archivo.","help":"Es obligatorio cuando usted no es el Process Owner.","validator":"evidence","show_when":{"field":"is_process_owner","operator":"equals","value":"no"}},
    {"field_id":"source_entity","status":"active","step":"details","label":"Proceso N4","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre","help":"Seleccione un proceso N4 existente.","source":"processes","validator":"catalog_required_n4"},
    {"field_id":"reason","status":"active","step":"changes","label":"Motivo","type":"textarea","required":true},
  ],
  "maint_leave_perimeter": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"is_process_owner","status":"active","step":"authority","label":"¿Es usted el Process Owner?","type":"radio","required":true,"help":"Seleccione sí solo si está verificado o si usted lo declara.","options":"yes:Sí|no:No"},
    {"field_id":"owner_evidence","status":"active","step":"authority","label":"Sustento de aprobación del Process Owner","type":"file_link","required":false,"placeholder":"Pegue una URL de Drive o seleccione un archivo.","help":"Es obligatorio cuando usted no es el Process Owner.","validator":"evidence","show_when":{"field":"is_process_owner","operator":"equals","value":"no"}},
    {"field_id":"source_entity","status":"active","step":"details","label":"Proceso N4","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre","help":"Seleccione un proceso N4 existente.","source":"processes","validator":"catalog_required_n4"},
    {"field_id":"reason","status":"active","step":"changes","label":"Motivo","type":"textarea","required":true},
  ],
  "wizard_implementation": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"need_detail","status":"active","step":"details","label":"Necesidad a cubrir","type":"textarea","required":true},
    {"field_id":"source_entity","status":"active","step":"details","label":"Proceso asociado","type":"autocomplete_process","required":true,"placeholder":"Busque por taxonomía o nombre del proceso","help":"Seleccione un proceso existente.","source":"processes","validator":"catalog_required"},
    {"field_id":"case_count","status":"active","step":"details","label":"Cantidad estimada de casos","type":"number","required":true,"placeholder":"1","validator":"positive_integer"},
    {"field_id":"impact","status":"active","step":"details","label":"Impacto esperado","type":"textarea","required":true},
  ],
  "wizard_feedback": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"feedback_sentiment","status":"active","step":"details","label":"Tipo de comentario","type":"radio","required":true,"options":"positive:Positivo|negative:Negativo"},
    {"field_id":"feedback_detail","status":"active","step":"details","label":"Detalle del comentario","type":"textarea","required":true},
  ],
  "inquiry_aris": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"question","status":"active","step":"details","label":"Su consulta","type":"textarea","required":true},
  ],
  "inquiry_maturity": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"question","status":"active","step":"details","label":"Su consulta","type":"textarea","required":true},
  ],
  "inquiry_governance": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"question","status":"active","step":"details","label":"Su consulta","type":"textarea","required":true},
  ],
  "inquiry_other": [
    {"field_id":"requester_name","status":"active","step":"contact","label":"Nombre completo del solicitante","type":"text","required":true,"placeholder":"Ingrese sus nombres y apellidos","help":"Se registra junto con la solicitud."},
    {"field_id":"requester_email","status":"active","step":"contact","label":"Correo corporativo","type":"text","required":false,"placeholder":"nombre@empresa.com","help":"Se usa solo si el correo de la cuenta activa no está disponible.","validator":"corporate_email"},
    {"field_id":"question","status":"active","step":"details","label":"Su consulta","type":"textarea","required":true},
  ],
};

// Estructura física. Solicitudes añade una columna por cada elemento de FIELDS.
var SHEET_DEFINITIONS = {
  "Solicitudes": {
    legacy_names: ["Registro_solicitudes"],
    include_fields: true,
    columns: [
      {"key":"request_id","label":"Id solicitud","aliases":[]},
      {"key":"ticket","label":"Ticket","aliases":[]},
      {"key":"submitted_at","label":"Fecha de solicitud","aliases":[]},
      {"key":"year","label":"Año","aliases":[]},
      {"key":"type_id","label":"Id tipo de solicitud","aliases":[]},
      {"key":"type_code","label":"Código de solicitud","aliases":[]},
      {"key":"type_label","label":"Tipo de solicitud","aliases":[]},
      {"key":"config_version","label":"Versión de configuración","aliases":[]},
      {"key":"status","label":"Estado","aliases":[]},
      {"key":"requester_email_source","label":"Origen del correo","aliases":[]},
      {"key":"maintenance_id","label":"Id mantenimiento","aliases":[]},
      {"key":"idempotency_key","label":"Clave de idempotencia","aliases":[]},
      {"key":"assigned_to","label":"Responsable asignado","aliases":[]},
      {"key":"internal_notes","label":"Notas internas","aliases":[]},
    ]
  },
  "Detalle Solicitudes de Mantenimiento": {
    legacy_names: ["Solicitudes_mantenimiento"],
    columns: [
      {"key":"maintenance_id","label":"Id mantenimiento","aliases":[]},
      {"key":"request_id","label":"Id solicitud","aliases":[]},
      {"key":"submitted_at","label":"Fecha de solicitud","aliases":[]},
      {"key":"requester_name","label":"Nombre del solicitante","aliases":[]},
      {"key":"action","label":"Acción","aliases":[]},
      {"key":"source_process_id","label":"Id proceso inicial","aliases":[]},
      {"key":"source_process_taxonomy","label":"Taxonomía del proceso inicial","aliases":[]},
      {"key":"source_process_name","label":"Nombre del proceso inicial","aliases":[]},
      {"key":"source_process_description","label":"Descripción del proceso inicial","aliases":[]},
      {"key":"source_variant_id","label":"Id variante inicial","aliases":[]},
      {"key":"source_variant_taxonomy","label":"Taxonomía de la variante inicial","aliases":[]},
      {"key":"source_variant_name","label":"Nombre de la variante inicial","aliases":[]},
      {"key":"source_variant_description","label":"Descripción de la variante inicial","aliases":[]},
      {"key":"source_process_owner","label":"Process Owner inicial","aliases":[]},
      {"key":"target_process_id","label":"Id proceso final","aliases":[]},
      {"key":"target_process_taxonomy","label":"Taxonomía del proceso final","aliases":[]},
      {"key":"target_process_name","label":"Nombre del proceso final","aliases":[]},
      {"key":"target_process_description","label":"Descripción del proceso final","aliases":[]},
      {"key":"target_variant_id","label":"Id variante final","aliases":[]},
      {"key":"target_variant_taxonomy","label":"Taxonomía de la variante final","aliases":[]},
      {"key":"target_variant_name","label":"Nombre de la variante final","aliases":[]},
      {"key":"target_variant_description","label":"Descripción de la variante final","aliases":[]},
      {"key":"target_process_owner","label":"Process Owner final","aliases":[]},
      {"key":"comment","label":"Comentario","aliases":[]},
      {"key":"evidence_text","label":"Detalle del sustento","aliases":[]},
      {"key":"evidence_links","label":"Enlaces de sustento","aliases":[]},
      {"key":"reason","label":"Motivo","aliases":[]},
    ]
  },
  "Equipo": {
    legacy_names: ["Equipo_atencion"],
    columns: [
      {"key":"team_id","label":"Id equipo","aliases":[]},
      {"key":"full_name","label":"Nombre completo","aliases":[]},
      {"key":"email","label":"Correo","aliases":[]},
      {"key":"specialty","label":"Especialidad","aliases":[]},
      {"key":"active","label":"Activo","aliases":[]},
    ]
  },
  "BD Procesos": {
    legacy_names: ["Catalogo_procesos"],
    columns: [
      {"key":"process_id","label":"Id proceso","aliases":[]},
      {"key":"taxonomy","label":"Taxonomía","aliases":[]},
      {"key":"name","label":"Nombre","aliases":[]},
      {"key":"description","label":"Descripción","aliases":[]},
      {"key":"level","label":"Nivel","aliases":[]},
      {"key":"parent_process_id","label":"Id proceso padre","aliases":[]},
      {"key":"process_owner_id","label":"Id responsable","aliases":[]},
      {"key":"process_owner_name","label":"Nombre responsable","aliases":[]},
      {"key":"perimeter","label":"Perímetro","aliases":[]},
      {"key":"active","label":"Activo","aliases":[]},
    ]
  },
  "BD T&C": {
    legacy_names: ["Catalogo_usuarios"],
    columns: [
      {"key":"user_id","label":"Id usuario","aliases":[]},
      {"key":"p_registro","label":"P-registro","aliases":[]},
      {"key":"full_name","label":"Nombre completo","aliases":[]},
      {"key":"email","label":"Correo","aliases":[]},
      {"key":"team","label":"Equipo","aliases":[]},
      {"key":"active","label":"Activo","aliases":[]},
    ]
  },
  "Automation_outbox": {
    columns: [
      {"key":"outbox_id","label":"Id evento","aliases":[]},
      {"key":"created_at","label":"Fecha de creación","aliases":[]},
      {"key":"event_type","label":"Tipo de evento","aliases":[]},
      {"key":"request_id","label":"Id solicitud","aliases":[]},
      {"key":"ticket","label":"Ticket","aliases":[]},
      {"key":"status","label":"Estado","aliases":[]},
      {"key":"attempts","label":"Intentos","aliases":[]},
      {"key":"last_attempt_at","label":"Último intento","aliases":[]},
      {"key":"last_error","label":"Último error","aliases":[]},
      {"key":"processed_at","label":"Fecha de procesamiento","aliases":[]},
    ]
  },
};

function getAppConfiguration_() {
  var settings = Object.assign({}, APP.settings);
  var driveFolderId = PropertiesService.getScriptProperties().getProperty(APP.drive_property);
  if (driveFolderId) settings.drive_root_folder_id = driveFolderId;

  var types = REQUEST_TYPES.filter(function(t) { return t.status === 'active'; }).map(frontType_);
  var leafIds = REQUEST_TYPES.filter(function(t) { return t.status === 'active' && t.kind === 'request'; }).map(function(t) { return t.id; });
  var fields = [];
  leafIds.forEach(function(requestId) {
    (REQUEST_FIELDS[requestId] || []).forEach(function(binding, index) {
      if (binding.status !== 'active') return;
      var field = getFieldDefinition_(binding.field_id);
      if (!field || field.status !== 'active') return;
      fields.push(frontField_(requestId, field, binding, index));
    });
  });

  return {
    version: APP.version,
    settings: settings,
    types: types,
    leafTypes: types.filter(function(t) { return t.is_leaf; }),
    fields: fields
  };
}

function frontType_(type) {
  return {
    type_id: type.id,
    parent_id: type.parent_id || '',
    code: type.code,
    label: type.label,
    short_help: type.short_help || '',
    long_help: type.long_help || type.short_help || '',
    sort_order: type.order || 0,
    active: type.status === 'active',
    is_leaf: type.kind === 'request',
    flow_key: type.flow || '',
    destination: type.destination || 'registry'
  };
}

function frontField_(requestId, field, binding, index) {
  var show = binding.show_when || {};
  return {
    request_type_id: requestId,
    field_key: field.id,
    step_key: binding.step || 'details',
    label: binding.label || field.column.label,
    field_type: binding.type || 'text',
    required: binding.required === true,
    placeholder: binding.placeholder || '',
    help_text: binding.help || '',
    options: binding.options || '',
    source_ref: binding.source || '',
    validator: binding.validator || '',
    show_when_field: show.field || '',
    show_when_operator: show.operator || '',
    show_when_value: show.value || '',
    target_column: field.id,
    sort_order: index + 1,
    active: true
  };
}

function getRequestType_(id) {
  for (var i = 0; i < REQUEST_TYPES.length; i++) {
    var t = REQUEST_TYPES[i];
    if (t.id === id || (t.legacy_ids || []).indexOf(id) >= 0) return t;
  }
  return null;
}

function getFieldDefinition_(id) {
  for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].id === id) return FIELDS[i];
  return null;
}

function getRequestBindings_(requestId, includeArchived) {
  return (REQUEST_FIELDS[requestId] || []).filter(function(binding) {
    return includeArchived || binding.status === 'active';
  });
}

function isFieldGloballyActive_(fieldId) {
  for (var requestId in REQUEST_FIELDS) {
    var request = getRequestType_(requestId);
    if (!request || request.status !== 'active') continue;
    var bindings = REQUEST_FIELDS[requestId] || [];
    for (var i = 0; i < bindings.length; i++) {
      if (bindings[i].field_id === fieldId && bindings[i].status === 'active') return true;
    }
  }
  return false;
}

function getSheetDefinition_(sheetName) {
  var definition = SHEET_DEFINITIONS[sheetName];
  if (!definition) throw new Error('No existe definición para la hoja: ' + sheetName);
  var columns = definition.columns.slice();
  if (definition.include_fields) {
    FIELDS.forEach(function(field) {
      columns.push({
        key: field.column.key,
        label: field.column.label,
        aliases: field.column.aliases || [],
        archived: !isFieldGloballyActive_(field.id)
      });
    });
  }
  return { legacy_names: definition.legacy_names || [], columns: columns };
}
