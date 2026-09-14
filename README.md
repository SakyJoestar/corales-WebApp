---
title: CoralGorgona
emoji: 🪸
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---

# 🪸 CoralGorgona

### Sistema inteligente de marcado de puntos en imágenes de coral

[![Estado](https://img.shields.io/badge/status-En%20Desarrollo-yellow)](#)
[![Python](https://img.shields.io/badge/Python-3.11-blue)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-Docker-green)](#)
[![PyTorch](https://img.shields.io/badge/PyTorch-CPU-red)](#)

---

## 📌 Descripción

**CoralGorgona** es una aplicación web (FastAPI + PyTorch + JavaScript vanilla) para el marcado automático y manual de puntos sobre imágenes de coral, pensada para análisis ecológico y estudios de cobertura bentónica (método de puntos aleatorios / point-count).

El sistema:
- Genera puntos aleatorios (o permite marcarlos a mano) sobre una imagen submarina.
- Clasifica un recorte alrededor de cada punto con una red convolucional (AlexNet / ResNet18 / VGG16 / MobileNetV2) entrenada para distinguir Algas, Coral, Otros organismos, Sustrato inerte, Tape y sin clasificar.
- Genera la imagen anotada, una tabla de puntos con confianza por predicción, cobertura por categoría, y exporta a Excel.
- Soporta procesamiento por lotes (hasta 25 imágenes) generando un ZIP con imágenes anotadas + un Excel con una hoja por imagen.

---

## 🗂️ Estructura del proyecto

```
coralWebApp/
├─ backend/                  # API FastAPI (Python)
│  └─ app/
│     ├─ main.py             # entrypoint: monta /static y sirve index.html en "/"
│     ├─ api/
│     │  ├─ router.py        # agrega todas las sub-rutas
│     │  └─ routes/          # process, process_batch, export, models, home, download
│     ├─ services/           # inferencia, dibujo de puntos, batch/zip, excel, carga de modelos
│     ├─ core/config.py      # constantes (clases, límites, paths)
│     └─ models_store/       # (gitignored) pesos locales, si los usas fuera del Hub
├─ frontend/                 # HTML/CSS/JS vanilla servido como estático en /static
│  ├─ index.html
│  ├─ styles.css
│  └─ js/                    # dom.js, state.js, api.js, manual.js, render.js, viewer.js, ...
├─ .github/workflows/        # CI: sync-to-hf.yml (espejo automático a Hugging Face)
├─ Dockerfile                # imagen usada tanto por el Space (Docker SDK) como localmente
└─ requirements.txt
```

`frontend/` vive en la raíz (no dentro de `backend/`) a propósito: son dos capas independientes — el backend solo la sirve como estáticos vía `StaticFiles`, montada bajo el prefijo URL `/static` (ver `backend/app/core/config.py:FRONTEND_DIR` y `backend/app/main.py`).

---

## 🚀 Características

- 🧠 Selección dinámica de modelo (AlexNet, ResNet18, VGG16, MobileNetV2) desde un repo de modelos en Hugging Face Hub.
- 📍 Generación automática de puntos aleatorios, con control de cantidad por imagen.
- ✍️ Modo manual interactivo (marca puntos a mano sobre una sola imagen).
- ✂️ Recorte de imagen antes de procesar.
- 📊 Tabla de resultados + cobertura por categoría, exportable a Excel.
- 📦 Procesamiento por lotes (hasta 25 imágenes) con salida en ZIP (imágenes anotadas + Excel).
- ⏹️ Botón de cancelar: aborta la petición desde el navegador y, del lado del servidor, corta la inferencia entre lotes de puntos (o entre imágenes en modo batch) en cuanto detecta que el cliente se desconectó — no sigue gastando CPU en una respuesta que nadie va a recibir.
- ⚡ Cache de modelos en memoria (no se recarga el modelo en cada request) y trabajo pesado (carga de modelo + inferencia + dibujo) corriendo en threadpool para no bloquear el event loop mientras se atienden otras peticiones.
- 🌗 Tema claro/oscuro, historial de resultados en el navegador.

---

## 🛠 Tecnologías

- **Backend**: FastAPI + Uvicorn (Python 3.11)
- **Deep Learning**: PyTorch + Torchvision (CPU), pesos descargados de Hugging Face Hub (`huggingface_hub`)
- **Procesamiento de imágenes**: Pillow
- **Exportación Excel**: OpenPyXL
- **Frontend**: HTML + CSS + JavaScript vanilla (sin build step)
- **Contenedor**: Docker (`python:3.11-slim`)
- **CI/CD**: GitHub Actions → sync automático a un Hugging Face Space

---

## 🧩 Modelos

Los pesos **no** viven en este repo. `backend/app/services/model_loader.py` descarga, por cada `model_id`, dos archivos desde un repo de Hugging Face Hub (`HF_REPO_ID = "SamuelGal/coral-models"`):

```
{model_id}/meta.json        # { "model_name": "<arquitectura>" }
{model_id}/best_model.pt    # state_dict de PyTorch
```

Arquitecturas soportadas hoy (normalizadas sin importar guiones/guion bajo, ej. `mobilenet_v2` o `mobilenetv2` son equivalentes): `vgg16`, `resnet18`, `alexnet`, `mobilenetv2`. Los `model_id` expuestos al frontend se definen en `backend/app/api/routes/models.py:AVAILABLE_MODELS`.

Para agregar un modelo nuevo: subir su carpeta `{model_id}/` (con `meta.json` y `best_model.pt`) al repo de Hugging Face, agregar su entrada en `AVAILABLE_MODELS`, y si es una arquitectura nueva, sumarla en `build_model()` dentro de `model_loader.py`.

---

## 🔌 Endpoints principales

| Método | Ruta                         | Descripción                                              |
|--------|------------------------------|-----------------------------------------------------------|
| GET    | `/`                          | Sirve el frontend (`frontend/index.html`)                |
| GET    | `/models`                    | Lista de modelos disponibles y sus clases                |
| POST   | `/process`                   | Procesa 1 imagen (automático o puntos manuales)           |
| POST   | `/process_batch`             | Procesa varias imágenes, devuelve un ZIP                  |
| POST   | `/export/excel`              | Exporta los puntos de una imagen a Excel                  |
| GET    | `/download/image/{token}`    | Descarga la imagen anotada generada por `/process`        |
| GET    | `/static/*`                  | Assets del frontend (JS, CSS, favicon)                    |

---

## 💻 Ejecutar localmente

```bash
# 1) Instalar dependencias
pip install -r requirements.txt

# 2) Levantar el servidor (desde la raíz del repo)
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

Abre `http://localhost:8000`. La primera vez que uses un modelo, se descargará desde Hugging Face Hub (puede tardar unos segundos).

---

## ☁️ Despliegue (Hugging Face Space) y CI/CD

La app corre como un [Space de Hugging Face](https://huggingface.co/spaces/SamuelGal/coralWebApp) (SDK Docker), pero **GitHub es la fuente de verdad**:

```
push a develop/master en GitHub  →  GitHub Action (.github/workflows/sync-to-hf.yml)  →  espejo por SSH al Space de HF
```

- Remoto `github` → `https://github.com/SakyJoestar/corales-WebApp` (donde se hace push).
- Remoto `origin` → `git@hf.co:spaces/SamuelGal/coralWebApp` (solo destino del sync automático; no se le hace push a mano).
- El Action usa un secret `HF_SSH_PRIVATE_KEY` (llave SSH cuya pública está agregada en la cuenta de Hugging Face) y mapea `master`→`main`, `develop`→`develop`.

**Flujo de trabajo:**
1. Se trabaja y se hace push directo a `develop`.
2. Para pasar a producción, se abre un Pull Request `develop` → `master` en GitHub y se mergea ahí (no se pushea `master` directo).
3. Cada push a cualquiera de las dos ramas dispara el sync automático hacia el Space correspondiente.

---

## ⚙️ Límites y configuración (`backend/app/core/config.py`)

| Constante           | Valor | Descripción                                                        |
|---------------------|-------|----------------------------------------------------------------------|
| `MAX_BATCH_IMAGES`   | 25    | Máximo de imágenes por lote en `/process_batch`                     |
| `DEFAULT_N_POINTS`   | 100   | Puntos por imagen si no se especifica otro valor                    |
| `POINTS_CHUNK_SIZE`  | 256   | Tamaño de lote de inferencia; entre chunks se revisa si el cliente canceló |
