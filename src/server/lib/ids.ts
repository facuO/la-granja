import { nanoid } from "nanoid";
import { randomUUID, randomInt } from "crypto";

export const uuid = (): string => randomUUID();

// Magic links for adults: high-entropy random token (signed cookie protects
// the session afterwards, but the token itself shouldn't be guessable).
export const shortToken = (): string => nanoid(32);

// Sofi's device tokens are typed/dictated by an adult once per device, so
// readability matters. 4 simple Spanish words joined by dashes give a
// memorable URL like "/s/mapa-luna-gato-sol" while still providing enough
// entropy with the wordlist size.
const SOFI_WORDS = [
  // nature
  "mapa", "luna", "sol", "mar", "rio", "isla", "monte", "lago", "cielo", "nube",
  "playa", "bosque", "campo", "valle", "rayo", "estrella",
  // animals
  "gato", "perro", "oso", "pez", "pato", "vaca", "oveja", "buho", "mono",
  "leon", "zorro", "tigre", "lobo", "rana", "abeja", "ardilla", "ciervo",
  // objects
  "silla", "mesa", "plato", "libro", "lapiz", "casa", "plaza", "llave", "pelota",
  "puente", "torre", "bote", "tren", "tractor", "globo", "carta", "reloj",
  // food
  "pan", "queso", "leche", "agua", "manzana", "banana", "papa", "tomate", "uva",
  "miel", "torta", "limon", "pera", "frutilla",
  // colors
  "rojo", "azul", "verde", "lila", "rosa", "gris", "blanco", "amarillo", "naranja",
  // misc
  "viento", "musica", "puerta", "ventana", "flor", "hoja", "rama", "piedra",
];

export const sofiToken = (): string => {
  const picks: string[] = [];
  for (let i = 0; i < 4; i++) {
    picks.push(SOFI_WORDS[randomInt(0, SOFI_WORDS.length)]);
  }
  return picks.join("-");
};
