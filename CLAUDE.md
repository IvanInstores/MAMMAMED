# CLAUDE.md – Regole permanenti del progetto MAMMAMED

## All'inizio di ogni sessione
1. Leggi `PASSAGGIO.md`: contiene cos'è il progetto, com'è fatto, lo stato del lavoro e le decisioni prese.
2. Lavora sul ramo `claude/medicine-reminder-app-q924p9` (è l'unico ramo ed è quello pubblicato come sito).

## A ogni novità
- Aggiorna `PASSAGGIO.md` nella stessa modifica: stato del lavoro (sezione 6), decisioni e perché (sezione 7), servizi esterni se cambiano (sezione 4).
- Se cambia il funzionamento visibile, aggiorna anche `README.md`.
- Un lavoro non è finito finché `PASSAGGIO.md` non lo racconta.

## ATTENZIONE: l'archivio è PUBBLICO
Chiunque può leggere ogni file e tutta la cronologia. Quindi mai, in nessun file, messaggio di commit o nome di ramo:
- chiavi e link segreti (`admin_token`, `mom_token`, link con `?k=...`);
- chiavi private (VAPID privata, chiave `service_role` di Supabase, password, token);
- dati personali: nomi di medicine reali della mamma, numeri di telefono, email, indirizzi, foto.

Regole pratiche:
- Le chiavi stanno solo nella tabella `config` di Supabase. Nei file si scrive `<chiave>` come segnaposto.
- Negli esempi e nelle prove usa dati finti (es. "PROVA", "Medicina A").
- Prima di ogni commit controlla che nel diff non ci sia nulla dell'elenco sopra.
- Se una chiave finisce per errore nell'archivio: cancellarla dal file non basta (resta nella cronologia). Va cambiata subito nella tabella `config` e vanno riaperti i link nuovi sui due telefoni.
- L'indirizzo del server in `config.js` è pubblico per natura e può restare.

## Come si pubblicano le modifiche
| Cosa modifichi | Come va online |
|---|---|
| App (`index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`, `icons/`) | `git commit` + `git push` sul ramo: GitHub Pages si aggiorna da solo in 1-2 minuti |
| Server (`supabase/functions/api/index.ts`) | Il push non basta: va ripubblicata la funzione `api` su Supabase, **con verifica JWT disattivata** (il server controlla da solo le chiavi) |
| Database | Nuovo file numerato in `supabase/migrations/` (es. `005_...sql`), da eseguire anche su Supabase. Mai modificare una migrazione già eseguita |

- Progetto Supabase: `mammamed`, codice `jqwtcbnfgbfazyjokuzs`.
- File nell'archivio e versione online devono restare uguali: se cambi server o database su Supabase, salva la stessa modifica nei file, e viceversa.
- Il server è in uso reale: una modifica sbagliata può far saltare un avviso di medicina. Prova prima in locale e dichiara cosa è stato verificato e cosa no.

## Regole di lavoro concordate con Ivan
- Rispondere in italiano, sintetico, con elenchi e tabelle.
- Guidare passo passo sulle cose tecniche, con sequenza completa e riepilogo finale.
- Registrare sempre decisioni e novità (in `PASSAGGIO.md` e nel `README.md`).
- Dire le cose come stanno, anche quando una scelta non convince, e proporre strade migliori.
- Cancellare dati solo su richiesta esplicita.

## Regole per i testi dell'app
- Sempre in italiano, linguaggio semplicissimo.
- Lato mamma: testi e immagini molto grandi e leggibili, pochi elementi, un solo tasto per confermare.
