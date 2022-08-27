#!/usr/bin/env node

const CLI_VERSION = "0.0.1";
const fs = require("fs");
const path = require("path");
const { program } = require("commander");
const runCmd = require("./src/utils/run-cmd");
const { getSomeRandomChars, scanDir } = require("./src/utils/utils");

const getLiveBuildPath = (projectDirName) =>
  `${__dirname}/live-builds/${projectDirName}`;

const replaceAll = (inStr, pattern, replacement) => {
  let outStr = inStr;
  while (outStr !== outStr.replace(pattern, replacement)) {
    outStr = outStr.replace(pattern, replacement);
  }
  return outStr;
};

// Version & Program description
program
  .version(CLI_VERSION, "-v", "Output the version number")
  .description("Creates, updates, and deploys Miwi projects");

// Create a new project
program
  .command("create <human-project-name>")
  .description("Create a new miwi project")
  .action(async function (humanProjectName) {
    const BASE_PROJECT_NAME = humanProjectName.toLowerCase().replace(/ /g, "-");
    console.log(`Creating ${BASE_PROJECT_NAME}...`);

    // Set up the default project
    const PROJECT_DIRECTORY_NAME = `${BASE_PROJECT_NAME}-${getSomeRandomChars()}`;
    const PROJECT_ROOT_PATH = `./${PROJECT_DIRECTORY_NAME}/`;
    fs.mkdirSync(PROJECT_ROOT_PATH);
    copyDefaultProject();
    function copyDefaultProject(
      inDir = path.resolve(`${__dirname}/src/templates/default-project`),
      outDir = path.resolve(PROJECT_ROOT_PATH),
    ) {
      const allFiles = scanDir(inDir);
      for (const file of allFiles) {
        if (file.isDir) {
          fs.mkdirSync(path.resolve(outDir, file.basename));
          copyDefaultProject(
            path.resolve(inDir, file.basename),
            path.resolve(outDir, file.basename),
          );
        } else {
          let inFileContents = fs.readFileSync(
            path.resolve(inDir, file.basename),
          );
          if (
            [`.json`, `.js`, `.ts`, `.html`].includes(
              path.extname(file.basename),
            )
          ) {
            inFileContents = replaceAll(
              inFileContents.toString(),
              `\${liveBuildRootPath}`,
              replaceAll(getLiveBuildPath(PROJECT_DIRECTORY_NAME), `\\`, `/`),
            );
          }
          fs.writeFileSync(path.resolve(outDir, file.basename), inFileContents);
        }
      }
    }
    await runCmd({
      command: `git clone https://github.com/MechMel/Miwi`,
      path: PROJECT_ROOT_PATH,
    });
    fs.renameSync(
      path.resolve(PROJECT_ROOT_PATH, `Miwi`),
      path.resolve(PROJECT_ROOT_PATH, `miwi`),
    );

    // Open vscode
    await runCmd({
      command: `code .`,
      path: PROJECT_ROOT_PATH,
    });
  });

// Watch the current project
program
  .command("test")
  .description("Compile the current project into a website")
  .action(async function () {
    const projectDirName = path.basename(path.resolve(`./`));
    const WEB_DIR_PATH = getLiveBuildPath(projectDirName);
    const OUT_DIR_IMAGES = `${WEB_DIR_PATH}/images`;

    // Quit on Q
    const readline = require("readline");
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on("keypress", (str, key) => {
      if (key.name === `q`) {
        console.log(`Quitting...`);
        rmdirContents(WEB_DIR_PATH);
        fs.rmdirSync(WEB_DIR_PATH);
        process.exit();
      }
      // Maybe implement press 'R' to reload.
    });

    // Start the server
    console.log(``);
    console.log(`Starting a test server...`);
    if (!fs.existsSync(WEB_DIR_PATH)) fs.mkdirSync(WEB_DIR_PATH);
    if (!fs.existsSync(OUT_DIR_IMAGES)) fs.mkdirSync(OUT_DIR_IMAGES);
    const allScripts = [];
    updateHtml();
    function updateHtml() {
      // Set up index.html
      let scriptsText = ``;
      // Miwi files must be added first in the correct order
      const miwiFiles = [
        `miwi/utils.js`,
        `miwi/var.js`,
        `miwi/bool.js`,
        `miwi/num.js`,
        `miwi/str.js`,
        `miwi/mdIcons.js`,
        `miwi/widget.js`,
        `miwi/md.js`,
      ];
      for (const file of miwiFiles) {
        scriptsText += `<script src="/${file}"></script>`;
      }
      for (const file of allScripts) {
        if (!miwiFiles.includes(file)) {
          scriptsText += `<script src="/${file}"></script>`;
        }
      }
      fs.writeFileSync(
        path.resolve(WEB_DIR_PATH, `index.html`),
        fs
          .readFileSync(`${__dirname}/src/templates/index.html`)
          .toString()
          .replace("${scripts}", scriptsText),
      );
    }
    require("live-server").start({
      port: 7171,
      root: WEB_DIR_PATH,
      file: `index.html`,
      // We want VSCode to open a browser so we can debug the code.
      open: false,
      logLevel: 0,
    });
    console.log(`The test server is live.`);
    console.log(``);

    // Run the watcher
    const watcher = new (require(`watcher`))(path.resolve(`./`), {
      recursive: true,
      // Don't copy config files
      ignore: (targetPath) => {
        let shouldIgnore = false;
        for (const blackListDir of [
          `.git`,
          `.vscode`,
          `node_modules`,
          `tsconfig.json`,
        ]) {
          shouldIgnore = shouldIgnore || targetPath.indexOf(blackListDir) > -1;
        }
        return shouldIgnore;
      },
    });
    watcher.on("all", (event, _targetPath, _targetPathNext) => {
      if (event !== `ready` && event !== `close` && event !== `error`) {
        console.log(`Updating...`);

        try {
          // Compute some stats on the change
          const inPath = _targetPathNext ?? _targetPath;
          const inPathOld =
            _targetPathNext === undefined ? undefined : _targetPath;
          const fileTypes = { dir: `dir`, image: `image`, script: `script` };
          function getFileType(filePath) {
            if (filePath === undefined) return undefined;
            const fileExt = path.extname(filePath);
            if (fileExt === ``) {
              return fileTypes.dir;
            } else if (
              [`.ico`, `.svg`, `.png`, `.jpg`, `.jpeg`].includes(fileExt)
            ) {
              return fileTypes.image;
            } else if (fileExt === `.ts`) {
              return fileTypes.script;
            } else {
              return undefined;
            }
          }
          function getOutPath(inPath) {
            const fileType = getFileType(inPath);
            switch (fileType) {
              case fileTypes.dir:
                return path.resolve(
                  WEB_DIR_PATH,
                  path.relative(path.resolve(`./`), inPath),
                );
              case fileTypes.image:
                return path.resolve(OUT_DIR_IMAGES, path.basename(inPath));
              case fileTypes.script:
                return path.resolve(
                  WEB_DIR_PATH,
                  path.relative(
                    path.resolve(`./`),
                    inPath.replace(`.ts`, `.js`),
                  ),
                );
              default:
                return undefined;
            }
          }
          // Images are stored all stored under an images folder, so that they can be referenced just via their name.
          const outPath = getOutPath(inPath);
          const outPathOld = getOutPath(inPathOld);

          // Doing per file change updating will hopefully improve performance
          switch (event) {
            case `addDir`:
              if (!fs.existsSync(outPath)) fs.mkdirSync(outPath);
              break;
            case `renameDir`:
              fs.existsSync(outPath)
                ? fs.renameSync(outPathOld, outPath)
                : fs.mkdirSync(outPath);
              break;
            case `unlinkDir`:
              if (fs.existsSync(outPath)) {
                rmdirContents(outPath);
                fs.rmdirSync(outPath);
              }
              break;
            // On rename we unlink and write instead of just renmaing, because renaming an input file can change where it is outputted to.
            case `rename`:
            case `unlink`:
              if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
              if (event === `unlink`) break;
            case `add`:
            case `change`:
              if (getFileType(inPath) === fileTypes.image) {
                fs.writeFileSync(outPath, fs.readFileSync(inPath));
              } else if (getFileType(inPath) === fileTypes.script) {
                // Transpile using esbuild because it is faster
                require("esbuild").buildSync({
                  entryPoints: [inPath],
                  outdir: path.parse(outPath).dir,
                  external: [],
                  watch: false,
                  sourcemap: true,
                });
                const importPath = replaceAll(
                  path.relative(WEB_DIR_PATH, outPath),
                  `\\`,
                  `/`,
                );
                if (!allScripts.includes(importPath)) {
                  allScripts.push(importPath);
                }
              } else {
                // We currently don't copy unsupported file formats. We might or migth not want to change this in future
              }
              break;
          }
          updateHtml();
        } catch (e) {
          console.log(e);
        }

        console.log(`Update finished.`);
        console.log(`Press 'Q' to quit.`);
        //console.log(`Press 'R' to reload.`);
        console.log(``);
      }
    });
  });

// Run this program
program.parse(process.argv);

function rmdirContents(dir) {
  const allFiles = scanDir(dir);
  for (const file of allFiles) {
    if (file.isDir) {
      rmdirContents(file.path);
      fs.rmdirSync(file.path);
    } else {
      fs.unlinkSync(file.path);
    }
  }
}
