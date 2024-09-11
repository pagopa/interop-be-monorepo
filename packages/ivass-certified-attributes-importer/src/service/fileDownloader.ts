import axios from "axios";
import * as zip from "@zip.js/zip.js";
import { FileManager, Logger } from "pagopa-interop-commons";

const unzipFile = async (zipBlob: Blob): Promise<Buffer> => {
  const entries = await new zip.ZipReader(
    new zip.BlobReader(zipBlob)
  ).getEntries({ filenameEncoding: "utf-8" });
  const csvEntries = entries.filter((entry) => entry.filename.endsWith(".csv"));

  if (csvEntries.length === 0) {
    throw new Error("The archive does not contain csv files");
  }

  if (csvEntries.length > 1) {
    throw new Error("The archive contains multiple csv files");
  }

  const entry = entries[0];

  if (!entry.getData) {
    throw new Error("Unexpected error: getData method is undefined");
  }

  const entryBlob: Blob = await entry.getData(new zip.BlobWriter());
  const arrayBuffer = await entryBlob.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

async function downloadFile(
  url: string
): Promise<{ filename: string; blob: Blob }> {
  /**
   * We need first to get the cookies from the first request;
   * When we call the url without the cookies, the server will make infinite redirects
   * until we reach the maxRedirects limit (?why?).
   *
   * So we need to make a first request (limiting the redirects) to get the cookies and then make another request with the cookies
   * set in the headers to get the file.
   */
  const redirectRes = await axios.get(url, {
    maxRedirects: 0,
    validateStatus(status) {
      return status >= 200 && status < 303;
    },
  });

  const CookieHeader = redirectRes.headers["set-cookie"]?.join("; ");

  const dataRes = await axios.get(url, {
    headers: {
      Cookie: CookieHeader,
    },
    responseType: "arraybuffer",
  });

  const filename = dataRes.headers["content-disposition"]
    .split("filename=")[1]
    .replace(/"/g, "");
  const blob = new Blob([dataRes.data], { type: "application/zip" });

  return {
    blob,
    filename,
  };
}

export const downloadCSV = async (
  sourceUrl: string,
  fileManager: FileManager,
  bucket: string,
  logger: Logger
): Promise<string> => {
  const { blob, filename } = await downloadFile(sourceUrl);

  const zipFile = Buffer.from(await blob.arrayBuffer());
  await fileManager.storeBytesByPath(
    bucket,
    `organizations/${filename}`,
    zipFile,
    logger
  );

  const unzippedFile = await unzipFile(blob);

  return unzippedFile.toString();
};
