from django.db import models


class Empresa(models.Model):
    """
    Entidad B2B — Cliente corporativo del laboratorio.

    Equivalente en sistema viejo: tabla `emp_empresas`
    Campos mapeados:
      - nit         ← emp_empresas.nit       (login del empresa en bio_cng/index.php)
      - nombre      ← emp_empresas.nombre_empresa
      - new_pass    → password (hashed, antes era texto plano)
      - new_estado  → activo  (antes 'A'/'I', ahora Boolean)

    Lógica vieja: Login($id, $pass)
        SELECT * FROM emp_empresas WHERE nit='$id' AND new_pass='$pass'
        if new_estado == 'I' → return 2  (inactiva)
        else → guardar sesión, return 1

    Lógica nueva: EmpresaLoginView valida nit + password hasheado con JWT.
    """

    nit = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='NIT',
        help_text='Identificador único de la empresa. Usado como username para login.'
    )
    nombre = models.CharField(
        max_length=200,
        verbose_name='Razón Social'
    )
    email = models.EmailField(
        blank=True,
        verbose_name='Correo electrónico'
    )
    telefono = models.CharField(
        max_length=15,
        blank=True,
        verbose_name='Teléfono'
    )

    # Contraseña hasheada con bcrypt a través de Django make_password
    # El sistema viejo guardaba texto plano en new_pass (inseguro)
    password = models.CharField(
        max_length=128,
        verbose_name='Contraseña',
        help_text='Almacenada como hash, nunca en texto plano.'
    )

    # Equivalente a new_estado: 'A' = True (Activo), 'I' = False (Inactivo)
    # El sistema viejo: Activar($id) / Inactivar($id) sobre emp_empresas
    activo = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )

    # Metadata
    fecha_registro = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de registro')
    fecha_actualizacion = models.DateTimeField(auto_now=True, verbose_name='Última actualización')

    class Meta:
        verbose_name = 'Empresa'
        verbose_name_plural = 'Empresas'
        ordering = ['nombre']

    def __str__(self):
        estado = 'Activa' if self.activo else 'Inactiva'
        return f"{self.nombre} (NIT: {self.nit}) — {estado}"
