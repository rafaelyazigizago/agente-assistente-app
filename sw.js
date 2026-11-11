// Agente Assistente · service worker: sempre pergunta ao servidor se o arquivo mudou; sem internet, abre a última guardada.
// Os dados (Supabase) nunca passam por aqui: só os arquivos da página.
// A versão vem de versao.js, carimbada pelo scripts/publicar.sh. Mudou o carimbo, o navegador instala este service worker de novo.
importScripts('versao.js');
const VERSAO = `assistente-${self.VERSAO_APP || 'dev'}`;
const ARQUIVOS = [
  './', 'index.html', 'estilo.css', 'manifest.webmanifest', 'versao.js',
  'app.js', 'datas.js', 'calculos.js', 'dados.js', 'estado.js', 'ui.js', 'tema.js', 'base-passos.js', 'data-local.js', 'hoje-dia.js', 'travei.js', 'fale.js', 'whisper-worker.js', 'inicio.js', 'contagem.js', 'sair.js',
  'fontes/atkinson-hyperlegible-latin-400-normal.woff2', 'fontes/atkinson-hyperlegible-latin-700-normal.woff2',
  'vendor/supabase-2.117.2.js', 'icones/icone-192.png', 'icones/icone-512.png',
];

self.addEventListener('install', (e) => {
  // 'reload': direto do servidor, sem a cópia de 10 min que o navegador guarda (senão a versão nova nasce misturada com a velha).
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS.map((a) => new Request(a, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      // só as versões velhas do app; o modelo do Whisper (transformers-cache) fica (revisão T037, achado 3)
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('assistente-') && n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const pedido = e.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) return;
  // 'no-cache': pergunta ao servidor se o arquivo mudou antes de usar a cópia do navegador.
  const daRede = pedido.mode === 'navigate' ? fetch(pedido.url, { cache: 'no-cache' }) : fetch(pedido, { cache: 'no-cache' });
  const guardar = daRede.then((resposta) => {
    if (resposta.ok) {
      const copia = resposta.clone();
      caches.open(VERSAO).then((c) => c.put(pedido, copia));
    }
    return resposta;
  });
  // Rede lenta (28/10, o Android que ficava carregando): depois de 10 s, usa a cópia guardada; sem cópia, continua esperando.
  const lenta = new Promise((ok) => setTimeout(ok, 10000))
    .then(() => caches.match(pedido, { ignoreSearch: true }))
    .then((r) => r || guardar);
  e.respondWith(Promise.race([guardar, lenta])
    .catch(() => caches.match(pedido, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
