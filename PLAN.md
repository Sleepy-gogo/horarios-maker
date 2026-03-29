# PLAN

## Objetivo

Construir una SPA en espanol para crear, personalizar, compartir y exportar horarios de cursada como imagen.

El flujo principal es:

1. Editar bloques de clase.
2. Ver el resultado instantaneamente en una lamina.
3. Guardar el horario localmente sin contaminar la URL.
4. Compartir el horario mediante exportacion/importacion de JSON.
5. Descargar el horario como imagen lista para usar.

## Alcance del MVP

- SPA cliente, sin backend.
- Interfaz completamente en espanol.
- Persistencia local automatica.
- Editor de bloques con:
  - dia
  - hora de inicio
  - hora de fin
  - materia
  - aula
  - detalle
  - color de fondo
  - color de texto
- Personalizacion del documento:
  - titulo
  - subtitulo
  - modo de compactacion
  - rango horario automatico o manual
  - hora de inicio y fin del documento
  - aspect ratio
  - tema visual
  - densidad
  - grosor de lineas
  - esquinas rectas o redondeadas
  - toggles para aula, detalle, horas y leyenda
- Exportacion:
  - PNG
  - SVG
  - JSON
- Estado inicial en blanco.

## Restricciones del proyecto

- Sin backend.
- Mantener la URL limpia por defecto.
- Sin backend.
- Compartir por enlace solo es aceptable si mas adelante existe compresion razonable o un backend para slugs cortos.
- Evitar dependencias innecesarias si el navegador puede resolverlo.
- Mantener la app liviana y facil de hostear estaticamente.
- No introducir copy en ingles en la UI.
- El preview y la exportacion deben salir del mismo motor visual para evitar diferencias.

## Decisiones tecnicas actuales

- Stack: React + TypeScript + Vite.
- Render del horario: SVG.
- Exportacion:
  - SVG: serializacion directa del nodo.
  - PNG: rasterizacion del SVG a canvas.
- Persistencia principal:
  - `localStorage`
- Compatibilidad legacy:
  - lectura de `?s=...` para enlaces viejos
  - limpieza inmediata de la URL despues de cargar
- Intercambio manual:
  - exportacion/importacion de JSON
- Sin router por ahora.

## Modelo de datos

`AppState`

- `version`
- `settings`
- `items`

`settings`

- `title`
- `subtitle`
- `compactMode`
- `timeRangeMode`
- `documentStartHour`
- `documentEndHour`
- `aspectRatio`
- `theme`
- `density`
- `strokeMode`
- `cornerMode`
- `uppercaseTitle`
- `showRoom`
- `showDetails`
- `showLegend`
- `showTimeLabels`

`items[]`

- `id`
- `day`
- `start`
- `end`
- `subject`
- `room`
- `details`
- `color`
- `textColor`

## Comportamiento esperado

### Compactacion

- `uniforme`: cada hora ocupa el mismo alto visual.
- `optimizado`: las horas sin cursada se comprimen para ahorrar espacio.

### Rango horario

- `automatico`: el documento calcula el rango segun las materias cargadas.
- `manual`: el usuario fija la hora inicial y final del documento.

### Compartir

- Cada cambio relevante actualiza `localStorage`.
- Abrir una URL vieja con `?s=...` debe reconstruir el horario, persistirlo localmente y limpiar la URL.
- Compartir entre personas se resuelve con exportacion/importacion de JSON mientras no exista backend.
- Si el estado no se puede parsear, la app vuelve al estado vacio por defecto.

### Exportacion

- El archivo exportado debe respetar:
  - aspect ratio
  - colores
  - texto
  - distribucion temporal

## Patrones de implementacion

- Mantener helpers puros para:
  - normalizacion de horas
  - serializacion
  - calculo de timeline
  - wrapping de texto SVG
- Sanitizar siempre los bloques entrantes antes de renderizar.
- Ordenar bloques por dia y hora para asegurar consistencia visual.
- Evitar efectos secundarios fuera de:
  - sincronizacion URL
  - clipboard
  - descarga de archivos
  - localStorage

## Convenciones de UI

- Espanol en labels, botones y estados.
- Estetica editorial/poster, no dashboard generico.
- El preview es la pieza principal de producto.
- El panel lateral es una herramienta de edicion, no el foco visual.

## Convenciones para agentes

- Antes de cambios grandes, revisar este archivo y respetar el alcance.
- No cambiar el contrato de `AppState` sin actualizar este documento.
- No reemplazar SVG por HTML/canvas sin una razon fuerte.
- Si se agregan nuevas opciones visuales, deben ser persistibles y exportables en JSON.
- No introducir dependencias pesadas para resolver problemas pequeños.
- No revertir trabajo ajeno sin instruccion explicita.

## Proximas mejoras candidatas

- Duplicar bloques.
- Reordenar bloques por drag and drop.
- Soporte para sabado.
- Paletas predefinidas por carrera.
- Plantillas visuales intercambiables.
- Import/export de JSON.
- Backend minimo para slugs cortos compartibles.
- Exportacion con mas resoluciones.
- Tipografias embebidas para exportaciones mas consistentes.

## Definicion de terminado para el MVP

- Se puede editar un horario completo desde la UI.
- La URL permanece limpia en uso normal.
- El horario persiste localmente entre recargas.
- Un JSON exportado reconstruye el mismo horario al importarse.
- Se puede descargar al menos PNG y SVG.
- La app funciona en desktop y mobile.
- La UI esta completamente en espanol.
