# CESD reference adoption

Reviewed source folder: `C:\Users\My PC\Documents\S N A P T U R E\CESD`.
The eleven inspected files are pinned by SHA-256 in
`SNAPTURE_BACKEND/core/cesd_sources.py`. Originals remain unchanged in that folder.
They are not copied to public source control, served as media or used for model training.

## Applied to the prototype

- Learn now reads `/api/learning/`, showing only intact, published information
  entries. Each expandable entry includes its source, limitations and version.
- Six educational entries cover household hazardous-waste precautions, source
  segregation, potential recovery/sale, composting awareness, sanitation safety
  and CESD program/collection background. These are source-checked adaptations,
  not expert approval, CESD endorsement or current service announcements.
- A reported chemical/cleaning-product history can display the published
  household precaution entry during assessment, including on an unidentified
  item. The photo is not described as detecting hazardous contents. Existing
  no-upcycling safeguards remain in force.
- Assessment links to Learn for uncertain items. Unsupported material still has
  no automatic segregation label, disposal authorization or project approval.
- The existing calendar remains date-based and server-filtered to the user's
  selected barangay. No dates or truck times were invented from the interview.
- Six camera materials remain PETE bottles, HDPE containers, cardboard, paper,
  fabric scraps and dry untreated wood. No model training or accuracy claim
  results from adding reference documents.

## Source mapping and decisions

| Source | Use | Limits |
| --- | --- | --- |
| Ordinance PowerPoint, slides 3-5, 8-9 | Segregation and collection preparation context | Contains inconsistent ordinance labels and incomplete statements. No penalties or full legal interpretation imported. |
| Interview, sections 3, 7, 11, 14-15 | Recovery feature, separate collection context, privacy, date-only barangay calendar | Statements are interview evidence, not validated technical rules. The transcript itself contains uncertain passages. |
| Hazardous brochure front | Household precautions and asking barangay/CESD about arrangements | No named contractor accreditation or facility acceptance is assumed current. |
| Hazardous brochure inside | Review context only | Health-unit/infectious-waste procedures are not generalized into DIY household instructions. |
| Compost brochure front and inside | Educational composting summary | No automatic food-waste class, bottle-cutting project, fixed maturation time, vacuum-dust or animal/fish-waste recommendation. Conservative home-input restrictions cross-checked against US EPA. |
| Desludging brochure front and inside | Awareness and authorized-service referral | No booking, medical diagnosis, tank entry instructions, fixed household interval or provider availability. |
| Three regular-activity posters | Description of documented CESD work | Historical photos are not upcoming event notices, model examples or classifier labels. |

## Deliberately held for clarification

1. Interview sections 1 and 14 mix the seven original materials and seven plastic
   resin codes. The user's later decision to retain six materials takes priority.
   Changing to seven plastic classes needs adviser/client agreement and new data.
2. Fabric, colored paper, glass and plastic examples in the interview need
   item-specific written CESD acceptance rules. No blanket special/hazardous
   classification is inferred from color or material alone. Never instruct a user
   to break glass for sale.
3. WACS percentages lack the underlying dated survey report and methodology. They
   are not published as current city statistics or model performance.
4. 2027 collection/composting plans are not treated as current services. Need
   actual barangay dates, publishing officer and current approved notices.
5. Need complete ordinance text and confirmation of conflicting references,
   current local collection acceptance, appropriate composting method and
   signed-off upcycling instructions. EPR and biodegradable-plastic statements
   are not turned into app legal guidance.
6. Confirm current CESD contact channels and permission before redistributing the
   original brochures/photos or interview. The summaries do not use personal
   anecdotes, signatures, personnel names or interview quotations.

## Reproducible import

From `SNAPTURE_BACKEND`, using the project's Python environment:

```powershell
..\SNAPTURE_ML\.venv\Scripts\python.exe manage.py import_cesd_information --source-dir "C:\Users\My PC\Documents\S N A P T U R E\CESD"
```

The command verifies every expected source file before writing, is transactional,
does not overwrite existing versions or reactivate archived references, and does
not change accounts, scans, projects, datasets or collection dates. Revised files
must be reviewed and imported as a new content version. The command is an explicit
local source-check publication step, not an expert-review workflow.

Cross-checks used during source review:

- https://www.epa.gov/hw/household-hazardous-waste-hhw
- https://www.epa.gov/recycle/composting-home
- https://bacoor.gov.ph/downloads/arta/CitizensCharter2021.pdf (official archived
  ordinance context, not proof of present enforcement or latest legal text)

The library can be withdrawn or superseded through existing Django guidance
administration controls. Published-content digests prevent unreviewed edits from
appearing on the API or assessment.
