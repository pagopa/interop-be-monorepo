# BFF errors mapping

> **Not documented**:
> - Authentication: none — no BFF-specific error is raised while authenticating every request. Errors from specific login endpoints remain documentable.
> - Infrastructure: `selfcareEntityNotFilled`, `attributeNotExists`, `dynamoReadingError`, `missingInterface`, `noDescriptorInEservice`, `missingDescriptorInClonedEservice`, `missingSelfcareId`, `privacyNoticeVersionIsNotTheLatest`, `missingActivePurposeVersion`, `activeAgreementByEserviceAndConsumerNotFound`, `purposeIdNotProvided`, `cannotGetKeyWithClient`, `clientAssertionPublicKeyNotFound`, `delegatedEserviceNotExportable`, `missingUserRolesInIdentityToken`, `noVersionInEServiceTemplate`, `delegationContractNotFound`.
> - Unused (no throw site in the BFF): `eserviceIsNotDraft`, `invalidJwtClaim`, `eserviceTemplateIsNotPublished`, `tooManyDescriptorForInterfaceWithTemplate`, `eserviceTemplateInterfaceNotFound`, `invalidInterfaceFile`, `eserviceTemplateInterfaceDataNotValid`, `invalidEserviceInterfaceFileDetected`, `operationForbidden`.
>
> Routers covered: `emailDeeplinkRouter`.

`emailDeeplinkRouter` has no documentable BFF error codes. `GET /emailDeepLink/:notificationType/:entityId` parses the notification type and maps it to a UI path; `GET /emailDeepLink/:digestNotificationType` returns a shared-model `badRequestError` for an invalid digest notification type. Neither endpoint throws an error from `packages/backend-for-frontend/src/model/errors.ts`.
