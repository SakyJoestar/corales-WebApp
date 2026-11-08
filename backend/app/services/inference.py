import torch
from PIL import Image

def crop_patch(img: Image.Image, x: int, y: int, size: int = 32):
    # Igual que crop_centered_patch() del pipeline de entrenamiento: recorta solo
    # la parte dentro de la imagen y la pega sobre negro en su posición relativa.
    # (PIL.crop ya rellena con negro lo que cae fuera, así que pegarlo además con
    # un desplazamiento corría el contenido en los puntos cerca del borde.)
    W, H = img.size
    half = size // 2
    left, top = x - half, y - half
    right, bottom = left + size, top + size

    ileft, itop = max(0, left), max(0, top)
    iright, ibottom = min(W, right), min(H, bottom)

    patch = Image.new("RGB", (size, size), (0, 0, 0))
    if iright > ileft and ibottom > itop:
        patch.paste(img.crop((ileft, itop, iright, ibottom)), (ileft - left, itop - top))
    return patch

@torch.no_grad()
def predict_probs(img, points, model, tfm, patch_size: int = 32):
    """Probabilidades softmax (N x num_clases) para el recorte de cada punto."""
    patches = [tfm(crop_patch(img, p["x"], p["y"], patch_size)) for p in points]
    batch = torch.stack(patches)
    return torch.softmax(model(batch), dim=1)

def predict_points_batch(img, points, model, tfm, patch_size: int = 32):
    probs = predict_probs(img, points, model, tfm, patch_size)
    pred_idxs = probs.argmax(dim=1).cpu().numpy()
    confs = probs.max(dim=1).values.cpu().numpy()
    return pred_idxs, confs
