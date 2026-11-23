/**
 * The computer for Colour Clash (see `bot` in index.js). It sees its own hand, the top card and how
 * many cards you hold, as a player does.
 *   easy:   plays the first card that fits; picks a colour at random now and then; forgets to call
 *           CLASH! one time in four, and is slow to catch you.
 *   normal: follows the colour before changing it, keeps its wilds for when nothing else fits, picks
 *           the colour it holds most of; always calls; catches you.
 *   hard:   also hits you with its Draw Twos and Draw Fours when you're down to a few cards, gets rid
 *           of its big cards first, and catches you at once.
 */
import { COLOURS, colourOf, faceOf, isWild, points } from './colour-clash.js';

function mostColour(cards, rng) {
  const count = Object.fromEntries(COLOURS.map((c) => [c, 0]));
  for (const c of cards) if (colourOf(c)) count[colourOf(c)]++;
  const best = Math.max(...Object.values(count));
  const top = COLOURS.filter((c) => count[c] === best);
  return top[Math.floor(rng() * top.length)];
}

export function colourClashBot(view, level, rng = Math.random) {
  if (!view || !view.cards || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const pace = (ms) => ms + rng() * ms * 0.8;
  // Catch the other out (Easy only notices some of the time, slowly).
  if (view.uncalled === 1 - me && view.phase !== 'handEnd' && view.phase !== 'over') {
    if (level !== 'easy' || rng() < 0.6) return { type: 'catch', botDelayMs: pace(level === 'hard' ? 700 : level === 'normal' ? 1400 : 2600), botFor: 'catch' + view.hand + ':' + view.counts[1 - me] };
  }
  if (view.turn !== me) return null;
  const others = view.counts[1 - me];
  if (view.phase === 'colour') {
    const colour = level === 'easy' && rng() < 0.3 ? COLOURS[Math.floor(rng() * 4)] : mostColour(view.cards, rng);
    return { type: 'colour', colour, botDelayMs: pace(900) };
  }
  if (view.phase !== 'play' && view.phase !== 'drawn') return null;
  const key = view.hand + ':' + view.cards.length + ':' + view.top + ':' + view.phase;
  const can = view.playable;
  if (!can.length) return { type: 'draw', botDelayMs: pace(1100), botFor: key };
  let card;
  if (level === 'easy') card = can[0];
  else {
    const score = (c) => {
      let s = 0;
      if (isWild(c)) s -= 30; // (kept for later)
      if (colourOf(c) === view.colour) s += 5; // (follows the colour rather than changing it)
      s += points(c) / (level === 'hard' ? 4 : 10); // (big cards out first)
      const f = faceOf(c);
      if (level === 'hard' && others <= 2 && (f === 'D' || f === 'W4' || f === 'S' || f === 'R')) s += 60;
      if (level === 'hard' && f === 'W4' && others > 3) s -= 20;
      return s + rng() * 0.5;
    };
    card = can.slice().sort((a, b) => score(b) - score(a))[0];
    // (a drawn card it would rather keep: a wild, while it has others to come)
    if (view.phase === 'drawn' && isWild(card) && view.cards.length > 3 && level === 'hard') return { type: 'keep', botDelayMs: pace(900), botFor: key };
  }
  const input = { type: 'play', card, botDelayMs: pace(1200), botFor: key };
  if (isWild(card)) input.colour = mostColour(view.cards.filter((c) => c !== card), rng);
  if (view.cards.length === 2) input.call = level !== 'easy' || rng() < 0.75;
  return input;
}
