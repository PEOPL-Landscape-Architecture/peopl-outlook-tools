/* Twenty CRM lookup (shared by popup + editor).
 *
 * Fills template fields from a person or firm in the self-hosted Twenty CRM
 * (default http://localhost:3000). Read-only: one GraphQL query lists people
 * and firms; nothing is ever written to Twenty.
 *
 * Settings (Twenty address + API key) live in chrome.storage.local under
 * 'peoplTwenty' — never in this file, never in Export, never in the repo.
 *
 * A field is linked to Twenty by its slot's "crm" role (set in the editor:
 * "Fill from Twenty"). Fields without one use DEFAULT_ROLES by field name;
 * crm: "" switches a default off. */
(function () {
  "use strict";

  var KEY = "peoplTwenty";
  var DEFAULT_URL = "http://localhost:3000";

  var ROLES = [
    { v: "",                 label: "— not linked —" },
    { v: "person.email",     label: "Person's email (firm's email if the person has none)" },
    { v: "firm.email",       label: "Firm's email (blank if it is already the To address)" },
    { v: "person.firstName", label: "Person's first name" },
    { v: "person.fullName",  label: "Person's full name" },
    { v: "person.jobTitle",  label: "Person's job title" },
    { v: "firm.name",        label: "Firm name" }
  ];
  var DEFAULT_ROLES = {
    "primary-email": "person.email",
    "secondary-email": "firm.email",
    "attention": "person.firstName"
  };

  function roleFor(id, slot) {
    if (slot && typeof slot.crm === "string") return slot.crm;
    return DEFAULT_ROLES[id] || "";
  }

  function loadSettings(cb) {
    if (typeof chrome === "undefined" || !chrome.storage) { cb({ url: DEFAULT_URL, key: "" }); return; }
    chrome.storage.local.get(KEY, function (res) {
      var s = (res && res[KEY]) || {};
      cb({ url: (s.url || DEFAULT_URL).replace(/\/+$/, ""), key: s.key || "" });
    });
  }
  function saveSettings(s, cb) {
    var o = {}; o[KEY] = { url: (s.url || DEFAULT_URL).trim().replace(/\/+$/, ""), key: (s.key || "").trim() };
    chrome.storage.local.set(o, cb || function () {});
  }

  var QUERY =
    "query PeoplTemplatesContacts {" +
    " people(first: 500) { edges { node { id name { firstName lastName } jobTitle" +
    "  emails { primaryEmail additionalEmails } company { id name publicEmail { primaryEmail additionalEmails } } } } }" +
    " companies(first: 500) { edges { node { id name publicEmail { primaryEmail additionalEmails } } } } }";

  // cb(err, entries). err is a plain-language message.
  function fetchContacts(settings, cb) {
    if (!settings.key) { cb("Add your Twenty API key first (⚙ Twenty)."); return; }
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; cb(unreachable(settings.url)); } }, 8000);
    fetch(settings.url + "/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + settings.key },
      body: JSON.stringify({ query: QUERY })
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) throw new Error("auth");
      return r.json();
    }).then(function (j) {
      if (done) return; done = true; clearTimeout(timer);
      if (j.errors && j.errors.length) {
        var msg = String(j.errors[0].message || "");
        cb(/auth|token|unauthor|forbidden/i.test(msg) ? "Twenty refused the API key — check it in ⚙ Twenty." : "Twenty error: " + msg);
        return;
      }
      cb(null, toEntries(j.data || {}));
    }).catch(function (e) {
      if (done) return; done = true; clearTimeout(timer);
      cb(e && e.message === "auth" ? "Twenty refused the API key — check it in ⚙ Twenty." : unreachable(settings.url));
    });
  }
  function unreachable(url) {
    return "Twenty isn't reachable at " + url + " — start it with the Twenty CRM shortcut, then try again.";
  }

  function emailsOf(e) {
    e = e || {};
    var list = [e.primaryEmail].concat(e.additionalEmails || []);
    return list.map(function (x) { return String(x || "").trim(); }).filter(Boolean);
  }

  function toEntries(data) {
    var out = [];
    var firmsWithPeople = {};
    ((data.people && data.people.edges) || []).forEach(function (ed) {
      var p = ed.node || {};
      var n = p.name || {};
      var full = [n.firstName, n.lastName].filter(Boolean).join(" ").trim();
      if (!full) return;
      var c = p.company || null;
      if (c) firmsWithPeople[c.id] = true;
      out.push({
        kind: "person",
        label: full + (c && c.name ? " — " + c.name : ""),
        person: { firstName: n.firstName || "", lastName: n.lastName || "", fullName: full,
                  jobTitle: p.jobTitle || "", emails: emailsOf(p.emails) },
        firm: { name: (c && c.name) || "", emails: emailsOf(c && c.publicEmail) }
      });
    });
    ((data.companies && data.companies.edges) || []).forEach(function (ed) {
      var c = ed.node || {};
      if (!c.name) return;
      out.push({
        kind: "firm",
        label: c.name + " (firm, no person)",
        person: { firstName: "", lastName: "", fullName: "", jobTitle: "", emails: [] },
        firm: { name: c.name, emails: emailsOf(c.publicEmail) }
      });
    });
    out.sort(function (a, b) { return a.label.localeCompare(b.label); });
    return out;
  }

  // The value a role takes for a picked entry.
  function valueFor(role, entry) {
    var p = entry.person, f = entry.firm;
    var to = p.emails[0] || f.emails[0] || "";
    switch (role) {
      case "person.email": return to;
      case "firm.email":
        // the firm's first address that isn't already the To address
        for (var i = 0; i < f.emails.length; i++) if (f.emails[i].toLowerCase() !== to.toLowerCase()) return f.emails[i];
        return "";
      case "person.firstName": return p.firstName;
      case "person.fullName": return p.fullName;
      case "person.jobTitle": return p.jobTitle;
      case "firm.name": return f.name;
      default: return null;
    }
  }

  window.PEOPL_TWENTY = {
    KEY: KEY, DEFAULT_URL: DEFAULT_URL, ROLES: ROLES, DEFAULT_ROLES: DEFAULT_ROLES,
    roleFor: roleFor, loadSettings: loadSettings, saveSettings: saveSettings,
    fetchContacts: fetchContacts, valueFor: valueFor, _toEntries: toEntries
  };
})();
