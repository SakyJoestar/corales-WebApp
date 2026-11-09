import io, os
from PIL import Image, UnidentifiedImageError

# Formatos aceptados: los mismos que anuncia la interfaz (PNG y JPG).
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
# MPO es JPEG con más de una imagen dentro (lo producen algunas cámaras, p. ej. Nikon);
# PIL lo reporta aparte, pero es un JPG normal para el usuario.
ALLOWED_FORMATS = {"PNG", "JPEG", "MPO"}
ALLOWED_LABEL = "PNG o JPG"


class InvalidImageError(ValueError):
    pass


def check_extension(filename: str) -> None:
    """Rechaza por extensión antes de leer el archivo."""
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise InvalidImageError(
            f'"{filename}" no es una imagen válida. Solo se aceptan archivos {ALLOWED_LABEL}.'
        )


def open_image(content: bytes, filename: str) -> Image.Image:
    """Abre la imagen en RGB. La extensión y el contenido deben ser PNG o JPG;
    si no, lanza InvalidImageError con un mensaje para mostrar al usuario."""
    check_extension(filename)
    try:
        img = Image.open(io.BytesIO(content))
        fmt = img.format
        img = img.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError):
        raise InvalidImageError(
            f'"{filename}" no se pudo leer como imagen. Solo se aceptan archivos {ALLOWED_LABEL}.'
        )
    if fmt not in ALLOWED_FORMATS:
        raise InvalidImageError(
            f'"{filename}" no es una imagen {ALLOWED_LABEL}.'
        )
    return img
