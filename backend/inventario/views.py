import csv
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.db.models import F
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, filters, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import logging

from .models import Producto, Movimiento
from .serializers import (
    ProductoListSerializer,
    ProductoSerializer,
    ProductoBacteriologoSerializer,
    MovimientoSerializer,
    MovimientoListSerializer,
)

logger = logging.getLogger('inventario')

ROLES_ADMIN = ('admin',)
ROLES_OPERATIVO = ('admin', 'bacteriologo')


def _require_admin(user):
    if user.role not in ROLES_ADMIN:
        raise PermissionDenied("Solo los administradores pueden realizar esta acción.")


def _require_operativo(user):
    if user.role not in ROLES_OPERATIVO:
        raise PermissionDenied("No tiene permisos para realizar esta acción.")


# =============================================================================
# CRUD — Productos (endpoints 1–3)
# =============================================================================

class ProductoListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/inventario/productos/ → Listar (admin y bacteriólogo, sin ultimo_costo)
    POST /api/inventario/productos/ → Crear (solo admin)
    """
    permission_classes = [IsAuthenticated]
    queryset = Producto.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['codigo', 'nombre', 'proveedor_habitual']
    ordering_fields = ['nombre', 'codigo', 'stock_actual', 'fecha_registro']
    ordering = ['nombre']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ProductoSerializer
        return ProductoListSerializer

    def perform_create(self, serializer):
        _require_admin(self.request.user)
        serializer.save()


class ProductoDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/inventario/productos/<id>/ → Detalle
    PATCH /api/inventario/productos/<id>/ → Actualizar (solo admin)
    """
    permission_classes = [IsAuthenticated]
    queryset = Producto.objects.all()
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return ProductoSerializer
        if self.request.user.role in ROLES_ADMIN:
            return ProductoSerializer
        return ProductoBacteriologoSerializer

    def perform_update(self, serializer):
        _require_admin(self.request.user)
        serializer.save()


class ProductoToggleView(APIView):
    """PATCH /api/inventario/productos/<id>/toggle/ — Activar/Desactivar (solo admin)."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        _require_admin(request.user)
        producto = get_object_or_404(Producto, pk=pk)
        producto.activo = not producto.activo
        producto.save(update_fields=['activo', 'fecha_actualizacion'])
        accion = 'activado' if producto.activo else 'desactivado'
        logger.info(
            "TOGGLE %s | producto_id=%s | codigo=%s | admin_id=%s",
            accion.upper(), producto.id, producto.codigo, request.user.id
        )
        return Response({
            'detail': f"Producto '{producto.nombre}' {accion} correctamente.",
            'activo': producto.activo,
        })
