import json
from io import BytesIO
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError
from PIL import Image
from django.test import SimpleTestCase, override_settings
from .cloud_vision import assess, CONDITION_VALUES, VisionUnavailable


@override_settings(OPENAI_API_KEY='unit-test-key-not-real', SNAPTURE_VISION_MODEL='test-vision-model', SNAPTURE_CLOUD_PHOTOS_ENABLED=True)
class CloudVisionTests(SimpleTestCase):
    def payload(self):
        return {'observations': {field: {'value': values[0], 'certainty': 'clear', 'evidence': 'Visible feature in the supplied image.'} for field, values in CONDITION_VALUES.items()}}

    def opener(self, result, **envelope):
        opener = MagicMock()
        raw = {'status': 'completed', 'model': 'provider-test-snapshot', 'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps(result)}]}], **envelope}
        opener.open.return_value.__enter__.return_value.read.return_value = json.dumps(raw).encode()
        return opener

    def image(self):
        return Image.new('RGB', (1600, 1200), 'brown')

    def test_real_image_payload_and_structured_response_without_fabricated_approval(self):
        opener = self.opener(self.payload())
        with patch('upcycling.cloud_vision.build_opener', return_value=opener):
            result = assess(self.image(), purpose='condition', material='cardboard')
        self.assertEqual(len(result['observations']), 6)
        self.assertNotIn('validated', result)
        request = opener.open.call_args.args[0]
        sent = json.loads(request.data)
        self.assertFalse(sent['store'])
        self.assertTrue(sent['text']['format']['strict'])
        self.assertTrue(sent['input'][0]['content'][2]['image_url'].startswith('data:image/jpeg;base64,'))
        self.assertEqual(request.full_url, 'https://api.openai.com/v1/responses')

    @override_settings(SNAPTURE_CLOUD_PHOTOS_ENABLED=False)
    def test_no_upload_without_explicit_cloud_opt_in(self):
        with patch('upcycling.cloud_vision.build_opener') as opener:
            with self.assertRaises(VisionUnavailable): assess(self.image())
        opener.assert_not_called()

    @override_settings(OPENAI_API_KEY='')
    def test_no_request_without_key(self):
        with patch('upcycling.cloud_vision.build_opener') as opener:
            with self.assertRaises(VisionUnavailable): assess(self.image())
        opener.assert_not_called()

    def test_incomplete_refusal_and_malformed_observations_fail_closed(self):
        for result, extra in [({}, {'status': 'incomplete'}), ({}, {}),
                              ({'observations': {'damage': {'value': 'safe', 'certainty': 'clear', 'evidence': 'Guess'}}}, {}),
                              ({}, {'output': [{'type': 'message', 'content': [{'type': 'refusal', 'refusal': 'Cannot assess'}]}]})]:
            with self.subTest(result=result, extra=extra), patch('upcycling.cloud_vision.build_opener', return_value=self.opener(result, **extra)):
                with self.assertRaises(VisionUnavailable): assess(self.image())

    def test_step_criteria_and_previous_images_are_sent_for_actual_comparison(self):
        raw = {'quality': {'usable': True, 'guidance': ''}, 'feedback': 'Fold visible.', 'criteria': [{'id': 'step_0', 'status': 'met', 'evidence': 'Fold visible.'}]}
        opener = self.opener(raw)
        stored = BytesIO(); Image.new('RGB', (50, 50), 'white').save(stored, format='PNG'); stored.seek(0)
        with patch('upcycling.cloud_vision.build_opener', return_value=opener), patch('upcycling.cloud_vision.default_storage.open', return_value=stored):
            result = assess(self.image(), purpose='project_step', criteria=[{'id': 'step_0', 'instruction': 'Show fold'}], previous_photos=[{'id': 2, 'image': 'upcycling/steps/prior.jpg'}])
        sent = json.loads(opener.open.call_args.args[0].data)
        self.assertEqual(sum(p['type'] == 'input_image' for p in sent['input'][0]['content']), 2)
        self.assertEqual(result['purpose'], 'project_step')
        self.assertNotIn('verdict', result)  # Server verifier, not adapter, decides.

    def test_provider_errors_do_not_echo_keys_or_response_bodies(self):
        opener = MagicMock(); opener.open.side_effect = HTTPError('https://api.openai.com', 401, 'secret-body', {}, None)
        with patch('upcycling.cloud_vision.build_opener', return_value=opener):
            with self.assertRaises(VisionUnavailable) as error: assess(self.image())
        self.assertIn('HTTP 401', str(error.exception))
        self.assertNotIn('secret-body', str(error.exception))
        self.assertNotIn('unit-test-key', str(error.exception))

    def test_saved_evidence_cannot_fetch_arbitrary_paths(self):
        with patch('upcycling.cloud_vision.build_opener') as opener:
            with self.assertRaises(VisionUnavailable):
                assess(self.image(), purpose='project_step', criteria=[{'id': 'step_0', 'instruction': 'Fold'}], previous_photos=[{'image': '../../private.jpg'}])
        opener.assert_not_called()
