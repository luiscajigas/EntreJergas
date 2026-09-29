# EntreJergas

Beta académica de **Jerga Contextual**: un chat para explorar expresiones regionales. El backend consulta primero PostgreSQL; en esta etapa no hay integración con IA ni generación automática de definiciones.

## Requisitos

- Node.js 20.19+ (recomendado: Node 22 o 24) y npm.
- Para dictado, navegador compatible con Web Speech API y permiso de micrófono. En producción el navegador requiere HTTPS.

## Ejecutar en desarrollo

Desde la raíz del repositorio:

```sh
npm install
```

Edita `backend/.env` y configura `DATABASE_URL` para tu PostgreSQL local. Después ejecuta desde la raíz:

```sh
npm run dev
```

Abre `http://localhost:4200`. Angular sirve la interfaz y reenvía `/api` a Express en `http://localhost:3000`. El backend crea las tablas e inserta las expresiones de ejemplo de manera idempotente al arrancar. Para correr solo el servidor: `npm run dev:api`.

## Vistas y flujo

- Escribe una expresión, selecciónala entre las sugerencias mientras aparece en el editor o envíala con Enter/botón.
- El dictado usa Web Speech API del navegador; no se sube audio al servidor. Algunos navegadores no implementan esta API.
- El Worker recibe las ediciones, espera 280 ms y busca candidatos en un vocabulario pequeño fuera del hilo principal. No hace llamadas de red ni sustituye la búsqueda autoritativa de la API.
- El servidor normaliza la expresión y consulta primero PostgreSQL. Una coincidencia responde con definición, región, contexto, equivalente y ejemplo; si no existe, responde `found: false`. No hay llamada de IA ni se inventan definiciones.
- La interfaz guarda localmente las definiciones consultadas para poder mostrarlas si se pierde la conexión. El historial y las métricas requieren la API; las consultas sin conexión no se sincronizan posteriormente.

## Contrato REST

Todas las rutas se sirven bajo `/api`. Las respuestas usan JSON.

| Método y ruta    | Solicitud                     | Respuesta                                                                                                                                                                                                    |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`    | Sin cuerpo                    | `{ "status": "ok", "service": "entrejergas-api" }`                                                                                                                                                           |
| `POST /lookup`   | `{ "expression": "parcero" }` | `{ "found": true, "entry": { "id", "expression", "meaning", "region", "context", "equivalent", "example", "pronunciation", "audioUrl", "source" } }` o `{ "found": false, "entry": null, "message": "..." }` |
| `GET /history`   | Sin cuerpo                    | `{ "items": [{ "id", "expression", "found", "createdAt" }] }` (máximo 30)                                                                                                                                    |
| `GET /dashboard` | Sin cuerpo                    | `{ "expressions": 16, "searches": 0, "regions": [{ "region", "count" }] }`                                                                                                                                   |

`POST /lookup` devuelve HTTP 400 si falta la expresión o tiene más de 100 caracteres. Tanto las coincidencias como las búsquedas sin coincidencia se guardan en historial. Se ignoran tildes y mayúsculas al comparar expresiones.

## Arquitectura y rendimiento

Angular renderiza como SPA del lado del cliente: el navegador dibuja la aplicación y el Worker procesa la detección; Express y PostgreSQL viven del lado servidor y mantienen la fuente de verdad. El límite cliente-servidor es `/api`, con DTOs tipados en `frontend/src/app/api.service.ts`.

Para observar la reactividad, escribe una frase larga y comprueba que el cursor y la entrada siguen respondiendo mientras el Worker espera y busca; en DevTools, el Worker aparece como hilo separado. El bundle de producción mantiene el Worker en un chunk separado. El debounce reduce trabajo repetido durante la escritura.

La red solo se usa al enviar una consulta o cargar historial/métricas; no se envía cada pulsación. El navegador conserva las entradas consultadas en `localStorage`. `pg.Pool` mantiene conexiones limitadas y reutilizables para consultas simultáneas; PostgreSQL administra concurrencia y persistencia fuera del proceso Node.

## Entornos

`backend/.env` es solo para desarrollo local y está excluido de Git. En Render crea una base de datos PostgreSQL y un servicio web desde `backend/` (o usa `backend/render.yaml` como blueprint). Configura `DATABASE_URL` con la **Internal Database URL** de Render y `CORS_ORIGIN` con el dominio de Vercel en el panel de Render. Render proporciona `PORT`; `NODE_ENV=production` activa SSL hacia PostgreSQL. La conexión externa se usa para pgAdmin desde tu computador; el hostname interno solo funciona desde Render. Nunca subas credenciales a Git.

Angular no necesita `.env`: las llamadas usan `/api` y Vercel las reenvía según `vercel.json`. Ahí se reemplaza el dominio de ejemplo por la URL pública de la API. No pongas credenciales de PostgreSQL ni claves de IA en el frontend; el archivo tiene `LLM_API_KEY` reservado solo para el futuro backend y todavía no se consume.

`vercel.json` contiene un destino de ejemplo para el proxy de `/api`. Después de crear el servicio de Render, reemplaza `REEMPLAZAR-POR-TU-API` por el nombre real del servicio en esa URL y despliega el directorio raíz con Vercel. Configura el proyecto Angular con `npm run build` y salida `frontend/dist/frontend/browser`.

Para extraer el backend, crea un repositorio cuyo contenido sea el de `backend/` (incluido `render.yaml`) y conéctalo a Render usando la raíz del repositorio. El servicio ejecuta `npm install` y `npm start`; no depende de los scripts del monorepo. Pega la Internal Database URL y el origen de Vercel en las variables que Render solicita al desplegar el blueprint. Render PostgreSQL y Supabase PostgreSQL son alternativas compatibles: en ambos casos se configura `DATABASE_URL`.

## Verificación

```sh
npm run build
npm --prefix frontend test -- --watch=false
npm --prefix backend test
```

Con PostgreSQL local disponible y la API encendida, verifica `GET http://localhost:3000/api/health` y envía `POST /api/lookup` con `{"expression":"parcero"}`. Debe regresar `found: true` con `source: "database"`; una expresión no sembrada regresa `found: false` sin usar IA.
