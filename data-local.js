// Agente Assistente · o dia e a hora de Brasília (T014). O app e a função `travei` contam o dia sempre em America/Sao_Paulo,
// mesmo quando o relógio do aparelho ou do servidor está em outro fuso (o Supabase roda em UTC). Cópia igual em
// supabase/functions/_shared/data-local.ts; testes/fuso.test.mjs confere as duas.
const FUSO = 'America/Sao_Paulo';
const partes = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });

function emBrasilia(instante) {
  const p = Object.fromEntries(partes.formatToParts(instante).map(({ type, value }) => [type, value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) };
}

// "2026-11-11": o dia de hoje em Brasília
export const diaLocal = (instante = new Date()) => emBrasilia(instante).dia;
// 0 a 23: a hora de agora em Brasília (as 9h da primeira tela, as 20h da pergunta da noite)
export const horaLocal = (instante = new Date()) => emBrasilia(instante).hora;
// O dia antes de um dia "AAAA-MM-DD" (conta só com datas, sem fuso)
export function diaAnterior(dia) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10);
}
