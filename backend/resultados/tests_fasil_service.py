from django.test import SimpleTestCase
from unittest.mock import patch, MagicMock
from resultados.services.fasil_service import fasil_service, FasilOrdenNoEncontrada, FasilConexionError


class FasilServiceGetOrdenesTests(SimpleTestCase):
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

    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=False)
    def test_mock_ordenes_tienen_pdf_false(self, _):
        """_mock_get_ordenes debe retornar órdenes con tiene_pdf=False (BIRT no disponible en desarrollo)."""
        result = fasil_service.get_ordenes('7')

        self.assertTrue(len(result) > 0, "Se esperan al menos 2 órdenes mock")
        for orden in result:
            self.assertFalse(orden.tiene_pdf, f"Orden {orden.id_orden} debe tener tiene_pdf=False")


class FasilServiceGetResultadoPdfTests(SimpleTestCase):
    """Tests de get_resultado_pdf con GET+POST a BIRT via requests.Session()."""

    def _mock_html_response(self):
        resp = MagicMock()
        resp.status_code = 200
        resp.headers = {'content-type': 'text/html;charset=utf-8'}
        resp.content = b'<html>BIRT Viewer</html>'
        resp.raise_for_status = MagicMock()
        return resp

    def _mock_pdf_response(self):
        resp = MagicMock()
        resp.status_code = 200
        resp.headers = {'content-type': 'application/pdf'}
        resp.content = b'%PDF-1.4 fake'
        resp.raise_for_status = MagicMock()
        return resp

    @patch('resultados.services.fasil_service.requests.Session')
    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=True)
    @patch('resultados.services.fasil_service._get_fasil_cursor')
    def test_get_html_luego_post_retorna_pdf(self, mock_cursor_fn, _, mock_session_cls):
        """Flujo normal: GET devuelve HTML, POST devuelve PDF."""
        cursor = MagicMock()
        cursor.fetchone.return_value = (1,)  # empresa_id = 1
        mock_cursor_fn.return_value = cursor

        session = MagicMock()
        session.get.return_value = self._mock_html_response()
        session.post.return_value = self._mock_pdf_response()
        mock_session_cls.return_value = session

        result = fasil_service.get_resultado_pdf('116657')

        self.assertEqual(result, b'%PDF-1.4 fake')
        session.get.assert_called_once()
        session.post.assert_called_once()
        # Verificar que el POST incluye los parámetros clave
        post_data = session.post.call_args[1]['data']
        self.assertEqual(post_data['__format'], 'pdf')
        self.assertEqual(post_data['DesdePrioridad'], '1')
        self.assertEqual(post_data['HastaPrioridad'], '17')

    @patch('resultados.services.fasil_service.requests.Session')
    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=True)
    @patch('resultados.services.fasil_service._get_fasil_cursor')
    def test_get_directo_pdf_sin_post(self, mock_cursor_fn, _, mock_session_cls):
        """Si BIRT devuelve PDF directo en el GET, no hace POST."""
        cursor = MagicMock()
        cursor.fetchone.return_value = (1,)
        mock_cursor_fn.return_value = cursor

        session = MagicMock()
        session.get.return_value = self._mock_pdf_response()
        mock_session_cls.return_value = session

        result = fasil_service.get_resultado_pdf('116657')

        self.assertEqual(result, b'%PDF-1.4 fake')
        session.post.assert_not_called()

    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=True)
    @patch('resultados.services.fasil_service._get_fasil_cursor')
    def test_orden_inexistente_lanza_error(self, mock_cursor_fn, _):
        """Si la orden no existe en FASIL, lanza FasilOrdenNoEncontrada."""
        cursor = MagicMock()
        cursor.fetchone.return_value = None
        mock_cursor_fn.return_value = cursor

        with self.assertRaises(FasilOrdenNoEncontrada):
            fasil_service.get_resultado_pdf('9999')

    def test_modo_mock_lanza_not_implemented(self):
        """En FASIL_ENABLED=False, lanza NotImplementedError."""
        with self.assertRaises(NotImplementedError):
            fasil_service.get_resultado_pdf('1')

    @patch('resultados.services.fasil_service.requests.Session')
    @patch('resultados.services.fasil_service._is_fasil_enabled', return_value=True)
    @patch('resultados.services.fasil_service._get_fasil_cursor')
    def test_error_http_birt_lanza_fasil_conexion_error(self, mock_cursor_fn, _, mock_session_cls):
        """Si BIRT devuelve error HTTP (ej. 503), lanza FasilConexionError."""
        from resultados.services.fasil_service import FasilConexionError
        import requests as req_lib

        cursor = MagicMock()
        cursor.fetchone.return_value = (1,)
        mock_cursor_fn.return_value = cursor

        session = MagicMock()
        error_resp = MagicMock()
        error_resp.content = b'<html>Service Unavailable</html>'
        error_resp.raise_for_status.side_effect = req_lib.exceptions.HTTPError('503 Server Error')
        session.get.return_value = error_resp
        mock_session_cls.return_value = session

        with self.assertRaises(FasilConexionError):
            fasil_service.get_resultado_pdf('116657')
