.PHONY: ui run package install uninstall

# Compila a interface React para dentro do app Python
ui:
	cd web && pnpm install && pnpm build

# Abre o app (janela WebUI)
run: ui
	cd app && uv run stem-splitter

# Gera o executável da plataforma atual em dist/stem-splitter
package: ui
	cd app && uv run pyinstaller --noconfirm --distpath ../dist stem-splitter.spec

# --- Instalação no Linux --------------------------------------------------------------------
# Uso:  make package && sudo make install      (desinstalar: sudo make uninstall)
# Outros destinos: PREFIX=/usr, PREFIX=$$HOME/.local (sem sudo) ou DESTDIR=/pasta (para empacotar).
PREFIX  ?= /usr/local
APPDIR   = $(DESTDIR)$(PREFIX)/lib/stem-splitter
BINDIR   = $(DESTDIR)$(PREFIX)/bin
DESKTOP  = $(DESTDIR)$(PREFIX)/share/applications
ICONDIR  = $(DESTDIR)$(PREFIX)/share/icons/hicolor/scalable/apps

install:
	@test -x dist/stem-splitter/stem-splitter || { echo "Pacote não encontrado. Rode primeiro: make package"; exit 1; }
	install -d $(APPDIR) $(BINDIR) $(DESKTOP) $(ICONDIR)
	cp -R dist/stem-splitter/. $(APPDIR)/
	chmod -R u=rwX,go=rX $(APPDIR)
	ln -sf $(PREFIX)/lib/stem-splitter/stem-splitter $(BINDIR)/stem-splitter
	install -m 644 web/public/favicon.svg $(ICONDIR)/stem-splitter.svg
	printf '%s\n' \
	  '[Desktop Entry]' 'Type=Application' 'Name=Stem Splitter' \
	  'Comment=Separação de áudio em pistas com o Demucs' \
	  'Exec=$(PREFIX)/bin/stem-splitter' 'Icon=stem-splitter' \
	  'Categories=AudioVideo;Audio;' 'Terminal=false' 'StartupWMClass=stem-splitter' \
	  > $(DESKTOP)/stem-splitter.desktop
	chmod 644 $(DESKTOP)/stem-splitter.desktop
	@[ -n "$(DESTDIR)" ] || { update-desktop-database $(DESKTOP) 2>/dev/null; gtk-update-icon-cache -q -t $(PREFIX)/share/icons/hicolor 2>/dev/null; true; }
	@echo "Instalado em $(PREFIX). Abra pelo menu de aplicativos ou com: stem-splitter"

uninstall:
	rm -rf $(APPDIR)
	rm -f $(BINDIR)/stem-splitter $(DESKTOP)/stem-splitter.desktop $(ICONDIR)/stem-splitter.svg
	@[ -n "$(DESTDIR)" ] || { update-desktop-database $(DESKTOP) 2>/dev/null; true; }
	@echo "Removido de $(PREFIX)."
