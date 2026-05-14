const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const SCRIPTS_DIR = path.join(ROOT_DIR, "scripts");

const RESULT_LINE_RE = /^RESULT_JSON\s+(\{.*\})\s*$/;

function getPythonBin() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === "win32" ? "python" : "python3";
}

function tail(buffer, n) {
  if (buffer.length <= n) return buffer;
  return buffer.slice(buffer.length - n);
}

function parseResult(tailText) {
  const lines = tailText.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(RESULT_LINE_RE);
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function runScript({ script, args, logPath, env }) {
  return new Promise((resolve) => {
    const scriptPath = path.join(SCRIPTS_DIR, script);
    const pythonBin = getPythonBin();

    const logStream = fs.createWriteStream(logPath, { flags: "a" });
    logStream.write(`== Job started: ${new Date().toISOString()} ==\n`);
    logStream.write(`Command: ${pythonBin} ${scriptPath} ${args.join(" ")}`.trim() + "\n\n");

    const child = spawn(pythonBin, [scriptPath, ...args], {
      cwd: ROOT_DIR,
      env: { ...process.env, ...(env || {}) }
    });

    let captured = "";
    const CAP_LIMIT = 8 * 1024;

    const onData = (chunk) => {
      const str = chunk.toString();
      captured = tail(captured + str, CAP_LIMIT);
      logStream.write(str);
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    child.on("error", (error) => {
      logStream.write(`\n== Spawn error: ${error.message} ==\n`);
      logStream.end();
      resolve({ code: -1, error: error.message, result: null });
    });

    child.on("close", (code) => {
      logStream.write(`\n== Job finished: ${new Date().toISOString()} (exit ${code}) ==\n`);
      logStream.end();
      const result = parseResult(captured);
      resolve({ code: code ?? -1, error: null, result });
    });
  });
}

module.exports = { runScript };
