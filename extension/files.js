/* Attachments: talks to the local native helper "com.peopl.files"
 * (native-host/ in the repo, registered by native-host/install.ps1). The
 * helper shows the real Windows Open dialog, checks paths and reads files;
 * a browser page cannot do either by itself. Shared by popup + editor. */
(function () {
  "use strict";
  var HOST = "com.peopl.files";

  // Attachment text -> list of paths (one per line, or separated by ;).
  function parse(text) {
    return String(text || "").split(/\r\n|\r|\n|;/)
      .map(function (s) { return s.trim().replace(/^"(.*)"$/, "$1"); })
      .filter(Boolean);
  }
  function baseName(p) { return String(p).split(/[\\/]/).pop(); }

  function available() { return typeof chrome !== "undefined" && chrome.runtime && !!chrome.runtime.connectNative; }

  // One port per operation; calls cb(err, reply) for each request in turn.
  function session() {
    var port = chrome.runtime.connectNative(HOST);
    var waiting = [], dead = null;
    port.onMessage.addListener(function (msg) { var w = waiting.shift(); if (w) w(null, msg); });
    port.onDisconnect.addListener(function () {
      var e = chrome.runtime.lastError;
      dead = helperError(e && e.message);
      while (waiting.length) waiting.shift()(dead);
    });
    return {
      ask: function (msg, cb) { if (dead) { cb(dead); return; } waiting.push(cb); port.postMessage(msg); },
      close: function () { try { port.disconnect(); } catch (e) {} }
    };
  }
  function helperError(raw) {
    if (/not found|not registered|forbidden/i.test(raw || ""))
      return "Edge can't reach the attachment helper (" + raw + "). Fully restart Edge (edge://restart); " +
             "if it persists, re-run native-host\\install.ps1 (see README).";
    return "Attachment helper stopped" + (raw ? ": " + raw : "") + ".";
  }

  // Opens the Windows dialog. cb(err, [paths])
  function pick(initialDir, cb) {
    if (!available()) { cb("Attachments need the browser extension."); return; }
    var s = session();
    s.ask({ cmd: "pick", initialDir: initialDir || "" }, function (err, r) {
      s.close();
      if (err) return cb(err);
      if (!r.ok) return cb(r.error || "Couldn't open the file dialog.");
      cb(null, r.paths || []);
    });
  }

  // cb(err, [{path, exists, name, size}])
  function stat(paths, cb) {
    if (!paths.length) { cb(null, []); return; }
    if (!available()) { cb("Attachments need the browser extension."); return; }
    var s = session();
    s.ask({ cmd: "stat", paths: paths }, function (err, r) {
      s.close();
      if (err) return cb(err);
      if (!r.ok) return cb(r.error || "Couldn't check the files.");
      cb(null, r.files || []);
    });
  }

  // Reads every path in full. cb(err, [{name, type, b64, size}])
  function readAll(paths, cb) {
    if (!paths.length) { cb(null, []); return; }
    if (!available()) { cb("Attachments need the browser extension."); return; }
    var s = session(), out = [], i = 0;
    function nextFile() {
      if (i >= paths.length) { s.close(); cb(null, out); return; }
      var path = paths[i++], parts = [], name = baseName(path), size = 0;
      (function chunk(offset) {
        s.ask({ cmd: "read", path: path, offset: offset }, function (err, r) {
          if (err) { s.close(); return cb(err); }
          if (!r.ok) { s.close(); return cb(r.error || ("Couldn't read " + path)); }
          parts.push(r.data); name = r.name || name; size = r.size;
          var got = r.count || 0;
          if (r.done || !got) { out.push({ name: name, type: mimeOf(name), b64: parts.join(""), size: size }); nextFile(); }
          else chunk(offset + got);
        });
      })(0);
    }
    nextFile();
  }
  // Chunks are base64 of whole 600 KB slices (a multiple of 3 bytes), so they
  // join into one valid base64 string without re-encoding.

  var MIME = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip", txt: "text/plain", csv: "text/csv", dwg: "application/acad", msg: "application/vnd.ms-outlook" };
  function mimeOf(name) { var m = /\.([^.]+)$/.exec(name || ""); return (m && MIME[m[1].toLowerCase()]) || "application/octet-stream"; }

  window.PEOPL_FILES = { parse: parse, baseName: baseName, pick: pick, stat: stat, readAll: readAll };
})();
