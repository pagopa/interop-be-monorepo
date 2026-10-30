import { AssignerProtocol, Kafka, logLevel } from "kafkajs";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import {
  DASHBOARD_TIMING,
  KAFKA_CONSUMER_READINESS,
  LOCAL_LOOPBACK_HOSTS,
} from "../config/constants.js";

function isLocalBroker(value: string): boolean {
  try {
    const broker = new URL(
      `${KAFKA_CONSUMER_READINESS.brokerProtocol}//${value}`
    );
    return (
      LOCAL_LOOPBACK_HOSTS.includes(broker.hostname) &&
      Boolean(broker.port) &&
      !broker.username &&
      !broker.password &&
      !broker.pathname &&
      !broker.search &&
      !broker.hash
    );
  } catch {
    return false;
  }
}

function consumerConfig(environment: NodeJS.ProcessEnv): {
  groupId: string;
  clientId: string;
  brokers: string[];
} {
  const groupId = environment.KAFKA_GROUP_ID;
  const clientId = environment.KAFKA_CLIENT_ID;
  const brokers =
    environment.KAFKA_BROKERS?.split(",").map((value) => value.trim()) ?? [];
  if (
    !groupId?.trim() ||
    !clientId?.trim() ||
    !brokers.length ||
    !brokers.every(isLocalBroker) ||
    environment.KAFKA_DISABLE_AWS_IAM_AUTH !== "true" ||
    environment.KAFKA_BROKER_CONNECTION_STRING
  ) {
    throw new Error(
      "Kafka consumer readiness requires local loopback brokers and disabled AWS authentication"
    );
  }
  return { groupId, clientId, brokers };
}

export function prepareKafkaConsumerEnvironment(
  environment: NodeJS.ProcessEnv | undefined
): NodeJS.ProcessEnv | undefined {
  if (environment?.KAFKA_GROUP_ID === undefined) return environment;
  const { clientId } = consumerConfig(environment);
  return {
    ...environment,
    KAFKA_CLIENT_ID: `${clientId}-${randomUUID()}`,
    // Existing committed offsets still win. Fresh local groups must retain seed
    // events even if their first offset lookup happens after group assignment.
    TOPIC_STARTING_OFFSET: KAFKA_CONSUMER_READINESS.startingOffset,
  };
}

function hasAssignedPartitions(assignment: Buffer): boolean {
  try {
    const decoded = AssignerProtocol.MemberAssignment.decode(assignment);
    return (
      decoded !== null &&
      Object.values(decoded.assignment).some(
        (partitions) => partitions.length > 0
      )
    );
  } catch {
    return false;
  }
}

export async function waitForKafkaConsumer(
  environment: NodeJS.ProcessEnv | undefined,
  isRunning: () => boolean
): Promise<void> {
  if (environment?.KAFKA_GROUP_ID === undefined) return;
  const { groupId, clientId, brokers } = consumerConfig(environment);
  const kafka = new Kafka({
    clientId: `${clientId}${KAFKA_CONSUMER_READINESS.probeClientSuffix}`,
    brokers,
    logLevel: logLevel.NOTHING,
    retry: { retries: 0 },
    connectionTimeout: DASHBOARD_TIMING.readinessRequestTimeoutMs,
    requestTimeout: DASHBOARD_TIMING.readinessRequestTimeoutMs,
  });
  const admin = kafka.admin();
  const deadline = Date.now() + DASHBOARD_TIMING.readinessTimeoutMs;
  const assertRunning = (): void => {
    if (!isRunning())
      throw new Error(`Kafka consumer ${groupId} exited before becoming ready`);
  };
  try {
    while (Date.now() < deadline) {
      assertRunning();
      let ready = false;
      try {
        await admin.connect();
        const { groups } = await admin.describeGroups([groupId]);
        ready = groups.some(
          (group) =>
            group.groupId === groupId &&
            group.state === KAFKA_CONSUMER_READINESS.groupState &&
            group.protocolType === KAFKA_CONSUMER_READINESS.protocolType &&
            group.members.some(
              (member) =>
                member.clientId === clientId &&
                hasAssignedPartitions(member.memberAssignment)
            )
        );
      } catch {
        // The group coordinator may not be available while a consumer joins.
      }
      assertRunning();
      if (ready) return;
      await delay(DASHBOARD_TIMING.readinessIntervalMs);
    }
    throw new Error(`Kafka consumer ${groupId} readiness timed out`);
  } finally {
    await admin.disconnect();
  }
}
