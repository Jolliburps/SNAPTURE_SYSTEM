# Scan runtime blocked by Windows Smart App Control

Investigated the phone's “Detection could not complete” screen on 19 November
2026. The upload reaches the scan API; the installed inference dependencies
cannot load under the active Windows application-control policy.

## Evidence

- Live `GET http://127.0.0.1:8000/api/health/`: HTTP 200 with `status: degraded`,
  `model.loaded: false`, and `DLL load failed while importing _ml_dtypes_ext:
  An Application Control policy has blocked this file.`
- Actual local detector invocation reproduces `ImportError` loading the
  `regex/_regex.cp313-win_amd64.pyd` dependency. It also fails in a fresh process
  run as the Windows user outside the tool sandbox.
- Windows Code Integrity Operational event **3077** names these binaries and
  policy `{0283ac0f-fff1-49ae-ada1-8a933130cad6}`. The Smart App Control registry
  state is `VerifiedAndReputablePolicyState: 1` (enabled).
- Microsoft's inbox-policy documentation identifies that policy as
  `VerifiedAndReputableDesktop`, used when Smart App Control is on:
  <https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/operations/inbox-appcontrol-policies>.
- Local package RECORD checks match both blocked files. This checks installation
  consistency; it does not establish a Microsoft trust verdict.

| Dependency | Installed version | Blocked binary SHA-256 |
| --- | --- | --- |
| ml-dtypes | 0.7.0 | `04ca84549f2278c9c52f4e5f4c1bcb2a93a20da22bcb70bc96f7f020d5239438` |
| regex | 2026.11.15 | `ba577158c33beb9807d7f9a22b6881a1a4fa701a135cea6f99f655ebd8404105` |

The original detector/model binaries are present. Retaking the paper photo
does not address this system-level import failure. No accuracy conclusion was
drawn from the diagnostic synthetic image: inference was blocked before it ran.

## Safe code correction

`SNAPTURE_BACKEND/predictions/scene_views.py` now returns an actionable PC-side
security/runtime message for this particular exception instead of suggesting
another photo. It keeps HTTP 503, logs the original traceback, and retains the
existing cleanup and inference-lock release behavior. A regression test in
`predictions/test_scenes.py` checks that message, absence of partial records,
released lock and successful retry after the mocked block is removed.

Validation: `manage.py test predictions.test_scenes predictions.test_single_item_frame
--noinput --verbosity 0` passed **39 tests** in an isolated test database. These
mock the inference boundary; they do not override the actual native DLL block.

Original files: `history/scan-runtime-diagnostics-2026-11-19/`, retaining their
project-relative paths. Restore those two files to undo this message correction.
No Windows policy, exclusions, dependency versions, model weights, datasets,
database settings or existing saved projects were changed.

## Remaining decision

Actual inference remains blocked. A fresh process did not resolve the policy
failure. The earlier 18 November runtime recovery report is historical evidence,
not proof of current readiness.

Microsoft states that Smart App Control has no per-app exception mechanism:
<https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions>.
Changing it affects protection for the PC, so an explicit user choice is required
before any such setting change. The user was offered keeping it enabled and
investigating a compatible runtime, or guidance through changing that setting.
No setting change has been attempted.

After resolving the runtime block, restart Terminal 1 using `START_BACKEND.ps1`
to clear the cached classifier startup failure. Verify `/api/health/` reports
`status: ok` and `model.loaded: true`, then rerun the detector diagnostic and
retry the phone scan. A successful health check alone does not verify OWL-ViT.

Diagnostic artifacts are under `.run-logs/`: `scan-runtime-reproduction*.log`,
`scan-native-imports.log`, `scan-blocked-binaries.json`,
`scan-code-integrity-events.json`, and `reproduce_scan_runtime.py`.
