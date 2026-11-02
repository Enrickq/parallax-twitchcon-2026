# PARALLAX — The Butterfly Effect of Twitch

**Tagline:** One chat. Two futures. A world that remembers.

**Elevator pitch:** Twitch chat chooses which universe becomes real, then explores the future it left behind. Every winning choice changes the world inherited by the next round.

## Inspiration

A stream's chat can hold a community's best ideas, but those messages soon disappear. We wanted to give a live audience a shared world that remembers its decisions, and a way to see what one different choice would have changed.

The question behind PARALLAX is simple: what if the audience could choose a future, then step into the future it did not choose?

## What it does

A streamer opens a rift between two procedural galaxies. Viewers use ordinary Twitch chat commands: `!a` or `!b` chooses a branch; `!spark hope` contributes a word to the round's visual DNA. Each username gets one vote and one spark per round.

At collapse, the winning branch changes the shared world's harmony, entropy, cumulative memory and procedural DNA seed. The next round inherits that result. The latest twelve decisions remain in a local archive across server restarts.

The Butterfly Lens makes the consequence inspectable. Both branch outcomes are computed from the same pre-decision state and the same contributions. Only the winner changes the shared world. The studio can enter a labeled, read-only preview of the unchosen branch, compare its metrics with the chosen outcome, and return to the current world. The OBS overlay stays with the shared world throughout.

PARALLAX includes a director studio, a dedicated OBS browser overlay, an authenticated Twitch IRC connector and a clearly labeled simulation mode for evaluating the full interaction without credentials.

## How we built it

The runtime has no external JavaScript dependencies. Node.js provides HTTP, TLS, file storage and Server-Sent Events; browser Canvas renders the galaxies from procedural seeds. The server owns voting deadlines, command validation, duplicate protection and the canonical world. The browser owns only the temporary what-if view.

We extended an entrant-supplied starter during a real OpenAI Codex session. Codex implemented deterministic paired futures from one origin, archived the alternative outcome, built the Butterfly Lens and local preview, strengthened IRC message handling and director request validation, and added behavior-focused engine and HTTP checks. The build log records changes, validation and session provenance. Codex is our development tool; the running universe does not make AI API calls.

## Challenges

The central challenge was making the alternative future meaningful without letting a preview rewrite the real result. We calculate both outcomes before committing the winner and keep historical inspection in the studio's local view. This gives the comparison a common origin while preserving the community's decision.

Another challenge was keeping evidence honest. Simulation is visibly labeled and disabled when Twitch credentials configure live mode. Automated IRC parsing checks are separate from end-to-end Twitch account verification.

## What we are proud of

The most satisfying moment happens after the vote. A viewer can see the world the community chose, the world it passed over, and the measurable difference between them. The consequence continues into the next round rather than disappearing with a finished poll.

## What we learned

A small interaction can feel substantial when its consequences are visible, persistent and understandable. Two commands, one shared decision and an inspectable alternative give the streamer a clear format for a community story.

## What's next

We would add creator-authored scenarios, richer world rules and exportable world archives. Broader live-stream testing and operational hardening are the next steps before production use.
