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

## `eventConflictError`

The request conflicts with an ongoing operation on the same resource. Please retry.

| Process | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------- | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `notification-config-process` | `POST /tenantNotificationConfigs` | Concurrent `updateTenantNotificationConfig` calls can read the same event-stream version; `repository.createEvent` then throws `eventConflictError` in `EventRepository.internalCreateEvent` when the `events_stream_id_version_key` constraint detects the duplicate version. | **CAN HAPPEN** — two tenant admins can edit the same tenant notification setting from the ordinary admin page; the BFF forwards both requests without a pre-check, so the request that loses the event-version race can return this error. | **Data precondition:** tenant A has an existing tenant notification configuration, a contact email, and two active admins.<br>1. In two separate sessions, sign in as the admins and open `/aderente/anagrafica`.<br>2. Both click _Modifica_ and change _Ricevi email di cortesia per l’ente attraverso questa casella_.<br>3. Click _Aggiorna_ in both sessions at nearly the same time; the request that loses the event-version race receives the conflict. | 🟢 **Easy resolution**<br>1. Reload `/aderente/anagrafica` and check the saved setting.<br>2. Set the intended value again and click _Aggiorna_. |
| `notification-config-process` | `POST /userNotificationConfigs` | Concurrent `updateUserNotificationConfig` calls can read the same event-stream version; `repository.createEvent` then throws `eventConflictError` in `EventRepository.internalCreateEvent` when the `events_stream_id_version_key` constraint detects the duplicate version. | **CAN HAPPEN** — user preferences autosave after a one-second debounce, and the switches remain interactive while a save is pending; overlapping saves can therefore race on the same user configuration stream. | **Data precondition:** the current user has an existing notification configuration and can access `/notifiche/configurazione`.<br>1. Open `/notifiche/configurazione` and select _Notifiche in-app_.<br>2. Turn on _Consenti le notifiche in piattaforma_; the page schedules an autosave after one second.<br>3. While the first save is still pending, turn the switch off and wait for the second debounced save to start; the request that loses the event-version race receives the conflict. | 🟢 **Easy resolution**<br>1. Reload `/notifiche/configurazione` and check which preference was saved.<br>2. Set the intended value again and wait for the save to complete. |