// Agente Assistente · a contagem da semana e a pergunta da noite (T031; spec US4, FR-012, FR-020, SC-003, SC-004).
// Testada em testes/contagem.test.mjs. Rafael, 11/11/2026: a contagem fica no Início, acima do "Me ajude a destravar",
// com o texto "3 tarefas travadas esta semana." e sem a meta ("Remover a meta, isso traz estresse").
// Semana = de segunda a domingo; dia e hora sempre em Brasília (data-local.js).
import { diaLocal, horaLocal } from './data-local.js';

const NOITE = 20;   // a pergunta da noite: 1ª abertura a partir das 20h (valor do agente, spec)

// "AAAA-MM-DD" ± n dias, só com datas (sem fuso)
function somar(dia, n) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

// A semana do dia: { inicio: segunda, fim: domingo }
export function semanaDe(dia) {
  const [a, m, d] = dia.split('-').map(Number);
  const desdeSegunda = (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;
  const inicio = somar(dia, -desdeSegunda);
  return { inicio, fim: somar(inicio, 6) };
}

// travadas: linhas da tabela (cada uma é um passo de uma conversa) · dias: linhas de `dias`
// nomeDaTarefa(id) → o título, ou null (aí vale "Geral")
export function contarSemana({ agora = new Date(), travadas = [], dias = [], nomeDaTarefa = () => null }) {
  const { inicio, fim } = semanaDe(diaLocal(agora));
  const naSemana = (dia) => dia >= inicio && dia <= fim;
  const linhas = travadas
    .map((t) => ({ ...t, dia: diaLocal(new Date(t.criado_em)) }))
    .filter((t) => naSemana(t.dia))
    .sort((x, y) => new Date(x.criado_em) - new Date(y.criado_em));

  // uma por conversa; linha antiga sem conversa conta sozinha. O resultado da conversa é o do último passo.
  const conversas = new Map();
  linhas.forEach((t, i) => {
    const chave = t.conversa_id ?? `linha-${t.id ?? i}`;
    const c = conversas.get(chave);
    if (c) c.resultado = t.resultado;
    else conversas.set(chave, { dia: t.dia, criado_em: t.criado_em, tarefa: (t.tarefa_id && nomeDaTarefa(t.tarefa_id)) || 'Geral', texto: t.texto ?? '', resultado: t.resultado });
  });

  const semTravei = dias.filter((d) => naSemana(d.data)).reduce((s, d) => s + (Number.isInteger(d.sem_travei) ? d.sem_travei : 0), 0);
  const passos = linhas.filter((t) => t.passo).length;
  const aceitas = linhas.filter((t) => t.passo && t.resultado === 'aceitou').length;
  return {
    inicio, fim,
    conversas: conversas.size, semTravei, total: conversas.size + semTravei,
    passos, aceitas, taxa: passos ? aceitas / passos : null,
    detalhe: [...conversas.values()],
  };
}

// O texto do Início
export const textoDaContagem = (n) => (n === 1 ? '1 tarefa travada esta semana.' : `${n} tarefas travadas esta semana.`);

// Sobre qual dia perguntar agora (ou null). dias = as linhas de `dias` (uma por dia aberto).
// A partir das 20h: sobre hoje, se ainda não perguntou. Antes: sobre o último dia aberto antes de hoje, se ainda não perguntou.
// Dia sem abertura não tem linha e não é perguntado; feita ou pulada (pergunta_feita_em preenchida) não volta.
export function perguntaDaNoite({ agora = new Date(), dias = [] }) {
  const hoje = diaLocal(agora);
  if (horaLocal(agora) >= NOITE) {
    const d = dias.find((x) => x.data === hoje);
    return d && !d.pergunta_feita_em ? hoje : null;
  }
  const anterior = dias.filter((x) => x.data < hoje).sort((x, y) => (x.data < y.data ? 1 : -1))[0];
  return anterior && !anterior.pergunta_feita_em ? anterior.data : null;
}

// O que gravar no dia: vezes = 0 ("Nenhuma"), 1, 2… ou null (pulou)
export function respostaDaNoite({ agora = new Date(), vezes }) {
  if (vezes !== null && !(Number.isInteger(vezes) && vezes >= 0)) throw new Error(`resposta inválida: ${vezes}`);
  return { sem_travei: vezes, pergunta_feita_em: agora.toISOString() };
}
