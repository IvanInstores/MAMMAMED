# PASSAGGIO – MAMMAMED

Documento di consegna per chi riparte da zero, senza la conversazione in cui il progetto è nato.
Ultimo aggiornamento: 23 novembre 2026.

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
| Archivio GitHub | `IvanInstores/MAMMAMED` (pubblico) |
| Ramo con la versione più recente | `claude/medicine-reminder-app-q924p9` |
| Ramo `main` | Non esiste: l'unico ramo è quello sopra, ed è quello pubblicato |

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
| **GitHub** | Codice | Archivio `IvanInstores/MAMMAMED` |
| **GitHub Pages** | Pubblicazione del sito | Dal ramo `claude/medicine-reminder-app-q924p9`, cartella `/ (root)`. Indirizzo: `https://ivaninstores.github.io/MAMMAMED/` |
| **Supabase** | Database e server | Progetto `mammamed`, codice `jqwtcbnfgbfazyjokuzs`, regione `eu-central-1`, organizzazione "Ivan Personale". Server: `https://jqwtcbnfgbfazyjokuzs.supabase.co/functions/v1/api` |
| **Servizi push dei browser** | Consegna notifiche | Google (Android/Chrome) e Apple (iPhone): nessun account da gestire |

### Chiavi di accesso (importante)
- Non ci sono password. Si entra con due **link segreti**: `https://ivaninstores.github.io/MAMMAMED/?k=<chiave>`.
- Le chiavi **non sono in questo archivio**, perché è pubblico. Stanno nella tabella `config` di Supabase, righe `admin_token` (Ivan) e `mom_token` (mamma).
- Per leggerle: Supabase → progetto `mammamed` → Table Editor → `config`.
- Per cambiarle (se un link finisce in mani sbagliate): modifica il valore nella tabella. I vecchi link smettono di funzionare e vanno riaperti quelli nuovi su entrambi i telefoni.

---

## 5. Come si avvia

### Usare l'app (già online)
Non c'è niente da avviare: sito e server sono già pubblicati. Basta aprire il link segreto.

### Lavorarci dal PC
1. Scarica l'archivio: `git clone https://github.com/IvanInstores/MAMMAMED.git`
2. Entra nella cartella e passa al ramo: `git checkout claude/medicine-reminder-app-q924p9`
3. Per vedere l'app in locale serve un piccolo server web (un service worker non funziona aprendo il file con doppio clic). Per esempio: `python -m http.server 8000`, poi apri `http://localhost:8000/?k=<chiave>`.
4. L'app in locale parla con il server vero: le modifiche ai dati sono reali.

### Pubblicare una modifica
| Cosa modifichi | Come va online |
|---|---|
| App (`index.html`, `app.js`, `style.css`, `sw.js`) | `git commit` + `git push` sul ramo: GitHub Pages si aggiorna da solo in 1-2 minuti |
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

### In corso
- **Telefono della mamma non ancora collegato.** Finché non si fa, a lei non arriva nessun avviso. Passaggi (Android, Chrome):
  1. Dal pannello di Ivan: "Invia il link alla mamma".
  2. Sul suo telefono aprire il link con Chrome.
  3. Menu ⋮ → "Aggiungi a schermata Home", poi aprire l'app **Medicine** dalla Home.
  4. Toccare il tasto giallo "TOCCA QUI PER ATTIVARE GLI AVVISI" → Consenti.
  5. Impostazioni → App → Chrome → Batteria → "Senza restrizioni".
  6. Dal pannello: "Manda un avviso di prova alla mamma".

### Non ancora provato
- Notifica reale ricevuta su un telefono, e tasto "L'HO PRESA" dentro la notifica.
- Giro completo sul server vero con quantità diverse per orario e con fine terapia scaduta (le modifiche sono caricate senza errori, ma verificate solo in locale).
- Comportamento su iPhone.
- Costo del progetto Supabase: da controllare nel pannello che sia sul piano gratuito.

### Manca / idee proposte e non fatte
- Riepilogo settimanale via email (prese e dimenticate).
- Avviso "scorta in esaurimento" con conteggio delle compresse.
- Un secondo familiare che riceve gli allarmi.
- Data di inizio terapia (oggi c'è solo la fine).
- Prove automatiche salvate nell'archivio (quelle fatte finora erano script temporanei, non conservati).

### Limiti noti
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
| Progetto Supabase separato (`mammamed`) | Scelta di Ivan: non mescolare con il progetto esistente "bilancio" |
| Chiavi fuori dall'archivio | L'archivio è pubblico (necessario per GitHub Pages gratuito) |
| Foto ridotta e salvata nel database | Semplicità: nessun servizio di archiviazione in più |
| Avviso ripetuto ogni 10 min, allarme a Ivan dopo 30 | Valori iniziali ragionevoli, modificabili dal pannello |
| Fine terapia: data compresa, facoltativa | Richiesta di Ivan; l'ultimo giorno scelto ha ancora gli avvisi |
| Più assunzioni al giorno: una riga per assunzione con orario e quantità propri | Richiesta di Ivan: la stessa medicina può avere dosi diverse (es. 1 compressa al mattino, mezza alla sera) |
| Conferma anche dal tasto dentro la notifica (Android) | "Un clic" come richiesto; se la chiamata fallisce si apre l'app |
| Ivan può segnare o annullare una conferma dal pannello | Per correggere errori o registrare una conferma avuta al telefono |

---

## 8. Regole di lavoro concordate con Ivan

- Rispondere in italiano, sintetico, con elenchi e tabelle.
- Guidare passo passo sulle cose tecniche, con sequenza completa e riepilogo finale.
- Registrare sempre decisioni e novità (in questo file e nel `README.md`).
- Dire le cose come stanno, anche quando una scelta non convince.
- Cancellare dati solo su richiesta esplicita.
