// =======================
// 📁 botRender.js – Renderización de texto, animación y audio
// =======================

import {
  animateMouthViseme,
  closeMouthSmoothly,
  obtenerVisemaDesdeLetra,
  separarSilabasMultilenguaje,
  setBotSpeaking
} from './anastasiaAnimation.js';

import {
  startListening,
  startMonitoring,
  detenerGrabacion
} from './audio.js';
import { manejarTurnoDelUsuario } from './botLogic.js';
import { setEstado, getEstado } from './estado.js';

// 🎞️ Estado de animación y reproducción
let animationFrameId = null;
const cacheAudios = new Map(); // caché para no repetir peticiones TTS
let audioEnReproduccion = false;

// =======================
// 🔒 Helpers de estado del sistema
// =======================
function puedeReproducir() {
  const estado = getEstado("sistema");

  return (
    estado === "escuchando" ||
    estado === "reproduciendo-texto" ||
    estado === "reproduciendo-audio" ||
    estado === "cargando-audio"
  );
}
function puedeGrabar() {
  return getEstado("sistema") === "escuchando";
}

function deshabilitarTodosLosBotonesPlay() {
  document.querySelectorAll(".play-burbuja").forEach(btn => {
    // Solo deshabilita si NO tiene la clase especial
    if (!btn.classList.contains("activo-reproduccion")) {
      btn.disabled = true;
    } else {
      btn.disabled = false;
    }
  });
}

function habilitarTodosLosBotonesPlay() {
  document.querySelectorAll(".play-burbuja").forEach(btn => {
    btn.disabled = false;
  });
}

function crearBotonPlay(texto, spanElemento) {
  const contenedor = spanElemento.closest(".bubble-left");
  const contenedorBoton = document.createElement("div");
  contenedorBoton.className = "d-flex justify-content-end mt-1";
  contenedorBoton.innerHTML = `
    <button class="btn btn-link btn-sm text-secondary p-0 play-burbuja" title="Reproducir">
      <i class="fas fa-play"></i>
    </button>`;
  contenedor.appendChild(contenedorBoton);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => scrollAlFinalDelChat());
  });
  return contenedorBoton.querySelector(".play-burbuja");
}

function configurarEventoPlay(boton, texto, spanElemento) {
  const icono = boton.querySelector("i");
  const audioPlayer = document.getElementById("respuesta-audio");
  let reproduciendo = false;

  boton.onclick = () => {
    const yaReproduciendoEste = boton.classList.contains("activo-reproduccion");

    // 🔁 Si ya está reproduciendo este, entonces hacemos STOP
    if (yaReproduciendoEste) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      closeMouthSmoothly();
      cancelarAnimacionTexto();
      setEstado("sistema", "escuchando");

      boton.classList.remove("activo-reproduccion");
      boton.disabled = false;
      icono.classList.remove("fa-stop");
      icono.classList.add("fa-play");
      audioEnReproduccion = false;
      reproduciendo = false;
      habilitarTodosLosBotonesPlay();
      return;
    }

    // 🚫 Si hay otro audio sonando, ignoramos
    if (audioEnReproduccion || !puedeReproducir()) {
      console.warn("⛔ No se puede reproducir en este estado");
      return;
    }

    // 🛑 Si está grabando, detenerlo
    if (getEstado("sistema") === "grabando") {
      detenerGrabacion("interrupcion");
    }

    reproduciendo = true;
    audioEnReproduccion = true;
    setEstado("sistema", "reproduciendo-texto");

    // 👉 Limpiar clase en todos los botones, marcar el actual como activo
    document.querySelectorAll(".play-burbuja").forEach(b => b.classList.remove("activo-reproduccion"));
    boton.classList.add("activo-reproduccion");

    deshabilitarTodosLosBotonesPlay(); // Este respeta al activo

    icono.classList.remove("fa-play");
    icono.classList.add("fa-stop");

    leerTextoEnVozAlta(texto, spanElemento, () => {
      closeMouthSmoothly();
      setEstado("sistema", "escuchando");

      boton.classList.remove("activo-reproduccion");
      boton.disabled = false;
      icono.classList.remove("fa-stop");
      icono.classList.add("fa-play");
      reproduciendo = false;
      audioEnReproduccion = false;
      habilitarTodosLosBotonesPlay();
    }, true);
  };
}


// =======================
// ▶️ Asigna botón de reproducción a una burbuja del bot
// =======================
export function asignarBotonPlayABurbuja(texto, spanElemento) {
  const btnPlay = crearBotonPlay(texto, spanElemento);
  btnPlay.disabled = !puedeReproducir() || audioEnReproduccion;
  configurarEventoPlay(btnPlay, texto, spanElemento);
}

// =======================
// 🗯️ Renderiza una nueva burbuja del bot
// =======================
export function renderizarBurbujaDeBot(texto, mostrarAnimacion = true) {
  const contenedorChat = document.getElementById("chat");
  const contenedorBurbuja = document.createElement("div");
  contenedorBurbuja.classList.add("d-flex", "justify-content-start", "mb-2");
  contenedorBurbuja.innerHTML = `
    <div class="bubble-left d-flex flex-column position-relative">
      <div class="nombre-emisor text-muted small mb-1">Anastasia</div>
      <span class="texto-burbuja ${mostrarAnimacion ? 'animacion-puntos' : ''}"></span>
    </div>`;
  contenedorChat.appendChild(contenedorBurbuja);

  requestAnimationFrame(() => scrollAlFinalDelChat());
  return contenedorBurbuja.querySelector(".texto-burbuja");
}

// =======================
// 🤖 Reproducir texto, animar, y manejar flujo
// =======================
export function reproducirTextoYAnimar(
  texto,
  perfilUsuario,
  historialConversacion,
  onComplete = null,
  skipListening = false,
  soloAnimar = false
) {
  const audioPlayer = document.getElementById("respuesta-audio");

  if (!audioPlayer.paused) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    closeMouthSmoothly();
    cancelarAnimacionTexto?.();
    audioEnReproduccion = false;
  }

  let spanDestino;
  if (soloAnimar) {
    const spans = document.querySelectorAll(".bubble-left span.texto-burbuja");
    spanDestino = spans[spans.length - 1];
  } else {
    spanDestino = renderizarBurbujaDeBot(texto, true);
  }

  if (!soloAnimar) setEstado("sistema", "cargando-audio");

  leerTextoEnVozAlta(texto, spanDestino, () => {
    closeMouthSmoothly();
    setEstado("sistema", "escuchando");

    if (!soloAnimar) {
      asignarBotonPlayABurbuja(texto, spanDestino);
    }

    if (typeof onComplete === "function") {
      onComplete();
    } else if (!skipListening && puedeGrabar()) {
      startListening(texto => mostrarRespuestaDelUsuario(texto, perfilUsuario, historialConversacion))
        .then(() => startMonitoring());
    }
  }, soloAnimar);
}

// =======================
// 🔊 Lectura en voz alta + animación
// =======================
export function leerTextoEnVozAlta(texto, contenedorSpan, onEnd, soloAnimar = false) {
  const audioPlayer = document.getElementById("respuesta-audio");

  if (!soloAnimar && !puedeReproducir()) {
    console.warn("⛔ Reproducción bloqueada por estado actual");
    return;
  }

  deshabilitarTodosLosBotonesPlay();

  const finalizarReproduccion = () => {
    onEnd();
    audioEnReproduccion = false;
  };

  const reproducir = (src) => {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    audioPlayer.src = src;
    audioPlayer.onended = finalizarReproduccion;
    audioPlayer.volume = 1.0;

    audioPlayer.play().then(() => {
      if (!soloAnimar) {
        setEstado("sistema", "reproduciendo-texto");
      }
      sincronizarTextoConAudio(texto, contenedorSpan, audioPlayer, soloAnimar);
    }).catch(err => console.error("❌ Error al reproducir audio:", err));
  };

  if (cacheAudios.has(texto)) {
    reproducir(cacheAudios.get(texto));
    return;
  }

  fetch("/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: texto })
  })
    .then(res => res.blob())
    .then(audioBlob => {
      const url = URL.createObjectURL(audioBlob);
      cacheAudios.set(texto, url);
      reproducir(url);
    });
}

// =======================
// 🔁 Sincronizar texto y visemas con el audio
// =======================
function sincronizarTextoConAudio(texto, contenedorTexto, audioPlayer, soloAnimar = false) {
  const silabas = separarSilabasMultilenguaje(texto);
  if (!soloAnimar) {
    contenedorTexto.classList.remove("animacion-puntos");
    contenedorTexto.textContent = "";
  }

  setBotSpeaking(true);

  const duracion = audioPlayer.duration || 1;
  const total = silabas.length;
  let i = 0;

  function animar() {
    if (audioPlayer.paused || audioPlayer.ended) {
      animationFrameId = null;
      closeMouthSmoothly();
      return;
    }

    const progreso = audioPlayer.currentTime / duracion;
    const objetivoIndex = Math.floor(progreso * total);

    while (i <= objetivoIndex && i < total) {
      const silaba = silabas[i];
      if (!soloAnimar) {
        contenedorTexto.textContent += silaba;
        scrollAlFinalDelChat();
      }
      const letraCentral = silaba[Math.floor(silaba.length / 2)] || ' ';
      const visema = obtenerVisemaDesdeLetra(letraCentral);
      if (visema) animateMouthViseme(visema);
      i++;
    }

    if (i < total) {
      animationFrameId = requestAnimationFrame(animar);
    } else {
      closeMouthSmoothly(); // Cierre suave al final
    }
  }

  animationFrameId = requestAnimationFrame(animar);
}

// =======================
// 💬 Renderizar respuesta del usuario
// =======================
export function mostrarRespuestaDelUsuario(mensaje, perfilUsuario, historialConversacion, soloRender = false) {
  const contenedorChat = document.getElementById("chat");
  const burbujaUsuario = document.createElement("div");

  burbujaUsuario.classList.add("d-flex", "justify-content-end", "mb-2");
  burbujaUsuario.innerHTML = `
    <div class="bubble-right d-flex flex-column position-relative">
      <div>${mensaje}</div>
    </div>`;

  contenedorChat.appendChild(burbujaUsuario);
  contenedorChat.scrollTop = contenedorChat.scrollHeight;

  if (!soloRender) {
    manejarTurnoDelUsuario(perfilUsuario, historialConversacion, mensaje);
  }
}

// =======================
// ⛔ Cancelar animación actual de texto
// =======================
export function cancelarAnimacionTexto() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

export function scrollAlFinalDelChat() {
  const chat = document.getElementById("chat");
  if (chat) {
    chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
  }
}
