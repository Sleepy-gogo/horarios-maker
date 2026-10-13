# Preparación y encargo para Opus 5.5

El usuario autorizó implementar toda la reconstrucción en un thread nuevo de T3 Code con Claude Opus 5.5. También pidió preparar y commitear la base antes de lanzarlo. Este documento registra la preparación, no una implementación terminada del estudio.

## Lo que ya está listo

- Registro `@uiarc` en `components.json`, siguiendo la [instalación oficial](https://uiarc.dev/docs/installation).
- 27 piezas gratuitas en `src/components/arc/`: action-button, alert, bottom-sheet, button-group, checkbox, color-picker, command-palette, context-menu, copy-button, dialog, dropdown-menu, empty-state, file-dropzone, inline-edit, number-field, popover, radio-cards, radio-group, resizable-panels, search-field, segmented-control, slider, split-button, tabs, text-morph, time-picker y tooltip. Text morph llegó como dependencia del color picker. Las bases shadcn de `src/components/ui/` se conservaron.
- Motion y los paquetes Radix necesarios instalados. Vite actualizado a 8.3.4; configuración preparada para `import.meta.dirname`.
- Zod, Zustand e idb disponibles para validación, estado y persistencia. HarfBuzzJS disponible como candidato para el motor tipográfico. Podés cambiar la elección técnica si encontrás una ruta mejor y quitar dependencias que no uses.
- Tokens del estudio y shadcn concentrados en `src/styles/tokens.css`. Las propiedades antiguas de chrome son aliases de las semánticas de shadcn.
- Puente Arc en `src/styles/arc-tokens.css`, cargado a través de `src/components/arc/foundation.css`. Sus aliases `--arc-accent*` resuelven desde `--primary*`, evitando confundir el acento de marca con el hover de shadcn. Tipografía, colores, superficies, radios y controles usan las mismas fuentes de tokens; llegan también a portales.
- Foundation original preservada como `foundation.upstream.css`, sólo para consulta. **No importarla globalmente:** volvería a crear un sistema de colores y foco separado.
- Eliminados los filtros de blur de las animaciones y el backdrop blur de Arc. Sus radios de blur en `motion-tokens.ts` son cero como protección adicional. Se mantuvieron los fades, movimientos y sombras normales. No volver a introducir blur al instalar o actualizar piezas.
- Selector de horas adaptado a 24h y pasos de 30 min por defecto. `includeEndOfDay` añade `24:00` sólo para el campo final. Combobox con opción activa asociada, opciones fuera del orden de Tab, Home/End y cierre al perder foco. La entrada de minutos arbitrarios de legado y los límites del proyecto siguen siendo responsabilidad del flujo integrado.
- Cinco familias locales completas en `public/fonts/`: DM Sans, Bebas Neue, JetBrains Mono, Inter y Geist, con licencias OFL. `catalog.json` describe assets, rangos de peso y hashes. `src/styles/fonts.css` las registra; se quitó el import CSS de Google que antes necesitaba red para las fuentes iniciales. No está resuelto aún el pipeline de exportación tipográfica.
- Licencia MIT de Arc conservada en `src/components/arc/LICENSE`. Sus archivos instalados son código local editable, no una caja cerrada.

El CLI generó inicialmente `src/@components/arc`; se corrigió a `src/components/arc`. La instalación de Bun tuvo errores EPERM al mover algunos paquetes a caché en Windows. Se completó con npm usando `--package-lock=false` y luego `bun install --lockfile-only`; el proyecto conserva `bun.lock` como lockfile, sin un segundo lockfile npm. Build y lint quedan como controles básicos de integración. No se agregaron suites ni nuevas evidencias para esta preparación.

Importá cada componente por su archivo, sin un barrel de todas las piezas. No hace falta usar todos los instalados. Hay oportunidad de integración amplia y concreta, pero conservar una base local equivalente es válido. Traducí los textos internos de las piezas que uses al español: la instalación conserva algunos defaults del proveedor en inglés.

## Encargo completo

Implementá el producto completo descrito en `docs/01` a `docs/06`. Empezá por leer `docs/README.md`, el plan integrado 06 y este archivo; usá 02 para flujos, 03 para motor y 05 para componentes. La referencia `C:/Users/gamer/code/tech-stack-architect` sirve para inspirarse en un estudio y sus comandos/paneles, sin arrastrar su stack entero.

La dirección de diseño, wireframes y flujos anteriores son propuestas. **Tomalos con una pizca de sal: confiamos plenamente en tus decisiones.** Si detectás una solución mejor, aplicala; no necesitás defender todos los detalles del plan ni pedir aprobación por elecciones normales. La preparación de tokens tampoco fija la paleta, la fuente de la interfaz ni la densidad definitivas. Podés reorganizar archivos y reemplazar piezas si mejora el resultado. Mantené una fuente de tokens compartida y la ausencia de blur.

El resultado debe cubrir:

1. Materias con identidad propia y nombre/colores compartidos; bloques con aula, tipo y notas independientes. Renombrar/recolorear una materia actualiza todos sus bloques.
2. Crear y abrir proyectos locales; empty state, modal inicial y de ajustes, barra superior de archivo/edición/vista/documento/tema; biblioteca y propiedades contextuales.
3. Motor nuevo con composición sólida, texto medido, solapamientos legibles y personalización real. No conservar los errores geométricos del actual.
4. Seleccionar materia, ghost en horario y creación por click/drag; seleccionar/mover bloques; handles superior/inferior y controles ±30 min.
5. Deshacer/rehacer, Delete, duplicar, copiar/pegar y atajos con alcance correcto. Inputs conservan sus comandos de texto. Todo gesto cancelable y confirmado como una operación.
6. Selectores cómodos de colores/horas, paletas y temas persistentes, fuentes públicas de Google con carga y errores controlados. Las fuentes locales iniciales permiten trabajar sin red.
7. Vista, SVG y PNG con la misma composición, contenido, fuentes y ajustes. El outline, ghost y handles del editor no salen en el archivo final.
8. Autosave real, recuperación de errores, migración de JSON/localStorage/enlaces viejos sin pérdida silenciosa, importación segura y exportación editable.
9. Uso selectivo y suficiente de Arc en los lugares útiles, con semántica, traducciones, foco, reduced motion y consistencia con shadcn.
10. Interfaz adaptable y operaciones reales; ningún botón ficticio, sección pendiente ni caso crítico dejado para que el usuario lo arregle después.

La instrucción más reciente del usuario prevalece sobre las puertas de pruebas/evidencia de los documentos anteriores. **No pide suites, capturas entregables, reportes ni benchmarks.** No conviertas el encargo en otra auditoría ni gastes el trabajo produciendo pruebas para mostrar. Hacé los controles mínimos que necesites para entregar algo funcional y compilable.

Sí es obligatorio que hagas al menos una revisión visual general del producto funcionando, tanto en escritorio como en un ancho estrecho. Recorré los flujos principales y corregí errores de diseño, overflows, controles rotos, textos cortados y problemas que encuentres. Usá primero el preview de T3; si falla, seguí el mecanismo de fallback disponible en el entorno. El usuario espera el producto terminado, no evidencia de cada comprobación.

Trabajá con autonomía hasta terminar todos los cambios necesarios. No pares en una fase A/B, un MVP parcial, un nuevo plan o una promesa de continuar. Podés tomar decisiones mejores que las nuestras manteniendo la intención del usuario. Resolvé pendientes dentro del trabajo y entregá un resumen breve de lo que quedó funcionando.
