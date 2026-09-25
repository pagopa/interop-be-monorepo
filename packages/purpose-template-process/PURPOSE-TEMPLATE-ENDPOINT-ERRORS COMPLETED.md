Note: `GET /creators` uses `emptyErrorMapper`, so it has no non-500 mapper errors and is not documented as a numbered section.

## 1. `POST /purposeTemplates`

Service: `purposeTemplateService` → `createPurposeTemplate`. Mapper: `createPurposeTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposeTemplates`

| Error                             | Status | When it happens                                                                                                               | Reachable from the FE?                                                                                                                                                                                                                                                                   | Steps to reproduce (UI) | Resolution steps |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------- |
| `missingFreeOfChargeReason`      | 400    | The requester creates a template with `purposeIsFreeOfCharge = true` but omits `purposeFreeOfChargeReason` (`assertConsistentFreeOfCharge`). | Cannot happen — `ConsumerPurposeTemplateListPage.handleCreateDraft` always sends `purposeIsFreeOfCharge: true` and fills `purposeFreeOfChargeReason` with the default value; `PurposeTemplateEditStepGeneralForm` also only includes the reason field when the switch is on and validates it as required. | — | — |
| `invalidFreeOfChargeReason`      | 400    | The requester sends a non-empty `purposeFreeOfChargeReason` while `purposeIsFreeOfCharge` is `false` (`assertConsistentFreeOfCharge`). | Cannot happen — the FE only sends `purposeFreeOfChargeReason` when `purposeIsFreeOfCharge` is `true`, and `PurposeTemplateEditStepGeneralForm` strips the field from the payload when the switch is off. | — | — |
| `riskAnalysisTemplateValidationFailed` | 400 | The submitted risk-analysis template violates the validation rules for the tenant kind (`validateRiskAnalysisTemplateOrThrow`). | Cannot happen — the create flow never sends a custom `purposeRiskAnalysisForm`; `handleCreateDraft` creates the draft with the default empty template, and the later edit flow is the only place where a risk-analysis seed is validated. | — | — |
| `ruleSetNotFoundError`           | 400    | No default risk-analysis rule set exists for the selected `targetTenantKind` when creating the default form (`getDefaultRiskAnalysisFormTemplate`). | Cannot happen — the UI only submits valid tenant kinds, and the backend only creates templates for configured tenant-kind rule sets; there is no normal UI path that can request an unsupported value. | — | — |
| `purposeTemplateNotFound`        | 404    | Dead mapper entry: no branch in `createPurposeTemplate` calls `retrievePurposeTemplate` or throws `purposeTemplateNotFound`. | Cannot happen — there is no throw site in this service; the method only validates input and persists a new purpose template. | — | — |
| `purposeTemplateTitleConflict`   | 409    | A purpose template with the same title already exists, so `assertPurposeTemplateTitleIsNotDuplicated` throws. | Cannot happen — the UI auto-generates the title as `Template finalità ${currentDateString}` in `ConsumerPurposeTemplateListPage.handleCreateDraft`, and the creation flow does not expose a user-edited title field. | — | — |

## 2. `GET /purposeTemplates`

Service: `purposeTemplateService` → `getPurposeTemplates`. Mapper: `getPurposeTemplatesErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `M2M_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error                      | Status | When it happens                                                                                                           | Reachable from the FE?                                                                                                                                                                                           | Steps to reproduce (UI) | Resolution steps |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------- |
| `purposeTemplateNotFound` | 404    | Dead mapper entry: the service only calls `readModelService.getPurposeTemplates` and never throws `purposeTemplateNotFound`. | Cannot happen — there is no throw site in `getPurposeTemplates`, and the generator reports no BFF route calling this process endpoint. | — | — |

## 3. `GET /purposeTemplates/:id`

Service: `purposeTemplateService` → `getPurposeTemplateById`. Mapper: `getPurposeTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `M2M_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /purposeTemplates/:purposeTemplateId`

| Error                                      | Status | When it happens                                                                                                                   | Reachable from the FE?                                                                                                                                                                                                                                      | Steps to reproduce (UI) | Resolution steps |
| ------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------- |
| `purposeTemplateNotFound`                  | 404    | The requested purpose template does not exist (`retrievePurposeTemplate`).                                                       | Cannot happen — the FE opens the detail route only from a purpose template already loaded in the app state, and the normal UI does not expose a field to target a non-existent template through a standard interaction.                                            | — | — |
| `eServiceDescriptorPurposeTemplateNotFound` | 404    | Dead mapper entry: `getPurposeTemplateById` does not call `retrievePurposeTemplateEserviceDescriptor` or throw this error.        | Cannot happen — there is no throw site in `getPurposeTemplateById`; the method only retrieves the purpose template and applies visibility.                                                                                                               | — | — |
| `tenantNotAllowed`                          | 403    | Dead mapper entry: `applyVisibilityToPurposeTemplate` throws `purposeTemplateNotFound` for inaccessible draft templates, not `tenantNotAllowed`. | Cannot happen — the visibility check in `applyVisibilityToPurposeTemplate` rejects non-visible draft templates by throwing `purposeTemplateNotFound`, and there is no tenant-specific guard that emits `tenantNotAllowed` in this path.                          | — | — |

## 4. `PUT /purposeTemplates/:id`

Service: `purposeTemplateService` → `updatePurposeTemplate`. Mapper: `updatePurposeTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `PUT /purposeTemplates/:purposeTemplateId`

| Error                               | Status | When it happens                                                                                                                  | Reachable from the FE?                                                                                                                                                                                                                                                                 | Steps to reproduce (UI) | Resolution steps |
| ----------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------- |
| `invalidFreeOfChargeReason`         | 400    | The requester submits a non-empty `purposeFreeOfChargeReason` while `purposeIsFreeOfCharge` is `false` (`assertConsistentFreeOfCharge`). | Cannot happen — `PurposeTemplateEditStepGeneralForm` only includes `purposeFreeOfChargeReason` when the free-of-charge switch is on and strips it when the switch is off.                                                                                           | — | — |
| `riskAnalysisTemplateValidationFailed` | 400    | The submitted risk-analysis template violates the tenant-specific validation rules (`validateRiskAnalysisTemplateOrThrow`).        | Cannot happen — the FE does not expose a custom risk-analysis editor in this flow, and the create/edit screens validate only the default form preloaded by the backend.                                                                                           | — | — |
| `missingFreeOfChargeReason`         | 400    | The requester marks the template as free of charge but omits a reason (`assertConsistentFreeOfCharge`).                            | Cannot happen — `PurposeTemplateEditStepGeneralForm` shows the reason field only when the switch is on and marks it as required.                                                                                                                 | — | — |
| `tenantNotAllowed`                  | 403    | Dead mapper entry: `assertRequesterIsCreator` throws `purposeTemplateNotFound` for non-creators, not `tenantNotAllowed`.          | Cannot happen — the creator check in `updateDraftPurposeTemplate` throws `purposeTemplateNotFound` for mismatched tenant ownership, and this route never emits `tenantNotAllowed`.                                                                                  | — | — |
| `purposeTemplateNotFound`           | 404    | The template no longer exists or is not visible to the requester (`retrievePurposeTemplate`).                                      | Cannot happen — the edit screen is only reached from a known template already loaded into the app, and the FE never offers a standard workflow that saves a template ID that was just removed.                                                                                | — | — |
| `purposeTemplateTitleConflict`      | 409    | Another purpose template already uses the same title (`assertPurposeTemplateTitleIsNotDuplicated`).                               | Cannot happen — the UI auto-generates the title from the current date and does not expose a user-editable title field in the save flow.                                                                                                     | — | — |
| `purposeTemplateNotInExpectedStates` | 409    | The template is not in the expected draft state (`assertPurposeTemplateIsDraft` / `assertPurposeTemplateStateIsValid`).           | Cannot happen — the FE only allows editing a draft purpose template while the page is open, and the standard save action is hidden once the template leaves the draft state.                                                                                       | — | — |

## 5. `PATCH /purposeTemplates/:id`

Service: `purposeTemplateService` → `patchUpdatePurposeTemplate`. Mapper: `updatePurposeTemplateErrorMapper`. Roles: `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error                               | Status | When it happens                                                                                                                  | Reachable from the FE?                                                                                                                                                                                                                                                                 | Steps to reproduce (UI) | Resolution steps |
| ----------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------- |
| `invalidFreeOfChargeReason`         | 400    | The requester submits a non-empty `purposeFreeOfChargeReason` while `purposeIsFreeOfCharge` is `false` (`assertConsistentFreeOfCharge`). | Cannot happen — the FE strips the reason when the switch is off and only sends it while the free-of-charge switch is on.                                                                                                                            | — | — |
| `riskAnalysisTemplateValidationFailed` | 400    | The submitted risk-analysis template violates the validation rules for the tenant kind (`validateRiskAnalysisTemplateOrThrow`).        | Cannot happen — the patch flow updates a purpose template that is already in the application state, and it does not expose a custom risk-analysis editor or a direct user field that can make the payload invalid.                                              | — | — |
| `missingFreeOfChargeReason`         | 400    | The requester marks the template as free of charge but omits a reason (`assertConsistentFreeOfCharge`).                            | Cannot happen — the FE renders the reason field only when the switch is on and requires it before submitting.                                                                                                                             | — | — |
| `tenantNotAllowed`                  | 403    | Dead mapper entry: `assertRequesterIsCreator` throws `purposeTemplateNotFound` for non-creators, not `tenantNotAllowed`.          | Cannot happen — the role check for patch updates is performed through the creator ownership predicate, which throws `purposeTemplateNotFound` instead of `tenantNotAllowed`.                                                                                     | — | — |
| `purposeTemplateNotFound`           | 404    | The template no longer exists or is not visible to the requester (`retrievePurposeTemplate`).                                      | Cannot happen — this route is reached only from an already loaded draft and the normal UI never sends a saved template ID from an invalid or stale state.                                                                                         | — | — |
| `purposeTemplateTitleConflict`      | 409    | Another purpose template already uses the same title (`assertPurposeTemplateTitleIsNotDuplicated`).                               | Cannot happen — the M2M patch flow does not expose or generate a user-editable title input, so duplicates cannot be created through standard UI interaction.                                                                                 | — | — |
| `purposeTemplateNotInExpectedStates` | 409    | The template is not in the expected draft state (`assertPurposeTemplateIsDraft` / `assertPurposeTemplateStateIsValid`).           | Cannot happen — the patch endpoint only applies to a draft template already selected by the app, and the normal UI does not keep a stale action enabled after the template leaves the draft state.                                                                  | — | — |

## 6. `DELETE /purposeTemplates/:id`

Service: `purposeTemplateService` → `deletePurposeTemplate`. Mapper: `deletePurposeTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /purposeTemplates/:purposeTemplateId`

| Error                         | Status | When it happens                                                                                                                     | Reachable from the FE?                                                                                                                                                                                                                              | Steps to reproduce (UI) | Resolution steps |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------- |
| `purposeTemplateNotInExpectedStates` | 409 | The purpose template is not in a draft state when the delete action runs (`assertPurposeTemplateIsDraft`). | Cannot happen — the UI only enables the delete draft action for a purpose template in `DRAFT`, and the summary/list flows hide or disable the action once the state is no longer draft. | — | — |
| `purposeTemplateNotFound` | 404 | The template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the standard delete flow is started from a purpose template already loaded in the current page, and the UI does not present a manual way to submit a stale or non-existent template id. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: `assertRequesterIsCreator` throws `purposeTemplateNotFound` for non-creators, not `tenantNotAllowed`. | Cannot happen — the ownership guard in `assertRequesterIsCreator` throws `purposeTemplateNotFound` for a different tenant, and this route never emits `tenantNotAllowed`. | — | — |

## 7. `GET /purposeTemplates/:id/eservices`

Service: `purposeTemplateService` → `getPurposeTemplateEServiceDescriptors`. Mapper: `getPurposeTemplateEServiceDescriptorsErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `M2M_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotFound` | 404 | The requested purpose template does not exist or is not visible to the requester (`retrievePurposeTemplate` via `applyVisibilityToPurposeTemplate`). | Cannot happen — the FE only opens this list from an already loaded purpose template in the app state, and the UI does not offer a standard action that targets an arbitrary non-existent id. | — | — |
| `eServiceDescriptorPurposeTemplateNotFound` | 404 | Dead mapper entry: the method returns `readModelService.getPurposeTemplateEServiceDescriptors(...)` and never throws this error. | Cannot happen — there is no throw site in `getPurposeTemplateEServiceDescriptors`; the service only retrieves the linked descriptors after validating the parent purpose template. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: `applyVisibilityToPurposeTemplate` rejects hidden templates by throwing `purposeTemplateNotFound`, not `tenantNotAllowed`. | Cannot happen — visibility handling in `applyVisibilityToPurposeTemplate` uses the purpose-template-not-found guard for inaccessible draft templates, and this route never emits `tenantNotAllowed`. | — | — |

## 8. `GET /purposeTemplates/:id/eserviceTemplates`

Service: `purposeTemplateService` → `getPurposeTemplateEServiceTemplates`. Mapper: `getPurposeTemplateEServiceTemplatesErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `M2M_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotFound` | 404 | The requested purpose template does not exist or is not visible to the requester (`retrievePurposeTemplate` via `applyVisibilityToPurposeTemplate`). | Cannot happen — the FE only opens this list from an already loaded purpose template in the app state, and the UI does not offer a standard action that targets an arbitrary non-existent id. | — | — |
| `eServiceDescriptorPurposeTemplateNotFound` | 404 | Dead mapper entry: the method returns `readModelService.getPurposeTemplateEServiceTemplates(...)` and never throws this error. | Cannot happen — there is no throw site in `getPurposeTemplateEServiceTemplates`; the service only retrieves the linked e-service templates after validating the parent purpose template. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: `applyVisibilityToPurposeTemplate` rejects hidden templates by throwing `purposeTemplateNotFound`, not `tenantNotAllowed`. | Cannot happen — visibility handling in `applyVisibilityToPurposeTemplate` uses the purpose-template-not-found guard for inaccessible draft templates, and this route never emits `tenantNotAllowed`. | — | — |

## 9. `GET /purposeTemplates/:id/eservices/:eserviceId`

Service: `purposeTemplateService` → `getPurposeTemplateEServiceDescriptor`. Mapper: `getPurposeTemplateEServiceDescriptorErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `M2M_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotFound` | 404 | The requested purpose template does not exist (`retrievePurposeTemplate`). | Cannot happen — the FE only reaches this lookup from an already loaded purpose template and there is no standard UI action that submits an arbitrary missing `purposeTemplateId`. | — | — |
| `eServiceDescriptorPurposeTemplateNotFound` | 404 | The requested e-service descriptor link does not exist for the selected purpose template (`retrievePurposeTemplateEserviceDescriptor`). | Cannot happen — the FE never exposes a direct way to open a descriptor route for an association that is not already in the current page state, and the generator reports no BFF route for this endpoint. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: `applyVisibilityToPurposeTemplate` rejects inaccessible draft templates by throwing `purposeTemplateNotFound`, not `tenantNotAllowed`. | Cannot happen — the authorization check in this flow is the visibility guard on the parent purpose template, which throws `purposeTemplateNotFound`, and this endpoint never emits `tenantNotAllowed`. | — | — |

## 10. `GET /purposeTemplates/:id/eserviceTemplates/:eserviceTemplateId`

Service: `purposeTemplateService` → `getPurposeTemplateEServiceTemplate`. Mapper: `getPurposeTemplateEServiceTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `M2M_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotFound` | 404 | The requested purpose template does not exist (`retrievePurposeTemplate`). | Cannot happen — the FE only reaches this lookup from an already loaded purpose template and there is no standard UI action that submits an arbitrary missing `purposeTemplateId`. | — | — |
| `eServiceTemplateVersionPurposeTemplateNotFound` | 404 | The requested e-service template link does not exist for the selected purpose template (`retrieveEServiceTemplateVersionPurposeTemplate`). | Cannot happen — the FE never exposes a direct route to an association that is not already in the current application state, and the generator reports no BFF route for this endpoint. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: `applyVisibilityToPurposeTemplate` rejects inaccessible draft templates by throwing `purposeTemplateNotFound`, not `tenantNotAllowed`. | Cannot happen — the authorization check in this flow is the parent-template visibility guard, which throws `purposeTemplateNotFound`, and this endpoint never emits `tenantNotAllowed`. | — | — |

## 11. `POST /purposeTemplates/:id/linkEservices`

Service: `purposeTemplateService` → `linkEservicesToPurposeTemplate`. Mapper: `linkEservicesToPurposeTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `associationEServicesForPurposeTemplateFailed` | 400 | The association validation fails because at least one submitted e-service is missing, has mismatched personal-data flags, is already linked, or has no valid published descriptor (`validateEservicesAssociations`). | Cannot happen — the generator reports no BFF endpoint for this operation and the FE does not expose a UI flow that submits an arbitrary list of e-services to link in this process. | — | — |
| `tooManyEServicesForPurposeTemplate` | 400 | The request includes more e-services than the configured maximum (`assertEServiceIdsCountIsBelowThreshold`). | Cannot happen — there is no FE route or form in this process that can trigger a bulk link action with an oversized list, and no BFF route exists to call this endpoint. | — | — |
| `purposeTemplateNotFound` | 404 | The parent purpose template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the link action only runs from a purpose template already loaded in the app state, and the UI never exposes a standard form that submits a stale or missing `purposeTemplateId`. | — | — |
| `associationBetweenEServiceAndPurposeTemplateAlreadyExists` | 409 | At least one selected e-service is already associated with the purpose template (`validateEservicesAssociations`). | Cannot happen — there is no direct UI to add the same e-service to an already-linked list, and no BFF route calls this backend operation from the frontend. | — | — |
| `purposeTemplateNotInExpectedStates` | 409 | The purpose template is not in a valid state for linking (`assertPurposeTemplateStateIsValid`, expected states: `draft` or `published`). | Cannot happen — the FE only allows the link action from a purpose template already in app state, and the standard UI does not present a stale action once the template exits the valid states. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: the creator check is implemented with `assertRequesterIsCreator`, which throws `purposeTemplateNotFound` for a different tenant rather than `tenantNotAllowed`. | Cannot happen — `assertRequesterIsCreator` throws `purposeTemplateNotFound` when the requester is not the creator, and this route never emits `tenantNotAllowed`. | — | — |

## 12. `POST /purposeTemplates/:id/linkEserviceTemplates`

Service: `purposeTemplateService` → `linkEServiceTemplatesToPurposeTemplate`. Mapper: `linkEServiceTemplatesToPurposeTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `associationEServiceTemplatesForPurposeTemplateFailed` | 400 | The association validation fails because at least one submitted e-service template is missing, not found, already linked, or has a non-allowed version state (`validateEServiceTemplatesAssociations`). | Cannot happen — the generator reports no BFF route for this operation and the frontend does not expose a form or action that can submit an arbitrary list of e-service templates to link in this process. | — | — |
| `tooManyEServiceTemplatesForPurposeTemplate` | 400 | The request includes more e-service template IDs than the configured threshold (`assertEServiceTemplateIdsCountIsBelowThreshold`). | Cannot happen — there is no FE route or bulk action in this process that can trigger an oversized link request, and no BFF route calls this endpoint. | — | — |
| `purposeTemplateNotFound` | 404 | The parent purpose template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the action only runs from a purpose template already loaded in the app state, and the UI never exposes a standard flow that submits a stale or missing `purposeTemplateId`. | — | — |
| `associationBetweenEServiceTemplateAndPurposeTemplateAlreadyExists` | 409 | At least one selected e-service template is already associated with the purpose template (`validateEServiceTemplatesAssociations`). | Cannot happen — there is no direct UI to add the same template to an already-linked list, and no BFF route calls this backend operation from the frontend. | — | — |
| `purposeTemplateNotInExpectedStates` | 409 | The purpose template is not in a valid state for linking (`assertPurposeTemplateStateIsValid`, expected states: `draft` or `published`). | Cannot happen — the FE only allows the link action from a purpose template already in app state, and the standard UI does not present a stale action once the template exits the valid states. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: `assertRequesterIsCreator` throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed`. | Cannot happen — the authorization check in this flow is the creator guard, which throws `purposeTemplateNotFound` when the requester is not the creator, and this route never emits `tenantNotAllowed`. | — | — |

## 13. `POST /purposeTemplates/:id/unlinkEserviceTemplates`

Service: `purposeTemplateService` → `unlinkEServiceTemplatesFromPurposeTemplate`. Mapper: `unlinkEServiceTemplatesFromPurposeTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `disassociationEServiceTemplatesFromPurposeTemplateFailed` | 400 | The disassociation validation fails because at least one submitted e-service template is missing, not found, or does not match a valid link for the parent purpose template (`validateEServiceTemplatesDisassociations`). | Cannot happen — the generator reports no BFF route for this operation and the frontend does not expose a form or action that can submit an arbitrary list of e-service templates to unlink in this process. | — | — |
| `tooManyEServiceTemplatesForPurposeTemplate` | 400 | The request includes more e-service template IDs than the configured threshold (`assertEServiceTemplateIdsCountIsBelowThreshold`). | Cannot happen — there is no FE route or bulk action in this process that can trigger an oversized unlink request, and no BFF route calls this endpoint. | — | — |
| `purposeTemplateNotFound` | 404 | The parent purpose template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the action only runs from a purpose template already loaded in the app state, and the UI never exposes a standard flow that submits a stale or missing `purposeTemplateId`. | — | — |
| `associationBetweenEServiceTemplateAndPurposeTemplateDoesNotExist` | 409 | At least one selected e-service template is not linked to the purpose template (`validateEServiceTemplatesDisassociations`). | Cannot happen — there is no direct UI to remove a template that is not already shown as linked, and no BFF route calls this backend operation from the frontend. | — | — |
| `purposeTemplateNotInExpectedStates` | 409 | The purpose template is not in a valid state for unlinking (`assertPurposeTemplateStateIsValid`, expected states: `draft` or `published`). | Cannot happen — the FE only allows the unlink action from a purpose template already in app state, and the standard UI does not present a stale action once the template exits the valid states. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: `assertRequesterIsCreator` throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed`. | Cannot happen — the authorization check in this flow is the creator guard, which throws `purposeTemplateNotFound` when the requester is not the creator, and this route never emits `tenantNotAllowed`. | — | — |

## 14. `POST /purposeTemplates/:id/unlinkEservices`

Service: `purposeTemplateService` → `unlinkEservicesFromPurposeTemplate`. Mapper: `unlinkEServicesFromPurposeTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `disassociationEServicesFromPurposeTemplateFailed` | 400 | The disassociation validation fails because at least one submitted e-service is missing, not found, or does not match a valid link for the parent purpose template (`validateEservicesDisassociations`). | Cannot happen — the generator reports no BFF route for this operation and the frontend does not expose a form or action that can submit an arbitrary list of e-services to unlink in this process. | — | — |
| `tooManyEServicesForPurposeTemplate` | 400 | The request includes more e-service IDs than the configured threshold (`assertEServiceIdsCountIsBelowThreshold`). | Cannot happen — there is no FE route or bulk action in this process that can trigger an oversized unlink request, and no BFF route calls this endpoint. | — | — |
| `purposeTemplateNotFound` | 404 | The parent purpose template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the action only runs from a purpose template already loaded in the app state, and the UI never exposes a standard flow that submits a stale or missing `purposeTemplateId`. | — | — |
| `associationBetweenEServiceAndPurposeTemplateDoesNotExist` | 409 | At least one selected e-service is not linked to the purpose template (`validateEservicesDisassociations`). | Cannot happen — there is no direct UI to remove an e-service that is not already shown as linked, and no BFF route calls this backend operation from the frontend. | — | — |
| `purposeTemplateNotInExpectedStates` | 409 | The purpose template is not in a valid state for unlinking (`assertPurposeTemplateStateIsValid`, expected states: `draft` or `published`). | Cannot happen — the FE only allows the unlink action from a purpose template already in app state, and the standard UI does not present a stale action once the template exits the valid states. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: `assertRequesterIsCreator` throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed`. | Cannot happen — the authorization check in this flow is the creator guard, which throws `purposeTemplateNotFound` when the requester is not the creator, and this route never emits `tenantNotAllowed`. | — | — |

## 15. `POST /purposeTemplates/:id/suspend`

Service: `purposeTemplateService` → `suspendPurposeTemplate`. Mapper: `suspendPurposeTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposeTemplates/:purposeTemplateId/suspend`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotInExpectedStates` | 409 | The purpose template is not in the `published` state when the suspend action runs (`assertSuspendableState` / `assertPurposeTemplateStateIsValid`). | Cannot happen — `useGetConsumerPurposeTemplateTemplatesActions` only exposes the _Sospendi_ action for `PUBLISHED` templates, and the UI removes it as soon as the state no longer matches. | — | — |
| `purposeTemplateNotFound` | 404 | The purpose template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the action runs only on a template already loaded in the app state, and the regular UI never submits a stale or missing `purposeTemplateId` from a standard interaction. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: the creator guard throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed` (`assertRequesterIsCreator`). | Cannot happen — `useGetConsumerPurposeTemplateTemplatesActions` returns no actions when `!isAdmin`, so non-admin users never reach the suspend mutation from the UI. | — | — |

## 16. `POST /purposeTemplates/:id/unsuspend`

Service: `purposeTemplateService` → `unsuspendPurposeTemplate`. Mapper: `activatePurposeTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposeTemplates/:purposeTemplateId/unsuspend`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `riskAnalysisTemplateValidationFailed` | 400 | The unsuspended purpose template still has a risk-analysis form that fails tenant-level validation (`validateRiskAnalysisTemplateOrThrow`). | Cannot happen — the standard FE flow never exposes a custom risk-analysis editor for activation, and the template is validated when it is created/edited; there is no normal action that can produce an invalid suspended template from the UI. | — | — |
| `purposeTemplateNotInExpectedStates` | 409 | The purpose template is not in the expected `suspended` state (`assertActivatableState` / `assertPurposeTemplateStateIsValid`). | Cannot happen — `useGetConsumerPurposeTemplateTemplatesActions` only shows the _Attiva_ action for `SUSPENDED` templates, and the UI hides it once the state changes. | — | — |
| `purposeTemplateStateConflict` | 409 | The template is in the `published` state while the method expects `suspended` (`assertPurposeTemplateStateIsValid`, conflict state: `published`). | Cannot happen — the activation button is only rendered for suspended records, so the UI cannot trigger a published-state conflict through a regular interaction. | — | — |
| `invalidAssociatedEServiceForPublicationError` | 409 | The associated e-service fails `validateAssociatedEserviceForPublication`, so the template cannot be published again because the linked e-service is not publication-eligible. | **CAN HAPPEN** — the FE exposes the _Attiva_ action on suspended templates without checking whether the linked e-service remains valid for publication; the backend validates that condition before flipping the template to `published`. | **Data precondition:** tenant A owns a suspended purpose template whose linked e-service is not valid for publication.<br>1. Go to the purpose template list.<br>2. Open the suspended template.<br>3. Click _Attiva_. | 🟢 Easy resolution <br />1. Fix the linked e-service so it is valid for publication.<br>2. Refresh the purpose template list and retry the activation. |
| `tenantNotAllowed` | 403 | Dead mapper entry: the creator guard throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed` (`assertRequesterIsCreator`). | Cannot happen — `useGetConsumerPurposeTemplateTemplatesActions` returns no actions when `!isAdmin`, so non-admin users never reach the reactivation mutation from the UI. | — | — |
| `purposeTemplateNotFound` | 404 | The template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the activation action is only offered for a template already loaded in the app state, and the standard UI does not submit a stale or missing `purposeTemplateId`. | — | — |

> Note: the activation flow can also throw `purposeTemplateRiskAnalysisFormNotFound` before the mapper when a suspended template has no risk-analysis form; because it is not listed in the mapper, the fallback rule turns it into a 500.

## 17. `POST /purposeTemplates/:id/archive`

Service: `purposeTemplateService` → `archivePurposeTemplate`. Mapper: `archivePurposeTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposeTemplates/:purposeTemplateId/archive`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotInExpectedStates` | 409 | The purpose template is not in an archivable state when the archive action runs (`assertArchivableState` / `assertPurposeTemplateStateIsValid`). | Cannot happen — `useGetConsumerPurposeTemplateTemplatesActions` only exposes the _Archivia_ action for `PUBLISHED` or `SUSPENDED` templates, and removes it as soon as the state changes. | — | — |
| `purposeTemplateNotFound` | 404 | The purpose template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the action runs only on a template already loaded in the app state, and the normal UI never submits a stale or missing `purposeTemplateId`. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: the creator guard throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed` (`assertRequesterIsCreator`). | Cannot happen — `useGetConsumerPurposeTemplateTemplatesActions` returns no actions when `!isAdmin`, so non-admin users never reach the archive mutation from the UI. | — | — |

## 18. `POST /purposeTemplates/:id/publish`

Service: `purposeTemplateService` → `publishPurposeTemplate`. Mapper: `activatePurposeTemplateErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposeTemplates/:purposeTemplateId/publish`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `riskAnalysisTemplateValidationFailed` | 400 | The published template still contains a risk-analysis form that fails tenant-level validation (`validateRiskAnalysisTemplateOrThrow`). | Cannot happen — the FE only exposes the publish action from the draft summary and never offers a custom risk-analysis editor or a mutation that leaves an invalid form in place before activation. | — | — |
| `purposeTemplateNotInExpectedStates` | 409 | The purpose template is not in the draft state when `activatePurposeTemplate` runs (`assertActivatableState`). | Cannot happen — the normal UI only shows the publish action for a draft template, and the summary screen does not allow a stale or published record to trigger the mutation through a supported interaction. | — | — |
| `purposeTemplateStateConflict` | 409 | The template is already in the `published` state while the activation flow expects `draft` (`assertPurposeTemplateStateIsValid`). | Cannot happen — the UI only exposes the publish action on active draft records, so a normal user cannot trigger the conflict state through the supported flow. | — | — |
| `invalidAssociatedEServiceForPublicationError` | 409 | `validateAssociatedEserviceForPublication` rejects the linked e-service before the template is activated. | **CAN HAPPEN** — the FE exposes the _Pubblica_ action on a draft without validating whether the linked e-service is still publication-eligible, and the backend checks that condition just before changing the state. | **Data precondition:** tenant A owns a draft purpose template whose linked e-service is no longer valid for publication.<br>1. Open the purpose template list.<br>2. Open the draft template.<br>3. Click _Pubblica_. | 🟢 Easy resolution <br />1. Fix or re-link the associated e-service so it passes publication validation.<br>2. Refresh the draft and retry the activation. |
| `tenantNotAllowed` | 403 | Dead mapper entry: `assertRequesterIsCreator` throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed`. | Cannot happen — the FE only offers the publish action to the owner, and the creator check path throws `purposeTemplateNotFound` instead of `tenantNotAllowed`. | — | — |
| `purposeTemplateNotFound` | 404 | The template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the action is started from a purpose template already loaded in the app state, and the standard UI does not allow the user to submit a stale or missing template id from a normal interaction. | — | — |

> Note: `purposeTemplateRiskAnalysisFormNotFound` can also be thrown when the selected purpose template has no risk-analysis form; since it is not listed in the mapper, the fallback rule turns it into a 500.

## 19. `POST /purposeTemplates/:id/riskAnalysis/answers/:answerId/annotation/documents`

Service: `purposeTemplateService` → `addRiskAnalysisTemplateAnswerAnnotationDocument`. Mapper: `addPurposeTemplateAnswerAnnotationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotFound` | 404 | The requested purpose template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the UI opens this upload flow only from an already loaded draft template, and there is no standard path that submits a stale or nonexistent template id. | — | — |
| `purposeTemplateRiskAnalysisFormNotFound` | 404 | The purpose template has no risk-analysis form (`retrieveRiskAnalysisFormTemplate`). | Cannot happen — the upload action is only provided while the form exists in the loaded draft, and the UI never offers a document upload for a template whose form is absent. | — | — |
| `riskAnalysisTemplateAnswerNotFound` | 404 | The selected answer id is missing from the current risk-analysis form (`retrieveRiskAnalysisTemplateAnswer`). | Cannot happen — the document upload action is bound to the answer currently rendered in the form, and the UI never exposes a manual way to target a missing answer id. | — | — |
| `riskAnalysisTemplateAnswerAnnotationNotFound` | 404 | The answer has no annotation payload at the point the document is appended (`retrieveAnswerAnnotation`). | Cannot happen — the FE creates the annotation when the user starts editing the answer, so the upload path can only run after the annotation object exists. | — | — |
| `riskAnalysisTemplateAnswerAnnotationDocumentNotFound` | 404 | Dead mapper entry: the method never attempts to fetch a document by id in this flow. | Cannot happen — there is no throw site in `addRiskAnalysisTemplateAnswerAnnotationDocument`; it only appends a new document to the current annotation and returns it. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: the creator guard throws `purposeTemplateNotFound` when the user is not the creator, not `tenantNotAllowed` (`assertRequesterIsCreator`). | Cannot happen — the edit page is only available to the template creator and the role check converts to `purposeTemplateNotFound` instead of `tenantNotAllowed`. | — | — |
| `conflictDocumentPrettyNameDuplicate` | 409 | The user uploads a document whose `prettyName` already exists in the same answer (`assertAnnotationDocumentIsUnique` / `assertPrettyNameIsUnique`). | **CAN HAPPEN** — the UI lets the user choose a file and never blocks reusing the same filename within the same annotation, while the backend enforces uniqueness at upload time. | **Data precondition:** tenant A owns a draft purpose template whose answer already contains a document called `Documento A.pdf`.<br>1. Open the draft template in edit mode and select the answer that already has the document.<br>2. Click _Salva documento_.<br>3. Choose a new file with the same name `Documento A.pdf` and confirm the upload. | 🟢 Easy resolution <br />1. Rename the file before uploading it again.<br>2. Refresh the answer and retry the upload with a unique name. |
| `conflictDuplicatedDocument` | 409 | The user uploads the same document again (same `checksum`) in the same answer (`assertAnnotationDocumentIsUnique`). | **CAN HAPPEN** — the upload form does not de-duplicate by file checksum, so the same file can be submitted twice and the backend rejects it as a duplicate. | Same as `conflictDocumentPrettyNameDuplicate`, except the duplicate is caused by uploading the same file again and the backend sees the same checksum. | 🟢 Easy resolution <br />1. Reuse the existing uploaded document instead of re-uploading it.<br>2. Choose a different file or remove the duplicate before retrying. |
| `annotationDocumentLimitExceeded` | 409 | The annotation already contains the maximum number of documents (`assertDocumentsLimitsNotReached`). | Cannot happen — `handleAddDocumentClick` stops the upload flow when `docs.length >= 2`, so the UI never leaves the document upload enabled after the limit is reached. | — | — |
| `purposeTemplateNotInExpectedStates` | 409 | The template is no longer in a draft state when the upload runs (`assertPurposeTemplateIsDraft`). | Cannot happen — the edit page only renders upload actions for a draft template, and the standard UI does not keep the upload control active after the template leaves `DRAFT`. | — | — |

> Note: `purposeTemplateRiskAnalysisFormNotFound` can also be thrown when the current draft has no risk-analysis form; because it is not listed in the mapper, the fallback rule turns it into a 500.

## 20. `PUT /purposeTemplates/:purposeTemplateId/riskAnalysis`

Service: `purposeTemplateService` → `updatePurposeTemplateRiskAnalysis`. Mapper: `updatePurposeTemplateRiskAnalysisErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `riskAnalysisTemplateValidationFailed` | 400 | The submitted risk-analysis form violates the tenant-level validation rules (`validateRiskAnalysisTemplateOrThrow`). | Cannot happen — the FE does not call this endpoint and does not expose a custom risk-analysis editor for the purpose-template update flow. | — | — |
| `purposeTemplateNotInExpectedStates` | 409 | The purpose template is not in the draft state (`assertPurposeTemplateIsDraft`). | Cannot happen — there is no BFF route or frontend action that reaches this process endpoint through the standard product flow, so the state guard is never exercised from the UI. | — | — |
| `purposeTemplateNotFound` | 404 | The requested template no longer exists or cannot be found (`retrievePurposeTemplate`). | Cannot happen — no frontend route or mutation calls this endpoint, so the standard UI never reaches a stale or missing template id. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: the creator check uses `purposeTemplateNotFound` for non-creators, not `tenantNotAllowed` (`assertRequesterIsCreator`). | Cannot happen — no frontend call site reaches this endpoint, and the creator guard in the service path resolves to `purposeTemplateNotFound` rather than a tenant permission error. | — | — |

> Note: `missingRiskAnalysisFormTemplate` can also be thrown when the update request omits the risk-analysis form; because it is not listed in the mapper, the fallback rule turns it into a 500.

## 21. `GET /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId`

Service: `purposeTemplateService` → `getRiskAnalysisTemplateAnswerAnnotationDocument`. Mapper: `getRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `M2M_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotFound` | 404 | The requested purpose template does not exist or is not visible to the requester (`retrievePurposeTemplate` + `applyVisibilityToPurposeTemplate`). | Cannot happen — the UI opens this download from an already selected template and answer, and the standard FE never exposes a free-form field to target a stale or hidden template id. | — | — |
| `riskAnalysisTemplateAnswerNotFound` | 404 | The selected answer is missing from the purpose template risk-analysis form (`assertAnswerExistsInRiskAnalysisTemplate`). | Cannot happen — the download action is triggered from the answer currently rendered in the UI, and the page does not expose a free-form answer id field. | — | — |
| `riskAnalysisTemplateAnswerAnnotationDocumentNotFound` | 404 | The answer exists but the requested annotation document is missing (`retrieveAnswerAnnotationDocument`). | Cannot happen — the UI downloads a document chosen from the already-rendered annotation list, and the standard interaction never submits a stale document id from a different session or tab. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: the visibility guard throws `purposeTemplateNotFound` for non-visible drafts, not `tenantNotAllowed` (`applyVisibilityToPurposeTemplate`). | Cannot happen — the visibility rule rejects hidden templates with `purposeTemplateNotFound`, and there is no tenant-specific throw site in this service path. | — | — |

## 22. `GET /purposeTemplates/:purposeTemplateId/riskAnalysis/annotationDocuments/:documentId`

Service: `purposeTemplateService` → `getRiskAnalysisTemplateAnswerAnnotationDocument`. Mapper: `getRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `M2M_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotFound` | 404 | The requested purpose template does not exist or is not visible to the requester (`retrievePurposeTemplate` + `applyVisibilityToPurposeTemplate`). | Cannot happen — the UI does not expose a standard route that targets an arbitrary missing purpose-template id for this document endpoint, and the document is only opened from the already-loaded form state. | — | — |
| `riskAnalysisTemplateAnswerNotFound` | 404 | The selected answer is missing from the purpose template risk-analysis form (`assertAnswerExistsInRiskAnalysisTemplate`). | Cannot happen — the UI never offers a free-form answer id for this endpoint; the document is selected from an already rendered answer list and answer id is derived from the current page state. | — | — |
| `riskAnalysisTemplateAnswerAnnotationDocumentNotFound` | 404 | The answer exists but the requested annotation document is not stored for the current template (`retrieveAnswerAnnotationDocument`). | Cannot happen — the standard FE interaction downloads a document already rendered in the annotation list, and the UI does not allow the user to submit a stale or non-existent document id. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: the visibility guard converts inaccessible drafts into `purposeTemplateNotFound`, not `tenantNotAllowed` (`applyVisibilityToPurposeTemplate`). | Cannot happen — the access check throws `purposeTemplateNotFound` for hidden or non-owned templates, and this path never emits `tenantNotAllowed`. | — | — |

## 23. `POST /purposeTemplates/:id/riskAnalysis/answers`

Service: `purposeTemplateService` → `createRiskAnalysisAnswer`. Mapper: `createRiskAnalysisAnswerErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `tenantNotAllowed` | 403 | Dead mapper entry: `assertRequesterIsCreator` throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed`. | Cannot happen — the edit page is only available to the template creator, and the ownership check resolves to `purposeTemplateNotFound` instead of a tenant-permission error. | — | — |
| `hyperlinkDetectionError` | 400 | The annotation text contains a URL or hyperlink (`validateRiskAnalysisAnswerAnnotationOrThrow` → `validateNoHyperlinksSafe`). | **CAN HAPPEN** — the annotation drawer accepts free text and the FE does not block pasted URLs before sending the request. | **Data precondition:** tenant A owns a draft purpose template and opens the answer-annotation drawer for a question in the risk-analysis form.<br>1. Open the purpose template edit page.<br>2. Select the question and click _Aggiungi annotazione_ (or the equivalent annotation action in the locale).<br>3. Paste a URL such as `https://example.com` into the annotation text and save the answer. | 🟢 Easy resolution <br />1. Remove the hyperlink from the annotation text.<br>2. Retry the save without the URL or replace it with plain text. |
| `riskAnalysisTemplateValidationFailed` | 400 | The submitted answer violates the tenant-specific risk-analysis rules (`validateRiskAnalysisAnswerOrThrow`). | Cannot happen — the FE populates the answer payload from the template’s available options and does not expose a way to generate an invalid answer through a normal interaction. | — | — |
| `purposeTemplateStateConflict` | 409 | Dead mapper entry: the service validates only `draft` and never passes a `conflictState` to `assertPurposeTemplateStateIsValid`, so the state-conflict branch is unreachable here. | Cannot happen — there is no throw site in `createRiskAnalysisAnswer`; the code only checks `state === draft` and rejects other states via `purposeTemplateNotInExpectedStates`. | — | — |
| `purposeTemplateNotInExpectedStates` | 409 | The template is not in the `draft` state when the answer is created (`assertPurposeTemplateStateIsValid`). | Cannot happen — the UI only exposes the answer-creation flow while the purpose template is a draft, and the standard edit page does not keep the action enabled once the state changes. | — | — |
| `purposeTemplateNotFound` | 404 | The template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the action starts from a purpose template already loaded in the edit page, and the FE does not offer a standard path that submits a stale or hidden template id. | — | — |
| `purposeTemplateRiskAnalysisFormNotFound` | 500 | The purpose template has no risk-analysis form (`assertPurposeTemplateHasRiskAnalysisForm`). | Cannot happen — the UI only allows adding an answer when the draft template already exposes a risk-analysis form, and the route is never reached for a template without that form. | — | — |

## 24. `PUT /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation`

Service: `purposeTemplateService` → `addRiskAnalysisAnswerAnnotation`. Mapper: `addRiskAnalysisAnswerAnnotationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `riskAnalysisTemplateValidationFailed` | 400 | The submitted answer violates the tenant-specific risk-analysis validation rules (`validateRiskAnalysisAnswerOrThrow`). | Cannot happen — the FE builds the answer from the template’s selectable options and does not expose controls or a direct editor that can create an invalid answer payload through a normal interaction. | — | — |
| `hyperlinkDetectionError` | 400 | The annotation text contains a URL or hyperlink (`validateRiskAnalysisAnswerAnnotationOrThrow` → `validateNoHyperlinksSafe`). | **CAN HAPPEN** — the annotation drawer accepts free text and the FE does not block pasted URLs before it sends the request. | **Data precondition:** tenant A owns a draft purpose template whose risk-analysis form is open in edit mode.<br>1. Open the purpose template edit page.<br>2. Select an answer and open the annotation editor.<br>3. Paste `https://example.com` into the annotation text and save the answer. | 🟢 Easy resolution <br />1. Remove the hyperlink from the annotation text.<br>2. Retry without the URL or replace it with plain text. |
| `purposeTemplateNotFound` | 404 | The selected purpose template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the UI reaches this action only from a purpose template already loaded in the edit flow, and the standard interaction never submits a stale or hidden template id. | — | — |
| `riskAnalysisTemplateAnswerNotFound` | 404 | The selected answer id is missing from the current risk-analysis form (`assertAnswerExistsInRiskAnalysisTemplate`). | Cannot happen — the action is tied to the answer currently shown in the form, and the FE does not expose a free-form answer id field. | — | — |
| `purposeTemplateNotInExpectedStates` | 409 | The template is not in the `draft` state when the annotation is saved (`assertPurposeTemplateStateIsValid`). | Cannot happen — the edit page only presents this action for a draft template and disables it when the template leaves the draft state. | — | — |
| `purposeTemplateStateConflict` | 409 | Dead mapper entry: this service path never uses a conflict state; `assertPurposeTemplateStateIsValid` only checks the allowed draft state and throws `purposeTemplateNotInExpectedStates` in the non-draft case. | Cannot happen — the function used here never receives a `conflictState`, so the “already published” conflict branch cannot be reached. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: the creator guard throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed` (`assertRequesterIsCreator`). | Cannot happen — the FE only allows the owner to edit the template, and the permission guard resolves to `purposeTemplateNotFound` instead of a tenant error. | — | — |
| `purposeTemplateRiskAnalysisFormNotFound` | 500 | The purpose template has no risk-analysis form (`assertPurposeTemplateHasRiskAnalysisForm`). | Cannot happen — the UI only offers an annotation action when the form is already present in the loaded draft and never reaches a save action for a template without the form. | — | — |

## 25. `DELETE /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation`

Service: `purposeTemplateService` → `deleteRiskAnalysisTemplateAnswerAnnotation`. Mapper: `deleteRiskAnalysisTemplateAnswerAnnotationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotInExpectedStates` | 409 | The template is not in the `draft` state when the annotation is deleted (`assertPurposeTemplateStateIsValid`). | Cannot happen — the FE only allows deleting the annotation while the template is a draft, and the action is cleared as soon as the state changes. | — | — |
| `purposeTemplateNotFound` | 404 | The selected purpose template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the delete action is started from a purpose template already loaded in the edit page, and the normal UI never submits a stale or hidden template id. | — | — |
| `riskAnalysisTemplateAnswerNotFound` | 404 | The selected answer id is missing from the current risk-analysis form (`assertAnswerExistsInRiskAnalysisTemplate`). | Cannot happen — the UI deletes the annotation from the answer currently rendered in the form, and the standard interaction does not expose a free-form answer id field. | — | — |
| `riskAnalysisTemplateAnswerAnnotationNotFound` | 404 | The answer exists but no annotation is attached to it at the moment of deletion (`retrieveAnswerAnnotation`). | Cannot happen — the FE only offers the delete action for an annotation that already exists in the rendered form, and it does not permit a stale annotation id to be submitted. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: the creator guard throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed` (`assertRequesterIsCreator`). | Cannot happen — the edit page is only available to the template creator, and the ownership check resolves to `purposeTemplateNotFound` rather than a tenant permission error. | — | — |

## 26. `DELETE /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId`

Service: `purposeTemplateService` → `deleteRiskAnalysisTemplateAnswerAnnotationDocument`. Mapper: `deleteRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotInExpectedStates` | 409 | The template is not in the `draft` state when the document is removed (`assertPurposeTemplateIsDraft`). | Cannot happen — the UI only exposes the delete-document action from an editor bound to a draft template, and the action is not kept enabled after the state changes. | — | — |
| `purposeTemplateNotFound` | 404 | The selected purpose template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the normal FE flow opens this removal action from a purpose template already loaded in the page state, so a stale or missing template id is never submitted through a supported UI interaction. | — | — |
| `riskAnalysisTemplateAnswerAnnotationDocumentNotFound` | 404 | The selected annotation document is missing in the current answer (`retrieveAnswerAnnotationDocument`). | Cannot happen — the UI deletes a document chosen from the already-rendered list, and the standard interaction never submits a stale or non-existent document id. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: the creator guard throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed` (`assertRequesterIsCreator`). | Cannot happen — the page is restricted to the template owner and the tenant check resolves to `purposeTemplateNotFound` instead of a tenant permission error. | — | — |

## 27. `DELETE /purposeTemplates/:purposeTemplateId/riskAnalysis/annotationDocuments/:documentId`

Service: `purposeTemplateService` → `deleteRiskAnalysisTemplateAnswerAnnotationDocument`. Mapper: `deleteRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotInExpectedStates` | 409 | The template is not in the `draft` state when the document is removed (`assertPurposeTemplateIsDraft`). | Cannot happen — the backend route is not invoked by any FE BFF endpoint and the standard UI only deletes documents from a draft answer in the currently loaded form. | — | — |
| `purposeTemplateNotFound` | 404 | The selected purpose template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the FE never calls this no-answer-id route; the standard interaction deletes a document from the answer currently rendered in the page state and never submits a free-form template id. | — | — |
| `riskAnalysisTemplateAnswerAnnotationDocumentNotFound` | 404 | The selected annotation document is missing from the current purpose-template form (`retrieveAnswerAnnotationDocument` with no answer id). | Cannot happen — this route is not exposed through the BFF, and the standard UI only removes a document already rendered in the currently selected answer list. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: `assertRequesterIsCreator` throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed`. | Cannot happen — the owner check resolves to `purposeTemplateNotFound`, and no standard FE route targets this process endpoint. | — | — |

## 28. `POST /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId/update`

Service: `purposeTemplateService` → `updateRiskAnalysisTemplateAnswerAnnotationDocument`. Mapper: `updateRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId/update`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `conflictDocumentPrettyNameDuplicate` | 409 | The user renames a document to a name already used by another document in the same answer (`assertAnnotationDocumentPrettyNameIsUnique`). | **CAN HAPPEN** — the UI exposes a document-name edit action and accepts a free-form string without enforcing uniqueness before the request is sent. | **Data precondition:** tenant A owns a draft purpose template and an answer with two attached documents, `Documento A` and `Documento B`.<br>1. Open the purpose template edit page and open the answer that contains the documents.<br>2. Click _Modifica nome del documento_ on `Documento A`.<br>3. Enter the same value currently used by `Documento B` in the document-name field and confirm the update. | 🟢 Easy resolution <br />1. Choose a different document name.<br>2. Save the document again with the unique name. |
| `purposeTemplateNotInExpectedStates` | 409 | The template is no longer in the `draft` state when the name update is attempted (`assertPurposeTemplateIsDraft`). | Cannot happen — the FE only offers the document-name editor while the template is in draft state, and the action is not kept enabled after the state changes. | — | — |
| `purposeTemplateNotFound` | 404 | The purpose template no longer exists or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the edit action is started from the currently loaded template state and the standard UI does not submit a stale or hidden template id through the supported flow. | — | — |
| `purposeTemplateRiskAnalysisFormNotFound` | 404 | The template has no risk-analysis form (`assertPurposeTemplateHasRiskAnalysisForm`). | Cannot happen — the action is only available from an already-open answer within a loaded form, and the UI never allows the form to be edited when no risk-analysis form exists. | — | — |
| `riskAnalysisTemplateAnswerNotFound` | 404 | The selected answer id is missing from the current risk-analysis form (`assertAnswerExistsInRiskAnalysisTemplate`). | Cannot happen — the UI updates the selected document from the answer currently rendered in the form, and the standard interaction never exposes a free-form answer id. | — | — |
| `riskAnalysisTemplateAnswerAnnotationNotFound` | 404 | The selected answer exists but has no annotation object to attach the document update to (`retrieveAnswerAnnotation`). | Cannot happen — the document list is only rendered from the answer’s annotation docs and the UI never submits an answer id that lacks its annotation payload. | — | — |
| `riskAnalysisTemplateAnswerAnnotationDocumentNotFound` | 404 | The document id no longer exists in the current answer (`retrieveAnswerAnnotationDocument`). | Cannot happen — the FE updates a document chosen from the already-rendered list, and the standard interaction never submits a stale or externally deleted document id. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: the owner check throws `purposeTemplateNotFound` for a different tenant, not `tenantNotAllowed` (`assertRequesterIsCreator`). | Cannot happen — the owner-only page prevents non-creators from reaching the action, and the access check resolves to `purposeTemplateNotFound` rather than a tenant error. | — | — |

## 29. `GET /purposeTemplates/:purposeTemplateId/riskAnalysisDocument`

Service: `purposeTemplateService` → `getRiskAnalysisTemplateDocument`. Mapper: `getRiskAnalysisTemplateDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /purposeTemplates/:purposeTemplateId/riskAnalysisDocument`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotFound` | 404 | The purpose template does not exist or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the normal UI does not expose a standard action that requests the unsigned template document by free-form template id; the product downloads the signed version through the dedicated `downloadSignedRiskAnalysis` path instead. | — | — |
| `purposeTemplateRiskAnalysisFormNotFound` | 404 | The template has no risk-analysis form (`retrieveRiskAnalysisFormTemplate`). | Cannot happen — the FE never reaches the unsigned-document route when the template is missing its form, and the standard product flow only downloads a document already associated with a valid form. | — | — |
| `purposeTemplateRiskAnalysisTemplateDocumentNotFound` | 404 | The risk-analysis form exists, but it has no underlying template document (`retrieveRiskAnalysisTemplateDocument`). | Cannot happen — the UI never invokes the unsigned template-document endpoint when the document is absent; no standard action renders a download for templates without an attached document. | — | — |

## 30. `GET /purposeTemplates/:purposeTemplateId/riskAnalysis/annotationDocuments`

Service: `purposeTemplateService` → `getRiskAnalysisTemplateAnnotationDocuments`. Mapper: `getRiskAnalysisTemplateAnnotationDocumentsErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`, `M2M_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `associationEServicesForPurposeTemplateFailed` | 400 | Dead mapper entry: `getRiskAnalysisTemplateAnnotationDocuments` only retrieves the purpose template and then queries annotation documents; it never validates or mutates E-service associations. | Cannot happen — there is no BFF route for this process endpoint and the normal UI never calls the annotation-document list endpoint from a purpose-template page. | — | — |
| `tooManyEServicesForPurposeTemplate` | 400 | Dead mapper entry: this method never runs the `tooManyEServicesForPurposeTemplate` association check. | Cannot happen — no standard FE flow triggers this endpoint, and the service only reads the existing annotation documents after the template is already loaded. | — | — |
| `purposeTemplateNotFound` | 404 | The purpose template does not exist or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the FE only reaches this list from a purpose template already in the page state, and there is no BFF route that exposes a free-form template id for this endpoint. | — | — |
| `associationBetweenEServiceAndPurposeTemplateAlreadyExists` | 409 | Dead mapper entry: no association creation or duplicate check runs in `getRiskAnalysisTemplateAnnotationDocuments`. | Cannot happen — there is no BFF route or UI action for this endpoint, and the method does not attempt to link or re-link an E-service to the template. | — | — |
| `purposeTemplateNotInExpectedStates` | 409 | Dead mapper entry: the method never asserts the purpose-template state before reading the annotation documents. | Cannot happen — the read-only method has no state transition guard and no FE interaction calls this endpoint directly. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: `applyVisibilityToPurposeTemplate` rejects inaccessible templates by throwing `purposeTemplateNotFound`, not `tenantNotAllowed`. | Cannot happen — the access guard resolves to a not-found error before any tenant-specific failure is emitted, and there is no UI path that calls this endpoint through the BFF. | — | — |

## 31. `GET /purposeTemplates/:purposeTemplateId/riskAnalysisDocument/signed`

Service: `purposeTemplateService` → `getRiskAnalysisTemplateSignedDocument`. Mapper: `getRiskAnalysisTemplateSignedDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /purposeTemplates/:purposeTemplateId/riskAnalysisDocument/signed`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | -------------- | ------------------ | ------------------------ | ---------------- |
| `purposeTemplateNotFound` | 404 | The purpose template does not exist or is not visible to the requester (`retrievePurposeTemplate`). | Cannot happen — the UI invokes the signed-document download only from a purpose template already loaded in the details screen, and the action is not enabled for a stale or non-existent template id. | — | — |
| `purposeTemplateRiskAnalysisFormNotFound` | 404 | The template does not include a risk-analysis form (`retrieveRiskAnalysisFormTemplate`). | Cannot happen — the FE only offers the signed-document download from a purpose template already rendered in the page, and the action is hidden when `purposeRiskAnalysisForm` is absent. | — | — |
| `purposeTemplateRiskAnalysisTemplateSignedDocumentNotFound` | 404 | The risk-analysis form does not have a signed document attached (`retrieveRiskAnalysisTemplateSignedDocument`). | Cannot happen — the UI only downloads the signed risk-analysis from a template that has already been loaded and shown in the product, and there is no standard action when the signed attachment is missing. | — | — |



