import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildHTMLTemplateService } from "pagopa-interop-commons";
import { digestTemplateServiceBuilder } from "../src/services/templateService.js";
import { getMockTenantDigestData } from "../test/mockUtils.js";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const outputDir = path.join(dirname, "../output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const htmlTemplateService = buildHTMLTemplateService();
const digestTemplateService = digestTemplateServiceBuilder(htmlTemplateService);

const mockData = getMockTenantDigestData();

const compiledHtml = digestTemplateService.compileDigestEmail(mockData);

const outputPath = path.join(outputDir, "mock-digest-email.html");
fs.writeFileSync(outputPath, compiledHtml);

console.log(`✅ Mock digest email generated successfully!`);
console.log(`📧 Output file: ${outputPath}`);
console.log(`\nYou can open it in your browser to preview the email.`);
