> Note: `GET /eservices` uses `emptyErrorMapper`, so no non-500 errors are mapped for this route.

## 1. `POST /eservices`

Service: `createEService` → `innerCreateEService`. Mapper: `createEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `originNotCompliant` | 403 | The requester tenant origin is not included in `config.producerAllowedOrigins` (`innerCreateEService`, `retrieveOriginFromAuthData`). | Cannot happen — `/erogazione/e-service/crea/` is a provider route and `AuthGuard` blocks provider access unless `isOrganizationAllowedToProduce`; the route itself is gated by `authLevels: ['admin', 'api']`. | — | — |
| `invalidDelegationFlags` | 400 | The delegation flags are mutually inconsistent: `isConsumerDelegable === false` while `isClientAccessDelegable === true` (`assertValidDelegationFlags`). | Cannot happen — the form normalizes the payload before submit: `EServiceCreateStepGeneral` forces `isClientAccessDelegable = false` whenever `isConsumerDelegable` is false, and the checkbox is hidden unless the consumer-delegation switch is on. | — | — |
| `asyncExchangeNotAllowedForReceiveMode` | 400 | Async exchange is enabled while the e-service mode is `RECEIVE` (`innerCreateEService`). | Cannot happen — `EServiceDetailsSectionBase` forces `mode` back to `DELIVER` whenever `asyncExchange` is true and disables the mode radio while async exchange is enabled. | — | — |
| `inconsistentDailyCalls` | 400 | `dailyCallsPerConsumer > dailyCallsTotal` (`assertConsistentDailyCalls`). | Cannot happen — `EServiceThresholdSection` sets the total field minimum to the per-consumer value and the UI only accepts integer numeric input, so the inverted ratio cannot be submitted from the form. | — | — |
| `eServiceNameDuplicateForProducer` | 409 | The producer already owns another e-service with the same name (`assertEServiceNameAvailableForProducer`). | **CAN HAPPEN** — the create form does not pre-check duplicate producer names before `POST /eservices`; the user can submit a name already used by another e-service of the same tenant. | **Data precondition:** tenant A already owns an e-service named `N`.<br>1. Go to `/erogazione/e-service/crea/`.<br>2. Type `N` in _Nome dell’e-service_.<br>3. Click _Salva bozza e prosegui_. | 🟢 Easy resolution<br>1. Change the e-service name to a unique value.<br>2. Submit again.<br>3. If the page is stale, reload the page and create the draft again with the new name. |
| `eserviceTemplateNameConflict` | 409 | The e-service name conflicts with an existing template name (`assertEServiceNameNotConflictingWithTemplate`). | **CAN HAPPEN** — the create form does not check template names before submit, so a producer can create an e-service whose name matches a template already present in the catalog. | **Data precondition:** tenant A has a template named `N` in the catalog.<br>1. Go to `/erogazione/e-service/crea/`.<br>2. Type `N` in _Nome dell’e-service_.<br>3. Click _Salva bozza e prosegui_. | 🟢 Easy resolution<br>1. Rename the new e-service to a non-conflicting value.<br>2. Save again.<br>3. If the catalog is stale, refresh the page and retry with the new name. |

## 2. `POST /templates/:templateId/eservices`

Service: `createEServiceInstanceFromTemplate` → `innerCreateEService`. Mapper: `createEServiceInstanceFromTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `POST /templates/:templateId/eservices`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceTemplateNotFound` | 404 | The selected template id does not exist in the read model (`retrieveEServiceTemplate`). | Cannot happen — the FE only opens this route from a template already selected in the provider template list or detail page, and the user cannot pass a foreign id through the normal flow. | — | — |
| `notValidDescriptor` | 400 | The selected published template version is not in a valid descriptor state for instance creation (`publishedVersion` validation in the service). | Cannot happen — the FE only offers instances from templates that already have an active published version; the user is not editing the template version metadata inside the instance wizard. | — | — |
| `inconsistentDailyCalls` | 400 | The inherited template quotas have `dailyCallsPerConsumer > dailyCallsTotal` (`assertConsistentDailyCalls`). | Cannot happen — the template values are read-only in the instance-creation form and the front-end never exposes quota editing in this flow. | — | — |
| `eServiceTemplateWithoutPublishedVersion` | 400 | The template has no published version (`publishedVersion` is undefined). | Cannot happen — the FE only allows creating an instance from a template that is already published or has a published version in the catalog list. | — | — |
| `templateMissingRequiredRiskAnalysis` | 400 | The template is missing the required risk analysis for the selected purpose usage (`extractEServiceRiskAnalysisFromTemplate`). | Cannot happen — templates are only chosen from a valid published state, and the create-from-template flow does not let the user create an instance from an incomplete template. | — | — |
| `eServiceTemplateWithoutPersonalDataFlag` | 400 | The template does not declare whether it handles personal data (`template.personalData === undefined`). | Cannot happen — the template creation flow requires a personal-data flag before publication, and the instance screen never exposes a way to mutate it. | — | — |
| `templateVersionMissingAsyncExchangeProperties` | 400 | The template is async-exchange enabled but the published version lacks the required async properties (`publishedVersion.asyncExchangeProperties`). | Cannot happen — the UI only lets the user create an instance from a template version that was already published with valid async-exchange configuration, and the template form requires these values. | — | — |
| `invalidDelegationFlags` | 400 | The instance flags are inconsistent (`assertValidDelegationFlags`). | Cannot happen — the template-instance form normalizes the delegation flags before submit: it forces `isClientAccessDelegable` to `false` whenever `isConsumerDelegable` is false. | — | — |
| `interfaceAlreadyExists` | 409 | The cloned template already contains an interface or the target descriptor already has a conflicting interface. | Cannot happen — the instance creation flow clones the template's documents and interface automatically; the user does not choose or duplicate them in this screen. | — | — |
| `documentPrettyNameDuplicate` | 409 | A document copied from the template has a duplicate pretty name in the new descriptor. | Cannot happen — the FE never lets the user edit or re-upload template document names during instance creation; the names are inherited from the published template. | — | — |
| `eServiceNameDuplicateForProducer` | 409 | The producer already owns an e-service whose final name conflicts with the generated instance name (`assertEServiceNameAvailableForProducer`). | **CAN HAPPEN** — the FE validates duplicate instance names inline after the create call, but it does not prevent the user from submitting a conflicting name before the request is sent; the field is only checked as a response-time validation. | **Data precondition:** tenant A already has an e-service whose final name matches the instance name generated from template `T` and the value in _Parola identificativa dell’e-service_.<br>1. Go to `/erogazione/e-service/template-eservice/:eServiceTemplateId/crea`.<br>2. In _Parola identificativa dell’e-service_, type the duplicate value that produces the same final name as an existing e-service.<br>3. Click _Salva bozza e prosegui_. | 🟢 Easy resolution<br>1. Change the instance label to a unique value.<br>2. Submit again.<br>3. Reload the page if the duplicate is from a stale list and retry with the new label. |
| `originNotCompliant` | 403 | The requester tenant origin is not included in `config.producerAllowedOrigins` (`innerCreateEService`). | Cannot happen — the route is a provider route and `AuthGuard` blocks access unless the tenant is allowed to produce; the form is never reachable for non-compliant tenants. | — | — |
| `tenantNotFound` | 500 | The read model cannot resolve the authenticated origin tenant while creating the service. | Cannot happen — the FE always uses the authenticated current tenant and a valid JWT, so the tenant lookup is never missing in a normal provider flow. | — | — |
| `tenantKindNotFound` | 500 | The tenant kind for the authenticated tenant cannot be resolved. | Cannot happen — the active party and the JWT are always available in the UI session, and the route does not allow creating a template instance without a valid tenant context. | — | — |

## 3. `GET /eservices/:eServiceId`

Service: `catalogService` → `getEServiceById`. Mapper: `getEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SUPPORT_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `INTERNAL_ROLE`, `REVIEWER_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The requested e-service id does not exist in the read model (`retrieveEService` throws `eServiceNotFound`). | Cannot happen — the generator found no BFF endpoint for `/eservices/{eServiceId}`, and the frontend never sends a direct detail request for a non-existent e-service in the normal UI flow. | — | — |

## 4. `PUT /eservices/:eServiceId`

Service: `catalogService` → `updateEService`. Mapper: `updateEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id is missing from the read model before the update (`retrieveEService` in `updateDraftEService`). | Cannot happen — the generator found no BFF endpoint for this mutation, and the provider edit flow is only opened from an existing e-service record. | — | — |
| `eServiceNameDuplicateForProducer` | 409 | The updated name already belongs to another e-service of the same producer (`assertEServiceNameAvailableForProducer`). | Cannot happen — the generator found no BFF endpoint for this backend mutation, so the normal provider UI never reaches it directly. | — | — |
| `eserviceTemplateNameConflict` | 409 | The edited name conflicts with an existing e-service template name (`assertEServiceNameNotConflictingWithTemplate`). | Cannot happen — there is no BFF route for this update call, and the frontend never submits a direct template-name check before the request. | — | — |
| `operationForbidden` | 403 | The requester is not allowed to mutate the target e-service (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the normal provider edit flow is gated by the authenticated tenant and delegation checks before this endpoint is called, and the generator did not find a BFF route for it. | — | — |
| `eserviceNotInDraftState` | 400 | The e-service is not in a draft state (`assertIsDraftEservice`). | Cannot happen — the frontend never calls this backend route from a non-draft edit screen, and no BFF endpoint exists for the mutation. | — | — |
| `invalidDelegationFlags` | 400 | The delegation flags are mutually inconsistent (`assertValidDelegationFlags`). | Cannot happen — the generator found no BFF route for this update mutation, and the provider edit form is not exposed to the user in a way that can submit invalid flag combinations. | — | — |
| `templateInstanceNotAllowed` | 400 | The target e-service is a template instance (`assertEServiceNotTemplateInstance`). | Cannot happen — the provider edit form cannot open an edit flow for a template instance, and the API is not reached through a BFF route in the frontend. | — | — |
| `asyncExchangeNotAllowedForReceiveMode` | 400 | Async exchange is enabled while the service mode is `RECEIVE` (`updatedEService.asyncExchange === true && updatedEService.mode === eserviceMode.receive`). | Cannot happen — no UI path submits this update payload through a BFF route, and the edit form does not expose the invalid combination to the user. | — | — |

## 5. `PATCH /eservices/:eServiceId`

Service: `catalogService` → `patchUpdateEService`. Mapper: `updateEServiceErrorMapper`. Roles: `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id is missing from the read model before the partial update (`retrieveEService` in `updateDraftEService`). | Cannot happen — the generator found no BFF endpoint for this patch mutation, and the frontend does not trigger partial edits to a non-existent e-service. | — | — |
| `eServiceNameDuplicateForProducer` | 409 | The patched name already belongs to another e-service of the same producer (`assertEServiceNameAvailableForProducer`). | Cannot happen — no BFF route exists for this API, so the normal UI never reaches the patch call. | — | — |
| `eserviceTemplateNameConflict` | 409 | The patched name conflicts with an existing template name (`assertEServiceNameNotConflictingWithTemplate`). | Cannot happen — there is no frontend mutation for this path and no BFF endpoint was found by the generator. | — | — |
| `operationForbidden` | 403 | The requester is not allowed to patch the target e-service (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the UI never calls this backend mutation directly, and the route is not exposed through the BFF. | — | — |
| `eserviceNotInDraftState` | 400 | The e-service is not in its draft state (`assertIsDraftEservice`). | Cannot happen — the regular frontend flow never submits a patch against a non-draft e-service, and no BFF route was found for this endpoint. | — | — |
| `invalidDelegationFlags` | 400 | The delegation flags are inconsistent after the partial update (`assertValidDelegationFlags`). | Cannot happen — no BFF route or direct UI action targets this patch endpoint, so the form cannot submit out-of-range delegation values. | — | — |
| `templateInstanceNotAllowed` | 400 | The target e-service is a template instance (`assertEServiceNotTemplateInstance`). | Cannot happen — the frontend never opens a patch flow for template instances, and there is no generated BFF route for this call. | — | — |
| `asyncExchangeNotAllowedForReceiveMode` | 400 | Async exchange is enabled while the service mode is `RECEIVE` (`updatedEService.asyncExchange === true && updatedEService.mode === eserviceMode.receive`). | Cannot happen — the frontend never emits this patch payload through a BFF endpoint, and the UI does not allow the invalid mode/async combination to be submitted. | — | — |

## 6. `POST /templates/eservices/:eServiceId`

Service: `catalogService` → `updateEServiceTemplateInstance`. Mapper: `updateEServiceTemplateInstanceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `POST /templates/eservices/:eServiceId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The requested template instance id does not exist in the read model before the update (`retrieveEService` in `updateEServiceTemplateInstance`). | Cannot happen — the FE only opens this drawer/route from an existing e-service instance already loaded from the template instance list/details page, and the user cannot submit a missing instance id through the normal flow. | — | — |
| `eServiceNameDuplicateForProducer` | 409 | The updated instance name already belongs to another e-service of the same producer (`assertEServiceNameAvailableForProducer` after `buildInstanceName`). | **CAN HAPPEN** — the instance-label form does not pre-check for duplicate producer names before submit; a producer can manually enter a label that produces the same final name as an existing e-service in the same tenant. | **Data precondition:** tenant A already owns an e-service whose final name matches the one generated by the template label.<br>1. Go to the provider template instance details page and open the edit drawer for the instance label.<br>2. Enter a label that resolves to the same catalog name as an existing e-service of tenant A (for example, `Patente` when `Template X - Patente` already exists).<br>3. Click _Upgrade_ / the submit action. | 🟢 Easy resolution<br>1. Change the instance label to a unique value.<br>2. Submit again.<br>3. If the page is stale, refresh the instance page and apply the new label. |
| `operationForbidden` | 403 | The requester is not the producer or active delegate for the template instance (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the route is only reachable from the provider/delegated template-instance screens, and the access check blocks non-owner tenants before the mutation is sent. | — | — |
| `eserviceNotInDraftState` | 400 | The target template instance is not in draft state (`assertIsDraftEservice`). | Cannot happen — the edit action is only shown for a draft instance, and the instance details UI does not let the user submit the update for a published or archived instance. | — | — |
| `invalidDelegationFlags` | 400 | The delegation flags are contradictory (`assertValidDelegationFlags` with `isConsumerDelegable === false` and `isClientAccessDelegable === true`). | Cannot happen — the instance form normalizes the delegation flags before submit, forcing `isClientAccessDelegable` to `false` whenever `isConsumerDelegable` is false, and the checkbox is hidden unless the consumer-delegation switch is on. | — | — |
| `eServiceNotAnInstance` | 400 | The target e-service is not a template instance (`assertEServiceIsTemplateInstance`). | Cannot happen — the UI only renders the template-instance editor for services created from a template, and a regular e-service never exposes this route. | — | — |

## 7. `DELETE /eservices/:eServiceId`

Service: `catalogService` → `deleteEService`. Mapper: `deleteEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /eservices/:eServiceId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id is missing from the read model before deletion (`retrieveEService` in `deleteEService`). | Cannot happen — the delete action is only shown from a currently loaded provider e-service summary, and the normal UI never submits a request for a non-existent service. | — | — |
| `operationForbidden` | 403 | The requester is not the owning producer (`assertRequesterIsProducer`). | Cannot happen — the action is only exposed to the producer tenant and the route is blocked by the provider auth guard before the backend call. | — | — |
| `eserviceNotInDraftState` | 409 | The target e-service is not in draft state (`assertIsDraftEservice`), so delete is rejected. | Cannot happen — the UI only displays the delete action for a draft e-service and hides it as soon as the service is published or active. | — | — |

## 8. `POST /eservices/:eServiceId/scheduleArchive`

Service: `catalogService` → `scheduleEServiceArchiving`. Mapper: `updateEServiceArchivingStatusErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceArchivingWithActiveOrPendingDelegation` | 409 | An active or pending producer delegation exists for the e-service (`assertNoExistingProducerDelegationForEServiceArchiving`). | Cannot happen — the direct producer archive flow is suppressed when a delegation is active or pending, and the UI routes the user to the delegated-archiving request flow instead. | — | — |
| `eServiceNotFound` | 404 | The e-service id does not exist before the archiving check (`retrieveEService`). | Cannot happen — the archive dialog is opened from an existing e-service summary page, and the normal UI never submits a call for a missing service id. | — | — |
| `operationForbidden` | 403 | The requester is not the producing tenant (`assertRequesterIsProducer`). | Cannot happen — the action is only visible to the owner and the route is guarded before the call is fired. | — | — |
| `eserviceWithoutValidDescriptors` | 400 | The e-service has no valid active descriptor that can be archived (`assertEServiceArchivable` / `assertEServiceUpdatableAfterPublish`). | Cannot happen — the archive dialog is only available for an e-service in a valid `Published` or `Suspended` state, and the UI disables the action when no valid descriptor exists. | — | — |
| `notValidEServiceState` | 400 | The latest descriptor is already in an unarchivable state (`assertEServiceArchivable`). | Cannot happen — the UI hides the archive action once the service is already `Archiving`, `ArchivingSuspended`, or `Archived`, so the backend is not reached in the normal flow. | — | — |
| `gracePeriodDaysLowerThanDescriptor` | 400 | The requested `gracePeriodDays` produces an `archivableOn` earlier than an existing descriptor schedule (`assertEServiceGracePeriodIsNotLowerThanDescriptors`). | **CAN HAPPEN** — the archive modal offers the allowed values (`30`, `60`, `90`, `120`) without a client-side comparison to the service's existing descriptor schedules, so a producer can choose a shorter period than the backend accepts. | **Data precondition:** tenant A has an e-service with an existing descriptor-level archiving schedule already set to a later date than the selected value.<br>1. Go to the provider e-service summary page for the service.<br>2. Open the archive dialog and choose `30` days in _Tempo di preavviso_.<br>3. Enter a reason longer than 10 characters and click _Archivia_. | 🟢 Easy resolution<br>1. Select a grace period equal to or greater than the existing descriptor schedule.<br>2. Submit again with the larger value.<br>3. If the page is stale, reload the summary and retry with the corrected period. |

## 9. `POST /eservices/:eServiceId/approveDelegatedArchiving`

Service: `catalogService` → `approveDelegatedEServiceArchiving`. Mapper: `approveDelegatedEServiceArchivingErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/approveDelegatedArchiving`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The e-service no longer exists when the delegator approves the delegating archiving request (`retrieveEService`). | Cannot happen — the confirmation dialog is opened only from an already loaded e-service record and the approval action is not displayed for a missing service. | — | — |
| `eServiceDescriptorNotFound` | 404 | The service checks the e-service aggregate but no descriptor-specific lookup is performed in this flow. | Cannot happen — this endpoint never loads a descriptor by id; the approval logic validates the EService and active request state only. | — | — |
| `noActiveDelegationFound` | 404 | The active producer delegation required to approve the request is missing at validation time (`retrieveActiveProducerDelegation`). | Cannot happen — the UI only shows the approval control while an active delegated producer relationship exists for the e-service, and the request is hidden as soon as the delegation is revoked. | — | — |
| `operationForbidden` | 403 | The requester is not the producing tenant for the e-service (`assertRequesterIsProducer`). | Cannot happen — the producer approval action is only exposed to the owner of the service and the auth guard blocks the route for other tenants. | — | — |
| `delegatedArchiveRequestForIncorrectDelegateProducer` | 403 | The pending request belongs to a different active delegate than the requester (`assertDelegatedArchivingRequestDelegationIsStillValid`). | Cannot happen — the modal is opened from the currently active delegation and the request is only visible to the matching delegate; a different delegate never sees the approval button. | — | — |
| `noDelegatedArchivingRequestFound` | 400 | There is no pending archiving request to approve on the e-service (`assertDelegatedEserviceHasAtLeastOneArchivingRequests`). | Cannot happen — the approval button is only rendered from the list of active delegated archiving requests, and the normal UI never offers the action without a pending request. | — | — |
| `notValidEServiceState` | 400 | The e-service is not in a state that can be archived (`assertEServiceArchivable`). | Cannot happen — the delegator approval action is hidden when the e-service is already `Archiving`, `ArchivingSuspended`, `Archived`, or otherwise non-archivable. | — | — |
| `notValidDescriptor` | 400 | A descriptor-specific state guard is violated during approval (`assertEServiceArchivable` is effectively the aggregate equivalent of a descriptor validation). | Cannot happen — the endpoint does not resolve or mutate a descriptor directly; the UI never renders the action for a service whose latest descriptor is invalid for archiving. | — | — |
| `eserviceWithoutValidDescriptors` | 400 | The e-service has no valid active descriptor that can be archived (`assertEServiceArchivable`). | Cannot happen — the flow only allows delegator approval when a valid active descriptor exists and the request is pending. | — | — |
| `gracePeriodDaysLowerThanDescriptor` | 400 | The requested grace period would end before an already scheduled descriptor archive (`assertEServiceGracePeriodIsNotLowerThanDescriptors`). | Cannot happen — the delegator approval modal does not let the user edit the grace period; it uses the server-side request already created by the delegate. | — | — |
| `delegatedArchivingRequestNotActive` | 409 | The delegated archiving request is no longer in the active/pending state (`assertDelegatedEserviceHasActiveArchivingRequests`). | Cannot happen — the approval action is only enabled for pending requests and disappears once the request is accepted or rejected. | — | — |

## 10. `POST /eservices/:eServiceId/rejectDelegatedArchiving`

Service: `catalogService` → `rejectDelegatedEServiceArchiving`. Mapper: `rejectDelegatedEServiceArchivingErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/rejectDelegatedArchiving`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The e-service no longer exists when the delegator rejects the request (`retrieveEService`). | Cannot happen — the rejection action is only rendered from the currently loaded delegated-archiving request list and the service must already exist to present it. | — | — |
| `eServiceDescriptorNotFound` | 404 | A descriptor lookup is attempted during validation, even though the route rejects the e-service-level request. | Cannot happen — the endpoint does not resolve a descriptor at all; it only validates the dominant e-service request and delegation state. | — | — |
| `noActiveDelegationFound` | 404 | No active delegated producer relationship is currently valid for the e-service (`retrieveActiveProducerDelegation`). | Cannot happen — the reject action is only visible when a live delegation exists and the current producer still owns the delegated-archiving request. | — | — |
| `operationForbidden` | 403 | The requester is not the producing tenant (`assertRequesterIsProducer`). | Cannot happen — only the owner/producer can open the reject dialog, and the route is blocked before the request is submitted. | — | — |
| `delegatedArchiveRequestForIncorrectDelegateProducer` | 403 | The request was submitted by a different delegate than the active producer delegation (`assertDelegatedArchivingRequestDelegationIsStillValid`). | Cannot happen — the UI only allows rejection for the active delegate request that is currently shown in the delegator workflow. | — | — |
| `noDelegatedArchivingRequestFound` | 400 | There is no pending delegated archiving request for the e-service (`assertDelegatedEserviceHasAtLeastOneArchivingRequests`). | Cannot happen — the rejection button is only generated from active delegated requests, and the normal flow never reaches the reject action without one. | — | — |
| `delegatedArchivingRequestNotActive` | 409 | The delegated archiving request is already accepted, rejected or otherwise not pending (`assertDelegatedEserviceHasActiveArchivingRequests`). | Cannot happen — the UI hides the reject action once the request is already resolved, so the request cannot be resubmitted by a normal click. | — | — |

> Note: `GET /eservices/:eServiceId/consumers` uses `emptyErrorMapper`, so no non-500 errors are mapped for this route.

## 11. `POST /eservices/:eServiceId/submitDelegatedArchiving`

Service: `catalogService` → `submitDelegatedEServiceArchiving`. Mapper: `submitDelegatedArchivingErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/submitDelegatedArchiving`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The e-service no longer exists when the delegate submits the request (`retrieveEService`). | Cannot happen — the action is only opened from an already loaded e-service detail page and the UI never posts a request for a non-existent service. | — | — |
| `eServiceDescriptorNotFound` | 404 | The route validates the e-service and active delegation only; no descriptor is loaded for this request. | Cannot happen — the frontend sends the e-service-scoped archiving request without a descriptor id, and the request is not shown for a missing descriptor. | — | — |
| `operationForbidden` | 403 | The requester is not the active delegate for the current producer delegation (`assertRequesterIsDelegateForArchiving`). | Cannot happen — the delegate archiving action is only visible to the delegate tenant, and the submit action is not rendered for a non-matching organization. | — | — |
| `noDelegationForArchivingRequest` | 400 | No active producer delegation is available for the e-service (`retrieveActiveProducerDelegation` and `if (!producerDelegation)`). | Cannot happen — the dialog is only offered when an active delegated producer relationship exists; there is no normal UI flow that lets the user submit without a delegation. | — | — |
| `notValidEServiceState` | 400 | The latest active descriptor is not in a state that allows e-service-level archiving (`assertEServiceArchivable`). | Cannot happen — the form is only exposed for an e-service in a valid `Published` or `Suspended` state, and the action is hidden otherwise. | — | — |
| `notValidDescriptor` | 400 | A descriptor-specific validation would be required, but this endpoint is e-service-scoped and never resolves one. | Cannot happen — the frontend submits the e-service request without a descriptor id, so this branch is dead in this flow. | — | — |
| `eserviceWithoutValidDescriptors` | 400 | The e-service has no valid active descriptor to archive (`assertEServiceArchivable` / `assertEServiceUpdatableAfterPublish`). | Cannot happen — the archive request button is only available while the latest descriptor is in a valid active state, and the UI disables it otherwise. | — | — |
| `gracePeriodDaysLowerThanDescriptor` | 400 | The requested grace period produces an `archivableOn` earlier than an already-running descriptor archiving schedule (`assertEServiceGracePeriodIsNotLowerThanDescriptors`). | **CAN HAPPEN** — the delegate archive dialog offers `30`, `60`, `90`, or `120` days without comparing the chosen value against existing descriptor schedules, so a shorter-than-valid period can be submitted. | **Data precondition:** tenant A is the delegate of tenant B on e-service E, and B already has a descriptor on that e-service with an `archivingSchedule` whose `archivableOn` is later than the selected value.<br>1. Go to the provider e-service details page for E as tenant A.<br>2. Open the “Richiedi archiviazione e-service” dialog.<br>3. In “Seleziona la durata del periodo di preavviso”, choose “30 giorni”.<br>4. Write a reason in “Motivo archiviazione” and click “Richiedi archiviazione”. | 🟢 Easy resolution<br>1. Increase the grace period to a value that is not shorter than the descriptor's scheduled archivable date.<br>2. Submit the request again.<br>3. Refresh the page and retry if the UI still shows the stale schedule. |
| `delegatedArchivingRequestAlreadyInProgress` | 409 | There is already a pending delegated archiving request for the e-service or one of its descriptors (`assertDelegatedEserviceHasNoActiveArchivingRequests`). | Cannot happen — the UI hides or disables the action when a pending archiving request already exists, so the normal request flow cannot trigger a second one. | — | — |

## 12. `DELETE /eservices/:eServiceId/submitDelegatedArchiving`

Service: `catalogService` → `cancelDelegatedEServiceArchiving`. Mapper: `cancelDelegatedEServiceArchivingErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /eservices/:eServiceId/submitDelegatedArchiving`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The e-service no longer exists when the delegate cancels the pending request (`retrieveEService`). | Cannot happen — the cancel action is only rendered from an already loaded e-service record and the UI does not expose a cancel control for a missing service. | — | — |
| `eServiceDescriptorNotFound` | 404 | The flow never loads a descriptor, so this 404 is a dead mapper entry in the cancel-e-service path. | Cannot happen — the call is e-service-scoped and the frontend never includes a descriptor id on this request. | — | — |
| `noActiveDelegationFound` | 404 | The active `delegatedProducer` relationship has been removed by the time the cancel check runs (`assertDelegatedArchivingRequestDelegationIsStillValid`). | Cannot happen — the dialog is only shown while the active delegation still exists, and the UI hides the action as soon as the delegation is revoked. | — | — |
| `operationForbidden` | 403 | The requester is not the active delegate for the e-service (`assertRequesterIsDelegateForArchiving`). | Cannot happen — the action is only rendered for the current delegate organization and the auth guard rejects other tenants before the request is sent. | — | — |
| `noDelegationForArchivingRequest` | 400 | No active producer delegation exists for the e-service (`retrieveActiveProducerDelegation` and `!producerDelegation`). | Cannot happen — the UI only opens the cancel dialog for a current delegated-archiving request, so a missing delegation cannot be triggered by a normal click. | — | — |
| `noDelegatedArchivingRequestFound` | 400 | There is no pending delegated archiving request to cancel (`assertDelegatedEserviceHasAtLeastOneArchivingRequests`). | Cannot happen — the cancel button is only generated when a pending request is present, and the normal flow hides it immediately once the request is removed. | — | — |
| `delegatedArchivingRequestNotActive` | 400 | The request is no longer in the active state when the delegate tries to cancel it (`assertDelegatedEserviceHasActiveArchivingRequests`). | Cannot happen — the UI hides the action once the request is accepted, rejected, or otherwise resolved, so a normal click cannot hit this branch. | — | — |
| `delegatedArchiveRequestForIncorrectDelegateProducer` | 400 | The pending request belongs to a different delegate than the requester (`assertDelegatedArchivingRequestDelegationIsStillValid`). | Cannot happen — the request is only visible to the matching delegate, and the action cannot be rendered for a different organization in the normal UI flow. | — | — |

## 13. `POST /eservices/:eServiceId/descriptors/:descriptorId/submitDelegatedArchiving`

Service: `catalogService` → `submitDelegatedDescriptorArchiving`. Mapper: `submitDelegatedArchivingErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/descriptors/:descriptorId/submitDelegatedArchiving`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The e-service no longer exists before the delegate submits the descriptor request (`retrieveEService`). | Cannot happen — the dialog is opened from a currently loaded e-service detail page and the UI never starts from a missing service. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id is missing from the e-service aggregate (`retrieveDescriptor`). | Cannot happen — the action is only rendered from an existing descriptor row in the UI, and the request is not generated for a removed or stale descriptor id. | — | — |
| `operationForbidden` | 403 | The requester is not the active delegate for the e-service (`assertRequesterIsDelegateForArchiving`). | Cannot happen — the delegate action is only visible to the current delegate tenant and the route is blocked by the auth guard for others. | — | — |
| `noDelegationForArchivingRequest` | 400 | No active delegated producer relationship is available for the e-service (`retrieveActiveProducerDelegation` and `if (!producerDelegation)`). | Cannot happen — the delegate “Richiedi archiviazione versione” dialog is only shown when a live delegation exists; the normal UI does not let the user submit without one. | — | — |
| `notValidEServiceState` | 400 | The e-service aggregate is not in a state that supports descriptor archiving (`assertEServiceArchivable`). | Cannot happen — the form is only offered for an e-service whose latest descriptor is in an archivable state, and the action is hidden otherwise. | — | — |
| `notValidDescriptor` | 400 | The descriptor itself is not in an archivable state (`assertDescriptorArchivable`). | Cannot happen — the version action is only exposed for a descriptor already considered valid for archiving, and the UI does not let the user pick a non-archivable version. | — | — |
| `eserviceWithoutValidDescriptors` | 400 | The e-service has no valid descriptor that can be archived (`assertDescriptorArchivable` / service-side validation for the aggregate). | Cannot happen — the request action is hidden whenever the service has no valid descriptor for delegation archiving, so the normal UI cannot reach this branch. | — | — |
| `gracePeriodDaysLowerThanDescriptor` | 400 | The chosen grace period would finish before an already-running descriptor archiving schedule (`assertEServiceGracePeriodIsNotLowerThanDescriptors`). | **CAN HAPPEN** — the version-level delegate dialog lets the user pick `30`, `60`, `90`, or `120` days without checking the existing `archivingSchedule`, so a shorter value can be submitted. | **Data precondition:** tenant A is the delegate of tenant B on e-service E, and one of B’s descriptors already has an `archivingSchedule` with an `archivableOn` later than the selected value.<br>1. Go to the provider e-service detail page as tenant A.<br>2. Open the “Richiedi archiviazione versione” dialog for the relevant version.<br>3. In “Seleziona la durata del periodo di preavviso”, choose “30 giorni”.<br>4. Click “Richiedi archiviazione”. | 🟢 Easy resolution<br>1. Choose a grace period that is not shorter than the currently scheduled descriptor deadline.<br>2. Submit again.<br>3. Refresh the page if the stale archiving date is still displayed and retry with a valid option. |
| `delegatedArchivingRequestAlreadyInProgress` | 409 | There is already an active delegated archiving request for the e-service or one of its descriptors (`assertDelegatedEserviceHasNoActiveArchivingRequests`). | Cannot happen — the normal UI hides or disables the action when a pending request already exists, so a second request cannot be triggered by a standard click. | — | — |

## 14. `DELETE /eservices/:eServiceId/descriptors/:descriptorId/submitDelegatedArchiving`

Service: `catalogService` → `cancelDelegatedDescriptorArchiving`. Mapper: `cancelDelegatedEServiceArchivingErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /eservices/:eServiceId/descriptors/:descriptorId/submitDelegatedArchiving`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The e-service has been removed before the delegate cancels the pending descriptor request (`retrieveEService`). | Cannot happen — the cancel action is only opened from an already loaded e-service detail page and no UI path submits a cancel for a missing service. | — | — |
| `eServiceDescriptorNotFound` | 404 | The descriptor id no longer exists in the current e-service aggregate (`retrieveDescriptor`). | Cannot happen — the cancel dialog is only offered from a currently loaded descriptor row, and the UI never sends a cancel call for a stale or missing descriptor. | — | — |
| `noActiveDelegationFound` | 404 | The active delegation required to cancel the request no longer exists (`assertDelegatedArchivingRequestDelegationIsStillValid`). | Cannot happen — the dialog is only rendered while the active delegation is valid, and the action disappears once the delegation is revoked. | — | — |
| `operationForbidden` | 403 | The requester is not the current delegate for the descriptor request (`assertRequesterIsDelegateForArchiving`). | Cannot happen — the UI only exposes the action to the active delegate organization, and the auth guard blocks other tenants before the request is sent. | — | — |
| `noDelegationForArchivingRequest` | 400 | No active producer delegation is associated with the e-service (`retrieveActiveProducerDelegation` and `!producerDelegation`). | Cannot happen — the UI cannot present a cancel button without an active delegation, so a normal click cannot trigger this branch. | — | — |
| `noDelegatedArchivingRequestFound` | 400 | No pending delegated archiving request exists for the descriptor (`assertDelegatedDescriptorHasAtLeastOneArchivingRequests`). | Cannot happen — the cancel action is only rendered in the presence of an active pending request, and the UI removes it once the request is no longer pending. | — | — |
| `delegatedArchivingRequestNotActive` | 400 | The request is no longer active when the delegate tries to cancel it (`assertDelegatedDescriptorHasActiveArchivingRequests`). | Cannot happen — once the request is approved, rejected, or resolved, the action is removed from the UI and the request cannot be submitted again by a normal click. | — | — |
| `delegatedArchiveRequestForIncorrectDelegateProducer` | 400 | The pending request belongs to a different delegate than the requester (`assertDelegatedArchivingRequestDelegationIsStillValid`). | Cannot happen — the UI only shows the cancel action for the matching delegate and never offers it to another organization. | — | — |

## 15. `POST /eservices/:eServiceId/descriptors/:descriptorId/approveDelegatedArchiving`

Service: `catalogService` → `approveDelegatedDescriptorArchiving`. Mapper: `approveDelegatedDescriptorArchivingErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/descriptors/:descriptorId/approveDelegatedArchiving`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The requested e-service is missing before the approval is processed (`retrieveEService`). | Cannot happen — the delegator only reaches this action from a currently loaded e-service detail page that already contains a pending delegated request; the normal UI never starts from a missing service id. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id is not present in the e-service aggregate when the approval is evaluated (`retrieveDescriptor`). | Cannot happen — the approval action is only rendered from an existing descriptor row already loaded in the e-service detail page, and the UI never calls this route for a stale or missing descriptor id. | — | — |
| `noActiveDelegationFound` | 404 | The active producer delegation linked to the e-service no longer exists at approval time (`retrieveActiveProducerDelegation`). | Cannot happen — the flow is only opened while the delegation is active, and the UI removes the approve action as soon as the delegation is revoked or expired. | — | — |
| `operationForbidden` | 403 | The requester is not the producer/owner of the e-service (`assertRequesterIsProducer`). | Cannot happen — the approval control is only exposed to the current owner/delegator in the provider UI, and the auth guard blocks other tenants before the request is sent. | — | — |
| `delegatedArchiveRequestForIncorrectDelegateProducer` | 403 | The pending request belongs to a different delegate than the current producer (`assertDelegatedArchivingRequestDelegationIsStillValid`). | Cannot happen — the UI only renders the approval action for the matching delegate request and never exposes it to a different organization in a normal session. | — | — |
| `noDelegatedArchivingRequestFound` | 400 | There is no active delegated archiving request for the descriptor (`assertDelegatedDescriptorHasAtLeastOneArchivingRequests`). | Cannot happen — the approve action is only shown when a pending request exists, and the normal flow hides it once the request is resolved or removed. | — | — |
| `notValidDescriptor` | 400 | The descriptor is not in an archivable state when the approval is evaluated (`assertDescriptorArchivable`). | Cannot happen — the UI only offers the approval action for a pending request that was already created against a valid descriptor in the current e-service detail state, so the user cannot trigger this branch from a normal page interaction. | — | — |
| `delegatedArchivingRequestNotActive` | 409 | The delegated request is no longer active when the producer tries to approve it (`assertDelegatedDescriptorHasActiveArchivingRequests`). | Cannot happen — once the request has been approved, rejected, or otherwise resolved, the control disappears from the provider UI and the action cannot be clicked again in the standard flow. | — | — |

## 16. `POST /eservices/:eServiceId/descriptors/:descriptorId/rejectDelegatedArchiving`

Service: `catalogService` → `rejectDelegatedDescriptorArchiving`. Mapper: `rejectDelegatedDescriptorArchivingErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/descriptors/:descriptorId/rejectDelegatedArchiving`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The requested e-service is missing before the rejection is processed (`retrieveEService`). | Cannot happen — the delegator only reaches this action from a loaded e-service detail page with an active pending request; the normal UI never starts from a missing service id. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id is not present in the e-service aggregate when the rejection is evaluated (`retrieveDescriptor`). | Cannot happen — the reject action is only rendered from an existing descriptor row in the current e-service detail page, and the UI never calls this route for a stale or missing descriptor id. | — | — |
| `noActiveDelegationFound` | 404 | The active producer delegation linked to the e-service no longer exists at rejection time (`retrieveActiveProducerDelegation`). | Cannot happen — the action is only available while the delegation is active, and the UI removes it as soon as the delegation is revoked or expires. | — | — |
| `operationForbidden` | 403 | The requester is not the producer/owner of the e-service (`assertRequesterIsProducer`). | Cannot happen — the reject control is only exposed to the current owner/delegator in the provider UI, and the auth guard blocks other tenants before the request is sent. | — | — |
| `delegatedArchiveRequestForIncorrectDelegateProducer` | 403 | The pending request belongs to a different delegate than the current producer (`assertDelegatedArchivingRequestDelegationIsStillValid`). | Cannot happen — the UI only renders the rejection action for the matching delegate request and never exposes it to a different organization in a normal session. | — | — |
| `noDelegatedArchivingRequestFound` | 400 | There is no active delegated archiving request for the descriptor (`assertDelegatedDescriptorHasAtLeastOneArchivingRequests`). | Cannot happen — the reject action is only shown when a pending request exists, and the standard UI hides it once the request is resolved or removed. | — | — |
| `delegatedArchivingRequestNotActive` | 409 | The delegated request is no longer active when the producer tries to reject it (`assertDelegatedDescriptorHasActiveArchivingRequests`). | Cannot happen — once the request is approved, rejected, or otherwise resolved, the control disappears from the provider UI and the action cannot be clicked again in the standard flow. | — | — |

## 17. `GET /eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId`

Service: `catalogService` → `getDocumentById`. Mapper: `documentGetErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SUPPORT_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `VIEWER_ROLE`, `REVIEWER_ROLE`.

### BFF endpoints

- `GET /eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The requested e-service id is not present in the read model (`retrieveEService`). | Cannot happen — the UI only starts this download from an already loaded e-service detail page, and the normal document action is never rendered for a missing service. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id is not associated with the e-service (`retrieveDescriptor`). | Cannot happen — the document-download control is only shown for a descriptor already loaded in the current UI state, and the normal flow never sends a stale descriptor id. | — | — |
| `eServiceDocumentNotFound` | 404 | The document id is missing from the descriptor's document list or is no longer visible after access checks (`retrieveDocument` / visibility validation). | Cannot happen — the FE obtains the document id from the current descriptor document list and only triggers the “Scarica documento” action for entries that are already loaded in the page; the user cannot normally click a missing file. | — | — |

## 18. `GET /eservices/:eServiceId/descriptors/:descriptorId/documents`

Service: `catalogService` → `getDocuments`. Mapper: `documentListErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SUPPORT_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The requested e-service id is not present in the read model when the document list is loaded (`retrieveEService`). | Cannot happen — the frontend never calls this list endpoint through a BFF route, and the normal UI only loads document lists from a still-existing e-service detail view. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id does not belong to the e-service when the document list is resolved (`retrieveDescriptorFromEService`). | Cannot happen — the frontend never triggers this list request for a stale or missing descriptor id, and no BFF route was found by the generator for the call. | — | — |

## 19. `POST /eservices/:eServiceId/descriptors/:descriptorId/documents`

Service: `catalogService` → `uploadDocument`. Mapper: `documentCreateErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/descriptors/:descriptorId/documents`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service is missing before the document is attached (`retrieveEService`). | Cannot happen — the document-upload action is opened from an already loaded provider e-service page, and the UI never submits a document for a missing service id. | — | — |
| `eServiceDescriptorNotFound` | 404 | The descriptor id is not attached to the e-service when the upload runs (`retrieveDescriptor`). | Cannot happen — the upload form is rendered for the current descriptor already loaded in the page, and the normal flow never sends a stale descriptor id. | — | — |
| `notValidDescriptor` | 400 | The descriptor is in a non-editable state for document upload (`innerAddDocumentToEserviceEvent` / descriptor-state validation). | Cannot happen — the UI only offers document upload while the current descriptor is still editable, and the drawer/form is not shown for a non-draft or non-archivable version. | — | — |
| `documentPrettyNameDuplicate` | 409 | A document with the same `prettyName` already exists in the same descriptor (`documentPrettyNameDuplicate`). | **CAN HAPPEN** — the upload form accepts a free-text name without a client-side uniqueness check, so the user can repeat an existing document label in the same version. | **Data precondition:** tenant A has a draft descriptor D of e-service E with an existing document named `API spec`.<br>1. Go to the provider e-service draft page for E and open the document upload section.<br>2. Select a file to upload.<br>3. In _Nome documento_, type `API spec`.<br>4. Click _Salva documento_. | 🟢 Easy resolution<br>1. Change the document name to a unique value.<br>2. Click _Salva documento_ again.<br>3. Refresh the form if the page still shows the old list and retry. |
| `interfaceAlreadyExists` | 409 | The descriptor already has an interface document and the upload tries to add another interface payload (`interfaceAlreadyExists`). | Cannot happen — the standard document upload form submits only `kind: 'DOCUMENT'` and never passes the interface-specific mutation path the UI does not expose. | — | — |
| `asyncExchangeCallbackInterfaceAlreadyExists` | 409 | The descriptor already contains the callback interface for async exchange and the upload tries to set it again (`asyncExchangeCallbackInterfaceAlreadyExists`). | Cannot happen — the document upload UI in the normal provider flow never submits the async callback interface kind, so this branch is unreachable in the regular product path. | — | — |
| `checksumDuplicate` | 409 | The uploaded file content matches another document already present in the descriptor (`checksumDuplicate`). | **CAN HAPPEN** — the front end does not block re-uploading the same file, and the backend validates by file checksum instead of file name. | **Data precondition:** tenant A already uploaded a document file `F` to descriptor D.<br>1. Go to the provider e-service draft page for E and open the document upload section.<br>2. Select the same file `F` again.<br>3. Type a different or same label in _Nome documento_.<br>4. Click _Salva documento_. | 🟢 Easy resolution<br>1. Rename or replace the file before uploading it again.<br>2. Re-run the upload with a different document content or a new file.<br>3. If the page still shows the old record, refresh and upload again with the new file. |
| `eServiceAsyncExchangeNotEnabled` | 400 | The async-exchange feature is disabled while a callback/interface-related upload is attempted (`eServiceAsyncExchangeNotEnabled`). | Cannot happen — the normal UI only uploads standard documents with `kind: 'DOCUMENT'`, and the async-exchange callback path is never triggered by the product pages. | — | — |
| `asyncExchangeBulkNotAllowedForSoap` | 400 | A bulk async-exchange operation is attempted on a SOAP e-service (`asyncExchangeBulkNotAllowedForSoap`). | Cannot happen — the UI does not expose an async bulk upload path for a SOAP document in the standard e-service docs flow. | — | — |
| `templateInstanceNotAllowed` | 400 | The target e-service is a template instance and the upload is blocked (`templateInstanceNotAllowed`). | Cannot happen — the provider upload flow is not rendered for template-instance e-services, and the frontend does not offer this upload action in that context. | — | — |
| `operationForbidden` | 403 | The requester is not the current producer or delegate for the e-service (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the action sits behind the provider auth guard and only appears for the active producer/delegate tenant; other roles never see the button. | — | — |

## 20. `DELETE /eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId`

Service: `catalogService` → `deleteDocument`. Mapper: `documentDeleteErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service is missing before deleting the document (`retrieveEService`). | Cannot happen — the delete action is only rendered from a currently loaded document list, and the UI never triggers a delete request for a missing service id. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor is no longer associated with the e-service (`retrieveDescriptor`). | Cannot happen — the user can only click delete from a currently visible descriptor document list, so a stale descriptor id is not reachable through the standard UI flow. | — | — |
| `eServiceDocumentNotFound` | 404 | The document id is no longer present in the descriptor (`retrieveDocument`). | Cannot happen — the deletion control is generated from the current document list, and the normal FE flow never sends a delete for a document that disappeared from the loaded page. | — | — |
| `notValidDescriptor` | 400 | The descriptor is in a state that forbids document deletion (`assertDocumentDeletableDescriptorState` / `assertInterfaceDeletableDescriptorState`). | Cannot happen — the document deletion action is only shown in an editable draft flow, and the UI does not expose the action for non-deletable states. | — | — |
| `templateInstanceNotAllowed` | 400 | The e-service is a template instance and document deletion is blocked (`assertEServiceNotTemplateInstance`). | Cannot happen — the UI never renders the delete action for template-instance services and no normal flow submits document deletion for them. | — | — |
| `operationForbidden` | 403 | The requester is not the active producer or delegate for the e-service (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the action is only available to the current provider/delegate session and the auth guard blocks all other tenants before the request is sent. | — | — |

## 21. `PUT /eservices/:eServiceId/descriptors/:descriptorId`

Service: `catalogService` → `updateDraftDescriptor`. Mapper: `updateDraftDescriptorErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `PUT /eservices/:eServiceId/descriptors/:descriptorId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id is missing before the draft update (`retrieveEService` in `updateDraftDescriptor`). | Cannot happen — the FE only calls this mutation from an already-loaded provider e-service draft, and the wizard never sends a stale service id to the BFF. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id is not attached to the loaded e-service (`retrieveDescriptor`). | Cannot happen — the page opens from an existing descriptor loaded in the current UI state, and the normal flow never sends a stale descriptor id. | — | — |
| `attributeNotFound` | 404 | One of the submitted attribute ids is missing from the descriptor or catalog after rehydration (`parseAndCheckAttributes`). | Cannot happen — the FE rebuilds the attribute payload from the currently loaded descriptor and does not expose a way to submit a foreign or stale attribute id from another draft. | — | — |
| `operationForbidden` | 403 | The requester is not the producer or active delegate for the e-service (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the action is rendered only in the provider flow and the auth guard blocks non-owner tenants before the request is sent. | — | — |
| `notValidDescriptor` | 400 | The descriptor is not in `draft` state (`assertIsDraftDescriptor`). | Cannot happen — the edit action is only shown for draft descriptors in the creation wizard, and the UI never submits a non-draft version update. | — | — |
| `inconsistentDailyCalls` | 400 | The merged quota values violate `dailyCallsPerConsumer <= dailyCallsTotal` (`assertConsistentDailyCalls`). | Cannot happen — the threshold section enforces `dailyCallsTotal >= dailyCallsPerConsumer` and the form validates integer values before dispatch. | — | — |
| `templateInstanceNotAllowed` | 400 | The target e-service was created from a template instance (`assertEServiceNotTemplateInstance`). | Cannot happen — the regular update-draft wizard is not rendered for template-instance e-services and the FE never calls this endpoint in that context. | — | — |
| `attributeDuplicatedInGroup` | 400 | The updated attribute seed contains the same attribute id more than once in the same group (`parseAndCheckAttributes`). | Cannot happen — the UI constructs the seed from the current descriptor and the attribute editor does not expose a duplicate-in-group action for normal provider editing. | — | — |
| `attributeDailyCallsNotAllowed` | 400 | A certified attribute includes a custom per-consumer threshold (`assertDailyCallsForCertifiedAttributesOnly`). | Cannot happen — the certified-attribute form in the provider wizard is read-only for daily-call caps and the FE never sends that payload from the standard create flow. | — | — |
| `asyncExchangeBulkNotAllowedForSoap` | 400 | The async-exchange `bulk` option is enabled for a SOAP e-service (`assertAsyncExchangeBulkAllowedForDescriptor`). | Cannot happen — the async-exchange section does not expose the invalid SOAP/bulk combination in the normal UI flow, and the form is validated before submit. | — | — |
| `attributeDiscreteConfigNotAllowed` | 400 | A certified attribute has a discrete configuration object in the seed (`assertDiscreteConfigForCertifiedAttributesOnly`). | Cannot happen — the FE never exposes discrete configuration for certified attributes in this update-draft screen, so the invalid payload cannot be generated by a normal interaction. | — | — |

## 22. `PATCH /eservices/:eServiceId/descriptors/:descriptorId`

Service: `catalogService` → `patchUpdateDraftDescriptor`. Mapper: `updateDraftDescriptorErrorMapper`. Roles: `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id is missing before the partial draft update (`retrieveEService`). | Cannot happen — there is no BFF route for this M2M-only mutation, and the normal provider UI never emits the call. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id is not attached to the e-service (`retrieveDescriptor`). | Cannot happen — no BFF route exists for this path and the browser UI never triggers a stale descriptor patch against a live page. | — | — |
| `attributeNotFound` | 404 | An attribute id in the partial seed cannot be resolved from the descriptor (`parseAndCheckAttributes`). | Cannot happen — no frontend action sends this patch request through the BFF, so the invalid attribute payload cannot be produced by a normal UI interaction. | — | — |
| `operationForbidden` | 403 | The requester is not allowed to patch the draft descriptor (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the normal UI has no access to this M2M-only path, and the generator did not find a BFF route for it. | — | — |
| `notValidDescriptor` | 400 | The descriptor is not in the `draft` state (`assertIsDraftDescriptor`). | Cannot happen — the frontend does not expose a direct UI flow for this patch endpoint, and the route is not reachable in the browser. | — | — |
| `inconsistentDailyCalls` | 400 | The submitted quota values violate `dailyCallsPerConsumer <= dailyCallsTotal` (`assertConsistentDailyCalls`). | Cannot happen — there is no BFF route for the PATCH call and the product UI never submits partial draft updates with invalid quota values. | — | — |
| `templateInstanceNotAllowed` | 400 | The e-service is a template instance (`assertEServiceNotTemplateInstance`). | Cannot happen — this endpoint is not exposed to the web UI and no provider screen reaches the M2M-only patch path. | — | — |
| `attributeDuplicatedInGroup` | 400 | The partial seed contains duplicate attributes in the same group (`parseAndCheckAttributes`). | Cannot happen — no BFF route exists for this backend mutation and the browser cannot generate the invalid duplicate payload through a product action. | — | — |
| `attributeDailyCallsNotAllowed` | 400 | A certified attribute includes custom daily-call caps (`assertDailyCallsForCertifiedAttributesOnly`). | Cannot happen — no browser flow submits this patch to the BFF, so the invalid attribute shape is not reachable through the normal UI. | — | — |
| `asyncExchangeBulkNotAllowedForSoap` | 400 | Async exchange `bulk` is enabled for a SOAP e-service (`assertAsyncExchangeBulkAllowedForDescriptor`). | Cannot happen — the PATCH route is not exposed through the FE and the UI never sends the unsupported SOAP/bulk combination via this call path. | — | — |
| `attributeDiscreteConfigNotAllowed` | 400 | A certified attribute carries a discrete config in the patch payload (`assertDiscreteConfigForCertifiedAttributesOnly`). | Cannot happen — there is no BFF route and the browser UI does not provide a way to submit the invalid certified-attribute configuration through the normal user flow. | — | — |

## 23. `POST /templates/eservices/:eServiceId/descriptors/:descriptorId`

Service: `catalogService` → `updateDraftDescriptorTemplateInstance`. Mapper: `updateDraftDescriptorTemplateInstanceErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `POST /templates/eservices/:eServiceId/descriptors/:descriptorId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target template instance e-service is missing before the draft update (`retrieveEService`). | Cannot happen — the FE only calls this route from an already-loaded template-based draft item, and the wizard never sends a stale e-service id. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id is not attached to the selected template instance (`retrieveDescriptor`). | Cannot happen — the create-from-template screen is built from a descriptor already selected in the current state, and the standard flow never submits a stale descriptor id. | — | — |
| `operationForbidden` | 403 | The requester is not the producer or active delegate for the template instance (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the action is only rendered in the provider create flow and the auth guard blocks non-owner tenants before the request is sent. | — | — |
| `notValidDescriptor` | 400 | The descriptor is not in `draft` state (`assertIsDraftDescriptor`). | Cannot happen — the template-instance edit flow is only shown for draft descriptors, and the UI never submits a non-draft version update. | — | — |
| `inconsistentDailyCalls` | 400 | The merged quotas violate `dailyCallsPerConsumer <= dailyCallsTotal` (`assertConsistentDailyCalls`). | Cannot happen — the threshold step validates the value before submit and the normal template-instance form does not allow the inverted quota ratio. | — | — |
| `attributeNotFound` | 404 | An attribute id in the template-instance seed is no longer resolvable in the loaded descriptor (`parseAndCheckAttributes`). | Cannot happen — the FE rebuilds the seed from the currently loaded descriptor and the user cannot submit a foreign attribute id through the normal create-from-template flow. | — | — |
| `eServiceNotAnInstance` | 400 | The target e-service is not a template instance (`assertEServiceIsTemplateInstance`). | Cannot happen — the page only invokes this route when the service was created from a template, and the normal UI never exposes the action for a plain e-service. | — | — |
| `attributeDiscreteConfigNotAllowed` | 400 | A certified attribute includes a discrete configuration object (`assertDiscreteConfigForCertifiedAttributesOnly`). | Cannot happen — the template-instance form never exposes discrete config for certified attributes and the UI never generates that invalid payload in the standard create path. | — | — |
| `templateInstanceNotAllowed` | 400 | The update is attempted against a non-template instance or a template instance in an unsupported context (`assertEServiceIsTemplateInstance` / template-check logic). | Cannot happen — the route itself is the template-instance update path; the user can reach it only from the valid template-based draft flow and the UI does not permit the unsupported context. | — | — |

## 24. `POST /eservices/:eServiceId/descriptors/:descriptorId/publish`

Service: `catalogService` → `publishDescriptor`. Mapper: `publishDescriptorErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/descriptors/:descriptorId/publish`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id does not exist in the read model (`retrieveEService`). | Cannot happen — the publish action is only rendered for e-services already loaded in the provider details flow, and the UI does not allow submitting a stale `eServiceId` from a normal browser action. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id is not attached to the loaded e-service (`retrieveDescriptor`). | Cannot happen — the provider version summary page only exposes the publish action for descriptors currently loaded in the UI, and the regular flow cannot send a stale or orphaned descriptor id. | — | — |
| `eServiceDescriptorWithoutInterface` | 400 | The descriptor has no API interface attached (`descriptor.interface === undefined`). | Cannot happen — the provider publish action is only enabled after the descriptor has a valid interface, and the UI blocks publication until the document is attached. | — | — |
| `eServiceRiskAnalysisIsRequired` | 400 | The e-service is in `RECEIVE` mode and the risk analysis is required but missing (`assertRiskAnalysisIsValidForPublication`). | Cannot happen — the create/publish wizard requires a valid risk analysis before allowing the descriptor to be published, and the UI hides the action until the analysis is present. | — | — |
| `riskAnalysisNotValid` | 400 | The configured risk analysis is invalid or incomplete for publication (`assertRiskAnalysisIsValidForPublication`). | Cannot happen — the FE validates the risk-analysis section before submit and prevents publication when the selected analysis is not valid for the tenant/use case. | — | — |
| `riskAnalysisTenantKindMismatch` | 400 | The tenant kind does not match the risk-analysis requirements for the current e-service (`assertRiskAnalysisIsValidForPublication`). | Cannot happen — the risk-analysis form is constrained by the current tenant kind and the publish action is disabled until the mismatch is fixed in the provider flow. | — | — |
| `notValidDescriptor` | 400 | The selected descriptor is not in the `draft` state (`descriptor.state !== descriptorState.draft`). | Cannot happen — the provider UI only exposes publication for draft descriptors, and the normal browser flow never submits a non-draft version to this endpoint. | — | — |
| `audienceCannotBeEmpty` | 400 | The descriptor has no audience values (`descriptor.audience.length === 0`). | Cannot happen — the publish step requires at least one audience value and the UI prevents the final submit while the field is empty. | — | — |
| `missingPersonalDataFlag` | 400 | The e-service does not declare whether it handles personal data (`eservice.data.personalData === undefined`). | Cannot happen — the provider details flow forces a personal-data choice before the publish action is available, and the form never submits the request without it. | — | — |
| `missingAsyncExchangeProperties` | 400 | Async exchange is enabled but required async properties are missing (`assertAsyncExchangeReadyForPublication`). | Cannot happen — the async-exchange configuration is required before publication and the form disables the publish action when those properties are incomplete. | — | — |
| `missingAsyncExchangeCallbackInterface` | 400 | Async exchange is enabled but the callback interface is missing (`assertAsyncExchangeReadyForPublication`). | Cannot happen — the provider UI requires the callback interface before enabling publication for async-exchange descriptors, so the request cannot be emitted in a normal interaction. | — | — |
| `asyncExchangeBulkNotAllowedForSoap` | 400 | Async exchange bulk is enabled for a SOAP descriptor (`assertAsyncExchangeReadyForPublication`). | Cannot happen — the form does not expose the unsupported SOAP/bulk combination and blocks the publish action before the request is sent. | — | — |
| `operationForbidden` | 403 | The requester is not allowed to publish the descriptor (`assertRequesterCanPublish`). | Cannot happen — the provider route and tenant/delegation checks guard the action before the back-end call, and the normal UI never exposes the button to a non-authorized tenant. | — | — |

## 25. `POST /eservices/:eServiceId/descriptors/:descriptorId/suspend`

Service: `catalogService` → `suspendDescriptor`. Mapper: `suspendDescriptorErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/descriptors/:descriptorId/suspend`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id is missing from the read model before the suspension (`retrieveEService`). | Cannot happen — the UI only renders the suspend action from an already-loaded provider e-service and the normal flow cannot submit a stale service id. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id is not attached to the e-service (`retrieveDescriptor`). | Cannot happen — the action is generated from the current descriptor list, and the standard provider page never sends a non-existent descriptor id. | — | — |
| `notValidDescriptor` | 400 | The descriptor is not in a publishable suspendable state (`assertDescriptorInRequiredStates` for `DEPRECATED`, `PUBLISHED`, `ARCHIVING`). | Cannot happen — the UI only shows the suspend action for descriptors currently in allowed states, and the action is disabled or hidden when the state does not match. | — | — |
| `operationForbidden` | 403 | The requester is not the producer or active delegate for the e-service (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the provider auth guard and delegation checks block the action before the backend call, and the normal UI does not render the suspend button to unauthorized tenants. | — | — |

## 26. `POST /eservices/:eServiceId/descriptors/:descriptorId/activate`

Service: `catalogService` → `activateDescriptor`. Mapper: `activateDescriptorErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/descriptors/:descriptorId/activate`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id does not exist before the reactivation (`retrieveEService`). | Cannot happen — the UI creates the action from the currently loaded provider e-service and never offers a reactivation action for a stale or missing service. | — | — |
| `eServiceDescriptorNotFound` | 404 | The descriptor id is not attached to the e-service (`retrieveDescriptor`). | Cannot happen — the reactivation action is generated from the already-open descriptor list, and the normal browser flow cannot submit a missing descriptor id. | — | — |
| `notValidDescriptor` | 400 | The descriptor is not in an activatable state (`assertDescriptorInRequiredStates` for `SUSPENDED` or `ARCHIVING_SUSPENDED`). | Cannot happen — the provider action menu only exposes the reactivation control when the current state matches one of the allowed values, and the UI prevents the invalid transition. | — | — |
| `operationForbidden` | 403 | The requester is not the producer or active delegate for the e-service (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the route is protected by provider auth and delegation rules, and the web client does not expose the reactivation action to unauthorized tenants. | — | — |

## 27. `POST /eservices/:eServiceId/descriptors/:descriptorId/clone`

Service: `catalogService` → `cloneDescriptor`. Mapper: `cloneEServiceByDescriptorErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/descriptors/:descriptorId/clone`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id does not exist before cloning (`retrieveEService`). | Cannot happen — the clone action is only rendered for an already loaded provider e-service, and the BFF route is reached from the current version detail page rather than from a free-form id entry. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor is not attached to the selected e-service (`retrieveDescriptor`). | Cannot happen — the action is generated from a descriptor currently displayed in the provider details page, and the FE does not submit a stale descriptor id from a normal interaction. | — | — |
| `eServiceNameDuplicateForProducer` | 409 | The automatically generated clone name is already owned by the producer (`assertEServiceNameAvailableForProducer`). | Cannot happen — the clone flow assigns the name automatically from the source service and timestamp; the user cannot edit the generated name and the UI does not expose a custom-name field for cloning. | — | — |
| `eserviceTemplateNameConflict` | 409 | The automatically generated clone name conflicts with an existing e-service template (`assertEServiceNameNotConflictingWithTemplate`). | Cannot happen — the clone flow generates the new name from the source e-service name and a timestamp; the user cannot override it, so the name cannot be chosen to match a template name. | — | — |
| `templateInstanceNotAllowed` | 400 | The source e-service is a template instance (`assertEServiceNotTemplateInstance`). | Cannot happen — the provider UI only exposes the clone action on standard published versions, and template-instance services do not render the clone action in the normal flow. | — | — |
| `operationForbidden` | 403 | The requester is not the producer of the source e-service (`assertRequesterIsProducer`). | Cannot happen — the provider route and auth guard restrict clone actions to the owning producer/admin API context, and the UI does not render the button to unauthorized tenants. | — | — |
| `eserviceWithActiveOrPendingDelegation` | 403 | The source e-service still has an active or pending delegation (`assertNoExistingProducerDelegationInActiveOrPendingState`). | Cannot happen — the provider page hides the clone action when the e-service still has an active or pending delegation, and the normal UI does not allow the action to proceed in that state. | — | — |

## 28. `POST /eservices/:eServiceId/descriptors/:descriptorId/update`

Service: `catalogService` → `updateDescriptor`. Mapper: `updateDescriptorErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/descriptors/:descriptorId/update`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id is missing before the update (`retrieveEService`). | Cannot happen — the BFF route is only called from an already loaded provider descriptor page, and the standard UI never submits a stale e-service id. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id is not attached to the selected e-service (`retrieveDescriptor`). | Cannot happen — the update action is generated from the descriptor currently visible in the provider detail view, and the normal browser flow cannot send a missing descriptor id. | — | — |
| `operationForbidden` | 403 | The requester is not the producer or delegate allowed to edit the descriptor (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the route is protected by auth and delegation checks, and the provider UI does not show the update action to unauthorized tenants. | — | — |
| `notValidDescriptor` | 400 | The descriptor is not updatable after publication (`assertDescriptorUpdatableAfterPublish`). | Cannot happen — the provider details screen only shows the quota-update action for a currently editable descriptor and hides it once the descriptor is no longer updatable. | — | — |
| `inconsistentDailyCalls` | 400 | The input quotas violate `dailyCallsPerConsumer <= dailyCallsTotal` (`assertConsistentDailyCalls`). | Cannot happen — the quota drawer only reads the existing descriptor values and does not expose a custom daily-calls form that can invert the relationship. | — | — |
| `attributeDailyCallsNotAllowed` | 400 | A certified attribute in the payload tries to set a custom daily-call cap (`assertDailyCallsForCertifiedAttributesOnly`). | Cannot happen — the update endpoint is only used for the descriptor quotas drawer; the FE never sends custom attribute thresholds through this route. | — | — |
| `templateInstanceNotAllowed` | 400 | The target e-service is a template instance (`assertEServiceNotTemplateInstance`). | Cannot happen — the quota update action is not rendered for template instances, and the normal provider flow never reaches this endpoint with that object. | — | — |
| `attributeDiscreteConfigNotAllowed` | 400 | A certified attribute in the payload includes a discrete configuration (`assertDiscreteConfigForCertifiedAttributesOnly`). | Cannot happen — the FE never exposes a discrete-config editor on the descriptor update drawer, so the invalid payload cannot be produced by a normal interaction. | — | — |
| `certifiedDiscreteAttributeConfigCannotBeChanged` | 400 | The descriptor already contains a certified attribute with a discrete config and the update payload tries to change it (`assertCertifiedDiscreteConfigUnchanged`). | Cannot happen — the UI does not allow editing certified discrete-config attributes from the descriptor quota update flow, so the invalid mutation is never generated by the normal UI. | — | — |

## 29. `POST /eservices/:eServiceId/descriptors/:descriptorId/scheduleArchive`

Service: `catalogService` → `scheduleEServiceDescriptorArchiving`. Mapper: `updateEserviceDescriptorArchivingStatusErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceDescriptorWithActiveOrPendingDelegation` | 409 | The descriptor still has an active or pending delegation while archiving is scheduled (`assertNoExistingProducerDelegationForDescriptorArchiving`). | Cannot happen — the generator found no BFF route for this endpoint and the standard provider UI does not expose a direct selector to call the descriptor archiving schedule API. | — | — |
| `eServiceNotFound` | 404 | The target e-service id is missing before the scheduling call (`retrieveEService`). | Cannot happen — there is no BFF route for this mutation and no browser action in the normal UI assembles a stale e-service id for it. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id is not attached to the selected e-service (`retrieveDescriptor`). | Cannot happen — no frontend route invokes this mutation, and the browser flow never sends an orphaned descriptor id to this backend path. | — | — |
| `operationForbidden` | 403 | The requester is not the producer of the e-service (`assertRequesterIsProducer`). | Cannot happen — the route is not exposed through the BFF and the normal provider UI never reaches this mutation for unauthorized tenants. | — | — |
| `descriptorArchivingNotCancelableByScope` | 403 | The descriptor is already in an E-Service scoped archiving schedule and cannot be rescheduled as a descriptor-scoped archiving (`assertDescriptorArchivingIsNotEserviceScoped`). | Cannot happen — no BFF route calls this endpoint in the front-end flow, and the UI does not provide a direct action that would produce an E-Service-scoped descriptor archiving conflict. | — | — |
| `notValidDescriptor` | 400 | The descriptor is not in an archivable state for descriptor scheduling (`assertDescriptorArchivable`). | Cannot happen — the generator found no BFF route for this endpoint, so the browser cannot trigger the invalid state transition through a normal user interaction. | — | — |
| `eserviceWithoutValidDescriptors` | 409 | The e-service does not have a valid descriptor set for archiving scheduling (`assertEserviceHasValidDescriptors`). | Cannot happen — no browser flow reaches this endpoint, and the FE does not offer a direct call path that could submit a service without valid descriptors. | — | — |

## 30. `POST /eservices/:eServiceId/riskAnalysis`

Service: `catalogService` → `createRiskAnalysis`. Mapper: `createRiskAnalysisErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id does not exist before the risk-analysis insertion (`retrieveEService`). | Cannot happen — the provider creation step is opened only from an existing e-service draft in the UI, and the normal flow never submits a stale or missing e-service id. | — | — |
| `eserviceNotInDraftState` | 400 | The e-service is already out of its draft state when the risk-analysis is added (`assertIsDraftEservice`). | Cannot happen — the risk-analysis form is only shown while the draft is still being created or edited, and the action is not available once the service is published. | — | — |
| `eserviceNotInReceiveMode` | 400 | The e-service is not in `RECEIVE` mode when the risk-analysis is saved (`assertIsReceiveEservice`). | Cannot happen — the create step only renders the risk-analysis form when `mode === RECEIVE`, and the UI does not offer the action for a deliver-mode e-service. | — | — |
| `riskAnalysisValidationFailed` | 400 | The submitted answers fail the schema validation for the selected tenant kind and personal-data configuration (`validateRiskAnalysisSchemaOrThrow`). | Cannot happen — `CreateStepPurposeRiskAnalysisForm` validates the questionnaire before submit and blocks incompatible personal-data answers, so malformed answer payloads are not sent by the normal UI. | — | — |
| `riskAnalysisTenantKindMismatch` | 400 | The selected risk-analysis template is incompatible with the producer tenant kind (`validateRiskAnalysisSchemaOrThrow` for `tenant.kind`). | Cannot happen — the UI loads the risk-analysis template from the current tenant context and does not let the user choose or switch to an incompatible rule set during the provider flow. | — | — |
| `templateInstanceNotAllowed` | 400 | The target e-service is a template instance (`assertEServiceNotTemplateInstance`). | Cannot happen — the risk-analysis wizard is part of the provider create flow for regular e-services and is not rendered for template-created instances. | — | — |
| `operationForbidden` | 403 | The requester is not the producer or active delegate for the e-service (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the route is behind provider auth and the UI only exposes the risk-analysis step to the current tenant’s authorized users. | — | — |
| `riskAnalysisDuplicated` | 409 | The risk-analysis name already exists for the same e-service (`ra.name.toLowerCase() === ...`). | **CAN HAPPEN** — the form accepts a duplicate name and does not run a preflight duplicate check before sending the request. | **Data precondition:** tenant A is creating a draft receive e-service and already has a finality named `N` on the same e-service.<br>1. Go to `/erogazione/e-service/crea/` and continue to the risk-analysis step for a receive-mode e-service.<br>2. In _Nome della finalità_, type `N`.<br>3. Complete the questionnaire and click _Salva bozza e prosegui_. | 🟢 Easy resolution<br>1. Change the finality name to a unique value.<br>2. Save again.<br>3. Refresh the page if the previous attempt is stale and retry with the new name. |

## 31. `POST /eservices/:eServiceId/descriptors/:descriptorId/agreementApprovalPolicy/update`

Service: `catalogService` → `updateAgreementApprovalPolicy`. Mapper: `updateAgreementApprovalPolicyErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `POST /eservices/:eServiceId/descriptors/:descriptorId/agreementApprovalPolicy/update`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id is missing before the agreement-approval update (`retrieveEService`). | Cannot happen — the drawer opens from an already loaded provider descriptor and the normal UI never submits a stale or missing e-service id. | — | — |
| `eServiceDescriptorNotFound` | 404 | The target descriptor id is not attached to the selected e-service (`retrieveDescriptor`). | Cannot happen — the action is generated from the descriptor shown in the provider details view, and the normal browser flow cannot dispatch a missing descriptor id. | — | — |
| `operationForbidden` | 403 | The requester is not the producer or delegate allowed to edit the descriptor (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the route is protected by auth and delegation checks, and the UI does not render the drawer for unauthorized tenants. | — | — |
| `notValidDescriptor` | 400 | The descriptor is not in an updatable state (`assertDescriptorUpdatableAfterPublish`). | Cannot happen — the drawer only opens for a valid mutable descriptor and the form validation rejects the same current value, so the backend never sees an invalid state from the normal FE flow. | — | — |

## 32. `POST /eservices/:eServiceId/riskAnalysis/:riskAnalysisId`

Service: `catalogService` → `updateRiskAnalysis`. Mapper: `updateRiskAnalysisErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eServiceNotFound` | 404 | The target e-service id is missing before the risk-analysis update (`retrieveEService`). | Cannot happen — the provider risk-analysis form is opened from an already loaded draft and the normal UI never submits a stale or missing e-service id. | — | — |
| `eServiceRiskAnalysisNotFound` | 404 | The selected risk-analysis id is not attached to the e-service (`retrieveRiskAnalysis`). | Cannot happen — the edit action is generated from the risk-analysis currently visible in the form, and the browser flow does not allow submitting a missing id. | — | — |
| `eserviceNotInDraftState` | 400 | The e-service is no longer in draft state when the risk-analysis is updated (`assertIsDraftEservice`). | Cannot happen — the form is only available while the draft is still editable; once the e-service is published, the update action disappears. | — | — |
| `eserviceNotInReceiveMode` | 400 | The e-service is not in `RECEIVE` mode for the update (`assertIsReceiveEservice`). | Cannot happen — the risk-analysis editor is only rendered for receive-mode services, and the UI does not offer the save action in deliver mode. | — | — |
| `riskAnalysisValidationFailed` | 400 | The updated answer set fails the tenant-kind or personal-data validation (`validateRiskAnalysisSchemaOrThrow`). | Cannot happen — the risk-analysis form validates answers before submit and blocks incompatible personal-data combinations, so malformed payloads are never generated by a normal interaction. | — | — |
| `templateInstanceNotAllowed` | 400 | The target e-service is created from a template (`assertEServiceNotTemplateInstance`). | Cannot happen — the standard risk-analysis editor is not displayed for template instances, and the edit action is not exposed in that context. | — | — |
| `operationForbidden` | 403 | The requester is not the producer or active delegate (`assertRequesterIsDelegateProducerOrProducer`). | Cannot happen — the route sits behind the provider auth guard and the UI only renders the edit action to authorized tenant members. | — | — |
| `riskAnalysisDuplicated` | 409 | A different risk-analysis in the same e-service already uses the same name (`ra.id !== riskAnalysisId && ra.name.toLowerCase() === ...`). | **CAN HAPPEN** — the edit form allows renaming a finality to a value already used by a different finality on the same e-service, without a preflight duplicate check. | **Data precondition:** tenant A is editing a draft receive e-service whose risk-analysis list already contains a finality named `N`.<br>1. Go to `/erogazione/e-service/crea/` and open the risk-analysis step for the draft.<br>2. Edit the current finality and in _Nome della finalità_ type `N`.<br>3. Complete or keep the questionnaire and click _Salva bozza e prosegui_. | 🟢 Easy resolution<br>1. Change the finality name so it differs from every other risk-analysis name in the same e-service.<br>2. Save again.<br>3. Refresh the page if the list is stale and retry with the unique name. |

