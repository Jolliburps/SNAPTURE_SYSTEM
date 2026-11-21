# Adding and maintaining upcycling projects

The existing Django `core.Guidance` database is the source of live recommendations. Detection code and mobile screens contain no independently eligible project catalog. The old 21 entries are preserved in `core/data/legacy_upcycling_catalog.json` and imported as **unpublished drafts**. Their existence is not expert validation.

Start the existing web admin from the T4 block in `RUN_COMMANDS.txt`, while T1/backend is running. Use **Upcycling Projects** in the navigation. No owner account was created in this setup because resident testing was requested first. When ready, use the existing `create_cesd_owner` management command interactively; never put a password in a command or document.

## Workflow

1. An authorized CESD owner or staff member with `core.change_guidance` creates/edits a draft. Supply a stable project key, name, compatible material, optional material type, minimum quantity, summary, tools/materials, ordered steps, difficulty, safety restrictions and optional reference-image URL.
2. Supply real source evidence and review notes. Use one tool or instruction per line. The form keeps multiline values intact until Save draft.
3. Define requirements using the existing exact answer wording plus a household goal and a physical fit rule. Unknown values do not match. The admin form validates material-specific object types, shapes and dimensions.
4. A qualified reviewer with the separate **`core.review_guidance` permission** reviews the current draft, then publishes it. Being an owner alone does not grant this permission. Reviewer identity, date and content digest are recorded through the existing review mechanism. A source citation alone does not validate a DIY procedure.
5. Publish only instructions whose material/quantity/condition and physical-fit assumptions, sources and restrictions have actually been reviewed. Expert-reviewed projects need condition, goals, object types, shapes and at least one dimension or area bound. The UI never supplies reviewer evidence for you.
6. Use Deactivate to archive a version. Use New version to update reviewed/published content; edit/review/publish the new draft. Existing review digests remain immutable. Existing policy treats the latest version as authoritative: creating a newer draft withholds the older published version until the new version is published.

Only the latest published, digest-valid, expert-reviewed project for a key can match. It must match the item's confirmed supported material, optional reported material type, resident-selected household goal, actual object type and shape, required dimensions, each condition/history requirement, and sufficient whole-number quantity. Optional resident preferences include maximum minutes, maximum PHP, difficulty ceiling, and supplies already available. A filter is applied only when the resident fills it; then projects with unknown corresponding metadata are excluded. Project time and cost are explicit reviewed estimates, not generated values. Filipino users see only projects with a complete reviewed Filipino translation; otherwise they get a no-match message rather than English project instructions under a Filipino preference. Existing material/contamination/resin/wood-history checks remain in force. Multiple matching projects are returned; no match produces no invented alternative. Each object is assessed separately; quantities are user reports, not quantities pooled across unrelated detections.

## Dimension and need rules

Residents can optionally check reuse ideas after sorting advice. The flow asks what they hope to do (`organize`, `grow_plants`, `decorate`, or `other`), selects a supported object type and shape, and asks for actual dimensions. Lengths are entered in centimetres and stored in millimetres; printed capacity is optional in ml. Required dimensions cover PET bottles (height and diameter), HDPE containers (length, width and height), cardboard, paper and fabric (length and width), untreated wood (length, width and thickness), and coconut shells (diameter and depth). Thickness/capacity are optional where relevant. Quantity, clean condition and material history remain separate eligibility inputs.

Example requirements for a cardboard box project:

```json
{
  "condition": ["Clean and dry"],
  "paper_surface": ["Plain uncoated material without personal details"],
  "goals": ["organize"],
  "physical": {
    "object_types": ["box"],
    "shapes": ["box_like"],
    "dimensions_mm": {
      "length_mm": {"min": 100, "max": 400},
      "width_mm": {"min": 80, "max": 300}
    }
  }
}
```

Optional reviewed fields can extend the same requirements JSON:

```json
{
  "preferences": {
    "time_minutes": {"max": 90},
    "budget_php": {"max": 250},
    "required_materials": ["scissors", "glue"]
  },
  "translations": {
    "fil": {
      "title": "...",
      "summary": "...",
      "materials": ["..."],
      "steps": ["..."],
      "safety_note": "..."
    }
  }
}
```

Every Filipino field must be supplied together and reviewed with the project. Editing these values changes the content digest; publish changes through the existing draft, review and publish workflow. The mobile language preference is stored locally and the selected locale, measured dimensions, project filters, and recommendation snapshot are stored on each updated scan. A saved project retains its translated steps and the suitability inputs used when it was started.

Photo pixels, detector boxes and model confidence never supply a physical measurement. An unmeasured, estimated, unsupported or out-of-range object produces no eligible recommendation. The database schema already stores the resident answers and the project requirements; no migration or edits to the live database are needed. The existing 21 imported ideas remain drafts pending qualified review and complete suitability requirements.

The public library may show published source-checked references as read-only information. These references cannot start a project without the separate item eligibility checks.

## Existing data

Project IDs returned by reviewed rules remain versioned (`project_key:v1`). The import retains the original legacy key text; existing saved projects retain their IDs, steps, timestamps and progress. Starting/changing a project is checked against current published rules. Reopening saved scan/project content reads its saved snapshot and does not run detection again. Archiving content does not erase historical snapshots.

Migration `core.0004_recommendation_metadata` adds only optional material type, difficulty and reference-image fields to Guidance. It does not change resident, scan, authentication or project tables. The migration has already been applied locally. For another checkout, run migrations before starting the backend. To import missing legacy drafts idempotently:

```powershell
Set-Location 'C:\Users\Jude\Desktop\SNAPTURE\SNAPTURE--main'
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py migrate
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py import_upcycling_drafts
```

The import never publishes anything and preserves existing versions and edits. The local 21 drafts need real review before they can become resident recommendations.
