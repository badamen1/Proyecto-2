# Spec: User como fuente de verdad + integración FASIL como fuente de resultados

**Fecha:** 2026-04-25
**Rama:** develop
**Contexto:** Se logró conectar con la BD real de FASIL (bioanalisis30, MySQL 5.5) via PyMySQL directo. Se identificó que depender de FASIL como fuente de identidad de pacientes genera inconsistencias: registros incompletos, pacientes que no existen en FASIL, datos desactualizados.

---

## Decisión de arquitectura

**Nuestro sistema es la fuente de verdad para usuarios.**
FASIL es únicamente fuente de resultados clínicos — no de identidad.

- El paciente se registra en nuestro sistema con sus propios datos.
- Al consultar resultados, se busca en FASIL por `documento`. Si existe → se muestran sus órdenes. Si no existe o FASIL no responde → se muestran solo los resultados manuales (degradación elegante).
- No hay dependencia de FASIL para crear, autenticar ni gestionar usuarios.

---

## Cambios en modelos

### `User` (users/models.py)
Añadir campo:
```python
nombre_completo = models.CharField(max_length=200, blank=False)
```
El `documento` ya existe. Con `nombre_completo` + `documento` + `tipo_documento`, `User` tiene toda la información de identidad del paciente.

### `Resultado` (resultados/models.py)
Añadir FK directa a `User`:
```python
paciente_user = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.SET_NULL,
    null=True, blank=True,
    related_name='resultados_directos',
)
```
Migración de datos: `resultado.paciente_user = resultado.paciente.user` para todos los registros que tengan ese vínculo.

La FK `paciente` (a `Paciente`) se deja como `null=True, blank=True` — no se elimina físicamente en este sprint. El modelo `Paciente` queda como registro histórico; se limpia en un sprint posterior.

---

## Cambios en registro y login OTP

### `RegisterView` — POST `/api/auth/register/`
Recibe: `documento`, `tipo_documento`, `nombre_completo`, `email` (opcional), `telefono` (opcional).
No recibe contraseña — los pacientes se autentican por OTP.
Siempre crea con `role=PACIENTE`.
No consulta FASIL durante el registro.

### `RequestOTPView` — POST `/api/auth/otp/request/`
**Antes:** `get_or_create` — creaba usuario si no existía.
**Después:** Busca `User` por `documento`. Si no existe → `HTTP 404` con `{"detail": "No tienes una cuenta. Regístrate primero."}`. Si existe → genera y guarda OTP en cache, responde 200.

---

## Endpoint unificado de resultados

### `GET /api/resultados/`

**Flujo para rol `paciente`:**
1. Obtener `user = request.user`.
2. Consultar BD: `Resultado.objects.filter(paciente_user=user, estado__in=['VALIDADO','ENTREGADO'])`.
3. Consultar FASIL secuencialmente:
   - `fasil_service.get_paciente(user.documento)` → obtiene `id_fasil`.
   - `fasil_service.get_ordenes(id_fasil)` → lista de `OrdenFASIL`.
   - Si lanza `FasilPacienteNoEncontrado` o `FasilConexionError` → lista FASIL vacía, log del error, continúa sin error al cliente.
4. Combinar: resultados manuales de BD + órdenes FASIL, ordenados por `fecha_examen` descendente.
5. Paginación: aplica sobre la lista combinada. Default 20 por página.

**Forma de cada ítem en la respuesta:**
```json
{
  "id": "15",
  "tipo_examen": "Hemograma Completo",
  "fecha_examen": "2026-04-10",
  "estado": "ENTREGADO",
  "fuente": "FASIL",
  "nombre_archivo": null,
  "tiene_pdf": true
}
```
El campo `id` **siempre es string** en la respuesta unificada. Para resultados de nuestra BD se serializa como `str(pk)` (ej. `"15"`). Para resultados de FASIL lleva prefijo `"fasil-"` (ej. `"fasil-ORD-42"`). Esto permite al frontend y al endpoint de PDF distinguir el origen sin lógica extra.

**Cambio requerido en URLs (resultados/urls.py):**

Los patrones `<int:pk>` deben cambiar a `<str:pk>` en los endpoints que el paciente usa:
```python
path('resultados/<str:pk>/',      ResultadoDetailView.as_view(), ...),
path('resultados/<str:pk>/pdf/',  ResultadoDescargarPDFView.as_view(), ...),
```
Los endpoints de admin/bacteriólogo (`estado/`) pueden mantenerse con `<int:pk>` ya que nunca reciben IDs FASIL.

### `GET /api/resultados/<id>/pdf/`
- Si `id` es entero → sirve desde `FileField` (comportamiento actual).
- Si `id` empieza con `"fasil-"` → extrae el `orden_id` y llama `fasil_service.get_resultado_pdf(orden_id)`, sirve bytes como `application/pdf`.
- Si no se encuentra → `HTTP 404`.

---

## Manejo de errores

| Situación | Comportamiento |
|---|---|
| Paciente no existe en FASIL | Lista FASIL vacía, sin error al cliente. Log `INFO`. |
| FASIL no disponible (timeout/red) | Lista FASIL vacía, sin error al cliente. Log `ERROR`. |
| `user.documento` vacío | Solo resultados manuales. No se consulta FASIL. |
| PDF de FASIL no encontrado | `HTTP 404` con mensaje claro. |
| OTP solicitado sin cuenta registrada | `HTTP 404`: `"No tienes una cuenta. Regístrate primero."` |

---

## Tests

### Backend (Django)

| Test | Descripción |
|---|---|
| `test_otp_rechaza_documento_sin_cuenta` | POST a `RequestOTPView` con documento no registrado → 404. |
| `test_otp_acepta_documento_registrado` | POST con documento existente → 200 y OTP en cache. |
| `test_registro_crea_user_con_nombre_completo` | POST a `RegisterView` con `nombre_completo` → User creado, `role=PACIENTE`, sin crear `Paciente`. |
| `test_resultados_lista_combina_fasil_y_manuales` | Mock de `get_paciente` y `get_ordenes`, verifica lista unificada con ítems de ambas fuentes. |
| `test_resultados_lista_fasil_caido_retorna_solo_manuales` | Mock lanza `FasilConexionError` → responde 200 con solo los manuales. |
| `test_resultados_lista_paciente_sin_fasil_retorna_solo_manuales` | Mock lanza `FasilPacienteNoEncontrado` → responde 200 con solo los manuales. |
| `test_pdf_fasil_delega_a_fasil_service` | GET `/api/resultados/fasil-ORD-42/pdf/` → llama a `get_resultado_pdf("ORD-42")`. |

### Frontend (Jest)
Los tests existentes de `resultados-list` y `resultados-detail` no requieren cambios: el contrato de respuesta es el mismo shape que ya esperan.

---

## Secuencia de implementación (3 pasos)

### Paso 1 — Registro explícito y login OTP sin auto-create
- Añadir `nombre_completo` a `User` + migración.
- Actualizar `RegisterSerializer` para incluir `nombre_completo`.
- Cambiar `RequestOTPView`: eliminar `get_or_create`, añadir lookup + 404.
- Tests de paso 1.

### Paso 2 — Vincular `Resultado` a `User`
- Añadir `paciente_user` FK a `Resultado` + migración de datos.
- Actualizar `ResultadoListCreateView` y `ResultadoDetailView` para usar `paciente_user`.
- Actualizar `ResultadoDescargarPDFView` para el prefijo `"fasil-"`.
- Tests de paso 2.

### Paso 3 — Endpoint unificado con FASIL
- Actualizar `get_queryset` de `ResultadoListCreateView` para consultar FASIL secuencialmente y combinar resultados.
- Actualizar serializador para emitir el campo `tiene_pdf` y manejar IDs con prefijo `"fasil-"`.
- Tests de paso 3.

---

## Lo que NO cambia

- El modelo `Paciente` y sus datos históricos permanecen intactos.
- El admin de Django sigue viendo `Paciente` y `Resultado` como antes.
- Los resultados subidos manualmente por bacteriólogos no se tocan.
- `fasil_service` no necesita cambios — ya tiene `get_paciente`, `get_ordenes` y `get_resultado_pdf`.
- El frontend (`app/dashboard/resultados/`) no necesita cambios: el contrato de API es el mismo.
