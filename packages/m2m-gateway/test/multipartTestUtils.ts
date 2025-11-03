import request from "supertest";
import { expect } from "vitest";
import supertest from "supertest";
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
  { id, file, prettyName }: DownloadedDocument,
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
    `--${boundary}`,
    `Content-Disposition: form-data; name="id"`,
    ``,
    id,
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

export type TestMultipartFileUpload = {
  fileContent: Buffer;
  filename: string;
  contentType?: string;
  prettyName?: string;
};
export function addMultipartFileToSupertestRequest(
  req: supertest.Request,
  file: TestMultipartFileUpload
): supertest.Request {
  if (file.fileContent) {
    void req.attach("file", file.fileContent, {
      filename: file.filename,
      contentType: file.contentType,
    });
  }

  if (file.prettyName) {
    void req.field("prettyName", file.prettyName);
  }

  return req;
}

// After PR https://github.com/pagopa/interop-be-monorepo/pull/2586
// this function it's deprecated, too many flaky test:api occurs with its usages.
// We adopting direct usage of "expect.any(File)" in place of this function,
// until we find a properly solution.
export function fileFromTestMultipartFileUpload(
  file: TestMultipartFileUpload,
  date = new Date()
): File {
  return new File([file.fileContent], file.filename, {
    type: file.contentType,
    lastModified: date.getTime(),
  });
}
