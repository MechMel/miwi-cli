#!/usr/bin/env node

const CLI_VERSION = "0.0.1";
const fs = require("fs");
const path = require("path");
const { program } = require("commander");
const runCmd = require("./src/utils/run-cmd");
const { getSomeRandomChars, scanDir } = require("./src/utils/utils");

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
          fs.writeFileSync(
            path.resolve(outDir, file.basename),
            fs.readFileSync(path.resolve(inDir, file.basename)),
          );
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
    const WEB_DIR_PATH = `${__dirname}/live-builds/${projectDirName}`;
    function removeOldWebsite(dir = WEB_DIR_PATH) {
      const allFiles = scanDir(dir);
      for (const i in allFiles) {
        if (allFiles[i].isDir) {
          removeOldWebsite(allFiles[i].path);
          fs.rmdirSync(allFiles[i].path);
        } else {
          //if (allFiles[i].basename != `index.html`) {
          fs.unlinkSync(allFiles[i].path);
          //}
        }
      }
    }

    async function compile() {
      console.log(`Updating...`);

      // Start with a clean slate
      if (!fs.existsSync(WEB_DIR_PATH)) {
        fs.mkdirSync(WEB_DIR_PATH);
      }
      removeOldWebsite();

      // Copy all image files in
      const tsFiles = [];
      const OUT_DIR_IMAGES = `${WEB_DIR_PATH}/images`;
      if (!fs.existsSync(OUT_DIR_IMAGES)) {
        fs.mkdirSync(OUT_DIR_IMAGES);
      }
      copyImages();
      function copyImages(inDir = path.resolve(`./`)) {
        const allFiles = scanDir(inDir);
        for (const file of allFiles) {
          if (file.isDir) {
            copyImages(file.path);
          } else {
            const _imageExtensions = [`.ico`, `.svg`, `.png`, `.jpg`, `.jpeg`];
            if (_imageExtensions.includes(path.extname(file.basename))) {
              fs.writeFileSync(
                path.resolve(OUT_DIR_IMAGES, file.basename),
                fs.readFileSync(file.path),
              );
            } else if (path.extname(file.basename) === `.ts`) {
              tsFiles.push(
                path.relative(path.resolve(`./`), file.path).replace(`\\`, `/`),
              );
            }
          }
        }
      }

      // Set up index.html
      const miwiFiles = [
        `miwi/utils.ts`,
        `miwi/mdIcons.ts`,
        `miwi/widget.ts`,
        `miwi/md.ts`,
      ];
      let scriptsText = ``;
      // Miwi files must be added first in the correct order
      for (const file of miwiFiles) {
        scriptsText += `<script src="/${file.replace(`.ts`, `.js`)}"></script>`;
      }
      for (const file of tsFiles) {
        if (!miwiFiles.includes(file)) {
          scriptsText += `<script src="/${file.replace(
            `.ts`,
            `.js`,
          )}"></script>`;
        }
      }
      fs.writeFileSync(
        path.resolve(WEB_DIR_PATH, `index.html`),
        fs
          .readFileSync(`${__dirname}/src/templates/index.html`)
          .toString()
          .replace("${scripts}", scriptsText),
      );

      // Transpile using esbuild because it is faster
      require("esbuild").buildSync({
        entryPoints: tsFiles,
        outdir: WEB_DIR_PATH,
        external: [],
        watch: false,
      });

      console.log(`Update finished.`);
      console.log(`Press 'Q' at any time to quit.`);
      console.log(``);
    }
    // Start the server
    console.log(``);
    await compile();
    console.log(`Strarting a test server...`);
    require("live-server").start({
      port: 7171,
      root: WEB_DIR_PATH,
      file: `index.html`,
      open: true,
      logLevel: 0,
    });
    console.log(`The test server is live.`);
    console.log(``);

    // Run the watcher
    const watcher = require("node-watch")(path.resolve(`./`), {
      recursive: true,
    });
    watcher.on(`change`, compile);

    // Quit on Q
    const readline = require("readline");
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on("keypress", (str, key) => {
      if (key.name === `q`) {
        console.log(`Quitting...`);
        removeOldWebsite();
        fs.rmdirSync(WEB_DIR_PATH);
        process.exit();
      }
    });
  });

// Run this program
program.parse(process.argv);
