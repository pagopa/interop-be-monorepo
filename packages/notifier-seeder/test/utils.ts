/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { afterAll, beforeAll } from "vitest";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import {
  QueueManager,
  initQueueManager,
} from "../src/queue-manager/queueManager.js";

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
let queueUrl: string;
export let nonExistingQueueUrl: string;
export let queueWriter: QueueManager;
export let nonExistingQueueWriter: QueueManager;

beforeAll(async () => {
  startedElasticMQContainer = await elasticMQContainer().start();

  queueUrl = `http://localhost:${startedElasticMQContainer.getMappedPort(
    TEST_ELASTIC_MQ_PORT
  )}/000000000000/sqsLocalQueue.fifo`;

  queueWriter = initQueueManager({
    queueUrl,
    messageGroupId: "test-message-group-id",
    logLevel: "info",
  });

  nonExistingQueueUrl = `http://localhost:${startedElasticMQContainer.getMappedPort(
    TEST_ELASTIC_MQ_PORT
  )}/000000000000/nonExistingQueue`;

  nonExistingQueueWriter = initQueueManager({
    queueUrl: nonExistingQueueUrl,
    messageGroupId: "test-message-group-id",
    logLevel: "info",
  });
});

afterAll(async () => {
  await startedElasticMQContainer.stop();
});
