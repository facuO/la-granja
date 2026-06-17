# Fonts locales

Para que la app no dependa de Google Fonts CDN (no funciona offline en G450),
bajá las fuentes Quicksand y Nunito como `.woff2` y dejalas acá.

## Qué bajar

Desde fonts.google.com (o cualquier mirror CC):

- **Quicksand** — pesos 500 y 700
- **Nunito** — pesos 400 y 700

Archivos esperados acá:

```
fonts/
├── Quicksand-Medium.woff2
├── Quicksand-Bold.woff2
├── Nunito-Regular.woff2
└── Nunito-Bold.woff2
```

Si los archivos no están, el browser cae al `font-family` del sistema (definido
en `styles/tokens.css`) — la app sigue funcionando, solo con tipografía menos
amigable.

## Cómo se carga

Las declaraciones `@font-face` están en `styles/tokens.css` con `font-display: swap`
para que la app sea usable mientras carga la fuente (o si no se encuentra el
archivo).
