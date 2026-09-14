# delegation-process endpoint errors

## 1. `GET /delegations`

Service: `getDelegations`. Mapper: `getDelegationsErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SUPPORT_ROLE`, `REVIEWER_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /delegations`

No mapped non-500 errors. The read-model query has no known service-specific throw site.

## 2. `GET /delegations/:delegationId`

Service: `getDelegationById` → `retrieveDelegationById`. Mapper: `getDelegationByIdErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /delegations/:delegationId`
- `GET /delegations/:delegationId/signedContract/:contractId`

| Error                | Code       | Status | When it happens                                                         | Reachable from the FE?                                                                                                             | Steps to reproduce (UI) |
| -------------------- | ---------- | ------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `delegationNotFound` | `010-0001` | 404    | `retrieveDelegationById` finds no delegation data for the requested id. | Cannot happen — the FE obtains the id from a current delegation list or detail route; stale tabs and crafted ids are out of scope. | —                       |

## 3. `GET /delegations/:delegationId/contracts/:contractId`

Service: `getDelegationContract` → `retrieveDelegationById`, `assertRequesterIsDelegateOrDelegator`. Mapper: `getDelegationContractErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /delegations/:delegationId/contracts/:contractId`

| Error                        | Code       | Status | When it happens                                                                                      | Reachable from the FE?                                                                                                                                                         | Steps to reproduce (UI) |
| ---------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `delegationNotFound`         | `010-0001` | 404    | `retrieveDelegationById` finds no delegation data.                                                   | Cannot happen — contract download links are rendered from a loaded delegation detail.                                                                                          | —                       |
| `delegationContractNotFound` | `010-0013` | 404    | The requested contract id is neither the delegation activation contract nor its revocation contract. | Cannot happen — the FE downloads only contract ids present in the loaded delegation.                                                                                           | —                       |
| `operationForbidden`         | `9989`     | 403    | `assertRequesterIsDelegateOrDelegator` sees that the requester is neither party to the delegation.   | Cannot happen — the detail and download actions are available only from the requester’s delegation data; the process role is not sufficient to bypass the ownership assertion. | —                       |

## 4. `POST /internal/delegations/:delegationId/contract`

Service: `internalAddDelegationContract` → `retrieveDelegationById`. Mapper: `generateDelegationContractErrorMapper`. Roles: `INTERNAL_ROLE`.

### BFF endpoints

- `None`

| Error                | Code       | Status | When it happens                                               | Reachable from the FE?                                                                                      | Steps to reproduce (UI) |
| -------------------- | ---------- | ------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------- |
| `delegationNotFound` | `010-0001` | 404    | `retrieveDelegationById` finds no delegation data for the id. | Cannot happen — this is an internal-only route requiring `INTERNAL_ROLE`; no frontend BFF route invokes it. | —                       |

## 5. `POST /internal/delegations/:delegationId/signedContract`

Service: `internalAddDelegationSignedContract` → `retrieveDelegationById`, `assertIsState`. Mapper: `generateDelegationSignedContractErrorMapper`. Roles: `INTERNAL_ROLE`.

### BFF endpoints

- `None`

| Error                | Code       | Status | When it happens                                                                                             | Reachable from the FE?                                                                                      | Steps to reproduce (UI) |
| -------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------- |
| `delegationNotFound` | `010-0001` | 404    | `retrieveDelegationById` finds no delegation data for the id.                                               | Cannot happen — this is an internal-only route requiring `INTERNAL_ROLE`; no frontend BFF route invokes it. | —                       |
| `incorrectState`     | `010-0011` | 409    | `assertIsState` requires the delegation to be `ACTIVE` or `REVOKED` before a signed contract can be stored. | Cannot happen — this is an internal-only route requiring `INTERNAL_ROLE`; no frontend BFF route invokes it. | —                       |

## 6. `POST /producer/delegations`

Service: `createProducerDelegation` → `createDelegation`. Mapper: `createProducerDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /producers/delegations`

| Error                            | Code       | Status | When it happens                                                                                                                                                                               | Reachable from the FE?                                                                                                                                                                                                         | Steps to reproduce (UI)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eserviceNotFound`               | `010-0002` | 400    | `retrieveEserviceById` cannot find the selected e-service.                                                                                                                                    | Cannot happen — the FE submits only an e-service selected from the producer e-service autocomplete; a deleted or stale selection is out of scope.                                                                              | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `tenantNotFound`                 | `010-0004` | 400    | `retrieveTenantById` cannot find either the authenticated delegator or the selected delegate tenant.                                                                                          | Cannot happen — the delegator comes from the authenticated organization and the delegate id comes from the tenant autocomplete; crafted or stale ids are out of scope.                                                         | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `invalidDelegatorAndDelegateIds` | `010-0005` | 400    | `assertDelegatorIsNotDelegate` receives the same tenant id for delegator and delegate.                                                                                                        | Cannot happen — `DelegationCreateTenantAutocomplete` filters out the authenticated organization from its delegate options.                                                                                                     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `eserviceAlreadyArchived`        | `010-0016` | 400    | `assertEserviceIsNotArchived` sees that the selected e-service's latest descriptor is in `ARCHIVED` state.                                                                                    | Cannot happen — the producer e-service autocomplete requests only non-archived descriptor states; stale or concurrent state changes are out of scope.                                                                          | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `delegationNotAllowedForTenant`  | `010-0006` | 403    | `assertDelegatorAndDelegateAllowedForDelegation` finds no active delegation-allowed certified attribute on the delegator or delegate, when `featureFlagDelegationConstraintSkip` is disabled. | **CAN HAPPEN** — the delegate autocomplete filters the `DELEGATED_PRODUCER` feature but does not verify the delegation-allowed certified attribute on the current tenant; the BFF forwards the request without this pre-check. | **Data precondition:** `featureFlagDelegationConstraintSkip` is disabled; tenant A is an admin, owns non-archived e-service E, lacks the active delegation-allowed certified attribute, and has no producer delegation for E; tenant B has the `DELEGATED_PRODUCER` feature.<br>1. Go to `/aderente/deleghe/crea/`.<br>2. Select _delega all’erogazione_ and click _Prosegui_.<br>3. Select E in _Nome dell'e-service (richiesto)_.<br>4. Select B in _Ente da delegare all’erogazione (richiesto)_.<br>5. Click _Inoltra delega_, tick _Ho capito_, and click _Inoltra delega_ in the confirmation dialog. |
| `tenantNotAllowedToDelegation`   | `010-0007` | 403    | `assertTenantAllowedToReceiveDelegation` finds no `DELEGATED_PRODUCER` feature on the selected delegate tenant.                                                                               | Cannot happen — `DelegationCreateTenantAutocomplete` requests tenants with the `DELEGATED_PRODUCER` feature and displays only those results.                                                                                   | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `differentEserviceProducer`      | `010-0012` | 403    | `assertDelegatorIsProducer` sees that the authenticated delegator is not the e-service producer.                                                                                              | Cannot happen — the producer e-service autocomplete is backed by the BFF catalog query scoped to the authenticated organization as `producersIds`.                                                                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `delegationAlreadyExists`        | `010-0003` | 409    | `assertDelegationNotExists` finds an active or waiting producer delegation for the same delegator, e-service, and kind.                                                                       | Cannot happen — the producer e-service autocomplete requests `delegated: false`, which excludes e-services with an active or waiting producer delegation; the form has no selectable duplicate state.                          | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## 7. `POST /producer/delegations/:delegationId/approve`

Service: `approveProducerDelegation` → `approveDelegation`, `retrieveDelegationById`, `assertIsDelegate`, `assertIsState`. Mapper: `approveDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /producers/delegations/:delegationId/approve`

| Error                           | Code       | Status | When it happens                                                                              | Reachable from the FE?                                                                                                              | Steps to reproduce (UI) |
| ------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `delegationNotFound`            | `010-0001` | 404    | No producer delegation exists for the requested id.                                          | Cannot happen — the approve action is rendered from a loaded received delegation; stale tabs are out of scope.                      | —                       |
| `operationRestrictedToDelegate` | `010-0010` | 403    | `assertIsDelegate` finds that the authenticated organization is not the delegation delegate. | Cannot happen — the FE received-delegation list is scoped to the current organization and the approve action is shown for that row. | —                       |
| `incorrectState`                | `010-0011` | 409    | `assertIsState` requires `WAITING_FOR_APPROVAL`, but the delegation is in another state.     | Cannot happen — the FE exposes approval only for a waiting received delegation; stale or concurrent submissions are out of scope.   | —                       |

## 8. `POST /producer/delegations/:delegationId/reject`

Service: `rejectProducerDelegation` → `rejectDelegation`, `retrieveDelegationById`, `assertIsDelegate`, `assertIsState`. Mapper: `rejectDelegationErrorMapper` (alias of `approveDelegationErrorMapper`).

### BFF endpoints

- `POST /producers/delegations/:delegationId/reject`

| Error                           | Code       | Status | When it happens                                                                              | Reachable from the FE?                                                                                                             | Steps to reproduce (UI) |
| ------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `delegationNotFound`            | `010-0001` | 404    | No producer delegation exists for the requested id.                                          | Cannot happen — the reject action is rendered from a loaded received delegation; stale tabs are out of scope.                      | —                       |
| `operationRestrictedToDelegate` | `010-0010` | 403    | `assertIsDelegate` finds that the authenticated organization is not the delegation delegate. | Cannot happen — the FE received-delegation list is scoped to the current organization.                                             | —                       |
| `incorrectState`                | `010-0011` | 409    | `assertIsState` requires `WAITING_FOR_APPROVAL`, but the delegation is in another state.     | Cannot happen — the FE exposes rejection only for a waiting received delegation; stale or concurrent submissions are out of scope. | —                       |

> Unmapped `hyperlinkDetectionError` (`10027`, 400 fallback): `validateNoHyperlinksSafe` rejects a rejection reason containing a hyperlink. **CAN HAPPEN** because the FE accepts free text in **Motivazione** without a hyperlink-specific guard. **Data precondition:** tenant B has a waiting producer delegation received from tenant A. 1. Open **Gestione delle deleghe**, choose **Deleghe ricevute**, and open the delegation. 2. Choose **Rifiuta delega**. 3. Enter `https://example.com` in **Motivazione** and click **Rifiuta delega**.

## 9. `DELETE /producer/delegations/:delegationId`

Service: `revokeProducerDelegation` → `revokeDelegation`, `retrieveDelegationById`, `assertIsDelegator`, `assertIsState`. Mapper: `revokeDelegationErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `DELETE /producers/delegations/:delegationId`

| Error                            | Code       | Status | When it happens                                                                                         | Reachable from the FE?                                                                                                                | Steps to reproduce (UI) |
| -------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `delegationNotFound`             | `010-0001` | 404    | No producer delegation exists for the requested id.                                                     | Cannot happen — the revoke dialog is opened from a loaded granted delegation; stale tabs are out of scope.                            | —                       |
| `operationRestrictedToDelegator` | `010-0009` | 403    | `assertIsDelegator` finds that the authenticated organization is not the delegation delegator.          | Cannot happen — the FE granted-delegation list is scoped to the current organization.                                                 | —                       |
| `incorrectState`                 | `010-0011` | 409    | `assertIsState` requires `WAITING_FOR_APPROVAL` or `ACTIVE`, but the delegation is rejected or revoked. | Cannot happen — the FE offers revoke only for an active/waiting granted delegation; stale or concurrent submissions are out of scope. | —                       |

## 10. `POST /consumer/delegations`

Service: `createConsumerDelegation` → `createDelegation`. Mapper: `createConsumerDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /consumers/delegations`

| Error                              | Code       | Status | When it happens                                                                                                                                                   | Reachable from the FE?                                                                                                              | Steps to reproduce (UI) |
| ---------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `eserviceNotFound`                 | `010-0002` | 400    | `retrieveEserviceById` cannot find the selected e-service.                                                                                                        | Cannot happen — the FE sends an e-service selected from the consumer-delegable autocomplete; stale selection is out of scope.       | —                       |
| `tenantNotFound`                   | `010-0004` | 400    | `retrieveTenantById` cannot find either the requester or selected delegate tenant.                                                                                | Cannot happen — ids come from authenticated tenant data or the delegate autocomplete; crafted or stale ids are out of scope.        | —                       |
| `invalidDelegatorAndDelegateIds`   | `010-0005` | 400    | `assertDelegatorIsNotDelegate` receives the same tenant id for delegator and delegate.                                                                            | Cannot happen — the delegate autocomplete supplies a different tenant from the current organization.                                | —                       |
| `eserviceNotConsumerDelegable`     | `010-0014` | 400    | `assertEserviceIsConsumerDelegable` sees `isConsumerDelegable` false.                                                                                             | Cannot happen — the consumer e-service autocomplete is explicitly filtered to e-services whose producers allow consumer delegation. | —                       |
| `delegationNotAllowedForTenant`    | `010-0006` | 403    | `assertDelegatorAndDelegateAllowedForDelegation` finds no active delegation-allowed certified attribute on either tenant, when the feature-flag skip is disabled. | Cannot happen — the delegation availability guard and delegate autocomplete restrict the normal UI flow to eligible tenants.        | —                       |
| `tenantNotAllowedToDelegation`     | `010-0007` | 403    | `assertTenantAllowedToReceiveDelegation` finds no `DELEGATED_CONSUMER` feature on the selected delegate.                                                          | Cannot happen — the consumer delegate autocomplete states that it lists only adherents available to become consumer delegates.      | —                       |
| `delegationAlreadyExists`          | `010-0003` | 409    | `assertDelegationNotExists` finds an active or waiting consumer delegation for the same delegator, e-service, and kind.                                           | Cannot happen — the FE queries existing consumer delegations and disables **Inoltra delega** while `isDelegated` is true.           | —                       |
| `delegationRelatedAgreementExists` | `010-0015` | 409    | `assertNoDelegationRelatedAgreementExists` finds an active or suspended agreement for the consumer and e-service.                                                 | Cannot happen — the FE queries active and suspended agreements and disables **Inoltra delega** while one exists.                    | —                       |

## 11. `POST /consumer/delegations/:delegationId/approve`

Service: `approveConsumerDelegation` → `approveDelegation`, `retrieveDelegationById`, `assertIsDelegate`, `assertIsState`. Mapper: `approveDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /consumers/delegations/:delegationId/approve`

| Error                           | Code       | Status | When it happens                                                                              | Reachable from the FE?                                                                                                            | Steps to reproduce (UI) |
| ------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `delegationNotFound`            | `010-0001` | 404    | No consumer delegation exists for the requested id.                                          | Cannot happen — the approve action is rendered from a loaded received delegation; stale tabs are out of scope.                    | —                       |
| `operationRestrictedToDelegate` | `010-0010` | 403    | `assertIsDelegate` finds that the authenticated organization is not the delegation delegate. | Cannot happen — the received-delegation list is scoped to the current organization.                                               | —                       |
| `incorrectState`                | `010-0011` | 409    | `assertIsState` requires `WAITING_FOR_APPROVAL`, but the delegation is in another state.     | Cannot happen — the FE exposes approval only for a waiting received delegation; stale or concurrent submissions are out of scope. | —                       |

## 12. `POST /consumer/delegations/:delegationId/reject`

Service: `rejectConsumerDelegation` → `rejectDelegation`, `retrieveDelegationById`, `assertIsDelegate`, `assertIsState`. Mapper: `rejectDelegationErrorMapper` (alias of `approveDelegationErrorMapper`).

### BFF endpoints

- `POST /consumers/delegations/:delegationId/reject`

| Error                           | Code       | Status | When it happens                                                                              | Reachable from the FE?                                                                                                             | Steps to reproduce (UI) |
| ------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `delegationNotFound`            | `010-0001` | 404    | No consumer delegation exists for the requested id.                                          | Cannot happen — the reject action is rendered from a loaded received delegation; stale tabs are out of scope.                      | —                       |
| `operationRestrictedToDelegate` | `010-0010` | 403    | `assertIsDelegate` finds that the authenticated organization is not the delegation delegate. | Cannot happen — the received-delegation list is scoped to the current organization.                                                | —                       |
| `incorrectState`                | `010-0011` | 409    | `assertIsState` requires `WAITING_FOR_APPROVAL`, but the delegation is in another state.     | Cannot happen — the FE exposes rejection only for a waiting received delegation; stale or concurrent submissions are out of scope. | —                       |

> Unmapped `hyperlinkDetectionError` (`10027`, 400 fallback): `validateNoHyperlinksSafe` rejects a rejection reason containing a hyperlink. **CAN HAPPEN** because the FE accepts free text in **Motivazione** without a hyperlink-specific guard. **Data precondition:** tenant B has a waiting consumer delegation received from tenant A. 1. Open **Gestione delle deleghe**, choose **Deleghe ricevute**, and open the delegation. 2. Choose **Rifiuta delega**. 3. Enter `https://example.com` in **Motivazione** and click **Rifiuta delega**.

## 13. `DELETE /consumer/delegations/:delegationId`

Service: `revokeConsumerDelegation` → `revokeDelegation`, `retrieveDelegationById`, `assertIsDelegator`, `assertIsState`. Mapper: `revokeDelegationErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `DELETE /consumers/delegations/:delegationId`

| Error                            | Code       | Status | When it happens                                                                                         | Reachable from the FE?                                                                                                                | Steps to reproduce (UI) |
| -------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `delegationNotFound`             | `010-0001` | 404    | No consumer delegation exists for the requested id.                                                     | Cannot happen — the revoke dialog is opened from a loaded granted delegation; stale tabs are out of scope.                            | —                       |
| `operationRestrictedToDelegator` | `010-0009` | 403    | `assertIsDelegator` finds that the authenticated organization is not the delegation delegator.          | Cannot happen — the granted-delegation list is scoped to the current organization.                                                    | —                       |
| `incorrectState`                 | `010-0011` | 409    | `assertIsState` requires `WAITING_FOR_APPROVAL` or `ACTIVE`, but the delegation is rejected or revoked. | Cannot happen — the FE offers revoke only for an active/waiting granted delegation; stale or concurrent submissions are out of scope. | —                       |

## 14. `GET /consumer/delegators`

Service: `getConsumerDelegators`. Mapper: `getConsumerDelegatorsErrorMapper` (alias of `getDelegationsErrorMapper`). Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /consumers/delegations/delegators`

No mapped non-500 errors. The read-model query has no known service-specific throw site.

## 15. `GET /consumer/delegatorsWithAgreements`

Service: `getConsumerDelegatorsWithAgreements`. Mapper: `getConsumerDelegatorsWithAgreementsErrorMapper` (alias of `getDelegationsErrorMapper`). Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /consumers/delegations/delegatorsWithAgreements`

No mapped non-500 errors. The read-model query has no known service-specific throw site.

## 16. `GET /consumer/eservices`

Service: `getConsumerEservices`. Mapper: `getConsumerEservicesErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /consumers/delegations/eservices`

No mapped non-500 errors. The read-model query has no known service-specific throw site.
