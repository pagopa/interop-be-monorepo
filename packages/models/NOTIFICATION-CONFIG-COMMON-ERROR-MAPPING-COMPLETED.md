# Common errors mapping

> **Not documented** (same for every endpoint, or never surfaced over HTTP):
> - Authentication: `jwtDecodingError`, `invalidClaim`, `missingHeader`, `tokenVerificationFailed`, `badBearerToken`, `badDPoPToken`.
> - Middleware-only: `tooManyRequestsError`.
> - Infrastructure: `authenticationSaslFailed`, `htmlTemplateInterpolationError`, `pdfGenerationError`, `genericError`, `thirdPartyCallError`, `tokenGenerationError`, `missingRSAKey`, `missingKafkaMessageData`, `kafkaMessageProcessError`, `missingRequiredJWKClaim`, `jwksSigningKeyError`, `kafkaApplicationAuditingFailed`, `fallbackApplicationAuditingFailed`, `invalidSqsMessage`, `decodeSQSMessageError`, `pollingMaxRetriesExceeded`.
>
> Processes covered: `notification-config-process`.

## `unauthorizedError`

Unauthorized.

| Process | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------- | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `notification-config-process` | `GET /tenantNotificationConfigs` | `validateAuthorization(ctx, [ADMIN_ROLE])` in `getTenantNotificationConfig` rejects a caller without `ADMIN_ROLE`. | Cannot happen — `PartyContactsSection` enables this query only when `isAdmin` is true, so other roles never call it and admins pass the process role check. | — | — |
| `notification-config-process` | `GET /userNotificationConfigs` | `validateAuthorization` in `getUserNotificationConfig` rejects a caller without `ADMIN_ROLE`, `API_ROLE`, `REVIEWER_ROLE`, or `SECURITY_ROLE`. | Cannot happen — `/notifiche/configurazione` admits exactly `admin`, `api`, `reviewer`, and `security` through `AuthGuard`, matching the process role check. | — | — |
| `notification-config-process` | `POST /tenantNotificationConfigs` | `validateAuthorization(ctx, [ADMIN_ROLE])` in `updateTenantNotificationConfig` rejects a caller without `ADMIN_ROLE`. | Cannot happen — `PartyContactsSection` renders _Modifica_ only for admins, and `UpdatePartyMailDrawer` renders the tenant notification switch only when `currentRoles` includes `admin`. | — | — |
| `notification-config-process` | `POST /userNotificationConfigs` | `validateAuthorization` in `updateUserNotificationConfig` rejects a caller without `ADMIN_ROLE`, `API_ROLE`, `REVIEWER_ROLE`, or `SECURITY_ROLE`. | Cannot happen — `/notifiche/configurazione` admits exactly `admin`, `api`, `reviewer`, and `security` through `AuthGuard`, matching the process role check. | — | — |
