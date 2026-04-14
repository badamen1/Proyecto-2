from django.contrib import admin
from .models import Paciente, Resultado


@admin.register(Paciente)
class PacienteAdmin(admin.ModelAdmin):
    list_display = ['nombre_completo', 'tipo_documento', 'documento', 'telefono', 'activo', 'fecha_registro']
    list_filter = ['tipo_documento', 'activo']
    search_fields = ['nombre_completo', 'documento', 'email']
    readonly_fields = ['fecha_registro', 'fecha_actualizacion']


@admin.register(Resultado)
class ResultadoAdmin(admin.ModelAdmin):
    list_display = ['tipo_examen', 'paciente', 'fuente', 'estado', 'fecha_examen', 'fecha_carga']
    list_filter = ['fuente', 'estado', 'fecha_examen']
    search_fields = ['tipo_examen', 'paciente__nombre_completo', 'paciente__documento']
    readonly_fields = ['fecha_carga', 'fecha_actualizacion']
    raw_id_fields = ['paciente', 'subido_por']
