// 📁 ui.js – Manejo visual del estado y temporizador

import { detenerGrabacion } from './audio.js';
import { onEstadoChange, getEstado } from './estado.js';

// =======================
// Estado visual según cambio de sistema
// =======================
onEstadoChange((clave, valor) => {
  if (clave === "sistema") {
    setEstadoIcono(valor);
    actualizarIndicadorEstado(valor);
    document.body.setAttribute("data-estado-sistema", valor);
  }

  if (clave === "micMuted") {
    const micIcon = document.getElementById("mic-icon");
    const micBtn = document.getElementById("mic-btn");

    if (valor) {
      micIcon.className = "fas fa-microphone-slash text-muted";
      micBtn.classList.add("btn-mic-muted");
    } else {
      micIcon.className = "fas fa-microphone";
      micBtn.classList.remove("btn-mic-muted");
    }

    // Cortar grabación si muteás mientras hablás
    if (valor && getEstado("sistema") === "grabando") {
      import("./audio.js").then(modulo => {
        modulo.detenerGrabacion("mute-activado");
        console.log("🎙️ Grabación detenida por mute.");
      });
    }
  }
});

// =======================
// 🎛️ Visual del estado del sistema
// =======================
export function setEstadoIcono(estado) {
  const icono = document.getElementById("estado-icono");

  switch (estado) {
    case "esperando":
    case "escuchando":
      icono.innerHTML = `
        <div class="estado-icono estado-escucha position-relative d-flex align-items-center justify-content-center">
          <span class="estado-contenido"></span>
        </div>`;
      break;
    case "grabando":
      icono.innerHTML = `
        <div class="estado-icono estado-grabando position-relative d-flex align-items-center justify-content-center">
          <span id="grabacion-timer" class="text-white fw-light">00:00</span>
        </div>`;
      iniciarTemporizador();
      break;
    case "procesando-transcripcion":
    case "procesando-chat":
    case "cargando-audio":
    case "procesando-feedback":
      icono.innerHTML = `
        <div class="estado-icono estado-procesando d-flex align-items-center justify-content-center">
          <i class="fas fa-spinner fa-spin"></i>
        </div>`;
      break;
    case "hablando-reproduccion":
    case "reproduciendo-texto":
      icono.innerHTML = `
        <div class="estado-icono estado-hablando position-relative d-flex align-items-center justify-content-center">
          <span class="estado-contenido"></span>
        </div>`;
      break;
    default:
      icono.innerHTML = '';
  }
}

// =======================
// ⏱️ Temporizador de grabación
// =======================
let countdownInterval = null;
export let segundosGrabacion = 0;

export function iniciarTemporizador() {
  if (countdownInterval) return;
  resetearTemporizador();

  countdownInterval = setInterval(() => {
    segundosGrabacion++;

    const minutos = Math.floor(segundosGrabacion / 60).toString().padStart(2, "0");
    const segs = (segundosGrabacion % 60).toString().padStart(2, "0");

    const timerEl = document.getElementById("grabacion-timer");
    if (timerEl) timerEl.textContent = `${minutos}:${segs}`;

    if (segundosGrabacion === 30) {
      const circulo = document.querySelector(".estado-grabando");
      if (circulo) circulo.style.animationDuration = "0.8s";
    }

    if (segundosGrabacion >= 35) {
      detenerGrabacion("tiempo");
    }
  }, 1000);
}

export function resetearTemporizador() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  segundosGrabacion = 0;

  const timerEl = document.getElementById("grabacion-timer");
  if (timerEl) timerEl.textContent = "00:00";
}

// =======================
// 💬 Vista de feedback final (Paso 6)
// =======================
export function mostrarVistaFeedback(result) {
  for (let i = 1; i <= 7; i++) {
    const div = document.getElementById(`paso-${i}`);
    if (div) {
      div.classList.toggle("d-none", i !== 7);
      div.classList.toggle("d-flex", i === 7);
    }
  }

  const container = document.getElementById("feedback-render");
  if (!container) return;

  const nombreUsuario = JSON.parse(localStorage.getItem("usuario") || "{}").nombre || "el candidato";
  const nivel = result.nivel || "Desconocido";
  const observaciones = result.observaciones || [];

  const iconoPorTipo = {
    fortaleza: 'fas fa-check-circle text-success',
    mejora: 'fas fa-exclamation-triangle text-warning'
  };

  const bullets = observaciones.map(obs => `
    <li class="observacion-item">
      <i class="${iconoPorTipo[obs.tipo] || 'fas fa-info-circle text-muted'} me-2"></i>
      ${obs.texto}
    </li>
  `).join('');

  container.innerHTML = `
    <div class="container py-4 px-3" id="feedback-render">
      <h2 class="text-center mb-2">¡Buen trabajo, ${nombreUsuario}! 🎉</h2>
      <div class="text-center display-3 fw-bold text-primary">${nivel}</div>
      <div class="text-center text-muted mb-4">Tu nivel de inglés estimado</div>

      <ul class="lista-observaciones mb-4 text-muted">
        ${bullets}
      </ul>
    </div>
  `;
}


// =======================
// Texto de ayuda según estado
// =======================
export function actualizarIndicadorEstado(estado) {
  const el = document.getElementById("estado-indicador");
  const esPrimerTurno = getEstado("primerTurno");

  if (!el) return;

  let texto = "";
  switch (estado) {
    case "escuchando":
      texto = "Puedes empezar a hablar cuando estés listo.";
      break;
    case "grabando":
      texto = "Grabando... intenta hablar entre 15 y 30 segundos.";
      break;
    case "procesando-transcripcion":
    case "procesando-chat":
    case "cargando-audio":
      texto = esPrimerTurno
        ? "Preparando la entrevista..."
        : "Un momento... preparando la respuesta.";
      break;
    case "reproduciendo-texto":
      texto = "Anastasia está hablando.";
      break;
    default:
      el.classList.add("d-none");
      return;
  }

  el.textContent = texto;
  el.classList.remove("d-none");
}

// =======================
// 🎧 Control de botones de reproducción
// =======================
const estadosQuePermitenReproducir = ["escuchando"];

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    if (mutation.attributeName === "data-estado-sistema") {
      const estado = document.body.getAttribute("data-estado-sistema");
      const botones = document.querySelectorAll(".play-burbuja");

      botones.forEach(boton => {
        const esActivo = boton.classList.contains("activo-reproduccion");
        boton.disabled = esActivo ? false : !estadosQuePermitenReproducir.includes(estado);
      });
    }
  }
});

// Observador para estado del sistema (clase en body)
observer.observe(document.body, { attributes: true });
