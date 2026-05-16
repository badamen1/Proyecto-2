from django.urls import path
from . import views

urlpatterns = [
    # ── Catálogo ──────────────────────────────────────────────────
    path('inventario/productos/', views.ProductoListCreateView.as_view(), name='inventario-producto-list'),
    path('inventario/productos/<int:pk>/', views.ProductoDetailView.as_view(), name='inventario-producto-detail'),
    path('inventario/productos/<int:pk>/toggle/', views.ProductoToggleView.as_view(), name='inventario-producto-toggle'),
]
