# BFF errors mapping

> **Not documented**:
> - Authentication: — (no error in `errors.ts` is raised while authenticating every request; errors from specific authentication endpoints remain documentable)
> - Infrastructure: `selfcareEntityNotFilled`, `attributeNotExists`, `dynamoReadingError`, `missingInterface`, `noDescriptorInEservice`, `missingDescriptorInClonedEservice`, `missingSelfcareId`, `privacyNoticeNotFoundInConfiguration`, `privacyNoticeVersionIsNotTheLatest`, `missingActivePurposeVersion`, `activeAgreementByEserviceAndConsumerNotFound`, `purposeIdNotProvided`, `tenantNotAllowed`, `cannotGetKeyWithClient`, `clientAssertionPublicKeyNotFound`, `delegatedEserviceNotExportable`, `missingUserRolesInIdentityToken`, `noVersionInEServiceTemplate`, `delegationContractNotFound`
> - Unused (no throw site in the BFF): `eserviceIsNotDraft`, `invalidJwtClaim`, `eserviceTemplateIsNotPublished`, `tooManyDescriptorForInterfaceWithTemplate`, `eserviceTemplateInterfaceNotFound`, `invalidInterfaceFile`, `eserviceTemplateInterfaceDataNotValid`, `invalidEserviceInterfaceFileDetected`, `operationForbidden`
>
> Routers covered: `notificationConfigRouter`.

No documentable BFF-specific errors are thrown by this router's handlers, services, or converters.
