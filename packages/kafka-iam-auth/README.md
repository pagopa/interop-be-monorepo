# Description

This package run consumer and handles AWS IAM authentication for Kafka topic consumed by consumer's services, it creates a SASL configuration valid for KafakaJS authetication mechanism.

## Usages

To run an authenticated consumer, you need to provide three parameters:

- **Consumer's Config**: Contains all environment variables defined for the current consumer. You can get it with `const config = consumerConfig();`

- **Topic Name**: The target topic for the consumer. It usually has a name like "event-store.{schema}.{table}".

- **Message Handler**: A function that processes messages and contains business logic. The function signature should be `(message: KafkaMessage) => Promise<void>`.

Here's an example of how to execute a consumer:

```javascript
import { runConsumer } from 'pagopa-interop-kafka-iam-auth';

// Your config, topic name, and message handler
const config = consumerConfig();
const topicName = 'event-store.mySchema.myTable';
const processMessageHandler = async (message: KafkaMessage) => {
  // Your message processing logic here
};

await runConsumer(config, topicName, processMessageHandler);
```


### Credits
This project uses code from the [Original Repository](https://github.com/jmaver-plume/kafkajs-msk-iam-authentication-mechanism), which is licensed under the MIT License. We are grateful to the original authors and contributors for their work.
