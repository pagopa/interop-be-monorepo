> Note: endpoints with an `emptyErrorMapper` were skipped because they have no non-500 errors: `DELETE /clients/purposes/:purposeId`.

## 1. `POST /clientsConsumer`

Service: `authorizationService` → `createConsumerClient`. Mapper: `createConsumerClientErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /clientsConsumer`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `duplicatedMembersInSeed` | 400 | The client seed contains duplicate member IDs (`assertMembersAreUnique` in `src/services/validators.ts`). | Cannot happen — `OperatorsInputTable` excludes already-selected user IDs via `excludeOperatorsIdsList`, so the form cannot submit duplicate `members` values from the FE. | — | — |

## 2. `POST /clientsApi`

Service: `authorizationService` → `createApiClient`. Mapper: `createApiClientErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `POST /clientsApi`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `duplicatedMembersInSeed` | 400 | The client seed contains duplicate member IDs (`assertMembersAreUnique` in `src/services/validators.ts`). | Cannot happen — the shared create-client form uses the same `OperatorsInputTable`, which excludes already-selected user IDs via `excludeOperatorsIdsList`, so the FE never sends duplicate `members` values. | — | — |

## 3. `GET /clientsWithKeys`

Service: `authorizationService` → `getClients`. Mapper: `getClientsWithKeysErrorMapper`. Roles: `ADMIN_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `API_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `clientNotFound` | 404 | Dead mapper entry: this endpoint's flow only filters and returns clients (`getClients`), and never calls `retrieveClient` or any equivalent client-ID assertion. | Cannot happen — the generator reports no BFF route for this process endpoint and the FE uses `ClientServices.getList` against `/clients`, not `/clientsWithKeys`. | — | — |
| `tenantNotAllowedOnClient` | 403 | Dead mapper entry: `getClients` does not call `assertOrganizationIsClientConsumer`, so there is no ownership check path that raises this error in this flow. | Cannot happen — there is no BFF route for `/clientsWithKeys`, and the FE list page does not invoke this process endpoint directly. | — | — |

> Note: endpoints with an `emptyErrorMapper` were skipped because they have no non-500 errors: `GET /clients`.

## 4. `GET /clients/:clientId`

Service: `authorizationService` → `getClientById`. Mapper: `getClientErrorMapper`. Roles: `ADMIN_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /clients/:clientId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `clientNotFound` | 404 | The requested client does not exist (`retrieveClient` in the read model lookup for `getClientById`). | Cannot happen — the FE loads this route only from a client already rendered in the current list/detail flow (`ClientQueries.getSingle` and `ConsumerClientManagePage`), and there is no UI control that lets a user request an arbitrary non-existent client ID. A stale browser tab or a deleted client from another session is outside a normal UI interaction. | — | — |

## 5. `DELETE /clients/:clientId`

Service: `authorizationService` → `deleteClient`. Mapper: `deleteClientErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /clients/:clientId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `clientNotFound` | 404 | The client to delete is already missing before the delete event is created (`retrieveClient` in `deleteClient`). | Cannot happen — the FE only enables the delete action for a client already loaded in the current screen (`useGetClientActions`), and there is no UI path for manually entering a client ID or deleting an item that was never shown. A stale tab after another user deletes the record is outside normal UI usage. | — | — |
| `tenantNotAllowedOnClient` | 403 | The current tenant is not the owner/consumer of the client (`assertOrganizationIsClientConsumer` in `deleteClient`). | Cannot happen — the UI only shows the delete action for the current tenant's own client records (`useGetClientActions` gates on the current admin session and the client in context), and the list/detail pages never expose another tenant's client for deletion. | — | — |

## 6. `GET /clients/:clientId/users`

Service: `authorizationService` → `getClientUsers`. Mapper: `getClientUsersErrorMapper`. Roles: `ADMIN_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `GET /clients/:clientId/users`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotAllowedOnClient` | 403 | The current tenant does not own the client being read (`assertOrganizationIsClientConsumer` in `getClientUsers`). | Cannot happen — the operators list is rendered only from the current tenant’s client detail flow (`ClientOperators` / `ConsumerClientManagePage`), so there is no UI action that switches the page to another tenant’s client or submits a different `clientId`. | — | — |
| `clientNotFound` | 404 | The requested client does not exist when `retrieveClient` is called in `getClientUsers`. | Cannot happen — the FE only loads the operator list from a client already returned by the current client detail flow, and there is no control that lets a user enter or reload an arbitrary non-existent `clientId`. A stale tab after the client was deleted is outside a normal UI interaction. | — | — |

## 7. `DELETE /clients/:clientId/users/:userId`

Service: `authorizationService` → `removeClientUser`. Mapper: `removeClientUserErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `clientNotFound` | 404 | The client being updated does not exist when `retrieveClient` is called in `removeClientUser`. | Cannot happen — the generator found no BFF route for this process endpoint, and the FE client-management screens never expose a remove-user action for an arbitrary client ID. | — | — |
| `clientUserIdNotFound` | 404 | The target user is not present in `client.data.users` before the removal is applied (`!client.data.users.includes(userIdToRemove)`). | Cannot happen — the generator found no BFF route for this process endpoint, and the UI does not offer a delete action for a user that is not currently displayed in the client operator list. | — | — |
| `tenantNotAllowedOnClient` | 403 | The current tenant is not the owner/consumer of the client (`assertOrganizationIsClientConsumer` in `removeClientUser`). | Cannot happen — the generator found no BFF route for this process endpoint, and the client detail pages only operate on the current tenant’s client records, never on another tenant’s client membership. | — | — |

## 8. `POST /clients/:clientId/users`

Service: `authorizationService` → `addClientUsers`. Mapper: `addClientUserErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `tenantNotAllowedOnClient` | 403 | The current tenant is not the owner/consumer of the client (`assertOrganizationIsClientConsumer` in `addClientUsers`). | Cannot happen — the generator found no BFF route for this process endpoint, and the FE client-management screens only allow adding users to the current tenant’s client; there is no UI path for a different tenant’s client. | — | — |
| `userWithoutSecurityPrivileges` | 403 | One of the selected users does not have the required admin/security roles in Selfcare (`assertUserSelfcareSecurityPrivileges` in `addClientUsers`). | Cannot happen — the FE’s operator selection is constrained to the current tenant and the user list is filtered by the same roles before submission, so it never sends a user without the required privileges. | — | — |
| `clientNotFound` | 404 | The target client does not exist when `retrieveClient` is called in `addClientUsers`. | Cannot happen — the generator found no BFF route for this process endpoint, and the FE never submits a user-add request for a client ID that was not already loaded in the current client management flow. | — | — |
| `tenantNotFound` | 404 | The tenant behind the current auth context cannot be resolved when `getSelfcareIdFromAuthData` calls `retrieveTenant(authData.organizationId)`. | Cannot happen — the FE is authenticated to a valid current tenant and the client management flow never lets a user add operators while the tenant context is unresolved. | — | — |
| `clientUserAlreadyAssigned` | 400 | The same user is already present in the client’s `users` array (`client.data.users.includes(userId)`). | Cannot happen — the FE prevents duplicate selections before submission, and the operator input table excludes already-chosen users from the next selection step. | — | — |
| `missingSelfcareId` | 500 | The tenant exists but has no `selfcareId`, so `getSelfcareIdFromAuthData` throws in `assertTenantHasSelfcareId`. | Cannot happen — the generator found no BFF route for this process endpoint, and the UI is not allowed to operate on a tenant record that lacks Selfcare metadata in the normal client-management flow. | — | — |

## 9. `POST /clients/:clientId/admin`

Service: `authorizationService` → `setAdminToClient`. Mapper: `addClientAdminErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `POST /clients/:clientId/admin`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `clientNotFound` | 404 | The target client does not exist when `retrieveClient` is called in `setAdminToClient`. | Cannot happen — the drawer is only opened from an already-loaded client detail and the FE does not offer a way to submit an arbitrary non-existent `clientId` from the UI. | — | — |
| `tenantNotAllowedOnClient` | 403 | The current tenant is not the owner/consumer of the client (`assertOrganizationIsClientConsumer` in `setAdminToClient`). | Cannot happen — the client-admin drawer is rendered only in the current tenant’s client management flow, and the component never exposes a different tenant’s client record for action. | — | — |
| `clientKindNotAllowed` | 403 | The target client is not of kind `api` (`assertClientIsAPI` in `setAdminToClient`). | Cannot happen — the “Client Admin API” drawer is only surfaced on API-client detail pages and never on the consumer-client flow that the frontend uses for other client types. | — | — |
| `userWithoutSecurityPrivileges` | 403 | The selected admin user does not have the required `ADMIN_ROLE` in Selfcare (`assertUserSelfcareSecurityPrivileges` in `setAdminToClient`). | Cannot happen — the drawer loads users from `TenantQueries.getPartyUsersList({ roles: ['admin'] })` and the form only allows values from that filtered list. | — | — |
| `userAlreadyAssignedAsAdmin` | 409 | The current client already has the same `adminId` selected (`oldAdminId && oldAdminId === adminId`). | Cannot happen — the form validation rejects the current value (`value !== admin?.userId`) and the drawer resets the selection to the existing admin before submit. | — | — |

## 10. `POST /clients/:clientId/keys`

Service: `authorizationService` → `createKey`. Mapper: `createKeyErrorMapper`. Roles: `ADMIN_ROLE`, `SECURITY_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /clients/:clientId/keys`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `clientNotFound` | 404 | The target client does not exist when `retrieveClient` is called in `createKey`. | Cannot happen — the add-key action is attached to a client already loaded in the current client detail flow and the FE never prompts for an arbitrary client ID. | — | — |
| `tooManyKeysPerClient` | 400 | The client already exceeds the maximum number of keys before the new key is appended (`assertClientKeysCountIsBelowThreshold` in `createKey`). | Cannot happen — the FE sets `publicKeysLimit = 100` in `ClientPublicKeysHeadSection` and disables the add-key action when `hasReachedPublicKeysLimit` is true, so the normal UI never posts a 101st key. | — | — |
| `notAllowedPrivateKeyException` | 400 | The value provided in the public-key field is rejected by JWK validation for being an invalid or unsupported public key. | **CAN HAPPEN** — the add-key drawer only enforces a required field, not RSA/PEM format or key length, so a normal interaction can send malformed or unsupported content to the backend. | **Data precondition:** the client exists and the current user is already a member/admin; the key list is not full.<br>1. Open the client detail and go to the tab “Chiavi pubbliche”.<br>2. Click the plus button to open “Inserisci nuova chiave pubblica”.<br>3. Paste a malformed or unsupported public key in “Chiave pubblica (richiesto)”.<br>4. Click “Inserisci”. | 🟢 Easy resolution <br />1. Replace the pasted text with a valid RSA public key in PEM format.<br>2. Re-submit the form after verifying the text is not truncated or corrupted. |
| `notAllowedCertificateException` | 400 | The submitted key is a certificate instead of a valid public key, so the JWK builder rejects it. | **CAN HAPPEN** — same as `notAllowedPrivateKeyException`; the FE accepts free text and does not reject certificate content before submit. | Same as `notAllowedPrivateKeyException`, except the pasted value is a certificate or certificate-like PEM rather than a plain public key. | 🟢 Easy resolution <br />1. Use a raw public key, not a certificate blob.<br>2. Paste only the RSA public key material and submit again. |
| `notAllowedMultipleKeysException` | 400 | The text contains more than one PEM block or multiple keys, which the loader rejects. | **CAN HAPPEN** — same as `notAllowedPrivateKeyException`; the form does not validate for single-key PEM content. | Same as `notAllowedPrivateKeyException`, except the pasted input contains multiple PEM blocks or more than one key. | 🟢 Easy resolution <br />1. Paste exactly one public key in the field.<br>2. Remove extra PEM blocks and submit again. |
| `jwkDecodingError` | 400 | The submitted PEM cannot be decoded into a usable JWK structure (`createJWK`). | cannot happen — the FE sends a string which is always decoded in base64 | — | — |
| `invalidPublicKey` | 400 | The public key payload does not pass the validation checks required by the JWK helper. | **CAN HAPPEN** — same as `notAllowedPrivateKeyException`; the FE does not validate the public-key text beyond a required field. | Same as `notAllowedPrivateKeyException`, except the pasted value is syntactically invalid or incomplete. | 🟢 Easy resolution <br />1. Check the PEM text for truncation or accidental whitespace changes.<br>2. Re-paste a valid public key and submit again. |
| `notAnRSAKey` | 400 | The key is not an RSA key (`createJWK` rejects non-RSA material). | **CAN HAPPEN** — same as `notAllowedPrivateKeyException`; the form accepts arbitrary text without an RSA-only check. | Same as `notAllowedPrivateKeyException`, except the pasted value is an EC/ECDSA or other non-RSA key. | 🟢 Easy resolution <br />1. Generate or export an RSA public key.<br>2. Submit only the valid RSA key material. |
| `invalidKeyLength` | 400 | The RSA key length is below the accepted threshold for this service. | **CAN HAPPEN** — same as `notAllowedPrivateKeyException`; the FE does not enforce the minimum key length in the form. | Same as `notAllowedPrivateKeyException`, except the pasted RSA key is shorter than the accepted length. | 🟢 Easy resolution <br />1. Recreate the key with a supported RSA size.<br>2. Paste the new public key and submit again. |
| `keyAlreadyExists` | 409 | The generated `kid` already exists in the current client or in another client/keychain (`assertKeyDoesNotAlreadyExist` in `createKey`). | **CAN HAPPEN** — the add-key form does not check whether the same key or same `kid` is already present before sending the request. | **Data precondition:** the same public key is already present in the current client.<br>1. Open the client detail and go to “Chiavi pubbliche”.<br>2. Click the plus button and open “Inserisci nuova chiave pubblica”.<br>3. Paste the same public key that is already listed in the current client.<br>4. Click “Inserisci”. | 🟢 Easy resolution <br />1. Reuse the existing key instead of uploading a duplicate.<br>2. If a new key is required, generate a fresh public/private pair and upload that one. |
| `tenantNotAllowedOnClient` | 403 | The current tenant is not the owner/consumer of the client (`assertOrganizationIsClientConsumer` in `createKey`). | Cannot happen — the client detail page is loaded from the current tenant’s client and the key form is never presented for another tenant’s client. | — | — |
| `userWithoutSecurityPrivileges` | 403 | The current authenticated user does not have the required admin/security role in the tenant (`assertUserSelfcareSecurityPrivileges` in `createKey`). | Cannot happen — the client page and add-key action are only shown for current client members who have the required roles, and the FE does not expose an action for a user without those privileges. | — | — |
| `userNotFound` | 403 | The authenticated user is not a member of the client (`if (!client.data.users.includes(authData.userId))`). | Cannot happen — the add-key action is disabled when the user is not in the client (`ClientPublicKeysHeadSection` computes `isInClient` and sets `disabled: canNotAddKey`). | — | — |

## 11. `GET /clients/:clientId/keys`

Service: `authorizationService` → `getClientKeys`. Mapper: `getClientKeysErrorMapper`. Roles: `ADMIN_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /clients/:clientId/keys`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `clientNotFound` | 404 | The client does not exist when `retrieveClient` is called in `getClientKeys`. | Cannot happen — the page is loaded from an already-selected client in the current detail flow and the FE never offers a direct UI action to request an arbitrary unknown `clientId`. | — | — |
| `tenantNotAllowedOnClient` | 403 | The current tenant does not own the client being read (`assertOrganizationIsClientConsumer` in `getClientKeys`). | Cannot happen — the page is only reached from the current tenant’s client detail and the frontend never shows another tenant’s client record in the same screen. | — | — |
| `securityUserNotMember` | 403 | A security-role user is not a member of the selected client (`assertSecurityRoleIsClientMember` in `getClientKeys`). | Cannot happen — the FE only shows the keys list in the current client detail flow and does not provide a UI path for a non-member security user to request the same endpoint. | — | — |

## 12. `GET /clients/:clientId/keys/:keyId`

Service: `authorizationService` → `getClientKeyById`. Mapper: `getClientKeyErrorMapper`. Roles: `ADMIN_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /clients/:clientId/keys/:keyId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `clientNotFound` | 404 | The requested client does not exist (`retrieveClient` in `getClientKeyById`). | Cannot happen — the FE opens this page only from an already-loaded client and never submits an arbitrary unknown `clientId` from its own controls (`ClientQueries.getSingleKey` and `KeyDetailsPage`). | — | — |
| `clientKeyNotFound` | 404 | The key id is not present in the selected client (`client.data.keys.find(...)` in `getClientKeyById`). | Cannot happen — the page is reached from a row already shown in the current client’s public-keys list, and the FE has no UI action for typing or reloading an arbitrary `kid`. | — | — |
| `tenantNotAllowedOnClient` | 403 | The current tenant does not own the client (`assertOrganizationIsClientConsumer` in `getClientKeyById`). | Cannot happen — the key detail route is opened only from the current tenant’s client view and the UI never presents another tenant’s client record. | — | — |
| `securityUserNotMember` | 403 | A security-role user is not a member of the selected client (`assertSecurityRoleIsClientMember` in `getClientKeyById`). | Cannot happen — the FE exposes the key detail only from a client page already loaded for the current member context; it does not offer a way to open a non-member security-user route from the normal interaction flow. | — | — |

## 13. `DELETE /clients/:clientId/keys/:keyId`

Service: `authorizationService` → `deleteClientKeyById`. Mapper: `deleteClientKeyByIdErrorMapper`. Roles: `ADMIN_ROLE`, `SECURITY_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /clients/:clientId/keys/:keyId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `clientNotFound` | 404 | The client is missing before the key deletion is applied (`retrieveClient` in `deleteClientKeyById`). | Cannot happen — the delete action is triggered from a client already loaded in the current screen and the FE never lets a user submit an arbitrary non-existent `clientId`. | — | — |
| `clientKeyNotFound` | 404 | The selected key is no longer in the client (`!client.data.keys.find(...)` in `deleteClientKeyById`). | Cannot happen — the action is attached to a key row already rendered in the current public-keys list, so the UI is not offering a stale or manually typed `kid` to the backend. | — | — |
| `tenantNotAllowedOnClient` | 403 | The current tenant is not the owner of the client (`assertOrganizationIsClientConsumer` in `deleteClientKeyById`). | Cannot happen — the action is only available in the current tenant’s client detail and the list/detail screens never expose another tenant’s client data. | — | — |
| `userNotAllowedToDeleteClientKey` | 403 | A security-role user tries to delete a key owned by another user (`keyToRemove.userId !== authData.userId` in `deleteClientKeyById`). | **CAN HAPPEN** — the security-user key list is rendered for the whole client and `useGetKeyActions` exposes the delete menu on every key row without checking whether the row belongs to the current operator. | **Data precondition:** tenant A already has client C and key K owned by operator B2; the current logged-in user is security-role operator B1 and is a member of client C.<br>1. Open the client detail for C and go to the tab “Chiavi pubbliche”.<br>2. Select the row for key K owned by B2.<br>3. Click _Elimina_ in the row action menu. | 🟢 Easy resolution <br />1. Restrict the delete action to keys whose `userId` matches the current security user.<br>2. Hide or disable the action in the row menu for other users’ keys before submitting the request. |
| `userNotAllowedOnClient` | 403 | A security-role user is not a member of the target client but still reaches the delete flow (`if (hasSecurityRole && !client.data.users.includes(authData.userId))`). | Cannot happen — the FE only offers the key action from within the current client detail page, and the security-user page is filtered to users already on the client membership list. | — | — |

## 14. `POST /clients/:clientId/purposes`

Service: `authorizationService` → `addClientPurpose`. Mapper: `addClientPurposeErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /clients/:clientId/purposes`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `clientNotFound` | 404 | The selected client was already deleted before the purpose association is created (`retrieveClient` in `addClientPurpose`). | Cannot happen — the drawer is opened from a client already present in the current list/detail flow, and the UI never submits an arbitrary non-existent `clientId` for this action. | — | — |
| `purposeNotFound` | 404 | The purpose referenced by `seed.purposeId` does not exist (`retrievePurpose` in `addClientPurpose`). | Cannot happen — the FE only offers this action from a purpose already loaded in the purpose detail page, and it never lets the user manually type an unknown `purposeId`. | — | — |
| `noActiveOrSuspendedAgreementFound` | 400 | The e-service has no active or suspended agreement for the purpose consumer (`getActiveOrSuspendedAgreement` in `addClientPurpose`). | Cannot happen — the drawer is only opened from a purpose detail that the current consumer flow already considers usable, and there is no UI path to select an invalid or uncontracted purpose for this action. | — | — |
| `noActiveOrSuspendedPurposeVersionFound` | 400 | The purpose has no active or suspended version, so the flow cannot continue (`purpose.versions.find(...)` in `addClientPurpose`). | Cannot happen — the UI exposes the action only from a valid, current purpose detail, and there is no normal interaction that targets an inactive purpose draft for customer-client binding. | — | — |
| `eserviceNotDelegableForClientAccess` | 400 | A delegated purpose is being attached to a client while the underlying e-service is not delegable for client access (`eservice.isClientAccessDelegable` in `addClientPurpose`). | Cannot happen — the FE only offers the action from the current purpose detail and never presents a client-binding action for a purpose/e-service pair that the user has not already passed through the normal delegation-aware flow. | — | — |
| `purposeAlreadyLinkedToClient` | 409 | The purpose is already associated with the selected client (`client.data.purposes.includes(purposeId)`). | Cannot happen — the drawer filters out clients already linked to the purpose (`!clientIdsAlreadyInPurpose.some((id) => client.id === id)`), so the user cannot submit a duplicate association from the FE. | — | — |
| `clientKindNotAllowed` | 403 | The target client is not a consumer client after `assertClientIsConsumer(client.data)`. | Cannot happen — the FE calls `ClientQueries.getList({ kind: 'CONSUMER' })` and only exposes consumer clients in the purpose-attachment drawer. | — | — |
| `tenantNotAllowedOnClient` | 403 | The current tenant is not the owner of the client (`assertOrganizationIsClientConsumer` in `addClientPurpose`). | Cannot happen — the action is only available in the current tenant’s own client and purpose detail flows. | — | — |
| `tenantNotAllowedOnPurpose` | 403 | The current tenant is not the consumer of the purpose (`assertOrganizationIsPurposeConsumer` or delegate check in `addClientPurpose`). | Cannot happen — the purpose drawer is opened only from the current tenant’s purpose detail page, and the UI never lets the user attach a purpose owned by another tenant. | — | — |
| `purposeDelegationNotFound` | 500 | The purpose is delegated but the corresponding delegation record is missing (`retrievePurposeDelegation` in `addClientPurpose`). | Cannot happen — the FE loads the purpose from the same delegated flow and does not offer a normal UI path to bind a client to a purpose whose delegation state is missing. | — | — |

## 15. `DELETE /clients/:clientId/purposes/:purposeId`

Service: `authorizationService` → `removeClientPurpose`. Mapper: `removeClientPurposeErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /clients/:clientId/purposes/:purposeId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `clientNotFound` | 404 | The client to remove from the purpose does not exist before the update is written (`retrieveClient` in `removeClientPurpose`). | Cannot happen — the FE only calls this action from a purpose detail page where the client row was already loaded from the current purpose (`PurposeClientsTableRow` calls `removeClientFromPurpose({ purposeId, clientId: client.id })`), and there is no normal user action for entering an arbitrary `clientId`. | — | — |
| `tenantNotAllowedOnClient` | 403 | The current tenant is not the owner/consumer of the client (`assertOrganizationIsClientConsumer` in `removeClientPurpose`). | Cannot happen — the remove action is only rendered for the current tenant’s own purpose-client list, and the UI never opens this action for a client belonging to another tenant. | — | — |
| `clientKindNotAllowed` | 403 | The target client is not a consumer client (`assertClientIsConsumer` in `removeClientPurpose`). | Cannot happen — the action sits in the consumer-purpose clients tab and only removes consumer clients from a purpose; the UI never presents an API or other client kind in this flow. | — | — |

## 16. `DELETE /clients/:clientId/admin/:adminId`

Service: `authorizationService` → `removeClientAdmin`. Mapper: `removeClientAdminErrorMapper`. Roles: `ADMIN_ROLE`.

### BFF endpoints

- `DELETE /clients/:clientId/admin/:adminId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `clientNotFound` | 404 | The client being edited no longer exists before the admin removal is applied (`retrieveClient` in `removeClientAdmin`). | Cannot happen — the button only appears from the current API-client detail page, and the UI reads the client already loaded in the page (`client?.admin` and `client.id`) rather than accepting an arbitrary manual `clientId`. | — | — |
| `clientKindNotAllowed` | 403 | The target client is not an API client (`assertClientIsAPI` in `removeClientAdmin`). | Cannot happen — the remove-admin action is only rendered when `clientKind === 'API'` in the current client-detail page, and the page never exposes this control for consumer clients. | — | — |
| `tenantNotAllowedOnClient` | 403 | The current tenant is not the owner/consumer of the client (`assertOrganizationIsClientConsumer` in `removeClientAdmin`). | Cannot happen — this UI is shown only from the current tenant’s client detail flow, and the page never lets a user open the remove-admin action for another tenant’s client. | — | — |
| `clientAdminIdNotFound` | 400 | The selected admin ID no longer matches the client’s current `adminId` (`assertAdminInClient` in `removeClientAdmin`). | Cannot happen — the action is guarded by `if (!client?.admin) return` and the current admin is read from the same client object already rendered in the page, so the FE never submits a stale or non-existent admin id. | — | — |

> Note: endpoints with an `emptyErrorMapper` were skipped because they have no non-500 errors: `GET /producerKeychains`, `GET /producerKeychains/eservices/:eserviceId/flags`.

## 17. `POST /producerKeychains`

Service: `authorizationService` → `createProducerKeychain`. Mapper: `createProducerKeychainErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /producerKeychains`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `duplicatedMembersInSeed` | 400 | The producer keychain seed contains duplicate member IDs (`assertMembersAreUnique` in `src/services/validators.ts`). | Cannot happen — both `UsersInputTable` and `AddUsersToKeychainDrawer` exclude already-selected `userId`s before submitting the payload, so the FE cannot send duplicate `members` values. | — | — |

## 18. `GET /producerKeychains/:producerKeychainId`

Service: `authorizationService` → `getProducerKeychainById`. Mapper: `getProducerKeychainErrorMapper`. Roles: `ADMIN_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `GET /producerKeychains/:producerKeychainId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `producerKeychainNotFound` | 404 | The requested producer keychain does not exist (`retrieveProducerKeychain` in `getProducerKeychainById`). | Cannot happen — the detail page is only opened from a keychain already loaded in the current list/detail flow (`KeychainQueries.getSingle` and `ProviderKeychainDetailsPage`), and the router does not expose a UI field for manually entering an arbitrary `keychainId`. A stale tab after the keychain was deleted is outside a normal UI interaction. | — | — |

## 19. `DELETE /producerKeychains/:producerKeychainId`

Service: `authorizationService` → `deleteProducerKeychain`. Mapper: `deleteProducerKeychainErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /producerKeychains/:producerKeychainId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `producerKeychainNotFound` | 404 | The keychain to delete no longer exists before the delete event is created (`retrieveProducerKeychain` in `deleteProducerKeychain`). | Cannot happen — the delete action is only rendered from the currently selected keychain detail page (`ProviderKeychainDetailsPage` calls `deleteKeychain({ producerKeychainId: keychainId })`), and the UI never lets a user submit an arbitrary `producerKeychainId`. A stale tab after another user deletes the record is outside a normal UI interaction. | — | — |
| `tenantNotAllowedOnProducerKeychain` | 403 | The current tenant is not the producer of the keychain (`assertOrganizationIsProducerKeychainProducer` in `deleteProducerKeychain`). | Cannot happen — the delete action is only available in the producer keychain detail flow and the current tenant’s keychain list/detail route, so another tenant’s keychain is never presented for deletion. | — | — |

## 20. `GET /producerKeychains/:producerKeychainId/users`

Service: `authorizationService` → `getProducerKeychainUsers`. Mapper: `getProducerKeychainUsersErrorMapper`. Roles: `ADMIN_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `GET /producerKeychains/:producerKeychainId/users`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `producerKeychainNotFound` | 404 | The keychain for which members are retrieved no longer exists when `retrieveProducerKeychain` is called in `getProducerKeychainUsers`. | Cannot happen — the members tab is opened from a keychain already selected in the current tenant’s detail flow (`KeychainMembersTab` calls `KeychainQueries.getSingle` / `KeychainServices.getProducerKeychainUsersList`), and there is no UI path to request an arbitrary non-existent keychain ID. | — | — |
| `tenantNotAllowedOnProducerKeychain` | 403 | The current tenant does not own the keychain being read (`assertOrganizationIsProducerKeychainProducer` in `getProducerKeychainUsers`). | Cannot happen — the members view is rendered only for the current tenant’s selected keychain and the route/auth guard does not expose another tenant’s keychain in the provider keychain UI. | — | — |

## 21. `POST /producerKeychains/:producerKeychainId/users`

Service: `authorizationService` → `addProducerKeychainUsers`. Mapper: `addProducerKeychainUserErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /producerKeychains/:producerKeychainId/users`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `userWithoutSecurityPrivileges` | 403 | A selected member does not have the required `ADMIN_ROLE` or `SECURITY_ROLE` in Selfcare when `assertUserSelfcareSecurityPrivileges` is invoked. | Cannot happen — the drawer loads `TenantQueries.getPartyUsersList({ roles: ['admin', 'security'] })` and the options are filtered for already-added users, so the UI never submits a member without the required institution roles. | — | — |
| `producerKeychainNotFound` | 404 | The keychain to update no longer exists before the membership write (`retrieveProducerKeychain` in `addProducerKeychainUsers`). | Cannot happen — the drawer is opened from an already-selected keychain detail page (`ProviderKeychainDetailsPage` → `KeychainMembersTab`), and there is no UI input for an arbitrary `producerKeychainId`. | — | — |
| `tenantNotAllowedOnProducerKeychain` | 404 | The current tenant is not the producer of the keychain (`assertOrganizationIsProducerKeychainProducer` in `addProducerKeychainUsers`). | Cannot happen — the members action is only exposed inside the current tenant’s own keychain detail flow, and the frontend never opens the drawer for another tenant’s keychain. | — | — |
| `producerKeychainUserAlreadyAssigned` | 400 | The same member is already present in the keychain’s `users` list (`producerKeychain.data.users.includes(userId)`). | Cannot happen — `excludeUsersIdsList` is populated from the current keychain members and then used to filter the multiselect options, so the form cannot submit a duplicate member. | — | — |
| `missingSelfcareId` | 500 | The current tenant record is missing `selfcareId` before `getSelfcareIdFromAuthData` can resolve the user’s institution. | Cannot happen — the normal UI flow is authenticated with a valid tenant and `isUiAuthData(authData)` short-circuits the lookup by using the already available `selfcareId`; the drawer never operates on a tenant without that value. | — | — |
| `tenantNotFound` | 500 | The organization behind `authData.organizationId` cannot be resolved during the selfcare lookup. | Cannot happen — the FE only allows this action while the user is logged into a valid current tenant, and there is no UI state where the add-members flow runs without a resolved tenant. | — | — |

## 22. `DELETE /producerKeychains/:producerKeychainId/users/:userId`

Service: `authorizationService` → `removeProducerKeychainUser`. Mapper: `removeProducerKeychainUserErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /producerKeychains/:producerKeychainId/users/:userId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `producerKeychainNotFound` | 404 | The keychain to update no longer exists before the user removal is applied (`retrieveProducerKeychain` in `removeProducerKeychainUser`). | Cannot happen — the remove button is rendered from the currently selected keychain detail page, and the UI does not open a form for an arbitrary `producerKeychainId`. | — | — |
| `producerKeychainUserIdNotFound` | 404 | The target user is not present in the keychain member list (`!producerKeychain.data.users.includes(userIdToRemove)`). | Cannot happen — the UI only renders the removal action for members currently listed in the keychain members table, so the form cannot submit a user that is not already shown. | — | — |
| `tenantNotAllowedOnProducerKeychain` | 404 | The current tenant is not the producer of the target keychain (`assertOrganizationIsProducerKeychainProducer` in `removeProducerKeychainUser`). | Cannot happen — the action is available only in the current tenant’s own keychain detail flow, and the page never renders a delete control for another tenant’s keychain. | — | — |

## 23. `POST /producerKeychains/:producerKeychainId/keys`

Service: `authorizationService` → `createProducerKeychainKey`. Mapper: `createProducerKeychainKeyErrorMapper`. Roles: `ADMIN_ROLE`, `SECURITY_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /producerKeychains/:producerKeychainId/keys`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `producerKeychainNotFound` | 404 | The keychain to be updated no longer exists before `retrieveProducerKeychain` is called. | Cannot happen — the add-public-key drawer is opened only from a keychain already loaded in the current detail page, and the FE never lets the user type an arbitrary `producerKeychainId`. | — | — |
| `tooManyKeysPerProducerKeychain` | 400 | The producer keychain already has the maximum number of keys before the new key is appended (`assertProducerKeychainKeysCountIsBelowThreshold`). | Cannot happen — `KeychainAddPublicKeyButton` calculates `publicKeysCount` and disables the action when `publicKeysCount >= 30`, so the normal UI never submits a 31st key. | — | — |
| `invalidPublicKey` | 400 | The submitted PEM/JWK content does not pass the validation checks used by `createJWK`. | **CAN HAPPEN** — the drawer validates only that the field is required, and does not enforce RSA format, PEM structure, or acceptable key size before submit. | **Data precondition:** the keychain exists and the current user is already a member/admin of it; the key list is not at its limit.<br>1. Open the keychain detail page and go to the tab “Chiavi pubbliche”.<br>2. Click the plus button to open “Inserisci nuova chiave pubblica”.<br>3. Paste malformed or incomplete PEM text in “Chiave pubblica (richiesto)”.<br>4. Click “Inserisci”. | 🟢 Easy resolution <br />1. Paste a valid PEM-encoded RSA public key.<br>2. Remove truncation, extra text and incorrect formatting, then submit again. |
| `notAnRSAKey` | 400 | The submitted key is not an RSA key (`createJWK` rejects the material). | **CAN HAPPEN** — same as `invalidPublicKey`; the form accepts free text without any RSA-only client-side guard. | Same as `invalidPublicKey`, except the pasted value is an EC or other non-RSA key. | 🟢 Easy resolution <br />1. Generate or export an RSA public key.<br>2. Re-paste only that RSA key and submit again. |
| `invalidKeyLength` | 400 | The RSA key is shorter than the accepted length threshold. | **CAN HAPPEN** — same as `invalidPublicKey`; the form does not enforce a minimum length before the request leaves the browser. | Same as `invalidPublicKey`, except the pasted RSA key is shorter than the accepted minimum length. | 🟢 Easy resolution <br />1. Regenerate the key pair with a supported RSA size (for example 2048 bits or more).<br>2. Upload the new public key and retry. |
| `tenantNotAllowedOnProducerKeychain` | 403 | The current tenant does not own the target keychain (`assertOrganizationIsProducerKeychainProducer` in `createProducerKeychainKey`). | Cannot happen — the add-key action is rendered only in the current tenant’s own keychain detail flow, and the route is not available for another tenant’s keychain. | — | — |

## 24. `GET /producerKeychains/:producerKeychainId/keys`

Service: `authorizationService` → `getProducerKeychainKeys`. Mapper: `getProducerKeychainKeysErrorMapper`. Roles: `ADMIN_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `GET /producerKeychains/:producerKeychainId/keys`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `producerKeychainNotFound` | 404 | The requested producer keychain does not exist (`retrieveProducerKeychain` in `getProducerKeychainKeys`). | Cannot happen — the key list is opened only from an already-selected producer keychain in the current tenant’s detail flow (`KeychainPublicKeysTab` calls `KeychainQueries.getProducerKeychainKeysList(params)` with a `producerKeychainId` already loaded in the page), and the FE never exposes a screen where the user types or edits an arbitrary keychain ID. | — | — |
| `tenantNotAllowedOnProducerKeychain` | 403 | The current tenant does not own the keychain being listed (`assertOrganizationIsProducerKeychainProducer` in `getProducerKeychainKeys`). | Cannot happen — the page is rendered only inside the current tenant’s own producer-keychain flow, and the frontend never shows a key list for another tenant’s keychain. | — | — |

## 25. `GET /producerKeychains/:producerKeychainId/keys/:keyId`

Service: `authorizationService` → `getProducerKeychainKeyById`. Mapper: `getProducerKeychainKeyErrorMapper`. Roles: `ADMIN_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `SUPPORT_ROLE`.

### BFF endpoints

- `GET /producerKeychains/:producerKeychainId/keys/:keyId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `producerKeychainNotFound` | 404 | The keychain that owns the requested key no longer exists when `retrieveProducerKeychain` is called in `getProducerKeychainKeyById`. | Cannot happen — the detail page is opened from a keychain already loaded in the current provider-keychain flow, and the FE does not offer a UI field for an arbitrary `producerKeychainId`. | — | — |
| `producerKeyNotFound` | 404 | The target key is missing from the keychain (`producerKeychain.data.keys.find((key) => key.kid === kid)` in `getProducerKeychainKeyById`). | Cannot happen — `ProviderKeychainPublicKeyDetailsPage` and `KeychainPublicKeysTableRow` only load a key already rendered in the current list/detail flow, and the UI does not provide a manual form for an arbitrary key ID. | — | — |
| `tenantNotAllowedOnProducerKeychain` | 403 | The current tenant does not own the producer keychain being read (`assertOrganizationIsProducerKeychainProducer` in `getProducerKeychainKeyById`). | Cannot happen — the details page is shown only from the current tenant’s own keychain, and there is no path in the FE that opens the public-key details for another tenant’s keychain. | — | — |

## 26. `DELETE /producerKeychains/:producerKeychainId/keys/:keyId`

Service: `authorizationService` → `removeProducerKeychainKeyById`. Mapper: `deleteProducerKeychainKeyByIdErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /producerKeychains/:producerKeychainId/keys/:keyId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `producerKeychainNotFound` | 404 | The producer keychain to update no longer exists before the delete logic starts (`retrieveProducerKeychain` in `removeProducerKeychainKeyById`). | Cannot happen — the delete action is only rendered from the currently selected producer-keychain detail page, and the UI never lets the user enter an arbitrary `producerKeychainId`. | — | — |
| `producerKeyNotFound` | 404 | The target key is missing from the keychain before deletion (`producerKeychain.data.keys.find((key) => key.kid === keyIdToRemove)` in `removeProducerKeychainKeyById`). | Cannot happen — the action is attached to a key already shown in the current list, and the FE does not expose a manual delete request for a nonexistent key ID. | — | — |
| `userNotFound` | 404 | Dead mapper entry: this flow never calls a user lookup; it validates membership against `producerKeychain.data.users` and the current auth data instead. | Cannot happen — the browser does not render a delete action for a key that is not already in the current keychain detail flow, and there is no BFF route that accepts an arbitrary user context for this request. | — | — |
| `tenantNotAllowedOnProducerKeychain` | 403 | The current tenant is not the producer of the keychain (`assertOrganizationIsProducerKeychainProducer` in `removeProducerKeychainKeyById`). | Cannot happen — the delete control is only offered inside the current tenant’s own producer-keychain detail flow, and the page never exposes another tenant’s keychain for deletion. | — | — |
| `userWithoutSecurityPrivileges` | 403 | Dead mapper entry: there is no `assertUserSelfcareSecurityPrivileges` call in `removeProducerKeychainKeyById`; the method checks keychain membership and key ownership instead. | Cannot happen — `useGetProducerKeychainKeyActions` hides the delete control for any security user whose `jwt.organizationId !== publicKey.user.userId`, so the FE never submits a delete request for another user’s key. | — | — |

> Note: unmapped in this flow: `userNotAllowedOnProducerKeychain` is thrown when a security-role user is not a member of the keychain or tries to delete a key that belongs to another user (`if (hasSecurityRole && !producerKeychain.data.users.includes(authData.userId))` and `if (hasSecurityRole && keyToRemove.userId !== authData.userId)` in `removeProducerKeychainKeyById`). It is not in the mapper, and because it is a service-specific error it falls back to 500 if reached.

## 27. `POST /producerKeychains/:producerKeychainId/eservices`

Service: `authorizationService` → `addProducerKeychainEService`. Mapper: `addProducerKeychainEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /producerKeychains/:producerKeychainId/eservices`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `producerKeychainNotFound` | 404 | The target producer keychain no longer exists when `retrieveProducerKeychain` is called in `addProducerKeychainEService`. | Cannot happen — the add-drawer is opened from an already-loaded keychain in the current e-service detail flow (`ProviderEserviceKeychainsTab` passes the selected keychain id), and the FE never exposes a free-form field for an arbitrary `producerKeychainId`. | — | — |
| `eserviceNotFound` | 404 | The target e-service is missing from the read model before the link is created (`retrieveEService(eserviceId, readModelService)`). | Cannot happen — the action runs on the current e-service already loaded in the provider detail page, and the form never lets the user choose or type an unrelated `eserviceId`. | — | — |
| `eserviceAlreadyLinkedToProducerKeychain` | 409 | The e-service is already present in the keychain’s `eservices` list (`producerKeychain.data.eservices.includes(eserviceId)`). | Cannot happen — the drawer excludes already-linked keychains and the keychain list is filtered with `excludeKeychainsIdsList`, so the FE cannot submit a duplicate link from the normal UI. | — | — |
| `tenantNotAllowedOnProducerKeychain` | 403 | The current tenant is not the producer of the selected keychain (`assertOrganizationIsProducerKeychainProducer`). | Cannot happen — the add action is only rendered in the current tenant’s own keychain and e-service detail flows, and the UI never opens the drawer for another tenant’s keychain. | — | — |
| `tenantNotAllowedOnEService` | 403 | The current tenant does not own the target e-service (`assertOrganizationIsEServiceProducer`). | Cannot happen — the page is opened from the current tenant’s provider e-service detail and the FE never offers a link action for a different tenant’s e-service. | — | — |

## 28. `DELETE /producerKeychains/:producerKeychainId/eservices/:eserviceId`

Service: `authorizationService` → `removeProducerKeychainEService`. Mapper: `removeProducerKeychainEServiceErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `DELETE /producerKeychains/:producerKeychainId/eservices/:eserviceId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `producerKeychainNotFound` | 404 | The selected producer keychain no longer exists when `retrieveProducerKeychain` runs in `removeProducerKeychainEService`. | Cannot happen — the action is rendered from the currently selected keychain and the FE never accepts an arbitrary keychain ID in the remove form; it is tied to the row already shown in the e-service list. | — | — |
| `eserviceNotFound` | 400 | The target e-service is not present in the keychain’s `eservices` list (`!producerKeychain.data.eservices.find((id) => id === eserviceIdToRemove)`). | Cannot happen — the UI only renders the removal action for a row already listed in the current e-service keychains table, so the browser cannot submit a non-member `eserviceId`. | — | — |
| `tenantNotAllowedOnProducerKeychain` | 403 | The current tenant is not the producer of the selected keychain (`assertOrganizationIsProducerKeychainProducer`). | Cannot happen — the remove action is only available inside the current tenant’s own keychain detail flow, and the frontend never exposes another tenant’s keychain for this action. | — | — |

## 29. `GET /keys/:kid`

Service: `authorizationService` → `getJWKByKid`. Mapper: `getJWKByKidErrorMapper`. Roles: `M2M_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `jwkNotFound` | 404 | The requested JWK `kid` does not exist in the read model (`readModelService.getClientJWKByKId(kid)` returns `undefined`). | Cannot happen — the generator reports no BFF route for this process endpoint, and there is no normal UI flow in the frontend that calls `getJWKByKid` with a `kid` from the current screen. | — | — |

## 30. `GET /producerKeys/:kid`

Service: `authorizationService` → `getProducerJWKByKid`. Mapper: `getProducerJWKByKidErrorMapper`. Roles: `M2M_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | -------------------- | ---------------------- | ---------------- |
| `producerJwkNotFound` | 404 | The requested producer JWK `kid` does not exist in the read model (`readModelService.getProducerJWKByKId(kid)` returns `undefined`). | Cannot happen — this route is restricted to `M2M_ROLE` / `M2M_ADMIN_ROLE` in `validateAuthorization`, the generator found no BFF route, and the frontend contains no call site or UI flow for `getProducerJWKByKid` or `/producerKeys/:kid`. | — | — |
