import { abrirBaseDatos } from "../src/db";
import { sembrar } from "../src/db/semilla";

const hecho = sembrar(abrirBaseDatos());
console.log(hecho ? "Datos iniciales cargados." : "La base de datos ya tenía datos: no se ha tocado nada.");
