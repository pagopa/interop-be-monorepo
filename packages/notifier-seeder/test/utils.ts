/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { inject } from "vitest";
import { initQueueManager } from "../src/queue-manager/queueManager.js";

export const queueWriter = initQueueManager({
  queueUrl: inject("elasticMQConfig")!.queueUrl!,
  messageGroupId: "test-message-group-id",
  logLevel: "info",
});

export const nonExistingQueueUrl =
  inject("elasticMQConfig")!.queueUrl! + "nonexisting";
export const nonExistingQueueWriter = initQueueManager({
  queueUrl: nonExistingQueueUrl,
  messageGroupId: "test-message-group-id",
  logLevel: "info",
});
