/* eslint-disable functional/no-let */
import path from "path";
import { fileURLToPath } from "url";
import {
  pdfGenerationError,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
} from "pagopa-interop-models";
import puppeteer, { Browser } from "puppeteer";
import { buildHTMLTemplateService } from "../templating/htmlTemplateService.js";

export interface PDFGenerator {
  generate: (
    templatePath: string,
    context: Record<string, unknown>
  ) => Promise<Buffer>;
}

/* Function to launch puppeteer for testing
with the same params used in production, but allowing to set
pipe option to true. Pipe true allows test suites to run
without spawning a new browser instance for each test. */
export const launchPuppeteerBrowser = (
  options: { pipe: boolean } = { pipe: false }
): Promise<Browser> =>
  puppeteer.launch({
    ...options,
    /* the following args allow file:// usages for
    resources files in template's folder */
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--allow-file-access-from-files",
      "--enable-local-file-accesses",
    ],
  });

export async function initPDFGenerator(): Promise<PDFGenerator> {
  const templateService = buildHTMLTemplateService();
  let browserInstance = await launchPuppeteerBrowser();

  const getBrowser = async (): Promise<Browser> => {
    if (browserInstance?.connected) {
      return browserInstance;
    } else {
      browserInstance = await launchPuppeteerBrowser();
      return browserInstance;
    }
  };

  // During unexpected browser crash restarts browser handling "disconnected" event
  browserInstance.on("disconnected", async () => {
    browserInstance = await launchPuppeteerBrowser();
  });

  return {
    generate: async (
      templatePath: string,
      context: Record<string, unknown>
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
        await page.setContent(htmlCompiled, {
          waitUntil: "networkidle2",
        });

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

export const getIpaCode = (tenant: Tenant): string | undefined =>
  tenant.externalId.origin === PUBLIC_ADMINISTRATIONS_IDENTIFIER
    ? tenant.externalId.value
    : undefined;
