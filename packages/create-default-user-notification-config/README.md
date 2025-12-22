# Create Default User Notification Config

One-time script to create default notification configurations for all users across all tenants.

## Purpose

This script:

1. Retrieves all tenants from the readmodel database
2. For each tenant, fetches users from the Selfcare API using the tenant's selfcareId
3. For each user and their roles, calls the notification-config-process endpoint to ensure their notification config exists

## Configuration

Copy `.env.example` to `.env` and configure the following environment variables:

### Readmodel Database

- `READMODEL_SQL_DB_HOST` - Readmodel database host
- `READMODEL_SQL_DB_NAME` - Readmodel database name
- `READMODEL_SQL_DB_USERNAME` - Readmodel database username
- `READMODEL_SQL_DB_PASSWORD` - Readmodel database password
- `READMODEL_SQL_DB_PORT` - Readmodel database port
- `READMODEL_SQL_DB_USE_SSL` - Use SSL for database connection (true/false)
- `READMODEL_SQL_DB_SCHEMA_TENANT` - Tenant schema name

### Selfcare API

- `SELFCARE_V2_URL` - Selfcare API base URL
- `SELFCARE_V2_API_KEY` - Selfcare API key

### Notification Config Process

- `NOTIFICATION_CONFIG_PROCESS_URL` - Notification config process base URL
- `INTERNAL_TOKEN` - Internal authentication token

### Other

- `INTEROP_PRODUCT` - Interop product ID for filtering users
- `NOTIFICATION_CONFIG_CALL_DELAY_MS` - Delay in milliseconds between notification config API calls (default: 1000)

## Running the Script

### Development

```bash
pnpm --filter pagopa-interop-create-default-user-notification-config start
```

### Production

```bash
pnpm --filter pagopa-interop-create-default-user-notification-config build
node packages/create-default-user-notification-config/dist/index.js
```

### Docker

```bash
docker build -f packages/create-default-user-notification-config/Dockerfile -t create-default-user-notification-config .
docker run --env-file packages/create-default-user-notification-config/.env create-default-user-notification-config
```

## Error Handling

The script stops on the first error encountered. This ensures data consistency and allows you to investigate and fix issues before continuing.

## User Role Mapping

The script maps Selfcare user roles to notification config roles as follows:

- `ADMIN_EA` → `admin`
- `DELEGATE` → `security`
- `MANAGER` → `admin`
- `OPERATOR` → `api`
- `SUB_DELEGATE` → `security`

## Logging

The script provides detailed logging at each step:

- Tenant processing progress
- User retrieval from Selfcare
- Notification config creation for each user/role
- Error details if any step fails
