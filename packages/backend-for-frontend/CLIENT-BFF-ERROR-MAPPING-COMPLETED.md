# BFF errors mapping

> **Not documented**:
> - Authentication: none — no BFF-specific error is raised while authenticating every request. Errors from specific login endpoints remain documentable.
> - Infrastructure: `selfcareEntityNotFilled`, `attributeNotExists`, `dynamoReadingError`, `missingInterface`, `noDescriptorInEservice`, `missingDescriptorInClonedEservice`, `missingSelfcareId`, `privacyNoticeVersionIsNotTheLatest`, `missingActivePurposeVersion`, `activeAgreementByEserviceAndConsumerNotFound`, `purposeIdNotProvided`, `cannotGetKeyWithClient`, `clientAssertionPublicKeyNotFound`, `delegatedEserviceNotExportable`, `missingUserRolesInIdentityToken`, `noVersionInEServiceTemplate`, `delegationContractNotFound`.
> - Unused (no throw site in the BFF): `eserviceIsNotDraft`, `invalidJwtClaim`, `eserviceTemplateIsNotPublished`, `tooManyDescriptorForInterfaceWithTemplate`, `eserviceTemplateInterfaceNotFound`, `invalidInterfaceFile`, `eserviceTemplateInterfaceDataNotValid`, `invalidEserviceInterfaceFileDetected`, `operationForbidden`.
>
> Routers covered: `clientRouter`.

## `clientNotFound`

The requested client was not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `clientRouter` | `GET /clients/{clientId}` | `clientService.getClientById` throws `clientNotFound` if authorization-process returns the client with `PARTIAL` visibility. The handler maps this error to 404 with `getClientErrorMapper`. | Cannot happen — `ClientTableRow` and voucher simulation obtain IDs from `GET /clients`, which is scoped to the authenticated organization; `PurposeClientsTableRow` uses clients attached to the current tenant's purpose. These UI paths do not supply a client with `PARTIAL` visibility. The detail routes also require `admin`, `support` or `security` via `authLevels` and `AuthGuard`. | — | — |
