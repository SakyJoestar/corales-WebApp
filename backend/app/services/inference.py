import torch
from PIL import Image

def crop_patch(img: Image.Image, x: int, y: int, size: int = 32):
    half = size // 2
    left, top = x - half, y - half
    right, bottom = x + half, y + half

    patch = Image.new("RGB", (size, size), (0, 0, 0))
    crop = img.crop((left, top, right, bottom))

    paste_x = max(0, -left)
    paste_y = max(0, -top)
    patch.paste(crop, (paste_x, paste_y))
    return patch

@torch.no_grad()
def predict_points_batch(img, points, model, tfm):
    patches = [tfm(crop_patch(img, p["x"], p["y"])) for p in points]
    batch = torch.stack(patches)
    logits = model(batch)
    probs = torch.softmax(logits, dim=1)

    pred_idxs = probs.argmax(dim=1).cpu().numpy()
    confs = probs.max(dim=1).values.cpu().numpy()
    return pred_idxs, confs