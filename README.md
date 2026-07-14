# Eneko Navarrete · Portfolio

Sitio personal de Eneko Navarrete — desarrollador web especializado en aplicaciones técnicas a medida (calculadoras, configuradores, visualizadores 3D, dashboards).

Web en producción: <https://enekodevs.com>

## Stack

HTML + CSS + JavaScript vanilla, sin frameworks ni build: los archivos se sirven tal cual.

- Multi-página: portada, trabajo, servicios, tarifas, contacto y CV (web + PDF)
- i18n propio (ES, CA, EN) con cambio en caliente y preferencia persistida en `localStorage`
- Animaciones de scroll con `IntersectionObserver` y respeto a `prefers-reduced-motion`
- Responsive móvil primero

## Estructura

```
.
├── index.html                 # portada
├── trabajo.html               # proyectos y casos de estudio
├── servicios.html             # servicios
├── tarifas.html               # tarifas
├── contacto.html              # contacto
├── cv.html / cv.pdf           # CV web y PDF
├── favicon.svg
├── screenshots/               # capturas reales de proyectos
├── robots.txt · sitemap.xml · _headers
└── README.md
```

## Caso de estudio principal

**DomesLab** — calculadora-configurador de domos geodésicos: Vite + React 18 + TypeScript estricto + react-three-fiber, con exportaciones a PDF/XLSX/OBJ/DXF y despliegue continuo en Cloudflare.

## Contacto

`eneko.devs@gmail.com` · <https://enekodevs.com>
