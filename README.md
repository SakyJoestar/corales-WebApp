# 🪸 Coral WebApp  
### Sistema Inteligente de Marcado de Puntos en Imágenes de Coral

[![Estado](https://img.shields.io/badge/status-En%20Desarrollo-yellow)](#)
[![Python](https://img.shields.io/badge/Python-3.9%2B-blue)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-green)](#)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.x-red)](#)
---

## 📑 Tabla de Contenidos

- [Descripción](#-descripción)
- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Instalación](#-instalación)
- [Uso](#-uso)

---

## 📌 Descripción

**Coral WebApp** es una aplicación web desarrollada con **FastAPI y PyTorch** que permite el marcado automático y manual de puntos sobre imágenes de coral para análisis ecológico y estudios científicos.

El sistema utiliza modelos de Deep Learning entrenados previamente para clasificar regiones específicas dentro de imágenes submarinas, generando:

- Imagen anotada con puntos etiquetados  
- Tabla estructurada con coordenadas y predicciones  
- Exportación a Excel  
- Procesamiento por lotes con generación de ZIP  

📍 **Estado del proyecto**: En desarrollo activo

---

## 🚀 Características

- 🧠 Selección dinámica de modelos entrenados
- 📍 Generación automática de puntos aleatorios
- ✍️ Modo manual interactivo
- 📊 Exportación de resultados a Excel
- 📦 Procesamiento por lotes (hasta 25 imágenes)
- 🖼 Generación de imágenes anotadas
- ⚡ Cache de modelos en memoria
- 🧩 Arquitectura modular y escalable

---

## 🛠 Tecnologías

- **Backend**: FastAPI
- **Deep Learning**: PyTorch + Torchvision
- **Procesamiento de imágenes**: Pillow
- **Exportación Excel**: OpenPyXL
- **Frontend**: HTML + CSS + JavaScript Vanilla
- **Servidor ASGI**: Uvicorn

---

## ⚙️ Instalación

### 1 Clonar el repositorio

```bash
git clone https://github.com/usuario/coral-webapp.git
cd coral-webapp
```

## ⚙️ uso 

### 1 Ejecutar desde backend

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2 Ejecutar desde raiz
```bash
uvicorn app.main:app --reload --app-dir backend --host 0.0.0.0 --port 8000
```