// 📁 selectorTipos.js – Selección adaptativa del tipo de pregunta

import { obtenerNivelDominante } from './evaluacion.js';

// 🎯 Mínimos requeridos por nivel CEFR
const COBERTURA_MINIMA = {
  A1: { pregunta_cefr: 3 },
  A2: { pregunta_cefr: 3, input_oral: 1, extra: 1 },
  B1: { pregunta_cefr: 3, input_oral: 1, extra: 2 },
  B2: { pregunta_cefr: 3, input_oral: 1, extra: 2 },
  C1: { pregunta_cefr: 3, input_oral: 1, extra: 2 },
};

const TIPOS_EXTRA = ["microconflicto", "decision_pragmatica"];
const TODOS = ["pregunta_cefr", "input_oral", ...TIPOS_EXTRA, "reformulacion", "resumen_reaccion"];

// 📚 Descripciones de cada tipo de pregunta con ejemplos
export const DESCRIPCIONES_TIPO = {
  pregunta_cefr: {
    descripcion: "Una pregunta estructurada para que el usuario demuestre su capacidad de hablar con claridad y orden.",
    ejemplo: "¿Puedes describir un día típico en tu trabajo?"
  },
  input_oral: {
    descripcion: "Pregunta basada en comprensión oral o referencias a algo dicho anteriormente.",
    ejemplo: "¿Qué opinas sobre lo que te conté antes acerca de las entrevistas grupales?"
  },
  microconflicto: {
    descripcion: "Situación breve de malentendido o problema cotidiano que el usuario debe resolver hablando.",
    ejemplo: "Tu compañero llega tarde y no tiene las instrucciones. ¿Cómo se lo explicarías rápidamente?"
  },
  decision_pragmatica: {
    descripcion: "Escenario en el que el usuario debe tomar una decisión práctica, explicando sus motivos.",
    ejemplo: "Estás eligiendo entre dos ofertas de trabajo. ¿Qué factores considerarías?"
  },
  reformulacion: {
    descripcion: "El usuario debe mejorar, aclarar o reformular una expresión o frase que usó antes.",
    ejemplo: "¿Puedes decir eso mismo pero usando otra estructura o vocabulario más formal?"
  },
  resumen_reaccion: {
    descripcion: "Se le pide al usuario que resuma una idea mencionada antes y dé su opinión.",
    ejemplo: "¿Podrías resumir tu punto de vista sobre las entrevistas virtuales?"
  }
};

// 🧠 Reglas de selección de tipos permitidos según nivel
function tiposPermitidosPorNivel(nivel) {
  switch (nivel) {
    case "A1":
      return ["pregunta_cefr"];
    case "A2":
      return ["pregunta_cefr", "input_oral"];
    case "B1":
    case "B2":
      return ["pregunta_cefr", "input_oral", "microconflicto", "decision_pragmatica", "reformulacion"];
    case "C1":
      return ["pregunta_cefr", "input_oral", "microconflicto", "decision_pragmatica", "reformulacion", "resumen_reaccion"];
    default:
      return ["pregunta_cefr"];
  }
}

// 🔍 Cuenta cuántas veces se ha usado cada tipo
function contarTipos(lista) {
  return lista.reduce((acc, tipo) => {
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});
}

// 🧠 Función principal de selección
export function seleccionarTipoParaPrompt(P_actual, historialTurnos) {
  const historialTipos = historialTurnos.map(t => t.tipo).filter(Boolean);
  const ultimoTipo = historialTipos.at(-1);
  const nivel = obtenerNivelDominante(P_actual);
  const cobertura = COBERTURA_MINIMA[nivel] || {};
  const conteo = contarTipos(historialTipos);
  const permitidos = tiposPermitidosPorNivel(nivel);
  const candidatosPendientes = [];

  // 🧩 Agrega tipos que aún no han cumplido su cobertura mínima
  for (const tipo in cobertura) {
    if (tipo === "extra") continue;
    if (!permitidos.includes(tipo)) continue;
    if ((conteo[tipo] || 0) < cobertura[tipo]) {
      candidatosPendientes.push(tipo);
    }
  }

  // ➕ Si faltan extras y hay disponibles, agrega uno
  if (candidatosPendientes.length === 0 && cobertura.extra) {
    const usados = TIPOS_EXTRA.filter(t => historialTipos.includes(t));
    const disponibles = TIPOS_EXTRA.filter(t => !usados.includes(t) && permitidos.includes(t));
    if (disponibles.length > 0) candidatosPendientes.push(disponibles[0]);
  }

  // 🪄 Si ya se cumplió todo, elige cualquier tipo permitido (excepto el último usado)
  if (candidatosPendientes.length === 0) {
    const restantes = TODOS.filter(t => t !== ultimoTipo && permitidos.includes(t));
    candidatosPendientes.push(...restantes);
  }

  // 🎲 Devuelve un tipo aleatorio dentro de los candidatos válidos
  return candidatosPendientes[Math.floor(Math.random() * candidatosPendientes.length)];
}
