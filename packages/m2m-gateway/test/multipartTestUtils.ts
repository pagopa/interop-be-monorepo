import request from "supertest";
import { expect } from "vitest";
import { DownloadedDocument } from "../src/utils/fileDownload.js";

export function testMultipartResponseParser(
  res: request.Response,
  done: (err: Error | null, res?: request.Response) => void
) {
  const chunks: Buffer[] = [];
  res.on("data", (c: Buffer) => chunks.push(c));
  res.once("end", function () {
    const buf = Buffer.concat(chunks);
    res.text = buf.toString("utf8");
    done(null, res);
  });
  res.once("error", done);
}

export async function testExpectedMultipartResponse(
  { file, prettyName }: DownloadedDocument,
  res: request.Response
) {
  const content = await file.text();
  expect(res.headers["content-type"]).toMatch(
    /^multipart\/form-data;\s*boundary=form-data-encoder-[A-Za-z0-9]+/
  );
  const boundary = res.headers["content-type"].match(/boundary=(.*)$/)![1];

  const CRLF = "\r\n";
  const expectedMultipart = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${file.name}"`,
    `Content-Type: ${file.type}`,
    ``,
    content,
    `--${boundary}`,
    `Content-Disposition: form-data; name="filename"`,
    ``,
    file.name,
    `--${boundary}`,
    `Content-Disposition: form-data; name="contentType"`,
    ``,
    file.type,
    ...(prettyName
      ? [
          `--${boundary}`,
          `Content-Disposition: form-data; name="prettyName"`,
          ``,
          prettyName,
        ]
      : []),
    `--${boundary}--`,
    CRLF,
  ].join(CRLF);

  expect(res.text).toEqual(expectedMultipart);
  expect(res.headers["content-length"]).toBe(
    Buffer.byteLength(expectedMultipart, "utf8").toString()
  );
}
