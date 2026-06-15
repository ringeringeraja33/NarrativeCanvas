# Project Story Template

<!-- narrative-canvas-story-md: v1 -->

## Start
<!-- id: start -->
type: Entry
slug: Start

Replace this opening scene with the first beat of the real project story. Route: {route}.

next:
- goto: First_Choice

## First_Choice
<!-- id: first_choice -->
type: Choice
slug: First_Choice

Replace this with the first meaningful branch that the acceptance route should cover.

choices:
- Take the direct route
  id: opt_take_direct_route
  effect: onChoose set route direct
  effect: onChoose add momentum 1
  goto: Direct_Path
- Take the quiet route
  id: opt_take_quiet_route
  effect: onChoose set route quiet
  effect: onChoose set clue_found true
  goto: Quiet_Path

## Direct_Path
<!-- id: direct_path -->
type: Choice
slug: Direct_Path

The direct route should exercise at least one state write and one condition. Momentum: {momentum}.

choices:
- Confirm the direct plan
  id: opt_confirm_direct_plan
  requires: momentum >= 1
  goto: Resolution

## Quiet_Path
<!-- id: quiet_path -->
type: Choice
slug: Quiet_Path

The quiet route should exercise a different state path. Clue found: {clue_found}.

choices:
- Use the quiet clue
  id: opt_use_quiet_clue
  requires: clue_found == true
  effect: onChoose add momentum 2
  goto: Resolution

## Resolution
<!-- id: resolution -->
type: Content
slug: Resolution

Replace this with the route endpoint that proves the exported consumers reached the expected scene. Route: {route}. Momentum: {momentum}. Clue: {clue_found}.
