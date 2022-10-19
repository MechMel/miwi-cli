const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const readline = require("readline");
const promptCallback = async function (message, callback) {
  const readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  readlineInterface.question(message, (response) => {
    readlineInterface.close();
    callback(null, response);
  });
};

module.exports = {
  promptAsync: promisify(promptCallback),

  promptYesNoAsync: async function ({ message, defaultValue = false }) {
    message.trimRight(" ");
    message.trimRight(":");
    message += defaultValue ? " (Y/n): " : " (y/N): ";
    const responseText = await module.exports.promptAsync(message);

    let responseValue;
    if (defaultValue) {
      responseValue = !responseText.startsWith("n");
    } else {
      responseValue = responseText.startsWith("y");
    }

    return responseValue;
  },

  // We use a chunk of random numbers to help guarantee that two projects don't accidentally get the same name
  getSomeRandomChars: function (charCount = 4) {
    //const validChars = "bcdfghjklmnpqrstvwxyz0123456789";
    const validChars = "bcdfghjklmnpqrstvwxyz";

    let randomChars = "";
    for (let i = 0; i < charCount; i++) {
      randomChars += validChars.charAt(
        Math.floor(Math.random() * validChars.length),
      );
    }

    return randomChars;
  },

  scanDir: (dir) =>
    fs.readdirSync(dir).map((fileName) => ({
      basename: fileName,
      path: path.resolve(dir, fileName),
      isDir: fs.statSync(path.resolve(dir, fileName)).isDirectory(),
    })),

  rmdirContents: (dir) => {
    if (fs.existsSync(dir)) {
      const allFiles = module.exports.scanDir(dir);
      for (const file of allFiles) {
        if (file.isDir) {
          module.exports.rmdirContents(file.path);
          fs.rmdirSync(file.path);
        } else {
          fs.unlinkSync(file.path);
        }
      }
    }
  },

  exists: (x) => x !== undefined && x !== null,

  replaceAll: (inStr, pattern, replacement) => {
    let outStr = inStr;
    while (outStr !== outStr.replace(pattern, replacement)) {
      outStr = outStr.replace(pattern, replacement);
    }
    return outStr;
  },
};
