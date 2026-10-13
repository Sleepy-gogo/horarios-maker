# Plan de implementación

Propuesta del 13 de octubre de 2026. Este trabajo termina en un plan y evidencia. No se cambió la aplicación. Los documentos de detalle son [auditoría](01-auditoria-codigo.md), [flujos](02-producto-y-flujos.md), [motor](03-motor-y-exportacion.md), [pruebas actuales](04-pruebas-de-uso.md) e [inventario UIArc](05-uiarc-componentes.md).

## Decisión general

Reconstruir el dominio, el motor y la interacción. Conservar React, TypeScript, Vite y el despliegue estático. El formato de horario semanal sigue siendo válido. El SVG también sirve como formato gráfico; el problema es la composición actual y su dependencia de fuentes externas, no la extensión SVG.

El estudio gira alrededor de un documento y una biblioteca de materias. Los controles del archivo salen del panel lateral y pasan a la barra superior y a modales. El lienzo permite colocar, seleccionar y editar bloques. La personalización afecta una composición única compartida por vista y exportación.

No incorporar cuentas, backend, colaboración en tiempo real, calendario con fechas, recurrencias, planificación automática ni un editor de vectores general en esta reconstrucción. Son ampliaciones separadas. Los proyectos locales, backups y JSON cubren el trabajo personal planteado.

## Decisiones cerradas para trabajar sin más preguntas

| Tema | Decisión | Motivo |
| --- | --- | --- |
| Materia | ID propio, nombre, color de fondo y texto compartidos. Bloques sólo referencian su ID. | Elimina recopia de nombre/color. |
| Bloque | Día, inicio/fin en minutos, aula, tipo libre con sugerencias y notas. | Teoría, práctica y consulta varían por aparición. |
| Biblioteca | Materias por proyecto; borrar último bloque no borra materia. | Permite volver a colocarla y evita cruces inesperados entre proyectos. |
| Color | Asignación inicial automática de paleta; popover con swatches, presets locales, HEX editable y aviso de contraste. | Nunca exigir elegir color para cada bloque. |
| Hora | Selector comunitario adaptado, escritura 24h y pasos de 30 min; 24:00 permitido sólo como final. | Entrada precisa y alternativa a arrastrar. |
| Inserción | Elegir materia y click en ghost; inicio ajustado a 30 min, duración inicial 60 y última duración de esa materia recordada en sesión. | Flujo rápido sin un formulario por bloque. |
| Herramientas | Colocar materia y seleccionar son modos explícitos. Escape cancela gesto y sale de colocar. El bloque existente tiene prioridad frente al ghost. | Evita inserciones accidentales mientras se edita. |
| Redimensionar | Handles superior/inferior, botones de extremo ±30 y alternativa por teclado/inspector. | Las horas no dependen del mouse. |
| Solapamiento | Permitir con aviso y carriles deterministas, bloquear duplicado exacto accidental. | Un horario puede contener alternativas legítimas; ningún bloque debe tapar otro. |
| Tiempo | Escala uniforme para edición y exportación inicial. Compactación se posterga y sólo vuelve si tiene inversa exacta y vista/export compartidas. | Un gesto no debe cambiar su propio mapa temporal. |
| Rango y días | Impedir aplicar un ajuste que excluya bloques. Ofrecer ampliar, mover o borrar explícitamente. | Nunca esconder ni reasignar horarios como efecto de cambiar el archivo. |
| Historial | Comandos atómicos; un gesto equivale a un deshacer. Excluir hover, selección y zoom. | Recuperación predecible. |
| Atajos | Ctrl/Cmd Z, Shift Z y Ctrl Y; Delete, copy/paste y duplicate con foco en estudio. Inputs conservan atajos nativos. | Evita borrar texto o robar teclas a formularios. |
| Proyectos | Inicio sin proyecto, crear por modal, múltiples proyectos locales y menú Archivo. | Separar configuración inicial del trabajo diario. |
| Guardado | Autosave por comando confirmado, estado real guardando/guardado/error y backup descargable. | Un toast optimista no demuestra persistencia. |
| Importación | Abrir como nuevo proyecto después de validar y revisar; nunca reemplazar automáticamente el activo. | Protege el trabajo existente. |
| Tema | Valores resueltos dentro del proyecto; presets en biblioteca local aparte. Aplicar copia valores, editar preset no modifica proyectos previos. | Archivos reproducibles y cambios controlados. |
| Fuentes | Catálogo Google Fonts verificado y ampliable, archivos/variantes fijados, caché y error visible. Sin sustitución silenciosa al exportar. | La tipografía forma parte del documento. |
| Exportación | Misma revisión y escena para vista/SVG/PNG; los controles de selección quedan afuera. | Garantiza composición y aspecto. |
| Migración | Agrupar v1 por nombre y colores exactamente iguales. Sugerir fusiones después, con revisión. | Conserva diferencias reales y evita fusiones por similitud. |
| Legado optimizado | Preservar archivo original y avisar al crear copia editable uniforme. | No presentar un cambio de aspecto como conversión idéntica. |
| Accesibilidad/móvil | Lista de bloques e inspector completos; touch sin hover y controles amplios; zoom/scroll del documento. | El SVG visual no puede ser la única forma de editar. |

Las decisiones son reversibles antes de implementar. No hay una pregunta de producto imprescindible pendiente. Las incertidumbres abiertas son técnicas y se resuelven con los ensayos de fuentes, exportación y rendimiento de la entrega A.

## Orden de entregas

Cada entrega debe quedar usable y comprobable antes de pasar a la siguiente. Las letras indican dependencia, no semanas ni estimaciones prometidas.

### A. Proteger datos y comprobar la ruta de fuentes

Esta entrega tiene dos trabajos independientes. Uno protege la versión actual; el otro verifica la arquitectura del reemplazo. No dedicarla a decorar el motor viejo.

- Validación estricta de versión, campos, enums, colores, IDs y horarios antes de reemplazar estado.
- Capturar errores de almacenamiento y render; conservar el documento en memoria y ofrecer JSON.
- No limpiar ni sobrescribir almacenamiento ante un enlace/archivo inválido. Guardar el original antes de migrar.
- Revisión concreta antes de reiniciar/importar en la versión vieja, hasta tener historial real.
- Revisar avisos de dependencias según el alcance de [01](01-auditoria-codigo.md). Actualizar Vite y revisar cadena shadcn CLI con build/lint; no presentar cada advisory transitivo como un exploit de producción.
- Spike comparativo de contornos HarfBuzz/Fontkit frente a SVG `<text>` con fuente embebida. Usar fuentes estáticas y variables, español y símbolos, apertura offline y tres navegadores. Medir bytes, carga y cajas de texto.

**Puerta de salida:** `?s=invalid`, `{}`, tema desconocido, archivo con IDs duplicados y falla de cuota conservan el proyecto recuperable. El spike elige un camino canónico de fuentes con resultados documentados. HarfBuzz con contornos es la propuesta preferida, no una dependencia ya aprobada.

Si se eligen contornos, el documento visual usará esos mismos contornos en pantalla y exportación. La accesibilidad y edición de texto siguen en controles HTML. La pérdida de texto seleccionable en SVG se comunica en el diálogo de exportación; JSON sigue siendo el archivo editable.

### B. Dominio v2, historial y almacenamiento de proyectos

- Crear esquema de Documento/Materia/Bloque y validar referencias. Minutos enteros, `0 <= inicio < fin <= 1440`.
- Implementar reducer de comandos e historial acotado, con undo/redo de alta, edición, borrar, importar, ajustes y tema.
- Migración revisable y backup del v1, sin escribir sobre la única copia antigua. No convertir detalles automáticamente a tipos.
- Guardar proyectos y activos de fuentes en IndexedDB, con índice/metadata y preferencias pequeñas separadas. Definir revisión por proyecto, transacciones y comprobación de conflictos entre pestañas.
- Guardado fallido conserva estado en memoria. Un conflicto de pestañas permite revisar y guardar como copia, sin estrategia silenciosa de "última escritura gana".
- Exportar JSON versionado. Un documento que referencia fuentes no cacheadas debe indicar que requiere conexión; proponer después un paquete portable con assets y licencias para reabrir offline en otro equipo.

**Puerta de salida:** migrar fixtures con materias homónimas y colores distintos no cambia sus textos, aulas, notas o minutos. Renombrar/recolorear materia afecta todos sus bloques. Deshacer/rehacer reconstruye exactamente el documento. Recargar recupera varios proyectos. Fallas de cuota y conflicto entre pestañas no destruyen la copia anterior.

### C. Nuevo espacio de trabajo y flujos de archivo

- Empty state con `Crear proyecto`, `Abrir archivo` y recientes.
- Modal crear/ajustar con título, subtítulo, días ordenados, tamaño/formato y rango 24h. Borrador transaccional, errores por campo y Cancelar que realmente cancela.
- Barra Archivo/Editar/Ver/Documento/Tema/Ayuda, nombre del proyecto, estado de guardado y exportar. Menús funcionales con teclado, no pestañas decorativas.
- Biblioteca de materias compacta y buscable. Crear/editar materia en un flujo común, color automático y selector con presets.
- Inspector contextual para materia/bloque. Ajustes de documento y tema tienen sus modales, con previsualización y Aplicar/Cancelar.
- Estado vacío dentro de un proyecto distinto del inicio sin proyecto. Guía breve de elegir materia y colocarla.
- Diseño móvil con hoja de materias/inspector, sin reservar medio viewport permanentemente a formularios. Documento con zoom/desplazamiento y lista alternativa.

**Puerta de salida:** crear proyecto, crear una materia, colocar varias clases con esa materia y editar aula/tipo independientes no pide repetir nombre/color. Toda acción de archivo es accesible por menú y teclado. Cancelar cualquier modal mantiene el documento y sus guardados sin cambios.

Integrar UIArc desde esta entrega para diálogos, selectores, feedback y navegación donde la matriz lo apruebe. No esperar al final para resolver foco, reduced motion y errores.

### D. Escena nueva y exportación fiel

- Construir layout puro: regiones de título, subtítulo, días, grilla, bloques y leyenda, sin dependencia del ancho de pantalla.
- Medir texto con las mismas métricas y glifos que se dibujan. Saltos, grafemas, clipping y elipsis explícitos, con aviso de truncado. Límites mínimos de grilla y composición inválida bloqueada.
- Carriles de solapamiento semiabiertos y deterministas por grupo temporal. Duración visual real, sin inventar 28 unidades de alto.
- `Scene` inmutable con revisión y font hashes. Un serializador SVG canónico para display/export; capa de controles aparte.
- PNG 1x/2x/escala elegida a partir de los mismos bytes SVG. Dimensiones y límites de memoria explícitos. Cancelación/error sin toast de éxito falso.
- Recuperación de importaciones con bloques fuera del rango. No habilitar export hasta resolver sus avisos de contenido omitido.

**Puerta de salida:** los cinco formatos existentes producen cajas finitas y no negativas. SVG offline no necesita fuentes del sistema ni red. PNG usa la revisión mostrada y el mismo texto/geometría. Abrir otra fuente, cambiar padding o tamaño no altera el resultado sólo al descargar. Probar título largo, palabra sin espacios, 100 bloques, leyenda excesiva y fuente fallida.

"Exactamente igual" significa misma composición, contenido, glifos y colores. La rasterización puede tener diferencias de antialias entre dispositivos. Si se necesita igualdad absoluta de píxeles, ofrecer vista de exportación del PNG generado por el mismo rasterizador. No prometer que dos programas ajenos renderizan SVG idéntico a cualquier escala.

### E. Interacción directa del estudio

- Controller con estados de selección/colocación/arrastre/resize, captura de puntero y cancelación.
- Conversión coordenada/minuto mediante transformaciones SVG reales; snap de 30 min y geometría congelada durante gesto.
- Ghost con intervalo y materia visibles; click crea, drag inicial define duración. Bloques existentes se pueden seleccionar sin crear encima accidentalmente.
- Mover conserva duración. Handles superior/inferior y controles ±30 operan los mismos comandos.
- Borrar, duplicar, copiar/pegar internos y clipboard de sistema cuando esté disponible. Payload versionado, IDs nuevos y revisión de vínculo de materia entre proyectos.
- Atajos con scope, composición IME y conflictos de formularios resueltos. Toolbar e inspector hacen accesibles todas las acciones sin atajo.

**Puerta de salida:** un drag de veinte frames crea una entrada de historial; Escape/pointercancel crean cero. Zoom 50/100/200% y scroll no cambian la hora elegida. No hay saltos de duración al borde. Delete dentro de input edita texto; Delete en bloque elimina y undo lo restaura. Copy/paste conserva aula/tipo/notas y comparte materia dentro del proyecto.

### F. Apariencia, fuentes y adopción completa de UIArc

- Modal de apariencia con roles tipográficos, padding, bordes, radios, grilla, colores, visibilidad y leyenda. Mostrar avisos si el contenido no cabe.
- Biblioteca de temas locales: crear, renombrar, duplicar, borrar con recuperación, aplicar y exportar/importar. Snapshot dentro del documento.
- Selector de fuentes Google por búsqueda, muestra y estado de disponibilidad. Cargar familias bajo demanda; presets sólo usan variantes comprobadas. Catálogo amplio después de validar formato y cobertura.
- Presets de color locales y selección de texto con contraste asistido; respetar decisiones del usuario sin recolorear silenciosamente.
- Revisar los destinos de UIArc del inventario. Añadir las oportunidades aprobadas con pruebas de foco, nombre accesible, respuesta al click, coste y reduced motion. No usar animaciones decorativas en el lienzo durante gestos.

**Puerta de salida:** cerrar/reabrir conserva temas y paletas; guardar preset no cambia otros proyectos; Aplicar y undo restauran todos los ajustes. Fuente lenta/fallida no genera archivos con otra fuente. Cada componente UIArc tiene función comprobable y se puede operar con teclado/touch.

### G. Prueba de uso y salida de la reconstrucción

Completar los flujos de [02](02-producto-y-flujos.md) en Chromium, Firefox y Safari; lector de pantalla y teléfono físico. Pedir a usuarios que creen una semana con una materia repetida, cambien una clase, recuperen un borrado y descarguen la composición. Observar si pueden terminar sin explicarles el motor. Priorizar los errores de esa prueba antes de ampliar funciones.

No declarar terminada la reconstrucción mientras exista una pérdida silenciosa de datos, una clase tapada, un campo omitido sin aviso o una diferencia tipográfica entre vista y archivo.

## Cobertura de lo pedido

| Pedido | Entregas | Prueba decisiva |
| --- | --- | --- |
| Nombre/color compartidos por materia | B, C | Recolorear una materia modifica sus cinco bloques; aulas distintas se conservan. |
| Color cómodo y presets | C, F | Crear tres bloques no abre selector de color; preset sobrevive recarga. |
| Horas con componente comunitario | C, E | Entrada 24h, teclado, 24:00 y extremos ±30 concuerdan. |
| Nuevo motor/ghost/selección/resize | D, E | Todos los gestos correctos al cambiar zoom y cancelar. |
| Ctrl Z/Y, Delete, copiar/pegar | B, E | Una transacción por gesto y formularios con atajos nativos. |
| Empty state, proyecto, modal y barra superior | C | Primer uso crea archivo sin rellenar sidebar permanente. |
| Themes locales y Google Fonts | D, F | Proyecto reabierto conserva fuente/padding; asset fallido tiene recuperación. |
| Vista igual a PNG/SVG | A, D, G | Comparación de escena y glifos; apertura SVG offline. |
| Referencia tech-stack-architect | C, E | Usar comandos/paneles como patrones; no importar ReactFlow/backend. |
| Uso amplio y selectivo de UIArc | C, E, F | Matriz completa y destinos con función, foco y coste comprobados. |

## Qué conservar y qué reemplazar

Conservar el stack, utilidades genéricas como descarga de Blob y estilos/primitivas que superen revisión. Mantener el formato de intercambio v1 sólo en su importador. Reutilizar conceptualmente menús, proyectos, comandos y paneles del otro estudio después de revisar sus puntos débiles detallados en [02](02-producto-y-flujos.md).

Reemplazar `ScheduleItem`, la sanitización correctiva, `useScheduleStudio` como estado único, `computeLayout`, medición aproximada, render de bloques, leyenda y pipeline de fuentes/export. El motor viejo sirve como fixture para entender archivos antiguos, no como base geométrica del nuevo.

`PLAN.md` sigue describiendo la versión vieja y promete cosas que hoy no existen, como descarga SVG. Durante implementación se debe actualizar junto con el esquema y README; este plan no cambia de forma anticipada un contrato de datos aún vigente.

## Riesgos que condicionan el orden

La dependencia de shaping y fuentes puede ser más costosa que el resto del editor; por eso se verifica antes. El otro estudio tiene un bundle grande y no debe trasladarse entero. UIArc distribuye código editable, cuya apariencia no demuestra accesibilidad; el time picker requiere corregir o verificar su modelo de foco. La persistencia del navegador puede fallar o perderse por limpieza del perfil; el producto debe ofrecer backup, sin presentarse como almacenamiento permanente garantizado.

Presupuestos iniciales a medir: interacción de 100 bloques con trabajo por frame p95 bajo 16 ms, PNG 2x bajo 2 segundos una vez preparadas las fuentes, y límites de rasterización de 16 megapíxeles/8192 por lado. Son objetivos propuestos para la máquina de referencia que se registre, no resultados actuales ni límites universales del navegador.
