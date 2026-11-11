// Agente Assistente · o Travei em conversa (T023; spec US1, FR-005 a FR-012, FR-014, FR-015, FR-018, FR-022; protótipo v8 do MVP).
// Rafael escreve o que está acontecendo; a função `travei` devolve 1 pergunta (no máximo 1 por travada), 1 passo pequeno ou a crise.
// Sem IA (sem internet, teto de R$ 2, falha, mais de 25 s ou IA desligada), o passo vem da Base (base-passos.js), com aviso.
// Este é o ÚNICO ponto que grava a travada (data-model): "pendente" na 1ª resposta, depois "aceitou", "outro" ou "sem_resposta".
// Sem internet, a linha fica na fila do aparelho (localStorage) e sobe quando a rede volta.
// O que a IA responde entra sempre como texto (textContent), nunca como HTML (LLM05).
import { $, el, avisar, comIcone } from './ui.js';
import * as dados from './dados.js';
import { passoSemIA, ehCrise, CONTATOS_CRISE, AVISO_SEM_IA } from './base-passos.js';
import { botaoFale, ligarCampo, aoEnviar } from './fale.js';

export const ABERTURA = 'O que está acontecendo com esta tarefa? Escreva ou fale do seu jeito. Pode ser “não sei dizer”.';
export const ABERTURA_GERAL = 'O que está acontecendo? Pode ser uma tarefa ou algo mais geral. Escreva ou fale do seu jeito. Pode ser “não sei dizer”.';
export const TEXTO_LARA = 'Oi, Lara. Travei agora e preciso de apoio. Você pode falar comigo?';
export const AVISO_TETO = 'A IA chegou no limite de gasto de hoje. Até amanhã, os passos vêm da Base de Técnicas.';
const AVISO_CADASTRAR_LARA = 'Cadastre o WhatsApp da Lara no “Do seu jeito” para chamar por aqui.';
const AVISO_COMBINADO = 'Combinado. Quando terminar, marque a tarefa no Hoje. Se travar de novo, é só voltar aqui.';
const TEMPO_MAXIMO_MS = 25000;   // a função desiste aos 20 s; com folga, ainda bem dentro de 1 min (FR-006, FR-015)
const PENDENTE_MAX_MIN = 30;
const FILA = 'agente-fila-travadas';

// Até o T033 ("Do seu jeito"), estes valores ficam só no aparelho
const ler = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const iaLigada = () => ler('agente-ia-ligada') !== '0';
const numeroLara = () => (ler('agente-lara-whatsapp') || '').replace(/\D/g, '');
const textoLara = () => ler('agente-lara-texto') || TEXTO_LARA;
const semInternet = () => navigator.onLine === false;

// ---------- A fila do aparelho (sem internet) ----------
const lerFila = () => { try { return JSON.parse(ler(FILA) || '[]'); } catch { return []; } };
const gravarFila = (fila) => { try { localStorage.setItem(FILA, JSON.stringify(fila)); } catch (erro) { console.error('não guardei a fila do Travei', erro); } };
let subindo = false;
export async function subirFila() {
  if (subindo || semInternet()) return;
  subindo = true;
  try {
    let fila = lerFila();
    while (fila.length) {
      const { local, ...linha } = fila[0];
      const id = await dados.criarTravada(linha);
      if (conversa?.linha?.local === local) conversa.linha = { id };   // a conversa aberta passa a usar a linha do banco
      fila = lerFila().filter((l) => l.local !== local);
      gravarFila(fila);
    }
  } catch (erro) {
    console.error('a fila do Travei não subiu; tento de novo quando a rede voltar', erro);
  } finally { subindo = false; }
}
addEventListener('online', () => { subirFila(); });

// Ao abrir o app: "pendente" com mais de 30 min vira "sem_resposta" (cobre o app fechado à força) e a fila sobe
export async function aoAbrirOApp() {
  subirFila();
  try { await dados.fecharTravadasPendentes(new Date(Date.now() - PENDENTE_MAX_MIN * 60000).toISOString()); }
  catch (erro) { console.error('não fechei as travadas pendentes', erro); }
}

// ---------- Gravar (só aqui) ----------
async function gravarNova(linha) {
  if (!semInternet()) {
    try { return { id: await dados.criarTravada(linha) }; }
    catch (erro) { if (!semInternet()) { console.error('não gravei a travada', erro); return null; } }
  }
  const local = crypto.randomUUID();
  gravarFila([...lerFila(), { ...linha, local }]);
  return { local };
}
async function mudarLinha(ref, patch) {
  if (!ref) return;
  if (ref.local) { gravarFila(lerFila().map((l) => (l.local === ref.local ? { ...l, ...patch } : l))); return; }
  try { await dados.mudarTravada(ref.id, patch); } catch (erro) { console.error('não mudei a travada', erro); }
}

// ---------- A conversa ----------
let conversa = null;      // { id, tarefa, texto, perguntaIa, resposta, perguntaFeita, passos, tecnicas, linha, linhaEhPergunta, resultado, crise }

const tela = () => $('tela-travei');
const rolar = () => { const r = tela().querySelector('.tv-rolagem'); if (r) r.scrollTop = r.scrollHeight; };
function balao(quem, ...filhos) {
  const b = el('div', { classe: `tv-b ${quem}` }, quem.startsWith('ela') ? el('span', { classe: 'quem' }, 'Assistente') : null, ...filhos);
  tela().querySelector('.tv-conversa').append(b);
  rolar();
  return b;
}
const tirarAcoes = () => tela().querySelectorAll('.tv-acoes').forEach((a) => a.remove());

// A casca (app.js) diz como mostrar e tirar a tela do Travei (é uma vista do protótipo, sem a barra de baixo)
let casca = { mostrar() {}, fechar() {} };
export const ligarTela = (f) => { casca = f; };

// alvo: a tarefa (objeto com id e titulo) ou null (geral, pela primeira tela). O desenho é o do protótipo de 10/11.
export function abrirTravei(alvo = null) {
  conversa = { id: crypto.randomUUID(), tarefa: alvo, texto: null, perguntaIa: null, resposta: null, perguntaFeita: false,
    passos: [], tecnicas: [], linha: null, linhaEhPergunta: false, resultado: null, crise: false };
  const campo = el('input', { id: 'travei-campo', classe: 'campo tv-campo', type: 'text', autocomplete: 'off', enterkeyhint: 'send', placeholder: 'Escreva do seu jeito, até “não sei dizer”', 'aria-label': 'O que está acontecendo' });
  campo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); enviar(); } });
  const envio = comIcone('enviar', el('button', { type: 'button', classe: 'btn principal estreito tv-enviar so-icone-celular', 'aria-label': 'Enviar', onclick: () => enviar() }, el('span', {}, 'Enviar')));
  tela().replaceChildren(
    el('div', { classe: 'rolagem tv-rolagem' }, el('div', { classe: 'col' },
      el('div', { classe: 'cabeca' }, el('button', { type: 'button', classe: 'voltar', onclick: () => sair() }, '‹ Voltar')),
      el('p', { classe: 'caminho tv-tarefa' }, alvo ? alvo.titulo : ''),
      el('h1', { classe: 'titulo', id: 'titulo-travei' }, 'Travei'),
      el('div', { classe: 'tv-conversa', 'aria-live': 'polite' }))),
    el('div', { classe: 'tv-rodape' }, el('div', { classe: 'dentro' }, el('div', { classe: 'linha' }, campo, envio,
      faleDoTravei()))),
    el('div', { classe: 'emergencia' }, el('div', { classe: 'dentro' }, el('button', { type: 'button', classe: 'btn', 'data-mantem-aviso': true, onclick: chamarLara }, 'Chamar Lara (Apoio)'))),
  );
  balao('ela', alvo ? ABERTURA : ABERTURA_GERAL);
  ligarCampo('travei', campo);   // saiu sem enviar? o que ele falou volta ao campo
  casca.mostrar();
  setTimeout(() => campo.focus({ preventScroll: true }), 50);
}

function fecharTela() {
  conversa = null;
  casca.fechar();
}

function sair() {
  const c = conversa;
  if (c?.linha && c.resultado === 'pendente') mudarLinha(c.linha, { resultado: 'sem_resposta' });
  fecharTela();
}

async function enviar() {
  const c = conversa, campo = $('travei-campo');
  const texto = campo.value.trim();
  if (!c || !texto || c.esperando) return;
  campo.value = '';
  aoEnviar('travei');   // FR-016: o áudio do Fale só é apagado aqui
  tirarAcoes();
  balao('eu', texto);
  if (c.texto === null) c.texto = texto;
  else if (c.perguntaIa && c.resposta === null) c.resposta = texto;
  else c.texto = `${c.texto}\n${texto}`;   // mais algum detalhe depois do passo: vai junto do que ele escreveu
  await pedir();
}

// O que vai à função: só o contrato (contracts/travei-funcao.md)
const pedido = (c) => ({ conversa_id: c.id, tarefa: c.tarefa?.titulo ?? null, texto: c.texto, pergunta_ia: c.perguntaIa, resposta_pergunta: c.resposta,
  passos_ja_dados: [...c.passos], pergunta_ja_feita: c.perguntaFeita, tecnicas_ja_usadas: [...c.tecnicas] });

async function pedir() {
  const c = conversa;
  if (ehCrise(c.texto) || ehCrise(c.resposta)) return mostrar({ tipo: 'crise', contatos: CONTATOS_CRISE }, 'ia');   // antes de tudo, mesmo sem internet
  if (!iaLigada() || semInternet()) return mostrarBase();
  c.esperando = true;
  let r = null;
  try {
    r = await Promise.race([dados.pedirAoTravei(pedido(c)), new Promise((ok) => setTimeout(() => ok(null), TEMPO_MAXIMO_MS))]);
  } catch (erro) {
    console.error('a função travei não respondeu; vai o passo da Base', erro?.message);
  } finally { c.esperando = false; }
  if (conversa !== c) return;   // ele saiu enquanto esperava
  if (!r || !['passo', 'pergunta', 'crise'].includes(r.tipo)) return mostrarBase(r?.tipo === 'teto' ? AVISO_TETO : null);
  if (r.tipo === 'pergunta' && c.perguntaFeita) return mostrarBase();   // nunca uma 2ª pergunta
  return mostrar(r, 'ia');
}

function mostrarBase(avisoExtra = null) {
  const c = conversa;
  const r = passoSemIA([c.texto, c.resposta].filter(Boolean).join(' '), { tecnicasJaUsadas: c.tecnicas, passosJaDados: c.passos });
  return mostrar(r, 'base', avisoExtra);
}

async function mostrar(r, origem, avisoExtra = null) {
  const c = conversa;
  if (r.tipo === 'crise') {
    c.crise = true;
    balao('ela crise', el('p', {}, 'Agora o mais importante é você. Fale com alguém agora:'),
      el('ul', { classe: 'tv-contatos' }, ...(r.contatos?.length ? r.contatos : CONTATOS_CRISE).map((k) =>
        el('li', {}, el('a', { href: `tel:${String(k.numero).replace(/\D/g, '')}`, classe: 'btn' }, `${k.nome} ${k.numero}`), ` · ${k.explica ?? ''}`))));
    tela().querySelector('.tv-rodape').hidden = true;   // a técnica para aqui (FR-010)
    await gravar({ crise: true, tecnica: null, passo: null, origem });
    return;
  }
  if (r.tipo === 'pergunta') {
    c.perguntaFeita = true;
    c.perguntaIa = String(r.pergunta);
    balao('ela', c.perguntaIa);
    await gravar({ pergunta_ia: c.perguntaIa, tecnica: null, passo: null, origem }, { ehPergunta: true });
    return;
  }
  // passo (da IA ou da Base): só o 1º passo em destaque; o mapa vem à parte, sem destaque (FR-008)
  const passo = String(r.passo);
  c.passos.push(passo);
  if (r.tecnica) c.tecnicas.push(r.tecnica);
  if (avisoExtra) balao('ela', avisoExtra);
  balao('ela passo', el('b', {}, 'Passo pequeno (menos de 2 minutos):'), el('br'), passo,
    r.linha_tecnica ? el('span', { classe: 'tv-tecnica' }, String(r.linha_tecnica)) : null,
    origem === 'base' ? el('span', { classe: 'tv-aviso' }, AVISO_SEM_IA) : null);
  const mapa = (Array.isArray(r.mapa) ? r.mapa : []).map(String).filter((m) => m.trim()).slice(0, 3);
  if (mapa.length) balao('ela', el('span', {}, 'Depois, se quiser:'), el('ol', { classe: 'tv-mapa' }, ...mapa.map((m) => el('li', {}, m))));
  const acoes = el('div', { classe: 'tv-acoes' },
    el('button', { type: 'button', classe: 'btn principal estreito', onclick: aceitar }, 'Vou fazer agora'),
    el('button', { type: 'button', classe: 'btn claro estreito', onclick: outroPasso }, 'Quero outro passo'));
  tela().querySelector('.tv-conversa').append(acoes);
  rolar();
  await gravar({ tecnica: r.tecnica ?? null, passo, origem });
}

// A 1ª resposta grava "pendente". O passo que vem depois da pergunta entra na mesma linha; cada "outro passo" é uma linha nova.
async function gravar(campos, { ehPergunta = false } = {}) {
  const c = conversa;
  if (c.linha && c.linhaEhPergunta && !ehPergunta) {
    c.linhaEhPergunta = false;
    c.resultado = 'pendente';
    await mudarLinha(c.linha, { resposta_pergunta: c.resposta, ...campos });
    return;
  }
  const linha = { conversa_id: c.id, tarefa_id: c.tarefa?.id ?? null, texto: c.texto, pergunta_ia: c.perguntaIa, resposta_pergunta: c.resposta,
    tecnica: null, passo: null, resultado: 'pendente', origem: 'ia', crise: false, ...campos };
  c.linhaEhPergunta = ehPergunta;
  c.resultado = 'pendente';
  c.linha = await gravarNova(linha);
}

async function aceitar() {
  const c = conversa;
  if (!c) return;
  c.resultado = 'aceitou';
  tirarAcoes();
  balao('eu', 'Vou fazer agora');
  setTimeout(() => { if (conversa === c) balao('ela', AVISO_COMBINADO); }, 600);
  await mudarLinha(c.linha, { resultado: 'aceitou' });
}

async function outroPasso() {
  const c = conversa;
  if (!c || c.esperando) return;
  tirarAcoes();
  balao('eu', 'Quero outro passo');
  c.resultado = 'outro';
  await mudarLinha(c.linha, { resultado: 'outro' });
  c.linha = null;
  await pedir();
}

// "Chamar Lara (Apoio)": abre o WhatsApp com o texto base, sem nada da tarefa; quem envia é Rafael (FR-011)
function chamarLara() {
  const numero = numeroLara();
  if (!numero) { avisar(AVISO_CADASTRAR_LARA); return; }
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(textoLara())}`, '_blank', 'noopener');
}

// Fale (fale.js): o Whisper no aparelho escreve no campo da conversa
function faleDoTravei() {
  const b = botaoFale('travei', () => $('travei-campo'));
  b.classList.add('tv-fale');
  return b;
}
