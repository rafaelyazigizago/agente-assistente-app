// Agente Assistente · peças de tela: criar elementos, os ícones do protótipo de 10/11, o aviso com Desfazer e a vibração.
export const $ = (id) => document.getElementById(id);

export function el(tag, props = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'classe') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k in n && typeof v !== 'string') n[k] = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) n.append(f);
  return n;
}

// Os ícones do protótipo de 10/11 (os mesmos desenhos, traço 1,6)
export const IC = {
  assistente: '<path d="M4 5h16v11H9l-5 4z"/>',
  hoje: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  seta: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  semana: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  listas: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
  diario: '<path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14"/>',
  financeiro: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  crm: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.7 3.1 2.5 3.5 5.2"/>',
  triagem: '<path d="M4 4h16l-6 8v6l-4 2v-8z"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 14h2M14 14h2M8 18h2"/>',
  configuracoes: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  foco: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  agente: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/>',
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  buscar: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
};
export const svg = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
// Um elemento com o ícone na frente do texto (como o data-ic do protótipo)
export function comIcone(n, no) { no.insertAdjacentHTML('afterbegin', svg(n)); return no; }

export function vibrar(padrao = 18) {
  if (navigator.vibrate && localStorage.getItem('agente-vibrar') === 'sim') navigator.vibrate(padrao);
}

// O estado da gravação fica num atributo (para testes e leitores de tela); não há mais "Salvo ✓" na tela.
export function mostrarEstado(texto, erro = false) {
  document.body.dataset.estado = texto;
  document.body.classList.toggle('nao-salvou', erro);
}

// ---------- Aviso com Desfazer: fica até a próxima ação, nunca some por tempo ----------
let desfazerAtual = null;
export function avisar(texto, desfazer) {
  $('recado-texto').textContent = texto;
  desfazerAtual = desfazer || null;
  $('recado-desfazer').hidden = !desfazer;
  $('recado').hidden = false;
}
export function fecharAviso() {
  $('recado').hidden = true;
  desfazerAtual = null;
}
export function ligarAviso() {
  $('recado-desfazer').addEventListener('click', () => {
    const d = desfazerAtual;
    fecharAviso();
    if (d) d();
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#recado') || e.target.closest('[data-mantem-aviso]')) return;
    fecharAviso();
  });
}
