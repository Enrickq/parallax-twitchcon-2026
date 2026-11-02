# PARALLAX — authentic Codex build log

Date: 2 November 2026. The entrant supplied the initial ZIP starter. This log describes the subsequent work performed in this Codex session; it does not attribute the supplied starter to this session.

## Session provenance

Codex session/thread ID: `01a19d6f-8834-70e3-b2ea-409c77ed5507`.

The identifier was read from the current runtime's `CODEX_THREAD_ID` / `CODEX_SESSION_ID` environment metadata. We do not claim that `/status` was executed. The entrant should verify the ID in the principal build thread before entering it in Devpost.

## Implemented in this session

- Deterministic counterfactual outcomes: both futures use the same saved origin, vote total and retained spark words. Only the winning branch changes the shared world.
- Archived `before`, paired `futures`, round theme and a short deterministic decision fingerprint, while retaining compatibility with older history records.
- Butterfly Lens comparison panel, history inspection and clearly labeled local what-if preview. Preview changes do not change server state or the OBS overlay.
- Stronger Twitch IRC parsing and room-join confirmation, PING/PONG handling, authentication failure handling and reconnect behavior.
- Director HTTP validation for JSON content, request size, malformed bodies, same-origin requests and cross-site rejection. Simulation injection remains disabled in configured Twitch mode.
- Engine and HTTP behavioral tests; refreshed documentation and an English submission description based on implemented features.
- Browser verification found a CSS class collision where a reveal event in the activity feed inherited the fullscreen reveal styling; this was fixed and the full browser flow checked again.

## Validation actually completed

- `node --test tests/*.test.js`: **18 tests passed, 0 failed**, reported by the main Codex build task. The test process required execution outside the restrictive sandbox after an access-denied failure.
- Browser QA completed the real local application flow: open round, simulated contributions, collapse, compare futures, enter and leave preview, inspect history and confirm the overlay remains on the shared world.
- Browser QA outputs and screenshots are in the project's artifacts. These are local simulation evidence, not proof of Twitch account authentication.
- Exported and checked a 116-second MP4 rehearsal with real local app capture, English narration generated locally, captions, and explicit simulation/build-artifact labels. Frame inspection and audio decoding passed. It remains separate from the required Twitch and Codex UI footage.

The tests exercise command deduplication, deadlines, paired outcomes and winner-only commitment, input sanitation, IRC parsing and HTTP boundaries. They do not authenticate a Twitch account or verify public hosting.

## Delivery limitations

At this documentation checkpoint, real Twitch end-to-end footage, genuine Codex screen footage, a published repository URL, a YouTube URL and confirmed Devpost submission have not been established. The exported local product recording remains labeled simulation. The delivery status is tracked separately in `submission/FINAL_STATUS.md`.

No credentials, invented usage metrics, fabricated live viewers or unverifiable claims of novelty are required to run or evaluate the project.
