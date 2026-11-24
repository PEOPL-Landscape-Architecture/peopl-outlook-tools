# Diagnostic: starts a throwaway headless Edge (temp profile) with the unpacked extension and
# pings the com.peopl.files helper from the extension's own page. Needs: pip websockets.
#   python -I native-host\test-in-edge.py <repo>\extension
# Prints 'native: REPLY {...ok...}' when Edge can reach the helper.
# CAUTION: an Edge started from a terminal inside the Claude desktop app shares that app's
# private registry view, so this can pass while the user's own Edge still can't see the host.
# Check the real view with an outside process: WMI Win32_Process.Create + reg query.
import asyncio, json, subprocess, sys, time, urllib.request, os, tempfile, shutil
import websockets

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
EXT = sys.argv[1]
EXT_ID = "ejljeppjlklbgklmfbcgnjnojdefmbci"
PORT = 9339
udd = tempfile.mkdtemp(prefix="edge-probe-")
proc = subprocess.Popen([EDGE, f"--user-data-dir={udd}", f"--remote-debugging-port={PORT}", "--headless=new",
                         "--no-first-run", "--no-default-browser-check", f"--load-extension={EXT}",
                         f"--disable-extensions-except={EXT}", "about:blank"])

JS = r"""
new Promise(res => {
  try {
    const port = chrome.runtime.connectNative('com.peopl.files');
    port.onMessage.addListener(m => res('REPLY ' + JSON.stringify(m)));
    port.onDisconnect.addListener(() => res('DISCONNECT ' + (chrome.runtime.lastError && chrome.runtime.lastError.message)));
    port.postMessage({cmd: 'ping', id: 1});
    setTimeout(() => res('TIMEOUT'), 15000);
  } catch (e) { res('THROW ' + e.message); }
})
"""

async def main():
    for _ in range(40):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=1); break
        except Exception: time.sleep(0.5)
    targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list"))
    print("targets:", [(t["type"], t["url"][:70]) for t in targets])
    page = [t for t in targets if t["type"] == "page"][0]
    async with websockets.connect(page["webSocketDebuggerUrl"], max_size=None) as ws:
        n = 0
        async def call(method, params=None):
            nonlocal n; n += 1; mid = n
            await ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
            while True:
                m = json.loads(await ws.recv())
                if m.get("id") == mid: return m
        await call("Page.navigate", {"url": f"chrome-extension://{EXT_ID}/popup.html"})
        await asyncio.sleep(3)
        r = await call("Runtime.evaluate", {"expression": "location.href + ' | connectNative: ' + typeof (chrome.runtime && chrome.runtime.connectNative)", "returnByValue": True})
        print("page:", r.get("result", {}).get("result", {}).get("value"), r.get("result", {}).get("exceptionDetails"))
        r = await call("Runtime.evaluate", {"expression": JS, "awaitPromise": True, "returnByValue": True})
        print("native:", r.get("result", {}).get("result", {}).get("value"), r.get("result", {}).get("exceptionDetails"))

try:
    asyncio.run(main())
finally:
    proc.terminate()
    try: proc.wait(timeout=10)
    except Exception: proc.kill()
    shutil.rmtree(udd, ignore_errors=True)


