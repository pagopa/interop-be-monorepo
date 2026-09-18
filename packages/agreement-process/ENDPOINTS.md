# Agreement Process: endpoint

Elenco degli endpoint esposti da `agreement-process`.

- Gli identificativi tra parentesi graffe sono parametri di path.
- Gli endpoint applicativi sono registrati in `src/routers/AgreementRouter.ts` tramite `agreementApi.agreementApi`.
- `/status` è registrato dal router health comune in `src/app.ts`.
- L'elenco segue l'ordine di dichiarazione nel router.

## Endpoint

1. `GET /status`

2. `POST /agreements/{agreementId}/submit`

3. `POST /agreements/{agreementId}/approve`

4. `POST /agreements/{agreementId}/unsuspend`

5. `POST /agreements/{agreementId}/consumer-documents`

6. `GET /agreements/{agreementId}/consumer-documents`

7. `GET /agreements/{agreementId}/consumer-documents/{documentId}`

8. `DELETE /agreements/{agreementId}/consumer-documents/{documentId}`

9. `POST /agreements/{agreementId}/suspend`

10. `POST /agreements/{agreementId}/reject`

11. `POST /agreements/{agreementId}/archive`

12. `POST /agreements`

13. `GET /agreements`

14. `GET /producers`

15. `GET /consumers`

16. `GET /agreements/{agreementId}`

17. `DELETE /agreements/{agreementId}`

18. `DELETE /internal/delegations/{delegationId}/agreements/{agreementId}`

19. `POST /internal/delegations/{delegationId}/agreements/{agreementId}/archive`

20. `POST /internal/agreement/{agreementId}/contract`

21. `POST /internal/agreement/{agreementId}/signedContract`

22. `POST /agreements/{agreementId}/update`

23. `POST /agreements/{agreementId}/upgrade`

24. `POST /agreements/{agreementId}/clone`

25. `POST /internal/compute/agreementsState`

26. `GET /agreements/filter/eservices`

27. `GET /tenants/{tenantId}/eservices/{eserviceId}/descriptors/{descriptorId}/certifiedAttributes/validate`
