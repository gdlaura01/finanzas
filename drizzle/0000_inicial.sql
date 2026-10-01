CREATE TABLE `atajos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`texto_boton` text NOT NULL,
	`concepto` text NOT NULL,
	`clase` text NOT NULL,
	`entrada_como` text,
	`grupo_id` integer,
	`etiqueta` text,
	`medio` text NOT NULL,
	`importe_cent` integer,
	`orden` integer NOT NULL,
	`usos` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`grupo_id`) REFERENCES `grupos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cuadres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cuenta` text NOT NULL,
	`fecha` text NOT NULL,
	`saldo_real_cent` integer NOT NULL,
	`saldo_calculado_cent` integer,
	`es_partida` integer DEFAULT false NOT NULL,
	`estimado` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cuadre_cuenta_fecha` ON `cuadres` (`cuenta`,`fecha`);--> statement-breakpoint
CREATE TABLE `eventos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`mes` integer,
	`dia` integer,
	`anio` integer,
	`grupo_id` integer NOT NULL,
	`etiqueta` text NOT NULL,
	`color` text,
	`importe_previsto_cent` integer NOT NULL,
	`notas` text,
	FOREIGN KEY (`grupo_id`) REFERENCES `grupos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `eventos_etiqueta_unique` ON `eventos` (`etiqueta`);--> statement-breakpoint
CREATE TABLE `grupos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`color` text NOT NULL,
	`orden` integer NOT NULL,
	`presupuesto_cent` integer,
	`efectivo_previsto_cent` integer DEFAULT 0 NOT NULL,
	`es_dinamico` integer DEFAULT false NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grupos_nombre_unique` ON `grupos` (`nombre`);--> statement-breakpoint
CREATE TABLE `importaciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fecha` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`archivo` text NOT NULL,
	`mapeo_id` integer,
	`filas_leidas` integer DEFAULT 0 NOT NULL,
	`aceptadas` integer DEFAULT 0 NOT NULL,
	`descartadas` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`mapeo_id`) REFERENCES `mapeos_extracto`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `intereses` (
	`cuenta` text NOT NULL,
	`mes` text NOT NULL,
	`importe_cent` integer NOT NULL,
	PRIMARY KEY(`cuenta`, `mes`)
);
--> statement-breakpoint
CREATE TABLE `mapeos_extracto` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`configuracion` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mapeos_extracto_nombre_unique` ON `mapeos_extracto` (`nombre`);--> statement-breakpoint
CREATE TABLE `movimientos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fecha_compra` text NOT NULL,
	`fecha_cargo` text NOT NULL,
	`concepto` text NOT NULL,
	`concepto_norm` text NOT NULL,
	`grupo_id` integer,
	`etiqueta` text,
	`tipo` text NOT NULL,
	`medio` text NOT NULL,
	`importe_cent` integer NOT NULL,
	`cuenta_origen` text,
	`cuenta_destino` text,
	`vinculado_id` integer,
	`recurrente_id` integer,
	`periodo` text,
	`origen` text DEFAULT 'manual' NOT NULL,
	`importacion_id` integer,
	`pendiente_revision` integer DEFAULT false NOT NULL,
	`notas` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`grupo_id`) REFERENCES `grupos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vinculado_id`) REFERENCES `movimientos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recurrente_id`) REFERENCES `recurrentes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`importacion_id`) REFERENCES `importaciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mov_fecha_cargo` ON `movimientos` (`fecha_cargo`);--> statement-breakpoint
CREATE INDEX `mov_grupo_cargo` ON `movimientos` (`grupo_id`,`fecha_cargo`);--> statement-breakpoint
CREATE INDEX `mov_etiqueta` ON `movimientos` (`etiqueta`);--> statement-breakpoint
CREATE INDEX `mov_duplicados` ON `movimientos` (`fecha_cargo`,`importe_cent`,`concepto_norm`);--> statement-breakpoint
CREATE UNIQUE INDEX `mov_recurrente_periodo` ON `movimientos` (`recurrente_id`,`periodo`);--> statement-breakpoint
CREATE TABLE `parametros` (
	`clave` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurrentes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concepto` text NOT NULL,
	`clase` text NOT NULL,
	`grupo_id` integer,
	`etiqueta` text,
	`medio` text NOT NULL,
	`cuenta_origen` text,
	`cuenta_destino` text,
	`importe_cent` integer,
	`vinculo` text,
	`dia` integer,
	`auto` integer DEFAULT false NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`desde` text NOT NULL,
	FOREIGN KEY (`grupo_id`) REFERENCES `grupos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recurrentes_omitidos` (
	`recurrente_id` integer NOT NULL,
	`periodo` text NOT NULL,
	PRIMARY KEY(`recurrente_id`, `periodo`),
	FOREIGN KEY (`recurrente_id`) REFERENCES `recurrentes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reglas_importacion` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`patron` text NOT NULL,
	`grupo_id` integer NOT NULL,
	`etiqueta` text,
	`prioridad` integer NOT NULL,
	FOREIGN KEY (`grupo_id`) REFERENCES `grupos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sync_drive` (
	`id` integer PRIMARY KEY NOT NULL,
	`estado` text DEFAULT 'ok' NOT NULL,
	`pendiente` integer DEFAULT false NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`proximo_intento` text,
	`ultimo_error` text,
	`ultimo_ok` text,
	`file_id` text
);
--> statement-breakpoint
CREATE TABLE `valoraciones_inversion` (
	`fecha` text PRIMARY KEY NOT NULL,
	`valor_cent` integer NOT NULL
);
