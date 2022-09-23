#!/usr/bin/env node

const CLI_VERSION = "0.0.1";
const fs = require("fs");
const path = require("path");
const { program } = require("commander");
const runCmd = require("./src/utils/run-cmd");
const { build } = require("./src/build.js");
const {
  getSomeRandomChars,
  scanDir,
  replaceAll,
} = require("./src/utils/utils");

//const LIVE_DEBUG_DIR = replaceAll(`${__dirname}/live-debug`, `\\`, `/`);
const LIVE_DEBUG_DIR = `./.miwi/debug`;
const CLIENT_BUILD_DIR = `./.miwi/client-build`;

// Version & Program description
program
  .version(CLI_VERSION, "-v", "Output the version number")
  .description("Creates, updates, and deploys Miwi projects");

// Create a new project
program
  .command("create <human-project-name>")
  .description("Create a new miwi project")
  .action(async function (humanProjectName) {
    // Set up the projet's root dir
    const BASE_PROJECT_NAME = humanProjectName.toLowerCase().replace(/ /g, "-");
    console.log(`Creating ${BASE_PROJECT_NAME}...`);
    const PROJECT_DIRECTORY_NAME = `${BASE_PROJECT_NAME}-${getSomeRandomChars()}`;
    const PROJECT_ROOT_PATH = `./${PROJECT_DIRECTORY_NAME}/`;
    fs.mkdirSync(PROJECT_ROOT_PATH);

    // Copy up the default files
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
              `\${liveDebugRootPath}`,
              LIVE_DEBUG_DIR,
            );
          }
          fs.writeFileSync(path.resolve(outDir, file.basename), inFileContents);
        }
      }
    }

    // Clone Miwi
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

// Debug the current project
program
  .command("debug")
  .description("Start a debug server for the current project")
  .action(async function () {
    build({
      inDir: `./`,
      outDir: LIVE_DEBUG_DIR,
      shouldWatch: true,
    });
  });

// Build the current project
program
  .command("build")
  .description("Compile the current project into a website")
  .action(async function () {
    build({
      inDir: `./`,
      outDir: CLIENT_BUILD_DIR,
      shouldWatch: false,
    });
  });

// Run this program
program.parse(process.argv);
