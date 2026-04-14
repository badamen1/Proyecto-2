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
    Paso 1 del Login de Pacientes (Según Contex.md)
    El paciente ingresa su documento, se genera un OTP y se "envía" (por ahora, simulado)
    """
    permission_classes = (AllowAny,)

    def post(self, request):
        documento = request.data.get('documento')
        if not documento:
            return Response({"detail": "Se requiere el documento."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar si el usuario existe o si hay que importar desde FASIL (MVP: Se asume que existe o se registra al vuelo para demo)
        user, created = User.objects.get_or_create(
            documento=documento,
            defaults={
                'username': documento, 
                'role': User.Role.PACIENTE
            }
        )
        if created:
            user.set_unusable_password()
            user.save()

        # Generar código OTP de 6 dígitos
        otp_code = str(random.randint(100000, 999999))
        
        # Guardar en cache por 5 minutos
        cache.set(f"otp_{documento}", otp_code, timeout=300)

        # Simulación del envío de OTP — en producción conectar con WhatsApp/SMS
        logger.info("OTP solicitado | documento=%s | nuevo_usuario=%s", documento, created)
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

