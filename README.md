# Finanzas

Aplicación de finanzas personales para usar en tu propio ordenador. Los datos viven en un archivo SQLite local (`data/finanzas.db`); nada sale a la nube salvo la copia de seguridad en tu Google Drive.

> Estado: **fase 1** (modelo de datos, migraciones, datos iniciales y reglas de negocio con pruebas). Las pantallas llegan en las fases siguientes.

## Requisitos

- Node.js 22 o superior.

## Instalación

```bash
npm install
cp .env.example .env.local   # y rellénalo (ver más abajo)
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
| `APP_EMAIL`, `APP_PASSWORD_HASH` | Tu acceso (fase 2). El hash es bcrypt; nunca la contraseña en claro. |
| `SESSION_SECRET` | Secreto para firmar la cookie de sesión. |
| `GOOGLE_CREDENTIALS_PATH` | Credenciales OAuth de Google Drive (fase 7), fuera del repositorio. |

`.env*`, la base de datos, las hojas de cálculo y las credenciales de Google están en `.gitignore`.

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

Las reglas de negocio están en `src/lib/reglas.ts` y sus pruebas en `src/lib/reglas.test.ts`: disponible del mes con efectivo, Revolut y retiradas de la hucha; devoluciones; mes por fecha de cargo; presupuesto dinámico de Regalos y eventos por grupo; saldos de las cuentas; rentabilidad de Inversión TR; colchón; sugerencias de clasificación.
