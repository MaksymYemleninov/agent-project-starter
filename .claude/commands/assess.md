---
description: Go / needs-clarification / kill on an idea, before any code exists.
argument-hint: "[optional: path to the idea file, defaults to docs/idea.md]"
---

# Assess this idea

Evaluate whether this idea should be built at all. You are not scaffolding anything and you are
not being encouraging. Run this before `/onboard` when the idea is not yet committed to.

Idea: `$1` if provided, otherwise @docs/idea.md

## 1. Restate

Two sentences: what it is, who it is for. If you cannot do this from the idea file, that is the
first finding.

## 2. Intake gaps

List what the idea does not say that a builder would need on day one. Ask the user the three
that matter most, one at a time.

## 3. Research

Check what already exists. Name actual products, not categories. For each close competitor:
what they do, what they charge, and what they are visibly bad at.

If the space is empty, say so and then ask the harder question: is it empty because it is new,
or empty because it does not work.

## 4. Shape

- Smallest testable version, and how long it would plausibly take.
- The single riskiest assumption, and the cheapest experiment that would kill it.
- What it costs to run at ten users and at ten thousand.

## 5. Decide

One of three, stated plainly with reasoning:

- **Go** - build it. Say what to build first and run `/onboard` next.
- **Needs clarification** - name exactly what has to be answered or tested before it is
  worth starting.
- **Kill** - say why, without softening it. A cheap no now is worth more than a slow yes.

Do not default to Go. An assessment that never kills anything is not an assessment.

Write the result to `docs/assessment.md` only if the user asks. Otherwise keep it in the
conversation: an unrequested document is clutter.
