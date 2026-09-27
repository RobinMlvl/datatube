# DataTube : la bibliothèque de connaissances YouTube

Spec du 2026-09-27, validée section par section avec Robin.

## 1. Le but

Une app Next.js **locale** (le Mac de Robin, sans cloud, sans compte).

On y colle des liens YouTube : des vidéos, une playlist ou une chaîne entière. L'app récupère le transcript de chaque vidéo, en écrit le résumé et range la vidéo dans un thème. Elle produit ensuite des **feuilles de connaissances** qu'on donne à une IA. Exemple : une série de vidéos de trading devient une feuille « Trading › Breakout », qu'un agent lit pour coder la stratégie dans un bot.

**Critère de réussite, démontré en vrai :**
1. On importe une playlist de trading.
2. Chaque vidéo a son résumé horodaté et son thème.
3. La feuille du thème consolide les vidéos.
4. Claude Code, via le serveur MCP de DataTube, lit cette feuille et en extrait la stratégie.

## 2. D'où vient la méthode

Elle vient du profil Hermes **ytquest** (VPS Dewex), copié tel quel dans `docs/reference/ytquest/`, sans cookies ni secrets. On en garde quatre choses :

- **Les règles anti-hallucination du SOUL :**
  - le transcript est la seule source ;
  - toute affirmation cite le texte et son horodatage `[MM:SS]` ;
  - une info absente s'écrit « pas dans la vidéo », jamais une reformulation approximative ;
  - aucune connaissance extérieure, aucune spéculation sur ce que l'orateur « voulait dire ».
- **Le parseur VTT** (`scripts/parse_vtt.py`). Dans les sous-titres auto de YouTube, le texte propre est porté par les segments d'une frame (moins de 0,02 s). On retire les balises de mots et on dédoublonne les lignes consécutives. Il est porté en JS.
- **Le découpage des longs transcripts :** au-delà de 50K caractères, blocs de 40K avec 2K de chevauchement, un résumé par bloc, puis une fusion.
- **Le format du résumé** (`references/summary-format-example.md`).

Ce qu'on laisse : les cookies, le solveur JS distant, le bridge iPhone et Tor. Tout cela contournait le blocage des IP de datacenter (Hetzner). Depuis l'IP résidentielle de Robin, le chemin simple suffit, comme l'a montré `YoutubeTranscript/transcribe.py` en mai 2026.

## 3. Décisions de Robin (27/09)

| Question | Décision |
|---|---|
| Unité de la feuille | **Par vidéo ET par thème** : une feuille par vidéo, et une feuille consolidée par thème |
| Classement | **L'IA propose, Robin corrige** |
| Contenu d'une feuille | **Résumé générique** (le format ytquest), le même pour toutes les vidéos, sans gabarit par domaine |
| Modèles | **DeepSeek écrit, Jev classe.** DeepSeek : résumés, feuilles de thème, nom d'un nouveau thème. Jev (TypeSafe System One) : le choix du thème, avec sa confiance. Jev ne génère jamais de texte, il répond par des probabilités calibrées. |
| Sortie vers une IA | **Export Markdown + serveur MCP local** |
| Import | **Liens, playlists et chaînes** |
| Moteur YouTube | **yt-dlp** |
| Emplacement | `~/Documents/Business/DataTube`, nouveau repo git |

## 4. Architecture

- **Stack :**
  - Next.js 16 (App Router), React 19, **JavaScript**, Tailwind v4 ;
  - zod aux frontières, vitest ;
  - Node 22 (installé : v22.23.2).
- **Stockage :** un fichier SQLite, `data/datatube.db`, via `better-sqlite3`. Il est hors git. Sauvegarder la bibliothèque = copier ce fichier.
- **Trois process :**
  - `web` : l'app Next ;
  - `worker` : `worker/index.mjs`, qui prend les jobs de la table `Job` un par un. Aucun Redis : SQLite suffit à un utilisateur.
  - `mcp` : `mcp/server.mjs`, lancé par Claude Code lui-même.

  `npm run dev` lance `web` et `worker` ensemble.
- **Secrets :** `DEEPSEEK_API_KEY` et `TYPESAFE_API_KEY` dans `.env.local`, qui n'est jamais commité. Une clé n'est jamais écrite en base, dans un log ou dans une page.
- **Outils système :** `yt-dlp` et `deno` (le runtime JS dont yt-dlp a besoin pour YouTube), installés avec `brew install yt-dlp deno`. Settings vérifie qu'ils sont là et donne la commande sinon.
- **Langue :** le texte de l'interface est en anglais (convention de Robin), les feuilles sont en français, le code et les commits en anglais.

### Données

Toutes les dates sont stockées en UTC (ISO).

| Table | Colonnes |
|---|---|
| `Video` | `id` (id YouTube, 11 caractères), `url`, `title`, `channel`, `channelId`, `durationS`, `publishedAt`, `chapters` (JSON), `language` (langue du transcript retenu), `state`, `error`, `themeId`, `themeSource` (`auto` \| `manual` \| `proposed`), `proposedTheme` (JSON `{ name, parent }`), `classifyConfidence` (entier 0-1000), `importBatchId`, `createdAt`, `updatedAt` |
| `Transcript` | `videoId`, `language`, `kind` (`manual` \| `auto`), `text` (lignes `[MM:SS] …`, `[H:MM:SS]` au-delà d'une heure), `chars` |
| `Summary` | `videoId`, `markdown`, `model`, `createdAt` |
| `Theme` | `id`, `name`, `parentId` (deux niveaux au plus), `sheetMarkdown`, `sheetModel`, `sheetGeneratedAt`, `changesSinceSheet` (entier) |
| `ImportBatch` | `id`, `input` (le texte collé), `createdAt`, `videoCount` |
| `Job` | `id`, `videoId`, `step` (`fetch` \| `summarize` \| `classify`), `state` (`queued` \| `running` \| `done` \| `failed`), `attempts`, `runAfter`, `error` |
| `ApiCall` | `provider`, `feature`, `videoId`, `tokensIn`, `tokensOut`, `costMicrousd` (**entier**), `createdAt` |
| `Setting` | `key`, `value` (JSON) |
| `SearchIndex` | table FTS5 sur titre, résumé et transcript |

Les états d'une `Video` : `queued` → `fetching` → `summarizing` → `classifying` → `done`. Les sorties sont `no_transcript` (aucun sous-titre) et `failed` (avec `error`).

## 5. Le traitement d'une vidéo

### 5.1 Import
- Robin colle un texte : des liens (un par ligne), une playlist ou une chaîne.
- Chaque ligne passe par `yt-dlp --flat-playlist -J <url>`, qui déplie playlists et chaînes (onglet Vidéos).
- Un id déjà en base est ignoré et compté (« 12 imported, 3 already in the library »).
- Chaque nouvelle vidéo reçoit un job `fetch`.

### 5.2 Transcript (`fetch`)
- `yt-dlp -J --skip-download <url>` donne les métadonnées : titre, chaîne, durée, date, chapitres, et les listes `subtitles` / `automatic_captions`.
- **Ordre de choix de la piste :**
  1. sous-titres manuels dans la langue d'origine de la vidéo ;
  2. manuels FR ;
  3. manuels EN ;
  4. auto FR ;
  5. auto EN ;
  6. n'importe quelle piste.
- Téléchargement : `yt-dlp --skip-download --write-subs|--write-auto-subs --sub-langs <code> --sub-format vtt -o <tmp>/%(id)s`, puis parsing (§2).
- Si le FR répond HTTP 429, on essaie tout de suite l'EN (règle ytquest : le 429 de timedtext est par langue).
- Aucune piste → état `no_transcript`. La vidéo reste visible, sans résumé, et le bouton Retry reste possible.
- Les vidéos sont traitées une à la fois, avec 3 s de pause entre deux appels à YouTube.

### 5.3 Résumé (`summarize`, DeepSeek)
- Le modèle est un Setting, `deepseek-v4-flash` par défaut. Le « thinking » est forcé à off (piège DeepSeek V4, cf. Dewex).
- Le prompt reprend les règles du §2. La sortie est en français, quelle que soit la langue de la vidéo.
- **Format fixe :**
  - `# <titre>` ;
  - une ligne de métadonnées : chaîne, durée, langue, date, lien ;
  - `## 🎯 Idée centrale` ;
  - `## 📊 Chapitres` : plages horodatées, en suivant les chapitres YouTube quand ils existent ;
  - `## 💡 Points clés` : chaque point porte sa citation `[MM:SS] « texte exact »` ;
  - `## 🛠️ Mise en pratique` : ce que la vidéo dit de faire, sinon « pas dans la vidéo ».
- Transcript de plus de 50K caractères : les notes de chaque bloc de 40K (2K de chevauchement), puis une passe de fusion au même format.
- Chaque appel écrit une ligne `ApiCall`, dont le coût est calculé en micro-USD entiers depuis une table de prix dans le code.

### 5.4 Classement (`classify`, Jev puis DeepSeek)
- **Jev** (`jev-1.13.0`, `POST https://api.typesafe.ai/v1/systemone`) reçoit :
  - l'état : titre, chaîne et idée centrale + points clés du résumé ;
  - une question `choice` : les thèmes existants (« Parent › Enfant ») + « None of these ».
- Si le thème gagnant n'est pas « None » et que sa confiance atteint le seuil (Setting, 600/1000 par défaut), la vidéo y est rangée avec `themeSource = auto`.
- Sinon, **DeepSeek** propose un thème (nom + parent éventuel) à partir du résumé et de la liste des thèmes. La vidéo passe en `themeSource = proposed` et apparaît dans **Review**.
- S'il n'existe encore aucun thème, on passe directement par la proposition DeepSeek.
- Chaque rangement ou retrait incrémente `changesSinceSheet` du thème concerné.

### 5.5 Feuille de thème (à la demande)
- Elle est régénérée **sur clic**, jamais automatiquement : le coût reste sous contrôle.
- La page du thème affiche « Sheet out of date: N changes since ».
- DeepSeek fusionne les résumés des vidéos du thème en une feuille consolidée :
  - chaque point cite `[Titre de la vidéo · MM:SS]` ;
  - une section `## ⚠️ Désaccords entre vidéos` liste les contradictions au lieu de les lisser ;
  - aucune connaissance extérieure.
- Un thème trop gros pour un seul appel est fusionné par paquets de résumés, puis en une passe finale.

### 5.6 Erreurs et reprises
- Une étape qui échoue est réessayée deux fois, avec 30 s puis 2 min d'attente. Elle passe ensuite en `failed`, avec la raison lisible et un bouton **Retry**.
- Si YouTube limite l'app (HTTP 429 sur les métadonnées ou la liste), toute la file se met en pause 10 min (`runAfter`) au lieu de faire échouer chaque vidéo. La page le dit.
- Une clé manquante bloque l'étape concernée avec un message clair, sans rien planter d'autre.

## 6. Interface

| Page | Contenu |
|---|---|
| **Library** `/` | La zone d'import en haut. Un tableau des vidéos : titre, chaîne, durée, thème, état, coût. Des filtres par thème et par état, et la recherche plein texte. Sur le côté, l'arbre des thèmes avec leurs compteurs, plus « To review (N) ». |
| **Video** `/videos/[id]` | Le lecteur YouTube intégré et la feuille rendue. Le transcript avec recherche : cliquer un `[MM:SS]` place le lecteur au bon moment. Les actions : changer de thème, Copy Markdown, Download .md, Regenerate summary, Retry si l'état est `failed`. |
| **Theme** `/themes/[id]` | La feuille consolidée et l'indicateur « out of date ». Les actions : Regenerate sheet, Copy / Download .md, **Export theme** (un .md avec la feuille du thème puis toutes les feuilles vidéo). Les vidéos du thème. Renommer le thème, le déplacer sous un parent. |
| **Review** `/review` | Les vidéos `proposed`, avec la proposition de DeepSeek et la confiance de Jev. Trois gestes : accepter (crée le thème), choisir un thème existant, renommer. |
| **Settings** `/settings` | Le modèle DeepSeek, le seuil de confiance de Jev, la présence des clés (oui/non, jamais la valeur), les versions de yt-dlp et de deno, le coût total et le coût du mois. |

**Export Markdown :** chaque fichier commence par un front-matter YAML (`source`, `channel`, `published`, `theme`, `language`, `generated_by`), pour qu'une IA sache d'où vient ce qu'elle lit.

## 7. Serveur MCP

`mcp/server.mjs` est un serveur stdio (`@modelcontextprotocol/sdk`) en **lecture seule**, qui ouvre la base en mode read-only.

| Outil | Entrée | Sortie |
|---|---|---|
| `list_themes` | aucune | l'arbre des thèmes, avec leur nombre de vidéos et la date de la feuille |
| `search` | `query`, `limit?` | les vidéos correspondantes (FTS5), avec le titre, le thème et un extrait |
| `get_video_sheet` | `videoId` | la feuille Markdown et ses métadonnées |
| `get_theme_sheet` | `themeId` ou `name` | la feuille consolidée, plus la liste de ses vidéos |
| `get_transcript` | `videoId`, `from?`, `to?` (MM:SS) | le transcript horodaté, entier ou sur une plage |

Installation : `claude mcp add datatube -- node ~/Documents/Business/DataTube/mcp/server.mjs`.

## 8. Tests

- **vitest sur les parties pures :**
  - le parseur VTT, sur un vrai fichier `.vtt` de YouTube en fixture ;
  - l'extraction d'id et le typage des liens (vidéo, playlist, chaîne, shorts, youtu.be) ;
  - le choix de la piste de sous-titres ;
  - le découpage 40K / 2K ;
  - la décision de classement (seuil, « None ») ;
  - le calcul des coûts (entiers) ;
  - l'export Markdown et son front-matter ;
  - chaque outil MCP sur une base SQLite de test.
- `yt-dlp`, DeepSeek et Jev sont **injectés**, donc simulés dans les tests. Aucun test n'appelle le réseau ni ne lit l'horloge réelle.
- **Preuve finale en réel** (le critère du §1) :
  - une playlist de trading d'au moins 3 vidéos, dont une de plus d'une heure (pour le découpage) ;
  - une chaîne dépliée ;
  - une vidéo sans sous-titres (état `no_transcript`) ;
  - une feuille de thème régénérée ;
  - puis Claude Code qui la lit par le MCP.

## 9. Hors périmètre (v1)

- La transcription locale (Whisper) des vidéos sans sous-titres. ffmpeg est déjà installé, c'est la v2 naturelle.
- Des gabarits de feuille par domaine : Robin a choisi le résumé générique.
- La synchronisation automatique d'une chaîne (importer ses nouvelles vidéos).
- L'édition manuelle d'une feuille.
- Plusieurs utilisateurs, une authentification, un déploiement cloud.
