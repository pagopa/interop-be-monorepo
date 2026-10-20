# BFF errors mapping

> **Not documented**:
> - Authentication: none — no BFF-specific error is raised while authenticating every request. Errors from specific login endpoints remain documentable.
> - Infrastructure: `selfcareEntityNotFilled`, `attributeNotExists`, `dynamoReadingError`, `missingInterface`, `noDescriptorInEservice`, `missingDescriptorInClonedEservice`, `missingSelfcareId`, `privacyNoticeVersionIsNotTheLatest`, `missingActivePurposeVersion`, `activeAgreementByEserviceAndConsumerNotFound`, `purposeIdNotProvided`, `cannotGetKeyWithClient`, `clientAssertionPublicKeyNotFound`, `delegatedEserviceNotExportable`, `missingUserRolesInIdentityToken`, `noVersionInEServiceTemplate`, `delegationContractNotFound`.
> - Unused (no throw site in the BFF): `eserviceIsNotDraft`, `invalidJwtClaim`, `eserviceTemplateIsNotPublished`, `tooManyDescriptorForInterfaceWithTemplate`, `eserviceTemplateInterfaceNotFound`, `invalidInterfaceFile`, `eserviceTemplateInterfaceDataNotValid`, `invalidEserviceInterfaceFileDetected`, `operationForbidden`.
>
> Routers covered: `supportRouter`.

`supportRouter` has no documentable BFF error codes. `POST /session/saml2/tokens` calls `authorizationService.getSaml2Token`; errors such as `samlNotValid` from `validateSamlResponse` and `missingSelfcareId` from `retrieveSupportClaims` are caught by the router and replaced with a generic error response. The frontend calls this endpoint through `AuthServices.swapSAMLToken` from `/assistenza/scelta-ente` after the user selects a tenant, but no error from `errors.ts` reaches the client as itself.
