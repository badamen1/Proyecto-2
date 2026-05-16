# Vista del Bacteriólogo — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer la vista del bacteriólogo 100% funcional: panel de trabajo, ingresar resultados externos con lake por documento, validar exámenes, y buscar pacientes.

**Architecture:** Layout anidado de Next.js en `/dashboard/bacteriologo/` con sidebar compartido. Backend extiende `Resultado` con campo `paciente_documento` para almacenar resultados de pacientes no registrados; cuando el paciente se registra la query lo encuentra por documento automáticamente (patrón idéntico a FASIL).

**Tech Stack:** Django REST Framework (backend), Next.js 15 App Router con `'use client'` (frontend), `apiFetch`/`apiFetchBlob` de `@/lib/api`, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-16-bacteriologo-vista-design.md`

---

## Mapa de archivos

### Backend — modificar
- `backend/resultados/models.py` — agregar `paciente_documento` + fix `__str__`
- `backend/resultados/migrations/0004_resultado_paciente_documento.py` — migración auto-generada
- `backend/resultados/serializers.py` — exponer `paciente_documento` en ambos serializers; `fecha_examen` opcional
- `backend/resultados/views.py` — query lake en `_list_paciente`
- `backend/resultados/tests.py` — tests de lake + POST sin paciente FK

### Frontend — crear
- `frontend/features/bacteriologo/components/BacteriologoSidebar.tsx`
- `frontend/app/dashboard/bacteriologo/layout.tsx`
- `frontend/app/dashboard/bacteriologo/page.tsx`
- `frontend/app/dashboard/bacteriologo/ingresar/page.tsx`
- `frontend/app/dashboard/bacteriologo/validar/page.tsx`
- `frontend/app/dashboard/bacteriologo/buscar/page.tsx`

### Frontend — modificar
- `frontend/app/dashboard/page.tsx` — links del bacteriólogo a rutas reales

---

## Task 1: Campo `paciente_documento` en el modelo `Resultado`

**Files:**
- Modify: `backend/resultados/models.py`
- Modify: `backend/resultados/migrations/` (auto-generado)
- Modify: `backend/resultados/tests.py`

- [ ] **Step 1: Escribir el test fallido**

Agregar al final de `backend/resultados/tests.py`:

```python
class ResultadoLakeModelTests(TestCase):
    """Resultado puede existir con solo paciente_documento (sin FK a Paciente ni User)."""

    def test_resultado_acepta_solo_paciente_documento(self):
        r = Resultado(
            paciente_documento='99900011',
            tipo_examen='Perfil Lipídico',
            fuente='EXTERNO',
            estado='PENDIENTE',
            fecha_examen=datetime.date.today(),
        )
        self.assertEqual(r.paciente_documento, '99900011')
        self.assertIsNone(r.paciente)
        self.assertIsNone(r.paciente_user)

    def test_str_resultado_sin_paciente_usa_documento(self):
        r = Resultado(
            paciente_documento='99900011',
            tipo_examen='Hemograma',
            fuente='EXTERNO',
            estado='PENDIENTE',
            fecha_examen=datetime.date.today(),
        )
        self.assertIn('Hemograma', str(r))
```

- [ ] **Step 2: Ejecutar el test para confirmar que falla**

```bash
cd backend && python manage.py test resultados.tests.ResultadoLakeModelTests -v 2
```

Resultado esperado: `ERROR` — `AttributeError: type object 'Resultado' has no attribute 'paciente_documento'`

- [ ] **Step 3: Agregar el campo al modelo**

En `backend/resultados/models.py`, después del campo `id_orden_fasil` (línea ~203), agregar:

```python
    paciente_documento = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        db_index=True,
        verbose_name='Documento del paciente (lake)',
        help_text='Documento cuando no existe Paciente en BD. Query por documento al registrarse.'
    )
```

También corregir el método `__str__` (línea ~216) para que no explote cuando `paciente` es null:

```python
    def __str__(self):
        nombre = (
            self.paciente.nombre_completo if self.paciente
            else self.paciente_documento or 'Sin paciente'
        )
        return f"{self.tipo_examen} - {nombre} ({self.fecha_examen})"
```

- [ ] **Step 4: Generar la migración**

```bash
cd backend && python manage.py makemigrations resultados --name add_paciente_documento_to_resultado
```

Resultado esperado: `Migrations for 'resultados': resultados/migrations/0004_resultado_paciente_documento.py`

- [ ] **Step 5: Aplicar la migración**

```bash
cd backend && python manage.py migrate
```

Resultado esperado: `Applying resultados.0004_resultado_paciente_documento... OK`

- [ ] **Step 6: Ejecutar el test para confirmar que pasa**

```bash
cd backend && python manage.py test resultados.tests.ResultadoLakeModelTests -v 2
```

Resultado esperado: `OK` — 2 tests passed

- [ ] **Step 7: Commit**

```bash
git add backend/resultados/models.py backend/resultados/migrations/0004_resultado_paciente_documento.py backend/resultados/tests.py
git commit -m "feat(resultados): agregar campo paciente_documento al modelo Resultado (lake)"
```

---

## Task 2: Serializers — exponer `paciente_documento`

**Files:**
- Modify: `backend/resultados/serializers.py`
- Modify: `backend/resultados/tests.py`

- [ ] **Step 1: Escribir test fallido**

Agregar al final de `backend/resultados/tests.py`:

```python
class ResultadoLakeAPITests(APITestCase):
    """POST /api/resultados/ acepta paciente_documento sin FK a Paciente."""

    def setUp(self):
        self.bacteriologo = User.objects.create(
            username='bact_test_01',
            documento='11100011',
            role=User.Role.BACTERIOLOGO,
        )
        self.bacteriologo.set_unusable_password()
        self.bacteriologo.save()
        self.client.force_authenticate(user=self.bacteriologo)

    def test_bacteriologo_crea_resultado_con_solo_documento(self):
        import io
        pdf = io.BytesIO(b'%PDF-1.4 fake pdf content')
        pdf.name = 'resultado_test.pdf'
        response = self.client.post('/api/resultados/', {
            'paciente_documento': '99900011',
            'tipo_examen': 'Perfil Lipídico',
            'fuente': 'EXTERNO',
            'fecha_examen': '2026-05-16',
            'archivo_pdf': pdf,
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['paciente_documento'], '99900011')
        self.assertIsNone(response.data['paciente'])

    def test_paciente_documento_aparece_en_listado_bacteriologo(self):
        """ResultadoListSerializer incluye paciente_documento."""
        Resultado.objects.create(
            paciente_documento='88800022',
            tipo_examen='Glucosa',
            fuente='EXTERNO',
            estado='PENDIENTE',
            fecha_examen=datetime.date.today(),
            subido_por=self.bacteriologo,
        )
        response = self.client.get('/api/resultados/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        documentos = [r.get('paciente_documento') for r in response.data['results']]
        self.assertIn('88800022', documentos)
```

- [ ] **Step 2: Ejecutar el test para confirmar que falla**

```bash
cd backend && python manage.py test resultados.tests.ResultadoLakeAPITests -v 2
```

Resultado esperado: `FAIL` — `paciente_documento` no aparece en la respuesta (campo no en el serializer)

- [ ] **Step 3: Actualizar `ResultadoSerializer`**

En `backend/resultados/serializers.py`, en la clase `ResultadoSerializer`, agregar `paciente_documento` a `fields` (después de `'id_orden_fasil'`) y hacer `fecha_examen` opcional:

```python
import datetime  # agregar al inicio del archivo si no existe

class ResultadoSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.SerializerMethodField()
    paciente_documento_display = serializers.SerializerMethodField()  # ya existía como get_paciente_documento
    subido_por_nombre = serializers.CharField(source='subido_por.username', read_only=True)
    nombre_archivo = serializers.ReadOnlyField()
    empresa_nombre = serializers.CharField(source='empresa.nombre', read_only=True, default=None)
    fecha_examen = serializers.DateField(required=False, default=datetime.date.today)

    class Meta:
        model = Resultado
        fields = [
            'id',
            'paciente',
            'paciente_nombre',
            'paciente_documento',        # ← NUEVO: campo lake (writable)
            'empresa',
            'empresa_nombre',
            'subido_por',
            'subido_por_nombre',
            'tipo_examen',
            'fuente',
            'estado',
            'archivo_pdf',
            'tipo_archivo',
            'nombre_archivo',
            'fecha_examen',
            'fecha_carga',
            'fecha_actualizacion',
            'observaciones',
            'id_orden_fasil',
        ]
        read_only_fields = [
            'id',
            'subido_por',
            'subido_por_nombre',
            'fecha_carga',
            'fecha_actualizacion',
            'nombre_archivo',
            'empresa_nombre',
        ]
```

Nota: el método `get_paciente_documento` ya existe pero mapea la FK; `paciente_documento` (el nuevo campo del lake) es diferente — es el CharField directo. Renombrar el método existente `get_paciente_documento` a `get_paciente_documento_display` para evitar conflicto, y actualizar `paciente_documento_display` en fields:

El bloque completo de `ResultadoSerializer` queda:

```python
class ResultadoSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.SerializerMethodField()
    paciente_documento_display = serializers.SerializerMethodField()
    subido_por_nombre = serializers.CharField(source='subido_por.username', read_only=True)
    nombre_archivo = serializers.ReadOnlyField()
    empresa_nombre = serializers.CharField(source='empresa.nombre', read_only=True, default=None)
    fecha_examen = serializers.DateField(required=False, default=datetime.date.today)

    class Meta:
        model = Resultado
        fields = [
            'id',
            'paciente',
            'paciente_nombre',
            'paciente_documento_display',
            'paciente_documento',
            'empresa',
            'empresa_nombre',
            'subido_por',
            'subido_por_nombre',
            'tipo_examen',
            'fuente',
            'estado',
            'archivo_pdf',
            'tipo_archivo',
            'nombre_archivo',
            'fecha_examen',
            'fecha_carga',
            'fecha_actualizacion',
            'observaciones',
            'id_orden_fasil',
        ]
        read_only_fields = [
            'id',
            'subido_por',
            'subido_por_nombre',
            'fecha_carga',
            'fecha_actualizacion',
            'nombre_archivo',
            'empresa_nombre',
        ]

    def get_paciente_nombre(self, obj):
        if obj.paciente_user_id:
            return obj.paciente_user.nombre_completo
        if obj.paciente_id:
            return obj.paciente.nombre_completo
        return ''

    def get_paciente_documento_display(self, obj):
        if obj.paciente_user_id:
            return obj.paciente_user.documento
        if obj.paciente_id:
            return obj.paciente.documento
        return ''

    def validate_archivo_pdf(self, value):
        if not value.name.lower().endswith('.pdf'):
            raise serializers.ValidationError("Solo se permiten archivos PDF.")
        max_size = 100 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError(
                f"El archivo excede el tamaño máximo de 100MB. Tamaño actual: {value.size / (1024*1024):.1f}MB"
            )
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['subido_por'] = request.user
        return super().create(validated_data)
```

- [ ] **Step 4: Actualizar `ResultadoListSerializer`**

Agregar `paciente_documento` a fields de `ResultadoListSerializer`:

```python
class ResultadoListSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.SerializerMethodField()
    paciente_documento_display = serializers.SerializerMethodField()
    empresa_nombre = serializers.CharField(source='empresa.nombre', read_only=True, default=None)
    nombre_archivo = serializers.ReadOnlyField()

    class Meta:
        model = Resultado
        fields = [
            'id',
            'paciente_nombre',
            'paciente_documento_display',
            'paciente_documento',        # ← NUEVO
            'empresa_nombre',
            'tipo_examen',
            'fuente',
            'estado',
            'fecha_examen',
            'fecha_carga',
            'nombre_archivo',
        ]

    def get_paciente_nombre(self, obj):
        if obj.paciente_user_id:
            return obj.paciente_user.nombre_completo
        if obj.paciente_id:
            return obj.paciente.nombre_completo
        return ''

    def get_paciente_documento_display(self, obj):
        if obj.paciente_user_id:
            return obj.paciente_user.documento
        if obj.paciente_id:
            return obj.paciente.documento
        return ''
```

- [ ] **Step 5: Ejecutar los tests para confirmar que pasan**

```bash
cd backend && python manage.py test resultados.tests.ResultadoLakeAPITests -v 2
```

Resultado esperado: `OK` — 2 tests passed

- [ ] **Step 6: Ejecutar todos los tests de resultados para verificar no hay regresiones**

```bash
cd backend && python manage.py test resultados -v 2
```

Resultado esperado: todos pasan.

- [ ] **Step 7: Commit**

```bash
git add backend/resultados/serializers.py backend/resultados/tests.py
git commit -m "feat(serializers): exponer paciente_documento en Resultado + fecha_examen opcional"
```

---

## Task 3: Query lake — paciente ve resultados por documento

**Files:**
- Modify: `backend/resultados/views.py`
- Modify: `backend/resultados/tests.py`

- [ ] **Step 1: Escribir test fallido**

Agregar al final de `backend/resultados/tests.py`:

```python
class ResultadoLakeQueryTests(APITestCase):
    """Paciente ve resultados del lake al registrarse con el mismo documento."""

    def setUp(self):
        self.bacteriologo = User.objects.create(
            username='bact_lake_01',
            documento='22200011',
            role=User.Role.BACTERIOLOGO,
        )
        self.bacteriologo.set_unusable_password()
        self.bacteriologo.save()

        # Resultado subido con solo documento (paciente no registrado)
        self.resultado_lake = Resultado.objects.create(
            paciente_documento='77700099',
            tipo_examen='Perfil Lipídico',
            fuente='EXTERNO',
            estado='VALIDADO',
            fecha_examen=datetime.date.today(),
            subido_por=self.bacteriologo,
        )

    @patch('resultados.views.fasil_service.get_paciente')
    def test_paciente_registrado_ve_resultado_del_lake(self, mock_fasil):
        from resultados.services.fasil_service import FasilPacienteNoEncontrado
        mock_fasil.side_effect = FasilPacienteNoEncontrado('no')

        paciente = User.objects.create(
            username='77700099',
            documento='77700099',
            nombre_completo='María López',
            role=User.Role.PACIENTE,
        )
        paciente.set_unusable_password()
        paciente.save()

        self.client.force_authenticate(user=paciente)
        response = self.client.get('/api/resultados/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [str(r['id']) for r in response.data['results']]
        self.assertIn(str(self.resultado_lake.pk), ids)

    @patch('resultados.views.fasil_service.get_paciente')
    def test_otro_paciente_no_ve_resultado_del_lake(self, mock_fasil):
        from resultados.services.fasil_service import FasilPacienteNoEncontrado
        mock_fasil.side_effect = FasilPacienteNoEncontrado('no')

        otro = User.objects.create(
            username='88800099',
            documento='88800099',
            role=User.Role.PACIENTE,
        )
        otro.set_unusable_password()
        otro.save()

        self.client.force_authenticate(user=otro)
        response = self.client.get('/api/resultados/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [str(r['id']) for r in response.data['results']]
        self.assertNotIn(str(self.resultado_lake.pk), ids)
```

- [ ] **Step 2: Ejecutar el test para confirmar que falla**

```bash
cd backend && python manage.py test resultados.tests.ResultadoLakeQueryTests -v 2
```

Resultado esperado: `FAIL` — el paciente registrado no ve el resultado del lake (query actual no incluye `paciente_documento`)

- [ ] **Step 3: Actualizar `_list_paciente` en `views.py`**

En `backend/resultados/views.py`, al inicio del archivo agregar:

```python
from django.db.models import Q
```

Luego, reemplazar el método `_list_paciente` (líneas ~242-288). Específicamente el bloque de BD items:

```python
    def _list_paciente(self, request):
        from .serializers import ResultadoUnificadoSerializer

        # 1. Resultados de BD — por paciente_user FK o por paciente_documento (lake)
        user = request.user
        documento = getattr(user, 'documento', None)

        bd_qs = Resultado.objects.filter(
            Q(paciente_user=user) | Q(paciente_documento=documento),
            estado__in=['VALIDADO', 'ENTREGADO']
        ) if documento else Resultado.objects.filter(
            paciente_user=user,
            estado__in=['VALIDADO', 'ENTREGADO']
        )

        bd_items = [_resultado_a_dict(r) for r in bd_qs]

        # 2. Órdenes FASIL — secuencial, con degradación elegante
        fasil_items = []
        if documento:
            try:
                paciente_fasil = fasil_service.get_paciente(documento)
                ordenes = fasil_service.get_ordenes(paciente_fasil.id_fasil)
                fasil_items = [_orden_fasil_a_dict(o) for o in ordenes]
            except FasilPacienteNoEncontrado:
                logger.info(
                    "FASIL: paciente no encontrado | documento=%s", documento
                )
            except FasilConexionError:
                logger.error(
                    "FASIL: error de conexión al listar resultados | documento=%s", documento
                )

        # 3. Combinar y ordenar por fecha_examen descendente
        todos = bd_items + fasil_items
        todos.sort(key=lambda x: x['fecha_examen'], reverse=True)

        # 4. Paginación manual compatible con DRF
        page_size = int(request.query_params.get('page_size', 20))
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        pagina = todos[start:end]

        next_url = None
        if end < len(todos):
            next_url = request.build_absolute_uri(
                f'?page={page + 1}&page_size={page_size}'
            )

        serializer = ResultadoUnificadoSerializer(pagina, many=True)
        return Response({
            'count': len(todos),
            'next': next_url,
            'previous': None,
            'results': serializer.data,
        })
```

También, eliminar el `get_queryset` que usa solo `paciente_user` para la vista del paciente. El método `get_queryset` actual filtra `paciente_user=user` — esto ya no aplica para `_list_paciente` porque hace su propia query. El `get_queryset` original se mantiene igual para admin/bacteriólogo.

- [ ] **Step 4: Ejecutar el test para confirmar que pasa**

```bash
cd backend && python manage.py test resultados.tests.ResultadoLakeQueryTests -v 2
```

Resultado esperado: `OK` — 2 tests passed

- [ ] **Step 5: Ejecutar todos los tests de resultados**

```bash
cd backend && python manage.py test resultados -v 2
```

Resultado esperado: todos pasan.

- [ ] **Step 6: Commit**

```bash
git add backend/resultados/views.py backend/resultados/tests.py
git commit -m "feat(views): query lake — paciente ve resultados por documento al registrarse"
```

---

## Task 4: Sidebar y Layout del bacteriólogo

**Files:**
- Create: `frontend/features/bacteriologo/components/BacteriologoSidebar.tsx`
- Create: `frontend/app/dashboard/bacteriologo/layout.tsx`

- [ ] **Step 1: Crear directorio y sidebar**

Crear `frontend/features/bacteriologo/components/BacteriologoSidebar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard/bacteriologo', label: 'Panel de Trabajo', icon: 'fa-chart-line', exact: true },
  { href: '/dashboard/bacteriologo/ingresar', label: 'Ingresar Resultado', icon: 'fa-vials', exact: false },
  { href: '/dashboard/bacteriologo/validar', label: 'Validar Exámenes', icon: 'fa-check-double', exact: false },
  { href: '/dashboard/bacteriologo/buscar', label: 'Buscar Paciente', icon: 'fa-search', exact: false },
];

export function BacteriologoSidebar() {
  const pathname = usePathname();

  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', alignSelf: 'start' }}>
      <h3 style={{ fontSize: '1rem', color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>
        Menú Bacteriólogo
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {links.map(({ href, label, icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 15px',
                  color: isActive ? '#fff' : '#555',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: '500' as const,
                  background: isActive ? 'var(--primary-blue)' : 'transparent',
                  boxShadow: isActive ? '0 4px 6px rgba(45, 83, 162, 0.2)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <i className={`fas ${icon}`} style={{ width: '25px' }} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Crear el layout del bacteriólogo**

Crear `frontend/app/dashboard/bacteriologo/layout.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BacteriologoSidebar } from '@/features/bacteriologo/components/BacteriologoSidebar';

export default function BacteriologoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = window.localStorage.getItem('access_token');
    const role = window.localStorage.getItem('user_role');
    if (!token) {
      router.push('/login');
      return;
    }
    if (role !== 'bacteriologo') {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogout = () => {
    window.localStorage.removeItem('access_token');
    window.localStorage.removeItem('refresh_token');
    window.localStorage.removeItem('user_role');
    router.push('/');
  };

  return (
    <section className="section" style={{ background: '#f4f6f9', minHeight: '90vh' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-blue)', margin: 0 }}>Portal Bacteriólogo — BIOANALISIS</h1>
            <p style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.9rem' }}>Rol Activo: Bacteriólogo</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link href="/dashboard" style={{ padding: '8px 15px', color: 'var(--primary-blue)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>
              ← Dashboard
            </Link>
            <button
              onClick={handleLogout}
              style={{ padding: '8px 15px', background: '#f1f1f1', color: '#555', border: 'none', borderRadius: '20px', fontSize: '0.9rem', cursor: 'pointer' }}
            >
              <i className="fas fa-sign-out-alt" /> Salir
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
          <BacteriologoSidebar />
          <div>{children}</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verificar que el proyecto compila sin errores de TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sin errores relacionados a los nuevos archivos.

- [ ] **Step 4: Commit**

```bash
git add frontend/features/bacteriologo/ frontend/app/dashboard/bacteriologo/layout.tsx
git commit -m "feat(bacteriologo): sidebar y layout con guard de rol"
```

---

## Task 5: Panel de Trabajo

**Files:**
- Create: `frontend/app/dashboard/bacteriologo/page.tsx`

- [ ] **Step 1: Crear la página del Panel de Trabajo**

Crear `frontend/app/dashboard/bacteriologo/page.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { PaginatedResponse, ResultadoLista, ResultadoEstado } from '@/lib/types';

const badgeColors: Record<ResultadoEstado, { bg: string; color: string }> = {
  PENDIENTE: { bg: '#fff3cd', color: '#856404' },
  VALIDADO: { bg: '#d4edda', color: '#155724' },
  ENTREGADO: { bg: '#cce5ff', color: '#004085' },
};

type EstadoFiltro = ResultadoEstado | 'TODOS';

export default function PanelTrabajoPage() {
  const [resultados, setResultados] = useState<ResultadoLista[]>([]);
  const [count, setCount] = useState(0);
  const [filtro, setFiltro] = useState<EstadoFiltro>('TODOS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validandoId, setValidandoId] = useState<string | null>(null);

  const cargar = useCallback(async (estado: EstadoFiltro) => {
    setLoading(true);
    setError(null);
    try {
      const qs = estado === 'TODOS' ? '' : `?estado=${estado}`;
      const data = await apiFetch<PaginatedResponse<ResultadoLista>>(`/api/resultados/${qs}`);
      setResultados(data.results);
      setCount(data.count);
    } catch (err) {
      setError((err as Error).message || 'Error al cargar resultados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void cargar(filtro); }, [filtro, cargar]);

  const validar = async (id: string) => {
    setValidandoId(id);
    try {
      await apiFetch(`/api/resultados/${id}/estado/`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'VALIDADO' }),
      });
      setResultados((prev) =>
        prev.map((r) => r.id === id ? { ...r, estado: 'VALIDADO' as ResultadoEstado } : r)
      );
    } catch (err) {
      alert('Error al validar: ' + (err as Error).message);
    } finally {
      setValidandoId(null);
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        <h2 style={{ color: 'var(--primary-blue)', margin: 0 }}>Panel de Trabajo</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>Estado:</label>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as EstadoFiltro)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.9rem' }}
          >
            <option value="TODOS">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="VALIDADO">Validado</option>
            <option value="ENTREGADO">Entregado</option>
          </select>
          <span style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>
            {count} resultado{count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}{' '}
          <button onClick={() => cargar(filtro)} style={{ marginLeft: '10px', padding: '4px 10px', border: '1px solid #721c24', background: 'transparent', color: '#721c24', borderRadius: '4px', cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem' }}>Cargando...</p>
      ) : resultados.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem' }}>No hay resultados para mostrar.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '12px' }}>Paciente</th>
              <th style={{ padding: '12px' }}>Examen</th>
              <th style={{ padding: '12px' }}>Fecha</th>
              <th style={{ padding: '12px' }}>Fuente</th>
              <th style={{ padding: '12px' }}>Estado</th>
              <th style={{ padding: '12px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => {
              const colors = badgeColors[r.estado];
              const pacienteLabel = r.paciente_nombre || r.paciente_documento || '—';
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>{pacienteLabel}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.tipo_examen}</td>
                  <td style={{ padding: '12px' }}>{new Date(r.fecha_examen).toLocaleDateString('es-CO')}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: '12px', background: '#e9ecef', color: '#495057' }}>
                      {r.fuente}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ background: colors.bg, color: colors.color, padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {r.estado}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {r.estado === 'PENDIENTE' && (
                      <button
                        onClick={() => validar(r.id)}
                        disabled={validandoId === r.id}
                        style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        {validandoId === r.id ? 'Validando...' : 'Validar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sin errores en el nuevo archivo.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/bacteriologo/page.tsx
git commit -m "feat(bacteriologo): panel de trabajo con todos los resultados y filtro de estado"
```

---

## Task 6: Ingresar Resultado

**Files:**
- Create: `frontend/app/dashboard/bacteriologo/ingresar/page.tsx`

- [ ] **Step 1: Crear la página de ingreso de resultado**

Crear `frontend/app/dashboard/bacteriologo/ingresar/page.tsx`:

```tsx
'use client';

import { useState, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function IngresarResultadoPage() {
  const [documento, setDocumento] = useState('');
  const [tipoExamen, setTipoExamen] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivo) return;
    setLoading(true);
    setError(null);

    const token = window.localStorage.getItem('access_token') ?? '';
    const hoy = new Date().toISOString().split('T')[0];

    const formData = new FormData();
    formData.append('paciente_documento', documento.trim());
    formData.append('tipo_examen', tipoExamen.trim());
    formData.append('archivo_pdf', archivo);
    formData.append('fuente', 'EXTERNO');
    formData.append('fecha_examen', hoy);

    try {
      const res = await fetch(`${API_BASE}/api/resultados/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || res.statusText);
      }
      setExito(true);
    } catch (err) {
      setError((err as Error).message || 'Error al subir el resultado');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDocumento('');
    setTipoExamen('');
    setArchivo(null);
    setExito(false);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  if (exito) {
    return (
      <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', color: '#28a745', marginBottom: '1rem' }}>
          <i className="fas fa-check-circle" />
        </div>
        <h2 style={{ color: '#333', marginBottom: '0.5rem' }}>Resultado ingresado exitosamente</h2>
        <p style={{ color: 'var(--text-gray)', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
          El resultado queda pendiente de validación. El paciente lo verá en su portal una vez que lo valides.
        </p>
        <button
          onClick={resetForm}
          style={{ background: 'var(--primary-blue)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '25px', cursor: 'pointer', fontSize: '1rem' }}
        >
          Ingresar otro resultado
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <h2 style={{ color: 'var(--primary-blue)', marginBottom: '0.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        Ingresar Resultado Externo
      </h2>
      <p style={{ color: 'var(--text-gray)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Si el paciente aún no está registrado en el sistema, el resultado aparecerá en su portal automáticamente cuando se registre con el mismo número de documento.
      </p>

      {error && (
        <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '480px' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>
            N° Documento del Paciente
          </label>
          <input
            type="text"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            placeholder="Ej: 1023456789"
            required
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' as const }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>
            Nombre del Examen
          </label>
          <input
            type="text"
            value={tipoExamen}
            onChange={(e) => setTipoExamen(e.target.value)}
            placeholder="Ej: Perfil Lipídico"
            required
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' as const }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>
            PDF del Resultado
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            required
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' as const }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !documento || !tipoExamen || !archivo}
          style={{
            background: 'var(--primary-blue)',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '25px',
            cursor: (loading || !documento || !tipoExamen || !archivo) ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            opacity: (loading || !documento || !tipoExamen || !archivo) ? 0.7 : 1,
            alignSelf: 'flex-start',
          }}
        >
          {loading ? 'Subiendo...' : 'Guardar Resultado'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/bacteriologo/ingresar/page.tsx
git commit -m "feat(bacteriologo): formulario ingresar resultado externo con lake por documento"
```

---

## Task 7: Validar Exámenes

**Files:**
- Create: `frontend/app/dashboard/bacteriologo/validar/page.tsx`

- [ ] **Step 1: Crear la página de validación**

Crear `frontend/app/dashboard/bacteriologo/validar/page.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { PaginatedResponse, ResultadoLista } from '@/lib/types';

export default function ValidarExamenesPage() {
  const [resultados, setResultados] = useState<ResultadoLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validandoId, setValidandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PaginatedResponse<ResultadoLista>>('/api/resultados/?estado=PENDIENTE');
      setResultados(data.results);
    } catch (err) {
      setError((err as Error).message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const validar = async (id: string) => {
    setValidandoId(id);
    try {
      await apiFetch(`/api/resultados/${id}/estado/`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'VALIDADO' }),
      });
      setResultados((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert('Error al validar: ' + (err as Error).message);
    } finally {
      setValidandoId(null);
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <h2 style={{ color: 'var(--primary-blue)', marginBottom: '0.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        Validar Exámenes
      </h2>
      <p style={{ color: 'var(--text-gray)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Al validar, el resultado queda visible para el paciente en su portal.
      </p>

      {error && (
        <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}{' '}
          <button onClick={cargar} style={{ marginLeft: '10px', padding: '4px 10px', border: '1px solid #721c24', background: 'transparent', color: '#721c24', borderRadius: '4px', cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem' }}>Cargando...</p>
      ) : resultados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-gray)' }}>
          <i className="fas fa-check-circle" style={{ fontSize: '3rem', color: '#28a745', display: 'block', marginBottom: '1rem' }} />
          No hay exámenes pendientes de validación.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '12px' }}>Paciente</th>
              <th style={{ padding: '12px' }}>Examen</th>
              <th style={{ padding: '12px' }}>Fecha</th>
              <th style={{ padding: '12px' }}>Fuente</th>
              <th style={{ padding: '12px' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px' }}>{r.paciente_nombre || r.paciente_documento || '—'}</td>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.tipo_examen}</td>
                <td style={{ padding: '12px' }}>{new Date(r.fecha_examen).toLocaleDateString('es-CO')}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: '12px', background: '#e9ecef', color: '#495057' }}>
                    {r.fuente}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  <button
                    onClick={() => validar(r.id)}
                    disabled={validandoId === r.id}
                    style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    {validandoId === r.id ? 'Validando...' : 'Validar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/bacteriologo/validar/page.tsx
git commit -m "feat(bacteriologo): página validar exámenes PENDIENTE"
```

---

## Task 8: Buscar Paciente

**Files:**
- Create: `frontend/app/dashboard/bacteriologo/buscar/page.tsx`

- [ ] **Step 1: Crear la página de búsqueda de paciente**

Crear `frontend/app/dashboard/bacteriologo/buscar/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import type { ResultadoLista, ResultadoEstado } from '@/lib/types';

type PacienteBuscar = {
  id: number;
  tipo_documento: string;
  documento: string;
  nombre_completo: string;
  telefono: string;
  activo: boolean;
};

const badgeColors: Record<ResultadoEstado, { bg: string; color: string }> = {
  PENDIENTE: { bg: '#fff3cd', color: '#856404' },
  VALIDADO: { bg: '#d4edda', color: '#155724' },
  ENTREGADO: { bg: '#cce5ff', color: '#004085' },
};

export default function BuscarPacientePage() {
  const [documento, setDocumento] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [paciente, setPaciente] = useState<PacienteBuscar | null>(null);
  const [resultados, setResultados] = useState<ResultadoLista[]>([]);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuscando(true);
    setPaciente(null);
    setResultados([]);
    setNoEncontrado(false);
    setError(null);

    try {
      const p = await apiFetch<PacienteBuscar>(`/api/pacientes/buscar/?documento=${documento.trim()}`);
      setPaciente(p);

      // PacienteResultadosView puede retornar array plano o paginado según config global
      const raw = await apiFetch<{ results: ResultadoLista[] } | ResultadoLista[]>(
        `/api/pacientes/${p.id}/resultados/`
      );
      setResultados(Array.isArray(raw) ? raw : raw.results);
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.includes('404') || msg.toLowerCase().includes('no se encontró')) {
        setNoEncontrado(true);
      } else {
        setError(msg || 'Error al buscar');
      }
    } finally {
      setBuscando(false);
    }
  };

  const descargarPDF = async (id: string, nombre: string | null) => {
    setDownloadingId(id);
    try {
      const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre ?? `resultado_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('No se pudo descargar: ' + (err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <h2 style={{ color: 'var(--primary-blue)', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        Buscar Paciente
      </h2>

      <form onSubmit={buscar} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', maxWidth: '480px' }}>
        <input
          type="text"
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
          placeholder="N° de documento"
          required
          style={{ flex: 1, padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem' }}
        />
        <button
          type="submit"
          disabled={buscando || !documento}
          style={{ background: 'var(--primary-blue)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && (
        <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {noEncontrado && (
        <div style={{ background: '#fff3cd', color: '#856404', padding: '1rem', borderRadius: '8px' }}>
          <strong>Paciente no registrado.</strong> Los resultados que hayas subido con el documento{' '}
          <strong>{documento}</strong> aparecerán en su portal cuando se registre.
        </div>
      )}

      {paciente && (
        <>
          <div style={{ background: '#f0f7ff', border: '1px solid #b8d9f7', borderRadius: '10px', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ color: 'var(--primary-blue)', margin: '0 0 1rem 0' }}>
              <i className="fas fa-user" style={{ marginRight: '10px' }} />
              {paciente.nombre_completo}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem', color: '#555' }}>
              <span><strong>Documento:</strong> {paciente.tipo_documento} {paciente.documento}</span>
              {paciente.telefono && <span><strong>Teléfono:</strong> {paciente.telefono}</span>}
            </div>
          </div>

          <h3 style={{ color: '#333', marginBottom: '1rem' }}>
            Historial de Resultados ({resultados.length})
          </h3>

          {resultados.length === 0 ? (
            <p style={{ color: 'var(--text-gray)' }}>Este paciente no tiene resultados registrados.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '12px' }}>Examen</th>
                  <th style={{ padding: '12px' }}>Fecha</th>
                  <th style={{ padding: '12px' }}>Estado</th>
                  <th style={{ padding: '12px' }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r) => {
                  const colors = badgeColors[r.estado] ?? { bg: '#eee', color: '#333' };
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.tipo_examen}</td>
                      <td style={{ padding: '12px' }}>{new Date(r.fecha_examen).toLocaleDateString('es-CO')}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ background: colors.bg, color: colors.color, padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {r.estado}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {r.nombre_archivo ? (
                          <button
                            onClick={() => descargarPDF(r.id, r.nombre_archivo)}
                            disabled={downloadingId === r.id}
                            style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            {downloadingId === r.id ? 'Descargando...' : 'Descargar PDF'}
                          </button>
                        ) : (
                          <span style={{ color: '#aaa', fontSize: '0.85rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/bacteriologo/buscar/page.tsx
git commit -m "feat(bacteriologo): búsqueda de paciente por documento con historial"
```

---

## Task 9: Conectar links del dashboard principal

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Actualizar los links del bacteriólogo en el dashboard**

En `frontend/app/dashboard/page.tsx`, reemplazar el bloque del menú bacteriólogo (líneas ~81-88):

```tsx
{/* Antes */}
{currentRole === 'bacteriologo' && (
    <>
        <li><Link href="#" style={activeNavItemStyle}><i className="fas fa-chart-line" style={{width: '25px'}}></i> Panel Trabajo</Link></li>
        <li><Link href="#" style={navItemStyle}><i className="fas fa-vials" style={{width: '25px'}}></i> Ingresar Resultados</Link></li>
        <li><Link href="#" style={navItemStyle}><i className="fas fa-check-double" style={{width: '25px'}}></i> Validar Exámenes</Link></li>
        <li><Link href="#" style={navItemStyle}><i className="fas fa-search" style={{width: '25px'}}></i> Buscar Paciente</Link></li>
    </>
)}
```

Reemplazar por:

```tsx
{currentRole === 'bacteriologo' && (
    <>
        <li><Link href="/dashboard/bacteriologo" style={navItemStyle}><i className="fas fa-chart-line" style={{width: '25px'}}></i> Panel Trabajo</Link></li>
        <li><Link href="/dashboard/bacteriologo/ingresar" style={navItemStyle}><i className="fas fa-vials" style={{width: '25px'}}></i> Ingresar Resultados</Link></li>
        <li><Link href="/dashboard/bacteriologo/validar" style={navItemStyle}><i className="fas fa-check-double" style={{width: '25px'}}></i> Validar Exámenes</Link></li>
        <li><Link href="/dashboard/bacteriologo/buscar" style={navItemStyle}><i className="fas fa-search" style={{width: '25px'}}></i> Buscar Paciente</Link></li>
    </>
)}
```

También reemplazar el contenido central del bacteriólogo (bloque `currentRole === 'bacteriologo'` en el área principal, líneas ~132-163) — la tabla con datos mock ya no es necesaria, poner un redirect o mensaje:

```tsx
{currentRole === 'bacteriologo' && (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', textAlign: 'center' }}>
        <i className="fas fa-flask" style={{ fontSize: '3rem', color: 'var(--primary-blue)', marginBottom: '1rem', display: 'block' }} />
        <h2 style={{ color: '#333', marginBottom: '1rem' }}>Portal Bacteriólogo</h2>
        <p style={{ color: 'var(--text-gray)', marginBottom: '1.5rem' }}>Usa el menú lateral para acceder a tus módulos de trabajo.</p>
        <Link href="/dashboard/bacteriologo" className="btn-primary" style={{ padding: '10px 20px', borderRadius: '25px', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-block' }}>
            Ir al Panel de Trabajo
        </Link>
    </div>
)}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/page.tsx
git commit -m "feat(dashboard): conectar links del bacteriólogo a rutas reales"
```

---

## Self-review

**Cobertura del spec:**
- ✅ Layout anidado con guard de rol → Task 4
- ✅ Panel de Trabajo con todos los estados + filtro → Task 5
- ✅ Ingresar resultado (3 campos: documento, examen, PDF) → Task 6
- ✅ Validar exámenes PENDIENTE, cualquier bacteriólogo → Task 7
- ✅ Buscar paciente por documento + historial → Task 8
- ✅ Lake: `paciente_documento` en modelo → Task 1
- ✅ Lake: serializer expone campo → Task 2
- ✅ Lake: query por documento al ver resultados → Task 3
- ✅ Links del dashboard conectados → Task 9
- ✅ Paciente no registrado ve resultado al registrarse → Task 3 (query)
- ✅ `__str__` de Resultado no explota con paciente null → Task 1

**Placeholders:** ninguno.

**Consistencia de tipos:** `ResultadoLista.paciente_documento` ya existe en `lib/types.ts` (línea 16). Los componentes lo usan directamente. `PacienteBuscar` se define inline en `buscar/page.tsx` (no merece un tipo compartido — solo lo usa esa página).
