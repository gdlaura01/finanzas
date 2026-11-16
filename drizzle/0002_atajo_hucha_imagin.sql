-- «Sacar de la hucha» confundía con pagar con Revolut: el atajo pasa a llamarse «Hucha → Imagin».
-- Solo si sigue con el nombre y el concepto de origen (si lo cambiaste, no se toca).
UPDATE atajos SET texto_boton = 'Hucha → Imagin', concepto = 'Traspaso de la hucha a Imagin'
WHERE texto_boton = 'Sacar de la hucha' AND concepto = 'Retirada de la hucha' AND clase = 'retirada';
