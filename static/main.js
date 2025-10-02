//main.js

import { logDev, errorDev, warnDev } from './debug.js';
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
  limpiarMemoriaLocal
} from './botLogic.js';
import {
  mostrarRespuestaDelUsuario,
  cancelarAnimacionTexto,
  asignarBotonPlayABurbuja,
  renderizarBurbujaDeBot,
  reproducirTextoYAnimar
} from './botRender.js';
import { getEstado, setEstado, actualizarEstadoParcial } from './estado.js';

window.onload = () => {
  detectarCompatibilidadGrabacion();
  configurarBotonesUI();
  cargarAvatarSVG();
  cargarListaSituaciones();

  const usuarioGuardado = localStorage.getItem("usuario");
  const historialGuardado = localStorage.getItem("historial");

  const evaluacionFinal = localStorage.getItem("evaluacionFinal") === "true";
  if (evaluacionFinal) {
    const resultadoPrevio = localStorage.getItem("feedbackResultado");
    if (resultadoPrevio) {
      const parsed = JSON.parse(resultadoPrevio);
      mostrarVistaFeedback(parsed);
    } else {
      mostrarPaso(9);
    }
    return;
  }

  if (usuarioGuardado && historialGuardado) {
    const usuarioParsed = JSON.parse(usuarioGuardado);
    setEstado("usuario", usuarioParsed);
    mostrarPaso(8);
    iniciarChat();
  }
};

function configurarBotonesUI() {

  //Paso 1: Bienvenida
  document.getElementById("empezar-btn").onclick = () => mostrarPaso(2);

  //Paso 2: Nombre
  document.getElementById("btn-atras-a-paso-1").onclick = () => mostrarPaso(1);
  document.getElementById("btn-siguiente-a-paso-3").onclick = () => {
    const nombre = document.getElementById("input-nombre").value.trim();
    if (!nombre) {
      alert("Por favor escribe tu nombre.");
      return;
    }
    actualizarEstadoParcial("usuario", { nombre });

    mostrarPaso(3);
  };

  //Paso 3: Idioma
  document.getElementById("input-idioma").setAttribute("readonly", "true");
  document.getElementById("btn-atras-a-paso-2").onclick = () => mostrarPaso(2);
  document.getElementById("btn-siguiente-a-paso-4").onclick = () => {
    const idioma = document.getElementById("input-idioma").value.trim();
    if (!idioma) {
      alert("Por favor selecciona un idioma.");
      return;
    }
    actualizarEstadoParcial("usuario", { idioma });

    mostrarPaso(4);
  };

  // Evento para selección visual de idioma
  document.querySelectorAll(".idioma-opcion").forEach(opcion => {
    opcion.onclick = () => {
      document.querySelectorAll(".idioma-opcion").forEach(el => el.classList.remove("selected"));
      opcion.classList.add("selected");
      const idioma = opcion.dataset.idioma;
      actualizarEstadoParcial("usuario", { idioma });
      document.getElementById("input-idioma").value = idioma;
      document.getElementById('idioma-seleccionado-situacion').textContent = idioma;
      document.getElementById('idioma-seleccionado-nivel').textContent = idioma;
    };
  });

  //Paso 4: Situación
  document.getElementById("btn-atras-a-paso-3").onclick = () => mostrarPaso(3);
  document.getElementById("btn-siguiente-a-paso-5").onclick = () => {
    const situacion = document.getElementById("input-situacion").value.trim();
    if (!situacion) {
      alert("Por favor selecciona una situación.");
      return;
    }
    actualizarEstadoParcial("usuario", { situacion });

    mostrarPaso(5);
  };

  // Pills para sugerencias:
  document.querySelectorAll(".pill-situacion")?.forEach(pill => {
    pill.onclick = () => {
      document.getElementById("input-situacion").value = pill.textContent;
    };
  });

  //Paso 5: Nivel
  document.getElementById("btn-atras-a-paso-4").onclick = () => mostrarPaso(4);
  document.querySelectorAll(".nivel-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".nivel-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      actualizarEstadoParcial("usuario", { nivel: btn.dataset.nivel });
    };
  });
  document.getElementById("btn-siguiente-a-paso-6").onclick = () => {
    const { nivel } = getEstado("usuario");
    if (!nivel) {
      alert("Por favor selecciona un nivel antes de continuar.");
      return;
    }
    mostrarPaso(6);
  };

  //Paso 6: Instrucciones
  document.getElementById("btn-atras-a-paso-5").onclick = () => mostrarPaso(5);
  document.getElementById("btn-comenzar-test").onclick = () => {
    const { nombre, idioma, situacion, nivel } = getEstado("usuario");

    if (!nombre || !idioma || !situacion || !nivel) {
      alert("Falta completar uno o más pasos anteriores.");
      return;
    }

    mostrarPaso(7);
    iniciarChat();
  };

  document.getElementById("form-contacto").addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = document.getElementById("input-contacto-nombre").value.trim();
    const apellido = document.getElementById("input-contacto-apellido").value.trim();
    const email = document.getElementById("input-contacto-email").value.trim();
    const pais = document.getElementById("input-pais").value.trim(); // Asegúrate de que exista este input

    const errorDiv = document.getElementById("error-contacto");
    errorDiv.classList.add("d-none"); // Oculta errores anteriores

    if (!nombre || !apellido || !email || !pais) {
      errorDiv.textContent = "Por favor completa todos los campos.";
      errorDiv.classList.remove("d-none");
      return;
    }

    const hubspotPortalId = "20619710";
    const hubspotFormId = "1f5602bf-ec35-45ac-8513-e6014d89c02b";

    const payload = {
      fields: [
        { name: "firstname", value: nombre },
        { name: "lastname", value: apellido },
        { name: "email", value: email },
        { name: "country", value: pais }
      ],
      context: {
        pageUri: window.location.href,
        pageName: document.title
      }
    };

    try {
      const response = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${hubspotPortalId}/${hubspotFormId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        mostrarPaso(9);
        mostrarVistaFeedback(JSON.parse(localStorage.getItem("feedbackResultado")));
      } else {
        errorDev("❌ Error en envío HubSpot:", await response.text());
        errorDiv.textContent = "Hubo un problema al enviar tus datos. Intenta nuevamente.";
        errorDiv.classList.remove("d-none");
      }
    } catch (err) {
      errorDev("❌ Error en conexión HubSpot:", err);
      errorDiv.textContent = "No se pudo conectar con el servidor. Intenta más tarde.";
      errorDiv.classList.remove("d-none");
    }
  });


  document.getElementById("mic-btn").onclick = () => toggleMicMuted();
  document.getElementById("end-btn").onclick = () => {
    const modal = new bootstrap.Modal(document.getElementById("modalConfirmarTerminar"));
    modal.show();
  };
  document.getElementById("btnConfirmarTerminar").onclick = () => resetApp();
  //document.getElementById("btn-try-again").onclick = () => resetApp();
  document.getElementById("btn-try-again").onclick = () => {
    window.location.href = "https://www.poliglota.org/?utm_medium=referral&utm_source=testdenivelai";
  };
}

function mostrarPaso(n) {
  for (let i = 1; i <= 9; i++) {
    const div = document.getElementById(`paso-${i}`);
    if (div) {
      div.classList.toggle("d-none", i !== n);
      div.classList.toggle("d-flex", i === n);
    }
  }

  const mostrarProgreso = n >= 2 && n <= 6;
  const barra = document.getElementById("barra-progreso-contenedor");
  const texto = document.getElementById("texto-progreso");

  if (barra) barra.style.display = mostrarProgreso ? "block" : "none";
  if (texto) texto.style.display = mostrarProgreso ? "block" : "none";

  if (mostrarProgreso) {
    const pasoVisual = n - 1;
    actualizarProgresoVisual(pasoVisual, 5);
  }
}

function actualizarProgresoVisual(pasoActual, totalPasos) {
  const porcentaje = Math.round((pasoActual / totalPasos) * 100);
  const barra = document.getElementById("barra-progreso");
  const texto = document.getElementById("texto-progreso");
  if (barra) barra.style.width = `${Math.min(porcentaje, 100)}%`;
  if (texto && pasoActual <= totalPasos) texto.textContent = `Paso ${pasoActual} de ${totalPasos}`;
}

function obtenerSituacionesAleatorias(lista, cantidad = 8) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, cantidad);
}

function cargarListaSituaciones() {
  fetch(window.RUTA_SITUACIONES)
    .then(res => res.json())
    .then(data => {
      const situacionesAleatorias = obtenerSituacionesAleatorias(data, 8);
      const datalist = document.getElementById("situaciones-sugeridas");
      const pillsContainer = document.getElementById("pills-situacion");

      if (datalist) {
        datalist.innerHTML = "";
        situacionesAleatorias.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s;
          datalist.appendChild(opt);
        });
      }

      if (pillsContainer) {
        pillsContainer.innerHTML = "";

        // Agrega los pills de situaciones
        situacionesAleatorias.forEach(s => {
          const pill = document.createElement("div");
          pill.className = "pill-situacion";
          pill.textContent = s;
          pill.onclick = () => document.getElementById("input-situacion").value = s;
          pillsContainer.appendChild(pill);
        });

        // Agrega el pill de refrescar temas
        const refreshPill = document.createElement("div");
        refreshPill.className = "pill-situacion";
        refreshPill.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Ver más temas';
        refreshPill.onclick = () => cargarListaSituaciones();
        pillsContainer.appendChild(refreshPill);
      }
    })
    .catch(() => warnDev("⚠️ No se pudo cargar la lista de situaciones."));
}

function iniciarChat() {
  const historial = prepararHistorial();
  setEstado("historialConversacion", historial);
  const esHistorialVacio = historial.length === 0;
  const esperaRespuestaUsuario = historial.at(-1)?.pregunta && !historial.at(-1)?.respuesta;

  const esPrimerTurno = esHistorialVacio;
  localStorage.setItem("primerTurno", esPrimerTurno ? "true" : "false");
  setEstado("primerTurno", esPrimerTurno);

  localStorage.setItem("usuario", JSON.stringify(getEstado("usuario")));

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
        getEstado("usuario"),
        historial,
        null,
        false,
        true
      );
    });
  } else {
    requestAnimationFrame(() => manejarTurnoDelUsuario(getEstado("usuario"), historial));
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
      mostrarRespuestaDelUsuario(item.respuesta, getEstado("usuario"), historialGuardado, true);
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
  localStorage.removeItem("historial");
  localStorage.removeItem("usuario");
  location.reload();
}

function cargarAvatarSVG() {
  const basePath = document.querySelector('script[src*="main.js"]')?.src.match(/(.*\/)static\//)?.[1] || '/';
  fetch(basePath + 'static/anastasia.svg')
    .then(res => res.text())
    .then(svg => {
      const contenedor = document.getElementById('contenedor-avatar');
      if (contenedor) contenedor.innerHTML = svg;
      requestAnimationFrame(() => initBotAnimations());
    });
}

function detectarCompatibilidadGrabacion() {
  const ua = navigator.userAgent;

  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isChromeIOS = /CriOS/.test(ua);
  const isFirefoxIOS = /FxiOS/.test(ua);
  const isSafari = isIOS && !isChromeIOS && !isFirefoxIOS && /Safari/.test(ua);

  const soportaMediaRecorder = typeof MediaRecorder !== "undefined";
  const soportaGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  // 🚫 Navegadores no compatibles
  if (!soportaMediaRecorder || !soportaGetUserMedia) {
    alert("Tu navegador no soporta grabación de audio. Usa Chrome (iOS 16.4+ o Android) o un navegador de escritorio con permisos activados.");
    return;
  }

  // 🚫 Safari real en iOS no es compatible
  if (isSafari) {
    alert("Safari no permite grabación de audio. Por favor usa Chrome o Firefox en iOS.");
    return;
  }

  // 🚫 Chrome iOS requiere versión >= 16.4
  if (isIOS && isChromeIOS) {
    const versionMatch = ua.match(/OS (\d+)_/);
    const iOSVersion = versionMatch ? parseInt(versionMatch[1]) : null;
    if (iOSVersion && iOSVersion < 16) {
      alert("Tu versión de iOS no permite grabar en Chrome. Actualiza a iOS 16.4 o superior.");
      return;
    }
  }

  // 🔒 Verifica permisos del micrófono
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: "microphone" }).then(permissionStatus => {
      if (permissionStatus.state === "denied") {
        alert("El acceso al micrófono está bloqueado. Ve a Configuración > Chrome > Micrófono para activarlo.");
      }
    }).catch(() => {
      warnDev("No se pudo verificar el permiso del micrófono.");
    });
  }
}

window.addEventListener("evaluacionCompletada", (e) => {
  const result = e.detail.result;
  mostrarPaso(8);
});