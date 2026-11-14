# Development and playtest policy

Continue from existing work. Use one implementation agent unless the user asks
for delegation. Inspect diffs and persisted test results before repeating work.
Preserve gameplay, saves, license notices and all existing branches.

Develop milestones on isolated feature branches based on current `playtest`.
The user authorizes automatic promotion of **completed and validated** milestones
to `playtest`; a separate human approval prompt is not required. This does not
authorize changes to `main`, public releases or public hosting.

Before promotion, validate the exact candidate commit: milestone acceptance,
all mandatory previous regressions, new feature tests, offline export, Chromium
startup/assets/errors, original/combat modes, saves and the existing launcher
protocol. Include damage/protection, movement, AI, injury and ragdoll checks as
applicable. Unavailable mandatory checks without reliable equivalents block
promotion. Distinguish Linux automation from native macOS testing.

Prefer independently executed CI gates. Never label draft or unrun checks as
passed. Retain evidence tied to the candidate SHA. Preserve a recoverable ref to
the old playtest SHA, verify ancestry, fast-forward only, and verify the remote
SHA. Never reset, force-push or promote partial milestones. On any gate failure,
missing validation or deployment blocker, retain `playtest` unchanged and report
the exact blocker. Preserve port 8001, loopback hosting, browser origin, offline
fallback and the installed macOS launcher's update protocol.

For quota-sensitive continuation, run focused tests after changes and one full
regression pass before promotion. Diagnose individual failures without blindly
rerunning the entire suite. If a milestone needs another large session, commit a
coherent development checkpoint and document the remaining work.
