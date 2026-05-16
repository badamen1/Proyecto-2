# Spec: Módulo de Inventario — `inventario/`

**Fecha:** 2026-05-16  
**Autor:** Bayron Mena  
**Estado:** Aprobado

---

## Contexto

El laboratorio CNG necesita controlar el stock de reactivos, consumibles y materiales de vidrio. Este módulo provee una API REST de inventario integrada al backend Django existente, siguiendo todos los patrones y convenciones del proyecto (`labclinic-refactor` skill).

El módulo NO reemplaza ningún sistema externo; es nativo del nuevo sistema.

---

## Decisiones de Diseño

| Decisión | Elección | Razón |
|---|---|---|
| Inmutabilidad `Movimiento` | Solo a nivel de views (sin endpoints PATCH/DELETE) | Consistente con el proyecto; suficiente para la escala del lab |
| Concurrencia egreso | Validación simple (sin `select_for_update`) | Bajo tráfico concurrente en contexto de laboratorio clínico |
| Permisos | Solo `role='admin'` para todos los endpoints | Inventario involucra costos y utilidades financieras |
| Estructura views | Un solo `views.py` | Coherente con el patrón de `empresas/views.py` |

---

## Modelos

### `Producto`

Catálogo de reactivos, consumibles y materiales del laboratorio.

```python
class Producto(models.Model):
    class Categoria(TextChoices):
        REACTIVO        = 'REACTIVO',        'Reactivo'
        CONSUMIBLE      = 'CONSUMIBLE',      'Consumible'
        MATERIAL_VIDRIO = 'MATERIAL_VIDRIO', 'Material de Vidrio'
        OTRO            = 'OTRO',            'Otro'

    class UnidadMedida(TextChoices):
        UNIDAD  = 'UNIDAD',   'Unidad'
        CAJA    = 'CAJA',     'Caja'
        ML      = 'ML',       'Mililitro'
        LT      = 'LT',       'Litro'
        GR      = 'GR',       'Gramo'
        PAQUETE = 'PAQUETE',  'Paquete'

    codigo             : CharField(unique=True)
    nombre             : CharField(200)
    categoria          : Categoria
    unidad_medida      : UnidadMedida
    stock_actual       : PositiveIntegerField(default=0)
    stock_minimo       : PositiveIntegerField(default=5)
    proveedor_habitual : CharField(blank=True)
    ultimo_costo       : DecimalField(10,2, null=True, blank=True)
    fecha_vencimiento  : DateField(null=True, blank=True)
    numero_lote        : CharField(blank=True)
    observaciones      : TextField(blank=True)
    activo             : BooleanField(default=True)
    fecha_registro     : DateTimeField(auto_now_add=True)
    fecha_actualizacion: DateTimeField(auto_now=True)
```

**Invariantes:**
- `stock_actual` nunca puede quedar negativo (enforced en `EgresoView`)
- `codigo` es único a nivel de base de datos (`unique=True`)
- Al crear, `stock_actual` inicia en 0 siempre

### `Movimiento`

Registro inmutable de cada transacción de inventario.

```python
class Movimiento(models.Model):
    class TipoMovimiento(TextChoices):
        INGRESO = 'INGRESO', 'Ingreso'
        EGRESO  = 'EGRESO',  'Egreso'

    producto       : FK(Producto, CASCADE)
    tipo           : TipoMovimiento
    cantidad       : PositiveIntegerField
    motivo         : CharField(200)
    registrado_por : FK(User, SET_NULL, null=True, blank=True)
    fecha_registro : DateTimeField(auto_now_add=True)
    # SIN fecha_actualizacion — inmutable por diseño
```

**Invariantes:**
- No existe endpoint PUT/PATCH/DELETE para Movimiento
- `has_change_permission = False` y `has_delete_permission = False` en Django admin
- Solo se crea a través de los endpoints `/ingreso/` o `/egreso/` de un Producto

---

## Serializers

### `ProductoListSerializer`
Campos ligeros para listados: `id`, `codigo`, `nombre`, `categoria`, `unidad_medida`, `stock_actual`, `stock_minimo`, `activo`.

### `ProductoSerializer`
Todos los campos. `read_only_fields`: `id`, `stock_actual`, `fecha_registro`, `fecha_actualizacion`.  
`stock_actual` es read-only en creación/edición directa — solo se modifica via `/ingreso/` y `/egreso/`.

### `MovimientoSerializer`
Campos: `id`, `producto`, `producto_nombre` (read-only, FK display), `tipo`, `cantidad`, `motivo`, `registrado_por`, `registrado_por_nombre` (read-only), `fecha_registro`.

### `MovimientoListSerializer`
Campos ligeros: `id`, `producto_nombre`, `tipo`, `cantidad`, `fecha_registro`.

---

## Endpoints

Todos requieren `IsAuthenticated` + `request.user.role == 'admin'`.

| # | Método | URL | View | Descripción |
|---|---|---|---|---|
| 1 | GET/POST | `/api/inventario/productos/` | `ProductoListCreateView` | Listar (paginado, buscable) / Crear |
| 2 | GET/PATCH | `/api/inventario/productos/<id>/` | `ProductoDetailView` | Detalle / Actualizar datos |
| 3 | PATCH | `/api/inventario/productos/<id>/toggle/` | `ProductoToggleView` | Activar/Desactivar |
| 4 | POST | `/api/inventario/productos/<id>/ingreso/` | `ProductoIngresoView` | Suma stock + crea Movimiento |
| 5 | POST | `/api/inventario/productos/<id>/egreso/` | `ProductoEgresoView` | Resta stock + crea Movimiento |
| 6 | GET | `/api/inventario/productos/<id>/movimientos/` | `ProductoMovimientosView` | Historial del producto (paginado) |
| 7 | GET | `/api/inventario/alertas/` | `InventarioAlertasView` | Stock bajo + vencidos/por vencer (30 días) |
| 8 | GET | `/api/inventario/movimientos/` | `MovimientoListView` | Trazabilidad global (paginado) |
| 9 | GET | `/api/inventario/movimientos/exportar/` | `MovimientoExportarView` | CSV sin paginación, con filtros |
| 10 | GET | `/api/inventario/resumen/` | `InventarioResumenView` | Contadores + últimos 5 movimientos |

### Detalle de endpoints no-CRUD

**POST `/ingreso/`**
```
Body: { "cantidad": int, "motivo": str, "fecha_vencimiento"?: date, "numero_lote"?: str, "ultimo_costo"?: decimal }
Flow: 
  1. Validar cantidad > 0
  2. producto.stock_actual += cantidad
  3. Actualizar opcionalmente: vencimiento, lote, costo
  4. Crear Movimiento(tipo=INGRESO)
  5. Log INFO: "INGRESO producto_id=X cantidad=Y admin_id=Z"
  6. Return: ProductoSerializer (estado actualizado)
```

**POST `/egreso/`**
```
Body: { "cantidad": int, "motivo": str }
Flow:
  1. Validar cantidad > 0
  2. Validar producto.stock_actual >= cantidad → 400 si no alcanza
  3. producto.stock_actual -= cantidad
  4. Crear Movimiento(tipo=EGRESO)
  5. Log INFO: "EGRESO producto_id=X cantidad=Y admin_id=Z"
  6. Return: ProductoSerializer (estado actualizado)
```

**GET `/alertas/`**
```
Response: {
  "stock_bajo": [ProductoListSerializer, ...],     # stock_actual <= stock_minimo
  "por_vencer": [ProductoListSerializer, ...],     # vence en <= 30 días
  "vencidos":   [ProductoListSerializer, ...]      # fecha_vencimiento < hoy
}
# Sin paginación — es un endpoint de alertas, se espera lista corta
```

**GET `/movimientos/exportar/`**
```
Query params: ?fecha_desde=YYYY-MM-DD&fecha_hasta=YYYY-MM-DD&producto_id=<int>
Response: text/csv
Filename: inventario_movimientos_YYYY-MM-DD.csv
Columnas: fecha_registro, producto_codigo, producto_nombre, tipo, cantidad, motivo, registrado_por
# Sin paginación — exportación completa
```

**GET `/resumen/`**
```
Response: {
  "total_productos": int,
  "stock_bajo": int,       # stock_actual <= stock_minimo
  "sin_stock": int,        # stock_actual == 0
  "vencidos": int,         # fecha_vencimiento < hoy
  "ultimos_movimientos": [MovimientoListSerializer x5]
}
```

---

## Búsqueda y Ordenamiento

**`ProductoListCreateView`:**
- `search_fields`: `['codigo', 'nombre', 'proveedor_habitual']`
- `ordering_fields`: `['nombre', 'codigo', 'stock_actual', 'fecha_registro']`
- `ordering`: `['nombre']`

**`MovimientoListView` y `ProductoMovimientosView`:**
- `search_fields`: `['producto__codigo', 'producto__nombre', 'motivo']`
- `ordering_fields`: `['fecha_registro', 'tipo']`
- `ordering`: `['-fecha_registro']`

---

## Admin Django

```python
@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display    = ['codigo', 'nombre', 'categoria', 'stock_actual', 'stock_minimo', 'activo']
    list_filter     = ['categoria', 'activo', 'unidad_medida']
    search_fields   = ['codigo', 'nombre', 'proveedor_habitual']
    readonly_fields = ['fecha_registro', 'fecha_actualizacion']

@admin.register(Movimiento)
class MovimientoAdmin(admin.ModelAdmin):
    list_display    = ['producto', 'tipo', 'cantidad', 'motivo', 'registrado_por', 'fecha_registro']
    list_filter     = ['tipo']
    search_fields   = ['producto__codigo', 'producto__nombre', 'motivo']
    readonly_fields = ['producto', 'tipo', 'cantidad', 'motivo', 'registrado_por', 'fecha_registro']

    def has_change_permission(self, request, obj=None): return False
    def has_delete_permission(self, request, obj=None): return False
```

---

## Configuración del Proyecto

### `settings.py` — Agregar logger `inventario`
```python
'inventario': {
    'handlers': ['console', 'audit_file'],
    'level': 'INFO',
    'propagate': False,
},
```

### `INSTALLED_APPS`
```python
'inventario.apps.InventarioConfig',
```

### `config/urls.py`
```python
path('api/', include('inventario.urls')),
```

---

## Archivos a Crear

```
backend/inventario/
├── __init__.py
├── apps.py
├── models.py
├── serializers.py
├── views.py
├── urls.py
├── admin.py
└── migrations/
    ├── __init__.py
    └── 0001_initial.py
```

---

## Checklist de Convenciones (labclinic-refactor skill)

- [x] Modelos con docstring en español referenciando sistema viejo
- [x] `verbose_name` en español en todos los campos
- [x] `TextChoices` para enums (Categoria, UnidadMedida, TipoMovimiento)
- [x] `fecha_registro` + `fecha_actualizacion` en Producto; solo `fecha_registro` en Movimiento
- [x] Registrados en `admin.py` con `list_display`, `search_fields`, `readonly_fields`
- [x] Serializers con `fields` explícito (nunca `__all__`)
- [x] `_nombre` read-only para relaciones FK
- [x] `ListSerializer` separado para endpoints de listado
- [x] `permission_classes` explícito en cada view
- [x] `select_related()` en querysets con FK en serializer
- [x] `search_fields` y `ordering_fields` en todas las list views
- [x] Logging a `audit.log` en ingreso, egreso y toggle
- [x] Sin SQL raw
- [x] Sin credenciales hardcodeadas
- [x] Paginación global respetada (excepto alertas, resumen y exportar CSV que son endpoints especiales)
