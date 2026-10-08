.PHONY: wasm wasm-release dev build

wasm:
	wasm-pack build demucs-wasm --target web --out-dir ../web/src/wasm

wasm-release:
	wasm-pack build demucs-wasm --release --target web --out-dir ../web/src/wasm

dev: wasm-release
	cd web && pnpm install && pnpm exec vite

build: wasm-release
	cd web && pnpm install && pnpm exec vite build
