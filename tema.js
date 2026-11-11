// Agente Assistente · o tema (Configurações › Do seu jeito): Claro, Escuro ou Automático (claro das 6h às 18h).
// As cores são as do protótipo de 10/11 (estilo.css). Guardado neste aparelho; a chave antiga "centelha-tema" ainda vale.
const ler = () => { try { return localStorage.getItem('agente-tema') || localStorage.getItem('centelha-tema') || 'auto'; } catch { return 'auto'; } };

export const TEMAS = [['claro', 'Claro'], ['escuro', 'Escuro'], ['auto', 'Automático']];
export const temaAtual = () => (TEMAS.some(([v]) => v === ler()) ? ler() : 'auto');

export function escuroAgora() {
  const t = temaAtual();
  if (t !== 'auto') return t === 'escuro';
  const h = new Date().getHours();
  return h < 6 || h >= 18;
}

export function aplicar() {
  const escuro = escuroAgora();
  document.documentElement.dataset.tema = escuro ? 'noite' : 'dia';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#151917' : '#F8F5EE');
}

export function trocar(valor) {
  try { localStorage.setItem('agente-tema', valor); localStorage.removeItem('centelha-tema'); } catch { /* sem guardar: vale só agora */ }
  aplicar();
}
