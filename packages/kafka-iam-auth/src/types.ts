/**
 * Library-agnostic Kafka types compatible with both kafkajs and
 * @confluentinc/kafka-javascript KafkaJS compat layer.
 *
 * These types represent the structural intersection of both libraries'
 * type definitions, so that either implementation can satisfy them
 * without requiring `as any` casts in the facade.
 */

export type IHeaders = Record<
  string,
  Buffer | string | (Buffer | string)[] | undefined
>;

export type KafkaMessage = {
  key: Buffer | null;
  value: Buffer | null;
  timestamp: string;
  attributes: number;
  offset: string;
  size?: number;
  headers?: IHeaders;
};

export type EachMessagePayload = {
  topic: string;
  partition: number;
  message: KafkaMessage;
  heartbeat(): Promise<void>;
  pause(): () => void;
};

export type Batch = {
  topic: string;
  partition: number;
  highWatermark: string;
  messages: KafkaMessage[];
  isEmpty(): boolean;
  firstOffset(): string | null;
  lastOffset(): string;
  offsetLag(): string;
  offsetLagLow(): string;
};

/**
 * Intersection of kafkajs and Confluent EachBatchPayload.
 * - `uncommittedOffsets` is omitted (not available in Confluent)
 * - `commitOffsetsIfNecessary` takes no parameters (Confluent does not accept offsets)
 */
export type EachBatchPayload = {
  batch: Batch;
  resolveOffset(offset: string): void;
  heartbeat(): Promise<void>;
  pause(): () => void;
  commitOffsetsIfNecessary(): Promise<void>;
  isRunning(): boolean;
  isStale(): boolean;
};

export type Message = {
  key?: Buffer | string | null;
  value: Buffer | string | null;
  partition?: number;
  headers?: IHeaders;
  timestamp?: string;
};

export type ProducerRecord = {
  topic: string;
  messages: Message[];
};

export type RecordMetadata = {
  topicName: string;
  partition: number;
  errorCode: number;
  offset?: string;
  timestamp?: string;
  baseOffset?: string;
  logAppendTime?: string;
  logStartOffset?: string;
};

export type Transaction = {
  send(record: ProducerRecord): Promise<RecordMetadata[]>;
  commit(): Promise<void>;
  abort(): Promise<void>;
};

export type Producer = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(record: ProducerRecord): Promise<RecordMetadata[]>;
  transaction(): Promise<Transaction>;
};
