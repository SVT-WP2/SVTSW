# WP tool: progress notes

What each ticket of [#405](https://github.com/SVT-WP2/SVTSW/issues/405) did, what it found, and what the next ones must
know. Every pull request of a ticket updates this page. Add to it; do not rewrite what an earlier ticket wrote, except to
mark a point as done. Keep each entry short and concrete: a file, a name, a value.

Where this page and a ticket differ, this page wins: it is newer.

## Status

| Ticket | Status | Pull request | Note |
|---|---|---|---|
| #406 S1 | not started | | |
| #407 T1 | not started | | |
| #408 T2 | not started | | |
| #409 T3 | not started | | |
| #410 T4 | not started | | |
| #411 T5 | not started | | |
| #412 T6 | not started | | needs the ITS3 owners |
| #413 T7 | not started | | |
| #414 S2 | not planned yet | | only when the WPAgent owners agree |

## Changes to the tickets

What a ticket did differently from its text, and why. Later tickets build on what was done, not on the text.

- (none yet)

## Findings for later tickets

Anything a later ticket needs: a helper that exists, a name that was chosen, a trap in the code, a test fixture to
reuse.

- (none yet)

## Facts

Learned from the SENTIO library, from WPMIT, or from the code, with where it comes from.

- Connecting to SENTIO sends `*RCS 1`; any command puts SENTIO into remote mode until `*LOCAL`
  (`sentio-prober-control` 24.4.0, library research of 23 Nov 2026).
- At 24.4.0 the library has a query of the open project (`get_project`), and none for "aligned", "PTPA valid" or the
  active camera (library research of 23 Nov 2026). #409 confirms the project query.
- WPMIT reports `In Default` for the chuck in the off-axis area (seen in a status of WPMIT). Which Z hints SENTIO can
  report in general is open; #408 reads the library for them, the run on WPMIT records them.
- Today's WPAgent mock reports `WideFieldCamera` after `move_chuck_wide`; the SENTIO driver sends `WorkArea.Probing`
  (`WPAgent/drivers/WPSentioProber.py` line 212). The simulator of #408 uses `Probing` until the run on WPMIT says
  otherwise.

## The run on WPMIT

The checklist is in the plan ("Done when"). Write here, step by step, what SENTIO reported for the Z hint and the work
area, and what was corrected in the simulator and in the separation check because of it.

- (not run yet)
