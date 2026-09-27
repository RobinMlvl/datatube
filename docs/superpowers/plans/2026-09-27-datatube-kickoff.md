Tu es l'orchestrateur du projet DataTube (ce dossier, un repo git neuf). Réponds-moi en français ; le code, l'interface, les feuilles et les commits sont en anglais.

Le but : une app Next.js locale. Je colle des liens YouTube (vidéos, playlists, chaînes), elle récupère les transcripts (yt-dlp), écrit une feuille de connaissances par vidéo (DeepSeek), range chaque vidéo dans un thème (Jev, TypeSafe), consolide une feuille par thème, et sert le tout en export Markdown et par un serveur MCP que Claude Code peut lire.

1. Lis en entier, avant tout :
   - docs/superpowers/specs/2026-09-27-datatube-design.md (la spec, validée) ;
   - docs/superpowers/plans/2026-09-27-datatube.md (le plan, 17 tâches) ;
   - docs/reference/ytquest/, la méthode d'origine, en lecture seule.

2. Exécute le plan avec le skill superpowers:subagent-driven-development :
   - les tâches [FABLE/OPUS], tu les fais toi-même ;
   - les tâches [SONNET], tu les confies chacune à un sous-agent (model: sonnet), avec le texte COMPLET de la tâche et la section « Global Constraints » du plan ;
   - tu relis le diff commité de chaque tâche ligne à ligne avant de passer à la suivante, et tu corriges ce qui ne va pas.

   Travaille directement sur main : le repo est neuf, c'est validé.

3. Le code de lib/ et mcp/ du plan a déjà été exécuté tel quel : 137 tests verts, serveur MCP et worker testés. Ce qui n'a pas encore tourné, ce sont le scaffold Next 16 et l'interface (tâches 0 et 11 à 14). Lis node_modules/next/dist/docs/ comme le plan le demande, et note-moi chaque écart.

4. Règles :
   - n'installe rien au niveau système : pour yt-dlp et deno, demande-moi de lancer `brew install yt-dlp deno` ;
   - n'affiche, ne logge et ne commite jamais une clé API ;
   - tests ciblés pendant la construction, suite complète + lint + build une fois à la tâche 16.

5. À la tâche 16, étape 4 (la preuve réelle), arrête-toi et demande-moi :
   - de remplir .env.local avec DEEPSEEK_API_KEY et TYPESAFE_API_KEY ;
   - une playlist de trading d'au moins 3 vidéos, dont une de plus d'une heure ;
   - une chaîne ;
   - une vidéo sans sous-titres.

À la fin, donne-moi un handoff court, le résultat d'abord :
- ce qui marche, prouvé en vrai ;
- les écarts avec le plan, un par un ;
- la commande `claude mcp add` à lancer.
