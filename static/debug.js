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
