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
    
    Usado por bacteriólogos para cargar resultados (equivale a 
    result_consultas.php → Cargar_Archivo() del sistema viejo).

    N-04 (Gap Analysis): se agregan los campos 'empresa' (FK writable)
    y 'empresa_nombre' (solo lectura) para que la API exponga y permita
    asignar la empresa al crear o editar un resultado.
    """
    paciente_nombre = serializers.SerializerMethodField()
    paciente_documento = serializers.SerializerMethodField()
    subido_por_nombre = serializers.CharField(source='subido_por.username', read_only=True)
    nombre_archivo = serializers.ReadOnlyField()
    # N-04: nombre legible de la empresa (sin costo de JOIN extra — usa select_related en la view)
    empresa_nombre = serializers.CharField(source='empresa.nombre', read_only=True, default=None)

    class Meta:
        model = Resultado
        fields = [
            'id',
            'paciente',
            'paciente_nombre',
            'paciente_documento',
            'empresa',          # FK nullable — permite asignar empresa al crear/editar
            'empresa_nombre',   # Nombre legible — read only
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
            'empresa_nombre',   # Solo escritura de empresa (ID), lectura de empresa_nombre
        ]

    def get_paciente_nombre(self, obj):
        if obj.paciente_user_id:
            return obj.paciente_user.nombre_completo
        if obj.paciente_id:
            return obj.paciente.nombre_completo
        return ''

    def get_paciente_documento(self, obj):
        if obj.paciente_user_id:
            return obj.paciente_user.documento
        if obj.paciente_id:
            return obj.paciente.documento
        return ''

    def validate_archivo_pdf(self, value):
        """Valida que el archivo sea un PDF y no exceda 100MB."""
        # Validar extensión
        if not value.name.lower().endswith('.pdf'):
            raise serializers.ValidationError("Solo se permiten archivos PDF.")
        
        # Validar tamaño (100MB máximo)
        max_size = 100 * 1024 * 1024  # 100MB
        if value.size > max_size:
            raise serializers.ValidationError(
                f"El archivo excede el tamaño máximo de 100MB. Tamaño actual: {value.size / (1024*1024):.1f}MB"
            )
        
        return value

    def create(self, validated_data):
        """
        Al crear un resultado, se asigna automáticamente el usuario autenticado
        como 'subido_por' (el bacteriólogo o admin que lo carga).
        """
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['subido_por'] = request.user
        return super().create(validated_data)


class ResultadoListSerializer(serializers.ModelSerializer):
    """
    Serializer resumido para listados de resultados.
    Optimizado para la vista del paciente (lista cronológica).

    Equivalente a la consulta de resultado.php (AJAX) del viejo,
    pero unificando resultados FASIL + externos.

    N-04 (Gap Analysis): se agrega empresa_nombre para que el admin
    y el portal empresa puedan identificar a qué empresa pertenece
    cada resultado en el listado sin hacer una llamada adicional.
    """
    paciente_nombre = serializers.SerializerMethodField()
    paciente_documento = serializers.SerializerMethodField()
    empresa_nombre = serializers.CharField(source='empresa.nombre', read_only=True, default=None)
    nombre_archivo = serializers.ReadOnlyField()

    class Meta:
        model = Resultado
        fields = [
            'id',
            'paciente_nombre',
            'paciente_documento',
            'empresa_nombre',   # N-04: nombre de empresa en listado
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

    def get_paciente_documento(self, obj):
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
