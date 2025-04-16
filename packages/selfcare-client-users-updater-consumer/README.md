# Selfcare client users updater

This service is responsible for managing updates to client user values.

## Main Features

- Removing the admin role from a client for a user who is no longer an admin in a specific tenant.
- Managing users who are no longer part of a tenant.

## Technologies Used

- **Node.js**
- **TypeScript**
- **Kafka** for message handling
- **Vitest** for testing