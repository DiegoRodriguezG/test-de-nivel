// 📁 estado.js – Manejo global del estado de la aplicación

import { logDev, errorDev, warnDev } from './debug.js';

const estado = {
  sistema: "inactivo",           // otros posibles: escuchando, grabando, reproduciendo-texto, etc.
  micMuted: false,
  isRecording: false,
  primerTurno: true,
  usuario: {
    nombre: "",
    idioma: "",
    situacion: "",
    nivel: ""
  },
  historialConversacion: []
};

const suscriptores = [];

// Obtener todo el estado o una clave específica
export function getEstado(clave = null) {
  return clave ? estado[clave] : { ...estado };
}

// Cambiar valor de una clave del estado y notificar a suscriptores
export function setEstado(clave, valor) {
  if (estado[clave] === valor) return;
  estado[clave] = valor;
  suscriptores.forEach(cb => cb(clave, valor));
}

// Actualizar parte de un objeto (por ejemplo, solo el nombre del usuario)
export function actualizarEstadoParcial(clave, cambiosParciales) {
  if (typeof estado[clave] !== "object" || estado[clave] === null) {
    errorDev(`❌ No se puede actualizar parcialmente ${clave}: no es un objeto.`);
    return;
  }
  estado[clave] = { ...estado[clave], ...cambiosParciales };
  suscriptores.forEach(cb => cb(clave, estado[clave]));
}

// Registrar callback para cambios de estado
export function onEstadoChange(cb) {
  suscriptores.push(cb);
}

// Logging por consola para debug
onEstadoChange((clave, valor) => {
  logDev(`🧠 Estado actualizado: ${clave} →`, valor);
});
