from types import SimpleNamespace

from django.test import SimpleTestCase
from PIL import Image

from . import scene_detector as detector
from .framed_scan import FrameReviewRequired, select_region, crop_bounds
from .material_classifier import recognition_result


def row(name='paper scrap', score=.8, box=None, material='paper', **extra):
    return {'name':name, 'material':material, 'score':score,
            'box':box or [.15,.15,.85,.85], **extra}


class FramedScanPolicyTests(SimpleTestCase):
    def test_all_seven_categories_share_foreground_selection_and_crop(self):
        from core.materials import SCOPE_LABELS
        from .material_classifier import PLASTIC_MATERIALS
        covered = set()
        for name, material in detector.PROMPTS:
            if material not in SCOPE_LABELS and name != 'plastic bottle':
                continue
            with self.subTest(query=name):
                target = row(name, .9, [.2,.2,.8,.8], material=material)
                background = row('computer mouse', .4, [.01,.01,.12,.12], material=None)
                context = [row(name, .99, [0,0,1,1], material=None) for name in ('person','human arm','dog','cat')]
                cleaned, _ = detector.clean_detections([target, background, *context])
                selected = self.select(cleaned, faces_present=True)
                self.assertEqual(selected['name'], name)
                bounds = crop_bounds(Image.new('RGB',(200,200)), selected)
                self.assertGreater(bounds[0], 0)
                self.assertLess(bounds[2], 200)
                covered.update(PLASTIC_MATERIALS if name == 'plastic bottle' else {material})
        self.assertEqual(covered, set(SCOPE_LABELS))

    def select(self, rows, **options):
        return select_region(detector.presentation(rows), **options)

    def test_holding_hand_does_not_delete_or_block_target(self):
        proposals = [row(), row('human hand',.95,[.2,.6,.6,.95],material=None)]
        cleaned, _ = detector.clean_detections(proposals)
        self.assertIn('paper scrap', {value['name'] for value in cleaned})
        self.assertEqual(self.select(cleaned)['name'], 'paper scrap')

    def test_disagreeing_same_region_becomes_one_review_not_multiple_objects(self):
        selected = self.select([row(), row('cardboard box or cardboard scrap',.75,[.16,.16,.84,.84],material='cardboard')])
        self.assertEqual(selected['detection_status'], 'review')
        self.assertEqual(len(selected['alternatives']), 1)

    def test_distinct_objects_do_not_merge_via_a_chain_of_boxes(self):
        with self.assertRaises(FrameReviewRequired) as error:
            self.select([row(box=[0,0,.4,.8]), row(box=[.3,0,.7,.8]), row(box=[.6,0,1,.8])])
        self.assertEqual(error.exception.code, 'multiple_items_in_frame')

    def test_small_center_target_can_be_over_a_large_keyboard(self):
        selected = self.select([row(box=[.35,.3,.65,.6]),
                                row('computer keyboard',.9,[0,0,1,1],material=None)])
        self.assertEqual(selected['name'], 'paper scrap')

    def test_person_overlapping_fabric_does_not_block_target_crop(self):
        selected = self.select([row('cloth or fabric scrap',.8,material='fabric_scraps'),
                                row('person',.7,[0,0,1,1],material=None)], faces_present=True)
        self.assertEqual(selected['name'], 'cloth or fabric scrap')

    def test_visible_face_prevents_whole_frame_material_fallback(self):
        with self.assertRaises(FrameReviewRequired):
            self.select([], faces_present=True)

    def test_weak_worn_clothing_guess_does_not_block_a_held_towel(self):
        selected = self.select([row('towel',.68,[.08,.07,.86,.98],material='fabric_scraps'),
                                row('clothing worn by a person',.287,[.04,.04,.92,.99],material=None),
                                row('human hand',.26,[.26,.8,.54,1],material=None)])
        self.assertEqual(selected['name'], 'towel')
        self.assertEqual(selected['detection_status'], 'review')

    def test_padding_is_bounded_by_the_analyzed_guide(self):
        self.assertEqual(crop_bounds(Image.new('RGB',(100,100)), row(box=[0,.1,1,1])), (0,6,100,100))

    def test_weak_target_can_be_checked_but_is_not_a_reliable_detection(self):
        selected = self.select([row(score=.13)])
        self.assertEqual(selected['detection_status'], 'review')

    def test_person_query_survives_a_higher_fabric_query_in_same_patch(self):
        import torch
        logits = torch.full((1,1,len(detector.PROMPTS)), -10.)
        names = [name for name, _ in detector.PROMPTS]
        logits[0,0,names.index('person')] = 0.
        logits[0,0,names.index('cloth or fabric scrap')] = 2.
        outputs = SimpleNamespace(logits=logits, pred_boxes=torch.tensor([[[.5,.5,.8,.8]]]))
        actual = detector.person_context(outputs)
        self.assertEqual([value['name'] for value in actual], ['person'])
        self.assertAlmostEqual(actual[0]['score'], .5)


class RecognitionPresentationTests(SimpleTestCase):
    def result(self, decision='unknown_unsupported', **evidence):
        return recognition_result(SimpleNamespace(decision=decision, image_quality={'material_prediction':evidence}))

    def test_below_threshold_keeps_suggestion_without_promoting_the_decision(self):
        actual = self.result(raw_class='paper', status='classified', confidence=.79)
        self.assertEqual(actual['status'], 'needs_review')
        self.assertEqual(actual['suggested_label'], 'paper')

    def test_cup_is_unsupported_and_conflict_does_not_suggest_a_false_material(self):
        self.assertEqual(self.result(status='not_applicable')['status'], 'unsupported')
        conflict = self.result(status='conflicting_evidence', raw_class='pete_bottles')
        self.assertEqual(conflict['status'], 'needs_review')
        self.assertIsNone(conflict['suggested_label'])

    def test_user_confirmed_category_replaces_only_this_items_review_state(self):
        self.assertEqual(self.result(decision='paper', status='needs_review')['status'], 'supported')
