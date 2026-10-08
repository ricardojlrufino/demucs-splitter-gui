.PHONY: ui run package

# Compila a interface React para dentro do app Python
ui:
	cd web && pnpm install && pnpm build

# Abre o app (janela WebUI)
run: ui
	cd app && uv run stem-splitter

# Gera o executável da plataforma atual em dist/stem-splitter
package: ui
	cd app && uv run pyinstaller --noconfirm --distpath ../dist stem-splitter.spec
