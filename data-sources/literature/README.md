# Literature metadata cache

`verification.json` is the successful bibliographic audit; `raw/` contains exact retrieved bodies with URLs, timestamps and SHA-256 hashes. `candidates.json` is an unverified search input and deliberately retains the originally proposed DOI values so the resolution process is reproducible. Additional atlas and system sources are declared in the verification script.

The frontend uses `src/data/references-expanded.js`, generated from resolved records, and `src/data/evidence.js`, whose claims and scope are curated separately. Metadata matching never establishes a scientific claim on its own.

Run `node scripts/verify_references.mjs --check` for local integrity and coverage validation, or omit `--check` to resolve records. No Python environment or package installation is required. Registry differences are retained in `crossCheck` and explained in `verificationNote`; a failed refresh does not replace the last successful output.

Audit dates use Asia/Shanghai; raw retrieval timestamps use UTC. Cached abstracts and bibliographic metadata are source material, not application instructions. Failed or superseded candidate-query records may remain in the cache as audit history and are not treated as accepted sources.
