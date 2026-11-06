# EntreJergas

Beta académica de **EntreJergas**: un diccionario para entender jergas de los países hispanohablantes. El backend consulta primero PostgreSQL y, si la expresión no está, le pide a la IA que la identifique y la explique. Solo las jergas confirmadas se agregan al diccionario compartido.

## Requisitos

- Node.js 22.22.3 y npm (versión requerida por Angular; la API por sí sola admite Node.js 20.19+).
- Para dictado, navegador compatible con Web Speech API y permiso de micrófono. En producción el navegador requiere HTTPS.

Este repositorio contiene el frontend directamente en su raíz. La API vive en otro repositorio; para desarrollo local, clona `EntreJergas-Back` junto a esta carpeta, con su servidor en `../EntreJergas-Back/backend`.

## Ejecutar en desarrollo

Desde la raíz del repositorio:

```sh
npm install
npm run install:api
```

Edita `../EntreJergas-Back/backend/.env` y configura `DATABASE_URL` para tu PostgreSQL local. Después ejecuta desde la raíz:

```sh
npm run dev
```

Abre `http://localhost:4200`. Angular sirve la interfaz y reenvía `/api` a Express en `http://localhost:3000`. El backend crea las tablas e inserta las expresiones de ejemplo de manera idempotente al arrancar. Para correr solo el servidor: `npm run dev:api`.

## Arquitectura

Las decisiones técnicas y sus trade-offs están en [docs/arquitectura.md](docs/arquitectura.md). Para actualizar los tipos de la API después de cambiar el contrato del backend: `npm run api:types`.

## Diseño

- Los colores y las fuentes se definen como variables en `src/styles.css`; el modo oscuro solo cambia esas variables.
- Cada vista tiene sus estilos junto a su componente, en `src/app/features/`.
- Los iconos viven en `src/app/shared/icon.ts` y los textos en español e inglés en `src/app/core/i18n/i18n.ts`.
- Tipografías: Chivo para la interfaz y Alegreya para las palabras y definiciones, cargadas desde Google Fonts.

## Vistas y flujo

- Crea una cuenta con nombre, correo y contraseña, o inicia sesión. La sesión se conserva en una cookie `HttpOnly`; el historial solo muestra consultas de la cuenta activa.
- Escribe una palabra o una frase completa, hasta 300 caracteres, o elige una sugerencia. Cada expresión aparece en su propia ficha, con sus países y su nivel de lenguaje.
- En **Diccionario** se recorren todas las expresiones con búsqueda, filtro por país y paginación. Los filtros quedan en la URL.
- En **Jugar**, el juego ¿De qué país es? usa las expresiones del diccionario que tienen un país conocido.
- El dictado usa Web Speech API del navegador; no se sube audio al servidor. Algunos navegadores no implementan esta API.
- Al cambiar a inglés, cada ficha pide su definición traducida al backend y vuelve al español sin otra llamada. Si la traducción falla, se conserva el español y se avisa.
- El Worker recibe las ediciones, espera 280 ms y busca candidatos en un vocabulario pequeño fuera del hilo principal. No hace llamadas de red ni sustituye la búsqueda autoritativa de la API.
- El servidor consulta primero PostgreSQL y, si no encuentra el texto, le pide a la IA que extraiga y clasifique las expresiones. Solo guarda las jergas confirmadas; la regla completa está en [docs/arquitectura.md](docs/arquitectura.md).
- La interfaz guarda localmente las definiciones consultadas para poder mostrarlas si se pierde la conexión. El historial y las métricas requieren la API; las consultas sin conexión no se sincronizan posteriormente.

## Contrato REST

El contrato completo está en `../EntreJergas-Back/backend/openapi.yaml`.

## Arquitectura y rendimiento

Angular renderiza como SPA del lado del cliente: el navegador dibuja la aplicación y el Worker procesa la detección; Express y PostgreSQL viven del lado servidor y mantienen la fuente de verdad. El límite cliente-servidor es `/api`, con DTOs tipados en `src/app/api.service.ts`.

Para observar la reactividad, escribe una frase larga y comprueba que el cursor y la entrada siguen respondiendo mientras el Worker espera y busca; en DevTools, el Worker aparece como hilo separado. El bundle de producción mantiene el Worker en un chunk separado. El debounce reduce trabajo repetido durante la escritura.

La red solo se usa al enviar una consulta o cargar historial/métricas; no se envía cada pulsación. El navegador conserva las entradas consultadas en `localStorage`. `pg.Pool` mantiene conexiones limitadas y reutilizables para consultas simultáneas; PostgreSQL administra concurrencia y persistencia fuera del proceso Node.

## Entornos

`../EntreJergas-Back/backend/.env` es solo para desarrollo local y está excluido de Git. En Render despliega el repositorio independiente `EntreJergas-Back/backend` (o usa su `render.yaml` como blueprint). Configura `DATABASE_URL` con la **Internal Database URL** de Render y `CORS_ORIGIN` con el dominio de Vercel en el panel de Render. Render proporciona `PORT`; `NODE_ENV=production` activa SSL hacia PostgreSQL. La conexión externa se usa para pgAdmin desde tu computador; el hostname interno solo funciona desde Render. Nunca subas credenciales a Git.

Angular no necesita `.env`: las llamadas usan `/api` y Vercel las reenvía según `vercel.json` al servicio `entrejergas-back` de Render. No pongas credenciales de PostgreSQL ni claves de IA en el frontend; `LLM_API_KEY` está reservada para el futuro backend y todavía no se consume.

Despliega `EntreJergas` desde la raíz en Vercel con `npm run build` y salida `dist/frontend/browser`. Despliega `EntreJergas-Back/backend` de forma independiente en Render; ese servicio ejecuta `npm install` y `npm start`. Render PostgreSQL y Supabase PostgreSQL son alternativas compatibles: en ambos casos se configura `DATABASE_URL`.

## Verificación

```sh
npm run build
npm test -- --watch=false
npm --prefix ../EntreJergas-Back/backend test
```

Con PostgreSQL local disponible y la API encendida, crea una cuenta desde la interfaz y luego prueba `GET http://localhost:3000/api/health`. Las consultas requieren la cookie de sesión; una expresión conocida regresa `found: true` con `source: "database"`, y una expresión no sembrada regresa `found: false` sin usar IA.
