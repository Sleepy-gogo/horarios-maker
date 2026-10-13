# Producto y flujos del editor de horarios

Especificación de producto basada en el código de `horarios-maker` y `tech-stack-architect`, revisado el 13 de octubre de 2026. Define el comportamiento a implementar. Los controles y capacidades propuestos no existen todavía salvo donde se indique lo contrario.

## Objetivo y criterio de producto

La persona configura una hoja, crea sus materias y coloca clases sobre la semana. Puede corregir horarios directamente en el lienzo, conservar varios proyectos en este navegador y descargar una imagen que coincide con la composición visible.

El foco es el horario. La aplicación debe parecer un estudio de edición: una barra de menús para acciones generales, una biblioteca de materias a la izquierda y herramientas contextuales junto al documento. Las opciones de formato no deben desplazar la lista de materias cada vez que la persona edita una clase.

Se mantiene el alcance de `PLAN.md`: SPA en español, sin backend, URL limpia y SVG como motor de composición y exportación. Agregar varios proyectos locales no implica cuentas, sincronización entre dispositivos ni enlaces públicos. El primer uso comienza vacío. No se insertan materias ni clases de ejemplo.

Prioridades usadas en este documento:

| Prioridad | Significado |
| --- | --- |
| P0 | Necesaria para reemplazar el flujo actual sin perder datos o acceso a funciones. |
| P1 | Completa la experiencia de estudio una vez que modelo, lienzo y persistencia son confiables. |
| P2 | Mejora posterior que no condiciona la primera entrega. |

## Evidencia del estado actual

Las referencias `horarios-maker/...` y `tech-stack-architect/...` son relativas a los repositorios hermanos en `C:/Users/gamer/code`.

| Hallazgo | Evidencia | Consecuencia |
| --- | --- | --- |
| Materia y clase son un mismo objeto. Cada bloque repite nombre y colores. | `horarios-maker/src/features/schedule/types.ts:67` | Renombrar una materia o cambiar su color exige editar cada clase. La leyenda deduplica por nombre, no por identidad. |
| Documento, estilo y edición de bloques comparten el panel lateral. | `horarios-maker/src/features/schedule/components/studio-sidebar.tsx:99`, `:238` | El panel crece con los horarios y obliga a alternar configuración general y carga de clases. |
| Agregar crea una clase de lunes de 08:00 a 09:00 con textos de ejemplo. | `horarios-maker/src/features/schedule/utils.ts:229` | El resultado no parte del lugar que eligió la persona y carga datos que luego debe borrar. |
| La vista previa expone un SVG como imagen y carece de interacción de bloques. | `horarios-maker/src/features/schedule/components/schedule-preview.tsx:56` | Seleccionar, mover y redimensionar necesitan un sistema de interacción nuevo. |
| Hay cinco días fijos y tamaños predefinidos. | `horarios-maker/src/features/schedule/types.ts:1`, `:3` | Días configurables requieren identidad estable y geometría calculada a partir de los días del proyecto. |
| Se guarda un único `AppState` en una clave local. | `horarios-maker/src/features/schedule/types.ts:56`, `:96` | No hay biblioteca de proyectos ni separación entre preferencias de aplicación y documento. |
| El guardado escribe sin manejar excepciones. | `horarios-maker/src/features/schedule/utils.ts:126`, `horarios-maker/src/features/schedule/use-schedule-studio.ts:30` | Una cuota llena o un almacenamiento bloqueado no produce una recuperación explícita. El texto de la barra representa la última acción, no el estado del guardado. |
| Importar reemplaza el estado activo. Reiniciar también lo reemplaza. | `horarios-maker/src/App.tsx:55`, `:71` | El nuevo flujo debe crear una copia importada y ofrecer deshacer o recuperación antes de reemplazar contenido. |
| Sanitizar corrige horas y completa campos sin informar qué cambió. | `horarios-maker/src/features/schedule/utils.ts:56`, `:89` | Una importación necesita validación, informe de conversiones y protección del original. |
| La posición temporal recorta al rango visible. | `horarios-maker/src/features/schedule/utils.ts:167` | Recortar un rango con clases puede ocultar o comprimir información. Debe impedirse antes de guardar el ajuste. |
| La UI ofrece PNG y JSON. El SVG figura en el plan pero no tiene acción en la barra actual. | `horarios-maker/src/features/schedule/components/studio-header.tsx:51`, `horarios-maker/src/App.tsx:89` | El menú Exportar debe completar los tres formatos y distinguir imagen de archivo editable. |
| Las fuentes del SVG dependen de familias servidas desde Google Fonts. | `horarios-maker/src/index.css:1`, `horarios-maker/src/features/schedule/components/schedule-preview.tsx:101` | La selección de fuentes debe contemplar carga local y exportación portable. |

La inspección de navegador registrada en `docs/evidence/browser-results.json` confirma cinco switches sin nombre accesible, bloques solapados con geometría idéntica y una carga `?s=invalid` que termina vacía mientras muestra "Horario cargado desde enlace". También reproduce pantalla vacía al importar un tema inválido y al simular una falla de cuota. La exportación no incorpora fuentes; la comparación visual entre SVG en DOM y PNG descargado presenta diferencias de tipografía y rasterización. Estos resultados convierten recuperación de datos, validación y nombres accesibles en P0. La captura móvil es emulación de 390 × 844, no prueba de teclado virtual en hardware.

Evaluación heurística provisional del flujo actual: 5/10. Combina lectura del código y los resultados de inspección del navegador, sin prueba con usuarios. Se puede completar un horario con formularios, hay persistencia local y el SVG ya concentra la composición. Penalizan la repetición de materias, la ausencia de deshacer, el guardado sin recuperación y la falta de un camino directo entre una posición de la semana y una clase. Para llegar a 10/10 en esta evaluación deben cumplirse los criterios P0, la edición por teclado y los recorridos de validación del final de este documento. Una puntuación alta no reemplaza la prueba de uso.

## Referencia concreta de tech-stack-architect

### Qué trasladar conceptualmente

| Patrón | Referencia | Adaptación al horario |
| --- | --- | --- |
| Separar catálogo, lienzo e inspector. | `src/components/app/Editor.tsx:108` | Biblioteca de materias a la izquierda; horario en el centro; inspector de un bloque cuando existe selección. En pantallas medianas se abre el inspector como panel temporal para conservar espacio. |
| Título editable y estado de guardado junto a las acciones globales. | `src/components/app/TopBar.tsx:182`, `src/components/app/TitleField.tsx:13`, `src/components/app/SaveStatus.tsx:13` | Título del proyecto visible y edición con Enter para aplicar, Escape para cancelar. Estado local veraz, presente también en móvil y con acciones de recuperación. |
| Inspector decidido por la selección. | `src/components/flow/inspector/Inspector.tsx:10` | Mostrar aula, tipo, notas, día y horas del bloque activo. Nunca renderizar todos los formularios de bloques en la biblioteca. |
| Herramientas con estado seleccionado, nombres y atajos. | `src/components/flow/ToolRail.tsx:14`, `:26` | Herramientas Seleccionar y Crear bloque. La materia armada aparece por su nombre. No se trasladan herramientas de texto, marcos o conexiones. |
| Estado vacío que explica una acción en el lienzo. | `src/components/flow/CanvasEmptyState.tsx:35` | Primero crear un proyecto; luego crear una materia y colocar su primera clase. El mensaje cambia según el paso pendiente. |
| Biblioteca buscable y navegación sin grandes tarjetas de formulario. | `src/components/flow/AssetPanel.tsx:103`, `:215` | Filas compactas con muestra de color, nombre, cantidad de bloques y menú contextual. Buscador visible al crecer la lista. |
| Un gesto genera una operación deshacible. | `src/lib/store.ts:224`, `:235`, `:262` | Mover durante varios eventos de puntero produce una sola entrada de historial al soltar. Cancelar el gesto no guarda cambios. |
| Distinguir estado transitorio del documento exportado. | `src/lib/store.ts:159` | Selección, hover, zoom, ghost y paneles no aparecen en el JSON del proyecto. |
| Guardado con demora corta y error observable. | `src/lib/store.ts:175` | Guardar cada operación confirmada, con agrupación de cambios y estados Guardando, Guardado en este navegador y No se pudo guardar. |
| Paneles móviles que dejan de ser enfocables cuando están cerrados. | `src/components/app/Editor.tsx:109`, `:128` | Usar superficies modales accesibles para biblioteca e inspector móviles. Un panel oculto no recibe foco ni eventos. |
| Tema de interfaz separado del documento. | `src/hooks/use-theme.ts:3` | Preferencia claro, oscuro o sistema para la aplicación. Los colores de la hoja viajan con cada proyecto. |

Las referencias de esta tabla son de `tech-stack-architect`. Se reutiliza la organización y el comportamiento; cada componente se adapta al contrato del horario y a los componentes UI ya instalados.

### Qué no copiar

- React Flow y su documento de nodos y aristas. El horario tiene columnas discretas y minutos, no un plano libre ni conexiones. Mantener SVG evita cambiar el motor visual y duplicar exportación.
- La colocación en el centro con desplazamientos de 28 píxeles, `src/hooks/use-canvas-placement.ts:10`. Una clase necesita un día y una hora elegidos, no una ubicación arbitraria.
- La grilla de ocho píxeles y las guías de proximidad entre objetos, `src/components/flow/FlowCanvas.tsx:239`. La unidad de interacción aquí es media hora. El zoom no modifica esa unidad.
- Los atajos a nivel de `window` como única protección, `src/hooks/use-editor-shortcuts.ts:18`. Además de ignorar inputs, el horario debe respetar el foco del lienzo, menús, modales, composición IME y widgets propios.
- El atajo de búsqueda que puede enfocar un campo de un panel cerrado, `src/components/flow/AssetPanel.tsx:45`. Abrir primero la biblioteca y luego enfocar la búsqueda.
- La sustitución inmediata al importar, `src/components/app/TopBar.tsx:115`. Importar crea otro proyecto; reemplazar el activo es una acción explícita.
- Ocultar el texto de guardado en tamaños menores a `lg`, `src/components/app/SaveStatus.tsx:68`. En móvil el error sigue siendo visible y accionable.
- La persistencia con una única clave de documento, `src/lib/store.ts:21`, ni el guardado de nodos de edición sin serializar, `:181`. Necesitamos varios proyectos y guardar sólo datos confirmados.
- La sincronización remota, enlaces, servidor y MCP. No forman parte del alcance autorizado del horario.
- El historial que guarda sólo nodos y aristas, `src/lib/store.ts:229`. En el horario, materia, bloque, título, días, rango y estilo deben participar en el historial del proyecto.

### Salud de la referencia

Verificaciones ejecutadas el 13 de octubre de 2026 en `tech-stack-architect`:

| Comando | Resultado |
| --- | --- |
| `npm test` | 32 pruebas aprobadas, ninguna fallida. Cubren rutas de conexiones, disposición, revisión de diagramas y MCP. |
| `npm run lint` | Código de salida 0, con 18 advertencias. Predominan exportaciones mezcladas para Fast Refresh; hay una advertencia de `setState` en un efecto de `carousel.tsx:96`. |
| `npm run build` | Código de salida 0. Compila cliente y servidor. Advierte tamaño de chunk: el JS principal del cliente mide 8.153,85 kB minificado y 3.040,78 kB gzip. |

Las pruebas existentes no verifican el recorrido completo por teclado, arrastre táctil, guardado local fallido, menú de proyectos múltiples ni accesibilidad de los overlays. Las advertencias no justifican descartar la referencia, pero tampoco convertirla en una plantilla copiada sin revisión. Su bundle de cliente refuerza la decisión de trasladar patrones puntuales y conservar el motor SVG liviano del horario. El chequeo de código no acredita funcionamiento en teléfonos reales.

## Conceptos y propiedad de los datos

### Proyecto, materia y bloque

| Entidad | Contenido | Regla de producto |
| --- | --- | --- |
| Proyecto | Identidad, título, subtítulo, días visibles, rango, tamaño, materias, bloques y estilo resuelto de la hoja. | Es una unidad guardable, duplicable e intercambiable. Su título también es el título de la hoja; se evita un segundo nombre oculto. |
| Materia | `id`, nombre, color de fondo y color de texto. | Se crea una vez dentro de un proyecto. Todas sus clases comparten nombre y colores. Puede existir sin bloques. |
| Bloque | `id`, `subjectId`, día, inicio, fin, aula, tipo y notas. | Es una clase concreta de esa materia. Aula, tipo y notas varían por bloque. |
| Tema guardado | Nombre, estilo visual y paleta opcional de materias. | Es una receta reutilizable, sin título, días, horas, materias ni clases. Aplicarla copia sus valores al proyecto. |
| Preferencias de aplicación | Apariencia claro/oscuro/sistema y preferencias de paneles. | Pertenecen al navegador y no cambian una imagen exportada. |
| Estado de edición | Selección, herramienta, materia armada, ghost, borradores, zoom, gesto activo y última duración por materia de esta sesión. | No es contenido del proyecto ni dispara autosave. |

Materia identifica un conjunto de clases; Bloque identifica una aparición semanal. Ejemplo: Álgebra es una materia. Su teórica del lunes 09:00 a 11:00, aula 201, y su práctica del jueves 14:00 a 16:00, aula 105, son dos bloques.

El tipo usa opciones Teórica, Práctica, Laboratorio, Consulta y Otro, con valor vacío inicial. Otro permite una etiqueta corta propia. Las notas son texto libre opcional. No convertir el antiguo `details` en un tipo por inferencia; migrarlo a notas conserva lo que escribió la persona.

Los días tienen identificadores estables de lunes a domingo y etiquetas en español con tildes. Un proyecto elige un subconjunto en orden semanal. Reordenar días arbitrariamente queda fuera de P0. Los tiempos se representan en minutos del día, de 0 a 1440. Se permite 24:00 sólo como fin. Un bloque no cruza la medianoche en esta entrega.

### Identidad, nombres y colores

- Crear y renombrar requieren un nombre no vacío tras quitar espacios en los extremos. Conservar acentos y mayúsculas escritos. Comparar duplicados sin distinguir mayúsculas y colapsando espacios consecutivos.
- En la creación manual, si ya existe ese nombre, mostrar "Ya tenés una materia con este nombre" y la acción "Usar esta materia". No crear dos filas indistinguibles por accidente.
- Renombrar una materia actualiza todos sus bloques y su entrada de leyenda en una sola operación deshacible. Nunca cambiar relaciones buscando el texto antiguo.
- Si el nombre nuevo coincide con otra materia, ofrecer "Unificar materias" en un paso explícito. Se conserva la materia de destino y sus colores, se reasignan los bloques y se muestran las cantidades afectadas antes de aplicar. Cancelar mantiene ambas identidades.
- Los colores son propiedad de la materia. Editarlos afecta todos sus bloques. No agregar overrides individuales en P0 porque complican el vínculo visual entre materia y clases.
- La leyenda usa `subjectId`, incluye sólo materias que tienen bloques y conserva el orden de la biblioteca. Los homónimos migrados conservan su nombre y colores originales; la biblioteca y los selectores agregan una etiqueta auxiliar de variante para poder elegirlos. No cambiar el texto exportado sin una edición explícita.
- Una materia nueva recibe el siguiente color de la paleta del tema, con texto de contraste suficiente. La muestra visual no reemplaza el nombre.

## Estructura del estudio

```text
┌ Horario Studio   Archivo  Editar  Ver  Documento  Tema  Ayuda ─────┐
│ [Título editable]  Guardado en este navegador          [Exportar] │
├ Materias ─────────┬──────────────────────────────────────────────┤
│ [Buscar] [+ Nueva]│ [Seleccionar] [Crear: Álgebra]      [Ajustar] │
│ ● Álgebra       2 │                                              │
│ ● Programación  3 │       hoja y grilla semanal                   │
│ ● Física        0 │       bloque activo con tiradores             │
│                  │                                              │
│                  │         inspector contextual al seleccionar  │
└──────────────────┴──────────────────────────────────────────────┘
```

La barra general permanece visible. En escritorio ancho, la biblioteca ocupa aproximadamente 260 px y el inspector hasta 300 px. Son valores iniciales a validar con nombres largos y una hoja horizontal. Si el espacio restante para la hoja es insuficiente, el inspector pasa a overlay. No se comprime el texto de las materias para sostener tres columnas a cualquier ancho.

La biblioteca contiene materias y sus acciones. No contiene título, tamaño de hoja, rango horario, fuentes ni un acordeón por bloque. Se puede plegar; Ver > Materias la recupera. Cada fila distingue la materia armada para creación del bloque seleccionado en la hoja.

| Menú | Acciones P0 y P1 |
| --- | --- |
| Archivo | Nuevo proyecto, Mis proyectos, Duplicar proyecto, Importar proyecto, Descargar proyecto JSON, Descargar copia de seguridad. |
| Editar | Deshacer, Rehacer, Copiar bloque, Pegar bloque, Duplicar bloque, Eliminar bloque. Estados deshabilitados con motivo cuando no aplican. |
| Ver | Materias, Propiedades del bloque, Ajustar hoja y zoom. P1 agrega composición compacta opt-in. |
| Documento | Ajustes del documento, título y subtítulo, días, rango, tamaño y elementos visibles. |
| Tema | Elegir tema, Personalizar tema, Guardar tema, Administrar mis temas. |
| Ayuda | Atajos y explicación breve del guardado local. |

Exportar es una acción visible fuera del menú. Abre PNG, SVG y Proyecto JSON, con aclaraciones de uso. JSON conserva edición; PNG y SVG representan la hoja. No llamar "Compartir" a una descarga si no produce un enlace.

## Primer uso y nuevos proyectos

### Sin proyectos

Mostrar el estudio vacío con una invitación central, "Creá tu primer horario", botón primario "Nuevo proyecto" y acción secundaria "Importar proyecto". Biblioteca y lienzo no deben permitir crear bloques sin un proyecto confirmado.

Nuevo proyecto abre un modal con:

1. Título, valor inicial "Mi horario", y subtítulo opcional en una sección secundaria.
2. Tamaño: A4 vertical, A4 horizontal, Cuadrado, Historia y Panorámico. Mostrar nombre y proporción. P1 agrega tamaño personalizado en píxeles con ancho y alto válidos.
3. Días: lunes a viernes seleccionados; sábado y domingo disponibles. Se exige al menos un día.
4. Rango: 08:00 a 21:00 de forma predeterminada, en pasos de 30 minutos, y opción "Ajustar a mis clases". El rango es fijo por defecto para que la grilla no cambie al colocar la primera clase.

El modal tiene "Crear proyecto" y "Cancelar". Validar al confirmar y enfocar el primer error. Crear agrega una identidad nueva a la biblioteca local; cancelar no crea un proyecto ni altera el activo. El nuevo proyecto usa el tema predeterminado o el último tema elegido como predeterminado por la persona.

### Proyecto sin materias o sin bloques

- Sin materias: la hoja ya muestra título, días y rango. Biblioteca muestra "Todavía no hay materias" y "Nueva materia". El lienzo indica "Creá una materia para empezar a ubicar tus clases".
- Con materias y sin bloques: el lienzo indica "Elegí una materia y hacé clic en la grilla". Una acción "Agregar bloque por formulario" ofrece un camino por teclado y tacto.
- Luego del primer bloque: se retira la explicación central y se conserva una ayuda breve junto a Crear bloque. No superponer un tutorial sobre las clases.

Volver a abrir la aplicación carga el último proyecto guardado. Si no puede recuperarlo, muestra Mis proyectos y el motivo; no reemplaza el contenido almacenado por un proyecto vacío.

## Materias y colocación de bloques

### Crear una materia

"Nueva materia" abre un formulario pequeño con nombre y color. Aula, día y horas no forman parte de este formulario. Al confirmar, crea la materia, la selecciona en la biblioteca y activa Crear bloque. El formulario puede cerrarse sin crear nada. Crear una materia no inventa su primera clase.

Una fila de materia funciona como selector de creación. Al pulsarla, activa Crear bloque con esa materia y muestra "Álgebra, clic para ubicar una clase". Su menú secundario permite Renombrar, Cambiar colores, Agregar bloque por formulario y Eliminar materia. El contador indica cuántos bloques usa.

### Ghost y creación directa, P0

1. Entrar en Crear bloque con una materia armada. Al pasar por una zona temporal válida, mostrar una previsualización semitransparente con nombre y `día, inicio–fin`.
2. Convertir el puntero a coordenadas del SVG y luego a día y minuto. Aplicar snap de 30 minutos. Usar el día bajo el centro de la columna, sin trasladar el bloque a una columna ajena por proximidad.
3. La duración inicial es 60 minutos o la última duración confirmada de esa materia en esta sesión. Esa memoria cambia al crear o redimensionar, no al mover ni al cancelar. No se exporta como propiedad de la materia ni se restaura como configuración obligatoria al abrir el archivo.
4. Clic en espacio vacío confirma un bloque con aula, tipo y notas vacíos. Se selecciona el bloque y se abre su inspector. La herramienta sigue en Crear para permitir clases repetidas; el botón Seleccionar o `V` sale del modo. `Escape` cancela el ghost y vuelve a Seleccionar.
5. En modo Crear, pulsar un bloque existente lo selecciona y cambia a Seleccionar. Nunca crear por debajo de un bloque por un clic ambiguo. Para solapar deliberadamente se usa arrastre desde espacio libre o el formulario.
6. Ghost fuera de la grilla desaparece. Un clic en margen, título, cabecera de día o leyenda no crea un bloque.

Si la duración no cabe al final del rango, el ghost conserva la duración y desplaza el inicio hacia arriba hasta caber. Mostrar las horas resultantes. Si el rango es más corto que la duración recordada, usar el rango completo para ese candidato sin sobrescribir la memoria hasta confirmar. El mínimo es 30 minutos.

Arrastrar desde espacio vacío en Crear define inicio y fin por medias horas. Se acepta arrastrar hacia arriba: el menor minuto es inicio y el mayor fin. Un gesto que no supera el umbral de arrastre usa el comportamiento de clic. La creación termina al soltar dentro de la grilla. Soltar fuera o recibir `pointercancel` descarta el candidato.

### Selección, movimiento y resize, P0

- Clic en un bloque selecciona sólo ese bloque. El borde de selección, las horas y los tiradores quedan fuera de la imagen exportada. Clic en vacío lo deselecciona.
- Arrastrar el cuerpo en Seleccionar conserva duración y mueve día e inicio. Capturar el puntero para completar o cancelar aunque cruce un margen. Mostrar el candidato mientras el documento confirmado permanece intacto.
- Aplicar snap al minuto de inicio en movimientos ordinarios. Un bloque legacy con minutos no múltiplos de 30 conserva la duración exacta. Al moverlo verticalmente por teclado cambia 30 minutos desde su hora original. Al moverlo con puntero, informar la nueva hora redondeada en la previsualización antes de confirmar.
- Resize sólo en bordes superior e inferior. Cambia un extremo en pasos de 30 minutos, sin cambiar día ni el otro extremo. El extremo activo queda entre el límite del rango y una duración mínima de 30 minutos.
- Mantener el bloque dentro de los días y rango activos. Un intento fuera del rango muestra el límite y no reduce silenciosamente la duración. Para agregar fuera del rango se editan primero los ajustes o se usa la propuesta de ampliación del formulario.
- `Escape` durante un gesto restaura el bloque anterior. Cancelar, perder captura o cambiar de proyecto no deja una operación parcial en historial ni autosave.
- Un gesto completo es una operación deshacible. Cambios de hover, snap o tiradores no generan entradas independientes.

Para evitar que la grilla salte durante un gesto, congelar su geometría, zoom y mapa temporal desde `pointerdown` hasta confirmar o cancelar. El rango automático sólo se recalcula después.

### Escala uniforme y compactación futura

El editor nuevo usa escala temporal uniforme. Media hora mantiene el mismo alto en todos los días. En P0, vista y exportación usan esa misma escala. Se conserva una vista previa de exportación para comprobar la hoja sin selección ni herramientas, pero no cambia su distribución temporal.

Composición compacta queda como P1 opt-in, aprovechando `getTimelineMetrics` después de resolver un mapa minuto/coordenada reversible y congelado durante cada gesto. Si permite sólo cambios por formulario, indicarlo y ofrecer "Volver a escala uniforme" para edición directa. No dividir el alto de la hoja por una duración global cuando las horas tienen pesos distintos.

La compactación elegida debe aplicarse a vista y exportación juntas. Nunca exportar un horario comprimido mientras el lienzo muestra distribución uniforme. Cambiar a uniforme también cambia el resultado exportado, de forma explícita y deshacible. Un parámetro legacy optimizado se conserva en la información de conversión y se informa antes de aceptar una copia editable uniforme; el archivo original sigue recuperable.

### Inspector del bloque

Título "Bloque de Álgebra" y campos Materia, Día, Inicio, Fin, Aula, Tipo y Notas. Mostrar duración calculada. Materia puede cambiarse sin recrear el bloque y toma el nombre y colores de la materia elegida.

Los campos usan borradores locales. Un formulario confirma con "Aplicar cambios" y cancela con "Cancelar". No corregir el fin mientras la persona escribe un inicio incompleto. Validar inicio < fin, límites de día y valores de formato. Mostrar errores cerca del campo y conservar el borrador.

Si la persona selecciona otro bloque con cambios pendientes, resolver dentro del panel con "Aplicar", "Descartar" y "Seguir editando". Un clic de selección no debe tirar texto escrito. Cerrar un inspector sin cambios no necesita confirmación. Al confirmar un formulario, el historial recibe una operación con todos los campos.

## Casos difíciles resueltos

| Caso | Decisión | Motivo y aceptación |
| --- | --- | --- |
| Clases superpuestas de materias diferentes o de la misma materia | Permitirlas con aviso. Dibujar en carriles dentro del mismo día, sin ocultar una debajo de otra. | Un horario puede representar alternativas o un conflicto real. La persona puede conservarlo y exportarlo. Inspector indica qué bloques se cruzan; el aviso usa texto e icono además del color. |
| Detección de solape | Intervalos semiabiertos: A cruza B si `A.inicio < B.fin` y `B.inicio < A.fin` en el mismo día. | Una clase que termina 10:00 y otra que empieza 10:00 no se marcan como conflicto. |
| Carriles de solape | Agrupar por componente conectado de intervalos y asignar el primer carril libre en orden inicio, fin e id. | Importar, guardar y exportar producen la misma disposición. Los cruces encadenados conservan espacio legible. La selección no cambia el carril. |
| Demasiados cruces o bloques pequeños | En la composición se priorizan nombre y horas; metadatos pueden abreviarse. El inspector y la lista accesible conservan todo. | No reducir texto indefinidamente. Mostrar aviso antes de exportar cuando hay texto truncado; permitir continuar. |
| Candidato idéntico a un bloque existente | Bloquear la creación accidental y seleccionar el existente. | Se compara materia, día, inicio, fin, aula, tipo y notas. Mostrar "Este bloque ya existe". Una importación conserva duplicados de origen y los marca para revisión. |
| Duplicar bloque | Crear un ghost con los mismos campos y duración, para elegir posición. Enter o clic lo confirma; Escape cancela. | Evita dejar dos copias exactamente apiladas. Por formulario se puede elegir día/horario. No generar nueva materia. |
| Borrar bloque | Quitar el bloque y mantener su materia. Seleccionar el siguiente bloque según orden del día o enfocar la biblioteca. | Deshacer lo restaura. Borrar la última clase no borra la materia. |
| Borrar materia sin bloques | Eliminar con deshacer, sin modal. | No afecta clases. |
| Borrar materia con bloques | Confirmación con nombre y cantidad: "Eliminar Álgebra y sus 3 bloques". Ofrecer "Reasignar bloques" antes de borrar si la intención es cambiar de materia. | Nunca dejar bloques huérfanos. La eliminación es una sola operación deshacible. |
| Renombrar materia | Propagar por id a todos los bloques; no copiar texto en cada bloque. | Leyenda, inspector, biblioteca y exportación muestran el nombre nuevo en la misma operación. |
| Quitar un día con bloques | Bloquear Aplicar hasta elegir otro día de destino o eliminar explícitamente los bloques afectados. | Mostrar cantidad por día. Reasignar puede generar solapes y los avisa. Cancelar mantiene días y clases. Nunca sólo ocultarlos. |
| Reducir el rango con bloques fuera | Mostrar cuántos bloques quedan fuera. Acción recomendada "Ampliar para incluir mis clases". Mantener el ajuste anterior hasta resolver. | No recortar ni desplazar automáticamente. Para sostener el rango más corto, mover o borrar las clases afectadas antes de aplicar. |
| Crear por formulario fuera del rango fijo | Proponer ampliar el rango al inicio y fin necesarios, en pasos de 30 minutos. Aplicar bloque y ampliación juntos sólo al aceptar. | Rechazar deja el borrador intacto. El horario no se desplaza solo. |
| Rango automático | Ajustar a los bloques confirmados con media hora de margen por lado, limitado a 00:00–24:00. Sin bloques usar 08:00–21:00. | El recálculo ocurre al confirmar; nunca mientras se arrastra. Días siguen siendo elección del proyecto. |
| Inicio 23:30, fin 24:00 | Válido. Inicio 24:00 o fin <= inicio, inválido. | No normalizarlo a 23:59 ni transformarlo en una clase de duración cero. |
| Cambio de tamaño de hoja | Redistribuir representación; conservar días y minutos. | Un bloque no cambia sus horas por mover de A4 vertical a horizontal. Deshacer revierte tamaño y composición. |
| Cambio de proyecto durante gesto o modal | Cancelar gesto; resolver borradores pendientes; guardar contenido confirmado antes de cambiar. | No trasladar selección, materia armada ni ghost al proyecto siguiente. |
| Autosave fallido | Conservar el documento en memoria, estado visible y acciones Reintentar y Descargar proyecto JSON. | Guardado no se declara exitoso si la escritura falla. Cambiar de proyecto necesita primero conservar una copia o una decisión explícita de descartar. |

## Proyectos locales, guardado y copias

### Mis proyectos

Archivo > Mis proyectos abre una biblioteca con título, fecha de modificación, cantidad de materias y bloques, y miniatura opcional en P1. Acciones Abrir, Renombrar, Duplicar, Descargar JSON y Eliminar. Orden por última modificación. No usar el título como clave; duplicar genera una identidad nueva y el título "Horario, copia".

Cada proyecto posee un historial de sesión. Cambiar de proyecto no permite deshacer acciones del anterior sobre el nuevo. La primera entrega puede reiniciar el historial al abrir, si queda indicado en Ayuda; el contenido guardado no se reinicia. Eliminar un proyecto pide confirmación y permite recuperarlo desde una papelera local durante siete días o eliminarlo definitivamente con una segunda acción explícita. Una copia de seguridad incluye la papelera con su fecha de borrado.

La interfaz explica una vez, en contexto de Mis proyectos: "Tus proyectos se guardan en este navegador. Descargá una copia para llevarlos a otro dispositivo". No presentar una promesa de cuenta o nube.

### Contrato visible del guardado

1. Guardar sólo cambios confirmados. No escribir al mover el puntero ni por cada carácter de un borrador.
2. Después de una operación, marcar "Guardando...". Agrupar operaciones cercanas con una demora corta, hasta 500 ms. Cambiar de proyecto, cerrar biblioteca o iniciar una copia de seguridad fuerza el guardado pendiente.
3. Mostrar "Guardado en este navegador" únicamente después de confirmar la escritura del contenido y sus metadatos. La fecha de modificación se actualiza en ese momento.
4. Una falla muestra "No se pudo guardar" y un panel de recuperación persistente. No esconderlo detrás de la última descarga exitosa.
5. Mantener la última versión válida; no borrar el registro previo antes de escribir el nuevo. Si falla un índice o una migración, el proyecto recuperable no desaparece.
6. Al arrancar, recuperar el último proyecto válido; si hay datos corruptos, ofrecer descargar los datos recuperables y abrir otra copia. No sobrescribir la clave dañada con estado vacío sin decisión explícita.
7. Detectar otra pestaña que escribe una revisión más nueva del mismo proyecto. Suspender el autosave de la pestaña obsoleta y ofrecer Recargar o Guardar como copia. No aplicar último escritor silenciosamente.

La selección de localStorage o IndexedDB y el diseño de transacciones se resuelven en el plan técnico. Estos comportamientos son obligatorios con cualquiera de las dos opciones. Persistir en el navegador no constituye una copia de seguridad contra el borrado de datos del sitio.

### Descargas e importación

| Acción | Contenido y comportamiento |
| --- | --- |
| Descargar proyecto JSON | Un proyecto, versión de esquema, materias, bloques, documento y estilo resuelto. Sin historial, selección, ghost ni preferencias de interfaz. |
| Descargar copia de seguridad | Todos los proyectos, temas personales y preferencias portables, con versión y fecha. Excluir estado transitorio y secretos. |
| Importar proyecto | Validar primero y mostrar resumen. Crear un proyecto nuevo con ids nuevos donde haga falta. No sustituir el activo. |
| Importar copia de seguridad | Mostrar cantidad de proyectos y temas. Por defecto agregar como copias; una restauración que reemplaza toda la biblioteca exige acción separada y copia previa. |
| Importar archivo inválido | Indicar problema y mantener el proyecto actual. No producir un proyecto vacío que parezca importado correctamente. |

La importación distingue errores que impiden comprender el formato de advertencias reparables. No descartar bloques inválidos sin informe. Si algunos necesitan revisión, ofrecer conservar el archivo original y abrir una copia convertida con listado de incidencias; la persona confirma antes de guardar esa copia. Formatos con versión futura no soportada se rechazan con un mensaje específico.

### Compatibilidad con `AppState` versión 1

P0 debe leer el JSON `{ version: 1, settings, items }`, la clave `horario-app-state` y enlaces antiguos `?s=...`. La migración crea un proyecto v2 nuevo y conserva los datos legacy hasta que el nuevo se haya guardado y reabierto con éxito. No eliminar el original durante el primer intento.

Reglas de conversión:

- Copiar título, subtítulo, tamaño, densidad, tema y toggles compatibles. Conservar la preferencia antigua de compactación en la información de conversión y explicar el cambio a uniforme del editor P0 antes de confirmar. Días iniciales lunes a viernes, ampliados si un import válido contiene sábado o domingo.
- Crear una materia por combinación EXACTA de nombre, color de fondo y color de texto. Mantener bloques asociados a esa identidad. No normalizar nombres ni colores para agrupar automáticamente. Esta decisión conserva nombres y aspecto de archivos donde valores parecidos representaban materias diferentes.
- Si se crean homónimos por colores diferentes, conservar el nombre original en documento y exportación. Mostrar "Variante 2" como texto auxiliar sólo en biblioteca y selectores. La comparación por nombre normalizado sirve para sugerir una fusión manual posterior, nunca para aplicar una durante la migración. No elegir el primer color y descartar el resto.
- Convertir `room` a aula y `details` a notas. Tipo inicial vacío. No inventar aula ni comisión cuando estaban vacías.
- Conservar los minutos exactos de origen aunque no sean múltiplos de 30. La memoria de duración de sesión comienza en 60 minutos. Una edición confirmada puede actualizar esa memoria, ajustada a 30 minutos para futuras creaciones, sin modificar las clases antiguas.
- Regenerar ids duplicados con un informe; mantener relaciones. Detectar días desconocidos, colores inválidos, horas inválidas e intervalos de duración cero. No corregirlos sin mostrar el cambio.
- Si un rango manual legacy excluye clases, ampliar en la copia convertida para incluirlas e informar el ajuste. Si el rango era automático, usar los límites reales, sin el recorte mínimo de las 06:00 actual.
- Un enlace antiguo importa una copia nueva. Limpiar `s` de la URL después de interpretar y preservar el proyecto importado; si el guardado falla, ofrecer descarga antes de quitar el único respaldo accesible. Un enlace dañado no pisa el proyecto local.

## Temas, presets y tipografías

### Dónde vive cada configuración

Documento > Ajustes concentra tamaño, días, rango, título, subtítulo y visibilidad de aula, tipo, notas, horas y leyenda. Tema > Personalizar concentra fondo, tinta, grilla, estilo de bloques, densidad y tipografías. La compactación futura pertenece a composición, no cambia la duración de ninguna clase.

Tema de la aplicación y tema de la hoja son independientes. Cambiar interfaz a oscuro conserva una hoja Papel clara y su exportación. Elegir Noche para la hoja no obliga a oscurecer los menús.

P0 conserva Papel, Noche y Tinta como presets reconocibles, mostrando pequeñas previews con clases reales o una muestra declarada como muestra. P1 permite guardar temas personales. No mezclar presets visuales con plantillas de horario que contienen materias.

### Aplicar y guardar un tema

- Elegir un preset previsualiza sobre el proyecto. "Aplicar tema" confirma una sola operación deshacible; Cancelar restaura el estilo previo.
- Cambia el estilo general de la hoja. Los colores de materias ya creadas se conservan por defecto. Una opción explícita "Aplicar también la paleta a mis materias" muestra la cantidad afectada y un preview antes de confirmar.
- Personalizar cambia sólo el proyecto actual. Marcarlo como "Personalizado" después de confirmar. No modificar automáticamente el preset del que partió.
- "Guardar tema" pide nombre y crea una receta independiente del proyecto. Actualizar un tema personal existente requiere elegirlo explícitamente. Sobrescribir un tema no modifica proyectos que lo aplicaron antes.
- Cada proyecto guarda una copia resuelta del estilo. Cambiar o borrar un tema de la biblioteca no altera proyectos guardados ni sus exportaciones.
- "Usar para nuevos proyectos" establece el predeterminado local. Esta acción no recolorea los proyectos existentes.
- Un JSON de proyecto importa sus valores visuales aunque el tema original no exista. Agregarlo a Mis temas requiere una acción posterior.

### Fuente y legibilidad

Mantener una selección breve y verificable. En P0 se ofrece una fuente sans local para texto del horario y la fuente de título actual si se empaqueta localmente; evitar un catálogo remoto. El sistema permite elegir título y contenido por separado, con pocos tamaños seguros. La familia de la interfaz no cambia al editar las fuentes del documento.

Cada fuente ofrecida debe cargar desde archivos del proyecto, cubrir español y tener permiso de distribución. Exportación PNG espera `document.fonts.ready`. SVG portable incorpora la fuente o una representación que no dependa de la máquina receptora. Si no se puede exportar una familia seleccionada, explicar el problema y ofrecer una alternativa antes de descargar; no generar una imagen con otra fuente en silencio.

Limitar el ajuste automático de texto. Nombre y horas tienen prioridad; aula, tipo y notas pueden ocultarse por toggle o abreviarse con indicación. Inspector conserva texto completo. Probar nombres como "Introducción a la programación orientada a objetos" en bloques de 30 minutos y en hojas horizontales antes de cerrar la elección de tamaños.

## Atajos, foco y accesibilidad

### Alcance del teclado

Los atajos son mejoras sobre acciones visibles. Todos los flujos deben poder completarse mediante formularios y botones.

| Atajo | Acción | Alcance |
| --- | --- | --- |
| `V` | Seleccionar. | Lienzo o barra de herramientas con foco, sin campos abiertos. |
| `B` | Crear bloque con la materia armada. | Lienzo. Si falta materia, abrir selector sin crear una vacía. |
| `Escape` | Cancelar gesto; cerrar overlay activo; salir de Crear; deseleccionar. | Resolver sólo el contexto más interno por pulsación, sin borrar un borrador silenciosamente. |
| `Delete` / `Backspace` | Eliminar el bloque seleccionado. | Lienzo con foco y bloque seleccionado. Nunca durante edición de texto ni en la biblioteca de materias. |
| `Ctrl/Cmd+Z` | Deshacer operación de proyecto. | Editor, fuera de campos. Dentro de inputs conserva el deshacer nativo del texto. |
| `Ctrl/Cmd+Shift+Z`, `Ctrl+Y` | Rehacer. | Mismo alcance que deshacer. |
| `Ctrl/Cmd+D` | Duplicar bloque como candidato de colocación. | Lienzo con bloque seleccionado. Prevenir el marcador del navegador sólo cuando la acción aplica. |
| `↑` / `↓` | Mover el bloque 30 minutos. | Lienzo con selección. `Shift` cambia 60 minutos. Anunciar nuevo intervalo al confirmar. |
| `←` / `→` | Mover al día visible anterior/siguiente. | Lienzo con selección. No saltar a días ocultos ni envolver del último al primero. |
| `Enter` | Abrir propiedades del bloque o confirmar candidato de creación enfocado. | Lienzo. Dentro de un formulario respeta su acción de confirmación. |
| `Ctrl/Cmd+C`, `Ctrl/Cmd+V` | Copiar y pegar bloque. | Lienzo con foco. Dentro de campos conserva copiar/pegar texto. |
| `Ctrl/Cmd+K` | Abrir paleta de comandos. | Editor fuera de formularios y modales. Incluye Buscar materias y los mismos comandos del menú. |
| `Ctrl/Cmd+S` | Forzar guardado local y mostrar resultado. | Editor; no descargar JSON ni declarar nube. |

No capturar letras o flechas cuando el objetivo es `input`, `textarea`, `select`, editable, combobox, listbox, menú o diálogo. También respetar `event.defaultPrevented`, `event.isComposing`, eventos de teclas con Alt y los widgets de fecha/hora. Un registro central resuelve prioridades; no distribuir listeners globales que compiten por Escape o borrar.

### Copiar y pegar

Copiar prepara un payload versionado de bloque y materia, sin crear historial. Dentro del mismo proyecto, pegar genera un ID de bloque nuevo y reutiliza la materia. Entre proyectos, reutilizar identidad sólo con coincidencia exacta verificada; si hay duda, crear una materia nueva con nombre y colores conservados. No vincular por nombre a secas.

Con una celda destino elegida, pegar propone allí el mismo bloque y conserva aula, tipo, notas y duración. Sin destino, abre un candidato de colocación en la posición original. Confirmar lo inserta como una operación; Escape lo cancela. Un candidato exactamente igual a otro se bloquea y ofrece elegir otra posición. Los solapes que no sean duplicados exactos siguen permitidos con aviso y carriles. Pegar repetidamente no desplaza clases a horarios inventados.

La copia interna funciona durante la sesión aunque falle el portapapeles del sistema. Cuando el navegador lo permite, escribir/leer JSON identificado para trasladar entre pestañas. Texto arbitrario se conserva para inputs y no crea bloques. El menú informa si sólo está disponible la copia interna. No depender de pegar con mouse ni de permisos del sistema para completar el flujo.

### Camino completo sin puntero

Crear proyecto desde Archivo; completar modal; crear materia desde biblioteca; pulsar "Agregar bloque por formulario"; elegir día, inicio y fin; aplicar; navegar a una lista cronológica de bloques y abrir propiedades. Editar, duplicar, eliminar y exportar desde acciones visibles. La lista puede ser un modo accesible alternativo de Ver, pero debe existir desde P0 para no depender de hit testing SVG.

El SVG de composición puede conservar semántica de imagen. La capa de edición necesita controles con nombres y foco, o un listado equivalente con correspondencia clara. No convertir un `g` clickeable en único acceso a una clase. La lista anuncia "Álgebra, lunes, 09:00 a 11:00, aula 201, Teórica" y conserva un foco estable tras cambios.

Modales y hojas móviles atrapan foco, vuelven al disparador al cerrar y hacen inerte el fondo. Menús usan flechas, Enter, Escape y Tab según el patrón de su componente. Tiradores requieren nombres como "Cambiar hora de fin" y una alternativa por campos. La selección, los cruces y los errores usan texto o icono además de color. El ghost es decorativo para lectores de pantalla; los resultados confirmados se anuncian en una región de estado estable sin repetir cada evento de puntero.

Objetivos de aceptación: foco visible, contraste de texto normal al menos 4,5:1 y de controles esenciales 3:1, objetivos táctiles de 44 px, navegación sin tabulación positiva y controles con nombre accesible. Verificar al 200% de zoom y a 320 px de ancho. Respetar movimiento reducido; ninguna animación es necesaria para entender la edición. Los errores de guardado con acciones quedan visibles hasta resolver o descartar, y no desaparecen como un toast corto.

## Móvil y teclado virtual

En móvil se conserva la hoja como protagonista. La barra resume título, menú de proyecto, estado y Exportar. "Materias" abre una hoja inferior o lateral; "Propiedades" abre otra. Sólo una superficie modal está abierta a la vez. Al elegir una materia, cerrar biblioteca y mostrar su nombre junto a Crear bloque.

Un toque en vacío con Crear muestra el candidato y abre un formulario breve con día e intervalo. "Crear bloque" confirma. Así el primer toque permite corregir la posición y no deja clases por error durante un desplazamiento. Un toque en bloque abre selección; la acción Editar abre propiedades. Movimiento táctil P1 usa un tirador explícito del bloque seleccionado; un gesto sobre el resto de la hoja conserva desplazamiento y zoom del navegador.

P0 no depende de hover, doble clic, botón derecho ni drag para crear o corregir. Cambiar días y horas por formulario completa todas las tareas en un teléfono.

Con teclado virtual abierto:

- El campo activo y los botones Aplicar/Cancelar siguen visibles mediante scroll del formulario. No quedan debajo del teclado ni de la zona segura inferior.
- Usar altura dinámica de viewport y contenedores con scroll propio. Evitar encerrar todos los campos en una altura fija que no puede desplazarse.
- Texto de inputs de al menos 16 px en superficies táctiles para evitar zoom de Safari; no deshabilitar zoom de la página.
- Mantener borrador cuando cambia orientación, se oculta el teclado o se suspende la app. No cerrar el formulario por perder hover o por un resize del viewport.
- Ajustar safe areas en barra y hoja. No bloquear scroll con `touch-action: none` en todo el lienzo. Reservarlo al tirador que de verdad captura un gesto.

Antes de considerar móvil terminado, verificar Safari en iPhone y Chrome en Android reales, teclado abierto, orientación horizontal y zoom. Emulación desktop sirve para detectar cortes de layout, no para acreditar tacto, teclado, overscroll o safe areas.

## Secuencia de entrega y criterios de aceptación

### P0. Modelo, primer uso y protección de datos

- Proyecto vacío se crea sólo al confirmar el modal. Cancelar conserva la biblioteca y proyecto activo.
- Una materia con dos clases cambia nombre/color en todos sus bloques con una sola operación. Borrar una clase conserva la materia.
- Importar v1 conserva título, clases, aula, notas, colores y minutos exactos. Variantes y reparaciones aparecen en el informe. El original sigue recuperable.
- Se pueden crear dos proyectos, alternar, recargar y recuperar ambos. Importar un tercero no reemplaza ninguno.
- Simular cuota llena produce un error persistente con Reintentar y Descargar JSON. Descargar preserva el último documento en memoria. Ninguna etiqueta afirma Guardado durante la falla.
- Un rango o día que excluiría bloques no se aplica sin resolver esos bloques. No hay clases invisibles por un ajuste confirmado.
- Deshacer/restaurar cubre materia, bloque, título y ajustes. Un gesto equivale a un paso.

### P0. Lienzo y caminos equivalentes

- Elegir Álgebra, ver ghost lunes 09:00–10:00 y confirmar crea un único bloque que usa su id. Nombre y colores coinciden en hoja, biblioteca e inspector.
- Crear por arrastre de 09:00 a 10:30 produce duración 90 minutos. La próxima clase de esa materia usa 90 minutos; una de otra materia conserva su propia memoria.
- Mover martes 10:00–11:30 a jueves 13:00 conserva 90 minutos. Resize fin a 15:00 conserva jueves e inicio 13:00.
- Soltar fuera de grilla, Escape y `pointercancel` no modifican el documento. Recargar nunca muestra un ghost persistido.
- Dos clases que sólo comparten una frontera no muestran cruce. Dos que comparten minutos permanecen visibles en carriles y conservan sus horarios al exportar.
- Escribir letras V/B, borrar texto y deshacer dentro de nombre, notas o título no activa acciones del lienzo. Flechas en menú o selector no mueven una clase.
- Se completa nuevo proyecto, materia, clase, edición y descarga sólo con teclado y también por formularios móviles.
- PNG y SVG usan el mismo documento confirmado, sin herramientas ni selección. JSON importado reproduce el proyecto y su composición.

### P1. Personalización y eficiencia

- Guardar un tema, aplicarlo a dos proyectos y actualizar luego la receta no cambia esos proyectos. Importar su JSON mantiene colores y fuentes aunque falte el preset local.
- Aplicar un tema conserva colores de materias salvo aceptación explícita de aplicar paleta. Cancelar preview revierte todos los cambios visuales provisionales.
- Duplicar un bloque solicita una posición y no agrega automáticamente una copia debajo del original.
- Biblioteca larga sigue siendo buscable y las propiedades sólo muestran el bloque activo. Menús conservan orden y nombres entre escritorio y móvil.
- Exportar con fuentes locales produce PNG/SVG visualmente equivalentes en otra máquina. Los nombres largos y bloques de 30 minutos tienen aviso cuando el texto se trunca.
- Dos pestañas no pisan revisiones del mismo proyecto silenciosamente. La copia de seguridad restaura proyectos y temas en un navegador limpio.

### P2. Extensiones que quedan abiertas

Selección múltiple, edición masiva, duplicar una semana, plantillas con materias, exportación PDF y enlaces compartibles. No agregarlas al mismo tiempo que se introduce la separación Materia/Bloque. Cada extensión necesita su propia regla de historial, importación y acceso por teclado.

## Recorridos para revisar antes de implementar y después de cada hito

1. Primer horario: proyecto A4 horizontal, lunes/miércoles/viernes, 08:00–18:00; crear Álgebra y Programación; colocar dos bloques de Álgebra con aulas distintas; descargar y reabrir JSON.
2. Corrección real: renombrar Álgebra, cambiar color, mover práctica, acortar teórica, provocar un cruce, deshacer todo y comprobar que cada acción restaura el documento esperado.
3. Ajustes que afectan clases: quitar miércoles con dos bloques, reducir rango por debajo del fin de uno, cancelar; luego reasignar el día y ampliar el rango propuesto.
4. Recuperación: importar v1 con colores distintos para un mismo nombre y minutos :15; importar un JSON inválido; simular falla de escritura y descargar la copia en memoria.
5. Varios proyectos: duplicar, modificar la copia, cambiar de proyecto, recargar; importar respaldo con ids repetidos y comprobar que se agrega sin pisar el original.
6. Teclado: crear todo sin mouse; abrir/cerrar cada menú; escribir y borrar dentro de los formularios; verificar que selección del lienzo no roba atajos de texto.
7. Teléfono real: crear y corregir por formulario, abrir teclado sobre el último campo, girar el dispositivo, cerrar hoja y exportar. Repetir con zoom y tamaño de texto aumentado.

Los recorridos son criterios de revisión del producto. Este documento no afirma que el código actual ya los cumpla.
