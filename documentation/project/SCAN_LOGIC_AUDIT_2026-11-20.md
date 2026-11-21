# Scan logic and TC photo procedure audit

Implemented November 20, 2026. The user approved blocking upcycling progress until AI checking is available and adding a small Recheck step photo action using the existing design.

## Logic changes

Scan session metadata must use arrays whose lengths match supplemental uploads. Explicit session requests require same-item confirmation even with one photo. Additional views cannot be submitted through the multi-item route, which cannot correctly attach those views. Existing legacy single-image requests remain compatible.

Unfinished photo procedures count only consecutive AI-matched steps. Unavailable, failed, retake or correction responses do not unlock the next step. Completion independently checks every step's AI evidence; stored checklist indices cannot bypass this check. The accepted final photo is copied to the completed project, and existing idempotent completion and inventory handling are preserved.

Saved unchecked photos can be rechecked by photo ID on the same owner-scoped step endpoint. A recheck updates the existing evidence record rather than duplicating its image. Photos rejected with usable correction feedback require a fresh photo. Completed output remains locked. Previously completed documentary records keep their original verification status; unfinished documentary progress needs checking before it can clear the new workflow.

The procedure reconciles its selected step after retrieving current server progress, including reopening older unfinished projects. Refresh and resume cannot leave the user stranded on a later unchecked step.

## Visible changes approved by the user

- Recheck step photo: uses the existing ghost Action style, inside the current step card. It appears only for unchecked saved evidence and is disabled while busy or earlier steps are unresolved.
- Existing explanatory text states that AI checking is required and unavailable checking keeps the next step locked.

No new screen, navigation route, module, layout, color, typography or icon system was introduced. No model replacement or database migration was made.

## Remaining dependency

SNAPTURE_VISUAL_ASSESSOR is still unconfigured. These fixes enforce the requested gate; they do not supply a vision model or establish real-world craft-stage accuracy. A capable service, sourced project checkpoint criteria and representative physical-item validation remain necessary. No arbitrary cardboard/PETE damage percentage was invented. Multi-view same-item identity remains a user confirmation, not an AI guarantee.

## Validation

267 backend core, prediction and upcycling tests passed. Fifteen targeted Android tests passed across the scan session, saved results, suitability, photo procedure and My Projects connection. TypeScript passed. These tests use fixture model outputs and do not certify model accuracy. One Android run exceeded its 5-second test startup timeout during parallel ML loading; the complete targeted run passed with a 20-second test timeout.
