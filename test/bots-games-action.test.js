// The computer against itself in the slow games (see HEAVY in helpers-bots.js): a file of their
// own, so they run alongside the rest of the tests.
import { HEAVY, gameTests } from './helpers-bots.js';

gameTests(HEAVY['action']);
