# Finanzas

Aplicación de finanzas personales para usar en tu propio ordenador. Los datos viven en un archivo SQLite local (`data/finanzas.db`); nada sale a la nube salvo la copia de seguridad en tu Google Drive.

> Estado: **fase 9**, completa: acceso, movimientos, panel con avisos, presupuesto, calendario, cuentas y ahorro, importadores, copia en Google Drive y ajustes.

## Requisitos

- Node.js 22 o superior.

## Instalación

```bash
npm install
cp .env.example .env.local   # crea tu archivo de configuración
npm run crear-acceso         # pide tu correo y contraseña y guarda el acceso en .env.local
npm run db:preparar          # crea data/finanzas.db, aplica migraciones y carga la configuración inicial
```

## Arranque

```bash
npm run dev                  # desarrollo, en http://localhost:3000
npm run build && npm start   # versión optimizada
```

`npm run dev` prepara la base de datos antes de arrancar; `npm start` aplica las migraciones pendientes.

## Abrir con un doble clic (Windows)

Para no usar la terminal: un icono «Finanzas» que abre la app y la cierra sola cuando dejas de usarla.

1. Una sola vez, tras la instalación: `npm run acceso-directo`. Crea el icono en el **escritorio** y en el **menú Inicio** (desde allí, clic derecho › *Anclar a la barra de tareas* si lo quieres abajo).
2. **Doble clic** en el icono: se abre el navegador con «Abriendo Finanzas…» y, en unos segundos, la app. No verás ninguna ventana de terminal.
3. Úsala con normalidad. Mientras tengas una pestaña abierta (en el ordenador o en el móvil) sigue en marcha; **15 minutos después de cerrar la última, se cierra sola**. Si había una copia a Drive a medias, espera a que termine (y si no hay internet, la retoma la próxima vez que la abras).
4. Si vuelves a una pestaña antigua después de que se haya cerrado, no responderá: haz doble clic en el icono otra vez.

Detalles:

- **Actualizar**: `git pull` y doble clic. El icono detecta la versión nueva, instala lo que falte y la compila él solo; esa primera vez tarda un par de minutos.
- **Recurrentes que se apuntan solos**: se registran al abrir la app, con su fecha correcta.
- **Si no se abre**, la página de espera lo dice, y el detalle queda en `data/lanzador.log`. Si otro programa usa el puerto 3000, pon otro en `PORT` dentro de `.env.local`.
- Para quitar el icono, bórralo del escritorio y del menú Inicio. `npm start` sigue funcionando igual (y así no se cierra sola).

## Usar desde el móvil (en casa)

La app sigue viviendo en tu ordenador; el móvil solo la abre a través de la wifi de casa.

1. Arranca la app en el ordenador (`npm run build && npm start`). Al arrancar escribe la dirección para el móvil, por ejemplo `http://192.168.1.20:3000`; también la tienes en **Ajustes › Copia y datos › Usar desde el móvil**.
2. Con el móvil en la **misma wifi**, abre esa dirección y entra con tu correo y contraseña.
3. Para tenerla como una app: en Android (Chrome), menú ⋮ › **Añadir a pantalla de inicio**; en iPhone (Safari), botón Compartir › **Añadir a pantalla de inicio**.

Si el móvil no llega:

- **Cortafuegos del ordenador**: la primera vez, Windows o macOS preguntan si Node.js puede aceptar conexiones. Permítelo **solo en redes privadas** (Windows: marca «Redes privadas» y que la wifi de casa esté como red privada). En Linux con `ufw`: `sudo ufw allow from 192.168.0.0/16 to any port 3000`.
- **Otra dirección**: el router puede cambiar la dirección del ordenador. Mira la nueva al arrancar o en Ajustes. Para que no cambie, reserva una IP fija para el ordenador en el router.
- La app solo responde mientras el ordenador esté encendido con ella abierta.

Seguridad: fuera de casa no se puede llegar a ella (tu router no la expone a internet; no abras puertos en él). Dentro de casa va por `http` sin cifrar, así que úsala solo en tu wifi, que debe tener contraseña; nunca en una wifi pública. La contraseña de la app y el bloqueo tras 5 intentos fallidos la protegen de otros aparatos de la red. **Conectar con Google Drive** se hace desde el ordenador (`http://localhost:3000`): Google no admite dar el permiso desde otra dirección.

## Variables de entorno (`.env.local`)

| Variable | Para qué |
|---|---|
| `DB_PATH` | Ruta de la base de datos. Por defecto `./data/finanzas.db`. |
| `APP_EMAIL`, `APP_PASSWORD_HASH` | Tu acceso. El hash es bcrypt; nunca la contraseña en claro. |
| `SESSION_SECRET` | Secreto para firmar la cookie de sesión (32 caracteres o más). |
| `COOKIE_SECURE` | `true` solo si sirves la app por https. En `http://localhost`, déjalo en `false`. |
| `GOOGLE_CREDENTIALS_PATH` | JSON del cliente OAuth de Google, fuera del repositorio (admite `~`). |
| `GOOGLE_TOKEN_PATH` | Opcional. Dónde se guarda el permiso de Google. Por defecto, `~/.config/finanzas/google-token.json`. |
| `DRIVE_NOMBRE_ARCHIVO` | Opcional. Nombre del libro en tu Drive. |

## Acceso

Hay un único usuario y no hay registro ni recuperación de contraseña.

- **Crear o cambiar la contraseña**: `npm run crear-acceso` y reinicia la app. Escribe en `.env.local` el correo, el hash bcrypt (con cada `$` escapado como `\$`, porque Next interpreta `$` como variable) y un `SESSION_SECRET` nuevo, lo que cierra las sesiones abiertas.
- **Si la olvidas**: vuelve a ejecutar `npm run crear-acceso`. Tus datos no se tocan.
- La sesión dura 30 días en cada navegador, en una cookie firmada y `httpOnly`.
- Tras 5 intentos fallidos seguidos, la pantalla de acceso se bloquea 30 segundos; cada bloqueo nuevo dura el doble, hasta 15 minutos.

`.env*`, la base de datos, las hojas de cálculo y las credenciales de Google están en `.gitignore`.

## Registrar movimientos

- **Registrar**: botón flotante o tecla <kbd>N</kbd> desde cualquier pantalla. Eliges qué es (gasto, entrada de dinero, ahorro, a la hucha o sacar de la hucha) y escribes el importe en positivo. <kbd>Intro</kbd> guarda y deja el formulario listo para el siguiente.
- **Fechas**: la de compra y la de cargo. El mes lo decide la de cargo; los botones «mismo día, +1, +2, +3» la ajustan.
- **Entradas de dinero**: si el concepto parece una nómina se guardan como ingreso; si no, como devolución en su grupo. Puedes cambiarlo antes de guardar.
- **Cubrir con la hucha**: en un gasto, apunta también una retirada de la hucha a Imagin por el mismo importe, enlazada al gasto: si lo editas, se ajusta; si lo borras, se borra.
- **Atajos y propuestas**: los atajos más usados salen primero. Al escribir un concepto conocido se propone lo de la última vez (o lo de tus reglas), sin tocar lo que ya hayas cambiado.
- **Movimientos**: en *Pendientes* confirmas los recurrentes del mes con la fecha y el importe reales, los omites o cambias su día previsto. La tabla se filtra, se ordena y se edita en la propia fila.

## Panel

Solo lectura, para leer de un vistazo (de arriba abajo y de izquierda a derecha):

- **Te queda por gastar**: ingresos − ahorro − lo traspasado a la hucha + lo sacado de ella − el gasto que paga Imagin (el efectivo y lo pagado con la hucha cuentan en su grupo, pero no restan de aquí). Avisa de las compras con tarjeta aún sin cargar.
- **Tus cuentas**: Imagin, Ahorro TR, Inversión TR y hucha, a hoy o al cierre del mes elegido.
- **Avisos** (en el panel, nunca ventanas emergentes), de lo más grave a lo menos:
  - un grupo que pasa del 80 % de su presupuesto del mes (ámbar) o lo supera (burdeos, con cuánto te has pasado), o gasta sin presupuesto;
  - un evento de este mes en el que ya te has pasado de lo previsto, y los eventos a menos de dos semanas;
  - recurrentes cuya fecha prevista ya pasó y no has confirmado;
  - apuntes de la carga inicial por revisar.
- **Resumen de cierre**: los 10 primeros días de cada mes, el panel te enseña el cierre del mes anterior (total ahorrado, gasto y disponible frente al mes previo, y en qué grupos te pasaste) hasta que pulses «Entendido». El cierre completo, con la desviación de cada grupo, está siempre al ver un mes pasado.
- **Resumen del mes**, **semáforo por grupo** (presupuesto fijo + eventos del mes), **reparto del gasto**, **ingresos frente a gastos** del año y **ahorro acumulado** desde el saldo de partida. Cada gráfico tiene su versión en tabla.
- **Pendientes**, **próximos eventos** y **últimos movimientos** (el lápiz abre el movimiento ya en edición). En meses pasados, además, el **cierre** frente al mes anterior.

## Presupuesto y calendario

- **Presupuesto**: el margen del plan de cada mes (nómina − traspaso a Trade Republic − hucha − lo que el presupuesto de los grupos pide a la nómina, es decir, sin la parte prevista en efectivo), la nómina y los importes habituales de ahorro, y el presupuesto de cada grupo con su parte en efectivo. Todo se guarda al salir de cada casilla.
- **Calendario anual**: próximos 12 meses o año natural. Cada evento tiene grupo, etiqueta, color, día opcional y puede ser «solo este año». Su importe se suma al presupuesto de su grupo ese mes (Regalos solo tiene eventos). Lo gastado con su etiqueta cuenta como gastado en el evento. Los eventos sin mes esperan en su bandeja.

## Cuentas y ahorro

- **Tus cuentas hoy**: Imagin, Ahorro TR, Inversión TR y hucha, con su tendencia de los últimos meses. Pulsa una para ver su detalle.
- **Cuadrar con el banco**: escribe el saldo real de hoy; desde ese momento la cuenta se calcula a partir de él y se te dice cuánta diferencia había. En Inversión TR, en su lugar, **anotas el valor** que ves en la app (con uno al mes basta).
- **Ahorro TR**: lo que entra y sale cada mes, los **intereses** (editables a mano en su tabla; vacío o 0 lo quita) y lo que te darían en 12 meses al tipo actual.
- **Inversión TR**: valor frente a lo aportado, ganancia, rentabilidad anual (TIR) y comparación con haber dejado ese dinero en Ahorro TR.
- **Colchón**: Ahorro TR + hucha frente a 3 o 6 meses de tu gasto medio.

## Ajustes

- **Recurrentes**: lo que se repite cada mes. «Se apunta solo» lo registra el día que toca (necesita día e importe); si no, te espera en *Pendientes*. Uno nuevo cuenta desde este mes, aunque su día ya haya pasado: si «se apunta solo» se registra al momento; si no, sale en *Pendientes*. Los de la app (nómina, traspasos, intereses, valor de la inversión) se pueden editar o desactivar, pero no borrar; la nómina y los traspasos cambian su importe en Presupuesto. Borrar un recurrente no borra los movimientos que ya apuntó.
- **Atajos**: los botones de «Registrar». Texto, concepto, tipo, grupo, medio e importe (vacío = lo escribes al usarlo). Allí salen primero los más usados; a igualdad, en el orden de aquí.
- **Grupos**: nombre, color y orden; uno nuevo se coloca antes de «Otros». Un grupo con movimientos (o usado en eventos, atajos, recurrentes o reglas) no se borra: se archiva y se puede reactivar.
- **Reglas**: proponen el grupo al importar. Palabras separadas por comas, sin importar mayúsculas ni tildes (`^bar` = empieza por «bar», `^hm$` = exactamente «hm»). Se miran de arriba abajo; una nueva va la primera. «Prueba un concepto» te dice qué regla lo clasificaría.
- **Copia y datos**: la copia en Google Drive y la descarga del libro `.xlsx`.

## Importar

En **Movimientos › Importar extracto** (o en `/importar`):

- **Carga inicial** (una sola vez): descarga tu hoja «Seguimiento Financiero» como Excel y súbela. Se cargan la nómina y los traspasos a Trade Republic del resumen mensual, los gastos fijos hasta que empiezan los recurrentes, los gastos variables y la gasolina con la fecha real de tu hoja de gasolina; los repostajes que no aparecen en la cuenta se marcan como efectivo. Lo que ya estuviera en la app no se repite. Después, en **Revisar carga inicial**, confirmas el día de cada nómina y clasificas los gastos por concepto (una decisión vale para todos los apuntes iguales), con excepciones por apunte y «Deshacer».
- **Extracto del banco** (CSV o Excel): las columnas se proponen solas y puedes cambiarlas; se recuerdan con un nombre («Imagin») para la próxima vez. La fecha de la operación es la de compra y la fecha valor, la de cargo. Cada línea llega con su tipo y una propuesta de grupo (lo aprendido de tus apuntes o tus reglas). Lo que se parece a algo que ya tienes (mismo importe y cargo a 2 días o menos) llega desmarcado como «posible duplicado». Si corriges un grupo, te ofrece crear una regla.

Los archivos se leen en tu ordenador y no se guardan; `*.xlsx`, `*.csv` y `data/importar/` están en `.gitignore`.

## Base de datos

| Orden | Qué hace |
|---|---|
| `npm run db:generar` | Crea una migración nueva en `drizzle/` tras cambiar `src/db/schema.ts`. |
| `npm run db:migrar` | Aplica las migraciones pendientes. |
| `npm run db:sembrar` | Carga la configuración inicial si la base de datos está vacía. Si ya hay datos, no toca nada. |

Convenciones del esquema: importes en céntimos enteros, fechas `AAAA-MM-DD`, meses `AAAA-MM`. El mes de un movimiento lo decide su **fecha de cargo**.

## Copia de seguridad y restauración

**Hacer una copia** con la app cerrada:

```bash
cp data/finanzas.db "data/copias/finanzas-$(date +%F).db"
```

Con la app abierta, usa la copia en caliente de SQLite, que respeta las escrituras en curso:

```bash
sqlite3 data/finanzas.db ".backup 'data/copias/finanzas-$(date +%F).db'"
```

**Restaurar**: cierra la app, borra `data/finanzas.db`, `data/finanzas.db-wal` y `data/finanzas.db-shm`, y copia la copia elegida como `data/finanzas.db`. Al arrancar se aplicarán las migraciones que falten.

También puedes descargar en cualquier momento el libro `.xlsx` con los datos calculados desde **Ajustes › Copia y datos**.

## Copia en Google Drive

Tras cada cambio (con unos segundos de margen para agrupar), la app genera un libro `.xlsx` con cinco hojas de valores ya calculados (Resumen, Movimientos, Presupuesto, Anuales y Ahorro) y **sobrescribe siempre el mismo archivo** de tu Drive por su `fileId`. Si no hay internet o Drive falla, lo deja pendiente y reintenta con espera creciente (10 s, 20 s, 40 s… hasta 30 min); al arrancar la app retoma lo pendiente. Nunca impide guardar. El indicador de abajo a la izquierda (arriba en el móvil) dice si está sincronizado, pendiente o con error, con un botón para reintentar.

**Configurarlo (una vez):**

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto (gratis) y activa la **Google Drive API** (APIs y servicios › Biblioteca).
2. En **Pantalla de consentimiento de OAuth**, tipo «Externo», añade tu correo como usuario de prueba. No hace falta publicarla.
3. En **Credenciales › Crear credenciales › ID de cliente de OAuth**, tipo **Aplicación web**, con este URI de redirección autorizado: `http://localhost:3000/api/drive/callback` (si usas otro puerto, cámbialo).
4. Descarga el JSON y guárdalo **fuera de esta carpeta**, por ejemplo en `~/.config/finanzas/google-oauth.json`, con permisos solo para ti (`chmod 600`).
5. Pon su ruta en `GOOGLE_CREDENTIALS_PATH` dentro de `.env.local` y reinicia la app.
6. En **Ajustes › Copia y datos**, pulsa **Conectar con Google Drive** y acepta.

La app solo pide el permiso `drive.file`: ve el archivo que ella crea, no el resto de tu Drive. El permiso duradero (refresh token) se guarda en `~/.config/finanzas/google-token.json` (fuera del repositorio, permisos 600). Para retirarlo: **Desconectar** en Ajustes, o quita el acceso desde tu cuenta de Google. Si borras el archivo en Drive, la app crea otro en la siguiente copia.

## Pruebas

```bash
npm test          # pruebas
npm run tipos     # comprobación de tipos
```

Las pruebas de los avisos están en `src/lib/avisos.test.ts`: umbrales del 80 % y del 100 %, eventos cercanos o ya pasados de presupuesto, recurrentes atrasados, orden por gravedad, cuándo se ofrece el cierre y sus desviaciones.

Las pruebas de la copia en Drive están en `src/lib/drive/*.test.ts`: las cinco hojas del libro (solo valores, formato, importes con signo), agrupar cambios, reintentos con espera creciente, error permanente, retomar al arrancar, y el cliente de Google con respuestas simuladas.

Las pruebas de los importadores están en `src/lib/importar/*.test.ts` y `src/db/importar.test.ts`, con una hoja y un extracto de ejemplo que tienen la misma forma que los reales: lectura de la hoja (gasolina con fecha real y efectivo deducido), CSV y mapeo de columnas, fechas, duplicados, propuestas, revisión por lotes y deshacer.

Las pruebas del presupuesto y el calendario están en `src/lib/plan.test.ts` y `src/db/plan.test.ts`: margen del plan con eventos y efectivo, meses del calendario, eventos de un solo año, validación de eventos y etiquetas, y parámetros del plan.

Las pruebas del panel están en `src/lib/panel.test.ts`: resumen con gasolina y efectivo, presupuesto por grupo con eventos, avisos, próximos eventos, saldos de las cuentas, ahorro acumulado, rendimiento de Inversión TR y cierre del mes.

Las pruebas del registro están en `src/lib/movimientos.test.ts`, `src/lib/formato.test.ts` y `src/db/movimientos.test.ts`: traducción de cada tipo al modelo, avisos del formulario, retirada enlazada al cubrir con la hucha, recurrentes pendientes y automáticos, formato español de importes y fechas.

Las pruebas del acceso están en `src/lib/auth/auth.test.ts`: firma y caducidad de la sesión, credenciales, escritura de `.env.local`, límite de intentos y redirecciones seguras.

Las reglas de negocio están en `src/lib/reglas.ts` y sus pruebas en `src/lib/reglas.test.ts`: disponible del mes con efectivo, Revolut y retiradas de la hucha; devoluciones; mes por fecha de cargo; presupuesto dinámico de Regalos y eventos por grupo; saldos de las cuentas; rentabilidad de Inversión TR; colchón; sugerencias de clasificación.
