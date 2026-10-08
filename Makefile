SHELL := /bin/bash
.PHONY: ui dev run package install uninstall

# Compila a interface React para dentro do app Python
ui:
	cd web && pnpm install && pnpm build

# Desenvolvimento da interface: API local (sem janela) + Vite com hot reload. Abra http://localhost:1420
# Ctrl+C encerra os dois.
dev:
	cd web && pnpm install
	@rm -f .dev-api.json
	@cd app && uv run python -m demucs_splitter_gui --api-only ../.dev-api.json & api=$$!; \
	trap 'kill $$api 2>/dev/null; wait $$api 2>/dev/null' EXIT INT TERM; \
	for i in $$(seq 1 100); do [ -f .dev-api.json ] && break; sleep 0.1; done; \
	[ -f .dev-api.json ] || { echo "A API não iniciou."; exit 1; }; \
	cd web && pnpm exec vite

# Abre o app (janela WebUI)
run: ui
	cd app && uv run demucs-splitter-gui

# Gera o executável da plataforma atual em dist/demucs-splitter-gui
package: ui
	cd app && uv run pyinstaller --noconfirm --distpath ../dist demucs-splitter-gui.spec

# --- Instalação no Linux --------------------------------------------------------------------
# Uso:  make package && sudo make install      (desinstalar: sudo make uninstall)
# Outros destinos: PREFIX=/usr, PREFIX=$$HOME/.local (sem sudo) ou DESTDIR=/pasta (para empacotar).
PREFIX  ?= /usr/local
APPDIR   = $(DESTDIR)$(PREFIX)/lib/demucs-splitter-gui
BINDIR   = $(DESTDIR)$(PREFIX)/bin
DESKTOP  = $(DESTDIR)$(PREFIX)/share/applications
ICONDIR  = $(DESTDIR)$(PREFIX)/share/icons/hicolor/scalable/apps

install:
	@test -x dist/demucs-splitter-gui/demucs-splitter-gui || { echo "Pacote não encontrado. Rode primeiro: make package"; exit 1; }
	install -d $(APPDIR) $(BINDIR) $(DESKTOP) $(ICONDIR)
	cp -R dist/demucs-splitter-gui/. $(APPDIR)/
	chmod -R u=rwX,go=rX $(APPDIR)
	ln -sf $(PREFIX)/lib/demucs-splitter-gui/demucs-splitter-gui $(BINDIR)/demucs-splitter-gui
	install -m 644 web/public/favicon.svg $(ICONDIR)/demucs-splitter-gui.svg
	printf '%s\n' \
	  '[Desktop Entry]' 'Type=Application' 'Name=Demucs Splitter GUI' \
	  'Comment=Separação de áudio em pistas com o Demucs' \
	  'Exec=$(PREFIX)/bin/demucs-splitter-gui' 'Icon=demucs-splitter-gui' \
	  'Categories=AudioVideo;Audio;' 'Terminal=false' 'StartupWMClass=demucs-splitter-gui' \
	  > $(DESKTOP)/demucs-splitter-gui.desktop
	chmod 644 $(DESKTOP)/demucs-splitter-gui.desktop
	@[ -n "$(DESTDIR)" ] || { update-desktop-database $(DESKTOP) 2>/dev/null; gtk-update-icon-cache -q -t $(PREFIX)/share/icons/hicolor 2>/dev/null; true; }
	@echo "Instalado em $(PREFIX). Abra pelo menu de aplicativos ou com: demucs-splitter-gui"

uninstall:
	rm -rf $(APPDIR)
	rm -f $(BINDIR)/demucs-splitter-gui $(DESKTOP)/demucs-splitter-gui.desktop $(ICONDIR)/demucs-splitter-gui.svg
	@[ -n "$(DESTDIR)" ] || { update-desktop-database $(DESKTOP) 2>/dev/null; true; }
	@echo "Removido de $(PREFIX)."
