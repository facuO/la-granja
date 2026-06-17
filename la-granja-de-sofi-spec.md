# La granja de Sofi

Plataforma web de estimulación cognitiva diaria para Sofi (10-12 años), con catálogo de juegos mapeado a las 4 áreas terapéuticas que ella trabaja: **fonoaudiología, psicopedagogía, psicomotricidad, terapia ocupacional**.

> **Disclaimer**: La app es un complemento lúdico, no reemplaza la terapia profesional. Las métricas son descriptivas (no diagnósticas) y están pensadas para acompañar la conversación con las terapeutas.

---

## 1. Contexto de uso

- **Usuaria**: Sofi, 10-12 años.
- **Modo**: sesiones cortas guiadas (~10-15 min), idealmente diarias.
- **Dispositivo**: laptop vieja, sin táctil, con internet, mic interno funcional.
- **Stack target**: Vite + React + TypeScript + Tailwind. Nada pesado (no Three.js, no framer-motion). Animaciones con CSS puro.
- **Voz**: Web Speech API (`lang: 'es-AR'`).
- **Persistencia**: localStorage, con schema pensado para migrar a Supabase en Phase 3.

---

## 2. Diseño y onda

- **Tema**: la granja de Sofi. Mascotas: pollitos.
- **Paleta**: amarillos cálidos, verdes campo, terracota, blanco crema. Tipo campo cordobés.
- **Tono visual**: lúdico sin infantilizar (Sofi tiene 10-12, no es nena chica).
- **Animaciones**: suaves, CSS transforms/transitions. Pollitos que rebotan, huevos que vibran antes de eclosionar.
- **Sonido**: discreto. "Pío" cortito al acertar, cacareo al completar sesión.

---

## 3. Catálogo de juegos — Phase 1 (11 juegos)

Cada juego tiene **uno o más tags terapéuticos**. Los solapamientos son legítimos (un juego puede trabajar lenguaje *y* memoria, por ejemplo).

### Fonoaudiología

| ID | Nombre | Mecánica | Tags |
|---|---|---|---|
| `palabras-al-vuelo` | Palabras al vuelo | Decir N palabras que empiecen con una letra en X segundos. Mic + diccionario español. | fono |
| `categorias` | Categorías | "Decí 5 animales de granja / frutas / colores". Mic. | fono, psicoped |
| `trabalenguas` | Trabalenguas | Repetir un trabalenguas. Se graba audio, ella lo escucha de vuelta. | fono |

### Psicopedagogía

| ID | Nombre | Mecánica | Tags |
|---|---|---|---|
| `n-back` | Memoria activa | Pollitos de colores en secuencia. "¿Igual al de hace 2?" → Espacio. | psicoped |
| `stop-go` | Stop & Go | Atrapar pollitos con Espacio, frenar cuando aparece un zorro. | psicoped |
| `memoria-pares` | Memoria de pares | Cartas dadas vuelta, encontrar pares. | psicoped |

### Psicomotricidad

| ID | Nombre | Mecánica | Tags |
|---|---|---|---|
| `atrapa-pollitos` | Atrapa-pollitos | Pollitos a izq o der, mano izq usa `F`, mano der usa `J`. | psicomot |
| `cruzados` | Cruzados | Estímulo a la derecha → tecla izquierda (y viceversa). Cuerpo calloso. | psicomot |
| `ritmo` | Ritmo | Seguir un patrón temporal con teclas (estilo Guitar Hero simple). | psicomot, psicoped |

### Terapia Ocupacional

| ID | Nombre | Mecánica | Tags |
|---|---|---|---|
| `trazado-preciso` | Trazado preciso | Seguir una línea con el mouse sin salirse. Mide error de trayectoria. | to |
| `clicks-precisos` | Clicks precisos | Blancos chicos que aparecen y se mueven. Tiempo + precisión. | to |

**Distribución por área**: fono 3 / psicoped 3 (+2 compartidos) / psicomot 3 / to 2 = balance razonable.

---

## 4. Arquitectura de juegos (interfaz común)

```ts
// src/games/types.ts
export type TherapyArea = 'fono' | 'psicoped' | 'psicomot' | 'to';

export interface GameMetrics {
  accuracy?: number;          // 0-1
  avgReactionMs?: number;
  errors?: { omission: number; commission: number };
  level?: number;
  durationSec: number;
  raw?: Record<string, unknown>;  // datos crudos del juego
}

export interface GameModule {
  id: string;
  name: string;
  description: string;
  areas: TherapyArea[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedSec: number;
  component: React.ComponentType<GameProps>;
}

export interface GameProps {
  difficulty: number;
  onFinish: (metrics: GameMetrics) => void;
  onAbort: () => void;
}
```

Cada juego vive en `src/games/<id>/` con su propio componente, lógica y constantes. Se registran en `src/games/index.ts`:

```ts
export const gameRegistry: GameModule[] = [
  palabrasAlVuelo,
  categorias,
  trabalenguas,
  nBack,
  stopGo,
  memoriaParesGame,
  atrapaPollitos,
  cruzados,
  ritmo,
  trazadoPreciso,
  clicksPrecisos,
];
```

Agregar un juego nuevo = crear su carpeta + sumarlo al registry. **No se toca el core.**

---

## 5. Modelo de datos (localStorage, vía Zustand persist)

```ts
// src/metrics/schema.ts

export interface GameSession {
  id: string;                  // uuid
  date: string;                // ISO datetime
  gameId: string;
  difficulty: number;
  metrics: GameMetrics;
}

export interface DailySummary {
  date: string;                // YYYY-MM-DD
  sessionIds: string[];
  totalMinutes: number;
  areaScores: Record<TherapyArea, number>;  // 0-100
  eggsEarned: number;
}

export interface Pollito {
  id: string;
  name: string;
  color: 'amarillo' | 'marron' | 'blanco' | 'negro';
  birthDate: string;
  stage: 'huevo' | 'pollito' | 'gallina' | 'gallo';
}

export interface CorralState {
  eggs: number;                // huevos sin eclosionar
  pollitos: Pollito[];
  streak: number;              // días consecutivos
  longestStreak: number;
  lastSessionDate: string | null;
}

export interface AppState {
  sessions: GameSession[];
  dailySummaries: DailySummary[];
  corral: CorralState;
  settings: { soundEnabled: boolean; sofiAvatar?: string };
}
```

**Cálculo de `areaScores` por día**: para cada área, promedio ponderado del `accuracy` y `(1 - reactionTime normalizado)` de los juegos jugados ese día con ese tag. Si un juego tiene múltiples tags, contribuye a cada área.

**Schema versionado** (`schemaVersion: 1`) para que las migraciones futuras a Supabase no rompan datos viejos.

---

## 6. Sistema del corral (gamificación)

| Acción | Recompensa |
|---|---|
| Completar 1 juego | +1 grano de maíz (animación) |
| Completar sesión diaria | +1 huevo |
| 5 huevos acumulados | Eclosiona pollito (Sofi le pone nombre) |
| 10 sesiones con un pollito | Crece a gallina |
| Racha 7 días | Logro "Gallina madrugadora" |
| Racha rota | La gallina "se va a dormir" (no se muere). Vuelve la próxima sesión. |

Los pollitos aparecen visualmente en el "corral" (pantalla home), caminando, picoteando. Cuantos más, más vivo se ve el corral.

---

## 7. Pantallas

```
Home (corral)
├── "Empezar sesión del día" (CTA principal)
├── "Elegir juego suelto" → Catálogo
├── "Ver mi progreso" → Dashboard Sofi
└── "👨‍🌾 Vista papá" (esquina inferior) → Dashboard Papá

Sesión del día
├── Intro: "Hoy vamos a jugar 4 juegos. ¿Lista?"
├── Juego 1 → resultado breve → Juego 2 → ... → Juego 4
└── Cierre: huevo conseguido, animación, "¡Mañana más!"

Catálogo
└── Grid con todos los juegos, agrupados por área. Click → jugar.

Dashboard Sofi
├── Mi corral (cantidad de pollitos, racha)
├── Resumen del día (minutos, áreas trabajadas)
└── Logros desbloqueados

Dashboard Papá (abierto, sin protección)
├── Gráficos de línea: score por área (7/30/90 días)
├── Tabla: juegos jugados / no jugados / tiempo dedicado
├── Tendencias: "esta semana +X% en memoria de trabajo"
└── Export JSON/CSV
```

---

## 8. Sesión del día — armado automático

El selector toma 4 juegos del catálogo garantizando:
- Al menos 1 juego de cada área (rotando)
- No repetir el mismo juego dos días seguidos si es posible
- Dificultad sugerida = nivel actual de Sofi en ese juego (basado en últimas 3 sesiones)

---

## 9. Estructura de carpetas

```
la-granja-de-sofi/
├── public/
│   ├── diccionario-es.json       # ~500KB, palabras comunes en español
│   └── sounds/                    # pio.mp3, cacareo.mp3, etc.
├── src/
│   ├── main.tsx
│   ├── App.tsx                    # router
│   ├── routes/
│   │   ├── Home.tsx
│   │   ├── Session.tsx
│   │   ├── Catalog.tsx
│   │   ├── SofiDashboard.tsx
│   │   └── PapaDashboard.tsx
│   ├── games/
│   │   ├── index.ts               # gameRegistry
│   │   ├── types.ts
│   │   ├── palabras-al-vuelo/
│   │   ├── categorias/
│   │   ├── trabalenguas/
│   │   ├── n-back/
│   │   ├── stop-go/
│   │   ├── memoria-pares/
│   │   ├── atrapa-pollitos/
│   │   ├── cruzados/
│   │   ├── ritmo/
│   │   ├── trazado-preciso/
│   │   └── clicks-precisos/
│   ├── corral/
│   │   ├── store.ts               # Zustand store del corral
│   │   ├── Corral.tsx             # vista del corral animado
│   │   └── pollito-names.ts       # sugerencias de nombres
│   ├── metrics/
│   │   ├── store.ts               # Zustand persist
│   │   ├── schema.ts
│   │   └── compute.ts             # cálculo de areaScores, tendencias
│   ├── voice/
│   │   ├── useSpeechRecognition.ts
│   │   └── useDictionary.ts
│   ├── ui/                        # componentes base
│   ├── lib/
│   │   ├── tags.ts
│   │   └── session-builder.ts     # arma la sesión del día
│   └── styles/
│       └── globals.css            # Tailwind + paleta de granja
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

---

## 10. Prompt para inicializar con Claude Code

Pegá esto en tu terminal después de `claude` en la carpeta donde quieras crear el proyecto:

````
Vamos a construir "La granja de Sofi", una web app de estimulación cognitiva
diaria para mi hija Sofi (10-12 años). Trabaja 4 áreas terapéuticas:
fonoaudiología, psicopedagogía, psicomotricidad y terapia ocupacional.

Stack:
- Vite + React + TypeScript
- Tailwind CSS (paleta cálida de granja: amarillos, verdes, terracota)
- Zustand con persist middleware para estado + localStorage
- React Router para navegación
- Web Speech API para reconocimiento de voz (lang: es-AR)
- Sin backend en esta fase. Schema preparado para migrar a Supabase después.

Restricciones de performance (corre en laptop vieja):
- Nada de Three.js, framer-motion, ni librerías pesadas
- Animaciones con CSS puro (transitions/transforms)
- Canvas 2D solo donde sea necesario (trazado-preciso)
- Bundle inicial liviano

Phase 1 incluye 11 juegos (ver lista abajo) + dashboards + sistema de corral.

Empezá creando:
1. El esqueleto del proyecto con Vite + React + TS + Tailwind
2. La estructura de carpetas según el plan
3. La interfaz GameModule en src/games/types.ts
4. El store de Zustand con persist en src/metrics/store.ts
5. El store del corral en src/corral/store.ts
6. Router con rutas: /, /session, /catalog, /sofi, /papa
7. Paleta Tailwind custom: granja-amarillo, granja-verde, granja-terracota,
   granja-crema. Tipografía: una sans rounded amigable (Quicksand o Nunito).
8. Componente Pollito reutilizable (SVG inline, animaciones CSS)
9. Home con el corral animado

Después seguimos juego por juego, en este orden:
  1. atrapa-pollitos (el más simple, valida bimanualidad)
  2. memoria-pares (clásico, valida loop de métricas)
  3. palabras-al-vuelo (valida flujo de voz)
  4. n-back, stop-go, cruzados, ritmo, categorias, trabalenguas,
     trazado-preciso, clicks-precisos

Cada juego implementa la interfaz GameModule y reporta métricas
(accuracy, avgReactionMs, errors, level, durationSec) al onFinish.

Catálogo completo de los 11 juegos y modelo de datos detallado:
[acá pegá las secciones 3, 4 y 5 de este spec]

Importante:
- Tono lúdico pero no infantil (Sofi tiene 10-12, no es nena chica)
- Dashboard papá es ABIERTO (sin PIN), accesible desde un botón discreto
  en home
- Disclaimer "esto no reemplaza la terapia" visible en el dashboard papá
- Versioná el schema (schemaVersion: 1) por si migramos a Supabase

Arrancá por el punto 1. Mostrame qué decisiones tomás y por qué antes
de escribir mucho código.
````

---

## 11. Roadmap

| Phase | Alcance |
|---|---|
| **1** (esta) | Esqueleto + 11 juegos + corral + dashboards + métricas localStorage |
| **2** | Dificultad adaptativa, skins del corral, +10 juegos del catálogo extendido |
| **3** | Backend Supabase opcional + acceso desde celular + export para terapeutas |

---

## 12. Catálogo extendido (Phase 2, no implementar ahora)

Fono: rimas, pares mínimos, adivinanzas.
Psicoped: Stroop, secuencias lógicas, categorización con regla cambiante, mini-cuento con preguntas, operaciones al vuelo.
Psicomot: espejo en teclado, doble tarea, lazy 8 con mouse.
TO: conectar puntos, drag & drop preciso.
