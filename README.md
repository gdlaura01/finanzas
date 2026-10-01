# Finanzas

Aplicación de finanzas personales para usar en tu propio ordenador. Los datos viven en un archivo SQLite local (`data/finanzas.db`); nada sale a la nube salvo la copia de seguridad en tu Google Drive.

> Estado: **fase 5** (acceso, movimientos, panel, presupuesto y calendario anual). Cuentas, importadores, Drive y avisos llegan en las fases siguientes.

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

## Variables de entorno (`.env.local`)

| Variable | Para qué |
|---|---|
| `DB_PATH` | Ruta de la base de datos. Por defecto `./data/finanzas.db`. |
| `APP_EMAIL`, `APP_PASSWORD_HASH` | Tu acceso. El hash es bcrypt; nunca la contraseña en claro. |
| `SESSION_SECRET` | Secreto para firmar la cookie de sesión (32 caracteres o más). |
| `COOKIE_SECURE` | `true` solo si sirves la app por https. En `http://localhost`, déjalo en `false`. |
| `GOOGLE_CREDENTIALS_PATH` | Credenciales OAuth de Google Drive (fase 7), fuera del repositorio. |

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
- **Avisos**: grupos por encima del 80 % de su presupuesto, gasto en grupos sin presupuesto, eventos a menos de dos semanas y apuntes pendientes de revisar.
- **Resumen del mes**, **semáforo por grupo** (presupuesto fijo + eventos del mes), **reparto del gasto**, **ingresos frente a gastos** del año y **ahorro acumulado** desde el saldo de partida. Cada gráfico tiene su versión en tabla.
- **Pendientes**, **próximos eventos** y **últimos movimientos** (el lápiz abre el movimiento ya en edición). En meses pasados, además, el **cierre** frente al mes anterior.

## Presupuesto y calendario

- **Presupuesto**: el margen del plan de cada mes (nómina − traspaso a Trade Republic − hucha − lo que el presupuesto de los grupos pide a la nómina, es decir, sin la parte prevista en efectivo), la nómina y los importes habituales de ahorro, y el presupuesto de cada grupo con su parte en efectivo. Todo se guarda al salir de cada casilla.
- **Calendario anual**: próximos 12 meses o año natural. Cada evento tiene grupo, etiqueta, color, día opcional y puede ser «solo este año». Su importe se suma al presupuesto de su grupo ese mes (Regalos solo tiene eventos). Lo gastado con su etiqueta cuenta como gastado en el evento. Los eventos sin mes esperan en su bandeja.

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

Además, la app mantendrá un libro `.xlsx` en tu Google Drive con los datos ya calculados (fase 7).

## Pruebas

```bash
npm test          # pruebas
npm run tipos     # comprobación de tipos
```

Las pruebas del presupuesto y el calendario están en `src/lib/plan.test.ts` y `src/db/plan.test.ts`: margen del plan con eventos y efectivo, meses del calendario, eventos de un solo año, validación de eventos y etiquetas, y parámetros del plan.

Las pruebas del panel están en `src/lib/panel.test.ts`: resumen con gasolina y efectivo, presupuesto por grupo con eventos, avisos, próximos eventos, saldos de las cuentas, ahorro acumulado, rendimiento de Inversión TR y cierre del mes.

Las pruebas del registro están en `src/lib/movimientos.test.ts`, `src/lib/formato.test.ts` y `src/db/movimientos.test.ts`: traducción de cada tipo al modelo, avisos del formulario, retirada enlazada al cubrir con la hucha, recurrentes pendientes y automáticos, formato español de importes y fechas.

Las pruebas del acceso están en `src/lib/auth/auth.test.ts`: firma y caducidad de la sesión, credenciales, escritura de `.env.local`, límite de intentos y redirecciones seguras.

Las reglas de negocio están en `src/lib/reglas.ts` y sus pruebas en `src/lib/reglas.test.ts`: disponible del mes con efectivo, Revolut y retiradas de la hucha; devoluciones; mes por fecha de cargo; presupuesto dinámico de Regalos y eventos por grupo; saldos de las cuentas; rentabilidad de Inversión TR; colchón; sugerencias de clasificación.
