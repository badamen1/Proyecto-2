# Frontend: Órdenes FASIL + Botones PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar órdenes FASIL junto a resultados manuales en la lista del paciente, con botones de ver PDF (nueva pestaña) y descargar PDF, funcionando correctamente en modo MOCK (`tiene_pdf: false`) y modo REAL (`tiene_pdf: true`).

**Architecture:** Parche in-place en 4 archivos. Backend: (1) `_mock_get_ordenes` retorna `tiene_pdf=False`; (2) `ResultadoDescargarPDFView` captura `NotImplementedError` como 404. Frontend: (3) `ResultadoLista` añade campo `tiene_pdf?: boolean`; (4) la página de lista renderiza botones condicionales según `fuente` y `tiene_pdf`.

**Tech Stack:** Django 5.2 + DRF (backend), Next.js 14 + TypeScript (frontend), Vitest + Testing Library (tests frontend), Django `SimpleTestCase` (tests backend).

---

## Archivos a modificar/crear

| Archivo | Rol |
|---|---|
| `backend/resultados/tests_views.py` | **Crear** — test unitario de `ResultadoDescargarPDFView` con `NotImplementedError` |
| `backend/resultados/views.py` | **Modificar** — añadir `NotImplementedError` al bloque `except` de la PDF view (líneas ~362-365) |
| `backend/resultados/tests_fasil_service.py` | **Modificar** — añadir test que verifica que mock ordenes tienen `tiene_pdf=False` |
| `backend/resultados/services/fasil_service.py` | **Modificar** — cambiar `tiene_pdf=True` a `tiene_pdf=False` en `_mock_get_ordenes` (líneas ~576, ~584) |
| `tests/app/dashboard/resultados-list.test.tsx` | **Modificar** — añadir 3 tests para comportamiento de botones FASIL/manual |
| `lib/types.ts` | **Modificar** — añadir `tiene_pdf?: boolean` a `ResultadoLista` |
| `app/dashboard/resultados/page.tsx` | **Modificar** — añadir `verPDFNuevaTab()` y lógica condicional de botones |

---

## Task 1: Backend — capturar `NotImplementedError` en `ResultadoDescargarPDFView`

**Files:**
- Create: `backend/resultados/tests_views.py`
- Modify: `backend/resultados/views.py` (bloque except en `ResultadoDescargarPDFView.get`, líneas ~362-365)

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/resultados/tests_views.py`:

```python
from django.test import SimpleTestCase
from django.http import Http404
from unittest.mock import patch, MagicMock
from resultados.views import ResultadoDescargarPDFView


class ResultadoDescargarPDFViewTests(SimpleTestCase):
    """Tests unitarios de ResultadoDescargarPDFView con fasil_service mockeado."""

    @patch('resultados.views.fasil_service')
    def test_notimplementederror_devuelve_404(self, mock_svc):
        """NotImplementedError (modo MOCK) debe propagarse como Http404, no 500."""
        mock_svc.get_resultado_pdf.side_effect = NotImplementedError("get_resultado_pdf() en modo MOCK")

        view = ResultadoDescargarPDFView()
        mock_request = MagicMock()

        with self.assertRaises(Http404):
            view.get(mock_request, pk='fasil-ORD-7-001')
```

- [ ] **Step 2: Verificar que el test falla**

```bash
cd backend && python manage.py test resultados.tests_views.ResultadoDescargarPDFViewTests -v 2
```

Resultado esperado: `FAIL` — `NotImplementedError` no está capturada, escapa sin convertirse en `Http404`.

- [ ] **Step 3: Implementar — añadir `NotImplementedError` al bloque `except`**

En `backend/resultados/views.py`, en `ResultadoDescargarPDFView.get()`, cambiar el bloque `except` actual:

```python
            except FasilOrdenNoEncontrada:
                raise Http404("No se encontró el PDF en FASIL.")
            except FasilConn as e:
                raise Http404(f"No se pudo conectar con FASIL: {e}")
```

por:

```python
            except FasilOrdenNoEncontrada:
                raise Http404("No se encontró el PDF en FASIL.")
            except (FasilConn, NotImplementedError) as e:
                raise Http404(f"PDF no disponible: {e}")
```

- [ ] **Step 4: Verificar que el test pasa**

```bash
cd backend && python manage.py test resultados.tests_views.ResultadoDescargarPDFViewTests -v 2
```

Resultado esperado: `OK` — 1 test pasa.

- [ ] **Step 5: Commit**

```bash
git add backend/resultados/tests_views.py backend/resultados/views.py
git commit -m "fix(backend): capturar NotImplementedError como 404 en PDF view modo MOCK"
```

---

## Task 2: Backend — `_mock_get_ordenes` retorna `tiene_pdf=False`

**Files:**
- Modify: `backend/resultados/tests_fasil_service.py` (añadir método a `FasilServiceGetOrdenesTests`)
- Modify: `backend/resultados/services/fasil_service.py` (líneas ~576 y ~584, `_mock_get_ordenes`)

- [ ] **Step 1: Añadir test que verifica `tiene_pdf=False` en órdenes mock**

En `backend/resultados/tests_fasil_service.py`, añadir el siguiente método al final de la clase `FasilServiceGetOrdenesTests`:

```python
    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=False)
    def test_mock_ordenes_tienen_pdf_false(self, _):
        """_mock_get_ordenes debe retornar órdenes con tiene_pdf=False (BIRT no disponible en desarrollo)."""
        result = fasil_service.get_ordenes('7')

        self.assertTrue(len(result) > 0, "Se esperan al menos 2 órdenes mock")
        for orden in result:
            self.assertFalse(orden.tiene_pdf, f"Orden {orden.id_orden} debe tener tiene_pdf=False")
```

- [ ] **Step 2: Verificar que el test falla**

```bash
cd backend && python manage.py test resultados.tests_fasil_service.FasilServiceGetOrdenesTests.test_mock_ordenes_tienen_pdf_false -v 2
```

Resultado esperado: `FAIL` — actualmente `tiene_pdf=True` en `_mock_get_ordenes`.

- [ ] **Step 3: Implementar — cambiar `tiene_pdf=True` a `tiene_pdf=False` en ambos registros mock**

En `backend/resultados/services/fasil_service.py`, en el método `_mock_get_ordenes`, hay dos construcciones de `OrdenFASIL`. Cambiar en ambas `tiene_pdf=True` → `tiene_pdf=False`:

```python
    def _mock_get_ordenes(
        self,
        paciente_id: str,
        empresa_nit: Optional[str] = None,
    ) -> list[OrdenFASIL]:
        """Retorna órdenes mock para desarrollo local."""
        return [
            OrdenFASIL(
                id_orden=f"ORD-{paciente_id}-001",
                paciente_id=paciente_id,
                tipo_examen='Hemograma Completo',
                fecha_examen='2026-04-01',
                empresa_nit=empresa_nit,
                tiene_pdf=False,
            ),
            OrdenFASIL(
                id_orden=f"ORD-{paciente_id}-002",
                paciente_id=paciente_id,
                tipo_examen='Perfil Lipídico',
                fecha_examen='2026-03-15',
                empresa_nit=empresa_nit,
                tiene_pdf=False,
            ),
        ]
```

- [ ] **Step 4: Verificar que todos los tests de `tests_fasil_service.py` pasan**

```bash
cd backend && python manage.py test resultados.tests_fasil_service -v 2
```

Resultado esperado: `OK` — 7 tests pasan (3 de GetOrdenes + 3 de GetResultadoPdf + 1 nuevo).

- [ ] **Step 5: Commit**

```bash
git add backend/resultados/services/fasil_service.py backend/resultados/tests_fasil_service.py
git commit -m "fix(backend): mock ordenes FASIL con tiene_pdf=False (BIRT no disponible en dev)"
```

---

## Task 3: Frontend — escribir tests que fallan para los nuevos botones

**Files:**
- Modify: `tests/app/dashboard/resultados-list.test.tsx`

- [ ] **Step 1: Añadir 3 tests al describe existente**

En `tests/app/dashboard/resultados-list.test.tsx`, añadir los siguientes tres `it` blocks **dentro del `describe('Pagina /dashboard/resultados', ...)`**, después del test `'redirige a /login si no hay token'`:

```typescript
  it('muestra botón deshabilitado para orden FASIL con tiene_pdf false', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'paciente');
    mockApiFetch.mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 'fasil-ORD-7-001',
          paciente_nombre: 'Juan',
          paciente_documento: '123',
          empresa_nombre: null,
          tipo_examen: 'Hemograma Completo',
          fuente: 'FASIL',
          estado: 'ENTREGADO',
          fecha_examen: '2026-04-01',
          fecha_carga: '2026-04-01T10:00:00Z',
          nombre_archivo: null,
          tiene_pdf: false,
        },
      ],
    });

    const { default: Page } = await import('@/app/dashboard/resultados/page');
    render(<Page />);

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /pdf no disponible/i });
      expect(btn).toBeDisabled();
    });
  });

  it('muestra botones Ver PDF y PDF para orden FASIL con tiene_pdf true', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'paciente');
    mockApiFetch.mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 'fasil-ORD-7-001',
          paciente_nombre: 'Juan',
          paciente_documento: '123',
          empresa_nombre: null,
          tipo_examen: 'Perfil Lipídico',
          fuente: 'FASIL',
          estado: 'ENTREGADO',
          fecha_examen: '2026-04-01',
          fecha_carga: '2026-04-01T10:00:00Z',
          nombre_archivo: null,
          tiene_pdf: true,
        },
      ],
    });

    const { default: Page } = await import('@/app/dashboard/resultados/page');
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ver pdf/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^pdf$/i })).toBeInTheDocument();
    });
  });

  it('muestra link Ver y botón PDF para resultado manual', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'paciente');
    mockApiFetch.mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: '42',
          paciente_nombre: 'Juan',
          paciente_documento: '123',
          empresa_nombre: null,
          tipo_examen: 'Hemograma',
          fuente: 'MANUAL',
          estado: 'VALIDADO',
          fecha_examen: '2026-04-01',
          fecha_carga: '2026-04-01T10:00:00Z',
          nombre_archivo: 'hemo.pdf',
        },
      ],
    });

    const { default: Page } = await import('@/app/dashboard/resultados/page');
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /^ver$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^pdf$/i })).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: Verificar que los 3 tests nuevos fallan (y los 3 existentes siguen pasando)**

```bash
npx vitest run tests/app/dashboard/resultados-list.test.tsx --reporter=verbose
```

Resultado esperado: 3 tests existentes pasan, 3 tests nuevos `FAIL` (los botones condicionales no existen aún).

- [ ] **Step 3: Commit los tests que fallan**

```bash
git add tests/app/dashboard/resultados-list.test.tsx
git commit -m "test(frontend): tests que fallan para botones FASIL condicionales (TDD)"
```

---

## Task 4: Frontend — implementar `tiene_pdf` en types y botones condicionales en la página

**Files:**
- Modify: `lib/types.ts` (añadir `tiene_pdf?: boolean`)
- Modify: `app/dashboard/resultados/page.tsx` (añadir `verPDFNuevaTab` + lógica condicional)

- [ ] **Step 1: Añadir `tiene_pdf` a `ResultadoLista` en `lib/types.ts`**

En `lib/types.ts`, modificar `ResultadoLista` añadiendo el campo `tiene_pdf` al final:

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
  tiene_pdf?: boolean;
};
```

- [ ] **Step 2: Añadir función `verPDFNuevaTab` en `page.tsx`**

En `app/dashboard/resultados/page.tsx`, añadir la función `verPDFNuevaTab` justo **después** de `descargarPDF` (después de la llave de cierre de `descargarPDF`, antes del bloque `if (loading)`):

```typescript
  const verPDFNuevaTab = async (id: string) => {
    setDownloadingId(id);
    try {
      const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      alert('No se pudo abrir el PDF: ' + (err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };
```

- [ ] **Step 3: Reemplazar la columna Acciones con lógica condicional**

En `app/dashboard/resultados/page.tsx`, reemplazar el bloque `<td style={{ padding: '12px', display: 'flex', gap: '8px' }}>` completo (que contiene el Link "Ver" y el botón "PDF") con:

```tsx
                        <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                          {r.fuente === 'FASIL' ? (
                            r.tiene_pdf !== false ? (
                              <>
                                <button
                                  onClick={() => verPDFNuevaTab(String(r.id))}
                                  disabled={downloadingId === String(r.id)}
                                  style={{ background: 'var(--primary-blue)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                  Ver PDF
                                </button>
                                <button
                                  onClick={() => descargarPDF(String(r.id), r.nombre_archivo)}
                                  disabled={downloadingId === String(r.id)}
                                  style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                  {downloadingId === String(r.id) ? 'Descargando...' : 'PDF'}
                                </button>
                              </>
                            ) : (
                              <button
                                disabled
                                style={{ background: '#ccc', color: '#666', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '0.85rem', cursor: 'not-allowed' }}
                              >
                                PDF no disponible
                              </button>
                            )
                          ) : (
                            <>
                              <Link
                                href={`/dashboard/resultados/${r.id}`}
                                style={{ background: 'var(--primary-blue)', color: '#fff', padding: '6px 12px', borderRadius: '4px', textDecoration: 'none', fontSize: '0.85rem' }}
                              >
                                Ver
                              </Link>
                              <button
                                onClick={() => descargarPDF(String(r.id), r.nombre_archivo)}
                                disabled={downloadingId === String(r.id)}
                                style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                {downloadingId === String(r.id) ? 'Descargando...' : 'PDF'}
                              </button>
                            </>
                          )}
                        </td>
```

- [ ] **Step 4: Verificar que los 6 tests pasan**

```bash
npx vitest run tests/app/dashboard/resultados-list.test.tsx --reporter=verbose
```

Resultado esperado: `6 tests passed` — los 3 existentes + los 3 nuevos de Task 3.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts app/dashboard/resultados/page.tsx
git commit -m "feat(frontend): botones condicionales FASIL/manual con soporte tiene_pdf"
```

---

## Resumen de commits esperados

1. `fix(backend): capturar NotImplementedError como 404 en PDF view modo MOCK`
2. `fix(backend): mock ordenes FASIL con tiene_pdf=False (BIRT no disponible en dev)`
3. `test(frontend): tests que fallan para botones FASIL condicionales (TDD)`
4. `feat(frontend): botones condicionales FASIL/manual con soporte tiene_pdf`

## Flujo de verificación manual post-implementación

### Modo MOCK (`FASIL_ENABLED=False`)
1. Iniciar backend: `cd backend && python manage.py runserver`
2. Iniciar frontend: `npm run dev`
3. Acceder como paciente a `/dashboard/resultados`
4. Las órdenes FASIL deben mostrar botón gris `"PDF no disponible"` (disabled)
5. Los resultados manuales deben mostrar `"Ver"` (link azul) + `"PDF"` (botón verde)

### Modo REAL (`FASIL_ENABLED=True`)
1. Configurar `FASIL_ENABLED=True` en `backend/.env`
2. Las órdenes FASIL deben mostrar botón `"Ver PDF"` (abre nueva pestaña) + `"PDF"` (descarga)
