// =======================
// 📁 botLogic.js – Lógica de conversación y evaluación
// =======================

// 🔗 Importaciones
import { logDev, errorDev, warnDev } from './debug.js';
import { mostrarVistaFeedback } from './ui.js';
import { reproducirTextoYAnimar } from './botRender.js';
import { setEstado, getEstado } from './estado.js';
import { apagarTodoAudio } from './audio.js';
import {
  evaluarProgreso,
  calcularW,
  actualizarDistribucion,
  deberiaFinalizarTest,
  obtenerNivelDominante
} from './evaluacion.js';

import { DESCRIPCIONES_TIPO, seleccionarTipoParaPrompt } from './selectorTipos.js';

// =======================
// 🔧 Estado interno de conversación
// =======================
let evaluacionFinalizada = false;
let P_actual = { A1: 20, A2: 20, B1: 20, B2: 20, C1: 20 }; // distribución inicial uniforme
let historialQ = [];
let turnosUtiles = 0;
let historialEvaluacion = [];

function obtenerDistribucionInicial(nivelDeclarado) {
  switch (nivelDeclarado?.toLowerCase()) {
    case "bajo":
      return { A1: 40, A2: 30, B1: 20, B2: 5, C1: 5 };
    case "medio":
      return { A1: 10, A2: 20, B1: 40, B2: 20, C1: 10 };
    case "alto":
      return { A1: 5, A2: 10, B1: 25, B2: 35, C1: 25 };
    default:
      return { A1: 20, A2: 20, B1: 20, B2: 20, C1: 20 }; // fallback
  }
}

// =======================
// 🗣️ Manejo de turnos del usuario
// =======================

/**
 * Controla el flujo del turno del usuario: saludo inicial o construcción de prompt y llamada a la API
 */
export function manejarTurnoDelUsuario(perfilUsuario, historialConversacion, mensajeDelUsuario = null) {
  if (getEstado("primerTurno")) {
    const saludo = obtenerMensajeSaludo(perfilUsuario);

    historialConversacion.push({ pregunta: saludo });
    guardarHistorial(historialConversacion);
    reproducirTextoYAnimar(saludo, perfilUsuario, historialConversacion);
    
    setEstado("primerTurno", false);
    localStorage.setItem("primerTurno", "false");
    
    // 🔧 Inicializar P_actual según el nivel declarado por el usuario
    const nivelDeclarado = perfilUsuario.nivel; // "bajo", "medio", "alto"
    P_actual = obtenerDistribucionInicial(nivelDeclarado);
    logDev("📌 Distribución inicial basada en nivel declarado:", P_actual);

    return;
  }

  const entradaActual = historialConversacion[historialConversacion.length - 1];
  if (entradaActual && !entradaActual.respuesta) {
    entradaActual.respuesta = mensajeDelUsuario;
  } else {
    historialConversacion.push({ respuesta: mensajeDelUsuario });
  }

  guardarHistorial(historialConversacion);

  const tipo = seleccionarTipoParaPrompt(P_actual, historialConversacion);
  logDev("📌 Tipo de pregunta seleccionada:", tipo);
  const prompt = construirPromptDelBot(perfilUsuario, historialConversacion, mensajeDelUsuario, tipo);

  setEstado("sistema", "procesando-chat");

  fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt })
  })
    .then(res => res.json())
    .then(data => {
      data.tipo = tipo; // 👈 inyectamos el tipo para guardarlo más adelante
      evaluarYProcesarRespuestaDelBot(data, perfilUsuario, historialConversacion);
    })
    .catch(err => errorDev("❌ Error en conversación con el bot:", err));
}

function guardarHistorial(historial) {
  try {
    const serializado = JSON.stringify(historial, null, 2);
    localStorage.setItem("historial", serializado);
    setEstado("historialConversacion", historial);
    logDev("🧠 Historial actualizado:\n", serializado);
  } catch (err) {
    errorDev("❌ Error guardando historial:", err);
  }
}

// =======================
// 📊 Evaluación y flujo de seguimiento
// =======================
function evaluarYProcesarRespuestaDelBot(data, perfilUsuario, historialConversacion) {
  const preguntaGenerada = data.reply;
  const Q = data.Q ?? 0;
  const P_nueva = data.P_nueva; // esperado: { A1: 10, A2: 20, ..., C1: 10 }

  logDev("🧠 Respuesta del modelo:");
  logDev("🔹 Pregunta generada:", preguntaGenerada);
  logDev("🔹 Q (calidad):", Q);
  logDev("🔹 P_nueva (nivel estimado por turno):", P_nueva);

  if (!preguntaGenerada || !P_nueva) {
    warnDev("⚠️ Faltan datos de respuesta del bot.");
    return;
  }

  historialQ.push(Q);

  P_actual = actualizarDistribucion(P_actual, P_nueva, Q);

  historialEvaluacion.push({ P_nueva, Q }); // 👈 nuevo registro

  if (Q >= 0.5) {
    turnosUtiles++;
    logDev("✅ Turno útil registrado. Total:", turnosUtiles);
  }

  const progreso = evaluarProgreso(turnosUtiles);
  actualizarBarraDeProgreso(progreso);

  if (!evaluacionFinalizada) {
    historialConversacion.push({
      pregunta: preguntaGenerada,
      tipo: data.tipo,
      Q: Q,
      P_nueva: P_nueva
    });
    guardarHistorial(historialConversacion);
    logDev("📊 P_actual (distribución acumulada actualizada):", P_actual);
  }

  logDev("⏳ Evaluando fin anticipado...");
  logDev("  - Turnos útiles:", turnosUtiles);
  logDev("  - Nivel dominante actual:", obtenerNivelDominante(P_actual));
  logDev("  - Historial Q:", historialQ.join(", "));

  if (!evaluacionFinalizada && deberiaFinalizarTest(P_actual, historialQ, turnosUtiles)) {
    evaluacionFinalizada = true;
    localStorage.setItem("evaluacionFinal", "true");
    cerrarTestYDarFeedback(perfilUsuario, historialConversacion);
    logDev("🛑 Test finalizado por early stop");
  } else {
    setEstado("sistema", "reproduciendo-texto");
    reproducirTextoYAnimar(preguntaGenerada, perfilUsuario, historialConversacion);
  }
}

function cerrarTestYDarFeedback(perfilUsuario, historialConversacion) {
  apagarTodoAudio(); // cortar todo antes de que el bot hable
  setEstado("micMuted", true); // fuerza muteo para bloquear escucha

  const mensajeFinal = obtenerMensajeCierre(perfilUsuario);
  setEstado("sistema", "reproduciendo-texto");

  reproducirTextoYAnimar(
    mensajeFinal,
    perfilUsuario,
    historialConversacion,
    () => {
      setEstado("sistema", "procesando-feedback");

      fetch("/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historial: historialConversacion, evaluacion_cruda: historialEvaluacion})
      })
        .then(res => res.json())
        .then(result => {
          localStorage.setItem("evaluacionFinal", "true");
          localStorage.setItem("feedbackResultado", JSON.stringify(result));
          localStorage.setItem("evaluacionCruda", JSON.stringify(historialEvaluacion));

          const evento = new CustomEvent("evaluacionCompletada", {
            detail: { result }
          });
          window.dispatchEvent(evento);
        })
        .catch(err => errorDev("❌ Error en evaluación final:", err));
    },
    true // <-- este es el cambio CLAVE: skipListening = true
  );
}

// =======================
// 📈 Progreso visual
// =======================

function actualizarBarraDeProgreso(progreso) {
  document.getElementById("barra-feedback").style.width = `${progreso}%`;
  document.getElementById("texto-feedback").textContent = `${progreso}%`;
}

// =======================
// 📨 Prompts y mensajes del bot
// =======================

function obtenerMensajeSaludo(usuario) {
  return `Hola ${usuario.nombre}, te doy la bienvenida. Vamos a conversar en ${usuario.idioma} sobre "${usuario.situacion}" para estimar tu nivel de idioma. ¿Listo para empezar?`;
}

function obtenerMensajeCierre(usuario) {
  return `Thank you, ${usuario.nombre}. I have enough information to give you feedback on your English level. Let me analyze your performance.`;
}

export function construirPromptDelBot(perfilUsuario, historialConversacion, mensajeDelUsuario, tipo) {
  const nivelTarget = obtenerNivelDominante(P_actual);
  const { nombre, idioma, situacion, nivel: nivelEstimado } = perfilUsuario;
  const tipoInfo = DESCRIPCIONES_TIPO[tipo] || { descripcion: "pregunta útil para evaluar el idioma", ejemplo: "" };

  const contexto = historialConversacion
    .slice(-3)
    .map(item => {
      const q = item.pregunta ? `Bot: ${item.pregunta}` : "";
      const a = item.respuesta ? `Usuario: ${item.respuesta}` : "";
      return [q, a].filter(Boolean).join("\n");
    })
    .join("\n\n");

  return `
  [Parámetros del turno]
  - Idioma objetivo para hablar y preguntar: ${idioma}
  - Idioma nativo del usuario: español
  - Tema / situación: "${situacion}"
  - Nivel CEFR estimado actual: ${nivelTarget}
  - Tipo de intervención solicitada: "${tipo}" (${tipoInfo.descripcion}) ${tipoInfo.ejemplo ? `- Ejemplo: "${tipoInfo.ejemplo}"` : ""}

  [Objetivo]
  Genera una sola intervención conversacional que:
  1) sea del tipo indicado,
  2) esté adaptada al nivel indicado,
  3) fomente una respuesta útil para evaluar.


  [Contexto]
  Último mensaje del usuario:
  "${mensajeDelUsuario}"

  Historial reciente de la conversación:
  ${contexto}

  Recuerda: mantén una conversación fluida y real.
  `;
}


export function limpiarMemoriaLocal() {
  localStorage.removeItem("historial");
  localStorage.removeItem("usuario");
  localStorage.removeItem("evaluacionFinal");
  localStorage.removeItem("feedbackResultado");
}
