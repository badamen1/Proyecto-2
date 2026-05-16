from django.test import TestCase
from django.contrib.auth import get_user_model
from resultados.models import Resultado, Paciente
from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import patch
import datetime

User = get_user_model()


class ResultadoPacienteUserTests(TestCase):

    def setUp(self):
        self.user = User.objects.create(
            username='12345678',
            documento='12345678',
            nombre_completo='Test Paciente',
            role=User.Role.PACIENTE,
        )
        self.user.set_unusable_password()
        self.user.save()

        self.paciente = Paciente.objects.create(
            documento='12345678',
            nombre_completo='Test Paciente',
            user=self.user,
        )

    def test_resultado_tiene_campo_paciente_user(self):
        """Resultado puede asignarse directamente a un User."""
        r = Resultado(
            paciente=self.paciente,
            paciente_user=self.user,
            tipo_examen='Hemograma',
            fuente='MANUAL',
            estado='VALIDADO',
            fecha_examen=datetime.date.today(),
        )
        self.assertEqual(r.paciente_user, self.user)

    def test_resultado_paciente_es_nullable(self):
        """El campo paciente acepta null."""
        r = Resultado(
            paciente=None,
            paciente_user=self.user,
            tipo_examen='Hemograma',
            fuente='MANUAL',
            estado='VALIDADO',
            fecha_examen=datetime.date.today(),
        )
        self.assertIsNone(r.paciente)


class ResultadoListPacienteUserTests(APITestCase):
    """Paciente ve sus resultados via paciente_user FK (no via Paciente model)."""

    def setUp(self):
        self.user = User.objects.create(
            username='55566677',
            documento='55566677',
            nombre_completo='Juan Pérez',
            role=User.Role.PACIENTE,
        )
        self.user.set_unusable_password()
        self.user.save()

        self.resultado = Resultado.objects.create(
            paciente_user=self.user,
            tipo_examen='Glucosa',
            fuente='MANUAL',
            estado='VALIDADO',
            fecha_examen=datetime.date.today(),
        )

    def test_paciente_ve_sus_resultados_via_paciente_user(self):
        """GET /api/resultados/ retorna resultados vinculados por paciente_user."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/resultados/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [str(r['id']) for r in response.data['results']]
        self.assertIn(str(self.resultado.id), ids)

    @patch('resultados.views.fasil_service.get_paciente')
    def test_paciente_no_ve_resultados_de_otro(self, mock_paciente):
        """Paciente solo ve sus propios resultados (FASIL no añade resultados ajenos)."""
        from resultados.services.fasil_service import FasilPacienteNoEncontrado
        mock_paciente.side_effect = FasilPacienteNoEncontrado('no encontrado')

        otro_user = User.objects.create(
            username='99988877',
            documento='99988877',
            nombre_completo='Otro Paciente',
            role=User.Role.PACIENTE,
        )
        otro_user.set_unusable_password()
        otro_user.save()

        self.client.force_authenticate(user=otro_user)
        response = self.client.get('/api/resultados/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 0)


from resultados.services.fasil_service import (
    PacienteFASIL, OrdenFASIL, FasilPacienteNoEncontrado, FasilConexionError
)


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
        """Si FASIL lanza FasilConexionError, retorna solo manuales sin 500."""
        mock_paciente.side_effect = FasilConexionError('timeout')

        response = self.client.get('/api/resultados/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [r['id'] for r in response.data['results']]
        self.assertIn(str(self.resultado_manual.pk), ids)
        self.assertFalse(any('fasil-' in i for i in ids))

    @patch('resultados.views.fasil_service.get_paciente')
    def test_paciente_no_en_fasil_retorna_solo_manuales(self, mock_paciente):
        """Si paciente no existe en FASIL, retorna solo manuales sin error."""
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


from resultados.services.fasil_service import FasilOrdenNoEncontrada


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
        mock_pdf.side_effect = FasilOrdenNoEncontrada('no encontrado')

        response = self.client.get('/api/resultados/fasil-ORD-00/pdf/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ResultadoLakeModelTests(TestCase):
    """Resultado puede existir con solo paciente_documento (sin FK a Paciente ni User)."""

    def test_resultado_acepta_solo_paciente_documento(self):
        r = Resultado(
            paciente_documento='99900011',
            tipo_examen='Perfil Lipídico',
            fuente='EXTERNO',
            estado='PENDIENTE',
            fecha_examen=datetime.date.today(),
        )
        self.assertEqual(r.paciente_documento, '99900011')
        self.assertIsNone(r.paciente)
        self.assertIsNone(r.paciente_user)

    def test_str_resultado_sin_paciente_usa_documento(self):
        r = Resultado(
            paciente_documento='99900011',
            tipo_examen='Hemograma',
            fuente='EXTERNO',
            estado='PENDIENTE',
            fecha_examen=datetime.date.today(),
        )
        self.assertIn('Hemograma', str(r))
