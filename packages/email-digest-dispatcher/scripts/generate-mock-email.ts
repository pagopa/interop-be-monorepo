import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildHTMLTemplateService } from "pagopa-interop-commons";
import { digestTemplateServiceBuilder } from "../src/services/templateService.js";
import {
  getMockTenantDigestData,
  getMockPartialDigestData,
} from "../test/mockUtils.js";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const outputDir = path.join(dirname, "../output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const htmlTemplateService = buildHTMLTemplateService();
const digestTemplateService = digestTemplateServiceBuilder(htmlTemplateService);

// Generate full data email
const fullData = getMockTenantDigestData();
const fullHtml = digestTemplateService.compileDigestEmail(fullData);
const fullOutputPath = path.join(outputDir, "mock-digest-email.html");
fs.writeFileSync(fullOutputPath, fullHtml);

// Generate partial data email (only E-services and Attributes)
const partialData = getMockPartialDigestData();
const partialHtml = digestTemplateService.compileDigestEmail(partialData);
const partialOutputPath = path.join(
  outputDir,
  "mock-digest-email-partial.html"
);
fs.writeFileSync(partialOutputPath, partialHtml);

/* eslint-disable no-console */
console.log(`✅ Mock digest emails generated successfully!`);
console.log(`\n📧 Output files:`);
console.log(`   - ${fullOutputPath} (all sections)`);
console.log(`   - ${partialOutputPath} (only E-services and Attributes)`);
console.log(`\nYou can open them in your browser to preview the emails.`);
/* eslint-enable no-console */
