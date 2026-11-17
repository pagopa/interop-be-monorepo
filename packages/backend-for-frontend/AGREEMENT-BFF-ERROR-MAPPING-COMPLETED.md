# BFF errors mapping

> **Not documented**:
> - Authentication: none — no BFF-specific error is raised while authenticating every request. Errors from specific login endpoints remain documentable.
> - Infrastructure: `selfcareEntityNotFilled`, `attributeNotExists`, `dynamoReadingError`, `missingInterface`, `noDescriptorInEservice`, `missingDescriptorInClonedEservice`, `missingSelfcareId`, `privacyNoticeVersionIsNotTheLatest`, `missingActivePurposeVersion`, `activeAgreementByEserviceAndConsumerNotFound`, `purposeIdNotProvided`, `cannotGetKeyWithClient`, `clientAssertionPublicKeyNotFound`, `delegatedEserviceNotExportable`, `missingUserRolesInIdentityToken`, `noVersionInEServiceTemplate`, `delegationContractNotFound`.
> - Unused (no throw site in the BFF): `eserviceIsNotDraft`, `invalidJwtClaim`, `eserviceTemplateIsNotPublished`, `tooManyDescriptorForInterfaceWithTemplate`, `eserviceTemplateInterfaceNotFound`, `invalidInterfaceFile`, `eserviceTemplateInterfaceDataNotValid`, `invalidEserviceInterfaceFileDetected`, `operationForbidden`.
>
> Routers covered: `agreementRouter`.

## `agreementDescriptorNotFound`

The descriptor of the agreement was not found in the e-service.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `agreementRouter` | `POST /agreements/:agreementId/approve` | `approveAgreement` calls `enrichAgreement`, which calls `getCurrentDescriptor`; it throws when the descriptor ID on the agreement returned by agreement-process is absent from the e-service returned by catalog-process. `approveAgreementErrorMapper` exposes this as 404. | Cannot happen — The FE does't permit this operation. | — | — |
| `agreementRouter` | `POST /agreements/:agreementId/unsuspend` | `unsuspendAgreement` calls `enrichAgreement`, which calls `getCurrentDescriptor`; it throws when the descriptor ID on the agreement returned by agreement-process is absent from the e-service returned by catalog-process. `unsuspendAgreementErrorMapper` exposes this as 404. | Cannot happen — The FE does't permit this operation. | — | — |

## `contractNotFound`

The contract was not found for the agreement.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `agreementRouter` | `GET /agreements/:agreementId/contract` | `getAgreementContract` throws `contractNotFound` when agreement-process returns an agreement without a contract and its state is not `ACTIVE`, `SUSPENDED`, or `ARCHIVED`. | Cannot happen — there is no generated operation or UI usage for this endpoint. The frontend has an unreferenced `downloadContract` helper, but its rendered download control calls only `/signedContract`. | — | — |
| `agreementRouter` | `GET /agreements/:agreementId/signedContract` | `getAgreementSignedContract` throws `contractNotFound` when agreement-process returns an agreement without a signed contract and its state is not `ACTIVE`, `SUSPENDED`, or `ARCHIVED`. | Cannot happen — The FE does't permit this operation. | — | — |

## `contractException`

There is no contract available to download for the agreement.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `agreementRouter` | `GET /agreements/:agreementId/contract` | `getAgreementContract` throws `contractException` when agreement-process returns an agreement without a contract and its state is `ACTIVE`, `SUSPENDED`, or `ARCHIVED`. | Cannot happen — there is no generated operation or UI usage for this endpoint. The frontend has an unreferenced `downloadContract` helper, but its rendered download control calls only `/signedContract`. | — | — |
| `agreementRouter` | `GET /agreements/:agreementId/signedContract` | `getAgreementSignedContract` throws `contractException` when agreement-process returns an agreement without a signed contract and its state is `ACTIVE`, `SUSPENDED`, or `ARCHIVED`. | **CAN HAPPEN** — On the provider details page the download action is rendered when `isContractPresent` is true, without checking `isDocumentReady`; a provider can click it while the signed document is not yet available. The consumer page disables its action while `isDocumentReady` is false. | **Data precondition:** Tenant A has an admin user and an active agreement whose contract is present but whose signed contract is not yet available. <br> 1. Sign in as tenant A’s admin and open `/erogazione/richieste` (“Richieste di fruizione ricevute”). <br> 2. Open the active agreement to load `/erogazione/richieste/{agreementId}`. <br> 3. In “Informazioni generali”, click “Scarica richiesta di fruizione” while the signed document is still unavailable. | 🟢 **Easy resolution** — Wait for signed-document generation to complete, reload the agreement details page, and click “Scarica richiesta di fruizione” again. If the document remains unavailable, contact support. |
