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
