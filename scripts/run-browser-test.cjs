const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const [relativeTestPath, statusName, budgetArg = "30000"] = process.argv.slice(2);
if (!relativeTestPath || !statusName) {
  console.error("Usage: node scripts/run-browser-test.cjs <html-path> <status-name> [virtual-time-budget-ms]");
  process.exit(2);
}

const projectRoot = path.resolve(__dirname, "..");
const testPath = path.resolve(projectRoot, relativeTestPath);
const virtualTimeBudget = Number(budgetArg);
const timeoutMs = Math.max(90000, virtualTimeBudget + 60000);
const retryEnvironmentKey = "NARRATIVE_CANVAS_BROWSER_TEST_RETRY";
if (!fs.existsSync(testPath)) {
  console.error(`[fail] Browser test file is missing: ${relativeTestPath}`);
  process.exit(1);
}
if (!Number.isFinite(virtualTimeBudget) || virtualTimeBudget <= 0) {
  console.error(`[fail] Invalid virtual time budget: ${budgetArg}`);
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
const stdoutPath = path.join(workDir, "output.html");
const stderrPath = path.join(workDir, "browser.log");

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function stopProcessTree(child) {
  if (!child || child.exitCode != null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function main() {
  let child = null;
  let stdoutFd = null;
  let stderrFd = null;
  try {
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
      `--user-data-dir=${profileDir}`,
      `--virtual-time-budget=${virtualTimeBudget}`,
      "--dump-dom",
      pathToFileURL(testPath).href
    ], {
      cwd: projectRoot,
      detached: process.platform !== "win32",
      stdio: ["ignore", stdoutFd, stderrFd]
    });
    const passStatus = `data-${statusName}-status="pass"`;
    const failStatus = `data-${statusName}-status="fail"`;
    const deadline = Date.now() + timeoutMs;
    let html = "";
    while (Date.now() < deadline) {
      await delay(250);
      html = fs.existsSync(stdoutPath) ? fs.readFileSync(stdoutPath, "utf8") : "";
      if (html.includes(passStatus) || html.includes(failStatus) || child.exitCode != null) break;
    }
    stopProcessTree(child);
    html = fs.existsSync(stdoutPath) ? fs.readFileSync(stdoutPath, "utf8") : html;
    if (!html.includes(passStatus)) {
      const incomplete = !html.includes(failStatus);
      if (incomplete && process.env[retryEnvironmentKey] !== "1") {
        const retryBudget = Math.max(60000, virtualTimeBudget * 2);
        console.warn(`[retry] ${relativeTestPath} remained incomplete after ${virtualTimeBudget} ms; retrying with ${retryBudget} ms`);
        const retry = spawnSync(process.execPath, [
          __filename,
          relativeTestPath,
          statusName,
          String(retryBudget)
        ], {
          cwd: projectRoot,
          env: { ...process.env, [retryEnvironmentKey]: "1" },
          stdio: "inherit"
        });
        process.exitCode = retry.status === 0 ? 0 : 1;
        return;
      }
      const reportMatch = html.match(new RegExp(`<pre id="${statusName}-report">([\\s\\S]*?)<\\/pre>`));
      if (reportMatch) console.error(reportMatch[1].trim());
      const stderr = fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, "utf8") : "";
      if (stderr) console.error(stderr.trim().slice(-4000));
      console.error(`[fail] ${relativeTestPath} did not report ${passStatus}`);
      process.exitCode = 1;
      return;
    }
    console.log(`[ok] ${relativeTestPath} passed`);
  } finally {
    stopProcessTree(child);
    if (stdoutFd != null) fs.closeSync(stdoutFd);
    if (stderrFd != null) fs.closeSync(stderrFd);
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[fail] ${error.stack || error.message || error}`);
  process.exit(1);
});
