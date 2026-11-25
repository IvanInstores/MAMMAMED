# PASSAGGIO – PillolAPP

Documento di consegna per chi riparte da zero, senza la conversazione in cui il progetto è nato.
Ultimo aggiornamento: 25 novembre 2026.

---

## 1. Cos'è e a cosa serve

App semplicissima che ricorda a una persona anziana (la mamma di Ivan) quando prendere le medicine.

- **La mamma** riceve sul telefono un avviso con nome della medicina, quantità, tipo e foto della scatola. Conferma con un tocco sul tasto verde **L'HO PRESA** (anche direttamente dalla notifica, su Android).
- **Ivan** gestisce tutto dal suo telefono: medicine, orari, quantità, giorni, fine terapia, foto. Vede lo stato di oggi e riceve la conferma quando la mamma prende la medicina, oppure un allarme se non conferma.

Requisiti fissati da Ivan: linguaggio semplicissimo, tutto in italiano, testi e immagini molto grandi e leggibili sul lato mamma.

---

## 2. Dove sta il codice

| Cosa | Valore |
|---|---|
| Archivio GitHub | `IvanInstores/PillolAPP` (pubblico) |
| Sito | `https://ivaninstores.github.io/PillolAPP/` |
| **Maiuscole e minuscole contano** | L'indirizzo va scritto esattamente `/PillolAPP/`. Scritto in un altro modo dà errore 404 |
| Nomi precedenti | Prima MAMMAMED (`/MAMMAMED/`), poi `pillolapp` tutto minuscolo (`/pillolapp/`): entrambi i vecchi indirizzi danno errore 404 |
| Ramo con la versione più recente | `claude/medicine-reminder-app-q924p9` |
| Ramo `main` | Non esiste: l'unico ramo è quello sopra, ed è quello pubblicato |
| Altri rami | Le sessioni cloud di Claude possono creare un ramo di lavoro locale (es. `claude/clever-lamport-j4occ5`): **non va mai pubblicato né cancellato**. Si pubblica solo sul ramo sopra |

---

## 3. Com'è fatto

### Tecnologie
- **App**: una pagina web installabile (PWA) in HTML, CSS e JavaScript puri. Nessun framework, nessuna compilazione, nessuna dipendenza da installare.
- **Server**: una sola funzione Supabase (Edge Function, Deno/TypeScript) che fa da unica porta d'ingresso.
- **Database**: Postgres su Supabase.
- **Avvisi**: Web Push standard (libreria `web-push`), con chiavi VAPID generate dal server al primo avvio e salvate nel database.
- **Orologio**: `pg_cron` + `pg_net` chiamano il server ogni minuto.

### Cartelle e file
| File | A cosa serve |
|---|---|
| `index.html` | Unica pagina. La stessa per mamma e Ivan: cambia il link (la chiave `?k=`) |
| `app.js` | Tutta la logica dell'app: schermata mamma, pannello di Ivan, attivazione avvisi, suono |
| `style.css` | Stile. Sezione "MAMMA" con caratteri molto grandi, sezione "IVAN" per il pannello |
| `sw.js` | Service worker: riceve gli avvisi ad app chiusa e gestisce il tasto "L'HO PRESA" nella notifica |
| `config.js` | Indirizzo del server (già compilato) |
| `version.json` | Numero di versione pubblicato. Deve essere uguale a `VERSION` in `app.js`: l'app lo controlla per aggiornarsi da sola |
| `manifest.webmanifest`, `icons/` | Dati e icone per installare l'app sulla schermata Home |
| `supabase/functions/api/index.ts` | Il server: salva i dati, calcola gli avvisi, spedisce le notifiche |
| `supabase/migrations/001_init.sql` | Tabelle, chiavi segrete iniziali, funzioni `generate_doses` e `today_schedule` |
| `supabase/migrations/002_cron.sql` | Controllo automatico ogni minuto |
| `supabase/migrations/003_end_date.sql` | Fine terapia |
| `supabase/migrations/004_time_doses.sql` | Quantità diversa per ogni orario |
| `README.md` | Riassunto breve |
| `CLAUDE.md` | Regole permanenti del progetto per chi ci lavora con Claude |
| `PASSAGGIO.md` | Questo documento: va letto a inizio sessione e aggiornato a ogni novità |

### Tabelle del database
| Tabella | Contenuto |
|---|---|
| `config` | Chiavi segrete (`admin_token`, `mom_token`), chiavi VAPID, impostazioni (`mom_name`, `repeat_minutes`, `alert_minutes`) |
| `medicines` | Le medicine: nome, quantità, tipo, nota, foto, orari (`times`), quantità per orario (`time_doses`), giorni, fine terapia (`end_date`), attiva/in pausa |
| `doses` | Ogni singola assunzione generata: quando era prevista, se e quando è stata confermata, quanti avvisi sono partiti |
| `push_subs` | I telefoni collegati per le notifiche, con ruolo `mom` o `admin` |

Tutte le tabelle hanno la sicurezza a righe (RLS) attiva e nessuna regola: dall'esterno non si legge nulla, passa tutto dalla funzione `api`.

### Come gira un avviso
1. Ogni minuto `pg_cron` chiama la funzione `api` con azione `tick`.
2. `generate_doses()` crea le assunzioni di oggi arrivate all'orario (fuso orario Italia).
3. Per ogni assunzione non confermata parte la notifica alla mamma; si ripete ogni `repeat_minutes` (default 10), al massimo 12 volte.
4. Dopo `alert_minutes` (default 30) senza conferma parte un allarme a Ivan.
5. Quando la mamma conferma, parte la notifica di conferma a Ivan.
6. Un'assunzione non confermata resta "da prendere" per 12 ore, poi finisce tra le "non confermate" del pannello.

### Azioni del server
Tutte in `POST` sull'unico indirizzo, con corpo JSON `{ "action": "...", "k": "<chiave>" }`.

| Chi | Azioni |
|---|---|
| Nessuna chiave | `tick` |
| Mamma e Ivan | `hello`, `subscribe`, `state`, `confirm` |
| Solo Ivan | `overview`, `save_med`, `delete_med`, `unconfirm`, `save_settings`, `test_push` |

---

## 4. Servizi esterni

| Servizio | Cosa | Dettagli |
|---|---|---|
| **GitHub** | Codice | Archivio `IvanInstores/PillolAPP` |
| **GitHub Pages** | Pubblicazione del sito | Dal ramo `claude/medicine-reminder-app-q924p9`, cartella `/ (root)`. Indirizzo: `https://ivaninstores.github.io/PillolAPP/` (maiuscole e minuscole contano) |
| **Supabase** | Database e server | Progetto `mammamed`, codice `jqwtcbnfgbfazyjokuzs`, regione `eu-central-1`, organizzazione "Ivan Personale". Server: `https://jqwtcbnfgbfazyjokuzs.supabase.co/functions/v1/api` |
| **Servizi push dei browser** | Consegna notifiche | Google (Android/Chrome) e Apple (iPhone): nessun account da gestire |

### Chiavi di accesso (importante)
- Non ci sono password. Si entra con due **link segreti**: `https://ivaninstores.github.io/PillolAPP/?k=<chiave>` (partono da `/PillolAPP/`, con le maiuscole: i link salvati con `/pillolapp/` o `/MAMMAMED/` non funzionano più).
- Le chiavi **non sono in questo archivio**, perché è pubblico. Stanno nella tabella `config` di Supabase, righe `admin_token` (Ivan) e `mom_token` (mamma).
- Per leggerle: Supabase → progetto `mammamed` → Table Editor → `config`.
- Per cambiarle (se un link finisce in mani sbagliate): modifica il valore nella tabella. I vecchi link smettono di funzionare e vanno riaperti quelli nuovi su entrambi i telefoni.

---

## 5. Come si avvia

### Usare l'app (già online)
Non c'è niente da avviare: sito e server sono già pubblicati. Basta aprire il link segreto.

### Lavorarci dal PC
1. Scarica l'archivio: `git clone https://github.com/IvanInstores/PillolAPP.git`
2. Entra nella cartella e passa al ramo: `git checkout claude/medicine-reminder-app-q924p9`
3. Per vedere l'app in locale serve un piccolo server web (un service worker non funziona aprendo il file con doppio clic). Per esempio: `python -m http.server 8000`, poi apri `http://localhost:8000/?k=<chiave>`.
4. L'app in locale parla con il server vero: le modifiche ai dati sono reali.

### Pubblicare una modifica
| Cosa modifichi | Come va online |
|---|---|
| App (`index.html`, `app.js`, `style.css`, `sw.js`) | Cambia il numero di versione in `app.js` (`VERSION`) e in `version.json` (stesso valore), poi `git commit` + `git push` sul ramo: GitHub Pages si aggiorna da solo in 1-2 minuti e i telefoni si ricaricano da soli |
| Server (`supabase/functions/api/index.ts`) | Va ripubblicata la funzione `api` su Supabase, **con verifica JWT disattivata** (il server controlla da solo le chiavi) |
| Database | Nuovo file in `supabase/migrations/` da eseguire su Supabase (SQL Editor) |

### Rifare tutto da zero su un altro progetto Supabase
1. Esegui nell'ordine `001_init.sql`, `003_end_date.sql`, `004_time_doses.sql`.
2. Pubblica la funzione `api` senza verifica JWT.
3. In `002_cron.sql` sostituisci il codice progetto nell'indirizzo ed eseguilo.
4. Scrivi il nuovo indirizzo in `config.js`.
5. Leggi le nuove chiavi nella tabella `config`.

---

## 6. Stato del lavoro

### Funziona (provato)
- Pannello di Ivan e schermata della mamma: provati in locale con un server finto (inserimento, più orari, quantità diverse per orario, fine terapia, conferma, annulla).
- Server vero: salvataggio di una medicina, generazione dell'assunzione all'orario esatto, invio dell'avviso, rifiuto dei link sbagliati.
- Sito pubblicato e telefono di Ivan collegato alle notifiche (visto dal database il 23/11/2026).
- Ivan ha inserito la prima medicina vera.
- Il 23/11/2026 il telefono di Ivan era stato ricollegato a `/pillolapp/` (vecchia icona tolta, app installata da quel link) e la notifica di prova "Manda una prova a me" era arrivata **una sola volta**: la pulizia automatica degli avvisi del vecchio indirizzo `/MAMMAMED/` funzionava. Quel collegamento è stato poi sostituito da quello a `/PillolAPP/` (riga sotto).
- Pulizia allargata (23/11/2026): `app.js` ora spegne gli avvisi legati a qualsiasi indirizzo diverso da quello attuale, quindi anche `/pillolapp/`. Provata in locale con un browser automatico (un indirizzo vecchio finto viene spento, quello attuale resta).
- **Telefono della mamma collegato il 25/11/2026** (il giorno del suo compleanno): Ivan l'ha provato con lei, "funziona alla grande". Da qui in poi gli avvisi le arrivano davvero.
- Telefono di Ivan ricollegato a `/PillolAPP/` (23/11/2026, sera): vecchia icona tolta, app installata dal nuovo indirizzo, "Manda una prova a me" arrivata **una sola volta**. La pulizia allargata funziona anche sul telefono.
- **Primo giro di miglioramenti alla schermata della mamma (24/11/2026, versione `2026-11-24.1`)**, solo app, server non toccato:
  - riquadro rosso "Manca la connessione… Chiama Ivan." quando l'aggiornamento non riesce; in quel caso sparisce "Adesso non devi prendere niente";
  - con una medicina da prendere: ora e data piccole su una riga, titolo su una riga, tasto verde sempre visibile; la scheda si adatta allo schermo (prima rimpicciolisce la foto, poi le scritte) così nulla finisce sotto il tasto;
  - errore a tutto schermo "Non è stata segnata" se la conferma non parte; "HO CAPITO" riporta al tasto verde;
  - nome della prossima medicina nella schermata tranquilla; testi di aiuto che finiscono con "Chiama Ivan."; niente trattino nei nomi lunghi;
  - aggiornamento automatico con `version.json`.
  - Provato in locale con browser automatico e server finto su schermi 360×640 e 412×892 (anche con nome su tre righe e nota su due). **Non provato su un telefono vero né sul sito vero.**
- **Secondo giro di miglioramenti alla schermata della mamma (24/11/2026, versione `2026-11-24.2`)**, solo app, server non toccato:
  - icone Lucide (SVG copiati in `app.js`, licenza ISC) al posto delle emoji, lato mamma: spunta sul tasto verde, faccina piena verde nella schermata tranquilla, spunta verde su disco bianco dopo "L'HO PRESA", triangolo di avviso pieno, campanella piena;
  - elenco "Le medicine di oggi" a riquadri colorati: verde "Presa", arancione "Da prendere", grigio "Più tardi", grigio "Non segnata";
  - regola dell'elenco: arancione "Da prendere" solo se in alto c'è la scheda con il tasto verde; una dose scaduta (non più in attesa) è "Non segnata"; una dose mai avvisata (medicina aggiunta o modificata dopo quell'orario) non compare;
  - niente sfarfallio: l'ora si aggiorna da sola, il resto della schermata (foto compresa) si ridisegna solo se cambia.
  - Provato in locale con browser automatico e server finto su schermi 360×640 e 412×892. **Non provato su un telefono vero né sul sito vero.**
  - Non toccati: il pannello di Ivan (ha ancora le emoji) e il tasto "✅ L'HO PRESA" dentro la notifica di sistema (lì le icone SVG non si possono usare).

### In corso
- **Verifica della versione `2026-11-24.2` sul sito vero e sui telefoni.** Chi ha già la `2026-11-24.1` si aggiorna da solo; chi ha una versione più vecchia deve chiudere del tutto l'app e riaprirla.

### Non ancora provato
- Tasto "L'HO PRESA" dentro la notifica di sistema (Android), senza aprire l'app: non risulta provato in modo specifico.
- Giro completo sul server vero con quantità diverse per orario e con fine terapia scaduta (le modifiche sono caricate senza errori, ma verificate solo in locale).
- Comportamento su iPhone.
- Costo del progetto Supabase: da controllare nel pannello che sia sul piano gratuito.

### Manca / idee proposte e non fatte
- **PROSSIMO LAVORO: "giro server" (progettato e approvato da Ivan il 24/11/2026, NON ancora fatto).** Tre novità insieme, perché toccano tutte server e database. Da fare **dopo** aver collegato il telefono della mamma, in un pomeriggio senza dosi vicine. Prima di pubblicare: prove in locale e tavole definitive "prima e dopo" a Ivan, poi il suo ok.
  1. **Momenti della giornata.** Nel pannello Ivan imposta 4 momenti fissi con l'orario del pasto: Colazione 08:00, Pranzo 12:30, Cena 19:30, Prima di dormire 22:00 (orari modificabili, **niente orari diversi nel fine settimana**). Ogni volta al giorno di una medicina è legata a un momento (Prima di / A / Dopo colazione, pranzo, cena; oppure Prima di dormire) **oppure** a un orario preciso, come oggi. "Prima di…" arriva **15 minuti prima** del pasto, "A…" all'ora del pasto, "Dopo…" **30 minuti dopo** (15 e 30 modificabili nel pannello). La mamma vede in grande il momento ("Dopo colazione") invece dell'ora; il titolo dell'avviso diventa il momento.
  2. **Finestra per segnare in ritardo, per ogni medicina.** Scelta nel modulo: 30 minuti, 1 ora, 2 ore, 4 ore, 8 ore, "fino alla dose successiva (massimo 12 ore)". **Si chiude comunque all'orario della dose successiva della stessa medicina.** Medicine nuove: **2 ore** (è anche quando finiscono i 12 avvisi ripetuti ogni 10 minuti). Medicine già inserite: restano a 12 ore (con la chiusura alla dose successiva) finché Ivan non imposta i valori giusti **dopo aver sentito il medico**. L'allarme a Ivan deve partire anche se la finestra è più corta dei 30 minuti.
  3. **Tasto HO SBAGLIATO.** Nella schermata "Brava!" (che diventa "Brava! Medicina A segnata" e resta circa 10 secondi) compare **in basso, dopo 1,5 secondi**, il tasto "HO SBAGLIATO – non l'ho presa": **bianco con bordo, ben distinto dal tasto verde** (il ritardo evita il doppio tocco per errore, perché sta dove prima c'era il tasto verde). Vale solo per la mamma, solo sulla sua conferma, solo entro 2 minuti. Riporta la dose a "da prendere" e **fa ripartire gli avvisi**; sul telefono di Ivan la notifica "ha preso la medicina" viene sostituita da "Mamma ha tolto la conferma" (stesso `tag`). Nel pannello la dose mostra "La mamma ha tolto la conferma alle hh:mm".
  4. **Più medicine nello stesso momento**: schede compatte (foto piccola a sinistra, nome e quantità, tasto verde sotto), così tutti i tasti verdi stanno nello schermo anche sul telefono piccolo.
  - **Database (nuovo file `005_...sql`, le migrazioni vecchie non si toccano):** tabella `moments` (chiave, nome, orario, pasto sì/no, ordine) con i 4 momenti; in `config` i due valori 15 e 30; in `medicines` le colonne `slots` (per ogni volta: orario preciso **oppure** momento + prima/a/dopo, e quantità) e `late_minutes`; in `doses` le colonne `slot`, `label` (es. "Dopo colazione", salvata quando parte l'avviso), `late_until` (fino a quando si può segnare) e `undone_at`; un vincolo "al massimo una dose al giorno per medicina e momento" (così spostare un momento dopo che l'avviso è partito non manda un secondo avviso); `generate_doses` e `today_schedule` riscritte. Nel server `PENDING_HOURS` viene sostituito da `late_until`; nuove azioni per salvare i momenti e per HO SBAGLIATO.
  - **Compatibilità:** ogni medicina esistente viene convertita in "orario preciso" con gli stessi orari e quantità: per la mamma non cambia nulla finché Ivan non lega una medicina a un momento. Le colonne vecchie `times` e `time_doses` restano e il server le tiene aggiornate (l'app vecchia funziona finché non si aggiorna da sola, e si può tornare indietro). Ordine di pubblicazione: database → server → app, ogni passo compatibile con il precedente.
  - **Prove obbligatorie prima di pubblicare:** HO SBAGLIATO riporta la dose a "da prendere" **e fa ripartire l'avviso**; HO SBAGLIATO dopo 2 minuti viene rifiutato; finestra che si chiude alla dose successiva; finestra più corta dei 30 minuti con allarme a Ivan; momento spostato dopo che l'avviso è partito (nessun doppio avviso); medicine esistenti invariate dopo la conversione.
  - Effetto collaterale accettato: nell'elenco di oggi le righe legate a un momento sono più alte, quindi sul telefono piccolo se ne vedono meno.
- Pannello di Ivan con le icone Lucide al posto delle emoji (proposto, non deciso).
- Scartato da Ivan: lettura vocale e uso da tastiera.
- Riepilogo settimanale via email (prese e dimenticate).
- Avviso "scorta in esaurimento" con conteggio delle compresse.
- Un secondo familiare che riceve gli allarmi.
- Data di inizio terapia (oggi c'è solo la fine).
- Prove automatiche salvate nell'archivio (quelle fatte finora erano script temporanei, non conservati).

### Limiti noti
- Su schermi molto piccoli (320×568) con nome lungo e nota lunga insieme, l'ultima riga della nota finisce sotto il tasto verde. Meglio tenere le note brevi.
- Con due medicine alla stessa ora, solo la prima scheda sta tutta nello schermo: la seconda si vede scorrendo.
- Aggiornamento automatico: il telefono può tenere i file vecchi per circa 10 minuti (memoria di GitHub Pages), quindi la versione nuova arriva entro 10-40 minuti dalla pubblicazione, non subito.
- L'avviso arriva solo se il telefono è acceso e connesso. Su Samsung e Xiaomi il risparmio batteria può ritardare le notifiche.
- Non è un dispositivo medico: l'allarme a Ivan è una rete di sicurezza, non una garanzia.
- Se si modifica una medicina, gli orari già passati di quel giorno non generano più avvisi fino al giorno dopo.
- Eliminare una medicina cancella anche il suo storico. Per fermarla senza perdere lo storico: metterla in pausa o impostare la fine terapia.
- Un'assunzione a ridosso della mezzanotte può saltare se il controllo automatico perde quel minuto.
- I progetti Supabase gratuiti vanno in pausa se inattivi: il controllo ogni minuto dovrebbe tenerlo sveglio, ma non è stato verificato nel tempo.

---

## 7. Decisioni prese e perché

| Decisione | Perché |
|---|---|
| App web installabile invece di app da negozio | Nessuna pubblicazione su Play Store/App Store, funziona su Android e iPhone, si aggiorna da sola |
| Nessuna password, solo due link segreti | Massima semplicità per la mamma: apre l'app ed è già dentro |
| Una sola pagina per mamma e Ivan | Meno codice da mantenere: il server riconosce il ruolo dalla chiave |
| Tutto passa da una sola funzione server | Il database resta chiuso verso l'esterno; un solo punto da controllare |
| Nome cambiato da MAMMAMED a PillolAPP (23/11/2026) | Scelta di Ivan. Cambiati nome visibile, archivio e indirizzo del sito |
| Archivio rinominato una seconda volta, da `pillolapp` a `PillolAPP` con le maiuscole (23/11/2026) | Scelta di Ivan. Cambia di nuovo l'indirizzo del sito (maiuscole e minuscole contano) e i telefoni vanno ricollegati |
| La pulizia in `app.js` spegne gli avvisi di qualsiasi indirizzo diverso da quello attuale, non di un elenco di nomi vecchi (23/11/2026) | Richiesta di Ivan: evita notifiche doppie anche a un prossimo cambio nome. Attenzione: vale per tutto `ivaninstores.github.io`, quindi spegnerebbe anche gli avvisi di un'eventuale altra app con notifiche pubblicata sullo stesso account GitHub. Oggi non ce ne sono; se ne nasce una, la pulizia va ristretta |
| Nomi tecnici lasciati com'erano (`MAMMAMED_API`, `mammamed_k`, `mammamed-tick`, progetto Supabase `mammamed`, commenti nelle migrazioni e nel server) | Rinominarli non porta nulla all'utente e rischia di rompere l'app: la chiave salvata sui telefoni andrebbe persa e il server andrebbe ripubblicato |
| Progetto Supabase separato (`mammamed`) | Scelta di Ivan: non mescolare con il progetto esistente "bilancio" |
| Chiavi fuori dall'archivio | L'archivio è pubblico (necessario per GitHub Pages gratuito) |
| Foto ridotta e salvata nel database | Semplicità: nessun servizio di archiviazione in più |
| Avviso ripetuto ogni 10 min, allarme a Ivan dopo 30 | Valori iniziali ragionevoli, modificabili dal pannello |
| Fine terapia: data compresa, facoltativa | Richiesta di Ivan; l'ultimo giorno scelto ha ancora gli avvisi |
| Più assunzioni al giorno: una riga per assunzione con orario e quantità propri | Richiesta di Ivan: la stessa medicina può avere dosi diverse (es. 1 compressa al mattino, mezza alla sera) |
| Conferma anche dal tasto dentro la notifica (Android) | "Un clic" come richiesto; se la chiamata fallisce si apre l'app |
| Ivan può segnare o annullare una conferma dal pannello | Per correggere errori o registrare una conferma avuta al telefono |
| L'app si ricarica da sola quando `version.json` cambia (24/11/2026) | Un'app installata può restare aperta per giorni e non prendere mai la versione nuova. Non si ricarica mentre c'è una medicina da prendere, un messaggio a schermo o il modulo medicina aperto: aspetta che la schermata torni tranquilla |
| Con una medicina da prendere la scheda si adatta allo schermo invece di far scorrere (24/11/2026) | Richiesta di Ivan: la mamma non scorre, e la nota è un'istruzione su come prendere la medicina |
| Errore di conferma a tutto schermo con tasto "HO CAPITO" (24/11/2026) | Una scritta piccola che sparisce da sola lei non la vede |
| Modifiche grafiche: prima le schermate "prima e dopo" con dati finti, poi l'ok di Ivan, poi la pubblicazione (24/11/2026) | Il ramo è anche il sito in uso: pubblicare è mandare la modifica sui telefoni |
| Icone Lucide in SVG, niente emoji lato mamma (24/11/2026) | Scelta di Ivan: le emoji non gli piacciono e cambiano aspetto da telefono a telefono. Nessuno strumento da installare: gli SVG sono copiati in `app.js` |
| La spunta vuol dire solo "medicina presa/segnata"; la schermata tranquilla usa la faccina (24/11/2026) | Per non usare lo stesso simbolo con due significati |
| Nell'elenco: "Da prendere" solo se c'è la scheda con il tasto verde; scaduta = "Non segnata" grigia; mai avvisata = non compare (24/11/2026) | Evita la contraddizione con "Adesso non devi prendere niente". "Non segnata" e non "Non presa": l'app sa solo che il tasto non è stato toccato. Grigia e non rossa per non spingerla a prendere tardi una dose vecchia |
| Medicine legate a momenti della giornata (Colazione, Pranzo, Cena, Prima di dormire) oltre che a orari precisi (24/11/2026, da fare) | Idea di Ivan: la mamma ragiona per pasti, non per orari. "Prima di" 15 minuti prima e "Dopo" 30 minuti dopo: altrimenti prima e dopo arriverebbero alla stessa ora. 4 momenti fissi, uguali tutti i giorni, per semplicità |
| Finestra per segnare in ritardo impostabile per medicina, chiusa al più tardi alla dose successiva; 2 ore per le medicine nuove (24/11/2026, da fare) | Con le 12 ore fisse, in una medicina con due dosi al giorno quella del mattino resta confermabile fino all'ora di quella della sera. I valori definitivi li decide Ivan con il medico |
| HO SBAGLIATO in basso, bianco con bordo, visibile dopo 1,5 secondi, valido 2 minuti (24/11/2026, da fare) | Rimedia a un tocco per errore su "L'HO PRESA" senza rischiare un secondo tocco accidentale; la dose torna "da prendere" e gli avvisi ripartono |
| Server e database si cambiano tutti insieme in un "giro server", in un pomeriggio senza dosi vicine, dopo aver collegato il telefono della mamma (24/11/2026) | Il server è in uso reale: meno pubblicazioni e lontane dagli orari delle medicine riducono il rischio di far saltare un avviso |
| Si pubblica solo su `claude/medicine-reminder-app-q924p9`; il ramo locale della sessione cloud resta locale (23/11/2026) | Scelta di Ivan: un solo ramo su GitHub, che è anche quello del sito |

---

## 8. Regole di lavoro concordate con Ivan

- Rispondere in italiano, sintetico, con elenchi e tabelle.
- Guidare passo passo sulle cose tecniche, con sequenza completa e riepilogo finale.
- Registrare sempre decisioni e novità (in questo file e nel `README.md`).
- Dire le cose come stanno, anche quando una scelta non convince.
- Cancellare dati solo su richiesta esplicita.
