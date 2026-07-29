const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { createServer } = require("net");
const { pathToFileURL } = require("url");

const [relativeTestPath, statusName, budgetArg = "30000"] = process.argv.slice(2);
if (!relativeTestPath || !statusName) {
  console.error("Usage: node scripts/run-browser-test.cjs <html-path> <status-name> [test-budget-ms]");
  process.exit(2);
}

const projectRoot = path.resolve(__dirname, "..");
const testPath = path.resolve(projectRoot, relativeTestPath);
const testBudgetMs = Number(budgetArg);
if (!fs.existsSync(testPath)) {
  console.error(`[fail] Browser test file is missing: ${relativeTestPath}`);
  process.exit(1);
}
if (!Number.isFinite(testBudgetMs) || testBudgetMs <= 0) {
  console.error(`[fail] Invalid test budget: ${budgetArg}`);
  process.exit(1);
}
if (typeof WebSocket !== "function") {
  console.error("[fail] This browser test runner requires Node.js 22 or newer.");
  process.exit(1);
}

const browserCandidates = [
  process.env.BROWSER_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
  process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe")
].filter(Boolean);
const browserPath = browserCandidates.find((candidate) => fs.existsSync(candidate));
if (!browserPath) {
  console.error("[fail] Chrome, Chromium, or Edge was not found. Set BROWSER_PATH explicitly.");
  process.exit(1);
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `narrative-canvas-${statusName}-`));
const profileDir = path.join(workDir, "profile");
const stdoutPath = path.join(workDir, "browser.out");
const stderrPath = path.join(workDir, "browser.log");
const testUrl = pathToFileURL(testPath).href;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function readTail(filePath, maxLength = 6000) {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8").trim().slice(-maxLength);
}

function signalProcessTree(child, signal = "SIGTERM") {
  if (!child || child.exitCode != null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Process already exited.
    }
  }
}

async function stopProcessTree(child) {
  if (!child || child.exitCode != null) return;
  signalProcessTree(child, "SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    delay(2000).then(() => false)
  ]);
  if (!exited) signalProcessTree(child, "SIGKILL");
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.addListener("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else if (!port) reject(new Error("Could not allocate a browser debugging port."));
        else resolve(port);
      });
    });
  });
}

async function waitForPageTarget(port, child, deadline) {
  const endpoint = `http://127.0.0.1:${port}/json/list`;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`Browser exited before the test page opened with code ${child.exitCode}.`);
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page" && target.url === testUrl)
          || targets.find((target) => target.type === "page" && target.url?.startsWith(testUrl));
        if (page?.webSocketDebuggerUrl) return page;
      }
    } catch {
      // Chrome may publish the port before the HTTP endpoint accepts requests.
    }
    await delay(100);
  }
  throw new Error("Browser test page did not expose a debugging target before the deadline.");
}

function connectCdp(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    const diagnostics = [];
    let nextId = 0;
    let settled = false;

    const rejectPending = (error) => {
      pending.forEach(({ reject: rejectCall, timer }) => {
        clearTimeout(timer);
        rejectCall(error);
      });
      pending.clear();
    };

    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (message.id && pending.has(message.id)) {
        const request = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) request.reject(new Error(message.error.message || "Chrome debugging request failed."));
        else request.resolve(message.result);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        const detail = message.params?.exceptionDetails;
        diagnostics.push(detail?.exception?.description || detail?.text || "Uncaught browser exception");
      }
      if (message.method === "Log.entryAdded") {
        const entry = message.params?.entry;
        if (entry?.level === "error") diagnostics.push(entry.text || "Browser log error");
      }
    });

    socket.addEventListener("open", () => {
      settled = true;
      resolve({
        diagnostics,
        call(method, params = {}, timeoutMs = 5000) {
          return new Promise((resolveCall, rejectCall) => {
            const id = ++nextId;
            const timer = setTimeout(() => {
              pending.delete(id);
              rejectCall(new Error(`Chrome debugging request timed out: ${method}`));
            }, timeoutMs);
            pending.set(id, { resolve: resolveCall, reject: rejectCall, timer });
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
        }
      });
    }, { once: true });

    socket.addEventListener("error", () => {
      const error = new Error("Could not connect to the browser test page.");
      rejectPending(error);
      if (!settled) reject(error);
    });
    socket.addEventListener("close", () => {
      const error = new Error("Browser test page debugging connection closed.");
      rejectPending(error);
      if (!settled) reject(error);
    });
  });
}

async function readTestState(cdp) {
  const attributeName = `data-${statusName}-status`;
  const progressName = `data-${statusName}-progress`;
  const lastTestName = `data-${statusName}-last-test`;
  const reportId = `${statusName}-report`;
  const expression = `(() => {
    const body = document.body;
    return {
      readyState: document.readyState,
      status: body?.getAttribute(${JSON.stringify(attributeName)}) || "",
      progress: body?.getAttribute(${JSON.stringify(progressName)}) || "",
      lastTest: body?.getAttribute(${JSON.stringify(lastTestName)}) || "",
      report: document.getElementById(${JSON.stringify(reportId)})?.textContent || ""
    };
  })()`;
  const evaluated = await cdp.call("Runtime.evaluate", {
    expression,
    returnByValue: true
  });
  if (evaluated?.exceptionDetails) {
    throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text || "Could not read browser test state.");
  }
  return evaluated?.result?.value || {};
}

function printFailureContext(state, diagnostics) {
  if (state?.report && state.report !== "running") {
    try {
      const report = JSON.parse(state.report);
      console.error(JSON.stringify({
        status: report.status || state.status || "unknown",
        checks: Array.isArray(report.tests) ? report.tests.length : Number(state.progress) || 0,
        failures: Array.isArray(report.failures) ? report.failures : []
      }, null, 2));
    } catch {
      console.error(state.report.trim().slice(-8000));
    }
  }
  if (state?.progress || state?.lastTest) {
    console.error(`[progress] checks=${state.progress || "unknown"} last=${JSON.stringify(state.lastTest || "unknown")}`);
  }
  if (diagnostics.length) {
    console.error(`[browser errors]\n${diagnostics.slice(-20).join("\n")}`);
  }
  if (!state?.report || state.report === "running") {
    const stderr = readTail(stderrPath);
    if (stderr) console.error(stderr);
  }
}

async function main() {
  let child = null;
  let stdoutFd = null;
  let stderrFd = null;
  let cdp = null;
  const startedAt = Date.now();
  const deadline = startedAt + testBudgetMs;
  let state = {};
  try {
    const port = await getAvailablePort();
    stdoutFd = fs.openSync(stdoutPath, "w");
    stderrFd = fs.openSync(stderrPath, "w");
    child = spawn(browserPath, [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-component-update",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--no-sandbox",
      "--allow-file-access-from-files",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      testUrl
    ], {
      cwd: projectRoot,
      detached: process.platform !== "win32",
      stdio: ["ignore", stdoutFd, stderrFd]
    });

    const page = await waitForPageTarget(port, child, deadline);
    cdp = await connectCdp(page.webSocketDebuggerUrl);
    await Promise.all([
      cdp.call("Runtime.enable"),
      cdp.call("Log.enable")
    ]);

    while (Date.now() < deadline) {
      if (child.exitCode != null) break;
      state = await readTestState(cdp);
      if (state.status === "pass" || state.status === "fail") break;
      await delay(200);
    }

    const elapsedMs = Date.now() - startedAt;
    if (state.status === "pass") {
      const detail = state.progress ? `, ${state.progress} checks` : "";
      console.log(`[ok] ${relativeTestPath} passed (${elapsedMs} ms${detail})`);
      return;
    }

    printFailureContext(state, cdp.diagnostics);
    if (state.status === "fail") {
      console.error(`[fail] ${relativeTestPath} reported test failures after ${elapsedMs} ms`);
    } else if (child.exitCode != null) {
      console.error(`[fail] ${relativeTestPath} browser exited with code ${child.exitCode}`);
    } else {
      console.error(`[fail] ${relativeTestPath} timed out after ${testBudgetMs} ms`);
    }
    process.exitCode = 1;
  } finally {
    cdp?.close();
    await stopProcessTree(child);
    if (stdoutFd != null) fs.closeSync(stdoutFd);
    if (stderrFd != null) fs.closeSync(stderrFd);
  }
}

main().catch((error) => {
  console.error(`[fail] ${error.stack || error.message || error}`);
  const stderr = readTail(stderrPath);
  if (stderr) console.error(stderr);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});
