import { launchPuppeteerBrowser } from "pagopa-interop-commons";
import puppeteer from "puppeteer";

export async function pdfScreenshot(pdfContent: Uint8Array): Promise<Buffer> {
  // eslint-disable-next-line functional/no-let
  let page: puppeteer.Page | undefined;

  try {
    const browser = await launchPuppeteerBrowser();
    page = await browser.newPage();
    const pdfBase64 = Buffer.from(pdfContent).toString("base64");

    const html = `
        <!DOCTYPE html>
        <html>
            <head>
                <style>
                    html, body {
                        margin: 0;
                        padding: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        background-color: white;
                        overflow: hidden;
                    }
                    embed {
                        display: block;
                        width: 100vw;
                        height: 100vh;
                        border: none;
                    }
                </style>
            </head>
            <body>
                <embed src="data:application/pdf;base64,${pdfBase64}" type="application/pdf" />
            </body>
        </html>`;

    await page.setContent(html, {
      waitUntil: "networkidle2",
    });

    await page.waitForSelector("embed", { visible: true });

    return await page.screenshot({
      type: "png",
      fullPage: true,
    });
  } catch (error) {
    throw Error(`Error generating PDF screenshot: ${error}`);
  } finally {
    await page?.close();
  }
}
