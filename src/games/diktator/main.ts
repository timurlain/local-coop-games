import { cs } from '../../shared/i18n/cs';
import { randomSeed } from '../../shared/rng';
import { saveJson } from '../../shared/storage';
import { decisionById } from './logic/decision';
import { GROUPS, hasStrength, type GroupId } from './logic/groups';
import { deserialize, newSave, recordTurn, retryFromYear, type SaveFile } from './logic/save';
import { score } from './logic/score';
import type { Command, GameEvent, GameState, PoliceSnapshot } from './logic/state';
import { advance, newGame, quarterLabel, validCommands } from './logic/turn';
import { albania } from './scenario/albania';
import { forecast } from './logic/forecast';
import { motherAdvice, moneyText } from './ui/effects-text';

const T = cs.diktator;
const SAVE_KEY = 'diktator/save';
const sc = albania;
/** 1928-Q3: Zogu is crowned; from then on he is addressed as Veličenstvo. */
const CORONATION_QUARTER = 15;

const $ = (id: string) => document.getElementById(id)!;
let file: SaveFile | null = null;
let lastReport: PoliceSnapshot | null = null;
let log: string[] = [];

function name(g: GroupId): string {
  return sc.groupNames[g];
}

function describe(e: GameEvent): string | null {
  const E = T.events;
  switch (e.type) {
    case 'bankrupt': return E.bankrupt;
    case 'costsPaid': return E.costsPaid(e.amount);
    case 'forcedNo': return E.forcedNo;
    case 'policeReportRefused': return e.reason === 'noMoney' ? E.policeRefusedMoney : E.policeRefusedHostile;
    case 'decisionUnaffordable': return E.unaffordable;
    case 'decided': return `✓ ${decisionById(sc, e.id).title}`;
    case 'aidGranted': return E.aidGranted(name(e.lender), e.amount);
    case 'aidRefused':
      return e.reason === 'tooEarly' ? E.aidTooEarly(name(e.lender)) : e.reason === 'used' ? E.aidUsed(name(e.lender)) : E.aidUnpopular(name(e.lender));
    case 'swissTransfer': return E.swiss(e.amount);
    case 'assassination': return e.survived ? E.assassinationSurvived(name(e.faction)) : null;
    case 'warThreat': return E.warThreat;
    case 'invasion': return e.won ? E.invasionWon(e.home, e.enemy) : E.invasionLost(e.home, e.enemy);
    case 'news': return `📰 ${sc.news.find((n) => n.id === e.id)!.title}`;
    case 'revolution': return E.revolution(name(e.faction), name(e.ally), e.strength);
    case 'planeFailed': return E.planeFailed;
    case 'joking': return E.joking;
    case 'revolutionFight': return E.fight(e.rebels, e.ours, e.won);
    case 'punished': return E.punished;
    default: return null;
  }
}

function endingText(s: GameState): string {
  if (s.phase.kind !== 'ended') return '';
  const e = s.phase.ending;
  if (e.kind === 'survived') return T.endings.survived;
  if (e.kind === 'escaped') return e.via === 'plane' ? T.endings.plane : T.endings.escapedMountains;
  return T.endings[e.cause];
}

function button(label: string, key: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.innerHTML = `<span class="key">${key}</span>`;
  b.append(label);
  b.dataset.key = key;
  b.addEventListener('click', onClick);
  return b;
}

function commandLabel(cmd: Command): string {
  switch (cmd.type) {
    case 'answer': return T[cmd.answer];
    case 'policeReport': return T.policeReport;
    case 'endDay': return T.endDay;
    case 'decide': {
      const d = decisionById(sc, cmd.decision);
      if (d.special?.kind === 'swiss' || d.special?.kind === 'aid' || !file) return d.title;
      return `${d.title} (${moneyText(d.effects)}) — Matka: ${motherAdvice(forecast(file.current, d.effects), sc.groupNames)}`;
    }
    case 'flee': return T.flee;
    case 'fight': return T.fight;
    case 'ally': return name(cmd.group);
    case 'punish': return cmd.punish ? T.punishYes : T.punishNo;
    default:
      return cmd.type;
  }
}

function play(cmd: Command): void {
  if (!file) return;
  const { state, events } = advance(sc, file.current, cmd);
  for (const e of events) {
    if (e.type === 'policeReport') lastReport = e.report;
    const line = describe(e);
    if (line) log.push(line);
  }
  file = recordTurn(file, state);
  saveJson(SAVE_KEY, file);
  render();
}

function renderReport(): void {
  const r = $('report');
  r.innerHTML = '';
  if (!lastReport) return;
  const table = document.createElement('table');
  for (const g of GROUPS) {
    const tr = document.createElement('tr');
    const plot = (g === 'armada' || g === 'rolnici' || g === 'statkari') ? lastReport.plots[g] : null;
    const plotText = !plot || plot.kind === 'none' ? '' : plot.kind === 'assassination' ? T.plots.assassination : T.plots.revolution(name(plot.ally));
    const strCell = hasStrength(g) ? `<span class="bar" style="width:${lastReport.str[g] * 12}px"></span> ${lastReport.str[g]}` : '';
    tr.innerHTML = `<td>${name(g)}</td><td><span class="bar" style="width:${lastReport.pop[g] * 12}px"></span> ${lastReport.pop[g]}</td><td>${strCell}</td><td class="plot">${plotText}</td>`;
    table.append(tr);
  }
  const head = document.createElement('tr');
  head.innerHTML = `<td></td><td>${T.popularity}</td><td>${T.strength}</td><td></td>`;
  table.prepend(head);
  r.append(table);
}

function render(): void {
  $('title').textContent = T.title;
  $('back').textContent = T.back;
  const logEl = $('log');
  logEl.innerHTML = '';
  for (const line of log.slice(-8)) {
    const p = document.createElement('p');
    p.textContent = line;
    logEl.append(p);
  }
  const prompt = $('prompt');
  const choices = $('choices');
  choices.innerHTML = '';
  if (!file) {
    prompt.textContent = T.subtitle;
    choices.append(button(T.newGame, '1', startNew));
    let raw: string | null = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch { /* storage unavailable */ }
    const saved = deserialize(raw);
    if (saved) choices.append(button(T.continueGame, '2', () => { file = saved; render(); }));
    return;
  }
  const s = file.current;
  const { year, q } = quarterLabel(Math.max(1, s.quarter));
  $('date').textContent = T.quarter(year, q);
  $('money').textContent = [T.treasury(s.treasury), T.costs(s.costs), T.swiss(s.swiss), T.guard(s.guard)].join('\n');
  renderReport();

  if (s.phase.kind === 'ended') {
    prompt.textContent = `${endingText(s)} ${T.score(score(s, s.phase.ending).total)}`;
    let key = 1;
    const retry = retryFromYear(file);
    if (retry) choices.append(button(T.retry(quarterLabel(retry.state.quarter).year), String(key++), () => { file = retry.file; log = []; lastReport = null; render(); }));
    choices.append(button(T.newGame, String(key++), startNew));
    return;
  }

  if (s.phase.kind === 'audience') {
    const p = sc.petitions.find((x) => x.id === (s.phase as { petition: string }).petition)!;
    const self = p.effects.pop?.[p.from] ?? 0;
    prompt.textContent =
      `${T.audienceFrom(name(p.from))} — ${T.audienceAsk(T.address(s.quarter >= CORONATION_QUARTER))} ${p.title}? ` +
      `(Peníze: ${moneyText(p.effects)}.) Matka o „ano“: ${motherAdvice(forecast(s, p.effects), sc.groupNames)} ` +
      `Matka o „ne“: ${motherAdvice(forecast(s, { pop: { [p.from]: -self } }), sc.groupNames)}`;
  } else if (s.phase.kind === 'chooseAlly') {
    prompt.textContent = T.chooseAlly;
  } else {
    prompt.textContent = '';
  }

  let key = 1;
  let section = 0;
  for (const cmd of validCommands(sc, s)) {
    if (cmd.type === 'decide') {
      const d = decisionById(sc, cmd.decision);
      if (d.section !== section) {
        section = d.section;
        const h = document.createElement('h2');
        h.textContent = T.decisionSections[section];
        choices.append(h);
      }
      if (d.special?.kind === 'swiss') {
        for (const share of [1, 2, 3, 4] as const) {
          choices.append(button(`${d.title} (${T.swissShare(share)})`, String(key++), () => play({ ...cmd, share })));
        }
        continue;
      }
    }
    choices.append(button(commandLabel(cmd), key <= 9 ? String(key) : '', () => play(cmd)));
    key++;
  }
}

function startNew(): void {
  const { state, events } = newGame(sc, randomSeed());
  file = newSave(sc.id, state);
  lastReport = null;
  log = events.map(describe).filter((x): x is string => x !== null);
  saveJson(SAVE_KEY, file);
  render();
}

window.addEventListener('keydown', (ev) => {
  const b = document.querySelector<HTMLButtonElement>(`#choices button[data-key="${ev.key}"]`);
  if (b) b.click();
});

render();
