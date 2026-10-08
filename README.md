# Stem Splitter

Separação de áudio em até 6 pistas (bateria, baixo, vocais, guitarra, piano, outros) com
[demucs-rs](https://github.com/nikhilunni/demucs-rs), rodando 100% no navegador via WASM + WebGPU.

- Aba **1 · Original**: importar arquivo, waveform com player, selecionar trecho, escolher modelo
  (Standard / 6-Stem / Fine-Tuned) e as pistas a extrair.
- Aba **2 · Pistas**: waveform por pista, mudo/solo/volume, download em WAV.

Os pesos dos modelos são baixados do Hugging Face na primeira vez e ficam em cache (IndexedDB).

## Rodar
Requisitos: Rust, `wasm-pack`, `rustup target add wasm32-unknown-unknown`, Node + pnpm, navegador com WebGPU.

    make dev      # compila WASM (release) + Vite dev server
    make build    # build de produção em web/dist
