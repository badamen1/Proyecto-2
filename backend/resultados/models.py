from django.db import models
from django.conf import settings
import os

# Import lazy para evitar circular import con la app empresas
from django.db.models import SET_NULL


def resultado_upload_path(instance, filename):
    """
    Genera la ruta de almacenamiento para PDFs de resultados.
    Formato: resultados/paciente_<documento>/<filename>
    """
    doc = instance.paciente.documento if instance.paciente else 'sin_paciente'
    return os.path.join('resultados', f'paciente_{doc}', filename)


class Paciente(models.Model):
    """
    Entidad clínica independiente de User (según Contex.md).
    
    Separación clave:
    - Un User puede existir sin ser Paciente (ej: solo agendar domicilio)
    - Un Paciente puede existir sin User (ej: importado desde FASIL)
    - La vinculación User <-> Paciente es opcional
    
    Equivalente en sistema viejo: tablas `pct_pacientes` + `persona`
    """

    class TipoDocumento(models.TextChoices):
        CC = 'CC', 'Cédula de Ciudadanía'
        TI = 'TI', 'Tarjeta de Identidad'
        CE = 'CE', 'Cédula de Extranjería'
        PA = 'PA', 'Pasaporte'
        RC = 'RC', 'Registro Civil'
        NIT = 'NIT', 'NIT'

    # Datos de identificación
    tipo_documento = models.CharField(
        max_length=5,
        choices=TipoDocumento.choices,
        default=TipoDocumento.CC,
        verbose_name='Tipo de documento'
    )
    documento = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='Número de documento'
    )

    # Datos personales
    nombre_completo = models.CharField(max_length=200, verbose_name='Nombre completo')
    telefono = models.CharField(max_length=15, blank=True, verbose_name='Teléfono')
    email = models.EmailField(blank=True, verbose_name='Correo electrónico')
    fecha_nacimiento = models.DateField(null=True, blank=True, verbose_name='Fecha de nacimiento')

    # Vínculo opcional con User (autenticación)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='paciente',
        verbose_name='Usuario vinculado'
    )

    # Integración con FASIL
    id_fasil = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        unique=True,
        verbose_name='ID en sistema FASIL',
        help_text='Identificador del paciente en el sistema FASIL (para integración futura)'
    )

    # Metadata
    activo = models.BooleanField(default=True, verbose_name='Activo')
    fecha_registro = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de registro')
    fecha_actualizacion = models.DateTimeField(auto_now=True, verbose_name='Última actualización')

    class Meta:
        verbose_name = 'Paciente'
        verbose_name_plural = 'Pacientes'
        ordering = ['-fecha_registro']

    def __str__(self):
        return f"{self.nombre_completo} ({self.tipo_documento} {self.documento})"


class Resultado(models.Model):
    """
    Resultado clínico unificado (FASIL + externos + manuales).
    
    Decisiones de diseño:
    - PDFs se almacenan en FileSystem (no BLOB como el viejo)
    - Se unifica el origen (FASIL/EXTERNO) para el paciente
    - Se mantiene la metadata para escalabilidad futura
    
    # Equivalente en sistema viejo: tabla `resultado`
    # - re_tipodocumento  → paciente.tipo_documento
    # - re_cc             → paciente.documento
    # - re_nombre         → paciente.nombre_completo
    # - re_archivo (BLOB) → archivo_pdf (FileField)
    # - re_tipo           → tipo_archivo (MIME type)
    # - re_fecha_ex       → fecha_examen
    # - idEmpresa         → empresa (FK) ← AGREGADO para soporte B2B
    """

    class Fuente(models.TextChoices):
        FASIL = 'FASIL', 'Sistema FASIL'
        EXTERNO = 'EXTERNO', 'Laboratorio Externo'
        MANUAL = 'MANUAL', 'Ingreso Manual'

    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente de validación'
        VALIDADO = 'VALIDADO', 'Validado'
        ENTREGADO = 'ENTREGADO', 'Entregado al paciente'

    # Relaciones
    paciente = models.ForeignKey(
        Paciente,
        on_delete=models.CASCADE,
        related_name='resultados',
        verbose_name='Paciente'
    )
    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resultados_subidos',
        verbose_name='Subido por',
        help_text='Bacteriólogo o admin que cargó el resultado'
    )
    # FK a Empresa — equivalente a idEmpresa en svc_ordenes del sistema viejo
    # Nullable: resultados de pacientes particulares (no empresas) lo dejan en null
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resultados',
        verbose_name='Empresa',
        help_text='Si el resultado fue solicitado por una empresa cliente (B2B).'
    )

    # Datos del resultado
    tipo_examen = models.CharField(
        max_length=100,
        verbose_name='Tipo de examen',
        help_text='Ej: Hemograma, Perfil Lipídico, Uroanálisis'
    )
    fuente = models.CharField(
        max_length=10,
        choices=Fuente.choices,
        default=Fuente.MANUAL,
        verbose_name='Fuente del resultado'
    )
    estado = models.CharField(
        max_length=15,
        choices=Estado.choices,
        default=Estado.PENDIENTE,
        verbose_name='Estado'
    )

    # Archivo PDF
    archivo_pdf = models.FileField(
        upload_to=resultado_upload_path,
        verbose_name='Archivo PDF',
        help_text='Resultado en formato PDF'
    )
    tipo_archivo = models.CharField(
        max_length=50,
        default='application/pdf',
        verbose_name='Tipo MIME del archivo'
    )

    # Fechas
    fecha_examen = models.DateField(verbose_name='Fecha del examen')
    fecha_carga = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de carga')
    fecha_actualizacion = models.DateTimeField(auto_now=True, verbose_name='Última actualización')

    # Observaciones
    observaciones = models.TextField(
        blank=True,
        verbose_name='Observaciones',
        help_text='Notas adicionales del bacteriólogo'
    )

    # Integración FASIL
    id_orden_fasil = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name='ID Orden FASIL',
        help_text='Referencia a svc_ordenes en FASIL (para integración futura)'
    )

    class Meta:
        verbose_name = 'Resultado'
        verbose_name_plural = 'Resultados'
        ordering = ['-fecha_examen', '-fecha_carga']

    def __str__(self):
        return f"{self.tipo_examen} - {self.paciente.nombre_completo} ({self.fecha_examen})"

    @property
    def nombre_archivo(self):
        """Retorna solo el nombre del archivo sin la ruta completa."""
        if self.archivo_pdf:
            return os.path.basename(self.archivo_pdf.name)
        return None
