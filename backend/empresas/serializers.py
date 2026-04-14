from rest_framework import serializers
from django.contrib.auth.hashers import make_password, check_password
from .models import Empresa


class EmpresaSerializer(serializers.ModelSerializer):
    """
    Serializer completo para CRUD de empresas (uso de Admin interno).
    El campo password solo se acepta en escritura; nunca se retorna.
    """
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Empresa
        fields = [
            'id', 'nit', 'nombre', 'email', 'telefono',
            'password', 'activo', 'fecha_registro', 'fecha_actualizacion'
        ]
        read_only_fields = ['id', 'fecha_registro', 'fecha_actualizacion']

    def create(self, validated_data):
        # Hashear la contraseña antes de guardar
        # Equivalente viejo: INSERT INTO emp_empresas (nit, new_pass, ...) — era texto plano
        raw_password = validated_data.pop('password', None)
        empresa = Empresa(**validated_data)
        if raw_password:
            empresa.password = make_password(raw_password)
        empresa.save()
        return empresa

    def update(self, instance, validated_data):
        raw_password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if raw_password:
            instance.password = make_password(raw_password)
        instance.save()
        return instance


class EmpresaListSerializer(serializers.ModelSerializer):
    """
    Serializer ligero para listar empresas en el panel admin.
    No expone contraseña.
    """
    class Meta:
        model = Empresa
        fields = ['id', 'nit', 'nombre', 'email', 'telefono', 'activo', 'fecha_registro']


class EmpresaLoginSerializer(serializers.Serializer):
    """
    Serializer para login B2B de empresa.

    Equivalente viejo (bio_cng/php/login_consultas.php):
        Login($id, $pass):
            SELECT * FROM emp_empresas WHERE nit='$id' AND new_pass='$pass'
    """
    nit = serializers.CharField()
    password = serializers.CharField()


class ResetPasswordSerializer(serializers.Serializer):
    """
    Serializer para resetear contraseña de empresa.

    Equivalente viejo:
        Cambiar_Pass($id): UPDATE emp_empresas SET new_pass='Bioanalisis2018*' WHERE idEmpresa=$id
    
    En el nuevo sistema el Admin puede asignar cualquier contraseña (no hardcodeada).
    """
    nueva_password = serializers.CharField(min_length=8)
