/*const fs = require("fs");

const numberStrings = [`0`, `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`];
const rootPath = `../material-design-icons/png`;
const fileNames = fs.readdirSync(rootPath);
const allIconNames = [];
for (const i in fileNames) {
  const dirPath = `${rootPath}/${fileNames[i]}`;
  const iconNamesInDir = fs.readdirSync(dirPath);
  for (const j in iconNamesInDir) {
    if (numberStrings.includes(iconNamesInDir[j][0])) {
      iconNamesInDir[j] = `i_${iconNamesInDir[j]}`;
    }
  }
  allIconNames.push(...iconNamesInDir);
}
fs.writeFileSync(`test.txt`, JSON.stringify(allIconNames, null, 2));
*/
