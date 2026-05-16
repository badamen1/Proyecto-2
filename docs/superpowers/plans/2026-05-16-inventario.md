# Inventario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la Django app `inventario/` con modelos Producto y Movimiento, 10 endpoints REST con permisos diferenciados por rol (admin / bacteriólogo), exportación CSV y alertas de stock.

**Architecture:** App independiente siguiendo el patrón de `empresas/` — un `views.py`, serializers con separación admin/bacteriólogo para `ultimo_costo`, movimientos inmutables solo via endpoints de ingreso/egreso. Leer `.agents/skills/labclinic-refactor/SKILL.md` antes de tocar cualquier archivo.

**Tech Stack:** Django REST Framework · SimpleJWT (roles en `request.user.role`) · PostgreSQL · Python `csv` stdlib para exportación.

---

## File Map

| Acción | Archivo |
|---|---|
| Crear | `backend/inventario/__init__.py` |
| Crear | `backend/inventario/apps.py` |
| Crear | `backend/inventario/models.py` |
| Crear | `backend/inventario/serializers.py` |
| Crear | `backend/inventario/views.py` |
| Crear | `backend/inventario/urls.py` |
| Crear | `backend/inventario/admin.py` |
| Crear | `backend/inventario/tests.py` |
| Crear | `backend/inventario/migrations/__init__.py` |
| Modificar | `backend/config/settings.py` (INSTALLED_APPS + logger) |
| Modificar | `backend/config/urls.py` (include inventario.urls) |

---

## Task 1: App scaffold y configuración global

**Files:**
- Create: `backend/inventario/__init__.py`
- Create: `backend/inventario/apps.py`
- Create: `backend/inventario/migrations/__init__.py`
- Create: `backend/inventario/models.py` (vacío temporal)
- Create: `backend/inventario/serializers.py` (vacío temporal)
- Create: `backend/inventario/views.py` (vacío temporal)
- Create: `backend/inventario/urls.py` (vacío temporal)
- Create: `backend/inventario/admin.py` (vacío temporal)
- Create: `backend/inventario/tests.py` (vacío temporal)
- Modify: `backend/config/settings.py`
- Modify: `backend/config/urls.py`

- [ ] **Step 1: Crear estructura de directorios y archivos vacíos**

```bash
mkdir backend/inventario
mkdir backend/inventario/migrations
```

Crear `backend/inventario/__init__.py` (vacío):
```python
```

Crear `backend/inventario/migrations/__init__.py` (vacío):
```python
```

- [ ] **Step 2: Crear `backend/inventario/apps.py`**

```python
from django.apps import AppConfig


class InventarioConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'inventario'
    verbose_name = 'Inventario'
```

- [ ] **Step 3: Crear archivos vacíos temporales**

`backend/inventario/models.py`:
```python
from django.db import models
```

`backend/inventario/serializers.py`:
```python
```

`backend/inventario/views.py`:
```python
```

`backend/inventario/admin.py`:
```python
from django.contrib import admin
```

`backend/inventario/urls.py`:
```python
from django.urls import path

urlpatterns = []
```

`backend/inventario/tests.py`:
```python
from django.test import TestCase
```

- [ ] **Step 4: Registrar app en `backend/config/settings.py`**

En `INSTALLED_APPS`, después de `'examenes.apps.ExamenesConfig',`, agregar:
```python
    'inventario.apps.InventarioConfig',
```

En la sección `LOGGING → loggers`, después del bloque `'examenes'`, agregar:
```python
        'inventario': {
            'handlers': ['console', 'audit_file'],
            'level': 'INFO',
            'propagate': False,
        },
```

- [ ] **Step 5: Registrar URLs en `backend/config/urls.py`**

Después de `path('api/', include('examenes.urls')),`, agregar:
```python
    path('api/', include('inventario.urls')),
```

- [ ] **Step 6: Verificar que Django no reporta errores**

```bash
cd backend && python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 7: Commit del scaffold**

```bash
git add backend/inventario/ backend/config/settings.py backend/config/urls.py
git commit -m "feat(inventario): scaffold inicial de la app inventario"
```

---

## Task 2: Modelos + migraciones

**Files:**
- Modify: `backend/inventario/models.py`
- Modify: `backend/inventario/tests.py`
- Create: `backend/inventario/migrations/0001_initial.py` (generado)

- [ ] **Step 1: Escribir tests de modelo (TDD — fallarán hasta tener el modelo)**

Reemplazar `backend/inventario/tests.py` con:

```python
from datetime import date
from django.test import TestCase
from django.db import IntegrityError
from rest_framework import status
from rest_framework.test import APIClient

from users.models import User
from inventario.models import Producto, Movimiento


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def make_producto(**kwargs):
    defaults = {
        'codigo': 'R001',
        'nombre': 'Reactivo A',
        'categoria': Producto.Categoria.REACTIVO,
        'unidad_medida': Producto.UnidadMedida.ML,
    }
    defaults.update(kwargs)
    return Producto.objects.create(**defaults)


def make_admin(username='admin_test'):
    return User.objects.create_user(
        username=username, password='pass123', role='admin'
    )


def make_bacteriologo(username='bact_test'):
    return User.objects.create_user(
        username=username, password='pass123', role='bacteriologo'
    )


# ─────────────────────────────────────────────
# Modelo: Producto
# ─────────────────────────────────────────────

class ProductoModelTest(TestCase):

    def test_stock_inicial_cero(self):
        p = make_producto()
        self.assertEqual(p.stock_actual, 0)

    def test_stock_minimo_default_cinco(self):
        p = make_producto()
        self.assertEqual(p.stock_minimo, 5)

    def test_activo_default_true(self):
        p = make_producto()
        self.assertTrue(p.activo)

    def test_codigo_unico(self):
        make_producto(codigo='DUP01')
        with self.assertRaises(IntegrityError):
            make_producto(codigo='DUP01', nombre='Duplicado')

    def test_str_incluye_codigo_y_nombre(self):
        p = make_producto(codigo='RX99', nombre='Tiras reactivas')
        self.assertIn('RX99', str(p))
        self.assertIn('Tiras reactivas', str(p))


# ─────────────────────────────────────────────
# Modelo: Movimiento
# ─────────────────────────────────────────────

class MovimientoModelTest(TestCase):

    def setUp(self):
        self.admin = make_admin()
        self.producto = make_producto()

    def test_crear_movimiento_ingreso(self):
        mov = Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.INGRESO,
            cantidad=10,
            motivo='Compra inicial',
            registrado_por=self.admin,
        )
        self.assertEqual(mov.tipo, 'INGRESO')
        self.assertEqual(mov.cantidad, 10)
        self.assertIsNotNone(mov.fecha_registro)

    def test_str_movimiento(self):
        mov = Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.EGRESO,
            cantidad=3,
            motivo='Uso en análisis',
        )
        self.assertIn('EGRESO', str(mov))
        self.assertIn(self.producto.codigo, str(mov))
```

- [ ] **Step 2: Ejecutar tests — deben fallar (ImportError)**

```bash
cd backend && python manage.py test inventario.tests.ProductoModelTest -v 2
```

Expected: `ImportError: cannot import name 'Producto' from 'inventario.models'`

- [ ] **Step 3: Escribir `backend/inventario/models.py`**

```python
from django.db import models
from django.conf import settings


class Producto(models.Model):
    """
    Reactivo, consumible o material de vidrio del laboratorio clínico.

    Equivalente en sistema viejo: no existía módulo de inventario digital.
    Este modelo es nativo del nuevo sistema.
    """

    class Categoria(models.TextChoices):
        REACTIVO = 'REACTIVO', 'Reactivo'
        CONSUMIBLE = 'CONSUMIBLE', 'Consumible'
        MATERIAL_VIDRIO = 'MATERIAL_VIDRIO', 'Material de Vidrio'
        OTRO = 'OTRO', 'Otro'

    class UnidadMedida(models.TextChoices):
        UNIDAD = 'UNIDAD', 'Unidad'
        CAJA = 'CAJA', 'Caja'
        ML = 'ML', 'Mililitro'
        LT = 'LT', 'Litro'
        GR = 'GR', 'Gramo'
        PAQUETE = 'PAQUETE', 'Paquete'

    codigo = models.CharField(
        max_length=50, unique=True, verbose_name='Código'
    )
    nombre = models.CharField(
        max_length=200, verbose_name='Nombre'
    )
    categoria = models.CharField(
        max_length=20,
        choices=Categoria.choices,
        verbose_name='Categoría',
    )
    unidad_medida = models.CharField(
        max_length=10,
        choices=UnidadMedida.choices,
        verbose_name='Unidad de medida',
    )
    stock_actual = models.PositiveIntegerField(
        default=0,
        verbose_name='Stock actual',
        help_text='Solo se modifica via /ingreso/ y /egreso/.',
    )
    stock_minimo = models.PositiveIntegerField(
        default=5,
        verbose_name='Stock mínimo',
        help_text='Nivel mínimo de alerta.',
    )
    proveedor_habitual = models.CharField(
        max_length=200, blank=True, verbose_name='Proveedor habitual'
    )
    ultimo_costo = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        verbose_name='Último costo',
        help_text='Solo visible para admin.',
    )
    fecha_vencimiento = models.DateField(
        null=True, blank=True, verbose_name='Fecha de vencimiento'
    )
    numero_lote = models.CharField(
        max_length=100, blank=True, verbose_name='Número de lote'
    )
    observaciones = models.TextField(
        blank=True, verbose_name='Observaciones'
    )
    activo = models.BooleanField(
        default=True, verbose_name='Activo'
    )
    fecha_registro = models.DateTimeField(
        auto_now_add=True, verbose_name='Fecha de registro'
    )
    fecha_actualizacion = models.DateTimeField(
        auto_now=True, verbose_name='Última actualización'
    )

    class Meta:
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.codigo} — {self.nombre}"


class Movimiento(models.Model):
    """
    Registro inmutable de cada transacción de inventario.

    Equivalente en sistema viejo: no existía módulo de inventario.
    INMUTABLE: no existe endpoint PUT/PATCH/DELETE. Solo se crea
    a través de ProductoIngresoView y ProductoEgresoView.
    """

    class TipoMovimiento(models.TextChoices):
        INGRESO = 'INGRESO', 'Ingreso'
        EGRESO = 'EGRESO', 'Egreso'

    producto = models.ForeignKey(
        Producto,
        on_delete=models.CASCADE,
        related_name='movimientos',
        verbose_name='Producto',
    )
    tipo = models.CharField(
        max_length=10,
        choices=TipoMovimiento.choices,
        verbose_name='Tipo',
    )
    cantidad = models.PositiveIntegerField(
        verbose_name='Cantidad',
    )
    motivo = models.CharField(
        max_length=200, verbose_name='Motivo'
    )
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='movimientos_inventario',
        verbose_name='Registrado por',
    )
    fecha_registro = models.DateTimeField(
        auto_now_add=True, verbose_name='Fecha de registro'
    )

    class Meta:
        verbose_name = 'Movimiento'
        verbose_name_plural = 'Movimientos'
        ordering = ['-fecha_registro']

    def __str__(self):
        fecha = self.fecha_registro.strftime('%Y-%m-%d') if self.fecha_registro else '?'
        return f"{self.tipo} | {self.producto.codigo} | {self.cantidad} | {fecha}"
```

- [ ] **Step 4: Crear migración y migrar**

```bash
cd backend && python manage.py makemigrations inventario
```

Expected output (última línea): `  Create model Movimiento`

```bash
cd backend && python manage.py migrate
```

Expected: `OK` en cada línea de migración.

- [ ] **Step 5: Ejecutar tests de modelos — deben pasar**

```bash
cd backend && python manage.py test inventario.tests.ProductoModelTest inventario.tests.MovimientoModelTest -v 2
```

Expected: `Ran 7 tests in ...s` → `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/inventario/models.py backend/inventario/migrations/ backend/inventario/tests.py
git commit -m "feat(inventario): modelos Producto y Movimiento con migraciones"
```

---

## Task 3: Serializers

**Files:**
- Modify: `backend/inventario/serializers.py`
- Modify: `backend/inventario/tests.py` (agregar tests de serializers)

- [ ] **Step 1: Agregar tests de serializers a `backend/inventario/tests.py`**

Al final del archivo, agregar:

```python
# ─────────────────────────────────────────────
# Serializers
# ─────────────────────────────────────────────

from inventario.serializers import (
    ProductoListSerializer,
    ProductoSerializer,
    ProductoBacteriologoSerializer,
    MovimientoSerializer,
    MovimientoListSerializer,
)


class ProductoSerializerTest(TestCase):

    def setUp(self):
        self.producto = make_producto(
            codigo='SER01', nombre='Reactivo Serializer',
            ultimo_costo='25.50',
        )

    def test_list_serializer_excluye_ultimo_costo(self):
        data = ProductoListSerializer(self.producto).data
        self.assertNotIn('ultimo_costo', data)

    def test_list_serializer_incluye_campos_basicos(self):
        data = ProductoListSerializer(self.producto).data
        for campo in ['id', 'codigo', 'nombre', 'categoria', 'stock_actual', 'stock_minimo', 'activo']:
            self.assertIn(campo, data)

    def test_serializer_admin_incluye_ultimo_costo(self):
        data = ProductoSerializer(self.producto).data
        self.assertIn('ultimo_costo', data)
        self.assertEqual(str(data['ultimo_costo']), '25.50')

    def test_serializer_bacteriologo_excluye_ultimo_costo(self):
        data = ProductoBacteriologoSerializer(self.producto).data
        self.assertNotIn('ultimo_costo', data)

    def test_stock_actual_es_readonly(self):
        serializer = ProductoSerializer(self.producto, data={'stock_actual': 999}, partial=True)
        serializer.is_valid()
        # stock_actual no debe aparecer en validated_data al ser read_only
        self.assertNotIn('stock_actual', serializer.validated_data)


class MovimientoSerializerTest(TestCase):

    def setUp(self):
        self.admin = make_admin(username='ser_admin')
        self.producto = make_producto(codigo='MOV01')
        self.movimiento = Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.INGRESO,
            cantidad=5,
            motivo='Test serializer',
            registrado_por=self.admin,
        )

    def test_movimiento_serializer_incluye_producto_nombre(self):
        data = MovimientoSerializer(self.movimiento).data
        self.assertIn('producto_nombre', data)
        self.assertEqual(data['producto_nombre'], self.producto.nombre)

    def test_movimiento_list_serializer_incluye_codigo(self):
        data = MovimientoListSerializer(self.movimiento).data
        self.assertIn('producto_codigo', data)
        self.assertEqual(data['producto_codigo'], self.producto.codigo)
```

- [ ] **Step 2: Ejecutar tests de serializers — deben fallar (ImportError)**

```bash
cd backend && python manage.py test inventario.tests.ProductoSerializerTest -v 2
```

Expected: `ImportError: cannot import name 'ProductoListSerializer' from 'inventario.serializers'`

- [ ] **Step 3: Escribir `backend/inventario/serializers.py`**

```python
from rest_framework import serializers
from .models import Producto, Movimiento


class ProductoListSerializer(serializers.ModelSerializer):
    """Serializer ligero para listados — admin y bacteriólogo. Sin ultimo_costo."""

    class Meta:
        model = Producto
        fields = [
            'id', 'codigo', 'nombre', 'categoria', 'unidad_medida',
            'stock_actual', 'stock_minimo', 'activo',
        ]


class ProductoSerializer(serializers.ModelSerializer):
    """Serializer completo — solo para admin. Incluye ultimo_costo."""

    class Meta:
        model = Producto
        fields = [
            'id', 'codigo', 'nombre', 'categoria', 'unidad_medida',
            'stock_actual', 'stock_minimo', 'proveedor_habitual',
            'ultimo_costo', 'fecha_vencimiento', 'numero_lote',
            'observaciones', 'activo', 'fecha_registro', 'fecha_actualizacion',
        ]
        read_only_fields = ['id', 'stock_actual', 'fecha_registro', 'fecha_actualizacion']


class ProductoBacteriologoSerializer(serializers.ModelSerializer):
    """Para GET detalle por bacteriólogo — excluye ultimo_costo."""

    class Meta:
        model = Producto
        fields = [
            'id', 'codigo', 'nombre', 'categoria', 'unidad_medida',
            'stock_actual', 'stock_minimo', 'proveedor_habitual',
            'fecha_vencimiento', 'numero_lote',
            'observaciones', 'activo', 'fecha_registro', 'fecha_actualizacion',
        ]
        read_only_fields = ['id', 'stock_actual', 'fecha_registro', 'fecha_actualizacion']


class MovimientoSerializer(serializers.ModelSerializer):
    """Serializer completo con campos legibles de FK."""
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    registrado_por_nombre = serializers.CharField(
        source='registrado_por.nombre_completo', read_only=True, default=None
    )

    class Meta:
        model = Movimiento
        fields = [
            'id', 'producto', 'producto_nombre', 'tipo', 'cantidad',
            'motivo', 'registrado_por', 'registrado_por_nombre', 'fecha_registro',
        ]
        read_only_fields = ['id', 'producto_nombre', 'registrado_por_nombre', 'fecha_registro']


class MovimientoListSerializer(serializers.ModelSerializer):
    """Serializer ligero para trazabilidad global y resumen."""
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)

    class Meta:
        model = Movimiento
        fields = ['id', 'producto_codigo', 'producto_nombre', 'tipo', 'cantidad', 'fecha_registro']
```

- [ ] **Step 4: Ejecutar tests de serializers — deben pasar**

```bash
cd backend && python manage.py test inventario.tests.ProductoSerializerTest inventario.tests.MovimientoSerializerTest -v 2
```

Expected: `Ran 7 tests in ...s` → `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/inventario/serializers.py backend/inventario/tests.py
git commit -m "feat(inventario): serializers con separación admin/bacteriólogo"
```

---

## Task 4: Admin

**Files:**
- Modify: `backend/inventario/admin.py`

- [ ] **Step 1: Escribir `backend/inventario/admin.py`**

```python
from django.contrib import admin
from .models import Producto, Movimiento


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    """Admin de productos del inventario clínico."""
    list_display = ['codigo', 'nombre', 'categoria', 'unidad_medida', 'stock_actual', 'stock_minimo', 'activo']
    list_filter = ['categoria', 'activo', 'unidad_medida']
    search_fields = ['codigo', 'nombre', 'proveedor_habitual']
    readonly_fields = ['fecha_registro', 'fecha_actualizacion']


@admin.register(Movimiento)
class MovimientoAdmin(admin.ModelAdmin):
    """Admin de movimientos — solo lectura, inmutable."""
    list_display = ['producto', 'tipo', 'cantidad', 'motivo', 'registrado_por', 'fecha_registro']
    list_filter = ['tipo']
    search_fields = ['producto__codigo', 'producto__nombre', 'motivo']
    readonly_fields = ['producto', 'tipo', 'cantidad', 'motivo', 'registrado_por', 'fecha_registro']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
```

- [ ] **Step 2: Verificar check pasa**

```bash
cd backend && python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 3: Commit**

```bash
git add backend/inventario/admin.py
git commit -m "feat(inventario): admin con MovimientoAdmin inmutable"
```

---

## Task 5: CRUD de Productos (endpoints 1–3) y URLs

**Endpoints cubiertos:** GET/POST `/productos/`, GET/PATCH `/productos/<id>/`, PATCH `/productos/<id>/toggle/`

**Files:**
- Modify: `backend/inventario/views.py`
- Modify: `backend/inventario/urls.py`
- Modify: `backend/inventario/tests.py` (agregar tests CRUD)

- [ ] **Step 1: Agregar tests CRUD al final de `backend/inventario/tests.py`**

```python
# ─────────────────────────────────────────────
# Endpoints CRUD: Productos (1–3)
# ─────────────────────────────────────────────

class BaseAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = make_admin(username='api_admin')
        self.bacteriologo = make_bacteriologo(username='api_bact')
        self.producto = make_producto(codigo='API001', nombre='Reactivo API')


class ProductoListCreateTest(BaseAPITest):

    def test_no_autenticado_retorna_401(self):
        r = self.client.get('/api/inventario/productos/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_puede_listar(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/productos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('results', r.data)

    def test_bacteriologo_puede_listar(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get('/api/inventario/productos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_lista_excluye_ultimo_costo(self):
        self.cliente = self.client
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get('/api/inventario/productos/')
        self.assertNotIn('ultimo_costo', r.data['results'][0])

    def test_admin_puede_crear_producto(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post('/api/inventario/productos/', {
            'codigo': 'NUEVO01', 'nombre': 'Nuevo Reactivo',
            'categoria': 'REACTIVO', 'unidad_medida': 'ML',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Producto.objects.get(codigo='NUEVO01').stock_actual, 0)

    def test_bacteriologo_no_puede_crear(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.post('/api/inventario/productos/', {
            'codigo': 'BACT01', 'nombre': 'Test',
            'categoria': 'REACTIVO', 'unidad_medida': 'ML',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_crear_codigo_duplicado_retorna_400(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post('/api/inventario/productos/', {
            'codigo': 'API001', 'nombre': 'Duplicado',
            'categoria': 'REACTIVO', 'unidad_medida': 'ML',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


class ProductoDetailTest(BaseAPITest):

    def test_admin_ve_ultimo_costo_en_detalle(self):
        self.producto.ultimo_costo = '15.50'
        self.producto.save()
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(f'/api/inventario/productos/{self.producto.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('ultimo_costo', r.data)

    def test_bacteriologo_no_ve_ultimo_costo_en_detalle(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get(f'/api/inventario/productos/{self.producto.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertNotIn('ultimo_costo', r.data)

    def test_admin_puede_actualizar(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.patch(
            f'/api/inventario/productos/{self.producto.id}/',
            {'nombre': 'Nombre Actualizado'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.nombre, 'Nombre Actualizado')

    def test_bacteriologo_no_puede_actualizar(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.patch(
            f'/api/inventario/productos/{self.producto.id}/',
            {'nombre': 'Intento'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_stock_actual_ignorado_en_patch(self):
        self.client.force_authenticate(user=self.admin)
        self.client.patch(
            f'/api/inventario/productos/{self.producto.id}/',
            {'stock_actual': 999},
            format='json'
        )
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 0)


class ProductoToggleTest(BaseAPITest):

    def test_toggle_cambia_estado(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.patch(f'/api/inventario/productos/{self.producto.id}/toggle/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.producto.refresh_from_db()
        self.assertFalse(self.producto.activo)

    def test_toggle_doble_restaura_estado(self):
        self.client.force_authenticate(user=self.admin)
        self.client.patch(f'/api/inventario/productos/{self.producto.id}/toggle/')
        self.client.patch(f'/api/inventario/productos/{self.producto.id}/toggle/')
        self.producto.refresh_from_db()
        self.assertTrue(self.producto.activo)

    def test_bacteriologo_no_puede_toggle(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.patch(f'/api/inventario/productos/{self.producto.id}/toggle/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
```

- [ ] **Step 2: Ejecutar tests — deben fallar (404, URLs no registradas)**

```bash
cd backend && python manage.py test inventario.tests.ProductoListCreateTest -v 2
```

Expected: `AssertionError: 404 != 200` (URLs aún vacías)

- [ ] **Step 3: Escribir `backend/inventario/views.py` (CRUD endpoints)**

```python
import csv
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.db.models import F
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, filters, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import logging

from .models import Producto, Movimiento
from .serializers import (
    ProductoListSerializer,
    ProductoSerializer,
    ProductoBacteriologoSerializer,
    MovimientoSerializer,
    MovimientoListSerializer,
)

logger = logging.getLogger('inventario')

ROLES_ADMIN = ('admin',)
ROLES_OPERATIVO = ('admin', 'bacteriologo')


def _require_admin(user):
    if user.role not in ROLES_ADMIN:
        raise PermissionDenied("Solo los administradores pueden realizar esta acción.")


def _require_operativo(user):
    if user.role not in ROLES_OPERATIVO:
        raise PermissionDenied("No tiene permisos para realizar esta acción.")


# =============================================================================
# CRUD — Productos (endpoints 1–3)
# =============================================================================

class ProductoListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/inventario/productos/ → Listar (admin y bacteriólogo, sin ultimo_costo)
    POST /api/inventario/productos/ → Crear (solo admin)
    """
    permission_classes = [IsAuthenticated]
    queryset = Producto.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['codigo', 'nombre', 'proveedor_habitual']
    ordering_fields = ['nombre', 'codigo', 'stock_actual', 'fecha_registro']
    ordering = ['nombre']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ProductoSerializer
        return ProductoListSerializer

    def perform_create(self, serializer):
        _require_admin(self.request.user)
        serializer.save()


class ProductoDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/inventario/productos/<id>/ → Detalle
    PATCH /api/inventario/productos/<id>/ → Actualizar (solo admin)
    """
    permission_classes = [IsAuthenticated]
    queryset = Producto.objects.all()
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return ProductoSerializer
        if self.request.user.role in ROLES_ADMIN:
            return ProductoSerializer
        return ProductoBacteriologoSerializer

    def perform_update(self, serializer):
        _require_admin(self.request.user)
        serializer.save()


class ProductoToggleView(APIView):
    """PATCH /api/inventario/productos/<id>/toggle/ — Activar/Desactivar (solo admin)."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        _require_admin(request.user)
        producto = get_object_or_404(Producto, pk=pk)
        producto.activo = not producto.activo
        producto.save(update_fields=['activo', 'fecha_actualizacion'])
        accion = 'activado' if producto.activo else 'desactivado'
        logger.info(
            "TOGGLE %s | producto_id=%s | codigo=%s | admin_id=%s",
            accion.upper(), producto.id, producto.codigo, request.user.id
        )
        return Response({
            'detail': f"Producto '{producto.nombre}' {accion} correctamente.",
            'activo': producto.activo,
        })
```

- [ ] **Step 4: Escribir `backend/inventario/urls.py` (parcial — solo CRUD)**

```python
from django.urls import path
from . import views

urlpatterns = [
    # ── Catálogo ──────────────────────────────────────────────────
    path('inventario/productos/', views.ProductoListCreateView.as_view(), name='inventario-producto-list'),
    path('inventario/productos/<int:pk>/', views.ProductoDetailView.as_view(), name='inventario-producto-detail'),
    path('inventario/productos/<int:pk>/toggle/', views.ProductoToggleView.as_view(), name='inventario-producto-toggle'),
]
```

- [ ] **Step 5: Ejecutar tests CRUD — deben pasar**

```bash
cd backend && python manage.py test inventario.tests.ProductoListCreateTest inventario.tests.ProductoDetailTest inventario.tests.ProductoToggleTest -v 2
```

Expected: `Ran 13 tests in ...s` → `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/inventario/views.py backend/inventario/urls.py backend/inventario/tests.py
git commit -m "feat(inventario): endpoints CRUD productos (listar, detalle, toggle)"
```

---

## Task 6: Ingreso, Egreso e Historial (endpoints 4–6)

**Endpoints:** POST `/productos/<id>/ingreso/`, POST `/productos/<id>/egreso/`, GET `/productos/<id>/movimientos/`

**Files:**
- Modify: `backend/inventario/views.py` (append)
- Modify: `backend/inventario/urls.py` (append)
- Modify: `backend/inventario/tests.py` (append)

- [ ] **Step 1: Agregar tests de ingreso/egreso/historial al final de `backend/inventario/tests.py`**

```python
# ─────────────────────────────────────────────
# Endpoints: Ingreso y Egreso (4–6)
# ─────────────────────────────────────────────

class ProductoIngresoTest(BaseAPITest):

    def test_ingreso_suma_stock(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 10, 'motivo': 'Compra inicial'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 10)

    def test_ingreso_crea_movimiento_tipo_ingreso(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 5, 'motivo': 'Compra'},
            format='json'
        )
        mov = Movimiento.objects.get(producto=self.producto)
        self.assertEqual(mov.tipo, Movimiento.TipoMovimiento.INGRESO)
        self.assertEqual(mov.cantidad, 5)
        self.assertEqual(mov.registrado_por, self.admin)

    def test_ingreso_actualiza_ultimo_costo(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 10, 'motivo': 'Compra', 'ultimo_costo': '25.50'},
            format='json'
        )
        self.producto.refresh_from_db()
        self.assertEqual(str(self.producto.ultimo_costo), '25.50')

    def test_ingreso_actualiza_vencimiento_y_lote(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 10, 'motivo': 'Compra', 'fecha_vencimiento': '2027-12-31', 'numero_lote': 'L-2024'},
            format='json'
        )
        self.producto.refresh_from_db()
        self.assertEqual(str(self.producto.fecha_vencimiento), '2027-12-31')
        self.assertEqual(self.producto.numero_lote, 'L-2024')

    def test_bacteriologo_no_puede_ingresar(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 5, 'motivo': 'Test'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_cantidad_cero_retorna_400(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 0, 'motivo': 'Test'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sin_motivo_retorna_400(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 5, 'motivo': ''},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_respuesta_incluye_ultimo_costo_para_admin(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 10, 'motivo': 'Compra', 'ultimo_costo': '10.00'},
            format='json'
        )
        self.assertIn('ultimo_costo', r.data)


class ProductoEgresoTest(BaseAPITest):

    def setUp(self):
        super().setUp()
        self.producto.stock_actual = 10
        self.producto.save()

    def test_egreso_resta_stock(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/egreso/',
            {'cantidad': 3, 'motivo': 'Uso en análisis'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 7)

    def test_egreso_stock_insuficiente_retorna_400(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/egreso/',
            {'cantidad': 20, 'motivo': 'Test'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Stock insuficiente', r.data['detail'])

    def test_egreso_crea_movimiento_tipo_egreso(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(
            f'/api/inventario/productos/{self.producto.id}/egreso/',
            {'cantidad': 4, 'motivo': 'Análisis hemograma'},
            format='json'
        )
        mov = Movimiento.objects.get(producto=self.producto)
        self.assertEqual(mov.tipo, Movimiento.TipoMovimiento.EGRESO)
        self.assertEqual(mov.cantidad, 4)

    def test_bacteriologo_puede_egresar(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/egreso/',
            {'cantidad': 2, 'motivo': 'Análisis'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_bacteriologo_egreso_no_ve_ultimo_costo(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/egreso/',
            {'cantidad': 1, 'motivo': 'Test'},
            format='json'
        )
        self.assertNotIn('ultimo_costo', r.data)

    def test_cantidad_cero_retorna_400(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/egreso/',
            {'cantidad': 0, 'motivo': 'Test'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


class ProductoMovimientosTest(BaseAPITest):

    def setUp(self):
        super().setUp()
        Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.INGRESO,
            cantidad=10, motivo='Setup ingreso',
        )

    def test_admin_ve_historial(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(f'/api/inventario/productos/{self.producto.id}/movimientos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['count'], 1)

    def test_bacteriologo_ve_historial(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get(f'/api/inventario/productos/{self.producto.id}/movimientos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_historial_incluye_producto_nombre(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(f'/api/inventario/productos/{self.producto.id}/movimientos/')
        self.assertIn('producto_nombre', r.data['results'][0])
```

- [ ] **Step 2: Ejecutar tests — deben fallar (404)**

```bash
cd backend && python manage.py test inventario.tests.ProductoIngresoTest -v 2
```

Expected: `AssertionError: 404 != 200`

- [ ] **Step 3: Agregar vistas de ingreso/egreso/historial al final de `backend/inventario/views.py`**

```python
# =============================================================================
# INGRESO / EGRESO / HISTORIAL (endpoints 4–6)
# =============================================================================

class ProductoIngresoView(APIView):
    """POST /api/inventario/productos/<id>/ingreso/ — Suma stock (solo admin)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        _require_admin(request.user)
        producto = get_object_or_404(Producto, pk=pk)

        motivo = request.data.get('motivo', '').strip()
        if not motivo:
            return Response({'detail': 'El motivo es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cantidad = int(request.data.get('cantidad', 0))
            if cantidad <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'detail': 'La cantidad debe ser un entero positivo.'}, status=status.HTTP_400_BAD_REQUEST)

        producto.stock_actual += cantidad
        update_fields = ['stock_actual', 'fecha_actualizacion']

        fecha_vencimiento = request.data.get('fecha_vencimiento')
        numero_lote = request.data.get('numero_lote')
        ultimo_costo = request.data.get('ultimo_costo')

        if fecha_vencimiento is not None:
            producto.fecha_vencimiento = fecha_vencimiento
            update_fields.append('fecha_vencimiento')
        if numero_lote is not None:
            producto.numero_lote = numero_lote
            update_fields.append('numero_lote')
        if ultimo_costo is not None:
            try:
                producto.ultimo_costo = Decimal(str(ultimo_costo))
            except InvalidOperation:
                return Response({'detail': 'El costo debe ser un número decimal válido.'}, status=status.HTTP_400_BAD_REQUEST)
            update_fields.append('ultimo_costo')

        producto.save(update_fields=update_fields)

        Movimiento.objects.create(
            producto=producto,
            tipo=Movimiento.TipoMovimiento.INGRESO,
            cantidad=cantidad,
            motivo=motivo,
            registrado_por=request.user,
        )

        logger.info(
            "INGRESO | producto_id=%s | codigo=%s | cantidad=%s | admin_id=%s",
            producto.id, producto.codigo, cantidad, request.user.id
        )
        return Response(ProductoSerializer(producto).data)


class ProductoEgresoView(APIView):
    """POST /api/inventario/productos/<id>/egreso/ — Resta stock (admin y bacteriólogo)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        _require_operativo(request.user)
        producto = get_object_or_404(Producto, pk=pk)

        motivo = request.data.get('motivo', '').strip()
        if not motivo:
            return Response({'detail': 'El motivo es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cantidad = int(request.data.get('cantidad', 0))
            if cantidad <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'detail': 'La cantidad debe ser un entero positivo.'}, status=status.HTTP_400_BAD_REQUEST)

        if producto.stock_actual < cantidad:
            return Response(
                {'detail': f'Stock insuficiente. Stock actual: {producto.stock_actual}, solicitado: {cantidad}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        producto.stock_actual -= cantidad
        producto.save(update_fields=['stock_actual', 'fecha_actualizacion'])

        Movimiento.objects.create(
            producto=producto,
            tipo=Movimiento.TipoMovimiento.EGRESO,
            cantidad=cantidad,
            motivo=motivo,
            registrado_por=request.user,
        )

        logger.info(
            "EGRESO | producto_id=%s | codigo=%s | cantidad=%s | user_id=%s | role=%s",
            producto.id, producto.codigo, cantidad, request.user.id, request.user.role
        )

        serializer_class = ProductoSerializer if request.user.role in ROLES_ADMIN else ProductoBacteriologoSerializer
        return Response(serializer_class(producto).data)


class ProductoMovimientosView(generics.ListAPIView):
    """GET /api/inventario/productos/<id>/movimientos/ — Historial (admin y bacteriólogo)."""
    permission_classes = [IsAuthenticated]
    serializer_class = MovimientoSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['fecha_registro', 'tipo']
    ordering = ['-fecha_registro']

    def get_queryset(self):
        _require_operativo(self.request.user)
        producto = get_object_or_404(Producto, pk=self.kwargs['pk'])
        return Movimiento.objects.filter(producto=producto).select_related('producto', 'registrado_por')
```

- [ ] **Step 4: Agregar URLs de ingreso/egreso/historial a `backend/inventario/urls.py`**

Después del último `path` existente, agregar:

```python
    # ── Movimientos por producto ───────────────────────────────────
    path('inventario/productos/<int:pk>/ingreso/', views.ProductoIngresoView.as_view(), name='inventario-producto-ingreso'),
    path('inventario/productos/<int:pk>/egreso/', views.ProductoEgresoView.as_view(), name='inventario-producto-egreso'),
    path('inventario/productos/<int:pk>/movimientos/', views.ProductoMovimientosView.as_view(), name='inventario-producto-movimientos'),
```

- [ ] **Step 5: Ejecutar tests de ingreso/egreso/historial — deben pasar**

```bash
cd backend && python manage.py test inventario.tests.ProductoIngresoTest inventario.tests.ProductoEgresoTest inventario.tests.ProductoMovimientosTest -v 2
```

Expected: `Ran 16 tests in ...s` → `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/inventario/views.py backend/inventario/urls.py backend/inventario/tests.py
git commit -m "feat(inventario): endpoints ingreso, egreso e historial de movimientos"
```

---

## Task 7: Reportes (endpoints 7–10) y URLs completas

**Endpoints:** GET `/alertas/`, GET `/movimientos/`, GET `/movimientos/exportar/`, GET `/resumen/`

**Files:**
- Modify: `backend/inventario/views.py` (append)
- Modify: `backend/inventario/urls.py` (completar)
- Modify: `backend/inventario/tests.py` (append)

- [ ] **Step 1: Agregar tests de reportes al final de `backend/inventario/tests.py`**

```python
# ─────────────────────────────────────────────
# Endpoints: Reportes (7–10)
# ─────────────────────────────────────────────

class InventarioAlertasTest(BaseAPITest):

    def test_alerta_stock_bajo(self):
        self.producto.stock_actual = 3  # stock_minimo=5 → stock_bajo
        self.producto.save()
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/alertas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        codigos_bajos = [p['codigo'] for p in r.data['stock_bajo']]
        self.assertIn('API001', codigos_bajos)

    def test_alerta_stock_igual_a_minimo_aparece(self):
        self.producto.stock_actual = 5  # igual al minimo
        self.producto.save()
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/alertas/')
        codigos_bajos = [p['codigo'] for p in r.data['stock_bajo']]
        self.assertIn('API001', codigos_bajos)

    def test_alerta_vencido(self):
        self.producto.fecha_vencimiento = date.today() - timedelta(days=1)
        self.producto.save()
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/alertas/')
        codigos_vencidos = [p['codigo'] for p in r.data['vencidos']]
        self.assertIn('API001', codigos_vencidos)

    def test_alerta_por_vencer(self):
        self.producto.fecha_vencimiento = date.today() + timedelta(days=15)
        self.producto.save()
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/alertas/')
        codigos_por_vencer = [p['codigo'] for p in r.data['por_vencer']]
        self.assertIn('API001', codigos_por_vencer)

    def test_bacteriologo_puede_ver_alertas(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get('/api/inventario/alertas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('stock_bajo', r.data)
        self.assertIn('vencidos', r.data)
        self.assertIn('por_vencer', r.data)


class MovimientoListTest(BaseAPITest):

    def setUp(self):
        super().setUp()
        Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.INGRESO,
            cantidad=10, motivo='Compra',
            registrado_por=self.admin,
        )

    def test_admin_puede_listar_movimientos(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/movimientos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['count'], 1)

    def test_bacteriologo_puede_listar_movimientos(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get('/api/inventario/movimientos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_busqueda_por_codigo_producto(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/movimientos/?search=API001')
        self.assertEqual(r.data['count'], 1)
        r2 = self.client.get('/api/inventario/movimientos/?search=NOEXISTE')
        self.assertEqual(r2.data['count'], 0)


class MovimientoExportarTest(BaseAPITest):

    def setUp(self):
        super().setUp()
        Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.INGRESO,
            cantidad=10, motivo='Compra exportar',
            registrado_por=self.admin,
        )

    def test_bacteriologo_no_puede_exportar(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get('/api/inventario/movimientos/exportar/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_exporta_csv(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/movimientos/exportar/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', r['Content-Type'])
        content = r.content.decode('utf-8-sig')
        self.assertIn('API001', content)
        self.assertIn('Compra exportar', content)

    def test_exportar_csv_tiene_encabezados(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/movimientos/exportar/')
        content = r.content.decode('utf-8-sig')
        for col in ['Fecha', 'Código Producto', 'Tipo', 'Cantidad', 'Motivo']:
            self.assertIn(col, content)

    def test_filtro_por_producto_id(self):
        otro = make_producto(codigo='OTRO01', nombre='Otro producto')
        Movimiento.objects.create(producto=otro, tipo='INGRESO', cantidad=5, motivo='Otro')
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(f'/api/inventario/movimientos/exportar/?producto_id={self.producto.id}')
        content = r.content.decode('utf-8-sig')
        self.assertIn('API001', content)
        self.assertNotIn('OTRO01', content)


class InventarioResumenTest(BaseAPITest):

    def test_bacteriologo_no_puede_ver_resumen(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get('/api/inventario/resumen/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_resumen_contiene_campos_requeridos(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/resumen/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        for campo in ['total_productos', 'stock_bajo', 'sin_stock', 'vencidos', 'ultimos_movimientos']:
            self.assertIn(campo, r.data)

    def test_resumen_sin_stock_cuenta_correctamente(self):
        # producto con stock=0 (default)
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/resumen/')
        self.assertGreaterEqual(r.data['sin_stock'], 1)

    def test_resumen_ultimos_movimientos_max_5(self):
        for i in range(7):
            Movimiento.objects.create(
                producto=self.producto,
                tipo=Movimiento.TipoMovimiento.INGRESO,
                cantidad=1, motivo=f'Movimiento {i}',
            )
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/resumen/')
        self.assertLessEqual(len(r.data['ultimos_movimientos']), 5)
```

- [ ] **Step 2: Ejecutar tests — deben fallar (404)**

```bash
cd backend && python manage.py test inventario.tests.InventarioAlertasTest -v 2
```

Expected: `AssertionError: 404 != 200`

- [ ] **Step 3: Agregar vistas de reportes al final de `backend/inventario/views.py`**

```python
# =============================================================================
# REPORTES (endpoints 7–10)
# =============================================================================

class InventarioAlertasView(APIView):
    """GET /api/inventario/alertas/ — Stock bajo + vencidos/por vencer (admin y bacteriólogo)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_operativo(request.user)
        hoy = date.today()
        limite_vencimiento = hoy + timedelta(days=30)

        stock_bajo = Producto.objects.filter(activo=True, stock_actual__lte=F('stock_minimo'))
        vencidos = Producto.objects.filter(activo=True, fecha_vencimiento__lt=hoy)
        por_vencer = Producto.objects.filter(
            activo=True,
            fecha_vencimiento__gte=hoy,
            fecha_vencimiento__lte=limite_vencimiento,
        )

        return Response({
            'stock_bajo': ProductoListSerializer(stock_bajo, many=True).data,
            'vencidos': ProductoListSerializer(vencidos, many=True).data,
            'por_vencer': ProductoListSerializer(por_vencer, many=True).data,
        })


class MovimientoListView(generics.ListAPIView):
    """GET /api/inventario/movimientos/ — Trazabilidad global (admin y bacteriólogo)."""
    permission_classes = [IsAuthenticated]
    serializer_class = MovimientoListSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['producto__codigo', 'producto__nombre', 'motivo']
    ordering_fields = ['fecha_registro', 'tipo']
    ordering = ['-fecha_registro']

    def get_queryset(self):
        _require_operativo(self.request.user)
        return Movimiento.objects.select_related('producto', 'registrado_por').all()


class MovimientoExportarView(APIView):
    """GET /api/inventario/movimientos/exportar/ — CSV (solo admin)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_admin(request.user)

        qs = Movimiento.objects.select_related('producto', 'registrado_por').order_by('-fecha_registro')

        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')
        producto_id = request.query_params.get('producto_id')

        if fecha_desde:
            qs = qs.filter(fecha_registro__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_registro__date__lte=fecha_hasta)
        if producto_id:
            qs = qs.filter(producto_id=producto_id)

        nombre_archivo = f"inventario_movimientos_{date.today():%Y-%m-%d}.csv"
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
        response.write('﻿')  # BOM para compatibilidad con Excel

        writer = csv.writer(response)
        writer.writerow(['Fecha', 'Código Producto', 'Nombre Producto', 'Tipo', 'Cantidad', 'Motivo', 'Registrado Por'])
        for mov in qs:
            writer.writerow([
                mov.fecha_registro.strftime('%Y-%m-%d %H:%M'),
                mov.producto.codigo,
                mov.producto.nombre,
                mov.get_tipo_display(),
                mov.cantidad,
                mov.motivo,
                mov.registrado_por.nombre_completo if mov.registrado_por else '',
            ])

        logger.info(
            "EXPORTAR CSV | admin_id=%s | fecha_desde=%s | fecha_hasta=%s | producto_id=%s",
            request.user.id, fecha_desde, fecha_hasta, producto_id
        )
        return response


class InventarioResumenView(APIView):
    """GET /api/inventario/resumen/ — Contadores + últimos 5 movimientos (solo admin)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_admin(request.user)
        hoy = date.today()

        return Response({
            'total_productos': Producto.objects.filter(activo=True).count(),
            'stock_bajo': Producto.objects.filter(activo=True, stock_actual__lte=F('stock_minimo')).count(),
            'sin_stock': Producto.objects.filter(activo=True, stock_actual=0).count(),
            'vencidos': Producto.objects.filter(activo=True, fecha_vencimiento__lt=hoy).count(),
            'ultimos_movimientos': MovimientoListSerializer(
                Movimiento.objects.select_related('producto').order_by('-fecha_registro')[:5],
                many=True
            ).data,
        })
```

- [ ] **Step 4: Reemplazar `backend/inventario/urls.py` con la versión completa**

```python
from django.urls import path
from . import views

urlpatterns = [
    # ── Catálogo ──────────────────────────────────────────────────
    path('inventario/productos/', views.ProductoListCreateView.as_view(), name='inventario-producto-list'),
    path('inventario/productos/<int:pk>/', views.ProductoDetailView.as_view(), name='inventario-producto-detail'),
    path('inventario/productos/<int:pk>/toggle/', views.ProductoToggleView.as_view(), name='inventario-producto-toggle'),

    # ── Movimientos por producto ───────────────────────────────────
    path('inventario/productos/<int:pk>/ingreso/', views.ProductoIngresoView.as_view(), name='inventario-producto-ingreso'),
    path('inventario/productos/<int:pk>/egreso/', views.ProductoEgresoView.as_view(), name='inventario-producto-egreso'),
    path('inventario/productos/<int:pk>/movimientos/', views.ProductoMovimientosView.as_view(), name='inventario-producto-movimientos'),

    # ── Reportes ──────────────────────────────────────────────────
    path('inventario/alertas/', views.InventarioAlertasView.as_view(), name='inventario-alertas'),
    # exportar ANTES de movimientos/ para que Django no lo confunda con <pk>
    path('inventario/movimientos/exportar/', views.MovimientoExportarView.as_view(), name='inventario-movimiento-exportar'),
    path('inventario/movimientos/', views.MovimientoListView.as_view(), name='inventario-movimiento-list'),
    path('inventario/resumen/', views.InventarioResumenView.as_view(), name='inventario-resumen'),
]
```

- [ ] **Step 5: Ejecutar TODOS los tests del módulo**

```bash
cd backend && python manage.py test inventario -v 2
```

Expected: `Ran 49 tests in ...s` → `OK` (el número exacto puede variar ±2)

- [ ] **Step 6: Commit**

```bash
git add backend/inventario/views.py backend/inventario/urls.py backend/inventario/tests.py
git commit -m "feat(inventario): endpoints reportes (alertas, trazabilidad, CSV, resumen)"
```

---

## Task 8: Verificación final

**Files:** ninguno nuevo

- [ ] **Step 1: Django system check**

```bash
cd backend && python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 2: Suite de tests completa**

```bash
cd backend && python manage.py test inventario -v 2
```

Expected: todos los tests en `OK`. Si hay fallos, leer el traceback y corregir antes de continuar.

- [ ] **Step 3: Verificar que los tests del resto del proyecto no se rompieron**

```bash
cd backend && python manage.py test --exclude-tag=slow 2>&1 | tail -5
```

Expected: `OK` o solo warnings, sin `FAIL` ni `ERROR` en el módulo inventario.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat(inventario): módulo completo — modelos, serializers, 10 endpoints, admin"
```

---

## Resumen de Archivos

| Archivo | Estado |
|---|---|
| `backend/inventario/__init__.py` | Creado |
| `backend/inventario/apps.py` | Creado |
| `backend/inventario/models.py` | Creado (Producto + Movimiento) |
| `backend/inventario/serializers.py` | Creado (5 serializers) |
| `backend/inventario/views.py` | Creado (10 endpoints) |
| `backend/inventario/urls.py` | Creado (10 URLs) |
| `backend/inventario/admin.py` | Creado (2 ModelAdmin) |
| `backend/inventario/tests.py` | Creado (~50 tests) |
| `backend/inventario/migrations/0001_initial.py` | Generado |
| `backend/config/settings.py` | Modificado (INSTALLED_APPS + logger) |
| `backend/config/urls.py` | Modificado (include inventario.urls) |
