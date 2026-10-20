# Kart Race PR 3b: Things On The Track

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** the last five items:
- **Web** and **Oil Slick**: dropped hazards.
- **Bouncer**, **Seeker** and **Bomb**: things that move on the track.

All five appear in the odds by place and are drawn on the TV.

**Architecture:**
- `server/games/kart-items.js` gains the hazard and shot rules:
  - `useItem` drops or fires them;
  - `stepShots(game, dt, now)` moves the shots, bounces them off barriers, steers seekers, sets off bombs and checks hits;
  - `hazardCheck(game, k, slot, now)` handles karts driving into webs and oil.
- The race keeps `webs`, `oils`, `shots` and `blasts` next to `bananas`. Each tick it calls `stepShots` once, then `hazardCheck` for each kart.
- `drive()` reads two new kart timers:
  - `webUntil`: top speed ×0.5;
  - `oilUntil`: no steering or braking.
- Every hit goes through `hitKart`, so Stars, shields, spinning and grace all work as in 3a.

**Spec:** `docs/superpowers/specs/2026-10-19-kart-racers-design.md`, Part 3 (table rows Web, Oil Slick, Bouncer, Seeker, Bomb; odds table).

## Global Constraints

- **Emoji:** 🕸️ 🛢️ 🥏 🎯 💣 (all within Emoji 12). No emoji on the canvas.
- **Values from the spec:**
  - Web: half speed for 1.5 s.
  - Oil: no steering or braking for 1 s.
  - Bouncer: 12 units/s; bounces off barriers and the field edge; lasts 4 s; can hit its thrower after 0.5 s.
  - Seeker: 13 units/s; follows the road; heads straight for the rival once within 4; a banana, web or Bouncer stops it; gives up after 6 s.
  - Bomb: lobbed 5 ahead; explodes 1.5 s after landing; spins out every kart within 2.
  - Hazard limit: 6 of each kind.
- **Odds** (1st / 2nd): web 3/1, oil 3/1, bouncer 4/2, bomb 1/2, seeker 0/3.
- **Coins:** only spin-outs cost coins. Web and Oil cost none.
- **Shield, Hover and Star:**
  - a shield blocks one hit of any kind, including Web and Oil;
  - Hover floats over webs and oil;
  - a Star clears them away.

## Rulings

- **The Bomb:**
  - it is placed 5 ahead at once (no flight time), held inside the barriers;
  - its 1.5 s fuse starts as soon as it is placed;
  - it hits karts whatever their stretch of road.
- **A Seeker's path:**
  - it follows the centre line 0.03 of a lap ahead of where it is;
  - once within 4 of the rival, it steers straight at them;
  - it is stopped by the first banana or web it touches, or by touching a Bouncer.

## Review Focus

1. **A Bouncer inside a tight bend:** it must never escape the barriers or the field. Test in Task 1.
2. **A Seeker whose target has finished or is out of the race:** it carries on until its 6 s timeout and never hits a finished kart. Test in Task 1.
3. **A Bomb exploding with the thrower inside the 2-unit blast:** the thrower spins too. Test in Task 1.
4. **Shots and hazards when a race ends:** they are cleared at the next race. Test in Task 1.
5. **A Bouncer meeting a Seeker:** both are destroyed. Test in Task 1.

### Task 1: Server (hazards and shots)

- [ ] Write failing tests:
  - `items: a Web holds you to half speed for 1.5 s (no coins lost); Hover floats over; a shield blocks it`
  - `items: Oil takes your steering and brakes for 1 s`
  - `items: a Bouncer flies straight, bounces off barriers and stays in, spins whoever it hits (its thrower only after 0.5 s), and is gone after 4 s`
  - `items: a Seeker chases the rival round the road and spins them; a banana in its way stops it; it never hits a finished kart`
  - `items: a Bomb lands ahead and goes off after 1.5 s, spinning everyone within 2`
  - `items: shots and hazards are cleared each race; 6 webs at most; a Bouncer and a Seeker destroy each other`
  - Odds: extend the existing odds test to check that 1st never draws a Seeker and that every kind is drawable by someone.
- [ ] Implement, then run `npm test` (green), then commit.

### Task 2: Screens

- [ ] `items.js` gets the five new entries. The TV draws:
  - a web of grey strands;
  - an oil puddle with a sheen;
  - a Bouncer: a spinning teal disc;
  - a Seeker: a red dart pointing the way it's going;
  - a Bomb: a black ball with a blinking fuse, and a flash ring when it explodes;
  - a webbed kart with strands over it, and an oiled kart with a dark sheen.
- [ ] Sounds: `shoot` when a Bouncer or Seeker is fired, `boom` when a Bomb explodes.
- [ ] Browser e2e: force the effects onto the TV view and take a screenshot.
- [ ] Commit.

### Task 3: Docs, review, PR

- [ ] Update the README items list and the catalog; review by opus; fix the Important findings with a failing test first; PR; merge on green.
