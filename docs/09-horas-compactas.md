# Horas vacías compactas

Documento → Ajustes → «Compactar horas vacías» reduce las horas sin clases en ningún día visible. La opción pertenece al proyecto, no al tema. Los documentos nuevos y los archivos v2 anteriores mantienen la escala uniforme. Una importación v1 conserva la opción explícita `compactMode: "optimizado"`.

## Composición y edición

Cada hora ocupada tiene peso 1; cada hora vacía, 0,42. Una clase que ocupa sólo parte de una hora protege la hora completa. El espacio ganado se reparte en las horas ocupadas y la grilla conserva su altura total. La compresión se suaviza cuando hace falta espacio entre las etiquetas horarias, incluyendo un comienzo parcial del rango. Si la grilla ya es demasiado baja para ese espacio, se conserva la escala uniforme.

`SceneGrid.timeScale` contiene segmentos horarios acumulados. `minuteToY` y `yToMinute` usan esos mismos segmentos para dibujar líneas, franjas, clases, fantasmas y controles. La conversión inversa elimina el error numérico cerca de minutos enteros para que un clic sobre una línea no caiga en el intervalo anterior. Las clases fuera de rango o en días ocultos conservan su diagnóstico y no alteran la escala.

Los gestos guardan grilla, zoom y origen al comenzar. El borrador no modifica las horas ocupadas. La escala se recalcula al confirmar. Escape, cancelación del puntero, cambio de documento, zoom, tamaño de ventana, pérdida de foco o desplazamiento cancelan el gesto sin guardar un bloque ni agregar historial.

## Verificación

- `bun run test`: 18 pruebas de escala, composición real con HarfBuzz y compatibilidad de archivos. Incluyen inversión en rangos parciales, 00:00–24:00, superposiciones, etiquetas, medios horarios exactos, valores inválidos y regreso al mismo SVG al desactivar la opción.
- `npm run lint` y `npm run build`: aprobados. El build conserva el aviso existente de HarfBuzz sobre el módulo de Node externalizado; el motor funciona en la prueba de producción.
- Navegador Chromium, escritorio 1440 × 1000 y teléfono 390 × 844: 26 comprobaciones de eventos por tamaño. Movimiento, ambos bordes de resize, creación, cancelaciones, deshacer/rehacer, estabilidad de escala y candidato táctil.
- Arrastres reales con mouse: mover una clase de martes 10:00–12:00 a jueves 13:00–15:00, extender su final a 13:30 y crear una clase de viernes 12:00–14:00 en la franja vacía. Una entrada de historial por gesto; deshacer restaura la composición.
- Ajustes: vista previa antes de aplicar, cancelación sin cambios, guardado y recuperación después de recargar. El control móvil es alcanzable y no produce desbordamiento horizontal.
- Build servido con `vite preview`: importación del fixture mediante el selector de archivo, compresión activada/desactivada, guardado, recarga y descargas PNG/SVG por la interfaz.
- El PNG descargado mide 2160 × 2160 px. Los archivos PNG y SVG de desarrollo y producción son idénticos por SHA-256. La estructura SVG coincide con la del lienzo.

La prueba de backup encontró y corrigió un error previo: `readImport` trataba cualquier archivo con `schemaVersion: 2` como proyecto antes de mirar su formato, por lo que rechazaba las copias de seguridad.

## Repetir las comprobaciones de navegador

1. Ejecutar `bun run dev` y abrir una sesión de prueba. Recargar la página para empezar sin versiones de módulos acumuladas por HMR.
2. Importar [el fixture](../tests/fixtures/compact.horario.json) como proyecto nuevo. Contiene el horario del ejemplo con compresión activada y clases de prueba.
3. Esperar a que aparezca el lienzo y ejecutar en DevTools:

```js
await (await import('/tests/browser-checks.mjs')).runBrowserChecks()
```

La función se limita al fixture, devuelve 26 comprobaciones y restaura su documento antes de guardarlo. Los eventos programáticos complementan los arrastres reales realizados en la verificación.

La prueba móvil usa un viewport de Chromium y eventos táctiles programáticos. No constituye una prueba en hardware iOS o Android ni una verificación de todos los navegadores.

## Evidencia

[PNG de producción](evidence/09-compact.png) · [SVG de producción](evidence/09-compact.svg)
