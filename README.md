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
npm test        # Ejecutar las suites del modelo
npm run build   # Comprobar TypeScript y generar dist/
npm run preview # Revisar la compilación local
```

Los comandos funcionan en Windows, macOS y Linux. `package-lock.json` debe mantenerse en el repositorio para instalar las mismas dependencias en otro equipo.

## Funcionalidades

- Habitación rectangular con medidas interiores, altura, grosor y paredes activables. Las paredes próximas a la cámara se ocultan para ver el interior.
- Prismas, cilindros, puertas, ventanas, columnas y vigas con posición, dimensiones y nombre editables. Color individual para prismas y marcos; color común para paredes, vigas y columnas.
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

Pulsa **Editar estancia** en la barra inferior para editar Anchura, Profundidad y Altura de la habitación y mostrar en la barra lateral los botones de Puerta, Ventana, Columna, Viga y **Rodapié**. Fuera de ese modo, **Muebles** permite añadir Prisma o Cilindro; **Personalizado** abre una biblioteca donde puedes crear y reutilizar tus propias formas. La lista de piezas aparece en una tarjeta independiente y se filtra según el modo. Todas las medidas están en milímetros. X y Z indican el centro horizontal; Y indica el punto más bajo del objeto, también cuando está girado.

El rodapié es un acabado blanco de 80 × 12 mm que recorre todas las paredes activas, incluso las ocultas por cámara, y respeta los huecos de las puertas. Se adapta a las medidas de la estancia y se guarda con el proyecto. El mismo botón permite quitarlo. Es decorativo y no añade colisiones.

Cuando una columna apoyada en el suelo toca una pared, el rodapié rodea sus caras expuestas en lugar de atravesarla por detrás. También contempla columnas en esquinas o conectadas entre sí y actualiza el recorrido al moverlas o cambiar sus medidas. Para columnas giradas utiliza su envolvente rectangular mundial.

En construcción, arrastra una puerta o ventana hacia otra pared para cambiarla de pared y orientar su marco automáticamente. Conserva su tamaño y altura; solo se utilizan paredes activas y visibles desde la cámara donde cabe. El hueco se actualiza durante el arrastre, respetando Snap y colisiones. Un solo deshacer revierte todo el gesto.

Puertas y ventanas se detienen ante columnas y vigas pegadas a la pared y no pueden colocarse detrás de ellas. Se comprueba también al redimensionar o cambiar de pared, incluso con las colisiones opcionales desactivadas. Una viga solo bloquea el marco cuando coinciden sus alturas.

El techo virtual está a la altura de las paredes y limita la parte superior de las piezas, también si están giradas o las paredes están desactivadas. Al reducir la altura de la habitación, las piezas se bajan si caben; si son demasiado altas, se rechaza el cambio. El techo no se dibuja y no oculta la escena.

**Colisiones** (su casilla general está temporalmente oculta), cambia a la vez el ajuste de prismas, puertas y ventanas. Vigas y columnas pueden solaparse entre sí, pero siempre colisionan con los demás tipos, incluso si esas piezas tienen las colisiones desactivadas. No muestran ajustes individuales de colisión ni de color. **Colisiones de este elemento**, en sus propiedades, modifica solo esa pieza: si está desactivado, puede atravesar y ser atravesada por otros elementos opcionales, mientras las piezas activas siguen colisionando entre sí. El general muestra un estado mixto cuando hay excepciones; pulsarlo en ese estado desactiva todas y pulsarlo de nuevo las activa todas. Los cambios generales también definen el ajuste de las piezas que añadas después. Paredes y techo siguen activos, y todos los ajustes se guardan con el proyecto. Los proyectos anteriores se convierten conservando los ajustes opcionales; las vigas y columnas se fuerzan a colisionar. Si la escena contiene solapamientos entre ellas y otros tipos, se rechaza la carga y se conserva la copia local.

Con las colisiones activas, los movimientos se detienen al contactar y permiten deslizarse por los ejes libres. Los tiradores de tamaño se limitan al contacto; las medidas y giros que provocarían un solapamiento se rechazan. Añadir y duplicar buscan una posición cercana libre. Si ya hay piezas solapadas, sepáralas o excluye una antes de activar las colisiones. Puertas y ventanas de paredes desactivadas no bloquean a otros elementos.

El icono de muestras de la barra inferior abre una paleta para la pieza seleccionada; con la habitación, vigas o columnas seleccionadas cambia el color común de la estructura. En la paleta de la estructura puedes elegir **Paredes** o **Suelo** para cambiar sus colores por separado. El suelo se muestra continuo, sin líneas de cuadrícula. La muestra tachada restaura el color original.

La paleta inferior cambia en bloque el color de paredes, vigas y columnas al seleccionar la estructura; el panel derecho no muestra ese selector. Comparten siempre ese color, independientemente del snap, desde su creación o importación. El ajuste se guarda con el proyecto y admite deshacer/rehacer. Los archivos anteriores sin este ajuste usan `#526171`.

Los cuadrados cambian el tamaño manteniendo fija la cara opuesta. Arrastra desde cualquier punto de una pieza para moverla sobre un plano horizontal. La base muestra el mismo tirador cuadrado de tamaño que las demás caras. El triángulo la eleva. Un clic simple selecciona; Ctrl/Cmd o Mayús + clic conserva la selección múltiple. Escribe en una cota flotante y confirma con Enter o al salir del campo. En la habitación, el panel derecho se abre únicamente con **Editar estancia** y muestra esas tres medidas de la habitación. Las piezas conservan sus cotas y controles en el visor.

Los controles de giro son flechas curvas de doble punta, sin recuadro, orientadas según su plano de rotación. X aparece sobre un extremo superior, Z sobre el centro del borde superior y Y junto a la esquina cercana de la base. Las flechas son grises y muestran el color del eje al pasar el cursor; sus curvas mantienen la orientación de su plano al orbitar. Arrastra siguiendo la dirección del aro para girar. Durante una misma operación, la pieza reduce su tamaño si lo necesita y lo recupera cuando vuelve a caber, hasta las medidas iniciales de esa operación.

Con Snap activo, los arrastres usan un paso fijo de 50 mm y los giros pasos de 15°. El snap a paredes utiliza un umbral de 60 mm y tiene prioridad sobre la cuadrícula. La cuadrícula visible tiene divisiones de 500 mm. Los cambios numéricos de posición aplican snap a superficies al confirmar; las cotas numéricas no se redondean a la cuadrícula.

| Acción | Atajo |
| --- | --- |
| Deshacer | Ctrl/Cmd + Z |
| Rehacer | Ctrl/Cmd + Mayús + Z |
| Duplicar selección | Ctrl/Cmd + D |
| Copiar selección | Ctrl/Cmd + C |
| Pegar selección | Ctrl/Cmd + V |
| Eliminar selección | Supr o Backspace |
| Deseleccionar | Escape |
| Modo mover / rotar | W / R |

La barra inferior incluye **Duplicar** junto a Agrupar/Desagrupar. Copiar y pegar utiliza un portapapeles interno del editor, conserva la disposición de una selección múltiple y respeta el modo de edición y las colisiones. Los atajos no intervienen al escribir en campos de texto o medidas.

Para la cámara: arrastra desde el espacio libre para orbitar, usa el botón derecho para desplazar y la rueda para zoom. Los controles flotantes, cotas y contorno de selección se ocultan mientras se mueve la cámara, incluida la inercia, y reaparecen al detenerse. El selector de vista ofrece perspectiva, superior, frontal y lateral.

## Objetos personalizados

Pulsa **Personalizado** y **Crear objeto personalizado** para abrir un plano limpio con suelo y rejilla. Añade prismas y cilindros, ajusta sus tamaños, posiciones, giros y colores, y combínalos como prefieras. Las piezas pueden solaparse en este taller. Debajo de Cilindro, el selector **Añadir forma personalizada** inserta una copia independiente de cualquier forma guardada disponible. Modificar esa copia no cambia la plantilla ni las piezas de la habitación.

El constructor muestra los ejes XYZ en el origen **(0, 0, 0)**. Al seleccionar una pieza, el panel derecho muestra dos bloques: **Tamaño** (anchura, altura y profundidad) y **Posición** (X, Y y Z), con medidas en milímetros. Enter o salir del campo confirma la edición; admite deshacer y se actualiza al arrastrar la pieza. X y Z indican el centro horizontal y Y el punto más bajo.

Junto al selector de perspectiva, el selector **Snap** permite ajustar movimientos y tamaños en pasos de **5, 10, 50 o 100 mm**, o deshabilitar el ajuste. Con Snap activo, los giros mantienen pasos de 15°. Al salir del constructor se recupera el ajuste de la habitación.

Las flechas mueven la selección un paso de Snap por pulsación: en direcciones relativas a la cámara sobre el plano horizontal, conservando la altura. Cada pulsación modifica únicamente X o Z: se elige el eje más cercano a la dirección en pantalla, sin desplazamientos diagonales. Con Snap deshabilitado, el paso es 1 mm. Los campos de entrada conservan su uso habitual de las flechas.

Escribe un nombre en la cabecera y pulsa **Guardar objeto**. Volverás a la habitación con la biblioteca abierta y una miniatura de la forma; púlsala para insertar una copia. Si no cabe, aparece un aviso dentro del modal. Varias piezas se insertan como un grupo con escala proporcional. **Volver a la habitación** cancela el borrador actual.

El lápiz de cada miniatura abre el objeto para editar sus piezas y nombre. Guardar actualiza esa plantilla; las copias que ya hayas colocado en la habitación se mantienen.

Los personalizados compuestos se insertan como una sola pieza y no pueden desagruparse. Puedes agruparlos con otros elementos; al desagrupar ese grupo exterior, el personalizado conserva todos sus componentes. Este comportamiento se conserva al duplicar y guardar el proyecto.

La biblioteca se conserva con el proyecto y el autoguardado. El borrador del taller también se recupera al recargar, conservando la habitación original por separado. Las formas compuestas conservan sus piezas, sin unión booleana; sus colisiones usan la envolvente conservadora de los grupos.

## Agrupar elementos

Selecciona varias piezas con **Ctrl/Cmd o Mayús + clic**, en la lista o en el visor, y pulsa **Agrupar**. Cada pieza seleccionada muestra su contorno cian para identificar la selección. Aparecen como un único elemento en la escena, conservando sus formas y colores. Puedes moverlo, elevarlo, girarlo, duplicarlo o eliminarlo como cualquier pieza. **Desagrupar** recupera los componentes en su posición, tamaño y orientación actuales. También puedes agrupar grupos.

El tamaño del grupo cambia proporcionalmente en los tres ejes; conserva la forma de sus piezas. Los giros conservan el tamaño y se rechazan si el grupo no cabe. Las colisiones y el snap utilizan la envolvente del grupo, incluidos los espacios entre componentes. Si esa envolvente invade otro elemento activo, hay que incluirlo en la selección o separarlo antes de agrupar. Los grupos con vigas o columnas mantienen colisiones obligatorias y el color común de sus piezas estructurales. Desagrupar restaura los ajustes individuales de colisión; si provoca solapamientos activos, se rechaza la operación. Puertas y ventanas no se agrupan porque dependen de una pared.

## Guardar y continuar desde otro equipo

Pulsa el nombre de la barra superior para editarlo y guarda con el icono de disquete (o Enter). El nombre se conserva con el autoguardado y el JSON.

Usa **Descargar proyecto** para exportar la escena a JSON y **Abrir** para recuperarla en el otro dispositivo. El formato actual es versión 6 y admite archivos de versiones 1–6.

La habitación y sus objetos se autoguardan por proyecto en IndexedDB y se recuperan al recargar o volver a abrir Gridly en la misma dirección. **Proyectos** permite abrir, crear y duplicar proyectos guardados en este dispositivo. **Abrir** un JSON crea otro proyecto sin sustituir el anterior; cambiar de proyecto limpia el historial de deshacer. El autoguardado anterior se migra conservando su copia original.

Se incluyen arrastres, deshacer/rehacer y borradores del constructor. Una copia de recuperación en `localStorage` conserva lo pendiente de confirmar en IndexedDB. Si otra pestaña modifica el mismo proyecto desde una versión antigua, se conservan ambas versiones y aparece una «Copia recuperada» en Proyectos. Si el almacenamiento falla, aparece un aviso para guardar el JSON manualmente.

El autoguardado no conserva el historial de deshacer. Subir el código a GitHub no transfiere las escenas; conserva un JSON como respaldo si borras los datos del navegador.

Con Supabase configurado, **Iniciar sesión** envía un enlace de acceso por correo. Usa la misma cuenta en tus dispositivos. **Mi cuenta → Guardar en mi cuenta** crea una copia en tu cuenta y conserva el proyecto local original. El proyecto abierto se sincroniza automáticamente tras una pausa, al volver a la app y al recuperar conexión. **Proyectos** muestra las copias locales y los proyectos de la cuenta; crear, duplicar e importar siguen creando proyectos locales hasta que decidas subirlos.

Cada guardado comprueba la revisión de origen. Si otro dispositivo ha cambiado el proyecto, se detiene la subida y aparece **Requiere revisión**. En Mi cuenta puedes **Conservar ambos** o **Usar la versión de la nube**; ambas opciones guardan primero una copia local del trabajo pendiente. Las actualizaciones recibidas se validan y esperan a que no haya edición activa. El borrador del constructor permanece local. Cerrar sesión oculta los proyectos de esa cuenta y conserva sus cambios pendientes en este dispositivo.

En **Proyectos**, el icono de papelera elimina el proyecto de la lista; **Papelera** permite restaurarlo. En la cuenta se elimina también de la nube, con comprobación de revisión y sin destruir el documento. Los registros con el mismo nombre se muestran en una sola fila; las copias idénticas no se repiten y las versiones distintas se pueden abrir desde **Otras versiones**. Eliminar esa fila mueve todas sus versiones a la papelera.

Para retomar el desarrollo con Codex, abre el repositorio clonado y pide que lea [AGENTS.md](AGENTS.md) y [el contexto del proyecto](docs/PROJECT_CONTEXT.md). Ambos archivos están versionados y recogen las convenciones, preferencias y estado actual.

La configuración y las garantías de sincronización están en [docs/SYNC_PLAN.md](docs/SYNC_PLAN.md).

### Configurar Supabase

1. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` desde tu proyecto Supabase. Usa solo la clave pública, nunca una clave secreta o `service_role`.
2. Aplica la migración de `supabase/migrations/` si preparas otro proyecto Supabase. En **gridly** (`pxouqnjmjnpopmfnlbpz`) ya está aplicada.
3. En **Authentication → URL Configuration**, configura Site URL y Redirect URLs para la dirección de la app. En desarrollo usa `http://127.0.0.1:5173/`; añade las direcciones exactas de los otros dispositivos o del alojamiento cuando existan.
4. Mantén el enlace predeterminado (`VITE_AUTH_EMAIL_MODE=magiclink`). El correo incorporado de Supabase solo permite direcciones del equipo y tiene límites de envío. Para usuarios externos configura SMTP propio. El modo `otp` requiere una plantilla que incluya `{{ .Token }}`; los proyectos Free nuevos sin SMTP no permiten personalizarla.
5. Reinicia Vite tras cambiar variables. Inicia sesión, guarda una escena de prueba en tu cuenta y ábrela en otro navegador/dispositivo. El servidor de desarrollo solo escucha en este equipo; para otro dispositivo necesitas una dirección accesible de Gridly.

`.env.local` está excluido de Git. La configuración local de gridly ya contiene URL y clave pública. Falta verificar el retorno del correo y una sesión real; la conexión del plugin no inicia sesión dentro de Gridly.

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
| `src/localProjects.ts`, `src/projectRepository.ts`, `src/projectPersistence.ts`, `src/useLocalProjects.ts` | Proyectos locales, IndexedDB, recuperación y metadatos de sincronización |
| `src/LocalProjects.vue`, `src/CloudAccount.vue` | Proyectos locales/remotos y acceso a cuenta |
| `src/cloudSync.ts`, `src/supabaseClient.ts`, `src/useCloudAccount.ts` | Revisiones, cola persistente, autenticación y sincronización |
| `supabase/migrations/`, `supabase/tests/` | Esquema, permisos y comprobaciones SQL |
| `tests/` | Pruebas de regresión del modelo |

## Límites actuales

No se incluyen snap entre objetos libres, importación STL, paredes irregulares ni apertura de hojas de puertas. Puertas y ventanas conservan la orientación de su pared. Los movimientos usan envolventes conservadoras para piezas giradas; las comprobaciones estáticas distinguen cajas orientadas que solo se tocan.

Los controles y cotas pueden necesitar ajustes adicionales en piezas muy pequeñas o vistas extremas. Vite muestra un aviso por el tamaño del bundle de Three.js; la compilación termina correctamente.

`node_modules/`, `dist/`, capturas de comprobación y archivos locales están excluidos mediante `.gitignore`.
