from django.urls import path

from .views import ExamenListView, ExamenDetailView

urlpatterns = [
    path('examenes/', ExamenListView.as_view(), name='examen-list'),
    path('examenes/<slug:slug>/', ExamenDetailView.as_view(), name='examen-detail'),
]
