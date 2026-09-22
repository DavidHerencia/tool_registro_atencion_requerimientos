# Avance del proyecto — Formulario de atención de requerimientos

## 1. Objetivo

Construir una herramienta de captura de requerimientos en Google Apps Script que reemplace el formulario tradicional por una experiencia dinámica, guiada y validada.

El foco de esta etapa es la captura correcta de información:

- pedir solo lo necesario según el tipo de solicitud;
- evitar solicitudes incompletas o inconsistentes;
- reutilizar catálogos para estandarizar información;
- registrar los datos de forma estructurada en Google Sheets;
- mantener la captura desacoplada de automatizaciones posteriores;
- permitir que el sistema evolucione sin volverse difícil de mantener.

La herramienta debe diseñarse desde el inicio pensando en aproximadamente 10.000 solicitudes, sin asumir que será un sistema pequeño o temporal.

## 2. Principio general de arquitectura

La arquitectura debe ser simple y estable:

```text
Config.gs
    ↓
Index.html
    ↓
Backend.gs
    ↓
Helpers.gs
    ↓
Google Sheets / Drive / Automation_outbox
```

La idea principal es:

- `Config.gs` define qué es el sistema.
- `Backend.gs` implementa capacidades genéricas.
- `Helpers.gs` contiene primitivas técnicas reutilizables.
- `Index.html` renderiza el formulario.
- Los cambios futuros deben poder ser realizados principalmente por un agente que interprete la configuración y aplique modificaciones seguras.

No se busca construir un sistema que pueda auto-migrar cualquier cambio futuro. Se busca una base ordenada para que un agente pueda entender qué existe, qué está activo, qué está archivado, qué debe preservarse y qué debe modificar.

## 3. Archivos base propuestos

### Config.gs

Será el contrato funcional central del sistema.

Debe contener de forma ordenada:

- versión de la configuración;
- árbol de categorías y solicitudes;
- identidad permanente de cada elemento;
- códigos visibles;
- labels actuales;
- estado de cada elemento;
- campos disponibles;
- relación entre solicitudes y campos;
- tipo de dato;
- obligatoriedad;
- textos de ayuda;
- placeholders;
- reglas declarativas;
- validadores declarativos;
- fuentes de datos;
- columnas asociadas;
- estructura esperada de las hojas.

No debe convertirse en un archivo lleno de lógica procedural.

### Backend.gs

Debe ser lo más genérico y estable posible.

Responsabilidades esperadas:

```text
cargar configuración
cargar catálogos
buscar procesos
buscar usuarios
validar solicitudes
guardar evidencias
registrar solicitudes
registrar detalles especializados
generar tickets
crear eventos de automatización
```

Agregar una solicitud normal no debería requerir modificar el backend.

Solo se modifica `Backend.gs` cuando aparece una capacidad nueva que no existe todavía.

### Helpers.gs

Contendrá funciones técnicas pequeñas, genéricas y reutilizables.

Ejemplos:

```text
obtener spreadsheet
obtener hoja
mapear headers
buscar columna
agregar fila desde un objeto
buscar registro por valor
crear hoja
agregar columna
renombrar header
normalizar valores
trabajar con cache
leer propiedades
```

Los helpers deben tener comentarios breves que indiquen qué hacen, qué reciben y qué devuelven.

No se quiere un `updateProject()` universal que intente adivinar cualquier cambio posible.

### Index.html

Es el frontend.

Debe construir la interfaz a partir de `Config.gs` y encargarse de:

- navegación por el árbol;
- mostrar únicamente solicitudes activas;
- renderizar campos;
- mostrar ayudas;
- aplicar condiciones de visibilidad;
- validaciones rápidas;
- autocompletados;
- revisión antes del envío.

El diseño visual actual no forma parte de esta etapa de refactor.

### Setup inicial

El setup solo tiene sentido para la instalación inicial.

No se considera necesario mantener `Setup.gs` como pieza central permanente. La inicialización puede reutilizar funciones de `Helpers.gs` para crear hojas, headers, propiedades y estructura base.

Las migraciones futuras se resolverán caso por caso usando esos helpers.

## 4. Configuración como matriz central

La configuración será la fuente principal para comprender el sistema.

Ejemplo conceptual:

```javascript
{
  id: 'aris_external_access',
  code: 'R1.1.1',
  parentId: 'aris_user_access',
  label: 'Acceso para personal externo',
  status: 'active',
  fields: [
    'p_registro',
    'first_names',
    'last_names',
    'access_reason'
  ]
}
```

La identidad técnica y el código visible deben ser distintos.

```text
id: aris_external_access
code: R1.1.1
```

El `id` es permanente. El `code` puede cambiar si algún día se reorganiza el árbol.

## 5. Identidad permanente de campos

Cada dato debe tener una identidad técnica estable.

```javascript
{
  id: 'access_reason',
  label: 'Motivo de acceso a ARIS',
  type: 'textarea'
}
```

Si el texto visible cambia a `Justificación del acceso`, se mantiene:

```text
id = access_reason
```

Solo cambia el label.

## 6. Persistencia de datos

La preferencia actual es que cada dato capturado tenga una columna propia en la hoja correspondiente.

Ejemplo:

```text
Ticket
Fecha de solicitud
Tipo de solicitud
P-registro
Taxonomía
Motivo de acceso
Nuevo Process Owner
...
```

No se ha acordado utilizar una columna `payload_json` como almacenamiento principal.

El JSON o matriz central se entiende actualmente como parte de `Config.gs`, no como sustituto de las columnas.

La configuración debe permitir mapear:

```text
identidad del campo
↔ label
↔ columna
↔ solicitudes que lo utilizan
↔ estado
```

### Punto pendiente

Todavía puede evaluarse en el futuro si conviene guardar algún snapshot adicional de configuración o metadata por solicitud. No está definido en esta versión.

## 7. Reutilización de campos

Los campos pueden reutilizarse entre diferentes tipos de solicitud cuando conceptualmente representan el mismo dato.

Ejemplo:

```text
Taxonomía del proceso
```

puede aparecer en varias solicitudes.

No se crea una columna distinta por solicitud si el dato es realmente el mismo.

## 8. Archivado de campos reutilizados

El archivado se maneja en dos niveles.

### Relación solicitud ↔ campo

Si un campo deja de usarse en una solicitud específica pero sigue activo en otras:

- se archiva esa relación;
- el campo global sigue activo;
- la columna no se marca como archivada.

### Campo global

Un campo se considera globalmente archivado solo cuando ninguna solicitud activa lo utiliza.

En ese momento:

- no aparece en formularios nuevos;
- la columna permanece;
- el header puede marcarse como archivado;
- opcionalmente la columna puede ocultarse;
- los datos históricos nunca se eliminan.

## 9. Archivado de solicitudes

Las solicitudes con histórico no se eliminan de la configuración.

Estados base previstos:

```text
active
archived
```

Opcionalmente se podrá añadir `draft` si aparece una necesidad real.

Una solicitud archivada:

- deja de mostrarse en el formulario;
- mantiene su identidad;
- mantiene su label histórico;
- conserva relación con sus campos;
- sigue siendo interpretable en registros antiguos.

Nunca se reutiliza el mismo `id` para una solicitud diferente.

## 10. Histórico y no destrucción

La evolución del sistema debe ser no destructiva por defecto.

Cuando algo deja de utilizarse:

```text
NO borrar columna
NO borrar datos
NO reutilizar identidad
NO perder relación histórica
```

En su lugar:

```text
archivar
documentar
mantener datos
ocultar cuando corresponda
```

## 11. Hojas operativas actuales

```text
Solicitudes
Detalle Solicitudes de Mantenimiento
Equipo
BD Procesos
BD T&C
Automation_outbox
```

### Solicitudes

Registro general de requerimientos.

Puede crecer horizontalmente conforme aparezcan nuevos datos.

Si con el tiempo la hoja se vuelve demasiado ancha o difícil de administrar, el agente debe evaluar alternativas antes de seguir agregando columnas sin criterio.

### Detalle Solicitudes de Mantenimiento

Tabla especializada para R3.

El patrón podrá reutilizarse en el futuro cuando otra familia realmente requiera una tabla especializada.

No se crea automáticamente una hoja por cada categoría.

### Equipo

Directorio del equipo de atención.

### BD Procesos

Catálogo de procesos y variantes.

### BD T&C

Catálogo de personas.

Debe utilizarse de forma eficiente; no se debe asumir que siempre conviene cargar el catálogo completo al navegador.

## 12. Automation_outbox

`Automation_outbox` desacopla la captura de la automatización posterior.

```text
Usuario envía solicitud
        ↓
se registra correctamente
        ↓
se crea evento en Automation_outbox
        ↓
el usuario recibe confirmación
```

Después:

```text
RDA / Python / otra automatización
        ↓
lee eventos pendientes
        ↓
procesa
        ↓
actualiza estado
```

Si una automatización falla, la captura no debe fallar.

Información mínima esperada:

```text
Id evento
Tipo de evento
Id solicitud
Fecha
Estado
Intentos
Último intento
Error
Fecha de procesamiento
```

No es necesario duplicar toda la solicitud en esta tabla salvo que una integración futura lo requiera.

## 13. Escalabilidad

La arquitectura debe pensarse desde el inicio para aproximadamente 10.000 solicitudes.

Principios:

- no leer toda una hoja para localizar un único registro;
- evitar `getDataRange().getValues()` cuando solo se busca un ticket, `request_id` o una fila;
- priorizar lecturas por rango;
- búsquedas por columnas concretas;
- `TextFinder` cuando sea apropiado;
- escrituras por lote;
- CacheService para catálogos y configuración cuando aporte valor;
- PropertiesService para metadata pequeña;
- búsquedas bajo demanda para catálogos grandes;
- pocas llamadas navegador ↔ Apps Script.

La baja latencia sigue siendo una prioridad.

## 14. Rol del agente futuro

La herramienta debe estar preparada para que una persona sin conocimiento técnico profundo pueda pedir cambios a un agente.

Ante una solicitud como:

```text
“Agrega una nueva solicitud para ...”
```

el agente debe primero entender:

- si pertenece a una categoría existente;
- si necesita una nueva categoría;
- en qué nivel del árbol debe ubicarse;
- si es nodo intermedio o solicitud final;
- qué campos necesita;
- qué campos existentes puede reutilizar;
- cuáles son nuevos;
- qué validaciones necesita;
- si requiere nuevos catálogos;
- si requiere tabla especializada;
- si cambia estructuras existentes;
- si necesita una migración.

Si una decisión funcional no está clara, debe preguntar antes de implementar.

## 15. Cambios futuros y migraciones

No se busca un migrador universal.

Los cambios sencillos pueden resolverse directamente desde configuración:

```text
nuevo label
nuevo texto de ayuda
activar solicitud
archivar solicitud
agregar campo
agregar opción
```

Los cambios complejos se analizan individualmente:

```text
dividir un campo histórico en dos
fusionar campos
cambiar significado de una columna
mover información a una tabla especializada
reorganizar datos históricos
```

Para estos casos, el agente crea una migración explícita utilizando los helpers disponibles.

## 16. Documentación para agentes

Además del código, el proyecto debe incluir una guía breve para mantenimiento por agentes.

Nombre propuesto:

```text
AGENT_GUIDE.md
```

Debe explicar:

- arquitectura;
- responsabilidades de cada archivo;
- estructura de Config;
- identidad permanente;
- archivado;
- reutilización de campos;
- preservación del histórico;
- uso de Helpers;
- reglas de escalabilidad;
- cuándo preguntar;
- cuándo crear una migración;
- qué nunca debe hacerse automáticamente.

## 17. Pendientes de definir

Todavía no están cerradas todas las reglas funcionales ni de evolución.

Pendientes:

- estructura definitiva del objeto de configuración;
- estados adicionales si fueran necesarios;
- política exacta para marcar headers archivados;
- cuándo ocultar físicamente columnas archivadas;
- límite práctico para considerar `Solicitudes` demasiado ancha;
- criterios para crear tablas especializadas;
- estrategia exacta de búsquedas para catálogos grandes;
- versionado de configuración;
- necesidad o no de snapshot adicional por solicitud;
- migraciones específicas;
- reglas particulares por tipo de solicitud.

# Reglas definidas V1

## R1. Config.gs es el contrato funcional central
**Regla:** categorías, solicitudes, campos, estados y estructura declarativa deben poder entenderse desde `Config.gs`.  
**Motivo:** reducir puntos de cambio y permitir que un agente comprenda rápidamente el sistema.

## R2. Backend genérico
**Regla:** una solicitud normal nueva no debe requerir lógica específica en `Backend.gs`.  
**Motivo:** evitar que el backend se convierta en una colección de casos difíciles de mantener.

## R3. Identidades permanentes
**Regla:** solicitudes y campos tienen un `id` técnico permanente independiente de su código o label visible.  
**Motivo:** permitir renombres y reorganizaciones sin romper históricos ni referencias internas.

## R4. No reutilizar identidades
**Regla:** un `id` archivado nunca se reutiliza para representar otra cosa.  
**Motivo:** evitar ambigüedad histórica.

## R5. Datos en columnas
**Regla:** cada dato estructurado requerido por las solicitudes se registra en una columna correspondiente.  
**Motivo:** mantener información visible, filtrable y utilizable desde Google Sheets.

## R6. Reutilizar campos cuando representan el mismo concepto
**Regla:** distintas solicitudes pueden usar el mismo campo y la misma columna si el significado del dato es realmente el mismo.  
**Motivo:** evitar duplicación innecesaria y mantener una estructura comprensible.

## R7. Archivado por relación y por campo
**Regla:** si un campo deja de usarse solo en una solicitud, se archiva esa relación. La columna se archiva globalmente solo cuando ningún tipo de solicitud activo la utiliza.  
**Motivo:** evitar marcar como obsoleto un dato que todavía se usa.

## R8. No borrar histórico
**Regla:** archivar no implica borrar columnas, datos ni definiciones históricas.  
**Motivo:** preservar trazabilidad.

## R9. Solicitudes archivadas permanecen definidas
**Regla:** una solicitud con histórico se marca como archivada en lugar de eliminarse.  
**Motivo:** mantener la relación entre registros antiguos y su definición.

## R10. Tablas especializadas solo cuando exista necesidad real
**Regla:** se mantiene `Detalle Solicitudes de Mantenimiento` para R3 y solo se crean estructuras similares cuando la operación lo justifique.  
**Motivo:** evitar proliferación innecesaria de hojas.

## R11. Helpers reutilizables, no migrador universal
**Regla:** `Helpers.gs` proporciona primitivas seguras; las migraciones complejas se crean específicamente para el cambio requerido.  
**Motivo:** un proceso genérico no puede interpretar correctamente todos los cambios futuros.

## R12. Cambios destructivos requieren análisis
**Regla:** dividir, fusionar, reinterpretar o mover datos históricos exige una migración explícita y revisión previa.  
**Motivo:** minimizar riesgo de pérdida o corrupción de información.

## R13. Diseñar para ~10.000 solicitudes
**Regla:** las operaciones de backend deben evitar lecturas completas innecesarias y trabajar eficientemente por rangos, columnas o búsquedas específicas.  
**Motivo:** mantener baja latencia conforme crece el histórico.

## R14. Captura y automatización desacopladas
**Regla:** el registro de una solicitud no depende del éxito de RDAs o automatizaciones posteriores.  
**Motivo:** una falla de automatización no debe impedir una captura válida.

## R15. El agente debe preguntar cuando falte intención funcional
**Regla:** si no está claro dónde ubicar una solicitud, qué campo reutilizar, si crear categoría, tabla especializada o migración, el agente debe consultarlo antes de modificar.  
**Motivo:** evitar decisiones de negocio inferidas incorrectamente.

## R16. Configuración y documentación deben ser legibles para agentes
**Regla:** comentarios breves, nombres claros, estructura predecible y documentación explícita.  
**Motivo:** facilitar mantenimiento sin generar ruido innecesario.
