const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const npmCommand = "npm";
const useShell = process.platform === "win32";
let isShuttingDown = false;

const processes = [
  spawn(npmCommand, ["run", "start:web"], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: useShell,
  }),
  spawn(npmCommand, ["run", "dev"], {
    cwd: path.join(projectRoot, "server"),
    stdio: "inherit",
    shell: useShell,
  }),
];

function shutdown(exitCode) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  processes.forEach((child) => {
    if (!child.killed) child.kill();
  });
  process.exit(exitCode);
}

processes.forEach((child, index) => {
  child.on("error", (error) => {
    console.error(index === 0 ? "Failed to start web app:" : "Failed to start backend:", error.message);
    shutdown(1);
  });
  child.on("exit", (code) => {
    if (!isShuttingDown) shutdown(code || 0);
  });
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
