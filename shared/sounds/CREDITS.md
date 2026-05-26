# Audio credits

## chacarera.mp3

- **Track**: "Para brisa(s) - aire de chacarera"
- **Artistas**: Mariana Pavan y Lucas Desposito (colectivo Galerías Efímeras)
- **Fuente**: [archive.org/details/ParaBrisas-AireDeChacarera-MarianaPavanYLucasDesposito](https://archive.org/details/ParaBrisas-AireDeChacarera-MarianaPavanYLucasDesposito)
- **Licencia**: [Creative Commons Attribution-NonCommercial-ShareAlike 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) (CC BY-NC-SA 3.0)
- **Uso permitido**: personal, educativo, no comercial. Con atribución.
- **Restricción**: cualquier obra derivada debe distribuirse bajo la misma licencia.

Esta aplicación usa el archivo como música de fondo opcional en el shell.
Sofi puede activarlo/desactivarlo desde el botón "♪ Música" en el corral.

## Fallback procedural

Si el archivo MP3 no carga (Syncthing no terminó de sincronizar, archivo movido,
etc.), `lib/sounds.js` cae automáticamente a un sintetizador Web Audio que
reproduce un Sa Ta Na Ma generado en tiempo real (sin assets externos).
