# SNAPTURE research evaluation scorecards

This update adds evaluation infrastructure, **not a newly trained model**. No real
accuracy, CESD endorsement, CVI, or recommendation-validity result has been invented.
The new tables start empty. Resident screens and existing safety gates are unchanged.

## Where to use it

- Mobile: log in as an administrator, then open **Research evaluation scorecards**.
  It is a read-only report viewer. Ordinary users cannot access the report APIs.
- Django: open `http://127.0.0.1:8000/admin/`, then **Research evaluation scorecards**.
  Use your existing staff account. Do not share credentials with residents.
- The Django run page has **Open evaluation scorecard**, with JSON and CSV downloads.
- Read-only bearer-token endpoints: `GET /api/evaluations/` and
  `GET /api/evaluations/<run_id>/?format=csv` (omit the format for JSON).

## 1. Define and lock the protocol before collecting outputs

Create an Evaluation run with:

1. A dataset version and either `validation` (development/tuning) or `test`
   (prespecified final held-out evaluation).
2. The actual scope, item sampling, capture conditions, baseline/comparator,
   acceptable reference outcomes, metrics and acceptance criteria. Have the TA
   approve these criteria before the final evaluation. There is no universal 80%
   pass mark built into the software.
3. Separation notes explaining how training/tuning photos, near duplicates,
   capture sessions and physical items are kept apart. Confirm held-out status only
   when you have checked it. The software cannot inspect every external dataset.
4. Select **Lock predefined protocols** in the run-list action menu. The protocol,
   split, dataset version and separation attestation then become read-only.

Use the same prespecified held-out items for a planned paired comparison of two
models, but keep each model in a separate run. If you change a model or threshold
after seeing final-test results, use a genuinely new untouched test set for a new
confirmatory claim. Calling that repeated tuning a "test" does not prevent leakage.

## 2. Prepare references and capture actual outputs

Qualified reviewers should label test cases independently, **before judging the
system's answer**. Use a separate blind reference sheet; record disagreements and
their resolution in the case notes. The software records the final adjudicated
reference, not multiple independent ratings or automatic inter-rater agreement.

Create an Evaluation case with an anonymous reference ID and physical-item group ID.
Select its actual prediction record. On saving, the application captures the stored
output once, including:

- original model class, score, threshold and model version;
- camera/manual origin and whole-image/detected-crop cohort;
- relevant reported conditions, quantities and material confirmations;
- the actual segregation instructions and offered recommendation versions.

No inference is rerun and no guidance refresh occurs during capture. Later user
corrections cannot turn the original raw model prediction into a correct one.
Resident names, emails, full photos and crop files are not copied into scorecards.
Use consented research photos and anonymous references; do not type personal details
into free-text fields. Deleting a source scan does not delete the captured text report.

Provide the true material, acceptable route names, whether clarification is needed,
whether any project is appropriate, and an explicit expert judgment of unsafe
segregation guidance. If review is required, leave acceptable unconditional routes
empty. A reference may permit multiple routes; the model is not forced to choose
one universal bin. Route names must match the reviewed local terminology exactly.

Supply reference sources, relevant reviewer expertise and adjudication notes.
The **Adjudicate references** action stamps the authenticated reviewer and date.
It requires `evaluations.review_evaluationcase`; being a resident is not sufficient.
Text declaring a qualification is an audit record, not independent verification of
credentials or evidence that CESD has endorsed the application.

## 3. Review each shown recommendation

Create one Recommendation judgment per captured recommendation ID, under its case.
The ID must exist in the captured output. Review all six criteria:

| Criterion | Question |
|---|---|
| Material suitability | Does it match the actual material? |
| Condition suitability | Is it appropriate for this condition and previous contents? |
| Safety | Are instructions and warnings suitable, without unsafe directions? |
| Instruction correctness | Are preparation and steps technically correct? |
| Practicality | Are tools and steps realistic for intended users? |
| Local applicability | Are local recovery claims and restrictions applicable? |

Use Pass / Needs revision / Reject, plus an explicit unsafe yes/no judgment and
evidence notes. A recommendation is acceptable only if **all six pass and unsafe is
false**. High practicality cannot cancel a failed safety criterion. A safety rejection
without a judgment of actual harm still fails acceptability; unsafe rate is the
reviewer's separate explicit harm judgment.

These are proposed SNAPTURE review criteria. Ask qualified experts and the TA to
validate the instrument before thesis use. CVI may assess the relevance of the
instrument's questions, but is not camera accuracy or recommendation correctness.
No CVI is calculated without the necessary independent relevance ratings.

## 4. Read the three scorecards separately

### Raw camera material identification

Per-material precision/recall/F1, unweighted macro-F1 over represented reference or
prediction labels, raw confusion matrix and raw accuracy. Missing categories have
no evidence, not a fabricated perfect score. The all-scope-classes indicator makes
incomplete coverage visible. Macro-F1 here is not an average over untested categories.

The raw confidence gate is evaluated separately: accepted-result correctness, acceptance
coverage, review rate, unsupported-item false acceptance, and a gated confusion
matrix with an extra Needs review column. A system that rejects every case does
not receive 100% accepted correctness. "Accepted" here means a raw model label passes
its confidence cutoff, not that the app has confirmed its identity, assigned a bin,
or approved a project. Manual selections are excluded entirely.

Whole-image and detected-crop results are also available separately in JSON.
**Crop classification does not measure missed objects, duplicate boxes or full-scene
detection.** Independent ground-truth boxes are still needed for detection mAP and
full-scene recall; these are explicitly not measured by this release.

### Segregation guidance

Acceptable-route-or-referral rate, unsafe-guidance rate, appropriate requests for
review, and unnecessary requests for review. Each metric exposes its numerator
and denominator. These are custom case-level measures against reviewed references,
not a published universal waste-validation instrument.

### Recycling / upcycling recommendations

Acceptability and unsafe rates among expert-judged shown ideas, judgment coverage,
eligible cases receiving at least one acceptable idea, and appropriate withholding
for ineligible cases. Unjudged ideas remain visibly pending and cannot be silently
counted as valid. Case-level idea/withholding measures use fully judged cases only.
No fixed-k ranking has been evaluated, so Precision@k and nDCG are not claimed.

Proportion metrics include Wilson 95% intervals and sample counts. These assume
independent items, not many near-identical photos of the same object. Raw F1 has no
fabricated confidence interval. There is no combined "overall AI accuracy" percentage.

## 5. Freeze and export the final report

Select **Freeze reviewed scorecards**. Freezing requires a locked protocol, complete
adjudication, all shown ideas judged, a single camera-model version, and one case per
physical-item group. Final-test runs also need held-out documentation and no group
overlap with recorded validation runs for the same dataset version.

Freezing does **not** require favorable results: a failed or unsafe system must be
reportable. The stored report, case references and recommendation judgments then
become read-only in the normal application. Reference edits before freezing clear
the case approval and invalidate older recommendation judgments until re-reviewed.
Snapshots have integrity hashes; they are not cryptographically signed evidence
against someone with unrestricted direct database access.

Inspect failure cases, then fix labels, collect missing examples, revise guidance
through its existing publication workflow, or tune on validation data. Create a new
run for the revised model. **No score automatically retrains a model, changes a
threshold, or publishes/approves guidance.** This preserves the existing source and
safety controls while creating evidence for subsequent improvements.

## Methods and limits

- Classification report and confusion matrix:
  https://scikit-learn.org/stable/modules/generated/sklearn.metrics.classification_report.html
- Detection evaluation requires ground-truth boxes:
  https://github.com/cocodataset/cocodataset.github.io/blob/master/dataset/detection-eval.htm
- Wilson proportion intervals (Wilson, 1927):
  https://doi.org/10.1080/01621459.1927.10502953
- Content validity is distinct from predictive validity (Polit, Beck & Owen, 2007):
  https://doi.org/10.1002/nur.20199

No new paid API, external image upload, dependency, invented expert judgment or
automatic claim of improved field accuracy is introduced by this implementation.
