// 📁 evaluacion.js – Lógica de evaluación adaptativa CEFR

// ------------------
// 🎯 Cálculo de progreso
// ------------------
export function evaluarProgreso(turnosUtiles) {
  return Math.round((turnosUtiles / 6) * 100);
}

// ------------------
// 🧮 Cálculo de peso según Q
// ------------------
export function calcularW(Q, P_nueva) {
  const pesoBase = 0.5 + 1.5 * Q;

  // Si la respuesta apunta fuertemente a nivel bajo
  const nivelBajo = P_nueva.A1 + P_nueva.A2;

  if (nivelBajo >= 70 && Q < 0.5) {
    return pesoBase + 1.0; // fuerza más impacto aunque la calidad sea baja
  }

  return pesoBase;
}


// ------------------
// 🔄 Actualización de distribución acumulada CEFR
// ------------------
// -------- Config interna (sin pasar por parámetros) --------
const LV = ["A1","A2","B1","B2","C1"];
const W  = { A1:1, A2:2, B1:3, B2:4, C1:5 };

const PRIOR_STRENGTH = 20; // firmeza del histórico (sube = más inercia)
const FORGET         = 0.05; // olvido suave por turno (sube = reacciona más rápido)

// -------- Helpers mínimos --------
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const norm01 = P => { const s = LV.reduce((t,k)=>t+(P[k]||0),0)||1;
  const o={}; LV.forEach(k=>o[k]=(P[k]||0)/s); return o; };
const to100 = p01 => {
  const r = LV.map(k=>({k,v:(p01[k]||0)*100}));
  const f = r.map(x=>({k:x.k,v:Math.floor(x.v)}));
  let t = f.reduce((a,b)=>a+b.v,0);
  const rem = r.map((x,i)=>({k:x.k,d:x.v-f[i].v})).sort((a,b)=>b.d-a.d);
  for(let i=0;t<100&&i<rem.length;i++){ f.find(z=>z.k===rem[i].k).v++; t++; }
  for(let i=rem.length-1;t>100&&i>=0;i--){ const z=f.find(z=>z.k===rem[i].k); if(z.v>0){z.v--; t--;}}
  const o={}; f.forEach(x=>o[x.k]=x.v); return o;
};
const meanLvl = p01 => LV.reduce((m,k)=>m+(p01[k]||0)*W[k],0); // ~1..5

// -------- Updater adaptativo minimal --------
/**
 * P_anterior/P_nueva: {A1..C1} enteros (suman 100)
 * Q: 0..1
 * firstTurn: boolean (opcional) → baja el peso en el primer turno
 */
export function actualizarDistribucion(P_anterior, P_nueva, Q, firstTurn=false) {
  if (Q < 0.15) return { ...P_anterior }; // evidencia casi nula

  const prev = norm01(P_anterior);
  const evid = norm01(P_nueva);

  // Contradicción simple: gap de nivel medio (0..1 aprox)
  const gap = Math.abs(meanLvl(evid) - meanLvl(prev)) / 4;

  // Temperatura: Q alto + gap alto → evidencia más "afilada"
  const tau = clamp(1.0 - 0.35*(Q-0.5) - 0.25*(gap-0.3), 0.7, 1.3);
  const evidSharp = (() => {
    const o = {};
    const Z = LV.reduce((s,k)=>s+Math.pow(evid[k]||1e-9,1/tau),0);
    LV.forEach(k => o[k] = Math.pow(evid[k]||1e-9,1/tau) / (Z||1));
    return o;
  })();

  // Peso efectivo de evidencia (ESS) — rápido si contradice y Q es alto
  const base = firstTurn ? 2 : 6;
  const ESS  = clamp(base + 10*Q + 10*gap, 4, 24);

  // Prior con olvido suave (internos)
  const alphaPrev = {}, alphaEvid = {};
  LV.forEach(k => {
    alphaPrev[k] = (1 - FORGET) * PRIOR_STRENGTH * prev[k];
    alphaEvid[k] = ESS * evidSharp[k];
  });

  // Posterior y normalización a 100
  const post01 = (() => {
    let sum = 0, o={};
    LV.forEach(k => { o[k] = alphaPrev[k] + alphaEvid[k]; sum += o[k]; });
    LV.forEach(k => o[k] = (o[k] || 0) / (sum || 1));
    return o;
  })();

  return to100(post01);
}


// ------------------
// 🛑 Lógica de finalización temprana
// ------------------
export function deberiaFinalizarTest(P_actual, historialQ, turnosUtiles) {
  const nivelDominante = obtenerNivelDominante(P_actual);
  const probDominante = P_actual[nivelDominante];

  const consecutivasBajas = contarRespuestasBajasConsecutivas(historialQ);
  const muyBajas = historialQ.filter(q => q < 0.2).length;
  const utiles = historialQ.filter(q => q >= 0.5).length;
  const total = historialQ.length;

  const esNivelBajo = nivelDominante === "A1" || nivelDominante === "A2";
  const confianzaAlta = probDominante >= 85;

  // 🔒 Nunca cortar antes de 4 turnos útiles
  if (turnosUtiles < 4) return false;

  // 🛑 Corte por nivel dominante claro en usuarios bajos con evidencia suficiente
  if (utiles >= 4 && total >= 6 && esNivelBajo && confianzaAlta) return true;

  // 🛑 Corte general por confianza alta (normal)
  if (!esNivelBajo && probDominante >= 70 && turnosUtiles >= 4) return true;

  // 🛑 Corte por patrón errático: muchas respuestas, pocas útiles
  const ratioUtiles = utiles / total;
  if (total >= 8 && ratioUtiles < 0.3) return true;

  // 🛑 Corte por bajo rendimiento
  if (muyBajas >= 6 && total >= 7) return true;
  if (consecutivasBajas >= 5) return true;

  // 🛑 Corte por máximo absoluto
  if (turnosUtiles >= 6) return true;

  return false;
}

function contarRespuestasBajasConsecutivas(historialQ) {
  let count = 0;
  for (let i = historialQ.length - 1; i >= 0; i--) {
    if (historialQ[i] < 0.3) count++;
    else break;
  }
  return count;
}

export function obtenerNivelDominante(P) {
  return Object.entries(P).reduce((acc, [nivel, valor]) =>
    valor > acc.valor ? { nivel, valor } : acc,
    { nivel: "A1", valor: 0 }
  ).nivel;
}

// =======================
// 📊 Cálculo del promedio ponderado final
// =======================
export function calcularPromedioPonderado(historialEvaluacion) {
  const niveles = ["A1", "A2", "B1", "B2", "C1"];
  const acumulado = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  let totalPeso = 0;

  for (const entrada of historialEvaluacion) {
    const { P_nueva, Q } = entrada;
    const w = calcularW(Q, P_nueva);

    totalPeso += w;

    for (const nivel of niveles) {
      acumulado[nivel] += (P_nueva[nivel] / 100) * w;
    }
  }

  const resultado = {};
  const suma = Object.values(acumulado).reduce((a, b) => a + b, 0);

  for (const nivel of niveles) {
    resultado[nivel] = Math.round((acumulado[nivel] / suma) * 100);
  }

  // Ajuste final para que sume 100 exacto
  const diferencia = 100 - Object.values(resultado).reduce((a, b) => a + b, 0);
  if (diferencia !== 0) {
    const nivelMax = niveles.reduce((a, b) => resultado[a] > resultado[b] ? a : b);
    resultado[nivelMax] += diferencia;
  }

  return resultado;
}
