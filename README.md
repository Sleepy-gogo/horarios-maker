# Horario Studio

Estudio en el navegador para armar, diseñar y exportar horarios de cursada semanales. Funciona sin servidor: los proyectos se guardan en el propio navegador (IndexedDB) y se comparten como archivos JSON.

## Qué hace

- **Proyectos locales.** Podés tener varios proyectos con autoguardado, papelera de 7 días, duplicado y descarga individual o de una copia completa. Si el guardado falla, la app lo avisa y no cambia de proyecto en silencio.
- **Materias y clases.** Cada materia tiene un nombre y colores compartidos. Cada clase es un bloque con día, horario en pasos de 30 minutos, aula, tipo y notas. Las clases superpuestas se reparten en carriles y se marcan como conflicto.
- **Edición en la grilla.**
  - Al pasar el cursor aparece un fantasma de la clase. Colocás con clic o arrastre, y movés o redimensionás con asas.
  - Cada gesto se puede cancelar con Escape y deja una sola entrada en el historial.
  - Todo tiene alternativa sin mouse: flechas, formulario y paleta de comandos.
- **Historial.** Deshacer y rehacer con nombre, hasta 100 pasos. Los arrastres de color cuentan como un solo paso.
- **Horas vacías.** En Documento → Ajustes, «Compactar horas vacías» reduce las horas sin clases en los días visibles y reparte ese espacio entre las horas ocupadas. Es opcional, se guarda por proyecto y también se aplica al SVG y PNG. La escala queda fija durante cada gesto de edición.
- **Apariencia.**
  - Temas incluidos y temas propios persistentes, que se pueden importar y exportar.
  - Paletas de colores, tipografía por rol y fuentes de Google Fonts con manejo de errores.
  - Opciones de grilla, bloques, leyenda y página.
- **Exportación fiel.**
  - El lienzo, el SVG y el PNG salen del mismo SVG. El texto va convertido en contornos de glifos medidos con HarfBuzz.
  - El fantasma, las asas y la selección nunca se exportan.
  - Si una fuente no cargó, la exportación se bloquea con opciones para resolverlo, en lugar de cambiarla por otra en silencio.
- **Migración e importación.** El horario de la versión anterior y los enlaces viejos `?s=…` se importan como proyectos nuevos, y los originales quedan intactos. Los archivos importados se validan y se previsualizan antes de confirmarlos.
- **Interfaz.**
  - Toda en español, sin blur, navegable con teclado y con anuncios para lectores de pantalla.
  - Se adapta al ancho:
    - **Escritorio (≥ 1180 px):** tres columnas.
    - **Tablet:** biblioteca y hoja de propiedades.
    - **Teléfono:** hojas inferiores y barra de paneles.

## Desarrollo

Requiere [Bun](https://bun.sh).

```sh
bun install
bun run dev      # servidor de desarrollo
bun run build    # chequeo de tipos + build de producción en dist/
bun run lint
bun run test     # escala temporal, composición real y compatibilidad de archivos
```

El build es estático: `dist/` se puede publicar en cualquier hosting de archivos.

## Stack

- **Base:** React 19, TypeScript, Vite 8 y React Compiler.
- **Estilos y componentes:** Tailwind CSS v4, componentes Arc (Radix + motion) y algunas bases de shadcn.
- **Estado y datos:** zustand para el estado, zod para validar los archivos e `idb` para IndexedDB.
- **Texto:** `harfbuzzjs` para dar forma al texto y extraer los contornos de los glifos.
- **Fuentes:** las fuentes incluidas viven en `public/fonts` (licencia OFL). El catálogo de Google se consulta a Fontsource cuando hace falta.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `src/domain` | Modelo v2, validación, presets de temas, colores, tiempo, archivos y migración v1. |
| `src/engine` | Composición de la escena, medición de texto, carriles, SVG y PNG. |
| `src/fonts` | Catálogo y carga de fuentes, con caché en IndexedDB. |
| `src/storage` | IndexedDB: proyectos, temas, preferencias, fuentes y originales legados. |
| `src/state` | Sesión, historial y autoguardado (`studio`), estado del editor y avisos. |
| `src/ui` | Barra superior, lienzo y gestos, paneles, diálogos y atajos. |
| `src/components/arc` | Componentes Arc adaptados. |

Las decisiones y el contrato de datos están en [PLAN.md](PLAN.md). Los documentos de diseño y la auditoría previa están en [docs/](docs/README.md).
