from rest_framework import serializers

from .models import Examen


class ExamenListSerializer(serializers.ModelSerializer):
    """Serializer ligero para el listado del catálogo de exámenes."""

    class Meta:
        model = Examen
        fields = ['slug', 'nombre', 'codigo', 'categoria', 'precio', 'sintomas']


class ExamenDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para la página de detalle de un examen."""

    class Meta:
        model = Examen
        fields = [
            'slug', 'nombre', 'codigo', 'categoria', 'precio',
            'descripcion', 'sintomas', 'requiere_ayuno', 'preparacion',
        ]
