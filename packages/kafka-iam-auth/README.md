# Description
This package handles AWS IAM authentication for Kafka topic consumed by consumer's services, it creates a SASL configuration valid for KafakaJS authetication mechanism.

## Usages   
Import node module "pagopa-interop-kafka-iam-auth" 
```
import { createMechanism } from "@jm18457 kafkajs-msk-iam-authentication-mechanism";
```

createMechanism accept AWS region and return a SALS config valid for KafkaJS, your configuration should be something like this:
```
  const kafkaConfig = {
    clientId: config.kafkaClientId,
    brokers: [config.kafkaBrokers],
    ssl: true,
    sasl: createMechanism({ region: config.awsRegion })
  };
```


## Credits
This project uses code from the [Original Repository](https://github.com/jmaver-plume/kafkajs-msk-iam-authentication-mechanism), which is licensed under the MIT License. We are grateful to the original authors and contributors for their work.

