# Notification User Lifecycle Consumer

This service is a Kafka consumer responsible for synchronizing user lifecycle events from Selfcare with the Interop database. It listens to a specific Kafka topic for user creation, update, and deletion events related to the "interop" product and performs the necessary actions to keep the user data and notification configurations consistent.

## Core Functionalities

- **User Addition:** When a new user is added in Self-Care for the "interop" product, this service:
  - Inserts the new user's record into the local user database.
  - Calls the Notification Config Process service to create default notification settings for the new user.
- **User Update:** When a user's details are updated, it updates the corresponding record in the local user database.
- **User Deletion:** When a user is removed, this service:
  - Deletes the user's record from the local user database.
  - Calls the Notification Config Process service to delete the user's notification settings.

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
- Database connection details for the user database (`USER_SQL_DB_HOST`, `USER_SQL_DB_NAME`, etc.)
- Read model database connection details.
- URL for the Notification Config Process service (`NOTIFICATION_CONFIG_PROCESS_URL`).
- The name of the product to filter for (`INTEROP_PRODUCT_NAME`).
