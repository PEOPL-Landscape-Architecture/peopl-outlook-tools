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

Clicking the toolbar icon opens a **docked side panel** beside Outlook that **stays open**
while you work (no more popup closing when you click into the email). **Drag its inner edge**
to make it wider/taller — the browser remembers the size.

## Use it

1. Open **Outlook on the web** and start a **new email / reply**.
2. **Click into the message body** (so the cursor is there).
3. Click the **PEOPL Email Templates** toolbar icon to open the docked **side panel** (it stays open).
4. Pick a template, set the dropdowns, fill in the fields — preview updates live.
5. **Insert into email** fills the **body** at your cursor, plus the **Subject** and any
   **To / Cc / Bcc** the template carries. The status line reports what landed.

> Subject is reliable; recipient boxes are **best-effort** on Outlook web (it's a fussy
> custom control). Glance at them after inserting — if one didn't fill, set it manually,
> or use **Copy** for the body. Everything is shown in the preview so it's easy to check.

## Creating & editing templates (no code)

Click the extension icon, then **✎ Edit** (top-right of the panel) — or right-click
the toolbar icon → **Options**. That opens the built-in editor in a full tab:

- **+ New template** — start a fresh one (comes pre-wired with `{{client}}` and `{{signoff}}`).
- **Template name / Subject / Email body** — type your email. Put a `{{field}}` wherever
  a bit should be fill-in or a dropdown, e.g. `Hi {{client}},`.
- **Recipients (To / Cc / Bcc)** — optional. Type **fixed addresses** (e.g.
  `studio@lynxlandscaping.com`), or use a `{{field}}` to be prompted each time
  (e.g. `{{clientEmail}}`). Separate several with `;`.
- **Make selected text a field** — highlight a word/phrase in the body and click this to
  turn it into a `{{field}}` (the highlighted text becomes its default value).
- **Fields** — each `{{field}}` gets a card. Pick its type:
  - **Text field** / **Paragraph field** → a fill-in box (with optional placeholder + default).
  - **Dropdown** → add options (a short *menu label* + the *text inserted*), and a default choice.
  - **Optional** → tick this to give the field an **include / skip checkbox** in the popup — ideal
    for paragraphs you sometimes leave out. Skipping one also tidies up the leftover blank line.
    Use *"Leave it OFF by default"* for paragraphs you only add occasionally.
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
