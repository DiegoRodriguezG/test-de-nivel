// =======================
// 📁 botLogic.js – Lógica de conversación y evaluación
// =======================

// 🔗 Importaciones
import { mostrarVistaFeedback } from './ui.js';
import { reproducirTextoYAnimar } from './botRender.js';
import { setEstado, getEstado } from './estado.js';

// =======================
// 🧠 Parámetros de evaluación
// =======================
const UMBRAL_RESPUESTAS_VALIDAS = 4;
const UMBRAL_TOTAL_INFORMATIVO = 14;

// =======================
// 🔧 Estado interno de conversación
// =======================
let totalValorInformativo = 0;
let cantidadRespuestasValidas = 0;
let evaluacionFinalizada = false;

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
    
    return;
  }

  const entradaActual = historialConversacion[historialConversacion.length - 1];
  if (entradaActual && !entradaActual.respuesta) {
    entradaActual.respuesta = mensajeDelUsuario;
  } else {
    historialConversacion.push({ respuesta: mensajeDelUsuario });
  }

  guardarHistorial(historialConversacion);

  const prompt = construirPromptDelBot(perfilUsuario, historialConversacion, mensajeDelUsuario);
  setEstado("sistema", "procesando-chat");

  fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt })
  })
    .then(res => res.json())
    .then(data => evaluarYProcesarRespuestaDelBot(data, perfilUsuario, historialConversacion))
    .catch(err => console.error("❌ Error en conversación con el bot:", err));
}

function guardarHistorial(historial) {
  try {
    const serializado = JSON.stringify(historial, null, 2);
    localStorage.setItem("historial", serializado);
    console.log("🧠 Historial actualizado:\n", serializado);
  } catch (err) {
    console.error("❌ Error guardando historial:", err);
  }
}

// =======================
// 📊 Evaluación y flujo de seguimiento
// =======================

function evaluarYProcesarRespuestaDelBot(data, perfilUsuario, historialConversacion) {
  const preguntaGenerada = data.reply;
  const valorInformativo = data.info_value ?? 0;

  if (!preguntaGenerada) {
    console.warn("⚠️ Respuesta vacía del bot.");
    return;
  }

  if (!evaluacionFinalizada) {
    historialConversacion.push({ pregunta: preguntaGenerada });
    guardarHistorial(historialConversacion);
  }

  if (valorInformativo >= 3) {
    totalValorInformativo += valorInformativo;
    cantidadRespuestasValidas++;

    localStorage.setItem("valorInformativo", totalValorInformativo);
    localStorage.setItem("respuestasValidas", cantidadRespuestasValidas);
  }

  actualizarBarraDeProgreso();

  if (!evaluacionFinalizada && cumpleCondicionesDeEvaluacion()) {
    evaluacionFinalizada = true;
    localStorage.setItem("evaluacionFinal", "true");

    cerrarEntrevistaYEvaluarUsuario(perfilUsuario, historialConversacion);
  } else {
    setEstado("sistema", "reproduciendo-texto");
    reproducirTextoYAnimar(preguntaGenerada, perfilUsuario, historialConversacion);
  }
}

function cumpleCondicionesDeEvaluacion() {
  return (
    cantidadRespuestasValidas >= UMBRAL_RESPUESTAS_VALIDAS &&
    totalValorInformativo >= UMBRAL_TOTAL_INFORMATIVO
  );
}

function cerrarEntrevistaYEvaluarUsuario(perfilUsuario, historialConversacion) {
  const mensajeFinal = obtenerMensajeCierre(perfilUsuario);
  setEstado("sistema", "reproduciendo-texto");

  reproducirTextoYAnimar(mensajeFinal, perfilUsuario, historialConversacion, () => {
    setEstado("sistema", "procesando-feedback");

    console.log("📤 Enviando historial a /evaluate:");
    console.log(historialConversacion);
    console.log("✔️ JSON serializado:", JSON.stringify({ historial: historialConversacion }));

    fetch("/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ historial: historialConversacion })
    })
      .then(res => res.json())
      .then(result => {
        localStorage.setItem("evaluacionFinal", "true");
        localStorage.setItem("feedbackResultado", JSON.stringify(result));

        const evento = new CustomEvent("evaluacionCompletada", {
          detail: { result }
        });
        console.log("🚀 Dispatching evento evaluacionCompletada");
        window.dispatchEvent(evento);
      })
      .catch(err => console.error("❌ Error en evaluación final:", err));
  });
}

// =======================
// 📈 Progreso visual
// =======================

function actualizarBarraDeProgreso() {
  const porcentaje = Math.min(
    100,
    Math.round((totalValorInformativo / UMBRAL_TOTAL_INFORMATIVO) * 100)
  );
  document.getElementById("barra-feedback").style.width = `${porcentaje}%`;
  document.getElementById("texto-feedback").textContent = `${porcentaje}%`;
}

// =======================
// 📨 Prompts y mensajes del bot
// =======================

function obtenerMensajeSaludo(usuario) {
  return usuario.nivel === "bajo"
    ? `Hola ${usuario.nombre}, te doy la bienvenida a esta entrevista para el cargo de ${usuario.cargo}. Soy Anastasia y te acompañaré el día de hoy. Esta entrevista será en inglés ¿Todo listo para comenzar?`
    : `Hola ${usuario.nombre}, te doy la bienvenida a esta entrevista para el cargo de ${usuario.cargo}. Soy Anastasia y te acompañaré el día de hoy. This interview will be in English. Are you ready to begin?`
}

function obtenerMensajeCierre(usuario) {
  return `Thank you, ${usuario.nombre}. I have enough information to give you feedback on your English level. Let me analyze your performance.`;
}

export function construirPromptDelBot(perfilUsuario, historialConversacion, mensajeDelUsuario) {
  const ultimas = historialConversacion
    .slice(-4)
    .map(item => {
      const q = item.pregunta ? `Q: ${item.pregunta}` : "";
      const a = item.respuesta ? `A: ${item.respuesta}` : "";
      return `${q}
${a}`.trim();
    })
    .filter(Boolean)
    .join("\n\n");

  return `
You are Anastasia, a professional and friendly interviewer simulating a job interview in English for the role of ${perfilUsuario.cargo}. The candidate is ${perfilUsuario.nombre} and their English level is ${perfilUsuario.nivel}.

Your job is to guide the conversation, help the candidate speak, and assess how informative their answers are for evaluating their English level.

You can:
- Ask new job interview questions
- Rephrase or repeat questions if needed
- Encourage the candidate to elaborate
- Give light feedback or clarification

Do **not** introduce a new topic or question if the candidate did not properly answer the last one. In that case, kindly help them give a better answer to the same question.
Try to cover different subjects during the conversation.
Try to match your language complexity to the candidate's English level (${perfilUsuario.nivel}), using simpler structures if needed to ensure understanding and fluency.

After each exchange, return a score called "info_value" from 1 to 5:
- 1 = no usable information
- 3 = acceptable but basic response
- 5 = rich, detailed answer that helps evaluate fluency

Always respond using this JSON format:
{
  "reply": "your full reply here",
  "info_value": 1 to 5
}

Here are the last interactions:
${ultimas}

Candidate's last message:
${mensajeDelUsuario}`;
}

export function limpiarMemoriaLocal() {
  localStorage.removeItem("historial");
  localStorage.removeItem("usuario");
  localStorage.removeItem("evaluacionFinal");
  localStorage.removeItem("valorInformativo");
  localStorage.removeItem("respuestasValidas");
  localStorage.removeItem("feedbackResultado");
}


export function importarProgresoEvaluacion(valorInfo, respuestasValidas) {
  totalValorInformativo = valorInfo;
  cantidadRespuestasValidas = respuestasValidas;
  actualizarBarraDeProgreso(); // ⬅️ se actualiza la barra visual
}

