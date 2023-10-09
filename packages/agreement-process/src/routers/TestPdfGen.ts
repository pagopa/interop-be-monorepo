import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";
import { zodiosRouter } from "@zodios/express";
import { api } from "../model/generated/api.js";

const testPdfGenRouter = zodiosRouter(api.api);

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

testPdfGenRouter.get("/generatePDF", async (_, res) => {
  const outHtmlPath = path.resolve(dirname, "..", "templates", "test.html");
  const outPdfPath = path.resolve(dirname, "test.pdf");
  const templateFilePath = path.resolve(
    dirname,
    "..",
    "templates",
    "template.html"
  );
  const cssFilePath = path.resolve(dirname, "..", "templates", "style.css");

  const template = fs.readFileSync(templateFilePath, "utf-8");
  const css = fs.readFileSync(cssFilePath, "utf-8");

  const content = template.replace(
    '<link rel="stylesheet" href="style.css" />',
    `<style>${css}</style><script src="paged.polyfill.js"></script>`
  );
  fs.writeFileSync(outHtmlPath, content);

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  await page.goto(`file://${outHtmlPath}`, {
    waitUntil: "networkidle0", // Wait until network is idle
  });

  const buffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      left: "0px",
      top: "0px",
      right: "0px",
      bottom: "0px",
    },
  });

  await browser.close();

  fs.writeFileSync(outPdfPath, buffer);

  res.status(200).end();
});

export default testPdfGenRouter;
