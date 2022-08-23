const promisify = require("util").promisify;
const exec = require("child_process").exec;

// Run the command
const runCmdAsync = async function ({ command, path }, callback) {
  const process = exec(command, { cwd: path }, callback);
  process.stdout.on("data", (data) => {
    console.log(data.toString());
  });
};

// Wrapper for the command
module.exports = async function ({
  command,
  path = process.cwd(),
  silent = false,
}) {
  if (!silent) {
    console.log(`Running: $ ${command}`);
    console.log(`in ${path}`);
  }
  await promisify(runCmdAsync)({ command, path }).catch((error) => {
    console.log(error);
  });
};
