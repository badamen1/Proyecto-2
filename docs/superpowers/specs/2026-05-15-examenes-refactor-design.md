# Diseño: Refactorización de Exámenes — Fuente Única de Verdad

**Fecha:** 2026-05-15  
**Estado:** Aprobado  
**Alcance:** Backend Django (`examenes/` app) + Chatbot + Frontend Next.js

---

## Problema

Los exámenes de laboratorio están hardcodeados en dos archivos JSON duplicados:
- `backend/chatbot/examenes.json` (91 exámenes)
- `frontend/app/data/examenes.json` (copia idéntica)

Esto impide actualizar precios o agregar exámenes sin modificar código. La fuente única de verdad debe ser la base de datos.

---

## Arquitectura General

```
BD (Examen model)
    │
    ├── GET /api/examenes/          → ExamenListView (DRF)
    ├── GET /api/examenes/<slug>/   → ExamenDetailView (DRF)
    │
    ├── chatbot/views.py            → consulta DB en cada request
    │
    └── frontend
        ├── /servicios              → fetch /api/examenes/ (client-side)
        └── /servicios/[slug]       → fetch /api/examenes/<slug>/ (client-side)
```

---

## 1. Backend — App `examenes/`

### 1.1 Estructura de archivos

```
backend/examenes/
├── __init__.py
├── apps.py
├── admin.py
├── models.py
├── serializers.py
├── views.py
├── urls.py
└── migrations/
    ├── 0001_initial.py
    └── 0002_populate_from_json.py
```

### 1.2 Modelo `Examen`

Convenciones seguidas: `verbose_name` en español, `TextChoices` para enum, timestamps estándar (`fecha_registro`, `fecha_actualizacion`), campo `activo`.

```python
class Examen(models.Model):
    class Categoria(models.TextChoices):
        COAGULACION   = 'Coagulación',   'Coagulación'
        HEMATOLOGIA   = 'Hematología',   'Hematología'
        HORMONAS      = 'Hormonas',      'Hormonas'
        INFECTOLOGIA  = 'Infectología',  'Infectología'
        INMUNOLOGIA   = 'Inmunología',   'Inmunología'
        METABOLISMO   = 'Metabolismo',   'Metabolismo'
        MICROBIOLOGIA = 'Microbiología', 'Microbiología'
        ONCOLOGIA     = 'Oncología',     'Oncología'
        OTRAS         = 'Otras',         'Otras'
        TIROIDES      = 'Tiroides',      'Tiroides'

    codigo       = CharField(max_length=10, unique=True)
    nombre       = CharField(max_length=200)
    slug         = SlugField(max_length=220, unique=True)  # auto-generado
    precio       = PositiveIntegerField()                   # COP, entero
    categoria    = CharField(choices=Categoria.choices)
    descripcion  = TextField(blank=True)
    sintomas     = JSONField(default=list)
    requiere_ayuno = BooleanField(default=False)
    preparacion  = TextField(blank=True)
    activo       = BooleanField(default=True)
    fecha_registro      = DateTimeField(auto_now_add=True)
    fecha_actualizacion = DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Examen'
        verbose_name_plural = 'Exámenes'
        ordering = ['nombre']
```

**Slug:** generado en `save()` con `django.utils.text.slugify(nombre)`. Si hay colisión, se añade el código como sufijo (`slugify(nombre) + '-' + codigo.lower()`).

### 1.3 Migración de datos (`0002`)

- Lee `backend/chatbot/examenes.json` con `Path(__file__).parent / '../../chatbot/examenes.json'`
- Crea un `Examen` por entrada con `requiere_ayuno=False`, `preparacion=''`
- Es una `RunPython` migration (no usa fixtures para mantener la lógica auditable)

### 1.4 Serializers

**`ExamenListSerializer`** (ligero, para el listado):
- Campos: `slug, nombre, codigo, categoria, precio, sintomas` (array completo — el frontend toma los primeros 3)

**`ExamenDetailSerializer`** (completo, para detalle):
- Todos los campos del modelo excepto timestamps internos

### 1.5 Vistas

**`ExamenListView`** (`ListAPIView`):
- Permiso: `AllowAny`
- Paginación: 20 resultados por página (configurable vía `page_size` query param, máx 200)
- Filtros: `SearchFilter` sobre `nombre` y `codigo`; filtro manual por `categoria` vía `request.query_params.get('categoria')`
- `queryset`: `Examen.objects.filter(activo=True)`

**`ExamenDetailView`** (`RetrieveAPIView`):
- Permiso: `AllowAny`
- Lookup field: `slug`
- `queryset`: `Examen.objects.filter(activo=True)`

### 1.6 URLs

```python
# config/urls.py
path('api/', include('examenes.urls'))

# examenes/urls.py
path('examenes/', ExamenListView.as_view(), name='examen-list'),
path('examenes/<slug:slug>/', ExamenDetailView.as_view(), name='examen-detail'),
```

### 1.7 Admin

```python
@admin.register(Examen)
class ExamenAdmin(admin.ModelAdmin):
    list_display   = ['nombre', 'codigo', 'categoria', 'precio', 'activo', 'requiere_ayuno']
    list_filter    = ['categoria', 'activo', 'requiere_ayuno']
    search_fields  = ['nombre', 'codigo']
    prepopulated_fields = {'slug': ('nombre',)}
```

---

## 2. Chatbot — Prompt Dinámico desde BD

### 2.1 `chatbot/views.py` refactor

**Eliminar:**
- `_EXAMENES_PATH`, `_EXAMENES` (carga de JSON en module-level)
- `_SYSTEM_PROMPT` (string hardcodeado)

**Cambiar `_build_system_prompt()`:**
- Nueva firma: `() -> str`
- Consulta: `Examen.objects.filter(activo=True).only('nombre','categoria','precio','sintomas','descripcion','requiere_ayuno','slug')`
- Cada línea del catálogo incluye el slug en formato markdown:
  ```
  - [Nombre del Examen](/servicios/slug) | Categoría: X | Precio: $X COP | ...
  ```
- Regla adicional en el prompt: _"Cuando recomiendes un examen, escribe su nombre como enlace markdown: `[Nombre](/servicios/slug)`"_

**Estrategia de caché:** ninguna — se construye el prompt y se instancia el modelo en cada request. La query es O(91 rows) y es aceptable para el volumen actual.

**Flujo en `chatbot_view`:**
1. Construir prompt con `_build_system_prompt()`
2. Instanciar `genai.GenerativeModel(system_instruction=prompt, ...)`
3. Continuar con el flujo existente (history, send_message, etc.)

---

## 3. Frontend — Páginas de Exámenes

### 3.1 `/servicios/page.tsx` (refactor)

- Eliminar `import examenesData from '../data/examenes.json'`
- `'use client'` — fetch a `GET ${API_BASE}/api/examenes/?page_size=100` en `useEffect`
- Estados: `examenes: ExamenList[]`, `loading: boolean`, `searchTerm: string`, `categoriaActiva: string`
- Filtros de categoría: row de chips/botones (Todos + 10 categorías), filtrado local en memoria
- Búsqueda: texto libre por nombre o código, también local
- Cards: muestran `nombre`, badge coloreado de `categoria`, precio formateado `$X.XXX COP`, primeros 3 síntomas como mini-tags
- Cada card es `<Link href={/servicios/${examen.slug}}>` — navegación a detalle

**Tipo TypeScript:**
```ts
interface ExamenList {
  slug: string;
  nombre: string;
  codigo: string;
  categoria: string;
  precio: number;
  sintomas: string[];
}
```

### 3.2 `/servicios/[slug]/page.tsx` (nueva)

- `'use client'` — fetch a `GET ${API_BASE}/api/examenes/${params.slug}/` en `useEffect`
- Loading state: spinner centrado mientras carga
- 404: si la API retorna 404, mostrar mensaje con `<Link href="/servicios">Volver al catálogo</Link>`

**Layout de la página:**
1. Breadcrumb: `Inicio > Servicios > [Nombre del Examen]`
2. Nombre del examen (h1)
3. Row: badge de categoría + código (estilo `Código: 17H`)
4. Precio grande: `$59.932 COP`
5. Descripción completa (párrafo)
6. Síntomas: tags pill (uno por síntoma)
7. Sección preparación: si `requiere_ayuno=true` → aviso de ayuno; si `preparacion` no vacío → texto de preparación
8. Botón WhatsApp: `<Link href="https://wa.me/573103661093?text=Hola, quiero agendar el examen: {nombre}">Agendar por WhatsApp</Link>`

**Tipo TypeScript:**
```ts
interface ExamenDetail extends ExamenList {
  descripcion: string;
  requiere_ayuno: boolean;
  preparacion: string;
}
```

### 3.3 `ChatbotWidget.tsx` — Parser de Markdown Links

Extraer función `parseMarkdownLinks`:
```ts
function parseMarkdownLinks(text: string): React.ReactNode[] {
  // Regex: [texto](url)
  // Retorna array mixto de strings y <Link> components
}
```

- Solo el bubble del bot (`msg.role === 'model'`) usa el parser
- Los bubbles del usuario siguen como texto plano
- `<Link>` usa `href` relativo (rutas internas `/servicios/...`)
- Sin dependencias externas — parser implementado con regex nativa

---

## 4. Limpieza

- Eliminar `backend/chatbot/examenes.json`
- Eliminar `frontend/app/data/examenes.json`
- Eliminar el directorio `frontend/app/data/` si queda vacío

---

## Restricciones y Decisiones

| Decisión | Elección | Razón |
|---|---|---|
| Caché chatbot | Sin caché | Simple, siempre fresco, volumen bajo |
| Campos migración | Defaults vacíos | No inventar datos; admin los completa |
| WhatsApp mensaje | Dinámico con nombre | Mejor experiencia del usuario |
| Fetch frontend | Client-side | Consistente con patrón actual |
| Slug colisión | Sufijo `-{codigo}` | Garantiza unicidad sin heurísticas complejas |

---

## Archivos Clave Afectados

**Backend:**
- `backend/examenes/` — nuevo directorio completo
- `backend/config/settings.py` — agregar `'examenes.apps.ExamenesConfig'`
- `backend/config/urls.py` — incluir `examenes.urls`
- `backend/chatbot/views.py` — refactor completo
- `backend/chatbot/examenes.json` — eliminar

**Frontend:**
- `frontend/app/servicios/page.tsx` — refactor
- `frontend/app/servicios/[slug]/page.tsx` — nuevo archivo
- `frontend/features/chatbot/components/ChatbotWidget.tsx` — agregar parser
- `frontend/app/data/examenes.json` — eliminar
