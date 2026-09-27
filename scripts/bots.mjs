// Headless bot-vs-bot tournament (spec bot §8):
// npm run bots -- --games 200 --iq 3v3 --level 2 [--length 1] [--seed 1] [--hide-airport]
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const USAGE = 'usage: npm run bots -- [--games N] [--iq AvB] [--level L] [--length M] [--seed S] [--hide-airport]';
/** Flags that take no value — parsed in one step instead of a `--key value` pair. */
const BOOLEAN_FLAGS = new Set(['hide-airport']);

function args(argv) {
  const out = { games: '100', iq: '3v3', level: '2', length: '1', seed: '1', 'hide-airport': false };
  for (let i = 0; i < argv.length; ) {
    const key = argv[i].replace(/^--/, '');
    if (!(key in out)) throw new Error(`bad argument ${argv[i]}\n${USAGE}`);
    if (BOOLEAN_FLAGS.has(key)) {
      out[key] = true;
      i += 1;
    } else {
      if (argv[i + 1] === undefined) throw new Error(`bad argument ${argv[i]}\n${USAGE}`);
      out[key] = argv[i + 1];
      i += 2;
    }
  }
  return out;
}

function int(name, text, min) {
  const n = Number(text);
  if (!Number.isInteger(n) || n < min) throw new Error(`--${name} must be a whole number >= ${min}, got ${text}\n${USAGE}`);
  return n;
}

const a = args(process.argv.slice(2));
// Root-relative module ids resolve against the project root, wherever the command is run from.
const config = { root: fileURLToPath(new URL('..', import.meta.url)), logLevel: 'error' };
const load = async (id) => (await runnerImport(id, config)).module;
const t = await load('/src/games/spy-vs-spy/bot/tournament.ts');
const { isIq } = await load('/src/games/spy-vs-spy/bot/iq.ts');
const { isLevel, isGameLengthMultiplier } = await load('/src/games/spy-vs-spy/logic/rules.ts');

const iq = a.iq.split('v').map(Number);
if (iq.length !== 2 || !iq.every(isIq)) throw new Error(`--iq must look like 3v3 (IQ 1-5), got ${a.iq}\n${USAGE}`);
const level = int('level', a.level, 1);
if (!isLevel(level)) throw new Error(`--level ${level} does not exist\n${USAGE}`);
const gameLength = Number(a.length);
if (!isGameLengthMultiplier(gameLength)) throw new Error(`--length must be 1, 1.5, 2 or 3, got ${a.length}\n${USAGE}`);
const opts = {
  games: int('games', a.games, 1), iq, level, gameLength, seed: int('seed', a.seed, 0), hideAirport: a['hide-airport'],
};

console.log(t.formatReport(opts, t.runTournament(opts)));
