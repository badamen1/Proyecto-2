import json
import logging
from pathlib import Path

import google.generativeai as genai
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django_ratelimit.decorators import ratelimit

logger = logging.getLogger('chatbot')

_EXAMENES_PATH = Path(__file__).parent / 'examenes.json'
with open(_EXAMENES_PATH, encoding='utf-8') as _f:
    _EXAMENES = json.load(_f)


def _build_system_prompt(examenes: list) -> str:
    lines = [
        "Eres el asistente virtual del Laboratorio Clínico BIOANALISIS, ubicado en Quibdó, Chocó, Colombia.",
        "",
        "Tu función es:",
        "1. Orientar a los usuarios sobre qué exámenes de laboratorio podrían ser útiles según sus síntomas.",
        "2. Explicar qué mide cada examen y qué significan los resultados de manera general.",
        "3. Responder preguntas generales sobre salud relacionadas con laboratorio clínico.",
        "",
        "Reglas estrictas:",
        "- NUNCA diagnostiques enfermedades. Solo orienta y recomienda exámenes.",
        "- Siempre indica que los resultados deben ser interpretados por un médico.",
        "- Solo recomienda exámenes que aparezcan en el catálogo provisto.",
        "- Si un examen tiene precio 1, indica 'consultar precio en recepción'.",
        "- Responde siempre en español, de manera amable, clara y profesional.",
        "- Cuando recomiendes exámenes, menciona el nombre y el precio en pesos colombianos (COP).",
        "- Si te preguntan algo completamente ajeno a salud o laboratorio, redirige amablemente.",
        "",
        "Catálogo de exámenes disponibles en BIOANALISIS:",
        "",
    ]
    for examen in examenes:
        precio = examen.get('precio', 0)
        precio_str = "Consultar en recepción" if precio <= 1 else f"${precio:,} COP"
        sintomas = ", ".join(examen.get('sintomas', []))
        lines.append(
            f"- {examen['nombre']} | Categoría: {examen.get('categoria', 'General')} | "
            f"Precio: {precio_str} | "
            f"Síntomas: {sintomas or 'ver descripción'} | "
            f"Descripción: {examen.get('descripcion', '')}"
        )
    return "\n".join(lines)


_SYSTEM_PROMPT = _build_system_prompt(_EXAMENES)
_MODEL = None


def _get_model():
    global _MODEL
    if _MODEL is None:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _MODEL = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=_SYSTEM_PROMPT,
            generation_config={
                'max_output_tokens': 1024,
                'temperature': 0.4,
            },
        )
    return _MODEL


@csrf_exempt
@require_POST
@ratelimit(key='ip', rate='30/h', method='POST', block=False)
def chatbot_view(request):
    if getattr(request, 'limited', False):
        return JsonResponse(
            {'error': 'Demasiadas consultas. Intenta en unos minutos.'},
            status=429,
        )

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'error': "El campo 'message' es requerido."}, status=400)

    message = (body.get('message') or '').strip()
    if not message:
        return JsonResponse({'error': "El campo 'message' es requerido."}, status=400)

    history = body.get('history', [])
    if not isinstance(history, list):
        history = []

    history = history[-20:]

    gemini_history = [
        {'role': msg['role'], 'parts': [msg.get('content', '')]}
        for msg in history
        if msg.get('role') in ('user', 'model') and msg.get('content')
    ]

    try:
        model = _get_model()
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(message)
        logger.info("Chatbot OK | ip=%s | chars_respuesta=%d", request.META.get('REMOTE_ADDR'), len(response.text))
        return JsonResponse({'response': response.text})
    except Exception as e:
        logger.error("Chatbot Gemini error: %s", str(e))
        return JsonResponse(
            {'error': 'Servicio no disponible. Intenta de nuevo.'},
            status=503,
        )
