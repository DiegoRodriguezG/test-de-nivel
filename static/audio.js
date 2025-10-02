// =======================
// 📁 audio.js – Manejo de grabación y detección de voz
// =======================

import { logDev, errorDev, warnDev, apiUrl } from './debug.js';
import { setEstado, getEstado } from './estado.js';
import { resetearTemporizador } from './ui.js';

// =======================
// 🔧 Estado interno
// =======================
let recorder, audioContext, input, analyser;
let silenceStart = null;
let chunks = [];
let isEscuchandoActivo = false;

export function reactivarEscuchaSegura() {
  const estado = getEstado("sistema");
  if (!["procesando-feedback", "feedback-finalizado"].includes(estado)) {
    setEstado("sistema", "escuchando");
  } else {
    logDev("🔒 Escucha bloqueada por estado final:", estado);
  }
}

// =======================
// 🔁 Toggle de mute
// =======================
export function toggleMicMuted() {
  const actual = getEstado("micMuted");
  setEstado("micMuted", !actual);
  return !actual;
}

export function getMicMuted() {
  return getEstado("micMuted");
}

// =======================
// 🧹 Detener recursos de audio activos
// =======================
export function detenerRecursosDeAudio() {
  try {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    if (audioContext && typeof audioContext.close === "function") {
      audioContext.close().catch(err => warnDev("⚠️ Error cerrando audioContext:", err));
    }
  } catch (e) {
    warnDev("⚠️ Error limpiando recursos de audio:", e);
  }

  recorder = null;
  audioContext = null;
  input = null;
  analyser = null;
  silenceStart = null;
  chunks = [];
}

// =======================
// ✅ Evaluar si se debe escuchar
// =======================
export function evaluarCondicionesDeEscucha() {
  if (getEstado("micMuted")) {
    logDev("🎙️ Micrófono muteado. No se activará escucha.");
    return;
  }

  if (getEstado("sistema") !== "escuchando") {
    logDev("🔕 Sistema no en modo escuchando. Abortando escucha.");
    return;
  }

  if (isEscuchandoActivo) {
    logDev("⏳ Escucha ya activa. No se reinicia.");
    return;
  }

  isEscuchandoActivo = true;

  startListening(texto => {
    const usuario = getEstado("usuario");
    const historial = getEstado("historialConversacion");
    import('./botRender.js').then(m => {
      m.mostrarRespuestaDelUsuario(texto, usuario, historial);
    });
  }).then(() => {
    if (getEstado("micMuted")) {
      logDev("🎙️ Micrófono muteado después de iniciar escucha. Cancelando.");
      detenerRecursosDeAudio();
      return;
    }
    startMonitoring();
  }).finally(() => {
    isEscuchandoActivo = false;
  });
}

// =======================
// 🎙️ Inicio de grabación y escucha del micrófono
// =======================
export function startListening(onTranscript = null) {
  if (getEstado("sistema") === "procesando-feedback") {
    logDev("🎧 Bloqueado: estamos en feedback final");
    return Promise.resolve();
  }

  if (getEstado("micMuted")) {
    warnDev("🎙️ Micrófono está en mute. Grabación bloqueada.");
    return Promise.resolve();
  }

  if (["reproduciendo-audio", "grabando", "procesando-transcripcion"].includes(getEstado("sistema"))) {
    warnDev("⛔ No se puede grabar en el estado actual.");
    return Promise.resolve();
  }

  if (recorder && recorder.state !== "inactive") {
    logDev("🧹 Deteniendo recorder anterior antes de iniciar uno nuevo");
    recorder.stop();
  }
  recorder = null;

  if (audioContext && typeof audioContext.close === "function") {
    audioContext.close().catch(err => warnDev("⚠️ Error cerrando audioContext:", err));
    audioContext = null;
  }

  input = null;
  analyser = null;
  chunks = [];

  return navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    if (getEstado("micMuted")) {
      warnDev("🎙️ Micrófono estaba en mute tras getUserMedia. Abortando.");
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    reactivarEscuchaSegura();

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    input = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    input.connect(analyser);
    analyser.fftSize = 2048;

    recorder = configurarMediaRecorder(stream, msg => {
      logDev("📝 Transcripción recibida en startListening:", msg);
      if (onTranscript) onTranscript(msg);
    });

    setEstado("isRecording", false);
  });
}

// =======================
// 📈 Monitoreo automático de volumen (silencio/voz)
// =======================
export function startMonitoring() {
  const estadoSistema = getEstado("sistema");

  if (
    estadoSistema !== "escuchando" ||
    getEstado("micMuted") ||
    estadoSistema === "reproduciendo-audio" ||
    estadoSistema === "cargando-audio"
  ) {
    warnDev("🎧 Monitoreo no permitido en estado actual:", estadoSistema);
    return;
  }

  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);

  // 💡 Configuración
  const UMBRAL_VOLUMEN = 0.02;

  const nivel = getEstado("usuario")?.nivel || "medio";
  const TIEMPO_SILENCIO_MS = nivel === "bajo" ? 3000 : 2000;
  
  const detectSpeech = () => {
    const estadoActual = getEstado("sistema");

    if (
      (estadoActual !== "escuchando" && estadoActual !== "grabando") ||
      getEstado("micMuted") || !recorder
    ) {
      return requestAnimationFrame(detectSpeech);
    }

    analyser.getByteTimeDomainData(dataArray);
    const volume = Math.sqrt(
      dataArray.reduce((sum, val) => {
        const v = (val - 128) / 128;
        return sum + v * v;
      }, 0) / bufferLength
    );

    if (volume > UMBRAL_VOLUMEN) {
      if (
        getEstado("sistema") === "escuchando" &&
        recorder.state === "inactive" &&
        !getEstado("isRecording")
      ) {
        logDev("🎙️ Detectado inicio de voz");
        setEstado("isRecording", true);
        setEstado("sistema", "grabando");
        recorder.start();
      }
      silenceStart = null;
    } else if (getEstado("sistema") === "grabando") {
      silenceStart = silenceStart || Date.now();
      if (Date.now() - silenceStart > TIEMPO_SILENCIO_MS) {
        detenerGrabacion("silencio");
        return;
      }
    }

    requestAnimationFrame(detectSpeech);
  };

  detectSpeech();
}

// =======================
// ⏹️ Detener grabación y procesar audio
// =======================
export function detenerGrabacion(motivo = "manual") {
  resetearTemporizador();
  if (recorder && getEstado("sistema") === "grabando") {
    logDev(`🛑 Grabación detenida por: ${motivo}`);
    recorder.stop();
    setEstado("isRecording", false);
    silenceStart = null;

    if (motivo !== "interrupcion") {
      setEstado("sistema", "procesando-transcripcion");
    } else {
      reactivarEscuchaSegura();
    }
  } else {
    warnDev("⛔ Intento de detener grabación sin recorder activo.");
    setEstado("isRecording", false);
    reactivarEscuchaSegura();
  }
}

// =======================
// 🧠 Procesamiento del audio grabado
// =======================
function configurarMediaRecorder(stream, onTranscript) {
  const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: "audio/webm" });
    chunks = [];

    if (audioContext && typeof audioContext.close === "function") {
      try {
        await audioContext.close();
      } catch (err) {
        warnDev("⚠️ Error cerrando audioContext:", err);
      }
      audioContext = null;
      input = null;
      analyser = null;
    }

    if (blob.size === 0) {
      warnDev("⚠️ Blob vacío, omitiendo transcripción.");
      if (getEstado("sistema") === "procesando-feedback") {
        logDev("✅ Fin del flujo. No se reinicia escucha tras blob vacío.");
      } else {
        reactivarEscuchaSegura();
      }
      return;
    }

    const formData = new FormData();
    formData.append("file", blob, "grabacion.webm");

    try {
      logDev("🎧 Tamaño del audio (bytes):", blob.size);
      const res = await fetch(apiUrl("/transcribe"), {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);

      const transcription = await res.json();
      const message = transcription.text;

      logDev("📨 Transcripción recibida:", message);

      if (!message || typeof message !== "string") {
        throw new Error("Respuesta vacía o inválida de transcripción");
      }

      if (typeof onTranscript === "function") {
        onTranscript(message);
      } else {
        warnDev("⚠️ onTranscript no está definido. Transcripción:", message);
        if (getEstado("sistema") === "procesando-feedback") {
          logDev("✅ Fin del flujo. No se reinicia escucha tras transcripción.");
        } else {
          reactivarEscuchaSegura();
        }
      }
    } catch (err) {
      errorDev("❌ Error al transcribir audio:", err);
      reactivarEscuchaSegura();
      alert("Hubo un problema al procesar tu audio. Intenta grabar nuevamente.");
    }
  };

  return mediaRecorder;
}

export function apagarTodoAudio() {
  try {
    detenerGrabacion("finalizado");
  } catch (e) {
    warnDev("⚠️ No se pudo detener grabación (probablemente no estaba activa).");
  }
  detenerRecursosDeAudio();
  setEstado("isRecording", false);
}
