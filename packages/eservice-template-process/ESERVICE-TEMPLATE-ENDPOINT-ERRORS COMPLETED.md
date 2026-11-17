## 1. `GET /templates`

Service: `eserviceTemplateService` → `getEServiceTemplates`. Mapper: `getEServiceTemplatesErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | This mapper entry appears dead: no throw site was found in the `getEServiceTemplates` flow, and the method only reads the list from the read model and returns it. | Cannot happen — the generator found no BFF endpoint for `GET /templates`, and the normal template-list UI never issues a missing-template lookup through the product flow. | — | — |

## 2. `POST /templates`

Service: `eserviceTemplateService` → `createEServiceTemplate`. Mapper: `createEServiceTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/templates`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `originNotCompliant` | 403 | The requester tenant origin is not in `config.producerAllowedOrigins` (`retrieveOriginFromAuthData` in `createEServiceTemplate`). | Cannot happen — `/erogazione/template-eservice/crea` is a provider route and `AuthGuard` blocks provider access unless `isOrganizationAllowedToProduce`; the route is not reachable for non-compliant tenants. | — | — |
| `eserviceTemplateDuplicate` | 409 | The template name is already present in the read model (`assertEServiceTemplateNameAvailable` / `readModelService.isEServiceTemplateNameAvailable`). | **CAN HAPPEN** — the create form submits a free-text template name and does not pre-check duplicates before the request; a user can submit a name already used by another template of the same tenant. | **Data precondition:** tenant A already owns a template named `N`.<br>1. Go to `/erogazione/template-eservice/crea`.<br>2. Type `N` in _Nome del template di e-service_.<br>3. Fill the required fields and click _Salva bozza e prosegui_. | 🟢 Easy resolution<br>1. Change the template name to a unique value.<br>2. Save again.<br>3. If the page is stale, refresh the page and retry with the new name. |
| `inconsistentDailyCalls` | 400 | `dailyCallsPerConsumer > dailyCallsTotal` (`assertConsistentDailyCalls`). | Cannot happen — `EServiceTemplateCreateStepThresholdsAndAttributes` sets the total field minimum to the per-consumer value and validates integer values, so the inverted ratio cannot be submitted from the form. | — | — |
| `asyncExchangeReceiveTemplateNotAllowed` | 400 | Async exchange is enabled while the template mode is `RECEIVE` (`assertAsyncExchangeReceiveTemplateNotAllowed`). | Cannot happen — `EServiceDetailsSectionBase` forces `mode` back to `DELIVER` whenever `asyncExchange` is true and disables the mode radio while async exchange is enabled. | — | — |

## 3. `GET /templates/:templateId`

Service: `eserviceTemplateService` → `getEServiceTemplateById`. Mapper: `getEServiceTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The requested template id is missing from the read model (`retrieveEServiceTemplate`). | Cannot happen — the generator found no BFF endpoint for `GET /templates/{templateId}`, and the normal provider UI only opens this detail from an already existing template record in the list or detail flow. | — | — |

## 4. `DELETE /templates/:templateId`

Service: `eserviceTemplateService` → `deleteEServiceTemplate`. Mapper: `deleteEServiceTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The requested template id is missing from the read model (`retrieveEServiceTemplate`). | Cannot happen — the generator found no BFF endpoint for `DELETE /templates/{templateId}`, and the provider UI only offers deletion after the template was already loaded from the current tenant list/detail flow. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the provider UI only renders the delete action for templates owned by the active tenant and never sends a delete request for another creator's template. | — | — |
| `eserviceTemplateNotInDraftState` | 409 | The template is not in draft state (`assertIsDraftEServiceTemplate`). | Cannot happen — the template deletion action is only enabled for draft templates in the provider UI, while published templates are not selectable for deletion. | — | — |

## 5. `PATCH /templates/:templateId/versions/:templateVersionId`

Service: `eserviceTemplateService` → `patchUpdateDraftTemplateVersion`. Mapper: `updateDraftTemplateVersionErrorMapper`. Roles: `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the generator found no BFF endpoint for `PATCH /templates/{templateId}/versions/{templateVersionId}`, and the product UI does not expose a direct M2M-admin draft-version patch flow. | — | — |
| `eserviceTemplateVersionNotFound` | 404 | The target version is not found inside the template (`retrieveEServiceTemplateVersion`). | Cannot happen — no BFF route is generated for this endpoint and the UI never issues a version patch against a non-selected template/version pair. | — | — |
| `attributeNotFound` | 404 | One of the submitted attributes does not exist in the read model (`parseAndCheckAttributes`). | Cannot happen — no FE route calls this M2M-only version patch endpoint, so the product form never submits arbitrary attribute ids through it. | — | — |
| `operationForbidden` | 403 | The requester is not the owner of the template (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the endpoint is M2M-only and the product UI never exposes a route that would trigger it for a normal provider session. | — | — |
| `notValidEServiceTemplateVersionState` | 400 | The template version is not in a state that allows interface operations (`versionStatesNotAllowingInterfaceOperations`). | Cannot happen — the product UI does not call this endpoint for normal provider editing, and the M2M-only API is not reachable from the front end. | — | — |
| `inconsistentDailyCalls` | 400 | Daily-call thresholds are inconsistent (`assertConsistentDailyCalls`). | Cannot happen — the generator found no BFF endpoint for this action, so the UI never reaches the endpoint with an invalid quota payload. | — | — |
| `attributeDuplicatedInGroup` | 400 | The submitted attributes include duplicates within the same group (`parseAndCheckAttributes`). | Cannot happen — normal template-version editing in the UI does not hit this endpoint, and no FE flow sends an attribute set to it. | — | — |
| `asyncExchangeBulkNotAllowedForSoap` | 400 | Async exchange bulk mode is used for a SOAP template (`assertAsyncExchangeReceiveTemplateNotAllowed` / soap validation). | Cannot happen — the frontend never exercises this endpoint and the UI forbids incompatible async-exchange/soap combinations before the action is reached. | — | — |
| `attributeDiscreteConfigNotAllowed` | 400 | A certified attribute uses an invalid discrete config (`assertDiscreteConfigForCertifiedAttributesOnly`). | Cannot happen — the generator found no BFF endpoint and the product UI never reaches a version patch on this M2M-only route with raw attribute payloads. | — | — |

## 6. `POST /templates/:templateId`

Service: `eserviceTemplateService` → `updateEServiceTemplate`. Mapper: `updateEServiceTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the generator found no BFF endpoint for `POST /templates/{templateId}`, and the provider UI updates drafts through the dedicated template-field endpoints rather than submitting a full template update here. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the UI only offers template updates to the current tenant owner, and there is no FE route that calls this endpoint directly. | — | — |
| `eserviceTemplateNotInDraftState` | 400 | The template is not in draft state (`assertIsDraftEServiceTemplate`). | Cannot happen — provider editing is limited to draft templates, and the non-draft flow is not available in the UI for this endpoint. | — | — |
| `eserviceTemplateDuplicate` | 409 | The template name violates uniqueness (`assertEServiceTemplateNameAvailable`). | Cannot happen — no BFF route is reported for this endpoint, and the UI does not use a full template-rewrite request when saving existing template names; it uses the dedicated `/name/update` action instead. | — | — |

## 7. `PATCH /templates/:templateId`

Service: `eserviceTemplateService` → `patchUpdateEServiceTemplate`. Mapper: `updateEServiceTemplateErrorMapper`. Roles: `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the generator found no BFF endpoint for `PATCH /templates/{templateId}`, and the product UI never exposes a direct M2M-admin template patch flow. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — this endpoint is M2M-only and the frontend does not render a route or action that calls it from a normal user session. | — | — |
| `eserviceTemplateNotInDraftState` | 400 | The template is not in draft state (`assertIsDraftEServiceTemplate`). | Cannot happen — the helper validates the template is a draft before editing, and the UI never calls this M2M-only route for a non-draft record. | — | — |
| `eserviceTemplateDuplicate` | 409 | The template name violates uniqueness (`assertEServiceTemplateNameAvailable`). | Cannot happen — no BFF route is generated for this endpoint, and the normal UI does not submit a full template patch with a conflicting name through this M2M route. | — | — |

## 8. `POST /templates/:templateId/versions`

Service: `eserviceTemplateService` → `createEServiceTemplateVersion`. Mapper: `createEServiceTemplateVersionErrorMapper`. Roles: `M2M_ADMIN_ROLE`, `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `POST /eservices/templates/:eServiceTemplateId/versions`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the BFF first loads the template from the current route and the UI only triggers this action from an already selected template detail; stale or crafted external requests are out of scope. | — | — |
| `attributeNotFound` | 400 | One of the submitted attributes is missing from the read model (`parseAndCheckAttributes`). | Cannot happen — the BFF clones the previous version's attributes and does not accept arbitrary user input, so the FE never sends a raw attribute payload that can fail this validation. | — | — |
| `attributeDuplicatedInGroup` | 400 | The submitted attributes contain duplicates inside the same group (`parseAndCheckAttributes`). | Cannot happen — the frontend never sends an attribute list to this BFF route; the call only clones the previous version data and keeps the existing attribute structure. | — | — |
| `draftEServiceTemplateVersionAlreadyExists` | 400 | The template already contains a draft version (`assertNoDraftEServiceTemplateVersions`). | Cannot happen — the UI only renders the “create new draft from template” action when there is no draft version, and the action is hidden when `hasVersionDraft` is true. | — | — |
| `inconsistentDailyCalls` | 400 | The daily-call thresholds are inconsistent (`assertConsistentDailyCalls`). | Cannot happen — the BFF copies the values from the previous published version, so the FE cannot submit an inverted or mismatched quota pair on this route. | — | — |
| `attributeDiscreteConfigNotAllowed` | 400 | A certified attribute uses an invalid discrete configuration (`assertDiscreteConfigForCertifiedAttributesOnly`). | Cannot happen — the route only clones attributes from the existing version and the UI never sends raw attribute configuration values through this endpoint. | — | — |
| `eserviceTemplateWithoutPublishedVersion` | 409 | The template has no published version (`assertPublishedEServiceTemplate`). | Cannot happen — the product UI only exposes the “create new draft from template” action for published or suspended templates, so a template without a published version never reaches this request. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the UI only enables this action for the active tenant owner and the BFF checks the current authenticated user before invoking the process endpoint. | — | — |

## 9. `DELETE /templates/:templateId/versions/:templateVersionId`

Service: `eserviceTemplateService` → `deleteEServiceTemplateVersion`. Mapper: `deleteEServiceTemplateVersionErrorMapper`. Roles: `M2M_ADMIN_ROLE`, `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `DELETE /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the generator exposes a BFF route for this action, but the UI only invokes it after the template has already been loaded from the current detail list and a valid draft version is selected. | — | — |
| `eserviceTemplateVersionNotFound` | 404 | The requested version does not exist in the template (`retrieveEServiceTemplateVersion`). | Cannot happen — the delete action is invoked only for a version already displayed in the current template detail, so a stale or invalid version id is not produced by a normal UI flow. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the delete action is only rendered for templates owned by the active tenant, and the frontend never exposes a delete control for a different creator's draft version. | — | — |
| `notValidEServiceTemplateVersionState` | 400 | The version is not in draft state (`version.state !== eserviceTemplateVersionState.draft`). | Cannot happen — the UI only allows deletion of a draft version and disables the action whenever the selected version is not in draft state. | — | — |

## 10. `POST /templates/:templateId/versions/:templateVersionId`

Service: `eserviceTemplateService` → `updateDraftTemplateVersion`. Mapper: `updateDraftTemplateVersionErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the UI only invokes this action from an already selected template detail, and the BFF/route is loaded from the current template record rather than a free-form id. | — | — |
| `eserviceTemplateVersionNotFound` | 404 | The target version is not present in the template (`retrieveEServiceTemplateVersion`). | Cannot happen — the form is bound to the selected version from the current page and never sends an arbitrary stale version id through the update-draft mutation. | — | — |
| `attributeNotFound` | 404 | One of the submitted attributes is missing from the read model (`parseAndCheckAttributes`). | Cannot happen — the frontend builds the payload from the current template-version data, strips empty groups and never submits raw attribute ids from outside the current object graph. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the provider UI only renders the save action for the current tenant's template and the route is guarded to the owner before the mutation is sent. | — | — |
| `notValidEServiceTemplateVersionState` | 400 | The selected version is not in a state that allows interface operations (`versionStatesNotAllowingInterfaceOperations`). | Cannot happen — the page only exposes draft-version editing for the selected version and the form does not allow saving when the version is no longer editable. | — | — |
| `inconsistentDailyCalls` | 400 | The daily-call quotas are inverted (`assertConsistentDailyCalls`). | Cannot happen — `EServiceTemplateCreateStepThresholdsAndAttributes` validates `dailyCallsPerConsumer` and `dailyCallsTotal` as integer inputs with `min` constraints, and the form prevents the invalid pair from being submitted. | — | — |
| `attributeDuplicatedInGroup` | 400 | The submitted attributes contain duplicates within the same group (`parseAndCheckAttributes`). | Cannot happen — the UI sanitizes attribute groups before submitting and does not allow the same attribute id to be added twice in the same group. | — | — |
| `asyncExchangeBulkNotAllowedForSoap` | 400 | Async exchange bulk mode is enabled for a SOAP template (`updatedAsyncExchangeProperties?.bulk === true` while `technology.soap`). | Cannot happen — the create flow disables or normalizes incompatible async-exchange/soap combinations before the save mutation is triggered. | — | — |
| `attributeDiscreteConfigNotAllowed` | 400 | A declared or verified attribute includes a discrete config outside the certified-only rule (`assertDiscreteConfigForCertifiedAttributesOnly`). | Cannot happen — the attribute editor only allows valid discrete configs for certified attributes and the form never sends a raw invalid config through the update-draft action. | — | — |

## 11. `POST /templates/:templateId/versions/:templateVersionId/publish`

Service: `eserviceTemplateService` → `publishEServiceTemplateVersion`. Mapper: `publishEServiceTemplateVersionErrorMapper`. Roles: `M2M_ADMIN_ROLE`, `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template is missing (`retrieveEServiceTemplate`). | Cannot happen — the generator found no BFF endpoint for `POST /templates/{templateId}/versions/{templateVersionId}/publish`, and the product UI does not expose a publish action on a non-loaded template. | — | — |
| `eserviceTemplateVersionNotFound` | 404 | The target version is not present in the template (`retrieveEServiceTemplateVersion`). | Cannot happen — there is no BFF route for this action, and the normal provider UI never sends a publish request for a stale or missing version id. | — | — |
| `missingTemplateVersionInterface` | 404 | The selected version has no interface defined (`eserviceTemplateVersion.interface === undefined`). | Cannot happen — no FE route is mapped for this endpoint, so the UI never reaches a publish call with a version that lacks its interface. | — | — |
| `notValidEServiceTemplateVersionState` | 400 | The version cannot be published because the state is not allowed for interface operations (`versionStatesNotAllowingInterfaceOperations`). | Cannot happen — the UI does not expose a publish action for versions that are not in a valid state, and no BFF route is generated for this flow. | — | — |
| `riskAnalysisValidationFailed` | 400 | The risk analysis is invalid for publish in receive mode (`assertRiskAnalysisIsValidForPublication`). | Cannot happen — the generator found no BFF route for this endpoint and the template publish flow is not surfaced in the UI for a normal provider session. | — | — |
| `missingPersonalDataFlag` | 400 | The template does not declare its personal-data flag (`eserviceTemplate.data.personalData === undefined`). | Cannot happen — no BFF route is generated for this action, and the UI never submits publication for a template with an absent flag. | — | — |
| `missingAsyncExchangeProperties` | 400 | Async exchange is enabled but the version is missing `asyncExchangeProperties`. | Cannot happen — the journey is not exposed in the frontend and no BFF route is generated to call this process endpoint directly. | — | — |
| `missingAsyncExchangeCallbackInterface` | 400 | Async exchange is enabled but the callback interface is missing. | Cannot happen — the publish request is not reachable from the product UI, and the generator reports no BFF endpoint for it. | — | — |
| `asyncExchangeBulkNotAllowedForSoap` | 400 | The version uses async exchange bulk mode on a SOAP template (`assertAsyncExchangeReceiveTemplateNotAllowed`/soap validation). | Cannot happen — no FE route or BFF endpoint exists for this publish call, so the UI cannot submit the invalid combination to the process. | — | — |
| `missingRiskAnalysis` | 409 | The template is in receive mode and lacks a required risk analysis (`assertRiskAnalysisIsValidForPublication`). | Cannot happen — the generator found no BFF route for the publish action, and the provider UI never calls this endpoint when the template is missing the mandatory risk-analysis data. | — | — |
| `operationForbidden` | 403 | The requester is not the creator of the template (`assertRequesterEServiceTemplateCreator`). | Cannot happen — there is no BFF route for the publish call and the frontend never renders a publish control for templates it does not own. | — | — |

## 12. `POST /templates/:templateId/versions/:templateVersionId/suspend`

Service: `eserviceTemplateService` → `suspendEServiceTemplateVersion`. Mapper: `suspendEServiceTemplateVersionErrorMapper`. Roles: `M2M_ADMIN_ROLE`, `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template is missing (`retrieveEServiceTemplate`). | Cannot happen — the generator found no BFF endpoint for `POST /templates/{templateId}/versions/{templateVersionId}/suspend`, and the normal provider UI never issues a suspend call on a not-loaded template. | — | — |
| `eserviceTemplateVersionNotFound` | 404 | The target version is not part of the template (`retrieveEServiceTemplateVersion`). | Cannot happen — there is no FE route or BFF endpoint for this suspend action, so a stale version id cannot be created from a normal UI interaction. | — | — |
| `notValidEServiceTemplateVersionState` | 400 | The version is not in the published state required for suspension (`eserviceTemplateVersion.state !== eserviceTemplateVersionState.published`). | Cannot happen — the UI only exposes suspension for published versions and no normal route reaches the process with an invalid state. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the generator reports no BFF route for this suspend action and the frontend never renders a suspend control for templates owned by another tenant. | — | — |

## 13. `POST /templates/:templateId/versions/:templateVersionId/activate`

Service: `eserviceTemplateService` → `activateEServiceTemplateVersion`. Mapper: `activateEServiceTemplateVersionErrorMapper`. Roles: `M2M_ADMIN_ROLE`, `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the action is reached only from an already selected template/version in the provider flow, and the generator found no BFF route for this activation endpoint. | — | — |
| `eserviceTemplateVersionNotFound` | 404 | The target version is missing inside the template (`retrieveEServiceTemplateVersion`). | Cannot happen — the activation control is bound to the currently selected version, and the frontend never creates a request for a stale or missing version id. | — | — |
| `notValidEServiceTemplateVersionState` | 409 | The version is not in the suspended state required by the activation flow (`eserviceTemplateVersion.state !== eserviceTemplateVersionState.suspended`). | Cannot happen — the UI only exposes activate for suspended versions and disables or hides the action for any other state. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the provider UI exposes activation only to the template owner and the route is not reachable from another tenant's context. | — | — |

## 14. `POST /templates/:templateId/versions/:templateVersionId/quotas/update`

Service: `eserviceTemplateService` → `updateEServiceTemplateVersionQuotas`. Mapper: `updateEServiceTemplateVersionQuotasErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/quotas/update`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the UI only triggers this action from an already loaded template-version page, and the BFF route is scoped to the selected template rather than a free-form id. | — | — |
| `eserviceTemplateVersionNotFound` | 404 | The requested version is missing from the template (`retrieveEServiceTemplateVersion`). | Cannot happen — the quota drawer is bound to the currently selected version, and the FE never sends an arbitrary stale version id through a normal interaction. | — | — |
| `notValidEServiceTemplateVersionState` | 400 | The version is not in a state that allows quota updates (`eserviceTemplateVersion.state !== published && state !== suspended`). | Cannot happen — the UI exposes the threshold drawer only for published or suspended versions and disables the action for other states. | — | — |
| `inconsistentDailyCalls` | 400 | The quota payload violates the daily-call consistency rule (`assertConsistentDailyCalls`). | Cannot happen — the drawer validates integer values and enforces `dailyCallsTotal >= dailyCallsPerConsumer + 1` before submitting the request, so the invalid pair cannot be sent by a normal UI flow. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the edit action is only rendered for the active tenant owner and the BFF checks the creator before calling the process endpoint. | — | — |

## 15. `POST /templates/:templateId/versions/:templateVersionId/documents`

Service: `eserviceTemplateService` → `createEServiceTemplateDocument`. Mapper: `createEServiceTemplateDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the upload flow is started from an already loaded template detail, and the request is always bound to the selected template rather than an arbitrary free-form id. | — | — |
| `eserviceTemplateVersionNotFound` | 404 | The target version is missing from the template (`retrieveEServiceTemplateVersion`). | Cannot happen — the document drawer is bound to the selected version and the UI never sends a stale version id through a normal interaction. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the document upload action is only rendered for the current tenant owner, and the BFF guards the route before invoking the process endpoint. | — | — |
| `interfaceAlreadyExists` | 400 | The version already has an interface document (`version.interface !== undefined`). | Cannot happen — the form hides the interface upload control as soon as an interface is present, and the UI shows the existing interface instead of allowing a second upload. | — | — |
| `asyncExchangeCallbackInterfaceAlreadyExists` | 400 | The version already has an async-exchange callback interface (`version.asyncExchangeCallbackInterface !== undefined`). | Cannot happen — `UploadTemplateCallbackInterfaceDoc` renders the upload form only when the callback interface is `null`, and the UI immediately swaps back to the existing document card afterward. | — | — |
| `eserviceTemplateAsyncExchangeNotEnabled` | 400 | The template is not configured for async exchange while the callback-interface upload flow is attempted (`eserviceTemplate.data.asyncExchange !== true`). | Cannot happen — the callback-interface upload field is only shown when async exchange is enabled, so the form is never exposed in the disabled state. | — | — |
| `asyncExchangeBulkNotAllowedForSoap` | 400 | This mapper entry appears dead: the SOAP async-exchange bulk restriction is enforced in `updateDraftTemplateVersion`, not in this document-creation flow. | Cannot happen — no upload-form path reaches the SOAP bulk guard and the current file-upload action cannot submit the invalid combination through this endpoint. | — | — |
| `documentPrettyNameDuplicate` | 409 | A document in the same version already has the same `prettyName` (`version.docs.some((d) => d.prettyName.toLowerCase() === document.prettyName.toLowerCase())`). | **CAN HAPPEN** — the upload drawer accepts free text in “Nome documento” and does not prevent submitting the same document name twice before the multipart request is sent. | **Data precondition:** tenant A already has a template draft version V with a document named `N`.<br>1. Go to `/erogazione/template-eservice/:eServiceTemplateId/:eServiceTemplateVersionId`.<br>2. Click _Modifica documentazione_.<br>3. Click _Aggiungi documentazione_.<br>4. Type `N` in _Nome documento_.<br>5. Select a file and click _Carica_. | 🟢 Easy resolution<br>1. Rename the document to a unique name.<br>2. Upload the file again.<br>3. Refresh the page if the document list is stale and retry with the new name. |
| `checksumDuplicate` | 409 | A document with the same file checksum already exists in the same version (`version.docs.some((d) => d.checksum === document.checksum)`). | **CAN HAPPEN** — the upload drawer lets the user attach any file and does not check whether the same content has already been uploaded before the request is sent. | **Data precondition:** tenant A already has a template draft version V with a document whose content matches the file `F` you want to upload again.<br>1. Go to `/erogazione/template-eservice/:eServiceTemplateId/:eServiceTemplateVersionId`.<br>2. Click _Modifica documentazione_.<br>3. Click _Aggiungi documentazione_.<br>4. Select `F` again and type any unique value in _Nome documento_.<br>5. Click _Carica_. | 🟢 Easy resolution<br>1. Upload a different file or create a new version of the same file.<br>2. Keep the document name unique if needed.<br>3. Refresh the page and retry with the updated file. |
| `notValidEServiceTemplateVersionState` | 400 | The version cannot accept document operations because its state is not valid (`versionStatesNotAllowingDocumentOperations(version)`). | Cannot happen — the upload form is shown only in editable draft states, and the UI blocks the action when the selected version is no longer in a valid state. | — | — |

## 16. `GET /templates/:templateId/versions/:templateVersionId/documents/:documentId`

Service: `eserviceTemplateService` → `getEServiceTemplateDocument`. Mapper: `getEServiceTemplateDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SUPPORT_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `operationForbidden` | 403 | The current user is not allowed to access the requested template version or document (`applyVisibilityToEServiceTemplate` + document lookup in the current version). | Cannot happen — the document download action is only triggered from an already loaded template-version page, and the FE sends only the selected template/version/document ids for the current tenant; it never exposes an arbitrary cross-tenant document request. | — | — |
| `eserviceTemplateVersionNotFound` | 404 | The target version is not present in the template (`retrieveEServiceTemplateVersion`). | Cannot happen — the UI downloads a document only from the currently selected version, and the route is bound to existing detail data rather than a free-form id. | — | — |
| `eserviceTemplateDocumentNotFound` | 404 | The requested document is not part of the selected version (`retrieveDocument` / `checkedTemplate.versions.find(...)`). | Cannot happen — the download button is shown only for documents already rendered in the current drawer, so the FE never submits a stale or non-existent document id. | — | — |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the document flow starts from an already loaded template detail, and the UI never issues a download for a template that was not selected from the current route. | — | — |

## 17. `DELETE /templates/:templateId/versions/:templateVersionId/documents/:documentId`

Service: `eserviceTemplateService` → `deleteDocument`. Mapper: `deleteDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template is not found (`retrieveEServiceTemplate`). | Cannot happen — the delete action is triggered only from an already loaded template-version document list, and the frontend never issues a delete for a stale or non-selected template id. | — | — |
| `eserviceTemplateVersionNotFound` | 404 | The requested version is missing inside the template (`retrieveEServiceTemplateVersion`). | Cannot happen — the document list is scoped to the current selected version, and the UI never creates a delete request for a missing version id from the normal flow. | — | — |
| `eserviceTemplateDocumentNotFound` | 404 | The target document is not present in the version (`retrieveDocument`). | Cannot happen — the delete button is rendered only for an existing visible document card, so the FE never sends a stale document id through a standard UI interaction. | — | — |
| `notValidEServiceTemplateVersionState` | 400 | The version is not in a state that allows document operations (`versionStatesNotAllowingDocumentOperations(version)`). | Cannot happen — the template documentation drawer only exposes delete actions for editable draft documents and does not let the user remove files from locked states. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the UI only renders the delete control for the current tenant owner and never exposes the action for other creators' documents. | — | — |

## 18. `POST /templates/:templateId/versions/:templateVersionId/documents/:documentId/update`

Service: `eserviceTemplateService` → `updateDocument`. Mapper: `updateDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId/update`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the update-description action is launched from an already loaded template-version page, and the frontend does not allow a free-form template id to be typed into the request. | — | — |
| `eserviceTemplateVersionNotFound` | 404 | The target version does not belong to the template (`retrieveEServiceTemplateVersion`). | Cannot happen — the form is bound to the currently selected version, and the UI never submits a stale or missing version id in a normal save action. | — | — |
| `eserviceTemplateDocumentNotFound` | 404 | The target document is not present in the version (`retrieveDocument`). | Cannot happen — the update control is shown for an existing document card only, so the FE never sends a nonexistent document id through the visible flow. | — | — |
| `notValidEServiceTemplateVersionState` | 400 | The version is not editable (`versionStatesNotAllowingDocumentOperations(version)`). | Cannot happen — the doc-update action is only enabled for draft versions and the drawer hides or disables the control when the selected version is not editable. | — | — |
| `interfaceDocumentNotUpdatable` | 400 | The document is the API interface or async-exchange callback interface (`document.id === version.interface?.id || document.id === version.asyncExchangeCallbackInterface?.id`). | Cannot happen — the UI shows an informational tooltip for interface documents and does not call the rename API on those files; the field is intentionally non-editable. | — | — |
| `documentPrettyNameDuplicate` | 409 | Another document in the same version already has the same `prettyName` (`version.docs.some((d) => d.id !== documentId && d.prettyName.toLowerCase() === prettyName.toLowerCase())`). | **CAN HAPPEN** — the drawer accepts free text in “Nome documento” and does not enforce uniqueness before sending the rename request. | **Data precondition:** tenant A already has a template draft version V with a document named `N`, and the user is editing a different document in the same version.<br>1. Go to `/erogazione/template-eservice/:eServiceTemplateId/:eServiceTemplateVersionId`.<br>2. Click _Modifica documentazione_.<br>3. Open the document card you want to rename and edit the name.<br>4. Type `N` in _Nome documento_.<br>5. Click _Salva_ or the confirmation action in the drawer. | 🟢 Easy resolution<br>1. Change the document name to a unique value.<br>2. Save the updated name again.<br>3. Refresh the page if the list is stale and retry with the new name. |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the action is only shown to the current tenant owner and the BFF route is guarded before the request is sent. | — | — |

## 19. `POST /templates/:templateId/riskAnalysis`

Service: `eserviceTemplateService` → `createRiskAnalysis`. Mapper: `createRiskAnalysisErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/templates/:eServiceTemplateId/riskAnalysis`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the action is started from a currently loaded template draft and the FE never sends a free-form missing template id through this route. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the provider UI only renders the risk-analysis action for templates owned by the active tenant and blocks the action before the mutation is fired. | — | — |
| `eserviceTemplateNotInDraftState` | 400 | The template is not in draft state (`assertIsDraftEServiceTemplate`). | Cannot happen — the risk-analysis creation form is only available while the template is in draft, and the action is hidden when the template is no longer editable. | — | — |
| `eserviceTemplateNotInReceiveMode` | 400 | The template is not in `RECEIVE` mode (`assertIsReceiveTemplate`). | Cannot happen — the form is shown only for receive-mode templates, and the template creation flow does not expose a risk-analysis action for deliver-mode templates. | — | — |
| `riskAnalysisValidationFailed` | 400 | The submitted risk-analysis form is invalid for the current template (`validateRiskAnalysisSchemaOrThrow`). | Cannot happen — the FE builds the question set from the current template-risk-analysis config and the shared form enforces required answers before the request is submitted. | — | — |
| `riskAnalysisNameDuplicate` | 409 | A risk analysis with the same name already exists in the template (`raSameName`). | **CAN HAPPEN** — the form accepts a free-text name in _Nome della finalità_ and the backend checks uniqueness only at submit time. | **Data precondition:** tenant A already has a risk analysis named `N` in the same draft template.<br>1. Go to the provider template-draft page for tenant A and open the risk-analysis step for the selected template.<br>2. Type `N` in _Nome della finalità_.<br>3. Complete the questionnaire and click _Salva bozza e procedi_. | 🟢 Easy resolution<br>1. Change the risk-analysis name to a unique value.<br>2. Submit the form again.<br>3. Refresh the template page if the list is stale and retry with the new name. |

## 20. `POST /templates/:templateId/riskAnalysis/:riskAnalysisId`

Service: `eserviceTemplateService` → `updateRiskAnalysis`. Mapper: `updateRiskAnalysisErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `POST /eservices/templates/:eServiceTemplateId/riskAnalysis/:riskAnalysisId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the edit action is launched from an already selected template and the FE never submits a free-form missing template id through the mutation. | — | — |
| `riskAnalysisNotFound` | 404 | The target risk analysis is not present in the template (`retrieveEServiceTemplateRiskAnalysis`). | Cannot happen — the list of risk analyses is bound to the currently selected template, and the UI never sends a stale risk-analysis id from the normal edit flow. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the provider UI only exposes the edit action for the active tenant's own template risk analysis and blocks the control before the request is sent. | — | — |
| `eserviceTemplateNotInDraftState` | 400 | The template is not in draft state (`assertIsDraftEServiceTemplate`). | Cannot happen — the edit drawer is only shown while the template remains editable, and non-draft templates do not expose the risk-analysis edit action. | — | — |
| `eserviceTemplateNotInReceiveMode` | 400 | The template is not in `RECEIVE` mode (`assertIsReceiveTemplate`). | Cannot happen — the risk-analysis form is only available for receive-mode template drafts, so non-receive templates never reach the update mutation. | — | — |
| `riskAnalysisValidationFailed` | 400 | The updated risk-analysis form is invalid (`validateRiskAnalysisSchemaOrThrow`). | Cannot happen — the FE renders the question set from the selected risk analysis and blocks invalid or incomplete answers before the update request leaves the form. | — | — |

## 21. `DELETE /templates/:templateId/riskAnalysis/:riskAnalysisId`

Service: `eserviceTemplateService` → `deleteRiskAnalysis`. Mapper: `deleteRiskAnalysisErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /eservices/templates/:eServiceTemplateId/riskAnalysis/:riskAnalysisId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the delete action is triggered only from an already loaded template detail, and the UI never originates a delete from a stale or missing template id. | — | — |
| `riskAnalysisNotFound` | 404 | The target risk analysis is not present in the template (`assertRiskAnalysisExists`). | Cannot happen — the delete button is rendered only for a currently visible risk analysis and the page never generates a delete for an absent item in the normal flow. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the delete control is only shown for the active tenant owner and is hidden before the request is fired for other creators' templates. | — | — |
| `eserviceTemplateNotInDraftState` | 400 | The template is not in draft state (`assertIsDraftEServiceTemplate`). | Cannot happen — the UI only enables the delete action while the template is editable, so locked or published templates never reach this route. | — | — |
| `eserviceTemplateNotInReceiveMode` | 400 | The template is not in `RECEIVE` mode (`assertIsReceiveTemplate`). | Cannot happen — receive-mode risk analyses are only editable in receive templates, and the UI hides the delete control for other template modes. | — | — |

## 22. `POST /templates/:templateId/intendedTarget/update`

Service: `eserviceTemplateService` → `updateEServiceTemplateIntendedTarget`. Mapper: `updateEServiceTemplateIntendedTargetErrorMapper`. Roles: `M2M_ADMIN_ROLE`, `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `POST /eservices/templates/:eServiceTemplateId/intendedTarget/update`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The requested template id is missing from the read model (`retrieveEServiceTemplate`). | Cannot happen — the update action is opened from an already selected template detail, and the FE sends only the current template id from the route; there is no free-form missing-template path in the visible flow. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the UI only renders the edit action for the active tenant owner and the route is guarded by ownership before the mutation is fired. | — | — |
| `eserviceTemplateWithoutPublishedVersion` | 409 | The template has no published or suspended version (`assertPublishedEServiceTemplate`). | Cannot happen — the “Modifica a chi è rivolto” action is only shown on an existing published/suspended template detail page, and the current template-detail route is not exposed for a completely unpublished template. | — | — |

## 23. `POST /templates/:templateId/description/update`

Service: `eserviceTemplateService` → `updateEServiceTemplateDescription`. Mapper: `updateEServiceTemplateDescriptionErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /eservices/templates/:eServiceTemplateId/description/update`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The requested template id is missing from the read model (`retrieveEServiceTemplate`). | Cannot happen — the update action is triggered from an already selected template detail, and the FE never submits a free-form missing template id in the standard flow. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the description edit control is only rendered for the active tenant owner and the ownership guard blocks the request before the mutation is sent. | — | — |
| `eserviceTemplateWithoutPublishedVersion` | 409 | The template has no published or suspended version (`assertPublishedEServiceTemplate`). | Cannot happen — the edit drawer is only shown when the template detail is opened for a published/suspended template instance and the form is not exposed for an unpublished one. | — | — |
| `eServiceTemplateUpdateSameDescriptionConflict` | 409 | The submitted description matches the current one (`assertUpdatedDescriptionDiffersFromCurrent`). | Cannot happen — the drawer validates that the description must differ from the current value before the request is submitted, and the form blocks the same-value save path. | — | — |

## 24. `POST /templates/:templateId/name/update`

Service: `eserviceTemplateService` → `updateEServiceTemplateName`. Mapper: `updateEServiceTemplateNameErrorMapper`. Roles: `M2M_ADMIN_ROLE`, `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `POST /eservices/templates/:eServiceTemplateId/name/update`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The requested template id is missing from the read model (`retrieveEServiceTemplate`). | Cannot happen — the update action is started from an already loaded template detail, and the FE sends only the selected template id from the route; a stale or missing template id is not produced by a normal UI flow. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the name edit action is only rendered for the active tenant owner and is hidden before the mutation is fired for other creators' templates. | — | — |
| `eserviceTemplateWithoutPublishedVersion` | 409 | The template has no published or suspended version (`assertPublishedEServiceTemplate`). | Cannot happen — the template-name edit drawer is only exposed while the user is editing an existing published/suspended template, and the UI does not offer the action for a completely unpublished record. | — | — |
| `eserviceTemplateDuplicate` | 409 | The requested name is already used by another template (`assertEServiceTemplateNameAvailable`). | **CAN HAPPEN** — the name drawer accepts free text in _Nome template e-service_, and the backend validates uniqueness only at submit time; a user can reuse an existing template name on another template. | **Data precondition:** tenant A already has another template named `N`.<br>1. Go to `/erogazione/template-eservice/:eServiceTemplateId/:eServiceTemplateVersionId`.<br>2. Click the edit action for the template name to open the drawer.<br>3. Type `N` in _Nome template e-service_.<br>4. Click _Salva_. | 🟢 Easy resolution<br>1. Change the template name to a unique value.<br>2. Save the change again.<br>3. Refresh the page if the list is stale and retry with the new name. |
| `eServiceTemplateUpdateSameNameConflict` | 409 | The new name matches the current template name (`assertUpdatedNameDiffersFromCurrent`). | Cannot happen — the drawer enforces the validation message “Il nome del template dell'e-service deve essere diverso da quella attuale” and blocks the same-value save path. | — | — |

> Note: `GET /creators` uses `emptyErrorMapper` and has no non-500 mapper errors.

## 25. `POST /templates/:templateId/versions/:templateVersionId/attributes/update`

Service: `eserviceTemplateService` → `updateEServiceTemplateVersionAttributes`. Mapper: `updateEServiceTemplateVersionAttributesErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the generator found no BFF endpoint for `POST /templates/{templateId}/versions/{templateVersionId}/attributes/update`, and the normal provider UI never exposes a direct “update attributes” mutation for an arbitrary template id. | — | — |
| `eserviceTemplateVersionNotFound` | 404 | The target version is not present inside the template (`retrieveEServiceTemplateVersion`). | Cannot happen — the UI never generates a direct version-attribute update request from a non-selected template/version pair, and there is no BFF route to reach this process method from the product flow. | — | — |
| `notValidEServiceTemplateVersionState` | 400 | The template version is in draft state (`eserviceTemplateVersion.state === eserviceTemplateVersionState.draft`). | Cannot happen — the generator found no BFF route for this action, so the product UI never reaches a draft-version attribute update call. | — | — |
| `inconsistentAttributesSeedGroupsCount` | 400 | The seed contains a different number of attribute groups than the version (`attributesVersion.length !== attributesSeed.length`). | Cannot happen — no FE route or BFF endpoint calls this update-attributes flow, so the client never sends an arbitrary attribute seed of the wrong group count. | — | — |
| `versionAttributeGroupSupersetMissingInAttributesSeed` | 400 | No seed group is a superset of the corresponding version group (`!attributesSeed.find(...)`). | Cannot happen — the frontend never calls this endpoint and never sends a raw seed with a mismatched attribute-group structure. | — | — |
| `unchangedAttributes` | 400 | The submitted seed adds no new attributes, so `newAttributes.length === 0`. | Cannot happen — the generator found no BFF endpoint and the normal UI does not expose an update-attributes action that can post an unchanged seed. | — | — |
| `attributeDuplicatedInGroup` | 400 | The seed repeats an attribute inside the same group (`parseAndCheckAttributes` / group validation). | Cannot happen — there is no BFF route for the action and the UI never submits a raw attribute set through this endpoint. | — | — |
| `attributeDiscreteConfigNotAllowed` | 400 | A certified attribute uses an invalid discrete configuration (`assertDiscreteConfigForCertifiedAttributesOnly`). | Cannot happen — the product UI never reaches this endpoint, and the route is not exposed through the BFF for direct attribute editing. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — no BFF route is generated for this action and the regular provider UI never exposes a direct attribute-update request for a different creator's template. | — | — |

## 26. `POST /templates/:templateId/personalDataFlag`

Service: `eserviceTemplateService` → `updateEServiceTemplatePersonalDataFlagAfterPublication`. Mapper: `updateEServiceTemplatePersonalDataFlagErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`.

### BFF endpoints

- `POST /eservices/templates/:eServiceTemplateId/personalDataFlag`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| --- | --- | --- | --- | --- | --- |
| `eserviceTemplateNotFound` | 404 | The target template does not exist (`retrieveEServiceTemplate`). | Cannot happen — the mutation is triggered from an already loaded template detail page, and the FE sends only the currently selected template id rather than a free-form missing record. | — | — |
| `operationForbidden` | 403 | The requester is not the template creator (`assertRequesterEServiceTemplateCreator`). | Cannot happen — the drawer is only exposed on the active tenant's template detail page and the auth/ownership checks block the action for other creators. | — | — |
| `eserviceTemplateWithoutPublishedVersion` | 409 | The template has no published version (`assertPublishedEServiceTemplate`). | Cannot happen — the UI only offers the “specify processing” action when the template already exists in the published template flow, and the button is not shown for unpublished records. | — | — |
| `eserviceTemplatePersonalDataFlagCanOnlyBeSetOnce` | 409 | The template already has a `personalData` value and the call tries to set it again (`if (eserviceTemplate.data.personalData !== undefined)`). | Cannot happen — the UI shows the update drawer only while `personalData === undefined`, and after a successful submit the alert and drawer disappear; there is no second action to resubmit the same value. | — | — |

## 27. `GET /creators`

Service: `eserviceTemplateService` → `getEServiceTemplateCreators`. Mapper: `emptyErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /eservices/templates/filter/creators`

This endpoint intentionally has no non-500 mapper errors because it uses `emptyErrorMapper`; it is therefore omitted from the per-error table.
