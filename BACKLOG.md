# BASIRET — Backlog

Deferred items, ordered roughly by priority within section. Each entry: what,
why it's deferred, what would trigger promotion to in-progress, rough estimate.

Promotion criteria for "DEFERRED → in progress":
- PRIORITY items: pick up before the next major release/launch milestone.
- DEFERRED items: pick up when a related task touches the area, OR when a
  pilot user reports the underlying friction, OR before public launch.

---

## Infrastructure / deploy

### A. Untracked server-local files outside git (PRIORITY)

**Status:** Open, partially mitigated 2026-05-16.

**What:** `/opt/basiret/nginx.conf` on the prod VPS exists outside the repo
(server-local, hand-edited during initial provisioning). Any `git pull` that
introduces a tracked `nginx.conf` from the repo would refuse to merge until
the local copy is moved aside, blocking deploy.

**Mitigation already applied (2026-05-16):**
- Verified `frontend/Dockerfile.prod` IS now tracked (commit `bd8b3a1`); only
  `nginx.conf` is still untracked.
- Backup of all current server-local files lives at
  `/root/basiret-server-files-backup/` on prod, so reconciliation is safe.
- Path B1 (auto-migrations in deploy workflow) shipped today (commit
  `c9e1a06`) as a preventive fix for the related Day 3-4 prod-500 incident.

**Why deferred:** Today's mitigation makes the migration-apply path safe;
the nginx-conflict path is theoretical at graduation scale.

**Trigger to promote:** before public launch OR if a deploy is ever blocked
by `git pull` aborting on `nginx.conf`.

**Estimate:** 30–60 minutes. Commit current server `nginx.conf` content to
`infra/nginx/nginx.conf` in the repo, point the prod container at the
checked-in copy, remove the server-local file.

---

### B. Deploy verification gate before Playwright (PRIORITY)

**Status:** Open. New 2026-05-16.

**What:** Add a 60-second pre-flight checklist any time a "verify on prod"
workflow starts. Three checks, any failure → don't start Playwright:
1. Latest GH Actions run on main was triggered by the commit under
   verification (`gh run list --workflow=deploy.yml --limit=1 --json headSha`
   matches the merge commit SHA).
2. That run's conclusion is `success`.
3. Prod bundle hash differs from the last known stale value (curl
   `/content-plan`, grep `/assets/index-*\.js`).

**Why this matters:** During Day 3-4 verification on 2026-05-16, ~30 minutes
were spent driving a Playwright session against the legacy prod bundle
because the branch was pushed but never merged. The smoking-gun grep against
the JS bundle (zero matches for "Generate all 7") would have caught the gap
in seconds.

**Why deferred:** Checklist item, not a code task — captured in CLAUDE.md +
this backlog. No automation needed at current cadence.

**Trigger to promote:** if a second "verify a deploy that never happened"
incident occurs.

**Estimate:** 0 (process change, already documented).

---

### D. Migration application not gated by tests (DEFERRED)

**Status:** Open. New 2026-05-16.

**What:** Migrations now apply automatically in the deploy workflow (Path B1,
commit `c9e1a06`). But there's no pre-deploy check that a new migration
applies cleanly against a copy of the production schema. A destructive or
conflicting migration could ship to prod and break.

**Mitigation options:**
- **(a)** CI runs `alembic upgrade head` against a fresh Postgres container
  that has been advanced to the previous head SHA first, simulating the
  upgrade path the production DB will see.
- **(b)** Require all PRs adding migrations to include a `downgrade` test
  (asserts `alembic downgrade -1` produces a working schema).

**Why deferred:** No destructive migrations are planned in the Week 1 / 2 /
3 roadmap. Low severity today; medium severity before public launch.

**Trigger to promote:** before public launch OR before any migration that
drops a column / adds a NOT-NULL without default.

**Estimate:** 2–3 hours for (a). 30 minutes for (b).

---

## Day 3-4 batch flow — verification gaps

All four items below were found during the 2026-05-16 Playwright verification
of `feat(content-plan): "Generate all 7 posts" batch flow`. The headline
feature works end-to-end; these are polish items that did not block Day 3-4
from closing.

### E. Failed-day badge uses `!` glyph, not `⚠️` emoji (DEFERRED — cosmetic)

**Status:** Open. New 2026-05-16.

**What:** When a day in a batch fails (real AI provider failure, not seeded),
the row badge renders `! Generation failed`. Spec called for `⚠️ Generation
failed` with the warning emoji.

**Severity:** cosmetic — the failure is clearly communicated; the icon is
the only visual deviation.

**Trigger to promote:** visual design pass before public launch.

**Estimate:** 15 minutes. Swap the icon in
`frontend/src/pages/Recommendations.tsx` per-day badge renderer.

---

### F. Batch-generated drafts use existing "Draft" / "Continue editing draft" labels (DEFERRED — cosmetic)

**Status:** Open. New 2026-05-16.

**What:** Days that completed in a batch show the existing `Draft` badge
(same as wizard-created drafts) and `Continue editing draft` CTA on the
preview pane. Spec called for `Draft ready ✓` badge and `Review draft` CTA
specifically for batch-generated days.

**Severity:** cosmetic / nomenclature — semantically equivalent ("the post
exists as a draft you can edit"), but the spec asked for a distinct visual
treatment to differentiate "I made this one-off via the wizard" from "the
batch made this and I should review it."

**Trigger to promote:** before public launch OR if pilot users find the
identical labels confusing.

**Estimate:** 30 minutes. Add a `from_batch: bool` to ScheduledPost OR
infer from the existence of a BatchGenerateProgress row pointing at the
post, then branch the badge + CTA renderer.

---

### G. Per-day "Try again" retry affordance for batch failures (DEFERRED — functional)

**Status:** Open. New 2026-05-16.

**What:** Spec called for a "Try again" button on the failed day's row in
both the progress modal AND the AI Plan row card. Not implemented — failed
days currently show the error badge but no retry CTA.

**Severity:** functional gap. Recovery paths exist (Regenerate plan + per-day
wizard, OR re-running the whole batch), but the explicit "retry just this
day" affordance is missing. User symptom: a day failed, no obvious way to
retry just that day.

**Trigger to promote:** if pilot users report friction recovering from
failures, OR if AI provider quota becomes flaky enough that 1-of-7 failures
become a common case.

**Estimate:** 2–3 hours. Backend: extend `batch-generate` to accept
`day_index` OR add new `POST /content-plan/batch-retry-day`. Frontend: retry
button + handler + state mutation. Tests for both happy + already-completed
day cases.

---

### H. Batch completion toast — global observer not implemented (DEFERRED — functional)

**Status:** Open. New 2026-05-16.

**What:** Spec called for a toast notification "Your 7 posts are ready" when
the batch completes while the user is detached (navigated away from Content
Plan, or modal closed). Empirically verified during 2026-05-16 verification:
toast does NOT fire in either case — neither when user is on `/dashboard`
during completion (Check 3) nor when modal is closed before completion
(Check 2).

**State IS reflected correctly when the user returns to the Content Plan
page** — per-day badges + Drafts tab reflect the completed batch. So the user
loses the proactive notification, not the data.

**Severity:** functional gap. User won't know the batch finished unless they
come back to Content Plan.

**Why deferred:** State-on-return works; the user always sees correct state
the moment they re-open Content Plan. The TODO in
`backend/app/api/v1/ai_pages.py:1857-1862` (added today) already documents
this as a V2 consideration.

**Trigger to promote:** if pilot users report missing the completion signal.

**Estimate:** 2–4 hours. Two options:
- **(a)** Lift the polling hook from `BatchGenerateProgressModal` to a
  global `BatchCompletionObserver` mounted in `AppLayout`. Polls
  `/content-plan/batch-progress/latest` every ~20s when a known running
  batch exists; fires toast on `status: running → completed` transition.
- **(b)** SSE/WebSocket push from the Celery task on completion. Heavier
  infra, real-time, no polling cost.

(a) is the pragmatic choice for graduation scale.

---

## Migration of file storage / housekeeping

(none yet — entries get added here as they come up)
