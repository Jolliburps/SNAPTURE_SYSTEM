"""Transport and fail-closed contracts; these are not model-accuracy tests."""
import base64
import json
from io import BytesIO
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError

from django.test import SimpleTestCase, override_settings
from PIL import Image

from .cloud_vision import CONDITION_VALUES, VisionUnavailable
from .local_vision import assess, ENDPOINT


@override_settings(SNAPTURE_LOCAL_VISION_MODEL='qwen3-vl:2b')
class LocalVisionTests(SimpleTestCase):
    def condition(self, **extra):
        return {'subject_visible': True, 'quality': {'usable': True, 'guidance': ''},
                'observations': {field: {'value': values[0], 'certainty': 'clear', 'evidence': 'Visible feature.'}
                                 for field, values in CONDITION_VALUES.items()}, **extra}

    def project(self, **extra):
        return {'subject_visible': True, 'quality': {'usable': True, 'guidance': ''},
                'feedback': 'Required fold is visible.',
                'criteria': [{'id': 'step_0', 'status': 'met', 'evidence': 'Fold is visible.'}], **extra}

    def opener(self, result, **extra):
        opener = MagicMock()
        envelope = {'done': True, 'done_reason': 'stop', 'model': 'qwen3-vl:2b',
                    'message': {'content': json.dumps(result)}, **extra}
        opener.open.return_value.__enter__.return_value.read.return_value = json.dumps(envelope).encode()
        return opener

    def image(self):
        return Image.new('RGB', (1600, 1200), 'brown')

    def call(self, opener, **context):
        with patch('upcycling.local_vision.build_opener', return_value=opener):
            return assess(self.image(), **context)

    def test_local_image_request_resizes_and_never_supplies_cloud_credentials(self):
        opener = self.opener(self.condition())
        result = self.call(opener, material='cardboard')
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, ENDPOINT)
        self.assertEqual(request.full_url, 'http://127.0.0.1:11434/api/chat')
        self.assertFalse(request.has_header('Authorization'))
        payload = json.loads(request.data)
        self.assertFalse(payload['stream']); self.assertFalse(payload['think'])
        self.assertEqual(payload['options']['num_ctx'], 2048)
        self.assertEqual(payload['options']['num_predict'], 700)
        self.assertNotIn('JSON schema:', payload['messages'][-1]['content'])
        self.assertIn('observations', payload['format']['properties'])
        raw = base64.b64decode(payload['messages'][-1]['images'][0])
        with Image.open(BytesIO(raw)) as image:
            self.assertEqual(image.size, (512, 384))
        self.assertEqual(len(result['observations']), 6)
        self.assertEqual(result['model'], 'qwen3-vl:2b')
        self.assertNotIn('validated', result)
        self.assertNotIn('verdict', result)

    def test_cloud_tags_and_remote_model_hosts_rejected_before_network(self):
        for model in ('qwen3-vl:cloud', 'remote/model', 'https://example.com/model', '', 'foo CLOUD'):
            with self.subTest(model=model), self.settings(SNAPTURE_LOCAL_VISION_MODEL=model), patch('upcycling.local_vision.build_opener') as opener:
                with self.assertRaises(VisionUnavailable): assess(self.image())
                opener.assert_not_called()

    def test_model_response_identity_must_match_requested_download(self):
        with self.assertRaises(VisionUnavailable):
            self.call(self.opener(self.condition(), model='unrelated-model'))

    def test_incomplete_or_truncated_output_cannot_pass(self):
        for extra in ({'done': False}, {'done_reason': 'length'}, {'message': {'content': 'not json'}}):
            with self.subTest(extra=extra), self.assertRaises(VisionUnavailable):
                self.call(self.opener(self.condition(), **extra))

    def test_condition_omissions_invalid_enums_and_blank_evidence_fail_closed(self):
        cases = [self.condition(observations={}), self.condition(subject_visible='yes')]
        unknown = self.condition(); unknown['observations']['damage']['value'] = 'safe'; cases.append(unknown)
        blank = self.condition(); blank['observations']['damage']['evidence'] = ''; cases.append(blank)
        for case in cases:
            with self.subTest(case=case), self.assertRaises(VisionUnavailable): self.call(self.opener(case))

    def test_hidden_or_poor_condition_image_marks_every_field_uncertain(self):
        raw = self.condition(subject_visible=False, quality={'usable': True, 'guidance': 'Show the item clearly.'})
        result = self.call(self.opener(raw))
        self.assertTrue(all(row['certainty'] == 'uncertain' and row['value'] == 'uncertain' for row in result['observations']))

    def test_step_requires_exact_criterion_evidence(self):
        criteria = [{'id': 'step_0', 'instruction': 'Show fold'}]
        result = self.call(self.opener(self.project()), purpose='project_step', criteria=criteria)
        self.assertEqual(result['criteria'][0]['status'], 'met')
        self.assertNotIn('validated', result)
        for rows in ([], [{'id': 'wrong', 'status': 'met', 'evidence': 'Fold'}],
                     [{'id': 'step_0', 'status': 'met', 'evidence': ''}]):
            with self.subTest(rows=rows), self.assertRaises(VisionUnavailable):
                self.call(self.opener(self.project(criteria=rows)), purpose='project_step', criteria=criteria)

    def test_unrelated_project_image_requests_retake_instead_of_approval(self):
        result = self.call(self.opener(self.project(subject_visible=False, quality={'usable': True, 'guidance': 'Show the current project.'})),
                           purpose='project_step', criteria=[{'id': 'step_0', 'instruction': 'Fold'}])
        self.assertFalse(result['quality']['usable'])
        self.assertEqual(result['criteria'][0]['status'], 'not_assessable')

    def test_saved_context_is_bounded_and_sent_as_images(self):
        stored = BytesIO(); Image.new('RGB', (50, 50), 'white').save(stored, format='PNG')
        opener = self.opener(self.project())
        def source(*args): return BytesIO(stored.getvalue())
        with patch('upcycling.local_vision.default_storage.open', side_effect=source):
            self.call(opener, purpose='project_step', criteria=[{'id': 'step_0', 'instruction': 'Fold'}],
                      previous_photos=[{'id': i, 'image': f'upcycling/steps/{i}.jpg'} for i in range(5)])
        payload = json.loads(opener.open.call_args.args[0].data)
        self.assertEqual(sum(bool(message.get('images')) for message in payload['messages']), 2)

    def test_saved_context_cannot_read_untrusted_paths(self):
        for name in ('../../secret.jpg', 'https://example.com/p.jpg', 'C:\\private.jpg', '/absolute.jpg'):
            with self.subTest(name=name), patch('upcycling.local_vision.build_opener') as opener:
                with self.assertRaises(VisionUnavailable):
                    assess(self.image(), previous_photos=[{'image': name}])
                opener.assert_not_called()

    def test_not_installed_and_timeout_errors_remain_unavailable_without_fallback(self):
        for error in (HTTPError(ENDPOINT, 404, 'private response text', {}, None), URLError('local stopped'), TimeoutError()):
            opener = MagicMock(); opener.open.side_effect = error
            with self.subTest(error=type(error).__name__), self.assertRaises(VisionUnavailable) as caught:
                self.call(opener)
            self.assertNotIn('private response text', str(caught.exception))

    @override_settings(SNAPTURE_LOCAL_VISION_TIMEOUT=999)
    def test_timeout_clamped_for_android_request_budget(self):
        opener = self.opener(self.condition())
        self.call(opener)
        self.assertEqual(opener.open.call_args.kwargs['timeout'], 120)

    def test_local_transport_disables_proxy_and_redirect_forwarding(self):
        opener = self.opener(self.condition())
        with patch('upcycling.local_vision.build_opener', return_value=opener) as factory:
            assess(self.image())
        proxy, redirect = factory.call_args.args
        self.assertEqual(proxy.proxies, {})
        self.assertIsNone(redirect.redirect_request(None, None, 302, None, None, 'https://example.com'))
