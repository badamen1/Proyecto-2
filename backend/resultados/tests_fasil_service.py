from django.test import SimpleTestCase
from unittest.mock import patch, MagicMock
from resultados.services.fasil_service import fasil_service, FasilOrdenNoEncontrada, FasilConexionError
import requests as req_lib


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
