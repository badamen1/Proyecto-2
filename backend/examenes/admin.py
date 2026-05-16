from django.contrib import admin

from .models import Examen


@admin.register(Examen)
class ExamenAdmin(admin.ModelAdmin):
    """Admin para gestionar el catálogo de exámenes de laboratorio."""

    list_display   = ['nombre', 'codigo', 'categoria', 'precio', 'activo', 'requiere_ayuno']
    list_filter    = ['categoria', 'activo', 'requiere_ayuno']
    search_fields  = ['nombre', 'codigo']
    list_editable  = ['activo']
    ordering       = ['nombre']
    prepopulated_fields = {'slug': ('nombre',)}
    fieldsets = (
        ('Identificación', {
            'fields': ('codigo', 'nombre', 'slug', 'categoria', 'activo'),
        }),
        ('Información clínica', {
            'fields': ('precio', 'descripcion', 'sintomas'),
        }),
        ('Preparación', {
            'fields': ('requiere_ayuno', 'preparacion'),
        }),
    )
