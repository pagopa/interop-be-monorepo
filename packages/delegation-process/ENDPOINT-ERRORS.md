## 1. `GET /delegations`

Service: `getDelegations` → `getDelegations`. Mapper: `getDelegationsErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SUPPORT_ROLE`, `REVIEWER_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /delegations`

| Error | Code | Status | When it happens                                                                                                   | Reachable from the FE?                                                                                                                | Steps to reproduce (UI) |
| ----- | ---- | ------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| —     | —    | —      | No explicit non-500 mapper arm is defined; any unmapped service-specific error falls back to the common 500 path. | Cannot happen — this listing endpoint has no user-driven write path and the mapper does not declare a concrete process-level mapping. | —                       |

## 2. `GET /delegations/:delegationId`

Service: `getDelegationById` → `getDelegationById`. Mapper: `getDelegationByIdErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /delegations/:delegationId`

| Error                | Code       | Status | When it happens                                                                           | Reachable from the FE?                                                                                                                                | Steps to reproduce (UI)                                                                                                                                                                                                                                                                     |
| -------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `delegationNotFound` | `010-0001` | 404    | `retrieveDelegationById` cannot find the requested delegation record for the provided id. | CANNOT HAPPEN — the UI selects an existing delegation from the list and then opens its details, so a stale or deleted record can still be requested. | — |

## 3. `GET /delegations/:delegationId/contracts/:contractId`

Service: `getDelegationContract` → `getDelegationContract`. Mapper: `getDelegationContractErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /delegations/:delegationId/contracts/:contractId`

| Error                        | Code       | Status | When it happens                                                                            | Reachable from the FE?                                                                                                 | Steps to reproduce (UI) |
| ---------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `delegationNotFound`         | `010-0001` | 404    | The delegation id in the route is not found in the read model.                             | Cannot happen — the UI opens the contract from an already loaded delegation row, so the id is current.                 | —                       |
| `delegationContractNotFound` | `010-0013` | 404    | The delegation exists, but the contract metadata for the requested contract id is missing. | Cannot happen — the contract id comes from the delegation payload the UI fetched earlier.                              | —                       |
| `operationForbidden`         | `9989`     | 403    | The requester is not allowed to see the contract for the delegation.                       | Cannot happen — the BFF route is gated by the authenticated tenant and only exposes already-authorized contract links. | —                       |

## 4. `POST /internal/delegations/:delegationId/contract`

Service: `internalAddDelegationContract` → `internalAddDelegationContract`. Mapper: `generateDelegationContractErrorMapper`. Roles: `INTERNAL_ROLE`.

### BFF endpoints

- `None`

| Error                | Code       | Status | When it happens                                                                     | Reachable from the FE?                                          | Steps to reproduce (UI) |
| -------------------- | ---------- | ------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------- |
| `delegationNotFound` | `010-0001` | 404    | The internal service is asked to add metadata for a delegation that does not exist. | Cannot happen — no normal UI flow calls this internal endpoint. | —                       |

## 5. `POST /internal/delegations/:delegationId/signedContract`

Service: `internalAddDelegationSignedContract` → `internalAddDelegationSignedContract`. Mapper: `generateDelegationSignedContractErrorMapper`. Roles: `INTERNAL_ROLE`.

### BFF endpoints

- `None`

| Error                | Code       | Status | When it happens                                                                | Reachable from the FE?                                          | Steps to reproduce (UI) |
| -------------------- | ---------- | ------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------- | ----------------------- |
| `delegationNotFound` | `010-0001` | 404    | The delegation referenced by the internal signed-contract flow does not exist. | Cannot happen — no normal UI flow calls this internal endpoint. | —                       |
| `incorrectState`     | `010-0011` | 409    | The delegation is not in a state that can accept a signed contract.            | Cannot happen — no normal UI flow calls this internal endpoint. | —                       |

## 6. `POST /producer/delegations`

Service: `createProducerDelegation` → `createDelegation`. Mapper: `createProducerDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /producers/delegations`

| Error                            | Code       | Status | When it happens                                                                                                | Reachable from the FE?                                                                                                 | Steps to reproduce (UI)                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eserviceNotFound`               | `010-0002` | 400    | The delegated e-service id is unknown.                                                                         | Cannot happen — the form is built from an existing selected e-service and the BFF resolves it before the process call. | —                                                                                                                                                                                                                                                                                                                   |
| `tenantNotFound`                 | `010-0004` | 400    | The chosen delegate tenant does not exist.                                                                     | Cannot happen — the UI only allows valid tenants from a valid organization selection.                                  | —                                                                                                                                                                                                                                                                                                                   |
| `invalidDelegatorAndDelegateIds` | `010-0005` | 400    | The delegator and delegate tenant ids are the same, which is invalid for delegation creation.                  | Cannot happen — the UI disallows selecting the same tenant.                                                            | —                                                                                                                                                                                                                                                                                                                   |
| `eserviceAlreadyArchived`        | `010-0016` | 400    | The selected e-service is already archived and cannot be delegated.                                            | Cannot happen — the UI only exposes active e-services for delegation creation.                                         | —                                                                                                                                                                                                                                                                                                                   |
| `delegationNotAllowedForTenant`  | `010-0006` | 403    | The tenant cannot participate in delegation as delegator or delegate.                                          | Cannot happen — tenant eligibility is validated by route and form flow before request submission.                      | —                                                                                                                                                                                                                                                                                                                   |
| `tenantNotAllowedToDelegation`   | `010-0007` | 403    | The delegate tenant is not allowed to receive this kind of delegation.                                         | Cannot happen — the UI restricts tenant compatibility before the call is sent.                                         | —                                                                                                                                                                                                                                                                                                                   |
| `differentEserviceProducer`      | `010-0012` | 403    | The delegate is trying to create a delegation for an e-service whose producer is different from the delegator. | Cannot happen — the form only offers valid producer/delegator combinations.                                            | —                                                                                                                                                                                                                                                                                                                   |
| `delegationAlreadyExists`        | `010-0003` | 409    | A delegation of the same kind for the same delegator and e-service already exists.                             | CANNOT HAPPEN — the creation action can be retried after a previous pending or active delegation already exists.      | — |

## 7. `POST /producer/delegations/:delegationId/approve`

Service: `approveDelegation` → `approveDelegation`. Mapper: `approveDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /producers/delegations/:delegationId/approve`

| Error                           | Code       | Status | When it happens                                                                 | Reachable from the FE?                                                                                   | Steps to reproduce (UI)                                                                                                                                                                                                                               |
| ------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `delegationNotFound`            | `010-0001` | 404    | The approval flow targets a delegation id that is no longer present.            | Cannot happen — the action is started from a loaded delegation row.                                      | —                                                                                                                                                                                                                                                     |
| `operationRestrictedToDelegate` | `010-0010` | 403    | The authenticated tenant is not the delegate for the delegation.                | Cannot happen — the UI only allows the delegate to approve the request.                                  | —                                                                                                                                                                                                                                                     |
| `incorrectState`                | `010-0011` | 409    | The delegation is not in `waitingForApproval` state when approval is requested. | **CAN HAPPEN** — a stale page may show an approval action for a delegation already approved or rejected. | **Data precondition:** delegation D has already changed state before the approve action is triggered.<br>1. Open the pending delegation detail page in a stale tab.<br>2. Click Approve on the already-processed delegation.<br>3. Submit the action. |

## 8. `POST /producer/delegations/:delegationId/reject`

Service: `rejectDelegation` → `rejectDelegation`. Mapper: `rejectDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /producers/delegations/:delegationId/reject`

| Error                           | Code       | Status | When it happens                                                    | Reachable from the FE?                                                                        | Steps to reproduce (UI)                                                                                                                                                                    |
| ------------------------------- | ---------- | ------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `delegationNotFound`            | `010-0001` | 404    | The rejection targets a missing delegation id.                     | Cannot happen — the UI binds the action to a loaded row.                                      | —                                                                                                                                                                                          |
| `operationRestrictedToDelegate` | `010-0010` | 403    | The current tenant is not the delegate for the pending delegation. | Cannot happen — the action is only rendered for the delegate.                                 | —                                                                                                                                                                                          |
| `incorrectState`                | `010-0011` | 409    | A delegation not in `waitingForApproval` is rejected.              | **CAN HAPPEN** — stale state can cause a duplicate action on an already processed delegation. | **Data precondition:** delegation D was already resolved before the reject action is submitted.<br>1. Open the old delegation detail page.<br>2. Click Reject.<br>3. Submit the rejection. |

## 9. `DELETE /producer/delegations/:delegationId`

Service: `revokeDelegation` → `revokeDelegation`. Mapper: `revokeDelegationErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `DELETE /producers/delegations/:delegationId`

| Error                            | Code       | Status | When it happens                                                | Reachable from the FE?                                                                                   | Steps to reproduce (UI)                                                                                                                                                              |
| -------------------------------- | ---------- | ------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `delegationNotFound`             | `010-0001` | 404    | The delegation is already removed when revoke is attempted.    | Cannot happen — only an existing row can trigger the revoke action.                                      | —                                                                                                                                                                                    |
| `operationRestrictedToDelegator` | `010-0009` | 403    | The requesting tenant is not the delegator for the delegation. | Cannot happen — the UI only renders revoke for the current delegator.                                    | —                                                                                                                                                                                    |
| `incorrectState`                 | `010-0011` | 409    | The delegation state is incompatible with revocation.          | **CAN HAPPEN** — the action can be fired on a stale page shortly after the delegation state transitions. | **Data precondition:** delegation D has already moved to a non-revocable state.<br>1. Open the delegation detail page from a stale tab.<br>2. Click Revoke.<br>3. Submit the action. |

## 10. `POST /consumer/delegations`

Service: `createConsumerDelegation` → `createDelegation`. Mapper: `createConsumerDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /consumers/delegations`

| Error                              | Code       | Status | When it happens                                                  | Reachable from the FE?                                                                                                 | Steps to reproduce (UI)                                                                                                                                                                                                               |
| ---------------------------------- | ---------- | ------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eserviceNotFound`                 | `010-0002` | 400    | The delegated e-service id is not valid.                         | Cannot happen — the selection list contains only valid e-services.                                                     | —                                                                                                                                                                                                                                     |
| `tenantNotFound`                   | `010-0004` | 400    | The delegate tenant does not exist.                              | Cannot happen — tenant choice is provided by existing organization data.                                               | —                                                                                                                                                                                                                                     |
| `invalidDelegatorAndDelegateIds`   | `010-0005` | 400    | The delegator and delegate are the same tenant.                  | Cannot happen — the UI prevents self-delegation.                                                                       | —                                                                                                                                                                                                                                     |
| `eserviceNotConsumerDelegable`     | `010-0014` | 400    | The targeted e-service is not consumer-delegable.                | Cannot happen — the action is hidden unless the e-service is delegable.                                                | —                                                                                                                                                                                                                                     |
| `delegationNotAllowedForTenant`    | `010-0006` | 403    | The tenant is not eligible to be either delegator or delegate.   | Cannot happen — the form only lists compatible tenants.                                                                | —                                                                                                                                                                                                                                     |
| `tenantNotAllowedToDelegation`     | `010-0007` | 403    | The delegate tenant cannot receive this delegation kind.         | Cannot happen — eligible delegate options are filtered before the call.                                                | —                                                                                                                                                                                                                                     |
| `delegationAlreadyExists`          | `010-0003` | 409    | A duplicate consumer delegation already exists.                  | CANNOT HAPPEN — the user can submit the same delegation twice.                                                        | — |
| `delegationRelatedAgreementExists` | `010-0015` | 409    | The consumer already has an active agreement for that e-service. | CANNOT HAPPEN — the frontend can still trigger the action when a related agreement exists and the backend rejects it. | — |

## 11. `POST /consumer/delegations/:delegationId/approve`

Service: `approveDelegation` → `approveDelegation`. Mapper: `approveDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /consumers/delegations/:delegationId/approve`

| Error                           | Code       | Status | When it happens                                    | Reachable from the FE?                                                        | Steps to reproduce (UI)                                                                                                                                                                  |
| ------------------------------- | ---------- | ------ | -------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `delegationNotFound`            | `010-0001` | 404    | The delegated request no longer exists.            | Cannot happen — action originates from a selected pending delegation.         | —                                                                                                                                                                                        |
| `operationRestrictedToDelegate` | `010-0010` | 403    | The current tenant is not the delegate.            | Cannot happen — the UI only enables approval for the delegate.                | —                                                                                                                                                                                        |
| `incorrectState`                | `010-0011` | 409    | Approval is attempted on a non-waiting delegation. | **CAN HAPPEN** — stale UI can submit approval after a prior state transition. | **Data precondition:** the delegation already changed state before the user submits approval.<br>1. Open the stale delegation detail page.<br>2. Click Approve.<br>3. Submit the action. |

## 12. `POST /consumer/delegations/:delegationId/reject`

Service: `rejectDelegation` → `rejectDelegation`. Mapper: `rejectDelegationErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /consumers/delegations/:delegationId/reject`

| Error                           | Code       | Status | When it happens                                               | Reachable from the FE?                                                                 | Steps to reproduce (UI)                                                                                                                         |
| ------------------------------- | ---------- | ------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `delegationNotFound`            | `010-0001` | 404    | The targeted delegation no longer exists.                     | Cannot happen — the UI initiates from a selected delegation record.                    | —                                                                                                                                               |
| `operationRestrictedToDelegate` | `010-0010` | 403    | The request is not coming from the delegate.                  | Cannot happen — the UI only exposes reject to the delegate.                            | —                                                                                                                                               |
| `incorrectState`                | `010-0011` | 409    | Reject is attempted on a delegation not waiting for approval. | **CAN HAPPEN** — stale state can trigger a second request after approval or rejection. | **Data precondition:** the delegation has already been resolved.<br>1. Open the stale detail page.<br>2. Click Reject.<br>3. Submit the action. |

## 13. `DELETE /consumer/delegations/:delegationId`

Service: `revokeDelegation` → `revokeDelegation`. Mapper: `revokeDelegationErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `DELETE /consumers/delegations/:delegationId`

| Error                            | Code       | Status | When it happens                                                     | Reachable from the FE?                                                                                 | Steps to reproduce (UI)                                                                                                                                              |
| -------------------------------- | ---------- | ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `delegationNotFound`             | `010-0001` | 404    | The delegation has been removed before revoke.                      | Cannot happen — only existing records can trigger this action.                                         | —                                                                                                                                                                    |
| `operationRestrictedToDelegator` | `010-0009` | 403    | The current user is not the delegator.                              | Cannot happen — the revoke action is limited to the delegator.                                         | —                                                                                                                                                                    |
| `incorrectState`                 | `010-0011` | 409    | Revoke is called on a delegation in a state that cannot be revoked. | **CAN HAPPEN** — stale UI can submit the action after the delegation moved out of the revocable state. | **Data precondition:** the delegation already changed state before the revoke submission.<br>1. Open the stale delegation details.<br>2. Click Revoke.<br>3. Submit. |

## 14. `GET /consumer/delegators`

Service: `getConsumerDelegators` → `getConsumerDelegators`. Mapper: `getConsumerDelegatorsErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /consumers/delegations/delegators`

| Error | Code | Status | When it happens                                                                                                                              | Reachable from the FE?                                                       | Steps to reproduce (UI) |
| ----- | ---- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| —     | —    | —      | No explicit non-500 mapper arms are defined for this read endpoint; unmapped service-specific errors would fall back to the common 500 path. | Cannot happen — the endpoint is a list query without a user-driven mutation. | —                       |

## 15. `GET /consumer/delegatorsWithAgreements`

Service: `getConsumerDelegatorsWithAgreements` → `getConsumerDelegatorsWithAgreements`. Mapper: `getConsumerDelegatorsWithAgreementsErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /consumers/delegations/delegatorsWithAgreements`

| Error | Code | Status | When it happens                                                                                                             | Reachable from the FE?                                                     | Steps to reproduce (UI) |
| ----- | ---- | ------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------- |
| —     | —    | —      | No explicit non-500 mapper arms are defined for this read endpoint; any unhandled service-specific issue falls back to 500. | Cannot happen — it is a read-only listing endpoint without a write action. | —                       |

## 16. `GET /consumer/eservices`

Service: `getConsumerEservices` → `getConsumerEservices`. Mapper: `getConsumerEservicesErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /consumers/delegations/eservices`

| Error | Code | Status | When it happens                                                                                                                            | Reachable from the FE?                                                                          | Steps to reproduce (UI) |
| ----- | ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------- |
| —     | —    | —      | No explicit non-500 mapper arms are defined for this read endpoint; unmapped service-specific errors fall back to the common 500 behavior. | Cannot happen — this is a read-only list operation used only in the UI after a valid selection. | —                       |
