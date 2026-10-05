# Guía para trabajar en Gridly

Antes de modificar el proyecto, lee `README.md` y `docs/PROJECT_CONTEXT.md`. Este último conserva las decisiones y el estado de la implementación entre equipos y conversaciones.

## Colaboración

- Comunícate en español, con explicaciones breves y concretas.
- El usuario prefiere que implementes las peticiones y compruebes el resultado sin pedir confirmación para cambios locales reversibles.
- Nunca hagas commits. El usuario los realiza; proporciona únicamente un título en inglés cuando lo solicite. Usa los prefijos `feat` (funcionalidades), `fix` (correcciones), `refactor`, `perf` (rendimiento), `docs` (documentación) o `chore` (mantenimiento), según el cambio. `VERSION UP` se excluye del changelog y los demás mensajes se agrupan como Other.
- Mantén las preferencias de interacción descritas en el contexto. No sustituyas controles ni cambies convenciones geométricas incidentalmente.
- Actualiza el contexto cuando cambie una decisión importante, el comportamiento o una limitación conocida. Describe el estado final, no el historial de la conversación.

## Desarrollo y comprobación

- Usa Node.js 24 y `npm ci`. El proyecto es Vue 3, TypeScript, Three.js y Vite.
- Ejecuta `npm run build` y `npm test` para cambios de lógica. Para cambios visuales, comprueba también la escena en el navegador, incluidas las superposiciones y los arrastres afectados.
- Las pruebas son scripts TypeScript con `node:assert/strict`; no requieren un framework adicional.
- Mantén las medidas del modelo en milímetros y convierte a metros solo en el visor.
- Conserva la compatibilidad de importación JSON con versiones 1–4. No cambies la versión del formato por cambios exclusivamente visuales.
- No incluyas `node_modules`, `dist`, capturas de comprobación ni archivos locales de herramientas en el repositorio.
- No añadas servicios, credenciales, despliegues o dependencias sin una necesidad concreta de la tarea.

## Archivos de referencia

- `src/editor.ts`: modelo, historial, importación/exportación y mutaciones.
- `src/Viewport.vue`: escena y renderizado; `src/useObjectControls.ts`: interacción flotante.
- `src/geometry.ts`, `src/collisions.ts`, `src/snapping.ts`, `src/rotationFit.ts`, `src/faceResize.ts`: lógica geométrica.
- `src/walls.ts`: paneles de paredes y huecos.
- `src/App.vue` y `src/style.css`: interfaz y estilos.
