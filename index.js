#!/usr/bin/env node

const CLI_VERSION = "0.2.0";
const fs = require("fs");
const path = require("path");
const { program } = require("commander");
const runCmd = require("./src/utils/run-cmd");
const {
  getSomeRandomChars,
  scanDir,
  replaceAll,
  exists,
} = require("./src/utils/utils");
const { kebabCase } = require("change-case");
const semver = require("semver");
const zl = require("zip-lib");

// Version & Program description
program
  .version(CLI_VERSION, "-v", "Output the version number")
  .description("Creates, updates, and deploys Miwi projects");

// Create a new project
program
  .command("new <human-project-name>")
  .description("Create a new Vue & Miwi project")
  .action(async function (humanProjectName) {
    humanProjectName = humanProjectName.trim();
    // Set up the projet's root dir
    const KEBAB_CASE = kebabCase(humanProjectName);
    console.log(`Creating ${KEBAB_CASE}...`);
    const PROJECT_DIRECTORY_NAME = `${KEBAB_CASE}-${getSomeRandomChars()}`;
    const PROJECT_ROOT_PATH = `./${PROJECT_DIRECTORY_NAME}/`;

    // Vue project creation
    await runCmd({
      command: `npm init vue@latest`,
    });

    // Running installation commands
    await runCmd({
      command: `npm install && npm run build`,
      path: PROJECT_ROOT_PATH,
    });

    // Installing Material Design Icon support
    await runCmd({
      command: `npm install mdi-vue`,
      path: PROJECT_ROOT_PATH,
    });
    await runCmd({
      command: `npm install @mdi/js`,
      path: PROJECT_ROOT_PATH,
    });

    // Fix meta tag in index.html
    let indexPath = path.join(PROJECT_ROOT_PATH, "public", "index.html");
    let indexFile = fs.readFileSync(indexPath, "utf8");
    indexFile = indexFile.replace(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no" />',
    );
    fs.writeFileSync(indexPath, indexFile);

    // Copy up the default files
    await runCmd({
      command: `git clone https://github.com/MechMel/Miwi-Vue-App-Template.git ${PROJECT_ROOT_PATH}`,
      path: PROJECT_ROOT_PATH,
    });
    // Remove the .git folder
    fs.rmdirSync(`${PROJECT_ROOT_PATH}/.git`, { recursive: true });

    // Open vscode
    await runCmd({
      command: `code .`,
      path: PROJECT_ROOT_PATH,
    });
  });

// Sync the current project to GitHub
program
  .command(`sync <message>`)
  .description(`Sync the current project to GitHub.`)
  .action(async function (message) {
    await runCmd({
      command: `git add .`,
      path: `./`,
    });
    await runCmd({
      command: `git commit -m "${message}"`,
      path: `./`,
    });
    await runCmd({
      command: `git push`,
      path: `./`,
    });
  });

// Debug the current project
// program
//   .command("debug")
//   .description("Run the current project in a live debug environment")
//   .action(async function () {
//   });

program
  .command(`pub`)
  .description(`Publish the current project to test flight.`)
  .option(`-m, --minor`, `Publish as a minor update. (default is patch)`)
  .option(`-M, --major`, `Publish as a major update. (default is patch)`)
  .action(async function (options) {
    // Parse request
    const releaseLevel = options.major
      ? `major`
      : options.minor
      ? `minor`
      : `patch`;

    // Update version number
    const { newVersionNum } = (() => {
      // Get version number from package.json
      const packageJson = JSON.parse(fs.readFileSync(`./package.json`));
      const prevVersionNum = packageJson.version;
      const newVersionNum = semver.inc(prevVersionNum, releaseLevel);

      // Update package.json
      packageJson.version = newVersionNum;
      fs.writeFileSync(`./package.json`, JSON.stringify(packageJson, null, 2));

      // Update codemagic.yaml
      const codemagicYaml = fs.readFileSync(`./codemagic.yaml`).toString();
      const newCodemagicYaml = codemagicYaml.replaceAll(
        new RegExp(`\\s[0-9]+\\.[0-9]+\\.[0-9]+\\s`, `g`),
        ` ${newVersionNum} `,
      );
      fs.writeFileSync(`./codemagic.yaml`, newCodemagicYaml);

      return { newVersionNum };
    })();
    console.log(`New version number: ${newVersionNum}`);

    // Build the client
    await runCmd({
      command:
        releaseLevel === `patch` ? `npm run build:patch` : `npm run build:full`,
      path: `./`,
    });

    // Zip the client build
    const patchZipName = `${newVersionNum}.zip`;
    const patchZipPath = `./${patchZipName}`;
    await zl.archiveFolder(`./dist`, patchZipPath);

    // Upload the client build to Firebase
    await (async () => {
      try {
        // Initialize Firebase
        const { initializeApp, cert } = require("firebase-admin/app");
        const { getStorage } = require("firebase-admin/storage");
        const serviceAccount = require(`${require("os").homedir()}/.miwi/firebase-admin-credentials.json`);
        const admin = initializeApp({
          credential: cert(serviceAccount),
        });
        const storage = getStorage(admin);

        // Upload the zipped file to Firebase Cloud Storage
        const bucket = storage.bucket("gs://tke-ota.appspot.com");
        const bundleId = JSON.parse(
          fs.readFileSync(`./capacitor.config.json`),
        ).appId;
        console.log(`Uploading patch for OTA...`);
        const uploadResult = await bucket.upload(patchZipPath, {
          destination: `${bundleId}/${patchZipName}`,
        });

        // TODO: Eventually check how many uploads there are and delete the oldest few automatically.
      } catch (e) {
        console.error(e);
      }
    })();

    // Clean up the zip file
    fs.unlinkSync(patchZipPath);

    /* Syncchanges to GitHub. For minor and major updates this is nessecary
     * for CodeMagic, but it seems good to do for all updates. */
    await runCmd({
      command: `miwi sync "Publishing ${newVersionNum}"`,
      path: `./`,
    });
  });

// Run this program
program.parse(process.argv);
