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


# ─────────────────────────────────────────────
# Endpoints: Ingreso y Egreso (4–6)
# ─────────────────────────────────────────────

class ProductoIngresoTest(BaseAPITest):

    def test_ingreso_suma_stock(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 10, 'motivo': 'Compra inicial'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 10)

    def test_ingreso_crea_movimiento_tipo_ingreso(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 5, 'motivo': 'Compra'},
            format='json'
        )
        mov = Movimiento.objects.get(producto=self.producto)
        self.assertEqual(mov.tipo, Movimiento.TipoMovimiento.INGRESO)
        self.assertEqual(mov.cantidad, 5)
        self.assertEqual(mov.registrado_por, self.admin)

    def test_ingreso_actualiza_ultimo_costo(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 10, 'motivo': 'Compra', 'ultimo_costo': '25.50'},
            format='json'
        )
        self.producto.refresh_from_db()
        self.assertEqual(str(self.producto.ultimo_costo), '25.50')

    def test_ingreso_actualiza_vencimiento_y_lote(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 10, 'motivo': 'Compra', 'fecha_vencimiento': '2027-12-31', 'numero_lote': 'L-2024'},
            format='json'
        )
        self.producto.refresh_from_db()
        self.assertEqual(str(self.producto.fecha_vencimiento), '2027-12-31')
        self.assertEqual(self.producto.numero_lote, 'L-2024')

    def test_bacteriologo_no_puede_ingresar(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 5, 'motivo': 'Test'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_cantidad_cero_retorna_400(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 0, 'motivo': 'Test'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sin_motivo_retorna_400(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 5, 'motivo': ''},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_respuesta_incluye_ultimo_costo_para_admin(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/ingreso/',
            {'cantidad': 10, 'motivo': 'Compra', 'ultimo_costo': '10.00'},
            format='json'
        )
        self.assertIn('ultimo_costo', r.data)


class ProductoEgresoTest(BaseAPITest):

    def setUp(self):
        super().setUp()
        self.producto.stock_actual = 10
        self.producto.save()

    def test_egreso_resta_stock(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/egreso/',
            {'cantidad': 3, 'motivo': 'Uso en análisis'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 7)

    def test_egreso_stock_insuficiente_retorna_400(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/egreso/',
            {'cantidad': 20, 'motivo': 'Test'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Stock insuficiente', r.data['detail'])

    def test_egreso_crea_movimiento_tipo_egreso(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(
            f'/api/inventario/productos/{self.producto.id}/egreso/',
            {'cantidad': 4, 'motivo': 'Análisis hemograma'},
            format='json'
        )
        mov = Movimiento.objects.get(producto=self.producto)
        self.assertEqual(mov.tipo, Movimiento.TipoMovimiento.EGRESO)
        self.assertEqual(mov.cantidad, 4)

    def test_bacteriologo_puede_egresar(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/egreso/',
            {'cantidad': 2, 'motivo': 'Análisis'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_bacteriologo_egreso_no_ve_ultimo_costo(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/egreso/',
            {'cantidad': 1, 'motivo': 'Test'},
            format='json'
        )
        self.assertNotIn('ultimo_costo', r.data)

    def test_cantidad_cero_retorna_400(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            f'/api/inventario/productos/{self.producto.id}/egreso/',
            {'cantidad': 0, 'motivo': 'Test'},
            format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


class ProductoMovimientosTest(BaseAPITest):

    def setUp(self):
        super().setUp()
        Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.INGRESO,
            cantidad=10, motivo='Setup ingreso',
        )

    def test_admin_ve_historial(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(f'/api/inventario/productos/{self.producto.id}/movimientos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['count'], 1)

    def test_bacteriologo_ve_historial(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get(f'/api/inventario/productos/{self.producto.id}/movimientos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_historial_incluye_producto_nombre(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(f'/api/inventario/productos/{self.producto.id}/movimientos/')
        self.assertIn('producto_nombre', r.data['results'][0])


# ─────────────────────────────────────────────
# Endpoints: Reportes (7–10)
# ─────────────────────────────────────────────

class InventarioAlertasTest(BaseAPITest):

    def test_alerta_stock_bajo(self):
        self.producto.stock_actual = 3  # stock_minimo=5 → stock_bajo
        self.producto.save()
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/alertas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        codigos_bajos = [p['codigo'] for p in r.data['stock_bajo']]
        self.assertIn('API001', codigos_bajos)

    def test_alerta_stock_igual_a_minimo_aparece(self):
        self.producto.stock_actual = 5  # igual al minimo
        self.producto.save()
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/alertas/')
        codigos_bajos = [p['codigo'] for p in r.data['stock_bajo']]
        self.assertIn('API001', codigos_bajos)

    def test_alerta_vencido(self):
        from datetime import date, timedelta
        self.producto.fecha_vencimiento = date.today() - timedelta(days=1)
        self.producto.save()
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/alertas/')
        codigos_vencidos = [p['codigo'] for p in r.data['vencidos']]
        self.assertIn('API001', codigos_vencidos)

    def test_alerta_por_vencer(self):
        from datetime import date, timedelta
        self.producto.fecha_vencimiento = date.today() + timedelta(days=15)
        self.producto.save()
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/alertas/')
        codigos_por_vencer = [p['codigo'] for p in r.data['por_vencer']]
        self.assertIn('API001', codigos_por_vencer)

    def test_bacteriologo_puede_ver_alertas(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get('/api/inventario/alertas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('stock_bajo', r.data)
        self.assertIn('vencidos', r.data)
        self.assertIn('por_vencer', r.data)


class MovimientoListTest(BaseAPITest):

    def setUp(self):
        super().setUp()
        Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.INGRESO,
            cantidad=10, motivo='Compra',
            registrado_por=self.admin,
        )

    def test_admin_puede_listar_movimientos(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/movimientos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['count'], 1)

    def test_bacteriologo_puede_listar_movimientos(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get('/api/inventario/movimientos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_busqueda_por_codigo_producto(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/movimientos/?search=API001')
        self.assertEqual(r.data['count'], 1)
        r2 = self.client.get('/api/inventario/movimientos/?search=NOEXISTE')
        self.assertEqual(r2.data['count'], 0)


class MovimientoExportarTest(BaseAPITest):

    def setUp(self):
        super().setUp()
        Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.INGRESO,
            cantidad=10, motivo='Compra exportar',
            registrado_por=self.admin,
        )

    def test_bacteriologo_no_puede_exportar(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get('/api/inventario/movimientos/exportar/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_exporta_csv(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/movimientos/exportar/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', r['Content-Type'])
        content = r.content.decode('utf-8-sig')
        self.assertIn('API001', content)
        self.assertIn('Compra exportar', content)

    def test_exportar_csv_tiene_encabezados(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/movimientos/exportar/')
        content = r.content.decode('utf-8-sig')
        for col in ['Fecha', 'Código Producto', 'Tipo', 'Cantidad', 'Motivo']:
            self.assertIn(col, content)

    def test_filtro_por_producto_id(self):
        otro = make_producto(codigo='OTRO01', nombre='Otro producto')
        Movimiento.objects.create(producto=otro, tipo=Movimiento.TipoMovimiento.INGRESO, cantidad=5, motivo='Otro')
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(f'/api/inventario/movimientos/exportar/?producto_id={self.producto.id}')
        content = r.content.decode('utf-8-sig')
        self.assertIn('API001', content)
        self.assertNotIn('OTRO01', content)

    def test_filtro_por_fecha_desde(self):
        from datetime import date, timedelta
        # Create a movement (all movements are created today in setUp)
        Movimiento.objects.create(
            producto=self.producto,
            tipo=Movimiento.TipoMovimiento.EGRESO,
            cantidad=1,
            motivo='viejo',
            registrado_por=self.admin,
        )
        today = date.today().isoformat()
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            '/api/inventario/movimientos/exportar/',
            {'fecha_desde': today, 'fecha_hasta': today},
        )
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8-sig')
        # At least header row present
        self.assertIn('Fecha', content)

    def test_fecha_desde_invalida_retorna_400(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            '/api/inventario/movimientos/exportar/',
            {'fecha_desde': 'no-es-fecha'},
        )
        self.assertEqual(response.status_code, 400)

    def test_producto_id_invalido_retorna_400(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            '/api/inventario/movimientos/exportar/',
            {'producto_id': 'abc'},
        )
        self.assertEqual(response.status_code, 400)

    def test_exportar_csv_fila_tiene_fecha_formato_correcto(self):
        import re
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            '/api/inventario/movimientos/exportar/',
        )
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8-sig')
        lines = content.strip().split('\n')
        # At least one data row beyond header
        self.assertGreater(len(lines), 1)
        # Data row date matches YYYY-MM-DD HH:MM format
        self.assertRegex(lines[1], r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}')


class InventarioResumenTest(BaseAPITest):

    def test_bacteriologo_no_puede_ver_resumen(self):
        self.client.force_authenticate(user=self.bacteriologo)
        r = self.client.get('/api/inventario/resumen/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_resumen_contiene_campos_requeridos(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/resumen/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        for campo in ['total_productos', 'stock_bajo', 'sin_stock', 'vencidos', 'ultimos_movimientos']:
            self.assertIn(campo, r.data)

    def test_resumen_sin_stock_cuenta_correctamente(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/resumen/')
        self.assertGreaterEqual(r.data['sin_stock'], 1)

    def test_resumen_ultimos_movimientos_max_5(self):
        for i in range(7):
            Movimiento.objects.create(
                producto=self.producto,
                tipo=Movimiento.TipoMovimiento.INGRESO,
                cantidad=1, motivo=f'Movimiento {i}',
            )
        self.client.force_authenticate(user=self.admin)
        r = self.client.get('/api/inventario/resumen/')
        self.assertLessEqual(len(r.data['ultimos_movimientos']), 5)
