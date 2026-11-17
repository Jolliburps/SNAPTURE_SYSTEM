# Existing admin report CSV formatting

Updated 27 October 2026. Use the same **Reports → Generate Report → Export CSV**
button. Its location, date/type filters, session authorization, queries, audit
entry and full-result export behavior are unchanged. No database migration,
additional dependency or endpoint is required.

The original export used technical field names (`updated_at`, `material_type`),
internal report kinds (`materials`), UTC ISO timestamps and inconsistent blank
cells. Its existing UTF-8 BOM and standard CSV escaping were already working.
The formatter now preserves all 18 original fields in this order:

| Existing field | CSV heading |
| --- | --- |
| id | Record ID |
| type | Record Type |
| title | Title |
| category | Category |
| status | Status |
| updated_by | Responsible Staff |
| created_at | Created Date and Time (Asia/Manila) |
| updated_at | Last Updated Date and Time (Asia/Manila) |
| material_type | Material Type |
| effective_date | Effective Date |
| collection_date | Collection Date |
| start_time | Collection Start Time (Asia/Manila) |
| end_time | Collection End Time (Asia/Manila) |
| waste_type | Waste Type |
| barangay | Barangay |
| description | Description |
| content | Policy Content |
| notes | Schedule Notes |

Common identity, status, staff and audit dates come first; type-specific details
and long descriptions follow. Report types use the same readable names as the
web page: Policies, Educational Materials, Collection Schedules and Announcements.
Known statuses and category names remain unchanged. This report contains content
and schedules; it does not add private scans, corrected labels or dataset-review
fields that were never part of this export.

Creation/update timestamps convert to **Asia/Manila** and use
`YYYY-MM-DD HH:mm:ss`. For example, `2026-10-26T16:01:02Z` becomes
`2026-10-27 00:01:02`. Date-only fields retain `YYYY-MM-DD`; schedule times retain
`HH:mm`. Empty/inapplicable cells use `N/A`. Unexpected legacy values retain their
original meaning/text rather than receiving a guessed label or timezone.

The filename is `SNAPTURE_Admin_Report_<type>_<start>_to_<end>.csv`, consistently
in the server response and browser download. Every cell is quoted; embedded
commas, quotes and line breaks remain within the original cell. UTF-8 with a BOM
preserves Filipino/Unicode text in Excel, following
[Microsoft's CSV encoding guidance](https://support.microsoft.com/en-us/excel/opening-csv-utf-8-files-correctly-in-excel).

Formula-like text, including whitespace/full-width prefix variants, receives a
quoted tab prefix. Detection checks a normalized prefix without changing the
original stored text. This follows
[OWASP's Excel-resistant CSV mitigation](https://community.owasp.org/attacks/CSV_Injection).
The protective tab is part of the exported text for downstream parsers. CSV cannot
set spreadsheet colors, widths, cell types or universal protection after another
program edits/re-exports it; use text import when preserving literal cell values.

## Verification on this PC

- Exported the actual available report before and after: **3 records, 18 columns**
  in each. No synthetic records were added to the live database.
- Opened the real export read-only in installed Excel: **3 data rows, 18 columns,
  no formula cells**. Closed without saving.
- Opened a separate seven-record synthetic edge-case CSV in Excel: all columns,
  Unicode, commas/quotes and multiline text preserved; **no formula cells**.
- Backend tests cover date rollover, all four report types, unchanged filters,
  all 18 fields, 25 records beyond the 10-row UI page, unique record identities,
  empty reports, missing values, unknown values and formula-like strings.
- Browser tests exercise the existing Export CSV button and verify its filename
  and human-readable headers. Google Sheets was not directly tested and no report
  was uploaded to an external service.

Main implementation: `SNAPTURE_BACKEND/cesd/views.py` (existing CSV branch and
formatters), `SNAPTURE_ADMIN/src/pages/Reports.tsx` (download filename).
Regressions: `SNAPTURE_BACKEND/cesd/test_report_csv.py`, `cesd/tests.py`, and
`SNAPTURE_ADMIN/tests/management.spec.ts`.

Private local verification files are under `.tools/csv-formatting/` in the
workspace, outside the project repository. The actual exported report must not
be committed as a source fixture.
