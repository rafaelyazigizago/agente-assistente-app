// Agente Assistente · o Hoje do modo MVP (T017; US2: FR-002, FR-003, FR-004, FR-021), no desenho do protótipo v8:
// cadastrar escrevendo (Enviar), 5 partes do dia sempre à vista, arrastar muda a ordem e a parte. A tarefa de agora (a tocada,
// ou a 1ª não feita) fica em destaque, com o Travei embaixo; tocar só escolhe, abrir é pelo ⋯. A não feita de ontem aparece
// aqui sem marca. As contas ficam em hoje-dia.js; com o modo MVP desligado, o Hoje é o de sempre (telas.js).
import { diaPorExtenso, interpretar } from './datas.js';
import { estado, anotar, redesenhar } from './estado.js';
import { $, el } from './ui.js';
import { linha } from './telas.js';
import { abrirTraveiDe } from './tela-tarefa.js';
import { diaLocal } from './data-local.js';
import { PARTES_DO_HOJE, parteDaHora, partesDoHoje, tarefaDeAgora, caixaNoHoje } from './hoje-dia.js';
import { aoPedirParteSemLugar, diaOrganizado } from './arrastar.js';
import { aoAcoesDoHoje } from './acoes.js';

// A tarefa sem parte do dia fica na parte da hora em que o Hoje abriu, e não muda de lugar sozinha enquanto a tela está aberta.
let fixada = { dia: null, parte: null };
export function parteSemLugar() {
  const dia = diaLocal();
  if (fixada.dia !== dia) fixada = { dia, parte: parteDaHora() };
  return fixada.parte;
}
export const opcoesDoHoje = () => ({ parteSemLugar: parteSemLugar() });
aoPedirParteSemLugar(parteSemLugar);
aoAcoesDoHoje({ travei: abrirTraveiDe, parteNoHoje: (t) => caixaNoHoje(t, opcoesDoHoje()), organizou: diaOrganizado });

const escolher = (t) => { estado.agoraId = t.id; redesenhar(); };

function formCadastrar() {
  const campo = el('input', { id: 'texto-cadastrar', classe: 'campo', type: 'text', enterkeyhint: 'send', autocomplete: 'off', placeholder: 'ex.: ligar para o contador amanhã', 'aria-labelledby': 'rotulo-cadastrar' });
  const form = el('form', { classe: 'cadastrar', autocomplete: 'off', 'data-mantem-aviso': true },
    el('h2', { classe: 'parte', id: 'rotulo-cadastrar' }, 'Cadastre uma nova tarefa para hoje'),
    el('div', { classe: 'linha-anotar' }, campo, el('button', { type: 'submit', classe: 'btn principal' }, 'Enviar')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (!texto) return;
    // Sem data no texto, a tarefa é de hoje, na parte do dia de agora (Rafael, 11/11/2026: "A, parte de agora");
    // "ligar para o contador amanhã" vai para amanhã, como sempre
    const nova = await anotar(texto, false, interpretar(texto).dia ? {} : { dia: diaLocal(), parte_do_dia: parteDaHora() });
    if (nova) { campo.value = ''; setTimeout(() => $('texto-cadastrar')?.focus(), 30); }
  });
  return form;
}

export function desenharHojeMvp() {
  const tela = $('tela-hoje');
  const visiveis = estado.tarefas.filter((t) => t.estado !== 'cancelada');
  const partes = partesDoHoje(visiveis, opcoesDoHoje());
  const agora = tarefaDeAgora(partes, estado.agoraId);
  const todas = PARTES_DO_HOJE.flatMap(([c]) => partes[c]);
  const feitas = todas.filter((t) => t.estado === 'feita').length;
  const data = diaPorExtenso(diaLocal());
  const blocos = [
    el('h1', { id: 'titulo-hoje' }, 'Hoje'),
    el('p', { classe: 'data' }, data[0].toUpperCase() + data.slice(1), todas.length ? ` · ${feitas} de ${todas.length} feitas hoje` : ''),
    formCadastrar(),
  ];
  for (const [c, nome] of PARTES_DO_HOJE) {
    const cartoes = partes[c].map((t) => {
      const no = linha(t, { aoTocar: escolher, semDia: true });
      if (t === agora) {
        no.classList.add('agora');
        no.append(el('div', { classe: 'travei-agora' },
          el('button', { type: 'button', classe: 'btn principal', 'data-mantem-aviso': true, onclick: () => abrirTraveiDe(t) }, 'Travei')));
      }
      return no;
    });
    blocos.push(el('section', { classe: 'grupo caixa-hoje parte-hoje', 'data-caixa-hoje': c },
      el('h2', { classe: 'parte' }, nome),
      el('div', { classe: 'lista', 'data-reordena': true, 'data-caixa': c }, cartoes)));
  }
  tela.replaceChildren(...blocos);
}
