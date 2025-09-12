import { Message } from "@aws-sdk/client-sqs";

export const buildFakeSQSEvent = (
  key: string,
  bucket = "test-bucket",
  messageId = "test-message"
): Message =>
  ({
    MessageId: messageId,
    Body: JSON.stringify({
      Records: [
        {
          s3: {
            bucket: { name: bucket },
            object: { key },
          },
        },
      ],
    }),
  } as Message);
