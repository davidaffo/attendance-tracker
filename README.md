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

## Verifiche

```bash
npm test
npm run build
```

La build di produzione viene generata in `dist/`.

## Prima configurazione dell'allenatore

Alla prima scelta della modalità allenatore, se sul dispositivo non esiste
ancora un registro, si apre una guida in cinque schermate:

1. spiegazione iniziale;
2. società, squadra, allenatore e stagione;
3. giorni abituali;
4. rosa;
5. collegamento Nextcloud facoltativo.

`Salta la guida` registra la scelta e apre la configurazione manuale. La guida
non ricompare automaticamente dopo essere stata completata o saltata. Può
essere riaperta da `Impostazioni → Configurazione guidata`.

Il criterio è un numero di versione conservato in IndexedDB. Flag assente e
nessun documento locale indicano una vera prima apertura. Se esiste già un
registro, l'installazione viene considerata automaticamente già configurata,
evitando di mostrare la guida agli utenti esistenti dopo un aggiornamento.

## Collegamento a Nextcloud

1. Installare l'app Nextcloud `WebAppPassword`.
2. Autorizzare l'origine completa della PWA, protocollo e porta compresi.
   Durante lo sviluppo è normalmente `http://localhost:5173`.
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

La cartella si trova direttamente nella root Nextcloud:

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

La password applicativa non viene registrata dall'app né scritta in IndexedDB.
Resta soltanto in memoria fino alla chiusura della pagina. I form usano gli
attributi standard `username` e `current-password`: il browser o il gestore
password del dispositivo può quindi proporre di salvarla e compilarla.

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

## Vista coordinatore

La modalità coordinatore offre due modalità di caricamento:

1. collegamento WebDAV con l'account Nextcloud del supervisore, che legge tutti
   i file `*.attendance.json` presenti in `attendance-tracker`;
2. selezione della cartella locale già sincronizzata da Nextcloud Desktop.

I dati di collegamento del supervisore sono conservati separatamente da quelli
dell'allenatore; la password resta esclusa. Dopo il caricamento vengono mostrati
il sommario di tutte le squadre e, per ciascuna squadra, riepilogo stagionale,
conteggi e percentuali per atleta e matrici mensili.

L'ultimo insieme di squadre caricato viene conservato in IndexedDB insieme a
data e sorgente del caricamento. Alla riapertura della PWA il coordinatore vede
quindi subito l'ultimo riepilogo, anche offline e senza reinserire la password.

Se l'ultima sorgente era una cartella locale, la PWA conserva anche il
riferimento sicuro alla cartella e prova a rileggerla automaticamente. Il
browser può richiedere una nuova conferma del permesso. Se l'ultima sorgente era
Nextcloud, viene mostrata la copia locale e `Aggiorna da Nextcloud` richiede la
password soltanto quando viene premuto.

La selezione diretta di una cartella richiede un browser desktop compatibile
con File System Access API, come Chrome o Edge. Negli altri browser viene usato
il selettore di directory disponibile.

## Navigazione

Le sezioni hanno indirizzi distinti (`#/allenatore/registro`,
`#/allenatore/impostazioni`, `#/coordinatore` e i dettagli delle squadre).
Indietro, Avanti, apertura diretta e ricaricamento funzionano anche nella PWA
installata e su hosting statici privi di fallback, come GitHub Pages.

## Pubblicazione su GitHub Pages

Il repository è predisposto per pubblicare automaticamente
`https://davidaffo.github.io/attendance-tracker/`.

1. Fare commit e push delle modifiche sul branch `main`.
2. Su GitHub aprire `Settings → Pages`.
3. In `Build and deployment → Source` selezionare `GitHub Actions`. Non lasciare
   `Deploy from a branch`: quella modalità pubblica i sorgenti Vite e produce una
   pagina vuota sui dispositivi che non hanno già una build in cache.
4. Aprire la scheda `Actions` e attendere il completamento del workflow
   `Verifica e pubblica la PWA`.
5. In Nextcloud/WebAppPassword autorizzare l'origine
   `https://davidaffo.github.io`.

Il workflow [deploy-pages.yml](.github/workflows/deploy-pages.yml) installa le
dipendenze, esegue i test, crea la build con base
`/attendance-tracker/` e pubblica `dist/`. Ogni successivo push su `main`
aggiorna automaticamente la PWA.

Per controllare localmente la stessa build:

```bash
npm run build:pages
```

Il codice pubblicato non contiene credenziali o JSON delle squadre: questi
restano nell'archivio locale del browser e su Nextcloud.

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

Da `Impostazioni → Ricomincia da zero` è possibile cancellare, dopo una doppia
conferma:

- registro locale e sessioni;
- configurazioni allenatore e coordinatore;
- cache dei riepiloghi del coordinatore;
- riferimento alla cartella locale;
- modalità selezionata e stato della configurazione guidata.

Dopo il reset la PWA viene ricaricata sulla scelta iniziale
allenatore/coordinatore. Non vengono cancellati i file già sincronizzati su
Nextcloud né le password conservate dal password manager del browser. Il
comando è disponibile anche nell'intestazione della modalità coordinatore.
