// Dependencies and data
// require("dotenv").config()
const express = require("express")
const axios = require("axios")
const gamedig = require("gamedig")
const fs = require("fs")
const WebSocket  = require("ws")
const mongoose = require("mongoose")
const mysql = require("mysql2")
const SteamID = require("steamid")

const app = express()
const imgFile = "/home/ds_web/api/images/discord.png"
let servers = {
	discord: {},
	bhop: {},
	surf: {},
	dev: {}
}
const joinURLs = {
	bhop: "steam://connect/dotshark.ovh:27015",
	surf: "steam://connect/dotshark.ovh:27025"
}
const medals = [":first_place:", ":second_place:", ":third_place:"]
let discordBot


// Login middleware
function loginToken(req, res, next) {
	const authHeader = req.headers["authorization"]
	const token = authHeader && authHeader.split(" ")[1]

	if (token === process.env.ACCESS_TOKEN) {
		next()
	} else {
		res.status(403).send("You need an acess token to use this method")
	}
}


// MongoDB
const {bhopPlayer, bhopPlayers} = require("./data_models/bhopPlayer")

async function mongoLogin() {
	try {
		await mongoose.connect(process.env.MONGO_URI)
		console.log("Connected to the MongoDB Database")
	} catch(error) {
		console.error(error)
	}
}

mongoLogin()


// MySQL
function createMysqlPool() {
	const env = process.env
	const mysqlPool = mysql.createPool({host: env.MYSQL_HOST, user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: env.MYSQL_DATABASE})
	return mysqlPool.promise()
}

const mysqlPool = createMysqlPool()


// Players recorders
let playerRecorder = {
	surf: {}, bhop: {}
}


// Web API
app.use( express.json() )
app.use( express.raw({
	type: ["png", "jpg"],
	limit: "2mb"
}) )

app.get("/", (req, res) => {
	res.send("Welcolme to DotShark's Gmod servers API, you can see the documentation <a href='https://github.com/DotShark/GmodWebAPI'>here</a>")
})

app.get("/:server", (req, res) => {
	const gServer = req.params.server
	if (gServer !== "bhop" && gServer !== "surf") {
		res.status(404).send("Sorry, this server doesn't exist")
	} else {
		res.send("Available methods:<br/>\n- infos")
	}
})

app.get("/discord/infos", async (req, res) => {
	let discord = servers.discord
	if (!discord) discord = {}
	res.json(discord)
})

app.get("/discord.png", async (req, res) => {
	res.sendFile(imgFile)
})

app.post("/discord.png", loginToken, (req, res) => {
	if (!req.body.length) {
		res.status(500).send("Invalid file")
		return
	}

	fs.writeFile("images/discord.png", req.body, (err) => {
		if (err) {
			res.status(500).send("Failed to copy the file")
		} else {
			res.send("Received discord logo")
		}
	})
})

app.get("/equinox/infos", async (req, res) => {
	try {
		const serverInfos = await gamedig.query({
			type: "garrysmod",
			host: "193.34.79.20",
			port: 63908
		})
		res.json({
			map: serverInfos.map,
			slots: serverInfos.maxplayers,
			nPlayers: serverInfos.players.length,
			playersList: []
		})
	} catch {
		res.status(404).send("No infos available for this server")
	}
})

app.get("/:server/infos", (req, res) => {
	const serverInfos = servers[req.params.server]
	if (serverInfos) {
		res.json(serverInfos)
	} else {
		res.status(404).send("No infos available for this server")
	}
})

app.put("/:server/infos", loginToken, async (req, res) => {
	const serverID = req.params.server
	if (!servers[serverID]) {
		res.status(404).send(`There isn't any ${serverID} server`)
		return
	}
	const infos = req.body
	servers[serverID] = infos
	res.send(`Successfully updated ${serverID} infos`)

	if (discordBot && serverID !== "discord") {
		const messageData = {
			type: "status",
			server: serverID,
			status: infos
		}
		discordBot.send( JSON.stringify(messageData) )
	}
})

app.get("/:server.png", (req, res) => {
	const gServer = req.params.server
	if (gServer != "bhop" && gServer != "surf" && gServer != "equinox") {
		res.status(404).send("Sorry, this server doesn't exist")
		return
	}

	res.sendFile(`/home/ds_web/api/images/${gServer}.png`)
})

app.get("/:server/menu/:lang", async (req, res) => {
	const gServer = req.params.server
	const lang = req.params.lang
	res.sendFile(`/home/ds_web/api/menus/${gServer}_${lang}.json`, (err) => {
		if (!err) return
		res.sendFile(`/home/ds_web/api/menus/${gServer}_en.json`, (err) => {
			if (err) res.status(404).send("Unable to find menu properties for this server")
		})
	})
})

app.get("/player/schema", (req, res) => {
	const server = req.params.server
	if (server === "bhop" || server === "pouf") {
		res.json(bhopPlayer)
	} else  {
		res.status(404).send("Sorry, there isn't any data here")
	}
})

app.get("/player/:steamID64", async (req, res) => {
	const steamID64 = req.params.steamID64
	let found = true
	try {
		const player = await bhopPlayers.findOne({SteamID64: steamID64})
		if (player) {
			res.json(player)
		} else {
			found = false
		}
	} catch {
		found = false
	}

	if (found) return
	let saved = true
	try {
		let id = new SteamID(steamID64)
		let name = ""
		try {
			let steamData = await axios.get(
				`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${process.env.STEAM_API_KEY}&steamids=${steamID64}`,
				{headers: {"User-Agent": "node-fetch"} }
			)
			name = steamData.data.response.players[0].personaname
		} catch (error) {
			console.error(error)
		}
		const player = await  bhopPlayers.create({SteamID64: steamID64, SteamID: id.getSteam2RenderedID(), Name: name})
		res.json(player)
	} catch(error) {
		saved = false
	}

	if (saved) return
	try {
		const player = await bhopPlayers.findOne({SteamID64: steamID64})
		if (player) {
			res.json(player)
		} else {
			res.status(500).send(error)
		}
	} catch {
		res.status(500).send(error)
	}
})

app.patch("/player/:steamID64", loginToken, async (req, res) => {
	try {
		const player = await bhopPlayers.findOneAndUpdate({SteamID64: req.params.steamID64}, req.body)
		res.json(player)
	} catch (error) {
		if (error.codeName === "UnknownReplWriteConcern") {
			res.send("Saving the data")
		} else {
			res.status(500).send(error)
		}
	}
} )

app.get("/:server/records", async (req, res) => {
	const server = req.params.server
	let searchQuery = `SELECT * FROM ${(server == "bhop" ? "game" : "surf")}_times WHERE`
	let conditions = []

	if (req.query.map) conditions.push({column: "szMap", value: req.query.map})
	if (req.query.player) {
		try {
			let steamID = new SteamID(req.query.player)
			conditions.push({column: "szUID", value: steamID.getSteam2RenderedID()})
		} catch {
			console.error("Sombody sent an invalid records request")
		}
	}
	if (req.query.mode) conditions.push({column: "nStyle", value: parseInt(req.query.mode)})

	if (conditions.length < 2) {
		res.status(403).send("Illegal request: you can't ask for so much records")
		return
	}

	let i = 0
	let values = []
	conditions.forEach(condition => {
		i++
		let queryPart = (i > 1) ? " AND" : ""
		queryPart = `${queryPart} ${condition.column} = ?`
		searchQuery += queryPart
		values.push(condition.value)
	})

	const [rows] = await mysqlPool.execute(searchQuery + " ORDER BY nTime", values)
	let records = []
	rows.forEach(row => {
		let name = new Buffer.from(row.szPlayer, "base64")
		name = name.toString("ascii")
		const data = row.vData.split(" ")
		records.push({SteamID: row.szUID, Name: name, Map: row.szMap, Mode: row.nStyle, Time: row.nTime, Date: row.szDate, Speed: {Max: data[0], Average: data[1]}, Jumps: data[2], Sync: data[3]})
	})
	res.json(records)
})

app.get("/:server/recorder/:steamID64", loginToken, (req, res) => {
	const server = req.params.server 
	const steamID64 = req.params.steamID64
	if (!server || !playerRecorder[server] || !steamID64 || !playerRecorder[server][steamID64]) {
		res.status(404).send("This player isn't being recorded")
		return
	}
	
	const playerData = playerRecorder[server][steamID64]
	let csv = ""
	const lTab = playerData[0].length, nCol = playerData.length
	for (let iTab = 0; iTab < lTab; iTab++) {
		for (let iCol = 0; iCol < nCol; iCol++) {
			csv += `${playerData[iCol][iTab]}${(iCol + 1 < nCol) ? "," : ";"}`
		}
	}

	playerRecorder[server][steamID64] = null
	res.send(csv)
})

app.post("/:server/recorder/:steamID64", loginToken, (req, res) => {
	const server = req.params.server 
	const steamID64 = req.params.steamID64
	if (!server || !playerRecorder[server] || !steamID64) {
		res.status(403).send("Illegal query")
		return
	}
	
	if (!playerRecorder[server][steamID64]) playerRecorder[server][steamID64] = []
	let playerData = playerRecorder[server][steamID64]
	const snapshots = req.body.csv.split(";")
	snapshots.forEach(snapshot => {
		if (snapshot === "") return 
		const snapshotData = snapshot.split(",")
		for (let i = 0; i < snapshotData.length; i++) {
			if (!playerData[i]) playerData[i] = []
			playerData[i].push( Number(snapshotData[i]) )
		}
	})

	res.send(`[${server}] Cached recorder data for ${steamID64}`)
})

app.delete("/:server/recorder/:steamID64", loginToken, (req, res) => {
	const server = req.params.server 
	const steamID64 = req.params.steamID64
	if (server && playerRecorder[server] && steamID64 && playerRecorder[server][steamID64]) {
		playerRecorder[server][steamID64] = null
		res.send(`[${server}] Deleted recorder data for ${steamID}`)
	} else {
		res.status(403).send("Failed to delete player data: Illegal query")
	}
})

app.delete("/:server/recorder", loginToken, (req, res) => {
	const server = req.params.server 
	if (server && playerRecorder[server]) {
		playerRecorder[server] = {}
		res.send(`[${server}] Deleted recorder data`)
	} else {
		res.status(403).send("Failed to delete data: Illegal query")
	}
})

app.put("/maps/:mapName/screen", loginToken, async (req, res) => {
	const mapName = req.params.mapName
	const path = `/home/ds_web/pouf/discord/${mapName}.jpg`
	let replaced = true
	
	try {
		await fs.promises.access(path)
		await fs.promises.unlink(path)
	} catch {
		replaced = false
	}

	try {
		await fs.promises.writeFile(path, req.body)
	} catch (err) {
		res.status(500).send("Failed to upload the file")
		console.log(err)
		return
	}
	res.send(`Successfully ${(replaced) ? "replaced" : "posted"} the map screenshot`)

	try {
		await axios.get(`https://pouf.dotshark.ovh/discord/${mapName}.jpg`)
	} catch {
		console.log("The screen can't be accessed publicly")
	}

	Object.entries(servers).forEach(async ([server, infos]) => {
		if (infos.map !== mapName) return
		try {
			await axios.post(`https://api.dotshark.ovh/${server}/infos`, infos, {
				headers: {authorization: `Bearer ${process.env.ACCESS_TOKEN}`}
			})
		} finally {
			console.log(`Updated the discord embed status for the ${server} server`)
		}
	})
})

app.post("/discord/message", loginToken, (req, res) => {
	if (discordBot) {
		discordBot.send( JSON.stringify(req.body) )
		res.send("Sended the message to the discord bot")
	} else {
		res.status(500).send("Failed to send the body to the discord bot")
	}
})

app.listen(process.env.PORT, () => {
	console.log(`DotShark's API listening at localhost:${process.env.PORT}`)
	fs.readFile("data/servers.json", (err, data) => {
		if (err) return
		data = JSON.parse(data)
		Object.entries(data).forEach(([serverID, infos]) => servers[serverID] = infos)
	})
})


// WebSocket server
const wss = new WebSocket.Server({port: process.env.WSS_PORT})

wss.on("listening", () => {
	console.log(`WebSocket server listening at localhost:${process.env.WSS_PORT}`)
})

wss.on("connection", (ws, req) => {
	// console.log(`New client connected: ${req.socket.localAddress}`)
	discordBot = ws
	ws.send("Successfully estabished a websocket connection", {})
})


// Process exit handler
process.on("SIGINT", async () => {
	fs.writeFile("data/servers.json", JSON.stringify(servers), (err) => {
		process.exit(err ? 1 : 0)
	})
})