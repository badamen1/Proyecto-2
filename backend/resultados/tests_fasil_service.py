import requests as req_lib
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


class FasilServiceGetResultadoPdfTests(SimpleTestCase):
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

        self.assertEqual(fasil_service.get_resultado_pdf('42'), b'%PDF-1.4 fake')
        called_url = mock_requests.get.call_args[0][0]
        self.assertIn('BioanalisisRepo272/run', called_url)
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
