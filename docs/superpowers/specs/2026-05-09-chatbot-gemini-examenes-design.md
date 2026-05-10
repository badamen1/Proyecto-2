# Chatbot Gemini — Recomendador de Exámenes por Síntomas

**Fecha:** 2026-05-09  
**Estado:** Aprobado

---

## Goal

Widget de chat flotante accesible en todas las páginas del sitio, que usa Gemini 2.5 Flash para orientar a cualquier visitante sobre qué exámenes de laboratorio realizar según sus síntomas, basándose en el catálogo real de BIOANALISIS.

---

## Architecture

```
Visitante (cualquier página)
    │
    ▼
[ChatbotWidget.tsx]  — componente React, fixed bottom-right
    │  POST /api/chatbot/  { message, history[] }
    ▼
[Django POST /api/chatbot/]
    │
    ├─ Valida input (message requerido, history opcional)
    ├─ Rate limit: 30 req/IP/hora (django-ratelimit)
    ├─ Carga system prompt (construido una vez al arrancar)
    │   └─ incluye catálogo completo de examenes.json enriquecido
    ├─ Llama Gemini 2.5 Flash SDK (multi-turn con history)
    └─ Retorna { response: string }
```

**Decisiones clave:**
- Historial de conversación en React state (client-side). Se pierde al cerrar/recargar — correcto para usuarios anónimos.
- Respuestas completas (no streaming). Spinner mientras genera.
- API key de Gemini solo en `backend/.env`, nunca llega al cliente.
- Sin modelo Django nuevo, sin sesiones, sin BD adicional.

---

## Frontend

### Archivos

| Archivo | Acción |
|---|---|
| `components/ChatbotWidget.tsx` | Crear — widget completo |
| `app/layout.tsx` | Modificar — añadir `<ChatbotWidget />` |

### Componente `ChatbotWidget.tsx`

**Estado local:**
```typescript
isOpen: boolean                                    // panel visible
messages: { role: 'user' | 'model'; content: string }[]  // historial
input: string                                      // texto del input
loading: boolean                                   // esperando respuesta
```

**Comportamiento:**
- Botón circular fixed `bottom: 90px, right: 20px` (sobre WhatsApp e Instagram)
- Ícono: `fa-comment-medical` (FontAwesome ya cargado en layout)
- Color: `var(--primary-blue)` del sistema de diseño existente
- Click en botón: toggle `isOpen`
- Panel: 360×500px, anclado al botón, animación slide-up con `transition`
- Al abrir por primera vez: insertar mensaje de bienvenida automático del bot
- Scroll automático al último mensaje en cada update
- Input bloqueado mientras `loading === true` (evita doble envío)
- Máximo 10 intercambios enviados al backend (los más recientes). El historial local puede ser más largo.

**Mensaje de bienvenida:**
> "Hola, soy el asistente virtual de BIOANALISIS. Cuéntame tus síntomas y te orientaré sobre qué exámenes podrían serte útiles. Recuerda que mis recomendaciones no reemplazan la consulta médica."

**Burbujas de chat:**
- Mensajes del usuario: alineados a la derecha, fondo `var(--primary-blue)`, texto blanco
- Mensajes del bot: alineados a la izquierda, fondo `#f1f3f5`, texto `#333`
- Estado loading: burbuja izquierda con 3 puntos animados (`···`)

**Errores de red:**
- Mostrar burbuja del bot con texto rojo: el mensaje de error del servidor
- Input vuelve a habilitarse para que el usuario pueda reintentar

---

## Backend

### Archivos

| Archivo | Acción |
|---|---|
| `backend/chatbot/__init__.py` | Crear |
| `backend/chatbot/apps.py` | Crear |
| `backend/chatbot/views.py` | Crear — lógica endpoint |
| `backend/chatbot/urls.py` | Crear — ruta POST |
| `backend/chatbot/examenes.json` | Crear — catálogo enriquecido |
| `backend/requirements.txt` | Modificar — añadir `google-generativeai` |
| `backend/config/settings.py` | Modificar — añadir app + `GEMINI_API_KEY` |
| `backend/.env` | Modificar — añadir `GEMINI_API_KEY=...` |
| `backend/config/urls.py` | Modificar — incluir rutas chatbot |

### Endpoint

```
POST /api/chatbot/
Content-Type: application/json
Sin autenticación requerida
```

**Request:**
```json
{
  "message": "tengo fatiga y me duele la cabeza",
  "history": [
    { "role": "user", "content": "hola" },
    { "role": "model", "content": "Hola, ¿en qué puedo ayudarte?" }
  ]
}
```

**Response 200:**
```json
{ "response": "Con esos síntomas te recomendaría considerar..." }
```

**Responses de error:**

| Código | Causa | Body |
|---|---|---|
| 400 | `message` vacío o ausente | `{"error": "El campo 'message' es requerido."}` |
| 429 | Rate limit superado | `{"error": "Demasiadas consultas. Intenta en unos minutos."}` |
| 503 | Gemini no responde / timeout | `{"error": "Servicio no disponible. Intenta de nuevo."}` |
| 500 | Error interno | `{"error": "Error interno del servidor."}` |

### Lógica de la vista (`views.py`)

```python
# Al arrancar el módulo (una vez):
_EXAMENES = json.load(open('chatbot/examenes.json'))
_SYSTEM_PROMPT = _build_system_prompt(_EXAMENES)

# En cada request:
# 1. Validar 'message' no vacío
# 2. Leer 'history' (lista, default [])
# 3. Truncar history a últimos 10 intercambios (20 items)
# 4. Llamar Gemini con system_prompt + history + message
# 5. Retornar { response: texto }
```

### Configuración Gemini

```python
model = "gemini-2.5-flash"
generation_config = {
    "max_output_tokens": 1024,
    "temperature": 0.4,
}
```

### System prompt (estructura)

```
Eres el asistente virtual del Laboratorio Clínico BIOANALISIS, ubicado en Quibdó, Chocó, Colombia.

Tu función es:
1. Orientar a los usuarios sobre qué exámenes de laboratorio podrían ser útiles según sus síntomas.
2. Explicar qué mide cada examen y qué significan los resultados de manera general.
3. Responder preguntas generales sobre salud relacionadas con laboratorio clínico.

Reglas estrictas:
- NUNCA diagnostiques enfermedades. Solo orienta y recomienda exámenes.
- Siempre indica que los resultados deben ser interpretados por un médico.
- Solo recomienda exámenes que aparezcan en el catálogo provisto.
- Si un examen tiene precio 1, indica "consultar precio en recepción".
- Responde siempre en español, de manera amable, clara y profesional.
- Si te preguntan algo completamente ajeno a salud o laboratorio, redirige amablemente.

Catálogo de exámenes disponibles en BIOANALISIS:
[lista generada desde examenes.json enriquecido]
```

### Rate limiting

```python
@ratelimit(key='ip', rate='30/h', method='POST', block=True)
```

---

## Catálogo de exámenes enriquecido

### Archivos

| Archivo | Acción |
|---|---|
| `app/data/examenes.json` | Modificar — añadir campos nuevos |
| `backend/chatbot/examenes.json` | Crear — misma data enriquecida |

### Estructura por examen

```json
{
  "codigo": "FERR",
  "nombre": "FERRITINA",
  "precio": 60000,
  "categoria": "Hematología",
  "descripcion": "Mide las reservas de hierro en el cuerpo. Útil para detectar anemia ferropénica.",
  "sintomas": ["fatiga", "debilidad", "palidez", "caída de cabello", "uñas quebradizas", "mareo"]
}
```

### Categorías

| Categoría | Ejemplos |
|---|---|
| Hematología | Ferritina, Electroforesis de hemoglobina, Recuento de Addis |
| Hormonas | Estradiol, Progesterona, Testosterona, Cortisol, Insulina, Hormona de crecimiento |
| Tiroides | TSH neonatal, Tiroglobulina, Anti-tiroglobulina, Anti-tiroperoxidasa |
| Inmunología | ANA, ENA, Complemento C3/C4, Inmunoglobulina IgA, Linfocitos CD3/CD4/CD8 |
| Infectología | Hepatitis A/B/C, Herpes I/II, Citomegalovirus, Carga viral HIV, Rubeola, Treponema |
| Oncología | CA 125, CA 15-3, CA 19-9, PSA, VPH, Western Blot |
| Coagulación | Anticoagulante lúpico, Cardiolipina IgG/IgM, Proteína C/S, Coombs indirecto |
| Metabolismo | Vitamina D, Vitamina K, Zinc, Plomo, Glucosa 6-fosfato, Bicarbonato, Transferrina |
| Microbiología | Cultivo de hongos, Cultivo secreción uretral |
| Otras | Biopsia, Ecografía, Examen ocupacional, Optometría, Prueba de paternidad |

---

## Seguridad

- `GEMINI_API_KEY` solo en `backend/.env` (ya en `.gitignore`)
- El endpoint no requiere autenticación (visitantes anónimos) pero sí rate limit
- No se persiste ningún mensaje del usuario en BD
- El historial máximo enviado a Gemini: 20 items (10 intercambios)
- `CORS` ya configurado en Django para el frontend Next.js

---

## Lo que NO se construye en este sprint

- Autenticación del chatbot (se puede añadir después)
- Historial persistido en BD
- Streaming de respuestas
- Panel admin para editar el catálogo
- Integración con historial de exámenes del paciente autenticado
- Analytics de conversaciones
