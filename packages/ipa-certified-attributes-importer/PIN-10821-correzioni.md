# PIN-10821, proposta di correzione

Questo documento descrive soltanto la correzione richiesta da PIN-10821. Gli altri bug trovati durante l'analisi sono raccolti in `PIN-10821-bug-fuori-scope.md`.

## Obiettivo del ticket

Quando una chiamata per aggiornare un tenant fallisce, il job deve registrare l'errore e continuare con gli altri tenant. Un errore locale non deve interrompere la run né impedire la successiva fase di revoca.

Il ticket non richiede di recuperare nella stessa run l'operazione fallita. Retry, idempotenza di `internalUpsertTenant` e correzioni di `tenant-process` sono fuori scope.

## Problema attuale

`assignNewAttributes()` esegue una chiamata `internalUpsertTenant` per ogni elemento pianificato. La chiamata e il polling non hanno una gestione locale degli errori. Se uno dei due fallisce, il ciclo termina, gli aggiornamenti successivi non vengono eseguiti e la fase di revoca non inizia.

`revokeAttributes()` ha lo stesso problema. Un errore durante una revoca impedisce tutte le revoche successive.

Il `catch` generale in `src/index.ts` registra l'errore ma non lo rilancia e non imposta `process.exitCode`. Una run interrotta può quindi terminare con exit code 0.

## Correzione richiesta

### 1. Impedire che il polling iniziale resti bloccato

`createNewAttributes()` usa un `do...while` senza un numero massimo di tentativi. Se un attributo creato non compare nel read model, la run non arriva mai agli aggiornamenti dei tenant.

Il ciclo deve usare `defaultPollingMaxRetries`, già disponibile nella configurazione del job. Raggiunto il limite, deve registrare un warning e proseguire. Se non esistono attributi da creare, non deve iniziare il polling.

Questa modifica riguarda soltanto il limite dell'attesa. La gestione separata dell'errore di ogni chiamata `createInternalCertifiedAttribute` resta fuori scope.

### 2. Deduplicare i record IPA

`getRegistryData()` concatena enti, AOO e UO senza eliminare i duplicati. Due record uguali con lo stesso `(origin, originId)` possono produrre due aggiornamenti dello stesso tenant. Un ente duplicato può inoltre produrre due creazioni dello stesso attributo.

La correzione deve usare un `Set` con chiave `JSON.stringify({ origin, value: originId })` per i record e un secondo `Set` con chiave `JSON.stringify({ origin, code })` per gli attributi. In entrambi i casi deve mantenere il primo elemento e scartare i successivi. Non serve unire attributi o identificativi appartenenti a record diversi.

### 3. Gestire separatamente chiamata e polling

Ogni aggiornamento deve distinguere due risultati diversi:

1. la chiamata a `tenant-process` può fallire e in questo caso l'aggiornamento non è riuscito;
2. la chiamata può riuscire ma il read model può non mostrare in tempo la nuova versione e in questo caso il comando è riuscito, mentre la sincronizzazione non è stata confermata.

I due errori non devono essere gestiti dallo stesso `catch`, perché soltanto il primo indica che il comando non è riuscito.

Per ogni chiamata `internalUpsertTenant` il job deve:

1. eseguire la chiamata dentro un `try/catch` locale;
2. in caso di errore, registrare il fallimento, valutare se lo stato del tenant è affidabile e continuare con il tenant successivo;
3. in caso di successo, contare il comando come riuscito;
4. se la risposta contiene `x-metadata-version`, eseguire il polling dentro un secondo `try/catch`;
5. se il polling termina senza vedere la versione richiesta, registrare un warning e marcare il tenant come non sincronizzato;
6. se la risposta non contiene `x-metadata-version`, registrare un warning e marcare il tenant come non sincronizzato;
7. continuare sempre con gli altri tenant.

La stessa gestione deve essere applicata a ogni chiamata `internalRevokeCertifiedAttribute`.

Il tenant deve essere marcato come non sincronizzato quando il codice è `005-10034`, quando la richiesta non ha ricevuto una risposta HTTP o quando non è possibile sapere se la scrittura sia avvenuta. `005-0014` viene generato prima della scrittura e non richiede da solo questo blocco.

### 4. Non eseguire altre operazioni su un tenant non sincronizzato

`tenant-process` legge il tenant dal read model prima di creare un nuovo evento. Dopo un errore con esito incerto, un polling fallito o una risposta senza `x-metadata-version`, una nuova richiesta sullo stesso tenant potrebbe usare una versione vecchia.

Il job deve mantenere un `Set` con le chiavi dei tenant non sincronizzati. Prima di ogni upsert o revoca deve controllare il `Set`: se il tenant è presente, l'operazione viene saltata e conteggiata; gli altri tenant continuano normalmente.

Questo controllo serve anche quando manca `x-metadata-version`. Oggi `assignNewAttributes()` e `revokeAttributes()` registrano un warning e proseguono senza proteggere le eventuali richieste successive sullo stesso tenant.

### 5. Distinguere i diversi 409

Lo status HTTP 409 non identifica la causa. Il job deve leggere `errors[].code` dal body della risposta.

| Codice | Significato | Comportamento nel ticket |
| --- | --- | --- |
| `005-0014` | Almeno un attributo richiesto risulta già attivo | Registrare il fallimento dell'upsert e continuare |
| `005-10034` | Conflitto sulla versione dell'event stream | Registrare il fallimento, marcare il tenant come non sincronizzato e continuare |
| Altro codice o codice assente | Errore non classificato | Registrare status e dettaglio disponibili, bloccare il tenant se l'esito della scrittura è incerto e continuare |

Con l'attuale `internalUpsertTenant`, `005-0014` non può essere trattato sempre come un no-op. La richiesta può contenere più attributi e identificativi ISTAT, e il 409 annulla l'intero payload. Il ticket deve quindi registrarlo come fallimento locale. La modifica idempotente dell'endpoint è descritta nel documento dei bug fuori scope.

`eventConflictError` è già convertito in HTTP 409 con codice `005-10034`. Non serve modificare `EventRepository`.

### 6. Limitare il `catch` generale agli errori bloccanti

Il `catch` generale deve ricevere soltanto gli errori che rendono impossibile continuare la run, per esempio:

- configurazione non valida;
- impossibilità di inizializzare token, client o connessioni;
- impossibilità di scaricare i dataset IPA;
- impossibilità di leggere lo stato iniziale dal read model;
- errore inatteso fuori dalle gestioni locali.

Un errore bloccante deve essere registrato e deve impostare `process.exitCode = 1`. `cleanup()` deve essere eseguito sempre nel `finally`.

Gli errori degli upsert, delle revoche e del relativo polling non devono raggiungere il `catch` generale.

### 7. Produrre un resoconto finale

Il job deve accumulare un resoconto e stamparlo una sola volta alla fine della run.

Il resoconto deve restare minimo e contenere soltanto:

- upsert riusciti e falliti;
- revoche riuscite e fallite;
- warning;
- operazioni saltate.

Un comando riuscito seguito da un polling fallito deve incrementare sia i successi sia i warning. Il polling non deve trasformare retroattivamente il comando in un fallimento.

Ogni errore viene già registrato nel punto in cui avviene con tenant, operazione, status, codice e dettaglio. Non serve raggruppare nuovamente gli errori per codice nel resoconto finale e non serve introdurre un modello complesso. Alla fine basta una sola riga di log con i contatori.

La run deve completare tutte le operazioni possibili prima di decidere l'exit code. La raccomandazione è:

- exit code 0 se non esistono comandi falliti o operazioni saltate;
- exit code 1 se almeno un comando è fallito, almeno una operazione è stata saltata oppure si è verificato un errore bloccante;
- un warning di polling senza operazioni saltate non rende da solo la run fallita.

## Ordine di implementazione

1. Aggiungere un limite al polling di `createNewAttributes()` e saltarlo quando la lista è vuota.
2. Deduplicare record e attributi IPA con due `Set` prima di creare attributi o costruire i `TenantSeed`.
3. Introdurre pochi contatori e una funzione per estrarre status, codice e dettaglio dagli errori HTTP.
4. Introdurre il `Set` dei tenant non sincronizzati e condividerlo tra assegnazioni e revoche.
5. Separare la gestione della chiamata dalla gestione del polling in `assignNewAttributes()`.
6. Applicare la stessa gestione a `revokeAttributes()`.
7. Fare in modo che gli errori locali non impediscano l'avvio della fase di revoca.
8. Limitare il `catch` generale agli errori bloccanti e impostare correttamente `process.exitCode`.
9. Stampare una sola riga di riepilogo finale.

## Test necessari

- Il polling di `createNewAttributes()` termina dopo il numero massimo di tentativi.
- Una lista vuota di nuovi attributi non esegue attese.
- Due record IPA uguali producono un solo `TenantSeed` e un solo upsert.
- Due enti IPA uguali producono una sola creazione dell'attributo dell'ente.
- Un errore HTTP durante un upsert non impedisce gli upsert dei tenant successivi.
- Un errore HTTP durante un upsert non impedisce l'avvio della fase di revoca.
- Un errore durante una revoca non impedisce le revoche successive di altri tenant.
- `005-0014` e `005-10034` vengono conteggiati separatamente.
- `005-10034` blocca soltanto le operazioni successive sullo stesso tenant.
- Un polling fallito non trasforma il comando riuscito in fallimento e non blocca gli altri tenant.
- Dopo un polling fallito, le operazioni successive sullo stesso tenant vengono saltate.
- Una risposta senza `x-metadata-version` produce un warning e blocca soltanto le operazioni successive sullo stesso tenant.
- Il resoconto finale contiene conteggi coerenti per successi, fallimenti, warning e operazioni saltate.
- Un errore bloccante imposta un exit code diverso da zero.

Non servono test nuovi per mapper o OpenAPI, perché non vengono modificati in questo ticket.

## Risultato atteso

PIN-10821 è risolto quando il polling iniziale ha un limite e nessun errore relativo a un singolo tenant interrompe la run. Il job deve eliminare creazioni e aggiornamenti duplicati, provare tutti gli altri tenant, raggiungere la fase di revoca, registrare ogni esito e terminare con un riepilogo compatto.
