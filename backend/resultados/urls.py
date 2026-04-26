from django.urls import path
from .views import (
    # Pacientes
    PacienteListCreateView,
    PacienteDetailView,
    PacienteBuscarView,
    PacienteResultadosView,
    # Resultados
    ResultadoListCreateView,
    ResultadoDetailView,
    ResultadoDescargarPDFView,
    ResultadoCambiarEstadoView,
)

urlpatterns = [
    # ── Pacientes ──────────────────────────────────────────────
    # Listar / Crear pacientes
    path('pacientes/', PacienteListCreateView.as_view(), name='paciente_list_create'),
    # Buscar paciente por documento (AJAX, equivale a nombres.php)
    path('pacientes/buscar/', PacienteBuscarView.as_view(), name='paciente_buscar'),
    # Detalle / Actualizar paciente
    path('pacientes/<int:pk>/', PacienteDetailView.as_view(), name='paciente_detail'),
    # Resultados de un paciente específico
    path('pacientes/<int:paciente_id>/resultados/', PacienteResultadosView.as_view(), name='paciente_resultados'),

    # ── Resultados ─────────────────────────────────────────────
    # Listar / Cargar resultados (con PDF upload)
    path('resultados/', ResultadoListCreateView.as_view(), name='resultado_list_create'),
    # Detalle / Actualizar / Eliminar resultado
    path('resultados/<int:pk>/', ResultadoDetailView.as_view(), name='resultado_detail'),
    # Descargar PDF del resultado
    path('resultados/<str:pk>/pdf/', ResultadoDescargarPDFView.as_view(), name='resultado_descargar_pdf'),
    # Cambiar estado del resultado (PENDIENTE → VALIDADO → ENTREGADO)
    path('resultados/<int:pk>/estado/', ResultadoCambiarEstadoView.as_view(), name='resultado_cambiar_estado'),
]
