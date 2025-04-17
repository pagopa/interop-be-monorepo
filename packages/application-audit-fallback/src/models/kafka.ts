export interface KafkaProducer {
  send: (params: {
    messages: Array<{ key: string; value: string }>;
  }) => Promise<void>;
}
