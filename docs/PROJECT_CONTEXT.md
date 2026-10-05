# Contexto del proyecto

Estado al 5 de octubre de 2026. Este archivo y `AGENTS.md` son la memoria portátil del proyecto; no dependen de una conversación compartida ni de rutas del equipo anterior.

## Objetivo y estado

Gridly es un editor web de habitaciones y elementos constructivos en 3D. Funciona íntegramente en el navegador, con interfaz oscura. La interfaz indica MVP 08. No tiene backend, cuentas ni sincronización. Dispone de autoguardado local de la última escena en el navegador.

## Comportamiento acordado

- Primero se define una habitación rectangular. Escena inicial: interior de 4000 × 3500 mm, paredes de 2500 mm y grosor de 120 mm. Cada pared se puede desactivar. Las paredes próximas a la cámara se ocultan para ver el interior, pero siguen participando en las colisiones.
- Se pueden añadir prismas, puertas, ventanas, columnas y vigas. Admiten medidas, posición, nombre, color, duplicado, eliminación e historial.
- Puertas y ventanas están vinculadas a una pared y generan huecos reales. Conservan la orientación de esa pared. Las puertas parten del suelo; las ventanas tienen alféizar editable. Una pared desactivada oculta sus elementos sin borrarlos.
- Snap de cuadrícula configurable y snap a paredes, suelo y altura de pared con umbral de 60 mm. El contacto con paredes prevalece sobre la cuadrícula. No existe snap entre objetos libres.
- Las paredes bloquean el desplazamiento incluso con Snap desactivado. La comprobación incluye todo el recorrido para evitar atravesarlas con movimientos rápidos. Se permite deslizarse por los ejes libres. Puertas y ventanas pueden ocupar su pared, pero no atravesar otras.
- Prismas, columnas y vigas giran en XYZ. Durante el giro se permite cualquier ángulo y el tamaño se adapta al máximo disponible entre paredes. Se conserva el grosor/altura si es posible; en situaciones extremas también se adaptan otras medidas. Dentro de la misma operación recuperan tamaño hasta la referencia tomada al comenzar. Un giro y sus cambios de tamaño se deshacen juntos.

## Preferencias visuales e interacción actuales

El usuario pidió controles inspirados en Tinkercad, pegados a la pieza:

- Contorno cian, seis tiradores cuadrados de tamaño, cotas flotantes editables en mm, control de desplazamiento y triángulo de elevación.
- Al redimensionar desde una cara, la opuesta permanece fija. El arrastre aplica el paso de Snap y se limita ante suelo/paredes. Las cotas numéricas se confirman con Enter o al perder el foco.
- Las cotas deben estar por encima de tiradores, iconos y líneas. Se recolocan para evitar solapamientos; su borrador de edición no debe ser sobrescrito por el refresco del visor.
- Los iconos de giro están anclados a las caras locales: X en la lateral positiva, Y en la superior, Z en la frontal positiva. Están desplazados dentro de la cara respecto al tirador de tamaño. Su posición se proyecta con la cámara, pero no se busca una nueva ubicación según la vista.
- Los aros están ocultos normalmente. Solo se muestra el correspondiente al icono bajo el cursor o enfocado con teclado; permanece visible durante el arrastre.
- No volver a una fila de botones XYZ sobre el objeto, ni a mostrar los tres aros permanentemente, ni a colocar los iconos en puntos del aro virtual.
- El arrastre del giro sigue una tangente proyectada, capturada al comenzar. Snap gira en pasos de 15°; los ángulos del panel admiten valores exactos.

## Convenciones y arquitectura

- Modelo en milímetros; Three.js usa metros. X/Z son el centro horizontal; Y es el punto más bajo de la envolvente mundial, incluso cuando el objeto está girado.
- Rotaciones en grados y orden Euler XYZ. `worldDimensions` calcula la envolvente alineada a los ejes mundiales usando la matriz de rotación absoluta.
- Los objetos libres se renderizan con geometría centrada y centro mundial en `y + worldHeight/2`. Los marcos tienen origen local en la base.
- `editor.ts` expone estado reactivo, selección computada y funciones de mutación. El historial conserva instantáneas JSON. Las operaciones de arrastre crean un único checkpoint.
- `Viewport.vue` mantiene grupos de Three.js estables cuando cambian las dimensiones, reconstruyendo solo sus hijos. Esto evita interrumpir un arrastre mientras el tamaño se adapta.
- `useObjectControls.ts` proyecta el overlay cada frame y usa captura de puntero. Desactiva OrbitControls mientras se manipula un objeto. Queda código de TransformControls en el visor, pero su helper está oculto y el control desactivado; la interacción vigente es el overlay.
- `rotationFit.ts` conserva las dimensiones de referencia durante la operación y adapta hasta un mínimo de 0,001 mm. Las medidas manuales tienen mínimo de 1 mm.
- Cada cambio de habitación u objetos se autoguarda, incluidos los arrastres, deshacer/rehacer e importaciones. Vue agrupa los cambios de una misma operación y `pagehide` fuerza los pendientes al salir. La recuperación inicial usa la misma validación que Abrir, sin crear un checkpoint. Un autoguardado inválido se conserva hasta que se modifique la escena y se muestra un aviso; si falla el almacenamiento, la edición continúa y el aviso indica guardar JSON.
- Exportación JSON versión 4, `units: "mm"`, habitación y objetos. Importación de versiones 1, 2, 3 y 4, con validación y rechazo de proyectos que atraviesan paredes.

## Limitaciones conocidas

- El autoguardado conserva la última escena en `localStorage` bajo `gridly.autosave`, por navegador y origen (dirección/puerto). No sincroniza entre equipos ni conserva el historial, la cámara o las preferencias de interacción. Borrar los datos del navegador borra esta copia; el JSON sigue siendo el medio de traslado y copia manual.
- No hay techo de colisión: un objeto puede pasar por encima de las paredes.
- No hay colisiones entre objetos libres, agrupación, STL, paredes irregulares ni apertura animada de puertas.
- Las colisiones usan envolventes mundiales conservadoras: pueden limitar antes de tiempo en esquinas con piezas giradas.
- Los iconos están vinculados a caras positivas fijas; no se intercambian con la cara opuesta al orbitar. En piezas pequeñas o vistas extremas puede ser necesario seguir refinando la separación de controles.
- El algoritmo de recolocación de cotas es sencillo. Cerca de los bordes del visor o con zoom extremo puede enviar una cota lejos de su línea; hay líneas guía. No considerar resuelta toda combinación de superposiciones sin comprobarla visualmente.
- Vite informa de un bundle superior a 500 kB por Three.js. La compilación termina correctamente; todavía no se ha dividido el bundle.

## Validación y continuación

`npm test` ejecuta las ocho suites: habitación, construcción, snap, colisiones, rotación, giro adaptable, redimensionado desde caras y autoguardado. La suite de autoguardado cubre modificaciones, recuperación, versiones 1–4, datos inválidos, cierre y fallos de almacenamiento. `npm run build` comprueba TypeScript y compila.

Los iconos de giro mantienen su ubicación en las caras y su comportamiento acordado. El autoguardado se comprobó en el navegador modificando la habitación, el nombre y la anchura de un prisma, y verificando su recuperación al recargar. Con Node 24 y `npm ci`, las ocho suites pasaron y `npm run build` terminó correctamente con el aviso conocido del tamaño del bundle.

En el equipo nuevo: leer estos archivos, ejecutar `npm ci`, `npm test`, `npm run build` y `npm run dev`. Retomar desde la siguiente petición del usuario; no hay otra funcionalidad pendiente autorizada ni una migración que ejecutar.

