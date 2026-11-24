# PillolAPP – Promemoria medicine

Sito: `https://ivaninstores.github.io/PillolAPP/` · Archivio: `IvanInstores/PillolAPP` · Nomi precedenti: MAMMAMED, pillolapp

**Maiuscole e minuscole contano**: l'indirizzo giusto è `/PillolAPP/`. I vecchi `/pillolapp/` e `/MAMMAMED/` danno errore 404. I link segreti sono `https://ivaninstores.github.io/PillolAPP/?k=<chiave>`.

App semplicissima: la mamma riceve l'avviso (nome, quantità, tipo, foto) e conferma con un tocco. Ivan gestisce tutto dal suo telefono.

## Come è fatta
| Pezzo | Dove | A cosa serve |
|---|---|---|
| `index.html`, `app.js`, `style.css` | GitHub Pages | L'app (stessa pagina per mamma e Ivan: cambia il link) |
| `sw.js` | GitHub Pages | Riceve gli avvisi anche ad app chiusa |
| `config.js` | GitHub Pages | Indirizzo del server |
| `version.json` | GitHub Pages | Numero di versione pubblicato (uguale a `VERSION` in `app.js`) |
| `supabase/migrations/` | Supabase | Tabelle + controllo ogni minuto |
| `supabase/functions/api/` | Supabase | Server: salva i dati e manda gli avvisi |

## Regole di funzionamento
- All'ora stabilita parte l'avviso sul telefono della mamma.
- Se non conferma, l'avviso si ripete (default ogni 10 minuti, massimo 12 volte).
- Dopo 30 minuti senza conferma (modificabile) arriva un allarme a Ivan.
- Quando la mamma tocca **L'HO PRESA**, Ivan riceve la conferma.
- Fine terapia (facoltativa): dopo quella data, compresa, la medicina non manda più avvisi.
- Stessa medicina più volte al giorno: una riga per ogni assunzione, ognuna con il suo orario e la sua quantità.
- Cambio di indirizzo: aprendo l'app al nuovo indirizzo si spengono da soli gli avvisi rimasti legati a qualsiasi indirizzo vecchio (niente notifiche doppie).
- Senza connessione la schermata della mamma lo dice con un riquadro rosso ("Manca la connessione… Chiama Ivan.") e non afferma più che non c'è niente da prendere.
- Se la conferma non parte compare un errore a tutto schermo; con "HO CAPITO" si torna al tasto verde per riprovare.
- La scheda della medicina sta tutta nello schermo con il tasto verde sempre visibile: se serve si rimpiccioliscono la foto e poi le scritte.
- Elenco "Le medicine di oggi": verde "Presa", arancione "Da prendere" (solo se in alto c'è la scheda con il tasto verde), grigio "Più tardi", grigio "Non segnata" per una dose scaduta senza conferma.
- Icone: Lucide (lucide.dev, licenza ISC), copiate come SVG in `app.js`.
- Aggiornamento automatico: l'app controlla `version.json` e si ricarica da sola quando esce una versione nuova, mai mentre c'è una medicina da prendere sullo schermo. Versione attuale: `2026-11-24.2`.
- Fuso orario: Italia. Nessuna password: si entra con due link segreti (uno per Ivan, uno per la mamma).

## Installazione (una volta sola)
1. Supabase: eseguire `001_init.sql`, pubblicare la funzione `api` (senza verifica JWT), eseguire `002_cron.sql` con il codice progetto.
2. Scrivere in `config.js` l'indirizzo `https://<progetto>.supabase.co/functions/v1/api`.
3. GitHub → Settings → Pages → pubblicare il ramo (cartella `/root`).
4. I link segreti sono nella tabella `config` (`admin_token`, `mom_token`): `https://<sito>/?k=<token>`.
