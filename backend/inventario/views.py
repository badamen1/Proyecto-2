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


# =============================================================================
# INGRESO / EGRESO / HISTORIAL (endpoints 4–6)
# =============================================================================

class ProductoIngresoView(APIView):
    """POST /api/inventario/productos/<id>/ingreso/ — Suma stock (solo admin)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        _require_admin(request.user)
        producto = get_object_or_404(Producto, pk=pk)

        motivo = request.data.get('motivo', '').strip()
        if not motivo:
            return Response({'detail': 'El motivo es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cantidad = int(request.data.get('cantidad', 0))
            if cantidad <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'detail': 'La cantidad debe ser un entero positivo.'}, status=status.HTTP_400_BAD_REQUEST)

        producto.stock_actual += cantidad
        update_fields = ['stock_actual', 'fecha_actualizacion']

        fecha_vencimiento = request.data.get('fecha_vencimiento')
        numero_lote = request.data.get('numero_lote')
        ultimo_costo = request.data.get('ultimo_costo')

        if fecha_vencimiento is not None:
            producto.fecha_vencimiento = fecha_vencimiento
            update_fields.append('fecha_vencimiento')
        if numero_lote is not None:
            producto.numero_lote = numero_lote
            update_fields.append('numero_lote')
        if ultimo_costo is not None:
            try:
                producto.ultimo_costo = Decimal(str(ultimo_costo))
            except InvalidOperation:
                return Response({'detail': 'El costo debe ser un número decimal válido.'}, status=status.HTTP_400_BAD_REQUEST)
            update_fields.append('ultimo_costo')

        producto.save(update_fields=update_fields)

        Movimiento.objects.create(
            producto=producto,
            tipo=Movimiento.TipoMovimiento.INGRESO,
            cantidad=cantidad,
            motivo=motivo,
            registrado_por=request.user,
        )

        logger.info(
            "INGRESO | producto_id=%s | codigo=%s | cantidad=%s | admin_id=%s",
            producto.id, producto.codigo, cantidad, request.user.id
        )
        return Response(ProductoSerializer(producto).data)


class ProductoEgresoView(APIView):
    """POST /api/inventario/productos/<id>/egreso/ — Resta stock (admin y bacteriólogo)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        _require_operativo(request.user)
        producto = get_object_or_404(Producto, pk=pk)

        motivo = request.data.get('motivo', '').strip()
        if not motivo:
            return Response({'detail': 'El motivo es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cantidad = int(request.data.get('cantidad', 0))
            if cantidad <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'detail': 'La cantidad debe ser un entero positivo.'}, status=status.HTTP_400_BAD_REQUEST)

        if producto.stock_actual < cantidad:
            return Response(
                {'detail': f'Stock insuficiente. Stock actual: {producto.stock_actual}, solicitado: {cantidad}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        producto.stock_actual -= cantidad
        producto.save(update_fields=['stock_actual', 'fecha_actualizacion'])

        Movimiento.objects.create(
            producto=producto,
            tipo=Movimiento.TipoMovimiento.EGRESO,
            cantidad=cantidad,
            motivo=motivo,
            registrado_por=request.user,
        )

        logger.info(
            "EGRESO | producto_id=%s | codigo=%s | cantidad=%s | user_id=%s | role=%s",
            producto.id, producto.codigo, cantidad, request.user.id, request.user.role
        )

        serializer_class = ProductoSerializer if request.user.role in ROLES_ADMIN else ProductoBacteriologoSerializer
        return Response(serializer_class(producto).data)


class ProductoMovimientosView(generics.ListAPIView):
    """GET /api/inventario/productos/<id>/movimientos/ — Historial (admin y bacteriólogo)."""
    permission_classes = [IsAuthenticated]
    serializer_class = MovimientoSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['fecha_registro', 'tipo']
    ordering = ['-fecha_registro']

    def get_queryset(self):
        _require_operativo(self.request.user)
        producto = get_object_or_404(Producto, pk=self.kwargs['pk'])
        return Movimiento.objects.filter(producto=producto).select_related('producto', 'registrado_por')


# =============================================================================
# REPORTES (endpoints 7–10)
# =============================================================================

class InventarioAlertasView(APIView):
    """GET /api/inventario/alertas/ — Stock bajo + vencidos/por vencer (admin y bacteriólogo)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_operativo(request.user)
        hoy = date.today()
        limite_vencimiento = hoy + timedelta(days=30)

        stock_bajo = Producto.objects.filter(activo=True, stock_actual__lte=F('stock_minimo'))
        vencidos = Producto.objects.filter(activo=True, fecha_vencimiento__lt=hoy)
        por_vencer = Producto.objects.filter(
            activo=True,
            fecha_vencimiento__gte=hoy,
            fecha_vencimiento__lte=limite_vencimiento,
        )

        return Response({
            'stock_bajo': ProductoListSerializer(stock_bajo, many=True).data,
            'vencidos': ProductoListSerializer(vencidos, many=True).data,
            'por_vencer': ProductoListSerializer(por_vencer, many=True).data,
        })


class MovimientoListView(generics.ListAPIView):
    """GET /api/inventario/movimientos/ — Trazabilidad global (admin y bacteriólogo)."""
    permission_classes = [IsAuthenticated]
    serializer_class = MovimientoListSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['producto__codigo', 'producto__nombre', 'motivo']
    ordering_fields = ['fecha_registro', 'tipo']
    ordering = ['-fecha_registro']

    def get_queryset(self):
        _require_operativo(self.request.user)
        return Movimiento.objects.select_related('producto', 'registrado_por').all()


class MovimientoExportarView(APIView):
    """GET /api/inventario/movimientos/exportar/ — CSV (solo admin)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_admin(request.user)

        qs = Movimiento.objects.select_related('producto', 'registrado_por').order_by('-fecha_registro')

        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')
        producto_id = request.query_params.get('producto_id')

        if fecha_desde:
            qs = qs.filter(fecha_registro__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_registro__date__lte=fecha_hasta)
        if producto_id:
            qs = qs.filter(producto_id=producto_id)

        nombre_archivo = f"inventario_movimientos_{date.today():%Y-%m-%d}.csv"
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
        response.write('﻿')  # BOM para compatibilidad con Excel

        writer = csv.writer(response)
        writer.writerow(['Fecha', 'Código Producto', 'Nombre Producto', 'Tipo', 'Cantidad', 'Motivo', 'Registrado Por'])
        for mov in qs:
            writer.writerow([
                mov.fecha_registro.strftime('%Y-%m-%d %H:%M'),
                mov.producto.codigo,
                mov.producto.nombre,
                mov.get_tipo_display(),
                mov.cantidad,
                mov.motivo,
                mov.registrado_por.nombre_completo if mov.registrado_por else '',
            ])

        logger.info(
            "EXPORTAR CSV | admin_id=%s | fecha_desde=%s | fecha_hasta=%s | producto_id=%s",
            request.user.id, fecha_desde, fecha_hasta, producto_id
        )
        return response


class InventarioResumenView(APIView):
    """GET /api/inventario/resumen/ — Contadores + últimos 5 movimientos (solo admin)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_admin(request.user)
        hoy = date.today()

        return Response({
            'total_productos': Producto.objects.filter(activo=True).count(),
            'stock_bajo': Producto.objects.filter(activo=True, stock_actual__lte=F('stock_minimo')).count(),
            'sin_stock': Producto.objects.filter(activo=True, stock_actual=0).count(),
            'vencidos': Producto.objects.filter(activo=True, fecha_vencimiento__lt=hoy).count(),
            'ultimos_movimientos': MovimientoListSerializer(
                Movimiento.objects.select_related('producto').order_by('-fecha_registro')[:5],
                many=True
            ).data,
        })
