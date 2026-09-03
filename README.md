# Registro Presenze

PWA locale-first per registrare le presenze di una squadra e sincronizzare un
file JSON su Nextcloud tramite WebDAV.

## Avvio locale

Requisiti: Node.js 24 o successivo.

```bash
npm install
npm run dev
```

L'app viene servita normalmente su `http://localhost:5173`.

Con `npm run dev`, un profilo locale vuoto viene inizializzato automaticamente
con un registro allenatore e cinque registri demo per coordinatore e
consultazione. I dati locali già presenti non vengono sovrascritti. Per testare
un avvio completamente vuoto:

```bash
VITE_DEV_DEMO_DATA=false npm run dev
```

I dati demo non vengono inclusi né inizializzati nella build di produzione.

## Verifiche

```bash
npm test
npm run build
```

La build di produzione viene generata in `dist/`.

## Prima configurazione dell’allenatore

Alla prima scelta della modalità allenatore, se sul dispositivo non esiste
ancora un registro, l’app propone due percorsi:

1. `Crea una nuova squadra`, per l’uso autonomo: apre la guida con società,
   squadra, allenatore, stagione, rosa e collegamento
   Nextcloud facoltativo;
2. `Apri una squadra condivisa`, quando il coordinatore ha già preparato il
   registro: richiede soltanto server Nextcloud, username e password
   applicativa, quindi legge squadra e configurazione direttamente dal JSON.

Se l’account vede un solo registro condiviso, questo viene aperto
automaticamente. Se ne vede più di uno, l’allenatore sceglie la squadra da un
elenco. Dopo l’accesso può riaprire lo stesso selettore toccando il nome della
squadra direttamente nella barra laterale su desktop, nella barra superiore su
mobile oppure usando `Impostazioni → Cambia squadra`.
Prima del passaggio l’app sincronizza le eventuali modifiche della squadra
attuale e impedisce il cambio se non riesce a metterle al sicuro su Nextcloud.

`Salta la guida` registra la scelta e apre la configurazione manuale. La guida
non ricompare automaticamente dopo essere stata completata o saltata. Può
essere riaperta da `Impostazioni → Configurazione guidata`.

Il criterio è un numero di versione conservato in IndexedDB. Flag assente e
nessun documento locale indicano una vera prima apertura. Se esiste già un
registro, l'installazione viene considerata automaticamente già configurata,
evitando di mostrare la guida agli utenti esistenti dopo un aggiornamento.

## Collegamento a Nextcloud

1. Installare l'app Nextcloud `WebAppPassword`.
2. Aprire come amministratore `Impostazioni → Impostazioni di amministrazione
   → WebAppPassword` e autorizzare l'origine completa della PWA, protocollo e
   porta compresi. Durante lo sviluppo è normalmente `http://localhost:5173`.
   L'origine va inserita in entrambi i campi separati: quello WebDAV e, nella
   sezione `Files sharing API`, in `Allowed origins for files sharing api`.
   Premere `Set origins` per ciascuna sezione modificata. Non aggiungere percorsi
   o una barra finale; più origini vanno separate da virgole.
3. Per ogni allenatore, creare una password applicativa revocabile nelle
   impostazioni di sicurezza Nextcloud.
4. Nell'app aprire `Impostazioni`, inserire indirizzo Nextcloud, nome utente,
   password applicativa e usare `attendance-tracker` come cartella remota.
5. Usare `Verifica e salva`, poi controllare che il JSON compaia nella cartella.

`Verifica e salva` termina con successo soltanto dopo avere verificato la
cartella e sincronizzato effettivamente il JSON. Se il collegamento funziona ma
la lettura o scrittura del file fallisce, l'errore WebDAV viene mostrato nelle
Impostazioni e lo stato resta `Errore cloud`.

Se Storage Share rifiuta ripetutamente le scritture `If-Match`, l'app passa
automaticamente alla protezione `Confronto e verifica Nextcloud`: rilegge e
unisce il JSON prima del caricamento e controlla nuovamente il contenuto dopo
il `PUT`. La modalità utilizzata è indicata nelle Impostazioni.

La cartella può trovarsi nella root Nextcloud oppure dentro altre cartelle:

```text
attendance-tracker/
├── u14__2026-2027.attendance.json
├── u16__2026-2027.attendance.json
└── u18__2026-2027.attendance.json
```

La password principale Nextcloud non deve essere inserita nella PWA.

### Dati ricordati sul dispositivo

La PWA conserva sempre in IndexedDB:

- indirizzo Nextcloud;
- nome utente;
- cartella remota `attendance-tracker`;
- modalità scelta e dati locali della squadra;
- riferimento alla cartella locale del coordinatore, quando il browser lo
  consente.

La password applicativa non viene scritta in IndexedDB o `localStorage`. Dopo
una verifica riuscita viene conservata nella `sessionStorage`, separatamente
per ruolo, server e username: in questo modo sopravvive ai refresh della stessa
scheda ma viene normalmente eliminata quando la scheda o la finestra della PWA
viene chiusa. `Resetta app` la rimuove immediatamente. I form usano inoltre gli
attributi standard `username` e `current-password`, quindi il browser o il
gestore password può proporre di salvarla e compilarla.

Come ogni dato accessibile a JavaScript nella stessa origine, la sessione non
può difendersi da uno script malevolo già in esecuzione nella PWA. Una protezione
di quel tipo richiederebbe un backend con cookie `HttpOnly` oppure uno sblocco
locale a ogni avvio. Per questo vengono usate soltanto password applicative
Nextcloud revocabili e non la password principale.

Quando una sincronizzazione parte senza password, l'app non mostra un errore:
apre direttamente una richiesta di credenziali. Se il browser ha conservato la
password potrà compilarla; altrimenti va inserita per quella sessione. Va sempre
usata una password applicativa Nextcloud revocabile, mai la password
principale.

Gli eventuali archivi cifrati creati dalle precedenti versioni di sviluppo
vengono eliminati automaticamente all'avvio.

Indirizzo, nome utente e cartella remota vengono invece registrati
automaticamente durante la digitazione; `Verifica e salva` serve soltanto a
provare la connessione della sessione corrente.

Per ragioni di sicurezza il browser non espone il percorso assoluto della
cartella locale. Può ricordare il riferimento alla cartella e, dopo un riavvio,
potrebbe chiedere di confermare nuovamente il permesso di lettura.

## Coordinatore e consultazione giocatrice

Le due modalità usano credenziali e configurazioni separate:

- il coordinatore cerca la cartella `attendance-tracker`, ne verifica la
  scrittura e può creare nuovi registri;
- la giocatrice non richiede alcuna cartella e cerca direttamente tutti i file
  `*.attendance.json` condivisi in lettura con il proprio account.

Se una giocatrice vede un solo file, il registro viene aperto automaticamente;
con più file viene mostrata la scelta delle squadre. I riepiloghi restano
sempre in sola lettura.

Un coordinatore collegato a Nextcloud apre `Pannello di controllo` per vedere
tutte le squadre, aggiungere un registro, aggiornarne l’elenco, aprirne la
gestione o eliminarlo da Nextcloud. Creazione, accessi e riepilogo vengono
mostrati nello stesso pannello: `Gestisci` espande la squadra senza cambiare
pagina. L’app crea, se necessario, la cartella remota e carica il JSON senza
sovrascrivere eventuali registri omonimi.

La sezione `Accessi e condivisioni` legge gli account visibili nella rubrica di
sistema CardDAV di Nextcloud. Il coordinatore seleziona graficamente una persona
e assegna al singolo file uno dei due ruoli, senza digitare username:

- `Allenatore`: lettura e modifica;
- `Giocatrice`: sola lettura.

Per ogni accesso esistente si può passare direttamente da sola lettura a
modifica, o revocarlo. Le operazioni passano dall'endpoint CORS dedicato di
WebAppPassword e riescono soltanto se l'account coordinatore è autorizzato a
condividere quel file. La rubrica rispetta le politiche Nextcloud: se non mostra
utenti, nelle impostazioni amministrative di condivisione va abilitato
`Consenti l’autocompletamento dei nomi utente nella finestra di condivisione`.

WebAppPassword mantiene separate le origini autorizzate per WebDAV e per la
Files sharing API. Se i registri si caricano ma il pannello condivisioni mostra
un errore CORS, quasi sempre è stato compilato soltanto il primo campo: aggiungere
l'origine mostrata dalla PWA anche a `Allowed origins for files sharing api`.
La lettura della rubrica CardDAV usa invece l’autorizzazione WebDAV/CalDAV.

Nel campo `Link Nextcloud` il coordinatore può incollare il solo indirizzo del
server oppure il link di una cartella. L’app cerca `attendance-tracker` in modo
ricorsivo tramite `SEARCH` WebDAV, senza esplorare e scaricare i file. Se trova
più cartelle mostra i percorsi fra cui scegliere; se non ne trova, crea la
sottocartella nel percorso indicato. Prima di salvare la connessione verifica
realmente i permessi creando e rimuovendo un piccolo file temporaneo.

Il coordinatore offre anche due modalità di caricamento:

1. collegamento WebDAV con l'account Nextcloud, che legge i file
   `*.attendance.json` per i quali l'utente dispone del permesso;
2. selezione della cartella locale già sincronizzata da Nextcloud Desktop.

Nel collegamento WebDAV la giocatrice può incollare il link ricevuto oppure il
semplice indirizzo del server Nextcloud. L’app cerca automaticamente tutti i
registri leggibili dal suo account, anche se sono file singoli condivisi e non
appartengono a una cartella `attendance-tracker` visibile.

- Se il link indica una cartella, l'app legge i registri presenti in quella
  cartella: è il flusso previsto per il coordinatore.
- Se il link indica un file nella radice o il server, l'app cerca
  automaticamente tutti i registri accessibili dall'account: è il flusso
  previsto per la giocatrice che riceve un singolo file condiviso.
- Se viene trovato un solo registro, il dettaglio della squadra si apre
  automaticamente; con più registri viene mostrata la scelta delle squadre.

Non è necessario ricavare o digitare manualmente il percorso WebDAV. La ricerca
resta limitata ai file che Nextcloud rende leggibili per l'account autenticato.

### Link rapidi per ruolo

I tre comandi `Link giocatrice`, `Link allenatore` e `Link coordinatore` sono
disponibili nella home del coordinatore, nel pannello di controllo delle squadre
e nella sezione Nextcloud `Link rapidi per ruolo`. Su un dispositivo non ancora
configurato ciascun collegamento apre direttamente il proprio flusso e
precompila l'indirizzo del server:

```text
# giocatrice
https://davidaffo.github.io/attendance-tracker/#/consultazione?nextcloud=...&role=viewer

# allenatore
https://davidaffo.github.io/attendance-tracker/#/allenatore/squadra-condivisa?nextcloud=...&role=coach

# coordinatore
https://davidaffo.github.io/attendance-tracker/#/coordinatore?nextcloud=...&role=coordinator
```

I link non contengono username, password o nomi delle squadre: dopo l'accesso,
ciascun account vede soltanto i registri autorizzati dai permessi Nextcloud. Se
il dispositivo è già configurato, ruolo e parametro cloud del link vengono
ignorati e l'app apre normalmente il ruolo e i dati salvati. I vecchi link
senza parametro `role` restano compatibili e mostrano la scelta del ruolo.

I dati di collegamento della vista in sola lettura sono conservati separatamente
da quelli dell'allenatore e del coordinatore; la password resta esclusa. Dopo il caricamento
vengono mostrati il sommario delle squadre accessibili e, per ciascuna squadra,
riepilogo stagionale, conteggi e percentuali per atleta e matrici mensili.

L'ultimo insieme di squadre caricato viene conservato in IndexedDB insieme a
data e sorgente del caricamento. Alla riapertura della PWA l'utente vede
quindi subito l'ultimo riepilogo come copia provvisoria, anche offline. Quando
la rete è disponibile, l’app aggiorna sempre i registri da Nextcloud
all’apertura della modalità; la password applicativa viene richiesta soltanto
se non è già disponibile nella sessione della scheda.
La cache Nextcloud è legata a server, username e percorso selezionato: cambiando
account o collegamento, i riepiloghi precedenti non vengono mostrati.

Se l'ultima sorgente era una cartella locale, la PWA conserva anche il
riferimento sicuro alla cartella e prova a rileggerla automaticamente. Il
browser può richiedere una nuova conferma del permesso. Se l'ultima sorgente era
Nextcloud, viene mostrata la copia locale e `Aggiorna da Nextcloud` richiede la
password soltanto quando viene premuto.

La selezione diretta di una cartella richiede un browser desktop compatibile
con File System Access API, come Chrome o Edge. Negli altri browser viene usato
il selettore di directory disponibile.

### Dataset dimostrativo

La cartella
[`resources/nextcloud-demo-2026-2027`](resources/nextcloud-demo-2026-2027)
simula una cartella Nextcloud completa: contiene cinque squadre, dati sintetici
e allenamenti distribuiti da agosto 2026 a luglio 2027. Può essere selezionata
direttamente con `Coordinatore → Cartella locale`.

Per rigenerare gli stessi file in modo deterministico:

```bash
npm run generate:demo
```

## Navigazione

Le sezioni hanno indirizzi distinti (`#/allenatore/registro`,
`#/allenatore/impostazioni`, `#/coordinatore`, `#/consultazione` e i dettagli
delle squadre).
Indietro, Avanti, apertura diretta e ricaricamento funzionano anche nella PWA
installata e su hosting statici privi di fallback, come GitHub Pages.

## Allenamenti previsti e uscite anticipate

Ogni squadra può avere uno o più giorni settimanali di allenamento. La
panoramica segnala la seduta prevista oggi e le date passate ancora prive di
una sessione; ciascuna data può essere aperta per compilare il registro oppure
ignorata, per esempio in caso di festività o allenamento annullato.

Per le squadre create e condivise dal coordinatore, soltanto il coordinatore
può modificare i giorni settimanali. L’allenatore può comunque compilare o
ignorare le sessioni previste. Il flag `U` (uscita anticipata) è indipendente
dallo stato di presenza e dispone di conteggio e percentuale propri nei
riepiloghi mensili e stagionali.

Il coordinatore con accesso in scrittura può ignorare direttamente gli avvisi
oppure usare `Entra come allenatore` per aprire la squadra e compilarne le
sessioni. Le date ignorate fanno parte del registro condiviso e scompaiono
anche per l’allenatore al successivo aggiornamento da Nextcloud.

Le stesse operazioni sono disponibili per i registri aperti tramite
`Cartella locale`: se il browser concede l’accesso in scrittura, le modifiche
vengono salvate direttamente nel file `.attendance.json`. Il selettore manuale
di file usato come ripiego nei browser non compatibili resta in sola lettura.

## Pubblicazione su GitHub Pages

Il repository è predisposto per pubblicare automaticamente
`https://davidaffo.github.io/attendance-tracker/`.

1. Fare commit e push delle modifiche sul branch `main`.
2. Su GitHub aprire `Settings → Pages`.
3. In `Build and deployment → Source` selezionare `Deploy from a branch`.
4. Selezionare il branch `main`, la cartella `/docs` e premere `Save`.
5. In Nextcloud/WebAppPassword autorizzare l'origine
   `https://davidaffo.github.io`.

La directory `docs/` contiene la build pubblicata con base
`/attendance-tracker/`. Il workflow [deploy-pages.yml](.github/workflows/deploy-pages.yml)
esegue test e build e controlla che la copia versionata in `docs/` sia
aggiornata. Non avvia un secondo deployment concorrente.

Prima di ogni commit che modifica l'app, rigenerare la build:

```bash
npm run build:pages
npm run verify:pages
```

Il codice pubblicato non contiene credenziali o JSON delle squadre: questi
restano nell'archivio locale del browser e su Nextcloud.

La PWA controlla automaticamente la presenza di nuove versioni all’avvio,
quando torna online, quando viene riaperta e ogni trenta minuti. Se trova un
aggiornamento mostra `Nuova versione disponibile` con il pulsante
`Aggiorna ora`. Il comando `Controlla aggiornamenti`, sempre visibile, permette
anche di forzare manualmente il controllo.

## Backup e ripristino della squadra

L'allenatore può scaricare una copia completa da
`Impostazioni → Backup e ripristino → Scarica backup JSON`.

Il pulsante `Ripristina da JSON` è disponibile:

- nella stessa sezione delle Impostazioni;
- nella prima schermata della configurazione guidata;
- nella configurazione manuale mostrata quando non esiste ancora un registro.

Prima del ripristino l'app valida lo schema del file e mostra un'anteprima con
squadra, stagione, numero di atlete, allenamenti e data di aggiornamento. Il
registro locale viene sostituito soltanto dopo una conferma esplicita.

Il ripristino non modifica immediatamente Nextcloud. La sincronizzazione
automatica resta sospesa e lo stato viene mostrato come backup da pubblicare.
Se la copia ripristinata deve diventare anche la copia cloud, l'allenatore deve
premere volontariamente `Pubblica il ripristino` nelle Impostazioni. In quel
momento il file remoto della stessa squadra e stagione viene aggiornato.

## Ripristino completo

Il comando `Resetta app`, disponibile nell’intestazione comune di allenatore,
coordinatore e giocatrice e anche nelle Impostazioni, permette di cancellare
dopo una doppia conferma:

- registro locale e sessioni;
- configurazioni separate di allenatore, coordinatore e giocatrice;
- cache dei riepiloghi in sola lettura;
- riferimento alla cartella locale;
- modalità selezionata e stato della configurazione guidata.

Dopo il reset la PWA viene ricaricata sulla scelta iniziale allenatore,
coordinatore o giocatrice. Non vengono cancellati i file già sincronizzati su
Nextcloud né le password conservate dal password manager del browser.
