import { GenericContainer } from "testcontainers";

export const TEST_ELASTIC_MQ_IMAGE = "softwaremill/elasticmq-native:1.5.7";
export const TEST_ELASTIC_MQ_PORT = 9324;

export const elasticMQContainer = (): GenericContainer =>
  new GenericContainer(TEST_ELASTIC_MQ_IMAGE)
    .withCopyFilesToContainer([
      {
        source: "elasticmq.local.conf",
        target: "/opt/elasticmq.conf",
      },
    ])
    .withExposedPorts(TEST_ELASTIC_MQ_PORT);
