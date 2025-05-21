/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  CorrelationId,
  generateId,
  SpanId,
  ApplicationAuditPhase,
} from "pagopa-interop-models";

import { afterAll, beforeAll } from "vitest";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { QueueManager, initQueueManager } from "pagopa-interop-commons";
import { ApplicationAuditEvent } from "../src/models/application-audit.js";

export const getMockBeginRequestAudit: ApplicationAuditEvent = {
  spanId: generateId<SpanId>(),
  correlationId: generateId<CorrelationId>(),
  service: "mockService",
  serviceVersion: "1.0",
  endpoint: "/mock-endpoint",
  httpMethod: "GET",
  requesterIpAddress: "192.168.1.100",
  nodeIp: "127.0.0.1",
  podName: "mock-pod",
  uptimeSeconds: 100,
  timestamp: Date.now(),
  amazonTraceId: generateId(),
  phase: ApplicationAuditPhase.BEGIN_REQUEST,
};

/* The ElasticMQ test container is setup here and not in the commons-test
global setup because it is used only in this test suite and the queueManager
is not a generic common component.
In case an SQS queue manager is needed in other services, the queue manager
and the ElasticMQ test container setup should be moved
to commons and commons-test respectively.
*/
const TEST_ELASTIC_MQ_IMAGE = "softwaremill/elasticmq-native:1.5.7";
const TEST_ELASTIC_MQ_PORT = 9324;

const elasticMQContainer = (): GenericContainer =>
  new GenericContainer(TEST_ELASTIC_MQ_IMAGE)
    .withCopyFilesToContainer([
      {
        source: "elasticmq.local.conf",
        target: "/opt/elasticmq.conf",
      },
    ])
    .withExposedPorts(TEST_ELASTIC_MQ_PORT);

let startedElasticMQContainer: StartedTestContainer;
export let producerQueueUrl: string;
export let nonExistingQueueUrl: string;
export let queueWriter: QueueManager;
export let nonExistingQueueWriter: QueueManager;

beforeAll(async () => {
  startedElasticMQContainer = await elasticMQContainer().start();

  producerQueueUrl = `http://localhost:${startedElasticMQContainer.getMappedPort(
    TEST_ELASTIC_MQ_PORT
  )}/000000000000/sqsLocalQueue.fifo`;

  queueWriter = initQueueManager({
    messageGroupId: "test-message-group-id",
    logLevel: "info",
  });

  nonExistingQueueUrl = `http://localhost:${startedElasticMQContainer.getMappedPort(
    TEST_ELASTIC_MQ_PORT
  )}/000000000000/nonExistingQueue`;

  nonExistingQueueWriter = initQueueManager({
    messageGroupId: "test-message-group-id",
    logLevel: "info",
  });
});

afterAll(async () => {
  await startedElasticMQContainer.stop();
});
