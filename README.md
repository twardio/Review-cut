# ReviewCut Lite

One Vimeo video. Timestamped feedback. CSV export.

## Use it

1. Paste a Vimeo video link and select **Load video**.
2. Pause at the moment you want to comment on. Start typing feedback to capture the timestamp automatically, then select **Add feedback**. The timestamp is also editable.
3. Select **Download CSV** in the **Send your feedback** panel beneath the video, then send the downloaded file to the person who shared the video. The CSV contains only **Timestamp** and **Comments**.

Select **Start new video** beside the link field to clear the saved video, comments and unfinished feedback, then refresh the page ready for a different link. This also removes this app's older saved reviews so they cannot return after refreshing. If there is saved or unfinished feedback, a confirmation reminds you to download the CSV first. Cancelling keeps the current draft without refreshing.

Click a saved timestamp to jump back to it. **Edit** and **Remove** change individual notes. There are no projects, dashboards, versions, categories, statuses, replies or accounts.

Your current video, saved notes and unfinished feedback are saved in this browser. A different video replaces that draft after confirmation. This is not a shared workspace: each reviewer sends their CSV separately. Clearing browser data can remove the current draft.

Saving also runs when the tab becomes hidden or the page is left, flushing unfinished text before navigation. It survives closing and reopening a normal browser tab on the same origin, browser profile and device. Private browsing, clearing site data, browser storage eviction or denied/full storage can remove or prevent the draft. If saving fails or another tab changes the draft, the page warns rather than overwriting the other copy.

When there is no new draft, the latest version of the most recently used review from the previous app is carried over automatically. Existing ranges and follow-up text are kept in the carried-over feedback and CSV. **Start new video** clears both the current draft and that older ReviewCut data.

## GitHub Pages

Extract **ReviewCut-Lite-GitHub-Pages.zip** and upload its contents to the root of a GitHub repository. In **Settings → Pages**, choose **Deploy from a branch → main → / (root)**, then save. `index.html` must be at the root alongside `app.js`, `core.js`, `style.css`, `icon.svg` and `.nojekyll`.

For a personal home page, name the repository `YOUR-USERNAME.github.io`. Ordinary project repositories work too. All asset paths are relative. No installation, build, API key or backend is required.

The Sites source repository keeps the deployable files in `dist/`. Copy the contents of `dist/` to the root of a GitHub repository, or into `/docs` and select that publishing folder.

## Vimeo

The video must allow embedding on your hosting domain. Unlisted links are supported, including their privacy hash. Use Vimeo's own player controls for playback, volume, speed and fullscreen. If the Vimeo Player SDK is unavailable, enter timestamps manually. Playback still depends on Vimeo and the video's access settings.

Only Vimeo is contacted for player and SDK requests. There are no application-server requests or analytics. The app uses system fonts. CSV uses UTF-8 with a BOM, quoted fields, escaped quotes and protection against spreadsheet formulas.

## Security and privacy

- Feedback is rendered as escaped text; Vimeo links are restricted to HTTPS Vimeo hosts and recognised video paths. Unlisted hashes are preserved.
- A Content Security Policy restricts scripts, embeds and styles, disables inline handlers and application network connections, and blocks form submission. The Vimeo frame is sandboxed without permission to navigate the containing page.
- CSV escaping covers ASCII and compatibility-normalised formula prefixes, commas, quotes and line breaks. No CSV defence guarantees the behaviour of every spreadsheet application after users save or transform a file; downloaded feedback should be treated as text.
- Local storage is not encrypted by this app and is accessible to scripts running on the same website origin. The Vimeo Player SDK is trusted third-party JavaScript; the cross-origin video frame is separate. Do not use this as a secure store for confidential or patient-identifiable information.
- GitHub Pages project paths under the same account domain share an origin and its local storage. A dedicated hosting domain/origin provides separation from other apps. Moving between the Sites and GitHub Pages domains does not transfer drafts.
- Unlisted video URLs, including their sharing hash, stay in local storage. Video URLs and timestamp links are not added to CSV exports.

## Verification

Run `npm test` with Node. No dependencies are required. Tests cover Vimeo URLs, timestamps, CSV data and the one-draft migration.
