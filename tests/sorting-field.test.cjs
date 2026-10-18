const { test } = require('node:test');
const assert = require('node:assert/strict');
const { visibleLanes, heroHeight, fieldGeometry, itemX, LANES } = require('../.private/test-build/sorting-field.js');

test('phone lanes are the four in spec positions', () => assert.deepEqual(visibleLanes(375).map(l => [l.id, l.phone.col, l.phone.row]), [['billing',0,2],['account',5,0],['tech',0,0],['review',5,2]]));
test('desk shows all six lanes', () => assert.equal(visibleLanes(1440).length, 6));
test('desk positions match the spec', () => assert.deepEqual(LANES.map(l => [l.id, l.desk.col, l.desk.row]), [['billing',0,2],['spam',1,1],['account',3,0],['tech',6,0],['sales',8,1],['review',7,2]]));
test('hero keeps 40px between console and field', () => { const w = 1100, h = heroHeight(653, w); assert.ok(fieldGeometry(w, h).top - 653 >= 40); });
test('hero never shrinks below its floor', () => { assert.equal(heroHeight(100, 1440), 860); assert.equal(heroHeight(100, 375), 720); });
test('phone tags fit the width', () => { for (const l of visibleLanes(320)) { const g = fieldGeometry(320, 720); assert.ok(g.left + l.phone.col * g.cell + 150 <= 320); } });
test('itemX ends at target, hesitant or not', () => { assert.equal(itemX(1, 10, 200, null), 200); assert.equal(itemX(1, 10, 200, 120), 200); });
test('hesitant path passes the tempting lane mid-flight', () => assert.ok(Math.abs(itemX(0.55, 10, 300, 120) - 120) < 8));
