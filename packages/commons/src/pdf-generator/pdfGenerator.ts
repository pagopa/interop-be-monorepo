/* eslint-disable functional/no-let */
import path from "path";
import { fileURLToPath } from "url";
import { pdfGenerationError } from "pagopa-interop-models";
import puppeteer, { Browser } from "puppeteer";
import { buildHTMLTemplateService } from "../index.js";

export interface PDFGenerator {
  generate: (
    templatePath: string,
    context: Record<string, string>
  ) => Promise<Buffer>;
}

export async function initPDFGenerator(): Promise<PDFGenerator> {
  const templateService = buildHTMLTemplateService();
  let browserInstance = await puppeteer.launch({
    /* NOTE 
      those configurations allow link (file://) usages for 
      resources files in template's folder
    */
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--allow-file-access-from-files",
      "--enable-local-file-accesses",
    ],
  });

  const getBrowser = async (): Promise<Browser> => {
    if (browserInstance?.connected) {
      return browserInstance;
    } else {
      browserInstance = await puppeteer.launch();
      return browserInstance;
    }
  };

  // During unexpected browser crash restarts browser handling "disconnected" event
  browserInstance.on("disconnected", async () => {
    browserInstance = await puppeteer.launch();
  });

  return {
    generate: async (
      templatePath: string,
      context: Record<string, string>
    ): Promise<Buffer> => {
      const filename = fileURLToPath(import.meta.url);
      const dirname = path.dirname(filename);
      const polyfillFilePath = path.resolve(dirname, "paged.polyfill.js");

      let page: puppeteer.Page | undefined;

      try {
        const browser = await getBrowser();
        page = await browser.newPage();
        await page.goto(`file://${templatePath}`);

        // Injecting polyfill paged.js to current html and set in the page
        const pageContent = await page.content();
        const htmlCompiled = templateService.compileHtml(pageContent, {
          ...context,
          "paged-pdf-polyfill": `<script src="file://${polyfillFilePath}"></script>`,
        });
        await page.setContent(htmlCompiled, { waitUntil: "networkidle2" });

        return await page.pdf({
          format: "A4",
          printBackground: true,
          margin: {
            left: "0px",
            top: "0px",
            right: "0px",
            bottom: "0px",
          },
        });
      } catch (error) {
        throw pdfGenerationError(error);
      } finally {
        await page?.close();
      }
    },
  };
}
