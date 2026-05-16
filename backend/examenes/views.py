from rest_framework import generics, filters
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny

from .models import Examen
from .serializers import ExamenListSerializer, ExamenDetailSerializer


class ExamenPagination(PageNumberPagination):
    """Paginación que permite al cliente pedir hasta 200 resultados con ?page_size=N."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 200


class ExamenListView(generics.ListAPIView):
    """
    GET /api/examenes/

    Catálogo público de exámenes activos. Soporta:
    - ?search=texto   → filtra por nombre o código
    - ?categoria=X    → filtra por categoría exacta
    - ?page_size=N    → hasta 200 resultados por página
    """
    serializer_class = ExamenListSerializer
    permission_classes = [AllowAny]
    pagination_class = ExamenPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['nombre', 'codigo']

    def get_queryset(self):
        qs = Examen.objects.filter(activo=True)
        categoria = self.request.query_params.get('categoria')
        if categoria:
            qs = qs.filter(categoria=categoria)
        return qs


class ExamenDetailView(generics.RetrieveAPIView):
    """
    GET /api/examenes/<slug>/

    Detalle público de un examen por slug. Retorna 404 si no existe o está inactivo.
    """
    serializer_class = ExamenDetailSerializer
    permission_classes = [AllowAny]
    queryset = Examen.objects.filter(activo=True)
    lookup_field = 'slug'
