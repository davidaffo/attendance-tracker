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

## Collegamento a Nextcloud

1. Installare l'app Nextcloud `WebAppPassword`.
2. Autorizzare l'origine completa della PWA, protocollo e porta compresi.
   Durante lo sviluppo è normalmente `http://localhost:5173`.
3. Per ogni allenatore, creare una password applicativa revocabile nelle
   impostazioni di sicurezza Nextcloud.
4. Nell'app aprire `Impostazioni`, inserire indirizzo Nextcloud, nome utente,
   password applicativa e percorso relativo della cartella di squadra.
5. Usare `Verifica e salva`, poi controllare che il JSON compaia nella cartella.

La password principale Nextcloud non deve essere inserita nella PWA.

## Vista coordinatore

Il coordinatore sincronizza con Nextcloud Desktop la cartella che contiene le
sottocartelle delle squadre. Nella modalità coordinatore seleziona quella
cartella: la PWA cerca ricorsivamente i file `*.attendance.json` e costruisce il
riepilogo in sola lettura.

La selezione diretta di una cartella richiede un browser desktop compatibile
con File System Access API, come Chrome o Edge. Negli altri browser viene usato
il selettore di directory disponibile.
