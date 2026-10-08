# Stem Splitter

App desktop para separar áudio em até 6 pistas (bateria, baixo, vocais, guitarra, piano e outros) usando o
**Demucs já instalado no computador** (linha de comando).

- Aba **1 · Original**: importar arquivo (seletor ou arrastar e soltar), waveform com player, selecionar um trecho,
  escolher o modelo (Standard / 6-Stem / Fine-Tuned) e o dispositivo (Automático / CUDA / MPS / CPU).
- Aba **2 · Pistas**: waveform por pista, mudo/solo/volume e download em WAV ou zip.

O painel "Ambiente" mostra se o Demucs e o ffmpeg foram encontrados e se o PyTorch tem aceleração por GPU. Os
modelos são baixados pelo próprio Demucs na primeira execução.

## Como funciona
Python + [WebUI](https://webui.me): a janela abre no Chrome/Edge/Firefox já instalado (modo app). Um servidor HTTP
local (só `127.0.0.1`, protegido por token aleatório a cada execução) faz o trabalho: converte o áudio com ffmpeg,
executa o `demucs` e envia o progresso à interface. A interface (React) fica em `web/` e é compilada para
`app/stem_splitter/ui`.

## Pré-requisitos
- `demucs` (ex.: `pipx install demucs`) e `ffmpeg` no PATH. O caminho do Demucs também pode ser informado no app.
- Um navegador instalado (Chrome, Edge ou Firefox).
- Para GPU NVIDIA, o PyTorch do ambiente do Demucs precisa ser a versão CUDA, por exemplo:

      pipx runpip demucs install torch torchaudio --index-url https://download.pytorch.org/whl/cu126

- Para desenvolver/compilar: [uv](https://docs.astral.sh/uv/), Node + pnpm.

## Rodar e empacotar
    make run        # compila a interface e abre o app
    make package    # gera dist/stem-splitter (PyInstaller) para a plataforma atual

O PyInstaller não faz cross-compile: gere o pacote de cada sistema (Linux, macOS, Windows) no próprio sistema,
por exemplo com uma matriz de jobs no GitHub Actions.

## Pipeline (GitHub Actions)
`.github/workflows/build.yml` compila a interface, empacota com PyInstaller e roda `--self-test` em Linux x64,
Windows x64, macOS arm64 e macOS x64. Cada job publica um artefato (`stem-splitter-<sistema>.tar.gz|zip`); ao
enviar uma tag `v*` (ex.: `git tag v0.1.0 && git push --tags`) os pacotes são anexados a um Release.

Os pacotes não são assinados: o macOS pede "Abrir mesmo assim" (Ajustes > Privacidade e Segurança) e o
Windows pode mostrar o aviso do SmartScreen.
