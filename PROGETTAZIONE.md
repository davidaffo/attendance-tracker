# Registro presenze — progettazione della PWA

**Stato:** progettazione approvata operativamente, prototipo MVP avviato  
**Versione:** 1.6
**Data:** 28 luglio 2026  
**Fonte analizzata:** `Registro stagionale.xlsx`

## 1. Decisione progettuale in breve

La soluzione consigliata è **una sola PWA**, utilizzabile da PC e mobile, che
usa Hetzner Storage Share/Nextcloud come archivio condiviso tramite WebDAV:

- gli allenatori mantengono gli account Nextcloud già esistenti;
- ogni allenatore accede soltanto alla cartella di squadra che gli è già stata
  assegnata;
- la PWA conserva una copia locale in IndexedDB, funziona offline e sincronizza
  un file JSON di squadra con Nextcloud;
- ogni squadra e stagione hanno un file separato;
- il coordinatore può leggere tutti i file direttamente via WebDAV con il
  proprio account supervisore oppure dalla cartella sincronizzata sul PC;
- la PWA costruisce localmente il sommario aggregato e i dettagli delle singole
  squadre.

Non è previsto un database centrale separato, né Supabase né un cloud server
dedicato. Nextcloud gestisce autenticazione, autorizzazioni alle cartelle,
trasferimento dei file, versioni e sincronizzazione desktop. La PWA gestisce i
dati applicativi contenuti nei JSON e i conflitti.

La PWA deve sostituire il foglio senza trasformarsi in un gestionale sportivo
generico. Il perimetro iniziale resta: configurazione essenziale, rosa, sessioni
di allenamento, presenze e riepiloghi.

## 2. Obiettivi

### 2.1 Obiettivi funzionali

1. Inserire gli stessi dati oggi tracciati nel file Excel.
2. Rendere la compilazione rapida su telefono durante o dopo l'allenamento.
3. Conservare la vista mensile a matrice, utile soprattutto su PC.
4. Calcolare automaticamente totali e percentuali mensili e stagionali.
5. Permettere al coordinatore di consultare una squadra o tutte le squadre.
6. Gestire in modo controllato copie locali, versioni remote e conflitti.
7. Esportare dati leggibili e portabili, senza dipendere per sempre da un
   fornitore.

### 2.2 Obiettivi di esperienza d'uso

- installabile come app su mobile e desktop;
- utilizzabile anche dal browser senza installazione;
- interfaccia in italiano;
- pochi passaggi per registrare una seduta;
- pulsanti grandi e selezione rapida dello stato;
- salvataggio automatico con stato di sincronizzazione sempre visibile;
- URL distinti per le sezioni e supporto alla cronologia Indietro/Avanti;
- nessuna schermata o campo non necessario al registro presenze.

## 3. Cosa contiene il file Excel

Il file è organizzato in 14 fogli:

- `Sommario`;
- dodici mesi, da `Agosto` a `Luglio`;
- `Impostazioni`.

### 3.1 Dati configurabili rilevati

| Area | Dato |
|---|---|
| Stagione | anno iniziale e anno finale calcolato |
| Allenatore | nome in un unico campo |
| Società | nome in un unico campo |
| Squadra | nome in un unico campo |
| Legenda | cinque codici e cinque descrizioni modificabili |
| Giorni abituali | selezione dei giorni della settimana |
| Rosa | ID progressivo e nome atleta in un unico campo |

La configurazione presente nel file analizzato usa la stagione 2025–2026 e
seleziona lunedì, martedì e giovedì come giorni abituali. Allenatore, società e
squadra non risultano compilati.

### 3.2 Stati di presenza predefiniti

| Codice | Significato |
|---|---|
| `P` | Presente |
| `A` | Assente |
| `R` | Ritardo |
| `E` | Impegno Pallavolistico |
| `I` | Infortunio |

Codice e descrizione sono modificabili nel foglio, quindi dovranno esserlo
anche nell'app. In prima versione si mantengono cinque stati ordinati, senza
aggiungere note, motivazioni o sottocategorie.

### 3.3 Struttura della rosa

Il modello predispone 32 righe atleta. Ogni atleta ha:

- un ID numerico progressivo;
- un nome visualizzato come testo unico.

L'app non deve avere il limite di 32 elementi. L'ID tecnico sarà stabile e
generato dal sistema; all'utente resterà visibile un semplice ordine di rosa.
Il nome rimane un campo unico, per non introdurre dati che il foglio non
richiede.

### 3.4 Registro mensile

Ogni foglio mensile incrocia:

- righe: atlete;
- colonne: tutti i giorni del mese;
- cella: uno dei cinque codici oppure vuoto.

Per ogni atleta sono calcolati:

- totale mensile per ciascuno stato;
- percentuale mensile per ciascuno stato.

Come nel file Excel, le percentuali di assenza (`A%`) e ritardo (`R%`) usano
una scala colore a tre punti con interpolazione:

| Percentuale | Verde | Giallo | Rosso |
|---|---:|---:|---:|
| `A%` | 0% | 20% | 33% e oltre |
| `R%` | 0% | 25% | 40% e oltre |

I colori originali sono verde `#00A933`, giallo `#FFFF00` e rosso `#FF0000`.
La stessa regola è applicata ai riepiloghi mensili e stagionali accessibili
all'allenatore e al coordinatore; le altre percentuali non ricevono una scala,
in coerenza con il foglio di origine.

Sono inoltre calcolati:

- totale degli allenamenti del mese;
- totale delle occorrenze di ciascuno stato nel mese;
- gli equivalenti totali stagionali nel foglio `Sommario`.

### 3.5 Regole di calcolo da preservare

Il foglio considera una data come allenamento se, in quella colonna, almeno una
atleta ha un valore non vuoto.

Per uno stato `S`:

```text
totale_stato_atleta = numero di registrazioni dell'atleta con stato S

percentuale_stato_atleta =
  totale_stato_atleta / numero totale di allenamenti della squadra
```

La percentuale usa quindi il totale degli allenamenti della squadra, non il
numero di celle compilate per la singola atleta. Se non esistono allenamenti la
percentuale deve essere `0`, mai un errore.

Il totale stagionale è la somma dei dodici mesi da agosto a luglio.

### 3.6 Osservazioni tecniche sul file ricevuto

- le celle destinate alla presenza non hanno una convalida Excel: i codici
  vengono digitati direttamente;
- il file viene usato esclusivamente come riferimento per campi, struttura e
  regole di calcolo;
- l'applicazione partirà vuota: non è prevista alcuna importazione o migrazione
  dei dati presenti nel file.

## 4. Perimetro della prima versione

### 4.1 Incluso

- accesso tramite gli account Nextcloud già esistenti;
- società e squadre;
- stagioni agosto–luglio;
- utilizzo delle cartelle di squadra e dei permessi già configurati in
  Nextcloud;
- rosa ordinabile e archiviabile;
- cinque stati configurabili;
- giorni settimanali abituali;
- creazione, modifica ed eliminazione di una sessione;
- compilazione delle presenze per sessione;
- vista mensile;
- riepilogo mensile e stagionale per atleta;
- riepilogo di squadra;
- vista coordinatore su tutte le squadre;
- funzionamento PWA e gestione delle modifiche offline;
- esportazione CSV ed Excel;
- backup e versionamento dei file tramite Storage Share.

### 4.2 Esplicitamente escluso

- chat e notifiche;
- convocazioni;
- calendario gare;
- statistiche tecniche di gioco;
- pagamenti e quote;
- documenti, fotografie o allegati;
- geolocalizzazione;
- firme;
- dettagli medici;
- profili atleta o accesso dei genitori;
- classifiche, badge o gamification;
- importazione o migrazione di dati da Excel;
- grafici decorativi che non aiutano la lettura dei dati.

Queste esclusioni possono cambiare solo dopo una richiesta esplicita, non
durante la realizzazione dell'MVP.

## 5. Modello operativo proposto

### 5.1 Un allenamento è una sessione esplicita

Nel foglio una sessione è dedotta dalla presenza di almeno un codice. Nell'app
sarà invece una riga esplicita con una data.

Questo evita tre ambiguità:

- una sessione con presenze non ancora completate può esistere;
- una giornata senza allenamento non entra per errore nei conteggi;
- una sessione annullata può essere eliminata senza cancellare celle una a una.

I giorni abituali servono solo a suggerire le date e a velocizzare la
creazione. Non generano automaticamente allenamenti conteggiati.

### 5.2 Flusso principale dell'allenatore

1. Apre l'app e trova la propria squadra.
2. Tocca `Registra allenamento`.
3. Conferma la data proposta, normalmente oggi.
4. Vede tutta la rosa.
5. Imposta lo stato di ogni atleta con un tocco.
6. Salva; online la modifica arriva subito al server, offline entra nella coda
   locale.
7. La schermata mostra `Salvato`, `Da sincronizzare` oppure `Conflitto`.

Scorciatoia prevista: `Segna tutte P`, seguita dalla modifica delle sole
eccezioni. Deve avere conferma/annullamento immediato per evitare tocchi
accidentali.

### 5.3 Vista mobile

La vista primaria è una sessione alla volta:

```text
Martedì 28 luglio

Atleta 1       [ P ] [ A ] [ R ] [ E ] [ I ]
Atleta 2       [ P ] [ A ] [ R ] [ E ] [ I ]
Atleta 3       [ P ] [ A ] [ R ] [ E ] [ I ]

12/20 compilate                    Da sincronizzare
```

I codici restano sempre accompagnati da una legenda accessibile. Il colore è
un aiuto, non l'unico modo per distinguere gli stati.

### 5.4 Vista desktop

La schermata Registro si apre sul riepilogo dell'intera stagione. In alto mostra
sempre `Stagione` e i dodici mesi da agosto a luglio, con il numero di sessioni
per ciascun periodo. Selezionando un mese si apre la matrice corrispondente:

```text
Atleta          01  02  03  04  ...  31 | P  A  R  E  I | P%
Atleta 1         P   -   A   P       ... | 2  1  0  0  0 | 67%
Atleta 2         P   -   P   R       ... | 2  0  1  0  0 | 67%
```

Caratteristiche:

- intestazione e nomi fissi durante lo scorrimento;
- navigazione esplicita fra riepilogo stagionale e tutti i dodici mesi;
- clic su una cella per scegliere lo stato;
- colonna vuota nei giorni senza sessione;
- totali calcolati, mai modificabili manualmente.

### 5.5 Riepilogo

Per una singola squadra:

- numero di sessioni;
- per ogni atleta, conteggio e percentuale dei cinque stati;
- filtro mensile o intera stagione;
- riga dei totali di squadra.

Per il coordinatore:

- selezione società e stagione;
- tabella delle squadre con numero di sessioni e totali per stato;
- apertura del dettaglio di una squadra;
- eventuale vista unificata di tutte le atlete, filtrabile per squadra.

L'MVP non richiede grafici: le tabelle rispondono già alle informazioni
contenute nel file.

## 6. Organizzazione e permessi

### 6.1 Ruoli

| Ruolo | Ambito | Permessi |
|---|---|---|
| Amministratore Nextcloud | istanza | utenti, gruppi e condivisioni |
| Coordinatore tecnico | cartella principale | lettura dei file di tutte le squadre |
| Allenatore | cartella di squadra | lettura e modifica del file della propria squadra |

Il coordinatore è inizialmente in sola lettura, salvo diversa decisione. Non
sono previsti utenti pubblici o anonimi.

### 6.2 Regole essenziali

- la PWA non implementa un secondo sistema di account;
- l'accesso ai dati è determinato dalle condivisioni Nextcloud già esistenti;
- ogni allenatore usa il proprio account Nextcloud e vede soltanto la cartella
  di squadra autorizzata;
- un dato resta sempre collegato a squadra e stagione nel relativo JSON;
- un'atleta rimossa dalla rosa viene archiviata, non cancellata dallo storico;
- i totali sono calcolati dai record originali e non salvati come numeri
  indipendenti.

## 7. Modello dati

L'unità di sincronizzazione è un documento JSON per squadra e stagione:

```text
attendance-tracker/
├── u14__2026-2027.attendance.json
├── u16__2026-2027.attendance.json
└── u18__2026-2027.attendance.json
```

`attendance-tracker` si trova direttamente nella root Nextcloud. Tutti i file
di squadra vengono conservati in questa cartella; squadra e stagione restano
riconoscibili dal nome del file e dai metadati interni.

Il file contiene:

```json
{
  "schemaVersion": 1,
  "teamId": "u14",
  "teamName": "U14",
  "organizationName": "Società",
  "season": { "startYear": 2026, "endYear": 2027 },
  "revision": 18,
  "updatedAt": "2026-09-15T20:30:00Z",
  "updatedBy": "account-nextcloud",
  "statuses": [],
  "trainingWeekdays": [],
  "athletes": [],
  "sessions": []
}
```

Atlete e sessioni hanno identificatori UUID stabili. Ogni sessione contiene la
data e un valore di presenza per ciascun membro della rosa. I totali non vengono
salvati: sono sempre ricalcolati dal contenuto originale.

### 7.1 Vincoli

- una sola sessione per squadra/stagione/data;
- un solo stato per atleta/sessione;
- codice stato univoco nella squadra/stagione;
- anno finale uguale ad anno iniziale + 1;
- data sessione compresa fra 1 agosto e 31 luglio della stagione;
- esattamente cinque stati attivi nell'MVP;
- la presenza può riferirsi solo a un membro della rosa della stessa
  squadra/stagione.

### 7.2 Identità delle atlete fra squadre

Nella prima versione ogni atleta appartiene al file della propria squadra. La
vista coordinatore aggrega i risultati per squadra, ma non unisce
automaticamente persone con lo stesso nome presenti in file diversi. Un
eventuale identificatore comune fra squadre sarà introdotto soltanto se servirà
realmente.

## 8. Calcoli

### 8.1 Mese

Per squadra e mese:

```text
sessioni_mese = conteggio delle sessioni nel mese
```

Per atleta e stato:

```text
conteggio = presenze con quello stato nel mese
percentuale = conteggio / sessioni_mese
```

Se `sessioni_mese = 0`, la percentuale visualizzata è `0%`.

### 8.2 Stagione

```text
sessioni_stagione = somma delle sessioni da agosto a luglio
conteggio_stagionale = somma dei conteggi mensili
percentuale_stagionale = conteggio_stagionale / sessioni_stagione
```

### 8.3 Atlete entrate o uscite durante la stagione

Per fedeltà al file, il denominatore iniziale sarà il totale delle sessioni
della squadra, anche se l'atleta entra a stagione iniziata. L'archiviazione non
modifica il passato.

Questa regola va confermata prima dell'implementazione, perché un'alternativa
ragionevole sarebbe conteggiare soltanto le sessioni in cui l'atleta faceva
parte della rosa. Cambiare regola cambierebbe però i numeri rispetto a Excel.

## 9. Architettura

```text
Allenatore
PWA ── IndexedDB locale ── WebDAV HTTPS ── file JSON su Nextcloud

Coordinatore
account supervisore ── WebDAV ───────────────┐
Nextcloud Desktop ── cartella locale ────────┴─ PWA coordinatore
                                                └─ sommari in sola lettura
```

### 9.1 Stack consigliato

Scelta proposta, ancora modificabile prima dell'avvio:

- **frontend:** React + TypeScript + Vite;
- **PWA:** web app manifest e service worker;
- **dati locali allenatore:** IndexedDB;
- **archivio remoto:** un JSON per squadra/stagione su Storage Share;
- **sincronizzazione allenatore:** WebDAV Nextcloud;
- **autenticazione:** account Nextcloud esistenti e password applicative
  revocabili;
- **protezione credenziali locale:** password solo in memoria; salvataggio e
  compilazione demandati al password manager del browser quando disponibile;
- **accesso coordinatore:** WebDAV con credenziali proprie oppure cartella
  aggiornata da Nextcloud Desktop e letta con File System Access API;
- **hosting frontend:** GitHub Pages tramite GitHub Actions, con base
  `/attendance-tracker/`;
- **export:** generazione locale CSV/Excel;
- **test:** calcoli, serializzazione, sincronizzazione, conflitti e lettura
  ricorsiva dei file.

Una PWA usa il service worker per cache, aggiornamenti e funzionamento offline
([riferimento MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/CycleTracker/Service_workers)).

### 9.2 Perché non serve un backend applicativo

I dati sono piccoli, ogni squadra modifica il proprio documento e il
coordinatore lavora in sola lettura sulle copie sincronizzate. Autenticazione,
permessi, versioni e trasferimento sono già forniti da Nextcloud. Calcoli,
esportazioni e aggregazione possono essere eseguiti localmente nella PWA.

### 9.3 Alternative di hosting

| Soluzione | Vantaggi | Svantaggi | Indicazione |
|---|---|---|---|
| Storage Share + hosting statico | riusa account e cartelle esistenti; nessun backend separato | sincronizzazione a livello di file; richiede CORS WebDAV | scelta consigliata |
| Hetzner Cloud Server | controllo completo e database relazionale | costo e manutenzione sistemistica | ripiego futuro se il modello a file non fosse sufficiente |
| Supabase | backend e database gestiti | secondo sistema di account e costo aggiuntivo | non necessario nel perimetro attuale |

## 10. Hetzner Storage Share

### 10.1 Capacità verificate

Hetzner Storage Share è un servizio gestito basato su Nextcloud, pensato per
condivisione di file e collaborazione
([documentazione Hetzner](https://docs.hetzner.com/storage/storage-share/general/)).
Offre:

- interfaccia web e client Nextcloud;
- utenti e gruppi Nextcloud;
- sincronizzazione e condivisione di file;
- accesso WebDAV;
- app installabili dal catalogo supportato;
- snapshot automatici della propria istanza Nextcloud.

Gli allenatori hanno già un account sull'istanza e accesso alla rispettiva
cartella di squadra. Non occorre quindi creare condivisioni pubbliche né
consegnare nuove credenziali.

### 10.2 Decisione per il progetto

Storage Share sarà l'archivio remoto operativo. La PWA usa gli endpoint WebDAV
Nextcloud per `PROPFIND`, `GET` e `PUT`
([documentazione ufficiale](https://docs.nextcloud.com/server/stable/developer_manual/client_apis/WebDAV/basic.html)).

Una PWA ospitata su un dominio diverso incontra normalmente le restrizioni CORS
del browser. Storage Share permette di installare applicazioni dal catalogo
Nextcloud. Installando **WebAppPassword** si può autorizzare l'origine HTTPS
della PWA, consentire WebDAV dal browser e generare password applicative
temporanee e revocabili
([app Nextcloud](https://apps.nextcloud.com/apps/webapppassword),
[documentazione](https://github.com/digital-blueprint/webapppassword)).

Prima di implementare l'intera applicazione verrà eseguita una prova tecnica
sull'istanza reale:

1. installazione e configurazione di WebAppPassword;
2. autorizzazione del dominio esatto della PWA;
3. accesso con un account allenatore di prova;
4. `PROPFIND`, `GET` e `PUT` soltanto nella cartella autorizzata;
5. verifica del comportamento su Android e iOS.

Se questa prova fallisse per una limitazione specifica dell'istanza gestita, si
valuterà un piccolo proxy. Non è una componente prevista nell'architettura
principale.

## 11. Offline e sincronizzazione

### 11.1 Comportamento

- al primo accesso online viene autorizzato l'account Nextcloud e scaricato il
  file della squadra;
- l'interfaccia e il documento restano disponibili offline in IndexedDB;
- al salvataggio viene aggiornata prima la copia locale;
- se c'è rete, la PWA carica subito il JSON aggiornato con `PUT`;
- se non c'è rete, marca il documento come `Da sincronizzare`;
- la sincronizzazione viene ritentata durante il salvataggio, all'avvio e
  quando la PWA torna in primo piano;
- la UI mostra `Salvato sul dispositivo`, `Sincronizzato`, `Da sincronizzare`
  oppure `Conflitto`.

Non si promette la sincronizzazione dopo la chiusura completa della PWA:
Background Sync non è disponibile uniformemente nei browser mobili.

### 11.2 Conflitti

La PWA conserva l'ETag dell'ultima versione remota letta, la revisione del JSON
e l'indicazione di modifiche locali non ancora caricate. Un conflitto esiste
quando il file remoto e la copia locale sono cambiati entrambi dalla precedente
sincronizzazione.

Alcune configurazioni Storage Share/WebAppPassword possono rifiutare
sistematicamente il `PUT` con `If-Match`, restituendo `412` anche dopo una
rilettura immediata. Dopo due rifiuti consecutivi la PWA passa, per quel
dispositivo, a una modalità compatibile: confronta ETag e JSON, unisce la
versione remota appena letta, esegue il `PUT` e rilegge il file per verificare
che il contenuto salvato coincida. La modalità attiva resta visibile nelle
Impostazioni.

Regola proposta:

1. nessuna modifica locale e remoto più recente: sostituire la copia locale;
2. modifiche locali e remoto invariato: caricare il file locale;
3. entrambi modificati: unire automaticamente sessioni con ID diversi;
4. se entrambi hanno modificato la stessa sessione, non sovrascrivere
   silenziosamente e chiedere quale versione mantenere.

È più raro del normale perché una squadra avrà pochi editor, ma deve essere
gestito fin dall'inizio.

### 11.3 Limiti offline

- il primo accesso e l'autorizzazione Nextcloud richiedono internet;
- un dispositivo condiviso deve essere protetto dal blocco del sistema;
- il logout rimuove i dati locali quando tutte le modifiche sono sincronizzate;
- prima di rimuovere dati locali non sincronizzati viene mostrato un avviso.

## 12. Esportazione

Non è prevista alcuna funzione di importazione da Excel: società, squadre,
stagioni, rose, sessioni e presenze saranno create ex novo nell'app.

### 12.1 Formati di esportazione

- CSV normalizzato, una riga per atleta/sessione;
- Excel leggibile, con struttura mensile simile al file attuale;
- esportazione di una squadra o di tutte le squadre autorizzate;
- filtro per stagione;
- nessuna formula necessaria per leggere l'export;
- nome file con società, squadra, stagione e data di esportazione.

Formato CSV minimo:

```text
societa,squadra,stagione,data,atleta,codice,descrizione
```

## 13. Sicurezza e protezione dei dati

I nomi delle atlete sono dati personali. Inoltre lo stato `Infortunio`,
associato a una persona identificabile, può rivelare un'informazione relativa
alla salute. I dati sulla salute ricevono una protezione specifica nel GDPR
([Commissione europea](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/legal-grounds-processing-data/sensitive-data/what-personal-data-considered-sensitive_en)).

La progettazione tecnica deve includere:

- accesso solo autenticato;
- permessi minimi applicati dalle cartelle e condivisioni Nextcloud;
- HTTPS obbligatorio;
- password applicative revocabili, senza memorizzare la password principale;
- password applicativa mai persistita dall'app;
- form compatibili con password manager tramite `username` e
  `current-password`;
- richiesta contestuale della password quando una sincronizzazione ne è priva,
  senza registrare la situazione come errore cloud;
- origine della PWA esplicitamente autorizzata in WebAppPassword;
- backup verificati con prova periodica di ripristino;
- esportazioni accessibili soltanto a ruoli autorizzati;
- log delle modifiche senza copiare inutilmente dati personali;
- cancellazione o anonimizzazione secondo una politica di conservazione;
- fornitore e area geografica dei dati documentati;
- accordi con eventuali responsabili del trattamento;
- informativa e base giuridica definite dalla società.

Il principio guida è raccogliere soltanto ciò che serve. La Commissione europea
richiama sia la minimizzazione sia misure adeguate contro accessi non
autorizzati e perdita accidentale
([principi GDPR](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/principles-gdpr/overview-principles/what-data-can-we-process-and-under-which-conditions_en)).

Questa sezione è un requisito progettuale, non una consulenza legale. Prima
della messa in produzione la società dovrà verificare base giuridica,
informativa, conservazione e trattamento dello stato `Infortunio`, soprattutto
se le atlete sono minorenni.

## 14. Backup e portabilità

- snapshot automatici dell'istanza Storage Share;
- versioni dei file offerte da Nextcloud;
- copia locale sincronizzata sul PC del coordinatore;
- ulteriore backup periodico della cartella locale su una destinazione distinta;
- prova di ripristino di un JSON prima del progetto pilota;
- esportazione completa sempre disponibile al coordinatore;
- documentazione e versionamento dello schema JSON;
- niente dati essenziali conservati solo sul dispositivo.

Gli snapshot gestiti dal fornitore non sostituiscono una copia separata
controllata dalla società.

## 15. Prestazioni e accessibilità

Obiettivi pratici:

- apertura della schermata di registrazione in meno di due secondi su una
  connessione normale dopo il primo caricamento;
- interazione immediata anche offline;
- nessun caricamento di tutti gli anni e tutte le società se non richiesto;
- supporto alle versioni correnti dei principali browser desktop e mobile;
- tastiera utilizzabile nella matrice desktop;
- contrasto adeguato e stato non identificato dal solo colore;
- aree toccabili di dimensioni adatte al telefono;
- date e percentuali in formato italiano;
- messaggi comprensibili, senza codici tecnici.

## 16. Criteri di accettazione dell'MVP

### Dati e calcoli

- configurazione e dati previsti dal foglio hanno una corrispondenza nell'app;
- con lo stesso insieme di sessioni e presenze, conteggi e percentuali
  coincidono con le regole documentate;
- nessuna divisione per zero produce errori;
- i totali derivano sempre dai record originali;
- una sessione eliminata non compare più nei conteggi;
- archiviare un'atleta non cancella lo storico.

### Permessi

- un allenatore non può ottenere dati di una squadra non assegnata neppure
  chiamando direttamente WebDAV;
- il coordinatore legge tutti i file presenti nella propria cartella
  sincronizzata;
- un utente non autenticato non legge alcun dato;
- i test verificano lettura e scrittura WebDAV con un account allenatore e il
  rifiuto sulle cartelle non autorizzate.

### PWA e offline

- app installabile su almeno un browser desktop, Android e iOS/iPadOS;
- shell dell'app e dati già scaricati disponibili senza rete;
- modifica offline sincronizzata senza duplicazioni;
- chiusura senza rete seguita da riapertura online sincronizza il file;
- conflitto simulato riconosciuto e risolvibile;
- aggiornamento della PWA non perde la coda locale.

### Export

- export di squadra e export coordinatore contengono i dati attesi;
- i totali esportati coincidono con quelli mostrati nell'app;
- un backup di prova viene ripristinato con successo.

## 17. Piano di realizzazione

### Fase 0 — conferma

- rispondere alle decisioni aperte;
- verificare WebAppPassword e WebDAV sull'istanza Storage Share reale;
- approvare regole di calcolo e ruoli.

**Uscita:** questo documento passa da bozza ad approvato.

### Fase 1 — fondazioni e prototipo

- schema JSON e validazione;
- autenticazione Nextcloud e WebDAV;
- layout mobile e desktop;
- configurazione squadra e rosa;
- prototipo del registro per una sessione e della matrice mensile.

**Uscita:** flusso completo dimostrabile con dati fittizi.

### Fase 2 — MVP allenatore

- archivio IndexedDB e file JSON remoto;
- sessioni e presenze;
- calcoli mensili e stagionali;
- sincronizzazione WebDAV;
- esportazioni.

**Uscita:** utilizzo online completo per una squadra.

### Fase 3 — coordinamento, offline e consolidamento

- cache locale;
- sincronizzazione e conflitti;
- selezione della cartella locale del coordinatore;
- scansione ricorsiva e vista multi-squadra;
- test di parità dei calcoli rispetto alle regole del foglio.

**Uscita:** candidata per il progetto pilota.

### Fase 4 — pilota e rilascio

- prova con una squadra;
- correzione dei problemi reali di compilazione;
- prova coordinatore con almeno due squadre;
- verifica backup/ripristino;
- revisione privacy e sicurezza;
- rilascio progressivo alle altre squadre.

**Uscita:** produzione.

## 18. Decisioni ancora aperte

Prima di scrivere codice vanno confermati questi punti:

1. **Uso offline:** necessario sempre o soltanto desiderabile?
2. **Modifica coordinatore:** sola lettura oppure può correggere i dati?
3. **Denominatore:** tutte le sessioni di squadra, come Excel, anche per chi
   entra a stagione iniziata?
4. **Legenda:** sempre esattamente cinque stati oppure numero variabile?
5. **Identità fra squadre:** serve già nell'MVP un totale della stessa atleta
   su più squadre?
6. **Conservazione:** per quanti anni devono restare disponibili i registri?

Le risposte non richiedono nuove funzionalità: servono a evitare che
l'implementazione prenda decisioni implicite sui dati.

## 19. Decisioni già prese in questa bozza

- una sola applicazione;
- un file JSON per squadra e stagione;
- separazione degli accessi tramite gli account e le cartelle Nextcloud già
  esistenti;
- sessioni esplicite, non dedotte da celle compilate;
- vista mobile per sessione e vista desktop a matrice;
- stessi cinque conteggi e stesse percentuali del foglio;
- niente funzionalità da gestionale sportivo fuori perimetro;
- nessun database o backend centrale separato;
- Hetzner Storage Share usato come archivio operativo tramite WebDAV;
- WebAppPassword per autorizzare la PWA e usare password applicative;
- IndexedDB come copia locale dell'allenatore;
- cartella Nextcloud sincronizzata sul PC per la vista coordinatore;
- PWA offline con sincronizzazione controllata tramite ETag e revisione;
- avvio ex novo senza importazione o migrazione dei dati Excel;
- file Excel usato soltanto come riferimento funzionale;
- esportazione aperta e backup esterno al dispositivo.

## 20. Stato dell'implementazione

Al 28 luglio 2026 è disponibile un primo prototipo eseguibile. Sono stati
realizzati:

- progetto React, TypeScript e Vite;
- manifest, service worker e icone PWA;
- interfaccia responsive distinta fra allenatore e coordinatore;
- configurazione iniziale di società, squadra, allenatore, stagione, giorni
  abituali e rosa;
- configurazione guidata allenatore in passaggi brevi, saltabile e riapribile
  dalle Impostazioni;
- criterio di prima apertura basato su versione onboarding in IndexedDB e
  assenza di un documento squadra, con migrazione silenziosa degli utenti già
  esistenti;
- registrazione e modifica di una sessione;
- scorciatoia `Segna tutte P`;
- archiviazione delle atlete senza cancellazione dello storico;
- cinque stati configurabili;
- vista mensile con conteggi e percentuale di presenza;
- documento JSON validato e versionato;
- persistenza locale tramite IndexedDB;
- indicazione dello stato di sincronizzazione;
- esito della configurazione cloud collegato alla sincronizzazione completa del
  JSON, non al solo test della cartella WebDAV;
- ultimo errore WebDAV visibile per esteso nelle Impostazioni;
- client WebDAV con `PROPFIND`, `GET`, `PUT`, ETag e scritture condizionali;
- fallback persistente per istanze che rifiutano `If-Match`, con merge prima
  della scrittura e verifica del JSON dopo il `PUT`;
- ritentativo all'avvio, al ritorno online e quando l'app torna in primo piano;
- merge delle sessioni create su dispositivi diversi e prevenzione del doppio
  allenamento nella stessa data;
- vista coordinatore che legge ricorsivamente i file locali
  `*.attendance.json`;
- caricamento coordinatore diretto di tutti i JSON via WebDAV;
- credenziali allenatore e coordinatore conservate separatamente;
- URL Nextcloud, nome utente e cartella remota ricordati in IndexedDB;
- password applicativa mantenuta soltanto in memoria durante la sessione;
- password manager del browser abilitato nei form di allenatore, coordinatore e
  richiesta contestuale;
- rimozione automatica degli archivi credenziali sperimentali delle versioni
  precedenti;
- URL, nome utente e cartella remota salvati automaticamente durante la
  modifica, senza richiedere il salvataggio dell'intera configurazione;
- riferimento alla cartella locale del coordinatore ricordato tramite File
  System Access API, con eventuale nuova conferma del permesso richiesta dal
  browser;
- cache IndexedDB dell'ultimo insieme di squadre caricato dal coordinatore, con
  sorgente e data di aggiornamento;
- ripristino immediato dei riepiloghi coordinatore alla riapertura, anche
  offline;
- rilettura automatica della cartella locale quando era l'ultima sorgente usata
  e il browser conserva il permesso;
- sommario aggregato delle squadre con sessioni, atlete e totali per stato;
- dettaglio coordinatore di ogni squadra con riepilogo stagionale, conteggi,
  percentuali e matrici mensili;
- URL a hash compatibili con GitHub Pages per selezione modalità, sezioni
  allenatore, modifica allenamento e dettaglio squadra coordinatore, con
  cronologia Indietro/Avanti;
- navigazione desktop e mobile realizzata con collegamenti, non con sole viste
  interne prive di indirizzo;
- workflow GitHub Actions con test, build PWA e deploy automatico su Pages;
- download del backup JSON completo dalla sezione Portabilità;
- ripristino allenatore da JSON validato, disponibile anche quando
  l'installazione non contiene ancora un registro;
- anteprima e conferma del backup prima della sostituzione del documento in
  IndexedDB;
- sospensione persistente della sincronizzazione automatica dopo il ripristino,
  fino al comando esplicito `Pubblica il ripristino`;
- ripristino completo con conferma in due passaggi, cancellazione di tutto lo
  stato IndexedDB e ritorno alla selezione iniziale;
- reset disponibile sia dalle Impostazioni allenatore sia dalla vista
  coordinatore, senza cancellare file remoti o password del browser;
- test automatici del documento, dei calcoli e del merge;
- build di produzione verificata.

La sincronizzazione è implementata ma non ancora collaudata contro l'istanza
Storage Share reale. Prima del progetto pilota restano quindi necessari:

1. installazione di WebAppPassword su Nextcloud;
2. autorizzazione dell'origine locale o pubblica della PWA;
3. creazione di una password applicativa per un account allenatore di prova;
4. verifica WebDAV sulla cartella di quella squadra;
5. prova reale su almeno un telefono Android e un iPhone/iPad;
6. pubblicazione della PWA su un'origine HTTPS stabile.

Non sono ancora stati realizzati l'export CSV/Excel e una schermata di
risoluzione manuale per modifiche concorrenti alla stessa sessione. Il
prototipo esegue già il merge deterministico scegliendo la versione della
sessione con `updatedAt` più recente; l'interfaccia manuale verrà aggiunta prima
del pilota se la stessa squadra deve essere modificata abitualmente da più
dispositivi.
