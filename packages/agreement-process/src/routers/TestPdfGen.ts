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
  const localFilePath = "file://" + path.resolve(dirname, "template3.html");

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  await page.goto(localFilePath, {
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

  fs.writeFileSync("test.pdf", buffer);

  res.status(200).end();
});

export default testPdfGenRouter;
