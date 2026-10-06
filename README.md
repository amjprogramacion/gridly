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
npm test        # Ejecutar las catorce suites del modelo
npm run build   # Comprobar TypeScript y generar dist/
npm run preview # Revisar la compilación local
```

Los comandos funcionan en Windows, macOS y Linux. `package-lock.json` debe mantenerse en el repositorio para instalar las mismas dependencias en otro equipo.

## Funcionalidades

- Habitación rectangular con medidas interiores, altura, grosor y paredes activables. Las paredes próximas a la cámara se ocultan para ver el interior.
- Prismas, puertas, ventanas, columnas y vigas con posición, dimensiones y nombre editables. Color individual para prismas y marcos; color común para paredes, vigas y columnas.
- Puertas y ventanas vinculadas a paredes, con huecos reales y alféizar editable en ventanas.
- Snap a cuadrícula y a paredes, suelo y altura de la habitación.
- Colisiones entre elementos con interruptor general y por pieza para prismas, puertas y ventanas; vigas y columnas con colisiones obligatorias contra otros tipos, permitiendo solaparse entre sí.
- Colisiones que impiden atravesar paredes y el techo virtual incluso con movimientos rápidos o Snap desactivado.
- Rotación XYZ con tamaño adaptable al espacio disponible entre paredes y bajo el techo.
- Contorno de selección, tiradores de tamaño, cotas flotantes editables, desplazamiento y elevación.
- Iconos de giro pegados a las caras. El aro correspondiente aparece al pasar el cursor, enfocar el control o arrastrarlo.
- Selección múltiple con Ctrl/Mayús, agrupación y desagrupación de piezas libres, con movimiento, giro y escala comunes.
- Duplicado, eliminación, deshacer/rehacer e importación/exportación de proyectos JSON.

## Uso

Pulsa **Editar estancia** en la barra inferior para editar Anchura, Profundidad y Altura de la habitación y mostrar en la barra lateral los botones de Puerta, Ventana, Columna, Viga y **Rodapié**. Todas las medidas están en milímetros. X y Z indican el centro horizontal; Y indica el punto más bajo del objeto, también cuando está girado.

El rodapié es un acabado blanco de 80 × 12 mm que recorre todas las paredes activas, incluso las ocultas por cámara, y respeta los huecos de las puertas. Se adapta a las medidas de la estancia y se guarda con el proyecto. El mismo botón permite quitarlo. Es decorativo y no añade colisiones.

El techo virtual está a la altura de las paredes y limita la parte superior de las piezas, también si están giradas o las paredes están desactivadas. Al reducir la altura de la habitación, las piezas se bajan si caben; si son demasiado altas, se rechaza el cambio. El techo no se dibuja y no oculta la escena.

**Colisiones** (su casilla general está temporalmente oculta), cambia a la vez el ajuste de prismas, puertas y ventanas. Vigas y columnas pueden solaparse entre sí, pero siempre colisionan con los demás tipos, incluso si esas piezas tienen las colisiones desactivadas. No muestran ajustes individuales de colisión ni de color. **Colisiones de este elemento**, en sus propiedades, modifica solo esa pieza: si está desactivado, puede atravesar y ser atravesada por otros elementos opcionales, mientras las piezas activas siguen colisionando entre sí. El general muestra un estado mixto cuando hay excepciones; pulsarlo en ese estado desactiva todas y pulsarlo de nuevo las activa todas. Los cambios generales también definen el ajuste de las piezas que añadas después. Paredes y techo siguen activos, y todos los ajustes se guardan con el proyecto. Los proyectos anteriores se convierten conservando los ajustes opcionales; las vigas y columnas se fuerzan a colisionar. Si la escena contiene solapamientos entre ellas y otros tipos, se rechaza la carga y se conserva la copia local.

Con las colisiones activas, los movimientos se detienen al contactar y permiten deslizarse por los ejes libres. Los tiradores de tamaño se limitan al contacto; las medidas y giros que provocarían un solapamiento se rechazan. Añadir y duplicar buscan una posición cercana libre. Si ya hay piezas solapadas, sepáralas o excluye una antes de activar las colisiones. Puertas y ventanas de paredes desactivadas no bloquean a otros elementos.

El icono de muestras de la barra inferior abre una paleta para la pieza seleccionada; con la habitación, vigas o columnas seleccionadas cambia el color común de la estructura. En la paleta de la estructura puedes elegir **Paredes** o **Suelo** para cambiar sus colores por separado. El suelo se muestra continuo, sin líneas de cuadrícula. La muestra tachada restaura el color original.

La paleta inferior cambia en bloque el color de paredes, vigas y columnas al seleccionar la estructura; el panel derecho no muestra ese selector. Comparten siempre ese color, independientemente del snap, desde su creación o importación. El ajuste se guarda con el proyecto y admite deshacer/rehacer. Los archivos anteriores sin este ajuste usan `#526171`.

Los cuadrados cambian el tamaño manteniendo fija la cara opuesta. El control de base mueve la pieza sobre un plano horizontal y el triángulo la eleva. Escribe en una cota flotante y confirma con Enter o al salir del campo. El panel derecho se abre únicamente con **Editar estancia** y muestra esas tres medidas de la habitación. Las piezas conservan sus cotas y controles en el visor.

Los controles de giro son flechas curvas de doble punta, sin recuadro, orientadas según su plano de rotación. X aparece sobre un extremo superior, Z sobre el centro del borde superior y Y junto a la esquina cercana de la base. Las flechas son grises y muestran el color del eje al pasar el cursor; sus curvas mantienen la orientación de su plano al orbitar. Arrastra siguiendo la dirección del aro para girar. Durante una misma operación, la pieza reduce su tamaño si lo necesita y lo recupera cuando vuelve a caber, hasta las medidas iniciales de esa operación.

Con Snap activo, los arrastres usan un paso fijo de 50 mm y los giros pasos de 15°. El snap a paredes utiliza un umbral de 60 mm y tiene prioridad sobre la cuadrícula. La cuadrícula visible tiene divisiones de 500 mm. Los cambios numéricos de posición aplican snap a superficies al confirmar; las cotas numéricas no se redondean a la cuadrícula.

| Acción | Atajo |
| --- | --- |
| Deshacer | Ctrl/Cmd + Z |
| Rehacer | Ctrl/Cmd + Mayús + Z |
| Duplicar | Ctrl/Cmd + D |
| Eliminar selección | Supr |
| Deseleccionar | Escape |
| Modo mover / rotar | W / R |

Para la cámara: arrastra para orbitar, usa el botón derecho para desplazar y la rueda para zoom. Los controles flotantes, cotas y contorno de selección se ocultan mientras se mueve la cámara, incluida la inercia, y reaparecen al detenerse. El selector de vista ofrece perspectiva, superior, frontal y lateral.

## Agrupar elementos

Selecciona varias piezas con **Ctrl/Cmd o Mayús + clic**, en la lista o en el visor, y pulsa **Agrupar**. Cada pieza seleccionada muestra su contorno cian para identificar la selección. Aparecen como un único elemento en la escena, conservando sus formas y colores. Puedes moverlo, elevarlo, girarlo, duplicarlo o eliminarlo como cualquier pieza. **Desagrupar** recupera los componentes en su posición, tamaño y orientación actuales. También puedes agrupar grupos.

El tamaño del grupo cambia proporcionalmente en los tres ejes; conserva la forma de sus piezas. Los giros conservan el tamaño y se rechazan si el grupo no cabe. Las colisiones y el snap utilizan la envolvente del grupo, incluidos los espacios entre componentes. Si esa envolvente invade otro elemento activo, hay que incluirlo en la selección o separarlo antes de agrupar. Los grupos con vigas o columnas mantienen colisiones obligatorias y el color común de sus piezas estructurales. Desagrupar restaura los ajustes individuales de colisión; si provoca solapamientos activos, se rechaza la operación. Puertas y ventanas no se agrupan porque dependen de una pared.

## Guardar y continuar desde otro equipo

Pulsa el nombre de la barra superior para editarlo y guarda con el icono de disquete (o Enter). El nombre se conserva con el autoguardado y el JSON.

Usa **Descargar proyecto** para exportar la escena a JSON y **Abrir** para recuperarla en el otro dispositivo. El formato actual es versión 6 y admite archivos de versiones 1–6.

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
| `src/collisions.ts`, `src/objectCollisions.ts`, `src/snapping.ts` | Colisiones de habitación y elementos, y snap |
| `src/rotationFit.ts`, `src/faceResize.ts` | Giro adaptable y redimensionado |
| `src/walls.ts` | Paredes y huecos |
| `tests/` | Pruebas de regresión del modelo |

## Límites actuales

No se incluyen snap entre objetos libres, importación STL, paredes irregulares ni apertura de hojas de puertas. Puertas y ventanas conservan la orientación de su pared. Los movimientos usan envolventes conservadoras para piezas giradas; las comprobaciones estáticas distinguen cajas orientadas que solo se tocan.

Los controles y cotas pueden necesitar ajustes adicionales en piezas muy pequeñas o vistas extremas. Vite muestra un aviso por el tamaño del bundle de Three.js; la compilación termina correctamente.

`node_modules/`, `dist/`, capturas de comprobación y archivos locales están excluidos mediante `.gitignore`.
