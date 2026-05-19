from django.core.management.base import BaseCommand
from users.models import User


class Command(BaseCommand):
    help = 'Crea el usuario admin por defecto si no existe'

    def handle(self, *args, **options):
        documento = '1078458080'
        password = '12345678'

        if User.objects.filter(documento=documento).exists():
            self.stdout.write('Admin ya existe, sin cambios.')
            return

        User.objects.create_superuser(
            username=documento,
            password=password,
            documento=documento,
            tipo_documento='CC',
            nombre_completo='Administrador',
            role=User.Role.ADMIN,
        )
        self.stdout.write(self.style.SUCCESS(f'Admin creado: documento={documento}'))
