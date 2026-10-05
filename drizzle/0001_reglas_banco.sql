-- Reglas para cómo escribe Imagin algunos conceptos que las reglas de la hoja no reconocían.
-- Solo se añaden si existe su grupo y si no hay ya una regla igual; van las primeras.
INSERT INTO reglas_importacion (patron, grupo_id, etiqueta, prioridad)
SELECT 'econoil|plenoil|petroil|^eess |^e\. ?s\. ', g.id, 'Trabajo', COALESCE((SELECT MIN(prioridad) FROM reglas_importacion), 20) - 10
FROM grupos g WHERE g.nombre = 'Gasolina'
AND NOT EXISTS (SELECT 1 FROM reglas_importacion WHERE patron = 'econoil|plenoil|petroil|^eess |^e\. ?s\. ');
--> statement-breakpoint
INSERT INTO reglas_importacion (patron, grupo_id, etiqueta, prioridad)
SELECT 'anthropic', g.id, NULL, COALESCE((SELECT MIN(prioridad) FROM reglas_importacion), 20) - 10
FROM grupos g WHERE g.nombre = 'IA'
AND NOT EXISTS (SELECT 1 FROM reglas_importacion WHERE patron = 'anthropic');
--> statement-breakpoint
INSERT INTO reglas_importacion (patron, grupo_id, etiqueta, prioridad)
SELECT 'viryi nails|^bk', g.id, NULL, COALESCE((SELECT MIN(prioridad) FROM reglas_importacion), 20) - 10
FROM grupos g WHERE g.nombre = 'Caprichos'
AND NOT EXISTS (SELECT 1 FROM reglas_importacion WHERE patron = 'viryi nails|^bk');
--> statement-breakpoint
INSERT INTO reglas_importacion (patron, grupo_id, etiqueta, prioridad)
SELECT '^h m$|\beci\b', g.id, NULL, COALESCE((SELECT MIN(prioridad) FROM reglas_importacion), 20) - 10
FROM grupos g WHERE g.nombre = 'Ropa'
AND NOT EXISTS (SELECT 1 FROM reglas_importacion WHERE patron = '^h m$|\beci\b');
