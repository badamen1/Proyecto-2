from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.core.cache import cache
import random
import logging
from .serializers import UserSerializer, RegisterSerializer, StaffRegisterSerializer, CustomTokenObtainPairSerializer

User = get_user_model()
logger = logging.getLogger('users')

class CustomTokenObtainPairView(TokenObtainPairView):
    # Personaliza la respuesta del Token JWT para Admin/Personal que sí usa contraseña
    serializer_class = CustomTokenObtainPairSerializer

class RequestOTPView(APIView):
    """
    Paso 1 del Login de Pacientes.

    El paciente ingresa su documento. Si tiene cuenta registrada se genera
    y envía el OTP. Si no tiene cuenta se rechaza con 404 explícito.

    CAMBIO ARQUITECTÓNICO: Ya no hace get_or_create.
    El paciente debe registrarse primero en POST /api/auth/register/.
    """
    permission_classes = (AllowAny,)

    def post(self, request):
        documento = request.data.get('documento', '').strip()
        if not documento:
            return Response(
                {"detail": "Se requiere el documento."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(documento=documento)
        except User.DoesNotExist:
            return Response(
                {"detail": "No tienes una cuenta. Regístrate primero."},
                status=status.HTTP_404_NOT_FOUND
            )

        otp_code = str(random.randint(100000, 999999))
        cache.set(f"otp_{documento}", otp_code, timeout=300)

        logger.info("OTP solicitado | user_id=%s | documento=%s", user.id, documento)
        print(f"[*] SIMULACIÓN SMS: Tu código OTP para BIOANALISIS es: {otp_code}")

        return Response({
            "detail": "Código OTP generado y enviado (simulado en consola).",
            "documento": documento
        }, status=status.HTTP_200_OK)

class VerifyOTPView(APIView):
    """
    Paso 2 del Login de Pacientes
    Verifica el código OTP y devuelve el JWT
    """
    permission_classes = (AllowAny,)

    def post(self, request):
        documento = request.data.get('documento')
        otp_ingresado = request.data.get('otp')

        if not documento or not otp_ingresado:
            return Response({"detail": "Documento y OTP son requeridos."}, status=status.HTTP_400_BAD_REQUEST)
            
        otp_guardado = cache.get(f"otp_{documento}")

        if otp_guardado and str(otp_guardado) == str(otp_ingresado):
            # OTP válido, autenticar usuario
            try:
                user = User.objects.get(documento=documento)
            except User.DoesNotExist:
                return Response({"detail": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)
            
            # Limpiar OTP usado
            cache.delete(f"otp_{documento}")

            # Generar Tokens JWT manualmente
            refresh = RefreshToken.for_user(user)
            refresh['role'] = user.role
            refresh['username'] = user.username

            logger.info("LOGIN OTP exitoso | user_id=%s | documento=%s | role=%s", user.id, documento, user.role)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'role': user.role,
                'detail': 'Autenticación exitosa'
            }, status=status.HTTP_200_OK)
        else:
            logger.warning("LOGIN OTP fallido | documento=%s | otp_valido=%s", documento, bool(otp_guardado))
            return Response({"detail": "Código OTP inválido o expirado."}, status=status.HTTP_401_UNAUTHORIZED)

class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/  — Auto-registro público.

    SOLO crea usuarios con rol PACIENTE, independientemente de lo que
    se envíe en el body. Campo `role` ignorado intencionalmente.

    El flujo habitual del paciente es por OTP (no password).
    Este endpoint es para el caso minoritario de registro directo.

    Seguridad (N-01 cerrado): usa RegisterSerializer, que excluye
    el campo `role` del body y fuerza PACIENTE en el create().
    """
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

class CurrentUserView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class UserListView(generics.ListCreateAPIView):
    """
    GET  /api/auth/users/  — Listar usuarios (admin ve todos, otros solo a sí mismos)
    POST /api/auth/users/  — Crear usuario con rol privilegiado (SOLO admin)

    Este es el único endpoint donde se puede asignar `role=bacteriologo` o `role=admin`.
    Usa StaffRegisterSerializer que valida y permite cualquier rol.
    Requiere IsAuthenticated + rol admin; cualquier otro recibe HTTP 403.
    """
    permission_classes = (IsAuthenticated,)
    serializer_class = UserSerializer

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)

    def post(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            return Response(
                {"detail": "Solo los administradores pueden crear usuarios desde aquí."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Usar StaffRegisterSerializer para permitir asignación de roles privilegiados
        serializer = StaffRegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

