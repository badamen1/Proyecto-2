# Frontend: Órdenes FASIL + PDF en lista de resultados — Design Spec

**Fecha:** 2026-04-27
**Scope:** Mostrar órdenes FASIL junto a resultados manuales en la lista del paciente, con botones de ver PDF (nueva pestaña) y descargar PDF. Funcionamiento correcto en modo MOCK y modo REAL.

---

## Contexto

El backend ya implementa un endpoint unificado (`GET /api/resultados/`) que combina resultados manuales de la BD con órdenes del sistema FASIL. La respuesta incluye el campo `tiene_pdf: boolean` para indicar si el PDF está disponible.

El PDF de órdenes FASIL es servido por Django como proxy del servidor BIRT interno:
```
Browser → apiFetchBlob('/api/resultados/fasil-{id}/pdf/') → Django → BIRT (LAN) → bytes PDF
```
El frontend nunca habla con BIRT directamente. `apiFetchBlob` funciona igual para FASIL y para resultados manuales.

En **modo MOCK** (`FASIL_ENABLED=False`): las órdenes FASIL aparecen con datos de prueba pero sin PDF real disponible. El backend señala esto con `tiene_pdf: false`.

---

## Enfoque: Parche in-place (Enfoque A)

Mínimo número de archivos. Sin nuevos tipos ni componentes. Cambios quirúrgicos en 3 archivos.

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `backend/resultados/services/fasil_service.py` | `_mock_get_ordenes`: `tiene_pdf=False`; view: capturar `NotImplementedError` |
| `lib/types.ts` | Añadir `tiene_pdf?: boolean` a `ResultadoLista` |
| `app/dashboard/resultados/page.tsx` | Lógica de botones según `fuente` y `tiene_pdf` |

---

## Cambio 1 — Backend: `_mock_get_ordenes`

En `FasilService._mock_get_ordenes`, cambiar `tiene_pdf=True` a `tiene_pdf=False`:

```python
OrdenFASIL(
    id_orden=f"ORD-{paciente_id}-001",
    paciente_id=paciente_id,
    tipo_examen='Hemograma Completo',
    fecha_examen='2026-04-01',
    empresa_nit=empresa_nit,
    tiene_pdf=False,   # ← False en MOCK: BIRT no disponible en desarrollo
)
```

Aplica a ambos registros mock. Sin cambio en el modo REAL.

---

## Cambio 2 — Backend: capturar `NotImplementedError` en la view

En `ResultadoDescargarPDFView.get()`, en el bloque FASIL, añadir captura de `NotImplementedError`:

```python
if isinstance(pk, str) and pk.startswith('fasil-'):
    orden_id = pk[len('fasil-'):]
    try:
        pdf_bytes = fasil_service.get_resultado_pdf(orden_id)
    except FasilOrdenNoEncontrada:
        raise Http404("No se encontró el PDF en FASIL.")
    except (FasilConexionError, NotImplementedError) as e:
        raise Http404(f"PDF no disponible: {e}")
```

Esto evita un 500 si alguien llama al endpoint en modo MOCK sin el guard del frontend.

---

## Cambio 3 — Frontend: `lib/types.ts`

Añadir `tiene_pdf` como campo opcional a `ResultadoLista`:

```typescript
export type ResultadoLista = {
  id: string;
  paciente_nombre: string;
  paciente_documento: string;
  empresa_nombre: string | null;
  tipo_examen: string;
  fuente: ResultadoFuente;
  estado: ResultadoEstado;
  fecha_examen: string;
  fecha_carga: string;
  nombre_archivo: string | null;
  tiene_pdf?: boolean;   // ← nuevo: false en MOCK para FASIL, true si hay PDF
};
```

---

## Cambio 4 — Frontend: `app/dashboard/resultados/page.tsx`

### Nueva función `verPDFNuevaTab`

```typescript
const verPDFNuevaTab = async (id: string) => {
  setDownloadingId(id);
  try {
    const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // La pestaña retiene la referencia; revocar con un pequeño delay
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch (err) {
    alert('No se pudo abrir el PDF: ' + (err as Error).message);
  } finally {
    setDownloadingId(null);
  }
};
```

### Lógica de botones en la columna Acciones

```typescript
const esFasil = r.fuente === 'FASIL';
const pdfDisponible = r.tiene_pdf !== false; // true si undefined o true
const ocupado = downloadingId === String(r.id);
```

| Caso | "Ver" | "PDF" |
|---|---|---|
| Manual (`!esFasil`) | `<Link href="/dashboard/resultados/${r.id}">Ver</Link>` | Botón descarga (igual que hoy) |
| FASIL + `pdfDisponible` | Botón → `verPDFNuevaTab(r.id)` | Botón → `descargarPDF(r.id, r.nombre_archivo)` |
| FASIL + `!pdfDisponible` | Botón deshabilitado `"PDF no disponible"` | oculto |

En el caso FASIL + sin PDF, se muestra un solo botón fusionado deshabilitado:

```tsx
<button disabled style={{ background: '#ccc', color: '#666', border: 'none',
  padding: '6px 12px', borderRadius: '4px', fontSize: '0.85rem', cursor: 'not-allowed' }}>
  PDF no disponible
</button>
```

---

## Flujo completo por modo

### Modo MOCK (`FASIL_ENABLED=False`)
1. `GET /api/resultados/` retorna resultados manuales + órdenes FASIL mock con `tiene_pdf: false`
2. Lista muestra ambos tipos mezclados
3. Órdenes FASIL: botón `"PDF no disponible"` (disabled) — ninguna llamada HTTP adicional
4. Resultados manuales: "Ver" + "PDF" funcionan igual que antes

### Modo REAL (`FASIL_ENABLED=True`)
1. `GET /api/resultados/` retorna resultados manuales + órdenes FASIL reales con `tiene_pdf: true`
2. Lista muestra ambos tipos mezclados
3. Órdenes FASIL: "Ver PDF" → `apiFetchBlob` → Django proxy BIRT → bytes → nueva pestaña
4. Órdenes FASIL: "PDF" → `apiFetchBlob` → descarga
5. Resultados manuales: sin cambio

---

## Manejo de errores

- FASIL caído / BIRT sin respuesta: el backend devuelve 404. El frontend muestra alert con el mensaje de error.
- FASIL no retorna órdenes para el paciente: la lista solo muestra resultados manuales (comportamiento de degradación elegante ya implementado en backend).
- `downloadingId` bloquea el botón durante la descarga para evitar doble clic.

---

## Tests a actualizar

- `tests/app/dashboard/resultados-list.test.tsx` — verificar que:
  - Orden FASIL con `tiene_pdf: false` muestra botón deshabilitado "PDF no disponible"
  - Orden FASIL con `tiene_pdf: true` muestra botones "Ver PDF" y "PDF"
  - Resultado manual sigue mostrando Link "Ver" y botón "PDF"
- `backend/resultados/tests_fasil_service.py` — actualizar mocks de `_mock_get_ordenes` para reflejar `tiene_pdf=False`

---

## Fuera del scope de esta entrega

- Vista de detalle para órdenes FASIL (no existe endpoint `/api/resultados/fasil-{id}/`)
- Columna de Fuente en la lista
- Paginación diferenciada por fuente
