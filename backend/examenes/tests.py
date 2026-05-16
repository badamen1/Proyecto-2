from django.test import TestCase

from .models import Examen


class ExamenModelTests(TestCase):
    def test_slug_auto_generado_desde_nombre(self):
        e = Examen(codigo='GLU', nombre='Glucosa Basal', precio=15000, categoria='Metabolismo')
        e.save()
        self.assertEqual(e.slug, 'glucosa-basal')

    def test_slug_normaliza_tildes(self):
        e = Examen(codigo='FE', nombre='Ferritina Sérica', precio=30000, categoria='Hematología')
        e.save()
        self.assertEqual(e.slug, 'ferritina-serica')

    def test_slug_colision_agrega_codigo(self):
        Examen.objects.create(
            codigo='A1', nombre='Proteína C', precio=10000, categoria='Otras', slug='proteina-c'
        )
        e = Examen(codigo='A2', nombre='Proteína C', precio=12000, categoria='Otras')
        e.save()
        self.assertEqual(e.slug, 'proteina-c-1')

    def test_str(self):
        e = Examen(codigo='GLU', nombre='Glucosa Basal', precio=15000, categoria='Metabolismo')
        self.assertEqual(str(e), 'Glucosa Basal (GLU)')
