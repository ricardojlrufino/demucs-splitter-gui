# Demucs Splitter GUI

App desktop para separar áudio em até 6 pistas (bateria, baixo, vocais, guitarra, piano e outros) usando o
**Demucs já instalado no computador** (linha de comando).

- Aba **1 · Original**: importar arquivo (seletor, arrastar e soltar ou **link do YouTube**), waveform com player, selecionar um trecho,
  escolher o modelo (Standard / 6-Stem / Fine-Tuned) e o dispositivo (Automático / CUDA / MPS / CPU).
- Aba **2 · Pistas**: waveform por pista, mudo/solo/volume e download em WAV ou zip.

O painel "Ambiente" mostra se o Demucs e o ffmpeg foram encontrados e se o PyTorch tem aceleração por GPU. Os
modelos são baixados pelo próprio Demucs na primeira execução.

## Importar do YouTube
Em vez de abrir um arquivo, você pode colar o link de um vídeo do YouTube na tela inicial:

1. Cole o link (`youtube.com/...` ou `youtu.be/...`) no campo **"Ou cole um link do YouTube"**.
2. Aperte Enter ou clique em **Importar**. O app baixa o áudio e mostra o progresso (dá para cancelar).
3. Quando terminar, o áudio abre como qualquer arquivo: escolha o trecho, o modelo e clique em separar.

Não precisa instalar nenhum programa extra para isso.

**Limites:** só links do YouTube, de um vídeo por vez (playlists são ignoradas), sem transmissões ao vivo e sem
vídeos com mais de 3 horas. Precisa de internet.

**Se o download falhar** com a mensagem de que o vídeo não pôde ser baixado, confira se o link abre no navegador e
se o vídeo está disponível na sua região. Se outros vídeos também falharem, provavelmente o YouTube mudou algo:
instale a versão mais recente do aplicativo, que traz o downloader atualizado.

**Aviso legal:** baixar vídeos do YouTube pode ir contra os termos de uso do serviço e contra direitos autorais.
Use apenas conteúdo que você tem direito de baixar e de processar (por exemplo, suas próprias gravações ou
material com licença que permita isso). A responsabilidade pelo uso é sua.

## Como funciona
Python + [WebUI](https://webui.me): a janela abre no Chrome/Edge/Firefox já instalado (modo app). Um servidor HTTP
local (só `127.0.0.1`, protegido por token aleatório a cada execução) faz o trabalho: converte o áudio com ffmpeg,
executa o `demucs` e envia o progresso à interface. A interface (React) fica em `web/` e é compilada para
`app/demucs_splitter_gui/ui`.

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

       git clone <url-do-repositório> demucs-splitter-gui
       cd demucs-splitter-gui

3. **Gerar o pacote** (como usuário comum, sem `sudo`; compila a interface e empacota com o PyInstaller)

       make package

4. **Instalar**

       sudo make install

   Instala em `/usr/local`: app em `lib/demucs-splitter-gui`, comando `demucs-splitter-gui` em `bin`, atalho no menu de
   aplicativos e ícone. Para outro destino use `PREFIX`:

       sudo make install PREFIX=/usr              # junto dos programas da distribuição
       make install PREFIX=$HOME/.local           # só para o seu usuário, sem sudo
       make install DESTDIR=/tmp/pkg              # monta uma árvore para criar pacotes

5. **Abrir**: pelo menu de aplicativos ("Demucs Splitter GUI") ou no terminal com `demucs-splitter-gui`.

6. **Desinstalar** (use o mesmo `PREFIX` da instalação)

       sudo make uninstall

Atualizar é repetir os passos 3 e 4 com os fontes novos.

> Se `make` der erro de "function definition file not found", o shell tem uma função `make` própria; use
> `/usr/bin/make`.

## Desenvolvimento
    make dev        # interface com hot reload: API local (sem janela) + Vite; abra http://localhost:1420
    make run        # compila a interface e abre o app direto dos fontes (janela WebUI), sem instalar
    make ui         # só recompila a interface React

O `make dev` é o mais rápido para mexer na interface: a API local sobe sem janela e o Vite recarrega a página a
cada alteração em `web/src`. Ctrl+C encerra os dois.

O auto-teste do pacote (usado na CI) confere a interface embutida e a biblioteca do WebUI, sem abrir janela:

    dist/demucs-splitter-gui/demucs-splitter-gui --self-test

## Windows e macOS
O PyInstaller não faz cross-compile: o pacote de cada sistema é gerado no próprio sistema. A pipeline abaixo faz
isso e publica um `.zip` por sistema; basta descompactar e executar `demucs-splitter-gui`.

## Manutenção: atualizar o downloader do YouTube
O download usa a biblioteca [yt-dlp](https://github.com/yt-dlp/yt-dlp), embutida no pacote. O YouTube muda com
frequência; quando os downloads começarem a falhar, atualize e gere uma nova versão:

    cd app && uv lock --upgrade-package yt-dlp
    make package          # e publique/instale o novo pacote

## Pipeline (GitHub Actions)
`.github/workflows/build.yml` compila a interface, empacota com PyInstaller e roda `--self-test` em Linux x64,
Windows x64, macOS arm64 e macOS x64. Cada job publica um artefato (`demucs-splitter-gui-<sistema>.tar.gz|zip`); ao
enviar uma tag `v*` (ex.: `git tag v0.1.0 && git push --tags`) os pacotes são anexados a um Release.

Os pacotes não são assinados: o macOS pede "Abrir mesmo assim" (Ajustes > Privacidade e Segurança) e o
Windows pode mostrar o aviso do SmartScreen.
