# Home Recommendations and Waste update

Implemented November 20, 2026 following the reviewed navigation proposal.

Home now owns My projects, Saved / favorite projects and My scans. Their previous Profile shortcuts, Home search, the ongoing-project duplicate and the Home idea carousel were removed. My projects opens the unified project list, including completed work. Scan history returns to Home. Profile retains account information, Collection and Ratings, and the existing barangay editor labeled Barangay Residence.

The Learn tab now displays Recommendations. It combines published upcycling entries, photo ideas, idea references and home tutorials from all material guides, deduplicated by material and stable project ID. Search matches title, material and summary, and combines with material filtering. Existing idea detail photos, instructions, source and review status are retained. Catalog browsing does not change item eligibility.

All seven Waste detail pages include a bundled photographic example, captions, source links and condition/preparation guidance. Photographs were downloaded from Pexels with their source and license recorded in `SNAPTURE_ANDROID/src/assets/material-examples/sources.json`. Plastic resin and wood treatment are explicitly not inferred from the photos; household cleaning-product containers are examples of a material type, not reuse approval. Recycling and disposal guidance panels were removed from these detail pages. Item-specific handling elsewhere remains available.

The transcript's unclear 70% cardboard example was not converted into a numeric safety threshold. The library explains project-specific condition, dimensions and quantity requirements, and distinguishes AI confidence from eligibility. No classifier, suitability rule, database or existing record was changed.

Validation: TypeScript passed; 22 targeted Android tests passed across MaterialConditionGuide, ProjectNavigation, ProfileSettingsNavigation and SavedScanReview. Metro compiled the updated Android bundle with HTTP 200. The connected debug phone was reloaded, and its rendered Home shortcuts and final one-line Recommendations navigation label were visually checked. Full physical-device interaction testing of every category remains outstanding.
