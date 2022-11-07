# GmodWebAPI
[Click here to read this file in french](https://github.com/DotShark/GmodWebAPI/blob/main/README_FR.md)
A Web API made in NodeJS used for my Gmod bhop and surf servers (bhop and surf being 2 gamemodes where the goal is to complete a map as quickly as possible).

It's currently in use on the servers to:
- Get the discord server avatar and member count
- Share played map, player count and players list between the 2 servers
- Get some static json data to be displayed in menus
- Store and retrieve players data
- Get players time on a choosed map
- Cache players positions and angles to make the server able to replay their run when they have the best time
- Upload maps screenshots and display them in a menu
- Interract with a discord bot which has server status displaying and logging features

At the moment it's running at https://api.dotshark.ovh

## Available methods
| HTTP Method | URI | Body | Response |
| ----------- | --- | ---- | -------- |
| GET | /:server | `null` | `text` Available methods |
| GET | /:server/infos | `null` | `json` Server infos |
| PUT | /:server/infos | `json` Server infos | `HTTP Status` |
| GET | /:server.png | `null` | `png` | Server icon |
| GET | /:server/menu/:lang | `null` | `json` Menu data |
| GET | /player/schema | `null` | `json` Database schema for a player document |
| GET | /player/:steamID64 | `null` | `json` Player data |
| PATCH | /player/:steamID64 | `json` Partial player data | `HTTP Status` |
| GET | /:server/records | `null` | `json` Get times done on the choosed server |
| GET | /:server/recorder/:steamID64 | `null`| `csv` Table of all the player pos |
| POST | /:server/recorder/:steamID64 | `json` {"csv": playerPositionsChunk} | `HTTP Status` |
| DELETE | /:server/recorder/:steamID64 | `null` | `HTTP Status` |
| DELETE | /:server/recorder | `null` | `HTTP Status` |
| PUT | /maps/:mapName/screen | `raw jpg` Map screenshot | `HTTP Status` |
| POST | /discord/message | `json` Discord message infos | `HTTP Status` |

## Environnement variables
```
PORT=8010 # Web server port
WSS_PORT=8020 # WebSocket server port (used to communicate with the discord bot)
ACCESS_TOKEN="" # Set the token used by the servers to log in (used for post methods)
MONGO_URI="" # Set it to your MongoDB log in URI (used to store players data)
STEAM_API_KEY="" # Set it to your Steam API Key (https://steamcommunity.com/dev/apikey) (used to get players nicknames)
# MySQL client config (used to get players times)
MYSQL_HOST="localhost"
MYSQL_USER=""
MYSQL_PASSWORD=""
MYSQL_DATABASE="gmod_servers"
```
