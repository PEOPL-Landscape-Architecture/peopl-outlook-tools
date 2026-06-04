# PEOPL Email Templates — Chrome / Edge extension

A browser-extension version of the template tool that works **without any Outlook
or IT permissions** — it isn't an Office add-in, so tenant add-in blocks don't
apply. It inserts straight into the **Outlook on the web** compose box (with Copy
as a fallback that works anywhere).

## Install (developer mode — one time)

1. Open **`chrome://extensions`** (Chrome) or **`edge://extensions`** (Edge).
2. Turn on **Developer mode** (toggle, top-right in Chrome / left sidebar in Edge).
3. Click **Load unpacked**.
4. Select this folder:
   `G:\GRAPHICS\Plugins\OUTLOOK PWA\peopl-outlook-tools\extension`
5. Pin it: click the puzzle-piece icon in the toolbar and pin **PEOPL Email Templates**.

It stays installed across restarts. (Developer-mode extensions show a "Disable
developer mode extensions" nudge on browser start — just dismiss it.)

## Use it

1. Open **Outlook on the web** and start a **new email / reply**.
2. **Click into the message body** (so the cursor is there).
3. Click the **PEOPL Email Templates** toolbar icon.
4. Pick a template, set the dropdowns, fill in the fields — preview updates live.
5. **Insert into email** drops it at your cursor. (If it can't find the box, use
   **Copy** and paste — Ctrl+V.)

> The subject is shown in the preview for reference; the extension inserts the
> **body** at your cursor. Type/paste the subject yourself.

## Editing templates

Edit **[`templates.js`](templates.js)** in this folder — same format as documented
at the top of that file (dropdowns via `options`, fill-ins via `type: "text"` /
`"textarea"`, any `{{token}}` becomes a field). After saving, go to
`chrome://extensions` and click the **reload** (↻) icon on the extension.

> Note: this is a separate copy from `../src/templates.js` (used by the hosted web
> page). Edit whichever you actually use, or ask me to keep them in sync.

## How it works / privacy

- A toolbar **popup** (this UI) builds the email text locally in your browser.
- On **Insert**, it runs a small script in the active tab (via `activeTab` +
  `scripting`) that drops the HTML at your cursor in the compose box. It only acts
  on the tab you're looking at, only when you click the button, and sends nothing
  anywhere — all processing is local.
