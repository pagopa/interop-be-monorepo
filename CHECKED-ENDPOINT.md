# BFF errors mapping

> **Not documented**:
> - Authentication: none. The global `authenticationMiddleware` (commons) raises no BFF code. `missingUserRolesInIdentityToken` is raised only in the identity-token login path (`authorizationService.ts`).
> - Infrastructure: `dynamoReadingError` (DynamoDB read failure in `privacyNoticeStorage.ts`, always mapped to 500)
> - Unused (no throw site in the BFF): `eserviceTemplateIsNotPublished` (function `eserviceTemplateNotPublished`), `eserviceIsNotDraft`
>
> Endpoints covered (including endpoints with no documentable errors):
> - `agreementRouter`: `DELETE /agreements/{agreementId}` (no BFF throw site; only process-originated errors)
> - `agreementRouter`: `GET /agreements/{agreementId}/contract`
> - `agreementRouter`: `POST /agreements/{agreementId}/update`
> - `agreementRouter`: `POST /agreements/{agreementId}/upgrade`
> - `catalogRouter`: `GET /import/eservices/presignedUrl` (no BFF throw site; only infrastructure errors)
> - `catalogRouter`: `GET /templates/{templateId}/eservices`
> - `catalogRouter`: `GET /templates/{templateId}/myInstances`
> - `catalogRouter`: `POST /eservices/{eServiceId}/approveDelegatedArchiving` (no BFF throw site; only process-originated errors)
> - `catalogRouter`: `POST /eservices/{eServiceId}/rejectDelegatedArchiving` (no BFF throw site; only process-originated errors)
> - `catalogRouter`: `DELETE /eservices/{eServiceId}/scheduleArchive` (no BFF throw site; only process-originated errors)
> - `catalogRouter`: `DELETE /eservices/{eServiceId}/riskAnalysis/{riskAnalysisId}` (no BFF throw site; only process-originated errors)
> - `catalogRouter`: `PUT /eservices/{eServiceId}` (no BFF throw site; only process-originated errors)
> - `catalogRouter`: `GET /eservices/{eServiceId}/consumers` (no BFF throw site; only process-originated errors)
> - `catalogRouter`: `PUT /eservices/{eServiceId}/descriptors/{descriptorId}` (no BFF throw site; only process-originated errors)
> - `catalogRouter`: `POST /eservices/{eServiceId}/descriptors/{descriptorId}/approve` (no BFF throw site; only process-originated errors)
> - `catalogRouter`: `POST /eservices/{eServiceId}/descriptors/{descriptorId}/approveDelegatedArchiving` (no BFF throw site; only process-originated errors)
> - `catalogRouter`: `GET /eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId}` (no BFF throw site; only process-originated errors)
> - `catalogRouter`: `POST /eservices/{eServiceId}/descriptors/{descriptorId}/clone`
> - `catalogRouter`: `POST /eservices/{eServiceId}/descriptors/{descriptorId}/scheduleArchive` (no BFF throw site; only process-originated errors)
> - `catalogRouter`: `DELETE /eservices/{eServiceId}/descriptors/{descriptorId}/scheduleArchive` (no BFF throw site; only process-originated errors)
> - `catalogRouter`: `POST /eservices/{eServiceId}/descriptors/{descriptorId}/rejectDelegatedArchiving` (no BFF throw site; only process-originated errors)
> - `clientRouter`: `DELETE /clients/{clientId}` (no BFF throw site; only process-originated errors)
> - `clientRouter`: `DELETE /clients/{clientId}/purposes/{purposeId}` (no BFF throw site; only process-originated errors)
> - `clientRouter`: `POST /clients/{clientId}/users` (no BFF throw site; only process-originated errors)
> - `clientRouter`: `POST /clients/{clientId}/admin`
> - `clientRouter`: `DELETE /clients/{clientId}/admin/{adminId}` (no BFF throw site; only process-originated errors)
> - `clientRouter`: `DELETE /clients/{clientId}/users/{userId}` (no BFF throw site; only process-originated errors)
> - `inAppNotificationRouter`: `DELETE /inAppNotifications` (no BFF throw site; only process-originated errors)
> - `inAppNotificationRouter`: `POST /inAppNotifications/bulk/markAsRead` (no BFF throw site; only process-originated errors)
> - `inAppNotificationRouter`: `POST /inAppNotifications/bulk/markAsUnread` (no BFF throw site; only process-originated errors)
> - `inAppNotificationRouter`: `DELETE /inAppNotifications/{notificationId}` (no BFF throw site; only process-originated errors)
> - `inAppNotificationRouter`: `POST /inAppNotifications/{notificationId}/markAsRead` (no BFF throw site; only process-originated errors)
> - `inAppNotificationRouter`: `POST /inAppNotifications/{notificationId}/markAsUnread` (no BFF throw site; only process-originated errors)
> - `delegationRouter`: `GET /delegations/{delegationId}/contracts/{contractId}` (no BFF throw site; only infrastructure errors)
> - `delegationRouter`: `GET /delegations/{delegationId}/signedContract/{contractId}`
> - `eserviceTemplateRouter`: `POST /templates/{eServiceTemplateId}` (no BFF throw site; only process-originated errors)
> - `eserviceTemplateRouter`: `POST /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}/suspend` (no BFF throw site; only process-originated errors)
> - `eserviceTemplateRouter`: `POST /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}/activate` (no BFF throw site; only process-originated errors)
> - `eserviceTemplateRouter`: `DELETE /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}` (no BFF throw site; only process-originated errors)
> - `eserviceTemplateRouter`: `POST /templates/{eServiceTemplateId}/personalDataFlag` (no BFF throw site; only process-originated errors)
> - `eserviceTemplateRouter`: `POST /eservices/templates/{eServiceTemplateId}/riskAnalysis/{riskAnalysisId}` (no BFF throw site; only process-originated errors)
> - `eserviceTemplateRouter`: `DELETE /eservices/templates/{eServiceTemplateId}/riskAnalysis/{riskAnalysisId}` (no BFF throw site; only process-originated errors)
> - `eserviceTemplateRouter`: `POST /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}/attributes/update` (no BFF throw site; only process-originated errors)
> - `eserviceTemplateRouter`: `POST /eservices/templates/{eServiceTemplateId}/versions`
> - `eserviceTemplateRouter`: `POST /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}/publish` (no BFF throw site; only process-originated errors)
> - `eserviceTemplateRouter`: `POST /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}/quotas/update` (no BFF throw site; only process-originated errors)
> - `eserviceTemplateRouter`: `DELETE /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}/documents/{documentId}` (no BFF throw site; only process-originated errors)
> - `producerKeychainRouter`: `DELETE /producerKeychains/{producerKeychainId}` (no BFF throw site; only process-originated errors)
> - `producerKeychainRouter`: `DELETE /producerKeychains/{producerKeychainId}/eservices/{eserviceId}` (no BFF throw site; only process-originated errors)
> - `producerKeychainRouter`: `DELETE /producerKeychains/{producerKeychainId}/keys/{keyId}` (no BFF throw site; only process-originated errors)
> - `producerKeychainRouter`: `POST /producerKeychains/{producerKeychainId}/users` (no BFF throw site; only process-originated errors)
> - `producerKeychainRouter`: `DELETE /producerKeychains/{producerKeychainId}/users/{userId}` (no BFF throw site; only process-originated errors)
> - `purposeRouter`: `POST /purposes/{purposeId}/versions` (no BFF throw site; only process-originated errors)
> - `purposeRouter`: `POST /purposes/{purposeId}/versions/{versionId}/activate` (no BFF throw site; only process-originated errors)
> - `purposeRouter`: `DELETE /purposes/{purposeId}` (no BFF throw site; only process-originated errors)
> - `purposeRouter`: `DELETE /purposes/{purposeId}/versions/{versionId}` (no BFF throw site; only process-originated errors)
> - `purposeRouter`: `POST /purposes/{purposeId}/riskAnalysis/assign` (no BFF throw site; only process-originated errors)
> - `purposeRouter`: `POST /purposes/{purposeId}/riskAnalysis/submit` (no BFF throw site; only process-originated errors)
> - `purposeRouter`: `GET /purposes/{purposeId}`
> - `purposeRouter`: `GET /purposes/{purposeId}/versions/{versionId}/documents/{documentId}` (no BFF throw site; only infrastructure errors)
> - `purposeRouter`: `GET /purposes/{purposeId}/versions/{versionId}/signedDocuments/{documentId}` (no BFF throw site; only infrastructure errors)
> - `purposeRouter`: `POST /purposes/{purposeId}/versions/{versionId}/reject` (no BFF throw site; only process-originated errors)
> - `purposeRouter`: `POST /purposes/{purposeId}/versions/{versionId}/archive` (no BFF throw site; only process-originated errors)
> - `purposeRouter`: `POST /purposes/{purposeId}/versions/{versionId}/suspend` (no BFF throw site; only process-originated errors)
> - `purposeRouter`: `POST /reverse/purposes/{purposeId}`
> - `purposeTemplateRouter`: `POST /purposeTemplates` (no BFF throw site; only process-originated errors)
> - `purposeTemplateRouter`: `DELETE /purposeTemplates/{purposeTemplateId}` (no BFF throw site; only process-originated errors)
> - `purposeTemplateRouter`: `POST /purposeTemplates/{purposeTemplateId}/suspend` (no BFF throw site; only process-originated errors)
> - `purposeTemplateRouter`: `POST /purposeTemplates/{purposeTemplateId}/archive` (no BFF throw site; only process-originated errors)
> - `purposeTemplateRouter`: `POST /purposeTemplates/{purposeTemplateId}/unlinkResource` (no BFF throw site; only process-originated errors)
> - `purposeTemplateRouter`: `GET /purposeTemplates/{purposeTemplateId}/riskAnalysis/answers/{answerId}/annotation/documents/{documentId}` (no BFF throw site; only infrastructure errors)
> - `purposeTemplateRouter`: `DELETE /purposeTemplates/{purposeTemplateId}/riskAnalysis/answers/{answerId}/annotation` (no BFF throw site; only process-originated errors)
> - `purposeTemplateRouter`: `DELETE /purposeTemplates/{purposeTemplateId}/riskAnalysis/answers/{answerId}/annotation/documents/{documentId}` (no BFF throw site; only process-originated errors)
> - `notificationConfigRouter`: `POST /tenantNotificationConfigs` (no BFF throw site; only process-originated errors)
> - `notificationConfigRouter`: `POST /userNotificationConfigs` (no BFF throw site; only process-originated errors)
> - `tenantRouter`: `POST /tenants/attributes/declared` (no BFF throw site; only process-originated errors)
> - `tenantRouter`: `DELETE /tenants/attributes/declared/{attributeId}` (no BFF throw site; only process-originated errors)
> - `tenantRouter`: `DELETE /tenants/{tenantId}/attributes/certified/{attributeId}` (no BFF throw site; only process-originated errors)
> - `tenantRouter`: `DELETE /tenants/{tenantId}/attributes/certifiedDiscrete/{attributeId}` (no BFF throw site; only process-originated errors)
> - `tenantRouter`: `DELETE /tenants/{tenantId}/attributes/verified/{attributeId}` (no BFF throw site; only process-originated errors)
> - `tenantRouter`: `PUT /tenants/{tenantId}/attributes/certifiedDiscrete/{attributeId}` (no BFF throw site; only process-originated errors)

## `purposeNotFound`

Purpose not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `clientRouter` | `POST /clients/{clientId}/admin` | `enhancePurposes` (`clientService.ts`), called by `enhanceClient` after `setAdminToClient`, throws when a purpose linked to the client is not returned by purpose-process. | Cannot happen — a purpose can be linked to a client only if it has an ACTIVE or SUSPENDED version (`authorizationService.ts`, `addClientPurpose`, ~866-882), and purpose-process `isDeletable` (`validators.ts`, 233-238) allows deletion only when every version is draft or waiting for approval, so a linked purpose cannot be deleted from the UI. | — | — |
| `purposeRouter` | `POST /reverse/purposes/{purposeId}` | `reversePurposeUpdate` (`purposeService.ts`, ~674) throws when `getCurrentVersion` finds no version in the purpose returned by purpose-process after `updateReversePurpose`, i.e. when every version is WAITING_FOR_APPROVAL or REJECTED, or the list is empty. | Cannot happen — purpose-process `performUpdatePurpose` (`purposeService.ts`, 2716) accepts only purposes whose versions are all DRAFT (`assertPurposeIsDraft`, `validators.ts`, 218) and returns the updated version still in DRAFT, which `getCurrentVersion` (BFF `purposeService.ts`, 145-158) does not exclude. A reverse purpose is always created with one DRAFT version (`createReversePurpose`, `purposeService.ts`, ~2059-2071), so the list is never empty. | — | — |

## `agreementDescriptorNotFound`

Descriptor of agreement not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `agreementRouter` | `POST /agreements/{agreementId}/update` | After `updateAgreement` (`agreementService.ts`) succeeds in agreement-process, `enrichAgreement` calls `getCurrentDescriptor` (`agreementService.ts`), which throws when `agreement.descriptorId` is not among the descriptors of the e-service returned by catalog-process. | Cannot happen — the update payload only carries `consumerNotes` (`agreement.services.ts` `updateDraft`), so `descriptorId` is never changed from the UI. The draft agreement references a descriptor that was non-draft when created (`agreement-validators.ts`, `validateDescriptorState` on the recent active descriptor), and catalog-process deletes only draft descriptors (`catalogService.ts`, `deleteDraftDescriptor` rejects non-draft with `notValidDescriptorState`), so that descriptor stays in the e-service's list. | — | — |
| `agreementRouter` | `POST /agreements/{agreementId}/upgrade` | After `upgradeAgreement` (`agreementService.ts`, 422) succeeds in agreement-process, `enrichAgreement` (840) calls `getCurrentDescriptor` (1050-1061), which throws when the agreement's `descriptorId` is not among the descriptors of the e-service returned by catalog-process. | Cannot happen — agreement-process upgrades to a PUBLISHED descriptor (`agreement-process/src/services/agreementService.ts`, 792-832), and the FE offers the upgrade only when `canAgreementBeUpgraded` (`src/utils/agreement.utils.ts`, 85-97) holds, i.e. the e-service's active descriptor is PUBLISHED or SUSPENDED. Catalog-process deletes only draft descriptors, so the descriptor stays in the e-service's list. A backend read-model lag between the agreement write and the catalog read is a timing matter, not a normal UI path. | — | — |

## `eServiceNotFound`

E-service not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `clientRouter` | `POST /clients/{clientId}/admin` | `enhancePurposes` (`clientService.ts`) throws when the e-service of a purpose linked to the client is not returned by catalog-process for the requester. | Cannot happen — a linked purpose has an ACTIVE or SUSPENDED version, which requires a PUBLISHED descriptor, and descriptors never return to draft. The consumer catalog view (`readModelServiceSQL.ts`, `getEServices`, ~690-705) shows an e-service with any descriptor in `activeDescriptorStates` (`catalog-process/src/services/descriptorStates.ts`, 3-8: published, suspended, deprecated, archived). The only uncovered state is the brief transitional `archiving`, which is a backend timing matter, not a normal UI path. | — | — |
| `purposeRouter` | `GET /purposes/{purposeId}` | `enhancePurpose` (`purposeService.ts`, 236-239) throws when no e-service in the list matches `purpose.eserviceId`. | Cannot happen — `getPurpose` (`purposeService.ts`, 1041-1048) fetches the e-service by `purpose.eserviceId` from catalog-process, so the id always matches; if that fetch fails, the process error is returned and this guard is never reached. | — | — |

## `tenantNotFound`

Tenant not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeRouter` | `GET /purposes/{purposeId}` | `enhancePurpose` (`purposeService.ts`, 244 for the producer, 249 for the consumer) and `enrichPurposeDelegation` (`purposeService.ts`, 81 and 84) throw when a tenant is not found in the lists passed to them. | Cannot happen — `getPurpose` (`purposeService.ts`, 1049-1062) fetches the consumer and the producer by id through `tenantProcessClient.tenant.getTenant`, so a missing tenant makes the process call fail before these guards run. The producer id comes from the e-service returned by catalog-process in the same request. | — | — |

## `agreementNotFound`

Agreement not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeRouter` | `GET /purposes/{purposeId}` | `enhancePurpose` (`purposeService.ts`, 260) throws when `getLatestAgreement` (`agreementService.ts`, 706) returns no agreement for the consumer and e-service. | Cannot happen — `getLatestAgreement` is called with `exact=true` and no state filter (`agreementService.ts`, 52 and 706), so it finds any agreement of the consumer for the e-service. A purpose can be created only while an ACTIVE agreement exists (`retrieveActiveAgreement`, purpose-process `purposeService.ts`, 298-308, used at creation, ~1968), and agreements are deletable only in draft, missingCertifiedAttributes or pending states (`agreement-validators.ts`, 108-112), which an agreement with a purpose never has. | — | — |

## `eserviceDescriptorNotFound`

EService descriptor not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeRouter` | `GET /purposes/{purposeId}` | `enhancePurpose` (`purposeService.ts`, 267) throws when the descriptor of the latest agreement is not among the descriptors of the e-service returned by catalog-process. | Cannot happen — the latest agreement references a descriptor that was active when the agreement was created or upgraded (a purpose requires an ACTIVE agreement, see `agreementNotFound` above), and catalog-process deletes only draft descriptors, so that descriptor stays in the e-service's list. | — | — |

## `noVersionInEServiceTemplate`

No version found in the e-service template.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `eserviceTemplateRouter` | `POST /eservices/templates/{eServiceTemplateId}/versions` | `createEServiceTemplateVersion` (`eserviceTemplateService.ts`, 499-514) reads the template from template-process and throws when `versions` is empty. | Cannot happen — template-process never persists a template with zero versions: creation seeds one draft version (`eserviceTemplateService.ts`, `createEServiceTemplate`, `versions: [draftVersion]`), deleting the last version emits a template-deletion event instead of leaving it empty (`deleteVersionDraft`, `isLastVersion`, ~973-985), and `deleteEServiceTemplate` with versions emits the template deletion in the same transaction (~2282-2300). The FE action that calls this endpoint (`useGetProviderEServiceTemplateActions.ts`, `createNewDraftAction`) is shown only when the template has no draft and is rendered from the template it just loaded. | — | — |

## `missingDescriptorInClonedEservice`

Missing descriptor in cloned e-service.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `catalogRouter` | `POST /eservices/{eServiceId}/descriptors/{descriptorId}/clone` | `cloneEServiceByDescriptor` (`catalogService.ts`, 1493-1516) throws after catalog-process `cloneDescriptor` returns an e-service whose `descriptors` array is empty (`eService.descriptors.at(0)?.id` is undefined). | Cannot happen — catalog-process `cloneDescriptor` (`packages/catalog-process/src/services/catalogService.ts`, 2508-2620) always builds the cloned e-service with exactly one draft descriptor (`descriptors: [newDescriptor]`), so the guard is never hit on a successful clone. The FE fires the clone only from `handleClone` (`src/hooks/useGetProviderEServiceActions.ts`, 170-185), which reads the returned `descriptorId` to navigate. | — | — |

## `contractNotFound`

Contract not found for the agreement.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `agreementRouter` | `GET /agreements/{agreementId}/contract` | `getAgreementContract` (`agreementService.ts`) finds no `contract` on the agreement returned by agreement-process and the agreement is not ACTIVE, SUSPENDED or ARCHIVED. | Cannot happen — no FE call site for `GetAgreementContract`: `downloadContract` (`agreement.services.ts`) is wrapped only by `useDownloadContract` (`agreement.downloads.ts`), which is never called. The rendered download actions use `useDownloadSignedContract` (`/signedContract`) instead. | — | — |

## `contractException`

Contract not available for an agreement that should have one.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `agreementRouter` | `GET /agreements/{agreementId}/contract` | `getAgreementContract` (`agreementService.ts`) finds no `contract` on the agreement returned by agreement-process and the agreement is ACTIVE, SUSPENDED or ARCHIVED. | Cannot happen — no FE call site for `GetAgreementContract`: `downloadContract` (`agreement.services.ts`) is wrapped only by `useDownloadContract` (`agreement.downloads.ts`), which is never called. | — | — |

## `delegationContractNotFound`

Delegation contract not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `delegationRouter` | `GET /delegations/{delegationId}/signedContract/{contractId}` | `getDelegationSignedContract` (`delegationService.ts`, 332-367) fetches the delegation from delegation-process and throws when `contractId` matches neither `activationSignedContract` nor `revocationSignedContract` (`delegationService.ts`, 351-357). | Cannot happen — the page takes `contractId` from `delegation.activationSignedContract?.id` / `delegation.revocationSignedContract?.id` of the same `DelegationQueries.getSingle` data it renders (`DelegationGeneralInfoSection.tsx`, `handleDownloadSignedDelegationDocument` / `handleDownloadRevokeSignedDelegationDocument`), which return early when the contract is absent, and the buttons are disabled when `isDocumentReady === false`. Signed contract ids are written once per state transition (`internalAddDelegationSignedContract`, `delegation-process/src/services/delegationService.ts`, 476), so the id the page holds is the one the BFF matches. | — | — |

## `eserviceTemplateNotFound`

E-service template not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `catalogRouter` | `GET /templates/{templateId}/eservices` | `getEServiceTemplateInstances` (`catalogService.ts`, 2269) calls `retrieveEServiceTemplate` (`eserviceTemplateService.ts`, 781), which throws when the template-process lookup returns no template. In practice the process 404 (`eserviceTemplateNotFound`) is passed through by the error builder (`models/src/errors.ts`, `problemErrorsPassthrough`) and mapped to 404 by `getEServiceTemplateInstancesErrorMapper` (`utilities/errorMappers.ts`, 299). | Cannot happen — no UI action deletes an e-service template. The FE has no delete-template mutation (`eserviceTemplate.mutations.ts` exposes only risk-analysis and draft-document deletes), and the template-process `deleteEServiceTemplate` (`eserviceTemplateService.ts`, 2246-2264) is reached only for a draft template, which is removed only when it has zero versions; the UI removes versions, which leaves the template in place. The Provider tenants tab (`ProviderEServiceTemplateDetails.page.tsx`) reads the template the page is already showing. | — | — |
| `catalogRouter` | `GET /templates/{templateId}/myInstances` | `getMyEServiceTemplateInstances` (`catalogService.ts`, 2359) calls `retrieveEServiceTemplate` (`eserviceTemplateService.ts`, 781), which throws when the template-process lookup returns no template. Same passthrough and 404 mapping as above. | Cannot happen — the consumer sees only published templates, which cannot be deleted (the template-process delete accepts only drafts with zero versions), and the Consumer instances tab (`ConsumerEServiceTemplateDetails.page.tsx`, 86-88) renders only when `isAvailableAtLeastOneInstance` holds, reading the template it already loaded. No UI action removes the template. | — | — |
