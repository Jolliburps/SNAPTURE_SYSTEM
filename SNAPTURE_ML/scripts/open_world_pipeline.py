"""Research adapter example, NOT wired to production and NOT a trained waste model.

Inject a tested class-agnostic proposer and calibrated fine-class classifier. No
model download, paid API, automatic training, or invented missing-object boxes.
"""
import math


def proposed_objects(image, propose, classify, threshold=.55, minimum_margin=.10):
    """propose -> normalized xyxy boxes; classify(crop) -> [(label, score)], OOD flag.

    Scores must be calibrated on held-out local validation data before interpreting
    the threshold. Max score/margin is only a rejection baseline, not proof of OOD.
    Every *valid proposed* region is kept, even with no classification candidates.
    """
    results = []
    for box in propose(image):
        if len(box) != 4 or any(not math.isfinite(float(v)) or not 0 <= v <= 1 for v in box):
            continue
        x1,y1,x2,y2 = box
        if x2 <= x1 or y2 <= y1:
            continue
        crop = image.crop((int(x1*image.width),int(y1*image.height),max(int(x1*image.width)+1,int(x2*image.width)),max(int(y1*image.height)+1,int(y2*image.height))))
        candidates, out_of_distribution = classify(crop)
        candidates = sorted([(name,float(score)) for name,score in candidates if isinstance(name,str) and math.isfinite(float(score)) and 0 <= float(score) <= 1],key=lambda row:row[1],reverse=True)[:3]
        first = candidates[0][1] if candidates else 0
        margin = first-(candidates[1][1] if len(candidates)>1 else 0)
        unidentified = not candidates or out_of_distribution or first < threshold or margin < minimum_margin
        results.append({'box':list(box),'fine_class':None if unidentified else candidates[0][0],
                        'confidence':first,'top_predictions':[{'label':name,'score':score} for name,score in candidates],
                        'needs_confirmation':unidentified,'safety_gate_passed':False})
    return results


def sam2_proposer(mask_generator):
    """Wrap an explicitly installed SAM2AutomaticMaskGenerator; no download.

    Run only in an offline experiment with a locally licensed checkpoint. Masks
    may cover object parts or miss items. Use an evaluated mask deduplication
    policy before deployment, and disclose any proposal/resource budget.
    """
    def propose(image):
        import numpy as np
        for proposal in mask_generator.generate(np.asarray(image.convert('RGB'))):
            x,y,width,height = proposal['bbox']
            yield [max(0,x/image.width),max(0,y/image.height),min(1,(x+width)/image.width),min(1,(y+height)/image.height)]
    return propose
