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
  exists,
} = require("./src/utils/utils");
const yaml = require("js-yaml");
const {
  createInitialProject,
  getAwsHostingDetails,
  CLOUD_BUILD_DIR,
} = require("./src/aws-serverless-hosting.js");
const qrcode = require("qrcode-terminal");
const semver = require('semver');
const zl = require('zip-lib');

//const LIVE_DEBUG_DIR = replaceAll(`${__dirname}/live-debug`, `\\`, `/`);
const LIVE_DEBUG_DIR = `./.miwi/debug`;
const CLIENT_BUILD_DIR = `./.miwi/client-build`;

// Version & Program description
program
  .version(CLI_VERSION, "-v", "Output the version number")
  .description("Creates, updates, and deploys Miwi projects");

program
  .command("temp")
  .description("Temp")
  .action(async function () {
    const outDir = path.resolve(CLOUD_BUILD_DIR);
    console.log(outDir);
    const getBaseNameFromCloudDir = (absoluteOutDir, relativeDir) => {
      if (path.dirname(relativeDir) != `.`) {
        return getBaseNameFromCloudDir(
          path.join(absoluteOutDir, `../`),
          path.join(relativeDir, `../`),
        );
      } else {
        return path.basename(path.join(absoluteOutDir, `../`));
      }
    };
    const projectBaseName = getBaseNameFromCloudDir(outDir, CLOUD_BUILD_DIR);
    console.log(projectBaseName);
  });

// Create a new project
program
  .command("new <human-project-name>")
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
  .description("Compile the current project into cloud config and a website")
  .action(async function () {
    const awsHostingDetailsPath = getAwsHostingDetails(CLOUD_BUILD_DIR);
    if (!fs.existsSync(awsHostingDetailsPath)) {
      await createInitialProject(CLOUD_BUILD_DIR);
    }

    build({
      inDir: `./`,
      outDir: CLIENT_BUILD_DIR,
      shouldWatch: false,
    });
  });

program
  .command(`pub`)
  .description(`Publish the current project to test flight.`)
  .option(`-m, --minor`, `Publish as a minor update. (default is patch)`)
  .option(`-M, --major`, `Publish as a major update. (default is patch)`)
  .action(async function (options) {
    // Parse request
    const releaseLevel = options.major ? `major` : options.minor ? `minor` : `patch`;
    
    // Update version number
    const { newVersionNum } = ((() => {
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
        new RegExp(`\\s[0-9]+\\.[0-9]+\\.[0-9]+\\s` , `g`),
        ` ${newVersionNum} `,
      );
      fs.writeFileSync(`./codemagic.yaml`, newCodemagicYaml);

      return { newVersionNum };
    })());
    console.log(`New version number: ${newVersionNum}`);

    // Build the client
    await runCmd({
      command: `npm run build`,
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
        const { initializeApp, cert } = require('firebase-admin/app');
        const { getStorage } = require('firebase-admin/storage');
        const serviceAccount = require(
          `${require('os').homedir()}/.miwi/firebase-admin-credentials.json`);
        const admin = initializeApp({
          credential: cert(serviceAccount)
        });
        const storage = getStorage(admin);
  
        // Upload the zipped file to Firebase Cloud Storage
        const bucket = storage.bucket("gs://tke-ota.appspot.com");
        const bundleId = JSON.parse(fs.readFileSync(`./capacitor.config.json`)).appId;
        console.log(`Uploading patch for OTA...`);
        const uploadResult = await bucket.upload(patchZipPath, {
          destination: `${bundleId}/${patchZipName}`,
        });
      } catch (e) {
        console.error(e);
      }
    })();

    // Clean up the zip file
    fs.unlinkSync(patchZipPath);
  });


// Deploys the current project
program
  .command("deploy")
  .description("Deploy the current project as a website")
  .action(async function () {
    const awsHostingDetailsPath = getAwsHostingDetails(CLOUD_BUILD_DIR);

    // Build the client
    await runCmd({
      command: `miwi build`,
      path: `./`,
    });

    // Deploy the cloud
    await runCmd({
      command: `serverless deploy`,
      path: CLOUD_BUILD_DIR,
    });

    // Deploy the client
    const awsHostingDetails = JSON.parse(
      fs.readFileSync(awsHostingDetailsPath),
    );
    const awsProfile = `tke-rel`;
    await runCmd({
      command: `aws s3 sync ./ s3://${awsHostingDetails.hostingBucketID}  --exclude "*.js" --delete --profile ${awsProfile} --acl public-read --region us-east-1`,
      path: CLIENT_BUILD_DIR,
    });
    await runCmd({
      command: `aws s3 sync ./ s3://${awsHostingDetails.hostingBucketID}  --exclude "*" --include "*.js" --content-type application/javascript --profile ${awsProfile} --acl public-read --region us-east-1`,
      path: CLIENT_BUILD_DIR,
    });
    await runCmd({
      command: `aws cloudfront create-invalidation --profile ${awsProfile} --distribution-id ${awsHostingDetails.cloudFrontDistributionID} --paths "/*"`,
      path: CLOUD_BUILD_DIR,
    });

    // Print a QR code
    console.log(`PWA URL: ${awsHostingDetails.pwaURL}`);
    qrcode.generate(awsHostingDetails.pwaURL);
  });

// Run this program
program.parse(process.argv);
