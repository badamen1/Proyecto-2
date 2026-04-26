from django.test import TestCase
from django.contrib.auth import get_user_model
from resultados.models import Resultado, Paciente
from rest_framework.test import APITestCase
from rest_framework import status
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

    def test_paciente_no_ve_resultados_de_otro(self):
        """Paciente solo ve sus propios resultados."""
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
