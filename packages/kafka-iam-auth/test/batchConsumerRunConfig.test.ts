/* eslint-disable functional/immutable-data */
import {
  EachBatchPayload,
  KafkaJSNonRetriableError,
  KafkaJSProtocolError,
} from "kafkajs";
import { InternalError } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { makeBatchConsumerRunConfig } from "../src/index.js";

// These tests pin the offset-commit contract of the batch consumer:
// - the commit is explicit and runs after the handler
// - a handler error blocks resolve and commit
// - a rebalance-typed commit error keeps its kafkajs identity, so the
//   kafkajs runner can rejoin the group instead of crashing the process
// - every other commit error becomes non-retriable, so the consumer
//   stops before it processes further uncommitted batches

const protocolError = (type: string): KafkaJSProtocolError => {
  const error = new KafkaJSProtocolError(`test ${type} error`);
  // The constructor copies type only from an Error cause.
  // A string cause leaves it undefined, so the test sets it directly.
  (error as { type: string }).type = type;
  return error;
};

const uncommitted = {
  topics: [
    { topic: "test-topic", partitions: [{ partition: 0, offset: "42" }] },
  ],
};

const makePayload = (
  overrides: Partial<Record<"commitError", unknown>> = {}
): {
  payload: EachBatchPayload;
  callOrder: string[];
  resolveOffset: ReturnType<typeof vi.fn>;
  commitOffsetsIfNecessary: ReturnType<typeof vi.fn>;
} => {
  const callOrder: string[] = [];
  const resolveOffset = vi.fn(() => {
    callOrder.push("resolveOffset");
  });
  const commitOffsetsIfNecessary = vi.fn(async () => {
    callOrder.push("commit");
    if (overrides.commitError !== undefined) {
      throw overrides.commitError;
    }
  });
  const payload = {
    batch: {
      topic: "test-topic",
      partition: 0,
      lastOffset: (): string => "41",
      messages: [],
    },
    resolveOffset,
    commitOffsetsIfNecessary,
    uncommittedOffsets: () => uncommitted,
    heartbeat: async (): Promise<void> => undefined,
    isRunning: (): boolean => true,
    isStale: (): boolean => false,
    pause: (): (() => void) => () => undefined,
  } as unknown as EachBatchPayload;
  return { payload, callOrder, resolveOffset, commitOffsetsIfNecessary };
};

const runEachBatch = async (
  payload: EachBatchPayload,
  handler: (p: EachBatchPayload) => Promise<void> = async () => undefined
): Promise<void> => {
  const runConfig = makeBatchConsumerRunConfig(handler, "test-service");
  expect(runConfig.autoCommit).toBe(false);
  expect(runConfig.eachBatchAutoResolve).toBe(false);
  expect(runConfig.eachBatch).toBeDefined();
  await runConfig.eachBatch!(payload);
};

describe("makeBatchConsumerRunConfig", () => {
  it("runs handler, resolves the last offset, then commits all uncommitted offsets", async () => {
    const { payload, callOrder, resolveOffset, commitOffsetsIfNecessary } =
      makePayload();
    const handler = vi.fn(async () => {
      callOrder.push("handler");
    });

    await runEachBatch(payload, handler);

    expect(handler).toHaveBeenCalledOnce();
    expect(resolveOffset).toHaveBeenCalledExactlyOnceWith("41");
    expect(commitOffsetsIfNecessary).toHaveBeenCalledExactlyOnceWith(
      uncommitted
    );
    expect(callOrder).toEqual(["handler", "resolveOffset", "commit"]);
  });

  it("wraps a handler error and neither resolves nor commits", async () => {
    const { payload, resolveOffset, commitOffsetsIfNecessary } = makePayload();
    const handlerError = new Error("handler failed");

    const thrown = await runEachBatch(payload, async () => {
      throw handlerError;
    }).then(
      () => undefined,
      (e) => e
    );

    expect(thrown).toBeInstanceOf(InternalError);
    expect((thrown as InternalError<string>).code).toBe(
      "kafkaMessageProcessError"
    );
    expect(resolveOffset).not.toHaveBeenCalled();
    expect(commitOffsetsIfNecessary).not.toHaveBeenCalled();
  });

  it.each([
    "REBALANCE_IN_PROGRESS",
    "NOT_COORDINATOR_FOR_GROUP",
    "ILLEGAL_GENERATION",
    "UNKNOWN_MEMBER_ID",
  ])("rethrows a %s commit error unchanged", async (type) => {
    const commitError = protocolError(type);
    const { payload } = makePayload({ commitError });

    const thrown = await runEachBatch(payload).then(
      () => undefined,
      (e) => e
    );

    // The identical reference proves that the kafkajs runner still sees
    // the original error type and takes its group-rejoin path.
    expect(thrown).toBe(commitError);
  });

  it("turns a generic commit error into a non-retriable error", async () => {
    const commitError = new Error("socket closed");
    const { payload } = makePayload({ commitError });

    const thrown = await runEachBatch(payload).then(
      () => undefined,
      (e) => e
    );

    expect(thrown).toBeInstanceOf(KafkaJSNonRetriableError);
    expect((thrown as KafkaJSNonRetriableError).retriable).toBe(false);
    expect((thrown as KafkaJSNonRetriableError).message).toContain(
      "Error: socket closed"
    );
  });

  it("turns a non-rebalance protocol commit error into a non-retriable error", async () => {
    const commitError = protocolError("GROUP_COORDINATOR_NOT_AVAILABLE");
    const { payload } = makePayload({ commitError });

    const thrown = await runEachBatch(payload).then(
      () => undefined,
      (e) => e
    );

    expect(thrown).toBeInstanceOf(KafkaJSNonRetriableError);
    expect((thrown as KafkaJSNonRetriableError).retriable).toBe(false);
  });
});
