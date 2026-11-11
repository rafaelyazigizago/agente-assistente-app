// Agente Assistente · sair da conta limpa o que é da conta no aparelho (pendência técnica da passagem da Fase 8).
// Testado em testes/sair.test.mjs. O que é do aparelho (tema, letra, vibrar) fica; o que é de Rafael sai:
// a cópia das tarefas, a fila do Travei sem rede, a resposta da noite guardada e os rascunhos do Fale (com o áudio).
export const CHAVES_DA_CONTA = ['agente-copia', 'agente-fila-travadas', 'agente-noite-pendente'];

// aparelho: o localStorage · apagarRascunhos(): apaga o IndexedDB do Fale
export async function limparAoSair({ aparelho, apagarRascunhos }) {
  for (const k of CHAVES_DA_CONTA) { try { aparelho.removeItem(k); } catch { /* sem acesso: segue */ } }
  try { await apagarRascunhos(); } catch (erro) { console.warn('não apaguei os rascunhos do Fale', erro); }
}
