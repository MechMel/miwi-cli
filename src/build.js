const fs = require("fs");
const path = require("path");
const { rmdirContents, replaceAll, scanDir, exists } = require("./utils/utils");

module.exports = {
  build: ({ inDir, outDir, shouldWatch = false }) => {
    const OUT_DIR_IMAGES = `${outDir}/images`;

    // Quit on Q
    if (shouldWatch) {
      const readline = require("readline");
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      process.stdin.on("keypress", (str, key) => {
        if (key.name === `q`) {
          console.log(`Quitting...`);
          rmdirContents(outDir);
          //fs.rmdirSync(WEB_DIR_PATH);
          process.exit();
        }
        // Maybe implement press 'R' to reload.
      });
    }

    // Delete the old debug dir
    rmdirContents(outDir);

    // Create the inital files
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    if (!fs.existsSync(OUT_DIR_IMAGES)) fs.mkdirSync(OUT_DIR_IMAGES);
    const allScripts = [];
    updateHtml();
    function updateHtml() {
      // Set up index.html
      let importScriptsText = ``;
      const importScript = (scriptName) =>
        (importScriptsText += exists(scriptName)
          ? `<script src="/${scriptName}"></script>`
          : ``);

      /* Because I don't want to deal with import order right now,
       * I'll put some files in a specific order, and alphabetize
       * everything else. */
      const alphabetizedScripts = [...allScripts];
      const removeFromAlphScripts = (scriptName) => {
        if (alphabetizedScripts.includes(scriptName)) {
          alphabetizedScripts.splice(
            alphabetizedScripts.indexOf(scriptName),
            1,
          );
          return scriptName;
        } else {
          return undefined;
        }
      };

      /* Eventually we should dynamically compute impor order, but
       * right now we just manually import all Miwi files in the
       * correct order. Followed by a few dev-definable files. */
      const miwiFiles = [
        `miwi/utils.js`,
        `miwi/var.js`,
        `miwi/list.js`,
        `miwi/bool.js`,
        `miwi/num.js`,
        `miwi/str.js`,
        `miwi/mdIcons.js`,
        `miwi/widget.js`,
        `miwi/md.js`,
      ];
      miwiFiles.forEach(removeFromAlphScripts);
      miwiFiles.forEach(importScript);

      // Devs can create these files, and we will manually improt them first
      importScript(removeFromAlphScripts(`utils.js`));
      importScript(removeFromAlphScripts(`custom-widgets.js`));

      // The routes file needs to get imported at the end
      const routesFileName = `routes.js`;
      let shouldImportRoutesFile = exists(
        removeFromAlphScripts(routesFileName),
      );

      // We alphabtize any scripts that aren't manually imported above.
      alphabetizedScripts.forEach(importScript);

      // The routes file needs to get imported at the end
      if (shouldImportRoutesFile) {
        importScriptsText += `<script src="/${routesFileName}"></script>`;
      }
      fs.writeFileSync(
        path.resolve(outDir, `index.html`),
        fs
          .readFileSync(`${__dirname}/templates/index.html`)
          .toString()
          .replace("${scripts}", importScriptsText),
      );

      /*const puppeteer = require("puppeteer");
      (async () => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // Log errors
        const logFilePath = `${__dirname}/temp-log.txt`;
        fs.writeFileSync(logFilePath, ``);
        page.on("pageerror", (error) => {
          const isRefError = error.message.startsWith(`ReferenceError:`);
          if (isRefError) {
            //const getProp
            fs.writeFileSync(
              logFilePath,
              fs.readFileSync(logFilePath) + error.message + "\n\n",
            );
          }
        });

        await page.goto(`http://localhost:7171/`);

        await browser.close();
      })();*/
    }

    // Run the watcher
    const dirBlackList = [
      `.git`,
      `.vscode`,
      `node_modules`,
      `tsconfig.json`,
      `.miwi`,
    ];
    const buildOneFile = (event, _targetPath, _targetPathNext) => {
      if (event !== `ready` && event !== `close` && event !== `error`) {
        if (shouldWatch) console.log(`Updating...`);

        try {
          // Compute some stats on the change
          const inPath = _targetPathNext ?? _targetPath;
          const inPathOld =
            _targetPathNext === undefined ? undefined : _targetPath;
          const fileTypes = {
            dir: `dir`,
            image: `image`,
            script: `script`,
            file: `file`,
          };
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
              return fileTypes.file;
            }
          }
          function getOutPath(inPath) {
            const fileType = getFileType(inPath);
            switch (fileType) {
              case fileTypes.dir:
              case fileTypes.file:
                return path.resolve(
                  outDir,
                  path.relative(path.resolve(`./`), inPath),
                );
              case fileTypes.image:
                return path.resolve(OUT_DIR_IMAGES, path.basename(inPath));
              case fileTypes.script:
                return path.resolve(
                  outDir,
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
              if (fs.existsSync(outPath)) {
                fs.unlinkSync(outPath);
                const scriptImportPath = replaceAll(
                  path.relative(outDir, outPath),
                  `\\`,
                  `/`,
                );
                //console.log(scriptImportPath);
                for (let i in allScripts) {
                  if (allScripts[i] === scriptImportPath) {
                    allScripts.splice(i, 1);
                    i--;
                  }
                }
              }
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
                  sourcemap: shouldWatch ? true : false,
                });
                const importPath = replaceAll(
                  path.relative(outDir, outPath),
                  `\\`,
                  `/`,
                );
                if (!allScripts.includes(importPath)) {
                  allScripts.push(importPath);
                }
              } else {
                // We just copy generic files straight over.
                fs.writeFileSync(outPath, fs.readFileSync(inPath));
              }
              break;
          }
          updateHtml();
        } catch (e) {
          console.log(e);
        }

        if (shouldWatch) {
          console.log(`Update finished.`);
          console.log(`Press 'Q' to quit.`);
          //console.log(`Press 'R' to reload.`);
          console.log(``);
        }
      }
    };

    // Run the build
    if (shouldWatch) {
      // Start the server
      console.log(``);
      console.log(`Starting a debug server...`);
      require("live-server").start({
        port: 7171,
        root: outDir,
        file: `index.html`,
        // We want VSCode to open a browser so we can debug the code.
        open: false,
        logLevel: 0,
      });
      console.log(`The debug server is live.`);
      console.log(``);

      // Start the build watcher
      const watcher = new (require(`watcher`))(path.resolve(inDir), {
        recursive: true,
        // Don't copy config files
        ignore: (targetPath) => {
          let shouldIgnore = false;
          for (const blackListedDir of dirBlackList) {
            shouldIgnore =
              shouldIgnore || targetPath.indexOf(blackListedDir) > -1;
          }
          return shouldIgnore;
        },
      });
      watcher.on("all", buildOneFile);
    } else {
      compileRec(inDir);
      function compileRec(dir) {
        const files = scanDir(dir);
        files.map((file) => {
          if (!dirBlackList.includes(file.basename)) {
            buildOneFile(file.isDir ? `addDir` : `add`, file.path, undefined);
            if (file.isDir) compileRec(`${dir}/${file.basename}`);
          }
        });
      }
      console.log(``);
      console.log(`Build finished.`);
    }
  },
};
