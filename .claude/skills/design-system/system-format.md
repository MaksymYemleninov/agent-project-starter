# docs/design/system.md format

The written half of the design system. Short, because it is read before every UI change.

```markdown
---
type: design
status: draft
last_verified: YYYY-MM-DD
---
# Design system

## Brief
Who uses it, in what situation, what they must feel and get done. From `docs/product/vision.md` and
`personas.md`, in two or three sentences. The subject's world (its materials, vocabulary, habits)
is where distinctive choices come from.

## Direction
The one idea that makes this product look like itself, in a sentence. What is bold (one thing) and
what is quiet (everything else). The defaults deliberately avoided, and why they do not fit here.

## Principles
Three to five, each a sentence a reviewer can apply to a screen: "Numbers are the interface: data is
set large and labels small", not "Clean and modern".

## Tokens
A table per group (colour per theme, type scale, space, radius, elevation, motion), with the
reasoning for the non-obvious values. The values themselves live in `design/tokens.css`; this is
why they are what they are. Contrast ratios for each text and UI pairing, both themes.

## Components
| Component | Variants | States designed | Where |
|---|---|---|---|
| Button | primary, secondary, danger, ghost | default, hover, focus, active, disabled, loading | components/ui/button |

## Prototypes
| Screen | File | Covers |
|---|---|---|
| Dashboard | design/prototypes/dashboard.html | empty, loaded, error; desktop and 375 px |

## Decisions
Dated, one line each, newest first: what changed in the design, why, who approved.

## Open questions
```

## Rules

- `status: stable` means the human looked at the prototypes in a browser and approved them in the
  conversation. Nothing else sets it.
- Every token has a reason or is obviously structural. "Brand blue" is not a reason; "the accent is
  the colour of the product's physical packaging, so the app feels like the same object" is.
- The component inventory lists only components that exist or are specified by a prototype. It
  grows with the product, not ahead of it.
