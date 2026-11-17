# BFF errors mapping

> **Not documented**:
> - Authentication: —
> - Infrastructure: `selfcareEntityNotFilled`, `dynamoReadingError`, `missingInterface`, `noDescriptorInEservice`, `missingDescriptorInClonedEservice`, `missingSelfcareId`, `privacyNoticeVersionIsNotTheLatest`, `missingActivePurposeVersion`, `activeAgreementByEserviceAndConsumerNotFound`, `cannotGetKeyWithClient`, `clientAssertionPublicKeyNotFound`, `delegatedEserviceNotExportable`, `missingUserRolesInIdentityToken`, `noVersionInEServiceTemplate`, `delegationContractNotFound`
> - Unused (no throw site in the BFF): `invalidJwtClaim`, `tooManyDescriptorForInterfaceWithTemplate`, `eserviceTemplateInterfaceNotFound`, `invalidInterfaceFile`, `eserviceTemplateInterfaceDataNotValid`, `operationForbidden`
>
> Routers covered: `purposeTemplateRouter`.

## `eServiceNotFound`

EService not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeTemplateRouter` | `GET /purposeTemplates/{purposeTemplateId}/linkableResources` | `enrichLinkableResourcePage`, called by `getPurposeTemplateLinkableResources`, throws `eServiceNotFound` when a purpose-template-process link has an `eserviceId` absent from the e-services returned by catalog-process for the linked IDs. | Cannot happen — The FE does't permit this operation. | — | — |

## `tenantNotFound`

Tenant not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeTemplateRouter` | `GET /catalog/purposeTemplates` | `getCatalogPurposeTemplates` throws `tenantNotFound` if its creator-tenant map lacks a returned template's `creatorId`. The map is built by `getTenantsFromPurposeTemplates`, which requests each creator ID returned by purpose-template-process. | Cannot happen — the FE filters the catalog but cannot alter the creator IDs returned by purpose-template-process; each successful tenant lookup is indexed by its returned ID, while a missing tenant makes the tenant-process request fail before this BFF guard. | — | — |
| `purposeTemplateRouter` | `GET /purposeTemplates/{purposeTemplateId}/linkableResources` | `enrichLinkableResourcePage`, called by `getPurposeTemplateLinkableResources`, throws `tenantNotFound` if the producer or template creator is absent from `tenantById` after tenant-process lookups for the owner IDs of the fetched resources. | Cannot happen — the FE does not provide the owner IDs; the BFF requests each ID from the fetched resources, and a missing tenant makes that lookup fail before this BFF guard. | — | — |
| `purposeTemplateRouter` | `GET /purposeTemplates/{purposeTemplateId}` | `getPurposeTemplate` throws `tenantNotFound` if the creator lookup returns no tenant for the `creatorId` in the purpose template returned by purpose-template-process. | Cannot happen — the FE opens a template selected from the catalog or the signed-in creator's list; `getTenant` returns a tenant on success and fails at the tenant-process call if it is missing, before this BFF guard. | — | — |

## `eserviceDescriptorNotFound`

EService descriptor not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeTemplateRouter` | `GET /purposeTemplates/{purposeTemplateId}/linkableResources` | `enrichLinkableResourcePage`, called by `getPurposeTemplateLinkableResources`, throws `eserviceDescriptorNotFound` when the linked e-service is returned by catalog-process but its `descriptors` contain no descriptor matching the link's `descriptorId`. | Cannot happen — The FE does't permit this operation. | — | — |

## `eserviceTemplateVersionNotFound`

EService template version not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeTemplateRouter` | `GET /purposeTemplates/{purposeTemplateId}/linkableResources` | `enrichLinkableResourcePage`, called by `getPurposeTemplateLinkableResources`, throws `eserviceTemplateVersionNotFound` when catalog data contains the linked e-service template but none of its `versions` match the link's `eserviceTemplateVersionId`. | Cannot happen — The FE does't permit this operation. | — | — |

## `eserviceTemplateNotFound`

EService template not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeTemplateRouter` | `GET /purposeTemplates/{purposeTemplateId}/linkableResources` | `enrichLinkableResourcePage`, called by `getPurposeTemplateLinkableResources`, throws `eserviceTemplateNotFound` when a purpose-template-process link's `eserviceTemplateId` is absent from the e-service templates returned by e-service-template-process for the linked IDs. | Cannot happen — The FE does't permit this operation. | — | — |
