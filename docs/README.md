# Reconstrucción de Horario Studio

Auditoría y propuesta del 13 de octubre de 2026. Se revisó el código real, se probaron flujos en un navegador aislado, se inspeccionó `tech-stack-architect` y se evaluó todo el catálogo gratuito de UIArc. Participaron cuatro subagentes Sol 6.1 High. Este trabajo agrega documentación y evidencia; no implementa cambios en la aplicación.

## Recomendación

Reconstruir el modelo, el motor y la interacción, manteniendo React/TypeScript/Vite y el formato de horario semanal. La materia será una entidad con nombre y colores compartidos. Cada clase será un bloque con día, horas, aula, tipo y notas. La biblioteca de materias y el lienzo pasan a ser el flujo principal; los ajustes de archivo y apariencia se trasladan a modales de la barra superior.

El requisito central del motor es una composición única para vista, SVG y PNG, con fuentes controladas y medidas reales de texto. Elegir SVG con contornos tipográficos es la propuesta preferida; antes de adoptarla hay que comprobar carga, compatibilidad y tamaño frente a fuentes embebidas. No basta con serializar el SVG actual.

## Qué se encontró

- Un enlace inválido puede borrar el único horario guardado y anunciar una carga exitosa.
- Un tema desconocido en un JSON hace caer el render. Una falla de almacenamiento también deja la interfaz vacía.
- Dos bloques superpuestos se tapan. Un bloque fuera del rango se dibuja en una hora falsa junto al borde.
- El PNG cambia las fuentes aun cuando la página ya las cargó. Se guardó una comparación real de vista, SVG y descarga.
- No hay historial de documento, selección de bloques ni edición desde el lienzo. La escritura corrige valores antes de que el usuario termine.
- La interfaz pierde legibilidad y corta contenido en pantallas pequeñas. Hay controles sin nombre accesible.

Build y lint del proyecto pasan. Eso no detecta estas fallas de uso y representación. Los avisos de seguridad de dependencias se documentaron distinguiendo producción, servidor de desarrollo y herramientas CLI.

## Cómo leer el trabajo

| Documento | Contenido |
| --- | --- |
| [01 · Auditoría de código](01-auditoria-codigo.md) | 18 hallazgos priorizados, referencias de archivo/línea, validaciones, persistencia, deuda y dependencias. |
| [02 · Producto y flujos](02-producto-y-flujos.md) | Especificación de proyectos, materias, bloques, gestos, menús, shortcuts, móvil y casos difíciles; referencia del otro estudio. |
| [03 · Motor y exportación](03-motor-y-exportacion.md) | Arquitectura de escena, composición, texto/fuentes, carriles, comandos, alternativas y ensayos técnicos pendientes. |
| [04 · Pruebas de uso](04-pruebas-de-uso.md) | 19 casos, resultados, capturas, diferencias de exportación, script reproducible y límites de cobertura. |
| [05 · UIArc](05-uiarc-componentes.md) | Las 132 piezas gratuitas, destino y motivo por componente, dependencias, licencia y condiciones de accesibilidad. |
| [06 · Plan de implementación](06-plan-de-implementacion.md) | Decisiones integradas, entregas con dependencias y puertas de aceptación, cobertura de todos los pedidos. |
| [Resumen visual](resumen-visual.html) | Prioridades, comparación gráfica, esquema del estudio y secuencia de entregas. |
| [07 · Preparación y encargo para Opus](07-preparacion-y-encargo-opus.md) | Componentes, tokens, fuentes y dependencias preparados; instrucciones actualizadas para implementar con autonomía y revisión visual. |

El documento 06 fija las decisiones integradas. El 01 explica el estado actual y las severidades de incidentes; el 02 describe comportamiento objetivo; el 03 traduce ese comportamiento a arquitectura. Las prioridades P0/P1 dentro de las especificaciones describen requisitos del nuevo producto, no sólo severidad de bugs existentes.

## UIArc con propósito

El catálogo oficial revisado tiene 110 componentes y 22 bloques gratuitos. La matriz propone 38 decisiones de incluir/conservar/adaptar, 41 de postergar y 53 de descartar. No significa instalar 38 componentes nuevos: se conservan las bases locales equivalentes.

Las incorporaciones principales son Dialog, Color picker con presets, Time picker adaptado, Command palette, Action button, Split button, Copy button, Inline edit, Radio cards, Resizable panels y un inspector móvil Drawer/Bottom sheet. La lista completa explica oportunidades y exclusiones. El Time picker requiere corregir/verificar la opción activa y el foco accesible antes de adoptarlo. [Catálogo oficial](https://uiarc.dev/r/catalog.json).

## Primera entrega recomendada

Proteger el documento ante errores de carga/importación/guardado y ejecutar el ensayo de fuentes/exportación. Después implementar dominio v2 e historial, espacio de trabajo, escena nueva, gestos y personalización. UIArc se integra en los flujos concretos a medida que existen, con tokens, foco y movimiento consistentes.

Las decisiones de uso necesarias quedaron resueltas y documentadas. Los asuntos pendientes son comprobaciones técnicas, no preguntas que bloqueen el plan. La auditoría no afirma haber probado todas las combinaciones ni todos los navegadores: Chromium fue el entorno ejecutado; Safari/Firefox, lectores de pantalla y teléfono físico quedan como aceptación de la implementación.
