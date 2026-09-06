# Google Sheets community rankings

The community submission feature uses a private Google Sheet and a bound Google Apps Script web app. GitHub Pages only serves the frontend; it never receives Google credentials.

## Create the backend

1. Create a new Google Sheet.
2. Open **Extensions → Apps Script**.
3. Replace the default script with [`google-apps-script/Code.gs`](./google-apps-script/Code.gs).
4. Save the project and run `setup` once from the Apps Script editor. Approve the spreadsheet permission prompt.
5. Choose **Deploy → New deployment → Web app**.
6. Set **Execute as** to yourself and **Who has access** to anyone.
7. Copy the web app URL ending in `/exec`.

Keep the spreadsheet private. Visitors interact only with the web app endpoint.

## Connect GitHub Pages

In the repository, open **Settings → Secrets and variables → Actions → Variables** and create:

```text
RANKINGS_API_URL = https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

The deploy workflow passes that public endpoint into the frontend as `PUBLIC_ENV__RANKINGS_API_URL`. Push a commit or rerun the deploy workflow afterward.

The endpoint URL is public by design. The Sheet and Apps Script project should remain private.

The frontend submits through a hidden HTML form and reads stats through a JSONP callback. This is intentional: Google Apps Script Content Service responses are redirected and do not behave like a conventional CORS API.

## What the script stores

Each submission is one row containing the display name, song-list version, ordered song IDs, timestamps, and hashes of the edit token and browser ID. The raw edit token is returned only to the submitting browser. The stats endpoint returns aggregates and participant similarity scores, never edit tokens.

The current ranking namespace is `phantom-siita-v1`. A submission may contain any two or more songs. If songs are added, append their IDs to `CONFIG.songIds`; existing rows remain valid because missing songs are ignored in pairwise statistics. Users do not need to redo old rankings. Updating a submission replaces that user’s previous ranking with the newly submitted set of songs.
