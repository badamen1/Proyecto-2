from django.urls import path
from .views import (
    # B2B — Portal Empresa (equivalente a bio_cng/)
    EmpresaLoginView,
    EmpresaPacienteBuscarView,
    EmpresaResultadosView,
    # Admin interno (equivalente a bioanalisis_cng/gestion/empresas/)
    EmpresaAdminListCreateView,
    EmpresaAdminDetailView,
    EmpresaToggleActivoView,
    EmpresaResetPasswordView,
)

urlpatterns = [
    # ── Portal B2B (bio_cng equivalente) ──────────────────────────────────────
    # Login empresa por NIT + password → retorna JWT B2B
    # Viejo: bio_cng/index.php → login_consultas.php → Login($id, $pass)
    path('b2b/login/', EmpresaLoginView.as_view(), name='empresa_login'),

    # Buscar paciente filtrado por empresa autenticada
    # Viejo: bio_cng/php/nombres.php → SELECT * FROM pct_pacientes WHERE ... AND idEmpresa=$nit
    path('b2b/pacientes/', EmpresaPacienteBuscarView.as_view(), name='empresa_buscar_paciente'),

    # Listar resultados de un paciente para la empresa autenticada
    # Viejo: bio_cng/php/resultado.php → SELECT * FROM svc_ordenes WHERE idPaciente=$c AND idEmpresa=$nit
    path('b2b/pacientes/<int:paciente_id>/resultados/', EmpresaResultadosView.as_view(), name='empresa_resultados'),

    # ── Panel Administrativo (bioanalisis_cng equivalente) ────────────────────
    # CRUD completo de empresas — solo Admin
    # Viejo: empresa_consultas.php → Empresas() + alta de empresa
    path('admin/empresas/', EmpresaAdminListCreateView.as_view(), name='empresa_admin_list_create'),
    path('admin/empresas/<int:pk>/', EmpresaAdminDetailView.as_view(), name='empresa_admin_detail'),

    # Toggle Activo/Inactivo
    # Viejo: Activar($id) / Inactivar($id)
    path('admin/empresas/<int:pk>/toggle/', EmpresaToggleActivoView.as_view(), name='empresa_toggle'),

    # Resetear contraseña
    # Viejo: Cambiar_Pass($id) — era hardcodeada 'Bioanalisis2018*'
    path('admin/empresas/<int:pk>/reset-password/', EmpresaResetPasswordView.as_view(), name='empresa_reset_password'),
]
