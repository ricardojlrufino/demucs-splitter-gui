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

## Requisitos para usar
- [Demucs](https://github.com/adefossez/demucs) instalado (ex.: `pipx install demucs`) e `ffmpeg`, ambos no PATH.
  O caminho do Demucs também pode ser informado dentro do app.
- Um navegador instalado (Chrome, Edge ou Firefox).
- Para GPU NVIDIA, o PyTorch do ambiente do Demucs precisa ser a versão CUDA, por exemplo:

      pipx runpip demucs install torch torchaudio --index-url https://download.pytorch.org/whl/cu126

## Instalar a partir dos fontes (Linux)

1. **Ferramentas de compilação** (só para gerar o pacote): [uv](https://docs.astral.sh/uv/getting-started/installation/),
   [Node.js](https://nodejs.org/) 20+ com [pnpm](https://pnpm.io/installation) e `make`.
   O Python 3.12 é baixado pelo `uv` se não houver um compatível.

2. **Baixar os fontes**

       git clone <url-do-repositório> stem-splitter
       cd stem-splitter

3. **Gerar o pacote** (como usuário comum, sem `sudo`; compila a interface e empacota com o PyInstaller)

       make package

4. **Instalar**

       sudo make install

   Instala em `/usr/local`: app em `lib/stem-splitter`, comando `stem-splitter` em `bin`, atalho no menu de
   aplicativos e ícone. Para outro destino use `PREFIX`:

       sudo make install PREFIX=/usr              # junto dos programas da distribuição
       make install PREFIX=$HOME/.local           # só para o seu usuário, sem sudo
       make install DESTDIR=/tmp/pkg              # monta uma árvore para criar pacotes

5. **Abrir**: pelo menu de aplicativos ("Stem Splitter") ou no terminal com `stem-splitter`.

6. **Desinstalar** (use o mesmo `PREFIX` da instalação)

       sudo make uninstall

Atualizar é repetir os passos 3 e 4 com os fontes novos.

> Se `make` der erro de "function definition file not found", o shell tem uma função `make` própria; use
> `/usr/bin/make`.

## Desenvolvimento
    make run        # compila a interface e abre o app direto dos fontes, sem instalar
    make ui         # só recompila a interface React

O auto-teste do pacote (usado na CI) confere a interface embutida e a biblioteca do WebUI, sem abrir janela:

    dist/stem-splitter/stem-splitter --self-test

## Windows e macOS
O PyInstaller não faz cross-compile: o pacote de cada sistema é gerado no próprio sistema. A pipeline abaixo faz
isso e publica um `.zip` por sistema; basta descompactar e executar `stem-splitter`.

## Pipeline (GitHub Actions)
`.github/workflows/build.yml` compila a interface, empacota com PyInstaller e roda `--self-test` em Linux x64,
Windows x64, macOS arm64 e macOS x64. Cada job publica um artefato (`stem-splitter-<sistema>.tar.gz|zip`); ao
enviar uma tag `v*` (ex.: `git tag v0.1.0 && git push --tags`) os pacotes são anexados a um Release.

Os pacotes não são assinados: o macOS pede "Abrir mesmo assim" (Ajustes > Privacidade e Segurança) e o
Windows pode mostrar o aviso do SmartScreen.
