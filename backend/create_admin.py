import os
import django

# Provide the settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

def create_default_admin():
    documento = "1078458080"
    password = "12345678"
    
    if User.objects.filter(documento=documento).exists():
        print(f"El usuario con documento {documento} ya existe.")
    else:
        # Create user
        # We also need an email/username which are required by AbstractUser conceptually usually,
        # Let's set the username to the documento
        admin_user = User.objects.create_superuser(
            username=documento,
            documento=documento,
            email="admin@bioanalisis.com",
            password=password,
            role=User.Role.ADMIN,
            first_name="Admin",
            last_name="Bioanalisis"
        )
        print(f"¡Administrador creado con éxito! Documento: {documento} | Contraseña: {password}")

if __name__ == '__main__':
    create_default_admin()
