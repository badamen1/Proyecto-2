import datetime

from rest_framework import serializers
from .models import Paciente, Resultado


class PacienteSerializer(serializers.ModelSerializer):
    """
    Serializer completo para CRUD de Pacientes.
    Usado por bacteriólogos y admin para gestión de pacientes.
    """
    resultados_count = serializers.SerializerMethodField()

    class Meta:
        model = Paciente
        fields = [
            'id',
            'tipo_documento',
            'documento',
            'nombre_completo',
            'telefono',
            'email',
            'fecha_nacimiento',
            'user',
            'id_fasil',
            'activo',
            'fecha_registro',
            'fecha_actualizacion',
            'resultados_count',
        ]
        read_only_fields = ['id', 'fecha_registro', 'fecha_actualizacion', 'resultados_count']

    def get_resultados_count(self, obj):
        return obj.resultados.count()


class PacienteListSerializer(serializers.ModelSerializer):
    """
    Serializer resumido para listados y búsqueda de pacientes.
    Equivalente al AJAX de nombres.php del sistema viejo.
    """

    class Meta:
        model = Paciente
        fields = [
            'id',
            'tipo_documento',
            'documento',
            'nombre_completo',
            'telefono',
            'activo',
        ]


class ResultadoSerializer(serializers.ModelSerializer):
    """
    Serializer completo para CRUD de Resultados.
    """
    paciente_nombre = serializers.SerializerMethodField()
    paciente_documento_display = serializers.SerializerMethodField()
    subido_por_nombre = serializers.CharField(source='subido_por.username', read_only=True)
    nombre_archivo = serializers.ReadOnlyField()
    empresa_nombre = serializers.CharField(source='empresa.nombre', read_only=True, default=None)
    fecha_examen = serializers.DateField(required=False, default=datetime.date.today)

    class Meta:
        model = Resultado
        fields = [
            'id',
            'paciente',
            'paciente_nombre',
            'paciente_documento_display',
            'paciente_documento',
            'empresa',
            'empresa_nombre',
            'subido_por',
            'subido_por_nombre',
            'tipo_examen',
            'fuente',
            'estado',
            'archivo_pdf',
            'tipo_archivo',
            'nombre_archivo',
            'fecha_examen',
            'fecha_carga',
            'fecha_actualizacion',
            'observaciones',
            'id_orden_fasil',
        ]
        read_only_fields = [
            'id',
            'subido_por',
            'subido_por_nombre',
            'fecha_carga',
            'fecha_actualizacion',
            'nombre_archivo',
            'empresa_nombre',
        ]

    def get_paciente_nombre(self, obj):
        if obj.paciente_user_id:
            return obj.paciente_user.nombre_completo
        if obj.paciente_id:
            return obj.paciente.nombre_completo
        return ''

    def get_paciente_documento_display(self, obj):
        if obj.paciente_user_id:
            return obj.paciente_user.documento
        if obj.paciente_id:
            return obj.paciente.documento
        return ''

    def validate_archivo_pdf(self, value):
        if not value.name.lower().endswith('.pdf'):
            raise serializers.ValidationError("Solo se permiten archivos PDF.")
        max_size = 100 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError(
                f"El archivo excede el tamaño máximo de 100MB. Tamaño actual: {value.size / (1024*1024):.1f}MB"
            )
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['subido_por'] = request.user
        return super().create(validated_data)


class ResultadoListSerializer(serializers.ModelSerializer):
    """
    Serializer resumido para listados de resultados.
    """
    paciente_nombre = serializers.SerializerMethodField()
    paciente_documento_display = serializers.SerializerMethodField()
    empresa_nombre = serializers.CharField(source='empresa.nombre', read_only=True, default=None)
    nombre_archivo = serializers.ReadOnlyField()

    class Meta:
        model = Resultado
        fields = [
            'id',
            'paciente_nombre',
            'paciente_documento_display',
            'paciente_documento',
            'empresa_nombre',
            'tipo_examen',
            'fuente',
            'estado',
            'fecha_examen',
            'fecha_carga',
            'nombre_archivo',
        ]

    def get_paciente_nombre(self, obj):
        if obj.paciente_user_id:
            return obj.paciente_user.nombre_completo
        if obj.paciente_id:
            return obj.paciente.nombre_completo
        return ''

    def get_paciente_documento_display(self, obj):
        if obj.paciente_user_id:
            return obj.paciente_user.documento
        if obj.paciente_id:
            return obj.paciente.documento
        return ''


class ResultadoUnificadoSerializer(serializers.Serializer):
    """
    Serializer de solo lectura para la vista unificada paciente.
    Representa tanto un Resultado de BD como una OrdenFASIL.
    El campo 'id' siempre es string:
      - Resultado BD: str(pk)        → "15"
      - Orden FASIL:  "fasil-" + id  → "fasil-ORD-42"
    """
    id = serializers.CharField(read_only=True)
    tipo_examen = serializers.CharField(read_only=True)
    fecha_examen = serializers.CharField(read_only=True)
    estado = serializers.CharField(read_only=True)
    fuente = serializers.CharField(read_only=True)
    nombre_archivo = serializers.CharField(read_only=True, allow_null=True)
    tiene_pdf = serializers.BooleanField(read_only=True)
