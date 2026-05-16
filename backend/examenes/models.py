from django.db import models
from django.utils.text import slugify


class Examen(models.Model):
    """
    Examen de laboratorio disponible en BIOANALISIS.

    Fuente única de verdad que reemplaza los archivos examenes.json
    duplicados que había en chatbot/ y frontend/app/data/.
    """

    class Categoria(models.TextChoices):
        COAGULACION   = 'Coagulación',   'Coagulación'
        HEMATOLOGIA   = 'Hematología',   'Hematología'
        HORMONAS      = 'Hormonas',      'Hormonas'
        INFECTOLOGIA  = 'Infectología',  'Infectología'
        INMUNOLOGIA   = 'Inmunología',   'Inmunología'
        METABOLISMO   = 'Metabolismo',   'Metabolismo'
        MICROBIOLOGIA = 'Microbiología', 'Microbiología'
        ONCOLOGIA     = 'Oncología',     'Oncología'
        OTRAS         = 'Otras',         'Otras'
        TIROIDES      = 'Tiroides',      'Tiroides'

    codigo    = models.CharField(max_length=10, unique=True, verbose_name='Código')
    nombre    = models.CharField(max_length=200, verbose_name='Nombre')
    slug      = models.SlugField(max_length=220, unique=True, blank=True, verbose_name='Slug')
    precio    = models.PositiveIntegerField(verbose_name='Precio (COP)')
    categoria = models.CharField(
        max_length=20,
        choices=Categoria.choices,
        default=Categoria.OTRAS,
        verbose_name='Categoría',
    )
    descripcion    = models.TextField(blank=True, verbose_name='Descripción')
    sintomas       = models.JSONField(default=list, verbose_name='Síntomas')
    requiere_ayuno = models.BooleanField(default=False, verbose_name='Requiere ayuno')
    preparacion    = models.TextField(blank=True, verbose_name='Preparación')
    activo         = models.BooleanField(default=True, verbose_name='Activo')

    fecha_registro      = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de registro')
    fecha_actualizacion = models.DateTimeField(auto_now=True, verbose_name='Última actualización')

    class Meta:
        verbose_name = 'Examen'
        verbose_name_plural = 'Exámenes'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.nombre} ({self.codigo})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.nombre) or slugify(self.codigo)
            candidate = base
            suffix = 1
            qs = Examen.objects.exclude(pk=self.pk)
            while qs.filter(slug=candidate).exists():
                candidate = f"{base}-{suffix}"
                suffix += 1
            self.slug = candidate
        super().save(*args, **kwargs)
