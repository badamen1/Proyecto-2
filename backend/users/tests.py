from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.core.cache import cache

User = get_user_model()

class AuthTests(APITestCase):

    def setUp(self):
        # Crear usuario Administrador
        self.admin_user = User.objects.create_user(
            username='1078458080',
            password='testpassword123',
            role=User.Role.ADMIN,
            documento='1078458080'
        )
        # Crear usuario Bacteriólogo
        self.bacteriologo_user = User.objects.create_user(
            username='987654321',
            password='testpassword123',
            role=User.Role.BACTERIOLOGO,
            documento='987654321'
        )
        self.login_url = '/api/auth/login/'

    def test_admin_can_login_with_password(self):
        """Prueba que un admin o personal pueda hacer login con usuario y contraseña"""
        data = {
            'username': '1078458080',
            'password': 'testpassword123'
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_invalid_login(self):
        """Prueba login con credenciales incorrectas"""
        data = {
            'username': '1078458080',
            'password': 'wrongpassword'
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class OTPTests(APITestCase):

    def setUp(self):
        self.request_otp_url = '/api/auth/otp/request/'
        self.verify_otp_url = '/api/auth/otp/verify/'

        # Paciente pre-registrado en nuestro sistema
        self.paciente = User.objects.create(
            username='123456789',
            documento='123456789',
            nombre_completo='María García',
            role=User.Role.PACIENTE,
        )
        self.paciente.set_unusable_password()
        self.paciente.save()

    def tearDown(self):
        cache.clear()

    def test_otp_rechaza_documento_sin_cuenta(self):
        """OTP request con documento no registrado → 404."""
        response = self.client.post(self.request_otp_url, {'documento': '00000000'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('Regístrate primero', response.data['detail'])
        # No se debe haber creado ningún usuario nuevo
        self.assertFalse(User.objects.filter(documento='00000000').exists())

    def test_otp_acepta_documento_registrado(self):
        """OTP request con documento registrado → 200 y OTP en cache."""
        response = self.client.post(self.request_otp_url, {'documento': '123456789'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        otp_guardado = cache.get('otp_123456789')
        self.assertIsNotNone(otp_guardado)
        self.assertEqual(len(otp_guardado), 6)

    def test_otp_sin_documento_retorna_400(self):
        """OTP request sin el campo documento → 400."""
        response = self.client.post(self.request_otp_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_valid_otp(self):
        """OTP correcto para usuario registrado → JWT con role."""
        # Solicitar OTP primero
        self.client.post(self.request_otp_url, {'documento': '123456789'})
        otp_guardado = cache.get('otp_123456789')

        response = self.client.post(self.verify_otp_url, {
            'documento': '123456789',
            'otp': otp_guardado,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['role'], 'paciente')

    def test_verify_invalid_otp(self):
        """OTP incorrecto → 401."""
        self.client.post(self.request_otp_url, {'documento': '123456789'})
        response = self.client.post(self.verify_otp_url, {
            'documento': '123456789',
            'otp': '000000',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class RoleManagementTests(APITestCase):

    def setUp(self):
        self.users_url = '/api/auth/users/'
        
        self.admin_user = User.objects.create_user(
            username='admin1', password='pw', role=User.Role.ADMIN
        )
        self.patient_user = User.objects.create_user(
            username='patient1', password='pw', role=User.Role.PACIENTE
        )
        
        self.new_user_data = {
            'username': '111222333',
            'password': 'newpassword123',
            'first_name': 'Nuevo',
            'last_name': 'Bacteriologo',
            'documento': '111222333',
            'role': 'bacteriologo'
        }

    def test_admin_can_create_user(self):
        """Verifica que un administrador pueda registrar un nuevo empleado"""
        # Autenticar como admin
        self.client.force_authenticate(user=self.admin_user)
        
        response = self.client.post(self.users_url, self.new_user_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), 3)
        self.assertEqual(User.objects.last().role, 'bacteriologo')

    def test_patient_cannot_create_user(self):
        """Verifica que si un paciente intenta crear un usuario, el servidor lo rechaza"""
        # Autenticar como paciente
        self.client.force_authenticate(user=self.patient_user)
        
        response = self.client.post(self.users_url, self.new_user_data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(User.objects.count(), 2)

    def test_unauthenticated_cannot_create_user(self):
        """Verifica que no se pueda crear usuarios sin iniciar sesión publicamente en la lista de recursos"""
        response = self.client.post(self.users_url, self.new_user_data)
        # La vista de ListCreate necesita IsAuthenticated
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class PacienteRegisterTests(APITestCase):
    """Tests para el nuevo flujo de registro de pacientes sin contraseña."""

    def setUp(self):
        self.register_url = '/api/auth/register/'

    def test_registro_con_nombre_completo_crea_paciente(self):
        """Registro con nombre_completo crea User PACIENTE sin contraseña."""
        data = {
            'documento': '123456789',
            'tipo_documento': 'CC',
            'nombre_completo': 'Ana María Torres',
            'email': 'ana@ejemplo.com',
            'telefono': '3001234567',
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(documento='123456789')
        self.assertEqual(user.nombre_completo, 'Ana María Torres')
        self.assertEqual(user.role, User.Role.PACIENTE)
        self.assertEqual(user.username, '123456789')
        self.assertFalse(user.has_usable_password())

    def test_registro_sin_nombre_completo_falla(self):
        """nombre_completo es obligatorio."""
        data = {'documento': '111222333'}
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nombre_completo', response.data)

    def test_registro_duplicado_falla(self):
        """No se puede registrar el mismo documento dos veces."""
        data = {
            'documento': '999888777',
            'nombre_completo': 'Carlos López',
        }
        self.client.post(self.register_url, data)
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registro_ignora_role_en_body(self):
        """El campo role del body es ignorado — siempre crea PACIENTE."""
        data = {
            'documento': '777666555',
            'nombre_completo': 'Atacante Admin',
            'role': 'admin',
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(documento='777666555')
        self.assertEqual(user.role, User.Role.PACIENTE)

