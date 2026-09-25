# Delegation Process: error map

`GET /delegations`, `GET /consumer/delegators`, `GET /consumer/delegatorsWithAgreements`, and `GET /consumer/eservices` use `emptyErrorMapper`: they have no non-500 errors and are not given dedicated sections.

## 1. `GET /delegations/:delegationId`

Service: `delegationService` → `getDelegationById`. Mapper: `getDelegationByIdErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `delegationNotFound` | 404 | `retrieveDelegationById` calls `readModelService.getDelegationById(...)`; if there is no delegation for the given `delegationId`, it throws `delegationNotFound`. | Cannot happen — the FE only opens this detail route from a delegation already listed in the app, and the list is loaded from the same backend aggregate. | — | — |

## 2. `GET /delegations/:delegationId/contracts/:contractId`

Service: `delegationService` → `getDelegationContract`. Mapper: `getDelegationContractErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /delegations/:delegationId/contracts/:contractId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `delegationNotFound` | 404 | `retrieveDelegationById` fails because the delegation id is not present in the read model. | Cannot happen — the UI renders the contract action only for delegations already returned by the list/detail queries. | — | — |
| `delegationContractNotFound` | 404 | `getDelegationContract` compares the requested `contractId` against `activationContract` and `revocationContract`; if neither matches, it throws `delegationContractNotFound`. | Cannot happen — the FE only asks for a contract id that was previously returned by the same delegation data set, and the action is not available for arbitrary ids. | — | — |
| `operationForbidden` | 403 | `assertRequesterIsDelegateOrDelegator` rejects the request when the authenticated tenant is neither the delegator nor the delegate. | Cannot happen — the route is only accessed from the delegation details page for the current tenant and the request is tied to the specific delegation being viewed. | — | — |

## 3. `POST /producer/delegations`

Service: `delegationService` → `createProducerDelegation`. Mapper: `createProducerDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /producers/delegations`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `eserviceNotFound` | 400 | `retrieveEserviceById` throws `eserviceNotFound` when the selected `eserviceId` is not present in the read model. | Cannot happen — the form only offers producer e-services from the current tenant and the new e-service flow creates the resource first. | — | — |
| `tenantNotFound` | 400 | `retrieveTenantById` throws `tenantNotFound` for the delegator or delegate tenant id. | Cannot happen — the delegate is selected from the tenant autocomplete and the current tenant is the authenticated organization. | — | — |
| `invalidDelegatorAndDelegateIds` | 400 | `assertDelegatorIsNotDelegate` throws when the delegator and delegate are the same tenant. | Cannot happen — the tenant autocomplete explicitly filters out the current organization from the available delegates. | — | — |
| `eserviceAlreadyArchived` | 400 | `assertEserviceIsNotArchived` throws when the latest descriptor of the e-service is in `ARCHIVED` state. | Cannot happen — the selection list excludes archived e-services from provider listings. | — | — |
| `delegationNotAllowedForTenant` | 403 | `assertDelegatorAndDelegateAllowedForDelegation` throws when either tenant lacks the delegation-allowed attribute. | **CAN HAPPEN** — the FE filters by delegation feature, but not by the backend-specific delegation-allowed attribute, so a tenant can still be selected without that attribute. | **Data precondition:** tenant A is the producer and tenant B is eligible for delegated producer flow, but B does not have the delegation-allowed attribute; A can still create a producer delegation.<br>1. Go to `/aderente/deleghe/crea`.<br>2. Choose the producer delegation flow.<br>3. Select a valid e-service owned by A.<br>4. Select tenant B in the delegate field.<br>5. Click the confirmation action to create the delegation. | 🟡 Medium resolution <br />1. Review the tenant attribute `delegationsAllowedAttributeId` for both A and B.<br />2. Add the required delegation-allowed attribute to the affected tenant(s).<br />3. Refresh the page and retry the delegation creation. |
| `tenantNotAllowedToDelegation` | 403 | `assertTenantAllowedToReceiveDelegation` throws when the delegate tenant does not expose the required delegated-producer feature. | Cannot happen — the tenant autocomplete requests tenants with the `DELEGATED_PRODUCER` feature and does not show tenants missing it. | — | — |
| `differentEserviceProducer` | 403 | `assertDelegatorIsProducer` throws when the e-service producer id differs from the authenticated delegator id. | Cannot happen — the e-service picker is scoped to the current producer and only shows owner-owned e-services. | — | — |
| `delegationAlreadyExists` | 409 | `assertDelegationNotExists` throws when an active delegation with the same delegator, delegate, e-service and kind already exists. | Cannot happen — the UI warns about an existing delegation in some states, but it does not block the submit action for a stale or concurrent duplicate. | — | — 

## 4. `POST /producer/delegations/:delegationId/approve`

Service: `delegationService` → `approveProducerDelegation`. Mapper: `approveDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /producers/delegations/:delegationId/approve`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `delegationNotFound` | 404 | `retrieveDelegationById` fails because the delegation id is no longer present in the read model. | Cannot happen — the approve action is available only from a currently listed delegation record. | — | — |
| `operationRestrictedToDelegate` | 403 | `assertIsDelegate` throws when the authenticated organization is not the delegate for that delegation. | Cannot happen — the UI only exposes the accept action to the delegate side of the delegation row. | — | — |
| `incorrectState` | 409 | `assertIsState(delegationState.waitingForApproval, delegation)` throws when the delegation is not pending approval. | **CAN HAPPEN** — the UI does not disable the accept button when the delegation has already been accepted or rejected in another tab or by another user. | **Data precondition:** tenant A has a delegation with id D already in `ACTIVE` or `REJECTED` state, and the request is still opened from stale UI state.<br>1. Open the delegation details or list for tenant A.<br>2. Click the accept action for D.<br>3. The request is sent after the delegation state changed elsewhere. | 🟢 Easy resolution <br />1. Refresh the delegations list.<br />2. Re-open the delegation state to confirm the current status.<br />3. Retry only when the delegation is still in `WAITING_FOR_APPROVAL`. |

## 5. `POST /producer/delegations/:delegationId/reject`

Service: `delegationService` → `rejectProducerDelegation`. Mapper: `rejectDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /producers/delegations/:delegationId/reject`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `delegationNotFound` | 404 | `retrieveDelegationById` fails because the delegation id is not found. | Cannot happen — the reject dialog is opened from a loaded delegation row. | — | — |
| `delegationContractNotFound` | 404 | `retrieveDelegationById` succeeds, but `delegationContractNotFound` is later raised for a missing contract while rejecting the delegation. | Cannot happen — the reject action is not tied to a missing contract in the FE flow. | — | — |
| `operationForbidden` | 403 | `assertIsDelegate` fails when the current organization is not the delegate. | Cannot happen — only the delegate side is allowed to reject the delegation. | — | — |

> Unmapped flow errors: `hyperlinkDetectionError` is thrown by `validateNoHyperlinksSafe(rejectionReason)` in this flow; it is a common error and `defaultCommonErrorMapper` returns 400.

## 6. `DELETE /producer/delegations/:delegationId`

Service: `delegationService` → `revokeProducerDelegation`. Mapper: `revokeDelegationErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `DELETE /producers/delegations/:delegationId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `delegationNotFound` | 404 | `retrieveDelegationById` fails because the delegation was already deleted or not created. | Cannot happen — the revoke dialog is shown only for a current delegated relation. | — | — |
| `operationRestrictedToDelegator` | 403 | `assertIsDelegator` throws when the authenticated tenant is not the delegator. | Cannot happen — the revoke action is only shown on the delegator side of the relationship. | — | — |
| `incorrectState` | 409 | `assertIsState(activeDelegationStates, delegation)` throws when the delegation is in a non-active state such as `WAITING_FOR_APPROVAL`, `REJECTED` or `REVOKED`. | **CAN HAPPEN** — the UI exposes the revoke action on active delegations, but does not guard against a stale state after the delegation was changed elsewhere. | **Data precondition:** tenant A is the delegator and delegation D is already `REJECTED`, `REVOKED` or no longer active; the stale UI still shows the revoke action.<br>1. Open the list or detail for the delegation D.<br>2. Click the revoke action.<br>3. Submit the confirmation dialog. | 🟢 Easy resolution <br />1. Refresh the delegations list.<br />2. Confirm the current delegation state.<br />3. Retry only when the delegation is still active. |

## 7. `POST /consumer/delegations`

Service: `delegationService` → `createConsumerDelegation`. Mapper: `createConsumerDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /consumers/delegations`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `eserviceNotFound` | 400 | `retrieveEserviceById` throws when the selected e-service is not found. | Cannot happen — the FE loads the e-service from the catalog or the tenant-owned list and does not allow arbitrary ids. | — | — |
| `tenantNotFound` | 400 | `retrieveTenantById` fails for the delegator or delegate tenant id. | Cannot happen — the delegate is chosen from the UI tenant list and the delegator is the current tenant. | — | — |
| `invalidDelegatorAndDelegateIds` | 400 | `assertDelegatorIsNotDelegate` throws when the same tenant is chosen as both delegator and delegate. | Cannot happen — the delegate list excludes the current organization. | — | — |
| `eserviceNotConsumerDelegable` | 400 | `assertEserviceIsConsumerDelegable` throws when the selected e-service is not consumer-delegable. | Cannot happen — the catalog list is filtered by `isConsumerDelegable: true`. | — | — |
| `delegationNotAllowedForTenant` | 403 | `assertDelegatorAndDelegateAllowedForDelegation` throws when either tenant lacks the delegation-allowed attribute. | **CAN HAPPEN** — the UI filters by delegation feature but not by the additional backend attribute, so an ineligible tenant can still be selected through the autocomplete. | **Data precondition:** tenant A is the delegator and tenant B is selected as delegate; B has the delegated consumer feature but is missing the delegation-allowed attribute.<br>1. Go to `/aderente/deleghe/crea`.<br>2. Choose the consumer delegation flow.<br>3. Select an e-service E from the catalog.<br>4. Select tenant B as delegate.<br>5. Click the confirmation action to create the delegation. | 🟡 Medium resolution <br />1. Verify the delegation-allowed attribute on both tenant A and tenant B.<br />2. Add the required attribute to the affected tenant(s).<br />3. Refresh the page and retry. |
| `tenantNotAllowedToDelegation` | 403 | `assertTenantAllowedToReceiveDelegation` throws when the delegate tenant misses the delegated-consumer feature. | Cannot happen — the autocomplete calls `TenantQueries.getTenants(..., features: [DELEGATED_CONSUMER])` and only exposes eligible delegates. | — | — |
| `delegationAlreadyExists` | 409 | `assertDelegationNotExists` throws when an active matching delegation already exists. | Cannot happen — the page shows an existing delegation warning, but the submit action is still available if the record was created elsewhere or stale data remains in the page. | — | — |
| `delegationRelatedAgreementExists` | 409 | `assertNoDelegationRelatedAgreementExists` throws when there is an active agreement for the same consumer and e-service. | Cannot happen — the FE warns if there are agreements for the selected e-service, but it does not prevent submission before the request is sent. | — | — |

## 8. `POST /consumer/delegations/:delegationId/approve`

Service: `delegationService` → `approveConsumerDelegation`. Mapper: `approveDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /consumers/delegations/:delegationId/approve`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `delegationNotFound` | 404 | `retrieveDelegationById` fails because the delegation id is no longer in the read model. | Cannot happen — the accept action is only exposed from a loaded delegation row. | — | — |
| `operationRestrictedToDelegate` | 403 | `assertIsDelegate` throws when the authenticated organization is not the delegate. | Cannot happen — the accept button is shown only to the delegate side of the relationship. | — | — |
| `incorrectState` | 409 | `assertIsState(delegationState.waitingForApproval, delegation)` throws when the delegation is no longer pending approval. | **CAN HAPPEN** — the UI does not prevent the action when the state changed in another tab or by another actor. | **Data precondition:** the delegation D is already `ACTIVE` or `REJECTED`; the stale UI still allows the accept action.<br>1. Open the delegation list for tenant A.<br>2. Select D and click the accept action.<br>3. Send the confirmation. | 🟢 Easy resolution <br />1. Refresh the list.<br />2. Confirm the delegation state is still `WAITING_FOR_APPROVAL`.<br />3. Retry only with a pending approval. |

## 9. `POST /consumer/delegations/:delegationId/reject`

Service: `delegationService` → `rejectConsumerDelegation`. Mapper: `rejectDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /consumers/delegations/:delegationId/reject`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `delegationNotFound` | 404 | `retrieveDelegationById` fails because the delegation was not found. | Cannot happen — the reject action is only available from a loaded delegation record. | — | — |
| `delegationContractNotFound` | 404 | A contract is missing for a delegation under reject processing. | Cannot happen — the FE does not ask for a missing contract in this flow. | — | — |
| `operationForbidden` | 403 | `assertIsDelegate` throws when the caller is not the delegate. | Cannot happen — only the delegate side can reject the delegation. | — | — |

> Unmapped flow errors: `hyperlinkDetectionError` is thrown by `validateNoHyperlinksSafe(rejectionReason)` in this flow; it is a common error and `defaultCommonErrorMapper` returns 400.

## 10. `DELETE /consumer/delegations/:delegationId`

Service: `delegationService` → `revokeConsumerDelegation`. Mapper: `revokeDelegationErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `DELETE /consumers/delegations/:delegationId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `delegationNotFound` | 404 | `retrieveDelegationById` fails because the delegation is already gone or never existed. | Cannot happen — the revoke dialog is only opened for a currently listed delegation. | — | — |
| `operationRestrictedToDelegator` | 403 | `assertIsDelegator` throws when the authenticated tenant is not the delegator. | Cannot happen — only the delegator side exposes the revoke action. | — | — |
| `incorrectState` | 409 | `assertIsState(activeDelegationStates, delegation)` throws when the delegation is in a non-active state. | **CAN HAPPEN** — the UI allows the revoke action on stale records if the state changed outside the current page or from another actor. | **Data precondition:** tenant A is the delegator and D is already `REJECTED` or `REVOKED`; the stale UI still exposes the revoke action.<br>1. Open the delegation list or detail for D.<br>2. Click the revoke action.<br>3. Submit the confirmation. | 🟢 Easy resolution <br />1. Refresh the list and verify the delegation state.<br />2. Abort the revoke if the record is already inactive.<br />3. Retry only when the delegation is still active. |
