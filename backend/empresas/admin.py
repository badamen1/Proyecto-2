from django.contrib import admin
from .models import Empresa


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    """
    Registro de Empresa en el panel de administración Django.

    Hallazgo N-03 (Gap Analysis): el archivo admin.py estaba vacío,
    impidiendo la gestión y verificación de empresas desde /admin/.
    """

    # Columnas visibles en el listado
    list_display = ['nombre', 'nit', 'email', 'telefono', 'activo', 'fecha_registro']

    # Filtros laterales por estado
    list_filter = ['activo']

    # Campos habilitados para búsqueda rápida
    search_fields = ['nombre', 'nit', 'email']

    # Campos que no deben editarse manualmente (generados automáticamente)
    readonly_fields = ['fecha_registro', 'fecha_actualizacion']

    # Orden por defecto en el listado (el modelo ya define ordering=['nombre'])
    ordering = ['nombre']
