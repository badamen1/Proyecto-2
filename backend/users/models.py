from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrador'
        PACIENTE = 'paciente', 'Paciente'
        BACTERIOLOGO = 'bacteriologo', 'Bacteriólogo'

    role = models.CharField(
        max_length=20, 
        choices=Role.choices, 
        default=Role.PACIENTE
    )
    documento = models.CharField(max_length=20, unique=True, blank=True, null=True)
    tipo_documento = models.CharField(
        max_length=10,
        choices=[('CC', 'CC'), ('TI', 'TI'), ('CE', 'CE'), ('PA', 'Pasaporte')],
        default='CC'
    )
    telefono = models.CharField(max_length=15, blank=True)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

