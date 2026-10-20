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
| `purposeTemplateRouter` | `GET /purposeTemplates/{purposeTemplateId}/linkableResources` | `enrichLinkableResourcePage`, called by `getPurposeTemplateLinkableResources`, throws `eServiceNotFound` when a purpose-template-process link has an `eserviceId` absent from the e-services returned by catalog-process for the linked IDs. | **CAN HAPPEN** — a linked e-service can disappear from catalog-process while its purpose-template link remains; the linked-resource query maps this error to 404 and the FE displays its orphan-resource warning. | **Data precondition:** Tenant A has an allowed UI role and can view a published purpose template whose purpose-template-process record still links an e-service that catalog-process no longer returns.<br>1. Open **Fruizione** > **Template finalità**.<br>2. Open that published template from the catalog.<br>3. Select **E-service e template e-service suggeriti**. The page requests linked resources and encounters the stale e-service link. | 🔴 **Impossible resolution** — 1. Contact support to restore the e-service record or remove the stale purpose-template link. |

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
| `purposeTemplateRouter` | `GET /purposeTemplates/{purposeTemplateId}/linkableResources` | `enrichLinkableResourcePage`, called by `getPurposeTemplateLinkableResources`, throws `eserviceDescriptorNotFound` when the linked e-service is returned by catalog-process but its `descriptors` contain no descriptor matching the link's `descriptorId`. | **CAN HAPPEN** — the linked-resource query fetches the current e-service after reading the stored link, so a stale descriptor link can produce this 404; the FE displays its orphan-resource warning. | **Data precondition:** Tenant A has an allowed UI role and can view a published purpose template whose stored e-service link references a descriptor ID absent from the current e-service returned by catalog-process.<br>1. Open **Fruizione** > **Template finalità**.<br>2. Open that published template from the catalog.<br>3. Select **E-service e template e-service suggeriti**. The page requests linked resources and encounters the stale descriptor link. | 🔴 **Impossible resolution** — 1. Contact support to reconcile the stale link or restore the descriptor. |

## `eserviceTemplateVersionNotFound`

EService template version not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeTemplateRouter` | `GET /purposeTemplates/{purposeTemplateId}/linkableResources` | `enrichLinkableResourcePage`, called by `getPurposeTemplateLinkableResources`, throws `eserviceTemplateVersionNotFound` when catalog data contains the linked e-service template but none of its `versions` match the link's `eserviceTemplateVersionId`. | **CAN HAPPEN** — the linked-resource query fetches current template data after reading the stored link, so a stale version link can produce this 404; the FE displays its orphan-resource warning. | **Data precondition:** Tenant A has an allowed UI role and can view a published purpose template whose stored template link references a version ID absent from the current template returned by e-service-template-process.<br>1. Open **Fruizione** > **Template finalità**.<br>2. Open that published template from the catalog.<br>3. Select **E-service e template e-service suggeriti**. The page requests linked resources and encounters the stale version link. | 🔴 **Impossible resolution** — 1. Contact support to reconcile the stale link or restore the version. |

## `eserviceTemplateNotFound`

EService template not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `purposeTemplateRouter` | `GET /purposeTemplates/{purposeTemplateId}/linkableResources` | `enrichLinkableResourcePage`, called by `getPurposeTemplateLinkableResources`, throws `eserviceTemplateNotFound` when a purpose-template-process link's `eserviceTemplateId` is absent from the e-service templates returned by e-service-template-process for the linked IDs. | **CAN HAPPEN** — a linked template can disappear from e-service-template-process while its purpose-template link remains; the linked-resource query maps this error to 404 and the FE displays its orphan-resource warning. | **Data precondition:** Tenant A has an allowed UI role and can view a published purpose template whose purpose-template-process record still links an e-service template that e-service-template-process no longer returns.<br>1. Open **Fruizione** > **Template finalità**.<br>2. Open that published template from the catalog.<br>3. Select **E-service e template e-service suggeriti**. The page requests linked resources and encounters the stale template link. | 🔴 **Impossible resolution** — 1. Contact support to restore the e-service template record or remove the stale purpose-template link. |
