# Rediseño del juego del Pollito — "Un día del Pollito"

**Fecha:** 2026-06-03
**Estado:** diseño aprobado, pendiente plan de implementación por fase
**Reemplaza:** el juego actual en `public/juegos/pollito.html` y módulos relacionados (`juego-pollito.js`, `juego-pollito-sprites.js`, `juego-pollito-audio.js`). El código previo queda en el repo hasta que cada fase del rediseño lo absorba.

## 1. Contexto

El juego "Aventura del Pollito" venía de iteraciones rápidas: cada feature se agregó arriba de la anterior sin una visión integrada. El resultado tiene piezas funcionales (4 mundos data-driven, sistema de sprites, plataformas móviles, cinemática de victoria, audio procedural) pero no se siente "pensado" — Facundo lo verbaliza como "pegado rápido".

El diagnóstico compartido es que el problema principal no es estética sino **progresión y sabor**: los 4 mundos por dentro se sienten iguales, ninguno descubre nada nuevo en jugabilidad, no hay arco. Decidimos rediseñar desde una visión unificada en lugar de seguir parchando.

Este spec captura la dirección acordada. Los planes detallados de implementación van después, uno por fase del roadmap.

## 2. Operación y contexto físico

- **Dispositivo primario**: laptop personal de Sofi. Teclado como input principal. Pantalla ≥1280×720.
- **Fallback**: mobile (iOS Chrome) sigue funcionando con touch controls — no es contexto primario pero no se rompe.
- **Operador**: Sofi acompañada por Papá o AT durante las primeras sesiones. Después puede jugar sola si lo decide.
- **Audio**: el silent switch de iOS deja de ser bug crítico (era laptop ≠ iOS). Igual mantenemos el fix porque mobile sigue siendo target secundario.

## 3. Visión

> **"Un día del Pollito en la granja."**
>
> El pollito recorre 4 lugares de la granja a lo largo de un día. La paleta, la luz y la música cambian con el sol: amanece en el Corral, mediodía en el Campo, tarde en el Estanque, atardecer en el Granero. Sofi elige el orden — no hay gating, pero el "día" sirve de marco emocional unificador.
>
> Cada mundo tiene su **mecánica firma** (saltar / planear / nadar / trepar) y su **paleta** propia. La granja "respira" según el calendario real: cambia con la estación, saluda en fechas especiales conocidas (cumple de Sofi 7/4, fechas patrias AR, navidad, primavera), y tiene un mini-evento del día generado por Groq, cacheado 24h, con fallback estático.

### Pilares no negociables

- Sin Game Over. Caídas = respawn al inicio del mundo.
- Sin presión temporal. Sin timers.
- Predictibilidad sobre sorpresa. Las sorpresas grandes son anunciadas con banner; las chiquitas son ambient sin texto.
- Un solo canal sensorial activo durante el desafío educativo (regla anti-sobrecarga del perfil de Sofi).
- Sofi elige el mundo, el orden y la mecánica. Sin progresión obligatoria.

## 4. Los 4 mundos

| # | Mundo | Momento | Mecánica firma | Desafío educativo | Enemigo amable | Música mood |
|---|---|---|---|---|---|---|
| 1 | 🐔 Corral | Amanecer | **Saltar** (base del platformer) | Conteo: juntar N huevos para abrir puerta | Zorro patrullando horizontal | Alegre, tempo medio |
| 2 | 🌾 Campo | Mediodía | **Planear** (mantener salto = capa) | Lengua: identificar sustantivos / verbos / adjetivos | Cuervos volando | Brisa, instrumentación abierta |
| 3 | 🦆 Estanque | Tarde | **Nadar** (gravedad reducida en agua) | Mate: sumas visuales con burbujas que forman puente | Ranas saltando en lirios | Pads largos, suave |
| 4 | 🏚️ Granero | Atardecer | **Trepar** (escaleras de heno verticales) | Naturales: clasificar animales / plantas / comidas | Ratones corriendo en plataformas | Cálida, reposada |

Reglas comunes a los 4 mundos:

- 1 huevo dorado oculto que premia exploración (+5 a stats, +1 al contador local)
- 1 enemigo amable acoplado a la mecánica firma (refuerza el "verbo" del mundo)
- 1 banderín / mecánica de cierre
- Sin timer, sin Game Over, sin texto sin pictograma cuando hay decisión educativa
- Una sola mecánica firma nueva que aprender en ese mundo

Cada enemigo refuerza la mecánica firma del mundo:
- **Zorro** (Corral): patrulla horizontal — el saltar encima lo duerme (introduce stomp como verbo)
- **Cuervo** (Campo): vuela en patrones — empuja del aire mientras planeás, fuerza a usar bien la mecánica firma
- **Rana** (Estanque): salta en lirios — si te toca dispara corriente que te empuja, requiere manejar nadar
- **Ratón** (Granero): corre en plataformas — si te toca en la escalera te suelta, requiere planificar trepar

Mecánica de daño común: sin Game Over. Si te toca el enemigo de costado, knockback suave + dropeás 1 huevo recolectado (que cae al piso y podés recoger de nuevo). Si saltás encima, el enemigo se duerme 3 segundos. Esta mecánica ya existe para el zorro; se generaliza.

## 5. Identidad visual

**Lenguaje único: flat vector con contornos negros finos.**

Características:
- Formas simples llenas de color sólido
- Contornos negros 1.2–1.4px en todo (personajes, decoración, plataformas)
- Paleta limitada por mundo, derivada de la estación × momento del día
- Sin gradientes complejos, sin texturas. Si hay sombreado es un color plano de la paleta
- Pictogramas ARASAAC se integran naturalmente (mismo lenguaje)

Por qué se elige este estilo:
- Coherente con ARASAAC (que es CC0 y usamos todo el tiempo en el tutor)
- Alto contraste y bordes claros → favorece el procesamiento visual de Sofi
- Escala bien de mobile a laptop sin pixelado
- Más rápido de dibujar que pixel art de buena calidad

Qué se rehace:
- Pollito (sale del pixel art actual, vuelve a vector)
- 8 animales (vaca, oveja, gallina, caballo, pato, cerdo, cabra, gato)
- 4 enemigos amables (zorro, cuervo, rana, ratón)
- Decoración por mundo (gallinero, trigo, juncos, heno, etc.)
- Parallax background (montañas, árboles, silos, molinos)

## 6. Audio

**Estructura en 4 capas**:

1. **Ambient bed** por mundo (siempre, suave, volumen 0.10): grillos + brisa (Corral), viento + pájaros (Campo), agua + ranas (Estanque), madera + animales (Granero).
2. **Tema melódico compuesto** (sparse, no continuo, volumen 0.15): 1 tema base de ~12 compases en C mayor, con 4 instrumentaciones distintas (1 por mundo, mismo tema). Aparece solo en momentos clave:
   - Intro al entrar al mundo (8 compases)
   - Encontrar huevo dorado (estribillo brillante)
   - Resolver desafío educativo (cierre satisfactorio)
   - Llegar al banderín (fanfarria corta)
3. **SFX expresivos** (volumen 0.35): movimiento (salto, planear whoosh, nadar chapuzón, trepar crujido), recolección (huevo normal, dorado), educación (acorde correcta, nota suave incorrecta), enemigos (pasos zorro, graznido cuervo, croa rana, chillido ratón), ambient triggers (muu, baa, cuac).
4. **Daily Flavor audio**: el animal del día suena más seguido en el ambient bed.

Implementación:
- Web Audio API procedural sigue siendo la base (cero archivos de audio pesados)
- El tema melódico es una secuencia de notas escrita a mano con velocity y articulación pensadas (no random como hoy)
- Ambient bed = capa ruido + pitched layers muy suaves loopeadas
- Volumen master default 0.4 (era 0.55)
- Mute toggle persistente, default muted

Por qué este enfoque vs. música continua: Sofi tiene menos canales superpuestos = menos sobrecarga sensorial. El silencio relativo hace que los momentos musicales destaquen, lo que refuerza positivamente el progreso.

## 7. Daily Flavor

El juego sabe qué día es y la granja "respira" en consecuencia.

### Componentes

```
┌────────────────────────────────────────────────────────────┐
│ Fecha del día                                              │
│   ├─ Estación (es-AR)         ← determinístico             │
│   ├─ Fecha especial conocida  ← tabla AR + cumple Sofi     │
│   └─ Animal + mini-evento     ← Groq con fallback estático │
└────────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────┐
│ Aplicación en el juego                                     │
│   ├─ Paleta del cielo (varía por estación × mundo)         │
│   ├─ Banner especial si la fecha es destacable             │
│   ├─ NPC central del animal del día (en su mundo natural)  │
│   ├─ Sonido del animal del día más frecuente en ambient    │
│   └─ Detalle visual mini-evento (1 de 5 tipos visuales)    │
└────────────────────────────────────────────────────────────┘
```

### Estaciones (es-AR, hemisferio sur)

| Mes | Estación |
|---|---|
| dic / ene / feb | Verano |
| mar / abr / may | Otoño |
| jun / jul / ago | Invierno |
| sep / oct / nov | Primavera |

Cada estación × mundo da una paleta de cielo distinta (16 combinaciones, todas pre-calculadas en código). La paleta de Corral en invierno es distinta a la del Corral en verano.

### Tabla de fechas especiales

| Fecha | Cómo aparece | Banner |
|---|---|---|
| 07-04 (cumple Sofi) | Globos en Corral + cake decorativo + huevo cumpleañero brillante | "¡Feliz cumple, Sofi!" |
| 25-05 / 09-07 / 17-06 / 20-06 / 17-08 / 12-10 / 20-11 | Escarapela en el banderín | "Hoy es {fecha patria}" |
| 21-09 (primavera) | Flores extra en Campo + mariposas extra | "Empezó la primavera" |
| Día del Niño (3er domingo de agosto) | Huevo dorado extra en el Corral | "Hoy es el Día del Niño" |
| 25-12 | Árbol decorado en Granero + nieve estilizada en techos | "Feliz Navidad" |
| 01-01 | Fuegos artificiales suaves en el cielo del Granero | "Feliz año nuevo" |
| 06-01 (Reyes) | Sorpresita de huevo extra en el Campo | banner suave |

Fechas como 24-03 (Memoria) y 02-04 (Malvinas) no se decoran: el juego es recreación, no contexto político.

El cumple de Sofi va hardcodeado en config inicial. Input editable en `/admin.html` queda como mejora futura.

### Animal del día

Pool: vaca / oveja / gallina / caballo / pato / cerdo / cabra (7 opciones). Lo elige Groq. Aparece como NPC central en su mundo natural (la vaca en Corral, el pato en Estanque, etc.).

### Mini-evento

Frase corta literal del LLM mapeada a 1 de 5 tipos visuales que el código sabe renderizar:

| Tipo | Renderizado |
|---|---|
| `npc-pollito` | Un pollito amigo extra en mundo X |
| `egg-color` | Un huevo de color especial entre los normales del mundo X |
| `hat-on-animal` | Sombrero / accesorio sobre animal Y del mundo X |
| `extra-flower` | Flores extra en zona del mundo X |
| `rainbow-cloud` | Nube de colores en el cielo del mundo X |

El LLM elige tipo + mundo + texto de 1 frase (≤12 palabras, voseo, literal). El código renderiza según el tipo.

### Prompt Groq (boceto)

```
SYSTEM: Sos un generador de mini-eventos diarios para "Aventura del Pollito",
un juego de granja para Sofi (10-12 años, autista).
Reglas: voseo argentino. Frases literales ≤12 palabras. Sin metáforas. Sin
presión temporal ("rápido", "ya"). Tono cálido ambient. JSON estricto.

USER: Hoy es {date} ({dayOfWeek}), estación {season}.
{if specialEvent: Hoy es {specialEvent.name}.}
Generá:
{
  "animalOfDay": "<vaca|oveja|gallina|caballo|pato|cerdo|cabra>",
  "miniEvent": {
    "type": "<npc-pollito|egg-color|hat-on-animal|extra-flower|rainbow-cloud>",
    "world": "<corral|campo|estanque|granero>",
    "text": "<frase ≤12 palabras>"
  }
}
```

### Caches y fallback

- Backend in-memory cache por `date` (clave: `YYYY-MM-DD`), expira a medianoche AR.
- Frontend localStorage `pollito_daily_${YYYYMMDD}` sobrevive recargas.
- Si Groq falla o tarda >3s, fallback estático: pool hardcoded de ~20 mini-eventos pre-escritos rotando por día-del-año.

## 8. Integración con el tutor

**Decisión: game y tutor quedan separados conceptualmente**. Sofi no necesita "pasar" del tutor al juego o viceversa. Son contextos distintos: tutor es trabajo guiado, juego es recreación libre.

Comparten sin embargo:
- **Mismas reglas de contenido**: anti-sobrecarga, ≤12 palabras, voseo, sin infantilizar, sin presión temporal (`.claude/skills/sofi-content-rules/`).
- **Mismos pictogramas ARASAAC**: IDs validados centralizados en `src/server/services/phrase-tokenizer.ts`.
- **Mismas materias** en los desafíos educativos del juego (refresh, no enseñar nuevo).

El contenido educativo in-game es un pool hardcoded de 4 desafíos por mundo (rotación aleatoria por sesión). No depende del Groq ni de qué hizo Sofi en el tutor esta semana. Mejora futura: que el pool del juego refresque el topic que vio en el tutor recientemente. No MVP.

## 9. Arquitectura técnica

### Frontend (sin cambios estructurales)

- `public/juegos/pollito.html` (existe)
- `public/js/juego-pollito.js` (existe — rewrite del rendering layer y de la level data)
- `public/js/juego-pollito-sprites.js` (existe — rewrite con vector flat, no pixel art)
- `public/js/juego-pollito-audio.js` (existe — extender con ambient bed + tema melódico)
- **NUEVO**: `public/js/juego-pollito-flavor.js` — fetch del daily flavor, cache local, aplicación al render

### Backend

- **NUEVO**: `src/server/services/daily-flavor.ts` — orquesta Groq + cache + fallback
- **NUEVO**: `src/server/services/special-dates-ar.ts` — tabla deterministica + cumple de Sofi
- **MODIFICADO**: `src/server/routes/sofi.routes.ts` — agregar `GET /api/sofi/daily-flavor?date=YYYY-MM-DD`

### Tests

- **NUEVO**: `tests/daily-flavor.test.ts` — tests deterministicos (estación, fecha especial), mock de Groq, validación JSON, fallback
- **NUEVO**: `tests/special-dates.test.ts` — verifica cada fecha del calendario
- Tests existentes del game se ajustan según rewrite

### Performance

- Daily Flavor: 1 request al cargar el juego (cacheado), no afecta el loop de render.
- Vector flat con contornos en lugar de pixel art: similar o menor costo de render.
- Tema melódico sparse + ambient bed: menos Web Audio scheduling continuo que hoy.

## 10. Qué se reemplaza vs qué se mantiene

### Se mantiene

- Motor Fastify + Postgres + vanilla JS + Web Audio API
- Sistema de mundos data-driven (`WORLDS[]`)
- ARASAAC pictograms hotlinked + IDs validados centralizados
- Sistema Sofi cookie + auth + persistencia
- Splash + selector + pausa + stats acumulados
- Cinemática de victoria, huevo dorado, plataformas móviles
- Aspect ratio + high-DPI canvas

### Se reemplaza

- Pixel art del pollito → vector flat
- Layouts de los 4 mundos → rediseño con mecánica firma + zonas
- Música procedural continua → ambient bed + tema sparse compuesto

### Se agrega

- 3 mecánicas firma nuevas (planear, nadar, trepar)
- 3 enemigos amables nuevos (cuervo, rana, ratón)
- Daily Flavor end-to-end (backend + frontend + Groq + cache + fallback)
- Tabla de fechas especiales AR + cumple de Sofi
- 5 tipos visuales de mini-eventos
- Vector flat de 8 animales + decoración + parallax + 4 enemigos
- Ambient bed por mundo + tema melódico compuesto

## 11. Roadmap por fases

Cada fase es un mini-proyecto con su propio plan de implementación (escrito con writing-plans skill al momento de empezar).

| Fase | Alcance | Por qué primero |
|---|---|---|
| **F1** Foundation | Daily Flavor backend (endpoint + Groq + fallback + tabla fechas + cache) + cliente con palette. Sin tocar gameplay. | Habilita la sensación "la granja respira con la fecha" desde el día 1. Es el corazón de la visión. |
| **F2** Visual reboot | Pollito + 8 animales + decoración + parallax en vector flat. Sin tocar gameplay. | Unifica el look antes de tocar mecánicas — evita rehacer assets dos veces. |
| **F3** Corral redesign | Layout nuevo + zorro mejorado + huevo dorado oculto + tutorial implícito de salto (sin texto, sólo diseño de plataformas). | Es el mundo de intro, debe ser perfecto. |
| **F4** Campo + planear | Mecánica planear + cuervos + quiz lengua. | Primera mecánica firma nueva. |
| **F5** Estanque + nadar | Mecánica nadar + ranas + quiz mate visual con burbujas. | Mecánica más distintiva, más trabajo. |
| **F6** Granero + trepar | Mecánica trepar + ratones + quiz naturales. | Último mundo, refina patrones aprendidos. |
| **F7** Audio reboot | Ambient bed por mundo + tema melódico compuesto + mezcla. | Después de gameplay porque depende de los eventos. |
| **F8** Cierre | Tests, validación con terapeutas (fono, psicoped, TO, psicomot), pulido final. | Validación clínica antes de cerrar el rediseño. |

Cada fase abre PR propio. La fase F1 puede arrancar inmediatamente; el resto secuencial.

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Groq cae / tarda / cambia API | Fallback estático con pool de 20 mini-eventos. Cache backend para no llamar por usuario. |
| El vector flat se ve "barato" si se hace apurado | F2 (visual reboot) debe pasar por los terapeutas antes de cerrar. |
| La mecánica "nadar" es difícil de aprender intuitivamente | Tutorial implícito al entrar al Estanque (cartel ARASAAC primer pantalla + animación). |
| Sofi se confunde con 4 verbos distintos por mundo | Cada mundo enseña UNO al entrar. No hay otros verbos transferidos entre mundos. |
| Daily Flavor cambia visualmente algo que Sofi necesita predecir | Las variaciones grandes son anunciadas con banner explícito. Las chiquitas son ambient sin texto. |
| El tema melódico compuesto es trabajo creativo, no automático | F7 se mete al final cuando hay tiempo y referencia clara. |
