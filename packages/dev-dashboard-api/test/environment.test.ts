import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { KMSClient, GetPublicKeyCommand } from "@aws-sdk/client-kms";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { SESv2Client, GetAccountCommand } from "@aws-sdk/client-sesv2";
import { SQSClient, GetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { localEnvironment } from "../src/services/environmentService.js";

const root = fileURLToPath(new URL("../../..", import.meta.url));
afterEach(() => vi.unstubAllEnvs());
describe("local package environment", () => {
  it("verifies the installed default SDK clients resolve the dashboard environment to loopback without making a request", async () => {
    const env = await localEnvironment(
      root,
      "pagopa-interop-authorization-server"
    );
    expect(env).toMatchObject({
      AWS_ACCESS_KEY_ID: "testawskey",
      AWS_SECRET_ACCESS_KEY: "testawssecret",
    });
    for (const [key, value] of Object.entries(env))
      if (value) vi.stubEnv(key, value);
    const endpoints: string[] = [];
    const requestHandler = {
      handle: async (request: {
        hostname: string;
        port?: number;
        headers: Record<string, string>;
      }) => {
        endpoints.push(`${request.hostname}:${request.port}`);
        expect(request.headers.authorization).toContain(
          "Credential=testawskey/"
        );
        throw new Error("Captured locally before transport");
      },
    };
    const dynamodb = new DynamoDBClient({ requestHandler, maxAttempts: 1 });
    const kms = new KMSClient({ requestHandler, maxAttempts: 1 });
    const s3 = new S3Client({
      requestHandler,
      maxAttempts: 1,
      forcePathStyle: true,
    });
    const sqs = new SQSClient({ requestHandler, maxAttempts: 1 });
    const ses = new SESv2Client({ requestHandler, maxAttempts: 1 });
    try {
      await expect(
        dynamodb.send(
          new DescribeTableCommand({ TableName: "platform-states" })
        )
      ).rejects.toThrow("Captured locally before transport");
      await expect(
        kms.send(new GetPublicKeyCommand({ KeyId: "local-key" }))
      ).rejects.toThrow("Captured locally before transport");
      await expect(
        s3.send(new HeadBucketCommand({ Bucket: "local-bucket" }))
      ).rejects.toThrow("Captured locally before transport");
      await expect(
        sqs.send(
          new GetQueueAttributesCommand({
            QueueUrl: "http://localhost:9324/000000000000/sqsLocalQueue.fifo",
          })
        )
      ).rejects.toThrow("Captured locally before transport");
      await expect(ses.send(new GetAccountCommand({}))).rejects.toThrow(
        "Captured locally before transport"
      );
      expect(endpoints).toEqual([
        "localhost:8085",
        "localhost:4566",
        "localhost:9000",
        "localhost:9324",
        "localhost:8005",
      ]);
    } finally {
      dynamodb.destroy();
      kms.destroy();
      s3.destroy();
      sqs.destroy();
      ses.destroy();
    }
  });
});
