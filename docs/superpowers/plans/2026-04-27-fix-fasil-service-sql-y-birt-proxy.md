# Fix FasilService: SQL Columns + BIRT Proxy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir dos bugs en `fasil_service.py` descubiertos al hacer DESCRIBE de las tablas reales de `bioanalisis30`: (1) nombres de columna equivocados en el subquery de `get_ordenes`, y (2) `get_resultado_pdf` que consulta columnas inexistentes — reemplazarlo con un proxy al servidor BIRT de la clínica.

**Architecture:** Dos cambios quirúrgicos en `FasilService`. El fix de `get_ordenes` corrige tres nombres de columna en el subquery SQL (sin cambio de firma ni de DTOs). El fix de `get_resultado_pdf` elimina la query a `svc_result` (que no tiene BLOBs) y la reemplaza con: (a) lookup de `idEmpresa` en `svc_ordenes`, (b) construcción de la URL BIRT parametrizada, (c) descarga via `requests.get()` proxeada desde el backend. El frontend y las vistas no cambian.

**Tech Stack:** Django 5.2, PyMySQL (conexión directa a MySQL 5.5), `requests` (nuevo), `python-decouple` (ya instalado).

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `backend/requirements.txt` | Modificar — añadir `requests` |
| `backend/.env` | Modificar — añadir `FASIL_BIRT_HOST` |
| `backend/config/settings.py` | Modificar — añadir `FASIL_BIRT_HOST` setting |
| `backend/resultados/services/fasil_service.py` | Modificar — fix SQL + reescribir `get_resultado_pdf` |
| `backend/resultados/tests_fasil_service.py` | Crear — tests unitarios del servicio con cursor mockeado |

---

## Task 1: Dependencia `requests` y setting `FASIL_BIRT_HOST`

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/.env`
- Modify: `backend/config/settings.py`

- [ ] **Step 1: Añadir `requests` a requirements.txt**

Añadir al final de `backend/requirements.txt`:

```
# HTTP client — usado por fasil_service para proxear PDFs desde servidor BIRT
requests==2.32.3
```

- [ ] **Step 2: Instalar la dependencia**

```bash
cd backend
pip install requests==2.32.3
```

Resultado esperado: `Successfully installed requests-2.32.3` (o similar si ya tiene versión compatible).

- [ ] **Step 3: Añadir `FASIL_BIRT_HOST` al `.env`**

Añadir al final del bloque FASIL en `backend/.env`:

```
FASIL_BIRT_HOST=http://192.168.1.109:8080
```

El archivo completo del bloque FASIL queda:

```
FASIL_ENABLED=False
FASIL_DB_NAME=bioanalisis30
FASIL_DB_USER=fasil2
FASIL_DB_PASSWORD=f4s1l2
FASIL_DB_HOST=192.168.1.109
FASIL_DB_PORT=3306
FASIL_BIRT_HOST=http://192.168.1.109:8080
```

- [ ] **Step 4: Añadir `FASIL_BIRT_HOST` a settings.py**

En `backend/config/settings.py`, añadir después de la línea `FASIL_DB_PORT`:

```python
FASIL_BIRT_HOST = config('FASIL_BIRT_HOST', default='http://192.168.1.109:8080')
```

El bloque FASIL completo queda:

```python
# BD FASIL (MySQL 5.5) — Conexion directa via PyMySQL (solo lectura)
# NOTA: Django 5.x exige MySQL >= 8.0.11 pero FASIL corre MySQL 5.5.56.
# Por eso NO se registra en DATABASES — Django lo rechazaria.
# La conexion se hace con PyMySQL directo desde fasil_service.py.
FASIL_ENABLED = config('FASIL_ENABLED', default=False, cast=bool)
FASIL_DB_NAME = config('FASIL_DB_NAME', default='bioanalisis30')
FASIL_DB_USER = config('FASIL_DB_USER', default='fasil2')
FASIL_DB_PASSWORD = config('FASIL_DB_PASSWORD', default='')
FASIL_DB_HOST = config('FASIL_DB_HOST', default='192.168.1.109')
FASIL_DB_PORT = config('FASIL_DB_PORT', default='3306')
FASIL_BIRT_HOST = config('FASIL_BIRT_HOST', default='http://192.168.1.109:8080')
```

- [ ] **Step 5: Verificar que Django arranca sin errores**

```bash
cd backend
python manage.py check
```

Resultado esperado: `System check identified no issues (0 silenced).`

---

## Task 2: Fix `get_ordenes` — nombres de columna SQL

**Contexto:** El schema real de `bioanalisis30` (obtenido con `DESCRIBE prb_prb` y `DESCRIBE svc_detordenes`) muestra:
- `svc_detordenes.idPrueba` (el código usaba `idPrb` — inexistente)
- `prb_prb.idPrueba` (el código usaba `idPrb` — inexistente)
- `prb_prb.namePrueba` (el código usaba `nomPrb` — inexistente)

Con los nombres incorrectos, MySQL lanza un error silenciado por el `except` genérico y `tipo_examen` siempre retorna `'Examen de laboratorio'`.

**Files:**
- Create: `backend/resultados/tests_fasil_service.py`
- Modify: `backend/resultados/services/fasil_service.py`

- [ ] **Step 1: Crear el archivo de tests unitarios del servicio**

Crear `backend/resultados/tests_fasil_service.py` con el siguiente contenido:

```python
from django.test import TestCase
from unittest.mock import patch, MagicMock
from resultados.services.fasil_service import fasil_service, FasilOrdenNoEncontrada, FasilConexionError
import requests as req_lib


class FasilServiceGetOrdenesTests(TestCase):
    """Tests unitarios de FasilService.get_ordenes con cursor mockeado."""

    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=True)
    @patch('resultados.services.fasil_service._get_fasil_cursor')
    def test_retorna_lista_de_ordenes_fasil(self, mock_cursor_fn, _):
        """get_ordenes mapea correctamente las filas del cursor a OrdenFASIL."""
        cursor = MagicMock()
        cursor.fetchall.return_value = [
            (101, 7, 'Hemograma Completo', '2026-04-01', 3),
            (102, 7, 'Perfil Lipídico',   '2026-03-15', 3),
        ]
        mock_cursor_fn.return_value = cursor

        result = fasil_service.get_ordenes('7')

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].id_orden, '101')
        self.assertEqual(result[0].tipo_examen, 'Hemograma Completo')
        self.assertEqual(result[0].fecha_examen, '2026-04-01')
        self.assertEqual(result[0].empresa_nit, '3')

    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=True)
    @patch('resultados.services.fasil_service._get_fasil_cursor')
    def test_lista_vacia_si_no_hay_ordenes(self, mock_cursor_fn, _):
        """get_ordenes retorna lista vacía si el cursor no devuelve filas."""
        cursor = MagicMock()
        cursor.fetchall.return_value = []
        mock_cursor_fn.return_value = cursor

        result = fasil_service.get_ordenes('9999')

        self.assertEqual(result, [])

    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=True)
    @patch('resultados.services.fasil_service._get_fasil_cursor')
    def test_empresa_nit_es_none_si_idempresa_es_null(self, mock_cursor_fn, _):
        """Si idEmpresa es NULL en la fila, empresa_nit queda None."""
        cursor = MagicMock()
        cursor.fetchall.return_value = [
            (201, 5, 'Glucosa', '2026-04-20', None),
        ]
        mock_cursor_fn.return_value = cursor

        result = fasil_service.get_ordenes('5')

        self.assertIsNone(result[0].empresa_nit)
```

- [ ] **Step 2: Ejecutar los tests para confirmar que pasan (lógica de mapeo correcta)**

```bash
cd backend
python manage.py test resultados.tests_fasil_service.FasilServiceGetOrdenesTests -v 2
```

Resultado esperado: 3 tests `OK`. Si fallan aquí hay un bug en el mapeo — revisar antes de continuar.

- [ ] **Step 3: Corregir los tres nombres de columna en `get_ordenes`**

En `backend/resultados/services/fasil_service.py`, dentro del método `get_ordenes`, reemplazar el subquery de `tipo_examen`:

```python
# ANTES (incorrecto — columnas inexistentes):
#   FROM svc_detordenes sd
#   JOIN prb_prb pp ON sd.idPrb = pp.idPrb
#   WHERE sd.idOrden = o.idOrden
#   LIMIT 1),
#   'Examen de laboratorio'
# ) AS tipo_examen,

# DESPUÉS (correcto — nombres reales verificados con DESCRIBE):
            sql = """
                SELECT
                    o.idOrden,
                    o.idPaciente,
                    COALESCE(
                        (SELECT pp.namePrueba
                         FROM svc_detordenes sd
                         JOIN prb_prb pp ON sd.idPrueba = pp.idPrueba
                         WHERE sd.idOrden = o.idOrden
                         LIMIT 1),
                        'Examen de laboratorio'
                    ) AS tipo_examen,
                    DATE_FORMAT(o.fecha, '%%Y-%%m-%%d') AS fecha_examen,
                    o.idEmpresa
                FROM svc_ordenes o
                WHERE o.idPaciente = %s
            """
```

El bloque completo del método `get_ordenes` (reemplazar desde `try:` hasta el `return`):

```python
        try:
            cursor = _get_fasil_cursor()

            sql = """
                SELECT
                    o.idOrden,
                    o.idPaciente,
                    COALESCE(
                        (SELECT pp.namePrueba
                         FROM svc_detordenes sd
                         JOIN prb_prb pp ON sd.idPrueba = pp.idPrueba
                         WHERE sd.idOrden = o.idOrden
                         LIMIT 1),
                        'Examen de laboratorio'
                    ) AS tipo_examen,
                    DATE_FORMAT(o.fecha, '%%Y-%%m-%%d') AS fecha_examen,
                    o.idEmpresa
                FROM svc_ordenes o
                WHERE o.idPaciente = %s
            """
            params = [paciente_id]

            if empresa_nit:
                sql += " AND o.idEmpresa = %s"
                params.append(empresa_nit)

            sql += " ORDER BY o.fecha DESC"

            cursor.execute(sql, params)
            rows = cursor.fetchall()
            cursor.close()

            return [
                OrdenFASIL(
                    id_orden=str(row[0]),
                    paciente_id=str(row[1]),
                    tipo_examen=row[2] or 'No especificado',
                    fecha_examen=row[3] or '',
                    empresa_nit=str(row[4]) if row[4] else None,
                    tiene_pdf=True,
                )
                for row in rows
            ]

        except Exception as e:
            logger.error("FASIL get_ordenes error: %s", str(e))
            raise FasilConexionError(f"Error consultando órdenes en FASIL: {e}")
```

- [ ] **Step 4: Re-ejecutar los tests**

```bash
cd backend
python manage.py test resultados.tests_fasil_service.FasilServiceGetOrdenesTests -v 2
```

Resultado esperado: 3 tests `OK`.

- [ ] **Step 5: Ejecutar todos los tests del proyecto para verificar que no rompimos nada**

```bash
cd backend
python manage.py test -v 2
```

Resultado esperado: todos `OK`.

- [ ] **Step 6: Commit Task 2**

```bash
git add backend/requirements.txt backend/.env backend/config/settings.py \
        backend/resultados/services/fasil_service.py \
        backend/resultados/tests_fasil_service.py
git commit -m "$(cat <<'EOF'
fix(fasil): corregir nombres de columna SQL en get_ordenes

DESCRIBE de bioanalisis30 revela que prb_prb usa idPrueba/namePrueba
y svc_detordenes usa idPrueba — no idPrb/nomPrb como estaba hardcodeado.
Con los nombres incorrectos el COALESCE siempre retornaba el fallback
'Examen de laboratorio'. Añade requests y FASIL_BIRT_HOST (prep Task 3).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Reescribir `get_resultado_pdf` como proxy BIRT

**Contexto:** `svc_result` (schema real): `id, idDetOrd, idCampo, idTipo, valor (varchar 255), validado, commentario, fecha`. No hay columna `archivo` ni `idOrden`. FASIL nunca almacenó PDFs como BLOBs — los generaba on-demand el servidor BIRT (`http://192.168.1.109:8080`). El sistema PHP viejo hacía redirect del browser directamente a BIRT (la IP era visible al cliente). El nuevo sistema actúa como proxy: Django descarga el PDF de BIRT (ambos en la misma LAN) y lo sirve al paciente sin exponer la IP interna.

URL BIRT descubierta en el código PHP original:
```
http://192.168.1.109:8080/BioanalisisRepo272/run
  ?__format=pdf
  &__report=ListadoResultadosOrden4.rptdesign
  &Desde%20Empresa={idEmpresa}
  &Hasta%20Empresa={idEmpresa}
  &Desde%20Orden={idOrden}
  &Hasta%20Orden={idOrden}
```

Requiere `idEmpresa`, que se obtiene de `svc_ordenes.idEmpresa` usando el `idOrden`.

**Files:**
- Modify: `backend/resultados/services/fasil_service.py`
- Modify: `backend/resultados/tests_fasil_service.py`

- [ ] **Step 1: Añadir el import de `requests` al top de `fasil_service.py`**

Añadir después de `from django.conf import settings`:

```python
import requests
```

El bloque de imports completo al top del archivo debe quedar:

```python
import logging
import requests
from dataclasses import dataclass
from typing import Optional
from django.conf import settings
```

- [ ] **Step 2: Escribir los tests que fallan para la nueva implementación**

Añadir al final de `backend/resultados/tests_fasil_service.py`:

```python
class FasilServiceGetResultadoPdfTests(TestCase):
    """Tests unitarios de FasilService.get_resultado_pdf con proxy BIRT."""

    @patch('resultados.services.fasil_service.requests')
    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=True)
    @patch('resultados.services.fasil_service._get_fasil_cursor')
    def test_descarga_pdf_y_construye_url_birt(self, mock_cursor_fn, _, mock_requests):
        """get_resultado_pdf consulta idEmpresa y construye URL BIRT correcta."""
        cursor = MagicMock()
        cursor.fetchone.return_value = (5,)   # idEmpresa = 5
        mock_cursor_fn.return_value = cursor

        mock_resp = MagicMock()
        mock_resp.content = b'%PDF-1.4 fake'
        mock_requests.get.return_value = mock_resp

        result = fasil_service.get_resultado_pdf('42')

        self.assertEqual(result, b'%PDF-1.4 fake')
        called_url = mock_requests.get.call_args[0][0]
        self.assertIn('Desde%20Orden=42', called_url)
        self.assertIn('Hasta%20Orden=42', called_url)
        self.assertIn('Desde%20Empresa=5', called_url)
        self.assertIn('ListadoResultadosOrden4.rptdesign', called_url)

    @patch('resultados.services.fasil_service.requests')
    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=True)
    @patch('resultados.services.fasil_service._get_fasil_cursor')
    def test_orden_inexistente_lanza_fasil_orden_no_encontrada(self, mock_cursor_fn, _, mock_requests):
        """Si svc_ordenes no tiene el idOrden, lanza FasilOrdenNoEncontrada."""
        cursor = MagicMock()
        cursor.fetchone.return_value = None   # orden no existe
        mock_cursor_fn.return_value = cursor

        with self.assertRaises(FasilOrdenNoEncontrada):
            fasil_service.get_resultado_pdf('9999')

        mock_requests.get.assert_not_called()

    @patch('resultados.services.fasil_service.requests')
    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=True)
    @patch('resultados.services.fasil_service._get_fasil_cursor')
    def test_birt_http_error_lanza_fasil_conexion_error(self, mock_cursor_fn, _, mock_requests):
        """Si BIRT responde error HTTP, lanza FasilConexionError."""
        cursor = MagicMock()
        cursor.fetchone.return_value = (3,)
        mock_cursor_fn.return_value = cursor

        mock_resp = MagicMock()
        mock_resp.raise_for_status.side_effect = req_lib.exceptions.HTTPError('503')
        mock_requests.get.return_value = mock_resp
        mock_requests.exceptions.HTTPError = req_lib.exceptions.HTTPError

        with self.assertRaises(FasilConexionError):
            fasil_service.get_resultado_pdf('77')
```

- [ ] **Step 3: Ejecutar los tests para confirmar que fallan**

```bash
cd backend
python manage.py test resultados.tests_fasil_service.FasilServiceGetResultadoPdfTests -v 2
```

Resultado esperado: `FAIL` o `ERROR` — la implementación actual consulta `svc_result.archivo` que no existe.

- [ ] **Step 4: Reemplazar el método `get_resultado_pdf` en `fasil_service.py`**

Reemplazar el método completo `get_resultado_pdf` (desde `def get_resultado_pdf` hasta el último `except` del método) con:

```python
    def get_resultado_pdf(self, orden_id: str) -> bytes:
        """
        Descarga el PDF de un resultado proxeando el servidor BIRT de la clínica.

        El sistema PHP viejo redirigía el browser del paciente directamente a BIRT:
            header("Location: http://192.168.1.109:8080/BioanalisisRepo272/run?...")
        Esto exponía la IP interna y fallaba desde fuera de la red.

        El nuevo sistema actúa como proxy: el backend (en la misma LAN que BIRT)
        descarga el PDF y lo sirve al paciente. La IP de BIRT nunca sale al cliente.

        URL BIRT requiere idEmpresa además de idOrden — se obtiene de svc_ordenes.

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
                "Los PDFs mock deben cargarse manualmente desde el panel admin."
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

        # 2. Construir URL BIRT con los parámetros del reporte
        birt_host = getattr(settings, 'FASIL_BIRT_HOST', 'http://192.168.1.109:8080')
        url = (
            f"{birt_host}/BioanalisisRepo272/run"
            f"?__format=pdf"
            f"&__report=ListadoResultadosOrden4.rptdesign"
            f"&Desde%20Empresa={empresa_id}"
            f"&Hasta%20Empresa={empresa_id}"
            f"&Desde%20Orden={orden_id}"
            f"&Hasta%20Orden={orden_id}"
        )

        # 3. Proxear la descarga desde BIRT (backend y BIRT están en la misma LAN)
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response.content
        except Exception as e:
            logger.error("FASIL get_resultado_pdf error BIRT: %s | url=%s", str(e), url)
            raise FasilConexionError(f"No se pudo obtener el PDF desde BIRT: {e}")
```

- [ ] **Step 5: Ejecutar los tests del servicio**

```bash
cd backend
python manage.py test resultados.tests_fasil_service.FasilServiceGetResultadoPdfTests -v 2
```

Resultado esperado: 3 tests `OK`.

- [ ] **Step 6: Ejecutar todos los tests del proyecto**

```bash
cd backend
python manage.py test -v 2
```

Resultado esperado: todos `OK`. Los tests de vista (`ResultadoPDFFasilTests`) mockean `fasil_service.get_resultado_pdf` al nivel de la view, por lo que siguen pasando independientemente de la implementación interna.

- [ ] **Step 7: Commit final**

```bash
git add backend/resultados/services/fasil_service.py \
        backend/resultados/tests_fasil_service.py
git commit -m "$(cat <<'EOF'
fix(fasil): reemplazar query BLOB inexistente con proxy BIRT en get_resultado_pdf

svc_result no tiene columna 'archivo' ni 'idOrden' — FASIL nunca almacenó
PDFs como BLOBs; los generaba on-demand el servidor BIRT. La implementación
anterior lanzaba FasilConexionError silencioso en modo REAL.

Nueva implementación: lookup de idEmpresa en svc_ordenes → construir URL
BIRT con parámetros del reporte → requests.get() desde el backend (misma
LAN que BIRT) → stream de bytes al cliente. La IP de BIRT nunca sale al
navegador del paciente.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review del plan

**Cobertura del spec:**
- ✅ Fix `get_ordenes`: `sd.idPrb → sd.idPrueba`, `pp.idPrb → pp.idPrueba`, `pp.nomPrb → pp.namePrueba` → Task 2 Step 3
- ✅ Fix `get_resultado_pdf`: elimina query a `svc_result.archivo` → Task 3 Step 4
- ✅ Proxy BIRT con URL real descubierta en PHP: `ListadoResultadosOrden4.rptdesign` + parámetros `Desde/Hasta Empresa` y `Desde/Hasta Orden` → Task 3 Step 4
- ✅ `FASIL_BIRT_HOST` configurable via `.env` → Task 1 Steps 3 y 4
- ✅ `requests` añadido a requirements.txt → Task 1 Step 1
- ✅ Tests unitarios con cursor mockeado para ambos métodos → Tasks 2 y 3

**Placeholder scan:** Ninguno. Todos los steps tienen código completo.

**Consistencia de tipos:**
- `get_ordenes` retorna `OrdenFASIL` con `id_orden=str(row[0])`. Test verifica `result[0].id_orden == '101'`. ✅
- `get_resultado_pdf` recibe `orden_id: str`, lo usa en SQL como `%s` (PyMySQL acepta str en WHERE INT). ✅
- `empresa_id = row[0]` es `int` desde MySQL; se interpola directamente en la URL f-string → `Desde%20Empresa=5`. ✅
- `requests` importado al top del módulo; en tests se mockea `resultados.services.fasil_service.requests`. ✅
- `mock_requests.exceptions.HTTPError` se asigna a `req_lib.exceptions.HTTPError` en el test para que el `except Exception` lo capture. ✅
