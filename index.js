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
  .command("new <human-project-name>")
  .description("Create a new miwi project")
  .action(async function (humanProjectName) {
    const BASE_PROJECT_NAME = humanProjectName.toLowerCase().replace(/ /g, "-");
    console.log(`Creating ${BASE_PROJECT_NAME}...`);

    // Create the project folder
    const PROJECT_DIRECTORY_NAME = `${BASE_PROJECT_NAME}-${getSomeRandomChars()}`;
    const PROJECT_ROOT_PATH = `./${PROJECT_DIRECTORY_NAME}/`;
    fs.mkdirSync(PROJECT_ROOT_PATH);

    // Create the project folder
    const MIWI_PATH = `${PROJECT_ROOT_PATH}/miwi`;
    fs.mkdirSync(MIWI_PATH);

    // Set up the default project
    fs.writeFileSync(
      path.resolve(PROJECT_ROOT_PATH, `favicon.png`),
      fs.readFileSync(`${__dirname}/src/templates/favicon.png`),
    );
    fs.writeFileSync(
      path.resolve(PROJECT_ROOT_PATH, `test.ts`),
      fs.readFileSync(`${__dirname}/src/templates/test.ts`),
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

    async function compile() {
      console.log(`Updating...`);

      // Remove old website content
      if (fs.existsSync(WEB_DIR_PATH)) {
        removeOldWebsite();
        function removeOldWebsite(dir = WEB_DIR_PATH) {
          const allFiles = scanDir(dir);
          for (const i in allFiles) {
            if (allFiles[i].isDir) {
              removeOldWebsite(allFiles[i].path);
              fs.rmdirSync(allFiles[i].path);
            } else {
              if (allFiles[i].basename != `index.html`) {
                fs.unlinkSync(allFiles[i].path);
              }
            }
          }
        }
      }

      // Transpile using esbuild because it is faster
      const { build } = require("esbuild");
      const glob = require("glob");
      const entryPoints = glob.sync("./**/*.ts");
      build({
        entryPoints,
        outdir: WEB_DIR_PATH,
        external: [],
        watch: false,
      });

      // Copy all image files in
      const OUT_DIR_IMAGES = `${WEB_DIR_PATH}/images`;
      if (!fs.existsSync(OUT_DIR_IMAGES)) {
        fs.mkdirSync(OUT_DIR_IMAGES);
      }
      copyImages();
      function copyImages(inDir = path.resolve(`./`)) {
        const allFiles = scanDir(inDir);
        for (const i in allFiles) {
          if (allFiles[i].isDir) {
            copyImages(allFiles[i].path);
          } else {
            const _imageExtensions = [`.ico`, `.svg`, `.png`, `.jpg`, `.jpeg`];
            if (_imageExtensions.includes(path.extname(allFiles[i].basename))) {
              fs.writeFileSync(
                path.resolve(OUT_DIR_IMAGES, allFiles[i].basename),
                fs.readFileSync(allFiles[i].path),
              );
            }
          }
        }
      }
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
        process.exit();
      }
    });
  });

// Run this program
program.parse(process.argv);
