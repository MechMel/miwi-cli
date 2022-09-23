const fs = require("fs");
const path = require("path");
const { rmdirContents, replaceAll, scanDir } = require("./utils/utils");

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
      let scriptsText = ``;
      // Miwi files must be added first in the correct order
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
      for (const file of miwiFiles) {
        scriptsText += `<script src="/${file}"></script>`;
      }
      for (const file of allScripts.sort()) {
        if (!miwiFiles.includes(file)) {
          scriptsText += `<script src="/${file}"></script>`;
        }
      }
      fs.writeFileSync(
        path.resolve(outDir, `index.html`),
        fs
          .readFileSync(`${__dirname}/templates/index.html`)
          .toString()
          .replace("${scripts}", scriptsText),
      );
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
                  sourcemap: true,
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
                // We currently don't copy unsupported file formats. We might or migth not want to change this in future
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
      const files = scanDir(inDir);
      files.map((file) => {
        if (!dirBlackList.includes(file.basename)) {
          buildOneFile(file.isDir ? `addDir` : `add`, file.path, undefined);
        }
      });
      console.log(``);
      console.log(`Build finished.`);
    }
  },
};
