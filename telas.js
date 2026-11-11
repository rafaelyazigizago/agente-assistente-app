// Centelha · telas Hoje e Semana (no Calendário) e os botões de dia (o que era a Caixa de entrada).
import { diaPorExtenso, rotuloDia, somarDias, interpretar } from './datas.js';
import { lampadasDoDia, varalDaSemana, tarefasDoDia, passaNasLentes, segundaDaSemana, CAIXAS_DO_HOJE, caixaDoHoje, yNoFio, FIO_DIA, temMarca, REPETICOES, duracaoTexto } from './calculos.js';
import { estado, secao, alternarFeita, moverPara, anotar } from './estado.js';
import { $, el, icone, caixinha, lampadaInterna, reiniciar, movimento } from './ui.js';
import { alternarEstrela, abrirAcoes, alternarSelecao, selecao } from './acoes.js';
import { ligarArrastar } from './arrastar.js';
import { corDe } from './etiquetas.js';
import { usavel } from './funcoes.js';
import { matrizQuadros } from './tela-lista.js';
import { modoMvpLigado } from './modo-mvp.js';

const LENTES = [['dinheiro', 'Traz renda'], ['tempo', 'Libera tempo'], ['amor', 'Quem eu amo']];   // "Traz renda" e "Libera tempo": nomes novos (28/10; o 2º para não confundir com "Quanto tempo deve levar")
const dobrasAbertas = new Set();
let abrirTarefa = () => {};
export const aoAbrirTarefa = (f) => { abrirTarefa = f; };
export const abrir = (t) => abrirTarefa(t);   // para as visões (visoes.js), que não usam o cartão
const visiveis = (t) => t.estado !== 'cancelada';

// ---------- Uma tarefa: a caixinha de concluir, o título, o porquê, a linha de detalhes e os botões ----------
// Como no Microsoft To Do: estrela à direita (opcional), ⋯ ou clique direito abre as ações, Shift+clique escolhe várias.
// aoTocar (Hoje do MVP): tocar no texto escolhe a tarefa em vez de abrir. semDia: sem a marca do dia (FR-021, sem atraso).
export function linhaTarefa(t, { umToque, semGrupo, estrela, semProjeto, aoTocar, semDia } = {}) {
  const feita = t.estado === 'feita';
  const marca = estado.marcas.get(t.id);
  const escolhida = selecao.has(t.id);
  const classes = ['tarefa', feita && 'feita', marca && 'saiu', t.nova && 'entrou', estado.recem === t.id && 'recem',
    escolhida && 'escolhida', estado.painel === t.id && 'no-painel'].filter(Boolean).join(' ');
  t.nova = false;
  const marcas = [];
  if (!semDia && t.dia && !['hoje', 'prioridade', 'amanha'].includes(secao(t)) && !marca) marcas.push(el('span', { classe: 'marca-t' }, rotuloDia(t.dia)));
  const passos = estado.passos.get(t.id);
  if (passos?.total) marcas.push(el('span', { classe: 'marca-t' }, `${passos.feitos} de ${passos.total} passos`));
  if (t.minutos && usavel('tempo')) marcas.push(el('span', { classe: 'marca-t' }, `~${duracaoTexto(t.minutos * 60000)}`));
  const projeto = !semProjeto && t.projeto_id && usavel('projetos') && estado.projetos.find((p) => p.id === t.projeto_id);
  if (projeto) marcas.push(el('span', { classe: 'marca-t projeto' }, `◆ ${projeto.nome}`));
  for (const [chave, nome] of LENTES) if ((t.lentes || []).includes(chave)) marcas.push(el('span', { classe: 'marca-t', html: `${icone(chave)} ${nome}` }));
  if (t.repetir_dias > 0) marcas.push(el('span', { classe: 'marca-t' }, `↻ ${REPETICOES.find(([n]) => n === t.repetir_dias)?.[1] ?? `a cada ${t.repetir_dias} dias`}`));
  if (temMarca(t, 'importante') && usavel('matriz')) marcas.push(el('span', { classe: 'marca-t importante' }, 'Importante'));
  if (temMarca(t, 'urgente') && usavel('matriz')) marcas.push(el('span', { classe: 'marca-t urgente' }, 'Urgente'));
  if ((t.etiquetas || []).some((e) => /^ideias?$/i.test(e))) marcas.push(el('span', { classe: 'marca-t ideia' }, 'ideia'));
  for (const e of (t.etiquetas || []).filter((e) => !/^(ideias?|importante|urgente)$/i.test(e) && e !== t.subgrupo).slice(0, 2)) marcas.push(el('span', { classe: 'marca-t etiqueta', 'data-cor': corDe(e) }, '#' + e));
  if (!semGrupo && (t.area || t.subgrupo)) marcas.push(el('span', { classe: 'marca-t' }, [t.area, t.subgrupo].filter(Boolean).join(' › ')));
  if (marca) marcas.push(el('span', { classe: 'marca-t aviso' }, marca));

  const cartao = el('div', { classe: classes, 'data-id': t.id, oncontextmenu: (e) => { e.preventDefault(); if (!estado.segurando) abrirAcoes(t); } },   // no celular, segurar é arrastar (arrastar.js)
    el('button', {
      type: 'button', classe: 'botao-lamp', 'aria-pressed': String(feita), 'data-mantem-aviso': true,
      'aria-label': `Concluir: ${t.titulo}`, html: caixinha(feita),
      onclick: (e) => alternarFeita(t, e.currentTarget),
    }),
    el('button', {
      type: 'button', classe: 'texto', 'aria-label': `${estado.selecionando ? (escolhida ? 'Desmarcar' : 'Escolher') : aoTocar ? 'Destacar' : 'Abrir'}: ${t.titulo}`,
      'aria-pressed': estado.selecionando ? String(escolhida) : null, 'data-mantem-aviso': estado.selecionando || null,
      onclick: (e) => (e.shiftKey || estado.selecionando ? alternarSelecao(t) : aoTocar ? aoTocar(t) : abrirTarefa(t)),
    },
      el('span', { classe: 'titulo-t' }, t.titulo),
      t.porque ? el('span', { classe: 'porque', html: `${icone('faisca')}<span></span>` }) : null,
      marcas.length ? el('span', { classe: 'marcas' }, marcas) : null),
    umToque && !feita && !estado.selecionando ? el('button', {
      type: 'button', classe: 'pilula um-toque', 'data-mantem-aviso': true,
      onclick: () => moverPara(t, umToque === 'Para amanhã' ? somarDias(estado.hoje, 1) : estado.hoje),
    }, umToque) : null,
    estrela ? el('button', {
      type: 'button', classe: 'icone-btn leve estrela', 'aria-pressed': String(!!t.prioridade_semana), 'data-mantem-aviso': true,
      'aria-label': `${t.prioridade_semana ? 'Tirar a estrela' : 'Pôr estrela'}: ${t.titulo}`, html: icone('estrela'),
      onclick: () => alternarEstrela(t),
    }) : null,
    el('button', {
      type: 'button', classe: 'icone-btn leve mais', 'aria-label': `Mais ações: ${t.titulo}`, 'aria-haspopup': 'dialog',
      onclick: () => abrirAcoes(t),
    }, '⋯'),
  );
  ligarArrastar(cartao, t);   // no notebook: arrastar para mudar a ordem ou soltar no menu lateral
  return cartao;
}
function comPorque(no, t) {
  const p = no.querySelector('.porque span');
  if (p) p.textContent = t.porque;
  return no;
}
export const linha = (t, o) => comPorque(linhaTarefa(t, o), t);

export function dobra(id, titulo, quantos, conteudo, conjunto = dobrasAbertas, classe = '') {
  const aberta = conjunto.has(id);
  const caixa = el('div', { classe: ['dobra', classe].filter(Boolean).join(' '), 'data-aberto': String(aberta) });
  const botao = el('button', {
    type: 'button', 'aria-expanded': String(aberta),
    onclick: () => {
      const agora = !conjunto.has(id);
      if (agora) conjunto.add(id); else conjunto.delete(id);
      caixa.dataset.aberto = String(agora);
      botao.setAttribute('aria-expanded', String(agora));
      gaveta.inert = !agora;
    },
  }, el('span', { classe: 'seta', 'aria-hidden': 'true' }, '›'), el('span', {}, titulo, quantos == null ? '' : ' ', quantos == null ? '' : el('span', { classe: 'n' }, `· ${quantos}`)));
  const gaveta = el('div', { classe: 'gaveta' }, el('div', {}, el('div', { classe: 'miolo-dobra' }, conteudo)));
  gaveta.inert = !aberta;   // fechada, nada de dentro recebe o foco
  caixa.append(botao, gaveta);
  return caixa;
}

// ---------- Varal pequeno do dia ----------
let ultimasAcesas = null;
function varalMini() {
  const { total, acesas } = lampadasDoDia(estado.tarefas, estado.hoje);
  const n = Math.min(total, 12);
  const largura = 320;
  let html = `<path class="fio" d="M0 4 Q${largura / 2} 30 ${largura} 4"/>`;
  const acendeuAgora = ultimasAcesas !== null && acesas > ultimasAcesas;
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? largura / 2 : 20 + i * ((largura - 40) / (n - 1));
    const y = yNoFio(FIO_DIA, x);
    const acesa = i < Math.min(acesas, n);
    const anima = acendeuAgora && i === Math.min(acesas, n) - 1 ? ' acendendo' : '';
    html += `<g transform="translate(${x - 9} ${y})"><g class="${anima.trim()}" style="transform-box:fill-box;transform-origin:center">${lampadaInterna(acesa, 0, 2, 18, 24)}</g></g>`;
  }
  const subiu = ultimasAcesas !== null && acesas !== ultimasAcesas;
  ultimasAcesas = acesas;
  const numero = el('span', { classe: 'numero' + (subiu ? ' subiu' : '') }, String(acesas));
  return [
    el('div', { classe: 'varal-mini', 'aria-hidden': 'true', html: `<svg viewBox="0 0 ${largura} 56">${html}</svg>` }),
    el('p', { classe: 'contagem' }, total ? numero : '', total ? ` de ${total} feitas hoje` : 'Nada marcado para hoje ainda'),
  ];
}

// ---------- Anotar, com a prévia de para onde vai ----------
let ignorarData = false;
function formAnotar() {
  const campo = el('input', { id: 'texto-anotar', type: 'text', enterkeyhint: 'done', autocomplete: 'off', placeholder: 'Anotar…' });
  const previa = el('p', { classe: 'dica', id: 'previa', 'aria-live': 'polite' }, 'ex.: ligar para o contador amanhã');
  const mostrar = () => {
    const texto = campo.value.trim();
    if (!texto) { ignorarData = false; previa.replaceChildren('ex.: ligar para o contador amanhã'); return; }
    const lido = interpretar(texto);
    const partes = [];
    if (lido.dia && !ignorarData) {
      partes.push(`Vai para: ${rotuloDia(lido.dia)}`);
      partes.push(el('button', { type: 'button', classe: 'pilula', 'data-mantem-aviso': true, onclick: () => { ignorarData = true; mostrar(); } }, `"${lido.palavraData}" não é data`));
    } else {
      partes.push('Fica sem dia (em Todas)');
      if (lido.dia) partes.push(el('button', { type: 'button', classe: 'pilula', 'data-mantem-aviso': true, onclick: () => { ignorarData = false; mostrar(); } }, `Usar "${lido.palavraData}"`));
    }
    if (lido.etiquetas.length) partes.splice(1, 0, ` · ${lido.etiquetas.map((e) => '#' + e).join(' ')}`);
    previa.replaceChildren(...partes);
  };
  campo.addEventListener('input', () => { ignorarData = false; mostrar(); });
  const form = el('form', { classe: 'anotar', autocomplete: 'off', 'data-mantem-aviso': true },
    el('label', { for: 'texto-anotar' }, 'Anotar uma tarefa'),
    el('div', { classe: 'linha-anotar' }, campo, el('button', { type: 'submit', classe: 'btn' }, 'Anotar')),
    previa);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (!texto) return;
    const nova = await anotar(texto, ignorarData);
    if (nova) { campo.value = ''; ignorarData = false; mostrar(); setTimeout(() => $('texto-anotar')?.focus(), 30); }
  });
  return form;
}

// ---------- HOJE ----------
// Do dia | O que fazer primeiro (era "Matriz"; nome de 29/10): só aparece com a função ligada em Ajustes
let modoHoje = 'dia';
const trocaDoHoje = () => (usavel('matriz') ? el('div', { classe: 'fileira visoes', role: 'group', 'aria-label': 'Ver o Hoje como' }, [['dia', 'Do dia'], ['matriz', 'O que fazer primeiro']].map(([m, nome]) => el('button', {
  type: 'button', classe: 'pilula', 'aria-pressed': String(modoHoje === m), onclick: () => { modoHoje = m; desenharHoje(); },
}, nome))) : null);

export function desenharHoje() {
  const tela = $('tela-hoje');
  const doTipo = (s) => estado.tarefas.filter((t) => visiveis(t) && secao(t) === s && passaNasLentes(t, estado.lentes));
  const hoje = diaPorExtenso(estado.hoje);
  const blocos = [
    el('h1', { id: 'titulo-hoje' }, 'Hoje'),
    el('p', { classe: 'data' }, hoje[0].toUpperCase() + hoje.slice(1)),
    ...varalMini(),
    formAnotar(),
    trocaDoHoje(),
  ];

  // As caixas do Hoje (pedido de Rafael, 28/10): cartões separados, como na tela Prioridades, e cada tarefa numa caixa só.
  const daCaixa = new Map(CAIXAS_DO_HOJE.map(([c]) => [c, []]));
  const feitasAntes = [];   // feitas antes de abrir a tela: recolhidas no fim; a que você acende agora fica no lugar, acesa
  for (const t of estado.tarefas) {
    if (!visiveis(t) || !passaNasLentes(t, estado.lentes)) continue;
    const c = caixaDoHoje(t, secao(t));
    if (c && t.estado === 'feita' && !estado.abertasNoInicio.has(t.id)) feitasAntes.push(t);
    else if (c) daCaixa.get(c).push(t);
  }
  // O que fazer primeiro (a Matriz do lote 42): um jeito de ver o Hoje. As tarefas abertas de hoje nas 4 caixas; arrastar troca as marcas.
  if (usavel('matriz') && modoHoje === 'matriz') {
    const doDia = [...daCaixa.values()].flat().filter((t) => t.estado === 'aberta');
    blocos.push(el('p', { classe: 'ajuda' }, 'As tarefas de hoje em 4 caixas, da que fazer agora à que pode esperar. Arraste para outra caixa, ou use o ⋯, para trocar as marcas.'), matrizQuadros(doDia, { estrela: true }));
    tela.replaceChildren(...blocos.filter(Boolean));
    return;
  }
  const caixa = (c, nome, opcoes = {}) => {
    const tarefas = daCaixa.get(c).sort(ordemNaCaixa);
    return el('section', { classe: 'grupo caixa-hoje' + (tarefas.length ? '' : ' vazia'), 'data-caixa-hoje': c },
      el('h2', {}, c === 'prioridades' ? el('span', { html: icone('estrela', 'estrela-titulo') }) : null, nome, el('span', { classe: 'n' }, String(tarefas.length))),
      listaDaCaixa(c, tarefas, opcoes));
  };
  const nomes = Object.fromEntries(CAIXAS_DO_HOJE);

  blocos.push(caixa('prioridades', nomes.prioridades));
  blocos.push(el('div', { classe: 'lentes', role: 'group', 'aria-label': 'Lentes' }, LENTES.map(([chave, nome]) => el('button', {
    type: 'button', classe: 'pilula', 'aria-pressed': String(estado.lentes.has(chave)), html: `${icone(chave)}${nome}`,
    onclick: () => {
      if (estado.lentes.has(chave)) estado.lentes.delete(chave); else estado.lentes.add(chave);
      desenharHoje();
      reiniciar(document.querySelector(`.lentes .pilula:nth-child(${LENTES.findIndex(([c]) => c === chave) + 1})`), 'pop');
    },
  }))));

  const partes = ['manha', 'almoco', 'tarde', 'noite', 'qualquer'];
  if (partes.every((c) => !daCaixa.get(c).length)) {
    blocos.push(el('p', { classe: 'vazio' }, estado.lentes.size
      ? 'Nenhuma tarefa de hoje com essa lente. Abra uma tarefa para marcar as lentes dela.'
      : 'Nada marcado para hoje. Anote acima, traga algo de Todas (o filtro "Sem dia") ou arraste para uma das caixas.'));
  }
  for (const c of partes) blocos.push(caixa(c, nomes[c], { umToque: 'Para amanhã' }));
  for (const c of ['andamento', 'aguardando']) {
    const tarefas = daCaixa.get(c).sort(ordemNaCaixa);
    const d = dobra(c, nomes[c], tarefas.length, listaDaCaixa(c, tarefas));
    d.classList.add('caixa-hoje');
    if (!tarefas.length) d.classList.add('vazia');
    d.dataset.caixaHoje = c;
    blocos.push(d);
  }

  if (feitasAntes.length) {
    const d = dobra('feitas-hoje', 'Feitas hoje', feitasAntes.length, el('div', { classe: 'lista' }, feitasAntes.sort(ordenar).map((t) => linha(t, { estrela: true }))));
    d.classList.add('feitas-hoje');
    blocos.push(d);
  }

  // Amanhã e Próximos dias ficam no Calendário; o que ficou para trás, em Todas (lote 44: "Aqui no Hoje entram as tarefas
  // que eu marquei para hoje"). Fica uma linha só, para o atrasado não sumir da cabeça (lembrete externo, R7).
  const atras = doTipo('para-tras').filter((t) => t.estado === 'aberta' && !caixaDoHoje(t, secao(t)));
  // Modo MVP: sem contador de atrasadas (FR-019, Constitution III). A tarefa de ontem passa a aparecer no Hoje, sem marca (T017).
  if (atras.length && !modoMvpLigado()) {
    blocos.push(el('p', { classe: 'linha-atras' }, el('button', { type: 'button', classe: 'link-leve', id: 'ver-atras', onclick: () => irParaTodas('atras') },
      `${atras.length} ${atras.length === 1 ? 'ficou' : 'ficaram'} para trás · ver em Todas`)));
  }
  tela.replaceChildren(...blocos.filter(Boolean));
}

const ORDEM_PARTE = { manha: 1, almoco: 2, tarde: 3, noite: 4 };
function ordenar(a, b) {
  if (a.estado !== b.estado) return a.estado === 'feita' ? 1 : -1;
  const pa = ORDEM_PARTE[a.parte_do_dia] ?? 9, pb = ORDEM_PARTE[b.parte_do_dia] ?? 9;
  if (pa !== pb) return pa - pb;
  return (a.hora ?? '99').localeCompare(b.hora ?? '99') || (a.criado_em || '').localeCompare(b.criado_em || '');
}

// Dentro de uma caixa do Hoje: as feitas por último; depois a ordem que você escolheu arrastando; sem ela, a de sempre.
function ordemNaCaixa(a, b) {
  if (a.estado !== b.estado) return a.estado === 'feita' ? 1 : -1;
  return ((a.ordem ?? Infinity) - (b.ordem ?? Infinity)) || ordenar(a, b);
}
// A lista de uma caixa aceita arrastar: muda a ordem e, vinda de outra caixa, muda o dia, a parte do dia ou a situação.
const listaDaCaixa = (c, tarefas, opcoes = {}) => el('div', { classe: 'lista', 'data-reordena': true, 'data-caixa': c },
  tarefas.map((t) => linha(t, { estrela: true, ...opcoes })));

// ---------- Os botões de dia: o que era a Caixa de entrada (desde o lote 42, em Todas, com o filtro "Sem dia") ----------
export function comBotoesDeDia(no, t) {
  if (estado.marcas.has(t.id) || t.estado !== 'aberta' || t.dia === estado.hoje) return no;
  const escolher = el('input', { type: 'date', 'aria-label': `Outro dia para ${t.titulo}`, hidden: true,
    onchange: (e) => { if (e.target.value) moverPara(t, e.target.value); } });
  no.append(el('div', { classe: 'fileira botoes-dia' },
    el('button', { type: 'button', classe: 'pilula', 'data-mantem-aviso': true, onclick: () => moverPara(t, estado.hoje) }, 'Hoje'),
    el('button', { type: 'button', classe: 'pilula', 'data-mantem-aviso': true, onclick: () => moverPara(t, somarDias(estado.hoje, 1)) }, 'Amanhã'),
    el('button', { type: 'button', classe: 'pilula', onclick: () => { escolher.hidden = false; try { escolher.showPicker?.(); } catch { /* sem seletor: o campo fica à vista */ } escolher.focus(); } }, 'Outro dia'),
    escolher));
  no.style.flexWrap = 'wrap';
  return no;
}

// ---------- Calendário: Semana | Mês (lote 42). A troca e o "Sem dia" são abertos pelo app.js ----------
let trocarCalendario = () => {}, abrirTodasCom = () => {};
export const aoTrocarCalendario = (f) => { trocarCalendario = f; };
export const aoAbrirTodasCom = (f) => { abrirTodasCom = f; };
// Todas com um filtro ligado: 'semdia', 'atras', 'aguardando' ou 'andamento'
export const irParaTodas = (filtro) => abrirTodasCom(filtro);
export function trocaDoCalendario(modo) {
  return el('div', { classe: 'fileira visoes', role: 'group', 'aria-label': 'Ver o calendário por' }, [['semana', 'Semana'], ['mes', 'Mês']].map(([m, nome]) => el('button', {
    type: 'button', classe: 'pilula', 'aria-pressed': String(m === modo), onclick: () => { if (m !== modo) trocarCalendario(m); },
  }, nome)));
}

// ---------- SEMANA: "Sua semana", os 7 dias numa linha reta (lote 46; antes, um varal em curva) ----------
let diaEscolhido = null;
export function desenharSemana(entrando = false) {
  const tela = $('tela-semana');
  const dias = varalDaSemana(estado.tarefas, estado.hoje);
  if (!diaEscolhido || !dias.some((d) => d.iso === diaEscolhido)) diaEscolhido = estado.hoje;
  const segunda = segundaDaSemana(estado.hoje), domingo = somarDias(segunda, 6);
  const [, mesS, diaS] = segunda.split('-'), [, mesD, diaD] = domingo.split('-');
  const intervalo = mesS === mesD ? `${+diaS} a ${+diaD}` : `${+diaS}/${mesS} a ${+diaD}/${mesD}`;

  let html = '<path class="fio" d="M2 18 L358 18"/>';
  dias.forEach((d, i) => {
    const x = 22 + i * 52.6;
    const y = 18;
    const acesa = d.acesas > 0;
    const forca = d.total ? d.acesas / d.total : 0;
    const atraso = entrando && movimento() !== 'parado' ? i * (movimento() === 'calmo' ? 60 : 110) : 0;
    const legenda = d.domingo && !d.total ? 'descanso' : d.total ? `${d.acesas} de ${d.total}` : '';
    html += `<g transform="translate(${x - 15} ${y})"><g class="pendente${entrando ? ' balanca' : ''}${d.iso === diaEscolhido ? ' escolhido' : ''}" data-iso="${d.iso}" role="button" tabindex="0" aria-label="${d.nome}${d.hoje ? ', hoje' : ''}: ${legenda || 'nada marcado'}" style="transform-box:fill-box;transform-origin:15px 0;animation-delay:${atraso}ms">` +
      `<line x1="15" y1="0" x2="15" y2="10" stroke="currentColor" stroke-width="1.4" style="color:var(--suave)"/>` +
      `<g style="opacity:${acesa ? (.55 + .45 * forca).toFixed(2) : 1}">${lampadaInterna(acesa, 0, 8, 30, 40)}</g>` +
      (d.domingo ? '<text x="27" y="18" style="font-size:12px">☾</text>' : '') +
      `<text x="15" y="66" class="${d.hoje ? 'hoje-rot' : ''}">${d.nome}</text>` +
      `<text x="15" y="80">${d.hoje ? 'hoje' : legenda}</text></g></g>`;
  });
  const varal = el('div', { classe: 'varal', html: `<svg viewBox="0 0 360 140" role="group" aria-label="Sua semana">${html}</svg>` });
  varal.querySelectorAll('.pendente').forEach((g) => {
    const escolher = () => { diaEscolhido = g.dataset.iso; desenharSemana(false); const n = $('tela-semana').querySelector(`.pendente[data-iso="${diaEscolhido}"]`); if (n) reiniciar(n, 'balanca'); };
    g.addEventListener('click', escolher);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(); } });
  });

  const doDia = tarefasDoDia(estado.tarefas, diaEscolhido).filter(visiveis).sort(ordenar);
  const nomeDia = diaEscolhido === estado.hoje ? 'Hoje' : diaPorExtenso(diaEscolhido);
  tela.replaceChildren(
    el('h1', { id: 'titulo-semana' }, 'Calendário'),
    trocaDoCalendario('semana'),
    el('p', { classe: 'data' }, `Sua semana · ${intervalo}`),
    varal,
    el('section', { classe: 'grupo cartao' },
      el('h2', {}, nomeDia[0].toUpperCase() + nomeDia.slice(1), el('span', { classe: 'n' }, String(doDia.length))),
      doDia.length ? el('div', { classe: 'lista', style: 'margin-top:10px' }, doDia.map((t) => linha(t)))
        : el('p', { classe: 'vazio' }, diaEscolhido === domingo ? 'Domingo é descanso.' : 'Nada marcado para este dia. Na tarefa aberta, escolha este dia para ela vir para cá.')),
  );
}
