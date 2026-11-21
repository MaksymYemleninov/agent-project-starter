# Preproduction document formats

Short, because each is read before production work in its area. All of them are listed in
`docs/INDEX.md` under Preproduction. `status: stable` means approved; the approval line says by whom.

## docs/preprod/concept.md

```markdown
---
type: preprod
status: draft
last_verified: YYYY-MM-DD
blind: false        # true when the human plays or watches blind (SKILL.md section 4)
---
# Concept

## Audience
Age range (youngest and oldest player it is made for), who else is in the room, what they play now.

## Genre and core verb
Genre, the one verb the player does most, platform, play setting, session length.

## References
| Reference | Taken from it | Not taken |
|---|---|---|

## Tone
The humour in one sentence, one line or situation it would contain, one it never would.

## Never feels like
Three items. The art and the story are checked against these.

## Approvals
Dated, newest first: what was approved, by whom (human, or agent delegated in blind mode).
```

## docs/preprod/story.md (spoilers)

```markdown
---
type: preprod
status: draft
last_verified: YYYY-MM-DD
spoilers: true
---
# Story and world

> Spoilers. Do not open if you are playing blind.

## Overall goal
## Characters
| Character | Role | Wants | Silhouette and detail | Palette |
|---|---|---|---|---|
## Villain
## Locations
| Location | Order met | Mood | Palette | Shape language |
|---|---|---|---|---|
## Visual bible
Per hero, villain and location: silhouette, palette, shape language, one distinctive detail.
## Approvals
```

## docs/preprod/idea-bank.md (spoilers)

Same frontmatter as `story.md`. One table, never shortened: `| Idea | Raised | Status (in, parked,
cut) | Why |`. A cut idea keeps its row.

## docs/preprod/art-direction.md

```markdown
---
type: preprod
status: draft
last_verified: YYYY-MM-DD
---
# Art direction

## Moodboard
Link to `preprod/moodboard.md`; the three ideas it settles (palette, light, line).

## Style frames
| Frame | File | Direction | Palette | Verdict |
|---|---|---|---|---|
| A | preprod/style-frames/a.html | ... | ... | chosen / rejected: why |

## Chosen direction
The frame chosen, the changes asked for, palette with hex values, shape language, line, light.

## Decisions
Dated, newest first. The first is the human's pick: date, frame, changes.
```

Style frames show a scene's look. In blind mode they carry no plot text and no caption that reveals
what happens.

## docs/playtests/NNNN-slug.md

```markdown
---
type: playtest
status: draft
last_verified: YYYY-MM-DD
verdict: not-yet    # fun | not-yet | no
build: preprod/greybox/index.html
---
# NNNN - What was tested

## Setup
Who played (role and age, not names), how many players, how long, which build.

## Observed
What players did, where they laughed, got stuck, stopped or asked to play again. Observed, not hoped.

## Tuning tried
## Verdict
fun, not-yet or no, and why in two sentences. What the next playtest changes, if any.

## Approval
Date and the human's words approving the verdict.
```

Numbered from `0001`, one file per session; a `not-yet` is followed by a new playtest, not an edit.

## docs/preprod/content.md (spoilers)

Same frontmatter as `story.md`, title "Content design". One section per level, mission or episode:
goal, mechanic taught or tested, story beat, location, the moment that should land, and the
playtest that approved its mechanic.
