# Paso 1: Registro explícito y OTP sin auto-create — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la dependencia de FASIL en el login: el paciente debe tener una cuenta registrada antes de poder solicitar un OTP. El endpoint de registro crea usuarios con `nombre_completo` sin contraseña.

**Architecture:** Se añade el campo `nombre_completo` al modelo `User`. `RegisterSerializer` se reescribe para el flujo OTP (sin `username` ni `password`). `RequestOTPView` cambia de `get_or_create` a lookup + 404 explícito.

**Tech Stack:** Django 5.2, djangorestframework, djangorestframework-simplejwt, pytest/unittest

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `backend/users/models.py` | Modificar — añadir `nombre_completo` |
| `backend/users/migrations/0002_*.py` | Crear — auto-generada con `makemigrations` |
| `backend/users/serializers.py` | Modificar — reescribir `RegisterSerializer`, añadir `nombre_completo` a `UserSerializer` |
| `backend/users/views.py` | Modificar — reescribir `RequestOTPView` |
| `backend/users/tests.py` | Modificar — actualizar tests rotos + añadir nuevos |

---

## Task 1: Añadir `nombre_completo` al modelo `User`

**Files:**
- Modify: `backend/users/models.py`

- [ ] **Step 1: Añadir el campo al modelo**

Editar `backend/users/models.py`. Añadir `nombre_completo` después del campo `telefono`:

```python
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
    nombre_completo = models.CharField(max_length=200, blank=True, verbose_name='Nombre completo')

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
```

- [ ] **Step 2: Generar y aplicar la migración**

```bash
cd backend
python manage.py makemigrations users --name="add_nombre_completo_to_user"
python manage.py migrate
```

Resultado esperado: `Applying users.0002_add_nombre_completo_to_user... OK`

- [ ] **Step 3: Verificar que el campo existe en DB**

```bash
python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); print(User._meta.get_field('nombre_completo'))"
```

Resultado esperado: `<django.db.models.fields.CharField: nombre_completo>`

---

## Task 2: Actualizar `RegisterSerializer` y `UserSerializer`

**Files:**
- Modify: `backend/users/serializers.py`

- [ ] **Step 1: Escribir el test que falla para el nuevo registro**

Reemplazar la clase `PublicRegisterSecurityTests` completa en `backend/users/tests.py`:

```python
class PacienteRegisterTests(APITestCase):
    """Tests para el nuevo flujo de registro de pacientes sin contraseña."""

    def setUp(self):
        self.register_url = '/api/auth/register/'

    def test_registro_con_nombre_completo_crea_paciente(self):
        """Registro con nombre_completo crea User PACIENTE sin contraseña."""
        data = {
            'documento': '123456789',
            'tipo_documento': 'CC',
            'nombre_completo': 'Ana María Torres',
            'email': 'ana@ejemplo.com',
            'telefono': '3001234567',
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(documento='123456789')
        self.assertEqual(user.nombre_completo, 'Ana María Torres')
        self.assertEqual(user.role, User.Role.PACIENTE)
        self.assertEqual(user.username, '123456789')
        self.assertFalse(user.has_usable_password())

    def test_registro_sin_nombre_completo_falla(self):
        """nombre_completo es obligatorio."""
        data = {'documento': '111222333'}
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nombre_completo', response.data)

    def test_registro_duplicado_falla(self):
        """No se puede registrar el mismo documento dos veces."""
        data = {
            'documento': '999888777',
            'nombre_completo': 'Carlos López',
        }
        self.client.post(self.register_url, data)
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registro_ignora_role_en_body(self):
        """El campo role del body es ignorado — siempre crea PACIENTE."""
        data = {
            'documento': '777666555',
            'nombre_completo': 'Atacante Admin',
            'role': 'admin',
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(documento='777666555')
        self.assertEqual(user.role, User.Role.PACIENTE)
```

- [ ] **Step 2: Ejecutar los tests para confirmar que fallan**

```bash
cd backend
python manage.py test users.tests.PacienteRegisterTests -v 2
```

Resultado esperado: todos los tests `ERROR` o `FAIL` (el serializer aún no acepta `nombre_completo`).

- [ ] **Step 3: Reescribir `RegisterSerializer` y actualizar `UserSerializer`**

Reemplazar el contenido completo de `backend/users/serializers.py`:

```python
from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'nombre_completo',
            'role', 'documento', 'tipo_documento', 'telefono'
        ]
        read_only_fields = ['id']


class RegisterSerializer(serializers.ModelSerializer):
    """
    Registro público de pacientes — flujo OTP (sin contraseña).

    Recibe: documento, nombre_completo, tipo_documento (opt), email (opt), telefono (opt).
    Crea: User con username=documento, role=PACIENTE, set_unusable_password().
    Nunca acepta: role, password, username en el body.
    """
    nombre_completo = serializers.CharField(required=True, max_length=200)

    class Meta:
        model = User
        fields = ['documento', 'tipo_documento', 'nombre_completo', 'email', 'telefono']

    def validate_documento(self, value):
        if User.objects.filter(documento=value).exists():
            raise serializers.ValidationError(
                "Ya existe una cuenta con este número de documento."
            )
        return value

    def create(self, validated_data):
        documento = validated_data['documento']
        user = User(
            username=documento,
            documento=documento,
            tipo_documento=validated_data.get('tipo_documento', 'CC'),
            nombre_completo=validated_data['nombre_completo'],
            email=validated_data.get('email', ''),
            telefono=validated_data.get('telefono', ''),
            role=User.Role.PACIENTE,
        )
        user.set_unusable_password()
        user.save()
        return user


class StaffRegisterSerializer(serializers.ModelSerializer):
    """
    Registro privilegiado — solo para Admin via POST /api/auth/users/.
    Permite asignar roles como bacteriologo o admin.
    NUNCA exponer en endpoints públicos.
    """
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'nombre_completo',
            'documento', 'tipo_documento', 'telefono', 'role'
        ]

    def validate_role(self, value):
        valid_roles = [r[0] for r in User.Role.choices]
        if value not in valid_roles:
            raise serializers.ValidationError(f"Rol inválido. Opciones: {valid_roles}")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            nombre_completo=validated_data.get('nombre_completo', ''),
            documento=validated_data.get('documento', ''),
            tipo_documento=validated_data.get('tipo_documento', 'CC'),
            telefono=validated_data.get('telefono', ''),
            role=validated_data.get('role', User.Role.PACIENTE),
        )
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        return token
```

- [ ] **Step 4: Ejecutar los tests para confirmar que pasan**

```bash
cd backend
python manage.py test users.tests.PacienteRegisterTests -v 2
```

Resultado esperado: 4 tests `OK`.

---

## Task 3: Actualizar `RequestOTPView` para rechazar documentos sin cuenta

**Files:**
- Modify: `backend/users/views.py`

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar la clase `OTPTests` completa en `backend/users/tests.py`:

```python
class OTPTests(APITestCase):

    def setUp(self):
        self.request_otp_url = '/api/auth/otp/request/'
        self.verify_otp_url = '/api/auth/otp/verify/'

        # Paciente pre-registrado en nuestro sistema
        self.paciente = User.objects.create(
            username='123456789',
            documento='123456789',
            nombre_completo='María García',
            role=User.Role.PACIENTE,
        )
        self.paciente.set_unusable_password()
        self.paciente.save()

    def test_otp_rechaza_documento_sin_cuenta(self):
        """OTP request con documento no registrado → 404."""
        response = self.client.post(self.request_otp_url, {'documento': '00000000'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('Regístrate primero', response.data['detail'])
        # No se debe haber creado ningún usuario nuevo
        self.assertFalse(User.objects.filter(documento='00000000').exists())

    def test_otp_acepta_documento_registrado(self):
        """OTP request con documento registrado → 200 y OTP en cache."""
        response = self.client.post(self.request_otp_url, {'documento': '123456789'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        otp_guardado = cache.get('otp_123456789')
        self.assertIsNotNone(otp_guardado)
        self.assertEqual(len(otp_guardado), 6)

    def test_otp_sin_documento_retorna_400(self):
        """OTP request sin el campo documento → 400."""
        response = self.client.post(self.request_otp_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_valid_otp(self):
        """OTP correcto para usuario registrado → JWT con role."""
        # Solicitar OTP primero
        self.client.post(self.request_otp_url, {'documento': '123456789'})
        otp_guardado = cache.get('otp_123456789')

        response = self.client.post(self.verify_otp_url, {
            'documento': '123456789',
            'otp': otp_guardado,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['role'], 'paciente')

    def test_verify_invalid_otp(self):
        """OTP incorrecto → 401."""
        self.client.post(self.request_otp_url, {'documento': '123456789'})
        response = self.client.post(self.verify_otp_url, {
            'documento': '123456789',
            'otp': '000000',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
```

- [ ] **Step 2: Ejecutar los tests para confirmar que fallan**

```bash
cd backend
python manage.py test users.tests.OTPTests -v 2
```

Resultado esperado: `test_otp_rechaza_documento_sin_cuenta` falla (actual: 200 con `get_or_create`).

- [ ] **Step 3: Reescribir `RequestOTPView` en `views.py`**

Reemplazar la clase `RequestOTPView` en `backend/users/views.py`:

```python
class RequestOTPView(APIView):
    """
    Paso 1 del Login de Pacientes.

    El paciente ingresa su documento. Si tiene cuenta registrada se genera
    y envía el OTP. Si no tiene cuenta se rechaza con 404 explícito.

    CAMBIO ARQUITECTÓNICO: Ya no hace get_or_create.
    El paciente debe registrarse primero en POST /api/auth/register/.
    """
    permission_classes = (AllowAny,)

    def post(self, request):
        documento = request.data.get('documento', '').strip()
        if not documento:
            return Response(
                {"detail": "Se requiere el documento."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(documento=documento)
        except User.DoesNotExist:
            return Response(
                {"detail": "No tienes una cuenta. Regístrate primero."},
                status=status.HTTP_404_NOT_FOUND
            )

        otp_code = str(random.randint(100000, 999999))
        cache.set(f"otp_{documento}", otp_code, timeout=300)

        logger.info("OTP solicitado | user_id=%s | documento=%s", user.id, documento)
        print(f"[*] SIMULACIÓN SMS: Tu código OTP para BIOANALISIS es: {otp_code}")

        return Response({
            "detail": "Código OTP generado y enviado (simulado en consola).",
            "documento": documento
        }, status=status.HTTP_200_OK)
```

- [ ] **Step 4: Ejecutar todos los tests de users**

```bash
cd backend
python manage.py test users -v 2
```

Resultado esperado: todos los tests `OK`. Si alguno falla, revisar antes de continuar.

- [ ] **Step 5: Commit del Paso 1**

```bash
cd backend
git add users/models.py users/migrations/0002_add_nombre_completo_to_user.py users/serializers.py users/views.py users/tests.py
git commit -m "$(cat <<'EOF'
feat(backend): paso 1 - registro explícito y OTP sin auto-create

- Añade nombre_completo a User (migración 0002)
- RegisterSerializer reescrito para flujo OTP: sin password, sin username
  (se deriva del documento). Valida duplicados de documento.
- RequestOTPView: elimina get_or_create, ahora rechaza documentos sin
  cuenta con HTTP 404 y mensaje claro "Regístrate primero"
- Actualiza tests: OTPTests usa usuario pre-creado, añade test de rechazo

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review del plan

**Cobertura del spec:**
- ✅ Añadir `nombre_completo` a `User` → Task 1
- ✅ `RegisterSerializer` acepta `nombre_completo`, no requiere contraseña → Task 2
- ✅ `RequestOTPView` rechaza documentos sin cuenta con 404 → Task 3
- ✅ Tests para cada comportamiento → Tasks 2 y 3

**Placeholders:** Ninguno. Todos los steps tienen código completo.

**Consistencia de tipos:**
- `nombre_completo`: `CharField(max_length=200, blank=True)` en el modelo. `CharField(required=True, max_length=200)` en el serializer. ✅
- `User.objects.get(documento=documento)` coincide con el campo `documento` del modelo. ✅
- `User.Role.PACIENTE` usado en serializer y en tests. ✅
