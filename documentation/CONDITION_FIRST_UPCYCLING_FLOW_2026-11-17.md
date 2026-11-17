# Condition before upcycling recommendations

## Behavior

- One usable detected item is selected automatically. Choosing its condition advances without another Continue button.
- Clean and dry: save the reported condition through the existing selection API, then show the recommendation page.
- Needs cleaning: show the item's existing preparation guidance on a separate page. Finish reports that cleaning and drying are complete, saves Clean and dry, and opens recommendations. No extra checkboxes are required.
- A failed save retains the cleaning page and allows Finish to retry.
- Damaged, contaminated, and Not sure: show handling guidance rather than project choices. Change item condition returns to the condition page.
- Saved items still marked Needs cleaning resume preparation.
- Multiple selected items retain a Continue action; any item needing cleaning goes through preparation before recommendations.
- Choosing a project continues to use the existing guide with Mark as done for each step and Finish after the steps.

Finishing cleaning is a user report, not visual verification of contamination, resin type, or safety. Existing recognition and recommendation eligibility rules remain in place. An unsupported or unsuitable item is not guaranteed a project merely because Clean and dry is selected.

## Files

- `SNAPTURE_ANDROID/src/CleaningPreparation.tsx`: separate preparation page.
- `SNAPTURE_ANDROID/src/SceneResults.tsx`: condition-first routing and save/retry behavior.
- `SNAPTURE_ANDROID/src/DisposalObjectRow.tsx`: no inline recommendations before condition review.
- `SNAPTURE_ANDROID/src/ItemActionAdvice.tsx`: condition gate for project choices.
- `SNAPTURE_ANDROID/src/LocalizedText.tsx`: Filipino copy for the new flow.
- `SNAPTURE_ANDROID/__tests__/ConditionFlow.test.tsx`: navigation, API condition, guide selection, retry, and saved-item coverage.
- `SNAPTURE_ANDROID/__tests__/ItemActionAdvice.test.tsx`: clean-condition project choices and non-clean condition gating.

## Validation

26 targeted tests pass across condition flow, scene results, project guidance, item advice, and idea selection. TypeScript and ESLint checks pass. No backend, model, or dataset changes were made for this request.

The wireless phone is connected and Metro/backend are listening. Live visual verification was blocked by the phone lock screen. No changed app screen was captured or claimed as verified on the device.
