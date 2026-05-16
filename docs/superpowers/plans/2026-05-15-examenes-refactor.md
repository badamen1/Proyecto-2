# Examenes Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar los exámenes hardcodeados en JSON duplicados a una BD PostgreSQL con API REST pública, actualizar el chatbot para leer desde la BD y generar enlaces markdown, y crear páginas de lista/detalle en Next.js.

**Architecture:** Nueva app Django `examenes/` expone `GET /api/examenes/` y `GET /api/examenes/<slug>/`. El chatbot construye su system prompt desde `Examen.objects.filter(activo=True)` en cada request (sin caché). El frontend hace fetch client-side y filtra localmente.

**Tech Stack:** Django 6 + DRF, PostgreSQL (JSONField nativo), Next.js 14 App Router (`'use client'`), TypeScript, `django.utils.text.slugify`.

---

## Mapa de archivos

**Crear:**
- `backend/examenes/__init__.py`
- `backend/examenes/apps.py`
- `backend/examenes/models.py`
- `backend/examenes/admin.py`
- `backend/examenes/serializers.py`
- `backend/examenes/views.py`
- `backend/examenes/urls.py`
- `backend/examenes/tests.py`
- `backend/examenes/migrations/__init__.py`
- `backend/examenes/migrations/0001_initial.py` ← generado por makemigrations
- `backend/examenes/migrations/0002_populate_from_json.py`
- `backend/examenes/fixtures/examenes_initial.json` ← copia de chatbot/examenes.json
- `frontend/app/servicios/[slug]/page.tsx`

**Modificar:**
- `backend/config/settings.py` — agregar app a INSTALLED_APPS
- `backend/config/urls.py` — incluir examenes.urls
- `backend/chatbot/views.py` — refactor completo
- `backend/chatbot/tests.py` — agregar tests de _build_system_prompt
- `frontend/app/servicios/page.tsx` — refactor completo
- `frontend/features/chatbot/components/ChatbotWidget.tsx` — agregar parser markdown

**Eliminar:**
- `backend/chatbot/examenes.json`
- `frontend/app/data/examenes.json`

---

## Task 1: App skeleton

**Files:**
- Create: `backend/examenes/__init__.py`
- Create: `backend/examenes/apps.py`
- Create: `backend/examenes/migrations/__init__.py`
- Modify: `backend/config/settings.py`
- Modify: `backend/config/urls.py`

- [ ] **Step 1.1: Crear archivos base de la app**

Crear `backend/examenes/__init__.py` (vacío):
```python
```

Crear `backend/examenes/apps.py`:
```python
from django.apps import AppConfig


class ExamenesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'examenes'
    verbose_name = 'Exámenes'
```

Crear `backend/examenes/migrations/__init__.py` (vacío):
```python
```

- [ ] **Step 1.2: Registrar en INSTALLED_APPS**

En `backend/config/settings.py`, dentro de `INSTALLED_APPS`, agregar después de `'chatbot.apps.ChatbotConfig'`:
```python
    'examenes.apps.ExamenesConfig',
```

- [ ] **Step 1.3: Registrar URL**

En `backend/config/urls.py`, agregar antes del último `urlpatterns`:
```python
    path('api/', include('examenes.urls')),
```

El archivo completo debe quedar:
```python
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/', include('resultados.urls')),
    path('api/', include('empresas.urls')),
    path('api/', include('chatbot.urls')),
    path('api/', include('examenes.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

- [ ] **Step 1.4: Verificar que Django reconoce la app**

```bash
cd backend
python manage.py check
```

Esperado: `System check identified no issues (0 silenced).`

- [ ] **Step 1.5: Commit**

```bash
git add backend/examenes/ backend/config/settings.py backend/config/urls.py
git commit -m "feat(examenes): crear esqueleto de la app examenes"
```

---

## Task 2: Modelo Examen + tests

**Files:**
- Create: `backend/examenes/models.py`
- Create: `backend/examenes/tests.py` (model tests)
- Create: `backend/examenes/migrations/0001_initial.py` (generado)

- [ ] **Step 2.1: Escribir los tests del modelo (fallarán — modelo sin save() todavía)**

Crear `backend/examenes/tests.py`:
```python
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Examen


class ExamenModelTests(TestCase):
    def test_slug_auto_generado_desde_nombre(self):
        e = Examen(codigo='GLU', nombre='Glucosa Basal', precio=15000, categoria='Metabolismo')
        e.save()
        self.assertEqual(e.slug, 'glucosa-basal')

    def test_slug_normaliza_tildes(self):
        e = Examen(codigo='FE', nombre='Ferritina Sérica', precio=30000, categoria='Hematología')
        e.save()
        self.assertEqual(e.slug, 'ferritina-serica')

    def test_slug_colision_agrega_codigo(self):
        Examen.objects.create(
            codigo='A1', nombre='Proteína C', precio=10000, categoria='Otras', slug='proteina-c'
        )
        e = Examen(codigo='A2', nombre='Proteína C', precio=12000, categoria='Otras')
        e.save()
        self.assertEqual(e.slug, 'proteina-c-a2')

    def test_str(self):
        e = Examen(codigo='GLU', nombre='Glucosa Basal', precio=15000, categoria='Metabolismo')
        self.assertEqual(str(e), 'Glucosa Basal (GLU)')
```

- [ ] **Step 2.2: Correr tests — deben FALLAR porque el modelo no existe**

```bash
cd backend
python manage.py test examenes.tests.ExamenModelTests
```

Esperado: `ImportError` o `ModuleNotFoundError` porque `models.py` no existe aún.

- [ ] **Step 2.3: Implementar el modelo**

Crear `backend/examenes/models.py`:
```python
from django.db import models
from django.utils.text import slugify


class Examen(models.Model):
    """
    Examen de laboratorio disponible en BIOANALISIS.

    Fuente única de verdad que reemplaza los archivos examenes.json
    duplicados que había en chatbot/ y frontend/app/data/.
    """

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

    codigo    = models.CharField(max_length=10, unique=True, verbose_name='Código')
    nombre    = models.CharField(max_length=200, verbose_name='Nombre')
    slug      = models.SlugField(max_length=220, unique=True, blank=True, verbose_name='Slug')
    precio    = models.PositiveIntegerField(verbose_name='Precio (COP)')
    categoria = models.CharField(
        max_length=20,
        choices=Categoria.choices,
        default=Categoria.OTRAS,
        verbose_name='Categoría',
    )
    descripcion    = models.TextField(blank=True, verbose_name='Descripción')
    sintomas       = models.JSONField(default=list, verbose_name='Síntomas')
    requiere_ayuno = models.BooleanField(default=False, verbose_name='Requiere ayuno')
    preparacion    = models.TextField(blank=True, verbose_name='Preparación')
    activo         = models.BooleanField(default=True, verbose_name='Activo')

    fecha_registro      = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de registro')
    fecha_actualizacion = models.DateTimeField(auto_now=True, verbose_name='Última actualización')

    class Meta:
        verbose_name = 'Examen'
        verbose_name_plural = 'Exámenes'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.nombre} ({self.codigo})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.nombre) or slugify(self.codigo)
            if Examen.objects.filter(slug=base_slug).exclude(pk=self.pk).exists():
                self.slug = f"{base_slug}-{self.codigo.lower()}"
            else:
                self.slug = base_slug
        super().save(*args, **kwargs)
```

- [ ] **Step 2.4: Generar la migración de esquema**

```bash
cd backend
python manage.py makemigrations examenes
```

Esperado:
```
Migrations for 'examenes':
  examenes/migrations/0001_initial.py
    - Create model Examen
```

- [ ] **Step 2.5: Aplicar la migración**

```bash
python manage.py migrate examenes
```

Esperado: `Applying examenes.0001_initial... OK`

- [ ] **Step 2.6: Correr tests del modelo — deben PASAR**

```bash
python manage.py test examenes.tests.ExamenModelTests
```

Esperado: `OK` con 4 tests pasando.

- [ ] **Step 2.7: Commit**

```bash
git add backend/examenes/models.py backend/examenes/tests.py backend/examenes/migrations/
git commit -m "feat(examenes): modelo Examen con slug auto-generado y tests"
```

---

## Task 3: Data migration desde JSON

**Files:**
- Create: `backend/examenes/fixtures/examenes_initial.json`
- Create: `backend/examenes/migrations/0002_populate_from_json.py`

- [ ] **Step 3.1: Crear directorio fixtures y copiar el JSON**

Crear el directorio `backend/examenes/fixtures/` y copiar el contenido de `backend/chatbot/examenes.json` a `backend/examenes/fixtures/examenes_initial.json`.

El archivo resultante debe ser idéntico a `backend/chatbot/examenes.json` (91 entradas, mismo formato).

- [ ] **Step 3.2: Escribir la data migration**

Crear `backend/examenes/migrations/0002_populate_from_json.py`:
```python
import json
from pathlib import Path

from django.db import migrations
from django.utils.text import slugify


def _make_slug(nombre, codigo):
    return slugify(nombre) or slugify(codigo)


def populate(apps, schema_editor):
    Examen = apps.get_model('examenes', 'Examen')
    data_file = Path(__file__).resolve().parent.parent / 'fixtures' / 'examenes_initial.json'
    data = json.loads(data_file.read_text(encoding='utf-8'))

    used_slugs = set()
    for entry in data:
        base_slug = _make_slug(entry['nombre'], entry['codigo'])
        slug = base_slug
        if slug in used_slugs:
            slug = f"{base_slug}-{entry['codigo'].lower()}"
        used_slugs.add(slug)

        Examen.objects.create(
            codigo=entry['codigo'],
            nombre=entry['nombre'],
            slug=slug,
            precio=entry.get('precio', 0),
            categoria=entry.get('categoria', 'Otras'),
            descripcion=entry.get('descripcion', ''),
            sintomas=entry.get('sintomas', []),
            requiere_ayuno=False,
            preparacion='',
            activo=True,
        )


def depopulate(apps, schema_editor):
    Examen = apps.get_model('examenes', 'Examen')
    Examen.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('examenes', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(populate, depopulate),
    ]
```

- [ ] **Step 3.3: Aplicar la data migration**

```bash
cd backend
python manage.py migrate examenes
```

Esperado: `Applying examenes.0002_populate_from_json... OK`

- [ ] **Step 3.4: Verificar los datos en el shell**

```bash
python manage.py shell -c "from examenes.models import Examen; print(Examen.objects.count()); print(Examen.objects.first())"
```

Esperado:
```
91
17 HIDROXIPROGESTERONA (17H)
```

- [ ] **Step 3.5: Commit**

```bash
git add backend/examenes/fixtures/ backend/examenes/migrations/0002_populate_from_json.py
git commit -m "feat(examenes): data migration desde examenes.json (91 exámenes)"
```

---

## Task 4: Serializers, Views, URLs y tests de API

**Files:**
- Create: `backend/examenes/serializers.py`
- Create: `backend/examenes/views.py`
- Create: `backend/examenes/urls.py`
- Modify: `backend/examenes/tests.py` (agregar API tests)

- [ ] **Step 4.1: Agregar los tests de API al archivo de tests (fallarán)**

Añadir al final de `backend/examenes/tests.py`:
```python

class ExamenListViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.glucosa = Examen.objects.create(
            codigo='GLU', nombre='Glucosa Basal', slug='glucosa-basal',
            precio=15000, categoria='Metabolismo', activo=True,
            sintomas=['sed excesiva', 'cansancio'],
        )
        self.hemograma = Examen.objects.create(
            codigo='HEM', nombre='Hemograma Completo', slug='hemograma-completo',
            precio=25000, categoria='Hematología', activo=True,
            sintomas=['fatiga', 'palidez'],
        )
        Examen.objects.create(
            codigo='INA', nombre='Examen Inactivo', slug='examen-inactivo',
            precio=10000, categoria='Otras', activo=False,
        )

    def test_list_retorna_200(self):
        response = self.client.get('/api/examenes/')
        self.assertEqual(response.status_code, 200)

    def test_list_no_requiere_auth(self):
        response = self.client.get('/api/examenes/')
        self.assertNotEqual(response.status_code, 401)

    def test_list_excluye_inactivos(self):
        response = self.client.get('/api/examenes/')
        nombres = [e['nombre'] for e in response.data['results']]
        self.assertNotIn('Examen Inactivo', nombres)

    def test_search_por_nombre(self):
        response = self.client.get('/api/examenes/?search=glucosa')
        nombres = [e['nombre'] for e in response.data['results']]
        self.assertIn('Glucosa Basal', nombres)
        self.assertNotIn('Hemograma Completo', nombres)

    def test_search_por_codigo(self):
        response = self.client.get('/api/examenes/?search=HEM')
        nombres = [e['nombre'] for e in response.data['results']]
        self.assertIn('Hemograma Completo', nombres)

    def test_filter_por_categoria(self):
        response = self.client.get('/api/examenes/?categoria=Hematología')
        nombres = [e['nombre'] for e in response.data['results']]
        self.assertIn('Hemograma Completo', nombres)
        self.assertNotIn('Glucosa Basal', nombres)

    def test_page_size_override(self):
        response = self.client.get('/api/examenes/?page_size=1')
        self.assertEqual(len(response.data['results']), 1)

    def test_respuesta_incluye_campos_lista(self):
        response = self.client.get('/api/examenes/')
        item = response.data['results'][0]
        for campo in ['slug', 'nombre', 'codigo', 'categoria', 'precio', 'sintomas']:
            self.assertIn(campo, item)


class ExamenDetailViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.examen = Examen.objects.create(
            codigo='GLU', nombre='Glucosa Basal', slug='glucosa-basal',
            precio=15000, categoria='Metabolismo', activo=True,
            descripcion='Mide el nivel de glucosa en sangre.',
            sintomas=['sed', 'cansancio'],
            requiere_ayuno=True,
            preparacion='Ayunar 8 horas antes.',
        )

    def test_detail_retorna_200(self):
        response = self.client.get('/api/examenes/glucosa-basal/')
        self.assertEqual(response.status_code, 200)

    def test_detail_no_requiere_auth(self):
        response = self.client.get('/api/examenes/glucosa-basal/')
        self.assertNotEqual(response.status_code, 401)

    def test_slug_inexistente_retorna_404(self):
        response = self.client.get('/api/examenes/no-existe/')
        self.assertEqual(response.status_code, 404)

    def test_inactivo_retorna_404(self):
        Examen.objects.create(
            codigo='INA', nombre='Inactivo', slug='examen-inactivo',
            precio=0, categoria='Otras', activo=False,
        )
        response = self.client.get('/api/examenes/examen-inactivo/')
        self.assertEqual(response.status_code, 404)

    def test_detail_incluye_todos_los_campos(self):
        response = self.client.get('/api/examenes/glucosa-basal/')
        data = response.data
        self.assertEqual(data['nombre'], 'Glucosa Basal')
        self.assertEqual(data['codigo'], 'GLU')
        self.assertEqual(data['precio'], 15000)
        self.assertTrue(data['requiere_ayuno'])
        self.assertEqual(data['preparacion'], 'Ayunar 8 horas antes.')
        self.assertIn('sed', data['sintomas'])
        self.assertEqual(data['descripcion'], 'Mide el nivel de glucosa en sangre.')
```

- [ ] **Step 4.2: Correr tests — deben FALLAR**

```bash
cd backend
python manage.py test examenes.tests.ExamenListViewTests examenes.tests.ExamenDetailViewTests
```

Esperado: `ConnectionRefused` o `404` porque las vistas no existen aún.

- [ ] **Step 4.3: Implementar serializers**

Crear `backend/examenes/serializers.py`:
```python
from rest_framework import serializers

from .models import Examen


class ExamenListSerializer(serializers.ModelSerializer):
    """Serializer ligero para el listado del catálogo de exámenes."""

    class Meta:
        model = Examen
        fields = ['slug', 'nombre', 'codigo', 'categoria', 'precio', 'sintomas']


class ExamenDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para la página de detalle de un examen."""

    class Meta:
        model = Examen
        fields = [
            'slug', 'nombre', 'codigo', 'categoria', 'precio',
            'descripcion', 'sintomas', 'requiere_ayuno', 'preparacion',
        ]
```

- [ ] **Step 4.4: Implementar views**

Crear `backend/examenes/views.py`:
```python
from rest_framework import generics, filters
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny

from .models import Examen
from .serializers import ExamenListSerializer, ExamenDetailSerializer


class ExamenPagination(PageNumberPagination):
    """Paginación que permite al cliente pedir hasta 200 resultados con ?page_size=N."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 200


class ExamenListView(generics.ListAPIView):
    """
    GET /api/examenes/

    Catálogo público de exámenes activos. Soporta:
    - ?search=texto   → filtra por nombre o código
    - ?categoria=X    → filtra por categoría exacta
    - ?page_size=N    → hasta 200 resultados por página
    """
    serializer_class = ExamenListSerializer
    permission_classes = [AllowAny]
    pagination_class = ExamenPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['nombre', 'codigo']

    def get_queryset(self):
        qs = Examen.objects.filter(activo=True)
        categoria = self.request.query_params.get('categoria')
        if categoria:
            qs = qs.filter(categoria=categoria)
        return qs


class ExamenDetailView(generics.RetrieveAPIView):
    """
    GET /api/examenes/<slug>/

    Detalle público de un examen por slug. Retorna 404 si no existe o está inactivo.
    """
    serializer_class = ExamenDetailSerializer
    permission_classes = [AllowAny]
    queryset = Examen.objects.filter(activo=True)
    lookup_field = 'slug'
```

- [ ] **Step 4.5: Implementar URLs**

Crear `backend/examenes/urls.py`:
```python
from django.urls import path

from .views import ExamenListView, ExamenDetailView

urlpatterns = [
    path('examenes/', ExamenListView.as_view(), name='examen-list'),
    path('examenes/<slug:slug>/', ExamenDetailView.as_view(), name='examen-detail'),
]
```

- [ ] **Step 4.6: Correr todos los tests de examenes — deben PASAR**

```bash
cd backend
python manage.py test examenes
```

Esperado: `OK` con todos los tests (model + API) pasando.

- [ ] **Step 4.7: Commit**

```bash
git add backend/examenes/serializers.py backend/examenes/views.py backend/examenes/urls.py backend/examenes/tests.py
git commit -m "feat(examenes): serializers, views y tests de API REST pública"
```

---

## Task 5: Admin

**Files:**
- Create: `backend/examenes/admin.py`

- [ ] **Step 5.1: Implementar admin**

Crear `backend/examenes/admin.py`:
```python
from django.contrib import admin

from .models import Examen


@admin.register(Examen)
class ExamenAdmin(admin.ModelAdmin):
    """Admin para gestionar el catálogo de exámenes de laboratorio."""

    list_display   = ['nombre', 'codigo', 'categoria', 'precio', 'activo', 'requiere_ayuno']
    list_filter    = ['categoria', 'activo', 'requiere_ayuno']
    search_fields  = ['nombre', 'codigo']
    list_editable  = ['activo']
    ordering       = ['nombre']
    prepopulated_fields = {'slug': ('nombre',)}
    fieldsets = (
        ('Identificación', {
            'fields': ('codigo', 'nombre', 'slug', 'categoria', 'activo'),
        }),
        ('Información clínica', {
            'fields': ('precio', 'descripcion', 'sintomas'),
        }),
        ('Preparación', {
            'fields': ('requiere_ayuno', 'preparacion'),
        }),
    )
```

- [ ] **Step 5.2: Verificar que el admin carga sin errores**

```bash
cd backend
python manage.py check
```

Esperado: `System check identified no issues (0 silenced).`

- [ ] **Step 5.3: Commit**

```bash
git add backend/examenes/admin.py
git commit -m "feat(examenes): registro en Django Admin con filtros y búsqueda"
```

---

## Task 6: Refactor chatbot

**Files:**
- Modify: `backend/chatbot/views.py`
- Modify: `backend/chatbot/tests.py`

- [ ] **Step 6.1: Agregar nuevos tests al chatbot (fallarán)**

Al final de `backend/chatbot/tests.py`, agregar:
```python

class BuildSystemPromptTests(TestCase):
    """Tests para _build_system_prompt() que ahora lee de la BD."""

    def test_prompt_incluye_enlace_markdown_con_slug(self):
        from examenes.models import Examen
        Examen.objects.create(
            codigo='GLU', nombre='Glucosa Basal', slug='glucosa-basal',
            precio=15000, categoria='Metabolismo', activo=True,
        )
        from chatbot.views import _build_system_prompt
        prompt = _build_system_prompt()
        self.assertIn('[Glucosa Basal](/servicios/glucosa-basal)', prompt)

    def test_prompt_excluye_examenes_inactivos(self):
        from examenes.models import Examen
        Examen.objects.create(
            codigo='INA', nombre='Examen Inactivo', slug='examen-inactivo',
            precio=0, categoria='Otras', activo=False,
        )
        from chatbot.views import _build_system_prompt
        prompt = _build_system_prompt()
        self.assertNotIn('Examen Inactivo', prompt)

    def test_prompt_con_bd_vacia_no_falla(self):
        from chatbot.views import _build_system_prompt
        prompt = _build_system_prompt()
        self.assertIsInstance(prompt, str)
        self.assertIn('BIOANALISIS', prompt)
```

- [ ] **Step 6.2: Correr nuevos tests — deben FALLAR**

```bash
cd backend
python manage.py test chatbot.tests.BuildSystemPromptTests
```

Esperado: fallan porque `chatbot.views` todavía lee del JSON.

- [ ] **Step 6.3: Refactorizar chatbot/views.py**

Reemplazar el contenido completo de `backend/chatbot/views.py`:
```python
import json
import logging

import google.generativeai as genai
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django_ratelimit.decorators import ratelimit

from examenes.models import Examen

logger = logging.getLogger('chatbot')


def _build_system_prompt() -> str:
    """Construye el system prompt leyendo los exámenes activos de la BD."""
    examenes = Examen.objects.filter(activo=True).only(
        'nombre', 'categoria', 'precio', 'sintomas', 'descripcion', 'requiere_ayuno', 'slug'
    )
    lines = [
        "Eres el asistente virtual del Laboratorio Clínico BIOANALISIS, ubicado en Quibdó, Chocó, Colombia.",
        "",
        "Tu función es:",
        "1. Orientar a los usuarios sobre qué exámenes de laboratorio podrían ser útiles según sus síntomas.",
        "2. Explicar qué mide cada examen y qué significan los resultados de manera general.",
        "3. Responder preguntas generales sobre salud relacionadas con laboratorio clínico.",
        "",
        "Reglas estrictas:",
        "- NUNCA diagnostiques enfermedades. Solo orienta y recomienda exámenes.",
        "- Siempre indica que los resultados deben ser interpretados por un médico.",
        "- Solo recomienda exámenes que aparezcan en el catálogo provisto.",
        "- Si un examen tiene precio 1, indica 'consultar precio en recepción'.",
        "- Responde siempre en español, de manera amable, clara y profesional.",
        "- Cuando recomiendes exámenes, menciona el nombre y el precio en pesos colombianos (COP).",
        "- Cuando menciones un examen, escribe su nombre como enlace markdown así: [Nombre del Examen](/servicios/slug).",
        "- Si te preguntan algo completamente ajeno a salud o laboratorio, redirige amablemente.",
        "- Si hay que estar en ayunas para un examen, indícalo claramente.",
        "",
        "Catálogo de exámenes disponibles en BIOANALISIS:",
        "",
    ]
    for examen in examenes:
        precio = examen.precio
        precio_str = "Consultar en recepción" if precio <= 1 else f"${precio:,} COP"
        sintomas = ", ".join(examen.sintomas or [])
        ayuno = " | Requiere ayuno: Sí" if examen.requiere_ayuno else ""
        lines.append(
            f"- [{examen.nombre}](/servicios/{examen.slug}) | "
            f"Categoría: {examen.categoria} | "
            f"Precio: {precio_str}{ayuno} | "
            f"Síntomas: {sintomas or 'ver descripción'} | "
            f"Descripción: {examen.descripcion}"
        )
    return "\n".join(lines)


def _get_model(system_prompt: str) -> genai.GenerativeModel:
    """Crea una instancia fresca del modelo Gemini con el system prompt dado."""
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel(
        model_name='gemini-2.5-flash',
        system_instruction=system_prompt,
        generation_config={
            'max_output_tokens': 1024,
            'temperature': 0.4,
        },
    )


@csrf_exempt
@require_POST
@ratelimit(key='ip', rate='30/h', method='POST', block=False)
def chatbot_view(request):
    if getattr(request, 'limited', False):
        return JsonResponse(
            {'error': 'Demasiadas consultas. Intenta en unos minutos.'},
            status=429,
        )

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'error': "El campo 'message' es requerido."}, status=400)

    message = (body.get('message') or '').strip()
    if not message:
        return JsonResponse({'error': "El campo 'message' es requerido."}, status=400)

    history = body.get('history', [])
    if not isinstance(history, list):
        history = []

    history = history[-20:]

    gemini_history = [
        {'role': msg['role'], 'parts': [msg.get('content', '')]}
        for msg in history
        if msg.get('role') in ('user', 'model') and msg.get('content')
    ]

    try:
        system_prompt = _build_system_prompt()
        model = _get_model(system_prompt)
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(message)
        logger.info(
            "Chatbot OK | ip=%s | chars_respuesta=%d",
            request.META.get('REMOTE_ADDR'),
            len(response.text),
        )
        return JsonResponse({'response': response.text})
    except Exception as e:
        logger.error("Chatbot Gemini error: %s", str(e))
        return JsonResponse(
            {'error': 'Servicio no disponible. Intenta de nuevo.'},
            status=503,
        )
```

- [ ] **Step 6.4: Correr todos los tests del chatbot — deben PASAR**

```bash
cd backend
python manage.py test chatbot
```

Esperado: `OK` — todos los tests pasan (los existentes siguen funcionando porque el mock de `_get_model` no depende de sus argumentos).

- [ ] **Step 6.5: Correr todos los tests del proyecto**

```bash
python manage.py test examenes chatbot
```

Esperado: todos pasan.

- [ ] **Step 6.6: Commit**

```bash
git add backend/chatbot/views.py backend/chatbot/tests.py
git commit -m "feat(chatbot): refactorizar prompt para leer exámenes desde BD con slugs markdown"
```

---

## Task 7: Frontend — refactor `/servicios/page.tsx`

**Files:**
- Modify: `frontend/app/servicios/page.tsx`

- [ ] **Step 7.1: Reemplazar el contenido completo de la página**

Reemplazar `frontend/app/servicios/page.tsx` con:
```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const CATEGORIAS = [
  'Todas',
  'Coagulación',
  'Hematología',
  'Hormonas',
  'Infectología',
  'Inmunología',
  'Metabolismo',
  'Microbiología',
  'Oncología',
  'Otras',
  'Tiroides',
];

const CATEGORIA_COLORS: Record<string, string> = {
  'Coagulación':   '#dc3545',
  'Hematología':   '#6610f2',
  'Hormonas':      '#6f42c1',
  'Infectología':  '#fd7e14',
  'Inmunología':   '#0d6efd',
  'Metabolismo':   '#198754',
  'Microbiología': '#d97706',
  'Oncología':     '#343a40',
  'Otras':         '#6c757d',
  'Tiroides':      '#0d9488',
};

interface ExamenList {
  slug: string;
  nombre: string;
  codigo: string;
  categoria: string;
  precio: number;
  sintomas: string[];
}

export default function Servicios() {
  const [examenes, setExamenes] = useState<ExamenList[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');

  useEffect(() => {
    fetch(`${API_BASE}/api/examenes/?page_size=200`)
      .then((res) => res.json())
      .then((data: { results?: ExamenList[] }) => setExamenes(data.results ?? []))
      .catch(() => setExamenes([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = examenes.filter((e) => {
    const matchSearch =
      e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategoria = categoriaActiva === 'Todas' || e.categoria === categoriaActiva;
    return matchSearch && matchCategoria;
  });

  return (
    <section
      className="section"
      style={{ background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', minHeight: '80vh' }}
    >
      <div className="container">
        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="section-title" style={{ fontSize: '2.5rem' }}>
            Catálogo de Exámenes
          </h1>
          <p
            className="section-subtitle"
            style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}
          >
            Encuentra rápidamente el examen que necesitas. Escribe el nombre o código en el
            buscador.
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ maxWidth: '600px', margin: '0 auto 2rem auto', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '15px',
              transform: 'translateY(-50%)',
              color: 'var(--text-gray)',
            }}
          >
            <i className="fas fa-search" />
          </div>
          <input
            type="text"
            placeholder="Buscar examen por nombre o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '15px 20px 15px 45px',
              borderRadius: '30px',
              border: '1px solid #ddd',
              fontSize: '1.1rem',
              outline: 'none',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
              transition: 'all 0.3s',
            }}
          />
        </div>

        {/* Category Filters */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            justifyContent: 'center',
            marginBottom: '2rem',
          }}
        >
          {CATEGORIAS.map((cat) => {
            const isActive = categoriaActiva === cat;
            const color = CATEGORIA_COLORS[cat] ?? 'var(--primary-blue)';
            return (
              <button
                key={cat}
                onClick={() => setCategoriaActiva(cat)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '20px',
                  border: `1px solid ${isActive ? color : '#ddd'}`,
                  background: isActive ? color : '#fff',
                  color: isActive ? '#fff' : '#555',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Results Count */}
        <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-gray)' }}>
          {loading
            ? 'Cargando...'
            : `Mostrando ${filtered.length} ${filtered.length === 1 ? 'examen' : 'exámenes'}`}
        </p>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <i
              className="fas fa-spinner fa-spin"
              style={{ fontSize: '2rem', color: 'var(--primary-blue)' }}
            />
          </div>
        ) : filtered.length > 0 ? (
          <div
            className="cards-grid"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          >
            {filtered.map((exam) => (
              <Link
                key={exam.slug}
                href={`/servicios/${exam.slug}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  className="service-card"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.transform = 'translateY(-4px)';
                    el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.transform = 'translateY(0)';
                    el.style.boxShadow = '';
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      background: CATEGORIA_COLORS[exam.categoria] ?? '#6c757d',
                      color: '#fff',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      marginBottom: '8px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {exam.categoria}
                  </span>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}>{exam.nombre}</h4>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#888' }}>
                    Cód: {exam.codigo}
                  </p>
                  <p
                    style={{
                      margin: '0 0 10px 0',
                      fontWeight: 600,
                      color: 'var(--primary-blue)',
                    }}
                  >
                    ${exam.precio.toLocaleString('es-CO')} COP
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {exam.sintomas.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: '#f0f4ff',
                          color: '#555',
                          fontSize: '0.72rem',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem',
              background: '#fff',
              borderRadius: '10px',
              border: '1px solid #eee',
            }}
          >
            <i
              className="fas fa-search"
              style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }}
            />
            <h3>No se encontraron resultados</h3>
            <p style={{ color: 'var(--text-gray)' }}>Intenta con otros términos de búsqueda.</p>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 7.2: Verificar manualmente**

Con el servidor backend y frontend corriendo:
1. Navegar a `/servicios`
2. Verificar que las cards cargan (91 exámenes)
3. Escribir "glucosa" en el buscador — solo deben mostrarse exámenes con esa palabra
4. Hacer clic en un chip de categoría (ej. "Hormonas") — solo deben mostrarse exámenes de esa categoría
5. Hacer clic en una card — debe navegar a `/servicios/<slug>`

- [ ] **Step 7.3: Commit**

```bash
git add frontend/app/servicios/page.tsx
git commit -m "feat(servicios): refactorizar listado para usar API con filtros por categoría"
```

---

## Task 8: Frontend — página de detalle `/servicios/[slug]`

**Files:**
- Create: `frontend/app/servicios/[slug]/page.tsx`

- [ ] **Step 8.1: Crear el directorio y el archivo**

Crear `frontend/app/servicios/[slug]/page.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const WHATSAPP_NUMBER = '573103661093';

const CATEGORIA_COLORS: Record<string, string> = {
  'Coagulación':   '#dc3545',
  'Hematología':   '#6610f2',
  'Hormonas':      '#6f42c1',
  'Infectología':  '#fd7e14',
  'Inmunología':   '#0d6efd',
  'Metabolismo':   '#198754',
  'Microbiología': '#d97706',
  'Oncología':     '#343a40',
  'Otras':         '#6c757d',
  'Tiroides':      '#0d9488',
};

interface ExamenDetail {
  slug: string;
  nombre: string;
  codigo: string;
  categoria: string;
  precio: number;
  descripcion: string;
  sintomas: string[];
  requiere_ayuno: boolean;
  preparacion: string;
}

export default function ExamenDetallePage() {
  const { slug } = useParams<{ slug: string }>();
  const [examen, setExamen] = useState<ExamenDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/examenes/${slug}/`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.json() as Promise<ExamenDetail>;
      })
      .then((data) => {
        if (data) setExamen(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <section
        className="section"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <i
          className="fas fa-spinner fa-spin"
          style={{ fontSize: '2.5rem', color: 'var(--primary-blue)' }}
        />
      </section>
    );
  }

  if (notFound || !examen) {
    return (
      <section
        className="section"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <i className="fas fa-vial" style={{ fontSize: '3rem', color: '#ccc' }} />
        <h2>Examen no encontrado</h2>
        <Link href="/servicios" style={{ color: 'var(--primary-blue)' }}>
          Volver al catálogo
        </Link>
      </section>
    );
  }

  const whatsappMsg = encodeURIComponent(`Hola, quiero agendar el examen: ${examen.nombre}`);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`;
  const badgeColor = CATEGORIA_COLORS[examen.categoria] ?? '#6c757d';

  return (
    <section
      className="section"
      style={{ background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', minHeight: '80vh' }}
    >
      <div className="container" style={{ maxWidth: '800px' }}>
        {/* Breadcrumb */}
        <nav style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: '#888' }}>
          <Link href="/" style={{ color: '#888' }}>
            Inicio
          </Link>
          {' › '}
          <Link href="/servicios" style={{ color: '#888' }}>
            Servicios
          </Link>
          {' › '}
          <span style={{ color: '#333' }}>{examen.nombre}</span>
        </nav>

        {/* Nombre */}
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{examen.nombre}</h1>

        {/* Badges */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              padding: '4px 14px',
              borderRadius: '14px',
              background: badgeColor,
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            {examen.categoria}
          </span>
          <span
            style={{
              padding: '4px 14px',
              borderRadius: '14px',
              background: '#f0f4ff',
              color: '#555',
              fontSize: '0.8rem',
            }}
          >
            Código: {examen.codigo}
          </span>
        </div>

        {/* Precio */}
        <p
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--primary-blue)',
            marginBottom: '1.5rem',
          }}
        >
          ${examen.precio.toLocaleString('es-CO')} COP
        </p>

        {/* Descripción */}
        {examen.descripcion && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              ¿Qué mide este examen?
            </h3>
            <p style={{ color: '#444', lineHeight: '1.7' }}>{examen.descripcion}</p>
          </div>
        )}

        {/* Síntomas */}
        {examen.sintomas.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Síntomas relacionados
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {examen.sintomas.map((s) => (
                <span
                  key={s}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '20px',
                    background: '#f0f4ff',
                    color: '#444',
                    fontSize: '0.85rem',
                    border: '1px solid #dce4ff',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Preparación */}
        {(examen.requiere_ayuno || examen.preparacion) && (
          <div
            style={{
              marginBottom: '2rem',
              padding: '16px 20px',
              background: '#fff8e1',
              borderRadius: '10px',
              border: '1px solid #ffe082',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <i className="fas fa-clock" style={{ marginRight: '8px', color: '#f59e0b' }} />
              Preparación
            </h3>
            {examen.requiere_ayuno && (
              <p style={{ margin: '0 0 4px 0', color: '#92400e' }}>
                <strong>Este examen requiere ayuno.</strong>
              </p>
            )}
            {examen.preparacion && (
              <p style={{ margin: 0, color: '#555' }}>{examen.preparacion}</p>
            )}
          </div>
        )}

        {/* CTA WhatsApp */}
        <Link
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 28px',
            borderRadius: '30px',
            background: '#25d366',
            color: '#fff',
            fontWeight: 600,
            fontSize: '1rem',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(37,211,102,0.35)',
            transition: 'opacity 0.2s',
          }}
        >
          <i className="fab fa-whatsapp" style={{ fontSize: '1.2rem' }} />
          Agendar por WhatsApp
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 8.2: Verificar manualmente**

Con ambos servidores corriendo:
1. Desde `/servicios`, hacer clic en cualquier card → debe navegar a `/servicios/<slug>`
2. Verificar que se muestra: nombre, badge de categoría, código, precio, descripción, síntomas como pills
3. La sección de Preparación/Ayuno solo debe aparecer si `requiere_ayuno=true` o `preparacion` no está vacío (en esta etapa todos tienen defaults vacíos, así que la sección estará oculta)
4. Hacer clic en "Agendar por WhatsApp" → debe abrir `wa.me/573103661093?text=Hola, quiero agendar el examen: NOMBRE_DEL_EXAMEN`
5. Navegar a `/servicios/slug-que-no-existe` → debe mostrarse la pantalla de "Examen no encontrado" con link de regreso

- [ ] **Step 8.3: Commit**

```bash
git add frontend/app/servicios/
git commit -m "feat(servicios): página de detalle de examen por slug con WhatsApp CTA"
```

---

## Task 9: ChatbotWidget — parser de markdown links

**Files:**
- Modify: `frontend/features/chatbot/components/ChatbotWidget.tsx`

- [ ] **Step 9.1: Agregar el import de Link y la función parseMarkdownLinks**

En `frontend/features/chatbot/components/ChatbotWidget.tsx`, agregar al inicio del archivo (después de `'use client';`):
```tsx
import Link from 'next/link';
```

Agregar la función `parseMarkdownLinks` antes de la función `ChatbotWidget`:
```tsx
function parseMarkdownLinks(text: string): React.ReactNode[] {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <Link
        key={key++}
        href={match[2]}
        style={{ color: '#93c5fd', textDecoration: 'underline' }}
      >
        {match[1]}
      </Link>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
```

- [ ] **Step 9.2: Actualizar el renderizado del bubble del bot**

En la sección de mensajes del chat, cambiar:
```tsx
{msg.content}
```

Por:
```tsx
{msg.role === 'model' ? parseMarkdownLinks(msg.content) : msg.content}
```

El bloque completo del message bubble (dentro del `.map`) debe quedar:
```tsx
{messages.map((msg, i) => (
  <div
    key={i}
    style={{
      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
      maxWidth: '82%',
      background:
        msg.role === 'user' ? 'var(--primary-blue, #0066cc)' : '#f1f3f5',
      color: msg.role === 'user' ? '#fff' : '#333',
      padding: '10px 14px',
      borderRadius:
        msg.role === 'user'
          ? '16px 16px 4px 16px'
          : '16px 16px 16px 4px',
      fontSize: '0.87rem',
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}
  >
    {msg.role === 'model' ? parseMarkdownLinks(msg.content) : msg.content}
  </div>
))}
```

- [ ] **Step 9.3: Verificar manualmente**

Con ambos servidores corriendo:
1. Abrir el chatbot
2. Escribir un mensaje como "tengo mucho cansancio y palidez"
3. La respuesta de Gemini debe recomendar exámenes con sus nombres como links clickeables
4. Al hacer clic en un link → debe navegar a `/servicios/<slug>` con la página de detalle del examen
5. Los mensajes del usuario siguen siendo texto plano sin links

- [ ] **Step 9.4: Commit**

```bash
git add frontend/features/chatbot/components/ChatbotWidget.tsx
git commit -m "feat(chatbot): parsear links markdown en respuestas del bot para navegar a detalle"
```

---

## Task 10: Limpieza — eliminar JSON duplicados

**Files:**
- Delete: `backend/chatbot/examenes.json`
- Delete: `frontend/app/data/examenes.json`
- Delete (si queda vacío): `frontend/app/data/`

- [ ] **Step 10.1: Verificar que el sistema funciona sin los JSON**

Antes de eliminar, confirmar con un check:
```bash
cd backend
python manage.py check
python manage.py test examenes chatbot
```

Esperado: todos los tests pasan (el código ya no importa los JSON).

- [ ] **Step 10.2: Eliminar los archivos**

```bash
# Desde la raíz del proyecto
git rm backend/chatbot/examenes.json
git rm frontend/app/data/examenes.json
```

Si `frontend/app/data/` queda vacío:
```bash
git rm -r frontend/app/data/
```

- [ ] **Step 10.3: Verificar que el build de Next.js no falla**

```bash
cd frontend
npm run build
```

Esperado: build exitoso sin errores de import (el `servicios/page.tsx` ya no importa el JSON).

- [ ] **Step 10.4: Correr todos los tests una última vez**

```bash
cd backend
python manage.py test examenes chatbot resultados empresas
```

Esperado: todos pasan.

- [ ] **Step 10.5: Commit final**

```bash
git add -A
git commit -m "chore: eliminar examenes.json duplicados — BD es la fuente única de verdad"
```

---

## Self-Review

**Cobertura del spec:**
- ✅ Modelo `Examen` con todos los campos especificados
- ✅ Data migration desde JSON con defaults vacíos para ayuno/preparacion
- ✅ `ExamenListSerializer` (ligero) + `ExamenDetailSerializer` (completo)
- ✅ `ExamenListView` — GET público, paginado, búsqueda + filtro por categoría
- ✅ `ExamenDetailView` — GET público por slug
- ✅ Admin con `list_display`, `list_filter`, `search_fields`
- ✅ Chatbot: prompt dinámico desde BD, sin caché, con links markdown
- ✅ `ChatbotWidget.tsx` parsea `[texto](url)` y renderiza `<Link>`
- ✅ `/servicios` con fetch a API, filtros por categoría, cards clickeables
- ✅ `/servicios/[slug]` con todos los campos del spec + WhatsApp dinámico
- ✅ Cleanup de ambos JSON

**Tipos consistentes:** `ExamenList` y `ExamenDetail` (Task 7 y 8) usan los mismos nombres de campo que los serializers (Task 4). `slug`, `nombre`, `codigo`, `categoria`, `precio`, `sintomas`, `descripcion`, `requiere_ayuno`, `preparacion`. ✅

**Sin placeholders:** todos los pasos tienen código completo. ✅
