# PLAN

Contrato vigente de Horario Studio v2. Antes de un cambio grande, revisá este archivo y actualizalo si el cambio altera algún contrato. El detalle de diseño está en `docs/02`, `docs/03` y `docs/06`; el estado de la implementación, en `docs/08`.

## Objetivo

Una SPA estática en español para crear, diseñar, guardar y exportar horarios de cursada semanales. No tiene backend. Lo que se ve en el lienzo es exactamente lo que se descarga.

## Restricciones

- No hay backend. La URL queda limpia: los enlaces `?s=` viejos solo se leen una vez para migrarlos.
- La interfaz está toda en español.
- No se usa blur (`backdrop-filter`) en ningún lugar.
- No se importa `foundation.upstream.css` de forma global. Los tokens viven en `src/styles/tokens.css` y `src/styles/arc-tokens.css`.
- Vista, SVG y PNG salen de la misma escena y del mismo string SVG. No hay un segundo renderizador.
- Una fuente que falló nunca se reemplaza en silencio en una descarga: la exportación se bloquea con un motivo y una acción.
- Nunca se sobrescriben datos originales: la migración y la importación siempre crean proyectos nuevos.
- No se suman dependencias pesadas para problemas chicos.

## Modelo de datos (schemaVersion 2)

La fuente de verdad es `src/domain/types.ts` y la validación está en `src/domain/schema.ts` (zod).

- **`ScheduleDocument`:** `schemaVersion`, `id`, `createdAt`, `subjects[]`, `blocks[]`, `settings` y `appearance`.
- **`Subject`:** `id`, `name`, `color` y `textColor`. Los colores son de la materia, así que todas sus clases los comparten.
- **`Block`:**
  - `id`, `subjectId`, `day` (`mon`…`sun`);
  - `start` y `end` en minutos desde las 00:00, en pasos de 30, con `0 ≤ start < end ≤ 1440`;
  - `room`, `kind` y `notes`.
- **`DocumentSettings`:**
  - `title`, `subtitle`;
  - `page` (preset o tamaño propio, de 320 a 4000 px);
  - `days` y `range` (rango visible de al menos una hora);
  - `compactEmptyHours`, opcional al leer archivos v2 anteriores y desactivado por defecto;
  - `show` (qué textos se dibujan).
- **`Appearance`:**
  - página, colores, hoja, encabezado, grilla, bloques, leyenda y decoraciones;
  - `type` (un `TextStyle` por rol, con su `FontRef`);
  - `palette` para las materias nuevas.
- **`FontRef`:** `source` (`local` o `google`), `id`, `family`, `version` fijada, `weight` e `italic`.
- **Límites:** 200 materias, 600 clases y 100 pasos de historial. Los textos tienen topes (`TEXT_LIMITS`).

Las clases que quedan fuera de los días o del rango visibles no se pierden. Se listan como "Fuera del documento" y bloquean la exportación hasta que se ajusten.

## Archivos

| Formato | Contenido |
| --- | --- |
| `horario-studio/project` | Un documento. |
| `horario-studio/backup` | Todos los proyectos (incluida la papelera) y los temas. |
| `horario-studio/theme` | Una `Appearance` con nombre. |

`readImport` también acepta un documento v2 suelto y el formato v1. Para importar, primero se valida, después se muestra un resumen y recién al confirmar se guarda como proyecto nuevo.

## Almacenamiento

Se usa una base IndexedDB llamada `horario-studio`, versión 1, con cinco almacenes:

| Almacén | Contenido |
| --- | --- |
| `projects` | Documento, `revision` (para detectar escrituras desde otra pestaña) y `deletedAt` (papelera de 7 días). |
| `themes` | Temas guardados. |
| `kv` | Preferencias (con copia en `localStorage` para aplicar el tema de la UI antes de abrir la base) y marcas de migración. |
| `fonts` | Bytes de fuentes descargadas, con su hash. |
| `legacy` | Originales v1 y enlaces, guardados tal cual. |

### Autoguardado

- Se guarda 450 ms después de cada cambio, con Ctrl+S y antes de cambiar de proyecto.
- Si guardar falla, el cambio de proyecto se cancela.
- Si otra pestaña escribió antes (`revision`), se marca un conflicto y se ofrecen acciones.
- `beforeunload` avisa cuando hay cambios sin guardar.

## Motor

`src/engine`, en este orden:

1. `layoutDocument(doc, resolveFont)` crea una `Scene`: rectángulos, corridas de glifos ya medidas, cajas de bloques con carril y conflicto, la geometría de la grilla y los `issues`.
2. `sceneToSvg(scene)` convierte la escena en un único string SVG. El texto va como `<path>` definidos una vez por glifo: no hay `<text>` ni `font-family`.
3. El lienzo inyecta ese string. La descarga SVG usa el mismo string, y la PNG lo rasteriza (`svgToPng`) hasta 8192 px por lado y 16 Mpx.

Detalles:

- **Horas vacías:** `compactEmptyHours` activa una escala de segmentos horarios con peso 0,42 para franjas vacías y 1 para ocupadas. El peso vacío aumenta si lo necesitan las etiquetas. Vista, exportación y conversión inversa de punteros comparten la escala; cada gesto congela su geometría. El comportamiento y las pruebas están en `docs/09`.
- **Superposiciones:** `assignLanes` reparte las clases superpuestas en carriles por día.
- **Texto:** se mide con HarfBuzz, se corta en líneas y se trunca con elipsis; cuando no entra, deja un aviso.
- **Contraste:** si el texto de una materia no llega a 4,5:1 sobre su fondo, se corrige automáticamente.
- **Bloqueos de exportación:** `exportBlockers` junta los errores: fuentes no disponibles, clases fuera del documento, grilla demasiado baja y leyenda que no entra. Las advertencias (texto truncado, glifos que faltan en la fuente) se pueden aceptar.

## Edición

- **Historial:** `commit(label, recipe, { coalesce })`. Los cambios con la misma clave dentro de 1,5 s se fusionan en una entrada.
- **Gestos de puntero:**
  - crear, mover, redimensionar el inicio o el fin, y tocar;
  - umbral de 4 px y captura del puntero;
  - Escape restaura el estado; solo el gesto confirmado entra al historial.
- **Pegar, duplicar y tocar en pantallas táctiles:** generan un candidato que se confirma (Enter) o se mueve con flechas.

### Atajos

| Acción | Atajo |
| --- | --- |
| Herramientas | `V` seleccionar · `B` colocar |
| Edición | `Ctrl+Z` / `Ctrl+⇧Z` / `Ctrl+Y` · `Ctrl+C` / `Ctrl+V` · `Ctrl+D` · `Supr` |
| Mover la clase | Flechas (`⇧` cambia la hora de fin, `Alt` la de inicio) |
| Archivo | `Ctrl+S` · `Ctrl+O` · `Ctrl+⇧E` exportar |
| Ajustes | `Ctrl+,` documento · `Ctrl+⇧A` apariencia |
| Navegación | `Ctrl+K` comandos · `Ctrl+±` / `Ctrl+0` zoom · `?` lista de atajos |

## Convenciones de código

- **Lógica pura:** el dominio y el motor no tocan React ni el DOM.
- **React Compiler y fuentes:** el compilador memoiza por argumentos. Las funciones que dependen de fuentes cargadas reciben `fontsVersion` (de `useFontsVersion()`), aunque no lo usen; los parámetros con `_` no los marca el lint.
- **Zustand:** los selectores no devuelven arrays ni objetos nuevos.
- **CSS:** los CSS modules de Arc no tienen capa y le ganan a Tailwind. Para pisarlos se usa el modificador `!`.
- **Opciones visuales nuevas:** van en `Appearance`, con su validación en `schema.ts` y su soporte en `layout.ts`. Así se persisten, viajan en los JSON y se exportan.
- **Trabajo ajeno:** no se revierte sin instrucción explícita.

## Pendientes conocidos

- Faltan pruebas manuales en Safari y Firefox, con lectores de pantalla y en teléfonos físicos (la revisión se hizo en Chromium).
- El catálogo de Google Fonts y las descargas dependen de la red. Las fuentes ya usadas quedan en caché local.
- Hay piezas Arc preparadas que todavía no se usan (context menu, resizable panels, segmented control, slider, text morph).
