# Story Source Acceptance Play

<!-- narrative-canvas-story-md: v1 -->

## Start
<!-- id: start -->
type: Entry
slug: Start

The train waits at the platform.

next:
- goto: Platform_choice

## Platform choice
<!-- id: platform_choice -->
type: Choice
slug: Platform_choice

The guard raises a lantern.

choices:
- Board the train
  id: opt_board
  goto: Corridor
- Wait on the platform
  id: opt_wait
  goto: Waiting

## Corridor
<!-- id: corridor -->
type: Choice
slug: Corridor

Two carriage doors stand open.

choices:
- Take left door
  id: opt_left
  effect: onChoose set route left
  goto: Aboard
- Take right door
  id: opt_right
  effect: onChoose set route right
  goto: Wrong_car

## Aboard
<!-- id: aboard -->
type: Content
slug: Aboard

The carriage door shuts behind you. Route: {route}.

## Waiting
<!-- id: waiting -->
type: Content
slug: Waiting

The train leaves without you.

## Wrong car
<!-- id: wrong_car -->
type: Content
slug: Wrong_car

The right door opens onto a locked compartment. Route: {route}.
