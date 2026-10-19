"""Publish explicitly labeled public-source references, never CESD approval."""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.content import digest
from core.models import Guidance

EPA = "US EPA, How Do I Recycle Common Recyclables (Paper/Cardboard; Plastics), accessed 2026-10-18: https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables"
HANDBOOK = "US EPA, Consumer's Handbook for Reducing Solid Waste, EPA 530-K-96-003, reuse suggestions; accessed 2026-10-18: https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P100047Q.TXT"
EMB = "DENR-EMB/NSWMC, Sampulna: Solid waste segregation remains a major challenge in PH (2022), general source-segregation context, accessed 2026-10-18: https://nswmc.emb.gov.ph/sampulna-solid-waste-segregation-remains-a-major-challenge-in-ph/"
NOTE = "Prepared from named public sources. Not CESD-approved or independently expert-tested. Confirm local acceptance; steps are conservative adaptations, not a safety certification."
PAPER = "Plain uncoated material without personal details"
BASE = {"condition": ["Clean and dry"], "previous_contents": ["Water or beverage", "Food or oil", "No chemical contact known"]}


def references():
    for label in ("paper", "cardboard", "pete_bottles", "hdpe_containers"):
        requirements = dict(BASE)
        if label in {"paper", "cardboard"}:
            requirements["paper_surface"] = [PAPER]
        else:
            requirements["resin_mark"] = ["PET/PETE code 1" if label == "pete_bottles" else "HDPE code 2"]
        yield dict(key=f"reference-{label}-recovery", kind="segregation", material=label,
                   title="Separate clean material for potential recovery", category="Potentially recyclable - confirm local acceptance",
                   requirements=requirements, instructions=["Keep this material separate and dry.", "Ask your barangay or receiving facility whether it accepts this item before collection."], source=EMB + "\n" + EPA)
    projects = [
        ("paper", "paper-gift-wrap", "Use paper as non-food gift wrapping", ["Plain clean paper", "String or reusable tape"],
         ["Choose a dry sheet without personal details.", "Fold it around a non-food gift and secure it.", "Keep usable paper for another use."], {"paper_surface": [PAPER]}),
        ("cardboard", "cardboard-craft-base", "Cardboard base for a decorative collage", ["Plain cardboard", "Clean paper offcuts", "Craft adhesive"],
         ["Choose a clean, flat piece without personal details.", "Arrange paper offcuts on the surface.", "Attach them using the adhesive instructions; keep it decorative."], {"paper_surface": [PAPER]}),
        ("fabric_scraps", "fabric-dusting-cloth", "Repurpose a fabric offcut for dusting", ["Clean dry fabric offcut"],
         ["Choose a washable offcut with no pins or sharp attachments.", "Use it to dust a non-food surface.", "Launder according to the fabric's care instructions."], {}),
    ]
    for label, key, title, materials, steps, extra in projects:
        yield dict(key=key, kind="project", material=label, title=title,
                   summary="Low-complexity reuse idea adapted from public waste-reduction guidance; check the item details first.",
                   requirements={**BASE, **extra}, materials=materials, instructions=steps, source=HANDBOOK + "\n" + EPA,
                   warnings="Non-food, non-structural use only. No burning, melting, chemical treatment or electrical work. Do not use contaminated material. Stop if suitability is uncertain.")


class Command(BaseCommand):
    help = "Load source-checked public references. Does not claim CESD or expert approval; never overwrites existing versions."

    @transaction.atomic
    def handle(self, *args, **options):
        created = 0
        for values in references():
            if Guidance.objects.filter(key=values["key"], version=1).exists():
                continue
            now = timezone.now()
            entry = Guidance(**values, version=1, review_level="source_checked", review_note=NOTE,
                             state="published", reviewed_at=now, published_at=now)
            entry.content_digest = digest(entry)
            entry.full_clean()
            entry.save()
            created += 1
        self.stdout.write(self.style.SUCCESS(f"Added {created} public-source reference versions (not CESD-approved)."))
