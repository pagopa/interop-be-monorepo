import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";
import { zodiosRouter } from "@zodios/express";
import Mustache from "mustache";
import { api } from "../model/generated/api.js";
import { logger } from "pagopa-interop-commons";

const testPdfGenRouter = zodiosRouter(api.api);

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const data = {
  todayDate: new Date(),
  todayTime: new Date(),
  agreementId: "123456789",
  consumerText: "Consumer test",
  submitter: "Submitter test",
  eServiceName: "eService test",
  producerText: "Producer test",
  submissionDate: new Date(),
  submissionTime: new Date(),
  activationDate: new Date(),
  activationTime: new Date(),
  activator: "Activator test",
  declaredAttributes: [
    {
      date: new Date(),
      time: new Date(),
      clientAttributeName: "Client attribute name test 1",
    },
    {
      date: new Date(),
      time: new Date(),
      clientAttributeName: "Client attribute name test 2",
    },
    {
      date: new Date(),
      time: new Date(),
      clientAttributeName: "Client attribute name test 3",
    },
  ],
  verifiedAttributes: [
    {
      date: new Date(),
      time: new Date(),
      clientAttributeName: "Client attribute name test 1",
    },
    {
      date: new Date(),
      time: new Date(),
      clientAttributeName: "Client attribute name test 2",
    },
    {
      date: new Date(),
      time: new Date(),
      clientAttributeName: "Client attribute name test 3",
    },
  ],
  certifiedAttributes: [
    {
      date: new Date(),
      time: new Date(),
      clientAttributeName: "Client attribute name test 1",
    },
    {
      date: new Date(),
      time: new Date(),
      clientAttributeName: "Client attribute name test 2",
    },
    {
      date: new Date(),
      time: new Date(),
      clientAttributeName: "Client attribute name test 3",
    },
  ],
};

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
  const renderedContent = Mustache.render(content, data);
  fs.writeFileSync(outHtmlPath, renderedContent);

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
