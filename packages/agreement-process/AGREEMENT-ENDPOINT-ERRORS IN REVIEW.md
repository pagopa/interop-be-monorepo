# Agreement Process: error map

## 1. `POST /agreements/:agreementId/submit`

Service: `agreementService` → `submitAgreement`. Mapper: `submitAgreementErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /agreements/:agreementId/submit`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `notLatestEServiceDescriptor` | 400 | `validateSubmitOnDescriptor` rejects the selected descriptor when it is not the latest active descriptor for the e-service (`validateLatestDescriptor`). | **CAN HAPPEN** — the FE allows submission from a draft tied to a descriptor that may already have been superseded by a newer published version. | **Data precondition:** tenant A is the consumer, there is an agreement draft for e-service E and the producer has published a newer version of E after the draft was created.<br>1. Go to the agreement draft page for A.<br>2. Confirm the draft is still shown against the old descriptor version.<br>3. Click _Inoltra richiesta_. | 🟡 Medium resolution <br />1. Refresh the draft detail and re-open the agreement from the newest descriptor version.<br />2. Re-create or update the agreement draft against the currently published descriptor.<br />3. Retry the submission only after the descriptor is current. |
| `agreementNotInExpectedState` | 400 | `assertSubmittableState` rejects any submission unless the agreement is still in `DRAFT` state. | **CAN HAPPEN (UNVERIFIED)** — the page can remain open after the agreement state changes elsewhere, so submitting from stale UI state is possible. | **Data precondition:** tenant A has an agreement draft D that was already moved out of `DRAFT` by a different action or another tab.<br>1. Go to the draft edit page for D.<br>2. Keep the stale page open.<br>3. Click _Inoltra richiesta_. | 🟢 Easy resolution <br />1. Refresh the agreement page.<br />2. Confirm the agreement is still in `DRAFT`.<br />3. Retry the submission only in the valid state. |
| `consumerWithNotValidEmail` | 400 | `validateConsumerEmail` throws when the consumer tenant has no contact email (`tenantMailKind.ContactEmail`). | **CAN HAPPEN** — the UI checks whether a contact email is available before enabling the button, but a stale page or a state change can still attempt the call. | **Data precondition:** tenant A is the consumer and the tenant profile has no valid contact email configured.<br>1. Go to the agreement draft page for A.<br>2. Verify the UI still presents the submit action from the stale draft state.<br>3. Click _Inoltra richiesta_. | 🟡 Medium resolution <br />1. Add a valid contact email to the consumer tenant profile.<br />2. Refresh the page so the submission button reflects the new profile state.<br />3. Retry the submission. |
| `agreementSubmissionFailed` | 400 | `validateActiveSuspendedOrPendingAgreement` throws when the calculated post-submission state is not `ACTIVE`, `PENDING` or `SUSPENDED`; it also covers failed activation conditions. | **CAN HAPPEN** — the UI submits the draft only when the page says it is ready, but the server may still reject the submission when attribute or suspension checks fail. | **Data precondition:** tenant A has a draft for E whose attribute or suspension state makes a valid activation impossible.<br>1. Go to the agreement draft page.<br>2. Confirm the draft is still eligible to submit from the UI.<br>3. Click _Inoltra richiesta_. | 🟡 Medium resolution <br />1. Verify the consumer attributes and current suspension state for the agreement.<br />2. Resolve the blocking attribute or suspension condition.<br />3. Retry the submission after refreshing the page. |
| `missingCertifiedAttributesError` | 400 | `validateCertifiedAttributes` rejects the consumer when required certified attributes are missing for the descriptor. | **CAN HAPPEN** — the FE disables the submit button when required attributes are missing, but the condition can still be hit from stale UI or changed profile state. | **Data precondition:** tenant A is the consumer and loses one required certified attribute after the page loads.<br>1. Open the agreement draft page for A.<br>2. Confirm the page is stale and still shows a valid state.<br>3. Click _Inoltra richiesta_. | 🟡 Medium resolution <br />1. Refresh the page to reload the current tenant attributes.<br />2. Add the required certified attribute to the consumer profile.<br />3. Retry the submission only after the attribute requirement is satisfied. |
| `descriptorNotInExpectedState` | 400 | `validateLatestDescriptor` rejects the descriptor when the selected version is not in an allowed state for submission. | **CAN HAPPEN** — the UI normally prevents invalid descriptor states, but a stale draft or a descriptor transition can still make the action reach the backend. | **Data precondition:** tenant A has a draft tied to a descriptor that is no longer `PUBLISHED` or was moved to another state.<br>1. Open the agreement draft page.<br>2. Leave the page stale after the descriptor changed state.<br>3. Click _Inoltra richiesta_. | 🟡 Medium resolution <br />1. Refresh the agreement page.<br />2. Re-open the draft against the currently published descriptor version.<br />3. Retry only when the descriptor state is valid. |
| `agreementNotFound` | 404 | `retrieveAgreement` throws when the agreement id is not found in the read model. | Cannot happen — the FE only calls this action from an already loaded agreement record and the route is built from that id. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the request when the authenticated tenant is not the consumer of the agreement. | Cannot happen — the submit action is shown only on the consumer-side draft page, and the request is sent for the agreement currently being edited. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the request when the caller is not the active consumer delegate for the agreement. | Cannot happen — the consumer delegation flow only exposes this action to the delegate actually attached to the agreement and the UI is scoped to that relationship. | — | — |
| `agreementAlreadyExists` | 409 | `verifyConflictingAgreements` throws when the consumer already has an active or pending agreement for the same e-service. | **CAN HAPPEN (UNVERIFIED)** — the FE does not block a stale submit action if an equivalent agreement already exists elsewhere or the page was opened before the conflict was created. | **Data precondition:** tenant A already has an active or pending agreement for e-service E; the draft page was left open and remains usable.<br>1. Open the stale agreement draft page for A.<br>2. Click _Inoltra richiesta_. | 🟢 Easy resolution <br />1. Refresh the agreement list and verify the conflicting agreement state.<br />2. Reuse or resolve the existing agreement before submitting the draft.<br />3. Retry the action only after the conflict is cleared. |
| `contractAlreadyExists` | 409 | The contract creation path detects an already existing contract for the same agreement. | Cannot happen — the FE never creates a duplicate contract on an initial draft submission; it only submits the draft and lets the activation flow create the required contract once. | — | — |

## 2. `POST /agreements/:agreementId/approve`

Service: `agreementService` → `approveAgreement`. Mapper: `approveAgreementErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /agreements/:agreementId/approve`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `notLatestEServiceDescriptor` | 400 | `validateActivationOnDescriptor` calls `validateLatestDescriptor`, which throws when the selected descriptor is not the newest active descriptor. | **CAN HAPPEN** — the approval action can be triggered while a newer descriptor version is already published in another tab or after a stale page load. | **Data precondition:** tenant A has an agreement pending on descriptor D, while a newer descriptor version for the same e-service is already published.<br>1. Open the agreement page for D.<br>2. Leave it stale after the newer version was published.<br>3. Click _Attiva_. | 🟡 Medium resolution <br />1. Refresh the agreement page.<br />2. Check whether a newer descriptor version is available.<br />3. Re-open the agreement against the current version and retry. |
| `agreementNotInExpectedState` | 400 | `assertActivableState` rejects the action when the agreement is not in `PENDING` or `SUSPENDED`, and `assertAgreementIsPending` or `assertAgreementIsSuspended` also guard the flow. | **CAN HAPPEN** — the action can remain visible on a stale record after the agreement state changes elsewhere. | **Data precondition:** tenant A has an agreement whose state changed from `PENDING` to a non-activable state after the page was loaded.<br>1. Open the agreement detail page.<br>2. Click the activation action on stale data.<br>3. Submit the confirmation. | 🟢 Easy resolution <br />1. Refresh the page and re-check the agreement state.<br />2. Retry the activation only if the agreement is still `PENDING` or `SUSPENDED`.<br />3. If not, the agreement must be handled in its current state. |
| `agreementActivationFailed` | 400 | `failOnActivationFailure` throws when the computed next state is not a valid final state for activation. | **CAN HAPPEN** — the FE does not prevent a stale activation attempt if the agreement no longer satisfies the required attribute or suspension conditions. | **Data precondition:** tenant A has a pending agreement that no longer satisfies the attribute requirements for activation.<br>1. Open the agreement details page.<br>2. Click _Attiva_.<br>3. Confirm the activation request. | 🟡 Medium resolution <br />1. Refresh the agreement and check the required certified/declared attributes.<br />2. Resolve the missing attribute or suspension condition.<br />3. Retry activation only after the agreement is valid again. |
| `descriptorNotInExpectedState` | 400 | `validateActivationOnDescriptor` throws when the descriptor is not in one of the allowed activation states (`PUBLISHED`, `SUSPENDED`, `DEPRECATED`). | **CAN HAPPEN** — the FE does not guard against a stale descriptor state when the agreement is still shown in the UI. | **Data precondition:** the descriptor for agreement D has changed to an invalid state for activation.<br>1. Open the agreement page while it still shows the old state.<br>2. Click _Attiva_. | 🟡 Medium resolution <br />1. Refresh the agreement page.<br />2. Check whether the e-service descriptor is still active.<br />3. Retry only after the descriptor is in an activable state. |
| `agreementNotFound` | 404 | `retrieveAgreement` throws when the agreement does not exist. | Cannot happen — the action is only exposed from a loaded agreement row or detail page. | — | — |
| `tenantIsNotTheDelegateProducer` | 403 | `assertRequesterCanActAsProducer` / `assertRequesterIsDelegateProducer` rejects the request when the caller is not the active producer delegate. | Cannot happen — the approve action is only shown to the producer or delegated producer for the specific e-service relationship. | — | — |
| `tenantIsNotTheProducer` | 403 | `assertRequesterCanActAsProducer` rejects the request when the authenticated organization is not the producer. | Cannot happen — the producer-side action is hidden for non-producer organizations and the route is scoped to the agreement's producer. | — | — |
| `tenantNotAllowed` | 403 | `getOrganizationRole` falls through to `tenantNotAllowed` when the caller is neither producer nor consumer for the agreement. | Cannot happen — the UI only renders the activation action to the valid organization role on the agreement. | — | — |
| `tenantIsNotTheDelegate` | 403 | `getOrganizationRole` throws when a delegation id is supplied but does not match the active producer or consumer delegation for this agreement. | Cannot happen — the UI passes only the active delegation id selected for the current relationship. | — | — |
| `agreementAlreadyExists` | 409 | `createActivationEvent` or conflict checks detect an already active agreement for the same consumer and e-service during activation. | **CAN HAPPEN (UNVERIFIED)** — the stale approval action can still be triggered while another active or conflicting agreement already exists. | **Data precondition:** tenant A already has a conflicting active agreement for the same e-service; the stale activation page remains visible.<br>1. Open the stale agreement approval page.<br>2. Click _Attiva_. | 🟢 Easy resolution <br />1. Refresh the agreement list and verify current conflicts.<br />2. Resolve the existing agreement before retrying activation.<br />3. Retry only when the conflict is cleared. |

## 3. `POST /agreements/:agreementId/unsuspend`

Service: `agreementService` → `unsuspendAgreement`. Mapper: `unsuspendAgreementErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /agreements/:agreementId/unsuspend`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `notLatestEServiceDescriptor` | 400 | `validateActivationOnDescriptor` rejects the descriptor if it is not the latest active version. | **CAN HAPPEN** — the unsuspend action can be triggered from stale UI after a newer descriptor version has been published for the same e-service. | **Data precondition:** tenant A has a suspended agreement on descriptor D while a newer descriptor version for the same e-service is already active.<br>1. Open the agreement details page for D.<br>2. Leave the page stale after the new version is published.<br>3. Click _Attiva_. | 🟡 Medium resolution <br />1. Refresh the page and verify the current descriptor version.<br />2. Re-create or update the agreement against the current descriptor version.<br />3. Retry the unsuspend only after the descriptor is current. |
| `agreementNotInExpectedState` | 400 | `assertAgreementIsSuspended` and `assertActivableState` reject the call unless the agreement is currently `SUSPENDED` and activable. | **CAN HAPPEN** — the action may stay visible on stale state after another actor updates the agreement. | **Data precondition:** tenant A has a suspended agreement D that has already changed state after the page was loaded.<br>1. Open the agreement details page for D.<br>2. Click the activation action from the stale UI state.<br>3. Confirm the action. | 🟢 Easy resolution <br />1. Refresh the page and re-check the current state.<br />2. Retry only if the agreement is still `SUSPENDED`.<br />3. If not, continue from the current agreement state. |
| `agreementActivationFailed` | 400 | `failOnActivationFailure` throws when the next state does not allow activation after unsuspension. | **CAN HAPPEN** — a stale request can still reach the backend if the conditions for activation changed after the page was loaded. | **Data precondition:** tenant A has a suspended agreement whose attribute requirements were changed or suspended conditions were updated after the page was loaded.<br>1. Open the agreement details page.<br>2. Click _Attiva_.<br>3. Submit the action. | 🟡 Medium resolution <br />1. Refresh the agreement data.<br />2. Resolve the missing attribute or suspension issue.<br />3. Retry after the agreement is back in a valid activation state. |
| `descriptorNotInExpectedState` | 400 | `validateActivationOnDescriptor` rejects the e-service descriptor when it is not in a valid activation state. | **CAN HAPPEN** — the UI can still send the call if the descriptor has changed after the page was opened. | **Data precondition:** the descriptor for agreement D no longer matches an activable state after the page was loaded.<br>1. Open the agreement details page.<br>2. Click _Attiva_.<br>3. Submit the unsuspend request. | 🟡 Medium resolution <br />1. Refresh the page and confirm the descriptor status.<br />2. Check whether the descriptor is still active or suspended.<br />3. Retry only after the descriptor state is valid. |
| `agreementNotFound` | 404 | `retrieveAgreement` throws when the agreement id no longer exists. | Cannot happen — the action is only started from a currently displayed agreement. | — | — |
| `tenantIsNotTheDelegateProducer` | 403 | `assertRequesterCanActAsProducer` rejects the caller if they are not the delegate producer for the agreement. | Cannot happen — the unsuspend action is only available to the valid producer-side delegate. | — | — |
| `tenantIsNotTheProducer` | 403 | `assertRequesterCanActAsProducer` rejects the request when the caller is not the producer. | Cannot happen — the producer-side UI hides the action for non-producer organizations. | — | — |
| `tenantNotAllowed` | 403 | `getOrganizationRole` rejects the request when the caller is not authorized for the agreement. | Cannot happen — the page is scoped to the current tenant and only shows activation for valid roles. | — | — |
| `tenantIsNotTheDelegate` | 403 | `getOrganizationRole` rejects delegation ids that do not correspond to the active delegation for the agreement. | Cannot happen — the UI only passes a currently active delegation id for the selected relationship. | — | — |

## 4. `POST /agreements/:agreementId/consumer-documents`

Service: `agreementService` → `addConsumerDocument`. Mapper: `addConsumerDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /agreements/:agreementId/consumer-documents`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `agreementNotFound` | 404 | `retrieveAgreement` throws when the agreement id does not exist in the read model. | Cannot happen — the FE opens this action only from an already loaded agreement and never renders the upload form for a missing agreement. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the caller when the authenticated tenant is not the consumer of the agreement. | Cannot happen — the upload form is only shown on the consumer-side edit page, and the request is sent for the current agreement's consumer. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the caller when they are not the active consumer delegate for the agreement. | Cannot happen — the UI only exposes the same action to the currently active delegated consumer for that agreement. | — | — |
| `tenantNotAllowed` | 403 | Dead mapper entry: `addConsumerDocument` does not throw `tenantNotAllowed`; authorization is enforced only through `assertRequesterCanActAsConsumer`. | Cannot happen — there is no throw site in this flow; the mapper entry is stale. | — | — |
| `documentsChangeNotAllowed` | 403 | `assertCanWorkOnConsumerDocuments` throws when the agreement is not in `DRAFT` state. | **CAN HAPPEN** — the FE can still attempt the call from a stale agreement-edit page after the agreement state has changed elsewhere. | **Data precondition:** tenant A has an agreement D that was already moved out of `DRAFT` while the edit page remained open.<br>1. Open the agreement edit page for D.<br>2. Leave the stale upload form visible.<br>3. Click _Carica_. | 🟢 Easy resolution <br />1. Refresh the agreement page and verify the current state.<br />2. Re-open the draft only if the agreement is still in `DRAFT`.<br />3. Retry the upload only in the valid state. |
| `agreementDocumentAlreadyExists` | 409 | `existentDocument` is checked by document id before creating the new consumer document. | Cannot happen — the BFF generates a fresh random `documentId` for each upload, so a normal UI flow cannot submit the same id twice. | — | — |

## 5. `GET /agreements/:agreementId/consumer-documents`

Service: `agreementService` → `getAgreementConsumerDocuments`. Mapper: `getAgreementConsumerDocumentsErrorMapper`. Roles: `M2M_ADMIN_ROLE`, `M2M_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `agreementNotFound` | 404 | `retrieveAgreement` throws when the agreement id does not exist in the read model. | Cannot happen — the FE retrieves this collection only from an agreement it has already loaded or from a route created from the current record. | — | — |
| `tenantNotAllowed` | 403 | `assertRequesterCanRetrieveAgreement` falls through to `tenantNotAllowed` when the caller is not a consumer, producer, delegate producer or delegate consumer for the agreement. | Cannot happen — the endpoint is only called from the authenticated agreement context and from screens that are role-scoped to the agreement's parties. | — | — |
| `tenantIsNotTheConsumer` | 403 | Dead mapper entry: this flow does not call `assertRequesterIsConsumer` as a direct failure path; it resolves through `assertRequesterCanRetrieveAgreement`. | Cannot happen — no throw site in this flow; dead mapper entry. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | Dead mapper entry: the delegated-consumer check is exercised only through the broader retrieval validator and not as a standalone throw in this endpoint. | Cannot happen — no throw site in this flow; dead mapper entry. | — | — |
| `tenantIsNotTheProducer` | 403 | Dead mapper entry: the producer-side checks are not directly thrown by `getAgreementConsumerDocuments`. | Cannot happen — no throw site in this flow; dead mapper entry. | — | — |
| `tenantIsNotTheDelegateProducer` | 403 | Dead mapper entry: the endpoint does not throw this error directly; the retrieval validity is narrowed through the shared retrieval guard. | Cannot happen — no throw site in this flow; dead mapper entry. | — | — |

## 6. `GET /agreements/:agreementId/consumer-documents/:documentId`

Service: `agreementService` → `getAgreementConsumerDocument`. Mapper: `getConsumerDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`, `M2M_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /agreements/:agreementId/consumer-documents/:documentId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `tenantNotAllowed` | 403 | `assertRequesterCanRetrieveAgreement` throws when the caller is not allowed to access the agreement. | Cannot happen — the FE only calls this document route from an agreement detail screen already scoped to the current tenant's allowed roles. | — | — |
| `documentNotFound` | 404 | `retrieveAgreementDocument` throws when the requested document id does not exist in the agreement's document list. | **CAN HAPPEN** — the client can still request a document after the page was loaded and the doc has been deleted or the link became stale. | **Data precondition:** tenant A opens agreement D and the agreement still shows a document row, but that doc was removed from the agreement in another session or the URL is stale.<br>1. Go to the agreement details page for D.<br>2. Click the document action _Scarica documento_ on the stale row.<br>3. The request reaches the BFF with the old document id. | 🟢 Easy resolution <br />1. Refresh the agreement page and confirm the document is still present.<br />2. Re-open the agreement detail from the current state.<br />3. Retry the download only after the document is available again. |
| `agreementAlreadyExists` | 409 | `createActivationEvent` or conflict logic detects an already existing active agreement for the same consumer and e-service. | **CAN HAPPEN (UNVERIFIED)** — stale UI can still call unsuspend while a conflicting agreement already exists on another tab or from another operation. | **Data precondition:** tenant A already has a conflicting active agreement for e-service E, while the suspended agreement still appears actionable.<br>1. Open the stale agreement details page.<br>2. Click _Attiva_. | 🟢 Easy resolution <br />1. Refresh the page and verify the active agreement list.<br />2. Resolve or remove the conflicting agreement before retrying.<br />3. Retry only once the duplicate conflict is cleared. |

## 7. `DELETE /agreements/:agreementId/consumer-documents/:documentId`

Service: `agreementService` → `removeAgreementConsumerDocument`. Mapper: `removeConsumerDocumentErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /agreements/:agreementId/consumer-documents/:documentId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `documentNotFound` | 404 | `retrieveAgreementDocument` throws when the requested consumer document is no longer present in the agreement. | **CAN HAPPEN** — the FE can still send a delete request for a document row that was removed in another tab or after a refresh race. | **Data precondition:** tenant A is the consumer for agreement D and the page still lists a document row, but that row was deleted in another session.<br>1. Go to the agreement detail page for D.<br>2. Open the stale document row and click the action to delete it.<br>3. Confirm the deletion request. | 🟢 Easy resolution <br />1. Refresh the agreement page.<br />2. Confirm the document still exists before trying again.<br />3. Retry the delete only on a current document row. |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the request when the authenticated organization is not the agreement consumer. | Cannot happen — the delete action is only rendered on the consumer-side agreement page and scoped to the current agreement consumer. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the request when the caller is not the active consumer delegate for the agreement. | Cannot happen — the UI only exposes the action to the currently active consumer delegate for that agreement. | — | — |
| `documentsChangeNotAllowed` | 403 | `assertCanWorkOnConsumerDocuments` throws when the agreement state is not `DRAFT`. | **CAN HAPPEN** — a stale agreement edit page can still show the delete action after the agreement moved out of `DRAFT`. | **Data precondition:** tenant A has agreement D already moved out of `DRAFT`, but the page still shows the document action.<br>1. Open the stale agreement edit page for D.<br>2. Click the delete action for the document.<br>3. Confirm the delete request. | 🟢 Easy resolution <br />1. Refresh the agreement page and verify the current state.<br />2. Re-open the agreement only if it is still in `DRAFT`.<br />3. Retry the action only in a valid edit state. |

## 8. `POST /agreements/:agreementId/suspend`

Service: `agreementService` → `suspendAgreement`. Mapper: `suspendAgreementErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /agreements/:agreementId/suspend`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `agreementNotFound` | 404 | `retrieveAgreement` throws when the agreement id is not found in the read model. | Cannot happen — the FE only invokes the suspend action from a currently loaded agreement record. | — | — |
| `tenantNotAllowed` | 403 | `getOrganizationRole` falls through to `tenantNotAllowed` when the caller is not allowed for the agreement. | Cannot happen — the suspend action is only shown for the valid organization role on the agreement detail page. | — | — |
| `tenantIsNotTheDelegate` | 403 | `getOrganizationRole` rejects a delegation id that does not match the active delegation for the agreement. | Cannot happen — the UI sends only the currently active delegation id for the selected relationship. | — | — |
| `agreementNotInExpectedState` | 400 | `assertExpectedState` rejects the action unless the agreement is in a suspendable state. | **CAN HAPPEN** — a stale agreement page can still trigger suspend after the agreement state changed elsewhere. | **Data precondition:** tenant A has agreement D and it is no longer in a suspendable state, but the page still displays the suspend action.<br>1. Open the agreement detail page for D.<br>2. Leave the page stale after the state changes.<br>3. Click _Sospendi_. | 🟢 Easy resolution <br />1. Refresh the agreement page.<br />2. Confirm the agreement is still in a suspendable state.<br />3. Retry only after the agreement is valid for suspension. |

## 9. `POST /agreements/:agreementId/reject`

Service: `agreementService` → `rejectAgreement`. Mapper: `rejectAgreementErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /agreements/:agreementId/reject`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `agreementNotFound` | 404 | `retrieveAgreement` throws when the agreement id does not exist in the read model. | Cannot happen — the action is only started from a currently loaded agreement record the user is already on. | — | — |
| `agreementNotInExpectedState` | 400 | `assertExpectedState` rejects the action unless the agreement is in a rejectable state. | **CAN HAPPEN** — stale UI can still attempt rejection after the agreement state changes elsewhere. | **Data precondition:** tenant A has agreement D and it is no longer in a rejectable state, but the page still shows the reject action.<br>1. Open the agreement detail page for D.<br>2. Leave the page stale after the state changes.<br>3. Click _Rifiuta_. | 🟢 Easy resolution <br />1. Refresh the agreement page.<br />2. Re-check the current agreement state.<br />3. Retry the rejection only when the agreement is still rejectable. |
| `tenantIsNotTheProducer` | 403 | `assertRequesterCanActAsProducer` rejects the request when the authenticated organization is not the producer of the agreement. | Cannot happen — the reject action is only exposed on the producer-side agreement page. | — | — |
| `tenantIsNotTheDelegateProducer` | 403 | `assertRequesterCanActAsProducer` rejects the request when the caller is not the active producer delegate for the agreement. | Cannot happen — the UI only shows the reject action to the active delegate producer for the current agreement. | — | — |

> Note: `GET /agreements` uses `emptyErrorMapper`; there are no non-500 mapper errors for this endpoint, so it is not documented as a section.

## 10. `POST /agreements/:agreementId/archive`

Service: `agreementService` → `archiveAgreement`. Mapper: `archiveAgreementErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `POST /agreements/:agreementId/archive`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `agreementNotFound` | 404 | `retrieveAgreement` throws when the agreement id is not present in the read model. | Cannot happen — the archive action is only started from a currently loaded agreement record and route params are derived from that page. | — | — |
| `agreementNotInExpectedState` | 400 | `assertExpectedState` rejects the action unless the agreement is in an archivable state. | **CAN HAPPEN** — a stale agreement detail can still trigger archive after the agreement state changes elsewhere. | **Data precondition:** tenant A is the consumer for agreement D and D is no longer archivable, but the page still shows the archive action.<br>1. Open the agreement detail page for D.<br>2. Leave the page stale after the state changes.<br>3. Click _Archivia_. | 🟢 Easy resolution <br />1. Refresh the agreement page.<br />2. Confirm the agreement is still in an archivable state.<br />3. Retry the archive only when the agreement is valid for archiving. |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the request when the authenticated tenant is not the agreement consumer. | Cannot happen — the UI only renders the archive action on the consumer-side agreement page and sends the current agreement id. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the request when the caller is not the active consumer delegate for the agreement. | Cannot happen — the action is only shown to the currently active delegated consumer for that agreement. | — | — |

## 11. `POST /agreements`

Service: `agreementService` → `createAgreement`. Mapper: `createAgreementErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /agreements`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `notLatestEServiceDescriptor` | 400 | `validateCreationOnDescriptor` rejects the selected descriptor when it is not the latest active published descriptor for the e-service. | **CAN HAPPEN** — the page can still create an agreement using a stale descriptor version after a newer descriptor was published elsewhere. | **Data precondition:** tenant A is the consumer for e-service E, and a newer descriptor version for E was published after the page was opened.<br>1. Go to the e-service details page for E.<br>2. Open the agreement creation flow while the page still references the older descriptor version.<br>3. Click _Crea bozza_ or proceed with the agreement draft creation. | 🟡 Medium resolution <br />1. Refresh the page and re-open the e-service from the current descriptor version.<br />2. Create the agreement draft against the newest published descriptor.<br />3. Retry only after the descriptor is current. |
| `descriptorNotInExpectedState` | 400 | `validateCreationOnDescriptor` rejects the descriptor when it is not in an allowed creation state. | **CAN HAPPEN** — stale UI state can still route the request to create an agreement when the selected descriptor has changed state. | **Data precondition:** tenant A is on the e-service details page for E, and the currently selected descriptor is no longer in a valid `PUBLISHED` state after the page was opened.<br>1. Open the agreement creation flow for E.<br>2. Leave the page stale after the descriptor state changes.<br>3. Continue to the creation action and submit the draft. | 🟡 Medium resolution <br />1. Refresh the e-service page.<br />2. Confirm the descriptor is still published and current.<br />3. Retry the agreement creation only in a valid state. |
| `missingCertifiedAttributesError` | 400 | `validateCertifiedAttributes` rejects the consumer when required certified attributes are missing for the descriptor. | **CAN HAPPEN** — the FE disables the action when attributes are missing, but stale page state or changed tenant attributes can still make the request reach the backend. | **Data precondition:** tenant A is the consumer for E and loses one required certified attribute after the page loads.<br>1. Open the agreement creation flow for E.<br>2. Confirm the page still shows the action as available.<br>3. Click _Crea bozza_ to create the draft. | 🟡 Medium resolution <br />1. Refresh the page to reload current tenant attributes.<br />2. Add the missing certified attribute to the consumer profile.<br />3. Retry the agreement creation only after the requirement is satisfied. |
| `eServiceNotFound` | 400 | `retrieveEService` fails when the selected e-service no longer exists. | Cannot happen — the UI routes to this action only from an existing e-service record currently loaded in the page. | — | — |
| `delegationNotFound` | 400 | `getConsumerFromDelegationOrRequester` rejects the selected delegation when it does not exist or is no longer valid for the request. | Cannot happen — the FE only sends a delegation id that was previously selected from an active or eligible delegation list. | — | — |
| `tenantNotFound` | 400 | `getConsumerFromDelegationOrRequester` rejects the requester when the implied tenant cannot be resolved. | Cannot happen — the authenticated tenant exists and the FE does not allow creation from a missing tenant context. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the request when the caller is not the active consumer delegate for the selected delegation. | Cannot happen — the agreement creation dialog only exposes the action to the currently active delegated consumer for that e-service. | — | — |
| `agreementAlreadyExists` | 409 | `verifyCreationConflictingAgreements` rejects the request when the consumer already has a conflicting active or pending agreement for the same e-service. | **CAN HAPPEN** — the UI can still create a draft from a stale page when an equivalent agreement already exists for the same e-service. | **Data precondition:** tenant A already has a non-archived agreement for e-service E and the agreement creation page remains open while the state already exists.<br>1. Go to the e-service details page for E.<br>2. Open the create-agreement flow from the stale page.<br>3. Click _Crea bozza_ to create the draft. | 🟢 Easy resolution <br />1. Refresh the e-service or agreement list.<br />2. Verify whether the consumer already has an active, pending or draft agreement for E.<br />3. Retry only after the conflicting agreement is resolved. |

## 12. `GET /agreements`

Service: `agreementService` → `getAgreements`. Mapper: `emptyErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SUPPORT_ROLE`, `REVIEWER_ROLE`, `VIEWER_ROLE`.

> No non-500 mapper errors are defined for this endpoint; the mapper is empty and no section is documented.

> Note: `GET /producers` and `GET /consumers` use `emptyErrorMapper`; there are no non-500 mapper errors for these endpoints in this batch.

## 13. `GET /agreements/:agreementId`

Service: `agreementService` → `getAgreementById`. Mapper: `getAgreementErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /agreements/:agreementId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `agreementNotFound` | 404 | `retrieveAgreement` throws when the agreement id is not found in the read model. | Cannot happen — the FE only opens this view from an already loaded agreement record and the route is generated from that record. | — | — |
| `tenantNotAllowed` | 403 | `assertRequesterCanRetrieveAgreement` fails after checking the consumer, producer, producer delegate and consumer delegate identities, and throws when the caller has no valid relationship to the agreement. | Cannot happen — the UI never renders this detail to an unrelated tenant, and the page is scoped to the current agreement context. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterIsConsumer` rejects the request when the authenticated tenant is not the agreement consumer. | Cannot happen — the agreement detail page is only shown for the relationship that matches the current tenant; other tenants cannot reach the consumer view. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | `assertRequesterIsDelegateConsumer` rejects the request when the caller is not the active consumer delegate for the agreement. | Cannot happen — the UI only exposes the agreement to the active delegated consumer, and a mismatched delegation id is rejected before any call is made. | — | — |
| `tenantIsNotTheProducer` | 403 | `assertRequesterIsProducer` rejects the request when the authenticated tenant is not the agreement producer. | Cannot happen — the producer-side detail is not rendered outside the producer relationship, and the route is scoped to the agreement's producer. | — | — |
| `tenantIsNotTheDelegateProducer` | 403 | `assertRequesterIsDelegateProducer` rejects the request when the caller is not the active producer delegate for the agreement. | Cannot happen — the page is only shown to the active delegated producer for this agreement, and wrong delegation ids are blocked before the API call. | — | — |

> Note: `GET /agreements/filter/eservices` uses `emptyErrorMapper`; there are no non-500 mapper errors for this endpoint, so it is not documented as a section.

## 14. `POST /agreements/:agreementId/clone`

Service: `agreementService` → `cloneAgreement`. Mapper: `cloneAgreementErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /agreements/:agreementId/clone`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `agreementNotFound` | 404 | `retrieveAgreement` throws when the agreement id does not exist in the read model. | Cannot happen — the FE only exposes the clone action on an already loaded agreement row or detail and the route is derived from that agreement. | — | — |
| `agreementNotInExpectedState` | 400 | `assertExpectedState` rejects the clone when the agreement is not in a cloneable state (`REJECTED`). | **CAN HAPPEN** — a stale agreement list/detail page can still trigger clone after the agreement state changes elsewhere. | **Data precondition:** tenant A has a rejected agreement D for e-service E, but the stale page still shows the clone action after the state changed.<br>1. Open the agreement list or detail page for A.<br>2. Leave the page open after the agreement state changes away from `REJECTED`.<br>3. Click _Duplica_. | 🟢 Easy resolution <br />1. Refresh the agreement page and confirm the agreement is still in `REJECTED`.<br />2. Re-open the agreement only in a cloneable state.<br />3. Retry the clone after the state is valid. |
| `missingCertifiedAttributesError` | 400 | `validateCertifiedAttributes` rejects the consumer when the descriptor still requires certified attributes the current consumer does not satisfy. | **CAN HAPPEN** — the FE can still fire the clone action from a stale page if the consumer's certified attributes change after the page was loaded. | **Data precondition:** tenant A owns rejected agreement D for e-service E, and the associated consumer loses or never satisfies a required certified attribute after the page loads.<br>1. Open the agreement detail or list page for D.<br>2. Keep the page stale while the tenant attributes change.<br>3. Click _Duplica_. | 🟡 Medium resolution <br />1. Refresh the page to reload the current tenant attributes.<br />2. Add the required certified attributes to the consumer profile.<br />3. Retry the clone only after the requirement is satisfied. |
| `eServiceNotFound` | 400 | `retrieveEService` throws when the agreement's e-service no longer exists in the catalog. | Cannot happen — the FE only offers the clone action from an existing agreement already loaded from the catalog and never renders it for a missing e-service record. | — | — |
| `agreementAlreadyExists` | 409 | `readModelService.getAllAgreements` finds a conflicting active agreement for the same consumer and e-service, and `agreementAlreadyExists` is thrown. | **CAN HAPPEN** — the clone action is still available from stale UI state even if a valid agreement for the same e-service already exists on the consumer side. | **Data precondition:** tenant A has the rejected agreement D for e-service E, and a draft or active agreement for the same consumer/e-service already exists.<br>1. Open the rejected agreement page for D.<br>2. Leave it open while the new agreement already exists.<br>3. Click _Duplica_. | 🟢 Easy resolution <br />1. Refresh the agreement list and verify whether a conflicting agreement already exists.<br />2. Resolve or reuse the active/draft agreement for E.<br />3. Retry the clone only after the conflict is cleared. |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the request when the authenticated tenant is not the consumer of the agreement. | Cannot happen — the clone action is only shown on the consumer-side agreement list/detail page and is never rendered for an unrelated tenant. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the request when the caller is not the active consumer delegate for the agreement. | Cannot happen — the UI only exposes the action to the currently active delegated consumer for that agreement and does not render the action otherwise. | — | — |

## 15. `GET /tenants/:tenantId/eservices/:eserviceId/descriptors/:descriptorId/certifiedAttributes/validate`

Service: `agreementService` → `verifyTenantCertifiedAttributes`. Mapper: `verifyTenantCertifiedAttributesErrorMapper`. Roles: `ADMIN_ROLE`, `SUPPORT_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /tenants/:tenantId/eservices/:eserviceId/descriptors/:descriptorId/certifiedAttributes/validate`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | --------------------- | ----------------------- | ---------------- |
| `tenantNotFound` | 404 | `retrieveTenant` throws when the selected consumer tenant cannot be resolved. | Cannot happen — the FE only calls this validation for a tenant selected from an existing consumer list in the create-agreement dialog. | — | — |
| `eServiceNotFound` | 400 | `retrieveEService` throws when the selected e-service no longer exists. | Cannot happen — the request is built from the currently opened e-service and the UI never renders this dialog for a missing e-service. | — | — |
| `descriptorNotFound` | 400 | `retrieveDescriptor` throws when the selected descriptor id is not present in the current e-service. | Cannot happen — the descriptor is taken from the currently selected e-service version and the page only passes a valid descriptor id. | — | — |
| `tenantIsNotTheConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the request when the authenticated tenant does not match the selected consumer. | Cannot happen — the validation is invoked from the consumer create flow and the selected tenant is the one currently being acted on; a different tenant cannot reach the action. | — | — |
| `tenantIsNotTheDelegateConsumer` | 403 | `assertRequesterCanActAsConsumer` rejects the request when the caller is not the active delegated consumer for that agreement/selection. | Cannot happen — the dialog only loads this validation when a valid delegated consumer is selected from the active delegation list, and the action is hidden for mismatched delegates. | — | — |

