from rest_framework import generics, status, filters
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
import logging

from .models import Paciente, Resultado
from .serializers import (
    PacienteSerializer,
    PacienteListSerializer,
    ResultadoSerializer,
    ResultadoListSerializer,
)
from .services.fasil_service import (
    fasil_service,
    FasilPacienteNoEncontrado,
    FasilConexionError,
)

logger = logging.getLogger('resultados')


def _resultado_a_dict(resultado):
    """Convierte un Resultado de BD al formato de lista unificada."""
    return {
        'id': str(resultado.pk),
        'tipo_examen': resultado.tipo_examen,
        'fecha_examen': str(resultado.fecha_examen),
        'estado': resultado.estado,
        'fuente': resultado.fuente,
        'nombre_archivo': resultado.nombre_archivo,
        'tiene_pdf': bool(resultado.archivo_pdf),
    }


def _orden_fasil_a_dict(orden):
    """Convierte una OrdenFASIL al formato de lista unificada."""
    return {
        'id': f'fasil-{orden.id_orden}',
        'tipo_examen': orden.tipo_examen,
        'fecha_examen': orden.fecha_examen,
        'estado': 'ENTREGADO',
        'fuente': 'FASIL',
        'nombre_archivo': None,
        'tiene_pdf': orden.tiene_pdf,
    }


# =============================================================================
# PACIENTES
# =============================================================================

class PacienteListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/pacientes/           → Listar pacientes (con búsqueda)
    POST /api/pacientes/           → Crear paciente

    Equivalente en sistema viejo:
    - nombres.php → búsqueda AJAX por documento
    - No tenía creación desde web (se hacía directo en BD)

    Permisos:
    - Admin y Bacteriólogo pueden listar y crear
    - Paciente solo puede ver su propio registro
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['documento', 'nombre_completo', 'email']
    ordering_fields = ['nombre_completo', 'fecha_registro']
    ordering = ['-fecha_registro']

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return PacienteListSerializer
        return PacienteSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ('admin', 'bacteriologo'):
            return Paciente.objects.all()
        # Paciente solo ve su propio registro
        return Paciente.objects.filter(user=user)

    def perform_create(self, serializer):
        # Solo admin y bacteriólogo pueden crear pacientes
        if self.request.user.role not in ('admin', 'bacteriologo'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Solo administradores y bacteriólogos pueden registrar pacientes.")
        serializer.save()


class PacienteDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/pacientes/<id>/     → Detalle de paciente
    PATCH /api/pacientes/<id>/     → Actualizar paciente

    Equivalente en sistema viejo: perfil_consultas.php → Actualizar_Usuarios()
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PacienteSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ('admin', 'bacteriologo'):
            return Paciente.objects.all()
        return Paciente.objects.filter(user=user)


class PacienteBuscarView(APIView):
    """
    GET /api/pacientes/buscar/?documento=12345678

    Búsqueda rápida de paciente por documento exacto.
    Equivalente directo del AJAX de nombres.php del sistema viejo:
        SELECT * FROM pct_pacientes WHERE documento = $c

    Usado por el bacteriólogo al cargar un resultado.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        documento = request.query_params.get('documento', '').strip()
        if not documento:
            return Response(
                {"detail": "El parámetro 'documento' es requerido."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            paciente = Paciente.objects.get(documento=documento)
            serializer = PacienteSerializer(paciente)
            return Response(serializer.data)
        except Paciente.DoesNotExist:
            return Response(
                {"detail": f"No se encontró paciente con documento '{documento}'."},
                status=status.HTTP_404_NOT_FOUND
            )


class PacienteResultadosView(generics.ListAPIView):
    """
    GET /api/pacientes/<id>/resultados/

    Lista todos los resultados de un paciente específico.
    Equivalente en sistema viejo:
        resultado.php → SELECT * FROM svc_ordenes WHERE idPaciente = $c

    Unifica resultados FASIL + externos (según Contex.md).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ResultadoListSerializer

    def get_queryset(self):
        paciente_id = self.kwargs['paciente_id']
        user = self.request.user

        # Verificar permisos
        if user.role in ('admin', 'bacteriologo'):
            return Resultado.objects.filter(paciente_id=paciente_id)

        # Paciente solo ve sus propios resultados
        return Resultado.objects.filter(
            paciente_id=paciente_id,
            paciente__user=user
        )


# =============================================================================
# RESULTADOS
# =============================================================================

class ResultadoListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/resultados/          → Listar resultados
    POST /api/resultados/          → Cargar resultado (con PDF)

    Equivalente en sistema viejo:
    - GET  → result_consultas.php → Resultados()
    - POST → result_consultas.php → Cargar_Archivo()

    Permisos:
    - Admin/Bacteriólogo: ver todos, crear nuevos
    - Paciente: solo ver los suyos (estado VALIDADO o ENTREGADO)
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['tipo_examen', 'paciente__nombre_completo', 'paciente__documento']
    ordering_fields = ['fecha_examen', 'fecha_carga']
    ordering = ['-fecha_examen']

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ResultadoListSerializer
        return ResultadoSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Resultado.objects.select_related('paciente', 'paciente_user', 'subido_por', 'empresa')

        if user.role in ('admin', 'bacteriologo'):
            qs = queryset.all()
        else:
            qs = queryset.filter(
                paciente_user=user,
                estado__in=['VALIDADO', 'ENTREGADO']
            )

        fuente = self.request.query_params.get('fuente')
        estado = self.request.query_params.get('estado')
        paciente_id = self.request.query_params.get('paciente')

        if fuente:
            qs = qs.filter(fuente=fuente)
        if estado and user.role in ('admin', 'bacteriologo'):
            qs = qs.filter(estado=estado)
        if paciente_id and user.role in ('admin', 'bacteriologo'):
            qs = qs.filter(paciente_id=paciente_id)

        return qs

    def perform_create(self, serializer):
        if self.request.user.role not in ('admin', 'bacteriologo'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Solo administradores y bacteriólogos pueden cargar resultados.")
        resultado = serializer.save(subido_por=self.request.user)
        logger.info(
            "RESULTADO CARGADO | resultado_id=%s | paciente_id=%s | tipo=%s | subido_por_id=%s | empresa_id=%s",
            resultado.id, resultado.paciente_id, resultado.tipo_examen,
            self.request.user.id, resultado.empresa_id
        )

    def list(self, request, *args, **kwargs):
        """Para pacientes: combina BD + FASIL. Para admin/bacteriólogo: solo BD."""
        if request.user.role not in ('admin', 'bacteriologo'):
            return self._list_paciente(request)
        return super().list(request, *args, **kwargs)

    def _list_paciente(self, request):
        from .serializers import ResultadoUnificadoSerializer

        # 1. Resultados de BD (ya filtrados por get_queryset para paciente_user=user)
        qs = self.get_queryset()
        bd_items = [_resultado_a_dict(r) for r in qs]

        # 2. Órdenes FASIL — secuencial, con degradación elegante
        fasil_items = []
        documento = getattr(request.user, 'documento', None)
        if documento:
            try:
                paciente_fasil = fasil_service.get_paciente(documento)
                ordenes = fasil_service.get_ordenes(paciente_fasil.id_fasil)
                fasil_items = [_orden_fasil_a_dict(o) for o in ordenes]
            except FasilPacienteNoEncontrado:
                logger.info(
                    "FASIL: paciente no encontrado | documento=%s", documento
                )
            except FasilConexionError:
                logger.error(
                    "FASIL: error de conexión al listar resultados | documento=%s", documento
                )

        # 3. Combinar y ordenar por fecha_examen descendente
        todos = bd_items + fasil_items
        todos.sort(key=lambda x: x['fecha_examen'], reverse=True)

        # 4. Paginación manual compatible con DRF
        page_size = int(request.query_params.get('page_size', 20))
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        pagina = todos[start:end]

        next_url = None
        if end < len(todos):
            next_url = request.build_absolute_uri(
                f'?page={page + 1}&page_size={page_size}'
            )

        serializer = ResultadoUnificadoSerializer(pagina, many=True)
        return Response({
            'count': len(todos),
            'next': next_url,
            'previous': None,
            'results': serializer.data,
        })


class ResultadoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/resultados/<id>/   → Detalle de resultado
    PATCH  /api/resultados/<id>/   → Actualizar resultado (ej: cambiar estado)
    DELETE /api/resultados/<id>/   → Eliminar resultado

    Equivalente en sistema viejo:
    - DELETE → result_consultas.php → Eliminar_Archivo()

    Permisos:
    - Admin: CRUD completo
    - Bacteriólogo: leer, actualizar estado
    - Paciente: solo leer si es suyo y está validado
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = ResultadoSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Resultado.objects.select_related('paciente', 'paciente_user', 'subido_por', 'empresa')

        if user.role == 'admin':
            return queryset.all()
        elif user.role == 'bacteriologo':
            return queryset.all()
        else:
            return queryset.filter(
                paciente_user=user,
                estado__in=['VALIDADO', 'ENTREGADO']
            )

    def perform_destroy(self, instance):
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Solo los administradores pueden eliminar resultados.")

        logger.info(
            "RESULTADO ELIMINADO | resultado_id=%s | paciente_id=%s | tipo=%s | admin_id=%s",
            instance.id, instance.paciente_id, instance.tipo_examen, self.request.user.id
        )
        # Eliminar archivo físico del FileSystem antes de borrar el registro
        if instance.archivo_pdf:
            instance.archivo_pdf.delete(save=False)
        instance.delete()


class ResultadoDescargarPDFView(APIView):
    """
    GET /api/resultados/<id>/pdf/  → Descargar archivo PDF

    Equivalente directo de resul_pdf.php del sistema viejo:
        SELECT re_tipo, re_archivo FROM resultado WHERE re_id = $id
        header("Content-type: $tipo");
        print $contenido;

    Diferencia clave: el viejo servía BLOB desde la BD,
    ahora servimos el archivo desde el FileSystem.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from .services.fasil_service import FasilOrdenNoEncontrada, FasilConexionError as FasilConn
        user = request.user

        # Ruta FASIL: pk empieza con "fasil-"
        if isinstance(pk, str) and pk.startswith('fasil-'):
            orden_id = pk[len('fasil-'):]
            try:
                pdf_url = fasil_service.get_resultado_pdf_url(orden_id)
            except FasilOrdenNoEncontrada:
                raise Http404("No se encontró el PDF en FASIL.")
            except (FasilConn, NotImplementedError) as e:
                raise Http404(f"PDF no disponible: {e}")

            from rest_framework.response import Response
            return Response({"pdf_url": pdf_url})

        # Ruta BD: pk es un entero (como string) — admin/bact o paciente con paciente_user
        if user.role in ('admin', 'bacteriologo'):
            resultado = get_object_or_404(Resultado, pk=pk)
        else:
            resultado = get_object_or_404(
                Resultado,
                pk=pk,
                paciente_user=user,
                estado__in=['VALIDADO', 'ENTREGADO']
            )

        if not resultado.archivo_pdf:
            raise Http404("Este resultado no tiene un archivo PDF asociado.")

        response = FileResponse(
            resultado.archivo_pdf.open('rb'),
            content_type=resultado.tipo_archivo or 'application/pdf'
        )
        filename = resultado.nombre_archivo or f"resultado_{pk}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class ResultadoCambiarEstadoView(APIView):
    """
    PATCH /api/resultados/<id>/estado/

    Permite cambiar el estado de un resultado:
    PENDIENTE → VALIDADO → ENTREGADO

    Usado por bacteriólogos para validar y por admin para marcar entregados.
    No existía en el sistema viejo (los resultados no tenían flujo de estados).
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if request.user.role not in ('admin', 'bacteriologo'):
            return Response(
                {"detail": "No tiene permisos para cambiar el estado."},
                status=status.HTTP_403_FORBIDDEN
            )

        nuevo_estado = request.data.get('estado')
        if nuevo_estado not in dict(Resultado.Estado.choices):
            return Response(
                {"detail": f"Estado inválido. Opciones: {list(dict(Resultado.Estado.choices).keys())}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        resultado = get_object_or_404(Resultado, pk=pk)
        resultado.estado = nuevo_estado
        resultado.save(update_fields=['estado', 'fecha_actualizacion'])

        logger.info(
            "ESTADO CAMBIADO | resultado_id=%s | nuevo_estado=%s | user_id=%s",
            pk, nuevo_estado, request.user.id
        )
        serializer = ResultadoSerializer(resultado)
        return Response(serializer.data)
