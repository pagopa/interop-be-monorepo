# BFF errors mapping

> **Not documented**:
> - Authentication: none — authentication errors in the BFF error model belong to specific login-flow endpoints.
> - Infrastructure: `selfcareEntityNotFilled`, `attributeNotExists`, `dynamoReadingError`, `missingInterface`, `noDescriptorInEservice`, `missingDescriptorInClonedEservice`, `privacyNoticeVersionIsNotTheLatest`, `missingActivePurposeVersion`, `activeAgreementByEserviceAndConsumerNotFound`, `purposeIdNotProvided`, `cannotGetKeyWithClient`, `clientAssertionPublicKeyNotFound`, `delegatedEserviceNotExportable`, `noVersionInEServiceTemplate`, `delegationContractNotFound`.
> - Unused (no throw site in the BFF): `eserviceIsNotDraft`, `invalidJwtClaim`, `eserviceTemplateIsNotPublished`, `tooManyDescriptorForInterfaceWithTemplate`, `eserviceTemplateInterfaceNotFound`, `invalidInterfaceFile`, `eserviceTemplateInterfaceDataNotValid`, `invalidEserviceInterfaceFileDetected`, `operationForbidden`.
>
> Routers covered: `swaggerRouter`.

`swaggerRouter` only mounts the optional Swagger UI at `GET /apiDocs`; it has no reachable throw site for a documentable BFF error code.
