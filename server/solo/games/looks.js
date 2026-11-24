// Looks a player unlocks by playing: a different snake, bird, tower, ship... They
// change how a game looks, never how it plays, so they don't split the scores.
// Each look's unlock is the achievement that opens it (see server/achievements.js);
// the first look of each game is open from the start.

import { settingOf } from './options.js';

export const LOOKS = {
  snake: {
    classic: { name: 'Classic' },
    rainbow: { name: '🌈 Rainbow', unlock: 'snake-10' },
    neon: { name: '💜 Neon', unlock: 'snake-25' },
    gold: { name: '👑 Gold', unlock: 'snake-50' },
  },
  flappy: {
    bird: { name: '🐤 Bird' },
    bat: { name: '🦇 Bat', unlock: 'flappy-10' },
    penguin: { name: '🐧 Penguin', unlock: 'flappy-25' },
    dragon: { name: '🐉 Dragon', unlock: 'flappy-50' },
  },
  'breaker-1p': {
    classic: { name: 'Classic' },
    fire: { name: '🔥 Fireball', unlock: 'breaker-level2' },
    crystal: { name: '💎 Crystal', unlock: 'breaker-level4' },
    rainbow: { name: '🌈 Rainbow', unlock: 'breaker-1000' },
  },
  runner: {
    runner: { name: '🏃 Runner' },
    robot: { name: '🤖 Robot', unlock: 'runner-100' },
    dino: { name: '🦖 Dino', unlock: 'runner-500' },
    ninja: { name: '🥷 Ninja', unlock: 'runner-1000' },
  },
  'asteroids-1p': {
    classic: { name: 'Classic' },
    rocket: { name: '🚀 Rocket', unlock: 'asteroids-wave3' },
    saucer: { name: '🛸 Saucer', unlock: 'asteroids-wave6' },
    gold: { name: '✨ Gold', unlock: 'asteroids-10k' },
  },
  invaders: {
    classic: { name: '👾 Classic' },
    ocean: { name: '🐙 Ocean', unlock: 'invaders-wave2' },
    spooky: { name: '👻 Spooky', unlock: 'invaders-saucer' },
    candy: { name: '🍭 Candy', unlock: 'invaders-5k' },
  },
  '2048': {
    classic: { name: 'Classic' },
    ocean: { name: '🌊 Ocean', unlock: '2048-512' },
    neon: { name: '💜 Neon', unlock: '2048-2048' },
  },
  'blocks-1p': {
    classic: { name: 'Classic' },
    candy: { name: '🍬 Candy', unlock: 'blocks-four' },
    retro: { name: '🟩 Retro green', unlock: 'blocks-40' },
    neon: { name: '💜 Neon', unlock: 'blocks-10k' },
  },
  gems: {
    classic: { name: 'Classic' },
    fruit: { name: '🍒 Fruit', unlock: 'gems-five' },
    space: { name: '🪐 Space', unlock: 'gems-chain4' },
    candy: { name: '🍬 Candy', unlock: 'gems-3000' },
  },
  'stack-1p': {
    classic: { name: 'Classic' },
    candy: { name: '🍬 Candy', unlock: 'stack-10' },
    glass: { name: '🧊 Glass', unlock: 'stack-25' },
    gold: { name: '👑 Gold', unlock: 'stack-perfect5' },
  },
  solitaire: {
    classic: { name: 'Classic blue' },
    midnight: { name: '🌌 Midnight', unlock: 'solitaire-win' },
    rose: { name: '🌹 Rose', unlock: 'solitaire-draw3' },
    gold: { name: '👑 Gold', unlock: 'solitaire-fast' },
  },
  freecell: {
    classic: { name: 'Classic' },
    four: { name: '🎨 Four colours', unlock: 'freecell-win' },
    felt: { name: '🟩 Green felt', unlock: 'freecell-8min' },
    night: { name: '🌙 Night cards', unlock: 'freecell-120' },
  },
  mahjong: {
    classic: { name: 'Ivory' },
    jade: { name: '🟢 Jade', unlock: 'mahjong-clear' },
    ink: { name: '⚫ Ink', unlock: 'mahjong-nohelp' },
    rose: { name: '🌸 Rose', unlock: 'mahjong-10min' },
  },
  'memory-1p': {
    animals: { name: '🐶 Animals' },
    food: { name: '🍕 Food', unlock: 'memory-solve' },
    sea: { name: '🐠 Sea', unlock: 'memory-12' },
    space: { name: '🚀 Space', unlock: 'memory-large' },
  },
  dogpark: {
    golden: { name: '🐕 Golden retriever' },
    aussie: { name: '🐾 Aussie', unlock: 'dogpark-solve' },
  },
  simon: {
    classic: { name: 'Classic' },
    pastel: { name: '🍬 Pastel', unlock: 'simon-10' },
    neon: { name: '💜 Neon', unlock: 'simon-20' },
  },
};

/** The look a game was started with, or its first one. */
export function lookOf(ctx, game) {
  const list = LOOKS[game];
  const first = Object.keys(list)[0];
  const look = settingOf(ctx, 'look', first);
  return Object.prototype.hasOwnProperty.call(list, look) ? look : first;
}
