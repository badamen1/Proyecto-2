import json
from django.test import TestCase, Client
from unittest.mock import patch, MagicMock


class ChatbotViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.url = '/api/chatbot/'

    def test_missing_message_returns_400(self):
        response = self.client.post(
            self.url,
            data=json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())

    def test_empty_message_returns_400(self):
        response = self.client.post(
            self.url,
            data=json.dumps({'message': '   '}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())

    def test_invalid_json_body_returns_400(self):
        response = self.client.post(
            self.url,
            data='not-json',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    @patch('chatbot.views._get_model')
    def test_valid_message_returns_response(self, mock_get_model):
        mock_model = MagicMock()
        mock_chat = MagicMock()
        mock_response = MagicMock()
        mock_response.text = 'Te recomendaría hacer Ferritina.'
        mock_chat.send_message.return_value = mock_response
        mock_model.start_chat.return_value = mock_chat
        mock_get_model.return_value = mock_model

        response = self.client.post(
            self.url,
            data=json.dumps({'message': 'tengo fatiga', 'history': []}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['response'], 'Te recomendaría hacer Ferritina.')

    @patch('chatbot.views._get_model')
    def test_history_is_truncated_to_20_items(self, mock_get_model):
        mock_model = MagicMock()
        mock_chat = MagicMock()
        mock_response = MagicMock()
        mock_response.text = 'respuesta'
        mock_chat.send_message.return_value = mock_response
        mock_model.start_chat.return_value = mock_chat
        mock_get_model.return_value = mock_model

        history = [
            {'role': 'user' if i % 2 == 0 else 'model', 'content': f'msg {i}'}
            for i in range(30)
        ]
        response = self.client.post(
            self.url,
            data=json.dumps({'message': 'hola', 'history': history}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        call_history = mock_model.start_chat.call_args[1]['history']
        self.assertEqual(len(call_history), 20)

    @patch('chatbot.views._get_model')
    def test_gemini_error_returns_503(self, mock_get_model):
        mock_model = MagicMock()
        mock_chat = MagicMock()
        mock_chat.send_message.side_effect = Exception('API error')
        mock_model.start_chat.return_value = mock_chat
        mock_get_model.return_value = mock_model

        response = self.client.post(
            self.url,
            data=json.dumps({'message': 'tengo fiebre'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 503)

    @patch('chatbot.views._get_model')
    def test_history_invalido_se_ignora(self, mock_get_model):
        """Si history no es lista, se procesa igual con historial vacío."""
        mock_model = MagicMock()
        mock_chat = MagicMock()
        mock_response = MagicMock()
        mock_response.text = 'respuesta'
        mock_chat.send_message.return_value = mock_response
        mock_model.start_chat.return_value = mock_chat
        mock_get_model.return_value = mock_model

        response = self.client.post(
            self.url,
            data=json.dumps({'message': 'hola', 'history': 'invalido'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        call_history = mock_model.start_chat.call_args[1]['history']
        self.assertEqual(call_history, [])


class BuildSystemPromptTests(TestCase):
    """Tests para _build_system_prompt() que ahora lee de la BD."""

    def test_prompt_incluye_enlace_markdown_con_slug(self):
        from examenes.models import Examen
        Examen.objects.create(
            codigo='GLU', nombre='Glucosa Basal', slug='glucosa-basal',
            precio=15000, categoria='Metabolismo', activo=True,
        )
        from chatbot.views import _build_system_prompt
        prompt = _build_system_prompt()
        self.assertIn('[Glucosa Basal](/servicios/glucosa-basal)', prompt)

    def test_prompt_excluye_examenes_inactivos(self):
        from examenes.models import Examen
        Examen.objects.create(
            codigo='INA', nombre='Examen Inactivo', slug='examen-inactivo',
            precio=0, categoria='Otras', activo=False,
        )
        from chatbot.views import _build_system_prompt
        prompt = _build_system_prompt()
        self.assertNotIn('Examen Inactivo', prompt)

    def test_prompt_con_bd_vacia_no_falla(self):
        from chatbot.views import _build_system_prompt
        prompt = _build_system_prompt()
        self.assertIsInstance(prompt, str)
        self.assertIn('BIOANALISIS', prompt)
