from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "apps" / "desktop"
DESTINATION = ROOT / "JARVIS-Desktop.zip"

with ZipFile(DESTINATION, "w", compression=ZIP_DEFLATED, compresslevel=8) as archive:
    for path in sorted(SOURCE.rglob("*")):
        if not path.is_file() or "__pycache__" in path.parts or ".pytest_cache" in path.parts or "venv" in path.parts or path.suffix == ".pyc":
            continue
        archive.write(path, Path("JARVIS-Desktop") / path.relative_to(SOURCE))

print(f"Updated {DESTINATION}")
