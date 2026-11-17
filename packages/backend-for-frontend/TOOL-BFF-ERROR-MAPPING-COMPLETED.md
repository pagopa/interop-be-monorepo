# BFF errors mapping

> **Not documented**:
> - Authentication: — (no error in `errors.ts` is raised while authenticating every request; errors from specific authentication endpoints remain documentable)
> - Infrastructure: `selfcareEntityNotFilled`, `dynamoReadingError`, `privacyNoticeVersionIsNotTheLatest`, `missingSelfcareId`, `attributeNotExists`, `missingInterface`, `noDescriptorInEservice`, `noVersionInEServiceTemplate`, `missingDescriptorInClonedEservice`, `cannotGetKeyWithClient`, `activeAgreementByEserviceAndConsumerNotFound`, `missingActivePurposeVersion`, `delegationContractNotFound`, `delegatedEserviceNotExportable`
> - Unused (no throw site in the BFF): `invalidJwtClaim`, `purposeIdNotProvided`, `clientAssertionPublicKeyNotFound`, `eserviceTemplateIsNotPublished`, `eserviceTemplateInterfaceNotFound`, `invalidInterfaceFile`, `eserviceTemplateInterfaceDataNotValid`, `invalidEserviceInterfaceFileDetected`, `operationForbidden`, `tooManyDescriptorForInterfaceWithTemplate`, `eserviceIsNotDraft`
>
> Routers covered: `toolRouter`.

## `tenantNotAllowed`

Tenant not allowed for the client.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `toolRouter` | `POST /tools/validateTokenGeneration` | In `assertIsConsumer` called by `retrieveKeyAndEservice` in `validateTokenGeneration`, the consumer client returned by authorization-process belongs to a different tenant than the authenticated user's organization. This applies to synchronous validation and asynchronous `start_interaction`, `get_resource`, or `confirmation` validation; the producer `callback_invocation` path does not call this check. | **CAN HAPPEN** — the route admits `admin`, `support`, `api`, and `security` roles, and the form accepts a manually entered client assertion and client ID without tying either to the signed-in tenant. A valid consumer assertion for a client owned by another tenant therefore reaches the ownership check. | **Data precondition:** User A is signed in as an admin of tenant A; tenant B owns a consumer client and has a valid client assertion for it, and the user can enter those values.<br>1. Open “Tool per lo sviluppo” > “Debug client assertion” (or navigate to `/tool-sviluppo/debug-voucher`).<br>2. Enter tenant B's valid assertion in “Client assertion” and its matching client ID in “client_id o producer_id”.<br>3. Leave “Modello di interazione” set to “Sincrono (standard)”.<br>4. Click “Inoltra richiesta”. Step 2 supplies the client belonging to a tenant other than the signed-in tenant. | 🟡 **Medium resolution**<br>1. Sign in as an admin of tenant B, or use a valid client assertion and matching client ID for a consumer client owned by tenant A.<br>2. Open “Tool per lo sviluppo” > “Debug client assertion”.<br>3. Enter the assertion and client ID for the tenant you are currently signed in as.<br>4. Click “Inoltra richiesta”. |
