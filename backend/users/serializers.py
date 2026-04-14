from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'documento', 'tipo_documento', 'telefono']
        read_only_fields = ['id']

class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer de auto-registro PÚBLICO.

    El campo `role` NO se expone — siempre se crea un usuario con rol PACIENTE.
    Esto cierra la vulnerabilidad N-01: un actor externo no puede crear
    cuentas admin o bacteriólogo desde el endpoint público /api/auth/register/.

    El flujo normal del paciente usa OTP (RequestOTPView / VerifyOTPView).
    Este endpoint queda para registro directo con password (ej. empresa demo).
    """
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        # 'role' intencionalmente EXCLUIDO — siempre se asigna PACIENTE
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'documento', 'tipo_documento', 'telefono']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            documento=validated_data.get('documento', ''),
            tipo_documento=validated_data.get('tipo_documento', 'CC'),
            telefono=validated_data.get('telefono', ''),
            role=User.Role.PACIENTE,  # Forzado — no acepta roles del request body
        )
        return user


class StaffRegisterSerializer(serializers.ModelSerializer):
    """
    Serializer de registro PRIVILEGIADO — solo para uso de Admin.

    Permite asignar roles como `bacteriologo` o `admin`.
    Solo se usa desde UserListView (protegido por IsAuthenticated + rol admin).
    NUNCA debe exponerse en un endpoint público.
    """
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'documento', 'tipo_documento', 'telefono', 'role']

    def validate_role(self, value):
        """El admin puede asignar cualquier rol. Se valida contra las opciones definidas."""
        valid_roles = [r[0] for r in User.Role.choices]
        if value not in valid_roles:
            raise serializers.ValidationError(f"Rol inválido. Opciones: {valid_roles}")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            documento=validated_data.get('documento', ''),
            tipo_documento=validated_data.get('tipo_documento', 'CC'),
            telefono=validated_data.get('telefono', ''),
            role=validated_data.get('role', User.Role.PACIENTE),
        )
        return user

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['role'] = user.role
        token['username'] = user.username
        return token
