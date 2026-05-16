from rest_framework import serializers
from .models import Producto, Movimiento


class ProductoListSerializer(serializers.ModelSerializer):
    """Serializer ligero para listados — admin y bacteriólogo. Sin ultimo_costo."""

    class Meta:
        model = Producto
        fields = [
            'id', 'codigo', 'nombre', 'categoria', 'unidad_medida',
            'stock_actual', 'stock_minimo', 'activo',
        ]


class ProductoSerializer(serializers.ModelSerializer):
    """Serializer completo — solo para admin. Incluye ultimo_costo."""

    class Meta:
        model = Producto
        fields = [
            'id', 'codigo', 'nombre', 'categoria', 'unidad_medida',
            'stock_actual', 'stock_minimo', 'proveedor_habitual',
            'ultimo_costo', 'fecha_vencimiento', 'numero_lote',
            'observaciones', 'activo', 'fecha_registro', 'fecha_actualizacion',
        ]
        read_only_fields = ['id', 'stock_actual', 'fecha_registro', 'fecha_actualizacion']


class ProductoBacteriologoSerializer(serializers.ModelSerializer):
    """Para GET detalle por bacteriólogo — excluye ultimo_costo."""

    class Meta:
        model = Producto
        fields = [
            'id', 'codigo', 'nombre', 'categoria', 'unidad_medida',
            'stock_actual', 'stock_minimo', 'proveedor_habitual',
            'fecha_vencimiento', 'numero_lote',
            'observaciones', 'activo', 'fecha_registro', 'fecha_actualizacion',
        ]
        read_only_fields = ['id', 'stock_actual', 'fecha_registro', 'fecha_actualizacion']


class MovimientoSerializer(serializers.ModelSerializer):
    """Serializer completo con campos legibles de FK."""
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    registrado_por_nombre = serializers.CharField(
        source='registrado_por.nombre_completo', read_only=True, default=None
    )

    class Meta:
        model = Movimiento
        fields = [
            'id', 'producto', 'producto_nombre', 'tipo', 'cantidad',
            'motivo', 'registrado_por', 'registrado_por_nombre', 'fecha_registro',
        ]
        read_only_fields = ['id', 'producto_nombre', 'registrado_por_nombre', 'fecha_registro']


class MovimientoListSerializer(serializers.ModelSerializer):
    """Serializer ligero para trazabilidad global y resumen."""
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)

    class Meta:
        model = Movimiento
        fields = ['id', 'producto_codigo', 'producto_nombre', 'tipo', 'cantidad', 'fecha_registro']
