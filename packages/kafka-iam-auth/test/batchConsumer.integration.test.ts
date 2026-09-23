/* eslint-disable functional/immutable-data */
import { randomUUID } from "crypto";
import { Admin, Consumer } from "kafkajs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { runBatchConsumer } from "../src/index.js";
import {
  allOffsetsCommitted,
  batchConfig,
  consumerConfig,
  createTopic,
  produceMessages,
  testKafka,
  waitFor,
} from "./utils.js";

// These tests run against a real Kafka broker. They pin the behavior that
// the production incident PIN-7461 depends on: the consumer commits the
// offsets of every batch, a restart does not replay committed messages,
// and a group rebalance does not stop the consumption.

describe("runBatchConsumer against a real broker", () => {
  let admin: Admin;
  let consumers: Consumer[];

  beforeAll(async () => {
    admin = testKafka.admin();
    await admin.connect();
  });

  afterAll(async () => {
    await admin.disconnect();
  });

  afterEach(async () => {
    await Promise.all(consumers.map((c) => c.disconnect()));
  });

  const values = (prefix: string, count: number): string[] =>
    Array.from({ length: count }, (_, i) => `${prefix}-${i}`);

  it("processes batches and commits the offsets of each batch", async () => {
    consumers = [];
    const topic = `topic-${randomUUID()}`;
    const groupId = `group-${randomUUID()}`;
    await createTopic(admin, topic, 3);

    const produced = values("commit", 30);
    await produceMessages(topic, produced);

    const received: string[] = [];
    consumers.push(
      await runBatchConsumer(
        consumerConfig(groupId),
        batchConfig,
        [topic],
        async ({ batch }) => {
          batch.messages.forEach((m) => received.push(String(m.value)));
        },
        "test-service"
      )
    );

    await waitFor(() => received.length >= produced.length, "all messages");
    expect(new Set(received)).toEqual(new Set(produced));

    await waitFor(
      () => allOffsetsCommitted(admin, groupId, topic),
      "committed offsets equal to the high watermarks"
    );
  });

  it("does not redeliver committed messages to a new consumer of the group", async () => {
    consumers = [];
    const topic = `topic-${randomUUID()}`;
    const groupId = `group-${randomUUID()}`;
    await createTopic(admin, topic, 3);

    const firstRound = values("old", 10);
    await produceMessages(topic, firstRound);

    const receivedA: string[] = [];
    const consumerA = await runBatchConsumer(
      consumerConfig(groupId),
      batchConfig,
      [topic],
      async ({ batch }) => {
        batch.messages.forEach((m) => receivedA.push(String(m.value)));
      },
      "test-service"
    );
    consumers.push(consumerA);

    await waitFor(() => receivedA.length >= firstRound.length, "first round");
    await waitFor(
      () => allOffsetsCommitted(admin, groupId, topic),
      "first round committed"
    );
    await consumerA.disconnect();

    const secondRound = values("new", 5);
    await produceMessages(topic, secondRound);

    const receivedB: string[] = [];
    consumers.push(
      await runBatchConsumer(
        consumerConfig(groupId),
        batchConfig,
        [topic],
        async ({ batch }) => {
          batch.messages.forEach((m) => receivedB.push(String(m.value)));
        },
        "test-service"
      )
    );

    await waitFor(() => receivedB.length >= secondRound.length, "second round");
    await waitFor(
      () => allOffsetsCommitted(admin, groupId, topic),
      "second round committed"
    );
    // A grace period catches a late replay of the first round.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(new Set(receivedB)).toEqual(new Set(secondRound));
    expect(receivedB).toHaveLength(secondRound.length);
  });

  it("redelivers a batch after a handler error, with no message loss", async () => {
    consumers = [];
    const topic = `topic-${randomUUID()}`;
    const groupId = `group-${randomUUID()}`;
    await createTopic(admin, topic, 1);

    const produced = values("retry", 10);
    await produceMessages(topic, produced);

    const received: string[] = [];
    let invocations = 0;
    consumers.push(
      await runBatchConsumer(
        consumerConfig(groupId),
        batchConfig,
        [topic],
        async ({ batch }) => {
          invocations += 1;
          if (invocations === 1) {
            throw new Error("simulated handler failure");
          }
          batch.messages.forEach((m) => received.push(String(m.value)));
        },
        "test-service"
      )
    );

    // The handler error blocks resolve and commit, so kafkajs fetches the
    // same batch again from the unchanged position.
    await waitFor(
      () => new Set(received).size >= produced.length,
      "all messages after redelivery"
    );
    expect(invocations).toBeGreaterThanOrEqual(2);
    expect(new Set(received)).toEqual(new Set(produced));

    await waitFor(
      () => allOffsetsCommitted(admin, groupId, topic),
      "offsets committed after redelivery"
    );
  });

  it("survives a group rebalance and continues to process and commit", async () => {
    consumers = [];
    const topic = `topic-${randomUUID()}`;
    const groupId = `group-${randomUUID()}`;
    await createTopic(admin, topic, 6);

    const firstRound = values("before-rebalance", 20);
    await produceMessages(topic, firstRound);

    const received: string[] = [];
    const handler =
      () =>
      async ({ batch }: { batch: { messages: Array<{ value: unknown }> } }) => {
        batch.messages.forEach((m) => received.push(String(m.value)));
      };

    consumers.push(
      await runBatchConsumer(
        consumerConfig(groupId),
        batchConfig,
        [topic],
        handler(),
        "test-service-a"
      )
    );
    await waitFor(() => received.length > 0, "consumption before rebalance");

    // A second member forces a rebalance of the running group.
    consumers.push(
      await runBatchConsumer(
        consumerConfig(groupId),
        batchConfig,
        [topic],
        handler(),
        "test-service-b"
      )
    );
    await waitFor(async () => {
      const { groups } = await admin.describeGroups([groupId]);
      return groups[0]?.members.length === 2 && groups[0]?.state === "Stable";
    }, "stable group with two members");

    const secondRound = values("after-rebalance", 20);
    await produceMessages(topic, secondRound);

    const all = new Set([...firstRound, ...secondRound]);
    // At-least-once semantics: a batch in flight during the rebalance can
    // arrive twice, so the assertion checks coverage, not count.
    await waitFor(
      () => new Set(received).size >= all.size,
      "full coverage across the rebalance"
    );
    expect(new Set(received)).toEqual(all);

    await waitFor(
      () => allOffsetsCommitted(admin, groupId, topic),
      "offsets committed after the rebalance"
    );
  });
});
