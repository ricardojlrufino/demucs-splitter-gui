"""Entrada para o PyInstaller (o pacote usa imports relativos)."""
import sys

from stem_splitter.__main__ import main

if __name__ == "__main__":
    sys.exit(main())
