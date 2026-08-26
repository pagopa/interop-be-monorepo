# Bug trovati fuori dallo scope di PIN-10821

Questo documento raccoglie i problemi confermati durante l'analisi di PIN-10821 che non servono per risolvere il ticket. Ogni sezione può diventare un ticket separato.

## 1. Un errore durante la creazione di un attributo interrompe la fase

Codice coinvolto: `packages/ipa-certified-attributes-importer/src/services/ipaCertifiedAttributesImporterService.ts`, funzione `createNewAttributes()`.

### Problema

Le chiamate `createInternalCertifiedAttribute` sono eseguite in un ciclo senza gestione locale. Il primo errore interrompe le creazioni successive, tutti gli aggiornamenti dei tenant e tutte le revoche.

### Correzione consigliata

- Gestire separatamente ogni creazione e continuare con gli attributi successivi.
- Attendere soltanto gli attributi la cui creazione è riuscita o il cui stato è stato verificato.
- Registrare le creazioni riuscite e fallite.

### Test utili

- Un errore durante una creazione non impedisce le creazioni successive.
- Un errore durante una creazione non inserisce l'attributo fallito tra quelli da attendere nel read model.

Il limite del polling e il caso della lista vuota sono inclusi in PIN-10821, perché il job deve sempre terminare l'attesa iniziale.

## 2. `internalUpsertTenant` non è idempotente per gli attributi già attivi

Codice coinvolto: `packages/tenant-process/src/services/tenantService.ts`, funzione `internalUpsertTenant()`.

### Problema

La descrizione OpenAPI dell'endpoint dice che aggiunge gli attributi mancanti. L'implementazione invece chiama `assignCertifiedAttribute()` per ogni attributo richiesto e genera `certifiedAttributeAlreadyAssigned` quando ne trova uno già attivo.

La richiesta può contenere più attributi e identificativi ISTAT. Se un solo attributo è già attivo, l'errore viene generato prima di `repository.createEvents()` e nessuna modifica del payload viene applicata.

### Correzione consigliata

- Ignorare gli attributi già attivi.
- Applicare gli attributi mancanti o revocati e gli identificativi ancora necessari.
- Restituire successo quando lo stato richiesto è già presente.
- Non introdurre una chiamata separata a `internalUpsertTenant` con `certifiedAttributes: []` soltanto per aggiornare gli identificativi ISTAT.

Gli identificativi remoti identici sono già gestiti come no-op. Il test `Should NOT add the remoteId if the Tenant already has it` conferma che l'endpoint restituisce la versione invariata e non crea eventi. Questa parte non deve essere modificata.

### Test utili

- Un payload con un attributo già attivo e uno mancante applica quello mancante.
- Un payload con un attributo già attivo e un nuovo identificativo ISTAT applica l'identificativo.
- Un payload completamente allineato restituisce successo senza nuovi eventi.

## 3. I mapper interni restituiscono 500 per errori che dovrebbero essere 404

Codice coinvolto: `packages/tenant-process/src/utilities/errorMappers.ts` e `packages/tenant-process/src/services/tenantService.ts`.

### Problemi

- `retrieveTenantByExternalId()` genera `tenantNotFoundByExternalId`, ma i mapper di `internalAssignCertifiedAttribute`, `internalUpsertTenant` e `internalRevokeCertifiedAttribute` gestiscono `tenantNotFound`. L'errore reale non viene riconosciuto e termina come 500.
- La revoca può generare `attributeNotFound`, ma `internalRevokeCertifiedAttributeErrorMapper` gestisce soltanto `attributeNotFoundInTenant`. Anche questo caso termina come 500.
- Alcuni test API simulano `tenantNotFound`, che non è l'errore realmente generato da queste route.

### Correzione consigliata

Allineare ogni mapper agli errori realmente generati dalla relativa route e correggere i dati errati nei test API esistenti.

## 4. Il contratto OpenAPI delle route interne è incompleto

Codice coinvolto: `packages/api-clients/open-api/tenantApi.yml`.

### Problemi

- La POST `internalAssignCertifiedAttribute` può restituire 404 per tenant o attributo non trovato, ma il contratto non dichiara la risposta 404.
- La DELETE `internalRevokeCertifiedAttribute` può restituire `eventConflictError` come 409 tramite il mapper comune, ma il contratto non dichiara la risposta 409.

### Correzione consigliata

Aggiornare il file OpenAPI, rigenerare i client e verificare le route coinvolte. Questo intervento può essere incluso nello stesso ticket dei mapper, perché riguarda gli stessi endpoint e gli stessi errori.

## 5. Descrizione e implementazione di `internalUpsertTenant` non concordano sulla creazione del tenant

Codice coinvolto: `packages/api-clients/open-api/tenantApi.yml` e `packages/tenant-process/src/services/tenantService.ts`.

### Problema

La descrizione OpenAPI di `POST /internal/tenants` dice che il tenant viene creato quando non esiste. L'implementazione chiama `retrieveTenantByExternalId()` e fallisce quando il tenant non viene trovato.

Prima di modificare il codice bisogna decidere quale comportamento è corretto. Non è sicuro cambiare la descrizione o creare automaticamente il tenant senza una decisione di dominio.

### Correzione consigliata

Aprire un ticket di allineamento del contratto. Se l'endpoint deve aggiornare soltanto tenant esistenti, correggere nome e descrizione. Se deve essere un vero upsert, definire i dati e gli eventi necessari per creare il tenant.

## Suddivisione consigliata dei prossimi ticket

1. Gestire separatamente gli errori delle chiamate di `createNewAttributes()`.
2. Rendere `internalUpsertTenant` idempotente per gli attributi già attivi.
3. Correggere insieme mapper interni e risposte OpenAPI mancanti.
4. Decidere e allineare il comportamento di creazione dichiarato da `internalUpsertTenant`.

## Elementi verificati che non richiedono una correzione

- `eventConflictError` è già convertito in HTTP 409 con codice `005-10034` dal mapper comune.
- Un identificativo remoto già presente non crea eventi e mantiene invariata la versione del tenant.
- Non serve introdurre un endpoint dedicato agli identificativi ISTAT per risolvere PIN-10821.
