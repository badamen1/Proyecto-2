# Automatizar Formulario BIRT para PDF sin Click del Usuario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modificar `fasil_service.py` para que `get_resultado_pdf()` siga automáticamente el formulario HTML de BIRT y retorne bytes del PDF sin interacción del usuario, eliminando el click "OK" y el salto al navegador.

**Architecture:** BIRT retorna HTML con un formulario POST antes de servir el PDF. El backend hace GET inicial con `requests.Session()` para obtener el HTML, lo parsea con `BeautifulSoup` para extraer el formulario y sus campos, hace el POST automático y retorna los bytes del PDF. El frontend vuelve al enfoque blob uniforme para todos los tipos de resultado.

**Tech Stack:** Django 5.2, `requests` (ya instalado), `beautifulsoup4==4.12.3` (nuevo), `html.parser` (built-in Python, sin deps nativas), `urllib.parse.urljoin` (built-in).

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `backend/requirements.txt` | Modificar — añadir `beautifulsoup4` |
| `backend/resultados/services/fasil_service.py` | Modificar — añadir `_follow_birt_response()`, renombrar `get_resultado_pdf_url` → `get_resultado_pdf` |
| `backend/resultados/views.py` | Modificar — retornar `HttpResponse` con bytes (revertir a antes) |
| `backend/resultados/tests_fasil_service.py` | Modificar — añadir tests para `_follow_birt_response` y `get_resultado_pdf` |
| `app/dashboard/resultados/page.tsx` | Modificar — revertir al enfoque blob uniforme |
| `app/dashboard/resultados/[id]/page.tsx` | Modificar — revertir al enfoque blob uniforme |

---

## Task 1: Diagnóstico — capturar y analizar el HTML completo que devuelve BIRT

**Files:**
- Modify: `backend/resultados/services/fasil_service.py`

El error anterior confirmó que BIRT devuelve `text/html`. Necesitamos ver el HTML completo para saber si usa formulario POST, JavaScript redirect, o meta-refresh. Esto determina la implementación exacta de `_follow_birt_response`.

- [ ] **Step 1: Añadir logging temporal del HTML completo en `get_resultado_pdf_url`**

En `fasil_service.py`, dentro del método `get_resultado_pdf_url`, justo **antes** del `return (f"{birt_host}...")`, insertar:

```python
        # DIAGNÓSTICO TEMPORAL — remover después de Task 1
        import tempfile, os as _os
        _debug_resp = requests.get(
            (
                f"{birt_host}/BioanalisisRepo30/run"
                f"?__format=pdf&__report=ListadoResultadosOrden4.rptdesign"
                f"&Pentrega=false&Ptitulos=true&Pfirmas=false&PMDesde=0&PMHasta=999"
                f"&Premitido=0&PmediaCarta=false&Ppiefirma=false&Phistoria=Historia%20"
                f"&Pcomentario=l&Psinfirmas=false&Pacreditada=2&Pconfoto=false&Pcarpeta=a"
                f"&usuario={birt_user}&Documento=%22%25%22"
                f"&Desde%20Empresa={empresa_id}&Hasta%20Empresa={empresa_id}"
                f"&Desde%20Orden={orden_id}&Hasta%20Orden={orden_id}"
            ),
            timeout=30
        )
        _tmp = _os.path.join(tempfile.gettempdir(), f"birt_debug_{orden_id}.html")
        with open(_tmp, "wb") as _f:
            _f.write(_debug_resp.content)
        logger.warning("BIRT HTML guardado en: %s", _tmp)
        # FIN DIAGNÓSTICO TEMPORAL
```

- [ ] **Step 2: Reiniciar el servidor Django y hacer click en "Ver PDF" en la app**

```bash
cd backend
python manage.py runserver
```

En los logs del servidor buscar la línea:
```
WARNING BIRT HTML guardado en: C:\Users\...\birt_debug_<orden_id>.html
```

- [ ] **Step 3: Abrir el archivo HTML en VS Code o Notepad++**

Buscar en el archivo estas señales:

**Señal A — formulario POST (caso más común):**
```html
<form method="post" action="/BioanalisisRepo30/run">
  <input type="hidden" name="__format" value="pdf">
  ...
  <input type="submit" value="Aceptar">
</form>
```

**Señal B — JavaScript redirect:**
```javascript
window.location = '/BioanalisisRepo30/download?token=...';
// o
window.location.href = '...';
```

**Señal C — meta refresh:**
```html
<meta http-equiv="refresh" content="0;url=/BioanalisisRepo30/...">
```

Anotar cuál de las tres señales aparece — determina si Task 4 necesita ajuste.

- [ ] **Step 4: Eliminar el bloque de diagnóstico del Step 1**

Remover el bloque `# DIAGNÓSTICO TEMPORAL` completo del método `get_resultado_pdf_url`.

---

## Task 2: Instalar `beautifulsoup4`

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Añadir la dependencia**

En `backend/requirements.txt`, añadir después de `requests==2.32.3`:

```
beautifulsoup4==4.12.3
```

- [ ] **Step 2: Instalar**

```bash
cd backend
pip install beautifulsoup4==4.12.3
```

Resultado esperado: `Successfully installed beautifulsoup4-4.12.3`

---

## Task 3: Tests para `_follow_birt_response`

**Files:**
- Modify: `backend/resultados/tests_fasil_service.py`

- [ ] **Step 1: Añadir los tests al final de `tests_fasil_service.py`**

```python
import requests as req_lib


class FollowBirtResponseTests(TestCase):
    """Tests para _follow_birt_response — parseo HTML y seguimiento de formulario."""

    def _make_html_response(self, form_html: str) -> MagicMock:
        resp = MagicMock()
        resp.status_code = 200
        resp.headers = {'content-type': 'text/html;charset=utf-8'}
        resp.content = form_html.encode('utf-8')
        resp.text = form_html
        resp.raise_for_status = MagicMock()
        return resp

    def _make_pdf_response(self) -> MagicMock:
        resp = MagicMock()
        resp.status_code = 200
        resp.headers = {'content-type': 'application/pdf'}
        resp.content = b'%PDF-1.4 fake content'
        resp.raise_for_status = MagicMock()
        return resp

    def test_si_respuesta_ya_es_pdf_la_retorna_directamente(self):
        """Si BIRT retorna PDF directo (sin HTML intermedio), retorna los bytes tal cual."""
        from resultados.services.fasil_service import _follow_birt_response
        session = MagicMock()
        pdf_resp = self._make_pdf_response()

        result = _follow_birt_response(session, pdf_resp, 'http://192.168.1.109:8080')

        self.assertEqual(result, b'%PDF-1.4 fake content')
        session.post.assert_not_called()
        session.get.assert_not_called()

    def test_sigue_formulario_post_y_retorna_pdf(self):
        """Si BIRT retorna HTML con <form method=post>, hace POST y retorna PDF."""
        from resultados.services.fasil_service import _follow_birt_response
        session = MagicMock()
        html = """
        <html><body>
        <form method="post" action="/BioanalisisRepo30/run">
            <input type="hidden" name="__format" value="pdf">
            <input type="hidden" name="__report" value="ListadoResultadosOrden4.rptdesign">
            <input type="hidden" name="Desde Orden" value="116258">
            <input type="submit" value="Aceptar">
        </form>
        </body></html>
        """
        html_resp = self._make_html_response(html)
        pdf_resp = self._make_pdf_response()
        session.post.return_value = pdf_resp

        result = _follow_birt_response(session, html_resp, 'http://192.168.1.109:8080')

        self.assertEqual(result, b'%PDF-1.4 fake content')
        session.post.assert_called_once()
        post_url = session.post.call_args[0][0]
        self.assertIn('BioanalisisRepo30', post_url)

    def test_form_sin_action_usa_base_url(self):
        """Un <form> sin action usa la base_url como destino del POST."""
        from resultados.services.fasil_service import _follow_birt_response
        session = MagicMock()
        html = """
        <html><body>
        <form method="post">
            <input type="hidden" name="__format" value="pdf">
            <input type="submit" value="OK">
        </form>
        </body></html>
        """
        html_resp = self._make_html_response(html)
        pdf_resp = self._make_pdf_response()
        session.post.return_value = pdf_resp

        result = _follow_birt_response(
            session, html_resp,
            'http://192.168.1.109:8080/BioanalisisRepo30/run'
        )

        self.assertEqual(result, b'%PDF-1.4 fake content')
        session.post.assert_called_once()

    def test_html_sin_form_lanza_fasil_conexion_error(self):
        """Si el HTML no tiene <form> ni inicia con %PDF, lanza FasilConexionError."""
        from resultados.services.fasil_service import _follow_birt_response, FasilConexionError
        session = MagicMock()
        html = '<html><body><p>Error desconocido de BIRT</p></body></html>'
        html_resp = self._make_html_response(html)

        with self.assertRaises(FasilConexionError):
            _follow_birt_response(session, html_resp, 'http://192.168.1.109:8080')
```

- [ ] **Step 2: Ejecutar los tests — deben fallar**

```bash
cd backend
python manage.py test resultados.tests_fasil_service.FollowBirtResponseTests -v 2
```

Resultado esperado: `ImportError` o `AttributeError` — `_follow_birt_response` no existe aún.

---

## Task 4: Implementar `_follow_birt_response` en `fasil_service.py`

**Files:**
- Modify: `backend/resultados/services/fasil_service.py`

- [ ] **Step 1: Añadir imports al top del archivo**

Reemplazar el bloque de imports existente (primeras líneas del archivo):

```python
import logging
import requests
from bs4 import BeautifulSoup
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urljoin
from django.conf import settings
```

- [ ] **Step 2: Añadir `_follow_birt_response` como función module-level**

Insertar el bloque completo **entre** `_is_fasil_enabled()` y `class FasilService:`:

```python
def _follow_birt_response(
    session: requests.Session,
    response: requests.Response,
    base_url: str,
) -> bytes:
    """
    Sigue la respuesta de BIRT: si ya es PDF lo retorna; si es HTML con formulario,
    hace POST automáticamente y retorna los bytes del PDF resultante.

    Args:
        session: requests.Session con cookies de la sesión BIRT.
        response: Respuesta HTTP del GET inicial a BIRT.
        base_url: URL del request original (para resolver actions relativos).

    Returns:
        Bytes del PDF generado por BIRT.

    Raises:
        FasilConexionError: Si no hay PDF ni formulario seguible en la respuesta.
    """
    # Caso 1: BIRT retornó el PDF directamente (sin página HTML intermedia)
    if response.content.startswith(b'%PDF'):
        return response.content

    # Caso 2: BIRT retornó HTML — buscar formulario y seguirlo con POST
    soup = BeautifulSoup(response.text, 'html.parser')
    form = soup.find('form')

    if form:
        action = form.get('action') or base_url
        if not action.startswith('http'):
            action = urljoin(base_url, action)

        method = form.get('method', 'get').lower()
        data = {
            inp.get('name'): inp.get('value', '')
            for inp in form.find_all('input')
            if inp.get('name')
        }

        logger.info(
            "BIRT seguir formulario | method=%s | action=%s | campos=%s",
            method, action, list(data.keys())
        )

        follow = session.post(action, data=data, timeout=30) if method == 'post' \
            else session.get(action, params=data, timeout=30)
        follow.raise_for_status()

        if follow.content.startswith(b'%PDF'):
            return follow.content

        preview = follow.content[:200].decode('utf-8', errors='replace')
        logger.error("BIRT POST no retornó PDF | action=%s | preview=%s", action, preview)
        raise FasilConexionError(
            f"BIRT no retornó PDF después del formulario. "
            f"Inicio de respuesta: {preview[:120]}"
        )

    # Caso 3 (alternativa): JavaScript redirect o meta-refresh
    import re
    match = re.search(r"window\.location(?:\.href)?\s*=\s*['\"]([^'\"]+)['\"]", response.text)
    if not match:
        match = re.search(
            r'<meta[^>]+http-equiv=["\']refresh["\'][^>]+url=([^\s"\'>;]+)',
            response.text, re.I
        )
    if match:
        redirect_url = match.group(1)
        if not redirect_url.startswith('http'):
            redirect_url = urljoin(base_url, redirect_url)
        logger.info("BIRT JS/meta redirect | url=%s", redirect_url)
        follow = session.get(redirect_url, timeout=30)
        follow.raise_for_status()
        if follow.content.startswith(b'%PDF'):
            return follow.content

    preview = response.content[:200].decode('utf-8', errors='replace')
    logger.error("BIRT HTML sin formulario ni redirect | base_url=%s | preview=%s", base_url, preview)
    raise FasilConexionError(
        "BIRT no retornó PDF ni formulario seguible. "
        f"Inicio de respuesta: {preview[:120]}"
    )
```

- [ ] **Step 3: Ejecutar los tests — deben pasar**

```bash
cd backend
python manage.py test resultados.tests_fasil_service.FollowBirtResponseTests -v 2
```

Resultado esperado: 4 tests `OK`.

- [ ] **Step 4: Commit intermedio**

```bash
git add backend/requirements.txt backend/resultados/services/fasil_service.py backend/resultados/tests_fasil_service.py
git commit -m "$(cat <<'EOF'
feat(fasil): añadir _follow_birt_response para parsear formulario HTML de BIRT

BIRT retorna HTML con formulario POST antes de servir el PDF.
_follow_birt_response parsea el formulario con BeautifulSoup y hace POST
automático. También cubre casos de JS redirect y meta-refresh.
EOF
)"
```

---

## Task 5: Reescribir `get_resultado_pdf_url` → `get_resultado_pdf`

**Files:**
- Modify: `backend/resultados/services/fasil_service.py`
- Modify: `backend/resultados/tests_fasil_service.py`

- [ ] **Step 1: Añadir tests del método al final de `tests_fasil_service.py`**

```python
class FasilServiceGetResultadoPdfV2Tests(TestCase):
    """Tests de get_resultado_pdf con _follow_birt_response mockeado."""

    @patch('resultados.services.fasil_service._follow_birt_response', return_value=b'%PDF-1.4 real')
    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=True)
    @patch('resultados.services.fasil_service._get_fasil_cursor')
    def test_retorna_bytes_pdf_cuando_birt_responde_ok(self, mock_cursor_fn, _, mock_follow):
        """get_resultado_pdf consulta empresa_id y delega a _follow_birt_response."""
        cursor = MagicMock()
        cursor.fetchone.return_value = (40,)
        mock_cursor_fn.return_value = cursor

        result = fasil_service.get_resultado_pdf('116703')

        self.assertEqual(result, b'%PDF-1.4 real')
        mock_follow.assert_called_once()

    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=True)
    @patch('resultados.services.fasil_service._get_fasil_cursor')
    def test_orden_inexistente_lanza_fasil_orden_no_encontrada(self, mock_cursor_fn, _):
        """Si svc_ordenes no tiene el idOrden, lanza FasilOrdenNoEncontrada."""
        cursor = MagicMock()
        cursor.fetchone.return_value = None
        mock_cursor_fn.return_value = cursor

        with self.assertRaises(FasilOrdenNoEncontrada):
            fasil_service.get_resultado_pdf('9999')

    def test_modo_mock_lanza_not_implemented(self):
        """En FASIL_ENABLED=False, lanza NotImplementedError."""
        with self.assertRaises(NotImplementedError):
            fasil_service.get_resultado_pdf('1')
```

- [ ] **Step 2: Ejecutar los tests — deben fallar**

```bash
cd backend
python manage.py test resultados.tests_fasil_service.FasilServiceGetResultadoPdfV2Tests -v 2
```

Resultado esperado: `AttributeError` — `FasilService has no attribute 'get_resultado_pdf'`.

- [ ] **Step 3: Reemplazar el método completo `get_resultado_pdf_url` por `get_resultado_pdf`**

En `fasil_service.py`, reemplazar desde `def get_resultado_pdf_url` hasta el último `return (f"{birt_host}...")` del método con:

```python
    def get_resultado_pdf(self, orden_id: str) -> bytes:
        """
        Obtiene los bytes del PDF desde BIRT de forma automática.

        BIRT muestra una página HTML con un formulario antes de servir el PDF.
        Este método hace el GET inicial con requests.Session(), parsea el formulario
        con BeautifulSoup y hace el POST automático — sin interacción del usuario.

        Args:
            orden_id: ID de la orden en FASIL (svc_ordenes.idOrden).

        Returns:
            Bytes del PDF generado por BIRT.

        Raises:
            FasilOrdenNoEncontrada: Si idOrden no existe en svc_ordenes.
            FasilConexionError: Si no se puede conectar a FASIL o a BIRT.
        """
        if not self.enabled:
            logger.info("FASIL get_resultado_pdf | orden_id=%s | modo=MOCK", orden_id)
            raise NotImplementedError(
                "get_resultado_pdf() en modo MOCK. "
                "Los PDFs FASIL solo están disponibles en despliegue on-premise."
            )

        logger.info("FASIL get_resultado_pdf | orden_id=%s | modo=REAL", orden_id)

        # 1. Obtener idEmpresa para construir la URL BIRT
        try:
            cursor = _get_fasil_cursor()
            cursor.execute(
                "SELECT idEmpresa FROM svc_ordenes WHERE idOrden = %s LIMIT 1",
                [orden_id]
            )
            row = cursor.fetchone()
            cursor.close()
        except Exception as e:
            logger.error("FASIL get_resultado_pdf error buscando orden: %s", str(e))
            raise FasilConexionError(f"Error consultando orden en FASIL: {e}")

        if not row:
            raise FasilOrdenNoEncontrada(
                f"No se encontró la orden '{orden_id}' en FASIL."
            )

        empresa_id = row[0]

        # 2. Construir URL BIRT con todos los parámetros del reporte
        birt_host = getattr(settings, 'FASIL_BIRT_HOST', 'http://192.168.1.109:8080')
        birt_user = getattr(settings, 'FASIL_BIRT_USER', '54')
        url = (
            f"{birt_host}/BioanalisisRepo30/run"
            f"?__format=pdf"
            f"&__report=ListadoResultadosOrden4.rptdesign"
            f"&Pentrega=false"
            f"&Ptitulos=true"
            f"&Pfirmas=false"
            f"&PMDesde=0"
            f"&PMHasta=999"
            f"&Premitido=0"
            f"&PmediaCarta=false"
            f"&Ppiefirma=false"
            f"&Phistoria=Historia%20"
            f"&Pcomentario=l"
            f"&Psinfirmas=false"
            f"&Pacreditada=2"
            f"&Pconfoto=false"
            f"&Pcarpeta=a"
            f"&usuario={birt_user}"
            f"&Documento=%22%25%22"
            f"&Desde%20Empresa={empresa_id}"
            f"&Hasta%20Empresa={empresa_id}"
            f"&Desde%20Orden={orden_id}"
            f"&Hasta%20Orden={orden_id}"
        )

        # 3. GET inicial + seguir formulario HTML de BIRT automáticamente
        try:
            session = requests.Session()
            response = session.get(url, timeout=30)
            response.raise_for_status()
            return _follow_birt_response(session, response, url)
        except (FasilOrdenNoEncontrada, FasilConexionError):
            raise
        except Exception as e:
            logger.error("FASIL get_resultado_pdf error: %s | url=%s", str(e), url)
            raise FasilConexionError(f"Error obteniendo PDF de BIRT: {e}")
```

- [ ] **Step 4: Ejecutar los tests del método**

```bash
cd backend
python manage.py test resultados.tests_fasil_service.FasilServiceGetResultadoPdfV2Tests -v 2
```

Resultado esperado: 3 tests `OK`.

- [ ] **Step 5: Ejecutar todos los tests del proyecto**

```bash
cd backend
python manage.py test -v 2
```

Resultado esperado: todos `OK`. Si algún test referencia `get_resultado_pdf_url`, renombrarlo a `get_resultado_pdf`.

---

## Task 6: Actualizar vista — retornar bytes del PDF (revertir)

**Files:**
- Modify: `backend/resultados/views.py`

- [ ] **Step 1: Reemplazar la rama FASIL en `ResultadoDescargarPDFView.get()`**

Localizar el bloque (aprox. línea 357):

```python
        # Ruta FASIL: pk empieza con "fasil-"
        if isinstance(pk, str) and pk.startswith('fasil-'):
            orden_id = pk[len('fasil-'):]
            try:
                pdf_url = fasil_service.get_resultado_pdf_url(orden_id)
            except FasilOrdenNoEncontrada:
                raise Http404("No se encontró el PDF en FASIL.")
            except (FasilConn, NotImplementedError) as e:
                raise Http404(f"PDF no disponible: {e}")

            from rest_framework.response import Response
            return Response({"pdf_url": pdf_url})
```

Reemplazar con:

```python
        # Ruta FASIL: pk empieza con "fasil-"
        if isinstance(pk, str) and pk.startswith('fasil-'):
            orden_id = pk[len('fasil-'):]
            try:
                pdf_bytes = fasil_service.get_resultado_pdf(orden_id)
            except FasilOrdenNoEncontrada:
                raise Http404("No se encontró el PDF en FASIL.")
            except (FasilConn, NotImplementedError) as e:
                raise Http404(f"PDF no disponible: {e}")

            from django.http import HttpResponse
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="resultado_{orden_id}.pdf"'
            return response
```

- [ ] **Step 2: Verificar que Django arranca sin errores**

```bash
cd backend
python manage.py check
```

Resultado esperado: `System check identified no issues (0 silenced).`

---

## Task 7: Revertir frontend al enfoque blob uniforme

**Files:**
- Modify: `app/dashboard/resultados/page.tsx`
- Modify: `app/dashboard/resultados/[id]/page.tsx`

- [ ] **Step 1: Reemplazar `descargarPDF` y `verPDFNuevaTab` en `page.tsx`**

Localizar las dos funciones (actualmente tienen lógica if/else fasil vs no-fasil) y reemplazarlas con la versión uniforme:

```typescript
  const descargarPDF = async (id: string, nombreArchivo: string | null) => {
    setDownloadingId(id);
    try {
      const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo ?? `resultado_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('No se pudo descargar el PDF: ' + (err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  const verPDFNuevaTab = async (id: string) => {
    const newTab = window.open('', '_blank');
    if (!newTab) {
      alert('Verifica que tu navegador permita ventanas emergentes para este sitio.');
      return;
    }
    setDownloadingId(id);
    try {
      const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
      const url = URL.createObjectURL(blob);
      newTab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      newTab.close();
      alert('No se pudo abrir el PDF: ' + (err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };
```

Si el import `apiFetch` quedó sin uso (verificar si se usa en `fetchResultados` u otras funciones de la página), eliminarlo del import. Si aún se usa en otros lugares, mantenerlo.

- [ ] **Step 2: Reemplazar `descargarPDF` en `[id]/page.tsx`**

```typescript
  const descargarPDF = async () => {
    if (!id) return;
    try {
      const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resultado?.nombre_archivo ?? `resultado_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('No se pudo descargar: ' + (err as Error).message);
    }
  };
```

- [ ] **Step 3: Commit final**

```bash
git add \
  backend/requirements.txt \
  backend/resultados/services/fasil_service.py \
  backend/resultados/views.py \
  backend/resultados/tests_fasil_service.py \
  app/dashboard/resultados/page.tsx \
  "app/dashboard/resultados/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(fasil): automatizar formulario BIRT — PDF sin click del usuario

El backend hace GET inicial a BIRT, parsea el formulario HTML con
BeautifulSoup + requests.Session, hace POST automático y retorna
los bytes del PDF directamente. Cubre formularios POST, JS redirect
y meta-refresh. Frontend vuelve al enfoque blob uniforme.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review del plan

**Cobertura del spec:**
- ✅ Eliminar click "OK" del usuario → Task 5 (`_follow_birt_response` + `get_resultado_pdf`)
- ✅ Mantener todos los parámetros BIRT existentes → Task 5 Step 3 (URL completa con todos los params)
- ✅ Frontend uniforme sin distinción fasil/manual → Task 7
- ✅ Vista retorna bytes con `HttpResponse` → Task 6
- ✅ `requests.Session()` para mantener cookies de sesión BIRT → Task 5 Step 3
- ✅ Cubre formulario POST (caso principal), JS redirect y meta-refresh → Task 4 Step 2
- ✅ Tests para `_follow_birt_response` → Task 3
- ✅ Tests para `get_resultado_pdf` → Task 5 Step 1

**Placeholder scan:** Ninguno. Todos los steps tienen código completo.

**Nota de contingencia (Task 1):** Si el diagnóstico en Task 1 revela que BIRT usa un mecanismo no cubierto (por ejemplo, una llamada AJAX asíncrona con polling), el plan necesita revisión. Señales de esto: el HTML contiene `XMLHttpRequest`, `fetch(`, o `setInterval`. En ese caso, el enfoque de BeautifulSoup no es suficiente y se requiere Playwright/Selenium headless. Abrir una conversación nueva con el HTML completo para replantear.
