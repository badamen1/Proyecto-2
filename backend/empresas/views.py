from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import check_password, make_password
from django.shortcuts import get_object_or_404
import logging

from .models import Empresa
from .serializers import (
    EmpresaSerializer,
    EmpresaListSerializer,
    EmpresaLoginSerializer,
    ResetPasswordSerializer,
)

# Importamos modelos de resultados para las consultas B2B
from resultados.models import Paciente, Resultado
from resultados.serializers import PacienteListSerializer, ResultadoListSerializer

logger = logging.getLogger('empresas')


# =============================================================================
# AUTENTICACIÓN B2B (Portal Empresa)
# =============================================================================

class EmpresaLoginView(APIView):
    """
    POST /api/b2b/login/

    Autenticación de empresa por NIT + contraseña.
    Retorna un JWT con claim especial 'empresa_id' para identificar la sesión B2B.

    Equivalente DIRECTO del sistema viejo (bio_cng/php/login_consultas.php):
        Login($id, $pass):
            SELECT * FROM emp_empresas WHERE nit='$id' AND new_pass='$pass'
            if new_estado == 'I': return 2   → ahora: HTTP 403 "Empresa inactiva"
            else: $_SESSION[...] = ...        → ahora: retorna JWT
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = EmpresaLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        nit = serializer.validated_data['nit']
        password = serializer.validated_data['password']

        try:
            empresa = Empresa.objects.get(nit=nit)
        except Empresa.DoesNotExist:
            # Equivalente viejo: return 0 → "Usuario/Contraseña Incorrectos"
            return Response(
                {"detail": "NIT o contraseña incorrectos."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Equivalente viejo: if new_estado == 'I' → return 2 (inactiva)
        if not empresa.activo:
            logger.warning("LOGIN B2B rechazado (empresa inactiva) | nit=%s", nit)
            return Response(
                {"detail": "La empresa se encuentra inactiva. Contacte al laboratorio."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Verificar contraseña hasheada
        if not check_password(password, empresa.password):
            logger.warning("LOGIN B2B rechazado (credenciales incorrectas) | nit=%s", nit)
            return Response(
                {"detail": "NIT o contraseña incorrectos."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Generar JWT con claims B2B personalizados
        # El viejo guardaba en sesión PHP: $_SESSION['id_user'], $_SESSION['id_nit_id'], $_SESSION['nombres']
        # Aquí usamos JWT stateless con los mismos datos
        refresh = RefreshToken()
        refresh['tipo_sesion'] = 'empresa'
        refresh['empresa_id'] = empresa.id
        refresh['empresa_nit'] = empresa.nit
        refresh['empresa_nombre'] = empresa.nombre

        logger.info("LOGIN B2B exitoso | empresa_id=%s | nit=%s | nombre=%s", empresa.id, empresa.nit, empresa.nombre)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "empresa": {
                "id": empresa.id,
                "nit": empresa.nit,
                "nombre": empresa.nombre,
            }
        }, status=status.HTTP_200_OK)


# =============================================================================
# MIXIN B2B — Extracción del token de empresa
# =============================================================================

class EmpresaTokenMixin:
    """
    Mixin para vistas del portal B2B.

    Centraliza la lógica de extracción del empresa_id desde el JWT B2B.
    Elimina la duplicación M-05 detectada en el Gap Analysis:
      - EmpresaPacienteBuscarView._get_empresa_id() (antes L143)
      - EmpresaResultadosView._get_empresa_id()     (antes L192)

    Uso:
        class MiView(EmpresaTokenMixin, APIView):
            def get(self, request):
                empresa_id = self.get_empresa_id(request)
                if not empresa_id:
                    return self.empresa_no_autorizado()
    """

    def get_empresa_id(self, request):
        """
        Extrae empresa_id del JWT B2B.
        Retorna el ID (int) si el token es válido y pertenece a una empresa,
        o None si el token es inválido, ausente o no es de tipo empresa.
        """
        from rest_framework_simplejwt.tokens import AccessToken
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return None
        try:
            token = AccessToken(auth.split(' ')[1])
            if token.get('tipo_sesion') != 'empresa':
                return None
            return token.get('empresa_id')
        except Exception:
            return None

    def empresa_no_autorizado(self, detalle=None):
        """Respuesta 401 estándar para token B2B inválido o ausente."""
        mensaje = detalle or "Token B2B inválido o sesión no es de empresa."
        return Response(
            {"detail": mensaje},
            status=status.HTTP_401_UNAUTHORIZED
        )


# =============================================================================
# CONSULTAS B2B (Equivalente a resultado.php del portal empresa)
# =============================================================================

class EmpresaPacienteBuscarView(EmpresaTokenMixin, APIView):
    """
    GET /api/b2b/pacientes/?documento=12345678

    Búsqueda de paciente DESDE la sesión de una empresa.
    Solo retorna el paciente si tiene resultados vinculados a esa empresa.

    Equivalente DIRECTO del sistema viejo (bio_cng/php/nombres.php):
        SELECT * FROM pct_pacientes
        WHERE idDocumento='$tipo' AND documento=$c AND idEmpresa=$nit

    La empresa autenticada filtra: los pacientes deben tener resultados
    con empresa_id == empresa actual (garantiza aislamiento B2B).
    """
    permission_classes = [AllowAny]  # Validación manual por token B2B

    def get(self, request):
        empresa_id = self.get_empresa_id(request)
        if not empresa_id:
            return self.empresa_no_autorizado()

        documento = request.query_params.get('documento', '').strip()
        if not documento:
            return Response(
                {"detail": "El parámetro 'documento' es requerido."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Buscar paciente que tenga resultados asociados a ESTA empresa
        # Equivalente viejo: WHERE documento=$c AND idEmpresa=$nit
        paciente = Paciente.objects.filter(
            documento=documento,
            resultados__empresa_id=empresa_id
        ).first()

        if not paciente:
            return Response(
                {"detail": f"No se encontró paciente con documento '{documento}' asociado a su empresa."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PacienteListSerializer(paciente)
        return Response(serializer.data)


class EmpresaResultadosView(EmpresaTokenMixin, APIView):
    """
    GET /api/b2b/pacientes/<paciente_id>/resultados/

    Lista los resultados de un paciente filtrados POR EMPRESA.
    Solo retorna los que tienen empresa_id == empresa autenticada.

    Equivalente DIRECTO del sistema viejo (bio_cng/php/resultado.php):
        SELECT * FROM svc_ordenes WHERE idPaciente=$c AND idEmpresa=$nit
        → Generaba links al servidor BIRT con el PDF

    En el nuevo sistema: retorna la lista con link de descarga directo al PDF.
    """
    permission_classes = [AllowAny]  # Validación manual por token B2B

    def get(self, request, paciente_id):
        empresa_id = self.get_empresa_id(request)
        if not empresa_id:
            return self.empresa_no_autorizado("Token B2B inválido.")

        # Verificar que el paciente tiene resultados de esta empresa
        # Garantiza aislamiento: una empresa no puede ver resultados de otra
        resultados = Resultado.objects.filter(
            paciente_id=paciente_id,
            empresa_id=empresa_id,
            estado__in=['VALIDADO', 'ENTREGADO']  # Solo resultados listos
        ).select_related('paciente')

        serializer = ResultadoListSerializer(resultados, many=True)
        return Response(serializer.data)


# =============================================================================
# PANEL ADMINISTRATIVO — Gestión de Empresas
# =============================================================================

class EmpresaAdminListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/admin/empresas/   → Listar todas las empresas (paginado, buscable)
    POST /api/admin/empresas/   → Crear nueva empresa

    Equivalente en sistema viejo (bioanalisis_cng/php/empresa_consultas.php):
        Empresas(): SELECT * FROM emp_empresas
        + formulario de alta de empresa

    Mejoras:
    - Paginación global (PAGE_SIZE=20) — Acción 4 M-04
    - Búsqueda por nombre o NIT con ?search=
    - Ordenamiento con ?ordering=nombre
    """
    permission_classes = [IsAuthenticated]
    queryset = Empresa.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'nit', 'email']
    ordering_fields = ['nombre', 'fecha_registro']
    ordering = ['nombre']

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return EmpresaListSerializer
        return EmpresaSerializer

    def perform_create(self, serializer):
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Solo los administradores pueden registrar empresas.")
        serializer.save()



class EmpresaAdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/admin/empresas/<id>/   → Detalle de empresa
    PATCH  /api/admin/empresas/<id>/   → Actualizar datos
    DELETE /api/admin/empresas/<id>/   → Eliminar empresa
    """
    permission_classes = [IsAuthenticated]
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer

    def perform_destroy(self, instance):
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Solo los administradores pueden eliminar empresas.")
        instance.delete()


class EmpresaToggleActivoView(APIView):
    """
    PATCH /api/admin/empresas/<id>/toggle/

    Activa o inactiva una empresa con un solo click.

    Equivalente DIRECTO del sistema viejo (empresa_consultas.php):
        Activar($id):   UPDATE emp_empresas SET new_estado='A' WHERE idEmpresa=$id
        Inactivar($id): UPDATE emp_empresas SET new_estado='I' WHERE idEmpresa=$id
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if request.user.role != 'admin':
            return Response(
                {"detail": "Solo los administradores pueden cambiar el estado de una empresa."},
                status=status.HTTP_403_FORBIDDEN
            )

        empresa = get_object_or_404(Empresa, pk=pk)
        empresa.activo = not empresa.activo
        empresa.save(update_fields=['activo', 'fecha_actualizacion'])

        accion = 'activada' if empresa.activo else 'inactivada'
        logger.info("EMPRESA %s | empresa_id=%s | nit=%s | admin_id=%s", accion.upper(), empresa.id, empresa.nit, request.user.id)
        return Response({
            "detail": f"Empresa '{empresa.nombre}' {accion} correctamente.",
            "activo": empresa.activo
        })


class EmpresaResetPasswordView(APIView):
    """
    PATCH /api/admin/empresas/<id>/reset-password/

    Permite al administrador resetear la contraseña de una empresa.

    Equivalente DIRECTO del sistema viejo (empresa_consultas.php):
        Cambiar_Pass($id):
            UPDATE emp_empresas SET new_pass='Bioanalisis2018*' WHERE idEmpresa=$id
        → Era contraseña HARDCODEADA. Ahora el admin define la nueva contraseña.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if request.user.role != 'admin':
            return Response(
                {"detail": "Solo los administradores pueden resetear contraseñas."},
                status=status.HTTP_403_FORBIDDEN
            )

        empresa = get_object_or_404(Empresa, pk=pk)
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        empresa.password = make_password(serializer.validated_data['nueva_password'])
        empresa.save(update_fields=['password', 'fecha_actualizacion'])

        logger.info("RESET PASSWORD empresa | empresa_id=%s | nit=%s | admin_id=%s", empresa.id, empresa.nit, request.user.id)
        return Response({"detail": f"Contraseña de '{empresa.nombre}' restablecida correctamente."})
