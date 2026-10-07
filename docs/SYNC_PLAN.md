# Sincronización entre dispositivos

## Alcance acordado

Una misma cuenta puede continuar sus proyectos entre dispositivos. No se implementa edición colaborativa simultánea. Aun así, una pestaña antigua o un dispositivo sin conexión nunca debe sobrescribir cambios que no ha recibido.

El autoguardado local funciona sin cuenta ni conexión. La sincronización del proyecto abierto es automática al terminar una operación o tras una pausa; no envía un guardado por cada frame del arrastre.

Se sincronizan habitación, piezas, nombre, colores, ajustes persistentes de colisiones y biblioteca de personalizados. Cámara, selección, historial de deshacer y borrador del constructor son locales. Guardar una plantilla incorpora su resultado al documento sincronizable. La revisión remota no es la versión del JSON; se conserva el formato 6 y la importación 1–6.

## Primera etapa implementada: proyectos locales

- IndexedDB `gridly.projects` almacena registros por identificador estable y un proyecto activo por ámbito. Se separan proyectos anónimos y de cada cuenta mediante `accountId`; cerrar sesión oculta los de la cuenta anterior.
- Cada registro reúne documento, `baseRevision`, `syncedDocument`, `pending`, `localVersion`, `writeId` y fecha. Nuevos proyectos tienen revisión remota nula y cambios pendientes. `customDraft` se conserva en el documento local pero se excluye al calcular el documento destinado a la nube.
- La lectura del proyecto activo precede al montaje del editor para impedir que una recuperación tardía reemplace una edición recién iniciada.
- El autoguardado anterior `gridly.autosave` se migra cuando no hay proyecto local activo. Se valida con el mismo parser de JSON y se conserva la fuente original. Las entradas inválidas permanecen intactas y producen un aviso.
- Antes de cada escritura asíncrona se guarda una copia de recuperación síncrona en `localStorage`, bajo `gridly.recovery.<sesión>`. `pagehide` y el paso a segundo plano capturan lo pendiente. La copia solo se elimina tras confirmar IndexedDB y si no fue sustituida por cambios más recientes. Las sesiones siguientes recuperan entradas locales válidas; las inválidas y las de otras cuentas se conservan.
- Las escrituras propias se ordenan. IndexedDB comprueba la versión local dentro de la transacción de escritura. Una pestaña que edita desde una versión antigua genera una copia independiente (`recoveredFrom`), sin sustituir la anterior. Repetir un guardado confirmado o la recuperación de una copia es idempotente. Una pestaña antigua sin cambios no genera copias.
- «Proyectos» permite abrir, crear y duplicar proyectos locales; las copias de conflictos se identifican como «Copia recuperada». Importar un JSON crea un proyecto independiente. Antes de cambiar se confirma el guardado del anterior; un fallo impide el cambio. Cambiar de proyecto limpia la selección y el historial de deshacer. Exportar sigue descargando JSON portátil, sin metadatos de almacenamiento.
- Si falla IndexedDB al inicializar, la edición sigue disponible con copias de recuperación independientes y un aviso; al volver IndexedDB se recuperan esas ediciones como proyectos locales, sin modificar la fuente de migración. Si falla una escritura, se mantiene la copia de recuperación cuando está disponible; si también falla `localStorage`, se indica descargar JSON. No se garantiza persistencia si ambos almacenamientos están bloqueados o sin espacio.

## Nube implementada

- **Acceso y ámbitos:** Supabase Auth por enlace de correo. Cambio de cuenta antes de permitir edición y recuperación solo del ámbito autorizado. Subir el proyecto anónimo crea una copia de cuenta mediante acción explícita. No se usan claves secretas en el cliente.
- **Guardado protegido:** migración aplicada en gridly (`pxouqnjmjnpopmfnlbpz`). RPC con propietario, revisión esperada e ID de operación; bloqueo por proyecto, revisión e historial transaccionales. RLS limita lecturas al propietario y no se permiten escrituras directas.
- **Cola durable:** operación persistente antes de enviar; una sola petición en vuelo e instantánea inmutable. El acuse confirma solo lo enviado. Reintentos idempotentes y respuestas tardías invalidadas por cambio de cuenta/proyecto.
- **Actualizaciones:** pausa de 1,2 s, apertura, vuelta/reconexión, Realtime y consulta de respaldo cada 30 s. Se sincroniza el proyecto activo; otros pendientes se retoman al abrirlos. Se valida antes de aplicar y se espera durante gestos, campos, modales y borradores del taller.
- **Conflictos:** se pausa y conserva el trabajo local. «Conservar ambos» o «Usar la versión de la nube» crean primero respaldo local. La primera crea además otro proyecto de cuenta con la versión local. No hay fusión geométrica automática.
- **Interfaz:** Mi cuenta muestra acceso, acciones y estado; Proyectos reúne copias locales, caché y proyectos remotos. Crear/importar/duplicar siguen siendo locales. Cerrar sesión afecta solo a este dispositivo.

## Pendiente para validar y ampliar

1. Revisar **Authentication → URL Configuration**: Site URL y Redirect URLs deben incluir la dirección de Gridly; en este equipo es `http://127.0.0.1:5173/`. El panel requiere sesión; el conector no edita esa configuración.
2. Iniciar sesión con correo real y comprobar entre dos navegadores/dispositivos: subir, abrir, editar por turnos, desconectar/reconectar y resolver conflicto. El correo incorporado solo envía a miembros del equipo; SMTP propio es necesario para otros correos. Se usa el enlace predeterminado; OTP requiere SMTP/plantilla `{{ .Token }}` y `VITE_AUTH_EMAIL_MODE=otp`.
3. Disponer de una dirección de Gridly accesible desde otros dispositivos. No se ha desplegado la app; Vite escucha solo en 127.0.0.1.
4. Añadir restauración de revisiones desde la interfaz y definir retención. Restaurar deberá crear una revisión nueva con comprobación de concurrencia. Ahora se guardan todas las revisiones completas, sin poda.
5. Si aumenta el uso, añadir paginación al listado (100 proyectos recientes) y revisar el límite remoto de 2 MB. Existe eliminación recuperable local/remota y papelera; no hay borrado definitivo ni cola global de todos los proyectos.

## Validación

`tests/local-projects.test.ts` cubre identidades, migración de versiones 1–6, importación independiente, cambio de proyecto, escrituras en cola, pestañas antiguas con/sin cambios, errores de escritura, recuperación tras cierre, reintentos idempotentes, borradores locales, aislamiento de ámbitos y conservación de fuentes inválidas. La transacción nativa de IndexedDB se comprueba además en navegador con recuperación tras recargar y conflicto entre pestañas.

`tests/cloud-sync.test.ts` comprueba subidas explícitas, reintentos tras pérdida de respuesta, ediciones durante subida/descarga, conflictos de dos clientes, aplazamiento de actualizaciones, cancelación por cuenta, borradores y versiones inválidas. `supabase/tests/project_sync.sql` se ejecutó con roles reales y ROLLBACK: comprueba propiedad, RLS, revisión, idempotencia, historial y escrituras directas prohibidas. La API rechaza lectura y RPC anónimas. Falta el recorrido real por correo y dos dispositivos; la restauración concurrente se probará cuando exista esa función.

La migración de eliminación añade una marca persistente y RPC protegida por propietario/revisión. Las filas se agrupan por nombre, con documentos diferentes accesibles como versiones. `tests/project-list.test.ts` y `supabase/tests/project_deletion.sql` verifican agrupación, recuperación y protección contra resurrección.
