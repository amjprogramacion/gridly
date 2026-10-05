# Gridly

Editor 3D de habitaciones con medidas editables, puertas, ventanas, columnas y vigas. Desarrollado con Vue 3, TypeScript y Three.js, con interfaz oscura y controles directamente sobre las piezas.

## Empezar

Requiere **Node.js 24** y npm. Después de clonar el repositorio:

```sh
npm ci
npm run dev
```

Abre la dirección que muestra Vite en la terminal. El servidor de desarrollo escucha en `127.0.0.1`.

```sh
npm test        # Ejecutar las ocho suites del modelo
npm run build   # Comprobar TypeScript y generar dist/
npm run preview # Revisar la compilación local
```

Los comandos funcionan en Windows, macOS y Linux. `package-lock.json` debe mantenerse en el repositorio para instalar las mismas dependencias en otro equipo.

## Funcionalidades

- Habitación rectangular con medidas interiores, altura, grosor y paredes activables. Las paredes próximas a la cámara se ocultan para ver el interior.
- Prismas, puertas, ventanas, columnas y vigas con posición, dimensiones, nombre y color editables.
- Puertas y ventanas vinculadas a paredes, con huecos reales y alféizar editable en ventanas.
- Snap a cuadrícula y a paredes, suelo y altura de la habitación.
- Colisiones que impiden atravesar paredes incluso con movimientos rápidos o Snap desactivado.
- Rotación XYZ con tamaño adaptable al espacio disponible entre paredes.
- Contorno de selección, tiradores de tamaño, cotas flotantes editables, desplazamiento y elevación.
- Iconos de giro pegados a las caras. El aro correspondiente aparece al pasar el cursor, enfocar el control o arrastrarlo.
- Duplicado, eliminación, deshacer/rehacer e importación/exportación de proyectos JSON.

## Uso

Selecciona **Habitación** para definir el espacio y añade piezas desde la barra lateral. Todas las medidas están en milímetros. X y Z indican el centro horizontal; Y indica el punto más bajo del objeto, también cuando está girado.

Los cuadrados cambian el tamaño manteniendo fija la cara opuesta. El control de base mueve la pieza sobre un plano horizontal y el triángulo la eleva. Escribe en una cota flotante y confirma con Enter o al salir del campo. El panel lateral permite introducir medidas y ángulos exactos.

Los iconos X, Y y Z se sitúan respectivamente en la cara lateral, superior y frontal. Arrastra siguiendo la dirección del aro para girar. Durante una misma operación, la pieza reduce su tamaño si lo necesita y lo recupera cuando vuelve a caber, hasta las medidas iniciales de esa operación.

Con Snap activo, los arrastres usan el paso seleccionado y los giros pasos de 15°. El snap a paredes utiliza un umbral de 60 mm y tiene prioridad sobre la cuadrícula. La cuadrícula visible tiene divisiones de 500 mm. Los cambios numéricos de posición aplican snap a superficies al confirmar; las cotas numéricas no se redondean a la cuadrícula.

| Acción | Atajo |
| --- | --- |
| Deshacer | Ctrl/Cmd + Z |
| Rehacer | Ctrl/Cmd + Mayús + Z |
| Duplicar | Ctrl/Cmd + D |
| Eliminar selección | Supr |
| Deseleccionar | Escape |
| Modo mover / rotar | W / R |

Para la cámara: arrastra para orbitar, usa el botón derecho para desplazar y la rueda para zoom. El selector de vista ofrece perspectiva, superior, frontal y lateral.

## Guardar y continuar desde otro equipo

Usa **Guardar proyecto** para exportar la escena a JSON y **Abrir** para recuperarla en el otro dispositivo. El formato actual es versión 4 y admite archivos de versiones 1–4.

La habitación y sus objetos se autoguardan con cada modificación en el almacenamiento local del navegador y se recuperan al recargar o volver a abrir Gridly en la misma dirección. Se incluyen arrastres, deshacer/rehacer y proyectos importados. Si el almacenamiento falla, aparece un aviso para guardar el JSON manualmente.

El autoguardado conserva la última escena; no conserva el historial de deshacer ni sincroniza entre dispositivos o navegadores. Subir el código a GitHub no transfiere esa escena. Usa el JSON para trasladarla y conserva una copia si borras los datos del navegador.

Para retomar el desarrollo con Codex, abre el repositorio clonado y pide que lea [AGENTS.md](AGENTS.md) y [el contexto del proyecto](docs/PROJECT_CONTEXT.md). Ambos archivos están versionados y recogen las convenciones, preferencias y estado actual.

## Estructura

| Archivo | Responsabilidad |
| --- | --- |
| `src/editor.ts` | Estado, mutaciones, historial y proyectos JSON |
| `src/Viewport.vue` | Escena y renderizado de Three.js |
| `src/useObjectControls.ts` | Controles flotantes y arrastres |
| `src/App.vue`, `src/style.css` | Interfaz y estilos |
| `src/geometry.ts` | Envolventes y rotación |
| `src/collisions.ts`, `src/snapping.ts` | Colisiones y snap |
| `src/rotationFit.ts`, `src/faceResize.ts` | Giro adaptable y redimensionado |
| `src/walls.ts` | Paredes y huecos |
| `tests/` | Pruebas de regresión del modelo |

## Límites actuales

No se incluyen colisiones ni snap entre objetos libres, agrupación, importación STL, paredes irregulares, techo de colisión ni apertura de hojas de puertas. Puertas y ventanas conservan la orientación de su pared. Las colisiones usan envolventes conservadoras para piezas giradas.

Los controles y cotas pueden necesitar ajustes adicionales en piezas muy pequeñas o vistas extremas. Vite muestra un aviso por el tamaño del bundle de Three.js; la compilación termina correctamente.

`node_modules/`, `dist/`, capturas de comprobación y archivos locales están excluidos mediante `.gitignore`.
