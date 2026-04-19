# Vista de resultados del paciente — Design Spec

**Fecha:** 2026-04-19
**Autor:** Bayron Mena (con asistencia de Claude)
**Estado:** Aprobado para implementación

## Contexto

El proyecto (LabClinic / BIOANALISIS) tiene:

- Backend Django REST ya funcional en `backend/resultados/` que expone endpoints para listar, obtener y descargar (PDF) resultados clínicos por paciente autenticado. Autenticación JWT (SimpleJWT).
- Frontend Next.js 16 con App Router. El dashboard (`app/dashboard/page.tsx`) muestra 3 roles (`paciente`, `bacteriologo`, `admin`) con contenido diferenciado.
- Para el rol `paciente` hoy se muestra una tarjeta "Resultados Recientes" con texto hardcodeado ("Tienes 1 resultado nuevo") y un botón "Ver Resultados" que no navega a ningún lado.
- **Gap:** no existe una vista real donde el paciente vea y descargue sus resultados, aunque el backend ya los entrega.

## Objetivo

Construir la experiencia cliente (paciente) para ver y descargar sus resultados clínicos validados, consumiendo los endpoints ya existentes, con autenticación robusta (auto-refresh de token) y paginación.

## Alcance (incluido)

1. Helper `lib/api.ts` con `apiFetch` que gestiona base URL, token JWT y auto-refresh en 401.
2. Página listado `app/dashboard/resultados/page.tsx` con paginación "load more".
3. Página detalle `app/dashboard/resultados/[id]/page.tsx` con visor PDF inline (iframe + blob URL autenticado).
4. Actualización de la card "Resultados Recientes" en `app/dashboard/page.tsx` para mostrar conteo real y enlazar a la lista.
5. Tests unitarios para `apiFetch` y tests de componente para la lista.

## Fuera de alcance

- Filtros (por fecha/tipo/estado) y buscador — se podrán agregar después sobre la base ya paginada.
- Redesign visual del dashboard — se mantiene el estilo inline actual.
- Refactor de las páginas existentes (`login`, `dashboard/usuarios`) para usar el helper — seguirán con su fetch directo.
- Notificaciones push de nuevos resultados.

## Arquitectura

### Diagrama de flujo

```
[Paciente autenticado]
        │
        ▼
┌────────────────────────┐
│ /dashboard             │  ← card "Resultados Recientes" muestra conteo real
│   (page.tsx)           │
└─────────┬──────────────┘
          │ click "Ver Resultados"
          ▼
┌────────────────────────┐        GET /api/resultados/?page=N
│ /dashboard/resultados  │ ───────────────────────────────────► Django
│   (lista, paginada)    │ ◄─── { count, next, previous, results[] }
└─────────┬──────────────┘
          │ click fila "Ver"
          ▼
┌────────────────────────┐        GET /api/resultados/<id>/
│ /dashboard/resultados/ │ ───────────────────────────────────► Django
│   [id] (detalle + PDF) │        GET /api/resultados/<id>/pdf/
└────────────────────────┘          (autenticado, devuelve blob)

Todas las llamadas pasan por lib/api.ts → apiFetch()
  └─ Si 401 → POST /api/auth/login/refresh/ → reintento 1 vez
       └─ Si falla → logout + redirect /login
```

### Componentes nuevos / modificados

| Archivo | Acción | Propósito |
|---|---|---|
| `lib/api.ts` | **Nuevo** | Helper fetch con token + auto-refresh |
| `app/dashboard/resultados/page.tsx` | **Nuevo** | Lista paginada de resultados del paciente |
| `app/dashboard/resultados/[id]/page.tsx` | **Nuevo** | Detalle de un resultado + visor PDF |
| `app/dashboard/page.tsx` | **Modificar** | Card del paciente con conteo real y link funcional |
| `tests/lib/api.test.ts` | **Nuevo** | Tests unitarios de `apiFetch` |
| `tests/app/dashboard/resultados.test.tsx` | **Nuevo** | Tests de componente del listado |
| `.env.local` (documentado en README) | **Opcional** | `NEXT_PUBLIC_API_URL=http://localhost:8000` |

## Componente 1 — `lib/api.ts`

### Responsabilidad

Ser el único punto de entrada a la API del backend desde el frontend (para las vistas nuevas). Gestiona base URL, headers de autenticación, refresh de token y errores.

### API pública

```ts
export async function apiFetch<T = unknown>(
  path: string,
  opts?: RequestInit
): Promise<T>

export async function apiFetchBlob(
  path: string,
  opts?: RequestInit
): Promise<Blob>

export function logoutAndRedirect(): void
```

### Comportamiento

- Base URL: `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'`.
- Inyecta `Authorization: Bearer <access_token>` leyendo `localStorage.getItem('access_token')`. Si no hay token y la ruta no es pública, llama a `logoutAndRedirect()`.
- Ejecuta el fetch. Si `response.status === 401`:
  1. Si ya se reintentó esta request (flag interno) → logout.
  2. Si no hay `refresh_token` en localStorage → logout.
  3. Si ya hay un refresh en curso (variable de módulo `refreshPromise`) → esperar esa promesa.
  4. Si no, iniciar un nuevo refresh: `POST /api/auth/login/refresh/` con `{refresh: <refresh_token>}` (fetch directo, no vía `apiFetch` para evitar recursión).
  5. Si el refresh devuelve 200 → guardar nuevo `access_token` en localStorage, reintentar la request original con el flag "reintentada".
  6. Si el refresh falla (4xx/5xx) → limpiar tokens + `router.push('/login')`.
- `apiFetch` parsea `response.json()` y retorna tipado. Si la respuesta no es OK tras el (posible) retry, lanza un `Error` con `response.statusText` y el cuerpo del error si es JSON.
- `apiFetchBlob` es la variante que devuelve `response.blob()` (para el PDF). Misma lógica de auth/refresh.
- `logoutAndRedirect()`: limpia `access_token`, `refresh_token`, `user_role` y hace `window.location.assign('/login')`.

### Nota sobre el refresh concurrente

Usamos una variable a nivel de módulo:

```ts
let refreshPromise: Promise<string> | null = null;
```

Cuando un 401 dispara refresh, todas las demás requests que también caigan en 401 durante esa ventana reutilizan la misma promesa. Al finalizar (exitosa o no), `refreshPromise = null`.

### Manejo de errores

- Errores de red (sin respuesta) → se propagan con mensaje claro "Error de conexión con el backend".
- 4xx no-401 → `Error` con mensaje del backend si existe (`data.detail`) o `statusText`.
- 5xx → `Error` "Error del servidor, intenta más tarde".

## Componente 2 — Lista `/dashboard/resultados`

### Layout

- Header con título "Mis Resultados" + botón "← Volver al dashboard".
- Contador superior: "Mostrando N de {count} resultados".
- Tabla con columnas: **Tipo de examen** | **Fecha del examen** | **Estado** (badge) | **Acciones**.
- Acciones por fila: "Ver detalle" (navega a `/dashboard/resultados/[id]`) y "Descargar PDF" (trigger de descarga).
- Botón "Cargar más" al final si `next !== null`.
- Estilo: inline styles consistentes con el dashboard actual (cards blancas con `boxShadow: '0 2px 10px rgba(0,0,0,0.05)'`, `var(--primary-blue)` para acentos).

### Estados de UI

| Estado | UI |
|---|---|
| Cargando inicial | `<div>Cargando resultados...</div>` centrado |
| Error de carga | Mensaje de error + botón "Reintentar" |
| Vacío (count=0) | Icono + texto "Aún no tienes resultados disponibles." |
| Con datos | Tabla + "Cargar más" si aplica |
| Cargando más | Botón muestra "Cargando..." y se deshabilita |

### Fetching

```ts
// Estado inicial
const [results, setResults] = useState<Resultado[]>([]);
const [nextUrl, setNextUrl] = useState<string | null>(null);
const [count, setCount] = useState(0);
const [loading, setLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const [error, setError] = useState<string | null>(null);

// Al montar
apiFetch<PaginatedResponse<Resultado>>('/api/resultados/')

// Al hacer click en "Cargar más"
apiFetch<PaginatedResponse<Resultado>>(pathFromUrl(nextUrl!))
  // extrae solo el path relativo de la URL completa que devuelve el backend
```

### Descarga de PDF desde la fila

Usa `apiFetchBlob('/api/resultados/<id>/pdf/')`, crea un object URL, crea un `<a download>` sintético, dispara click, revoca URL.

### Verificación de rol

Antes de fetch: leer `localStorage.user_role`. Si no es `paciente` → redirect a `/dashboard` (los resultados de bacteriólogo/admin son otra vista, fuera de alcance aquí).

## Componente 3 — Detalle `/dashboard/resultados/[id]`

### Layout

- Header con: Tipo de examen (h1), badge de estado, botón "← Volver".
- Panel de metadata (2 columnas en grid):
  - Fecha del examen
  - Fecha de carga
  - Fuente (FASIL / EXTERNO / MANUAL — convertir a texto legible)
  - Subido por (username del bacteriólogo si está disponible)
  - Observaciones (span 2 columnas, si existen)
- Botón "Descargar PDF" (mismo helper que la lista).
- Iframe PDF: `width: 100%`, `height: 800px`, `src={blobUrl}`, `style={{ border: '1px solid #ddd', borderRadius: '8px' }}`.

### Fetching

```ts
// 1. apiFetch<Resultado>(`/api/resultados/${id}/`) → metadata
// 2. apiFetchBlob(`/api/resultados/${id}/pdf/`) → blob
//    → URL.createObjectURL(blob) → guardar en state blobUrl
//    → useEffect cleanup: URL.revokeObjectURL(blobUrl)
```

### Estados

| Estado | UI |
|---|---|
| Cargando metadata | Spinner |
| 404 / no permitido | "Resultado no encontrado o no disponible" + link volver |
| Metadata OK, PDF cargando | Metadata visible + "Cargando PDF..." en el área del iframe |
| PDF listo | Iframe renderizado |
| Error de PDF | "No se pudo cargar el PDF. Puedes descargarlo manualmente." + botón descarga |

### Nota sobre el iframe con blob URL

El backend requiere `Authorization: Bearer ...` en `/api/resultados/<id>/pdf/`. Un `<iframe src="http://...">` no envía headers custom, por eso:

1. Hacer fetch autenticado con `apiFetchBlob`.
2. `URL.createObjectURL(blob)` → URL tipo `blob:http://...`.
3. `<iframe src={blobUrl}>` renderiza el PDF con el visor nativo del navegador.
4. En cleanup, `URL.revokeObjectURL(blobUrl)` libera memoria.

## Componente 4 — Card actualizada en `/dashboard`

En `app/dashboard/page.tsx`, dentro del bloque `currentRole === 'paciente'`:

- Al montar (si rol es `paciente`): `apiFetch<PaginatedResponse<Resultado>>('/api/resultados/')` — solo para leer `count`.
- Reemplazar texto hardcodeado por:
  - Si `count === 0`: "No tienes resultados aún."
  - Si `count > 0`: `Tienes ${count} resultado${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}.`
- Botón "Ver Resultados" envuelto en `<Link href="/dashboard/resultados">`.
- Mantener el loading state inicial simple (mostrar "Cargando..." en lugar del texto).

**Fuera de alcance** aquí: cambiar la card "Próxima Cita" (esa sigue con datos hardcodeados, tema aparte).

## Contratos de datos

### Tipos TypeScript a definir (en `lib/api.ts` o `lib/types.ts`)

```ts
export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ResultadoEstado = 'PENDIENTE' | 'VALIDADO' | 'ENTREGADO';
export type ResultadoFuente = 'FASIL' | 'EXTERNO' | 'MANUAL';

export type ResultadoLista = {
  id: number;
  paciente_nombre: string;
  paciente_documento: string;
  empresa_nombre: string | null;
  tipo_examen: string;
  fuente: ResultadoFuente;
  estado: ResultadoEstado;
  fecha_examen: string;       // ISO date
  fecha_carga: string;        // ISO datetime
  nombre_archivo: string | null;
};

export type ResultadoDetalle = ResultadoLista & {
  paciente: number;
  empresa: number | null;
  subido_por: number | null;
  subido_por_nombre: string | null;
  archivo_pdf: string;
  tipo_archivo: string;
  fecha_actualizacion: string;
  observaciones: string;
  id_orden_fasil: string | null;
};
```

## Seguridad

- El filtrado por estado (`VALIDADO`/`ENTREGADO` para paciente) ya lo hace el backend en `ResultadoListCreateView.get_queryset` — el frontend no necesita re-filtrar.
- El filtrado por paciente (un paciente solo ve sus propios resultados) también lo hace el backend vía `paciente__user=user`. El frontend no envía ningún filtro de paciente.
- Los PDFs se sirven por un endpoint autenticado → el blob URL es local al navegador, no expone la URL del backend.
- `logoutAndRedirect` limpia TODOS los tokens y el `user_role` antes de redirigir.

## Testing

### `tests/lib/api.test.ts` (Vitest)

Casos:
1. Happy path: token presente, 200 → retorna JSON parseado.
2. Sin token → llama a logout y redirect (mockear `window.location`).
3. 401 con refresh exitoso → reintenta la request original, retorna datos.
4. 401 con refresh fallido → llama a logout.
5. Dos requests en paralelo reciben 401 → solo se dispara un refresh (verificar con mock de fetch que el endpoint de refresh se llama exactamente una vez).
6. 500 → lanza Error con mensaje.
7. `apiFetchBlob` con happy path → retorna Blob.

Mocks: `global.fetch`, `localStorage` (ya mockeable vía jsdom), `window.location`.

### `tests/app/dashboard/resultados.test.tsx`

Casos:
1. Render inicial → muestra "Cargando resultados...".
2. Con resultados → renderiza N filas con los datos esperados.
3. Vacío → muestra mensaje de vacío, no muestra tabla.
4. Error de API → muestra mensaje de error y botón reintentar.
5. Badge de estado → `VALIDADO` verde, `ENTREGADO` azul.
6. Botón "Cargar más" aparece si `next !== null` y se oculta si `null`.

Mocks: `apiFetch` (con vi.mock del módulo `lib/api`).

### Testing manual

1. Levantar Django: `cd backend && python manage.py runserver`.
2. Levantar Next: `npm run dev`.
3. Crear un paciente vinculado a un User desde admin de Django.
4. Cargar un PDF de resultado para ese paciente con estado `VALIDADO`.
5. Login como ese paciente (flujo OTP).
6. Verificar: dashboard muestra conteo real → click lleva a lista → click a detalle → PDF se renderiza en iframe → descarga funciona → logout y login nuevamente para confirmar flujo.
7. Simular token expirado: en DevTools, corromper `access_token` → navegar a otra página → verificar que se refresca automáticamente sin expulsar al usuario.
8. Simular refresh token también inválido: corromper ambos → verificar que redirige a `/login`.

## Decisiones clave y alternativas rechazadas

| Decisión | Alternativas consideradas | Razón |
|---|---|---|
| `iframe + blob URL` para PDF | `react-pdf` | Evitar +300KB al bundle; visor nativo es suficiente para lectura |
| "Load more" en vez de paginación con números | Paginación clásica | El paciente típico tiene pocos resultados; UX más limpia en móvil |
| Helper `lib/api.ts` solo para páginas nuevas | Refactor global | Alcance mínimo, sin regresiones en login/usuarios |
| Mantener estilos inline | Tailwind / CSS Modules | Consistencia con el dashboard actual; el refactor estilístico es otro tema |
| Auto-refresh con promesa singleton | Refresh por cada 401 | Evita múltiples refreshes en paralelo y race conditions |
| Verificar rol en cliente antes de fetch | Solo confiar en backend | UX más rápida; backend sigue siendo la autoridad de seguridad |

## Riesgos / consideraciones

- **CORS**: el backend ya debe permitir `Content-Disposition` y `Authorization` en desarrollo. Verificar `django-cors-headers` config durante implementación.
- **Tamaño del PDF**: backend permite hasta 100MB (ver `ResultadoSerializer.validate_archivo_pdf`). Un blob de 100MB en memoria puede afectar navegadores débiles — aceptable, los resultados clínicos suelen ser <5MB.
- **SSR / hidratación**: las páginas usan `'use client'` y acceden a `localStorage` — solo se debe leer dentro de `useEffect`, nunca en el render inicial.
- **Locale de fechas**: usar `toLocaleDateString('es-CO')` para mostrar fechas.
