from datetime import date
from django.test import TestCase
from django.db import IntegrityError
from rest_framework import status
from rest_framework.test import APIClient

from users.models import User
from inventario.models import Producto, Movimiento


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def make_producto(**kwargs):
    defaults = {
        'codigo': 'R001',
        'nombre': 'Reactivo A',
        'categoria': Producto.Categoria.REACTIVO,
        'unidad_medida': Producto.UnidadMedida.ML,
    }
    defaults.update(kwargs)
    return Producto.objects.create(**defaults)


def make_admin(username='admin_test'):
    return User.objects.create_user(
        username=username, password='pass123', role='admin'
    )


def make_bacteriologo(username='bact_test'):
    return User.objects.create_user(
        username=username, password='pass123', role='bacteriologo'
    )


# ─────────────────────────────────────────────
# Modelo: Producto
# ─────────────────────────────────────────────

class ProductoModelTest(TestCase):

    def test_stock_inicial_cero(self):
        p = make_producto()
        self.assertEqual(p.stock_actual, 0)

    def test_stock_minimo_default_cinco(self):
        p = make_producto()
        self.assertEqual(p.stock_minimo, 5)

    def test_activo_default_true(self):
        p = make_producto()
        self.assertTrue(p.activo)

    def test_codigo_unico(self):
        make_producto(codigo='DUP01')
        with self.assertRaises(IntegrityError):
            make_producto(codigo='DUP01', nombre='Duplicado')

    def test_str_incluye_codigo_y_nombre(self):
        p = make_producto(codigo='RX99', nombre='Tiras reactivas')
        self.assertIn('RX99', str(p))
        self.assertIn('Tiras reactivas', str(p))


# ─────────────────────────────────────────────
# Modelo: Movimiento
# ─────────────────────────────────────────────

class MovimientoModelTest(TestCase):

    def setUp(self):
        self.admin = make_admin()
        self.producto = make_producto()

    def test_crear_movimiento_ingreso(self):
        mov = Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.INGRESO,
            cantidad=10,
            motivo='Compra inicial',
            registrado_por=self.admin,
        )
        self.assertEqual(mov.tipo, 'INGRESO')
        self.assertEqual(mov.cantidad, 10)
        self.assertIsNotNone(mov.fecha_registro)

    def test_str_movimiento(self):
        mov = Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.EGRESO,
            cantidad=3,
            motivo='Uso en análisis',
        )
        self.assertIn('EGRESO', str(mov))
        self.assertIn(self.producto.codigo, str(mov))


# ─────────────────────────────────────────────
# Serializers
# ─────────────────────────────────────────────

from inventario.serializers import (
    ProductoListSerializer,
    ProductoSerializer,
    ProductoBacteriologoSerializer,
    MovimientoSerializer,
    MovimientoListSerializer,
)


class ProductoSerializerTest(TestCase):

    def setUp(self):
        self.producto = make_producto(
            codigo='SER01', nombre='Reactivo Serializer',
            ultimo_costo='25.50',
        )

    def test_list_serializer_excluye_ultimo_costo(self):
        data = ProductoListSerializer(self.producto).data
        self.assertNotIn('ultimo_costo', data)

    def test_list_serializer_incluye_campos_basicos(self):
        data = ProductoListSerializer(self.producto).data
        for campo in ['id', 'codigo', 'nombre', 'categoria', 'stock_actual', 'stock_minimo', 'activo']:
            self.assertIn(campo, data)

    def test_serializer_admin_incluye_ultimo_costo(self):
        data = ProductoSerializer(self.producto).data
        self.assertIn('ultimo_costo', data)
        self.assertEqual(str(data['ultimo_costo']), '25.50')

    def test_serializer_bacteriologo_excluye_ultimo_costo(self):
        data = ProductoBacteriologoSerializer(self.producto).data
        self.assertNotIn('ultimo_costo', data)

    def test_stock_actual_es_readonly(self):
        serializer = ProductoSerializer(self.producto, data={'stock_actual': 999}, partial=True)
        serializer.is_valid()
        # stock_actual no debe aparecer en validated_data al ser read_only
        self.assertNotIn('stock_actual', serializer.validated_data)


class MovimientoSerializerTest(TestCase):

    def setUp(self):
        self.admin = make_admin(username='ser_admin')
        self.producto = make_producto(codigo='MOV01')
        self.movimiento = Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.INGRESO,
            cantidad=5,
            motivo='Test serializer',
            registrado_por=self.admin,
        )

    def test_movimiento_serializer_incluye_producto_nombre(self):
        data = MovimientoSerializer(self.movimiento).data
        self.assertIn('producto_nombre', data)
        self.assertEqual(data['producto_nombre'], self.producto.nombre)

    def test_movimiento_list_serializer_incluye_codigo(self):
        data = MovimientoListSerializer(self.movimiento).data
        self.assertIn('producto_codigo', data)
        self.assertEqual(data['producto_codigo'], self.producto.codigo)


# ─────────────────────────────────────────────
# Endpoints CRUD: Productos (1–3)
# ─────────────────────────────────────────────

class BaseAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = make_admin(username='api_admin')
        self.bacteriologo = make_bacteriologo(username='api_bact')
        self.producto = make_producto(codigo='API001', nombre='Reactivo API')


class ProductoListCreateTest(BaseAPITest):

    def test_no_autenticado_retorna_401(self):
        r = self.client.get('/api/inventario/productos/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_puede_listar(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/productos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('results', r.data)

    def test_bacteriologo_puede_listar(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get('/api/inventario/productos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_lista_excluye_ultimo_costo(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get('/api/inventario/productos/')
        self.assertNotIn('ultimo_costo', r.data['results'][0])

    def test_admin_puede_crear_producto(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post('/api/inventario/productos/', {
            'codigo': 'NUEVO01', 'nombre': 'Nuevo Reactivo',
            'categoria': 'REACTIVO', 'unidad_medida': 'ML',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Producto.objects.get(codigo='NUEVO01').stock_actual, 0)

    def test_bacteriologo_no_puede_crear(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.post('/api/inventario/productos/', {
            'codigo': 'BACT01', 'nombre': 'Test',
            'categoria': 'REACTIVO', 'unidad_medida': 'ML',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_crear_codigo_duplicado_retorna_400(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post('/api/inventario/productos/', {
            'codigo': 'API001', 'nombre': 'Duplicado',
            'categoria': 'REACTIVO', 'unidad_medida': 'ML',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


class ProductoDetailTest(BaseAPITest):

    def test_admin_ve_ultimo_costo_en_detalle(self):
        self.producto.ultimo_costo = '15.50'
        self.producto.save()
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(f'/api/inventario/productos/{self.producto.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('ultimo_costo', r.data)

    def test_bacteriologo_no_ve_ultimo_costo_en_detalle(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get(f'/api/inventario/productos/{self.producto.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertNotIn('ultimo_costo', r.data)

    def test_admin_puede_actualizar(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.patch(
            f'/api/inventario/productos/{self.producto.id}/',
            {'nombre': 'Nombre Actualizado'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.nombre, 'Nombre Actualizado')

    def test_bacteriologo_no_puede_actualizar(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.patch(
            f'/api/inventario/productos/{self.producto.id}/',
            {'nombre': 'Intento'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_stock_actual_ignorado_en_patch(self):
        self.client.force_authenticate(user=self.admin)
        self.client.patch(
            f'/api/inventario/productos/{self.producto.id}/',
            {'stock_actual': 999},
            format='json'
        )
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 0)


class ProductoToggleTest(BaseAPITest):

    def test_toggle_cambia_estado(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.patch(f'/api/inventario/productos/{self.producto.id}/toggle/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.producto.refresh_from_db()
        self.assertFalse(self.producto.activo)

    def test_toggle_doble_restaura_estado(self):
        self.client.force_authenticate(user=self.admin)
        self.client.patch(f'/api/inventario/productos/{self.producto.id}/toggle/')
        self.client.patch(f'/api/inventario/productos/{self.producto.id}/toggle/')
        self.producto.refresh_from_db()
        self.assertTrue(self.producto.activo)

    def test_bacteriologo_no_puede_toggle(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.patch(f'/api/inventario/productos/{self.producto.id}/toggle/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
