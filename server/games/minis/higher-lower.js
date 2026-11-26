// Higher or Lower: a card shows; you each pick, in secret, whether the next one is higher or lower.
// The next card turns over: right, and you score your streak (1 for the first right call, 2 for the
// next in a row, 3 …); wrong, or no pick in time, and your streak starts again. The same number
// again: nobody's right or wrong, the streaks stand. Eight cards; the most points wins.
export const TIMING = { pickMs: 4500, showMs: 2200 };
export const CARDS = 8; // calls in a game

export default {
  id: 'higher-lower', kind: 'party', look: '2d', name: 'Higher or Lower', order: 'HIGHER OR LOWER?', howTo: 'Is the next card higher or lower? Right calls in a row score more', durationMs: 70000,
  create(api) {
    // Ranks 1 (ace) … 13 (king), from a shuffled deck so a run of cards feels like a real deck.
    const deck = [];
    for (let r = 1; r <= 13; r++) for (let k = 0; k < 4; k++) deck.push(r);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(api.rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const cards = deck.slice(0, CARDS + 1);
    let at = 0; // the card showing
    let stage = 'pick';
    let picks = [null, null];
    let timer = null;
    const points = [0, 0];
    const streak = [0, 0];
    let last = null; // { from, to, picks, right: [bool | null, …], gained }

    function newCall() {
      stage = 'pick';
      picks = [null, null];
      timer = api.setTimeout(reveal, TIMING.pickMs);
      api.update();
    }

    function reveal() {
      api.clearTimeout(timer);
      const from = cards[at];
      const to = cards[at + 1];
      const answer = to > from ? 'higher' : to < from ? 'lower' : null;
      const right = [0, 1].map((s) => (answer === null ? null : picks[s] === answer));
      const gained = [0, 0];
      for (const s of [0, 1]) {
        if (right[s] === null) continue;
        if (right[s]) { streak[s]++; gained[s] = streak[s]; points[s] += streak[s]; } else streak[s] = 0;
      }
      last = { from, to, picks: picks.slice(), right, gained };
      at++;
      stage = 'show';
      if (at >= CARDS) {
        api.update();
        timer = api.setTimeout(finish, TIMING.showMs);
        return;
      }
      timer = api.setTimeout(newCall, TIMING.showMs);
      api.update();
    }

    function finish() {
      api.end({ winner: points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1 });
    }

    return {
      start: newCall,
      onInput(slot, input) {
        if (input.type !== 'pick' || stage !== 'pick' || (slot !== 0 && slot !== 1) || picks[slot] !== null) return;
        if (input.call !== 'higher' && input.call !== 'lower') return;
        picks[slot] = input.call;
        if (picks[0] !== null && picks[1] !== null) reveal();
        else api.update();
      },
      onTimeUp: finish,
      view: (slot) => ({
        card: cards[at], call: at + 1, calls: CARDS, stage,
        picked: picks.map((p) => p !== null),
        mine: slot === 0 || slot === 1 ? picks[slot] : null, // (yours only: theirs stays secret till the card turns)
        last, points, streak, pickMs: TIMING.pickMs,
      }),
    };
  },
};
