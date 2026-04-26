from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.db import IntegrityError

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'nombre_completo',
            'role', 'documento', 'tipo_documento', 'telefono'
        ]
        read_only_fields = ['id']


class RegisterSerializer(serializers.ModelSerializer):
    """
    Registro público de pacientes — flujo OTP (sin contraseña).

    Recibe: documento, nombre_completo, tipo_documento (opt), email (opt), telefono (opt).
    Crea: User con username=documento, role=PACIENTE, set_unusable_password().
    Nunca acepta: role, password, username en el body.
    """
    nombre_completo = serializers.CharField(required=True, max_length=200)

    class Meta:
        model = User
        fields = ['documento', 'tipo_documento', 'nombre_completo', 'email', 'telefono']

    def validate_documento(self, value):
        if User.objects.filter(documento=value).exists():
            raise serializers.ValidationError(
                "Ya existe una cuenta con este número de documento."
            )
        return value

    def create(self, validated_data):
        documento = validated_data['documento']
        user = User(
            username=documento,
            documento=documento,
            tipo_documento=validated_data.get('tipo_documento', 'CC'),
            nombre_completo=validated_data['nombre_completo'],
            email=validated_data.get('email', ''),
            telefono=validated_data.get('telefono', ''),
            role=User.Role.PACIENTE,
        )
        user.set_unusable_password()
        try:
            user.save()
        except IntegrityError:
            raise serializers.ValidationError(
                {"documento": "Ya existe una cuenta con este número de documento."}
            )
        return user


class StaffRegisterSerializer(serializers.ModelSerializer):
    """
    Registro privilegiado — solo para Admin via POST /api/auth/users/.
    Permite asignar roles como bacteriologo o admin.
    NUNCA exponer en endpoints públicos.
    """
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'nombre_completo',
            'documento', 'tipo_documento', 'telefono', 'role'
        ]

    def validate_role(self, value):
        valid_roles = [r[0] for r in User.Role.choices]
        if value not in valid_roles:
            raise serializers.ValidationError(f"Rol inválido. Opciones: {valid_roles}")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            nombre_completo=validated_data.get('nombre_completo', ''),
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
        token['role'] = user.role
        token['username'] = user.username
        return token
