# BFF errors mapping

> **Not documented**:
> - Authentication: —
> - Infrastructure: `selfcareEntityNotFilled`, `attributeNotExists`, `dynamoReadingError`, `missingInterface`, `noDescriptorInEservice`, `missingDescriptorInClonedEservice`, `samlNotValid`, `missingSelfcareId`, `privacyNoticeVersionIsNotTheLatest`, `missingActivePurposeVersion`, `activeAgreementByEserviceAndConsumerNotFound`, `purposeIdNotProvided`, `cannotGetKeyWithClient`, `clientAssertionPublicKeyNotFound`, `delegatedEserviceNotExportable`, `missingUserRolesInIdentityToken`, `noVersionInEServiceTemplate`, `delegationContractNotFound`
> - Unused (no throw site in the BFF): `eserviceIsNotDraft`, `invalidJwtClaim`, `eserviceTemplateIsNotPublished`, `tooManyDescriptorForInterfaceWithTemplate`, `eserviceTemplateInterfaceNotFound`, `invalidInterfaceFile`, `eserviceTemplateInterfaceDataNotValid`, `invalidEserviceInterfaceFileDetected`, `operationForbidden`
>
> Routers covered: `selfcareRouter`.

## `userNotFound`

User not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `selfcareRouter` | `GET /users/{userId}` | `getSelfcareUser` throws `userNotFound` when Selfcare returns no user for the requested `userId` and the current institution. | **CAN HAPPEN** — a client can retain a member reference after that user's Selfcare account is removed. The client members list can still show the reference because the BFF supplies a fallback compact user, and the details link uses its user ID. | **Data precondition:** Tenant A has an admin user and a client containing member U; U's Selfcare account has been removed, but the client still retains U's ID.<br>1. Sign in as tenant A's admin.<br>2. Open **Fruizione** > **API e-service**.<br>3. In the row for the client containing U, click **Visualizza**.<br>4. Select **Membri del client**, then click **Visualizza** in U's row. The details page requests U and triggers the error. | 🟡 **Medium resolution**<br>1. As tenant A's admin, return to **Membri del client**.<br>2. In U's row, open the actions menu, choose **Rimuovi dal client**, then confirm with **Conferma**.<br>3. If U should remain a member, restore U's account in Selfcare before adding U to the client again. |
