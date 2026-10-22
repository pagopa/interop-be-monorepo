# BFF errors mapping

> **Not documented**:
> - Authentication: none — no BFF-specific error is raised while authenticating every request. Errors from specific login endpoints remain documentable.
> - Infrastructure: `selfcareEntityNotFilled`, `attributeNotExists`, `dynamoReadingError`, `missingInterface`, `noDescriptorInEservice`, `missingDescriptorInClonedEservice`, `missingSelfcareId`, `privacyNoticeVersionIsNotTheLatest`, `missingActivePurposeVersion`, `activeAgreementByEserviceAndConsumerNotFound`, `purposeIdNotProvided`, `cannotGetKeyWithClient`, `clientAssertionPublicKeyNotFound`, `delegatedEserviceNotExportable`, `missingUserRolesInIdentityToken`, `noVersionInEServiceTemplate`, `delegationContractNotFound`.
> - Unused (no throw site in the BFF): `eserviceIsNotDraft`, `invalidJwtClaim`, `eserviceTemplateIsNotPublished`, `tooManyDescriptorForInterfaceWithTemplate`, `eserviceTemplateInterfaceNotFound`, `invalidInterfaceFile`, `eserviceTemplateInterfaceDataNotValid`, `invalidEserviceInterfaceFileDetected`, `operationForbidden`.
>
> Routers covered: `delegationRouter`.

## `delegationNotFound`

Delegation not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `delegationRouter` | `GET /delegations/{delegationId}` | `getDelegation` in `delegationService.getDelegation` throws `delegationNotFound` if delegation-process returns no delegation for the requested ID. | Cannot happen — the `Visualizza` link in `DelegationsTableRow` uses the ID from the `/delegations` result. The UI's revoke action changes the delegation state to `REVOKED`; it does not delete the record, so an ordinary state change while the list is open does not make that ID absent. | — | — |
