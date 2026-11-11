// Agente Assistente · passos da Base sem IA (T011). Quando a IA não pode responder (sem internet, teto de R$ 2, IA desligada,
// falha ou mais de 20 s), o Travei dá um passo da Base de Técnicas v0, escolhido pelas palavras do que Rafael escreveu, e avisa
// em uma linha que veio sem IA (FR-022; Rafael: "A, passo da Base"). Sinal de crise vem antes de tudo: CVV 188 e SAMU 192 (FR-010).
// Fonte: "3 Construção/Documentos de trabalho/Base de Técnicas do Travei v0 - 101126.md". Mesmo formato da resposta da função `travei`.
export const AVISO_SEM_IA = 'Este passo veio sem IA, da Base de Técnicas.';

// [código]: nome, força da prova, palavras do "Quando usar" (sem acento, minúsculas) e 2 a 3 passos genéricos
export const TECNICAS = {
  T1: { nome: 'Quebrar em passos', forca: 'Forte',
    palavras: ['grande demais', 'por onde comecar', 'muito grande', 'enorme'],
    passos: ['Escreva só o primeiro passo desta tarefa, com um verbo: "abrir", "ler", "separar". Faça só ele.',
      'Abra o arquivo, o site ou o lugar desta tarefa e olhe só o começo. Nada mais por agora.',
      'Divida a tarefa em 3 pedaços numa nota. Comece pelo menor.'] },
  T2: { nome: 'Plano se-então', forca: 'Forte',
    palavras: ['distrai', 'outro site', 'outra coisa', 'esqueco', 'celular'],
    passos: ['Combine com você: se der vontade de abrir outra coisa, escreva o nome dela numa nota e volte para esta tarefa.',
      'Escolha o momento: "quando eu terminar o café, então abro esta tarefa".',
      'Se aparecer uma ideia no meio, anote numa linha e volte. Ela fica guardada.'] },
  T3: { nome: 'Começo mínimo', forca: 'Sem prova direta',
    palavras: ['nao consigo comecar', 'preguica', 'chato', 'chata', 'tedio', 'entediante', 'sem vontade'],
    passos: ['Abra a tarefa e faça só o que cabe em 2 minutos. O objetivo é só começar.',
      'Ponha 2 minutos no relógio e mexa na tarefa até tocar. Depois você decide se continua.',
      'Faça a menor parte possível: abrir, olhar, escrever uma palavra. Só isso já conta.'] },
  T4: { nome: 'Uma coisa por vez', forca: 'Moderada',
    palavras: ['me perco', 'pulando', 'muita coisa', 'tudo ao mesmo tempo', 'abas'],
    passos: ['Feche o que não é desta tarefa. Deixe na tela só ela.',
      'Escolha uma coisa só para os próximos 10 minutos: esta tarefa. As outras esperam numa nota.',
      'Guarde o celular longe da mão e deixe aberta só esta tarefa.'] },
  T5: { nome: 'Lembrete externo na hora de agir', forca: 'Forte',
    palavras: ['fazer depois', 'esqueco de voltar', 'mais tarde', 'amanha'],
    passos: ['Ponha um alarme agora, com o nome desta tarefa, para a hora em que você vai fazer.',
      'Deixe um aviso onde você vai ver na hora: um bilhete na tela ou um alarme no celular.'] },
  T6: { nome: 'Anotar o próximo passo', forca: 'Moderada',
    palavras: ['parei no meio', 'onde parei', 'parei', 'interromp'],
    passos: ['Escreva numa linha onde você parou e qual é o próximo passo. Ex.: "parei na página 2; próximo: o quadro 1".',
      'Antes de sair, anote o próximo passo na tarefa. Quando voltar, comece por ele.'] },
  T7: { nome: 'Pausa curta com retorno', forca: 'Moderada',
    palavras: ['cansaco', 'cansad', 'sem energia', 'irritad', 'exaust', 'esgotad'],
    passos: ['Faça uma pausa de 10 minutos com o relógio marcando. Ao voltar, só abra a tarefa.',
      'Respire devagar por 1 minuto: puxe o ar em 4, solte em 6. Depois, só abra a tarefa.',
      'Levante, beba água e volte em 5 minutos. O passo de volta é só abrir a tarefa.'] },
};

// Sinal de crise (desespero, falar em se ferir): para a técnica e mostra os contatos. Na dúvida, mostra.
const CRISE = ['me matar', 'suicid', 'quero morrer', 'vontade de morrer', 'me ferir', 'me machucar', 'me cortar', 'tirar minha vida',
  'tirar a minha vida', 'acabar com tudo', 'acabar com a minha vida', 'nao aguento mais', 'desesper', 'sem saida', 'nao quero mais viver'];
export const CONTATOS_CRISE = [{ nome: 'CVV', numero: '188', explica: 'conversa, 24 horas, de graça' }, { nome: 'SAMU', numero: '192', explica: 'emergência' }];

const limpar = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
export const ehCrise = (texto) => { const t = limpar(texto); return CRISE.some((p) => t.includes(p)); };

// A técnica cuja palavra do "Quando usar" mais longa aparece no texto ("esqueço de voltar" vence "esqueço").
// Sem nenhuma, T3 (começo mínimo), que serve para "não sei dizer".
function escolher(texto, fora) {
  const t = limpar(texto);
  let melhor = null, tamanho = 0;
  for (const [cod, { palavras }] of Object.entries(TECNICAS)) {
    if (fora.has(cod)) continue;
    for (const p of palavras) if (t.includes(p) && p.length > tamanho) { melhor = cod; tamanho = p.length; }
  }
  if (melhor) return melhor;
  if (!fora.has('T3')) return 'T3';
  // "Quero outro passo" sem palavra que sirva: a primeira técnica ainda não usada, na ordem da Base
  return Object.keys(TECNICAS).find((c) => !fora.has(c)) ?? null;
}

export function passoSemIA(texto, { tecnicasJaUsadas = [], passosJaDados = [] } = {}) {
  if (ehCrise(texto)) return { tipo: 'crise', pergunta: null, passo: null, mapa: [], tecnica: null, forca: null, linha_tecnica: null, contatos: CONTATOS_CRISE };
  const ja = new Set(passosJaDados);
  let cod = escolher(texto, new Set(tecnicasJaUsadas));
  let passo = cod && TECNICAS[cod].passos.find((p) => !ja.has(p));
  if (!passo) {   // todas usadas: volta à técnica do texto (ou T3), com um passo ainda não dado
    cod = escolher(texto, new Set());
    passo = TECNICAS[cod].passos.find((p) => !ja.has(p))
      ?? Object.entries(TECNICAS).flatMap(([c, t]) => t.passos.map((p) => [c, p])).find(([, p]) => !ja.has(p))?.[1];
    if (!TECNICAS[cod].passos.includes(passo)) cod = Object.keys(TECNICAS).find((c) => TECNICAS[c].passos.includes(passo)) ?? cod;
    passo ??= TECNICAS[cod].passos[0];   // tudo já foi dado: repete o primeiro, melhor que nada
  }
  const { nome, forca } = TECNICAS[cod];
  return { tipo: 'sem_ia', pergunta: null, passo, mapa: [], tecnica: cod, forca,
    linha_tecnica: `Usei: ${nome} · prova: ${forca.toLocaleLowerCase('pt-BR')}`, aviso: AVISO_SEM_IA };
}
