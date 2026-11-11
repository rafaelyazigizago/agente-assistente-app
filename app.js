// Agente Assistente · a casca do app: é o protótipo de 10/11/2026 (sobre o v8 de 06/11), em tela cheia, ligado aos dados de verdade.
// Rafael, 11/11/2026: "É para seguir exatamente o layout que eu pedi. [...] é isso aqui e somente isso, não quero nada antigo".
// Com dado de verdade: Início (Assistente), Hoje, a tarefa aberta, o Travei (travei.js) e o que já funciona em Configurações.
// O resto que o protótipo mostra aparece igual e, ao tocar, abre "Ainda sem tela" (Rafael: "A, como no protótipo").
import { diaPorExtenso, interpretar, somarDias, deISO, hojeISO } from './datas.js';
import { segundaDaSemana } from './calculos.js';
import * as dados from './dados.js';
import { estado, aoMudar, fixarSecoes, alternarFeita, anotar, mudar, moverPara } from './estado.js';
import { $, el, svg, comIcone, avisar, ligarAviso, mostrarEstado } from './ui.js';
import { diaLocal, diaAnterior } from './data-local.js';
import { PARTES_DO_HOJE, parteDaHora, partesDoHoje, tarefaDeAgora, caixaNoHoje, mudancaNoHoje } from './hoje-dia.js';
import { abrirTravei, ligarTela as ligarTelaTravei, aoAbrirOApp as aoAbrirOTravei, TEXTO_LARA } from './travei.js';
import * as tema from './tema.js';
import { botaoFale, ligarCampo, aoEnviar, vaiEnviar, naoEnviou } from './fale.js';
import { abrirODia, marcarOrganizado, guardaDoAparelho } from './inicio.js';
import { semanaDe, contarSemana, perguntaDaNoite, respostaDaNoite, textoDaContagem } from './contagem.js';

// ---------- As seções (as mesmas do protótipo) ----------
// Assistente e Menu são fixos; Configurações fica sempre dentro do Menu. No MVP só o Hoje tem tela.
const SECOES = [['hoje', 'Hoje'], ['diario', 'Diário'], ['semana', 'Semana'], ['listas', 'Listas'], ['financeiro', 'Financeiro'],
  ['crm', 'CRM'], ['triagem', 'Triagem'], ['calendario', 'Calendário']];
const nome = Object.fromEntries(SECOES);
const COM_TELA = new Set(['assistente', 'hoje']);
const SEM_BARRA = ['entrar', 'tarefa', 'travei'];   // uma coisa por vez: sem a barra de baixo
const DA_ABA = { tarefa: 'hoje' };
const PARTES = Object.fromEntries(PARTES_DO_HOJE);
// celular: 4 lugares na barra (2 escolhidos); tablet e computador: 7 lugares (5 escolhidos)
const largo = matchMedia('(min-width: 768px)');
const lugares = () => (largo.matches ? 5 : 2);

const guardado = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v : padrao; } catch { return padrao; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem guardar: vale só agora */ } };
let ativas = new Set(guardado('agente-secoes-ativas', SECOES.map(([id]) => id)).filter((id) => nome[id]));
function lerBarra() {
  const n = lugares(), padrao = ['hoje', 'diario'];
  for (const [id] of SECOES) if (padrao.length < n && !padrao.includes(id)) padrao.push(id);
  return guardado(`agente-barra-${n}`, padrao).filter((id) => ativas.has(id)).slice(0, n);
}
let naBarra = lerBarra();
const gravarBarra = () => guardar(`agente-barra-${lugares()}`, naBarra);

// ---------- Ir de uma tela a outra (como o protótipo: uma vista por vez, com a pilha do Voltar) ----------
let atual = null, pilha = [], abaDoSemTela = null, tarefaId = null;
const vista = (v) => document.querySelector(`.vista[data-v="${v}"]`);

function ir(v, voltando = false) {
  if (!vista(v)) return;
  if (!voltando && atual && v !== atual) pilha.push(atual);
  atual = v;
  fecharFolha();
  document.querySelectorAll('.vista').forEach((x) => { const on = x.dataset.v === v; x.classList.toggle('on', on); x.hidden = !on; });
  if (v === 'assistente') { desenharInicio(); if (estado.carregadoEm) carregarSemana(); }
  if (v === 'hoje' && estado.carregadoEm) desenharHoje();
  const r = vista(v).querySelector('.rolagem');
  if (r) r.scrollTop = 0;
  barra();
}
const voltar = () => ir(pilha.pop() || 'assistente', true);

// "Ainda sem tela": o título da seção e a frase, com a barra de baixo (como Semana, Financeiro e CRM no protótipo)
function semTela(titulo, aba = null) {
  $('titulo-sem-tela').textContent = titulo;
  abaDoSemTela = aba;
  ir('sem-tela');
}
function irSecao(id) {
  if (COM_TELA.has(id)) { pilha = []; ir(id, true); return; }
  pilha = [];
  semTela(nome[id] || id, id);
}

// ---------- A barra de baixo (desenho e animação do protótipo: linha em cima, ícone preenche) ----------
function barra() {
  const abas = $('abas');
  const itens = [['assistente', 'Assistente'], ...naBarra.map((id) => [id, nome[id]]), ['menu', 'Menu']];
  const aba = atual === 'sem-tela' ? abaDoSemTela : (DA_ABA[atual] || atual), chave = itens.map(([id]) => id).join();
  // a barra só é redesenhada quando os itens mudam; senão troca só a aba escolhida, para a passagem animar
  if (abas.dataset.chave !== chave) {
    abas.dataset.chave = chave;
    abas.innerHTML = itens.map(([id, n]) => `<button class="aba${id === aba ? ' ativa' : ''}" type="button" data-aba="${id}">${svg(id)}${n}</button>`).join('');
  } else abas.querySelectorAll('.aba').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === aba));
  abas.hidden = !estado.usuario || SEM_BARRA.includes(atual);
}

// Cadastrar: sem data no texto, a tarefa é de hoje, na parte do dia de agora (Rafael, 11/11/2026: "A, parte de agora");
// "ligar para o contador amanhã" vai para amanhã
// tela: "hoje" ou "inicio" (o rascunho do Fale de cada campo; o Enviar apaga o áudio, FR-016)
async function cadastrar(campo, tela) {
  const texto = campo.value.trim();
  if (!texto) return;
  const id = campo.id;
  vaiEnviar(tela);   // o redesenho durante o anotar não traz o rascunho de volta (revisão T037, achado 1)
  const nova = await anotar(texto, false, interpretar(texto).dia ? {} : { dia: diaLocal(), parte_do_dia: parteDaHora() });
  if (nova) { aoEnviar(tela); campo.value = ''; const atualCampo = $(id); if (atualCampo) atualCampo.value = ''; }   // a tela pode ter sido redesenhada
  else naoEnviou(tela);
}

// ---------- Hoje: as contas ficam em hoje-dia.js ----------
let fixada = { dia: null, parte: null };   // a tarefa sem parte fica na parte da hora em que o Hoje abriu
function parteSemLugar() {
  const dia = diaLocal();
  if (fixada.dia !== dia) fixada = { dia, parte: parteDaHora() };
  return fixada.parte;
}
const opcoesDoHoje = () => ({ parteSemLugar: parteSemLugar() });
const tarefa = (id) => estado.tarefas.find((t) => t.id === id);
function partesAgora() {
  const partes = partesDoHoje(estado.tarefas.filter((t) => t.estado !== 'cancelada'), opcoesDoHoje());
  return { partes, agora: tarefaDeAgora(partes, estado.agoraId) };
}
const dataDeHoje = () => { const d = diaPorExtenso(diaLocal()); return d[0].toUpperCase() + d.slice(1); };
const caminhoDe = (t) => [t.area, t.subgrupo].filter(Boolean).join(' › ');
const tagsDe = (t) => ((t.etiquetas || []).length ? el('div', { classe: 'tags' }, t.etiquetas.map((e) => el('span', { classe: 'tag' }, e))) : null);

function linhaDoHoje(t, agora) {
  const feita = t.estado === 'feita', sel = t === agora;
  return el('div', { classe: `tarefa${feita ? ' feita' : ''}${sel ? ' sel agora' : ''}`, 'data-id': t.id },
    el('button', { type: 'button', classe: `cx${feita ? ' ok' : ''}`, 'aria-label': feita ? `Feita: ${t.titulo}` : `Marcar como feita: ${t.titulo}`, 'data-mantem-aviso': true }, feita ? '✓' : ''),
    el('div', { classe: 't' }, el('b', {}, t.titulo), caminhoDe(t) ? el('span', { classe: 'meta' }, caminhoDe(t)) : null, tagsDe(t),
      sel ? el('button', { type: 'button', classe: 'btn principal estreito tv-lado', 'data-travei-sel': true }, 'Travei') : null),
    feita ? null : el('button', { type: 'button', classe: 'mais', 'aria-label': 'Mais ações' }, '⋯'));
}

function desenharHoje() {
  const tela = $('tela-hoje'), antes = $('texto-cadastrar')?.value ?? '';
  const { partes, agora } = partesAgora();
  const todas = PARTES_DO_HOJE.flatMap(([c]) => partes[c]);
  const feitas = todas.filter((t) => t.estado === 'feita').length;
  const campo = el('input', { id: 'texto-cadastrar', classe: 'campo', type: 'text', enterkeyhint: 'send', autocomplete: 'off', placeholder: 'ex.: ligar para o contador amanhã', 'aria-label': 'Cadastre uma nova tarefa para hoje', value: antes });
  campo.value = antes;
  const form = el('form', { classe: 'linha', autocomplete: 'off', 'data-mantem-aviso': true, onsubmit: (e) => { e.preventDefault(); cadastrar(campo, 'hoje'); } },
    campo, comIcone('enviar', el('button', { type: 'submit', classe: 'btn principal estreito so-icone-celular', 'aria-label': 'Enviar' }, el('span', {}, 'Enviar'))), botaoFale('hoje', () => $('texto-cadastrar')));
  ligarCampo('hoje', campo);
  const zonas = PARTES_DO_HOJE.flatMap(([c, n]) => [el('h2', { classe: 'parte' }, n), el('div', { classe: 'zona', 'data-parte': c }, partes[c].map((t) => linhaDoHoje(t, agora)))]);
  tela.replaceChildren(el('div', { classe: 'rolagem' }, el('div', { classe: 'col sem-cabeca' },
    el('h1', { classe: 'titulo', id: 'titulo-hoje' }, 'Hoje'),
    el('p', { classe: 'sub' }, dataDeHoje(), ` · ${feitas} de ${todas.length} feitas hoje`),
    el('div', { classe: 'bloco' }, el('h2', { classe: 'parte' }, 'Cadastre uma nova tarefa para hoje'), form),
    el('div', { classe: 'bloco' }, zonas))));
}

// ---------- Início (Assistente): a primeira tela ----------
// Destaque azul (Rafael, 10/11): antes das 9h, ou na 1ª abertura do dia ainda não organizado → "Quero organizar o meu dia";
// depois → "Me ajude a destravar". "Dia organizado" = arrastou uma tarefa no Hoje. Para testar: ?hora=8 ou ?hora=15.
// A regra fica em inicio.js (T029, testada em testes/inicio.test.mjs).
let destaque = null;
function calcularDestaque() {
  const qh = new URLSearchParams(location.search).get('hora');
  destaque = abrirODia({ hora: qh !== null ? Number(qh) : undefined, guarda: guardaDoAparelho });
}
const horaAgora = () => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
const primeiroNome = () => String(estado.usuario?.user_metadata?.full_name || estado.usuario?.user_metadata?.name || 'Rafael').split(' ')[0];

function desenharInicio() {
  const tela = $('tela-inicio'), antes = $('texto-inicio')?.value ?? '';
  const { agora } = partesAgora();
  const botao = (ic, texto, props) => comIcone(ic, el('button', { type: 'button', classe: 'botao', ...props }, texto));
  const campo = el('input', { id: 'texto-inicio', classe: 'campo', type: 'text', enterkeyhint: 'send', autocomplete: 'off', placeholder: 'Fale ou escreva a demanda', 'aria-label': 'Cadastre uma nova tarefa' });
  campo.value = antes;
  campo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); cadastrar(campo, 'inicio'); } });
  const enviar = el('button', { type: 'button', classe: 'btn estreito envio', 'data-mantem-aviso': true, onclick: () => {
    enviar.classList.add('tocado'); setTimeout(() => enviar.classList.remove('tocado'), 300); cadastrar(campo, 'inicio');
  } }, el('span', {}, 'Enviar'));
  comIcone('enviar', enviar); enviar.classList.add('so-icone-celular'); enviar.setAttribute('aria-label', 'Enviar');
  const organizar = botao('hoje', 'Quero organizar o meu dia', { 'data-organizar': true, onclick: () => semTela('Organizar o meu dia', 'assistente') });
  const destravar = botao('seta', 'Me ajude a destravar', { 'data-travei-geral': true, onclick: () => abrirTravei(null) });
  organizar.classList.toggle('principal', destaque === 'organizar');
  destravar.classList.toggle('principal', destaque === 'destravar');
  // dentro da rolagem: em tela baixa (computador, celular deitado) o Início rola até o "Cadastre" (Rafael, 11/11/2026)
  tela.replaceChildren(el('div', { classe: 'rolagem' }, el('div', { classe: 'conteudo' },
    // Rafael, 11/11/2026: "B · Ao lado da data, no topo": a versão no ar sempre à vista
    el('div', { classe: 'data' }, `${dataDeHoje()} · ${horaAgora()} · v${self.VERSAO_APP || 'dev'}`),
    el('div', { classe: 'saudacao' }, el('h1', {}, `Olá, ${primeiroNome()}.`), el('p', {}, 'Tudo bem contigo?')),
    el('div', { classe: 'escolhas' },
      el('p', { classe: 'rotulo' }, 'O que você deseja fazer?'),
      organizar,
      agora ? botao('seta', `Quero continuar: ${agora.titulo}`, { 'data-continuar': true, onclick: () => abrirTarefa(agora.id) }) : null,
      botao('semana', 'Quero organizar a minha semana', { onclick: () => semTela('Semana', 'semana') }),
      semana ? el('button', { type: 'button', classe: 'contagem', 'data-contagem': true, onclick: () => abrirFolha('semana') }, textoDaContagem(semana.total)) : null,
      destravar),
    el('div', { classe: 'demanda' }, el('h2', {}, 'Cadastre uma nova tarefa'), el('div', { classe: 'linha' }, campo, enviar, botaoFale('inicio', () => $('texto-inicio')))))));
  ligarCampo('inicio', campo);
}

// ---------- A tarefa aberta ----------
function abrirTarefa(id) {
  if (!tarefa(id)) return;
  tarefaId = id;
  desenharTarefa();
  ir('tarefa');
  carregarPassos(id);
}
const passos = new Map();   // id da tarefa → os passos (subtarefas)
async function carregarPassos(id) {
  try { passos.set(id, await dados.passosDe(id)); } catch (erro) { console.error('não trouxe os passos', erro); passos.set(id, []); }
  if (tarefaId === id && atual === 'tarefa') desenharTarefa();
}
async function marcarPasso(p) {
  p.feita = !p.feita;
  desenharTarefa();
  try { await dados.mudarPasso(p.id, { feita: p.feita }); }
  catch (erro) { p.feita = !p.feita; desenharTarefa(); console.error(erro); avisar('Não salvou: sem internet ou o servidor não respondeu. Tente de novo.'); }
}
function desenharTarefa() {
  const t = tarefa(tarefaId), tela = $('tela-tarefa');
  if (!t) return;
  const hoje = diaLocal(), amanha = somarDias(hoje, 1);
  const quando = t.dia === hoje ? 'Hoje' : t.dia === amanha ? 'Amanhã' : !t.dia ? 'Sem dia' : null;
  const chip = (n, acao) => el('button', { type: 'button', classe: `chip${quando === n ? ' on' : ''}`, onclick: acao }, n);
  const lista = passos.get(t.id) || [];
  const linhaPasso = (p) => el('div', { classe: `tarefa fixa${p.feita ? ' feita' : ''}` },
    el('button', { type: 'button', classe: `cx${p.feita ? ' ok' : ''}`, 'aria-label': p.feita ? 'Feita' : 'Marcar como feita', onclick: () => marcarPasso(p) }, p.feita ? '✓' : ''),
    el('div', { classe: 't' }, el('b', {}, p.texto)));
  const criada = t.criado_em ? new Date(t.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) : null;
  tela.replaceChildren(el('div', { classe: 'rolagem' }, el('div', { classe: 'col' },
    el('div', { classe: 'cabeca' }, el('button', { type: 'button', classe: 'voltar', onclick: voltar }, '‹ Voltar'),
      comIcone('cadeado', el('button', { type: 'button', classe: 'ib', onclick: () => semTela('Privada', 'hoje') }, 'Privada'))),
    caminhoDe(t) ? el('p', { classe: 'caminho' }, caminhoDe(t)) : null,
    el('h1', { classe: 'titulo' }, t.titulo),
    el('div', { classe: 'mt-p' }, el('button', { type: 'button', classe: 'btn principal', onclick: () => abrirTravei({ id: t.id, titulo: t.titulo }) }, 'Travei')),
    tagsDe(t),
    el('div', { classe: 'bloco' }, el('h2', { classe: 'parte' }, 'Quando'), el('div', { classe: 'chips escolha' },
      chip('Hoje', () => t.dia !== hoje && moverPara(t, hoje)), chip('Amanhã', () => t.dia !== amanha && moverPara(t, amanha)),
      chip('Sem dia', () => t.dia && moverPara(t, null)), el('button', { type: 'button', classe: 'chip', onclick: () => semTela('Repetir', 'hoje') }, 'Repetir: não'))),
    el('div', { classe: 'bloco' }, el('h2', { classe: 'parte' }, 'Passos'), lista.map(linhaPasso),
      el('div', { classe: 'mt-p' }, comIcone('foco', el('button', { type: 'button', classe: 'btn esq', onclick: () => semTela('Foco', 'hoje') }, 'Focar nesta tarefa')))),
    t.porque ? el('div', { classe: 'bloco' }, el('h2', { classe: 'parte' }, 'Por que importa'), el('p', { classe: 'texto' }, t.porque)) : null,
    t.notas ? el('div', { classe: 'bloco' }, el('h2', { classe: 'parte' }, 'Anotações'), el('p', { classe: 'texto' }, t.notas)) : null,
    criada ? el('div', { classe: 'bloco' }, el('h2', { classe: 'parte' }, 'Mais detalhes'), el('p', { classe: 'texto' }, `Criada em ${criada}`)) : null,
    el('div', { classe: 'lado mt' }, el('button', { type: 'button', classe: 'btn principal', 'data-mantem-aviso': true, onclick: async () => {
      if (t.estado !== 'feita') await alternarFeita(t);
      voltar();
    } }, 'Concluir')))));
}

// ---------- A folha de baixo: Menu, Configurações, Escolher a barra, Mais ações, Mudar a parte do dia ----------
let vistaFolha = null, tarefaMais = null;
const folha = () => $('folha');
const topo = (titulo, volta) => [el('div', { classe: 'folha-topo' },
  volta ? el('button', { type: 'button', classe: 'voltar', 'data-vista': volta }, '‹ Voltar') : el('h2', {}, titulo),
  el('button', { type: 'button', classe: 'fechar', 'aria-label': 'Fechar' }, '×')), volta ? el('h2', {}, titulo) : null];
const secao = (n) => el('p', { classe: 'secao' }, n);
const ajuda = (n, estilo) => el('p', { classe: 'ajuda', style: estilo }, n);
const itemSemTela = (texto, info, titulo) => el('button', { type: 'button', classe: 'item', 'data-sem-tela': titulo || texto }, el('span', { classe: 'nome' }, texto), info ? el('span', { classe: 'info' }, info) : null);
const chaveSemTela = (texto, on, titulo) => el('div', { classe: 'item' }, el('span', { classe: 'nome' }, texto), el('button', { type: 'button', classe: `chave${on ? ' on' : ''}`, 'data-sem-tela': titulo, 'aria-label': `${on ? 'Desligar' : 'Ligar'}: ${texto}` }));
const iconeItem = (id) => el('span', { html: svg(id), style: 'display:contents' });
const lerAparelho = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const numeroLara = () => lerAparelho('agente-lara-whatsapp') || '';
// "IA ligada" (T033; FR-018): só no aparelho, padrão ligada. Desligada, o Travei usa só a Base (travei.js lê a mesma chave).
// Rafael, 11/11/2026: a chave fica logo abaixo de "A IA do assistente".
const iaLigada = () => lerAparelho('agente-ia-ligada') !== '0';
function trocarIa() {
  try { if (iaLigada()) localStorage.setItem('agente-ia-ligada', '0'); else localStorage.removeItem('agente-ia-ligada'); } catch { /* vale só agora */ }
  desenharFolha();
}
const acao = (texto, info, props) => el('button', { type: 'button', classe: 'item', ...props }, el('span', { classe: 'nome' }, texto, info ? [el('br'), el('span', { classe: 'info' }, info)] : null));

function desenharFolha() {
  const v = vistaFolha, f = folha();
  let conteudo = [];
  if (v === 'menu') {
    const noMenu = SECOES.filter(([id]) => ativas.has(id) && !naBarra.includes(id));
    f.setAttribute('aria-label', 'Menu');
    conteudo = [...topo('Menu'), el('div', { classe: 'grade' },
      noMenu.map(([id, n]) => el('button', { type: 'button', classe: 'ladrilho', 'data-ir': id }, iconeItem(id), n)),
      el('button', { type: 'button', classe: 'ladrilho', 'data-vista': 'configuracoes' }, iconeItem('configuracoes'), 'Configurações'))];
  } else if (v === 'configuracoes') {
    f.setAttribute('aria-label', 'Configurações');
    conteudo = [...topo('Configurações', 'menu'),
      secao('O seu assistente'),
      itemSemTela('Como você quer chamar o seu assistente?', 'Assistente ›', 'O seu assistente'),
      itemSemTela('Como o assistente fala com você', 'Gentil ›', 'O seu assistente'),
      itemSemTela('A IA do assistente', 'Groq · chave no cofre', 'A IA do assistente'),
      el('div', { classe: 'item' }, el('span', { classe: 'nome' }, 'IA ligada', el('span', { classe: 'detalhe' }, 'Desligada, o Travei usa só os passos da Base.')),
        el('button', { type: 'button', classe: `chave${iaLigada() ? ' on' : ''}`, 'data-ia-ligada': true, 'aria-label': `${iaLigada() ? 'Desligar' : 'Ligar'} a IA`, onclick: trocarIa })),
      itemSemTela('Meu agente', 'Teseu', 'Meu agente'),
      secao('O que o assistente aprendeu'),
      chaveSemTela('Quando você marca "Cansaço" depois das 15h, sugerir Pausa primeiro.', true, 'O que o assistente aprendeu'),
      chaveSemTela('"Grande demais" → começar pelo Passo de 2 minutos.', true, 'O que o assistente aprendeu'),
      chaveSemTela('Você rende mais de manhã: o "Organizar o meu dia" põe o difícil cedo.', true, 'O que o assistente aprendeu'),
      el('div', { classe: 'mt-p' }, el('button', { type: 'button', classe: 'btn', 'data-sem-tela': 'O que o assistente aprendeu' }, 'Apagar tudo o que ele aprendeu')),
      secao('Apoio'),
      acao('Quem você chama quando trava', null, { 'data-vista': 'apoio' }),
      secao('Foco'),
      itemSemTela('Tempo de foco', '40 min', 'Foco'), itemSemTela('Tempo de pausa', '10 min', 'Foco'), itemSemTela('Sugerir na pausa', 'água · alongar · respirar', 'Foco'),
      secao('Navegação'),
      el('div', { classe: 'item' }, iconeItem('menu'), el('span', { classe: 'nome' }, 'Barra de baixo'), el('button', { type: 'button', classe: 'pequeno', 'data-vista': 'barra' }, 'Escolher')),
      secao('Seções ativadas'),
      ajuda('A seção desligada some do Menu e da barra. Nada se apaga.'),
      SECOES.map(([id, n]) => el('div', { classe: 'item' }, iconeItem(id), el('span', { classe: 'nome' }, n),
        el('button', { type: 'button', classe: `chave${ativas.has(id) ? ' on' : ''}`, 'data-ativa': id, 'aria-label': `${ativas.has(id) ? 'Desligar' : 'Ligar'} ${n}` }))),
      secao('Funções que você usa'),
      chaveSemTela('Repetir', true, 'Repetir'), chaveSemTela('Foco', true, 'Foco'), chaveSemTela('Quadro, Tabela e Linha do tempo', false, 'Quadro, Tabela e Linha do tempo'),
      secao('Do seu jeito'),
      el('button', { type: 'button', classe: 'item', 'data-vista': 'jeito' }, el('span', { classe: 'nome' }, 'Tema · Cor de destaque · Fonte · Tamanho'), el('span', { classe: 'info' }, '›')),
      ajuda(`Versão no ar: ${self.VERSAO_APP || 'dev'}`, 'margin-top:16px')];
    // o item do Apoio mostra quem é chamado, como no protótipo
    conteudo.find((n) => n?.dataset?.vista === 'apoio')?.append(el('span', { classe: 'info' }, 'Lara Yazigi · WhatsApp'));
  } else if (v === 'apoio') {
    f.setAttribute('aria-label', 'Apoio');
    const campo = el('input', { id: 'lara-whatsapp', classe: 'campo', type: 'tel', inputmode: 'tel', autocomplete: 'off', placeholder: 'WhatsApp da Lara, com DDD', 'aria-label': 'WhatsApp da Lara, com DDD' });
    campo.value = numeroLara();
    // O texto base da mensagem (FR-011): só no aparelho; vazio volta ao padrão
    const texto = el('textarea', { id: 'lara-texto', classe: 'campo', rows: 3, 'aria-label': 'Mensagem para a Lara' });
    texto.value = lerAparelho('agente-lara-texto') || TEXTO_LARA;
    conteudo = [...topo('Apoio', 'configuracoes'), ajuda('Quem você chama quando trava: Lara Yazigi · WhatsApp'), campo,
      secao('Mensagem para a Lara'), texto,
      el('div', { classe: 'mt-p' }, el('button', { type: 'button', classe: 'btn principal', onclick: () => {
        const n = campo.value.replace(/\D/g, '');
        const m = texto.value.trim();
        try {
          if (n) localStorage.setItem('agente-lara-whatsapp', n); else localStorage.removeItem('agente-lara-whatsapp');
          if (m && m !== TEXTO_LARA) localStorage.setItem('agente-lara-texto', m); else localStorage.removeItem('agente-lara-texto');
        } catch { /* vale só agora */ }
        vistaFolha = 'configuracoes'; desenharFolha();
      } }, 'Salvar'))];
  } else if (v === 'jeito') {
    f.setAttribute('aria-label', 'Do seu jeito');
    conteudo = [...topo('Do seu jeito', 'configuracoes'), secao('Tema'),
      el('div', { classe: 'chips escolha' }, tema.TEMAS.map(([valor, n]) => el('button', { type: 'button', classe: `chip${tema.temaAtual() === valor ? ' on' : ''}`, 'data-escolher-tema': valor }, n))),
      secao('Cor de destaque · Fonte · Tamanho'), itemSemTela('Cor de destaque', '›'), itemSemTela('Fonte', '›'), itemSemTela('Tamanho', '›')];
  } else if (v === 'barra') {
    const n = lugares(), cheia = naBarra.length >= n, livres = SECOES.filter(([id]) => ativas.has(id) && !naBarra.includes(id));
    f.setAttribute('aria-label', 'Escolher a barra');
    conteudo = [...topo('Escolher a barra', 'configuracoes'),
      ajuda(`Neste aparelho a barra tem ${n + 2} lugares. O Assistente e o Menu ficam sempre. Escolha até ${n} seções e a ordem delas.`),
      el('div', { classe: 'item' }, iconeItem('assistente'), el('span', { classe: 'nome' }, 'Assistente'), el('span', { classe: 'info' }, 'fixo')),
      naBarra.map((id, i) => el('div', { classe: 'item' }, iconeItem(id), el('span', { classe: 'nome' }, nome[id]),
        el('button', { type: 'button', classe: 'pequeno', 'data-sobe': id, disabled: i === 0, 'aria-label': `Subir ${nome[id]}` }, '↑'),
        el('button', { type: 'button', classe: 'pequeno', 'data-desce': id, disabled: i === naBarra.length - 1, 'aria-label': `Descer ${nome[id]}` }, '↓'),
        el('button', { type: 'button', classe: 'chave on', 'data-tira': id, 'aria-label': `Tirar ${nome[id]} da barra` }))),
      el('div', { classe: 'item' }, iconeItem('menu'), el('span', { classe: 'nome' }, 'Menu'), el('span', { classe: 'info' }, 'fixo')),
      secao('Ficam no Menu'),
      cheia ? el('div', { classe: 'aviso' }, 'A barra está cheia. Para pôr outra seção, tire uma acima.') : null,
      livres.map(([id, nm]) => el('div', { classe: 'item' }, iconeItem(id), el('span', { classe: 'nome' }, nm),
        el('button', { type: 'button', classe: 'chave', 'data-poe': id, disabled: cheia, 'aria-label': `Pôr ${nm} na barra` })))];
  } else if (v === 'mais') {
    const t = tarefa(tarefaMais), noHoje = t && caixaNoHoje(t, opcoesDoHoje());
    f.setAttribute('aria-label', 'Mais ações');
    conteudo = [...topo('Mais ações'),
      acao('Abrir a tarefa', null, { 'data-abrir-tarefa': true }),
      acao('Travei', 'Conte o que está acontecendo; o Assistente sugere um passo pequeno.', { 'data-travei': true }),
      noHoje ? acao('Mudar a parte do dia', `Hoje: ${PARTES[noHoje]}. O mesmo que arrastar.`, { 'data-vista': 'parte' }) : null,
      acao('Mover para…', 'Escolher o lugar na árvore, com um toque.', { 'data-sem-tela': 'Mover para…' }),
      acao('Para amanhã', null, { 'data-amanha': true }),
      acao(t?.prioridade_semana ? 'Tirar a estrela' : 'Pôr estrela', null, { 'data-estrela': true }),
      acao('Projeto ligado', null, { 'data-sem-tela': 'Projeto ligado' }),
      acao('Reabrir · Arquivar', null, { 'data-arquivar': true })];
  } else if (v === 'semana') {
    const s = semana, quando = { aceitou: 'aceitou o passo', outro: 'pediu outro passo', sem_resposta: 'sem resposta', pendente: 'em andamento' };
    f.setAttribute('aria-label', 'Esta semana');
    conteudo = [...topo('Esta semana'),
      s ? [el('p', { classe: 'contagem-numero' }, textoDaContagem(s.total)),
        s.passos ? [secao('Passos aceitos'), el('p', { classe: 'contagem-valor' }, `${s.aceitas} de ${s.passos}`)] : null,
        s.detalhe.length || s.semTravei ? secao('Cada travada') : null,
        s.detalhe.map((d) => el('div', { classe: 'item' }, el('span', { classe: 'nome' }, `${diaPorExtenso(d.dia)} · ${d.tarefa}`,
          el('span', { classe: 'detalhe' }, [d.texto ? `"${d.texto}"` : null, quando[d.resultado] || d.resultado].filter(Boolean).join(' · '))))),
        s.semTravei ? el('div', { classe: 'item' }, el('span', { classe: 'nome' }, 'Sem abrir o Travei',
          el('span', { classe: 'detalhe' }, `${s.semTravei} ${s.semTravei === 1 ? 'vez' : 'vezes'}, pela pergunta da noite`))) : null] : null];
  } else if (v === 'noite') {
    const hoje = diaLocal(), quando = noite === hoje ? 'Hoje' : noite === diaAnterior(hoje) ? 'Ontem' : `${/^(sábado|domingo)/.test(diaPorExtenso(noite)) ? 'No' : 'Na'} ${diaPorExtenso(noite)},`;
    f.setAttribute('aria-label', 'Pergunta da noite');
    conteudo = [...topo('Pergunta da noite'),
      el('p', { classe: 'noite-pergunta' }, `${quando} você travou ou desviou sem abrir o Travei? Quantas vezes?`),
      el('div', { classe: 'grade noite' }, [['Nenhuma', 0], ['1', 1], ['2', 2], ['3', 3], ['4 ou mais', 4]].map(([n, k]) =>
        el('button', { type: 'button', classe: 'btn', 'data-noite': k }, n))),
      el('div', { classe: 'mt-p' }, el('button', { type: 'button', classe: 'btn', 'data-noite': 'pular' }, 'Pular'))];
  } else if (v === 'parte') {
    const t = tarefa(tarefaMais), agora = t && caixaNoHoje(t, opcoesDoHoje());
    f.setAttribute('aria-label', 'Mudar a parte do dia');
    conteudo = [...topo('Mudar a parte do dia', 'mais'),
      PARTES_DO_HOJE.map(([id, n]) => el('button', { type: 'button', classe: 'item', 'data-parte-ir': id }, el('span', { classe: 'nome' }, n), id === agora ? el('span', { classe: 'info' }, 'agora') : null))];
  }
  f.dataset.folhaVista = v;
  f.replaceChildren(...conteudo.flat(Infinity).filter(Boolean));
}
function abrirFolha(v, id = null) {
  vistaFolha = v;
  if (id) tarefaMais = id;
  $('veu').classList.add('on');
  folha().classList.add('on');
  desenharFolha();
}
function fecharFolha() {
  $('veu').classList.remove('on');
  folha().classList.remove('on');
  vistaFolha = null;
}

// Dia organizado: arrastou ou mudou a parte (grava dias.organizado; antes do Run da 0008 o erro fica só no console)
function diaOrganizado() {
  marcarOrganizado({ guarda: guardaDoAparelho });
  dados.marcarDiaOrganizado(diaLocal()).catch((erro) => console.warn('dia organizado não gravou', erro));
}
function mudarParte(t, c) {
  const patch = mudancaNoHoje(c);
  if (!patch) return;
  estado.agoraId = null;
  mudar(t, patch, { mensagem: `${PARTES[c]} · ${t.titulo}`, desfazer: Object.fromEntries(Object.keys(patch).map((k) => [k, t[k]])) });
  diaOrganizado();
}
function arquivar(t) {
  if (t.estado === 'feita') return mudar(t, { estado: 'aberta', feita_em: null, feita_por: null }, { mensagem: `Reaberta · ${t.titulo}` });
  return mudar(t, { estado: 'cancelada' }, { mensagem: `Arquivada · ${t.titulo}`, desfazer: { estado: t.estado } });
}

// ---------- Arrastar no Hoje (como o protótipo): com o mouse, segurar e mover; no toque, segurar 300 ms e mover ----------
let arr = null, acabouDeArrastar = false;
function ligarArrastar(tela) {
  const rolagem = () => document.querySelector('#tela-hoje .rolagem');
  const comecar = () => { arr.ativo = true; arr.t.classList.add('arrastando'); if (rolagem()) rolagem().style.overflowY = 'hidden'; };
  tela.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('#tela-hoje .zona .tarefa');
    if (!t || e.target.closest('.cx, .mais, .tv-lado')) return;
    arr = { t, x: e.clientX, y: e.clientY, ativo: false, toque: e.pointerType !== 'mouse' };
    if (arr.toque) arr.timer = setTimeout(() => { if (arr) comecar(); }, 300);
  });
  tela.addEventListener('pointermove', (e) => {
    if (!arr) return;
    const longe = Math.hypot(e.clientX - arr.x, e.clientY - arr.y) > 6;
    if (!arr.ativo) { if (arr.toque) { if (longe) { clearTimeout(arr.timer); arr = null; } return; } if (!longe) return; comecar(); }
    e.preventDefault();
    arr.t.style.pointerEvents = 'none';
    const sob = document.elementFromPoint(e.clientX, e.clientY);
    arr.t.style.pointerEvents = '';
    document.querySelectorAll('#tela-hoje .zona').forEach((z) => z.classList.remove('alvo'));
    if (!sob) return;
    const outra = sob.closest('#tela-hoje .zona .tarefa'), titulo = sob.closest('#tela-hoje .parte');
    const zona = sob.closest('#tela-hoje .zona') || (titulo && titulo.nextElementSibling?.classList.contains('zona') ? titulo.nextElementSibling : null);
    if (outra && outra !== arr.t) { const r = outra.getBoundingClientRect(); outra.parentElement.insertBefore(arr.t, e.clientY < r.top + r.height / 2 ? outra : outra.nextSibling); }
    else if (zona && !outra) { zona.classList.add('alvo'); if (!zona.contains(arr.t)) zona.append(arr.t); }
  });
  const soltar = () => {
    if (!arr) return;
    clearTimeout(arr.timer);
    const no = arr.ativo ? arr.t : null;
    if (no) { no.classList.remove('arrastando'); acabouDeArrastar = true; if (rolagem()) rolagem().style.overflowY = ''; }
    document.querySelectorAll('#tela-hoje .zona').forEach((z) => z.classList.remove('alvo'));
    arr = null;
    if (no) soltou(no);
  };
  tela.addEventListener('pointerup', soltar);
  tela.addEventListener('pointercancel', soltar);
}
// Soltou: a tarefa passa a ser daquela parte (se mudou) e a parte inteira ganha a ordem da tela (1000 em 1000)
async function soltou(no) {
  const t = tarefa(no.dataset.id), zona = no.closest('.zona');
  if (!t || !zona) return;
  const c = zona.dataset.parte, patches = new Map();
  if (caixaNoHoje(t, opcoesDoHoje()) !== c) patches.set(t.id, { ...mudancaNoHoje(c) });
  [...zona.querySelectorAll('.tarefa')].forEach((n, i) => {
    const x = tarefa(n.dataset.id), ordem = (i + 1) * 1000;
    if (x && x.ordem !== ordem) patches.set(x.id, { ...(patches.get(x.id) || {}), ordem });
  });
  estado.agoraId = null;   // o destaque volta para a 1ª não feita
  diaOrganizado();
  if (!patches.size) { desenharTudo(); return; }
  const antes = [...patches].map(([id, p]) => [tarefa(id), Object.fromEntries(Object.keys(p).map((k) => [k, tarefa(id)[k]]))]);
  for (const [id, p] of patches) Object.assign(tarefa(id), p);
  desenharTudo();
  mostrarEstado('Salvando…');
  try {
    for (const [id, p] of patches) await dados.mudarTarefa(id, p);
    mostrarEstado('Salvo');
  } catch (erro) {
    for (const [x, a] of antes) Object.assign(x, a);
    desenharTudo();
    console.error(erro);
    mostrarEstado('Não salvou', true);
    avisar('Não salvou: sem internet ou o servidor não respondeu. Tente de novo.');
  }
}

// ---------- Os toques (um ouvinte só, como no protótipo) ----------
function ligarToques() {
  const app = $('app');
  ligarArrastar(app);
  app.addEventListener('click', (e) => {
    const alvo = e.target;
    if (acabouDeArrastar) { acabouDeArrastar = false; if (alvo.closest('#tela-hoje .zona')) return; }
    const noHoje = alvo.closest('#tela-hoje .tarefa[data-id]');
    const t = noHoje && tarefa(noHoje.dataset.id);
    if (t && alvo.closest('.cx')) { alternarFeita(t); return; }
    if (t && alvo.closest('[data-travei-sel]')) { abrirTravei({ id: t.id, titulo: t.titulo }); return; }
    if (t && alvo.closest('.mais')) { abrirFolha('mais', t.id); return; }
    if (t && t.estado !== 'feita') { estado.agoraId = t.id; desenharTudo(); return; }
    // folha
    const rn = alvo.closest('[data-noite]'); if (rn) { responderNoite(rn.dataset.noite === 'pular' ? null : Number(rn.dataset.noite)); return; }
    if (alvo.closest('.fechar') || alvo.id === 'veu') { if (vistaFolha === 'noite') noite = null; fecharFolha(); return; }
    const tm = tarefa(tarefaMais);
    if (alvo.closest('[data-abrir-tarefa]') && tm) { fecharFolha(); abrirTarefa(tm.id); return; }
    if (alvo.closest('[data-travei]') && tm) { fecharFolha(); abrirTravei({ id: tm.id, titulo: tm.titulo }); return; }
    if (alvo.closest('[data-amanha]') && tm) { fecharFolha(); moverPara(tm, somarDias(diaLocal(), 1)); return; }
    if (alvo.closest('[data-estrela]') && tm) { fecharFolha(); const sim = !tm.prioridade_semana; mudar(tm, { prioridade_semana: sim }, { mensagem: `${sim ? 'Estrela' : 'Sem estrela'} · ${tm.titulo}`, desfazer: { prioridade_semana: !sim } }); return; }
    if (alvo.closest('[data-arquivar]') && tm) { fecharFolha(); arquivar(tm); return; }
    const pi = alvo.closest('[data-parte-ir]'); if (pi && tm) { fecharFolha(); mudarParte(tm, pi.dataset.parteIr); return; }
    const st = alvo.closest('[data-sem-tela]'); if (st) { semTela(st.dataset.semTela, atual === 'sem-tela' ? abaDoSemTela : (DA_ABA[atual] || atual)); return; }
    const vf = alvo.closest('[data-vista]'); if (vf) { vistaFolha = vf.dataset.vista; desenharFolha(); return; }
    const tm2 = alvo.closest('[data-escolher-tema]'); if (tm2) { tema.trocar(tm2.dataset.escolherTema); desenharFolha(); return; }
    const ladrilho = alvo.closest('[data-ir]'); if (ladrilho) { irSecao(ladrilho.dataset.ir); return; }
    const aba = alvo.closest('[data-aba]'); if (aba) { if (aba.dataset.aba === 'menu') abrirFolha('menu'); else irSecao(aba.dataset.aba); return; }
    // Escolher a barra e Seções ativadas
    const b = alvo.closest('button'); if (!b || !folha().contains(b)) return;
    const troca = (id, d) => { const i = naBarra.indexOf(id), j = i + d; [naBarra[i], naBarra[j]] = [naBarra[j], naBarra[i]]; };
    if (b.dataset.sobe) troca(b.dataset.sobe, -1);
    else if (b.dataset.desce) troca(b.dataset.desce, 1);
    else if (b.dataset.tira) naBarra = naBarra.filter((x) => x !== b.dataset.tira);
    else if (b.dataset.poe && naBarra.length < lugares()) naBarra.push(b.dataset.poe);
    else if (b.dataset.ativa) {
      const id = b.dataset.ativa;
      if (ativas.has(id)) { ativas.delete(id); naBarra = naBarra.filter((x) => x !== id); } else ativas.add(id);
      guardar('agente-secoes-ativas', [...ativas]);
    } else return;
    gravarBarra();
    barra();
    desenharFolha();
  });
  largo.addEventListener('change', () => { naBarra = lerBarra(); barra(); if (vistaFolha) desenharFolha(); });
}

// ---------- Desenhar o que depende das tarefas ----------
function desenharTudo() {
  if (!estado.carregadoEm) return;
  desenharInicio();
  desenharHoje();
  if (atual === 'tarefa') desenharTarefa();
  if (vistaFolha === 'mais' || vistaFolha === 'parte') desenharFolha();
}
aoMudar(desenharTudo);
aoMudar(guardarCopia);   // a cópia do aparelho acompanha cada mudança

// ---------- Carregando, sem banco, erro ao abrir (na vista do Hoje, com as peças do protótipo) ----------
const TEMPO_MAXIMO_MS = window.__ASSISTENTE_TEMPO_MAXIMO_MS ?? window.__CENTELHA_TEMPO_MAXIMO_MS ?? 10000;
const comTempo = (promessa) => Promise.race([promessa,
  new Promise((_, falhar) => setTimeout(() => falhar(Object.assign(new Error('o banco não respondeu em 10 s'), { tempo: true })), TEMPO_MAXIMO_MS))]);
function mostrarSoHoje(...conteudo) {
  window.__assistenteIniciou = true;
  $('tela-hoje').replaceChildren(el('div', { classe: 'rolagem' }, el('div', { classe: 'col sem-cabeca' }, ...conteudo)));
  ir('hoje', true);
  $('abas').hidden = true;
}
function mostrarCarregando() {
  mostrarSoHoje(el('h1', { classe: 'titulo', id: 'titulo-hoje' }, 'Hoje'),
    el('div', { 'aria-hidden': 'true' }, [1, 2, 3].map(() => el('div', { classe: 'esqueleto-cartao' }))),
    el('p', { classe: 'sub', role: 'status' }, 'Trazendo as suas tarefas…'));
}
function mostrarSemBanco(tentar = () => entrar(estado.usuario)) {
  mostrarEstado('Não carregou', true);
  mostrarSoHoje(el('h1', { classe: 'titulo', id: 'titulo-hoje' }, 'Não consegui falar com o banco'),
    el('p', { classe: 'sub' }, 'Suas tarefas estão guardadas. Só não chegaram até aqui agora.'),
    el('p', { classe: 'nota' }, 'Sem internet? Quando ela voltar, eu tento de novo sozinho.'),
    el('p', { classe: 'nota' }, 'O banco pode estar em pausa. Tente de novo em alguns minutos.'),
    el('div', { classe: 'mt' }, el('button', { type: 'button', classe: 'btn principal', id: 'tentar-de-novo', onclick: tentar }, 'Tentar de novo')));
}
function mostrarErroAoAbrir(erro) {
  console.error(erro);
  mostrarSoHoje(el('h1', { classe: 'titulo', id: 'titulo-hoje' }, 'O Assistente não abriu direito'),
    el('p', { classe: 'sub' }, 'Nada se perdeu: suas tarefas estão guardadas no banco.'),
    el('div', { classe: 'mt' }, el('button', { type: 'button', classe: 'btn principal', onclick: () => location.reload() }, 'Recarregar')),
    el('p', { classe: 'nota' }, 'Se continuar, feche o navegador de vez e abra de novo.'),
    el('p', { classe: 'nota detalhe' }, `Detalhe para o suporte: ${String(erro?.message || erro).slice(0, 160)} · versão ${self.VERSAO_APP || 'dev'}`));
}

// ---------- Entrar, carregar, sair ----------
function mostrarEntrar() {
  window.__assistenteIniciou = true;
  estado.usuario = null;
  pilha = [];
  ir('entrar', true);
  document.body.dataset.pronto = '1';
}
async function pedirLogin() {
  $('erro-entrar').hidden = true;
  const { error } = await dados.banco.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) {
    $('erro-entrar').textContent = 'Não deu para abrir o login do Google. Confira a internet e tente de novo.';
    $('erro-entrar').hidden = false;
  }
}
// ---------- A contagem da semana e a pergunta da noite (T031, contagem.js; spec US4) ----------
// Rafael, 11/11/2026: no Início, acima do "Me ajude a destravar": "3 tarefas travadas esta semana.", sem a meta.
// Antes do Run da 0008 (sem `dias` e sem as colunas novas de `travadas`) a linha não aparece e o erro fica só no console.
let semana = null, noite = null;   // noite: o dia "AAAA-MM-DD" sobre o qual a pergunta está aberta
async function carregarSemana({ perguntar = false } = {}) {
  const agora = new Date(), hoje = diaLocal(agora), { inicio } = semanaDe(hoje);
  try {
    if (perguntar) await dados.abrirDia(hoje);
    // dias: desde 7 antes da segunda (a pergunta pode ser sobre o último dia aberto); travadas: desde a véspera da segunda (o fuso)
    const [travadas, dias] = await Promise.all([dados.travadasDesde(`${diaAnterior(inicio)}T00:00:00Z`), dados.diasDesde(semanaDe(diaAnterior(inicio)).inicio)]);
    semana = contarSemana({ agora, travadas, dias, nomeDaTarefa: (id) => tarefa(id)?.titulo ?? null });
    if (atual === 'assistente' && !vistaFolha) desenharInicio();
    if (vistaFolha === 'semana') desenharFolha();
    const dia = perguntar ? perguntaDaNoite({ agora, dias }) : null;
    if (dia && !vistaFolha) {
      noite = dia;
      abrirFolha('noite');
      await dados.mudarDia(dia, { pergunta_feita_em: agora.toISOString() });   // mostrada = não volta, mesmo se pular
    }
  } catch (erro) { console.warn('a contagem da semana não carregou', erro); }
}
async function responderNoite(vezes) {
  const dia = noite;
  noite = null;
  fecharFolha();
  if (!dia || vezes === null) return;
  try { await dados.mudarDia(dia, respostaDaNoite({ vezes })); await carregarSemana(); }
  catch (erro) { console.error(erro); avisar('Não salvou: sem internet ou o servidor não respondeu.'); }
}

// ---------- Sem internet (T035; FR-022): a cópia da última vez fica no aparelho, e o app abre com ela ----------
// Guarda o espaço, as tarefas e os passos de quem entrou. Sem rede, o Hoje aparece com ela e o Travei dá o passo da Base;
// o que não grava avisa, como já avisava. Quando a rede volta, o app recarrega do banco.
const COPIA = 'agente-copia';
function guardarCopia() {
  if (!estado.usuario || !estado.carregadoEm || estado.semRede) return;
  try { localStorage.setItem(COPIA, JSON.stringify({ usuario: estado.usuario.id, espacoId: estado.espacoId, tarefas: estado.tarefas, passos: [...estado.passos] })); }
  catch { /* sem espaço: fica a anterior */ }
}
// Só falta de rede (aparelho sem rede, tempo esgotado ou o pedido nem saiu); outro erro mostra a tela de sempre (revisão T037, achado 5)
const ehFaltaDeRede = (erro) => !navigator.onLine || !!erro?.tempo || /failed to fetch|network|load failed/i.test(String(erro?.message ?? erro));
function usarCopia(usuario, erro) {
  if (!ehFaltaDeRede(erro)) return false;
  let c = null;
  try { c = JSON.parse(localStorage.getItem(COPIA)); } catch { /* estragada */ }
  if (!c || c.usuario !== usuario.id || !Array.isArray(c.tarefas)) return false;
  estado.espacoId = c.espacoId;
  estado.tarefas = c.tarefas;
  estado.passos = new Map(Array.isArray(c.passos) ? c.passos : []);
  estado.semRede = true;
  fixarSecoes();
  estado.carregadoEm = Date.now();
  mostrarEstado('Sem internet', true);
  // a rede voltou: traz do banco sem recarregar a página (a conversa do Travei e o texto pela metade ficam; revisão T037, achado 4)
  const tentar = async () => { if (estado.semRede && await carregar()) { desenharTudo(); carregarSemana(); } };
  addEventListener('online', tentar, { once: true });
  // com o aparelho online (o banco só demorou), o evento "online" não vem: tenta de novo em 20 s (converge do T037)
  if (navigator.onLine) setTimeout(tentar, 20000);
  return true;
}

async function entrar(usuario) {
  estado.usuario = usuario;
  mostrarEstado('Carregando…');
  if (!estado.carregadoEm) mostrarCarregando();
  try {
    [estado.espacoId] = await comTempo(Promise.all([dados.espacoPessoal(usuario.id), dados.conferir0007()]));
  } catch (erro) { console.error(erro); if (!usarCopia(usuario, erro)) { mostrarSemBanco(); return; } }
  if (!estado.semRede && !(await carregar())) return;
  calcularDestaque();
  desenharTudo();
  pilha = [];
  ir('assistente', true);
  document.body.dataset.pronto = '1';
  aoAbrirOTravei();
  carregarSemana({ perguntar: true });
}
// Abertas + feitas desde segunda (o Hoje mostra as feitas de hoje, riscadas)
async function carregar() {
  const desde = deISO(segundaDaSemana(hojeISO())).toISOString();
  try {
    [estado.tarefas, estado.passos] = await comTempo(Promise.all([dados.carregarTarefas(estado.espacoId, desde), dados.contarPassos()]));
  } catch (erro) {
    console.error(erro);
    if (!estado.carregadoEm) { if (usarCopia(estado.usuario, erro)) return true; mostrarSemBanco(); return false; }
    mostrarEstado('Não carregou', true);
    avisar('Não deu para trazer as tarefas. Recarregue a página.');
    return false;
  }
  fixarSecoes();
  estado.carregadoEm = Date.now();
  estado.semRede = false;
  guardarCopia();
  mostrarEstado('Salvo');
  return true;
}

// ---------- Começo ----------
const RECARREGAR_DEPOIS_MS = 30 * 60 * 1000;
let versaoNova = false;
const textoPelaMetade = () => [...document.querySelectorAll('input:not([type]), input[type=text], input[type=tel], textarea')].some((c) => c.value.trim());

function ligar() {
  tema.aplicar();
  ligarAviso();
  ligarToques();
  ligarTelaTravei({ mostrar: () => ir('travei'), fechar: () => { voltar(); desenharTudo(); } });
  $('entrar').addEventListener('click', pedirLogin);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && vistaFolha) fecharFolha(); });
  window.addEventListener('online', () => { if (estado.usuario && !estado.carregadoEm) entrar(estado.usuario); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && versaoNova && !textoPelaMetade()) { location.reload(); return; }
    if (document.visibilityState !== 'visible') return;
    tema.aplicar();
    navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
    if (!estado.espacoId || vistaFolha || atual === 'travei') return;
    if (Date.now() - estado.carregadoEm > RECARREGAR_DEPOIS_MS || hojeISO() !== estado.hoje) carregar().then((ok) => ok && desenharTudo());
    // Voltou do segundo plano (o normal no celular): o destaque do Início, a abertura do dia e a pergunta da noite
    // valem também aqui, e não só quando o app abre do zero (revisão T037, achado 6; FR-001, FR-020)
    calcularDestaque();
    if (atual === 'assistente') desenharInicio();
    carregarSemana({ perguntar: true });
  });
  // Para os testes e as fotos (testes/app-falso.html): ir a uma tela, abrir a folha ou a tarefa
  window.__assistente = { ir: (v) => (COM_TELA.has(v) || vista(v) ? ir(v) : irSecao(v)), abrirFolha, abrirTarefa };
}

async function comecar() {
  ligar();
  if ('serviceWorker' in navigator) {
    const tinhaControle = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (tinhaControle) versaoNova = true; });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
  dados.iniciar();
  const { data } = await comTempo(dados.banco.auth.getSession());
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname);
  dados.banco.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_OUT' && estado.usuario) mostrarEntrar(); });
  if (data.session) await entrar(data.session.user);
  else mostrarEntrar();
}

comecar().catch((erro) => {
  if (erro?.tempo) mostrarSemBanco(() => location.reload());
  else mostrarErroAoAbrir(erro);
});
