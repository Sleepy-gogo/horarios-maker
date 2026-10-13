# 08 · Implementación v2

Estado al 13 de octubre de 2026. La reconstrucción descrita en 02, 03 y 06 está implementada en `src/`. El contrato vigente (modelo, archivos, almacenamiento, motor y atajos) está en [PLAN.md](../PLAN.md); este documento registra qué se decidió al implementar y en qué se aparta del plan.

## Cobertura de los pedidos

| Pedido | Dónde vive |
| --- | --- |
| Materia con id, nombre y colores compartidos; bloques con aula, tipo y notas | `domain/types.ts`, `domain/document.ts`, `ui/panels/Inspector.tsx` |
| Varios proyectos locales, estado vacío y modal de creación | `storage/projects.ts`, `ui/shell/Welcome.tsx`, `ui/dialogs/ProjectDialog.tsx`, `ProjectsDialog.tsx` |
| Menús Archivo, Editar, Ver, Documento, Tema y Ayuda; biblioteca; inspector contextual | `ui/commands.ts`, `ui/shell/MenuBar.tsx`, `ui/panels/*` |
| Texto medido y carriles de superposición | `engine/text.ts` (HarfBuzz), `engine/layout.ts` (`assignLanes`) |
| Fantasma, colocar, mover y redimensionar con cancelación; alternativas de teclado | `ui/canvas/DocumentCanvas.tsx`, `ui/canvas/gesture.ts`, `ui/shortcuts.ts` |
| Deshacer, rehacer, borrar, duplicar, copiar y pegar; una entrada de historial por gesto | `state/studio.ts` (`commit` con `coalesce`), `state/actions.ts` |
| Paletas guardadas, temas persistentes y Google Fonts con errores controlados | `ui/dialogs/AppearanceDialog.tsx`, `FontPicker.tsx`, `fonts/service.ts` |
| Vista igual al archivo; SVG y PNG de la misma escena; sin elementos de edición; fuentes que fallan no se sustituyen | `engine/render.ts`, `engine/svg.ts`, `engine/export.ts`, `ui/dialogs/ExportDialog.tsx` |
| Autoguardado con recuperación; migración v1 sin sobrescribir; importación segura | `state/studio.ts` (`bootStart`, `saveNow`), `domain/legacy.ts`, `domain/files.ts`, `ui/dialogs/ImportDialog.tsx` |
| Español, sin blur, accesible y responsive | Toda la UI; breakpoints en `hooks/use-media.ts` |

## Decisiones tomadas al implementar

- **Texto como contornos.** Se confirmó la opción preferida en 03: el SVG lleva un `<path>` por glifo, definido una sola vez y reutilizado con `<use>`. El archivo no depende de fuentes instaladas y el PNG rasteriza exactamente ese string. El costo es un SVG más pesado que con texto vivo, algo aceptable para una lámina.
- **Fuentes fallidas.** El lienzo dibuja con DM Sans para no quedar en blanco, pero la escena registra un error `font-unavailable`. Ese error bloquea las tres descargas hasta reintentar, elegir otra fuente o quitarla. Nunca se exporta con la fuente sustituida.
- **Clases fuera del documento.** Siguen en el modelo, aparecen en la pestaña Clases y bloquean la exportación. El diálogo de ajustes ofrece ampliar el rango, volver a incluir los días o eliminarlas.
- **Colocación por toque.** En pantallas táctiles, un toque crea un candidato con una barra para confirmar, mover o cancelar. Así se evita crear clases por accidente al desplazar la vista.
- **Diálogos pesados.** Apariencia, Exportar e Importar se cargan en chunks aparte, después del armazón.
- **Menú en tablet.** Por debajo de 1180 px, la barra de menús pasa a un botón de menú compacto para que el título del documento no quede comprimido.

## Revisión visual realizada

Se revisó en el preview de T3 (Chromium):

| Ancho | Qué se revisó |
| --- | --- |
| Escritorio, 1280 px | Bienvenida, creación, lienzo, apariencia con una fuente de Google y exportación. |
| Tablet, 900×700, modo oscuro | Biblioteca, lienzo, asas y barra inferior. |
| Teléfono, 390×844 | Barra de paneles y hojas de materias y propiedades. |

Problemas encontrados y corregidos en la revisión:

- el indicador "Cargando fuentes" quedaba fijo por la memoización del React Compiler;
- el pie del diálogo de exportar quedaba arriba de todo;
- las pestañas de apariencia se desbordaban;
- había un desborde horizontal de 9 px en la biblioteca;
- el título quedaba comprimido en tablet.

## Pendiente

- Probar en Safari y Firefox, con lectores de pantalla (NVDA, VoiceOver) y en teléfonos físicos.
- Medir el rendimiento con documentos cerca de los límites (600 clases).
- Definir si las piezas Arc preparadas y sin uso se integran (menú contextual en el lienzo, paneles redimensionables) o se eliminan.
