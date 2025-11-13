# Notification User Lifecycle Consumer

This service is a Kafka consumer responsible for synchronizing user lifecycle events from Selfcare with the Interop database. It listens to a specific Kafka topic for user creation, update, and deletion events related to the "interop" product and performs the necessary actions to keep the user data and notification configurations consistent.

## Core Functionalities

- When Self-Care send an `add` or `update` message, this service calls the Notification Config Process to ensure that a notification config exists for that user in that tenant and that the user's role is stored.
- When Self-Care sends a delete message (`update` with `relationshipStatus = DELETED`), this service calls the Notification Config Process to remove that role for the user or delete the user's notification config if it was their only role.

## Message Processing Flow

1.  The service consumes messages from the `SELFCARE_TOPIC`.
2.  It parses the incoming message payload, expecting a `UsersEventPayload` format.
3.  It filters messages, processing only those where the `productId` matches the configured `INTEROP_PRODUCT_NAME`.
4.  Based on the `eventType` (`add`, `update`, or `delete`), it triggers the corresponding logic.
5.  It uses an internal token generator to securely communicate with other internal services (like the Notification Config Process API).

## Configuration

The service is configured through environment variables. A template `.env` file is provided in the root directory. Key variables include:

- Kafka connection details (`KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, etc.)
- Self-Care topic (`SELFCARE_TOPIC`)
- Read model database connection details.
- URL for the Notification Config Process service (`NOTIFICATION_CONFIG_PROCESS_URL`).
- The name of the product to filter for (`INTEROP_PRODUCT_NAME`).
