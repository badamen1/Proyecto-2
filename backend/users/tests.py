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
        self.documento = '123456789'

    def test_request_otp(self):
        """Prueba que un paciente pueda solicitar un OTP y se cree en la base de datos"""
        data = {'documento': self.documento}
        response = self.client.post(self.request_otp_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verificar que el usuario se creó como PACIENTE
        self.assertTrue(User.objects.filter(documento=self.documento).exists())
        user = User.objects.get(documento=self.documento)
        self.assertEqual(user.role, User.Role.PACIENTE)
        
        # Verificar que el cache se llenó correctamente
        otp_guardado = cache.get(f"otp_{self.documento}")
        self.assertIsNotNone(otp_guardado)

    def test_verify_valid_otp(self):
        """Prueba la verificación de un OTP válido y la generación del token JWT"""
        # Primero solicitar para generar el registro y el cache
        self.client.post(self.request_otp_url, {'documento': self.documento})
        otp_guardado = cache.get(f"otp_{self.documento}")
        
        # Ahora verificar
        data = {
            'documento': self.documento,
            'otp': otp_guardado
        }
        response = self.client.post(self.verify_otp_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['role'], 'paciente')

    def test_verify_invalid_otp(self):
        """Prueba que devuelva Unauthorized con un OTP incorrecto"""
        self.client.post(self.request_otp_url, {'documento': self.documento})
        
        data = {
            'documento': self.documento,
            'otp': '000000' # OTP seguramente incorrecto
        }
        response = self.client.post(self.verify_otp_url, data)
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


class PublicRegisterSecurityTests(APITestCase):
    """
    Tests de seguridad para la corrección N-01:
    El endpoint público POST /api/auth/register/ NO debe permitir
    crear usuarios con roles privilegiados (admin, bacteriologo).

    Antes de la corrección: RegisterSerializer aceptaba `role` en el body
    → un atacante podía crear un admin sin autenticación.

    Después de la corrección: RegisterSerializer excluye `role` del body
    y fuerza PACIENTE en create(). Si se envía `role` en el body, es ignorado.
    """

    def setUp(self):
        self.register_url = '/api/auth/register/'

    def test_public_register_creates_paciente_by_default(self):
        """El registro público crea siempre un usuario PACIENTE."""
        data = {
            'username': 'nuevo_paciente',
            'password': 'contraseña123',
            'documento': '123000001',
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username='nuevo_paciente')
        self.assertEqual(user.role, User.Role.PACIENTE)

    def test_public_register_ignores_admin_role_in_body(self):
        """
        Si alguien envía role='admin' al endpoint público, el campo es ignorado
        y el usuario se crea como PACIENTE de todas formas.
        Esto es el cierre concreto de la vulnerabilidad N-01.
        """
        data = {
            'username': 'atacante_admin',
            'password': 'contraseña123',
            'documento': '999000001',
            'role': 'admin',  # Intento de escalación de privilegios
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username='atacante_admin')
        # El rol debe ser PACIENTE, no admin
        self.assertEqual(user.role, User.Role.PACIENTE)
        self.assertNotEqual(user.role, User.Role.ADMIN)

    def test_public_register_ignores_bacteriologo_role_in_body(self):
        """
        El endpoint público tampoco debe permitir crear bacteriólogos.
        """
        data = {
            'username': 'atacante_bacte',
            'password': 'contraseña123',
            'documento': '999000002',
            'role': 'bacteriologo',
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username='atacante_bacte')
        self.assertEqual(user.role, User.Role.PACIENTE)
        self.assertNotEqual(user.role, User.Role.BACTERIOLOGO)

    def test_admin_can_still_create_bacteriologo_via_users_endpoint(self):
        """
        El flujo legítimo del admin para crear bacteriólogos no se rompe.
        POST /api/auth/users/ (autenticado como admin) sí acepta roles privilegiados.
        """
        admin = User.objects.create_user(
            username='admin_test', password='pw', role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=admin)

        data = {
            'username': 'bacteriologo_legit',
            'password': 'contraseña123',
            'documento': '777000001',
            'role': 'bacteriologo',
        }
        response = self.client.post('/api/auth/users/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username='bacteriologo_legit')
        self.assertEqual(user.role, User.Role.BACTERIOLOGO)

