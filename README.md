# PEOPL Email Templates — Outlook add-in

Pick an email template, swap words / phrases / paragraphs with dropdowns, fill in
the blanks, and drop it into your email. Works in **new Outlook for Windows,
Outlook on the web, and classic Outlook desktop** from one codebase.

- **Live add-in:** https://peopl-landscape-architecture.github.io/peopl-outlook-tools/
- **Manifest (the thing you install):**
  `https://peopl-landscape-architecture.github.io/peopl-outlook-tools/manifest.xml`

---

## Install (one time)

The same route works for new Outlook, Outlook on the web, and classic desktop —
they all share the same web add-in system.

1. Go to **outlook.office.com** (or use new Outlook for Windows). Start a **new email**.
2. On the message ribbon open **Apps** (or **… More options → Apps**).
3. Choose **Get Add-ins → My add-ins**, scroll to **Custom add-ins**, then
   **Add a custom add-in → Add from URL…**
4. Paste the manifest URL above and confirm:
   `https://peopl-landscape-architecture.github.io/peopl-outlook-tools/manifest.xml`
5. In **classic desktop**, the same dialog is at **File → Manage Add-ins / Get Add-ins**.
   Restart Outlook afterwards.

You'll now see a **PEOPL ▸ Templates** button when composing an email (look under
**Apps** / **…** if your ribbon is compact).

> If "Add a custom add-in" is greyed out, your mailbox is managed by an admin who
> has blocked sideloading — it would then need to be pushed from the Microsoft 365
> admin center instead.

## Daily use

1. Start a new email (or reply).
2. Click **PEOPL ▸ Templates**.
3. Pick a template, set the dropdowns, type into any free-text fields. The preview
   updates live.
4. **Insert into email**. Options:
   - **Set subject** (on by default) — also fills the subject line.
   - **Replace whole body** — wipes the body first (off by default, so it inserts
     at your cursor — handy for replies).
   - **Copy** — copies the text to the clipboard instead.

---

## Editing the templates  ← this is the part you'll use

Everything lives in **[`src/templates.js`](src/templates.js)** — one well-commented
file. You don't touch anything else.

Each template has a `subject` and a `body`. Anywhere you write a token like
`{{client}}` or `{{scope}}`, the add-in shows a control so you can fill it in or
pick from a dropdown.

```js
{
  id: "my-template",
  name: "My template",                       // shown in the dropdown
  subject: "Re: {{project}}",
  body:
`Hi {{client}},

{{opening}}

Kind regards,
{{signoff}}`,
  slots: {
    client:  { label: "Client name", type: "text", placeholder: "e.g. Jane" },
    project: { label: "Project", type: "text" },
    opening: {                               // a dropdown of paragraphs
      label: "Opening paragraph",
      default: "Thanks",
      options: [
        "Thanks for your email.",
        { label: "Following up", text: "Just following up on my last note." }
      ]
    },
    signoff: { label: "Sign-off", type: "textarea",
               default: "Aaron Troy\nPEOPL Landscape Architecture" }
  }
}
```

- **Dropdown of phrases/paragraphs** → give the slot `options` (a list of strings,
  or `{ label, text }` for a short menu label with longer inserted text).
- **Single-line fill-in** → `type: "text"`.
- **Paragraph fill-in** → `type: "textarea"`.
- Any `{{token}}` you *don't* define under `slots` becomes a text box automatically.
- `default` preselects a dropdown option or pre-fills a text field.

After editing, save and **push** (see below). The add-in updates next time you open it.

## Saving changes

This repo is wired into the PEOPL backup system:

```powershell
# from this folder, in any Claude Code session:
/backup
# or manually:
git add -A; git commit -m "Update templates"; git push
```

It's also opted into the nightly auto-backup (the `.peopl-autobackup` marker).

## Preview locally (optional)

No Outlook needed to check layout / try edits — it runs in a browser in
"preview mode" (the Insert button only works inside real Outlook):

```powershell
python -m http.server 5500 --directory "G:\GRAPHICS\Plugins\OUTLOOK PWA\peopl-outlook-tools"
# then open http://localhost:5500/src/taskpane.html
```

---

## How it's hosted

The add-in's files are served by **GitHub Pages** straight from this repo's `main`
branch. This repo is **public** on purpose — GitHub Pages on a *private* repo needs
a paid GitHub plan, and there are no secrets in here (names, amounts, etc. are
fill-in fields, not stored). The published site is reachable by URL regardless of
repo visibility, so making the repo public changes nothing about exposure.

## Files

| Path | What it is |
|---|---|
| `manifest.xml` | Add-in definition you install into Outlook. |
| `src/templates.js` | **The templates — edit this.** |
| `src/taskpane.html/.css/.js` | The task-pane UI and engine. |
| `commands.html` | Required stub for the ribbon button. |
| `index.html` | Landing page for the Pages site. |
| `assets/icon-*.png` | Ribbon / store icons. |

## Troubleshooting

- **Button missing:** make sure you're *composing* (not reading) an email; check
  under **Apps** / **…** on the ribbon. Restart Outlook after installing.
- **Changes not showing:** Outlook caches add-in files. Close and reopen the task
  pane, or restart Outlook; the Pages CDN can take a minute to update after a push.
- **Can't insert:** you must be in a compose window. In "preview mode" (a plain
  browser) Insert is disabled by design.
