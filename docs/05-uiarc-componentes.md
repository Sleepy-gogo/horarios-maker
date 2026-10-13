# Componentes gratuitos de Arc UI para horarios-maker

Consulta del 13 de octubre de 2026. Esta revisión propone usos y decisiones; no instala componentes ni modifica `src/`.

## Alcance y fuentes verificadas

El [catálogo oficial](https://uiarc.dev/r/catalog.json), generado el 12 de octubre de 2026 a las 15:00:10 UTC, contiene 250 entradas. Filtrando explícitamente `tier === "free"` aparecen **110 componentes y 22 bloques**, 132 piezas gratuitas. Las otras 118 entradas son Pro, 49 componentes y 69 bloques. Se recorrieron todas las entradas gratuitas y se comprobó que sus nombres existen en el registro del repositorio público, además de las dos piezas de infraestructura.

El [repositorio oficial](https://github.com/kuratlielia/arc-library) se inspeccionó en el commit [55c0d3ebd7cc643ec118c4d8a11413e6fadcc7df](https://github.com/kuratlielia/arc-library/tree/55c0d3ebd7cc643ec118c4d8a11413e6fadcc7df), fechado el 12 de octubre de 2026 a las 15:12:33 UTC. Su registro tiene 134 entradas, las 132 piezas Free y `arc-foundation`/`arc-motion-tokens`. La matriz siguiente es exhaustiva para esa versión del catálogo.

La [home](https://uiarc.dev/) coincide con 110 Free y 22 bloques. Algunas páginas indexadas muestran cifras anteriores, 97 en pricing y 108 en README. No se usan esos textos para contar ni se deduce que una pieza sea gratis porque permita ver su demo. [llms.txt](https://uiarc.dev/llms.txt) también informa 132 entradas Free, pero omite algunas piezas en su listado de enlaces. Para detectar novedades futuras hay que repetir el filtro del catálogo.

| Grupo Free | Cantidad |
| --- | ---: |
| Actions | 18 |
| Inputs | 34 |
| Disclosure | 12 |
| Feedback | 10 |
| Data | 31 |
| Text | 4 |
| Special | 1 |
| Bloques | 22 |
| Total | 132 |

Fuentes por pieza: cada nombre de la matriz enlaza a su ficha oficial. Su Markdown se obtiene agregando `/markdown`; el registro instalable es `https://uiarc.dev/r/<id>.json`. Los IDs no deben traducirse.

## Qué conviene adoptar

Hay 38 decisiones de incluir, 41 de postergar y 53 de descartar para el producto propuesto. Incluir no significa importar 38 componentes nuevos. Varias bases ya existen en el proyecto y conviene conservarlas. Las decisiones se distinguen en la matriz:

- **Incluir, conservar**: mantener la pieza equivalente local y aplicar sólo el patrón útil. Evita dos sistemas de botones, formularios o notificaciones.
- **Incluir, adaptar**: candidato concreto para componer una función futura, con estilos del estudio y datos reales.
- **Postergar**: depende de una capacidad que todavía no existe o aporta poco frente al control actual.
- **Descartar**: no resuelve una tarea de este editor o su movimiento perjudica el trabajo.

Las incorporaciones con mayor retorno son Dialog, Split button, Action button, Copy button, Command palette, Color picker, Radio cards, Inline edit, Resizable panels y un inspector móvil con Drawer/Bottom sheet. Time picker es un candidato con una condición de accesibilidad explicada más abajo. Las filas con “conservar” aprovechan shadcn, Radix y Sonner que ya están instalados.

## Encaje con el repositorio actual

La app declara React ^19.2.4, TypeScript ~5.9.3 y Vite ^8.0.1; Vite resuelto en la auditoría es 8.0.3. Tiene Tailwind ^4.2.2, shadcn, Lucide, Radix y Base UI. `components.json` ya define `@/components` y `@/components/ui`; su registro de terceros está vacío. Motion no está instalado. La [guía oficial](https://uiarc.dev/docs/installation) admite Vite y React 19; Arc entrega TSX y CSS Modules, no requiere Tailwind ni un runtime propio de Arc.

La persistencia actual es un único `AppState` en localStorage. `use-schedule-studio.ts` administra materias y settings; `StudioHeader` ofrece reiniciar, importar/exportar JSON y descargar PNG. `SubjectEditorCard` utiliza campos de hora y color nativos. El preview/exportación comparten un SVG, y Sonner ya muestra resultados en `App.tsx`. “Proyecto” en este documento es una organización futura: no hay hoy colección de proyectos, selector de proyectos ni backend. Esa función necesita un modelo y migración independientes de Arc.

No reemplazar el motor SVG por un componente calendario de Arc. Arc debe aportar controles alrededor de la lámina. Los presets siguen produciendo los mismos settings persistibles y exportables, y las miniaturas salen del mismo renderer.

## Composiciones concretas

### Crear y configurar proyecto

Un botón “Nuevo horario” abre Dialog con nombre, preset de tema mediante Radio cards y días mediante Checkbox. Dos opciones de rango, automático/manual, usan Radio group; el rango manual muestra inicio/fin. El submit crea datos reales y cierra al terminar. Un Alert junto al formulario explica fallos. No se necesita un wizard de registro ni Stepper en el primer formulario.

“Configurar horario” reutiliza ese Dialog para metadatos y propiedades generales. El inspector conserva los ajustes frecuentes, así no obliga a abrir un modal para cada edición. Al reemplazar un horario sin conservarlo, confirmar el efecto y ofrecer una forma real de volver. El modelo de varios proyectos y su migración se planifican antes de presentar esas acciones.

### Toolbar, menús y comandos

La cabecera muestra nombre editable, estado de persistencia y Split button “Descargar PNG”, con menú para SVG. Dropdown menu compone Archivo, Editar, Ver, Documento, Tema y Ayuda según [los flujos](02-producto-y-flujos.md). Archivo agrupa nuevo, abrir/importar, proyectos y backups; los ajustes del documento y del tema abren sus modales. Button group reúne zoom/encuadre junto al preview. Mantener etiquetas visibles en acciones principales; los iconos secundarios tienen nombre accesible y Tooltip.

Command palette es un **bloque Free**, no un componente Pro. Ofrece búsqueda, grupos y atajos, pero renderiza inline: necesita un Dialog que gestione cierre y foco. Agrupar “Proyecto”, “Materias” y “Exportar”. Agregar materia, duplicar selección, ir al inspector y exportar ejecutan el mismo conjunto de comandos que la toolbar. Ctrl/Cmd+K abre, Escape cierra y devuelve foco al control previo. No interceptar atajos mientras la persona escribe en un campo salvo el comando explícito para abrir la paleta. [Ficha del bloque](https://uiarc.dev/components/blocks/command-palette).

### Guardar, copiar y responder

El guardado local automático debe mostrar “Guardado en este dispositivo” sólo cuando la transacción de persistencia tenga éxito. IndexedDB se propone para los proyectos nuevos; el localStorage actual se conserva como fuente de migración. Un error persistente ofrece exportar JSON como recuperación. No usar “Guardando...” por una demora artificial ni emitir un toast por cada tecla.

Action button tiene pendiente, resultado y región de estado; sirve en generación PNG o una importación que requiera trabajo asíncrono. Copy button sirve para copiar JSON. Copiar imagen necesita comprobar la API real y dar Descargar como alternativa. La app actual no produce un enlace corto de proyecto: “Copiar enlace” queda fuera hasta definir compresión o un backend. Sonner conserva las notificaciones globales; Toast y Toast stack de Arc no se montan encima.

### Materias, colores y temas

La biblioteca contiene materias con nombre, color y cantidad de bloques. El inspector contiene propiedades del bloque seleccionado, con día/horas/aula/tipo/notas; no mezcla días y horas como propiedades de la materia. Inline edit renombra una materia y propaga el nombre a sus bloques. Input/Select/Time picker editan el bloque. Alert explica fin anterior al inicio y superposición. Documento y Tema abren modales desde la barra, con Tabs para grupos de ajustes si hacen falta. Los borradores de esos modales se ven en una previsualización y sólo se confirman con Aplicar.

Color picker **sí es Free**. Tiene swatches guardables, entrada de formatos y lectura de contraste, según su ficha y código. No es un catálogo de paletas por carrera listo para usar: esos presets y sus nombres los define horarios-maker. Su `onSwatchesChange` permite persistir colores elegidos; el componente solo no los agrega al JSON de la app. Para el color de texto, usar `background={subject.color}` en el modelo nuevo; para evaluar el fondo, comparar el par real texto/fondo. No confundir el contraste contra el chrome con legibilidad en la exportación. [Ficha Color picker](https://uiarc.dev/components/color-picker).

Radio cards muestra presets de la lámina con miniaturas reales y nombre. Un único preset seleccionado cambia el tema persistible. Theme switcher de Arc cambia el claro/oscuro de la aplicación, una preferencia distinta; nunca usarlo como sustituto de los temas exportables.

### Exportación, importación y primer uso

Al descargar PNG, cambiar el botón a “Generando PNG”, bloquear repetición y volver a una acción disponible si falla. Progress sólo se incorpora si el proceso permite medir avance. No mostrar porcentajes inventados ni Skeleton sobre la lámina en cada edición. La exportación conserva SVG y PNG; JSON se explica como archivo editable.

Importar abre Dialog con File dropzone y botón “Elegir archivo JSON”. Mostrar nombre, validación y cantidad de materias antes de confirmar creación de un proyecto nuevo, sin reemplazar automáticamente el activo. El bloque File upload agrega estados de upload que aquí no existen; no hace falta para leer un archivo local.

El inicio sin proyecto usa Empty state con Crear proyecto y Abrir archivo. Dentro de un proyecto vacío, el estado “Agregá tu primera materia” ofrece Agregar materia y explica cómo colocarla. La ayuda explica persistencia local, exportación y recuperación mediante FAQ/Accordion. Notification center se reserva para notificaciones persistentes reales. Un onboarding corto no necesita animaciones de títulos, marquesinas ni una demostración que reproduzca sola.

## Matriz de todos los componentes Free

Las dependencias se leen del `registry.json` del commit auditado, no del conjunto de devDependencies del repositorio. Abreviaturas: **M** = `motion`, **L** = `lucide-react`, **R: nombre** = `@radix-ui/react-nombre`. “Ninguna” significa sin paquetes runtime adicionales declarados por esa entrada. Todos requieren React; los componentes dependientes y tokens también se instalan. No es una medición de KB comprimidos.

### Actions

| Pieza gratuita e ID | Decisión | Ubicación propuesta | Motivo y adaptación | Paquetes declarados |
| --- | --- | --- | --- | --- |
| [Button](https://uiarc.dev/components/button) · `button` | Incluir, conservar | Crear horario, agregar materia, confirmar modales | La base ya está en components/ui/button. Mantener acciones con etiqueta visible; Arc aporta patrones de loading y respuesta de pulsación si se unifica luego. | M |
| [Action button](https://uiarc.dev/components/action-button) · `action-button` | Incluir, adaptar | Descargar PNG y confirmar creación/importación | Pendiente y éxito dentro del mismo botón evitan doble envío. Conectar al resultado real y traducir sus anuncios; no fingir una demora de guardado local. | L, M |
| [Split button](https://uiarc.dev/components/split-button) · `split-button` | Incluir, adaptar | Toolbar, Descargar con menú PNG/SVG | Una acción principal y formatos alternativos reducen botones sueltos. JSON va en archivo/proyecto, con nombre que distinga datos e imagen. | R: dropdown-menu, L, M |
| [Button group](https://uiarc.dev/components/button-group) · `button-group` | Incluir, adaptar | Toolbar de preview, zoom y encuadre | Agrupa acciones relacionadas. Una sola fila estable; el highlight puede ser discreto y no debe competir con el horario. | R: dropdown-menu, L, M |
| [Floating button group](https://uiarc.dev/components/floating-button-group) · `floating-button-group` | Postergar | Herramientas contextuales al seleccionar bloque en canvas | Tiene sentido con selección directa futura. Hoy duplica la toolbar y tapa la lámina; mantener ubicación fija si se incorpora. | R: tooltip, M |
| [Expanding button group](https://uiarc.dev/components/expanding-button-group) · `expanding-button-group` | Descartar | Toolbar principal | Los nombres que aparecen sólo al hover/foco reducen reconocimiento y desplazan vecinos. Preferir botones con etiqueta estable. | M |
| [Dropdown menu](https://uiarc.dev/components/dropdown-menu) · `dropdown-menu` | Incluir, conservar | Menú proyecto y menú de cada materia | Nuevo, importar, exportar JSON, duplicar y eliminar caben en grupos claros. Ya existe la base local; no agregar otra implementación por estética. | R: dropdown-menu, L, M |
| [Context menu](https://uiarc.dev/components/context-menu) · `context-menu` | Postergar | Clic derecho sobre clase de la vista previa | Útil cuando el SVG permita seleccionar bloques. Mostrar también el mismo menú con un botón para teclado y móvil. | L, M |
| [Copy button](https://uiarc.dev/components/copy-button) · `copy-button` | Incluir, adaptar | Copiar JSON y, si se desarrolla, copiar imagen | Confirmación local breve. Conectar a clipboard real y al error; no ofrecer Copiar enlace sin un formato de enlaces definido. | L, M |
| [Theme switcher](https://uiarc.dev/components/theme-switch) · `theme-switch` | Postergar | Preferencias de la aplicación, claro/oscuro | El chrome actual es oscuro fijo. No confundir apariencia de la app con el tema exportable de la lámina. | L, M |
| [Eclipse](https://uiarc.dev/components/theme-switch-eclipse) · `theme-switch-eclipse` | Descartar | Cambio de apariencia de la aplicación | La transición sobre toda la página distrae del SVG. Para una preferencia frecuente alcanza un cambio simple. | L, M |
| [Split](https://uiarc.dev/components/theme-switch-split) · `theme-switch-split` | Descartar | Cambio de apariencia de la aplicación | El barrido central no explica una operación del horario y añade movimiento de pantalla completa. | L, M |
| [Rise](https://uiarc.dev/components/theme-switch-rise) · `theme-switch-rise` | Descartar | Cambio de apariencia de la aplicación | El reemplazo vertical de toda la página es innecesario para trabajar con un documento estable. | L, M |
| [Hold to confirm](https://uiarc.dev/components/hold-to-confirm) · `hold-to-confirm` | Descartar | Reiniciar horario o eliminar materia | Mantener presionado exige tiempo/motricidad y no añade valor frente a confirmación clara y Deshacer. | L, M |
| [Swipe actions](https://uiarc.dev/components/swipe-actions) · `swipe-actions` | Postergar | Filas de materias en móvil | Puede ofrecer duplicar/eliminar rápido. Conservar menú visible equivalente; el gesto no debe disparar pérdida inmediata. | R: dropdown-menu, L, M |
| [User menu](https://uiarc.dev/components/user-menu) · `user-menu` | Descartar | Menú de cuenta en cabecera | No existe usuario autenticado. Usar menú Proyecto o Preferencias con nombre explícito. | L, M |
| [Icon morph](https://uiarc.dev/components/icon-morph) · `icon-morph` | Incluir, adaptar opcional | Copiar/Copiado y expandir/cerrar inspector | Confirmación pequeña del cambio de estado. No reemplazar labels ni repetir morph en cada icono de la pantalla. | M |
| [Confirm morph](https://uiarc.dev/components/confirm-morph) · `confirm-morph` | Postergar | Eliminar selección o reiniciar desde toolbar | Se puede evaluar una confirmación inline con Deshacer real. Dialog explícito es más simple inicialmente; evitar modo hold/countdown. | L, M |

### Inputs

| Pieza gratuita e ID | Decisión | Ubicación propuesta | Motivo y adaptación | Paquetes declarados |
| --- | --- | --- | --- | --- |
| [Input](https://uiarc.dev/components/input) · `input` | Incluir, conservar | Nombre de proyecto, materia, aula y título | Los campos locales ya cumplen este trabajo. Copiar sólo estados útiles, mantener labels y errores asociados. | M |
| [Textarea](https://uiarc.dev/components/textarea) · `textarea` | Incluir, conservar | Detalle de materia y descripción de proyecto | Permite texto multilineal cuando haga falta. El documento debe seguir limitando/wrappeando el texto exportado. | M |
| [Select](https://uiarc.dev/components/select) · `select` | Incluir, conservar | Día, densidad, aspecto y tema | Ya existe selección Radix en el repo. No migrar todos los selects sólo por añadir springs. | R: select, L, M |
| [Combobox](https://uiarc.dev/components/combobox) · `combobox` | Postergar | Elegir materias guardadas o plantillas en un catálogo largo | Hace falta un listado reusable real. Para cinco días o cuatro temas, Select o Radio cards son más simples. | L, M |
| [Checkbox](https://uiarc.dev/components/checkbox) · `checkbox` | Incluir, adaptar | Días incluidos al crear proyecto y opciones de exportación | Varias elecciones independientes, guardadas al confirmar. No usar Switch para una selección que espera submit. | R: checkbox, M |
| [Switch](https://uiarc.dev/components/switch) · `switch` | Incluir, conservar | Mostrar aula, detalles, horas y leyenda | Ya existen switches. Reservarlos para cambios inmediatos que el preview refleje al instante. | R: switch, M |
| [Multi-select](https://uiarc.dev/components/multi-select) · `multi-select` | Postergar | Filtros de varias materias o días | Útil con biblioteca grande y selección de varios valores. Para la configuración inicial de días bastan checkboxes. | L, M |
| [Number field](https://uiarc.dev/components/number-field) · `number-field` | Incluir, adaptar | Resolución PNG, zoom y rango manual | Valores acotados con incremento legible. Definir límites y unidad; no dar horas como enteros si se admiten minutos. | L, M |
| [Password field](https://uiarc.dev/components/password-field) · `password-field` | Descartar | Autenticación | La SPA no tiene cuentas ni servidor. No se necesita un campo sensible. | M |
| [Search field](https://uiarc.dev/components/search-field) · `search-field` | Incluir, adaptar | Buscar materias en inspector/biblioteca | Útil cuando la lista crezca. Campo estable con Limpiar y estado Sin resultados; ocultarlo si la lista es mínima. | L, M |
| [Tag input](https://uiarc.dev/components/tag-input) · `tag-input` | Postergar | Etiquetas de materia, carrera o período | El modelo no incluye etiquetas. Incorporarlas sólo si sirven para buscar y filtrar, con migración de JSON. | L, M |
| [File dropzone](https://uiarc.dev/components/file-dropzone) · `file-dropzone` | Incluir, adaptar | Modal Importar horario | Un único JSON local con elección mediante botón además de drag and drop. Validar tamaño, contenido y reemplazo antes de aplicar. | L, M |
| [Radio group](https://uiarc.dev/components/radio-group) · `radio-group` | Incluir, adaptar | Formato exportado y opciones exclusivas de proyecto | Opciones mutuamente excluyentes con etiquetas visibles. Enter confirma el formulario; las flechas cambian la opción. | M |
| [Segmented control](https://uiarc.dev/components/segmented-control) · `segmented-control` | Incluir, adaptar | Vista de inspector Materias/Diseño; densidad pequeña | Dos o tres opciones cercanas dan acceso directo. Mantener semántica correcta y no duplicar Tabs para el mismo propósito. | M |
| [Calendar](https://uiarc.dev/components/calendar) · `calendar` | Postergar | Fecha de inicio de cuatrimestre o excepciones fechadas | El horario actual es semanal, sin fechas. Depende de una evolución explícita del modelo. | L, M |
| [Date picker](https://uiarc.dev/components/date-picker) · `date-picker` | Postergar | Configuración futura de período lectivo | Sólo cuando exista un dato de fecha persistible y exportable. No es necesario para escoger lunes a viernes. | L, M |
| [Time picker](https://uiarc.dev/components/time-picker) · `time-picker` | Incluir, adaptar con condición | Inicio/fin de clase y rango manual | Es Free y devuelve HH:mm. Usar 24h; conservar entrada precisa y corregir navegación/lectura de opción activa antes de adoptarlo. | L, M |
| [Slider](https://uiarc.dev/components/slider) · `slider` | Postergar | Zoom continuo o tamaño de texto futuro | Los ajustes actuales son discretos. Un slider necesita valor numérico y límites; no reemplazar densidad por un rango ambiguo. | M |
| [Elastic slider](https://uiarc.dev/components/elastic-slider) · `elastic-slider` | Descartar | Zoom y rango de horas | El rebote fuera del límite comunica valores imposibles y distrae. Slider normal es suficiente. | M |
| [Inline edit](https://uiarc.dev/components/inline-edit) · `inline-edit` | Incluir, adaptar | Renombrar proyecto y materia desde su resumen | Cambio breve sin abrir todo el inspector. Enter guarda, Escape cancela y muestra errores; no convertir cada metadato en campo oculto. | L, M |
| [Expanding search](https://uiarc.dev/components/expanding-search) · `expanding-search` | Descartar | Buscar materias en toolbar | Oculta una función que debe encontrarse y altera ancho de la barra. Usar Search field estable o la paleta. | L, M |
| [Chip group](https://uiarc.dev/components/chip-group) · `chip-group` | Postergar | Filtro rápido por día en lista de materias | Útil si la lista se vuelve larga. Las chips no modifican qué clases se exportan salvo que esa acción esté explícita. | M |
| [Password strength](https://uiarc.dev/components/password-strength) · `password-strength` | Descartar | Registro de cuenta | No hay registro de usuario en este producto local. | M |
| [Signature pad](https://uiarc.dev/components/signature-pad) · `signature-pad` | Descartar | Firma de documento | El horario no exige firma ni aprobación formal; añade canvas y gestos ajenos al objetivo. | L, M |
| [Date range picker](https://uiarc.dev/components/date-range-picker) · `date-range-picker` | Postergar | Fechas de un cuatrimestre futuro | La semana actual no tiene rango de fechas. Se necesita persistencia y reglas para excepciones antes. | L, M |
| [Color picker](https://uiarc.dev/components/color-picker) · `color-picker` | Incluir, adaptar | Color de fondo/texto de materia y presets | Free con swatches y contraste. Persistir paletas, traducir textos internos, controlar alfa y comparar textColor contra color. | L, M |
| [Morph select](https://uiarc.dev/components/morph-select) · `morph-select` | Descartar | Día, tema o densidad | El panel que crece desde el trigger es visualmente complejo. Select normal y Radio cards cubren estas elecciones. | L, M |
| [Phone input](https://uiarc.dev/components/phone-input) · `phone-input` | Descartar | Proyecto o materia | No existe un dato de teléfono en el modelo ni una comunicación telefónica. | L, M |
| [Money input](https://uiarc.dev/components/money-input) · `money-input` | Descartar | Proyecto o materia | No hay precios, presupuesto ni matrícula en el alcance. | L, M |
| [Shortcut recorder](https://uiarc.dev/components/shortcut-recorder) · `shortcut-recorder` | Postergar | Preferencias de atajos para uso intensivo | Primero definir pocos atajos consistentes y una ayuda visible. Personalizarlos necesita detectar conflictos y persistir preferencias. | L, M |
| [Mention input](https://uiarc.dev/components/mention-input) · `mention-input` | Descartar | Detalle de materia | No hay personas/canales ni comentarios compartidos; texto simple evita un sistema de tokens innecesario. | L, M |
| [Rich text editor](https://uiarc.dev/components/rich-text-editor) · `rich-text-editor` | Descartar | Descripción de materia | El SVG exporta texto sencillo, no HTML/Markdown rico. Añadir formato requiere un contrato y motor de exportación nuevos. | L, M |
| [Billing toggle](https://uiarc.dev/components/billing-toggle) · `billing-toggle` | Descartar | Preferencias de aplicación | El componente representa precios/ciclos de pago. La app no vende suscripciones; Segmented control cubre elecciones generales. | M |
| [Radio cards](https://uiarc.dev/components/radio-cards) · `radio-cards` | Incluir, adaptar | Presets de tema/aspecto al crear o configurar proyecto | Miniatura real del SVG y nombre permiten comparar antes de elegir. Un ring sobrio, sin zooms ni marcas ficticias. | M |

### Disclosure

| Pieza gratuita e ID | Decisión | Ubicación propuesta | Motivo y adaptación | Paquetes declarados |
| --- | --- | --- | --- | --- |
| [Drawer](https://uiarc.dev/components/drawer) · `drawer` | Incluir, adaptar | Inspector de materia en pantallas estrechas | Edición temporal sin navegar fuera del horario. Reusar Sheet local si ofrece el mismo flujo y movimiento. | R: dialog, L, M |
| [Accordion](https://uiarc.dev/components/accordion) · `accordion` | Incluir, conservar | Secciones avanzadas de diseño e inspector | Ya existe Accordion/Collapsible. Esconde detalle secundario; las materias siguen mostrando nombre, día y hora estando cerradas. | R: accordion, L, M |
| [Dialog](https://uiarc.dev/components/dialog) · `dialog` | Incluir, adaptar | Crear/configurar proyecto, importar y confirmar reinicio | Decisiones breves con foco contenido y vuelta al trigger. Formulario pequeño, errores propios; no reemplaza el panel de edición continua. | R: dialog, L, M |
| [Popover](https://uiarc.dev/components/popover) · `popover` | Incluir, adaptar | Paleta de color y ayuda contextual de un ajuste | Contenido corto cerca del control. Evitar anidar varios popovers/modal sobre la misma acción. | R: popover |
| [Tooltip](https://uiarc.dev/components/tooltip) · `tooltip` | Incluir, conservar | Iconos de toolbar y atajos | Ya hay Tooltip local. El nombre accesible del botón existe sin el tooltip; la ayuda no es información obligatoria. | R: tooltip, M |
| [Tabs](https://uiarc.dev/components/tabs) · `tabs` | Incluir, adaptar | Grupos de ajustes dentro de modales Documento/Tema | Ordena grupos estables de edición. Flechas entre tabs y un único tab stop; mantener borradores al cambiar de grupo. La biblioteca y el inspector siguen separados. | R: tabs, L, M |
| [Expandable card](https://uiarc.dev/components/expandable-card) · `expandable-card` | Postergar | Tarjeta de plantilla que abre configuración | Puede servir a un catálogo de plantillas real. Para las clases actuales, el Collapsible local ya ofrece expansión suficiente. | L, M |
| [Breadcrumb](https://uiarc.dev/components/breadcrumb) · `breadcrumb` | Postergar | Biblioteca futura, proyecto y documento | Sólo con jerarquía real de navegación. La SPA actual no tiene rutas ni niveles que mostrar. | L, M |
| [Bottom sheet](https://uiarc.dev/components/bottom-sheet) · `bottom-sheet` | Incluir, adaptar | Inspector móvil de materia/diseño | Dos alturas permiten ver la lámina y editar. Añadir botones expandir/cerrar; teclado virtual y foco visibles antes de adoptarlo. | R: dialog, L, M |
| [Hover card](https://uiarc.dev/components/hover-card) · `hover-card` | Postergar | Resumen de una plantilla o materia referenciada | Sólo contenido complementario con equivalente al foco y al toque. No esconder horario o aula detrás de hover. | R: popover, M |
| [Resizable panels](https://uiarc.dev/components/resizable-panels) · `resizable-panels` | Incluir, adaptar | Inspector lateral y canvas en escritorio | Da más espacio al SVG o al formulario según tarea. Separador operable con teclado y límites; móvil usa sheet. | L, M |
| [Scroll area](https://uiarc.dev/components/scroll-area) · `scroll-area` | Incluir, conservar/adaptar | Inspector y listas de proyectos | Mantener scroll nativo, foco visible y la scrollbar existente si funciona. Arc no necesita JS de animación para este componente. | Ninguna |

### Feedback

| Pieza gratuita e ID | Decisión | Ubicación propuesta | Motivo y adaptación | Paquetes declarados |
| --- | --- | --- | --- | --- |
| [Alert](https://uiarc.dev/components/alert) · `alert` | Incluir, adaptar | JSON inválido, error al guardar y superposición de clases | Mensaje persistente con explicación y recuperación. No esconder errores sólo en una notificación efímera. | L, M |
| [Toast](https://uiarc.dev/components/toast) · `toast` | Incluir, conservar | JSON exportado, PNG descargado y eliminación con deshacer | Sonner ya está instalado y usado. Mantener un solo sistema, mensajes en español y error visible hasta resolverlo. | L, M |
| [Progress](https://uiarc.dev/components/progress) · `progress` | Postergar | Exportaciones por lote o importación realmente lenta | Un porcentaje necesita medición real. PNG actual basta con estado Generando; nunca inventar progreso. | L, M |
| [Skeleton](https://uiarc.dev/components/skeleton) · `skeleton` | Postergar | Biblioteca o miniaturas cargadas en diferido | La edición y localStorage son inmediatos. No reemplazar el SVG por skeleton por cada cambio. | M |
| [Toast stack](https://uiarc.dev/components/toast-stack) · `toast-stack` | Descartar | Resultados de guardado y exportación | Duplica Sonner y favorece acumulación de mensajes. Una única cola breve con prioridades basta. | L, M |
| [Usage meter](https://uiarc.dev/components/usage-meter) · `usage-meter` | Descartar | Límite de materias/proyectos | No hay cupos comerciales ni servidor. No presentar límites artificiales para llenar el diseño. | L, M |
| [Stepper](https://uiarc.dev/components/stepper) · `stepper` | Postergar | Crear proyecto con varios pasos necesarios | El primer proyecto debería abrirse con un formulario corto. Usarlo sólo si presets, días y rango se vuelven demasiadas decisiones. | M |
| [Countdown](https://uiarc.dev/components/countdown) · `countdown` | Descartar | Exportación y guardado | No existe un vencimiento ni lanzamiento en el flujo. No mostrar cuenta regresiva ficticia. | M |
| [Cookie consent](https://uiarc.dev/components/cookie-consent) · `cookie-consent` | Descartar | Inicio de la SPA local | No se verificó uso de tracking/cookies que requiera este flujo. No introducir un banner sin una necesidad real definida. | R: switch, L, M |
| [Announcement bar](https://uiarc.dev/components/announcement-bar) · `announcement-bar` | Postergar | Aviso de versión con migración o problema real | Sólo una advertencia puntual que afecte al horario. Sin rotación, cuenta regresiva ni banners permanentes. | L, M |

### Data

| Pieza gratuita e ID | Decisión | Ubicación propuesta | Motivo y adaptación | Paquetes declarados |
| --- | --- | --- | --- | --- |
| [Avatar](https://uiarc.dev/components/avatar) · `avatar` | Descartar | Cuenta o perfil | El producto local no tiene usuarios remotos ni autenticación. No inventar una identidad para completar una toolbar. | M |
| [Avatar group](https://uiarc.dev/components/avatar-group) · `avatar-group` | Descartar | Colaboradores de proyecto | No existe colaboración multiusuario; añadir retratos ficticios comunica una capacidad ausente. | M |
| [Badge](https://uiarc.dev/components/badge) · `badge` | Incluir, conservar | Guardado local, conflicto y tipo de proyecto | Estado con texto e icono, no sólo color. Ya existe Badge; limitarlo a información útil y verificable. | M |
| [Card](https://uiarc.dev/components/card) · `card` | Incluir, conservar | Lista de materias y presets de tema | Las tarjetas locales ya agrupan edición. Usar variante sobria sin hover expansivo en cada tarjeta. | R: dialog, L, M |
| [Metric card](https://uiarc.dev/components/metric-card) · `metric-card` | Postergar | Resumen de horas semanales en configuración | Un dato breve puede ser texto simple. Considerarlo cuando se añadan horas totales/días de cursada, sin convertir el editor en dashboard. | M |
| [Empty state](https://uiarc.dev/components/empty-state) · `empty-state` | Incluir, adaptar | Horario nuevo vacío y lista de materias sin resultados | Primer paso claro, Agregar materia o Importar JSON. El vacío no debe simular datos ni animar continuamente. | L, M |
| [Tree view](https://uiarc.dev/components/tree-view) · `tree-view` | Descartar | Navegación de proyectos/materias | Una colección pequeña y plana no necesita carpetas jerárquicas. Revaluar si el producto incorpora organización por carpetas. | L, M |
| [Pagination](https://uiarc.dev/components/pagination) · `pagination` | Postergar | Biblioteca de muchos proyectos/plantillas | No paginar una semana ni separar materias del mismo horario. Necesita primero una colección grande. | L, M |
| [Filter toolbar](https://uiarc.dev/components/filter-toolbar) · `filter-toolbar` | Postergar | Biblioteca de proyectos y lista extensa de materias | Aplicar filtros por día, período o etiqueta con reset visible. No agregar un segundo toolbar al editor vacío. | L, M |
| [Sortable data table](https://uiarc.dev/components/sortable-data-table) · `sortable-data-table` | Postergar | Edición masiva o revisión tabular de muchas clases | Podría facilitar ordenar por día/inicio. El SVG permanece como representación principal y no se sustituye por esta tabla. | L, M |
| [Sparkline](https://uiarc.dev/components/sparkline) · `sparkline` | Descartar | Resumen de carga académica | Sin datos históricos no existe tendencia. La distribución semanal cabe en texto o barras si alguna vez se necesita. | M |
| [Gauge](https://uiarc.dev/components/gauge) · `gauge` | Descartar | Indicador de carga o completitud | No hay un objetivo cuantificable de horario terminado; un medidor inventaría una meta y ocuparía espacio. | M |
| [Animated counter](https://uiarc.dev/components/animated-counter) · `animated-counter` | Postergar | Número de materias u horas tras un cambio | Puede confirmar una adición, con actualización simple en reduced motion. No es necesario animar todos los totales. | M |
| [Code block](https://uiarc.dev/components/code-block) · `code-block` | Postergar | Vista avanzada de JSON antes de copiar | Para usuarios que lo necesitan, dentro de Importar/Exportar avanzado. El flujo normal trabaja con nombres y controles. | L, M |
| [Image compare](https://uiarc.dev/components/image-compare) · `image-compare` | Postergar | Comparar dos plantillas/temas del mismo horario | Puede ayudar al decidir diseño, pero requiere dos snapshots reales. No es parte de la edición diaria. | L, M |
| [Carousel](https://uiarc.dev/components/carousel) · `carousel` | Postergar | Galería pequeña de plantillas visuales | Una grilla de presets es más fácil de comparar. Considerarlo sólo si ancho/móvil lo justifica, sin autoplay. | L, M |
| [Card stack](https://uiarc.dev/components/card-stack) · `card-stack` | Descartar | Selector de plantillas o materias | Oculta opciones y añade gesto de descarte a contenido que debe compararse o editarse. | L, M |
| [Bar chart](https://uiarc.dev/components/bar-chart) · `bar-chart` | Postergar | Horas por día o distribución de carga | Es la gráfica que mejor encajaría en un resumen futuro. Sólo si se necesitan decisiones de carga, con tabla/texto equivalente. | M |
| [Activity heatmap](https://uiarc.dev/components/activity-heatmap) · `activity-heatmap` | Descartar | Calendario de actividad de edición | No es el contenido del horario y requeriría rastrear uso. No instrumentar historial por decoración. | M |
| [Timeline](https://uiarc.dev/components/timeline) · `timeline` | Postergar | Historial local de cambios/importaciones | Depende de historial real persistido. Hoy sólo hay último mensaje de acción; no inventar eventos. | L, M |
| [Line chart](https://uiarc.dev/components/line-chart) · `line-chart` | Descartar | Resumen académico actual | La semana no es una serie histórica continua. Para carga por día sirven números o Bar chart. | M |
| [Donut chart](https://uiarc.dev/components/donut-chart) · `donut-chart` | Descartar | Horas por materia | Una lista ordenada con horas permite comparar mejor y ocupa menos. No usar proporciones sin una tarea que las requiera. | M |
| [Streamgraph](https://uiarc.dev/components/streamgraph) · `streamgraph` | Descartar | Distribución de materias en el tiempo | No existen series históricas para comparar y la forma ondulada dificulta leer horas exactas. | M |
| [Brush chart](https://uiarc.dev/components/brush-chart) · `brush-chart` | Descartar | Explorar períodos o cursada | El documento muestra una semana acotada. Un overview con zoom temporal añade complejidad sin datos densos. | M |
| [Ridgeline](https://uiarc.dev/components/ridgeline) · `ridgeline` | Descartar | Comparar carga de horarios | No hay distribuciones estadísticas por cohortes. No representa los bloques de clase. | M |
| [Treemap](https://uiarc.dev/components/treemap) · `treemap` | Descartar | Horas por carrera/materia | El tamaño relativo de áreas no ayuda a colocar clases en días/horas; una lista y el SVG ya responden esa tarea. | M |
| [Waffle chart](https://uiarc.dev/components/waffle-chart) · `waffle-chart` | Descartar | Porcentaje de horas o completitud | La cuadrícula de cien celdas no mejora los valores exactos de carga y genera demasiada animación. | M |
| [Slope chart](https://uiarc.dev/components/slope-chart) · `slope-chart` | Descartar | Comparación de horarios | Antes/después entre dos magnitudes no resuelve la comparación semanal de bloques. Requiere una pregunta distinta. | M |
| [JSON viewer](https://uiarc.dev/components/json-viewer) · `json-viewer` | Postergar | Importación avanzada y diagnóstico de JSON | Útil para inspeccionar datos rechazados, detrás de Ver detalles. No imponer un árbol técnico a quien sólo quiere importar. | L, M |
| [Chat thread](https://uiarc.dev/components/chat-thread) · `chat-thread` | Descartar | Asistente o colaboración | No existe chat, servicio de IA ni mensajería. No añadir una conversación de muestra al editor. | L, M |
| [Comment thread](https://uiarc.dev/components/comment-thread) · `comment-thread` | Descartar | Notas sobre horario | No hay colaboración ni servidor. Detalle de materia ya cubre anotaciones locales. | L, M |

### Text

| Pieza gratuita e ID | Decisión | Ubicación propuesta | Motivo y adaptación | Paquetes declarados |
| --- | --- | --- | --- | --- |
| [Text reveal](https://uiarc.dev/components/text-reveal) · `text-reveal` | Descartar | Títulos de aplicación y modales | La información operativa debe aparecer completa al abrir. Una revelación de letras retrasa lectura sin aportar significado. | Ninguna |
| [In-view title](https://uiarc.dev/components/in-view-title) · `in-view-title` | Descartar | Títulos del inspector | El editor no necesita entradas de headings al hacer scroll. Mantener títulos estables. | M |
| [Text morph](https://uiarc.dev/components/text-morph) · `text-morph` | Postergar | Estado breve Guardando/Guardado o Copiar/Copiado | Usar sólo en una confirmación localizada y sin cambiar el nombre accesible de forma incoherente. Es dependencia interna de Color picker. | M |
| [Text shimmer](https://uiarc.dev/components/text-shimmer) · `text-shimmer` | Descartar | Texto de carga de exportación | Texto fijo Generando PNG y spinner breve comunican trabajo sin iluminar palabras repetidamente. | M |

### Special

| Pieza gratuita e ID | Decisión | Ubicación propuesta | Motivo y adaptación | Paquetes declarados |
| --- | --- | --- | --- | --- |
| [Slot text](https://uiarc.dev/components/slot-text) · `slot-text` | Descartar | Estado de guardado y exportación | El efecto de rodillo añade movimiento a texto de interfaz frecuente. Un cambio simple de estado es suficiente. | M |

### Bloques

| Pieza gratuita e ID | Decisión | Ubicación propuesta | Motivo y adaptación | Paquetes declarados |
| --- | --- | --- | --- | --- |
| [Sign up form](https://uiarc.dev/components/blocks/signup-form) · `signup-form` | Descartar | Alta de cuenta | Sin backend ni autenticación. No reusar un flujo de registro para crear un proyecto local. | R: checkbox, M |
| [Logo marquee](https://uiarc.dev/components/blocks/logo-marquee) · `logo-marquee` | Descartar | Inicio u onboarding | No hay marcas/clientes que mostrar y el movimiento continuo distrae del objetivo. | L, M |
| [Plan comparison](https://uiarc.dev/components/blocks/plan-comparison) · `plan-comparison` | Descartar | Elegir proyecto/preset | No existen planes pagos. Radio cards representa opciones de documento sin metáfora comercial. | R: switch, L, M |
| [Command palette](https://uiarc.dev/components/blocks/command-palette) · `command-palette` | Incluir, adaptar | Acciones globales con Ctrl/Cmd+K | Bloque Free real. Envolver en Dialog, agrupar Proyecto/Materias/Exportar y operar los mismos comandos de toolbar. | L, M |
| [Notification center](https://uiarc.dev/components/blocks/notification-center) · `notification-center` | Postergar | Avisos persistentes y resultados de operaciones por lote | No crear campana para cada guardado. Útil sólo si aparecen varias notificaciones que deben releerse. | R: popover, L, M |
| [File upload](https://uiarc.dev/components/blocks/file-upload) · `file-upload` | Postergar | Importación de varios horarios en biblioteca | El flujo actual lee un archivo local, sin upload. Dropzone alcanza; usar el bloque sólo con lotes y validación por archivo. | L, M |
| [OTP input](https://uiarc.dev/components/blocks/otp-input) · `otp-input` | Descartar | Verificar identidad | La aplicación no autentica ni envía códigos. Requiere un servicio ajeno al alcance. | M |
| [Changelog feed](https://uiarc.dev/components/blocks/changelog-feed) · `changelog-feed` | Postergar | Ayuda, Novedades de la aplicación | Una página aparte puede explicar cambios. No poner un feed de lanzamientos en el canvas; adaptar imports de Next si se usa. | L, M |
| [Sign in](https://uiarc.dev/components/blocks/sign-in) · `sign-in` | Descartar | Acceder a proyectos | Los proyectos locales deben poder abrirse sin cuenta. Login con código necesita backend. | L, M |
| [Page header](https://uiarc.dev/components/blocks/page-header) · `page-header` | Incluir, adaptar como referencia | Cabecera de proyecto, nombre, guardado y exportar | El bloque es Free y aporta estados coherentes. Mantener cabecera estable; desactivar contracción al scroll y contadores decorativos. | R: dropdown-menu, R: tabs, L, M |
| [Empty states](https://uiarc.dev/components/blocks/empty-states) · `empty-states` | Postergar | Biblioteca vacía y búsqueda sin resultados | El bloque tiene varias escenas animadas. Empty state simple resuelve el primer uso; evaluar ilustración estática aparte. | M |
| [Centered login](https://uiarc.dev/components/blocks/login-centered) · `login-centered` | Descartar | Acceder a la aplicación | No existe passkey, email auth ni cuenta. Un formulario de creación de proyecto no es login. | L, M |
| [Site header](https://uiarc.dev/components/blocks/site-header) · `site-header` | Postergar | Página informativa separada del estudio | Puede servir si se publica una landing. No meter navegación de marketing y megamenú en el editor. | L, M |
| [Site footer](https://uiarc.dev/components/blocks/site-footer) · `site-footer` | Postergar | Página informativa, créditos/licencias y ayuda | Un footer mínimo puede servir afuera del estudio. Evitar newsletter y marca Arc de muestra. | L, M |
| [Hero section](https://uiarc.dev/components/blocks/hero-section) · `hero-section` | Descartar | Pantalla inicial del editor | Los demos de SaaS y meshes no son el producto. El inicio debe llevar a crear/importar y mostrar el horario real. | L, M |
| [FAQ section](https://uiarc.dev/components/blocks/faq-section) · `faq-section` | Incluir, adaptar simple | Ayuda accesible desde toolbar y onboarding | Respuestas a guardado local, importar y exportar. Reusar Accordion y texto español; no requiere instalar el bloque completo. | L, M |
| [Contact section](https://uiarc.dev/components/blocks/contact-section) · `contact-section` | Postergar | Página informativa de soporte | Necesita un destino/canal real y manejo del formulario. No prometer envío sin servicio que lo reciba. | L, M |
| [Blog grid](https://uiarc.dev/components/blocks/blog-grid) · `blog-grid` | Descartar | Estudio y biblioteca de horarios | No se solicitó publicar contenido editorial. Cards de proyectos no necesitan un lector de blog. | L, M |
| [Comparison table](https://uiarc.dev/components/blocks/comparison-table) · `comparison-table` | Descartar | Elegir tema o exportación | No hay comparativa competitiva ni planes. Las opciones de formato caben en controles breves. | L, M |
| [Stats band](https://uiarc.dev/components/blocks/stats-band) · `stats-band` | Descartar | Inicio del estudio | No usar métricas comerciales o números ficticios. Horas por semana, si hacen falta, van junto al documento. | M |
| [CTA section](https://uiarc.dev/components/blocks/cta-section) · `cta-section` | Postergar | Página informativa separada | Una acción Crear horario puede ser útil en una landing. En el estudio esa acción ya está en la toolbar y el empty state. | L, M |
| [Newsletter signup](https://uiarc.dev/components/blocks/newsletter-signup) · `newsletter-signup` | Descartar | Onboarding o footer del estudio | No hay boletín ni servicio de suscripción. Evitar pedir email para un editor local. | R: switch, L, M |

## Infraestructura gratuita y dependencias compartidas

Estas dos entradas son auxiliares, no se suman a los 132 componentes/bloques.

| Entrada | Decisión | Integración |
| --- | --- | --- |
| [arc-foundation](https://uiarc.dev/r/arc-foundation.json) | Incluir si se adopta código Arc | CSS de tokens compartidos. Revisar colisiones con `--background`, `--foreground`, `--accent`, `--text-secondary` y los tokens shadcn del estudio antes de importarlo. |
| [arc-motion-tokens](https://uiarc.dev/r/arc-motion-tokens.json) | Incluir con los componentes que lo importan | Presets locales de springs/duración. Centralizar los ajustes y conservar ramas de reduced motion. |

La instalación recomendada es por pieza, en `src/components/arc/`, con `@uiarc` en `components.json` o con la URL directa. Esto deja intacta la convención de `components/ui/`. El comando de foundation se ejecuta una vez; luego se agregan sólo piezas elegidas. El CLI trae sus dependencias internas automáticamente. Esta revisión no ejecutó esos comandos.

```sh
npx shadcn@latest add https://uiarc.dev/r/arc-foundation.json
npx shadcn@latest add https://uiarc.dev/r/dialog.json
```

Para este proyecto no se inicializa otro Vite, no se migra a Next y no se vuelve a correr shadcn init. La guía completa se consulta en [instalación oficial](https://uiarc.dev/docs/installation).

Aunque Lucide y varias piezas Radix ya existen, Arc utiliza imports como `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu` y `@radix-ui/react-tabs`. Tener `radix-ui` agregado no garantiza que todos esos paquetes individuales sean dependencias directas. El registro indica cuáles necesita cada incorporación. Motion es el coste transversal nuevo; debe medirse el bundle después de la primera integración. No se afirma que Arc sea gratis en KB por ser copy/paste.

La paleta de comandos y el Color picker también incorporan componentes/archivos locales. Color picker importa Text morph; Resizable panels tiene lógica de interacción mayor que una grilla CSS. La matriz enumera paquetes externos directos, no todo el árbol transitivo. Revisar cada JSON al instalar y quitar variantes/código que no se usen después de comprobar equivalencia.

Algunos bloques de marketing incluyen referencias de Next.js en sus ejemplos/código, como Changelog feed, Site header y Newsletter signup. Si se incorporan a Vite, reemplazar Link/Image por enlaces/imágenes compatibles. No agregar Next como dependencia para resolverlos. [Notas oficiales de compatibilidad](https://github.com/kuratlielia/arc-library#troubleshooting).

El estilo de Arc no determina el documento. `foundation.css` declara tokens globales en `:root`; un import sin adaptar puede cambiar la interfaz actual. Se necesita un puente de tokens o un orden de estilos deliberado, incluidas las capas de portal, y se comprueban contraste y popovers. Conservar la tipografía, densidad y acento acordados para horarios-maker. Arc usa `data-theme`; el estudio usa chrome oscuro y su variante Tailwind `.dark`. El tema de la lámina sigue siendo `settings.theme`.

## Accesibilidad y movimiento, hallazgos y condiciones

Se aplicaron los criterios de [better-accessibility](C:/Users/gamer/.agents/skills/better-accessibility/SKILL.md), [ux-heuristics](C:/Users/gamer/.agents/skills/ux-heuristics/SKILL.md) y [unslop](C:/Users/gamer/.agents/skills/unslop/SKILL.md). La metadata de Arc describe teclado y reduced motion por pieza; eso es una declaración del proveedor. Se inspeccionó código de los candidatos principales. Todavía no equivale a una prueba completa de la composición integrada con lector de pantalla.

| Pieza | Evidencia en el commit auditado | Condición para horarios-maker |
| --- | --- | --- |
| [Dialog](https://github.com/kuratlielia/arc-library/blob/55c0d3ebd7cc643ec118c4d8a11413e6fadcc7df/registry/components/dialog/dialog.tsx) | Usa Radix Dialog, título/description semánticos y `useReducedMotion`. El cierre interno tiene `aria-label="Close dialog"`. | Traducir el texto interno a Cerrar diálogo y verificar foco inicial, Tab dentro del modal, Escape y vuelta al trigger. No dejar salir foco durante el cierre animado. |
| [Command palette](https://github.com/kuratlielia/arc-library/blob/55c0d3ebd7cc643ec118c4d8a11413e6fadcc7df/registry/components/command-palette/command-palette.tsx) | Input con combobox y `aria-activedescendant`; lista/grupos/resultados. No envuelve un modal. Hay textos internos como Clear search, Close command palette y Command results. | Envolver en Dialog, traducir visible y accesible, probar nombre del buscador/resultados y asegurar que elegir un comando no deja el foco en un elemento desmontado. |
| [Time picker](https://github.com/kuratlielia/arc-library/blob/55c0d3ebd7cc643ec118c4d8a11413e6fadcc7df/registry/components/time-picker/time-picker.tsx#L74) | Las flechas cambian `activeIndex` con foco en el trigger. La opción activa sólo recibe `data-active`; no se ve `aria-activedescendant`, movimiento de foco a esa opción ni `tabIndex=-1` en los botones de opción. La lista usa role=listbox. | Corregir el patrón de foco/selección y comprobar anuncio de la opción activa antes de sustituir el input nativo. Son observaciones de código, no una falla observada con lector. Con minuteStep=1 aparecen 1440 opciones: conservar entrada HH:mm o un flujo híbrido para minutos arbitrarios. |
| [Color picker](https://github.com/kuratlielia/arc-library/blob/55c0d3ebd7cc643ec118c4d8a11413e6fadcc7df/registry/components/color-picker/color-picker.tsx) | Sliders y swatches con manejo de teclado, contraste escrito e `inert` al cerrar. Tiene reduced motion. Usa `useEffectEvent`, disponible en el React 19.2 del proyecto. Devuelve hex con alfa cuando no es opaco. | Traducir Opacity, Done, Saved colors, nombres de sliders y anuncios. Definir si se acepta alfa y normalizar el contrato, porque los inputs de color actuales esperan colores opacos de seis dígitos. Persistir swatches. Verificar el par color/textColor en SVG y PNG. |
| [Resizable panels](https://github.com/kuratlielia/arc-library/blob/55c0d3ebd7cc643ec118c4d8a11413e6fadcc7df/registry/components/resizable-panels/resizable-panels.tsx#L364) | Separador enfocable con aria-valuenow/min/max y flechas/Home/End/Enter. Paneles colapsados inert y rama reduced motion. | Nombres del panel en español, límites que no tapen campos ni lámina, tamaño persistido como preferencia de UI y fallback móvil. No colapsar de forma que se pierda el foco de un formulario. |
| [Bottom sheet](https://uiarc.dev/components/bottom-sheet/markdown) | Metadata declara Radix Dialog, botón de grabber, avisos de altura y expansión para foco bajo el fold. Reduced motion salta entre alturas y usa fade. | Probar teclado virtual, scroll interno y el foco al pasar del inspector a preview. Elegir alturas útiles; no agregar sheets anidados por cada campo. |
| [Action button](https://github.com/kuratlielia/arc-library/blob/55c0d3ebd7cc643ec118c4d8a11413e6fadcc7df/registry/components/action-button/action-button.tsx) | Botón nativo con aria-busy, aria-disabled y role=status. Metadata declara fade sin escala/dibujo bajo reduced motion. | Label y estado accesibles en español; bloquear ejecución repetida de verdad aunque siga enfocable. Si falla la acción, mostrar recuperación y no emitir éxito. |

En la ficha Color picker se comprobó el título “free” y su presencia en la navegación. Se usó una pestaña propia de la auditoría; no se operó la pestaña del estudio. No se afirma haber ejercitado los 132 previews ni medido contraste, mobile, bundle o lectores para cada uno.

La animación aceptable explica una operación: abrir un inspector, ubicar un menú, cambiar selección, confirmar copia. En edición frecuente, reducir desplazamientos, escalas, blur, rebotes y conteos. La lámina no debe animarse con cada tecla. Sin carousels autoplay, revelación letra por letra ni barridos de toda la app. Con `prefers-reduced-motion`, los paneles y resultados aparecen por fade breve o de inmediato; nunca esperar una secuencia para empezar a trabajar.

Para cerrar la futura integración hay que comprobar:

- Crear/configurar proyecto, importar, exportar y editar materia enteramente con teclado.
- Nombres/roles/estado de cada icono, campo, tab, opción y resultado en español. No basta traducir sólo las props visibles.
- Escape, cierre exterior, foco inicial y devolución de foco en modales, paleta y sheet.
- Anuncios de guardado/errores con una región estable; no anunciar cada edición como toast.
- Contraste real de texto y controles, y del par texto/fondo de cada materia, sin depender sólo del color.
- Ancho de 320 px, zoom del navegador al 200 %, y campos visibles con teclado móvil.
- Reduced motion activado y operaciones rápidas repetidas durante apertura/cierre.
- Paridad de preview SVG, descarga SVG/PNG y reconstrucción mediante JSON.

## Piezas Pro que parecen encajar pero quedan fuera

No son gratuitas aunque sus previews estén visibles. La alternativa gratis resuelve la función sin copiar su fuente ni reconstruir su efecto.

| Pieza Pro | Función tentadora | Alternativa propuesta |
| --- | --- | --- |
| [Week calendar](https://uiarc.dev/components/blocks/week-calendar) | Crear/mover clases en una semana | Motor SVG actual y edición de bloques; interacción directa futura propia. |
| [Workspace sidebar](https://uiarc.dev/components/blocks/workspace-sidebar) | Selector de proyectos | Sidebar local, Dropdown menu y lista sencilla de proyectos. |
| [Settings page](https://uiarc.dev/components/blocks/settings-page) / [Settings command](https://uiarc.dev/components/blocks/settings-command) | Configuración con búsqueda | Dialog, Tabs y Command palette Free. |
| [Share sheet](https://uiarc.dev/components/share-sheet) / [Share access](https://uiarc.dev/components/share-access) | Compartir enlaces y permisos | Copy button y export/import JSON local; no mostrar permisos remotos sin backend. |
| [Dock](https://uiarc.dev/components/dock) / [Control center](https://uiarc.dev/components/control-center) | Herramientas y ajustes flotantes | Button group estable, inspector lateral y Popover. |
| [Multi-step form](https://uiarc.dev/components/blocks/multi-step-form) | Crear un proyecto guiado | Dialog y campos Free; Stepper sólo si hace falta dividir el formulario. |
| [Time dial](https://uiarc.dev/components/time-dial) / [Date reel](https://uiarc.dev/components/date-reel) | Elegir hora con dial/rueda | Input time actual o Time picker Free corregido. |
| [Data grid](https://uiarc.dev/components/data-grid) | Edición masiva tipo spreadsheet | Sortable data table Free si aparece esa necesidad, más formularios locales. |

No se incorporan templates Arc SaaS/AI/Startup: están marcados Pro y además cambiarían el propósito/stack del editor. [Índice oficial](https://uiarc.dev/llms.txt).

## Licencia y conservación de la fuente

El [LICENSE del commit auditado](https://github.com/kuratlielia/arc-library/blob/55c0d3ebd7cc643ec118c4d8a11413e6fadcc7df/LICENSE) es MIT, con copyright 2026 Elia Kuratli. El código Free se puede usar y adaptar en proyectos comerciales o personales conservando aviso de copyright y licencia. Mantener ese texto junto al código vendorizado o en un archivo de avisos de terceros. No hace falta una cuenta Pro para instalar las piezas Free. [Licencia del sitio](https://uiarc.dev/license), [términos del servicio](https://uiarc.dev/terms).

La página de licencia del sitio se presenta como borrador; al integrar se comprueba la versión de cada archivo recibido. El catálogo mezcla Free y Pro, y los Pro usan un registro con acceso específico. El alcance de este informe es exclusivamente Free. Los ejemplos de nombres, fotos y marcas no se deben tomar como assets de horarios-maker. El producto utiliza datos propios y miniaturas propias del SVG.

## Orden recomendado de integración

1. Definir tokens puente y mantener componentes locales equivalentes. Instalar un único candidato pequeño para medir CSS y bundle, por ejemplo Dialog con un modal real.
2. Resolver flujo proyecto/importación/confirmación y estados verdaderos de persistencia y exportación. Después integrar Split button, Action button y Copy button donde tengan operaciones reales.
3. Mejorar biblioteca e inspector con Inline edit/Color picker; usar Tabs/Radio cards en ajustes de Documento/Tema. Corregir y verificar Time picker antes de sustituir los inputs actuales. Las nuevas preferencias se agregan al modelo sólo si forman parte del documento.
4. Componer Command palette sobre Dialog y los mismos comandos. Probar foco y atajos en todos los campos.
5. Incorporar Resizable panels y un único inspector móvil. Verificar SVG/PNG/JSON y reduced motion.
6. Biblioteca y varios proyectos pertenecen al alcance de esta reconstrucción. Fechas, edición masiva y otros destinos de piezas postergadas requieren una revisión posterior; no se instalan por anticipado.

Esta secuencia no propone rehacer toda la UI con Arc. Prioriza piezas que reducen pasos, aclaran estados o permiten trabajar con teclado, mientras la lámina sigue siendo el centro del producto.
