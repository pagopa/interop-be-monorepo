import { CopyObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { genericLogger, initFileManager } from "pagopa-interop-commons";
import { afterAll, afterEach, describe, expect, it } from "vitest";

describe("file manager S3 copy", () => {
  const s3Mock = mockClient(S3Client);
  const fileManager = initFileManager({
    s3CustomServer: false,
    logLevel: "info",
  });
  afterEach(() => s3Mock.reset());
  afterAll(() => s3Mock.restore());

  it("encodes reserved characters in copy sources without changing destination keys", async () => {
    s3Mock.on(CopyObjectCommand).resolves({});
    const source = "documents/document #1?%.pdf";

    await fileManager.copy(
      "documents",
      source,
      "copies",
      "operation",
      source,
      genericLogger
    );

    expect(
      s3Mock.commandCalls(CopyObjectCommand)[0].args[0].input
    ).toMatchObject({
      CopySource: "documents/documents/document%20%231%3F%25.pdf",
      Key: "copies/operation/documents/document #1?%.pdf",
    });
  });
});
