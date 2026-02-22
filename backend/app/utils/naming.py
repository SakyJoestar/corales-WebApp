import os

def safe_sheet_name(name: str) -> str:
    bad = ['[', ']', ':', '*', '?', '/', '\\']
    for b in bad:
        name = name.replace(b, "_")
    name = name.strip() or "Imagen"
    return name[:31]

def safe_filename(name: str) -> str:
    name = os.path.basename(name or "imagen")
    return "".join(
        c if c.isalnum() or c in (" ", "-", "_", ".", "(", ")") else "_"
        for c in name
    ).strip() or "imagen"