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
vm.runInContext(readFileSync(new URL('./Code.gs', import.meta.url), 'utf8'), context);
context.getSheet_ = () => ({ appendRow: (row) => rows.push(row) });
context.hash_ = (value) => `hashed:${value}`;
context.readRows_ = () => rows.map((row, index) => ({
  rowNumber: index + 2, submission_id: row[0], version: row[1],
  display_name: row[2], edit_token_hash: row[3], browser_id_hash: row[4],
  ranking_json: row[5]
}));
context.updateRow_ = (_, number, values) => {
  rows[number - 2][2] = values.display_name;
  rows[number - 2][5] = values.ranking_json;
};

const payload = {
  action: 'submit', requestId: 'request-1', version: 'phantom-siita-v1',
  browserId: 'browser-1', submissionId: 'browser-1:phantom-siita-v1',
  editToken: 'private-token', displayName: 'Tester',
  ranking: [{ songId: '14', rank: 1 }, { songId: '9', rank: 2 }]
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
assert.equal(submit({ ...payload, displayName: 'Updated' }).ok, true);
assert.equal(rows.length, 1, 'retry must update, not duplicate');
assert.equal(rows[0][2], 'Updated');
assert.equal(submit({ ...payload, ranking: [] }).ok, false);
assert.equal(submit({ ...payload, browserId: 'someone-else', editToken: 'wrong' }).ok, false);
assert.equal(rows.length, 1);
console.log('Passed: first submission, retry/update, validation error, invalid edit, callback contract.');
