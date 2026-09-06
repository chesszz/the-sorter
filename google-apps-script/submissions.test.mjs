import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const rows = [];
const context = vm.createContext({
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  HtmlService: {
    XFrameOptionsMode: { ALLOWALL: 'allow' },
    createHtmlOutput: (html) => ({ html, setXFrameOptionsMode() { return this; } })
  }
});
vm.runInContext(readFileSync('google-apps-script/Code.gs', 'utf8'), context);
context.getSheet_ = () => ({ appendRow: (row) => rows.push(row), deleteRow: (number) => rows.splice(number - 2, 1) });
context.hash_ = (value) => `hashed:${value}`;
context.readRows_ = () => rows.map((row, index) => ({
  rowNumber: index + 2, submission_id: row[0], display_name: row[1],
  edit_token_hash: row[2], browser_id_hash: row[3], ranking_json: row[4]
}));
context.updateRow_ = (_, number, values) => {
  rows[number - 2][1] = values.display_name;
  rows[number - 2][4] = values.ranking_json;
};

const payload = {
  action: 'submit', requestId: 'request-1',
  browserId: 'browser-1', submissionId: 'browser-1',
  editToken: 'private-token', displayName: 'Tester',
  ranking: [{ songId: '14', rank: 1 }, { songId: '9', rank: 2 }, { songId: '4', rank: 3 }]
};
function submit(body) {
  const response = context.doPost({ parameter: { payload: JSON.stringify(body) } });
  let message;
  vm.runInNewContext(response.html.match(/<script>([\s\S]*)<\/script>/)[1], {
    window: { top: { postMessage: (value) => { message = value; } } }
  });
  assert.equal(message.type, 'community-ranking-response');
  assert.equal(message.requestId, body.requestId);
  assert.equal(message.editToken, undefined);
  return message;
}
assert.equal(submit(payload).ok, true, 'first submission must create a row');
assert.equal(rows.length, 1);
assert.equal(submit({
  ...payload,
  displayName: 'Updated',
  ranking: [{ songId: '14', rank: 2 }, { songId: '9', rank: 1 }]
}).ok, true);
assert.equal(rows.length, 1, 'retry must update, not duplicate');
assert.equal(rows[0][1], 'Updated');
assert.deepEqual(JSON.parse(rows[0][4]), [
  { songId: '14', rank: 2 },
  { songId: '9', rank: 1 }
], 'an update must replace the previous ranking');
assert.equal(submit({ ...payload, ranking: [] }).ok, false);
assert.equal(submit({ ...payload, browserId: 'someone-else', editToken: 'wrong' }).ok, false);
assert.equal(rows.length, 1);
assert.equal(submit({ ...payload, action: 'delete', editToken: 'wrong' }).ok, false);
assert.equal(rows.length, 1, 'invalid token must not delete');
assert.equal(submit({ ...payload, action: 'delete' }).ok, true);
assert.equal(rows.length, 0);
assert.equal(submit({ ...payload, action: 'delete' }).ok, true, 'retry deletion safely');
assert.equal(submit(payload).ok, true, 'can submit again after deletion');
console.log('Passed: submit, update, errors, authenticated deletion, retry and resubmit.');
