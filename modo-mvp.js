// Agente Assistente · o modo MVP (T009). Rafael, 10/11/2026: "A, adaptar o app" (um modo que mostra só o Hoje e o Travei e
// esconde o resto pelas "funções que você liga"); 11/11/2026: "A, nasce ligado" (o app já abre enxuto; a chave "Modo MVP"
// em "Do seu jeito" desliga e mostra o app inteiro). Esconder não apaga nada: o que está no banco continua lá.
// Fica guardado neste aparelho. Sem nada guardado (quem acabou de chegar), vem ligado.
export const CHAVE_MVP = 'agente-modo-mvp';

const armazenamento = () => { try { return globalThis.localStorage; } catch { return null; } };

export function modoMvpLigado(caixa = armazenamento()) {
  try { return caixa?.getItem(CHAVE_MVP) !== '0'; } catch { return true; }
}

export function ligarModoMvp(sim, caixa = armazenamento()) {
  try { if (sim) caixa?.removeItem(CHAVE_MVP); else caixa?.setItem(CHAVE_MVP, '0'); } catch { /* sem guardar: vale só nesta página */ }
}

// As telas do MVP: a primeira tela (Início, chega no T029), o Hoje e a tarefa (onde mora o Travei, que é uma folha por cima)
const TELAS_MVP = new Set(['inicio', 'hoje', 'tarefa']);
const ABAS = ['hoje', 'grupos', 'calendario', 'diario'];

export const telaNoModo = (tela, ligado) => !ligado || TELAS_MVP.has(tela);
export const abasNoModo = (ligado) => (ligado ? ABAS.filter((a) => TELAS_MVP.has(a)) : [...ABAS]);
// As funções extras (Chama, Quadro, Projetos…) ficam fora do MVP; desligado, valem as escolhas da pessoa
export const funcaoNoModo = (_chave, ligado) => !ligado;
