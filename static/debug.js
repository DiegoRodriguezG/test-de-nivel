// debug.js

export function logDev(...args) {
  if (location.hostname === "localhost") {
    console.log(...args);
  }
}

export function warnDev(...args) {
  if (location.hostname === "localhost") {
    console.warn(...args);
  }
}

export function errorDev(...args) {
  if (location.hostname === "localhost") {
    console.error(...args);
  }
}

// Helper para construir URLs de API con el prefijo correcto
export function apiUrl(path) {
  // Obtener el base path desde el script actual
  const scriptSrc = document.querySelector('script[src*="main.js"]')?.src || '';
  const match = scriptSrc.match(/(.*?)\/static\//);
  const basePath = match ? match[1] : '';
  return basePath + path;
}
