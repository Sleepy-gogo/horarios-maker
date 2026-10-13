# Pruebas de uso y evidencia

Auditoría del 13 de octubre de 2026. Se recorrió la aplicación real con Vite en `127.0.0.1:5173`, Chromium headless y un contexto de navegador nuevo. Los datos son fixtures descartables; no se usó el almacenamiento del navegador del usuario. No se modificó `src`.

## Resultado

La aplicación sirve para editar y descargar horarios simples, pero hoy no protege el documento ante entradas inválidas ni fallas de almacenamiento. La pérdida de datos tiene prioridad sobre el rediseño. La exportación PNG cambia la tipografía de la vista aun cuando las fuentes de la página terminaron de cargar.

La evaluación heurística actual es **3/10**. Es un juicio de revisión, no una medición con usuarios. La vista inmediata, la exportación JSON y los formularios básicos ayudan; la falta de recuperación, los errores silenciosos, el concepto confuso de materia, el lienzo sin interacción y la legibilidad móvil reducen el puntaje. Para alcanzar la calidad esperada se necesitan los flujos de [02](02-producto-y-flujos.md), la composición de [03](03-motor-y-exportacion.md) y las puertas de aceptación de [06](06-plan-de-implementacion.md). Una prueba posterior con usuarios debe comprobar que esas decisiones funcionan, no sólo que están implementadas.

## Método y límites

Se intentó primero el navegador colaborativo de T3. La navegación directa abrió el editor, pero dos inspecciones devolvieron `Preview automation snapshot timed out after 15000ms.` También apareció `No preview automation host is available for evaluate`. CUA no tenía navegadores conectados. Las pruebas se completaron con Playwright y el Chromium disponible en el entorno.

El [script](evidence/browser-audit.mjs) conserva las acciones. Los [resultados JSON](evidence/browser-results.json) registran la versión exacta de Chromium, geometría y errores. Las capturas permiten revisar lo que se vio. El script incluye una segunda ejecución para reproducir datos y comparación gráfica; no agrega un framework de pruebas al producto.

Se comprobó el comportamiento en Chromium de escritorio y con viewports móviles emulados de 390×844 y 320×568. Esto no equivale a probar Safari, Firefox, un teléfono físico, teclado virtual, VoiceOver o NVDA. No se simularon todas las políticas de portapapeles porque la aplicación actual no implementa copiar/pegar. El nuevo motor todavía no existe; sus pruebas son criterios futuros, no resultados aprobados.

## Casos recorridos

| ID | Acción real | Resultado | Prioridad |
| --- | --- | --- | --- |
| U01 | Abrir sin datos | Aparece un horario vacío con todas las herramientas; no hay flujo de crear proyecto. | P1 |
| U02 | Agregar bloque, cambiar materia/aula/detalle y agregar otro | Ambos comienzan lunes 08:00–09:00 y ocupan el mismo rectángulo. El segundo tapa al primero. | P0 |
| U03 | Vaciar nombre de materia | El input vuelve a `Materia`. La normalización durante escritura no permite mantener un borrador vacío. | P1 |
| U04 | Cambiar inicio a 23:59 | Inicio y final quedan en 23:59, intervalo de duración cero. | P0 |
| U05 | Hacer click en SVG y pulsar Delete | No se selecciona ni borra un bloque. | P1 |
| U06 | Pulsar Ctrl+Z después de ese click | Se deshace la edición nativa del campo Detalle, de `Teoría` a `Comision`, y el foco vuelve al input. No hay historial del documento. | P1 |
| U07 | Exportar JSON e importar el mismo archivo | El estado válido coincide, incluidos IDs y ajustes. | Pasa |
| U08 | Abrir bloque y pulsar Eliminar | Se elimina de inmediato. No hay recuperación del bloque por historial. | P1 |
| U09 | Importar `{}` | Se acepta como `JSON importado` y reemplaza el horario por uno vacío. | P0 |
| U10 | Importar tema `inexistente` | Error `Cannot read properties of undefined (reading 'blockRadius')`; `#root` queda vacío. | P0 |
| U11 | Abrir `?s=invalid` con dos bloques guardados | Se persisten cero bloques, se limpia la URL y se anuncia `Horario cargado desde enlace`. | P0 |
| U12 | Reiniciar y pulsar Ctrl+Z | Quedan cero bloques. La operación no pide revisión ni tiene deshacer de documento. | P0 |
| U13 | Hacer fallar `Storage.setItem` con `QuotaExceededError` | Se registra el error y la interfaz queda vacía. El usuario no recibe una salida para guardar el JSON. | P0 |
| U14 | Descargar PNG después de `document.fonts.ready` | Descarga correcta a 2000×2828, pero título y textos usan tipografía distinta. | P0 |
| U15 | Escribir un título largo | Su caja mide aproximadamente 3266.6 unidades en un documento de 1000, con x negativa. Queda cortado sin aviso. | P1 |
| U16 | Importar bloque 10:00–11:00 con rango manual 08:00–09:00 | Dibuja un rectángulo de 28 unidades debajo del final de la grilla; no muestra la hora real ni alerta. | P0 |
| U17 | Revisar switches del panel | Los cinco no tienen texto, `aria-label` ni `aria-labelledby`; sus captions son spans hermanos sin asociación. | P1 |
| U18 | Usar viewport 390×844 | El documento queda de 216×306 píxeles CSS. El panel ocupa la mitad de la altura y la tipografía del horario resulta diminuta. | P1 |
| U19 | Usar viewport 320×568 | Toolbar llega a x≈355.8 y canvas a y=628. El body oculta overflow; se cortan controles y parte del área de trabajo. | P1 |

Los ensayos de funciones, validación, geometría con muchas materias, IDs duplicados y dependencias están en [01](01-auditoria-codigo.md). No se infló la lista contando cada síntoma visual como un problema independiente del motor.

## La diferencia entre vista y PNG

Se guardaron cuatro artefactos de la misma revisión:

- [SVG serializado actualmente](evidence/03-serialized-current.svg).
- [Vista SVG en el navegador](evidence/03-live-svg.png).
- [PNG descargado por la aplicación](evidence/03-export-original.png).
- [Diferencia de píxeles](evidence/03-diff.png).

La captura DOM y la descarga tienen 2000×2828 píxeles. Se retiraron borde, radio y sombra CSS externos del contenedor para comparar el documento. Las fuentes usadas de Bebas Neue y DM Sans constaban como cargadas en la página. El SVG serializado nombra ambas familias, pero no incluye `@font-face` ni bytes de fuentes.

La comparación con `pixelmatch`, umbral 0.1, encontró 62 271 píxeles distintos sobre 5 656 000, aproximadamente 1.10%. El porcentaje incluye diferencias de rasterización; no mide cuánto texto está incorrecto. La evidencia más clara es visual: el título condensado Bebas Neue de la vista se convierte en un sans ancho en el PNG. Un porcentaje bajo sobre mucho fondo vacío puede esconder una diferencia muy importante en el título.

El criterio futuro debe comprobar composición y glifos, no limitarse a "el PNG se descargó". También debe separar los controles del editor del documento exportado. Un outline de selección no pertenece al archivo final.

## Capturas para revisión

| Captura | Qué permite revisar |
| --- | --- |
| [Vacío escritorio](evidence/01-empty-desktop.png) | Jerarquía inicial, ruido de ajustes y ausencia de crear proyecto. |
| [Solapamiento](evidence/02-overlap.png) | Dos bloques existentes, una sola aparición visible. |
| [Móvil 390](evidence/04-mobile.png) | Escala ilegible del documento y reparto de altura. |
| [Móvil 320](evidence/04-mobile-320.png) | Cortes de toolbar y de lienzo. |
| [Importación que hace caer la app](evidence/05-crash-invalid-theme.png) | Pantalla vacía después de un JSON sintácticamente válido. |
| [Título largo](evidence/07-long-title.png) | Falta de composición y aviso de overflow. |
| [Bloque fuera del rango](evidence/08-outside-range.png) | Falsa ubicación en el borde inferior. |

## Cómo repetir las pruebas

Requisitos: Node, servidor Vite levantado y dependencias auxiliares `playwright`, `pngjs`, `pixelmatch` en un directorio temporal. El script usa ese directorio mediante `createRequire`, sin modificar `package.json` ni `bun.lock`.

```powershell
bun run dev --host 127.0.0.1
```

En otra terminal:

```powershell
$auditDeps = Join-Path $env:TEMP 'horarios-maker-audit-deps'
npm.cmd install --prefix $auditDeps playwright pngjs pixelmatch --no-audit --no-fund
# Si Playwright no tiene su navegador instalado:
& (Join-Path $auditDeps 'node_modules/.bin/playwright.cmd') install chromium
# O indicar el ejecutable de Chromium existente, sin instalar uno nuevo:
# $env:AUDIT_BROWSER_PATH = 'ruta-absoluta/chrome-headless-shell.exe'
node docs/evidence/browser-audit.mjs
```

Las capturas y los resultados se sobrescriben en `docs/evidence/`. El contexto del navegador se descarta al finalizar; el script no inspecciona ni borra proyectos personales.

## Qué falta verificar después

Probar la nueva interacción con zoom 50/100/200%, pantalla con scroll, cancelación de gestos, extremos a 00:00/24:00, intervalos de legado fuera de la grilla, diez bloques simultáneos, notas largas y símbolos. Ejecutar export offline y con fuentes lentas/fallidas, recuperación de cuota y conflicto entre pestañas. Completar pruebas en Safari y Firefox, lectores de pantalla y un teléfono físico. Estas condiciones aparecen como puertas de salida en [06](06-plan-de-implementacion.md).
