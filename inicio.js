// Agente Assistente · a regra do destaque azul da primeira tela (T029; spec US3, FR-001). Testada em testes/inicio.test.mjs.
// Rafael, 10/11/2026: antes das 9h, ou na 1ª abertura do dia ainda não organizado → "Quero organizar o meu dia";
// senão → "Me ajude a destravar". "Organizado" = arrastou uma tarefa no Hoje (fica no aparelho e em `dias`, pelo app.js).
// Hora e dia contam sempre em Brasília (data-local.js), mesmo com o aparelho em outro fuso.
import { diaLocal, horaLocal } from './data-local.js';

// dia: { aberto, organizado } de hoje · hora: só para os testes da tela (?hora=8)
export function destaqueDoInicio({ agora = new Date(), hora = horaLocal(agora), dia }) {
  return (hora < 9 || (!dia.aberto && !dia.organizado)) ? 'organizar' : 'destravar';
}

// O dia de hoje guardado no aparelho; o de outro dia (ou estragado) não vale
function diaDeHoje(agora, guarda) {
  const hoje = diaLocal(agora);
  try {
    const d = guarda.ler();
    if (d && typeof d === 'object' && d.dia === hoje) return { dia: hoje, aberto: !!d.aberto, organizado: !!d.organizado };
  } catch { /* sem acesso: vale como 1ª abertura */ }
  return { dia: hoje, aberto: false, organizado: false };
}
const gravar = (guarda, d) => { try { guarda.gravar(d); } catch { /* vale só agora */ } };

// Abrir a primeira tela: calcula o destaque e marca o dia como aberto
export function abrirODia({ agora = new Date(), hora, guarda }) {
  const d = diaDeHoje(agora, guarda);
  const destaque = destaqueDoInicio({ agora, hora: hora ?? horaLocal(agora), dia: d });
  gravar(guarda, { ...d, aberto: true });
  return destaque;
}

// Arrastou uma tarefa no Hoje: o dia fica organizado
export function marcarOrganizado({ agora = new Date(), guarda }) {
  gravar(guarda, { ...diaDeHoje(agora, guarda), organizado: true });
}

// O guardado de verdade: o localStorage do aparelho
const CHAVE = 'agente-inicio-dia';
export const guardaDoAparelho = {
  ler: () => JSON.parse(localStorage.getItem(CHAVE)),
  gravar: (d) => localStorage.setItem(CHAVE, JSON.stringify(d)),
};
