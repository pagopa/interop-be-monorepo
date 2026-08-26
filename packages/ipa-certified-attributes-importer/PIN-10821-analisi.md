# PIN-10821, perché un errore interrompe l'importazione degli attributi IPA

Documento temporaneo di analisi. Da rimuovere prima della PR.

## Il problema in breve

Il job `ipa-certified-attributes-importer` legge i dati del registro IPA e aggiorna i tenant già presenti sulla piattaforma. Per ogni tenant crea gli attributi certificati IPA mancanti, aggiunge quelli che il tenant deve avere e revoca quelli che non deve più avere.

Il ticket segnala questo problema: quando `tenant-process` restituisce un errore durante l'aggiunta degli attributi certificati IPA a un tenant, il job interrompe l'intera esecuzione. I tenant successivi non vengono aggiornati e la fase che revoca gli attributi non parte.

Esempio: il job deve aggiornare i tenant A, B e C. A viene aggiornato. B restituisce 409. Il job non prova ad aggiornare C e non esegue nessuna revoca. Il comportamento richiesto è registrare l'errore di B e continuare con C e con le revoche.

## Termini usati nel documento

- Tenant: l'organizzazione registrata sulla piattaforma. Il modello è in `packages/models/src/tenant/tenant.ts`.
- External id del tenant: la coppia `origin` e `value` che identifica il tenant in un sistema esterno. Il modello `ExternalId` è in `packages/models/src/tenant/tenant.ts`.
- Tenant IPA: non esiste un tipo di tenant chiamato IPA. In questo documento indica un tenant con `externalId.origin = "IPA"`.
- Attributo certificato IPA: un oggetto `Attribute` con `kind = "Certified"` e `origin = "IPA"`. Il modello è in `packages/models/src/attribute/attribute.ts`.
- Aggiungere un attributo a un tenant: rendere attivo quell'attributo nella lista degli attributi certificati del tenant. Il job lo fa chiamando `tenant-process` tramite `internalUpsertTenant`.
- Revocare un attributo: rendere non più attivo un attributo certificato già presente sul tenant. Il job lo fa tramite `internalRevokeCertifiedAttribute`.
- Read model: il database usato per leggere lo stato corrente. Viene aggiornato in modo asincrono a partire dagli eventi scritti nell'event store.
- Polling: dopo una scrittura riuscita, il job rilegge più volte il read model finché vede la nuova versione del tenant.

La costante che associa il valore `IPA` alle pubbliche amministrazioni è `PUBLIC_ADMINISTRATIONS_IDENTIFIER` in `packages/models/src/constants.ts`.

## Dati letti dal job

Il job scarica dal registro IPA quattro dataset: enti, AOO, UO e categorie. La lettura e la conversione dei record sono in `packages/ipa-certified-attributes-importer/src/services/openDataExtractor.ts`. `getRegistryData()` unisce enti, AOO e UO in una sola lista in `packages/ipa-certified-attributes-importer/src/services/openDataService.ts`.

Il job legge poi dal read model, tramite `packages/ipa-certified-attributes-importer/src/services/readModelServiceSQL.ts`:

- tutti gli attributi certificati con `origin = "IPA"`;
- tutti i tenant con `externalId.origin = "IPA"`.

Questi dati formano lo stato iniziale usato per decidere cosa fare. Il job esegue altre letture durante il polling, ma non ricalcola le operazioni già decise usando i dati più recenti.

## Cosa fa una run

1. Scarica i dataset IPA.
2. Legge dal read model gli attributi certificati IPA e i tenant con external id IPA.
3. Per ogni record IPA associato a un tenant della piattaforma, calcola quali attributi certificati IPA quel tenant dovrebbe avere.
4. Crea nel registro degli attributi gli attributi certificati IPA che ancora non esistono.
5. Chiama `internalUpsertTenant` una volta per ogni aggiornamento pianificato. Ogni chiamata può aggiungere uno o più attributi certificati IPA allo stesso tenant e può aggiungere un identificativo ISTAT.
6. Dopo ogni risposta riuscita, se è presente l'header `x-metadata-version`, attende che il read model mostri quella versione; se l'header manca, registra un warning e continua senza polling.
7. Calcola quali attributi certificati IPA attivi devono essere revocati.
8. Chiama `internalRevokeCertifiedAttribute` per ogni attributo da revocare e attende di nuovo l'aggiornamento del read model.

Le chiamate sono eseguite una dopo l'altra, non in parallelo.

## Perché il job si interrompe

I cicli che chiamano `internalUpsertTenant` e `internalRevokeCertifiedAttribute` non hanno un `try/catch` per il singolo tenant o per il singolo attributo. Se una chiamata fallisce, l'errore esce dal ciclo e arriva al solo `catch` generale di `packages/ipa-certified-attributes-importer/src/index.ts`.

Lo stesso accade se la chiamata riesce ma fallisce il polling successivo. In questo caso la modifica può essere stata salvata correttamente, ma il job si interrompe perché non l'ha vista nel read model entro il numero previsto di tentativi.

Le conseguenze sono:

- un errore durante `internalUpsertTenant` impedisce gli aggiornamenti dei tenant successivi e impedisce l'avvio di tutte le revoche;
- un errore durante `internalRevokeCertifiedAttribute` impedisce le revoche successive;
- un errore durante uno dei due polling produce le stesse interruzioni, anche se la scrittura può essere riuscita;
- il `catch` generale registra l'errore ma non lo rilancia, quindi una run incompleta può terminare con exit code 0 e apparire riuscita allo scheduler.

Questo è il difetto principale di PIN-10821.

## Perché `internalUpsertTenant` può restituire 409

Il body del 409 deve essere controllato. Il solo status HTTP non identifica la causa.

| Codice | Errore | Significato |
| --- | --- | --- |
| `005-0014` | `certifiedAttributeAlreadyAssigned` | Almeno uno degli attributi inviati dal job risulta già attivo sul tenant |
| `005-10034` | `eventConflictError` | La versione dell'evento che `tenant-process` prova a inserire esiste già nell'event store |

### 409 `005-0014`: attributo già attivo

Il job decide quali attributi aggiungere confrontando i dati IPA con lo stato iniziale letto dal read model. Quando `tenant-process` riceve la richiesta, legge nuovamente il tenant. Se uno degli attributi richiesti risulta già attivo, `assignCertifiedAttribute()` genera `certifiedAttributeAlreadyAssigned`.

Questo può accadere in tre casi:

1. il read model usato dal job era in ritardo e non mostrava ancora un attributo già aggiunto;
2. un altro processo ha aggiunto l'attributo dopo il calcolo del job;
3. il job ha pianificato due aggiornamenti equivalenti per lo stesso tenant.

L'errore viene generato prima della scrittura degli eventi. Se la richiesta contiene anche altri attributi mancanti o un identificativo ISTAT, nessuno di questi aggiornamenti viene salvato.

Per questo motivo ignorare il 409 e passare al tenant successivo fa continuare la run, ma può lasciare incompleto il tenant che ha restituito l'errore.

### 409 `005-10034`: versione dell'evento già presente

`tenant-process` legge dal read model la versione corrente del tenant e usa quella versione per creare il nuovo evento. L'event store può però essere più aggiornato del read model.

Esempio: il read model mostra la versione 10, ma l'event store contiene già la versione 11. `tenant-process` parte dalla versione 10 e prova a inserire una nuova versione 11. PostgreSQL trova la versione 11 già presente e restituisce il duplicate key `23505` sul vincolo `events_stream_id_version_key`. `EventRepository` converte questo errore in `eventConflictError`, esposto come HTTP 409.

Lo stesso errore può verificarsi se due processi provano a modificare contemporaneamente lo stesso tenant partendo dalla stessa versione.

`internalUpsertTenant` scrive tutti gli eventi della richiesta in una sola transazione. Se avviene il conflitto, la transazione viene annullata e nessun aggiornamento della richiesta viene salvato.

Il dettaglio di `eventConflictError` contiene `CID`, `SID` e `SV`: correlation id, id del tenant nell'event store e versione usata dalla richiesta. Questi valori servono per verificare il conflitto nei log e nello stream degli eventi.

Il test di integrazione presente nel worktree riproduce il caso in cui il read model mostra una versione precedente a quella dell'event store. Questo dimostra che la causa è possibile, ma non dimostra che sia la causa dei 409 osservati in produzione.

## Perché i 409 sono comparsi negli ultimi giorni

Il commit `5bbee483a` del 24 agosto 2026 ha introdotto `eventConflictError`. Da quel commit, un duplicate key sulla versione di uno stream viene restituito come 409 `005-10034`. Prima veniva restituito come errore generico 500.

Il ticket è stato creato il 26 agosto 2026. È quindi possibile che conflitti già esistenti siano diventati visibili come 409 dopo il nuovo mapping. Non è però possibile sapere se i 409 citati dal ticket siano `005-0014` oppure `005-10034` senza leggere `errors[].code` nel body o nei log delle run.

Per cercare lo stesso conflitto prima del 24 agosto, nei log di `tenant-process` bisogna cercare `Error creating multiple events`.

## Richieste duplicate create dallo stesso job

`getRegistryData()` concatena enti, AOO e UO senza eliminare i record con lo stesso `(origin, originId)`. `getTenantUpsertData()` crea un elemento per ogni record ricevuto. Di conseguenza, due record con lo stesso identificativo possono produrre due chiamate `internalUpsertTenant` per lo stesso tenant.

La prima chiamata può aggiungere l'attributo. La seconda può ricevere 409 `005-0014` perché l'attributo è ormai attivo.

I test in `packages/ipa-certified-attributes-importer/test/duplicateInstitutions.test.ts` confermano che due record uguali producono due aggiornamenti pianificati. Non abbiamo però verificato che i dataset delle run di produzione contenessero realmente quei duplicati.

## Altri problemi confermati nello stesso flusso

### La creazione degli attributi ha lo stesso problema

Gli attributi certificati IPA mancanti vengono creati uno alla volta. Anche questo ciclo non gestisce l'errore del singolo attributo. Se una creazione fallisce, le creazioni successive, tutti gli aggiornamenti dei tenant e tutte le revoche vengono saltati.

Dopo le creazioni, il job attende che tutti i nuovi attributi compaiano nel read model. Questo ciclo non ha un numero massimo di tentativi. Se un attributo non viene proiettato, il job può restare in attesa senza fine.

### I log non identificano chiaramente l'operazione fallita

Prima della chiamata esiste un log informativo con il tenant e i codici degli attributi. Il `catch` generale registra poi soltanto l'errore tecnico. Non esiste un singolo log di errore che riporti insieme operazione, tenant, attributi, status HTTP, codice applicativo e dettaglio.

### Una risposta senza metadata permette altre richieste sullo stesso tenant

`assignNewAttributes()` e `revokeAttributes()` controllano la presenza di `x-metadata-version`. Se l'header manca, registrano un warning e continuano senza polling. Una richiesta successiva sullo stesso tenant può quindi partire prima che il read model mostri la modifica appena salvata e può usare una versione vecchia. Gli altri tenant non sono coinvolti.

### Una run incompleta può risultare riuscita

Il `catch` generale non rilancia l'errore e non imposta un exit code diverso da zero. Lo scheduler può quindi considerare riuscita una run che ha saltato tenant o revoche.

### La revoca può restituire un 409 non dichiarato nel contratto

La route `internalRevokeCertifiedAttribute` può restituire `eventConflictError` come 409 tramite il mapper comune degli errori. Il 409 non è però dichiarato tra le risposte della DELETE in `packages/api-clients/open-api/tenantApi.yml`.

## Correzione richiesta dal ticket

Per rispettare PIN-10821, il job deve:

1. limitare il numero di tentativi del polling eseguito dopo la creazione degli attributi;
2. deduplicare record e attributi IPA uguali prima di creare attributi o costruire gli aggiornamenti;
3. gestire separatamente l'errore di ogni chiamata `internalUpsertTenant`;
4. registrare tenant, attributi, status HTTP, codice applicativo e dettaglio dell'errore;
5. continuare con il tenant successivo;
6. eseguire comunque la fase di revoca dopo aver provato tutti gli aggiornamenti dei tenant;
7. gestire separatamente anche l'errore di ogni revoca;
8. distinguere nei log un errore della chiamata da un errore del polling;
9. produrre alla fine una sola riga con i contatori essenziali.

Questa modifica impedisce che un errore fermi il resto della run, ma non recupera il tenant fallito. Retry dei 409, idempotenza di `internalUpsertTenant`, gestione separata degli errori di creazione e correzioni di mapper e OpenAPI sono interventi raccolti in `PIN-10821-bug-fuori-scope.md`.

Il ticket non specifica se una run che completa tutti i tentativi ma contiene errori debba terminare con exit code 0 oppure con un exit code diverso da zero. La scelta deve essere esplicita, altrimenti lo scheduler non può distinguere una run completa da una run parziale.

Il polling successivo alla creazione degli attributi rientra nel ticket perché non ha un limite e può impedire alla run di terminare. La gestione separata dell'errore di ogni creazione resta fuori scope.

## Verifiche eseguite

- I cinque test in `packages/ipa-certified-attributes-importer/test/errorResilience.test.ts` falliscono perché il job si ferma al primo errore HTTP o al primo errore del polling.
- I due test in `packages/ipa-certified-attributes-importer/test/duplicateInstitutions.test.ts` falliscono perché due record uguali producono due aggiornamenti dello stesso tenant.
- I 22 test di `packages/tenant-process/test/api/internalUpsertTenant.test.ts` passano e confermano che `005-0014` e `005-10034` vengono restituiti come HTTP 409.
- Gli 8 test di `packages/tenant-process/test/integration/internalUpsertTenant.test.ts` passano e confermano il conflitto quando il read model è indietro rispetto all'event store.

## Conclusione

Il problema principale è semplice: un errore relativo a un tenant viene trattato come errore dell'intera run. Il job deve invece registrare il fallimento, continuare con gli altri tenant ed eseguire comunque le revoche. I 409 possono essere causati da un attributo già attivo oppure da un conflitto sulla versione degli eventi. Senza il codice presente nel body del 409 non possiamo sapere quale dei due casi sia avvenuto nelle run di produzione.
