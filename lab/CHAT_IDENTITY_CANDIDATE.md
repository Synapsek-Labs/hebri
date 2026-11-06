# Chat identity and strict delegation candidate

Prepared on 6 November 2026 in the isolated Hebri Lab checkout.

## Changes

- Startup waits for remembered navigation to commit before initializing a draft,
  preserving the selected tab. An awaited explicit resume cannot be displaced by
  the old URL, and successful warm/cold resumes publish their destination.
- Hidden canonical Bit chats display their owner's name. Their exact owner route,
  caption scope and last observed display name survive restart, even when the
  Bits sidebar is unmounted. Live roster names override cached labels. Scope
  metadata follows local profile rename/deletion without touching remote owners.
  Canonical chat lookup still resolves the profile's registry by title on every
  Bit click; persisted presentation metadata is not a canonical pointer.
- Delegated tasks may explicitly select `stop_on_tool_error: true`. Their tools
  run sequentially; the first durably recorded tool failure ends the child,
  skips unstarted calls and returns a failed result without a further model turn
  or output-schema correction. Ordinary children retain recovery behavior.
- Terminal validation and timeout errors without an exit code count as failures.
- Failed terminal exits also appear as errors in child traces and output previews;
  strict-child results retain the actual tool failure instead of a missing-response error.

## Evidence and limits

Native quit/reopen checks preserved the selected exercise chat and hidden Bit
caption with both Bits and Team Chat as the startup sidebar. Hebri/Lead/Hebri
switching returned distinct canonical histories. Read-only checks preserved the
earlier A/B result owners, completion rows, delivery attempts and probe markers.

Two-home integration tests cover persona, synthetic secrets, builtin memory,
user notes and same-ID session history in both launch orders. This is profile
scoping, not an operating-system sandbox.

Caption/integration tests passed 124 cases; ownership/Team Chat UI tests passed
92; the final unmounted-roster checks passed 49. Strict-child execution tests
passed 11 and real two-home identity tests passed 2. Counts overlap. TypeScript,
targeted lint and the renderer build passed. Retained logs and source manifests:
`.lab-data/live-test/desktop-remaining-v1/`.

One user-approved cloud message was sent to Synapsek -> General and returned
unchanged under the human author after renderer reload and full restart.
Second-device synchronization is explicitly deferred. Cross-account denial was
not exercised live; local backend authorization tests are separate evidence.

The first live delegated-task qualification failed: the parent claimed the stop
policy was active but omitted its actual boolean argument and replaced the
requested output schema with `{}`. One probe invocation exited 17, but the child
made a second model call and reported `completed`. The runtime was not opted in.
This demonstrates why prose alone cannot guarantee activation. Preserved evidence:
`.lab-data/live-test/strict-child-live-v1/`.

The independent explicit-argument check passed the runtime stopping contract:
the actual task selected `stop_on_tool_error: true`; one child model call and one
terminal invocation ended at exit 17, with a failed result delivered exactly once
to its originating chat. Evidence: `.lab-data/live-test/strict-child-explicit-v1/`.
The parent again replaced the requested output schema with `{}`, so live schema
correction suppression remains unverified. Automated tests cover that path.
The live run preceded the two reporting fixes; the final canonical focused run
passed 13 tests with no failures after those fixes. See
`.lab-data/release-prep/chat-identity-20261106/verification-diagnostics.log`.

## Packaging boundary

This candidate contains the reviewed chat/navigation/caption and strict-child
changes plus their tests. Existing automatic-learning, completion-retention and
other Lab-tooling edits remain in the working tree outside this candidate. No
production installation, profile migration, push or publication is included.
The patch is based on the Lab branch, so applying it to another branch requires
review and validation against that target; the Lab build is not a production
installer. A live parent that omits the opt-in must never be described as having
runtime-enforced stopping.
