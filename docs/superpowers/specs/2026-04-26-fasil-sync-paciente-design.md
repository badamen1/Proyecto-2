
# Spec: Sincronización de resultados FASIL para pacientes

**Fecha:** 2026-04-26
**Rama:** develop
**Contexto:** El backend ya tiene `fasil_service.py` completo y el endpoint `/api/resultados/` ya combina BD + FASIL. Lo que falta es cerrar los huecos que impiden que el flujo funcione de extremo a extremo: detalle de órdenes FASIL, descarga de PDF en mock, e indicadores visuales en el frontend.

---

## Estado actual

| Componente | Estado |
|---|---|
| `fasil_service.get_paciente / get_ordenes` | ✅ Completo (mock + real) |
| `GET /api/resultados/` unificado | ✅ Completo |
| `ResultadoUnificadoSerializer` | ✅ Completo |
| `urls.py` detalle `<int:pk>` | ❌ Rechaza IDs FASIL |
| `ResultadoDetailView` con IDs FASIL | ❌ No implementado |
| PDF en modo mock | ❌ Lanza NotImplementedError |
| Badge FASIL en lista frontend | ❌ Sin distinción visual |
| Detalle FASIL frontend | ❌ No maneja shape distinto |

---

## Cambios en el backend

### 1. `backend/resultados/urls.py`

Cambiar el conversor del endpoint de detalle de `<int:pk>` a `<str:pk>`:

```python
path('resultados/<str:pk>/',     ResultadoDetailView.as_view(),        name='resultado_detail'),
path('resultados/<str:pk>/pdf/', ResultadoDescargarPDFView.as_view(),   name='resultado_descargar_pdf'),
path('resultados/<int:pk>/estado/', ResultadoCambiarEstadoView.as_view(), name='resultado_cambiar_estado'),
```

`/estado/` mantiene `<int:pk>` porque solo lo usan admin/bacteriólogo y nunca recibe IDs FASIL.

### 2. `backend/resultados/views.py` — `ResultadoDetailView`

Sobrescribir `get()` para detectar el prefijo `"fasil-"`:

```python
def get(self, request, *args, **kwargs):
    pk = self.kwargs['pk']
    if str(pk).startswith('fasil-'):
        return self._get_fasil_orden(request, pk)
    return super().get(request, *args, **kwargs)

def _get_fasil_orden(self, request, pk):
    orden_id = pk[len('fasil-'):]
    documento = getattr(request.user, 'documento', None)
    if not documento:
        return Response({'detail': 'Orden no encontrada.'}, status=404)
    try:
        paciente = fasil_service.get_paciente(documento)
        if paciente is None:
            raise FasilPacienteNoEncontrado()
        ordenes = fasil_service.get_ordenes(paciente.id_fasil)
        orden = next((o for o in ordenes if str(o.id_orden) == orden_id), None)
        if orden is None:
            raise FasilOrdenNoEncontrada(orden_id)
    except (FasilPacienteNoEncontrado, FasilOrdenNoEncontrada):
        return Response({'detail': 'Orden no encontrada.'}, status=404)
    except FasilConexionError as e:
        logger.error('FASIL no disponible al pedir detalle | orden=%s | %s', pk, e)
        return Response({'detail': 'FASIL no disponible.'}, status=503)

    data = {
        'id': pk,
        'tipo_examen': orden.tipo_examen,
        'fecha_examen': str(orden.fecha_examen),
        'estado': 'ENTREGADO',
        'fuente': 'FASIL',
        'tiene_pdf': orden.tiene_pdf,
        'nombre_archivo': None,
        'subido_por_nombre': None,
        'observaciones': None,
    }
    return Response(data)
```

### 3. `backend/resultados/services/fasil_service.py` — PDF mock

En `get_resultado_pdf()`, cuando `FASIL_ENABLED=False`, retornar bytes de un PDF mínimo válido (1 página en blanco) en lugar de lanzar `NotImplementedError`:

```python
# PDF mínimo válido de 1 página — solo para simulación en desarrollo
_MOCK_PDF = (
    b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj '
    b'2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj '
    b'3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj '
    b'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n'
    b'0000000058 00000 n\n0000000115 00000 n\n'
    b'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
)

def get_resultado_pdf(self, orden_id: str) -> bytes:
    if not self._enabled:
        return _MOCK_PDF
    # ... resto del código real
```

---

## Cambios en el frontend

### 4. `lib/types.ts` — Tipos para detalle FASIL

Añadir `ResultadoFasilDetalle` y actualizar `ResultadoDetalle`:

```typescript
export type ResultadoFasilDetalle = {
  id: string;
  tipo_examen: string;
  fecha_examen: string;
  estado: 'ENTREGADO';
  fuente: 'FASIL';
  tiene_pdf: boolean;
  nombre_archivo: null;
  subido_por_nombre: null;
  observaciones: null;
};

export type ResultadoBDDetalle = ResultadoLista & {
  paciente: number | null;
  empresa: number | null;
  subido_por: number | null;
  subido_por_nombre: string | null;
  archivo_pdf: string;
  tipo_archivo: string;
  fecha_actualizacion: string;
  observaciones: string;
  id_orden_fasil: string | null;
};

export type ResultadoDetalle = ResultadoBDDetalle | ResultadoFasilDetalle;

// Type guard
export function esFasilDetalle(r: ResultadoDetalle): r is ResultadoFasilDetalle {
  return r.fuente === 'FASIL';
}
```

### 5. `app/dashboard/resultados/page.tsx` — Badge FASIL

En cada fila de la tabla, junto al tipo de examen:
- Si `r.fuente === 'FASIL'` → badge morado con texto "FASIL"
- El botón "PDF" solo se muestra si `r.tiene_pdf === true`
- El botón "Ver" siempre aparece (la vista detalle maneja la ausencia de PDF)

### 6. `app/dashboard/resultados/[id]/page.tsx` — Detalle FASIL

Usar el type guard `esFasilDetalle()` para bifurcar:

**Vista BD (actual):** metadata completa + visor inline PDF

**Vista FASIL:**
- Título: `resultado.tipo_examen`
- Badge: "ENTREGADO" + "Sistema FASIL"
- Fila de metadata: solo `Fecha del examen`
- Si `tiene_pdf`:
  - Botón "Descargar PDF" → llama `GET /api/resultados/{id}/pdf/` (misma función `apiFetchBlob` que BD)
  - Visor inline (iframe con blob URL, igual que BD)
- Si `!tiene_pdf`:
  - Mensaje: "Este resultado aún no tiene PDF disponible."

---

## Manejo de errores

| Situación | Comportamiento |
|---|---|
| Paciente no existe en FASIL | 404 → frontend muestra "Orden no encontrada" |
| FASIL caído al pedir detalle | 503 → frontend muestra "FASIL no disponible" |
| Orden FASIL no tiene PDF | `tiene_pdf=false` → frontend oculta visor, muestra aviso |
| PDF FASIL en modo mock | Retorna PDF de 1 página en blanco (sin error) |

---

## Tests backend

| Test | Descripción |
|---|---|
| `test_detalle_fasil_retorna_dict` | GET `/api/resultados/fasil-ORD-1/` → 200 con campos correctos |
| `test_detalle_fasil_paciente_no_encontrado` | GET con documento no en FASIL → 404 |
| `test_detalle_fasil_conexion_error` | Mock lanza FasilConexionError → 503 |
| `test_pdf_fasil_mock_retorna_bytes` | `fasil_service.get_resultado_pdf("any")` en modo mock → bytes válidos |
| `test_url_detail_acepta_str_pk` | GET `/api/resultados/fasil-X/` llega al view (no 404 de URL) |

---

## Archivos modificados

| Archivo | Acción |
|---|---|
| `backend/resultados/urls.py` | Modificar — `<int:pk>` → `<str:pk>` en detail |
| `backend/resultados/views.py` | Modificar — añadir `get()` y `_get_fasil_orden()` |
| `backend/resultados/services/fasil_service.py` | Modificar — PDF mock |
| `backend/resultados/tests.py` | Modificar — tests nuevos |
| `lib/types.ts` | Modificar — nuevos tipos y type guard |
| `app/dashboard/resultados/page.tsx` | Modificar — badge FASIL, condicional PDF |
| `app/dashboard/resultados/[id]/page.tsx` | Modificar — bifurcación BD vs FASIL |
