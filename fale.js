// Agente Assistente · o Fale (T026; spec FR-002, FR-005, FR-016; research R3; data-model "Rascunho do Fale").
// Rafael toca em Fale, fala e toca de novo. O Whisper roda DENTRO do aparelho (whisper-worker.js) e escreve no campo,
// para ele corrigir. O áudio nunca vai para a rede: fica como rascunho no IndexedDB e só é apagado quando ele toca em Enviar.
// Saiu sem enviar? O rascunho fica, e o texto volta ao campo quando a tela abre de novo.
// Nos testes: window.__gravadorFalso troca o microfone e window.__vozFalsa troca o Whisper (testes/app-falso.html, ?gravador e ?voz).
import { el, avisar, comIcone } from './ui.js';

// ---------- O miolo, sem tela (testado em testes/fale.test.mjs) ----------
// gravador: { comecar(), parar() → Blob } · transcrever(Blob) → texto · rascunhos: { gravar(r), ler(tela), apagar(tela) }
export function criarFale({ gravador, transcrever, rascunhos, agora = () => new Date() }) {
  return {
    comecar: () => gravador.comecar(),
    async parar(tela) {
      const audio = await gravador.parar();
      const rascunho = { tela, texto: '', audio, criado_em: agora().toISOString() };
      await rascunhos.gravar(rascunho);   // antes do Whisper: se o app fechar no meio, o áudio não se perde
      const texto = String(await transcrever(audio) ?? '').trim();
      // Enviou enquanto o Whisper escrevia (revisão T037, achado 10): o rascunho já foi apagado e não volta
      if (await rascunhos.ler(tela)) await rascunhos.gravar({ ...rascunho, texto });
      return texto;
    },
    async corrigir(tela, texto) {
      const r = await rascunhos.ler(tela);
      if (r) await rascunhos.gravar({ ...r, texto });
    },
    enviado: (tela) => rascunhos.apagar(tela),
    textoGuardado: async (tela) => (await rascunhos.ler(tela))?.texto ?? null,
  };
}

// ---------- O rascunho no IndexedDB do aparelho (um por tela: "hoje" ou "travei") ----------
const BANCO = 'agente-fale', LOJA = 'rascunhos';
function abrirBanco() {
  return new Promise((ok, erro) => {
    const p = indexedDB.open(BANCO, 1);
    p.onupgradeneeded = () => p.result.createObjectStore(LOJA, { keyPath: 'tela' });
    p.onsuccess = () => ok(p.result);
    p.onerror = () => erro(p.error);
  });
}
async function naLoja(modo, fazer) {
  const db = await abrirBanco();
  try {
    return await new Promise((ok, erro) => {
      const t = db.transaction(LOJA, modo), pedido = fazer(t.objectStore(LOJA));
      t.oncomplete = () => ok(pedido.result);
      t.onerror = () => erro(t.error);
    });
  } finally { db.close(); }
}
const rascunhosNoAparelho = {
  gravar: (r) => naLoja('readwrite', (l) => l.put(r)),
  ler: async (tela) => (await naLoja('readonly', (l) => l.get(tela))) ?? null,
  apagar: (tela) => naLoja('readwrite', (l) => l.delete(tela)),
};

// ---------- O microfone (MediaRecorder) ----------
function gravadorDoNavegador() {
  let gravador = null, pedacos = [];
  return {
    async comecar() {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      pedacos = [];
      gravador = new MediaRecorder(fluxo);
      gravador.ondataavailable = (e) => { if (e.data.size) pedacos.push(e.data); };
      gravador.start();
    },
    parar() {
      return new Promise((ok) => {
        gravador.onstop = () => {
          gravador.stream.getTracks().forEach((t) => t.stop());   // desliga o microfone (some o aviso do celular)
          ok(new Blob(pedacos, { type: gravador.mimeType || 'audio/webm' }));
        };
        gravador.stop();
      });
    },
  };
}

// ---------- O Whisper no aparelho (whisper-worker.js) ----------
// O áudio vira 16 mil amostras por segundo, num canal (o que o Whisper espera), e vai ao worker. Nada sai do aparelho.
let worker = null, pedidoN = 0;
const esperando = new Map();
function oWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.tipo === 'baixando') { aoBaixar?.(data.pronto); return; }
    const p = esperando.get(data.id);
    if (!p) return;
    esperando.delete(data.id);
    if (data.erro) p.erro(new Error(data.erro)); else p.ok(data.texto);
  };
  worker.onerror = (e) => { for (const p of esperando.values()) p.erro(new Error(e.message || 'o Whisper parou')); esperando.clear(); worker = null; };
  return worker;
}
async function transcreverNoAparelho(audio) {
  const ctx = new AudioContext({ sampleRate: 16000 });
  let amostras;
  try { amostras = (await ctx.decodeAudioData(await audio.arrayBuffer())).getChannelData(0); } finally { ctx.close(); }
  return new Promise((ok, erro) => {
    const id = ++pedidoN;
    esperando.set(id, { ok, erro });
    oWorker().postMessage({ id, amostras }, [amostras.buffer]);
  });
}

// ---------- O botão Fale, igual ao do protótipo de 10/11 ----------
const fale = () => criarFale({
  gravador: window.__gravadorFalso ?? (gravadorAtual ??= gravadorDoNavegador()),
  transcrever: window.__vozFalsa ?? transcreverNoAparelho,
  rascunhos: rascunhosNoAparelho,
});
let gravadorAtual = null, aoBaixar = null;
// A fase de cada tela fica aqui, e não no botão: a tela pode ser redesenhada no meio da gravação (revisão T037, achado 2)
const fases = new Map();
// Telas com Enviar em andamento: o rascunho não volta ao campo, nem num redesenho (revisão T037, achado 1)
const enviando = new Set();

// Os textos do botão. Rafael, 11/11/2026: "A · Diz o próximo toque": gravando, o botão diz "Enviar gravação" (com a bolinha
// vermelha piscando); depois, "Analisando"; na 1ª vez, enquanto o Whisper baixa, "Baixando N%".
const TEXTO = { parado: 'Fale', ouvindo: 'Enviar gravação', escrevendo: 'Analisando' };

// tela: "hoje" ou "travei" · campo(): o campo onde o texto entra
export function botaoFale(tela, campo) {
  const pintar = (b, f) => { b.lastChild.textContent = TEXTO[f]; b.setAttribute('aria-pressed', f === 'ouvindo'); };
  const mostrar = (f) => { fases.set(tela, f); document.querySelectorAll(`button.fale[data-fale="${tela}"]`).forEach((b) => pintar(b, f)); pintar(botao, f); };
  const botao = comIcone('mic', el('button', { type: 'button', classe: 'fale', 'data-fale': tela, 'data-mantem-aviso': true, onclick: async () => {
    const fase = fases.get(tela) ?? 'parado';
    if (fase === 'escrevendo') return;
    if (fase === 'parado') {
      try { await fale().comecar(); mostrar('ouvindo'); } catch { avisar('Não consegui ouvir o microfone. Escreva no campo.'); }
      return;
    }
    mostrar('escrevendo');
    aoBaixar = (pronto) => { document.querySelectorAll(`button.fale[data-fale="${tela}"]`).forEach((b) => { b.lastChild.textContent = pronto >= 100 ? TEXTO.escrevendo : `Baixando ${pronto ?? 0}%`; }); };
    try {
      const texto = await fale().parar(tela);
      const c = campo();
      if (c && texto) { c.value = texto; c.dispatchEvent(new Event('input', { bubbles: true })); c.focus({ preventScroll: true }); }
    } catch {
      avisar('Não consegui escrever o que você falou. O áudio ficou guardado; escreva no campo.');
    } finally { mostrar('parado'); }
  } }, TEXTO.parado));
  pintar(botao, fases.get(tela) ?? 'parado');
  return botao;
}

// Ligar o campo ao rascunho: o que Rafael corrige vai junto; ao abrir a tela, o texto guardado volta (se o campo estiver vazio).
export function ligarCampo(tela, campo) {
  campo.addEventListener('input', () => { fale().corrigir(tela, campo.value).catch(() => {}); });
  if (enviando.has(tela)) return;
  fale().textoGuardado(tela).then((t) => { if (t && !campo.value && campo.isConnected && !enviando.has(tela)) campo.value = t; }).catch(() => {});
}

// Rafael tocou em Enviar: a partir daqui o rascunho não volta ao campo; se não gravou, volta a valer
export const vaiEnviar = (tela) => { enviando.add(tela); };
export const naoEnviou = (tela) => { enviando.delete(tela); };

// Rafael tocou em Enviar: o áudio daquela tela é apagado (FR-016)
export const aoEnviar = (tela) => fale().enviado(tela).catch(() => {}).finally(() => enviando.delete(tela));
