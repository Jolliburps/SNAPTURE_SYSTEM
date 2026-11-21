"""Material inputs for one build of each built-in SNAPTURE design."""
import re


def fit(quantity, **dimensions):
    return {'minimum_quantity': quantity, 'dimensions': {
        name: ({'minimum': bounds[0], 'maximum': bounds[1]} if isinstance(bounds, tuple)
               else {'minimum': bounds}) for name, bounds in dimensions.items()
    }}


CATALOG_FIT = {
    'pete_planter': fit(1, capacity=500),
    'pete_organizer': fit(1, capacity=500),
    'pete_seed_set': fit(3, capacity=250),
    'hdpe_planter': fit(1, capacity=500),
    'hdpe_storage': fit(1, capacity=500),
    'hdpe_scoop': {**fit(1, capacity=1000), 'shapes': ['One-piece container with an intact molded handle']},
    'hdpe_small_parts': {**fit(1, capacity=(30, 250)), 'shapes': ['Container with an intact lid']},
    'cardboard_organizer': fit(1, length=250, width=180),
    'cardboard_divider': fit(3, length=180, width=120),
    'cardboard_craft': fit(1, length=80, width=60),
    'paper_gift_wrap': fit(1, length=297, width=210),
    'paper_organizer': fit(1, length=210, width=148),
    'paper_craft': fit(3, length=50, width=50),
    'fabric_cleaning_cloth': fit(1, length=180, width=180),
    'fabric_pouch': fit(2, length=150, width=120),
    'fabric_patchwork': fit(4, length=60, width=60),
    'coconut_planter': fit(1, diameter=90),
    'coconut_bowl': fit(1, diameter=80),
    'coconut_craft': fit(2, diameter=50),
    'wood_shelf': fit(3, length=200, width=100, thickness=15),
    'wood_marker': fit(1, length=100, width=15, thickness=3),
    'wood_craft': fit(1, length=60, width=40, thickness=5),
}

NUMBER = r'\d+(?:\.\d+)?'
PAPER = {'a3': (420, 297), 'a4': (297, 210), 'a5': (210, 148),
         'letter': (279.4, 215.9), 'legal': (355.6, 215.9)}


def estimated_dimensions(material, size):
    if not isinstance(size, str):
        return {}
    value = size.strip().casefold()
    if material in {'pete_bottles', 'hdpe_containers'}:
        match = re.fullmatch(rf'(?:about\s+)?({NUMBER})\s*(ml|l)', value)
        return {'capacity': float(match[1]) * (1000 if match[2] == 'l' else 1)} if match else {}
    if material in {'paper', 'cardboard'} and value in PAPER:
        return dict(zip(('length', 'width'), PAPER[value]))
    if material == 'coconut_shells':
        match = re.fullmatch(rf'(?:about\s+)?({NUMBER})\s*(mm|cm)', value)
        return {'diameter': float(match[1]) * (10 if match[2] == 'cm' else 1)} if match else {}
    match = re.fullmatch(rf'(?:about\s+)?({NUMBER})\s*[x×]\s*({NUMBER})(?:\s*[x×]\s*({NUMBER}))?\s*(mm|cm)', value)
    if not match:
        return {}
    factor = 10 if match[4] == 'cm' else 1
    length, width = sorted((float(match[1]) * factor, float(match[2]) * factor), reverse=True)
    result = {'length': length, 'width': width}
    if match[3]:
        result['thickness'] = float(match[3]) * factor
    return result
