"""Choose one principal region without treating a holding hand as waste."""
from . import scene_detector as detector


VERSION = 'principal-region-v3'
HOLDING_PARTS = {'human hand', 'human arm'}
# Clothing alone is not proof of a person: a held towel can match that query.
CONTEXT_NAMES = detector.HUMAN_NAMES | {'dog', 'cat', 'animal'}


class FrameReviewRequired(ValueError):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


def area(box):
    return max(0, box[2] - box[0]) * max(0, box[3] - box[1])


def same_region(first, second):
    """Require comparable sizes as well as overlap, preserving distinct items."""
    a, b = first['box'], second['box']
    overlap = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    small, large = sorted((area(a), area(b)))
    return detector.iou(a, b) >= .5 or (small > 0 and overlap / small >= .85 and small / large >= .5)


def supported_query(row):
    from core.materials import SCOPE_LABELS
    from .material_classifier import PLASTIC_PROMPTS
    return row.get('material') in SCOPE_LABELS or row['name'] in PLASTIC_PROMPTS


def select_region(rows, truncated=False, faces_present=False):
    """Geometric rules are provisional and recorded for subsequent evaluation."""
    if truncated:
        raise FrameReviewRequired('uncertain_single_item', 'Move closer to one item and keep it inside the border.')
    # Context is excluded from target selection, not used as a veto. Recheck
    # target presentation without people/animal rows so overlap alone cannot
    # demote a held sheet or fabric item.
    targets_only = detector.presentation([row for row in rows if row['name'] not in CONTEXT_NAMES])
    candidates = [row for row in targets_only if row['name'] not in CONTEXT_NAMES
                  and row['name'] != 'unfamiliar discarded object'
                  and row.get('detection_status') != 'duplicate'
                  and row['score'] >= detector.DISPLAY_THRESHOLD]
    # Cluster against a fixed representative so chains of touching boxes cannot
    # turn several objects into one large region.
    groups = []
    for row in sorted(candidates, key=lambda value: value['score'], reverse=True):
        group = next((group for group in groups if same_region(row, group[0])), None)
        if group is None:
            groups.append([row])
        else:
            group.append(row)

    # An identifiable foreground target can sit over a keyboard or monitor.
    # Only ignore a containing background region when the target is smaller
    # and near the guide center. Two separate substantial items still reject.
    targets = [group for group in groups if any(supported_query(row) for row in group)]
    if len(targets) == 1:
        target = targets[0][0]
        x1, y1, x2, y2 = target['box']
        centered = .2 <= (x1 + x2) / 2 <= .8 and .2 <= (y1 + y2) / 2 <= .8
        if centered:
            groups = [group for group in groups if group is targets[0] or not (
                group[0]['name'] in detector.BACKGROUND_NAMES and
                area(target['box']) < area(group[0]['box']) * .5 and
                group[0]['box'][0] <= x1 and group[0]['box'][1] <= y1 and
                group[0]['box'][2] >= x2 and group[0]['box'][3] >= y2)]

    if len(groups) > 1:
        # A clearly dominant, centered foreground region may have smaller
        # surrounding objects. Comparable targets still require a closer shot.
        def prominence(group):
            proposal = group[0]
            x1, y1, x2, y2 = proposal['box']
            distance = abs((x1+x2)/2-.5) + abs((y1+y2)/2-.5)
            return area(proposal['box']) * max(.25, 1-distance) * proposal['score']
        ranked = sorted(groups, key=prominence, reverse=True)
        target = ranked[0][0]
        if (supported_query(target) and area(target['box']) >= .2 and
                prominence(ranked[0]) >= 1.8 * prominence(ranked[1])):
            groups = [ranked[0]]
    if len(groups) > 1:
        raise FrameReviewRequired('multiple_items_in_frame', 'More than one separate item was found. Move closer to the item you want to scan.')
    if not groups:
        weak_targets = [row for row in targets_only if supported_query(row)
                        and row['score'] >= detector.MIN_PROPOSAL_SCORE]
        if weak_targets:
            selected = dict(max(weak_targets, key=lambda row: row['score']))
            selected.update(detection_status='review',
                            detection_reason='The object outline is uncertain. Check the material or retake.')
            return selected
        if faces_present or any(row['name'] in CONTEXT_NAMES and row['score'] >= detector.DISPLAY_THRESHOLD for row in rows):
            raise FrameReviewRequired('main_object_not_found', 'The main item could not be located. Move closer so the item fills more of the border.')
        return None

    group = groups[0]
    selected = dict(group[0])
    # Same-region disagreements require a material check, not a second box.
    if len(group) > 1:
        selected['alternatives'] = [
            *selected.get('alternatives', []),
            *[{'label': row['name'], 'score': row['score']} for row in group[1:]],
        ]
        if len({detector.family(row['name']) for row in group}) > 1:
            selected.update(detection_status='review',
                            detection_reason='Overlapping object suggestions disagree. Check the material.')
    return selected


def crop_bounds(image, row):
    """Use one padded object crop for classification and its stored preview."""
    x1, y1, x2, y2 = row['box']
    pad_x, pad_y = (x2 - x1) * .04, (y2 - y1) * .04
    return (max(0, int((x1 - pad_x) * image.width)),
            max(0, int((y1 - pad_y) * image.height)),
            min(image.width, round((x2 + pad_x) * image.width)),
            min(image.height, round((y2 + pad_y) * image.height)))
