from django.db import models
from django.conf import settings


class Producto(models.Model):
    """
    Reactivo, consumible o material de vidrio del laboratorio clínico.

    Equivalente en sistema viejo: no existía módulo de inventario digital.
    Este modelo es nativo del nuevo sistema.
    """

    class Categoria(models.TextChoices):
        REACTIVO = 'REACTIVO', 'Reactivo'
        CONSUMIBLE = 'CONSUMIBLE', 'Consumible'
        MATERIAL_VIDRIO = 'MATERIAL_VIDRIO', 'Material de Vidrio'
        OTRO = 'OTRO', 'Otro'

    class UnidadMedida(models.TextChoices):
        UNIDAD = 'UNIDAD', 'Unidad'
        CAJA = 'CAJA', 'Caja'
        ML = 'ML', 'Mililitro'
        LT = 'LT', 'Litro'
        GR = 'GR', 'Gramo'
        PAQUETE = 'PAQUETE', 'Paquete'

    codigo = models.CharField(
        max_length=50, unique=True, verbose_name='Código'
    )
    nombre = models.CharField(
        max_length=200, verbose_name='Nombre'
    )
    categoria = models.CharField(
        max_length=20,
        choices=Categoria.choices,
        verbose_name='Categoría',
    )
    unidad_medida = models.CharField(
        max_length=10,
        choices=UnidadMedida.choices,
        verbose_name='Unidad de medida',
    )
    stock_actual = models.PositiveIntegerField(
        default=0,
        verbose_name='Stock actual',
        help_text='Solo se modifica via /ingreso/ y /egreso/.',
    )
    stock_minimo = models.PositiveIntegerField(
        default=5,
        verbose_name='Stock mínimo',
        help_text='Nivel mínimo de alerta.',
    )
    proveedor_habitual = models.CharField(
        max_length=200, blank=True, verbose_name='Proveedor habitual'
    )
    ultimo_costo = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        verbose_name='Último costo',
        help_text='Solo visible para admin.',
    )
    fecha_vencimiento = models.DateField(
        null=True, blank=True, verbose_name='Fecha de vencimiento'
    )
    numero_lote = models.CharField(
        max_length=100, blank=True, verbose_name='Número de lote'
    )
    observaciones = models.TextField(
        blank=True, verbose_name='Observaciones'
    )
    activo = models.BooleanField(
        default=True, verbose_name='Activo'
    )
    fecha_registro = models.DateTimeField(
        auto_now_add=True, verbose_name='Fecha de registro'
    )
    fecha_actualizacion = models.DateTimeField(
        auto_now=True, verbose_name='Última actualización'
    )

    class Meta:
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.codigo} — {self.nombre}"


class Movimiento(models.Model):
    """
    Registro inmutable de cada transacción de inventario.

    Equivalente en sistema viejo: no existía módulo de inventario.
    INMUTABLE: no existe endpoint PUT/PATCH/DELETE. Solo se crea
    a través de ProductoIngresoView y ProductoEgresoView.
    """

    class TipoMovimiento(models.TextChoices):
        INGRESO = 'INGRESO', 'Ingreso'
        EGRESO = 'EGRESO', 'Egreso'

    producto = models.ForeignKey(
        Producto,
        on_delete=models.CASCADE,
        related_name='movimientos',
        verbose_name='Producto',
    )
    tipo = models.CharField(
        max_length=10,
        choices=TipoMovimiento.choices,
        verbose_name='Tipo',
    )
    cantidad = models.PositiveIntegerField(
        verbose_name='Cantidad',
    )
    motivo = models.CharField(
        max_length=200, verbose_name='Motivo'
    )
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='movimientos_inventario',
        verbose_name='Registrado por',
    )
    fecha_registro = models.DateTimeField(
        auto_now_add=True, verbose_name='Fecha de registro'
    )

    class Meta:
        verbose_name = 'Movimiento'
        verbose_name_plural = 'Movimientos'
        ordering = ['-fecha_registro']

    def __str__(self):
        fecha = self.fecha_registro.strftime('%Y-%m-%d') if self.fecha_registro else '?'
        return f"{self.tipo} | {self.producto.codigo} | {self.cantidad} | {fecha}"
