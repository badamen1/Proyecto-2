from django.urls import path
from . import views

urlpatterns = [
    # ── Catálogo ──────────────────────────────────────────────────
    path('inventario/productos/', views.ProductoListCreateView.as_view(), name='inventario-producto-list'),
    path('inventario/productos/<int:pk>/', views.ProductoDetailView.as_view(), name='inventario-producto-detail'),
    path('inventario/productos/<int:pk>/toggle/', views.ProductoToggleView.as_view(), name='inventario-producto-toggle'),

    # ── Movimientos por producto ───────────────────────────────────
    path('inventario/productos/<int:pk>/ingreso/', views.ProductoIngresoView.as_view(), name='inventario-producto-ingreso'),
    path('inventario/productos/<int:pk>/egreso/', views.ProductoEgresoView.as_view(), name='inventario-producto-egreso'),
    path('inventario/productos/<int:pk>/movimientos/', views.ProductoMovimientosView.as_view(), name='inventario-producto-movimientos'),

    # ── Reportes ──────────────────────────────────────────────────
    path('inventario/alertas/', views.InventarioAlertasView.as_view(), name='inventario-alertas'),
    # exportar ANTES de movimientos/ para evitar conflictos de routing
    path('inventario/movimientos/exportar/', views.MovimientoExportarView.as_view(), name='inventario-movimiento-exportar'),
    path('inventario/movimientos/', views.MovimientoListView.as_view(), name='inventario-movimiento-list'),
    path('inventario/resumen/', views.InventarioResumenView.as_view(), name='inventario-resumen'),
]
