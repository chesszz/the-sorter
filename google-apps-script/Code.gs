const CONFIG = {
  sheetName: 'submissions',
  songCatalogUrl: 'https://raw.githubusercontent.com/chesszz/the-sorter/main/data/songs.json',
  songCatalogCacheKey: 'phantom-siita-song-catalog',
  songCatalogCacheSeconds: 300
};

const HEADERS = [
  'submission_id',
  'display_name',
  'edit_token_hash',
  'browser_id_hash',
  'ranking_json',
  'created_at',
  'updated_at',
  'ranking_summary'
];

function setup() {
  const sheet = getSheet_();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
}

// Run this once from the Apps Script editor to authorize fetching songs.json.
function authorizeCatalogAccess() {
  getSongTitles_();
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
          data: getStats_(parseSongIds_(event.parameter.songIds))
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
    if (body.action === 'delete') {
      return postMessage_(
        Object.assign(deleteSubmission_(body), { requestId: String(body.requestId || '') })
      );
    }
    if (body.action === 'submit') {
      return postMessage_(
        Object.assign(saveSubmission_(body), { requestId: String(body.requestId || '') })
      );
    }
    return postMessage_({
      ok: false,
      message: 'Unknown action.',
      requestId: String(body.requestId || '')
    });
  } catch (error) {
    let requestId = '';
    try {
      requestId = String(
        JSON.parse(event.parameter?.payload || event.postData?.contents || '{}').requestId || ''
      );
    } catch (_) {}
    return postMessage_({ ok: false, message: error.message || 'Request failed.', requestId });
  }
}

function deleteSubmission_(body) {
  const submissionId = String(body.submissionId || '');
  const editToken = String(body.editToken || '');
  if (!submissionId || !editToken)
    throw new Error('Your edit link is required to delete this ranking.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const existing = readRows_(sheet).find((row) => row.submission_id === submissionId);
    if (!existing) return { ok: true };
    if (existing.edit_token_hash !== hash_(editToken))
      throw new Error('That edit link is invalid or expired.');
    sheet.deleteRow(existing.rowNumber);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function saveSubmission_(body) {
  const displayName = String(body.displayName || '').trim();
  const browserId = String(body.browserId || '');
  const ranking = validateRanking_(body.ranking);
  const rankingSummary = formatRankingSummary_(body.ranking, ranking);
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

    if (submissionId && rows.some((row) => row.submission_id === submissionId)) {
      const existing = rows.find(
        (row) => row.submission_id === submissionId && row.edit_token_hash === tokenHash
      );
      if (!existing) {
        const sameBrowser = rows.find(
          (row) => row.submission_id === submissionId && row.browser_id_hash === browserHash
        );
        if (sameBrowser) {
          updateRow_(sheet, sameBrowser.rowNumber, {
            display_name: displayName,
            ranking_json: JSON.stringify(ranking),
            ranking_summary: rankingSummary,
            updated_at: new Date()
          });
          sheet.getRange(sameBrowser.rowNumber, 4).setValue(tokenHash);
          return { ok: true, submissionId, editToken };
        }
        throw new Error('That edit link is invalid or expired.');
      }
      updateRow_(sheet, existing.rowNumber, {
        display_name: displayName,
        ranking_json: JSON.stringify(ranking),
        ranking_summary: rankingSummary,
        updated_at: new Date()
      });
      return { ok: true, submissionId, editToken };
    }

    const duplicate = rows.find((row) => row.browser_id_hash === browserHash);
    if (duplicate) {
      throw new Error(
        'This browser already has a ranking for this song list. Use your saved edit link to update it.'
      );
    }

    const newSubmissionId = submissionId || browserId;
    const newEditToken =
      editToken || Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    sheet.appendRow([
      newSubmissionId,
      displayName,
      hash_(newEditToken),
      browserHash,
      JSON.stringify(ranking),
      new Date(),
      new Date(),
      rankingSummary
    ]);
    return { ok: true, submissionId: newSubmissionId, editToken: newEditToken };
  } finally {
    lock.releaseLock();
  }
}

function validateRanking_(ranking) {
  if (!Array.isArray(ranking) || ranking.length < 2 || ranking.length > 1000) {
    throw new Error('Rank at least two songs.');
  }
  const songTitles = getSongTitles_();
  const seen = {};
  return ranking.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('The ranking contains an invalid song entry.');
    }
    const songId = String(entry.songId || '');
    const songTitle = String(entry.songTitle || '').trim();
    const rank = entry.rank;
    if (!Object.prototype.hasOwnProperty.call(songTitles, songId)) {
      throw new Error('The ranking contains an unknown song.');
    }
    if (seen[songId]) throw new Error('The ranking contains duplicate songs.');
    if (songTitle !== songTitles[songId]) {
      throw new Error('The ranking contains an invalid song title.');
    }
    if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 1 || rank > ranking.length) {
      throw new Error('The ranking contains an invalid rank position.');
    }
    seen[songId] = true;
    return { songId, rank };
  });
}

function getSongTitles_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CONFIG.songCatalogCacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (_) {}
  }

  const response = UrlFetchApp.fetch(CONFIG.songCatalogUrl, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error('The current song catalog could not be loaded.');
  }

  let songs;
  try {
    songs = JSON.parse(response.getContentText());
  } catch (_) {
    throw new Error('The current song catalog is invalid.');
  }
  if (!Array.isArray(songs)) throw new Error('The current song catalog is invalid.');

  const titles = {};
  songs.forEach((song) => {
    const songId = String(song?.id || '');
    const title = String(song?.name || '').trim();
    if (/^\d+$/.test(songId) && title) titles[songId] = title;
  });
  if (Object.keys(titles).length < 2) throw new Error('The current song catalog is invalid.');

  cache.put(CONFIG.songCatalogCacheKey, JSON.stringify(titles), CONFIG.songCatalogCacheSeconds);
  return titles;
}

function formatRankingSummary_(submittedRanking, ranking) {
  const titles = {};
  if (Array.isArray(submittedRanking)) {
    submittedRanking.forEach((entry) => {
      const songId = String(entry.songId || '');
      const title = String(entry.songTitle || '').trim();
      if (songId && title) titles[songId] = title;
    });
  }
  return ranking
    .map(
      (entry) =>
        `${entry.rank}. ${titles[entry.songId] || '(title unavailable)'} (ID: ${entry.songId})`
    )
    .join('\n');
}

function parseRanking_(rankingJson) {
  try {
    const ranking = JSON.parse(rankingJson);
    return Array.isArray(ranking) ? ranking : [];
  } catch (_) {
    return [];
  }
}

function getStats_(requestedSongIds) {
  const rows = readRows_(getSheet_());
  const songIds = requestedSongIds.length ? requestedSongIds : getSongIdsFromRows_(rows);
  const songScores = {};
  songIds.forEach((id) => (songScores[id] = []));
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

  const songs = songIds.map((songId) => {
    const values = songScores[songId];
    return {
      songId,
      sentiment: roundOneDecimal_(average_(values) * 100),
      sampleSize: values.length
    };
  });

  const matchups = [];
  for (let left = 0; left < songIds.length; left += 1) {
    for (let right = left + 1; right < songIds.length; right += 1) {
      let leftWins = 0;
      let rightWins = 0;
      let ties = 0;
      participants.forEach((participant) => {
        const leftRank = participant.ranks[songIds[left]];
        const rightRank = participant.ranks[songIds[right]];
        if (leftRank === undefined || rightRank === undefined) return;
        if (leftRank < rightRank) leftWins += 1;
        else if (rightRank < leftRank) rightWins += 1;
        else ties += 1;
      });
      matchups.push({
        leftSongId: songIds[left],
        rightSongId: songIds[right],
        leftWins,
        rightWins,
        ties,
        total: leftWins + rightWins + ties
      });
    }
  }

  const correlations = [];
  for (let left = 0; left < songIds.length; left += 1) {
    for (let right = left + 1; right < songIds.length; right += 1) {
      const leftValues = [];
      const rightValues = [];
      participants.forEach((participant) => {
        const leftScore = participant.scores[songIds[left]];
        const rightScore = participant.scores[songIds[right]];
        if (leftScore === undefined || rightScore === undefined) return;
        leftValues.push(leftScore);
        rightValues.push(rightScore);
      });
      correlations.push({
        leftSongId: songIds[left],
        rightSongId: songIds[right],
        correlation: round_(correlation_(leftValues, rightValues)),
        sampleSize: leftValues.length
      });
    }
  }

  const consensus = {};
  songs.forEach((song) => (consensus[song.songId] = song.sentiment / 100));
  const consensusRanks = buildConsensusRanks_(songs);
  const participantStats = participants.map((participant) => {
    const ids = songIds.filter((id) => participant.scores[id] !== undefined);
    const scoreDistance = ids.length
      ? ids.reduce((sum, id) => sum + Math.abs(participant.scores[id] - consensus[id]), 0) /
        ids.length
      : 1;
    return {
      displayName: participant.name,
      similarity: weightedKendallSimilarity_(participant, ids, consensusRanks),
      distance: round_(scoreDistance),
      rankedSongCount: ids.length,
      ranks: participant.ranks
    };
  });

  return {
    submissionCount: rows.length,
    songs,
    matchups,
    correlations,
    participants: participantStats
  };
}

function parseSongIds_(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^\d+$/.test(id))
    )
  ).slice(0, 1000);
}

function getSongIdsFromRows_(rows) {
  const ids = [];
  rows.forEach((row) => {
    parseRanking_(row.ranking_json).forEach((entry) => {
      const songId = String(entry.songId || '');
      if (/^\d+$/.test(songId) && !ids.includes(songId)) ids.push(songId);
    });
  });
  return ids;
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
  } else {
    migrateVersionedSheet_(sheet);
  }
  return sheet;
}

function migrateVersionedSheet_(sheet) {
  const headerCount = Math.max(sheet.getLastColumn(), HEADERS.length);
  const headers = sheet.getRange(1, 1, 1, headerCount).getValues()[0].map(String);
  if (headers[0] === 'submission_id' && headers[1] === 'version') {
    sheet.deleteColumn(2);
  }
  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].map(String);
  if (currentHeaders.join('|') !== HEADERS.join('|')) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function readRows_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  return values.map((row, index) => ({
    rowNumber: index + 2,
    submission_id: String(row[0]),
    display_name: String(row[1]),
    edit_token_hash: String(row[2]),
    browser_id_hash: String(row[3]),
    ranking_json: String(row[4])
  }));
}

function updateRow_(sheet, rowNumber, values) {
  const row = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
  if (values.display_name !== undefined) row[1] = values.display_name;
  if (values.ranking_json !== undefined) row[4] = values.ranking_json;
  if (values.updated_at !== undefined) row[6] = values.updated_at;
  if (values.ranking_summary !== undefined) row[7] = values.ranking_summary;
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

function roundOneDecimal_(value) {
  return Math.round(value * 10) / 10;
}

function buildConsensusRanks_(songs) {
  const ordered = songs.slice().sort((left, right) => right.sentiment - left.sentiment);
  const ranks = {};
  let position = 0;
  let currentRank = 0;
  let previousSentiment;
  ordered.forEach((song) => {
    position += 1;
    if (song.sentiment !== previousSentiment) currentRank = position;
    ranks[song.songId] = currentRank;
    previousSentiment = song.sentiment;
  });
  return ranks;
}

function compareRankOrder_(leftRank, rightRank) {
  if (leftRank < rightRank) return 1;
  if (leftRank > rightRank) return -1;
  return 0;
}

function weightedKendallSimilarity_(participant, ids, consensusRanks) {
  let agreementWeight = 0;
  let totalWeight = 0;
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      const leftId = ids[left];
      const rightId = ids[right];
      const userOrder = compareRankOrder_(participant.ranks[leftId], participant.ranks[rightId]);
      const consensusOrder = compareRankOrder_(consensusRanks[leftId], consensusRanks[rightId]);
      const weight = 1 + Math.abs(consensusRanks[leftId] - consensusRanks[rightId]);
      totalWeight += weight;
      if (userOrder === consensusOrder) agreementWeight += weight;
      else if (userOrder === 0 || consensusOrder === 0) agreementWeight += weight / 2;
    }
  }
  return totalWeight ? round_((agreementWeight / totalWeight) * 100) : 50;
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
  const body = JSON.stringify({
    type: 'community-ranking-response',
    requestId: value.requestId,
    ok: value.ok,
    message: value.message
  }).replace(/</g, '\\u003c');
  const output = HtmlService.createHtmlOutput(
    `<!doctype html><script>window.top.postMessage(${body}, '*');</script>`
  );
  return output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
