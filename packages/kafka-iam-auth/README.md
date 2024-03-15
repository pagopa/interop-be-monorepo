# Description

This package runs consumer and handles AWS IAM authentication for Kafka topic consumed by consumer's services, it creates a SASL configuration valid for KafakaJS authentication mechanism.

To refresh the AWS IAM authentication the consumer will be disconnected and reconnected to the topics just before the authentication expiration.

## Usages

To run an authenticated consumer, you need to provide three parameters:

- **Consumer's Config**: contains all environment variables defined for the current consumer.If your consumer needs to write on readmodel you can get it with `const config = readModelWriterConfig();` or you can use `kafkaConsumerConfig()` for more general kafka consumer

- **Topic Name**: the target topic for the consumer. It usually has a name like "event-store.{schema}.{table}".

- **Message Handler**: function that processes messages, contains your business logic. The function signature is `(message: KafkaMessage) => Promise<void>`.

Here's an example of how to execute a consumer:

```javascript
import { runConsumer } from 'pagopa-interop-kafka-iam-auth';

// Your config, topic name, and message handler
const config = readModelWriterConfig();
const topicName = 'event-store.mySchema.myTable';
const processMessageHandler = async (message: KafkaMessage) => {
  // Your message processing logic here
};

await runConsumer(config, topicName, processMessageHandler);
```

## Local Testing
To simulate Kafaka topic consuming and executing a real SALS authentication with AWS, you need to connect your consumer to specific topic presents in dev environment.
You must put the following variables in your consumer .env file to simulate the same credential provisioning executed by service in Kubernates pod:

```bash
AWS_WEB_IDENTITY_TOKEN_FILE="{TOKE_FILE_PATH}"
AWS_ROLE_ARN="arn:aws:iam::{ID}:role/interop-be-{SERVICE}-consumer-refactor-dev"
AWS_REGION="eu-central-1"
AWS_STS_REGIONAL_ENDPOINTS="regional"
AWS_DEFAULT_REGION="eu-central-1"
```

Replace all placeholders {...} with desired configurations.

Token file should contains a valid token retrieved from AWS, by the way all of those variables can be found inspecting pod in dev cluster.


## Credits
This project uses code from the [Original Repository](https://github.com/jmaver-plume/kafkajs-msk-iam-authentication-mechanism), which is licensed under the MIT License. We are grateful to the original authors and contributors for their work.
