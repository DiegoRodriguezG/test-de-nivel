import { initBotAnimations } from './anastasiaAnimation.js';
import {
  startListening,
  startMonitoring,
  detenerGrabacion,
  toggleMicMuted
} from './audio.js';
import {
  resetearTemporizador,
  mostrarVistaFeedback
} from './ui.js';
import {
  manejarTurnoDelUsuario,
  limpiarMemoriaLocal,
  importarProgresoEvaluacion
} from './botLogic.js';
import {
  mostrarRespuestaDelUsuario,
  cancelarAnimacionTexto,
  asignarBotonPlayABurbuja,
  renderizarBurbujaDeBot,
  reproducirTextoYAnimar
} from './botRender.js';
import { setEstado, getEstado } from './estado.js';

let usuario = {
  nombre: "",
  cargo: "",
  nivel: ""
};

window.onload = () => {
  detectarCompatibilidadGrabacion();
  configurarBotonesUI();
  cargarAvatarSVG();
  cargarListaCargos();

  const usuarioGuardado = localStorage.getItem("usuario");
  const historialGuardado = localStorage.getItem("historial");

  const evaluacionFinal = localStorage.getItem("evaluacionFinal") === "true";
  if (evaluacionFinal) {
    const resultadoPrevio = localStorage.getItem("feedbackResultado");
    if (resultadoPrevio) {
      const parsed = JSON.parse(resultadoPrevio);
      mostrarVistaFeedback(parsed); // Ya está definido en ui.js
    } else {
      mostrarPaso(6); 
    }
    return; 
  }

  if (usuarioGuardado && historialGuardado) {
    const usuarioParsed = JSON.parse(usuarioGuardado);
    usuario = usuarioParsed;
    mostrarPaso(5);
    iniciarChat();
  }
};

function configurarBotonesUI() {
  document.getElementById("empezar-btn").onclick = () => mostrarPaso(2);

  document.getElementById("btn-atras-a-paso-1").onclick = () => mostrarPaso(1);
  document.getElementById("btn-siguiente-a-paso-3").onclick = () => {
    usuario.nombre = document.getElementById("input-nombre").value.trim();
    if (!usuario.nombre) {
      alert("Por favor escribe tu nombre.");
      return;
    }
    mostrarPaso(3);
  };

  document.getElementById("btn-atras-a-paso-2").onclick = () => mostrarPaso(2);
  document.getElementById("btn-siguiente-a-paso-4").onclick = () => {
    usuario.cargo = document.getElementById("input-cargo").value.trim();
    if (!usuario.cargo) {
      alert("Por favor ingresa el cargo.");
      return;
    }
    mostrarPaso(4);
  };

  document.querySelectorAll(".nivel-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".nivel-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      usuario.nivel = btn.dataset.nivel;
    };
  });

  document.getElementById("btn-atras-a-paso-3").onclick = () => mostrarPaso(3);
  document.getElementById("btn-comenzar-entrevista").onclick = () => {
    if (!usuario.nivel) {
      alert("Selecciona un nivel de inglés.");
      return;
    }

    // Validación completa antes de pasar al paso 5 (chat)
    if (!usuario.nombre || !usuario.cargo || !usuario.nivel) {
      alert("Falta completar uno o más pasos anteriores.");
      return;
    }

    mostrarPaso(5);
    iniciarChat();
  };

  document.getElementById("btn-enviar-resultados").onclick = () => {
    const email = document.getElementById("input-email").value.trim();
    const pais = document.getElementById("input-pais").value.trim();
    if (!email || !pais) {
      alert("Completa tu correo y país.");
      return;
    }

    console.log("✅ Email y país:", { email, pais });
    mostrarPaso(7);
  };

  document.getElementById("mic-btn").onclick = () => toggleMicMuted();
  document.getElementById("end-btn").onclick = () => {
    const modal = new bootstrap.Modal(document.getElementById("modalConfirmarTerminar"));
    modal.show();
  };
  document.getElementById("btnConfirmarTerminar").onclick = () => resetApp();
  document.getElementById("btn-try-again").onclick = () => resetApp();
}

function mostrarPaso(n) {
  for (let i = 1; i <= 7; i++) {
    const div = document.getElementById(`paso-${i}`);
    if (div) {
      div.classList.toggle("d-none", i !== n);
      div.classList.toggle("d-flex", i === n);
    }
  }

  // Mostrar barra solo desde paso 2 a 4
  const mostrarProgreso = n >= 2 && n <= 4;
  const barra = document.getElementById("barra-progreso-contenedor");
  const texto = document.getElementById("texto-progreso");

  if (barra) barra.style.display = mostrarProgreso ? "block" : "none";
  if (texto) texto.style.display = mostrarProgreso ? "block" : "none";

  // Ajuste visual: paso 2 es "Paso 1 de 3"
  if (mostrarProgreso) {
    const pasoVisual = n - 1; // porque paso 2 = visual 1
    actualizarProgresoVisual(pasoVisual, 3);
  }
}

function actualizarProgresoVisual(pasoActual, totalPasos) {
  const porcentaje = Math.round((pasoActual / totalPasos) * 100);
  const barra = document.getElementById("barra-progreso");
  const texto = document.getElementById("texto-progreso");
  if (barra) barra.style.width = `${Math.min(porcentaje, 100)}%`;
  if (texto && pasoActual <= totalPasos) texto.textContent = `Paso ${pasoActual} de ${totalPasos}`;
}

function obtenerCargosAleatorios(lista, cantidad = 8) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, cantidad);
}

function cargarListaCargos() {
  fetch(window.RUTA_CARGOS)
    .then(res => res.json())
    .then(data => {
      const cargosAleatorios = obtenerCargosAleatorios(data, 8);
      const datalist = document.getElementById("cargos-sugeridos");
      const pillsContainer = document.getElementById("pills-cargo");

      if (datalist) {
        datalist.innerHTML = "";
        cargosAleatorios.forEach(c => {
          const opt = document.createElement("option");
          opt.value = c;
          datalist.appendChild(opt);
        });
      }

      if (pillsContainer) {
        pillsContainer.innerHTML = "";
        cargosAleatorios.forEach(c => {
          const pill = document.createElement("div");
          pill.className = "pill-cargo";
          pill.textContent = c;
          pill.onclick = () => document.getElementById("input-cargo").value = c;
          pillsContainer.appendChild(pill);
        });
      }
    })
    .catch(() => console.warn("⚠️ No se pudo cargar la lista de cargos."));
}

function iniciarChat() {
  const historial = prepararHistorial();
  const esHistorialVacio = historial.length === 0;
  const esperaRespuestaUsuario = historial.at(-1)?.pregunta && !historial.at(-1)?.respuesta;

  const esPrimerTurno = esHistorialVacio;
  localStorage.setItem("primerTurno", esPrimerTurno ? "true" : "false");
  setEstado("primerTurno", esPrimerTurno);

  // 🔄 Restaurar progreso si existe
  const valInfo = parseInt(localStorage.getItem("valorInformativo") || "0");
  const respValidas = parseInt(localStorage.getItem("respuestasValidas") || "0");
  importarProgresoEvaluacion(valInfo, respValidas);

  localStorage.setItem("usuario", JSON.stringify(usuario));

  if (!esHistorialVacio) {
    restaurarHistorialEnPantalla();
  }

  if (esperaRespuestaUsuario) {
    const span = renderizarBurbujaDeBot(historial.at(-1).pregunta, false);
    span.textContent = historial.at(-1).pregunta;
    asignarBotonPlayABurbuja(historial.at(-1).pregunta, span);
    requestAnimationFrame(() => {
      setEstado("sistema", "reproduciendo-texto");
      reproducirTextoYAnimar(
        historial.at(-1).pregunta,
        usuario,
        historial,
        null,
        false,
        true
      );
    });
  } else {
    requestAnimationFrame(() => manejarTurnoDelUsuario(usuario, historial));
  }
}

function prepararHistorial() {
  try {
    const guardado = JSON.parse(localStorage.getItem("historial") || "[]");
    return Array.isArray(guardado) ? guardado : [];
  } catch {
    return [];
  }
}

function restaurarHistorialEnPantalla() {
  const historialGuardado = limpiarHistorial(JSON.parse(localStorage.getItem("historial") || "[]"));
  historialGuardado.forEach(item => {
    if (item.pregunta) {
      const span = renderizarBurbujaDeBot(item.pregunta, false);
      span.textContent = item.pregunta;
      asignarBotonPlayABurbuja(item.pregunta, span);
    }
    if (item.respuesta) {
      mostrarRespuestaDelUsuario(item.respuesta, usuario, historialGuardado, true);
    }
  });
}

function limpiarHistorial(historial) {
  return historial.filter(item => item.pregunta?.trim() && item.respuesta?.trim());
}

function resetApp() {
  cancelarAnimacionTexto();
  detenerGrabacion();
  resetearTemporizador();
  limpiarMemoriaLocal();
  localStorage.removeItem("evaluacionFinal");
  localStorage.removeItem("feedbackResultado");
  location.reload();
}

function cargarAvatarSVG() {
  fetch('/static/anastasia.svg')
    .then(res => res.text())
    .then(svg => {
      const contenedor = document.getElementById('contenedor-avatar');
      if (contenedor) contenedor.innerHTML = svg;
      requestAnimationFrame(() => initBotAnimations());
    });
}

function detectarCompatibilidadGrabacion() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isChrome = /CriOS/.test(navigator.userAgent);
  const iOSVersionMatch = navigator.userAgent.match(/OS (\d+)_/);
  const iOSVersion = iOSVersionMatch ? parseInt(iOSVersionMatch[1]) : null;

  if (!window.MediaRecorder || (isIOS && !isChrome)) {
    alert("Tu navegador no soporta grabación de audio. Usa Chrome (iOS 16.4+ o Android) o un navegador de escritorio.");
  } else if (isChrome && isIOS && iOSVersion && iOSVersion < 16) {
    alert("Tu versión de iOS no soporta grabación en Chrome. Actualiza a iOS 16.4 o superior.");
  } else if (isSafari) {
    alert("Safari no soporta grabación de audio. Usa Chrome o Firefox.");
  }
}

// 🔧 Habilitar botón de debug en local
window.addEventListener("DOMContentLoaded", () => {
  if (location.hostname === "localhost") {
    const btn = document.getElementById("btn-debug-eval");
    if (btn) {
      btn.classList.remove("d-none");
      btn.addEventListener("click", () => {
        const usuarioFalso = {
          nombre: "Jose",
          cargo: "Project Manager",
          nivel: "Intermedio",
          empresa: "Poliglota"
        };

        const historialFalso = [
          {
            pregunta: "Tell me about yourself.",
            respuesta: "Hi, my name is Jose and I love working with teams."
          },
          {
            pregunta: "How do you handle conflict?",
            respuesta: "I usually handle conflict by listening first and asking questions."
          },
          {
            pregunta: "What is your greatest strength?",
            respuesta: "My biggest strength is adaptability. I can adjust quickly to changes in a project."
          },
          {
            pregunta: "Why are you interested in this position?",
            respuesta: "Because I enjoy working in international environments and helping people grow."
          }
        ];

        // Guarda en localStorage para simular sesión real
        localStorage.setItem("usuario", JSON.stringify(usuarioFalso));
        localStorage.setItem("historial", JSON.stringify(historialFalso));
        localStorage.setItem("evaluacionFinal", "true");

        // Llamar al backend real
        fetch("/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ historial: historialFalso })
        })
          .then(res => res.json())
          .then(data => {
            console.log("✅ Resultado de evaluación simulada:", data);
            localStorage.setItem("feedbackResultado", JSON.stringify(data));
            import("./ui.js").then(mod => mod.mostrarVistaFeedback(data));
          })
          .catch(err => console.error("❌ Error en evaluación debug:", err));
      });

    }
  }
});
