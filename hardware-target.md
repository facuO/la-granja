# Target hardware: Lenovo G450 (refuncionalizada para Sofi)

## Hardware
- **Modelo:** Lenovo G450, machine type 2949 (notebook 14", 2010)
- **CPU:** Intel Pentium Dual-Core T4500 @ 2.30GHz
  - Arquitectura: Penryn (2010), 45nm
  - 2 cores / 2 threads (sin Hyper-Threading)
  - 1MB L2 cache, FSB 800MHz, TDP 35W
  - x86_64 capable (ISA: SSE2, SSE3, SSSE3, SSE4.1 — sin AVX)
- **RAM:** 6GB DDR3 SODIMM (upgrade desde 2GB original)
- **GPU:** Intel GMA 4500M integrada
  - OpenGL 2.1 máximo, sin soporte Vulkan
  - No apta para WebGL2 complejo, shaders pesados, ni aceleración de video moderna (H.265, AV1)
  - Decodificación HW solo hasta H.264 básico
- **Storage:** [pendiente] SSD SATA 240GB a instalar (originalmente HDD 5400rpm)
- **Red:** Ethernet 100Mbps + Wi-Fi Broadcom BCM4312 (b/g, sin N)
- **USB:** 2.0 únicamente (sin USB 3.0)

## Software
- **OS:** Linux Mint 22.3 XFCE 64-bit (base Ubuntu 24.04 LTS)
- **Kernel:** 6.8 LTS
- **Desktop:** XFCE 4.18
- **Browser objetivo:** Firefox ESR o Chromium estable

## Restricciones de diseño para apps/ejercicios
- **Frontend:** HTML+JS vanilla o frameworks ultralivianos (Alpine, Petite-Vue).
  Evitar: React/Vue/Svelte con bundles grandes, Tailwind JIT en cliente, Electron.
- **Renderizado:** SVG y Canvas 2D OK. Evitar WebGL avanzado, Three.js complejo, shaders custom.
- **Animaciones:** CSS transitions OK, evitar animaciones JS de alto framerate (60fps puede sufrir).
- **Audio:** Web Audio API básica OK; síntesis pesada en tiempo real puede saturar CPU.
- **Python local:** OK para scripts educativos (sin ML pesado). Thonny IDE recomendado.
- **Tamaño de assets:** mantener imágenes <500KB, evitar videos embebidos pesados.
- **Tabs simultáneas:** asumir 3-4 max sin degradación.

## Caso de uso
PC dedicada a ejercicios educativos para Sofi (mi hija). Los ejercicios se sincronizan
desde mi compu vía Syncthing a `~/Ejercicios/`. Formato preferido: un `index.html`
autocontenido por ejercicio, sin build step, abre directo en el browser.
