# Generador de horarios

Editor de horarios semanales con materias, clases, temas y exportación PNG/SVG. Los proyectos se guardan en IndexedDB, dentro del navegador. Se pueden importar y compartir como archivos JSON.

## Desarrollo

Requiere Bun.

```sh
bun install
bun run dev
bun run test
bun run lint
bun run build
bun run preview
```

`build` comprueba TypeScript y genera el sitio estático en `dist/`.

## Uso

- Creá materias y colocá clases en la grilla. Podés moverlas, redimensionarlas o editar sus horarios con el formulario.
- Deshacé o rehacé cambios desde Editar o con Ctrl+Z / Ctrl+Shift+Z (⌘ en macOS).
- Documento → Compactar horas vacías reduce las franjas sin clases. La opción también está en Ajustes y se guarda por proyecto.
- Tema permite cambiar colores y fuentes, y guardar apariencias propias.
- Exportar descarga PNG, SVG o el proyecto editable. Archivo permite descargar una copia de todos los proyectos.

## Código y pruebas

`src/domain` contiene el modelo y la validación; `src/engine`, la composición y exportación; `src/state` y `src/storage`, el historial y la persistencia; `src/ui`, la interfaz. Las fuentes incluidas y sus licencias están en `public/fonts`.

Las pruebas de `bun run test` cubren la escala horaria, la composición con HarfBuzz, los archivos y la migración. Para comprobar gestos en desarrollo, importá `tests/fixtures/compact.horario.json` y ejecutá en DevTools:

```js
await (await import('/tests/browser-checks.mjs')).runBrowserChecks()
```

El lienzo y las descargas usan el mismo SVG. La exportación espera a que carguen las fuentes; el texto se convierte en contornos con HarfBuzz.
