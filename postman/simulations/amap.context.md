# AMap local simulation

Generated 2026-10-27 from the locally documented AMap subset. No owner workspace lookup: Postman CLI is signed out; examples are synthetic, based on the linked official documentation in docs/amap-contract.json.

## Purpose

Exercise the actual Express API and PostgreSQL against nearby-search and geocoding HTTP responses. Failure cases live in ../mocks/amap/default.js. Test-only examples must never seed the application database.

## Execution

`npm run test:integration` starts temporary PostgreSQL, starts this simulation on 4901, and points the API at `http://127.0.0.1:4901/amap`. It checks readiness, executes tests, and stops both. For inspection: `postman simulation run postman/simulations/amap.sim.yaml --port 4901 --no-history --output ndjson`.

## Assumptions

- Provider live credentials, quotas and response freshness remain unverified. The test contract models the documented subset, not every provider field (reasoned 2026-10-27, docs/amap-contract.json).
- The configured upstream base URL may contain a routing prefix; dropping `/amap` prevents every provider call from reaching the simulation (observed 2026-10-27).

## Observations

<!-- begin:observations -->
2026-10-27: the sole amap member served geocoding and nearby search, including upstream error/empty/HTML branches. A timeout request was aborted before the delayed response. All integration assertions passed; no members stayed unused.
<!-- end:observations -->

## What didn't work

- 2026-10-27: first run reported 502 and zero simulation requests because `new URL('/path', base)` discarded the member prefix. Fixed by preserving the configured base path; the subsequent run passed.
