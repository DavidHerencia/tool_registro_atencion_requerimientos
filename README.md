# Registro de solicitudes para Google Apps Script

Aplicación HTML Service vinculada a una hoja de cálculo de Google Sheets. Sustituye un formulario estático por un flujo dinámico, accesible y configurable desde Sheets. La captura confirmada se mantiene separada de la automatización futura mediante un buzón de salida.

## Contenido

- Los 22 tipos hoja de solicitudes R1 a R5, con ID internos estables y códigos visibles.
- Árbol y campos declarativos en `Tipos_solicitudes` y `Detalle_informacion_solicitudes`.
- Estrategia de baja latencia: una llamada `bootstrapApp()` carga la configuración publicada y todos los catálogos; una llamada `submitRequest(form)` realiza el envío autoritativo.
- Validación en cliente como ayuda y validación autoritativa en servidor.
- Registro concurrente seguro con UUID, ticket `REQ-YYYY-NNNNNN`, ledger de idempotencia y confirmación por lectura posterior.
- Registro especializado de mantenimiento R3, custodia de archivos en Drive y `Automation_outbox` independiente.

## Instalación en una hoja vinculada

## Estrategia de baja latencia

La interfaz descarga un payload completo al iniciar: configuración publicada, identidad, ajustes, tipos, campos, procesos, usuarios y contactos de equipo. Las búsquedas, autocompletado, paginación de variantes, contactos R5, resúmenes y validaciones de ayuda se ejecutan en el navegador sin llamadas interactivas adicionales. El formulario solo vuelve al servidor para el envío final.

Este enfoque elimina esperas durante la captura, a cambio de transferir el catálogo completo. Para catálogos de hasta 7.000 usuarios se debe mantener el payload compacto, limitar campos de usuario a los necesarios y publicar una configuración razonable. Si el catálogo crece de forma importante, el coste principal será memoria y descarga inicial del navegador, no la cantidad de llamadas. El servidor conserva la validación autoritativa, la persistencia con bloqueo e idempotencia, la custodia de archivos en Drive, XML, el ledger, la lectura de confirmación y `Automation_outbox`. Las funciones de configuración, publicación, mantenimiento y administración de Sheets siguen siendo backend.

1. Cree o abra la hoja de cálculo que será el contenedor.
2. Abra **Extensiones > Apps Script**.
3. Cree o copie los archivos: `App.gs`, `Setup.gs`, `ConfigService.gs`, `CatalogService.gs`, `ValidationService.gs`, `SubmissionService.gs`, `MaintenanceService.gs`, `DriveService.gs`, `AutomationService.gs`, `Index.html` y `appsscript.json`.
4. Guarde el proyecto y recargue la hoja de cálculo.
5. Ejecute **Configuración de solicitudes > Configurar hojas del proyecto**.
6. Revise y reemplace los catálogos de ejemplo antes de usar el aplicativo en producción.
7. Ejecute **Validar configuración** y luego **Publicar configuración**.

La configuración inicial guarda el ID de la hoja contenedora en `ScriptProperties`. Las llamadas del web app abren esa hoja por ID, por lo que no dependen de una hoja activa. Si falta el ID, el web app informa que se debe ejecutar la configuración desde la hoja contenedora.

`setupProject()` crea solo las hojas inexistentes y carga datos iniciales únicamente si la hoja tiene encabezados y no contiene filas de usuario. Ante encabezados distintos se detiene sin cambiar datos existentes.

## Despliegue

1. En Apps Script seleccione **Implementar > Nueva implementación**.
2. Seleccione **Aplicación web**.
3. Elija una identidad de ejecución con acceso a la hoja configurada y a la ubicación de custodia de Drive.
4. Restrinja el acceso al dominio corporativo en el diálogo de implementación.
5. Autorice, implemente y abra la URL con una cuenta corporativa.

No se afirma que exista un despliegue real probado. Las verificaciones locales no pueden comprobar políticas de Google Workspace, identidad de usuario, permisos de Sheets ni permisos de Drive del tenant.

## Hojas creadas

| Hoja | Uso |
| --- | --- |
| `Config` | Configuración, incluida la carpeta raíz de custodia, `aris_base_url`, límite de resultados y `max_upload_mb`. |
| `Tipos_solicitudes` | Árbol de solicitudes, ayuda visible, orden, activación, `flow_key` y destino. |
| `Detalle_informacion_solicitudes` | Campos declarativos, etiquetas, ayudas, opciones, reglas de visibilidad y validadores. |
| `Catalogo_procesos` | Catálogo de procesos N4 y variantes N5. |
| `Catalogo_usuarios` | Catálogo de usuarios para Process Owner. |
| `Equipo_atencion` | Contactos filtrados para consultas R5. |
| `Registro_solicitudes` | Registro principal con solicitante, asunto, URL ARIS, motivo, evidencias, datos buscables y payload JSON. |
| `Solicitudes_mantenimiento` | Instantáneas N4 y N5, cambios solicitados y sustento para R3. |
| `Automation_outbox` | Eventos `request.captured` para automatización posterior. |
| `Configuracion_publicada` | Instantáneas publicadas actuales y previas, oculta. |
| `Submission_ledger` | Ledger de idempotencia, oculto. |

## Publicación de configuración

Edite contenido, ayudas, opciones y campos simples en las hojas editables. Después valide y publique. El web app consume una instantánea publicada, no las filas editables en vivo. La instantánea incluye versión y checksum del JSON almacenado. Se admite la instantánea actual y la previa para que un formulario abierto pueda completar una solicitud si se publica una nueva versión.

`CacheService` es una optimización. Si la instantánea supera un tamaño seguro de caché o la caché se evacua, el aplicativo lee la copia durable y fragmentada en `Configuracion_publicada`.

Las reglas complejas se aplican en servidor mediante `flow_key` y `validator`, incluyendo evidencias R3, taxonomía de variante, perímetro, mínimo de fusiones y campos condicionales.

## Identidad y evidencias

El nombre del solicitante es obligatorio para todas las solicitudes. Cuando `Session.getActiveUser().getEmail()` está disponible, se usa y el campo de correo alternativo no se muestra. Cuando la política de Workspace devuelve un correo vacío, se muestra y exige el correo corporativo alternativo.

Los archivos se validan en servidor por contenido, extensión, tipo y tamaño. El valor inicial de `max_upload_mb` es 10. XML acepta XML; los sustentos aceptan PDF, documento, correo o imagen. Un archivo vacío no satisface un campo obligatorio.

Los archivos se copian a una carpeta `año/ticket` bajo `drive_root_folder_id`, o bajo la raíz de Drive de la identidad de ejecución si ese ID no se configura. Las URL de Drive se copian cuando el archivo es accesible. Los originales nunca se mueven. El XML pegado se guarda como archivo XML de custodia. El payload JSON solo conserva URLs de custodia, nunca objetos Blob.

## Pruebas manuales recomendadas

1. Ejecute **Ejecutar pruebas internas** desde la hoja.
2. Abra el web app y pruebe R3.4 con un N4 que tenga más de diez variantes. Verifique la paginación anterior y siguiente.
3. Pruebe R3 sin ser Process Owner y confirme que el sustento es obligatorio.
4. Pruebe R3.2 y R3.3 activando cada cambio y dejando el valor destino vacío. Debe rechazarse.
5. Pruebe R4.1 con cero casos. Debe rechazarse.
6. Pruebe R1.1.1 y un XML con archivo vacío, tamaño excesivo o tipo inválido. Deben rechazarse.
7. Reintente un envío después de un fallo transitorio. El mismo `idempotency_key` debe conservar un solo ticket, registro, fila de mantenimiento y conjunto de copias de custodia.
8. Verifique que R5 muestre los contactos filtrados y que los datos principales aparezcan en `Registro_solicitudes`.

La automatización debe consumir filas confirmadas de `Automation_outbox` y registrar sus propios intentos. Un fallo de automatización no debe impedir la captura de la solicitud.
