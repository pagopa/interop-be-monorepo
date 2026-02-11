import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import { openApiDocument as notificationConfigDocument } from "./notificationConfigApi.js";

// eslint-disable-next-line no-underscore-dangle
const currentDir = path.dirname(fileURLToPath(import.meta.url));

const documents = [
  {
    document: notificationConfigDocument,
    outputFile: "notificationConfigApi.yml",
  },
];

for (const { document, outputFile } of documents) {
  const outputPath = path.resolve(currentDir, "../open-api", outputFile);
  fs.writeFileSync(
    outputPath,
    YAML.stringify(document, { aliasDuplicateObjects: false, lineWidth: 0 })
  );
  // eslint-disable-next-line no-console
  console.log(`Generated ${outputFile}`);
}
