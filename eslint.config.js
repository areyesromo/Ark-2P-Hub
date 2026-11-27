// ESLint: only rules that catch real mistakes (undefined names, unused variables, unreachable
// code, duplicate keys...), not style. `npm run lint`; CI runs it too.
import js from '@eslint/js';
import globals from 'globals';

// The helpers the browser scripts share through window (common.js's Ark, and each game's own).
const ARK = ['Ark', 'ArkMini', 'ArkDice', 'ArkGolf', 'ArkSound', 'ArkMotion', 'ArkSea', 'ArkMemory', 'ArkWords', 'ArkPads', 'ArkKartItems', 'ArkLD', 'ArkMusic', 'ArkTilt', 'ArkDial', 'ArkCK', 'ArkC4', 'ArkDB', 'ArkMC', 'ArkLooks', 'ArkReversi', 'ArkBJ', 'ArkFL', 'ArkMD', 'ArkBG', 'ArkGin', 'ArkCC', 'ArkChess', 'ArkLudo', 'ArkDom', 'ArkGomoku', 'ArkMorris', 'ArkCode', 'ArkHang','ArkTango','ArkZip','ArkTraffic','ArkPipes','ArkFutoshiki','ArkPeg','ArkHashi','ArkSlither','ArkPoker','ArkCrib','ArkLucky','ArkFish', 'ArkHex', 'ArkUttt', 'ArkFarkle', 'ArkWalls', 'ArkStar', 'ArkRush', 'ArkPairs', 'ArkReactionRush', 'ArkTrivia', 'ArkWordSearch', 'ArkSweeper', 'ArkBreaker', 'ArkStackSolo', 'ArkAsteroids', 'ArkBlocks', 'ArkMastermind'];

export default [
  { ignores: ['node_modules/', 'dist/', 'data/', 'desktop/bin/', 'docs/', 'asset-references/'] },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-control-regex': 'off', // (names are cleaned of control characters on purpose)
    },
  },
  // The server, tests, tools and desktop app: Node ES modules.
  {
    files: ['server/**/*.js', 'test/**/*.js', 'tools/**/*.js', 'desktop/**/*.js', '*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
  },
  { files: ['desktop/**/*.cjs'], languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } } },
  // The TV and phone pages: plain browser scripts (no bundler), sharing a few globals.
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      // (Socket.IO's io, and the hub's helpers each script hangs on window: Ark, ArkMini, ArkDice...)
      globals: { ...globals.browser, io: 'readonly', ...Object.fromEntries(ARK.map((name) => [name, 'readonly'])) },
    },
  },
];
