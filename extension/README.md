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

Clicking the toolbar icon — or pressing **Alt+Shift+E** — opens the tool in its own
**resizable window** that floats beside Outlook and **stays open** while you work. This works
whether Outlook is a normal browser tab **or installed as an app / PWA** (app windows don't
show the toolbar popup or side panel, so a separate window is used). Snap it next to Outlook
with **Win + ←/→**; resize it to whatever's comfortable.

> Inside an Outlook **app window** there's no toolbar icon — use **Alt+Shift+E**, or the app
> window's **"…" → Extensions → PEOPL Email Templates**, to open the tool.

## Use it

1. Open **Outlook on the web** and start a **new email / reply**.
2. **Click into the message body** (so the cursor is there).
3. Open the tool with **Alt+Shift+E** (works inside the Outlook app window) or the toolbar icon.
4. Pick a template, set the dropdowns, fill in the fields — preview updates live.
5. **Insert into email** fills the **body** at your cursor, plus the **Subject** and any
   **To / Cc / Bcc** the template carries. The status line reports what landed.

> Subject is reliable; recipient boxes are **best-effort** on Outlook web (it's a fussy
> custom control). Glance at them after inserting — if one didn't fill, set it manually,
> or use **Copy** for the body. Everything is shown in the preview so it's easy to check.

### Saved forms & remembered entries
- The form **remembers what you've typed** — switching templates, or editing one, keeps your
  entries (matched by field name). **Reset** clears them back to the template defaults.
- **Saved forms** (top of the window) save a template *with your filled-in values* under a name:
  fill it in → **Save as…** → name it (e.g. "Smith – fee proposal"). Pick it from the **Saved forms**
  list anytime to reload, then Insert. **Save** overwrites the loaded form in place (no rename);
  **🗑** deletes the selected one. Templates stay the blank masters.

## Creating & editing templates (no code)

In the tool window, click **✎ Edit templates** (top-right). The editor **slides out in the
same window**; click **‹ Done** to slide back to your form. Changes sync live — your compose
form updates as you edit. (Right-click the toolbar icon → **Options** still opens it in a full
tab too.) The editor:

- **+ New template** — start a fresh one (comes pre-wired with `{{client}}` and `{{signoff}}`).
- **Template name / Subject / Email body** — type your email. Put a `{{field}}` wherever
  a bit should be fill-in or a dropdown, e.g. `Hi {{client}},`.
- **Recipients (To / Cc / Bcc)** — optional. Type **fixed addresses** (e.g.
  `studio@lynxlandscaping.com`), or use a `{{field}}` to be prompted each time
  (e.g. `{{clientEmail}}`). Separate several with `;`.
- **Make selected text a field** — highlight a word/phrase in the body and click this to
  turn it into a `{{field}}` (the highlighted text becomes its default value).
- **Formatting** — every text area (the **body**, each **dropdown option**, and **paragraph
  field defaults**) has its own little **B / i / • / 1. / ↗** toolbar. Select text and click,
  or type the marks directly: `**bold**`, `*italic*`, `- bullets`, `1. numbered`,
  `[text](https://…)`. The preview shows it rendered, and it inserts into Outlook as real
  bold / italics / lists / links — so a dropdown option can be a bold sentence or a numbered block.
  Pressing **Enter** in a numbered/bulleted list **auto-continues** it (Enter on an empty item ends
  the list). The main compose window's paragraph fields have the same toolbar. The **colour swatch**
  (defaults to black) colours the selected text. Inserted email text is black with proper paragraph
  spacing.
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
