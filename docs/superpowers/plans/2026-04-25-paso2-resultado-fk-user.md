# Paso 2: Vincular `Resultado` directamente a `User` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir FK directa `paciente_user → User` al modelo `Resultado`, migrar los datos existentes, y actualizar vistas y serializers para filtrar por esa FK en lugar de la indirección `paciente__user`.

**Architecture:** Se añade `Resultado.paciente_user` como FK nullable a `User`. Una migración de datos copia `paciente.user → paciente_user` en todos los registros que tienen ese vínculo. El modelo `Paciente` queda intacto (su FK en `Resultado` se vuelve nullable, no se elimina). Los serializers usan `paciente_user` con fallback a `paciente` para compatibilidad con registros históricos.

**Tech Stack:** Django 5.2, djangorestframework, migraciones con RunPython

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `backend/resultados/models.py` | Modificar — añadir `paciente_user` FK, hacer `paciente` nullable |
| `backend/resultados/migrations/0003_resultado_paciente_user.py` | Crear — auto-generada + data migration |
| `backend/resultados/serializers.py` | Modificar — usar `paciente_user` para nombre/documento con fallback |
| `backend/resultados/views.py` | Modificar — filtros de paciente usan `paciente_user=user` |
| `backend/resultados/tests.py` | Modificar — añadir tests |

---

## Task 1: Añadir `paciente_user` FK y hacer `paciente` nullable

**Files:**
- Modify: `backend/resultados/models.py`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `backend/resultados/tests.py`:

```python
from django.test import TestCase
from django.contrib.auth import get_user_model
from resultados.models import Resultado, Paciente
import datetime

User = get_user_model()


class ResultadoPacienteUserTests(TestCase):

    def setUp(self):
        self.user = User.objects.create(
            username='12345678',
            documento='12345678',
            nombre_completo='Test Paciente',
            role=User.Role.PACIENTE,
        )
        self.user.set_unusable_password()
        self.user.save()

        self.paciente = Paciente.objects.create(
            documento='12345678',
            nombre_completo='Test Paciente',
            user=self.user,
        )

    def test_resultado_tiene_campo_paciente_user(self):
        """Resultado puede asignarse directamente a un User."""
        r = Resultado(
            paciente=self.paciente,
            paciente_user=self.user,
            tipo_examen='Hemograma',
            fuente='MANUAL',
            estado='VALIDADO',
            fecha_examen=datetime.date.today(),
        )
        # No debe lanzar excepción al acceder al campo
        self.assertEqual(r.paciente_user, self.user)

    def test_resultado_paciente_es_nullable(self):
        """El campo paciente acepta null (históricamente podría no tener Paciente)."""
        r = Resultado(
            paciente=None,
            paciente_user=self.user,
            tipo_examen='Hemograma',
            fuente='MANUAL',
            estado='VALIDADO',
            fecha_examen=datetime.date.today(),
        )
        self.assertIsNone(r.paciente)
```

- [ ] **Step 2: Ejecutar el test para confirmar que falla**

```bash
cd backend
python manage.py test resultados.tests.ResultadoPacienteUserTests -v 2
```

Resultado esperado: `AttributeError` — campo `paciente_user` no existe aún.

- [ ] **Step 3: Modificar el modelo**

En `backend/resultados/models.py`, hacer dos cambios:

**a)** Hacer `paciente` nullable (era `on_delete=CASCADE`, no nullable):

```python
paciente = models.ForeignKey(
    Paciente,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='resultados',
    verbose_name='Paciente'
)
```

**b)** Añadir `paciente_user` justo después del bloque de `paciente`:

```python
paciente_user = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='resultados_directos',
    verbose_name='Paciente (usuario)',
    help_text='FK directa al User del paciente. Reemplaza la indirección via Paciente.user.',
)
```

- [ ] **Step 4: Generar la migración de esquema**

```bash
cd backend
python manage.py makemigrations resultados --name="resultado_paciente_user"
```

Resultado esperado: crea `resultados/migrations/0003_resultado_paciente_user.py`.

- [ ] **Step 5: Añadir la data migration al archivo generado**

Abrir `backend/resultados/migrations/0003_resultado_paciente_user.py` y añadir la función de migración de datos **antes** de la clase `Migration`, y registrarla en `operations`:

```python
def populate_paciente_user(apps, schema_editor):
    Resultado = apps.get_model('resultados', 'Resultado')
    for r in Resultado.objects.select_related('paciente__user').filter(
        paciente__isnull=False,
        paciente__user__isnull=False,
    ):
        r.paciente_user_id = r.paciente.user_id
        r.save(update_fields=['paciente_user_id'])


def reverse_populate(apps, schema_editor):
    pass  # No hay rollback significativo para datos
```

En la clase `Migration`, dentro de `operations`, **añadir al final**:

```python
migrations.RunPython(populate_paciente_user, reverse_populate),
```

- [ ] **Step 6: Aplicar la migración**

```bash
cd backend
python manage.py migrate
```

Resultado esperado: `Applying resultados.0003_resultado_paciente_user... OK`

- [ ] **Step 7: Ejecutar los tests para confirmar que pasan**

```bash
cd backend
python manage.py test resultados.tests.ResultadoPacienteUserTests -v 2
```

Resultado esperado: 2 tests `OK`.

---

## Task 2: Actualizar vistas para usar `paciente_user`

**Files:**
- Modify: `backend/resultados/views.py`

- [ ] **Step 1: Escribir los tests de vista que fallan**

Añadir en `backend/resultados/tests.py`:

```python
from rest_framework.test import APITestCase
from rest_framework import status
import tempfile, os


class ResultadoListPacienteUserTests(APITestCase):
    """Paciente ve sus resultados via paciente_user FK (no via Paciente model)."""

    def setUp(self):
        from empresas.models import Empresa
        self.user = User.objects.create(
            username='55566677',
            documento='55566677',
            nombre_completo='Juan Pérez',
            role=User.Role.PACIENTE,
        )
        self.user.set_unusable_password()
        self.user.save()

        # Crear un resultado con paciente_user directamente (sin Paciente)
        self.resultado = Resultado.objects.create(
            paciente_user=self.user,
            tipo_examen='Glucosa',
            fuente='MANUAL',
            estado='VALIDADO',
            fecha_examen=datetime.date.today(),
            archivo_pdf=None,
        )

    def test_paciente_ve_sus_resultados_via_paciente_user(self):
        """GET /api/resultados/ retorna resultados vinculados por paciente_user."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/resultados/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [str(r['id']) for r in response.data['results']]
        self.assertIn(str(self.resultado.id), ids)

    def test_paciente_no_ve_resultados_de_otro(self):
        """Paciente solo ve sus propios resultados."""
        otro_user = User.objects.create(
            username='99988877',
            documento='99988877',
            nombre_completo='Otro Paciente',
            role=User.Role.PACIENTE,
        )
        otro_user.set_unusable_password()
        otro_user.save()

        self.client.force_authenticate(user=otro_user)
        response = self.client.get('/api/resultados/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 0)
```

- [ ] **Step 2: Ejecutar para confirmar que fallan**

```bash
cd backend
python manage.py test resultados.tests.ResultadoListPacienteUserTests -v 2
```

Resultado esperado: `FAIL` — la vista aún filtra por `paciente__user=user`.

- [ ] **Step 3: Actualizar los filtros de paciente en las vistas**

En `backend/resultados/views.py`, actualizar los tres lugares donde se filtra por `paciente__user=user`:

**`ResultadoListCreateView.get_queryset()`** — reemplazar el bloque `else`:

```python
def get_queryset(self):
    user = self.request.user
    queryset = Resultado.objects.select_related('paciente', 'paciente_user', 'subido_por', 'empresa')

    if user.role in ('admin', 'bacteriologo'):
        qs = queryset.all()
    else:
        qs = queryset.filter(
            paciente_user=user,
            estado__in=['VALIDADO', 'ENTREGADO']
        )

    fuente = self.request.query_params.get('fuente')
    estado = self.request.query_params.get('estado')
    paciente_id = self.request.query_params.get('paciente')

    if fuente:
        qs = qs.filter(fuente=fuente)
    if estado and user.role in ('admin', 'bacteriologo'):
        qs = qs.filter(estado=estado)
    if paciente_id and user.role in ('admin', 'bacteriologo'):
        qs = qs.filter(paciente_id=paciente_id)

    return qs
```

**`ResultadoDetailView.get_queryset()`** — reemplazar el bloque `else`:

```python
def get_queryset(self):
    user = self.request.user
    queryset = Resultado.objects.select_related('paciente', 'paciente_user', 'subido_por', 'empresa')

    if user.role == 'admin':
        return queryset.all()
    elif user.role == 'bacteriologo':
        return queryset.all()
    else:
        return queryset.filter(
            paciente_user=user,
            estado__in=['VALIDADO', 'ENTREGADO']
        )
```

**`ResultadoDescargarPDFView.get()`** — reemplazar el `get_object_or_404` del else:

```python
def get(self, request, pk):
    user = request.user

    if user.role in ('admin', 'bacteriologo'):
        resultado = get_object_or_404(Resultado, pk=pk)
    else:
        resultado = get_object_or_404(
            Resultado,
            pk=pk,
            paciente_user=user,
            estado__in=['VALIDADO', 'ENTREGADO']
        )

    if not resultado.archivo_pdf:
        raise Http404("Este resultado no tiene un archivo PDF asociado.")

    response = FileResponse(
        resultado.archivo_pdf.open('rb'),
        content_type=resultado.tipo_archivo or 'application/pdf'
    )
    filename = resultado.nombre_archivo or f"resultado_{pk}.pdf"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
```

- [ ] **Step 4: Ejecutar los tests**

```bash
cd backend
python manage.py test resultados.tests.ResultadoListPacienteUserTests -v 2
```

Resultado esperado: 2 tests `OK`.

---

## Task 3: Actualizar serializers para usar `paciente_user`

**Files:**
- Modify: `backend/resultados/serializers.py`

- [ ] **Step 1: Actualizar `ResultadoListSerializer`**

Reemplazar las líneas de `paciente_nombre` y `paciente_documento` en `ResultadoListSerializer` con `SerializerMethodField` que hace fallback:

```python
class ResultadoListSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.SerializerMethodField()
    paciente_documento = serializers.SerializerMethodField()
    empresa_nombre = serializers.CharField(source='empresa.nombre', read_only=True, default=None)
    nombre_archivo = serializers.ReadOnlyField()

    class Meta:
        model = Resultado
        fields = [
            'id',
            'paciente_nombre',
            'paciente_documento',
            'empresa_nombre',
            'tipo_examen',
            'fuente',
            'estado',
            'fecha_examen',
            'fecha_carga',
            'nombre_archivo',
        ]

    def get_paciente_nombre(self, obj):
        if obj.paciente_user_id:
            return obj.paciente_user.nombre_completo
        if obj.paciente_id:
            return obj.paciente.nombre_completo
        return ''

    def get_paciente_documento(self, obj):
        if obj.paciente_user_id:
            return obj.paciente_user.documento
        if obj.paciente_id:
            return obj.paciente.documento
        return ''
```

- [ ] **Step 2: Actualizar `ResultadoSerializer` (vista de detalle)**

En `ResultadoSerializer`, reemplazar las líneas de `paciente_nombre` y `paciente_documento`:

```python
paciente_nombre = serializers.SerializerMethodField()
paciente_documento = serializers.SerializerMethodField()

def get_paciente_nombre(self, obj):
    if obj.paciente_user_id:
        return obj.paciente_user.nombre_completo
    if obj.paciente_id:
        return obj.paciente.nombre_completo
    return ''

def get_paciente_documento(self, obj):
    if obj.paciente_user_id:
        return obj.paciente_user.documento
    if obj.paciente_id:
        return obj.paciente.documento
    return ''
```

Y añadir `paciente_nombre` y `paciente_documento` a `read_only_fields` si no estaban.

- [ ] **Step 3: Ejecutar todos los tests de resultados**

```bash
cd backend
python manage.py test resultados -v 2
```

Resultado esperado: todos `OK`.

- [ ] **Step 4: Ejecutar todos los tests del proyecto**

```bash
cd backend
python manage.py test -v 2
```

Resultado esperado: todos `OK`.

- [ ] **Step 5: Commit del Paso 2**

```bash
cd backend
git add resultados/models.py \
        resultados/migrations/0003_resultado_paciente_user.py \
        resultados/serializers.py \
        resultados/views.py \
        resultados/tests.py
git commit -m "$(cat <<'EOF'
feat(backend): paso 2 - Resultado con FK directa a User

- Añade Resultado.paciente_user FK a User (null=True)
- Hace Resultado.paciente nullable (SET_NULL); el modelo Paciente queda
  intacto como registro histórico
- Migración 0003 copia paciente.user → paciente_user en registros existentes
- Vistas de paciente filtran por paciente_user en lugar de paciente__user
- Serializers usan paciente_user con fallback a paciente para compatibilidad

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

**Cobertura del spec:**
- ✅ Añadir `paciente_user` FK a `Resultado` → Task 1
- ✅ Migración de datos `paciente.user → paciente_user` → Task 1 Step 5
- ✅ `Paciente` queda nullable, sin eliminar → Task 1 Step 3
- ✅ Vistas filtran por `paciente_user` → Task 2
- ✅ Serializers usan `paciente_user` con fallback → Task 3

**Placeholders:** Ninguno.

**Consistencia de tipos:**
- `paciente_user` es FK a `settings.AUTH_USER_MODEL` en el modelo. En vistas se usa `paciente_user=user` (objeto User). ✅
- `obj.paciente_user_id` (check de None sin acceder al objeto) seguido de `obj.paciente_user.nombre_completo` (acceso seguro si no es None). ✅
- `select_related('paciente_user')` añadido en vistas para evitar N+1. ✅
