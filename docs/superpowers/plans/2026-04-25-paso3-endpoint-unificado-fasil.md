# Paso 3: Endpoint unificado FASIL + resultados manuales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `GET /api/resultados/` combina resultados de nuestra BD con órdenes de FASIL en una sola lista paginada. Si FASIL falla, retorna solo los manuales sin error. El endpoint de PDF maneja IDs con prefijo `"fasil-"` delegando a `fasil_service.get_resultado_pdf()`.

**Architecture:** Se sobreescribe `list()` en `ResultadoListCreateView` para pacientes: consulta FASIL secuencialmente, combina con resultados de BD, ordena y pagina. Se crea `ResultadoUnificadoSerializer` para serializar ítems de ambas fuentes. El URL pattern del PDF cambia de `<int:pk>` a `<str:pk>`. Los IDs siempre son string en la respuesta.

**Tech Stack:** Django 5.2, djangorestframework, fasil_service (ya implementado en `resultados/services/fasil_service.py`)

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `backend/resultados/serializers.py` | Modificar — añadir `ResultadoUnificadoSerializer` |
| `backend/resultados/views.py` | Modificar — `list()` con FASIL + `pdf()` con prefijo |
| `backend/resultados/urls.py` | Modificar — `<int:pk>` → `<str:pk>` en PDF endpoint |
| `backend/resultados/tests.py` | Modificar — tests con mock de fasil_service |

---

## Task 1: Serializer unificado

**Files:**
- Modify: `backend/resultados/serializers.py`

- [ ] **Step 1: Añadir `ResultadoUnificadoSerializer` al final del archivo**

Añadir al final de `backend/resultados/serializers.py`:

```python
class ResultadoUnificadoSerializer(serializers.Serializer):
    """
    Serializer de solo lectura para la vista unificada paciente.
    Representa tanto un Resultado de BD como una OrdenFASIL.

    Invariante: el campo 'id' siempre es string.
    - Resultado de BD: str(resultado.pk)  → "15"
    - Orden FASIL:     "fasil-" + id_orden → "fasil-ORD-42"
    """
    id = serializers.CharField(read_only=True)
    tipo_examen = serializers.CharField(read_only=True)
    fecha_examen = serializers.CharField(read_only=True)
    estado = serializers.CharField(read_only=True)
    fuente = serializers.CharField(read_only=True)
    nombre_archivo = serializers.CharField(read_only=True, allow_null=True)
    tiene_pdf = serializers.BooleanField(read_only=True)
```

- [ ] **Step 2: Verificar que el serializer importa correctamente**

```bash
cd backend
python manage.py shell -c "from resultados.serializers import ResultadoUnificadoSerializer; print('OK')"
```

Resultado esperado: `OK`

---

## Task 2: Función helper para construir ítems unificados

**Files:**
- Modify: `backend/resultados/views.py`

- [ ] **Step 1: Añadir el helper `_resultado_a_dict` y `_orden_fasil_a_dict` en views.py**

Añadir estas dos funciones **antes** de la clase `ResultadoListCreateView` en `backend/resultados/views.py`. También añadir el import de FASIL al bloque de imports existente:

```python
from .services.fasil_service import (
    fasil_service,
    FasilPacienteNoEncontrado,
    FasilConexionError,
)
```

Luego las funciones helper:

```python
def _resultado_a_dict(resultado):
    """Convierte un Resultado de BD al formato de lista unificada."""
    return {
        'id': str(resultado.pk),
        'tipo_examen': resultado.tipo_examen,
        'fecha_examen': str(resultado.fecha_examen),
        'estado': resultado.estado,
        'fuente': resultado.fuente,
        'nombre_archivo': resultado.nombre_archivo,
        'tiene_pdf': bool(resultado.archivo_pdf),
    }


def _orden_fasil_a_dict(orden):
    """Convierte una OrdenFASIL al formato de lista unificada."""
    return {
        'id': f'fasil-{orden.id_orden}',
        'tipo_examen': orden.tipo_examen,
        'fecha_examen': orden.fecha_examen,
        'estado': 'ENTREGADO',
        'fuente': 'FASIL',
        'nombre_archivo': None,
        'tiene_pdf': orden.tiene_pdf,
    }
```

- [ ] **Step 2: Escribir el test que falla**

Añadir en `backend/resultados/tests.py`:

```python
from unittest.mock import patch, MagicMock
from resultados.services.fasil_service import (
    PacienteFASIL, OrdenFASIL, FasilPacienteNoEncontrado, FasilConexionError
)
import datetime


class ResultadoListUnificadoTests(APITestCase):
    """GET /api/resultados/ combina BD + FASIL para el paciente."""

    def setUp(self):
        self.user = User.objects.create(
            username='44455566',
            documento='44455566',
            nombre_completo='Lucía Gómez',
            role=User.Role.PACIENTE,
        )
        self.user.set_unusable_password()
        self.user.save()

        self.resultado_manual = Resultado.objects.create(
            paciente_user=self.user,
            tipo_examen='Glucosa',
            fuente='MANUAL',
            estado='VALIDADO',
            fecha_examen=datetime.date(2026, 3, 1),
            archivo_pdf=None,
        )
        self.client.force_authenticate(user=self.user)

    @patch('resultados.views.fasil_service.get_paciente')
    @patch('resultados.views.fasil_service.get_ordenes')
    def test_lista_combina_manual_y_fasil(self, mock_ordenes, mock_paciente):
        """La lista incluye resultados manuales y órdenes FASIL."""
        mock_paciente.return_value = PacienteFASIL(
            id_fasil='42',
            documento='44455566',
            tipo_documento='CC',
            nombre_completo='Lucía Gómez',
        )
        mock_ordenes.return_value = [
            OrdenFASIL(
                id_orden='ORD-99',
                paciente_id='42',
                tipo_examen='Hemograma',
                fecha_examen='2026-04-10',
                tiene_pdf=True,
            )
        ]

        response = self.client.get('/api/resultados/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ids = [r['id'] for r in response.data['results']]
        self.assertIn(str(self.resultado_manual.pk), ids)
        self.assertIn('fasil-ORD-99', ids)

    @patch('resultados.views.fasil_service.get_paciente')
    def test_fasil_caido_retorna_solo_manuales(self, mock_paciente):
        """Si FASIL lanza FasilConexionError, retorna solo resultados manuales sin 500."""
        mock_paciente.side_effect = FasilConexionError('timeout')

        response = self.client.get('/api/resultados/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [r['id'] for r in response.data['results']]
        self.assertIn(str(self.resultado_manual.pk), ids)
        self.assertNotIn(True, ['fasil-' in i for i in ids])

    @patch('resultados.views.fasil_service.get_paciente')
    def test_paciente_no_en_fasil_retorna_solo_manuales(self, mock_paciente):
        """Si paciente no existe en FASIL, retorna solo resultados manuales sin error."""
        mock_paciente.side_effect = FasilPacienteNoEncontrado('no encontrado')

        response = self.client.get('/api/resultados/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['id'], str(self.resultado_manual.pk))

    @patch('resultados.views.fasil_service.get_paciente')
    @patch('resultados.views.fasil_service.get_ordenes')
    def test_ids_siempre_son_string(self, mock_ordenes, mock_paciente):
        """Todos los ids en la respuesta son strings."""
        mock_paciente.return_value = PacienteFASIL(
            id_fasil='42', documento='44455566',
            tipo_documento='CC', nombre_completo='Lucía Gómez',
        )
        mock_ordenes.return_value = []

        response = self.client.get('/api/resultados/')
        for item in response.data['results']:
            self.assertIsInstance(item['id'], str)
```

- [ ] **Step 3: Ejecutar para confirmar que fallan**

```bash
cd backend
python manage.py test resultados.tests.ResultadoListUnificadoTests -v 2
```

Resultado esperado: `FAIL` o `ERROR` — `list()` aún no consulta FASIL.

---

## Task 3: Sobreescribir `list()` en `ResultadoListCreateView`

**Files:**
- Modify: `backend/resultados/views.py`

- [ ] **Step 1: Añadir el método `list()` en `ResultadoListCreateView`**

Añadir este método dentro de la clase `ResultadoListCreateView`, **después** de `perform_create`:

```python
def list(self, request, *args, **kwargs):
    """
    Para pacientes: combina resultados de BD con órdenes FASIL.
    Para admin/bacteriólogo: comportamiento estándar DRF (solo BD).
    """
    if request.user.role not in ('admin', 'bacteriologo'):
        return self._list_paciente(request)
    return super().list(request, *args, **kwargs)

def _list_paciente(self, request):
    from .serializers import ResultadoUnificadoSerializer

    # 1. Resultados de BD
    qs = self.get_queryset()
    bd_items = [_resultado_a_dict(r) for r in qs]

    # 2. Órdenes FASIL (secuencial, con degradación elegante)
    fasil_items = []
    documento = getattr(request.user, 'documento', None)
    if documento:
        try:
            paciente_fasil = fasil_service.get_paciente(documento)
            ordenes = fasil_service.get_ordenes(paciente_fasil.id_fasil)
            fasil_items = [_orden_fasil_a_dict(o) for o in ordenes]
        except FasilPacienteNoEncontrado:
            logger.info(
                "FASIL: paciente no encontrado | documento=%s", documento
            )
        except FasilConexionError:
            logger.error(
                "FASIL: error de conexión al listar resultados | documento=%s", documento
            )

    # 3. Combinar y ordenar por fecha_examen descendente
    todos = bd_items + fasil_items
    todos.sort(key=lambda x: x['fecha_examen'], reverse=True)

    # 4. Paginación manual compatible con DRF
    page_size = int(request.query_params.get('page_size', 20))
    page = int(request.query_params.get('page', 1))
    start = (page - 1) * page_size
    end = start + page_size
    pagina = todos[start:end]

    next_url = None
    if end < len(todos):
        next_url = request.build_absolute_uri(
            f'?page={page + 1}&page_size={page_size}'
        )

    serializer = ResultadoUnificadoSerializer(pagina, many=True)
    return Response({
        'count': len(todos),
        'next': next_url,
        'previous': None,
        'results': serializer.data,
    })
```

- [ ] **Step 2: Ejecutar los tests**

```bash
cd backend
python manage.py test resultados.tests.ResultadoListUnificadoTests -v 2
```

Resultado esperado: 4 tests `OK`.

---

## Task 4: PDF endpoint con soporte para IDs FASIL

**Files:**
- Modify: `backend/resultados/views.py`
- Modify: `backend/resultados/urls.py`

- [ ] **Step 1: Escribir el test que falla**

Añadir en `backend/resultados/tests.py`:

```python
class ResultadoPDFFasilTests(APITestCase):
    """GET /api/resultados/fasil-ORD-99/pdf/ delega a fasil_service."""

    def setUp(self):
        self.user = User.objects.create(
            username='77788899',
            documento='77788899',
            nombre_completo='Pedro Ruiz',
            role=User.Role.PACIENTE,
        )
        self.user.set_unusable_password()
        self.user.save()
        self.client.force_authenticate(user=self.user)

    @patch('resultados.views.fasil_service.get_resultado_pdf')
    def test_pdf_fasil_delega_a_fasil_service(self, mock_pdf):
        """GET con id fasil-ORD-99 llama a get_resultado_pdf('ORD-99')."""
        mock_pdf.return_value = b'%PDF-1.4 fake content'

        response = self.client.get('/api/resultados/fasil-ORD-99/pdf/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_pdf.assert_called_once_with('ORD-99')
        self.assertEqual(response['Content-Type'], 'application/pdf')

    @patch('resultados.views.fasil_service.get_resultado_pdf')
    def test_pdf_fasil_no_encontrado_retorna_404(self, mock_pdf):
        """Si FASIL no tiene el PDF, retorna 404."""
        from resultados.services.fasil_service import FasilOrdenNoEncontrada
        mock_pdf.side_effect = FasilOrdenNoEncontrada('no encontrado')

        response = self.client.get('/api/resultados/fasil-ORD-00/pdf/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
```

- [ ] **Step 2: Ejecutar para confirmar que fallan**

```bash
cd backend
python manage.py test resultados.tests.ResultadoPDFFasilTests -v 2
```

Resultado esperado: `ERROR` — la URL `fasil-ORD-99` no matchea el patrón `<int:pk>`.

- [ ] **Step 3: Actualizar `ResultadoDescargarPDFView` para manejar el prefijo**

Reemplazar el método `get` completo en `ResultadoDescargarPDFView`:

```python
def get(self, request, pk):
    from .services.fasil_service import (
        fasil_service, FasilOrdenNoEncontrada, FasilConexionError
    )
    user = request.user

    # Ruta FASIL: pk empieza con "fasil-"
    if isinstance(pk, str) and pk.startswith('fasil-'):
        orden_id = pk[len('fasil-'):]
        try:
            pdf_bytes = fasil_service.get_resultado_pdf(orden_id)
        except FasilOrdenNoEncontrada:
            raise Http404("No se encontró el PDF en FASIL.")
        except FasilConexionError as e:
            raise Http404(f"No se pudo conectar con FASIL: {e}")

        from django.http import HttpResponse
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="resultado_{orden_id}.pdf"'
        return response

    # Ruta BD: pk es un entero (o string de entero)
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

- [ ] **Step 4: Cambiar el URL pattern de `<int:pk>` a `<str:pk>` en el endpoint PDF**

Reemplazar en `backend/resultados/urls.py`:

```python
# Antes:
path('resultados/<int:pk>/pdf/', ResultadoDescargarPDFView.as_view(), name='resultado_descargar_pdf'),

# Después:
path('resultados/<str:pk>/pdf/', ResultadoDescargarPDFView.as_view(), name='resultado_descargar_pdf'),
```

Los demás patrones (`<int:pk>/`, `<int:pk>/estado/`) se mantienen con `<int:pk>` ya que nunca reciben IDs FASIL.

- [ ] **Step 5: Ejecutar todos los tests del proyecto**

```bash
cd backend
python manage.py test -v 2
```

Resultado esperado: todos `OK`.

- [ ] **Step 6: Commit del Paso 3**

```bash
cd backend
git add resultados/serializers.py \
        resultados/views.py \
        resultados/urls.py \
        resultados/tests.py
git commit -m "$(cat <<'EOF'
feat(backend): paso 3 - endpoint unificado FASIL + resultados manuales

- GET /api/resultados/ combina resultados de BD con órdenes FASIL para
  pacientes. Consulta FASIL secuencialmente por user.documento.
  Degrada elegantemente si FASIL no responde (solo retorna manuales).
- ResultadoUnificadoSerializer: formato único con id siempre string.
- GET /api/resultados/fasil-<orden_id>/pdf/ delega a fasil_service.
- URL pattern PDF: <int:pk> → <str:pk> para soportar IDs FASIL.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

**Cobertura del spec:**
- ✅ Lista combina BD + FASIL secuencialmente → Task 3
- ✅ Degrada si `FasilConexionError` o `FasilPacienteNoEncontrado` → Task 3 `_list_paciente`
- ✅ `id` siempre string en respuesta → `ResultadoUnificadoSerializer` + helpers
- ✅ Prefijo `"fasil-"` en IDs FASIL → `_orden_fasil_a_dict`
- ✅ PDF endpoint maneja `"fasil-"` → Task 4 Step 3
- ✅ URL pattern cambia a `<str:pk>` → Task 4 Step 4
- ✅ Tests con mock de fasil_service → Tasks 2 y 4

**Placeholders:** Ninguno.

**Consistencia de tipos:**
- `_resultado_a_dict` retorna `'id': str(resultado.pk)`. ✅
- `_orden_fasil_a_dict` retorna `'id': f'fasil-{orden.id_orden}'`. ✅
- `pk.startswith('fasil-')` en la vista PDF requiere que `pk` sea str — el URL pattern `<str:pk>` lo garantiza. ✅
- `fasil_service.get_ordenes(paciente_fasil.id_fasil)` — `id_fasil` es `str` en `PacienteFASIL`. ✅
- `logger` ya está definido en `views.py` como `logger = logging.getLogger('resultados')`. ✅
- Paginación retorna formato compatible con lo que el frontend espera: `{count, next, previous, results}`. ✅
