// Agente Assistente · as contas puras do Hoje do MVP (T017; testes/hoje-dia.test.mjs). Sem tela: o desenho fica em hoje.js.
// O "hoje" é o de America/Sao_Paulo (data-local.js). A tarefa não feita de um dia aparece no Hoje dos dias seguintes, na parte
// dela, sem marca de atraso nem contador (FR-021): isso é só leitura, nada é gravado.
import { diaLocal, horaLocal } from './data-local.js';

// As 5 partes do Hoje, com os nomes do protótipo v8 (FR-002)
export const PARTES_DO_HOJE = [['prioridades', 'Prioridade de hoje'], ['manha', 'Manhã'], ['almoco', 'Almoço'], ['tarde', 'Tarde'], ['noite', 'Noite']];
const PARTES_DO_DIA = ['manha', 'almoco', 'tarde', 'noite'];

// A parte do dia de uma hora de Brasília (valor do agente): manhã até 11h, almoço 12h–13h, tarde 14h–17h, noite a partir das 18h.
export function parteDaHora(hora = horaLocal()) {
  if (hora < 12) return 'manha';
  if (hora < 14) return 'almoco';
  if (hora < 18) return 'tarde';
  return 'noite';
}

// Em que parte do Hoje a tarefa fica, ou null se ela não é do Hoje.
// parteSemLugar: onde fica a tarefa do Hoje que não tem parte do dia.
export function caixaNoHoje(t, { agora = new Date(), parteSemLugar = parteDaHora(horaLocal(agora)) } = {}) {
  const hoje = diaLocal(agora);
  if (t.estado === 'feita') {
    if (!t.feita_em || diaLocal(new Date(t.feita_em)) !== hoje) return null;
  } else if (t.estado !== 'aberta') return null;
  else if (!t.dia || t.dia > hoje) {
    if (!(t.prioridade_semana && !t.dia)) return null;   // a estrela sem dia também é prioridade de hoje
  }
  if (t.prioridade_semana) return 'prioridades';
  return PARTES_DO_DIA.includes(t.parte_do_dia) ? t.parte_do_dia : parteSemLugar;
}

// O que muda numa tarefa solta noutra parte do Hoje: ela passa a ser de hoje, naquela parte.
export function mudancaNoHoje(caixa, hoje = diaLocal()) {
  if (caixa === 'prioridades') return { dia: hoje, prioridade_semana: true };
  return PARTES_DO_DIA.includes(caixa) ? { dia: hoje, prioridade_semana: false, parte_do_dia: caixa } : null;
}

// A ordem dentro de uma parte: a que você escolheu arrastando; sem ela, a de criação. A feita fica no lugar, riscada.
export function ordemNoHoje(a, b) {
  return ((a.ordem ?? Infinity) - (b.ordem ?? Infinity)) || (a.criado_em || '').localeCompare(b.criado_em || '');
}

// As tarefas do Hoje por parte, cada parte já na ordem.
export function partesDoHoje(tarefas, opcoes = {}) {
  const partes = Object.fromEntries(PARTES_DO_HOJE.map(([c]) => [c, []]));
  for (const t of tarefas) {
    const c = caixaNoHoje(t, opcoes);
    if (c) partes[c].push(t);
  }
  for (const c of Object.keys(partes)) partes[c].sort(ordemNoHoje);
  return partes;
}

// A tarefa de agora: a escolhida (se ainda está aberta no Hoje) ou a 1ª não feita na ordem. Não é gravada.
export function tarefaDeAgora(partes, escolhidaId) {
  const abertas = PARTES_DO_HOJE.flatMap(([c]) => partes[c]).filter((t) => t.estado === 'aberta');
  return abertas.find((t) => t.id === escolhidaId) ?? abertas[0] ?? null;
}
