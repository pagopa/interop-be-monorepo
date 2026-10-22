# Tenant Process: error map

Endpoints whose mapper is `emptyErrorMapper` and therefore have no non-500 mapper errors: `GET /consumers`, `GET /producers`, `GET /tenants`.

## 1. `GET /tenants/:id`

Service: `tenantService.getTenantById`. Mapper: `getTenantByIdErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `INTERNAL_ROLE`, `VIEWER_ROLE`, `REVIEWER_ROLE`.

### BFF endpoints

- `GET /tenants/:tenantId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | `retrieveTenant` fails when the requested tenant id does not exist in the read model. | Cannot happen — the frontend only opens this route from a tenant already loaded in the session or from a selected party; the UI never sends a stale or invented tenant id on a normal navigation flow. | — | — |

## 2. `GET /tenants/origin/:origin/code/:code`

Service: `tenantService.getTenantByExternalId`. Mapper: `getTenantByExternalIdErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFoundByExternalId` | 404 | `readModelService.getTenantByExternalId` does not find a tenant for the given `origin` + `code`. | Cannot happen — the endpoint is not exposed by a normal UI route or action; the FE does not render a form that can submit arbitrary external-id lookups. | — | — |

## 3. `GET /tenants/attributes/certified`

Service: `tenantService.getCertifiedAttributesByCertifier`. Mapper: `getCertifiedAttributesByCertifierErrorMapper`. Roles: `ADMIN_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | The certifier tenant cannot be resolved from the authenticated context. | Cannot happen — the UI already has a valid authenticated tenant and this endpoint is read-only on the current organization, not a user-supplied tenant lookup. | — | — |
| `tenantIsNotACertifier` | 403 | `assertTenantIsCertifier` fails because the active organization is not a certifier. | Cannot happen — the FE only exposes the certifier page to certified organizations and hides the action for non-certifiers. | — | — |

## 4. `POST /tenants/:tenantId/attributes/verified/:attributeId`

Service: `tenantService.updateTenantVerifiedAttribute`. Mapper: `updateTenantVerifiedAttributeErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `INTERNAL_ROLE`, `VIEWER_ROLE`, `REVIEWER_ROLE`.

### BFF endpoints

- `POST /tenants/:tenantId/attributes/verified/:attributeId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | `retrieveTenant` fails when the target tenant is missing. | Cannot happen — the UI only allows the operation after selecting an existing tenant from the current party or certifier list. | — | — |
| `verifiedAttributeNotFoundInTenant` | 404 | The tenant does not have the verified attribute to update. | Cannot happen — the FE only submits an attribute already shown in the tenant details and the attribute row is not selectable when it does not exist. | — | — |
| `expirationDateCannotBeInThePast` | 400 | Validation rejects an expiry date earlier than today. | **CAN HAPPEN** — the date input is free text or a date picker but the FE does not block past dates before submit. | **Data precondition:** tenant A is a verifier and the tenant B is a valid target; B has no verified attribute for attribute X yet or is editing an existing one.<br>1. Go to the tenant details page for B.<br>2. Open the verified attributes section and choose _Assign verified attribute_.<br>3. Select attribute X and set an expiry date in the past.<br>4. Click _Salva_. | 🟢 Easy resolution <br />1. Set a future expiry date. <br />2. Re-submit the form. |
| `tenantNotFoundInVerifiers` | 403 | The current verifier is not allowed to manage the target tenant’s verified attributes. | Cannot happen — the operation is only shown to organizations that are actual verifiers for the tenant and the route is not available otherwise. | — | — |

## 5. `POST /tenants/:tenantId/attributes/verified/:attributeId/verifier/:verifierId`

Service: `tenantService.updateVerifiedAttributeExtensionDate`. Mapper: `updateVerifiedAttributeExtensionDateErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `INTERNAL_ROLE`, `VIEWER_ROLE`, `REVIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | The tenant targeted by the update does not exist. | Cannot happen — the UI is driven by an already-loaded tenant selection. | — | — |
| `verifiedAttributeNotFoundInTenant` | 404 | The tenant has no such verified attribute. | Cannot happen — only rows that already exist are editable. | — | — |
| `tenantNotFoundInVerifiers` | 403 | The tenant is not in the current verifier set. | Cannot happen — the UI hides the action unless the selected tenant is in the verifier list. | — | — |
| `expirationDateNotFoundInVerifier` | 400 | The verifier record for the tenant does not contain an expiry date to update. | Cannot happen — the FE cannot reach a verifier record that is missing its editable date field. | — | — |

## 6. `POST /tenants/:tenantId/mails`

Service: `tenantService.addTenantMail`. Mapper: `addTenantMailErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`, `VIEWER_ROLE`, `REVIEWER_ROLE`.

### BFF endpoints

- `POST /tenants/:tenantId/mails`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `operationForbidden` | 403 | The requester is not allowed to manage the tenant mail configuration. | Cannot happen — the action is only rendered for the current tenant and the route is protected by tenant-level authorization. | — | — |
| `tenantNotFound` | 404 | The tenant identified by `tenantId` does not exist. | Cannot happen — the FE only submits the current tenant id after loading tenant details. | — | — |
| `mailAlreadyExists` | 409 | The same mailbox is already configured for the tenant. | Cannot happen — the form does not allow submitting an email already attached to the tenant; the FE runs a uniqueness check before sending. | — | — |

## 7. `DELETE /tenants/:tenantId/mails/:mailId`

Service: `tenantService.deleteTenantMail`. Mapper: `deleteTenantMailErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`, `VIEWER_ROLE`, `REVIEWER_ROLE`.

### BFF endpoints

- `DELETE /tenants/:tenantId/mails/:mailId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `operationForbidden` | 403 | The requester cannot delete the selected tenant mail. | Cannot happen — the delete action is hidden unless the user is authorized for the current tenant. | — | — |
| `tenantNotFound` | 404 | `tenantId` points to a tenant that no longer exists. | Cannot happen — the UI only deletes a mail row loaded from the current tenant. | — | — |
| `mailNotFound` | 404 | The selected `mailId` no longer exists. | Cannot happen — the FE only submits the row currently rendered in the list and does not allow deleting stale mail entries. | — | — |

## 8. `POST /tenants/delegatedFeatures/update`

Service: `tenantService.updateTenantDelegatedFeatures`. Mapper: `updateTenantDelegatedFeaturesErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`, `VIEWER_ROLE`, `REVIEWER_ROLE`.

### BFF endpoints

- `POST /tenants/delegatedFeatures/update`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `operationForbidden` | 403 | The current user is not allowed to edit the delegated feature flags of the tenant. | Cannot happen — the UI only exposes the delegated-features switch to an authorized tenant admin and the request always carries the current tenant id. | — | — |
| `tenantNotFound` | 404 | The tenant being updated is missing. | Cannot happen — the toggles are loaded from the currently selected tenant and not from an arbitrary or stale tenant id. | — | — |

## 9. `GET /tenants/:tenantId/attributes/verified/:attributeId/verifiers`

Service: `tenantService.getTenantVerifiedAttributeVerifiers`. Mapper: `getTenantVerifiedAttributeVerifiersErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `INTERNAL_ROLE`, `VIEWER_ROLE`, `REVIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | The tenant in the URL does not exist. | Cannot happen — the UI opens this view only for tenants already present in the read model. | — | — |
| `attributeNotFound` | 404 | The declared attribute id is unknown. | Cannot happen — the FE lists only existing verified-attribute rows. | — | — |
| `attributeNotFoundInTenant` | 404 | The tenant does not actually hold the attribute. | Cannot happen — the list only renders rows for attributes attached to the current tenant. | — | — |

## 10. `GET /tenants/:tenantId/attributes/verified/:attributeId/revokers`

Service: `tenantService.getTenantVerifiedAttributeRevokers`. Mapper: `getTenantVerifiedAttributeRevokersErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `INTERNAL_ROLE`, `VIEWER_ROLE`, `REVIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | The tenant in the request does not exist. | Cannot happen — the page is opened from data already loaded for a known tenant. | — | — |
| `attributeNotFound` | 404 | The verified-attribute id is unknown. | Cannot happen — the UI only fetches details for attributes shown in the table. | — | — |
| `attributeNotFoundInTenant` | 404 | The tenant has no such attribute. | Cannot happen — the view is rendered from the current tenant’s verified-attribute collection. | — | — |

## 11. `POST /m2m/tenants`

Service: `tenantService.m2mUpsertTenant`. Mapper: `m2mUpsertTenantErrorMapper`. Roles: `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | A referenced tenant has been removed while the M2M upsert is running. | Cannot happen — the endpoint is M2M-only and has no UI route. | — | — |
| `attributeNotFound` | 404 | An assigned certified attribute does not exist. | Cannot happen — the endpoint is M2M-only and has no UI route. | — | — |
| `tenantNotFoundByExternalId` | 404 | A tenant lookup by external id fails. | Cannot happen — no normal FE interaction calls this route. | — | — |
| `certifiedAttributeAlreadyAssigned` | 409 | A certified attribute is already assigned to the tenant. | Cannot happen — M2M-only endpoint, not reachable from the UI. | — | — |
| `tenantIsNotACertifier` | 403 | The requesting tenant is not authorized to certify the incoming attribute assignment. | Cannot happen — M2M-only endpoint, not reachable from the UI. | — | — |

## 12. `DELETE /m2m/origin/:origin/externalId/:externalId/attributes/:code`

Service: `tenantService.m2mRevokeCertifiedAttribute`. Mapper: `m2mRevokeCertifiedAttributeErrorMapper`. Roles: `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | A tenant used in the revoke flow no longer exists. | Cannot happen — this is an M2M route and is not surfaced in the UI. | — | — |
| `tenantNotFoundByExternalId` | 404 | The tenant cannot be resolved from `origin` + `externalId`. | Cannot happen — no UI action targets this M2M path. | — | — |
| `attributeNotFound` | 400 | The attribute id passed to the revoke operation does not exist. | Cannot happen — no UI action targets this M2M path. | — | — |
| `attributeNotFoundInTenant` | 400 | The attribute exists but is not assigned to the tenant. | Cannot happen — no UI action targets this M2M path. | — | — |
| `tenantIsNotACertifier` | 403 | The certifier role is missing. | Cannot happen — no UI action targets this M2M path. | — | — |

## 13. `GET /tenants/selfcare/:selfcareId`

Service: `tenantService.getTenantBySelfcareId`. Mapper: `getTenantBySelfcareIdErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFoundBySelfcareId` | 404 | The selfcare id cannot be resolved to a tenant. | Cannot happen — UI flows only resolve a tenant from the authenticated session or from a selected party and do not submit arbitrary selfcare ids. | — | — |

## 14. `POST /selfcare/tenants`

Service: `tenantService.selfcareUpsertTenant`. Mapper: `selfcareUpsertTenantErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `operationForbidden` | 403 | The requester is not allowed to upsert the SelfCare tenant payload. | Cannot happen — the FE does not expose a direct UI for this endpoint and performs the operation only as part of authenticated tenant bootstrap. | — | — |
| `selfcareIdConflict` | 409 | The same SelfCare id already exists for a different tenant. | Cannot happen — no user interaction creates a direct SelfCare tenant upsert route from the web UI. | — | — |

## 15. `POST /tenants/:tenantId/attributes/certified`

Service: `tenantService.addCertifiedAttribute`. Mapper: `addCertifiedAttributeErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `POST /tenants/:tenantId/attributes/certified`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | Target tenant does not exist. | Cannot happen — the page is loaded from an existing tenant and does not let the user choose a missing one. | — | — |
| `tenantIsNotACertifier` | 403 | The acting tenant is not a certifier. | Cannot happen — the certifier drawer is only available to organizations that own the certifier role. | — | — |
| `attributeNotFound` | 400 | The attribute id is invalid or the attribute has been deleted. | Cannot happen — the FE only sends a selected attribute row from the current attribute catalog. | — | — |
| `attributeDoesNotBelongToCertifier` | 403 | The attribute to assign is not owned by the acting certifier. | Cannot happen — the UI filters out attributes not owned by the current certifier before submit. | — | — |
| `certifiedAttributeAlreadyAssigned` | 400 | The tenant already has the same certified attribute assigned. | **CAN HAPPEN** — the certifier drawer can submit an already assigned attribute if the page was stale or the user double-submits. | **Data precondition:** tenant A is a certifier; tenant B already owns certified attribute X.<br>1. Go to the certifier page for tenant B.<br>2. Open _Assign certified attribute_.<br>3. Select attribute X.<br>4. Click _Assegna_. | 🟢 Easy resolution <br />1. Refresh the tenant attribute list and use a different attribute. <br />2. Submit again after the list refresh. |
| `certifiedDiscreteAttributeAlreadyAssigned` | 409 | The same discrete attribute is already present in a conflicting assignment. | Cannot happen — the assignment UI prevents the same discrete attribute from being selected twice on the same form. | — | — |

## 16. `POST /tenants/:tenantId/attributes/certifiedDiscrete`

Service: `tenantService.addCertifiedAttribute`. Mapper: `addCertifiedAttributeErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `POST /tenants/:tenantId/attributes/certifiedDiscrete`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | Target tenant no longer exists. | Cannot happen — the form is opened only for an existing tenant. | — | — |
| `tenantIsNotACertifier` | 403 | The current tenant is not a certifier. | Cannot happen — the certifier drawer is hidden for unauthorized users. | — | — |
| `attributeNotFound` | 400 | The attribute used in the request is missing. | Cannot happen — the attribute list is generated from the current catalog and is not user-editable. | — | — |
| `attributeDoesNotBelongToCertifier` | 403 | The certifier is trying to assign an attribute not belonging to it. | Cannot happen — the selector is filtered to the current certifier’s attributes. | — | — |
| `certifiedAttributeAlreadyAssigned` | 400 | The discrete assignment already exists. | **CAN HAPPEN** — double-submit or stale selection can re-send the same assignment against an already populated tenant record. | **Data precondition:** tenant A is a certifier; tenant B already owns the discrete attribute X.<br>1. Open the certifier page for B.<br>2. Select the already assigned attribute X in the drawer.<br>3. Click _Assegna_. | 🟢 Easy resolution <br />1. Refresh the attribute list. <br />2. Select a different attribute or value. |
| `certifiedDiscreteAttributeAlreadyAssigned` | 409 | A discrete attribute assignment conflict is detected. | Cannot happen — the field choices are constrained by the current certifier’s available discrete attribute set and thus cannot duplicate. | — | — |

## 17. `POST /tenants/attributes/declared`

Service: `tenantService.addDeclaredAttribute`. Mapper: `addDeclaredAttributeErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`, `REVIEWER_ROLE`.

### BFF endpoints

- `POST /tenants/attributes/declared`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | The tenant represented by the operation cannot be resolved. | Cannot happen — the operation is backed by the current authenticated tenant. | — | — |
| `attributeNotFound` | 404 | The attribute reference is invalid or no longer exists. | Cannot happen — the FE uses a selection from the current organization attribute list. | — | — |
| `delegationNotFound` | 404 | The delegate flow expects a valid active delegation from which to assign the declared attribute. | Cannot happen — the FE only allows the delegate action when a delegation is present and selected. | — | — |
| `operationRestrictedToDelegate` | 403 | The requester is not the delegate for the attribute assignment flow. | Cannot happen — the form is hidden unless the current user is acting as delegate; the role check is front-end enforced. | — | — |

## 18. `POST /tenants/:tenantId/attributes/verified`

Service: `tenantService.verifyVerifiedAttribute`. Mapper: `verifyVerifiedAttributeErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `POST /tenants/:tenantId/attributes/verified`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `expirationDateCannotBeInThePast` | 400 | The expiration date entered for a verified attribute is earlier than today. | **CAN HAPPEN** — the FE accepts a date input and does not fully validate it before sending. | **Data precondition:** tenant B has an agreement with tenant A and an attribute X that can be assigned as verified.<br>1. Go to the agreement page for the consumer tenant.<br>2. Open the verified-attributes assignment flow.<br>3. Select attribute X and set an expiry date in the past.<br>4. Click _Conferma_. | 🟢 Easy resolution <br />1. Set a future date. <br />2. Submit the assignment again. |
| `tenantNotFound` | 404 | The target tenant is missing. | Cannot happen — the FE only assigns attributes to enrolled tenants present in the current flow. | — | — |
| `attributeNotFound` | 404 | The attribute does not exist. | Cannot happen — the attribute is selected from the current catalog and cannot be stale in the UI. | — | — |
| `agreementNotFound` | 404 | The agreement tied to the verified attribute is missing. | Cannot happen — the FE only submits the selected agreement from a loaded state. | — | — |
| `eServiceNotFound` | 404 | The e-service backing the agreement is missing. | Cannot happen — the agreement details page is opened only when the e-service exists. | — | — |
| `descriptorNotFoundInEservice` | 404 | The version descriptor referenced by the agreement cannot be found. | Cannot happen — the FE only exposes the flow for a currently loaded agreement descriptor. | — | — |
| `verifiedAttributeSelfVerificationNotAllowed` | 403 | A tenant attempts to verify an attribute on itself. | Cannot happen — the UI does not allow a user to choose their own tenant as the verifier for their own attribute flow. | — | — |
| `attributeVerificationNotAllowed` | 403 | The agreement or delegation does not allow the verification operation. | Cannot happen — the UI blocks the action when the attribute is not eligible for verification. | — | — |

## 19. `DELETE /tenants/:tenantId/attributes/verified/:attributeId`

Service: `tenantService.revokeVerifiedAttribute`. Mapper: `revokeVerifiedAttributeErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `DELETE /tenants/:tenantId/attributes/verified/:attributeId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | The tenant is missing. | Cannot happen — the revoke action is invoked only for rows from the current tenant state. | — | — |
| `attributeNotFound` | 400 | The verified attribute is absent. | Cannot happen — the UI triggers revoke only for rows currently rendered. | — | — |
| `agreementNotFound` | 404 | The agreement linked to the attribute is no longer found. | Cannot happen — the operation is performed from an agreement context already loaded by the page. | — | — |
| `eServiceNotFound` | 404 | The e-service behind the agreement was removed. | Cannot happen — the FE cannot show an agreement without its e-service. | — | — |
| `descriptorNotFoundInEservice` | 404 | The descriptor has been removed from the e-service. | Cannot happen — the same loaded agreement state is used. | — | — |
| `verifiedAttributeSelfRevocationNotAllowed` | 403 | A tenant tries to revoke an attribute on itself. | Cannot happen — the UI filters self-revocation out of the action list. | — | — |
| `attributeRevocationNotAllowed` | 403 | The operation is not permitted for the current agreement or delegation. | Cannot happen — the action is hidden when the agreement is not eligible. | — | — |
| `attributeAlreadyRevoked` | 409 | The verified attribute was already revoked. | Cannot happen — the UI disables the revoke action once the row is already revoked. | — | — |

## 20. `DELETE /tenants/:tenantId/attributes/certified/:attributeId`

Service: `tenantService.revokeCertifiedAttribute`. Mapper: `revokeCertifiedAttributeErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | The target tenant is missing. | Cannot happen — the revoke action is only fired for tenant rows loaded from the current certifier view. | — | — |
| `attributeNotFound` | 404 | The certified attribute does not exist. | Cannot happen — the action is tied to an existing attribute row. | — | — |
| `attributeDoesNotBelongToCertifier` | 403 | The certifier is revoking an attribute it does not own. | Cannot happen — the UI hides rows not owned by the current certifier. | — | — |
| `tenantIsNotACertifier` | 403 | The acting tenant is not a certifier. | Cannot happen — the action is rendered only for certifier organizations. | — | — |
| `attributeAlreadyRevoked` | 409 | The attribute has already been revoked. | Cannot happen — the revoke button is disabled once the row is already revoked. | — | — |

## 21. `PUT /tenants/:tenantId/attributes/certifiedDiscrete/:attributeId`

Service: `tenantService.internalUpdateCertifiedDiscreteAttribute` (called via certified-discrete update flow). Mapper: `updateCertifiedDiscreteAttributeErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | The target tenant is missing. | Cannot happen — the update form is opened from existing tenant data. | — | — |
| `attributeNotFound` | 404 | The discrete attribute cannot be found. | Cannot happen — the UI submits only an attribute from the current list. | — | — |
| `attributeDoesNotBelongToCertifier` | 403 | The attribute does not belong to the current certifier. | Cannot happen — selector options are filtered to the certifier’s set. | — | — |
| `tenantIsNotACertifier` | 403 | The acting tenant is not a certifier. | Cannot happen — the action requires certifier authorization. | — | — |
| `certifiedDiscreteAttributeRevoked` | 409 | The attribute has already been revoked and cannot be changed. | Cannot happen — the form is not shown for revoked rows. | — | — |

## 22. `DELETE /tenants/:tenantId/attributes/certifiedDiscrete/:attributeId`

Service: `tenantService.revokeCertifiedAttribute`. Mapper: `revokeCertifiedAttributeErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | The tenant no longer exists. | Cannot happen — this action is launched from a loaded tenant record. | — | — |
| `attributeNotFound` | 404 | The discrete attribute is missing. | Cannot happen — the row is selected from the current attribute list. | — | — |
| `attributeDoesNotBelongToCertifier` | 403 | The attribute is not owned by the current certifier. | Cannot happen — the UI filters the action to certifier-owned rows only. | — | — |
| `tenantIsNotACertifier` | 403 | The acting tenant is not a certifier. | Cannot happen — the action is hidden for non-certifiers. | — | — |
| `attributeAlreadyRevoked` | 409 | The discrete attribute was already revoked. | Cannot happen — the action is disabled after revoke. | — | — |

## 23. `DELETE /tenants/attributes/declared/:attributeId`

Service: `tenantService.revokeDeclaredAttribute`. Mapper: `revokeDeclaredAttributeErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`, `REVIEWER_ROLE`.

### BFF endpoints

- `DELETE /tenants/attributes/declared/:attributeId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | The tenant associated with the declared attribute cannot be found. | Cannot happen — the action is related to the current authenticated tenant and is not submitted with an arbitrary tenant id. | — | — |
| `attributeNotFound` | 400 | The declared attribute no longer exists in the tenant. | Cannot happen — the row is selected from an existing list and the UI does not allow stale rows to be revoked. | — | — |

