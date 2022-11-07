# GmodWebAPI
Une API web faite en NodeJS utilisée pour mes serveurs Gmod bhop et surf (le bhop et le surf étant 2 gamemodes dans lesquels le but est de terminer une map le plus rapidement posssible).

Elle est actuellement utilisé sur mes serveurs pour :
- Afficher l'avatar et le nombre de membres du serveur Discord
- Partager la nom de la map jouée, le nombre de joueurs connectés et la liste des joueurs entre les 2 serveurs
- Afficher un menu d'aide à partir de fichiers JSON	renvoyés par l'API
- Stocker et retrouver des données à propos des joueurs
- Afficher les temps des joueurs sur une map
- Mettre en cache les positions et les angles des joueurs afin que le serveur soit capables de rejouer leur performance lorsqu'ils battent un record
- Mettre en ligne une capture d'écran de la map pour que celle-ci puisse être affichée dans un menu
- Interagir avec un bot discord qui a des fonctionnalités de logs et d'affichage du statut des serveurs en temps réel

Cette API est disponible à l'adresse suivante : https://api.dotshark.ovh

## Méthodes utilisables
| Méthode HTTP | URI | Contenu envoyé | Réponse |
| ----------- | --- | ---- | -------- |
| GET | /:server | `null` | `text` Méthodes disponibles |
| GET | /:server/infos | `null` | `json` Statut du serveur |
| PUT | /:server/infos | `json` Statut du serveur | `HTTP Status` |
| GET | /:server.png | `null` | `png` | Icône du serveur |
| GET | /:server/menu/:lang | `null` | `json` Contenu du menu |
| GET | /player/schema | `null` | `json` Schéma d'un document `player` |
| GET | /player/:steamID64 | `null` | `json` Donnée du joueur |
| PATCH | /player/:steamID64 | `json` Modifications demandées | `HTTP Status` |
| GET | /:server/records | `null` | `json` Temps enregistrés sur le serveur |
| GET | /:server/recorder/:steamID64 | `null`| `csv` Liste des positions du joueur |
| POST | /:server/recorder/:steamID64 | `json` {"csv": playerPositionsChunk} | `HTTP Status` |
| DELETE | /:server/recorder/:steamID64 | `null` | `HTTP Status` |
| DELETE | /:server/recorder | `null` | `HTTP Status` |
| PUT | /maps/:mapName/screen | `raw jpg` Capture d'écran de la map | `HTTP Status` |
| POST | /discord/message | `json` Message discord | `HTTP Status` |

## Variables d'environnement
```
PORT=8010 # Port du serveur web
WSS_PORT=8020 # Port du serveur WebSocket (utilisé pour communiquer avec le bot discord)
ACCESS_TOKEN="" # Défini le token utilisé par les serveur pour se connecter à l'API (nécessaire pour les méthodes induisant des changements d'état)
MONGO_URI="" # Défini l'URI utilisé pour se connecter à la base de données qui stocke les données des joueurs
STEAM_API_KEY="" # Clé API Steam (https://steamcommunity.com/dev/apikey) (utilisé pour trouver les pseudos des joueurs)
# Configuration MySQL (utilisé pour retrouver les temps des joueurs)
MYSQL_HOST="localhost"
MYSQL_USER=""
MYSQL_PASSWORD=""
MYSQL_DATABASE="gmod_servers"
```
