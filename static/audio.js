// =======================
// 📁 audio.js – Manejo de grabación y detección de voz
// =======================

import { setEstado, getEstado } from './estado.js';
import { resetearTemporizador } from './ui.js';

// =======================
// 🔧 Estado interno
// =======================
let recorder, audioContext, input, analyser;
let silenceStart = null;
let chunks = [];

// =======================
// 
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
// 🎙️ Inicio de grabación y escucha del micrófono
// =======================

export function startListening(onTranscript = null) {
  if (getEstado("micMuted")) {
    console.warn("🎙️ Micrófono está en mute. Grabación bloqueada.");
    return Promise.resolve(); // Bloquea por completo
  }

  if (["reproduciendo-audio", "grabando", "procesando-transcripcion"].includes(getEstado("sistema"))) {
    console.warn("⛔ No se puede grabar en el estado actual.");
    return Promise.resolve();
  }

  return navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    if (getEstado("micMuted")) {
      console.warn("🎙️ Micrófono estaba en mute tras getUserMedia. Abortando.");
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    setEstado("sistema", "escuchando");

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    input = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    input.connect(analyser);
    analyser.fftSize = 2048;

    recorder = configurarMediaRecorder(stream, msg => {
      if (onTranscript) onTranscript(msg);
    });
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
    console.warn("🎧 Monitoreo no permitido en estado actual:", estadoSistema);
    return;
  }

  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);

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

    if (volume > 0.02) {
      if (getEstado("sistema") === "escuchando" && recorder.state === "inactive") {
        console.log("🎙️ Detectado inicio de voz");
        if (getEstado("sistema") !== "grabando") {
          setEstado("sistema", "grabando");
        }
        recorder.start();
      }
      silenceStart = null;
    } else if (getEstado("sistema") === "grabando") {
      silenceStart = silenceStart || Date.now();
      if (Date.now() - silenceStart > 2000) {
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
    console.log(`🛑 Grabación detenida por: ${motivo}`);
    recorder.stop();
    silenceStart = null;

    if (motivo !== "interrupcion") {
      setEstado("sistema", "procesando-transcripcion");
    } else {
      setEstado("sistema", "escuchando");
    }
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

    const formData = new FormData();
    formData.append("file", blob, "grabacion.webm");

    try {
      const res = await fetch("/transcribe", {
        method: "POST",
        body: formData
      });
      const transcription = await res.json();
      const message = transcription.text;
      if (onTranscript) onTranscript(message);
    } catch (err) {
      console.error("❌ Error al transcribir audio:", err);
    }
  };

  return mediaRecorder;
}
