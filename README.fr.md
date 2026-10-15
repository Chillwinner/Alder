<div align="center">

<img src="docs/readme/logo.svg" width="72" alt="Alder" />

# Alder

**Poste local · Beta v0.1**

Fichiers, mémos et conversation sur la même machine. On glisse, et ça se rejoint.

Modifié à partir de [Free-FS](https://github.com/dromara/free-fs). [Licence Apache 2.0](LICENSE). Attribution dans [NOTICE](NOTICE).

[English](README.md) · [中文](README.zh.md) · [繁體](README.zh-Hant.md) · [日本語](README.ja.md) · [Français](README.fr.md) · [Русский](README.ru.md)

</div>

Alder est un **poste de travail local** : une machine (ou un Docker Compose) fait tourner tout le site pour un bureau ou une maison. Ce n’est pas un disque public. Version **Beta v0.1** : l’API et l’interface vont encore bouger.

Une idée : **l’espace, les mémos et la conversation sont trois portes sur la même matière**. On ne retélécharge pas.

<div align="center">
<img src="docs/readme/interconnect.gif" width="920" alt="Fichiers, mémos et conversation" />
</div>

## Espace de travail

Chaque espace a ses fichiers, membres, rôles et stockages. Le disque local est le défaut. Le stockage objet (MinIO / OSS / COS et autres S3) reste dans cet espace ; on change d’espace, on ne le voit plus.

Grille ou liste, deux volets possibles. Un fichier déjà stocké passe tout de suite. Le disque local reprend avec Tus. Images, Office, audio et vidéo s’ouvrent dans la page.

<div align="center">
<img src="docs/readme/files.gif" width="920" alt="Bibliothèque de l’espace" />
</div>

## Mémos

Mémos à gauche, colonne `fileshare` de l’espace à droite. On glisse des deux côtés. Un fichier de l’espace dans un mémo est une **carte de référence**, pas une copie ; la carte ouvre l’emplacement du fichier. Un fichier de l’ordinateur passe d’abord par cette colonne.

La collaboration utilise Yjs ; les changements partent en SSE. Si le fichier est ensuite supprimé, la carte est marquée invalide.

<div align="center">
<img src="docs/readme/board.gif" width="920" alt="Mémos à côté des fichiers" />
</div>

## Conversation

La conversation flotte sur n’importe quelle page. Sans quitter la bibliothèque, on y dépose un fichier de l’espace (le même), ou on **copie** un fichier de discussion dans un dossier. Vers un mémo : d’abord copie dans `fileshare`, puis carte de référence.

Discussions, groupes, citation, rappel, lu. Le texte est chiffré de bout en bout ; les clés restent sur l’appareil.

<div align="center">
<img src="docs/readme/chat.gif" width="920" alt="Conversation au-dessus de la bibliothèque" />
</div>

Comment glisser :

| Depuis | Déposé sur | Ce qui se passe |
| --- | --- | --- |
| Un fichier de l’espace | Un mémo | Carte de référence, sans copie |
| Un fichier de l’espace | Une conversation | Ce fichier déjà présent est envoyé |
| Un fichier de la conversation | L’espace | Copié dans le dossier sous le pointeur |
| Un fichier de la conversation | Un mémo | Copié dans la colonne, puis carte |
| Un fichier de l’ordinateur | Un mémo | Téléversé dans la colonne, puis placé dans le mémo |

## Autres fonctions

<div align="center">
<img src="docs/readme/more.gif" width="920" alt="Accueil, avancement, réunions, notifications, collectes, transferts" />
</div>

| | | |
| --- | --- | --- |
| **Accueil et calendrier** | Catégories, fichiers récents, stockage. Grande date, calendrier lunaire, jours fériés. Les événements personnels ne suivent pas l’espace. | <img src="docs/readme/home.gif" width="280" alt="Accueil" /> |
| **Collecte** | Lien pour des membres choisis ; les fichiers tombent dans un dossier choisi. Rappels dans la cloche, pas dans le chat. | <img src="docs/readme/collections.gif" width="280" alt="Collecte" /> |
| **Avancement** | Tâches et pointage quotidien. Tableau / liste / mois. Photos dans `fileshare/scale`, puis relecture. | <img src="docs/readme/progress.gif" width="280" alt="Avancement" /> |
| **Réunions** | Réservées par espace, ouvertes 15 minutes avant. Tableau, micro, caméras, un partage d’écran. P2P, sinon TURN. | <img src="docs/readme/meetings.gif" width="280" alt="Réunions" /> |
| **Notifications et votes** | Invitations, collectes, votes, réunions dans la cloche. Ce qui est fermé ne revient pas. | <img src="docs/readme/notifications.gif" width="280" alt="Notifications" /> |
| **Transferts** | Progression, pause, reprise. Entre amis du même réseau, envoi local sans stockage objet. | <img src="docs/readme/transfer.gif" width="280" alt="Transferts" /> |
| **Partage** | Lien et code. Un fichier reçu peut être enregistré dans son espace. | |
| **Config du site** | Courrier, domaine, CORS, chemins locaux, TURN. Les secrets ne sont pas renvoyés. Export chiffré `alder-site.box`. | |

Langues de l’interface : anglais, chinois simplifié, chinois traditionnel.

## Déploiement (poste local)

Il faut [Docker](https://docs.docker.com/get-docker/) et Docker Compose. Le premier build tire les images JDK / Node et prend quelques minutes.

```bash
git clone <ce-dépôt> alder && cd alder
docker compose up -d --build
```

Ouvrez **http://localhost**. L’API est aussi sur `http://localhost:8080` (doc `/swagger-ui.html`).

Les données sont dans deux volumes : `alder-pg` (PostgreSQL) et `alder-files` (envois locaux). Arrêter les conteneurs ne les efface pas.

```bash
docker compose logs -f gateway
docker compose down          # arrêt, volumes conservés
docker compose down -v       # arrêt et vidage de la base et des fichiers
```

Le compte Compose par défaut est `alder` / `alder`, pour un réseau fermé. Avant d’exposer la machine, changez le mot de passe et le JWT, et remplissez courrier et CORS dans Réglages → Config du site. Les réunions hors LAN demandent votre TURN.

Sans Docker : JDK 21, Maven, PostgreSQL, Redis, Node.js. Copiez `application.example.yml` et `application-dev.example.yml` sans `.example`. Ne démarrez que `Gateway` (sans `-am`). Le front `npm run dev` écoute `http://localhost:5180`.

## Licence

Publié sous la [licence Apache 2.0](LICENSE).

Alder est un dérivé de [Free-FS](https://github.com/dromara/free-fs) (xddcode et la communauté dromara), pas une publication officielle. Les mentions amont sont conservées selon Apache 2.0 §4. Attribution dans [NOTICE](NOTICE).
