# Registro React condiviso

La repository contiene la PWA autonoma e il workspace npm `@clubiva/attendance`
in `packages/attendance`. Non serve una terza repository o un registro npm pubblico.

## Confini

Il pacchetto contiene le interfacce originali: elenco squadre, creazione registri,
pannello di controllo del coordinatore, impostazioni e rosa, panoramica, editor,
registro mensile/stagionale e punteggi, oltre a validazione e calcoli.
`@clubiva/attendance/domain` esporta la sola logica, utilizzabile anche nei test
Node senza dipendere dai componenti React. La PWA importa direttamente i sorgenti
del pacchetto, senza compilarli prima, senza copie e senza file ponte nelle
vecchie posizioni di `src/components` e `src/domain`.

Routing hash, onboarding, amministrazione Nextcloud, credenziali, temi,
service worker e IndexedDB restano nell'app. `src/adapters/nextcloud.ts` è
l'implementazione WebDAV esistente, estratta conservando ETag, merge a tre vie,
conflitti, ripristino, verifica delle scritture e operazioni offline.
Il supporto ai file locali del coordinatore resta nell'app.

L'interfaccia riceve documenti e callback asincrone; non conosce storage o API.
`onSave` deve risolversi solo quando la persistenza dell'host ha confermato la
scrittura. Nella PWA la prima persistenza è quella locale; in Clubiva è il server.
Gli host possono fornire conferme di partecipazione opzionali: matrice ed editor
le mostrano insieme agli stati effettivi. Lo standalone non richiede conferme.
Creazione e impostazioni accettano un catalogo opzionale di persone e squadre:
Clubiva lo usa per selezionare le anagrafiche esistenti; la PWA mantiene la
creazione libera originale. Le azioni Nextcloud del pannello sono fornite
dalla PWA, senza introdurre dipendenze cloud nel pacchetto.
Le operazioni disponibili dipendono dalle callback fornite e dalle modalità
di sola lettura dei componenti. I permessi effettivi restano a Nextcloud o al server.

React e React DOM sono peer dependencies 19.x, escluse dal bundle. Le sole icone
utilizzate sono incluse nel bundle con l'attribuzione originale. Non occorre
allineare la versione di Lucide dell'app ospitante. La build produce JavaScript
ESM, dichiarazioni TypeScript e `styles.css`, con selettori circoscritti a
`.attendance-module` e nomi delle animazioni separati. L'host deve usare tale
contenitore e può assegnargli `data-theme="dark"`. I tooltip restano nello
stesso contenitore. La PWA mantiene il proprio foglio globale originale.

Il formato standalone mantiene una sessione per data. Le proiezioni del
calendario API usano `sessionIdentity: 'id'`, così due eventi nella stessa data
restano distinti. La sincronizzazione Nextcloud non viene usata da Clubiva.

## Sviluppo e verifiche

Richiesto Node 24 o successivo e npm. Dalla root:

```sh
npm ci
npm run dev
npm test
npm run build
npm run build:pages
npm run verify:pages
npm run build:attendance
```

La build Pages continua a usare `/attendance-tracker/`, manifest/PWA e routing
hash. `docs/` contiene soltanto l'output versionato richiesto dal workflow esistente.
Questa guida rimane nella root perché Vite rigenera interamente `docs/`.

## Aggiornamento automatico in Clubiva da GitHub

Modificare i sorgenti condivisi in `packages/attendance/src` e gli stili in
`packages/attendance/styles/app.css`, verificare test/build e pubblicare le
modifiche nella repository GitHub **davidaffo/attendance-tracker**, ramo `main`.
Commit e push rimangono azioni esplicite dell'utente: questi script non li eseguono.

Clubiva non legge la cartella locale: all'avvio dello sviluppo, alla build e
al deploy risolve il commit GitHub, scarica la relativa sorgente, esegue `npm ci`
e costruisce il workspace. Conserva un solo artefatto
`vendor/clubiva-attendance-VERSIONE-SHA.tgz`, insieme a manifest e lockfile con
integrità. La revisione viene adottata anche senza incremento di versione.
Modifiche non pubblicate su GitHub non arrivano automaticamente a Clubiva.

Per il primo utilizzo remoto vanno pubblicati tutti i file del refactoring,
compresi il workspace, i manifest e il lockfile. Il vecchio ramo remoto, privo
di `packages/attendance`, viene rifiutato con un messaggio esplicito.

La versione del pacchetto può essere incrementata per identificare una release:

```sh
npm version --workspace @clubiva/attendance patch --no-git-tag-version
npm test
npm run build:attendance
```

La PWA usa direttamente gli stessi sorgenti e resta distribuibile indipendentemente.
Configurazione remota, comportamento Docker e modalità di build riproducibile
sono documentati in `docs/shared-attendance.md` nella repository Clubiva.
