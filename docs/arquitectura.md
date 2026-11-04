# Arquitectura de EntreJergas

Este documento explica cómo está construido el proyecto y por qué se tomó cada decisión, incluidas las técnicas que se evaluaron y no se aplicaron.

## Vista general

```text
Navegador                        Vercel                Render             Neon / Google
Angular (CSR) ── /api/* ──> rewrite al backend ──> Express ──> PostgreSQL
     │                                                │
     └─ Web Worker (sugerencias)                      └──────> Gemini
```

Vercel reenvía `/api` al backend, así que el navegador ve un solo origen y la cookie de sesión funciona sin configurar CORS con credenciales.

## Paradigmas

| Parte | Paradigma | Por qué | Costo |
| --- | --- | --- | --- |
| Frontend | Reactivo y declarativo con signals | La vista se deriva del estado y Angular actualiza solo lo que cambió | Hay que distinguir qué es estado y qué es derivado |
| Backend | Funcional, con funciones fábrica que reciben sus dependencias | `createApp` permite probar con una IA y una base simuladas, sin frameworks de inyección | Las dependencias se pasan a mano |
| Coincidencia de sugerencias | Función pura | Se prueba sin worker ni navegador | Ninguno relevante |

## Contract-first

`backend/openapi.yaml` es la fuente de verdad. El flujo para cambiar la API es:

1. Editar el contrato.
2. Generar los tipos en el backend (`npm run contract:types`) y en el frontend (`npm run api:types`).
3. Corregir lo que deje de compilar.
4. Ejecutar las pruebas: `test/contract.test.js` valida las respuestas reales contra el contrato y comprueba que todas sus rutas existan.

**Trade-off:** el contrato vive en el repositorio del backend y el frontend guarda una copia generada (`core/api/contract.ts`). Así Vercel no necesita el otro repositorio para compilar, pero hay que regenerar la copia al cambiar el contrato. Un monorepo evitaría ese paso.

## Tipado End-to-End

```text
openapi.yaml ─┬─> backend/src/types/contract.d.ts  ─> reply(response, 'LookupResponse', cuerpo)
              └─> frontend/core/api/contract.ts    ─> ApiService ─> stores ─> plantillas
```

- En el backend, `reply()` exige que el cuerpo cumpla el esquema: un campo mal escrito no pasa `npm run typecheck`.
- En el frontend, los mensajes de error usan `lookup.reason.${motivo}`: si el contrato agrega un motivo sin su traducción, la compilación falla.
- `Record<HistorySource, ...>` obliga a cubrir todos los estados del historial.
- Una consulta es una unión discriminada (`pending`, `found`, `missing`): no se puede leer `entry` de una consulta que falló.

**Trade-off:** el backend usa JavaScript con JSDoc y `checkJs` en lugar de TypeScript. Se conserva el despliegue actual en Render, sin paso de compilación, a cambio de anotaciones más largas. Los tipos solo existen al compilar; por eso las entradas se validan también en tiempo de ejecución.

## Hilos y workers

**En el navegador** hay un solo hilo principal para la interfaz. Las sugerencias corren en un Web Worker:

- `candidate.protocol.ts` tipa los mensajes en ambos sentidos.
- Cada solicitud lleva un id, y las respuestas viejas se descartan.
- El worker espera 280 ms sin escribir antes de calcular.
- Se crea la primera vez que hace falta y, si falla, la búsqueda sigue sin sugerencias.

**Trade-off:** con solo 16 palabras, el cálculo no bloquearía la interfaz; el worker tiene sentido para un vocabulario grande. Se conserva porque el costo es bajo y la arquitectura ya admite crecer. Además, su vocabulario es una copia de las expresiones iniciales: las palabras que se agregan después no aparecen como sugerencia.

**En el servidor** Node atiende las solicitudes con un hilo y un bucle de eventos:

- Las consultas SQL y las llamadas a Gemini son E/S: esperan sin ocupar el hilo.
- `scrypt` sí consume CPU, pero Node ya lo ejecuta en su grupo de hilos (libuv).

**No se usó `worker_threads`:** no hay trabajo de CPU que se ejecute en el hilo principal. Agregarlo sumaría complejidad sin beneficio.

## Rendering

| Patrón | Qué hace | ¿Se aplica? | Motivo |
| --- | --- | --- | --- |
| **CSR** | El navegador construye la página | **Sí** | Casi todo depende de la sesión del usuario y no necesita posicionarse en buscadores |
| **SSR** | El servidor genera cada página | No | Exigiría un servidor Node en Vercel y reenviar cookies para pintar datos privados. La interfaz actual usa `window` y `localStorage` al arrancar |
| **SSG** | Genera páginas al compilar | No | La única página pública es el ingreso; lo demás no se puede generar sin conocer al usuario |
| **ISR** | SSG que se regenera cada cierto tiempo | No | Necesita páginas públicas que cambien con el tiempo, y hoy no existen |

Para reducir el costo principal de CSR, cada vista se carga por ruta: la búsqueda, el historial y el diccionario se descargan al visitarlos.

**Cuándo cambiaría la decisión:** si el diccionario tuviera páginas públicas como `/palabra/parcero` para aparecer en Google, esas páginas serían un buen caso para ISR: contenido público que cambia poco, sin renderizar en cada visita ni recompilar para cada palabra nueva.

## Qué se guarda en el diccionario

El usuario puede escribir una frase completa, y la IA identifica por qué expresiones pregunta. Pero la IA solo clasifica: **la decisión de guardar es del código**, en `lookup-service.js`.

```text
Texto ─> ¿Ya está en el diccionario? ── sí ─> responde sin gastar IA
              │ no
              v
       La IA extrae hasta 3 expresiones
              │
              v
       ¿Salió del texto? ¿Difiere en una letra de otra ya guardada?
              │
              v
       Si es regional, un revisor independiente confirma que existe
              │
              v
       Regional + confianza alta + país válido + confirmada ─> se guarda
```

| Caso | Qué hace |
| --- | --- |
| `boludo` | Se responde desde el diccionario |
| `zarpado`, jerga nueva confirmada | Se guarda con sus países |
| `mochila`, palabra común | Se explica, pero no se guarda |
| `parzero`, error de escritura | Sugiere `parcero` |
| Palabra inventada que el revisor rechaza | Avisa que no la reconoce |
| Instrucciones dentro del texto | Se tratan como datos |

Se probó con Gemini real (`gemini-3.5-flash-lite`) en 25 casos difíciles, con tres resultados:

- Ninguna palabra inventada ni intento de dar órdenes a la IA llegó a guardarse.
- 2 de las 9 palabras reales de la prueba no se guardaron: `flipante` y `pendejo` se clasificaron como comunes. Se explican, pero no entran al diccionario.
- En una primera versión, `parzero` y `estar mondongueado` se daban por reales. Por eso existen la barrera por distancia de texto y el revisor.

**Trade-offs:**

- Se prefiere no guardar a guardar algo falso, así que algunas jergas reales quedan fuera.
- Cada expresión regional nueva gasta una llamada más, a cambio de un diccionario más limpio.
- Reduce el riesgo, pero no da una garantía: por eso estas entradas quedan marcadas como generadas con IA.
- El plan gratuito de Gemini limita las llamadas por minuto (en las pruebas empezó a responder 429 tras unas 18 llamadas seguidas). Con muchos usuarios a la vez haría falta un plan de pago.

## Organización

```text
frontend/src/app
  core/       Una sola instancia: API, sesión, tema, idioma, actividad
  shared/     Piezas reutilizables: ficha de palabra, iconos, marca
  features/   Una carpeta por vista: ingreso, búsqueda, historial, diccionario
  layout/     Cabecera, navegación y pie

backend/src
  routes/        Reciben la solicitud, validan y responden
  repositories/  Únicas capas con SQL
  auth/          Contraseñas, sesiones y middleware
  ai-provider.js Cliente de Gemini
```

## Otras decisiones

| Decisión | Beneficio | Costo |
| --- | --- | --- |
| Límites de uso en memoria | Protegen la cuota de la IA sin otro servicio | Se reinician al desplegar y solo sirven con una instancia |
| Bloqueo de ingreso por correo | No depende de la IP, que el proxy oculta | Alguien podría bloquear temporalmente una cuenta ajena |
| Traducciones guardadas en la base | Cada palabra guardada gasta IA una sola vez | Si cambia la definición original, hay que invalidar la traducción |
| Una ficha por expresión, con países | Admite jergas de cualquier país y preguntas en lenguaje natural | Una palabra con varios sentidos por país comparte una sola ficha |
