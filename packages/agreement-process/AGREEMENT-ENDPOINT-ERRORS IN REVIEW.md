## 1. `DELETE /agreements/:agreementId`

Service: `agreementService` → `deleteAgreementById`. Mapper: `deleteAgreementErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /agreements/:agreementId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `agreementNotFound` | 404 | The agreement id does not match an existing agreement (`retrieveAgreement`). | Cannot happen — the FE only opens the delete action from a valid agreement already loaded in the current tenant context, and it never renders a delete control against a synthetic or stale agreement id. | — | — |
| `agreementNotInExpectedState` | 400 | The agreement is not in a state allowing deletion (`assertExpectedState` with `agreementDeletableStates`). | Cannot happen — the UI only exposes the delete action for agreements in an eligible state and hides it for other states. | — | — |
| `tenantIsNotTheConsumer` | 403 | The acting tenant is not the agreement consumer (`assertRequesterCanActAsConsumer`). | Cannot happen — the delete button is only shown for the current consumer tenant, and the route/guard restricts it to the consumer role and active agreement context. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | The acting tenant is a consumer delegate but does not match the active consumer delegation (`assertRequesterCanActAsConsumer`). | Cannot happen — the FE only offers delegated consumer actions when the active delegation matches the current organization, and otherwise the action is hidden. | — | — |

## 2. `POST /agreements/:agreementId/update`

Service: `agreementService` → `updateAgreement`. Mapper: `updateAgreementErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `POST /agreements/:agreementId/update`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `agreementNotFound` | 404 | The agreement id does not match an existing agreement (`retrieveAgreement`). | Cannot happen — the update flow starts from an agreement already selected in the current tenant context, and the FE never builds a nonexistent agreement id during normal editing. | — | — |
| `agreementNotInExpectedState` | 400 | The agreement is not in an editable state (`assertExpectedState` with `agreementUpdatableStates`). | Cannot happen — the UI only permits editing drafts in the allowed agreement state and never exposes the update action for other states. | — | — |
| `tenantIsNotTheConsumer` | 403 | The acting tenant is not the agreement consumer (`assertRequesterCanActAsConsumer`). | Cannot happen — the FE only renders the edit/update controls for the current consumer organization, and the route/guard excludes other tenants. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | The acting tenant is a consumer delegate but does not match the active consumer delegation (`assertRequesterCanActAsConsumer`). | Cannot happen — the UI only offers delegated consumer actions when the active delegation matches the current organization, and otherwise the edit action is hidden. | — | — |

## 3. `POST /agreements/:agreementId/upgrade`

Service: `agreementService` → `upgradeAgreement`. Mapper: `upgradeAgreementErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /agreements/:agreementId/upgrade`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `agreementNotFound` | 404 | The agreement id does not match an existing agreement (`retrieveAgreement`). | Cannot happen — the upgrade action only starts from an agreement already selected in the consumer flow, and the FE never targets a nonexistent agreement id in a normal interaction. | — | — |
| `missingCertifiedAttributesError` | 400 | The consumer is missing certified attributes required by the newer published descriptor (`validateCertifiedAttributes`). | Cannot happen — the FE checks the certified-attribute requirements before enabling the upgrade action and blocks the call when the attributes are insufficient. | — | — |
| `agreementNotInExpectedState` | 400 | The agreement is not in an upgradeable state (`assertExpectedState` with `agreementUpgradableStates`). | Cannot happen — the UI only shows the upgrade action for agreements in eligible states and hides it for non-upgradable records. | — | — |
| `publishedDescriptorNotFound` | 400 | The e-service has no published descriptor to upgrade to (`newDescriptor === undefined`). | Cannot happen — the FE only offers upgrade when a published descriptor exists for the selected e-service; the action is disabled when no published version is available. | — | — |
| `noNewerDescriptor` | 400 | The published descriptor version is not newer than the current agreement descriptor version (`latestDescriptorVersion.data <= currentVersion.data`). | Cannot happen — the FE blocks the upgrade action when there is no newer published descriptor available, so the backend never receives an invalid upgrade request from the UI. | — | — |
| `tenantIsNotTheConsumer` | 403 | The acting tenant is not the agreement consumer (`assertRequesterCanActAsConsumer`). | Cannot happen — the consumer-side upgrade action is only rendered for the current consumer organization and the route/guard blocks other tenants. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | The acting tenant is a consumer delegate but does not match the active consumer delegation (`assertRequesterCanActAsConsumer`). | Cannot happen — the FE only passes the active consumer delegation when it matches the current organization, and otherwise the action is hidden. | — | — |

Note: `GET /agreements/filter/eservices` uses `emptyErrorMapper` and has no non-500 errors.

## 4. `POST /agreements/:agreementId/clone`

Service: `agreementService` → `cloneAgreement`. Mapper: `cloneAgreementErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /agreements/:agreementId/clone`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `agreementNotFound` | 404 | The agreement id does not match an existing agreement (`retrieveAgreement`). | Cannot happen — the action is launched from an agreement already loaded in the consumer list, and the FE never builds a non-existent agreement id during a normal interaction. | — | — |
| `agreementNotInExpectedState` | 400 | The agreement is not in a cloneable state (`assertExpectedState` with `agreementClonableStates`, currently only `REJECTED`). | Cannot happen — the UI exposes the clone action only for rejected agreement requests and hides it for any other state. | — | — |
| `missingCertifiedAttributesError` | 400 | The consumer is missing certified attributes required by the agreement's descriptor (`validateCertifiedAttributes`). | **CAN HAPPEN** — the consumer can click "Duplica" on a rejected agreement even when the corresponding request was rejected for missing certified attributes, and the FE does not perform a pre-check before calling the clone endpoint. | **Data precondition:** tenant A has a rejected agreement for e-service E and descriptor D, and A still lacks the certified attribute required by D.<br>1. Go to `/fruizione/richieste`.<br>2. Open the rejected agreement for E.<br>3. Click "Duplica". | 🟢 Easy resolution<br>1. Review the agreement and ensure the consumer tenant satisfies the certified-attribute requirement for descriptor D.<br>2. Reopen the rejected agreement or create a new draft after fixing the missing attributes.<br>3. Retry the clone action after the requirement is satisfied. |
| `eServiceNotFound` | 400 | The referenced e-service no longer exists (`retrieveEService`). | Cannot happen — the clone action is initiated from a selected agreement already tied to an existing e-service in the current tenant context, and the FE never targets a stale or deleted e-service during a normal flow. | — | — |
| `agreementAlreadyExists` | 409 | Another active or conflicting agreement for the same consumer and e-service already exists (`getAllAgreements` with `agreementCloningConflictingStates`). | **CAN HAPPEN** — the FE shows the clone action on a rejected request without checking whether another draft/active agreement for the same e-service already exists. | **Data precondition:** tenant A has a rejected agreement for e-service E. A also already has a draft, pending, active, suspended or missing-certified-attributes agreement for the same e-service E.<br>1. Go to `/fruizione/richieste`.<br>2. Open the rejected agreement for E.<br>3. Click "Duplica". | 🟢 Easy resolution<br>1. Resolve or remove the conflicting agreement for e-service E before cloning the rejected request.<br>2. Keep only one active or draft agreement for the same e-service.<br>3. Retry the clone action once the conflict is cleared. |
| `tenantIsNotTheConsumer` | 403 | The acting tenant is not the agreement consumer (`assertRequesterCanActAsConsumer`). | Cannot happen — the clone action is only offered in the consumer agreement flow and the auth guards restrict the route/action to the consumer tenant. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | The acting tenant is a consumer delegate but does not match the active delegation for that agreement (`assertRequesterCanActAsConsumer`). | Cannot happen — the FE only offers delegated consumer actions when the current organization matches the active consumer delegation, otherwise the action is hidden. | — | — |

## 5. `GET /tenants/:tenantId/eservices/:eserviceId/descriptors/:descriptorId/certifiedAttributes/validate`

Service: `agreementService` → `verifyTenantCertifiedAttributes`. Mapper: `verifyTenantCertifiedAttributesErrorMapper`. Roles: `ADMIN_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /tenants/:tenantId/eservices/:eserviceId/descriptors/:descriptorId/certifiedAttributes/validate`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotFound` | 404 | The target tenant does not exist (`retrieveTenant`). | Cannot happen — the FE only queries a tenant chosen from the existing tenant list in the agreement-consumer dialog, and the selection is never a stale or missing tenant in a normal flow. | — | — |
| `eServiceNotFound` | 400 | The target e-service does not exist (`retrieveEService`). | Cannot happen — the dialog is opened from the selected e-service and descriptor already loaded in the current agreement flow, so the FE never sends a non-existing e-service id. | — | — |
| `descriptorNotFound` | 400 | The target descriptor does not exist in the selected e-service (`retrieveDescriptor`). | Cannot happen — the FE chooses the descriptor from the current e-service metadata and never submits a descriptor id that is absent from that service. | — | — |
| `tenantIsNotTheConsumer` | 403 | The acting tenant is not the consumer for the agreement context (`assertRequesterCanActAsConsumer`). | Cannot happen — the validation is called only from the consumer side agreement dialog and the route/guard ensures the current organization is the consumer or the active delegation holder. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | The acting tenant is the consumer delegate but does not match the active consumer delegation (`assertRequesterCanActAsConsumer`). | Cannot happen — the FE only invokes this check when the selected consumer matches the current organization/delegation context; otherwise the mutation is not rendered or enabled. | — | — |
