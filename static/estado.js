// 📁 estado.js – Manejo global del estado de la aplicación

const estado = {
  sistema: "inactivo",     // otros posibles: escuchando, grabando, reproduciendo-texto, etc.
  micMuted: false,
  isRecording: false,
  primerTurno: true
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

// Registrar callback para cambios de estado
export function onEstadoChange(cb) {
  suscriptores.push(cb);
}

// Logging por consola para debug
onEstadoChange((clave, valor) => {
  console.log(`🧠 Estado actualizado: ${clave} →`, valor);
});
