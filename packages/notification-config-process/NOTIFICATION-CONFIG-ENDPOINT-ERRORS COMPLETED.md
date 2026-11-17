## 1. `GET /tenantNotificationConfigs`

Service: `notificationConfigService.getTenantNotificationConfig` → `NotificationConfigService.getTenantNotificationConfig`. Mapper: `getTenantNotificationConfigErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `GET /tenantNotificationConfigs`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ---------------------- | --------------- |
| `tenantNotificationConfigNotFound` | 404 | The tenant-level notification config is missing in the read model when the admin page asks for it. | Cannot happen — `PartyContactsSection` can only load the tenant config after the user is already authorized as admin, and there is no UI action in the drawer that deletes or creates the record; the tenant config is provisioned server-side during tenant setup. | — | — |

## 2. `GET /userNotificationConfigs`

Service: `notificationConfigService.getUserNotificationConfig` → `NotificationConfigService.getUserNotificationConfig`. Mapper: `getUserNotificationConfigErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `REVIEWER_ROLE`, `SECURITY_ROLE`.

### BFF endpoints

- `GET /userNotificationConfigs`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ---------------------- | --------------- |
| `userNotificationConfigNotFound` | 404 | The user-level notification config is missing in the read model when the current user opens the notification settings page. | Cannot happen — `NotificationUserConfigPage` loads the current user config on page open and there is no UI control that can remove the record; the backend creates the default user notification config when the user role lifecycle runs. | — | — |

## 3. `POST /tenantNotificationConfigs`

Service: `notificationConfigService.updateTenantNotificationConfig` → `NotificationConfigService.updateTenantNotificationConfig`. Mapper: `updateTenantNotificationConfigErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `POST /tenantNotificationConfigs`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ---------------------- | --------------- |
| `tenantNotificationConfigNotFound` | 404 | The admin tries to update a tenant notification setting, but the tenant config record is absent in the read model. | Cannot happen — `UpdatePartyMailDrawer` only submits after the admin page has already read the tenant config, and there is no UI path that removes the tenant config or creates a missing one from the form. | — | — |

## 4. `POST /userNotificationConfigs`

Service: `notificationConfigService.updateUserNotificationConfig` → `NotificationConfigService.updateUserNotificationConfig`. Mapper: `updateUserNotificationConfigErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `REVIEWER_ROLE`, `SECURITY_ROLE`.

### BFF endpoints

- `POST /userNotificationConfigs`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ---------------------- | --------------- |
| `userNotificationConfigNotFound` | 404 | The current user tries to save notification preferences, but the user-level notification config record is absent in the read model. | Cannot happen — the form is submitted only after the page has loaded the current user config, and there is no UI control that deletes the config or allows the user to trigger a missing-record state; the user config is seeded by the server-side lifecycle. | — | — |
| `notificationConfigNotAllowedForUserRoles` | 403 | The submitted notification seed contains a flag that is not allowed for the current user's roles, and `isNotificationConfigAllowedForUserRoles` rejects it before the update is persisted. | Cannot happen — `NotificationConfigUserTab` builds the form from `useGetNotificationConfigSchema`, which filters the rendered switches to the roles currently present in `currentRoles`; the backend then re-checks the same role map with `isNotificationConfigAllowedForUserRoles`, so a normal UI submission cannot include a forbidden notification type. | — | — |
