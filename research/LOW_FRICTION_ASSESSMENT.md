# Sorting first, optional reuse second

Updated 2026-10-21, assessment-v3. No numbered onboarding panels or camera-layout redesign.

## Problems found

- Saving showed a generic success popup and left the user in the same long form, with outcomes below it.
- A newly selected material acquired its specific questions only after saving. The backend also removed freshly submitted paper/wood/condition answers when changing materials, forcing another round.
- Quantity and extra reuse-suitability questions were requested even when only sorting was wanted or no reviewed project existed.
- Scene progress depended on quantity and all project questions, making a completed sorting check look unfinished.

## Implementation

- The backend supplies separate sorting and project question IDs plus actual published-rule/project availability. The app fetches the new material's questions before saving.
- One explicit 'clean, dry and no residue' choice records those three user reports; no safe values are preselected and no facts are inferred from the image. Alternative condition choices and full optional details remain available.
- Material confirmation is compact. Plastic resin still needs an actual code; no duplicate 'looks right' approval is needed before answering the resin question.
- Ordinary sorting does not ask for quantity. Optional reuse asks for it only when an expert-reviewed project exists. No new guide is invented or unlocked by this UX change.
- A successful check immediately switches to a separate, top-positioned advice view. It shows a concrete next action, an honest unavailable-rule message, or a precaution. No generic extra OK tap. Project-saving/research-consent confirmations retain the shared success dialog.
- Done returns to the appropriate previous screen. Editing answers remains secondary. Existing answers persist; failed requests preserve drafts. Unknown/skip never implies a verified bin assignment.
- Known special-handling and already-checked items open advice directly instead of repeating the form. A missing local rule is explained without requesting irrelevant answers.
- Scientific detail and source traces remain available through a disclosure; a short uncertainty/safety note stays visible.
- Scene checks count a saved user review independently of quantity and bin approval. A server-written review timestamp is not a verified material or model-correctness label. Reopening a saved review goes straight to its next action.

## Verification and limits

Automated tests cover the single-save material-change fix, fresh dynamic questions, no default clean/history answers, no quantity for sorting, immediate advice and Done, preserved failure drafts, unknown and hazard endings, existing project confirmations and research consent. Existing user scans and project progress are not rewritten by the implementation. No migration is needed.

This reduces interaction burden; it does not establish better model accuracy or local waste acceptance. CESD-reviewed disposal rules and validated detection data are still required. Do not claim measured improvements in motivation, task time or segregation behavior without a usability study with residents.
