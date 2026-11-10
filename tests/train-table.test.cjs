const { test } = require('node:test');
const assert = require('node:assert/strict');
const { guessColumns, answerType, readiness } = require('../.private/test-build/train-table.js');

// 60 tickets: the agent column gives the team away, the ticket id is an id, customers repeat.
const teams = ['Billing', 'Technical support', 'Account changes'];
const agents = { Billing: 'Ana', 'Technical support': 'Raj', 'Account changes': 'Li' };
const tickets = {
  headers: ['ticket_id', 'customer_id', 'message', 'channel', 'assigned_agent', 'team'],
  rows: Array.from({ length: 60 }, (_, i) => [`T-${i}`, `C-${i % 20}`, `message number ${i}`, ['chat', 'email'][i % 2], agents[teams[i % 3]], teams[i % 3]]),
};

test('the guess puts the answer on the right, ids and give-aways out, and keeps customers together', () => {
  assert.deepEqual(guessColumns(tickets), {
    decide: 'team', group: 'customer_id', reads: ['message', 'channel'], unused: ['ticket_id', 'assigned_agent'],
  });
  // No answer-like name: the last column is the guess.
  const plain = { headers: ['text', 'score'], rows: [['a', 'x'], ['b', 'y']] };
  assert.equal(guessColumns(plain).decide, 'score');
});

test('answer types: yes or no and picks 1 of N train today; the rest say why not', () => {
  assert.deepEqual(answerType(['no', 'yes', 'yes', '']), { type: 'yesno', answers: ['yes', 'no'] });
  assert.deepEqual(answerType(['b', 'a', 'b', 'c']), { type: 'choice', answers: ['a', 'b', 'c'] });
  assert.deepEqual(answerType(['1', '2', '3', '4', '5', '5']), { type: 'choice', answers: ['1', '2', '3', '4', '5'] });
  assert.equal(answerType(Array.from({ length: 300 }, (_, i) => String(i * 1.5))).type, 'numbers');
  assert.equal(answerType(Array.from({ length: 300 }, (_, i) => `free text ${i}`)).type, 'toomany');
  assert.deepEqual(answerType(['ok', 'ok']), { type: 'single', answer: 'ok' });
  assert.deepEqual(answerType(['', ' ']), { type: 'missing' });
});

test('readiness builds the mapping, leaves out flagged rows and names the first problem', () => {
  const guess = guessColumns(tickets);
  const ready = readiness(tickets, guess);
  assert.equal(ready.problem, '');
  assert.deepEqual(ready.mapping, { inputs: ['message', 'channel'], answer: 'team', group: 'customer_id' });
  assert.deepEqual(ready.outcomes, ['Account changes', 'Billing', 'Technical support']);
  assert.equal(ready.independent, false);
  assert.equal(ready.report.included, 60);

  const repeated = { ...tickets, rows: [...tickets.rows, tickets.rows[0]] };  // the same information twice
  const fixed = readiness(repeated, guess);
  assert.equal(fixed.problem, '');
  assert.equal(fixed.left, 2);  // both copies are left out
  assert.equal(fixed.report.included, 59);

  assert.match(readiness(tickets, { ...guess, decide: '' }).problem, /right of the line/);
  assert.match(readiness(tickets, { ...guess, reads: [] }).problem, /at least one column/);
  assert.match(readiness(tickets, { ...guess, decide: 'message', reads: ['channel'] }).problem, /different values/);
  const few = { ...tickets, rows: tickets.rows.slice(0, 4) };
  assert.match(readiness(few, { ...guess, group: '' }).problem, /needs at least 3 separate cases/);
  assert.equal(readiness(tickets, { ...guess, group: '' }).independent, true);
});

test('the run form on the table page lays out its fields', () => {
  // The submission form's field styles live under the older page's wrapper, which the table page does not use.
  const css = require('node:fs').readFileSync('components/train-table.module.css', 'utf8');
  assert.match(css, /:where\(\.review form\) label[^{]*\{[^}]*display: block/);
  assert.match(css, /:where\(\.review form\) input:not\(\[type=checkbox\]\):not\(\[type=radio\]\)[^{]*\{[^}]*display: block[^}]*border: 1px solid/);
});
