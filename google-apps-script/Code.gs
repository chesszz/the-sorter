const CONFIG = {
  sheetName: 'submissions',
  defaultVersion: 'phantom-siita-v1',
  songIds: ['14', '9', '4', '6', '3', '16', '7', '15', '5', '13', '2', '1', '10', '11', '8', '12']
};

const HEADERS = [
  'submission_id',
  'version',
  'display_name',
  'edit_token_hash',
  'browser_id_hash',
  'ranking_json',
  'created_at',
  'updated_at'
];

function setup() {
  const sheet = getSheet_();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
}

function doGet(event) {
  try {
    const action = event.parameter.action || 'stats';
    if (action === 'health')
      return json_({ ok: true, data: { status: 'ok' } }, event.parameter.callback);
    if (action === 'stats') {
      return json_(
        {
          ok: true,
          data: getStats_(event.parameter.version || CONFIG.defaultVersion)
        },
        event.parameter.callback
      );
    }
    return json_({ ok: false, message: 'Unknown action.' }, event.parameter.callback);
  } catch (error) {
    return json_(
      { ok: false, message: error.message || 'Request failed.' },
      event.parameter.callback
    );
  }
}

function doPost(event) {
  try {
    const bodyText =
      event.parameter && event.parameter.payload
        ? event.parameter.payload
        : event.postData.contents || '{}';
    const body = JSON.parse(bodyText);
    if (body.action === 'submit') {
      return postMessage_(Object.assign(saveSubmission_(body), { requestId: String(body.requestId || '') }));
    }
    return postMessage_({ ok: false, message: 'Unknown action.', requestId: String(body.requestId || '') });
  } catch (error) {
    let requestId = '';
    try {
      requestId = String(JSON.parse(event.parameter?.payload || event.postData?.contents || '{}').requestId || '');
    } catch (_) {}
    return postMessage_({ ok: false, message: error.message || 'Request failed.', requestId });
  }
}

function saveSubmission_(body) {
  const version = String(body.version || CONFIG.defaultVersion);
  const displayName = String(body.displayName || '').trim();
  const browserId = String(body.browserId || '');
  const ranking = validateRanking_(body.ranking, version);
  if (!displayName || displayName.length > 40) throw new Error('Enter a name up to 40 characters.');
  if (!browserId) throw new Error('Missing browser identifier.');

  const editToken = String(body.editToken || '');
  const submissionId = String(body.submissionId || '');
  const sheet = getSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rows = readRows_(sheet);
    const browserHash = hash_(browserId);
    const tokenHash = editToken ? hash_(editToken) : '';

    if (submissionId && tokenHash) {
      const existing = rows.find(
        (row) => row.submission_id === submissionId && row.edit_token_hash === tokenHash
      );
      if (!existing) {
        const sameBrowser = rows.find(
          (row) =>
            row.submission_id === submissionId &&
            row.version === version &&
            row.browser_id_hash === browserHash
        );
        if (sameBrowser) {
          const existingRanking = parseRanking_(sameBrowser.ranking_json);
          updateRow_(sheet, sameBrowser.rowNumber, {
            display_name: displayName,
            ranking_json: JSON.stringify(mergeRankings_(existingRanking, ranking)),
            updated_at: new Date()
          });
          sheet.getRange(sameBrowser.rowNumber, 4).setValue(tokenHash);
          return { ok: true, submissionId, editToken };
        }
        throw new Error('That edit link is invalid or expired.');
      }
      const existingRanking = parseRanking_(existing.ranking_json);
      updateRow_(sheet, existing.rowNumber, {
        version,
        display_name: displayName,
        ranking_json: JSON.stringify(mergeRankings_(existingRanking, ranking)),
        updated_at: new Date()
      });
      return { ok: true, submissionId, editToken };
    }

    const duplicate = rows.find(
      (row) => row.version === version && row.browser_id_hash === browserHash
    );
    if (duplicate) {
      throw new Error(
        'This browser already has a ranking for this song list. Use your saved edit link to update it.'
      );
    }

    const newSubmissionId = submissionId || `${browserId}:${version}`;
    const newEditToken =
      editToken || Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    sheet.appendRow([
      newSubmissionId,
      version,
      displayName,
      hash_(newEditToken),
      browserHash,
      JSON.stringify(ranking),
      new Date(),
      new Date()
    ]);
    return { ok: true, submissionId: newSubmissionId, editToken: newEditToken };
  } finally {
    lock.releaseLock();
  }
}

function validateRanking_(ranking, version) {
  if (version !== CONFIG.defaultVersion)
    throw new Error('This song list version is not supported.');
  if (!Array.isArray(ranking) || ranking.length < 2 || ranking.length > CONFIG.songIds.length) {
    throw new Error('Rank at least two songs.');
  }
  const validIds = {};
  CONFIG.songIds.forEach((id) => (validIds[id] = true));
  const seen = {};
  return ranking.map((entry) => {
    const songId = String(entry.songId || '');
    const rank = Number(entry.rank);
    if (!validIds[songId] || seen[songId] || !Number.isFinite(rank)) {
      throw new Error('The ranking contains invalid or duplicate songs.');
    }
    seen[songId] = true;
    return { songId, rank };
  });
}

function parseRanking_(rankingJson) {
  try {
    const ranking = JSON.parse(rankingJson);
    return Array.isArray(ranking) ? ranking : [];
  } catch (_) {
    return [];
  }
}

function mergeRankings_(existingRanking, newRanking) {
  const merged = {};
  existingRanking.forEach((entry) => (merged[String(entry.songId)] = entry));
  newRanking.forEach((entry) => (merged[String(entry.songId)] = entry));
  return Object.keys(merged).map((songId) => merged[songId]);
}

function getStats_(version) {
  const rows = readRows_(getSheet_()).filter((row) => row.version === version);
  const songScores = {};
  CONFIG.songIds.forEach((id) => (songScores[id] = []));
  const participants = [];
  rows.forEach((row) => {
    const ranking = parseRanking_(row.ranking_json);
    const rankMap = {};
    const scoreMap = {};
    const maxRank = ranking.reduce((max, entry) => Math.max(max, Number(entry.rank)), 0);
    ranking.forEach((entry) => {
      const songId = String(entry.songId);
      const rank = Number(entry.rank);
      if (!songScores[songId] || !Number.isFinite(rank)) return;
      rankMap[songId] = rank;
      scoreMap[songId] = normalizedScore_(rank, maxRank);
      songScores[songId].push(scoreMap[songId]);
    });
    participants.push({ name: row.display_name, ranks: rankMap, scores: scoreMap });
  });

  const songs = CONFIG.songIds.map((songId) => {
    const values = songScores[songId];
    return {
      songId,
      sentiment: round_(average_(values) * 100),
      sampleSize: values.length
    };
  });

  const matchups = [];
  for (let left = 0; left < CONFIG.songIds.length; left += 1) {
    for (let right = left + 1; right < CONFIG.songIds.length; right += 1) {
      let leftWins = 0;
      let rightWins = 0;
      let ties = 0;
      participants.forEach((participant) => {
        const leftRank = participant.ranks[CONFIG.songIds[left]];
        const rightRank = participant.ranks[CONFIG.songIds[right]];
        if (leftRank === undefined || rightRank === undefined) return;
        if (leftRank < rightRank) leftWins += 1;
        else if (rightRank < leftRank) rightWins += 1;
        else ties += 1;
      });
      matchups.push({
        leftSongId: CONFIG.songIds[left],
        rightSongId: CONFIG.songIds[right],
        leftWins,
        rightWins,
        ties,
        total: leftWins + rightWins + ties
      });
    }
  }

  const correlations = [];
  for (let left = 0; left < CONFIG.songIds.length; left += 1) {
    for (let right = left + 1; right < CONFIG.songIds.length; right += 1) {
      const leftValues = [];
      const rightValues = [];
      participants.forEach((participant) => {
        const leftScore = participant.scores[CONFIG.songIds[left]];
        const rightScore = participant.scores[CONFIG.songIds[right]];
        if (leftScore === undefined || rightScore === undefined) return;
        leftValues.push(leftScore);
        rightValues.push(rightScore);
      });
      correlations.push({
        leftSongId: CONFIG.songIds[left],
        rightSongId: CONFIG.songIds[right],
        correlation: round_(correlation_(leftValues, rightValues)),
        sampleSize: leftValues.length
      });
    }
  }

  const consensus = {};
  songs.forEach((song) => (consensus[song.songId] = song.sentiment / 100));
  const participantStats = participants.map((participant) => {
    const ids = CONFIG.songIds.filter((id) => participant.scores[id] !== undefined);
    const distance = ids.length
      ? ids.reduce((sum, id) => sum + Math.abs(participant.scores[id] - consensus[id]), 0) /
        ids.length
      : 1;
    return {
      displayName: participant.name,
      similarity: round_(Math.max(0, 100 - distance * 100)),
      distance: round_(distance),
      rankedSongCount: ids.length
    };
  });

  return {
    version,
    submissionCount: rows.length,
    songs,
    matchups,
    correlations,
    participants: participantStats
  };
}

function normalizedScore_(rank, maxRank) {
  if (maxRank <= 1) return 0.5;
  return 1 - (rank - 1) / (maxRank - 1);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(CONFIG.sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readRows_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  return values.map((row, index) => ({
    rowNumber: index + 2,
    submission_id: String(row[0]),
    version: String(row[1]),
    display_name: String(row[2]),
    edit_token_hash: String(row[3]),
    browser_id_hash: String(row[4]),
    ranking_json: String(row[5])
  }));
}

function updateRow_(sheet, rowNumber, values) {
  const row = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
  if (values.version !== undefined) row[1] = values.version;
  if (values.display_name !== undefined) row[2] = values.display_name;
  if (values.ranking_json !== undefined) row[5] = values.ranking_json;
  if (values.updated_at !== undefined) row[7] = values.updated_at;
  sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([row]);
}

function hash_(value) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(digest);
}

function average_(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median_(values) {
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function percentage_(value, total) {
  return total ? (value / total) * 100 : 0;
}

function correlation_(left, right) {
  if (left.length < 2) return 0;
  const leftAverage = average_(left);
  const rightAverage = average_(right);
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  left.forEach((value, index) => {
    const leftDelta = value - leftAverage;
    const rightDelta = right[index] - rightAverage;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  });
  return leftVariance && rightVariance ? numerator / Math.sqrt(leftVariance * rightVariance) : 0;
}

function round_(value) {
  return Math.round(value * 100) / 100;
}

function json_(value, callback) {
  const body = JSON.stringify(value);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(`${callback}(${body});`).setMimeType(
      ContentService.MimeType.JAVASCRIPT
    );
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function postMessage_(value) {
  const body = JSON.stringify(value).replace(/</g, '\\u003c');
  const output = HtmlService.createHtmlOutput(
    `<!doctype html><script>window.top.postMessage(${body}, '*');</script>`
  );
  return output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
