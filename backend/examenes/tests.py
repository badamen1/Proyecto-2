from django.test import TestCase
from rest_framework.test import APIClient

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


class ExamenListViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.glucosa = Examen.objects.create(
            codigo='GLU', nombre='Glucosa Basal', slug='glucosa-basal',
            precio=15000, categoria='Metabolismo', activo=True,
            sintomas=['sed excesiva', 'cansancio'],
        )
        self.hemograma = Examen.objects.create(
            codigo='HEM', nombre='Hemograma Completo', slug='hemograma-completo',
            precio=25000, categoria='Hematología', activo=True,
            sintomas=['fatiga', 'palidez'],
        )
        Examen.objects.create(
            codigo='INA', nombre='Examen Inactivo', slug='examen-inactivo',
            precio=10000, categoria='Otras', activo=False,
        )

    def test_list_retorna_200(self):
        response = self.client.get('/api/examenes/')
        self.assertEqual(response.status_code, 200)

    def test_list_no_requiere_auth(self):
        response = self.client.get('/api/examenes/')
        self.assertNotEqual(response.status_code, 401)

    def test_list_excluye_inactivos(self):
        response = self.client.get('/api/examenes/')
        nombres = [e['nombre'] for e in response.data['results']]
        self.assertNotIn('Examen Inactivo', nombres)

    def test_search_por_nombre(self):
        response = self.client.get('/api/examenes/?search=glucosa')
        nombres = [e['nombre'] for e in response.data['results']]
        self.assertIn('Glucosa Basal', nombres)
        self.assertNotIn('Hemograma Completo', nombres)

    def test_search_por_codigo(self):
        response = self.client.get('/api/examenes/?search=HEM')
        nombres = [e['nombre'] for e in response.data['results']]
        self.assertIn('Hemograma Completo', nombres)

    def test_filter_por_categoria(self):
        response = self.client.get('/api/examenes/?categoria=Hematología')
        nombres = [e['nombre'] for e in response.data['results']]
        self.assertIn('Hemograma Completo', nombres)
        self.assertNotIn('Glucosa Basal', nombres)

    def test_page_size_override(self):
        response = self.client.get('/api/examenes/?page_size=1')
        self.assertEqual(len(response.data['results']), 1)

    def test_respuesta_incluye_campos_lista(self):
        response = self.client.get('/api/examenes/')
        item = response.data['results'][0]
        for campo in ['slug', 'nombre', 'codigo', 'categoria', 'precio', 'sintomas']:
            self.assertIn(campo, item)


class ExamenDetailViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.examen = Examen.objects.create(
            codigo='GLU', nombre='Glucosa Basal', slug='glucosa-basal',
            precio=15000, categoria='Metabolismo', activo=True,
            descripcion='Mide el nivel de glucosa en sangre.',
            sintomas=['sed', 'cansancio'],
            requiere_ayuno=True,
            preparacion='Ayunar 8 horas antes.',
        )

    def test_detail_retorna_200(self):
        response = self.client.get('/api/examenes/glucosa-basal/')
        self.assertEqual(response.status_code, 200)

    def test_detail_no_requiere_auth(self):
        response = self.client.get('/api/examenes/glucosa-basal/')
        self.assertNotEqual(response.status_code, 401)

    def test_slug_inexistente_retorna_404(self):
        response = self.client.get('/api/examenes/no-existe/')
        self.assertEqual(response.status_code, 404)

    def test_inactivo_retorna_404(self):
        Examen.objects.create(
            codigo='INA', nombre='Inactivo', slug='examen-inactivo',
            precio=0, categoria='Otras', activo=False,
        )
        response = self.client.get('/api/examenes/examen-inactivo/')
        self.assertEqual(response.status_code, 404)

    def test_detail_incluye_todos_los_campos(self):
        response = self.client.get('/api/examenes/glucosa-basal/')
        data = response.data
        self.assertEqual(data['nombre'], 'Glucosa Basal')
        self.assertEqual(data['codigo'], 'GLU')
        self.assertEqual(data['precio'], 15000)
        self.assertTrue(data['requiere_ayuno'])
        self.assertEqual(data['preparacion'], 'Ayunar 8 horas antes.')
        self.assertIn('sed', data['sintomas'])
        self.assertEqual(data['descripcion'], 'Mide el nivel de glucosa en sangre.')
