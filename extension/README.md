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

## Creating & editing templates (no code)

Click the extension icon, then **✎ Edit** (top-right of the popup) — or right-click
the toolbar icon → **Options**. That opens the built-in editor:

- **+ New template** — start a fresh one (comes pre-wired with `{{client}}` and `{{signoff}}`).
- **Template name / Subject / Email body** — type your email. Put a `{{field}}` wherever
  a bit should be fill-in or a dropdown, e.g. `Hi {{client}},`.
- **Make selected text a field** — highlight a word/phrase in the body and click this to
  turn it into a `{{field}}` (the highlighted text becomes its default value).
- **Fields** — each `{{field}}` gets a card. Pick its type:
  - **Text field** / **Paragraph field** → a fill-in box (with optional placeholder + default).
  - **Dropdown** → add options (a short *menu label* + the *text inserted*), and a default choice.
- Changes **auto-save** to your browser as you type.
- **Export** downloads a JSON backup; **Import** restores it (or moves templates to another PC).
- **Reset to samples** restores the original examples.

> Templates are stored per browser profile. To back them up to GitHub, **Export** the
> JSON and commit it (or paste it into `templates.js`), then `/backup`.

### Advanced: edit the file directly
The starter templates live in [`templates.js`](templates.js) (same shape). Editing the
file is optional now that the editor exists; if you do, click the **reload** (↻) icon on
the extension at `chrome://extensions`.

## How it works / privacy

- A toolbar **popup** (this UI) builds the email text locally in your browser.
- On **Insert**, it runs a small script in the active tab (via `activeTab` +
  `scripting`) that drops the HTML at your cursor in the compose box. It only acts
  on the tab you're looking at, only when you click the button, and sends nothing
  anywhere — all processing is local.
- Templates are saved locally in your browser (`chrome.storage`); nothing is uploaded.
