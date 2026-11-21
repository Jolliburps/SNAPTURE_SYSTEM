# Wireless testing and network reliability report

Completed 26 October 2026 on the existing local working tree. Earlier feature
and documentation changes were preserved. No dependencies were installed or
upgraded, no backend/authentication model was replaced, and no datasets, model
weights, account/passwords or stored scan/project records were changed.

## Working setup and user confirmation

The TECNO connected through Android's authorized wireless ADB transport. It was
already paired; no new pairing code was requested, stored or printed. After
restoring reverse 8000 and 8081, separate HTTP probes originating on the phone
returned 200 from Django and Metro. The user unplugged USB and confirmed the app
worked. A later device listing contained only the wireless transport, and both
phone probes still returned 200.

Django, Metro and Vite were not running initially. One existing launcher for each
was started with timestamped private local logs; no database migration or owner
recreation ran. Web page/proxied CSRF checks returned 200; an anonymous web-session
lookup correctly returned 401. The user signed in privately and confirmed that
the admin dashboard worked cleanly. No credential was supplied to the agent.
These three services remain running. Startup commands now detect occupied ports
and avoid duplicate copies; a listener alone is not falsely labeled a healthy
SNAPTURE service, so Doctor still verifies the HTTP endpoints.

## Created and changed files

| File | Change |
| --- | --- |
| SNAPTURE_ANDROID/scripts/android-dev.cjs | Bounded device, pairing/connect, forwarding, discovery, doctor, phone-probe, open, scoped-log and disconnect commands |
| SNAPTURE_ANDROID/scripts/configure-api.cjs | Validate/show/write public development or production API settings |
| SNAPTURE_ANDROID/scripts/test-reliable.cjs | Optional per-file 60-second bound, individual logs and honest failure/timeout status |
| SNAPTURE_ANDROID/scripts/tests/android-dev.test.cjs | Five Node tests for endpoints, target selection, API policy and platform metadata |
| SNAPTURE_ANDROID/api-environment.json | One public build setting; retained development localhost-forwarding URL |
| SNAPTURE_ANDROID/src/apiEnvironment.ts | Validate environment; production HTTPS/public-host checks; useful network-specific guidance |
| SNAPTURE_ANDROID/src/api.ts | Read shared configuration, bound previously unbounded requests, coalesce overlapping public reads, scope tokens to another API URL, invalidate schedule snapshots |
| SNAPTURE_ANDROID/src/scheduleCache.ts | Bounded dated schedule snapshots, freshness/expiry, account/barangay/server/month separation and late-response guards |
| SNAPTURE_ANDROID/src/useCollectionSchedule.ts | Use the cache on navigation, bypass freshness on Refresh and return cache-state metadata |
| SNAPTURE_ANDROID/src/CollectionSchedule.tsx | Existing styles with visible saved-date/staleness/withdrawal caution |
| SNAPTURE_ANDROID/src/MainExperience.tsx | Calendar empty-state text distinguishes a saved lookup from current publications |
| SNAPTURE_ANDROID/test/setup.cjs | Block accidental live unit-test fetches; pre-load lazy native test primitives before timed assertions |
| SNAPTURE_ANDROID/jest.config.js | Register setup; preserve React's setImmediate scheduler when application timers are faked |
| SNAPTURE_ANDROID/.eslintrc.js | Explicit modern Node/Jest contexts for the new CJS tools |
| SNAPTURE_ANDROID/__tests__/NetworkReliability.test.ts | Eleven cache, timeout, isolation, configuration, coalescing and benchmark cases |
| SNAPTURE_ANDROID/__tests__/DashboardSchedule.test.tsx | Cache isolation between fixtures and an offline/refresh display regression |
| SNAPTURE_ANDROID/__tests__/AuthNetwork.test.ts | Updated wireless-aware copy contract; existing no-retry/no-token assertions retained |
| SNAPTURE_ANDROID/__tests__/BarangayApi.test.ts | Assert the existing authenticated PATCH plus its added abort signal |
| SNAPTURE_ANDROID/package.json | New developer npm scripts; package versions unchanged |
| .gitignore | Ignore local per-file test evidence |
| README.md, RUNBOOK.md, SNAPTURE_ANDROID/README.md | Links and single-source API configuration instructions |
| documentation/README.md | Maintained guide index and explicit older Word/PDF snapshot scope |
| documentation/guides/ANDROID_WIRELESS_DEBUGGING_AND_TROUBLESHOOTING.md | Initial setup, daily commands, eight scenarios, network limits, offline behavior and official references |
| Start-Snapture.ps1 in the outer workspace | Wireless/doctor shortcuts, explicit transport selection and duplicate-service guard |
| RUN_COMMANDS.txt in the outer workspace | Clear four-terminal workflow, wireless Terminal 3, optional watcher and USB fallback |
| .tools/phone_connection.py in the outer workspace | Optional explicit wireless serial and accurate transport-neutral watcher messages |

Task-only inspection/build/service helpers and evidence remain under the outer
workspace `.tools/`; they are not application dependencies or public dataset
content. No source folder was moved for this task. The earlier cleanup's report
moves and other pre-existing Git changes are not new deletions here.

## Team wireless workflow

From SNAPTURE_ANDROID with Node and ADB available:

```powershell
# Only when pairing is needed; code stays in the local terminal
$pairingAddress = Read-Host 'Pairing dialog IPv4:port'
npm.cmd run android:pair -- $pairingAddress

# Main screen connection port is separate from the pairing port
$connectionAddress = Read-Host 'Main Wireless debugging IPv4:port'
npm.cmd run android:wireless -- $connectionAddress
npm.cmd run android:forward -- --serial $connectionAddress
npm.cmd run android:probe -- --serial $connectionAddress
npm.cmd run android:open -- --serial $connectionAddress
```

Backend, Metro and Admin launch commands are unchanged. Terminal 3 normally
connects/opens the existing installation rather than rebuilding. Use the root
launcher `Wireless -Address` to combine connect and forwarding, and
`Reconnect -Serial <current-address> -Watch` for an optional single watcher.
After a network/port change, read the new endpoint and reconnect deliberately;
the watcher does not invent it. Run Doctor/Devices/Logs before clearing caches.
No helper restarts ADB, changes firewall/network settings or enables legacy TCP.

## Implemented traffic and offline behavior

- Public materials, learning and announcement requests share overlapping work
  only. Later publication checks are fresh; no persistent stale-file feed was added.
- Schedule reads reuse a 60-second snapshot for navigation. Refresh bypasses
  that freshness. On a transport failure, up-to-24-hour-old saved data is clearly
  dated and warned as potentially changed/cancelled. HTTP/auth failures do not
  become cached success. Empty cached results do not claim current verified absence.
- Snapshot scope includes API, account, barangay and month. Logout/new sign-in
  and successful barangay updates invalidate it; old-session/late older requests
  cannot overwrite newer snapshots. At most 12 records and a bounded encoded
  cache are retained. Storage failures do not block a successful live response.
- Normal API requests have 30-second limits, scenes retain 180 seconds and token
  revocation 10 seconds. A non-aborting transport still times out. No mutation,
  scan/photo upload or project step is automatically retried or queued.
- Existing image quality, frame crop, stored photos, detector/classifier and
  recommendation decisions remain unchanged. No unverified lossy compression
  or new private photo/history cache was introduced.
- The existing active-app notification refresh remains at 30 seconds. No new
  radio-selection library or connectivity polling was added.

The repeatable ASCII-fixture experiment recorded **10 uncached logical reads vs
1 cached logical read**, with **1,160 vs 116 response-entry bytes**. These are
synthetic test measurements, excluding headers, TLS, image uploads and other
traffic. They do not establish total phone/carrier data savings.

## Actual verification results

| Check | Result |
| --- | --- |
| Authorized wireless ADB connection and explicit selection | Passed on TECNO |
| Phone-originated backend and Metro HTTP probes after USB removal | Both 200 |
| Doctor through Start-Snapture.ps1 | Passed: Node 22.23.4, JDK 17.0.20.1, SDK API 37, Build Tools 37.0.0, NDK 29.0.14206865; API/Metro 200 |
| New Node development-tool tests | 5 passed |
| Complete mobile Jest suite | 42 suites, 198 tests passed |
| TypeScript --noEmit | Passed |
| Mobile and explicit CJS ESLint with --max-warnings 0 | Passed with zero errors/warnings |
| Django check and full isolated backend suite | Passed; 249 tests |
| Web admin build and lint | Passed |
| Android non-development JavaScript bundle and eight assets | Built successfully outside the repo |
| Web page / proxied CSRF / anonymous protected session | 200 / 200 / expected 401 |
| Existing-account web dashboard | User confirmed working |
| Re-running Backend/Metro/Admin commands | All correctly avoided duplicate listeners |
| Dependency roots and lockfiles; whitespace and documentation links | Checked before completion |

The final test evidence is local under `.tools/wireless-verification/`, including
`mobile-all.json`, `mobile-all.log`, `build-checks.json`, per-check logs and
`web-admin-http.json`. Optional isolated-run evidence is under ignored
`SNAPTURE_ANDROID/.test-results/`.

## Errors investigated and limits

Initial component runs exceeded the first notification test's five-second limit,
and camera/project files hit their process bound. Lazy native test loading was
moved outside timed assertions; React's setImmediate scheduler remains real under
fake timers. Assertions/time limits were not relaxed. All three formerly stalled
files and the final full suite passed after the test-harness correction.

An explicit CJS lint run initially found an older parser context and undefined
Jest globals. Scoped lint configuration fixed those; six earlier source lint
warnings were corrected, and final strict lint passed. A relative tool path in
one verification invocation was wrong; rerunning with its actual absolute path
passed. Doctor initially assumed `platforms/android-37`; the installed platform
is `android-37.0` with API metadata `37.0`. It now reads metadata and android.jar
instead of falsely declaring the SDK missing. No software reinstall was needed.

The full suite still emits pre-existing test-only act warnings in
ScanUpcyclingIdeas; they were not suppressed or counted as failures. Metro keeps
its existing private-featureflags export-fallback warning and color-environment
warnings; the final bundle completed. No native APK rebuild was required for
these JavaScript/tooling changes. The production-mode bundle check used the
retained development API settings, not an invented production deployment.

The user deferred a fresh physical Analyze-image check while arranging the four
terminals. The app's wireless opening, HTTP data path and web sign-in are verified;
fresh camera inference accuracy/latency and a real schedule-cache outage on the
phone remain manual acceptance checks. Camera, inference-route, recommendations,
history, authentication and schedule flows have automated regression coverage.
New code-entry pairing, unrelated-network switching and a real hosted production
server were not tested. Offline authentication was intentionally not added.

Local inference can operate without internet when its installed models and the
PC are reachable. Switching the phone to unrelated mobile data usually breaks
wireless ADB/Metro/local API routes. Hosted recognition still requires network
access to its actual HTTPS backend; a bundled app alone cannot make that local
service reachable. No firewall weakening, public ADB exposure, paid API, source
upload, model training or Git push occurred.

The Word/PDF exports remain the earlier dated consolidation snapshot. Current
wireless commands and cache policy are maintained in Markdown and linked from
the documentation index rather than silently regenerating those artifacts.
