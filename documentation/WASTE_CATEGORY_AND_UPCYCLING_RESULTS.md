# Waste category and upcycling results

Implemented November 19, 2026.

Waste routing is separate from the seven supported upcycling materials. A
recognized object outside those materials can display its waste category without
being admitted to the upcycling catalog. Accepted detector labels use the
existing waste taxonomy; a missing material-model score is not an absent object
detection score. Uncertain objects still require review.

SNAPTURE routes recognized or user-reported glass to **Hazardous Waste** as an
injury precaution because broken glass can cause injuries. This is an application
policy, not a claim that all intact glass is legally classified as hazardous.
Glass displays **Not Eligible for Upcycling**, cannot request recommendations,
and retains the advice not to break or crush it. Older eligible screening
snapshots cannot override this exclusion. Raw model evidence and the seven
upcycling material labels remain separate from the displayed waste category.

The **No checked local rule yet** card was the default advice when a confirmed
material had no published reviewed sorting rule and no more specific advice
applied. It did not control upcycling eligibility. The default card is now hidden;
specific handling advice, safety instructions, and expandable sources remain.
The backend still tracks missing rules and does not invent local acceptance.

Validation:

- Backend: 245 tests passed across `core` and `predictions`.
- Mobile: 59 tests passed across WasteCategoryPresentation,
  ScreeningSeparation, QuickAssessment, DetectionAccordion, TextilePresentation,
  and SavedScanReview. Two initial timing failures passed with a 20-second test
  timeout.
- TypeScript: `tsc --noEmit` passed.

Validation covers rules and rendered components. No new model training, physical
photo inference verification, Android APK build, or device installation was done.
