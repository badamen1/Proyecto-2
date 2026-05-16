# Vista del Bacteriólogo — Diseño

**Fecha:** 2026-05-16  
**Estado:** Aprobado  

## Contexto

El dashboard del bacteriólogo existe pero todos sus links apuntan a `href="#"` con datos mock estáticos. El backend (Django REST) ya tiene las APIs necesarias. Este spec cubre hacer la vista 100% funcional.

El rol `bacteriologo` puede:
- Ver todos los resultados del sistema (sin filtro por quién los subió)
- Subir resultados de exámenes externos (remitidos a otro lab)
- Validar cualquier resultado PENDIENTE (no solo el propio)
- Buscar pacientes por documento y ver su historial

## El problema del paciente no registrado ("lake")

Cuando el bacteriólogo sube un resultado de un examen remitido, el paciente puede no estar registrado en el sistema todavía. La solución sigue el mismo patrón que la integración FASIL: almacenar el documento del paciente directamente en el resultado y hacer la query por documento cuando el paciente se registre.

## Cambios de backend

### 1. Nuevo campo `paciente_documento` en `Resultado`

```python
paciente_documento = models.CharField(
    max_length=20,
    null=True,
    blank=True,
    db_index=True,
    verbose_name='Documento del paciente (lake)',
    help_text='Documento del paciente cuando no existe registro en BD. Query por documento al registrarse.'
)
```

- Migración requerida.
- `db_index=True` porque se filtra frecuentemente por este campo.
- `fecha_examen` pasa a tener `default=date.today` para que el formulario simplificado no lo requiera.

### 2. Serializer — `ResultadoSerializer`

- Agregar `paciente_documento` como campo writable.
- Hacer `fecha_examen` opcional con default `date.today` en `create()` si no viene en los datos.
- `paciente` y `paciente_user` siguen siendo nullable — un resultado del lake tiene ambos en null.

### 3. Query del paciente (`_list_paciente` en `views.py`)

Actualizar el filtro de resultados del paciente:

```python
from django.db.models import Q

qs = queryset.filter(
    Q(paciente_user=user) | Q(paciente_documento=user.documento),
    estado__in=['VALIDADO', 'ENTREGADO']
)
```

Cuando el paciente se registra con su documento, sus resultados del lake aparecen automáticamente sin ninguna acción adicional. Sin migración de datos, sin jobs. Mismo patrón que FASIL.

## Estructura de archivos — Frontend

```
frontend/app/dashboard/bacteriologo/
├── layout.tsx                        ← Shell + sidebar fijo del bacteriólogo
├── page.tsx                          ← Panel de Trabajo
├── ingresar/
│   └── page.tsx                      ← Formulario ingresar resultado
├── validar/
│   └── page.tsx                      ← Cola de validación
└── buscar/
    └── page.tsx                      ← Buscar paciente

frontend/features/bacteriologo/
└── components/
    ├── BacteriologoSidebar.tsx       ← Navegación lateral
    ├── PanelTrabajo.tsx              ← Tabla de todos los resultados
    ├── IngresarResultadoForm.tsx     ← Formulario 3 campos
    ├── ValidarExamenes.tsx           ← Lista PENDIENTE con validación
    └── BuscarPaciente.tsx            ← Búsqueda por documento + historial
```

**Actualización a `dashboard/page.tsx`:** los 4 links del bacteriólogo pasan de `href="#"` a rutas reales. La sección de contenido central del bacteriólogo redirige a `/dashboard/bacteriologo`.

## Módulos

### Layout (`layout.tsx`)

- Verifica autenticación y rol `bacteriologo` al montar (redirect a `/login` o `/dashboard` si no aplica).
- Renderiza sidebar fijo a la izquierda + `{children}` a la derecha.
- El sidebar marca el link activo según `usePathname()`.

### Panel de Trabajo (`/dashboard/bacteriologo`)

**Fuente de datos:** `GET /api/resultados/`  
**Quién puede ver:** todos los resultados del sistema (admin y bacteriólogo ven todo).

| Columna | Dato |
|---|---|
| Paciente | `paciente_nombre` o `paciente_documento` si no hay nombre |
| Examen | `tipo_examen` |
| Fecha | `fecha_examen` |
| Fuente | badge EXTERNO / FASIL / MANUAL |
| Estado | badge PENDIENTE / VALIDADO / ENTREGADO |
| Acciones | "Validar" (si PENDIENTE) · "Ver PDF" (si tiene archivo) |

- Dropdown de filtro por estado en la cabecera (Todos / PENDIENTE / VALIDADO / ENTREGADO). El filtro pasa `?estado=X` a la API.
- Botón "Validar" llama a `PATCH /api/resultados/<id>/estado/` con `{estado: "VALIDADO"}` e inline actualiza el badge sin recargar la página.

### Ingresar Resultado (`/dashboard/bacteriologo/ingresar`)

**Formulario de 3 campos:**

| Campo | Tipo | Validación |
|---|---|---|
| N° documento del paciente | text | requerido, solo números |
| Nombre del examen | text | requerido |
| PDF del resultado | file | requerido, solo `.pdf` |

**Al guardar:** `POST /api/resultados/` con:
```json
{
  "paciente_documento": "<documento>",
  "tipo_examen": "<nombre>",
  "archivo_pdf": "<file>",
  "fuente": "EXTERNO",
  "fecha_examen": "<hoy ISO>"
}
```

Estado resultante: `PENDIENTE`. Paciente no visible hasta que se valide.

**Post-submit:** mensaje de éxito + botón "Ingresar otro resultado" que limpia el formulario.

**Caso paciente no registrado:** el formulario no busca ni valida si el paciente existe. El documento se almacena en `paciente_documento`. Cuando el paciente se registre con ese documento, el resultado aparece automáticamente en su portal.

### Validar Exámenes (`/dashboard/bacteriologo/validar`)

**Fuente de datos:** `GET /api/resultados/?estado=PENDIENTE`

- Lista los resultados PENDIENTE de todos los bacteriólogos (cualquier bacteriólogo puede validar cualquiera).
- Por cada fila: paciente, examen, fecha, fuente, botón "Validar".
- Al validar: `PATCH /api/resultados/<id>/estado/` con `{estado: "VALIDADO"}`.
- La fila desaparece de la lista al confirmarse (el resultado pasa a VALIDADO y ya no es PENDIENTE).
- Si la lista queda vacía: mensaje "No hay exámenes pendientes de validación."

### Buscar Paciente (`/dashboard/bacteriologo/buscar`)

- Input de documento + botón Buscar.
- Llama a `GET /api/pacientes/buscar/?documento=X`.
- **Si encontrado:** tarjeta con nombre, tipo doc, documento, teléfono. Debajo, tabla con `GET /api/pacientes/<id>/resultados/` (tipo examen, fecha, estado, botón descargar PDF).
- **Si no encontrado:** mensaje "Este paciente no está registrado en el sistema. Los resultados que hayas subido con este documento aparecerán en su portal cuando se registre."

## Flujo de estados

```
[Bacteriólogo sube resultado]
        ↓
    PENDIENTE  ← paciente NO lo ve
        ↓  (cualquier bacteriólogo hace clic en Validar)
    VALIDADO   ← paciente SÍ lo ve
        ↓  (admin marca como entregado — fuera del scope de esta vista)
    ENTREGADO
```

## Permisos

| Acción | Bacteriólogo | Admin | Paciente |
|---|---|---|---|
| Ver todos los resultados | ✅ | ✅ | ❌ (solo los propios) |
| Subir resultado | ✅ | ✅ | ❌ |
| Validar cualquier resultado | ✅ | ✅ | ❌ |
| Ver resultados propios (VALIDADO/ENTREGADO) | — | — | ✅ |

Los permisos del backend ya están implementados correctamente. No se requieren cambios de permisos.

## Fuera de scope

- Cambiar estado a ENTREGADO (acción del admin, no del bacteriólogo).
- Eliminar resultados (solo admin).
- Editar un resultado ya subido.
- Crear pacientes desde el formulario de ingreso (el lake lo hace innecesario).
