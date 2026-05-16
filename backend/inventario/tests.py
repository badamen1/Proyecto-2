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
