// anastasiaAnimation.js

import * as flubber from "https://cdn.jsdelivr.net/npm/flubber/+esm";

/**
 * Easing cuadrático tipo ease-in-out
 * @param {number} t - Valor entre 0 y 1
 * @returns {number} - Valor suavizado entre 0 y 1
 */
function easeInOutQuad(t) {
  return t < 0.5
    ? 2 * t * t
    : -1 + (4 - 2 * t) * t;
}

// ========================
// 🔁 Estados y datos de boca
// ========================
let intervalId;
let idleAnimationId;
let mouthAnimationFrameId = null;
let fondo, dientes, labios;
let dFondo, dDientes, dLabios;

const visemaMap = {
  "cerrada": "boca-cerrada",                  // reposo o silencio
  "labial": "boca-m-b-p",                     // m, b, p
  "labiodental": "boca-f-v",                  // f, v
  "abierta-pequeña": "boca-ah-i-small",       // a, e, i (vocales abiertas cortas)
  "abierta-grande": "boca-ah-i-big",          // a, i (en énfasis)
  "media-pequeña": "boca-ee-uh-en-small",     // n, l, y
  "media-grande": "boca-ee-uh-en-big",        // y, vocales prolongadas
  "redonda": "boca-oh",                       // o
  "cerrada-redonda": "boca-oo-u-w-r-small",   // u, w, r suave
  "cerrada-redonda-grande": "boca-oo-u-w-r-big", // u prolongada, diptongos con énfasis
  "sibilante": "boca-s-c-z-sh-ch"             // s, c, z, sh, ch, th
};

const visemasData = {};

let isBotSpeaking = false;
export function setBotSpeaking(state) {
  isBotSpeaking = state;
}

// ========================
// 🚀 Inicialización del avatar
// ========================
export function initBotAnimations() {
  const svg = document.querySelector("#contenedor-avatar svg");
  if (!svg) return;

  const partes = {
    ojoIzq: svg.getElementById("ojo_izq"),
    ojoDer: svg.getElementById("ojo_der"),
    cejaIzq: svg.getElementById("ceja_izq"),
    cejaDer: svg.getElementById("ceja_der"),
    nariz: svg.getElementById("nariz"),
    boca: svg.getElementById("boca-actual"),
    lentes: svg.getElementById("lentes"),
    copete: svg.getElementById("copete"),
    orejaIzq: svg.getElementById("oreja_izq"),
    orejaDer: svg.getElementById("oreja_der"),
    cabeza: svg.getElementById("cabeza"),
    pelo: svg.getElementById("pelo")
  };

  fondo = svg.getElementById("boca-actual-fondo");
  dientes = svg.getElementById("boca-actual-dientes");
  labios = svg.getElementById("boca-actual-labios");

  dFondo = fondo?.getAttribute("d") || "";
  dDientes = dientes?.getAttribute("d") || "";
  dLabios = labios?.getAttribute("d") || "";

  Object.entries(visemaMap).forEach(([letra, id]) => {
    const grupo = svg.getElementById(id);
    if (!grupo) return;
    const f = grupo.querySelector('[id^="fondo"]');
    const d = grupo.querySelector('[id^="dientes"]');
    const l = grupo.querySelector('[id^="labios"]');
    if (f && d && l) {
      visemasData[letra] = {
        fondo: f.getAttribute("d"),
        dientes: d.getAttribute("d"),
        labios: l.getAttribute("d")
      };
    }
    grupo.setAttribute("visibility", "hidden");
  });

  iniciarAnimaciones(partes);
}

// ========================
// 🔁 Animaciones generales
// ========================
function iniciarAnimaciones(partes) {
  let alturaCejas = 0;
  let anguloPelo = 0;
  let velocidadPelo = 0;
  let peloOffsetX = 0;

  let miradaTarget = { x: 0, y: 0 };
  let miradaActual = { x: 0, y: 0 };
  let giro = { target: 0, actual: 0 };
  let giroVertical = { target: 0, actual: 0 };

  function cicloParpadeo() {
    if (Math.random() < 0.8) {
      partes.ojoIzq.style.opacity = 0;
      partes.ojoDer.style.opacity = 0;
      setTimeout(() => {
        partes.ojoIzq.style.opacity = 1;
        partes.ojoDer.style.opacity = 1;
      }, 120);
    }
    setTimeout(cicloParpadeo, 3000 + Math.random() * 2000);
  }

  function moverOjos() {
    const v = isBotSpeaking ? 0.2 : 0.1;
    miradaActual.x += (miradaTarget.x - miradaActual.x) * v;
    miradaActual.y += (miradaTarget.y - miradaActual.y) * v;
    requestAnimationFrame(moverOjos);
  }

  function animarCabeza() {
    const v = isBotSpeaking ? 0.3 : 0.2;
    giro.actual += (giro.target - giro.actual) * v;
    giroVertical.actual += (giroVertical.target - giroVertical.actual) * v;

    const anguloCabeza = giro.actual * 2 + giroVertical.actual * -1.5;
    const escala = 1;
    const fuerza = (anguloCabeza - anguloPelo) * 0.05;
    velocidadPelo = velocidadPelo * 0.9 + fuerza;
    anguloPelo += velocidadPelo;
    peloOffsetX = giro.actual * -8;

    const baseCX = { izq: 114.36, der: 180.47 };
    const baseCY = 121.45;

    const dxFrontal = giro.actual * 6;
    const dxOjos = giro.actual * 5;
    const dxOrejas = giro.actual * -4;
    const dyCara = giroVertical.actual * -4;
    const dyOrejas = giroVertical.actual * 2;

    if (partes.pelo) partes.pelo.setAttribute("transform", `rotate(${anguloPelo} 150 150) translate(${peloOffsetX}, 0)`);
    if (partes.ojoIzq) {
      partes.ojoIzq.setAttribute("cx", baseCX.izq + miradaActual.x + (giro.actual < 0 ? giro.actual * 2.5 : dxOjos));
      partes.ojoIzq.setAttribute("cy", baseCY + miradaActual.y + dyCara);
    }
    if (partes.ojoDer) {
      partes.ojoDer.setAttribute("cx", baseCX.der + miradaActual.x + (giro.actual > 0 ? giro.actual * 2.5 : dxOjos));
      partes.ojoDer.setAttribute("cy", baseCY + miradaActual.y + dyCara);
    }
    if (partes.cejaIzq) partes.cejaIzq.setAttribute("transform", `translate(${dxOjos}, ${dyCara + alturaCejas})`);
    if (partes.cejaDer) partes.cejaDer.setAttribute("transform", `translate(${dxOjos}, ${dyCara + alturaCejas})`);
    if (partes.nariz) partes.nariz.setAttribute("transform", `translate(${dxFrontal}, ${dyCara})`);
    if (partes.boca) partes.boca.setAttribute("transform", `translate(${dxFrontal}, ${dyCara})`);
    if (partes.lentes) partes.lentes.setAttribute("transform", `translate(${dxFrontal}, ${dyCara})`);
    if (partes.copete) partes.copete.setAttribute("transform", `translate(${dxFrontal}, ${dyCara})`);
    if (partes.orejaIzq) partes.orejaIzq.setAttribute("transform", `translate(${dxOrejas}, ${dyOrejas})`);
    if (partes.orejaDer) partes.orejaDer.setAttribute("transform", `translate(${dxOrejas}, ${dyOrejas})`);

    requestAnimationFrame(animarCabeza);
  }

  function moverCabezaPor3Segundos() {
    let angulo = 0;
    let direccion = 1;
    let activo = true;
    let volviendo = false;

    function animar() {
      if (activo) {
        angulo += direccion * 0.15;
        if (angulo > 2 || angulo < -2) direccion *= -1;
      } else if (volviendo) {
        angulo *= 0.9;
        if (Math.abs(angulo) < 0.05) {
          angulo = 0;
          volviendo = false;
        }
      }

      if (!activo && !volviendo) return;
      partes.cabeza?.setAttribute("transform", `rotate(${angulo} 150 150) scale(1, 1)`);
      const fuerza = (angulo - anguloPelo) * 0.05;
      velocidadPelo = velocidadPelo * 0.9 + fuerza;
      anguloPelo += velocidadPelo;
      partes.pelo?.setAttribute("transform", `rotate(${anguloPelo} 150 150) translate(${peloOffsetX}, 0)`);

      requestAnimationFrame(animar);
    }

    animar();
    setTimeout(() => {
      activo = false;
      volviendo = true;
    }, 3000);
  }

  function elevarCejas() {
    const duracion = 300; // ms
    const desplazamiento = -6;

    function animar(target, onComplete) {
      const inicio = performance.now();
      function frame(now) {
        const t = Math.min(1, (now - inicio) / duracion);
        const easedT = easeInOutQuad(t);
        alturaCejas = target === 0
          ? desplazamiento + (0 - desplazamiento) * easedT
          : 0 + (desplazamiento - 0) * easedT;

        requestAnimationFrame(t < 1 ? frame : onComplete);
      }
      requestAnimationFrame(frame);
    }

    animar(desplazamiento, () => {
      setTimeout(() => {
        animar(0, () => {});
      }, 2000);
    });
  }

  function animacionIdleExtra() {
    if (isBotSpeaking) elevarCejas();
    else moverCabezaPor3Segundos();
    idleAnimationId = setTimeout(animacionIdleExtra, 7000 + Math.random() * 4000);
  }

  function actualizarMiradaYGiro() {
    miradaTarget = { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 3 };
    giro.target = (Math.random() - 0.5) * 2;
    giroVertical.target = (Math.random() - 0.5) * 2;
    setTimeout(actualizarMiradaYGiro, 3000 + Math.random() * 3000);
  }


  // Lanzar todas las animaciones
  cicloParpadeo();
  moverOjos();
  animarCabeza();
  animacionIdleExtra();
  actualizarMiradaYGiro();

}

// ========================
// 👄 Animación de visemas
// ========================

export function animateMouthViseme(char) {
  if (mouthAnimationFrameId !== null) return; // ⛔️ No hagas nada si ya está animando

  const datos = visemasData[char.toLowerCase()];
  if (!datos || !fondo || !dientes || !labios) return;

  const opts = { maxSegmentLength: 0.5 };
  const interpF = flubber.interpolate(dFondo, datos.fondo, opts);
  const interpD = flubber.interpolate(dDientes, datos.dientes, opts);
  const interpL = flubber.interpolate(dLabios, datos.labios, opts);

  let t = 0;
  const isCerrada = char === "cerrada";
  const tStep = isCerrada ? 0.2 : 0.15; // Ajustable

  const animate = () => {
    t += tStep;
    const easedT = easeInOutQuad(t);

    fondo.setAttribute("d", interpF(easedT));
    dientes.setAttribute("d", interpD(easedT));
    labios.setAttribute("d", interpL(easedT));
    const clip = document.getElementById("clip-shape");
    if (clip) clip.setAttribute("d", interpF(easedT));
    if (t < 1) {
      mouthAnimationFrameId = requestAnimationFrame(animate);
    } else {
      dFondo = datos.fondo;
      dDientes = datos.dientes;
      dLabios = datos.labios;
      mouthAnimationFrameId = null; // ✅ Marca que terminó
    }
  };
  animate();
}


export function closeMouthSmoothly() {
  if (mouthAnimationFrameId) {
    cancelAnimationFrame(mouthAnimationFrameId);
    mouthAnimationFrameId = null;
  }
  setBotSpeaking(false);
  animateMouthViseme("cerrada");
}


// letras agrupadas por su comportamiento fonético
const gruposFonema = [
  { match: ["th", "dh"], visema: "sibilante" },
  { match: ["sh", "ch", "zh"], visema: "sibilante" },
  { match: ["m", "b", "p"], visema: "labial" },
  { match: ["f", "v"], visema: "labiodental" },
  { match: ["a", "e", "i"], visema: "abierta-pequeña" },
  { match: ["o"], visema: "redonda" },
  { match: ["u", "w"], visema: "cerrada-redonda" },
  { match: ["r"], visema: "cerrada-redonda" },
  { match: ["n", "l"], visema: "media-pequeña" },
  { match: ["g", "j"], visema: "media-grande" },
  { match: ["y"], visema: "media-pequeña" },
  { match: ["z", "s", "c"], visema: "sibilante" },
  { match: [" "], visema: "cerrada" },
];


export function obtenerVisemaDesdeLetra(letra) {
  for (let grupo of gruposFonema) {
    if (grupo.match.includes(letra)) return grupo.visema;
  }
  return null;
}

export function separarSilabasMultilenguaje(texto) {
  const vocales = ['a', 'e', 'i', 'o', 'u', 'y'];
  const esVocal = l => vocales.includes(l.toLowerCase());

  const palabras = texto.split(/(\s+)/); // <-- captura espacios también
  const silabas = [];

  for (let palabra of palabras) {
    if (/^\s+$/.test(palabra)) {
      silabas.push(palabra); // <-- conserva los espacios
      continue;
    }

    let actual = '';
    for (let i = 0; i < palabra.length; i++) {
      const l = palabra[i];
      actual += l;

      const siguiente = palabra[i + 1];
      const despues = palabra[i + 2];

      if (
        esVocal(l) &&
        siguiente && !esVocal(siguiente) &&
        despues && esVocal(despues)
      ) {
        silabas.push(actual);
        actual = '';
      } else if (
        esVocal(l) &&
        siguiente && !esVocal(siguiente) &&
        (!despues || !palabra[i + 3])
      ) {
        silabas.push(actual);
        actual = '';
      }
    }
    if (actual) silabas.push(actual);
  }

  return silabas;
}
