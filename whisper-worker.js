// Agente Assistente · o Whisper dentro do aparelho (T026; research R3). Roda num Web Worker para a tela não travar.
// Recebe { id, amostras } (áudio em 16 kHz, um canal) de fale.js e devolve { id, texto } ou { id, erro }.
// Biblioteca: Transformers.js 4.3.2 e o ONNX Runtime que ela pede, guardados em vendor/ (Rafael: "A, pode baixar", 11/11/2026).
// O modelo (Whisper small multilíngue, quantizado) baixa do Hugging Face na 1ª vez e fica no Cache Storage do aparelho.
// Se ficar lento no celular (mais de 10 s para uma frase de 15 s), trocar MODELO para 'onnx-community/whisper-base'.
// O áudio nunca sai daqui: só o modelo é baixado; nada é enviado.
import { pipeline, env } from './vendor/transformers-4.3.2/transformers.min.js';

const MODELO = 'onnx-community/whisper-small';
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = new URL('./vendor/transformers-4.3.2/', import.meta.url).href;   // o ONNX vem do app, não da internet

let ouvido = null;
async function preparar() {
  const comGpu = !!(self.navigator?.gpu && await self.navigator.gpu.requestAdapter().catch(() => null));
  return pipeline('automatic-speech-recognition', MODELO, {
    device: comGpu ? 'webgpu' : 'wasm',
    dtype: comGpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback: (p) => { if (p.status === 'progress') self.postMessage({ tipo: 'baixando', pronto: Math.round(p.progress ?? 0) }); },
  });
}

self.onmessage = async ({ data: { id, amostras } }) => {
  try {
    ouvido ??= preparar();
    const fazer = await ouvido;
    const r = await fazer(amostras, { language: 'portuguese', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
    self.postMessage({ id, texto: String(r?.text ?? '').trim() });
  } catch (e) {
    ouvido = null;   // tenta preparar de novo na próxima vez
    self.postMessage({ id, erro: String(e?.message || e) });
  }
};
