import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";

const s3 = new S3Client({ region: config.awsRegion });

export async function persistToS3(
  payload: { id: string },
  logger: Logger
): Promise<void> {
  const key = `signed-objects/${Date.now()}-${payload.id}.json`;

  await s3.send(
    new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: JSON.stringify(payload),
      ContentType: "application/json",
    })
  );

  logger.debug(`Persisted object with id ${payload.id} to S3 key "${key}"`);
}
