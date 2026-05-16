from django.contrib import admin
from .models import Producto, Movimiento


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    """Admin de productos del inventario clínico."""
    list_display = ['codigo', 'nombre', 'categoria', 'unidad_medida', 'stock_actual', 'stock_minimo', 'activo']
    list_filter = ['categoria', 'activo', 'unidad_medida']
    search_fields = ['codigo', 'nombre', 'proveedor_habitual']
    readonly_fields = ['fecha_registro', 'fecha_actualizacion']


@admin.register(Movimiento)
class MovimientoAdmin(admin.ModelAdmin):
    """Admin de movimientos — solo lectura, inmutable."""
    list_display = ['producto', 'tipo', 'cantidad', 'motivo', 'registrado_por', 'fecha_registro']
    list_filter = ['tipo']
    search_fields = ['producto__codigo', 'producto__nombre', 'motivo']
    readonly_fields = ['producto', 'tipo', 'cantidad', 'motivo', 'registrado_por', 'fecha_registro']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
