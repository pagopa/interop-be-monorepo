# BFF errors mapping

> **Not documented**:
> - Authentication: —
> - Infrastructure: `activeAgreementByEserviceAndConsumerNotFound`, `cannotGetKeyWithClient`, `clientAssertionPublicKeyNotFound`, `delegatedEserviceNotExportable`, `delegationContractNotFound`, `dynamoReadingError`, `missingActivePurposeVersion`, `missingDescriptorInClonedEservice`, `missingInterface`, `missingSelfcareId`, `missingUserRolesInIdentityToken`, `noDescriptorInEservice`, `noVersionInEServiceTemplate`, `privacyNoticeVersionIsNotTheLatest`, `selfcareEntityNotFilled`
> - Unused (no throw site in the BFF): `invalidJwtClaim`, `tooManyDescriptorForInterfaceWithTemplate`, `eserviceTemplateInterfaceNotFound`, `invalidInterfaceFile`, `eserviceTemplateInterfaceDataNotValid`, `operationForbidden`
>
> Routers covered: `purposeRouter`.

## `purposeNotFound`

Purpose not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeRouter` | `POST /reverse/purposes/{purposeId}` | `reversePurposeUpdate` throws `purposeNotFound` when `updateReversePurpose` succeeds but `getCurrentVersion(updatedPurpose.versions)` finds no version other than `WAITING_FOR_APPROVAL` or `REJECTED` (including an empty version list). | Cannot happen — the admin-only purpose edit page selects this endpoint only for an e-service in `RECEIVE` mode. Its form submits editable purpose fields; version states come from the purpose-process response, and a valid draft update must return a current version. | — | — |

## `eServiceNotFound`

E-service not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeRouter` | `GET /producers/purposes` | `enhancePurpose` throws `eServiceNotFound` if no fetched catalog e-service has the `eserviceId` from a returned purpose. `getPurposes` fetches catalog e-services by the IDs from those same purpose results before calling `enhancePurpose`. | Cannot happen — the FE supplies no e-service ID for this lookup; the BFF fetches each e-service using the ID in the purpose-process result, and a failed catalog lookup rejects before `enhancePurpose` runs. | — | — |
| `purposeRouter` | `GET /consumers/purposes` | `enhancePurpose` throws `eServiceNotFound` if no fetched catalog e-service has the `eserviceId` from a returned purpose. `getPurposes` fetches catalog e-services by the IDs from those same purpose results before calling `enhancePurpose`. | Cannot happen — the FE supplies no e-service ID for this lookup; the BFF fetches each e-service using the ID in the purpose-process result, and a failed catalog lookup rejects before `enhancePurpose` runs. | — | — |
| `purposeRouter` | `GET /purposes/riskAnalysis/assignments` | `getRiskAnalysisAssignments` calls `getPurposes`, where `enhancePurpose` throws `eServiceNotFound` if the fetched catalog e-services do not contain a purpose's `eserviceId`. | Cannot happen — the FE's risk-analysis filters do not provide the purpose's linked e-service ID to the BFF lookup; `getPurposes` fetches that ID from each returned purpose, and a failed catalog lookup rejects before `enhancePurpose` runs. | — | — |
| `purposeRouter` | `GET /purposes/{purposeId}` | `enhancePurpose` throws `eServiceNotFound` if the fetched catalog e-service list does not contain the purpose's `eserviceId`. `getPurpose` fetches the catalog e-service using that exact ID and passes it as the sole list entry. | Cannot happen — the e-service ID comes from the purpose returned by purpose-process, and `getPurpose` passes the successful catalog lookup result directly to `enhancePurpose`; the UI cannot provide a second, mismatched ID. | — | — |

## `tenantNotFound`

Tenant not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeRouter` | `GET /producers/purposes` | In `enhancePurpose`, a producer or consumer lookup is missing from the fetched tenant lists; or, for a delegated purpose, `enrichPurposeDelegation` throws when the delegation's delegate or delegator cannot be retrieved from tenant-process. | Cannot happen — the UI provides no tenant IDs to these lookups and has no action to remove a tenant referenced by a purpose or delegation; the BFF derives IDs from purpose, e-service, and delegation-process data. | — | — |
| `purposeRouter` | `GET /consumers/purposes` | In `enhancePurpose`, a producer or consumer lookup is missing from the fetched tenant lists; or, for a delegated purpose, `enrichPurposeDelegation` throws when the delegation's delegate or delegator cannot be retrieved from tenant-process. | Cannot happen — the UI provides no tenant IDs to these lookups and has no action to remove a tenant referenced by a purpose or delegation; the BFF derives IDs from purpose, e-service, and delegation-process data. | — | — |
| `purposeRouter` | `GET /purposes/riskAnalysis/assignments` | `getRiskAnalysisAssignments` calls `getPurposes`, where `enhancePurpose` throws if a producer or consumer lookup is missing; `enrichPurposeDelegation` also throws if a delegated purpose's delegate or delegator cannot be retrieved from tenant-process. | Cannot happen — the risk-analysis page supplies only e-service and signing-state filters, not tenant IDs; tenant IDs come from the purpose and delegation records, and the UI has no action to remove those tenants. | — | — |
| `purposeRouter` | `GET /purposes/{purposeId}` | `getPurpose` loads the purpose's consumer and e-service producer, then `enhancePurpose` throws if either tenant lookup is missing; `enrichPurposeDelegation` throws if a delegated purpose's delegate or delegator cannot be retrieved from tenant-process. | Cannot happen — the detail pages take `purposeId` from a purpose selected from a BFF result or its route; the UI has no control for changing or removing the purpose's tenant references or delegation tenants. | — | — |

## `agreementNotFound`

Agreement not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeRouter` | `GET /producers/purposes` | `enhancePurpose` throws `agreementNotFound` when `getLatestAgreement(agreementProcessClient, purpose.consumerId, true, eservice, headers)` returns no agreement for a returned purpose. | Cannot happen — the producer page filters purposes but does not supply or delete agreements; normal agreement state changes retain the agreement record, which `getLatestAgreement` searches without filtering by state. | — | — |
| `purposeRouter` | `GET /consumers/purposes` | `enhancePurpose` throws `agreementNotFound` when `getLatestAgreement(agreementProcessClient, purpose.consumerId, true, eservice, headers)` returns no agreement for a returned purpose. | Cannot happen — the consumer page filters purposes but does not supply or delete agreements; normal agreement state changes retain the agreement record, which `getLatestAgreement` searches without filtering by state. | — | — |
| `purposeRouter` | `GET /purposes/riskAnalysis/assignments` | `getRiskAnalysisAssignments` calls `getPurposes`, where `enhancePurpose` throws `agreementNotFound` when `getLatestAgreement` finds no agreement for the purpose's consumer and e-service. | Cannot happen — the risk-analysis page filters by e-service and signing state only; it cannot remove or replace an agreement, and agreement state changes do not remove the record searched by `getLatestAgreement`. | — | — |
| `purposeRouter` | `GET /purposes/{purposeId}` | `enhancePurpose` throws `agreementNotFound` when `getLatestAgreement(agreementProcessClient, purpose.consumerId, true, eservice, headers)` returns no agreement for the purpose. | Cannot happen — the purpose detail page does not supply agreement identifiers or mutate agreements; the BFF searches existing agreement records for the purpose's consumer and e-service, regardless of agreement state. | — | — |
