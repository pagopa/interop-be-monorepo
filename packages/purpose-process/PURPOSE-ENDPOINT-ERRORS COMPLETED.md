## 1. `GET /purposes`

Service: `purposeService` → `getPurposes`. Mapper: `getPurposesErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`, `REVIEWER_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | Dead mapper entry — `getPurposes` only queries the read model with filters and returns a list; it never resolves a specific purpose ID or invokes `retrievePurpose`. | Cannot happen — there is no throw site in this method, and the UI does not call a single-purpose lookup through this endpoint. | — | — |
| `purposeVersionNotFound` | 404 | Dead mapper entry — `getPurposes` does not inspect a purpose version, so no code path in this method throws `purposeVersionNotFound`. | Cannot happen — the endpoint never resolves a version ID or a specific version document. | — | — |
| `purposeVersionDocumentNotFound` | 404 | Dead mapper entry — this endpoint is not a document-download route and never calls the purpose-version document lookup helpers. | Cannot happen — there is no document fetch branch in `getPurposes`. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry — the list endpoint does not perform the cross-tenant authorization checks used by the single-purpose retrieval flow. | Cannot happen — authorization is checked by the read-model query, not by a throw in `getPurposes`. | — | — |

## 2. `POST /purposes`

Service: `purposeService` → `createPurpose`. Mapper: `createPurposeErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposes`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantIsNotTheConsumer` | 403 | The requester is not the consumer of the e-service and there is no active delegated consumer relationship (`verifyRequesterIsConsumerOrDelegateConsumer`). | Cannot happen — the FE only offers the create-purpose flow for the active consumer org and the route guard rejects non-consumer access before the request reaches the process. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | The requester is acting as a delegate but is not the active delegated consumer for the selected e-service (`assertRequesterIsDelegateConsumer`). | Cannot happen — the FE only sends the current consumer/delegate context for the selected e-service, and the role guard blocks any other org from entering the flow. | — | — |
| `invalidFreeOfChargeReason` | 400 | `assertConsistentFreeOfCharge` throws when `isFreeOfCharge` is `false` but a reason is still present. | Cannot happen — the UI normalizes the payload by omitting `freeOfChargeReason` when the switch is off, and the create form only sends a reason when the free-of-charge option is enabled. | — | — |
| `missingFreeOfChargeReason` | 400 | `assertConsistentFreeOfCharge` throws when `isFreeOfCharge` is `true` but no reason was provided. | Cannot happen — the create form forces a reason when the free-of-charge toggle is enabled and the payload includes a default reason for the draft creation flow. | — | — |
| `agreementNotFound` | 400 | The consumer has no active agreement for the selected e-service (`retrieveActiveAgreement`). | Cannot happen — the FE only offers e-services with an active agreement in the purpose-creation flow and blocks selection of the otherwise invalid combination. | — | — |
| `riskAnalysisValidationFailed` | 400 | `validateRiskAnalysisOrThrow` rejects the risk-analysis form when the submitted answers fail schema or business validation. | Cannot happen — the FE block this operation. | — | — |
| `riskAnalysisTenantKindMismatch` | 400 | `assertRiskAnalysisTenantKindMatch` rejects a risk-analysis form whose tenant kind does not match the current tenant kind. | Cannot happen — the FE derives the tenant kind from the current org and sends the same normalized value in the risk-analysis payload, so the mismatch cannot be created through the normal form. | — | — |
| `duplicatedPurposeTitle` | 409 | `assertPurposeTitleIsNotDuplicated` finds an existing purpose with the same title for the same consumer and e-service. | **CAN HAPPEN** — the title is free text and the create form does not enforce uniqueness client-side. | **Data precondition:** consumer A already has a purpose with the same title for e-service E.<br>1. Go to the consumer purpose creation page from the side menu.<br>2. Select tenant A and e-service E.<br>3. Type the existing title in the purpose name field.<br>4. Click _Crea bozza_ or the final save action. | 🟢 Easy resolution <br />1. Change the purpose title to a unique value.<br>2. Save the draft again with the corrected title. |

## 3. `POST /reverse/purposes`

Service: `purposeService` → `createReversePurpose`. Mapper: `createReversePurposeErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantIsNotTheConsumer` | 403 | The requester is not the consumer and no active delegated consumer relationship exists (`verifyRequesterIsConsumerOrDelegateConsumer`). | Cannot happen — the receive-mode purpose flow is only surfaced for the current consumer org and the route guard rejects non-consumer access. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | The user is acting as a delegate but is not the active delegated consumer for the selected receive-mode e-service (`assertRequesterIsDelegateConsumer`). | Cannot happen — the flow is bound to the selected consumer/delegate context and the UI does not expose the invalid delegation state. | — | — |
| `eserviceNotFound` | 400 | `retrieveEService` cannot find the selected e-service for the reverse purpose creation flow. | Cannot happen — the UI only lets the user pick an existing e-service returned by the catalog, and the selection is blocked if the e-service does not exist. | — | — |
| `eServiceModeNotAllowed` | 400 | `assertEserviceMode` throws when the selected e-service is not in `receive` mode. | Cannot happen — the receive-purpose creation flow only offers receive-mode e-services and does not allow a deliver-mode selection in this path. | — | — |
| `eserviceRiskAnalysisNotFound` | 400 | The selected receive-mode e-service has no attached risk-analysis configuration (`retrieveRiskAnalysis`). | Cannot happen — the FE only exposes the receive-mode purpose creation flow for e-services that already have a risk-analysis document. | — | — |
| `invalidFreeOfChargeReason` | 400 | `assertConsistentFreeOfCharge` throws when `isFreeOfCharge` is `false` but a reason is still provided. | Cannot happen — the receive-purpose form omits or normalizes `freeOfChargeReason` when the switch is off before the request is sent. | — | — |
| `missingFreeOfChargeReason` | 400 | `assertConsistentFreeOfCharge` throws when `isFreeOfCharge` is `true` and no reason is present. | Cannot happen — the receive-purpose form requires the reason when the free-of-charge toggle is enabled and does not send an empty value. | — | — |
| `agreementNotFound` | 400 | `retrieveActiveAgreement` cannot find an active agreement for the e-service/consumer pair. | Cannot happen — the receive-purpose flow is only available for a selected e-service that already has a valid active agreement. | — | — |
| `riskAnalysisValidationFailed` | 400 | `validateRiskAnalysisOrThrow` rejects the risk-analysis answers for the reverse-purpose creation flow. | Cannot happen — the FE block this operati| — | — |
| `riskAnalysisTenantKindMismatch` | 400 | `assertRiskAnalysisTenantKindMatch` rejects a form whose tenant kind does not match the current tenant kind. | Cannot happen — the receive-mode flow uses the current tenant kind when building the risk-analysis payload and does not let the user supply a mismatched value. | — | — |
| `duplicatedPurposeTitle` | 409 | `assertPurposeTitleIsNotDuplicated` finds an existing purpose with the same title for the same consumer and e-service. | **CAN HAPPEN** — the purpose name is free text and the create form does not enforce title uniqueness client-side. | **Data precondition:** consumer A already has a purpose with the same title for the receive-mode e-service E.<br>1. Go to the receive-purpose creation page from the side menu.<br>2. Select tenant A and e-service E.<br>3. Enter the existing title.<br>4. Click the final save action. | 🟢 Easy resolution <br />1. Change the title to a unique value.<br>2. Save the draft again with the corrected title. |

## 4. `POST /reverse/purposes/:id`

Service: `purposeService` → `updateReversePurpose`. Mapper: `updateReversePurposeErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `POST /reverse/purposes/:purposeId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | Dead mapper entry — `retrievePurpose(purposeId, readModelService)` is the first guard in the update flow, but this route is only invoked from an already selected draft purpose and never from a user-created arbitrary ID. | Cannot happen — the FE only opens the action from a purpose already loaded in the current route or selection, and the form never lets the user enter a different purpose ID. | — | — |
| `eserviceNotFound` | 404 | Dead mapper entry — `retrieveEService(purpose.data.eserviceId, readModelService)` runs after the purpose is retrieved, so it only triggers for a stale or inconsistent purpose record, not a normal user edit. | Cannot happen — the edit form is bound to the current purpose and its e-service is already loaded by the page; the user cannot choose an e-service that does not exist from the normal receive-purpose update flow. | — | — |
| `tenantKindNotFound` | 404 | Dead mapper entry — `retrieveKindOfInvolvedTenantByEServiceMode` resolves the tenant kind for the receive-mode e-service and throws only if the tenant record is missing a kind. | Cannot happen — the FE acts on a currently valid tenant and e-service pair; a missing tenant kind is a backend data integrity issue, not a normal UI action. | — | — |
| `unableToDetermineTenantKind` | 404 | Dead mapper entry — this branch is only used in the maintenance risk-analysis repair flow, not in the draft-update path, which resolves the tenant kind directly from the current e-service mode. | Cannot happen — the receive-mode update path never computes a historical or fallback tenant kind; it resolves the current involved tenant from the loaded e-service record. | — | — |

## 5. `PATCH /reverse/purposes/:id`

Service: `purposeService` → `patchUpdateReversePurpose`. Mapper: `updateReversePurposeErrorMapper`. Roles: `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | Dead mapper entry — the patch flow reuses `performUpdatePurpose` and starts by loading the existing purpose via `retrievePurpose`, which only fails for an invalid or stale purpose ID. | Cannot happen — the M2M-admin flow is invoked only for an already known purpose reference and never from a user typed ID in the UI. | — | — |
| `eserviceNotFound` | 404 | Dead mapper entry — after the purpose is loaded, the handler fetches the associated e-service and fails only if the e-service record was removed or the state is inconsistent. | Cannot happen — the patch request is sent against a purpose that already belongs to the current e-service context; there is no editable e-service selector in this route. | — | — |
| `tenantKindNotFound` | 404 | Dead mapper entry — `retrieveKindOfInvolvedTenantByEServiceMode` checks the partner tenant kind for the receive-mode purpose and throws if the tenant record lacks a kind. | Cannot happen — this route is not exposed in the normal UI and the backend has already resolved a valid tenant/e-service pair before the call is made. | — | — |
| `unableToDetermineTenantKind` | 404 | Dead mapper entry — the receive-mode patch flow does not compute a fallback tenant kind from historical dates, so this branch is not reached here. | Cannot happen — the route uses the current receive-mode context instead of a historical lookup and therefore does not generate this error in the UI path. | — | — |

## 6. `GET /purposes/:purposeId/remainingDailyCalls`

Service: `purposeService` → `getRemainingDailyCalls`. Mapper: `getRemainingDailyCallsErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `GET /purposes/:purposeId/remainingDailyCalls`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails when the purpose no longer exists in the read model. | Cannot happen — the FE only calls this operation from an already loaded purpose on the consumer details or summary screens, and the user cannot submit a non-existent purpose ID through the normal UI. | — | — |
| `eserviceNotFound` | 404 | `retrieveEService(purpose.data.eserviceId, readModelService)` fails if the purpose points to a deleted or missing e-service. | Cannot happen — the page loads the purpose and its e-service from the same backend state before showing the action, so the user cannot reach a broken e-service record through a normal interaction. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the caller when the requester is not the consumer or delegated consumer for that purpose. | Cannot happen — the UI is only rendered for the consumer side of the purpose and the route guard blocks any non-consumer org from opening the drawer or summary section. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the delegated caller when the current delegation is not the active delegated consumer for the purpose. | Cannot happen — the FE only shows the current consumer/delegate context and does not expose an action for a different delegation in the normal UI. | — | — |
| `agreementNotFound` | 400 | `retrieveActiveAgreement(eserviceId, consumerId, readModelService)` fails when there is no current active agreement for the consumer/e-service pair. | Cannot happen — the FE only renders the purpose daily-calls section for a purpose that already has an active agreement, and the user cannot select a purpose with no agreement from a normal UI flow. | — | — |

## 7. `GET /purposes/:id`

Service: `purposeService` → `getPurposeById`. Mapper: `getPurposeErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`, `REVIEWER_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails when the purpose ID is not present in the read model. | Cannot happen — the details page is opened from an already-selected purpose in the list/detail flow, and the normal UI never asks the user to type a purpose ID manually. | — | — |
| `tenantNotAllowed` | 403 | `assertRequesterCanRetrievePurpose` rejects the caller when none of the allowed tenants (consumer, producer, active consumer delegate, active producer delegate) matches the current organization. | Cannot happen — the route is only opened from the tenant's purpose list or detail flow, and the list is filtered by the current organization’s allowed purpose set. | — | — |

## 8. `POST /purposes/:id`

Service: `purposeService` → `updatePurpose`. Mapper: `updatePurposeErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `POST /purposes/:purposeId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `eServiceModeNotAllowed` | 400 | `assertEserviceMode` rejects the update when the associated e-service is not in `deliver` mode. | Cannot happen — the FE switches to the receive-purpose update call when `purpose.eservice.mode === 'RECEIVE'`, so the deliver-mode endpoint is never used for a receive-mode purpose. | — | — |
| `invalidFreeOfChargeReason` | 400 | `assertConsistentFreeOfCharge` throws when `isFreeOfCharge` is `false` but a free-of-charge reason is still present. | Cannot happen — the form strips `freeOfChargeReason` from the payload unless the switch is enabled (`...(isFreeOfCharge ? { freeOfChargeReason } : {})`), so the invalid payload is never sent by the UI. | — | — |
| `missingFreeOfChargeReason` | 400 | `assertConsistentFreeOfCharge` throws when `isFreeOfCharge` is `true` but the reason is missing. | Cannot happen — the free-of-charge reason field is marked as required in the general-information form, and the payload only includes that field when the toggle is enabled. | — | — |
| `riskAnalysisValidationFailed` | 400 | `validateRiskAnalysisOrThrow` rejects an incomplete or invalid risk-analysis form. | Cannot happen — the FE block this operation | — | — |
| `riskAnalysisTenantKindMismatch` | 400 | `assertRiskAnalysisTenantKindMatch` rejects a risk-analysis whose tenant-kind mismatch is inconsistent with the current tenant kind. | Cannot happen — the FE derives the tenant kind from the current organization and sends the existing form payload without allowing a mismatched tenant kind to be introduced manually. | — | — |
| `purposeNotInDraftState` | 400 | `assertPurposeIsDraft` rejects an update if the purpose is not currently in draft state. | Cannot happen — the edit page is only opened for the current draft purpose and the FE never offers the update mutation for a non-draft purpose. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the caller when the requester is not the consumer or an active delegated consumer. | Cannot happen — the route and list are limited to the current consumer organization, and the FE does not expose a cross-tenant edit action. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | `assertRequesterIsDelegateConsumer` rejects the delegated caller when the active delegation is not the current consumer delegation. | Cannot happen — the FE only operates with the selected purpose and its active consumer delegation; there is no way to switch to a different delegation from the normal edit flow. | — | — |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails when the purpose no longer exists at the time of update. | Cannot happen — the edit route is opened from a purpose already loaded in the FE, and the user cannot set a different purpose ID from the normal interaction. | — | — |
| `duplicatedPurposeTitle` | 409 | `assertPurposeTitleIsNotDuplicated` rejects a title already used by another purpose for the same consumer and e-service. | **CAN HAPPEN** — the title is free text and the UI does not enforce uniqueness before submitting the mutation. | **Data precondition:** tenant A already has another purpose for the same e-service with the title `X`.<br>1. Go to `/fruizione/finalita/:purposeId/modifica`.<br>2. In the field _Nome della finalità_, type `X`.<br>3. Click _Salva bozza e prosegui_. | 🟢 Easy resolution <br />1. Change the title to a unique value in _Nome della finalità_.<br>2. Save the draft again with the corrected name. |
| `purposeFromTemplateCannotBeModified` | 409 | A purpose created from a template is rejected because template-derived content cannot be modified through this update path. | Cannot happen — the FE does not offer a template-based purpose edit flow through this route, and the selection is blocked before the mutation is submitted. | — | — |
| `riskAnalysisFormCannotBeUpdated` | 409 | The backend rejects updates when the risk-analysis form is locked or cannot be modified in the current purpose state. | Cannot happen — the FE only submits the edit for a currently editable draft purpose and never enables a mutation when the form is locked. | — | — |

## 9. `PATCH /purposes/:id`

Service: `purposeService` → `patchUpdatePurpose`. Mapper: `updatePurposeErrorMapper`. Roles: `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `eServiceModeNotAllowed` | 400 | `assertEserviceMode` rejects the patch when the associated e-service is not in `deliver` mode. | Cannot happen — this is an M2M-admin endpoint, not surfaced by any frontend route or mutation. | — | — |
| `invalidFreeOfChargeReason` | 400 | `assertConsistentFreeOfCharge` throws when `isFreeOfCharge` is `false` but a free-of-charge reason is still supplied. | Cannot happen — this endpoint is not exposed in the FE and the UI never constructs that payload in a normal user flow. | — | — |
| `missingFreeOfChargeReason` | 400 | `assertConsistentFreeOfCharge` throws when `isFreeOfCharge` is `true` but the reason is missing. | Cannot happen — this endpoint is not exposed in the FE and the UI never sends that combination from a normal interaction. | — | — |
| `riskAnalysisValidationFailed` | 400 | `validateRiskAnalysisOrThrow` rejects an incomplete or invalid risk-analysis. | Cannot happen — the M2M-admin path is not reachable from any frontend form or route, and the UI cannot trigger it through a normal interaction. | — | — |
| `riskAnalysisTenantKindMismatch` | 400 | `assertRiskAnalysisTenantKindMatch` rejects a mismatched tenant kind in the risk-analysis payload. | Cannot happen — no frontend route or mutation calls this M2M endpoint, so the user cannot create that payload from the UI. | — | — |
| `purposeNotInDraftState` | 400 | `assertPurposeIsDraft` rejects the patch when the purpose is not in draft state. | Cannot happen — the FE never exposes a route for M2M partial updates of an existing purpose state. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the caller when the request does not match the current consumer. | Cannot happen — this route is not part of the browser UI and is only used in the M2M-admin backend flow. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | The delegated consumer check fails when the active delegation does not match the purpose. | Cannot happen — there is no frontend route or mutation that calls this M2M-admin endpoint; the UI never constructs the delegated-consumer context. | — | — |
| `purposeNotFound` | 404 | `retrievePurpose` fails when the purpose ID is stale or missing. | Cannot happen — the route is not reachable from the FE and the browser never passes an arbitrary purpose ID into this M2M-admin call. | — | — |
| `duplicatedPurposeTitle` | 409 | `assertPurposeTitleIsNotDuplicated` rejects a duplicate title for the same consumer and e-service. | Cannot happen — the M2M-admin patch endpoint is not used by any user-facing form or route. | — | — |
| `purposeFromTemplateCannotBeModified` | 409 | The purpose is rejected because it was created from a template and cannot be edited through this path. | Cannot happen — this path is not exposed by the frontend and the UI never invokes it for template-based purpose edits. | — | — |
| `riskAnalysisFormCannotBeUpdated` | 409 | The backend rejects updates when the risk-analysis form is locked or cannot be modified. | Cannot happen — the browser UI never invokes this M2M-admin patch endpoint for a purpose edit. | — | — |

## 10. `DELETE /purposes/:id`

Service: `purposeService` → `deletePurpose`. Mapper: `deletePurposeErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /purposes/:purposeId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose no longer exists in the read model. | Cannot happen — the FE only starts the delete action from an already loaded purpose on the consumer purpose list/details screens, and the normal UI never lets the user submit an arbitrary purpose ID. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the caller when the auth org is not the consumer and there is no valid active delegated-consumer relationship. | Cannot happen — the delete action is shown only in the consumer-purpose flow and the route/list context keeps the user on their own tenant. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | `assertRequesterIsDelegateConsumer` rejects the caller when the active delegation is not the current delegated consumer. | Cannot happen — the FE only exposes the delete action for the current consumer/delegate context, and the action is hidden when the delegation does not match. | — | — |
| `purposeCannotBeDeleted` | 409 | `isDeletable(purpose.data)` returns `false` when the purpose contains any version other than draft or waiting-for-approval. | Cannot happen — the consumer UI only renders the delete action for a draft or waiting-for-approval purpose, and the action is hidden for active/suspended/archived states. | — | — |

## 11. `POST /purposes/:purposeId/versions`

Service: `purposeService` → `createPurposeVersion`. Mapper: `createPurposeVersionErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposes/:purposeId/versions`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `unchangedDailyCalls` | 400 | `previousDailyCalls === seed.dailyCalls` when the user submits the same value as the current active/suspended daily-call estimate. | Cannot happen — the drawer validates `value !== currentDailyCalls` and blocks the same-value submission before the request is sent. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the caller when the auth org is not the consumer and there is no active delegated consumer relationship. | Cannot happen — the update-daily-calls drawer is only displayed in the consumer-purpose details flow, and the route/list context keeps the user on the current consumer org. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | `assertRequesterIsDelegateConsumer` rejects the delegated caller when the current delegation is not the active delegated consumer for the purpose. | Cannot happen — the FE only exposes the change-plan action for the current consumer/delegate context; there is no UI path to choose another delegation. | — | — |
| `purposeVersionStateConflict` | 409 | `conflictVersion` exists in draft or waiting-for-approval state when a new version is created. | Cannot happen — the change-plan drawer is only available when the purpose is not already in a conflicting draft/waiting-for-approval version state, and the action is hidden or disabled otherwise. | — | — |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose record is missing. | Cannot happen — the action is launched from an already selected purpose in the consumer details page, and the normal UI never lets the user submit an arbitrary purpose ID. | — | — |

## 12. `DELETE /purposes/:purposeId/versions/:versionId`

Service: `purposeService` → `deletePurposeVersion`. Mapper: `deletePurposeVersionErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /purposes/:purposeId/versions/:versionId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose no longer exists. | Cannot happen — the delete-version action is launched from the currently loaded purpose and the FE never exposes a way to type an arbitrary purpose ID. | — | — |
| `purposeVersionNotFound` | 404 | `retrievePurposeVersion(versionId, purpose)` fails because the selected version is not present in the purpose. | Cannot happen — the UI only offers delete for the currently loaded waiting-for-approval version and does not let the user select a nonexistent version from a normal interaction. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the caller when the auth org is not the consumer and there is no valid active delegated-consumer relationship. | Cannot happen — the delete-version action is only available in the consumer side of a purpose and the route/list context prevents cross-tenant access. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | `assertRequesterIsDelegateConsumer` rejects the delegate when the current delegation does not match the purpose’s delegated consumer. | Cannot happen — the FE only shows the action for the current consumer/delegate context, and there is no UI path to switch to a different delegation. | — | — |
| `purposeVersionCannotBeDeleted` | 409 | `isDeletableVersion(purposeVersion, purpose.data)` returns `false` when the version is not waiting-for-approval or when the purpose has only one version. | Cannot happen — the delete-version action is only rendered for a waiting-for-approval change request and is disabled for suspended or single-version cases. | — | — |

## 13. `GET /purposes/:purposeId/versions/:versionId/documents/:documentId`

Service: `purposeService` → `getRiskAnalysisDocument`. Mapper: `getRiskAnalysisDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /purposes/:purposeId/versions/:versionId/documents/:documentId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose record is missing. | Cannot happen — the document page is opened from an already selected purpose and the normal UI never lets the user type an arbitrary purpose ID. | — | — |
| `purposeVersionNotFound` | 404 | `retrievePurposeVersion(versionId, purpose)` fails because the requested version is not present in the purpose. | Cannot happen — the FE only offers the document for the currently loaded version and does not expose a way to choose a non-existent version in the normal flow. | — | — |
| `purposeVersionDocumentNotFound` | 404 | `retrievePurposeVersionDocument(purposeId, version, documentId)` fails when the document is not attached to the selected version. | Cannot happen — the action is only rendered for a risk-analysis document already attached to the displayed version, and the UI cannot request an absent document from a normal interaction. | — | — |
| `tenantNotAllowed` | 403 | `assertRequesterCanRetrievePurpose(...)` rejects the caller when the current tenant is not one of the allowed roles for that purpose. | Cannot happen — the UI only renders the document action for the current consumer/producer/delegate context and the routing/list filters prevent access by a different tenant. | — | — |

## 14. `POST /purposes/:purposeId/versions/:versionId/reject`

Service: `purposeService` → `rejectPurposeVersion`. Mapper: `rejectPurposeVersionErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `POST /purposes/:purposeId/versions/:versionId/reject`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose no longer exists. | Cannot happen — the reject action is started from the current purpose record and the normal UI never lets the user submit an arbitrary purpose ID. | — | — |
| `purposeVersionNotFound` | 404 | `retrievePurposeVersion(versionId, purpose)` fails because the selected version is missing from the purpose. | Cannot happen — the UI only offers reject for the currently loaded waiting-for-approval version and never exposes a non-existent version in the standard flow. | — | — |
| `tenantIsNotTheProducer` | 403 | `assertRequesterCanActAsProducer(...)` rejects the caller when the current organization is not the producer tenant. | Cannot happen — the producer-side reject dialog is only rendered for the producer org and the route guards prevent a non-producer tenant from opening it. | — | — |
| `tenantIsNotTheDelegatedProducer` | 403 | `assertRequesterCanActAsProducer(...)` rejects the delegated producer when the current delegation is not the active delegated producer for the e-service. | Cannot happen — the FE only surfaces the reject action for the active producer/delegate context and does not offer a different delegation in the normal UI. | — | — |
| `notValidVersionState` | 400 | `isRejectable(purposeVersion)` returns `false` when the selected version is not in the waiting-for-approval state. | Cannot happen — the reject action is shown only for a waiting-for-approval version and is disabled or hidden in other states. | — | — |

## 15. `POST /purposes/:purposeId/riskAnalysis/assign`

Service: `purposeService` → `assignRiskAnalysisReviewer`. Mapper: `assignRiskAnalysisReviewerErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `POST /purposes/:purposeId/riskAnalysis/assign`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose record is missing. | Cannot happen — the reviewer assignment action is launched from the current purpose and the normal UI never lets the user submit an arbitrary purpose ID. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterIsConsumer(purpose.data, authData)` rejects the caller when the current org is not the consumer. | Cannot happen — the assign-reviewer form is only exposed on the consumer side of the purpose and the route guard blocks access for a non-consumer org. | — | — |
| `reviewerWorkflowConflict` | 409 | `purpose.data.reviewerWorkflow?.signingState === riskAnalysisSigningState.signed` is true, so the workflow already entered the signed state. | Cannot happen — the assign-reviewer action is only offered while the purpose is in a draft workflow state and the UI hides or disables the form once the review is signed. | — | — |
| `userWithoutReviewerPrivileges` | 400 | `assertUserSelfcareReviewerPrivileges(...)` rejects a selected reviewer user who does not have the required reviewer privileges. | Cannot happen — the FE populates the reviewer list from the allowed reviewer users and does not expose a way to choose an invalid reviewer in the standard flow. | — | — |
| `duplicatedReviewersInSeed` | 400 | `assertReviewerIdsAreUnique(seed.reviewerIds)` fails when the seed includes the same reviewer more than once. | Cannot happen — the reviewer selector is bound to a unique list and the UI does not allow duplicate entries in the same assignment. | — | — |
| `purposeFromTemplateCannotBeModified` | 400 | `assertPurposeIsNotFromTemplate(purpose.data)` fails when the purpose is generated from a template. | Cannot happen — the template-based purpose flow is not surfaced in the assign-reviewer UI and the action is unavailable for template-derived purposes. | — | — |
| `purposeNotInDraftState` | 400 | `assertPurposeIsDraft(purpose.data)` fails because the purpose is no longer in draft state. | Cannot happen — the reviewer-assignment form is only available while the purpose is in draft state and is hidden/disabled once the workflow advances. | — | — |
| `reviewerWorkflowNotAllowedForDelegatedPurpose` | 400 | `purpose.data.delegationId !== undefined` blocks assignment when the purpose is delegated. | Cannot happen — the reviewer assignment UI is not shown for delegated purposes and the flow only operates on the consumer-owned purpose path. | — | — |
| `reviewerWorkflowNotAllowedForReceiveMode` | 400 | `eservice.mode === eserviceMode.receive` rejects the assignment because review assignment is not allowed for receive-mode e-services. | Cannot happen — the UI only enables the reviewer assignment flow for deliver-mode e-services and prevents selection of a receive-mode e-service from the normal form. | — | — |
| `missingReviewers` | 400 | `!isSelfAssignmentMode && !hasRequestedReviewers` fails when the user submits a non-self-assignment workflow with no reviewers selected. | Cannot happen — the form requires at least one reviewer selection and the UI blocks save when the reviewer list is empty. | — | — |
| `reviewersNotAllowedForReviewMode` | 400 | `isSelfAssignmentMode && hasRequestedReviewers` fails when the user tries to select reviewers in admin-writes-admin-signs mode. | Cannot happen — the review-mode switch changes the available controls and the UI disables reviewer selection when self-assignment mode is active. | — | — |
| `featureFlagNotEnabled` | 501 | `assertFeatureFlagEnabled(config, "featureFlagNewOperators")` fails when the feature flag is off. | Cannot happen — the assign-reviewer route and action are hidden behind the `featureFlagNewOperators` gate and the UI does not expose the feature when the flag is disabled. | — | — |

## 16. `POST /purposes/:purposeId/riskAnalysis/submit`

Service: `purposeService` → `submitRiskAnalysis`. Mapper: `submitRiskAnalysisErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `POST /purposes/:purposeId/riskAnalysis/submit`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose no longer exists in the read model. | Cannot happen — the submit action is launched from the current purpose and the normal UI never lets the user type an arbitrary purpose ID. | — | — |
| `reviewerWorkflowNotFound` | 404 | `purpose.data.reviewerWorkflow` is missing, so the code cannot resolve the review workflow before submit. | Cannot happen — the submit action is only shown once a reviewer workflow is already created for the current purpose and the form does not render for a purpose without one. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterIsConsumer(purpose.data, authData)` rejects the caller when the active organization is not the current consumer. | Cannot happen — the flow is only exposed on the consumer side of the purpose and the route guard blocks a non-consumer org from opening it. | — | — |
| `reviewerWorkflowNotSubmittable` | 409 | The workflow is not in `DRAFT` or `REJECTED` state, so the risk analysis cannot be submitted again. | Cannot happen — the UI only enables the submit action while the purpose is still in a submittable reviewer workflow state and hides it once the flow advances. | — | — |
| `submitNotAllowedForReviewMode` | 409 | `purpose.data.riskAnalysisReviewMode !== riskAnalysisReviewMode.adminWritesReviewerSigns` rejects the request because the current mode does not allow submit. | Cannot happen — the FE only offers the submit action for the `adminWritesReviewerSigns` review mode and does not expose the button in other modes. | — | — |
| `riskAnalysisValidationFailed` | 400 | `validateAndTransformRiskAnalysis(...)` rejects the submitted risk-analysis payload when schema or business validation fails. | Cannot happen — the FE block this operation | — | — |
| `missingRiskAnalysis` | 400 | `validateAndTransformRiskAnalysis(...)` receives `undefined` and the flow tries to submit without an actual risk-analysis form. | Cannot happen — the submit action is only available after the _Analisi del rischio_ form has been filled, and the FE never sends an empty payload from the normal UI flow. | — | — |
| `featureFlagNotEnabled` | 501 | `assertFeatureFlagEnabled(config, "featureFlagNewOperators")` fails when the backend feature flag is turned off. | Cannot happen — the UI cannot toggle the backend feature flag, and the submit action is not exposed when the feature is disabled. | — | — |

## 17. `POST /purposes/:purposeId/riskAnalysis/sign`

Service: `purposeService` → `signRiskAnalysis`. Mapper: `signRiskAnalysisErrorMapper`. Roles: `REVIEWER_ROLE`.

### BFF endpoints

- `POST /purposes/:purposeId/riskAnalysis/sign`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose no longer exists. | Cannot happen — the sign action is triggered from the current purpose summary and the normal UI never submits an arbitrary purpose ID. | — | — |
| `reviewerWorkflowNotFound` | 404 | `purpose.data.reviewerWorkflow` is missing, so the review workflow cannot be signed. | Cannot happen — the reviewer approval dialog is only rendered after a valid workflow is loaded for the current purpose. | — | — |
| `riskAnalysisValidationFailed` | 400 | `validateRiskAnalysisOrThrow(...)` rejects the stored risk-analysis form when its content is invalid. | Cannot happen — the reviewer approval flow only exposes the confirm action after the form has been compiled and validated in the same UI flow, and the final step does not allow a stale invalid payload to be submitted via a normal interaction. | — | — |
| `missingRiskAnalysis` | 400 | The purpose reaches the signing step without a risk-analysis form. | Cannot happen — the reviewer page only shows the approval action when the risk-analysis is present and the form has already been loaded from the purpose data. | — | — |
| `requesterIsNotDesignatedReviewer` | 403 | `workflow.reviewers.some((reviewer) => reviewer.id === authData.userId)` fails because the current reviewer is not assigned to the purpose. | Cannot happen — the approval dialog is only shown to the designated reviewer and the route/action is not exposed to an unassigned user. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterIsConsumer(purpose.data, authData)` fails when the caller is not the consumer. | Cannot happen — the reviewer approval flow is scoped to the current purpose’s assigned reviewer and not to the consumer actor. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | Dead mapper entry — there is no delegated-consumer branch in `signRiskAnalysis`; the method only checks that the caller is the consumer and never resolves a delegated-consumer context. | Cannot happen — the method never throws this error and the reviewer approval path does not expose delegated-consumer validation here. | — | — |
| `reviewerWorkflowNotInSignableState` | 409 | `signRiskAnalysis` rejects the workflow when it is not in the expected signable state. | Cannot happen — the approve action is only enabled for the signable workflow state and is disabled or hidden in all other states. | — | — |
| `purposeMetadataVersionMismatch` | 409 | `metadataVersionToSign !== purpose.metadata.version` fails when the reviewer signs a stale version. | Cannot happen — the FE loads the current draft state for the purpose and the approval dialog is not shown with a stale version in a normal user flow. | — | — |
| `featureFlagNotEnabled` | 501 | `assertFeatureFlagEnabled(config, "featureFlagNewOperators")` fails when the feature flag is off. | Cannot happen — the UI cannot toggle the backend feature flag, and the approval action is not rendered when the flag is disabled. | — | — |

## 18. `POST /purposes/:purposeId/riskAnalysis/reject`

Service: `purposeService` → `rejectRiskAnalysis`. Mapper: `rejectRiskAnalysisErrorMapper`. Roles: `REVIEWER_ROLE`.

### BFF endpoints

- `POST /purposes/:purposeId/riskAnalysis/reject`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose record is missing. | Cannot happen — the rejection flow is started from the current purpose and the UI never lets the user enter an arbitrary purpose ID. | — | — |
| `reviewerWorkflowNotFound` | 404 | `purpose.data.reviewerWorkflow` is missing, so the request cannot resolve the review workflow. | Cannot happen — the reject action is only rendered after a workflow is loaded for the selected purpose and the flow will not start without one. | — | — |
| `requesterIsNotDesignatedReviewer` | 403 | `workflow.reviewers.some((reviewer) => reviewer.id === authData.userId)` fails because the current reviewer is not the assigned reviewer. | Cannot happen — the reject dialog is only shown to the designated reviewer and the route does not expose the action to another reviewer. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterIsConsumer(purpose.data, authData)` rejects the caller when the current organization is not the consumer. | Cannot happen — the reviewer rejection flow is scoped to the purpose’s review workflow and not to the consumer actor. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | Dead mapper entry — the method never resolves a delegated-consumer context for the rejection flow; it only checks the consumer and assigned reviewer. | Cannot happen — there is no throw site for this error in `rejectRiskAnalysis`, and the UI does not expose any delegated-consumer branch in this action. | — | — |
| `reviewerWorkflowNotInSubmittedState` | 409 | The workflow is not in `SUBMITTED` state when the rejection is attempted. | Cannot happen — the reject action is only enabled in the submitted state and the dialog is hidden or disabled in other review states. | — | — |
| `rejectNotAllowedInCurrentMode` | 409 | `purpose.data.riskAnalysisReviewMode !== riskAnalysisReviewMode.adminWritesReviewerSigns` rejects the operation because the mode does not allow rejection. | Cannot happen — the FE only exposes the reject action in the `adminWritesReviewerSigns` mode and hides it otherwise. | — | — |
| `featureFlagNotEnabled` | 501 | `assertFeatureFlagEnabled(config, "featureFlagNewOperators")` fails when the feature flag is off. | Cannot happen — the UI cannot toggle the backend feature flag, and the reject action is absent when the feature is disabled. | — | — |

## 19. `PUT /purposes/:purposeId/riskAnalysis/form`

Service: `purposeService` → `editRiskAnalysisForm`. Mapper: `editRiskAnalysisFormErrorMapper`. Roles: `REVIEWER_ROLE`.

### BFF endpoints

- `PUT /purposes/:purposeId/riskAnalysis/form`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | Dead mapper entry — the method resolves the purpose before any validation, so a missing purpose is only possible for a stale route state or an inconsistent backend record, not a normal in-UI action. | Cannot happen — the form is opened from the current purpose and the normal reviewer workflow never allows the user to submit an arbitrary purpose ID. | — | — |
| `reviewerWorkflowNotFound` | 404 | Dead mapper entry — `purpose.data.reviewerWorkflow` is resolved immediately before the review-mode checks, so the page would only reach this path if the workflow record has already disappeared from the current state. | Cannot happen — the edit form is only rendered when the purpose already has an active reviewer workflow; the UI does not start from a workflow-less state. | — | — |
| `requesterIsNotDesignatedReviewer` | 403 | `workflow.reviewers.some((reviewer) => reviewer.id === authData.userId)` fails because the current user is not the designated reviewer. | Cannot happen — the action is only shown to the assigned reviewer and the page is not rendered for other users. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterIsConsumer(purpose.data, authData)` fails when the caller is not the consumer for the purpose. | Cannot happen — the reviewer form is opened from the active purpose’s current consumer context and the route does not expose the action to a different tenant. | — | — |
| `editNotAllowedForReviewMode` | 409 | `purpose.data.riskAnalysisReviewMode !== riskAnalysisReviewMode.reviewerWritesReviewerSigns` rejects the request because the purpose is not in the reviewer-edit mode. | Cannot happen — the FE only calls this endpoint in the reviewer-writes-reviewer-signs flow and hides the edit action in every other mode. | — | — |
| `reviewerWorkflowNotEditable` | 409 | `workflow.signingState !== riskAnalysisSigningState.assigned` rejects the request after the reviewer workflow is no longer editable. | Cannot happen — the form is only enabled while the workflow is in the `ASSIGNED` state and is disabled when the state advances. | — | — |
| `riskAnalysisValidationFailed` | 400 | `validateAndTransformRiskAnalysis` rejects the submitted seed when the risk-analysis answers are structurally or semantically invalid. | Cannot happen — the FE block this operation | — | — |
| `featureFlagNotEnabled` | 501 | `assertFeatureFlagEnabled(config, "featureFlagNewOperators")` fails when the feature flag is off. | Cannot happen — the UI cannot toggle the server feature flag, and the reviewer edit flow is not rendered when the flag is disabled. | — | — |

## 20. `POST /purposes/:purposeId/versions/:versionId/activate`

Service: `purposeService` → `activatePurposeVersion`. Mapper: `activatePurposeVersionErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposes/:purposeId/versions/:versionId/activate`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `missingRiskAnalysis` | 400 | The draft purpose version is activated without a risk-analysis form attached to the current purpose record. | Cannot happen — the FE block this operation. | — | — |
| `agreementNotFound` | 400 | `retrieveActiveAgreement(...)` fails because the purpose has no active agreement for the selected e-service/consumer pair. | Cannot happen — the FE only offers the activation action for a purpose already tied to the current active agreement and never exposes a draft without a valid agreement in the normal UI flow. | — | — |
| `riskAnalysisValidationFailed` | 400 | `validateRiskAnalysisOrThrow` rejects the current risk-analysis form when it is invalid or stale at activation time. | Cannot happen — the FE block this operation. | — | — |
| `riskAnalysisTenantKindMismatch` | 400 | `assertRiskAnalysisTenantKindMatch` rejects the form when the tenant kind does not match the current purpose context. | Cannot happen — the FE builds the activation flow from the currently loaded purpose and does not let the user change the tenant-kind context during a simple activation action. | — | — |
| `reviewerWorkflowNotInSignedState` | 400 | `isFeatureFlagEnabled(...)` and the workflow signing state check fail when the reviewer workflow is not yet in `SIGNED` state. | Cannot happen — the UI only enables the activation action once the review workflow is already at the valid ready-to-publish state, and it hides the action otherwise. | — | — |
| `tenantIsNotTheConsumer` | 403 | The caller is not the consumer for the purpose and the `match` state logic rejects the activation path. | Cannot happen — the purpose activation action is only surfaced in the consumer workflow and the route guard blocks the non-consumer tenant from opening the action. | — | — |
| `tenantIsNotTheProducer` | 403 | The current organization is the producer side but the activation flow expects the consumer side. | Cannot happen — the action is not rendered for the producer-side purpose view and the FE prevents that path in the normal UI. | — | — |
| `tenantNotAllowed` | 403 | A purpose state/ownership combination is not allowed to continue in the activation lifecycle. | Cannot happen — the action is only shown for an allowed ownership state and the UI blocks the forbidden combinations before request dispatch. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | A delegated consumer is not the active delegated consumer for the purpose when activation is attempted. | Cannot happen — the FE resolves the delegation context from the current purpose and does not expose a different delegated consumer in the activation dialog. | — | — |
| `tenantIsNotTheDelegate` | 403 | The delegate is not the active delegate for the purpose during activation. | Cannot happen — the activation dialog is not shown unless the current delegation context matches the purpose and different delegates are filtered out by the UI. | — | — |
| `purposeNotFound` | 404 | `retrievePurpose(...)` fails because the purpose no longer exists in the read model. | Cannot happen — the action is launched from an already loaded purpose and the normal FE does not accept an arbitrary purpose ID into the activation flow. | — | — |
| `purposeVersionNotFound` | 404 | `retrievePurposeVersion(...)` fails because the selected version record is absent from the purpose. | Cannot happen — the version is selected from the current purpose object and the UI never exposes a stale or manually-entered `versionId` in a normal interaction. | — | — |
| `purposeTemplateNotFound` | 404 | `retrievePublishedPurposeTemplate(...)` fails when the purpose is linked to a template that no longer exists. | Cannot happen — the purpose template link is loaded with the purpose, and the normal UI only allows activation from a current valid purpose/template state. | — | — |

## 21. `POST /purposes/:purposeId/clone`

Service: `purposeService` → `clonePurpose`. Mapper: `clonePurposeErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `POST /purposes/:purposeId/clone`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(...)` fails because the source purpose no longer exists. | Cannot happen — the clone action is launched from the current purpose record and the UI never accepts an arbitrary purpose ID in the clone dialog. | — | — |
| `duplicatedPurposeTitle` | 409 | `assertPurposeTitleIsNotDuplicated` fails when the clone would create a new purpose whose title duplicates an existing one for the same consumer and e-service. | **CAN HAPPEN** — the title is generated from the source title plus a timestamp suffix, but the FE does not enforce uniqueness on the cloned title before the request leaves the client. | **Data precondition:** consumer A already has a purpose with the same generated clone title for e-service E.<br>1. Go to the consumer purpose list and open the purpose A detail page.<br>2. Click _Clona_.<br>3. Select e-service E in the clone dialog and confirm with _Conferma_. | 🟢 Easy resolution <br />1. Change the cloned purpose title by using a different e-service or a different source purpose.<br>2. Retry the clone action after the title is unique.<br>3. If the title is already duplicated, choose a different purpose or create a fresh draft. |
| `purposeCannotBeCloned` | 409 | `!isClonable(purposeToClone.data)` rejects the request because the source purpose is not in a cloneable state. | Cannot happen — the clone action is only rendered for purposes that are currently cloneable, and the dialog disables the confirm button when the ruleset is expired or the state is incompatible with cloning. | — | — |

## 22. `POST /purposes/:purposeId/versions/:versionId/suspend`

Service: `purposeService` → `suspendPurposeVersion`. Mapper: `suspendPurposeVersionErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposes/:purposeId/versions/:versionId/suspend`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose record is missing. | Cannot happen — the action is launched from the current purpose and the UI never lets the user submit an arbitrary purpose ID through the normal suspend flow. | — | — |
| `purposeVersionNotFound` | 404 | `retrievePurposeVersion(versionId, purpose)` fails because the selected version is missing from the purpose. | Cannot happen — the UI selects the version from the current purpose object; a stale or manually typed `versionId` is outside the normal user flow. | — | — |
| `tenantNotAllowed` | 403 | `getOrganizationRole(...)` fails because the current organization is neither the consumer nor the producer and is not an active delegate. | Cannot happen — the suspend action is only rendered for the allowed consumer/producer/delegate states and route guards block any other tenant from reaching it. | — | — |
| `tenantIsNotTheDelegatedProducer` | 403 | A producer delegate is not the active delegated producer for the e-service being suspended. | Cannot happen — the FE resolves the active producer delegation from the current purpose context and hides the suspend action whenever the delegation does not match. | — | — |
| `tenantIsNotTheDelegate` | 403 | `delegationId` is present but does not match the active consumer or producer delegation for the purpose. | Cannot happen — the FE only sends a valid delegation ID for the current active delegation and never exposes a mismatched delegate in the suspend dialog. | — | — |
| `notValidVersionState` | 400 | `isSuspendable(purposeVersion)` returns `false` because the version is not in an active or suspended state. | Cannot happen — the UI only displays the suspend action for versions in the suspendable states and hides or disables it in all other states. | — | — |

## 23. `POST /purposes/:purposeId/versions/:versionId/archive`

Service: `purposeService` → `archivePurposeVersion`. Mapper: `archivePurposeVersionErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposes/:purposeId/versions/:versionId/archive`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose no longer exists. | Cannot happen — the archive action is launched from the current purpose record and the FE never accepts a random purpose ID through the normal archive flow. | — | — |
| `purposeVersionNotFound` | 404 | `retrievePurposeVersion(versionId, purpose)` fails because the selected version is missing from the purpose. | Cannot happen — the UI picks the version from the loaded purpose and does not expose a stale or manually entered `versionId` in a normal interaction. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer(...)` rejects the caller when the request is not made by the active consumer or delegated consumer. | Cannot happen — the archive action is only rendered for the consumer-side workflow and the route guard blocks any other organization from launching it. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | A delegated consumer is not the active delegated consumer for the purpose when the archive action is attempted. | Cannot happen — the FE resolves the active delegation from the current purpose context and filters out mismatched delegates before showing the action. | — | — |
| `notValidVersionState` | 400 | `isArchivable(purposeVersion)` returns `false` because the version is not in an active or suspended state. | Cannot happen — the UI only enables the archive action for versions that are currently archivable and disables it in all other states. | — | — |

## 24. `GET /purposes/riskAnalysis/latest`

Service: `purposeService` → `retrieveLatestRiskAnalysisConfiguration`. Mapper: `retrieveLatestRiskAnalysisConfigurationErrorMapper`. Roles: `ADMIN_ROLE`, `SUPPORT_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `REVIEWER_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /purposes/riskAnalysis/latest`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 400 | `retrieveTenantKind(authData.organizationId, readModelService)` cannot resolve the current tenant, so the lookup fails before any config is selected. | Cannot happen — the request is made only for an authenticated tenant already loaded in the current session, and the FE never sends a tenant ID that is not present in the user context. | — | — |
| `tenantKindNotFound` | 400 | The tenant exists but its `kind` is missing, so `getLatestVersionFormRules(kind)` cannot determine the correct config. | Cannot happen — the UI is bound to a valid tenant record already returned by the auth and profile flows; a missing tenant kind is a backend data integrity issue rather than a normal user action. | — | — |
| `riskAnalysisConfigLatestVersionNotFound` | 400 | `getLatestVersionFormRules(kind)` returns no config for the tenant kind, so the latest risk-analysis schema is unavailable. | Cannot happen — the FE only requests the risk-analysis config for a tenant kind that is already present in the supported flow and does not expose an unsupported kind through its normal form entry points. | — | — |

## 25. `GET /purposes/riskAnalysis/version/:riskAnalysisVersion`

Service: `purposeService` → `retrieveRiskAnalysisConfigurationByVersion`. Mapper: `retrieveRiskAnalysisConfigurationByVersionErrorMapper`. Roles: `ADMIN_ROLE`, `SUPPORT_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `REVIEWER_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /purposes/riskAnalysis/version/:riskAnalysisVersion`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `eserviceNotFound` | 404 | `retrieveEService(eserviceId, readModelService)` cannot find the selected e-service for the requested schema version. | Cannot happen — the UI resolves the risk-analysis version from the currently loaded e-service context and does not allow a random `eserviceId` in the ordinary flow. | — | — |
| `riskAnalysisConfigVersionNotFound` | 404 | `getFormRulesByVersion(tenantKind, riskAnalysisVersion)` returns no schema for the requested risk-analysis version. | Cannot happen — the FE only asks for the version already attached to the current purpose or catalog risk-analysis record and does not expose a manually typed unsupported version in the normal flow. | — | — |

> `tenantNotFound` (500) and `tenantKindNotFound` (500) can be thrown by `retrieveKindOfInvolvedTenantByEServiceMode` when the tenant record is missing or its kind is undefined. They are not in the mapper, so they fall back to the default mapper because neither code is classified as a common code.

## 26. `POST /templates/:purposeTemplateId/purposes`

Service: `purposeService` → `createPurposeFromTemplate`. Mapper: `createPurposeFromTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposeTemplates/:purposeTemplateId/purposes`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantIsNotTheConsumer` | 403 | `verifyRequesterIsConsumerOrDelegateConsumer` rejects the caller because the active organization is not the consumer of the selected e-service. | Cannot happen — the FE only shows the template-based creation flow for the active consumer and route guards block other tenant contexts before the request is sent. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | The user is acting as a delegate but is not the active delegated consumer for the selected e-service. | Cannot happen — the form is bound to the current consumer/delegate context and the UI does not expose an alternative delegation selection in this route. | — | — |
| `purposeTemplateNotFound` | 404 | `retrievePublishedPurposeTemplate(purposeTemplateId, readModelService)` fails because the template no longer exists or was unpublished. | Cannot happen — the user starts from an existing template route already loaded in the catalog and the FE does not allow a stale template ID to be entered manually. | — | — |
| `tenantNotFound` | 400 | `retrieveTenantKind(consumerId, readModelService)` fails because the consumer tenant record is missing. | Cannot happen — the create flow is only available for an authenticated tenant already known to the session; a missing tenant is a backend data-integrity issue, not a normal UI action. | — | — |
| `tenantKindNotFound` | 400 | `retrieveTenantKind(consumerId, readModelService)` resolves the tenant but the tenant kind is absent. | Cannot happen — the FE is initialized with a valid tenant and does not offer the template creation route for a tenant without a kind. | — | — |
| `agreementNotFound` | 400 | `retrieveActiveAgreement(eserviceId, consumerId, readModelService)` cannot find an active agreement for the selected e-service. | Cannot happen — the create form only surfaces deliver-mode e-services that already have an active agreement, and the UI filters out the invalid cases before the request is emitted. | — | — |
| `riskAnalysisValidationFailed` | 400 | `validateRiskAnalysisAgainstTemplateOrThrow` rejects an incomplete or invalid risk-analysis answer set inherited from the purpose template. | Cannot happen — the FE block this operation | — | — |
| `riskAnalysisTenantKindMismatch` | 400 | `assertValidPurposeTenantKind` rejects a template whose target tenant kind does not match the current consumer tenant kind. | Cannot happen — the template and tenant-kind context are selected from the same current consumer record and the FE does not let the user override that mismatch in the form. | — | — |
| `invalidPurposeTenantKind` | 400 | `assertValidPurposeTenantKind` rejects a template whose target tenant kind is incompatible with the current purpose tenant kind. | Cannot happen — the UI always derives the tenant kind from the selected consumer and template context, so the mismatched combination is not user-editable. | — | — |
| `riskAnalysisMissingExpectedFieldError` | 400 | The template defines an answer that is not editable and should be filled from template data; a missing answer in the seed triggers this error. | Cannot happen — the FE submits the full seed built from the template and the form keeps required answers populated, so the runtime cannot send a missing non-editable answer from the normal UI. | — | — |
| `riskAnalysisContainsNotEditableAnswers` | 400 | The user submits a value for a non-editable answer in the template-defined risk-analysis form. | Cannot happen — the form hides or disables non-editable answers, and the FE does not include them in the payload. | — | — |
| `riskAnalysisAnswerNotInSuggestValues` | 400 | The template contains a suggested-answer field, and the submitted value is not one of the allowed suggestions. | Cannot happen — the UI renders the allowed values as a constrained control and only sends one of them. | — | — |
| `riskAnalysisVersionMismatch` | 400 | The submitted risk-analysis form version differs from the purpose template’s version. | Cannot happen — the form schema is generated from the selected template version and cannot drift to a different version in the normal UI flow. | — | — |
| `eServiceModeNotAllowed` | 400 | `assertEserviceMode(eservice, 'deliver')` rejects the request when the selected e-service is not in deliver mode. | Cannot happen — the route only offers template-based purpose creation for deliver-mode e-services and the UI filters out receive-mode items before request submission. | — | — |
| `invalidPersonalData` | 400 | `assertPersonalDataCompliant` rejects the template because the selected e-service personal-data flag does not match the template requirement. | Cannot happen — the FE filters catalog templates by the selected e-service and does not present a mismatch between personal-data handling and the template. | — | — |
| `duplicatedPurposeTitle` | 409 | `assertPurposeTitleIsNotDuplicated` finds an existing purpose with the same title for the same consumer and e-service. | **CAN HAPPEN** — the title is user-set and the create form does not enforce uniqueness client-side. | **Data precondition:** tenant A already owns a purpose for e-service E with the same title selected for the template draft.<br>1. Go to `/fruizione/finalita/:purposeTemplateId/crea`.<br>2. Select e-service E and confirm the template flow.<br>3. Enter the existing title in the instance name field.<br>4. Click _Crea bozza_. | 🟢 Easy resolution <br />1. Change the purpose title to a unique value.<br>2. Retry the creation flow with the corrected title. |

## 27. `PATCH /templates/:purposeTemplateId/purposes/:purposeId`

Service: `purposeService` → `patchUpdatePurposeFromTemplate`. Mapper: `updatePurposeByTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `PATCH /purposeTemplates/:purposeTemplateId/purposes/:purposeId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `riskAnalysisValidationFailed` | 400 | `validateRiskAnalysisAgainstTemplateOrThrow` rejects the submitted risk-analysis form when it is incomplete or invalid. | Cannot happen — the FE block this operation| —| — |
| `riskAnalysisTenantKindMismatch` | 400 | `assertRiskAnalysisTenantKindMatch` rejects a risk-analysis form whose tenant kind does not match the current tenant context. | Cannot happen — the FE derives the tenant kind from the current consumer and does not let the user override it from the template edit form. | — | — |
| `tenantKindNotFound` | 400 | The tenant associated with the purpose or template context exists but is missing a `kind`, so the validation cannot proceed. | Cannot happen — this is a backend data-integrity issue and the FE is bound to a valid current tenant record. | — | — |
| `riskAnalysisVersionMismatch` | 400 | The submitted risk-analysis schema version differs from the template’s expected version. | Cannot happen — the form is built from the current template version and the UI never sends a different schema version in the standard flow. | — | — |
| `riskAnalysisMissingExpectedFieldError` | 400 | A non-editable answer is expected from the template but missing from the request payload. | Cannot happen — the UI populates the seeded values from the template and does not send a partial or empty payload for non-editable answers. | — | — |
| `riskAnalysisContainsNotEditableAnswers` | 400 | The request includes value(s) for a non-editable template answer. | Cannot happen — the form hides or disables non-editable answers and the payload omits them before submission. | — | — |
| `riskAnalysisAnswerNotInSuggestValues` | 400 | A suggested-value answer is provided with a value that is not contained in the allowed suggestion list. | Cannot happen — the edit form only offers the valid suggestion values and does not accept arbitrary values for that question. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the caller because the active organization is not the consumer of the purpose. | Cannot happen — the route is shown only for the active consumer and the guard prevents other tenant roles from opening it. | — | — |
| `tenantIsNotTheDelegatedConsumer` | 403 | The user is acting as a delegate but is not the active delegated consumer for the purpose. | Cannot happen — the FE resolves the current delegation from the purpose context and does not expose a different delegated consumer in the standard edit flow. | — | — |
| `purposeTemplateNotFound` | 404 | `retrievePublishedPurposeTemplate(purposeTemplateId, readModelService)` cannot find the template linked to the purpose. | Cannot happen — the edit route is opened from a current template-based purpose loaded in the app state and the UI does not allow an arbitrary stale template ID. | — | — |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose no longer exists. | Cannot happen — the form is opened from the current purpose and the normal route never accepts a random purpose ID from the UI. | — | — |
| `eserviceNotFound` | 404 | `retrieveEService(purpose.data.eserviceId, readModelService)` fails because the purpose points to a missing e-service. | Cannot happen — the current purpose and its e-service are loaded together before the edit form is shown, so a missing e-service is a stale backend record rather than a user action. | — | — |
| `purposeDraftVersionNotFound` | 409 | The purpose is missing a draft version when the patch update tries to replace it. | Cannot happen — the draft version is selected from the current purpose object loaded in the page and the FE never sends a stale or manually typed draft version ID. | — | — |
| `duplicatedPurposeTitle` | 409 | `assertPurposeTitleIsNotDuplicated` finds an existing purpose with the same title for the same consumer and e-service. | **CAN HAPPEN** — the title is user-editable and the FE does not enforce uniqueness client-side on the template-based edit form. | **Data precondition:** the consumer A already has a purpose with the same title for the selected e-service E.<br>1. Go to `/fruizione/template-finalita/:purposeTemplateId/modifica`.<br>2. Update the instance name field to the duplicated title.<br>3. Click _Salva bozza e prosegui_. | 🟢 Easy resolution <br />1. Pick a unique title for the purpose.<br>2. Save the draft again after renaming it. |

## 28. `GET /purposes/:purposeId/versions/:versionId/signedDocuments/:documentId`

Service: `purposeService` → `getRiskAnalysisSignedDocument`. Mapper: `getRiskAnalysisDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `purposeNotFound` | 404 | `retrievePurpose(purposeId, readModelService)` fails because the purpose record no longer exists. | Cannot happen — the generator found no BFF endpoint and no frontend route/action calls this API, so the standard UI never reaches this signed-document download flow. | — | — |
| `purposeVersionNotFound` | 404 | `retrievePurposeVersion(versionId, purpose)` fails because the selected version does not exist in the current purpose. | Cannot happen — there is no frontend route, BFF call, or user action that sends a `purposeId`/`versionId` pair to this document endpoint from the UI. | — | — |
| `purposeVersionDocumentNotFound` | 404 | `retrievePurposeVersionSignedDocument(...)` fails because the signed document is missing or its `id` does not match `documentId`. | Cannot happen — the endpoint is not surfaced by the FE or the BFF, and the normal UI never triggers a direct signed-document fetch for this purpose version. | — | — |
| `tenantNotAllowed` | 403 | `assertRequesterCanRetrievePurpose(...)` rejects the caller when the organization is neither the consumer, producer, producer delegate, nor consumer delegate for the purpose. | Cannot happen — no frontend route or UI action calls this route, and the app never exposes a signed-document download flow for an arbitrary tenant context. | — | — |

> `eserviceNotFound` (500) and `purposeDelegationNotFound` (500) can be thrown by `retrieveEService(...)` and `retrievePurposeDelegation(...)` when the purpose points to a missing e-service or an inactive delegation. They are not in the mapper, so the default common mapper falls back to 500 because neither code is in the common-code allowlist.
