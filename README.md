# Formulario de atención — Base V1

Esta base contiene la arquitectura acordada para continuar el desarrollo por partes.

## Archivos

- `Config.gs`: contrato funcional. Árbol, campos, relaciones, estado y esquema de hojas.
- `Backend.gs`: lógica genérica de carga, validación, registro, evidencias y outbox.
- `Helpers.gs`: primitivas reutilizables de Sheets y futuras migraciones específicas.
- `Index.html`: frontend actual. Mantiene el diseño y consulta catálogos bajo demanda.
- `appsscript.json`: manifest.
- `Avance.md`: decisiones de arquitectura tomadas hasta ahora.

## Primera instalación / adaptación de la base actual

1. Copiar `Config.gs`, `Backend.gs`, `Helpers.gs`, `Index.html` y `appsscript.json` al mismo proyecto Apps Script.
2. Eliminar los `.gs` anteriores que ya no formen parte de esta base.
3. Ejecutar manualmente `initializeProject()` una vez.
4. Revisar las hojas y sus headers antes de publicar.
5. Crear una nueva versión de la implementación Web App.

`initializeProject()` es no destructivo: crea/reutiliza las seis hojas y agrega columnas faltantes. No borra ni reordena datos y no pretende resolver migraciones futuras.

## Hojas

- Solicitudes
- Detalle Solicitudes de Mantenimiento
- Equipo
- BD Procesos
- BD T&C
- Automation_outbox

## Regla de trabajo actual

Primero se pulirá `Config.gs`: solicitudes, campos, columnas y headers. Después se fortalecerán las capacidades genéricas de `Backend.gs` y la experiencia de `Index.html`. Las reglas completas para agentes y migraciones se definirán en una etapa posterior.
