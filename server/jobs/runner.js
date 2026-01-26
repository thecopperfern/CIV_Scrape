const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const SCRIPTS_DIR = path.join(ROOT_DIR, "scripts");

function getPythonBin() {
  if (process.env.PYTHON_BIN) {
    return process.env.PYTHON_BIN;
  }
  return process.platform === "win32" ? "python" : "python3";
}

function runScript({ script, args, logPath }) {
  return new Promise((resolve) => {
    const scriptPath = path.join(SCRIPTS_DIR, script);
    const pythonBin = getPythonBin();

    const logStream = fs.createWriteStream(logPath, { flags: "a" });
    logStream.write(`== Job started: ${new Date().toISOString()} ==\n`);
    logStream.write(`Command: ${pythonBin} ${scriptPath} ${args.join(" ")}`.trim() + "\n\n");

    const child = spawn(pythonBin, [scriptPath, ...args], {
      cwd: ROOT_DIR,
      env: { ...process.env }
    });

    child.stdout.on("data", (data) => {
      logStream.write(data.toString());
    });

    child.stderr.on("data", (data) => {
      logStream.write(data.toString());
    });

    child.on("error", (error) => {
      logStream.write(`\n== Spawn error: ${error.message} ==\n`);
      logStream.end();
      resolve({ code: -1, error: error.message });
    });

    child.on("close", (code) => {
      logStream.write(`\n== Job finished: ${new Date().toISOString()} (exit ${code}) ==\n`);
      logStream.end();
      resolve({ code: code ?? -1, error: null });
    });
  });
}

module.exports = { runScript };
