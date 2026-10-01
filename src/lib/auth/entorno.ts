/** Ayudas para escribir .env.local desde `npm run crear-acceso`. */

/** Next expande `$VAR` al leer .env: los `$` del hash van escapados. */
export const escaparDolar = (s: string) => s.replace(/\$/g, "\\$");

/** Sustituye o añade claves en el texto de un .env, sin tocar el resto. */
export function actualizarEnv(texto: string, valores: Record<string, string>) {
  const lineas = texto ? texto.replace(/\n$/, "").split("\n") : [];
  for (const [clave, valor] of Object.entries(valores)) {
    const i = lineas.findIndex((l) => new RegExp(`^\\s*${clave}\\s*=`).test(l));
    const linea = `${clave}=${valor}`;
    if (i >= 0) lineas[i] = linea;
    else lineas.push(linea);
  }
  return lineas.join("\n") + "\n";
}
