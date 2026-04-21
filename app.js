// Dependencies and data
// require("dotenv").config()
const express = require("express")
const axios = require("axios")
const fs = require("fs")
const WebSocket  = require("ws")
const mongoose = require("mongoose")
const mysql = require("mysql2")
const SteamID = require("steamid")

const app = express()
const imgFile = `${process.cwd()}/images/discord.png`
let servers = {
	discord: {},
	bhop: {},
	surf: {},
	dev: {}
}
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
const maps = require("./data_models/map")
const { error } = require("console")
const { GmodMap } = require("./utils/gmodMap")

async function mongoLogin() {
	try {
		mongoose.set("strictQuery", false)
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
	const mysqlConfig = {host: env.MYSQL_HOST, user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: env.MYSQL_DATABASE}
	const mysqlPool = mysql.createPool(mysqlConfig)
	return mysqlPool.promise()
}

const mysqlPool = createMysqlPool()


// Players recorders
let playerRecorder = {
	surf: {}, bhop: {}, dev: {}
}


// Web API
app.use( express.json({limit: "100mb"}) )
app.use( express.urlencoded() )
app.use( express.raw({
	type: ["png", "jpg"],
	limit: "2mb"
}) )

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

app.get("/:server/maps", async (req, res) => {
	const serverID = req.params.server
	if (!servers[serverID]) {
		res.status(404).send(`There isn't any ${serverID} server`)
		return
	}

	try {
		const serverMaps = await maps.find({gamemode: serverID})
		for (const map of serverMaps) {
			map.zones = undefined
			map.tweaks = undefined
		}
		res.json(serverMaps)
	} catch (err) {
		console.log(err)
		res.status(404).send(`Unable to find ${serverID} maps`)
	}
})

app.get("/:server/maps/stats", async (req, res) => {
	const serverID = req.params.server
	if (!servers[serverID]) {
		res.status(404).send(`There isn't any ${serverID} server`)
		return
	}

	try {
		const serverMaps = await maps.find({gamemode: serverID})
		let stats = {totalMaps: 0, totalMultiplier: 0, totalBonusMultiplier: 0}
		for (const map of serverMaps) {
			stats.totalMaps++
			if (map.multiplier) stats.totalMultiplier += map.multiplier
			if (map.bonusMultiplier) stats.totalBonusMultiplier += map.bonusMultiplier
		}
		if (serverID === "bhop") {
			// multiplier calculation used to be broken on my bhop server so I have to reproduce the bug if I don't want to break players ranking
			stats.totalMultiplier += 43057
			stats.totalBonusMultiplier += 3987
		}
		res.json(stats)
	} catch (err) {
		console.log(err)
		res.status(404).send(`Unable to find ${serverID} maps`)
	}
})

app.get("/:server/maps/:mapName", async (req, res) => {
	const serverID = req.params.server
	if (!servers[serverID]) {
		res.status(404).send(`There isn't any ${serverID} server`)
		return
	}

	const mapName = req.params.mapName
	try {
		const mapData = await maps.findOne({gamemode: serverID, name: mapName})
		if (!mapData) throw new Error(`Map not found ${mapName}`)
		res.json(mapData)
	} catch (err) {
		console.log(err)
		res.status(404).send(`Unable to find any info for ${mapName}`)
	}
})

app.post("/:server/maps/:mapName", loginToken, async (req, res) => {
	const map = {gamemode: req.params.server, name: req.params.mapName, playable: false, plays: 0}
	try {
		const existing = await maps.findOne({gamemode: map.gamemode, name: map.name})
		if (existing) {
			res.status(409).send(`Map ${map.name} already exists for ${map.gamemode}`)
			return
		}
		await maps.create(map)
		res.status(201).json(map)
	} catch (err) {
		res.status(500).send(`Failed to create ${map.name} document`)
	}
})

app.patch("/:server/maps/:mapName", loginToken, async (req, res) => {
	const {server, mapName} = req.params
	const newParams = {...req.body}

	try {
		const mapData = await maps.findOne({gamemode: server, name: mapName})
		if (newParams.tweaks) newParams.tweaks = {...mapData._doc.tweaks, ...newParams.tweaks}
		await maps.findOneAndUpdate({gamemode: server, name: mapName}, newParams)
		res.status(200).json({...mapData._doc, ...newParams})
	} catch (err) {
		res.status(500).send(`Failed to save ${req.params.mapName} data`)
		console.log(err)
	}
})

app.patch("/:server/maps/:mapName/zones", loginToken, async (req, res) => {
	const {server, mapName} = req.params
	const newZone = req.body

	try {
		const {zones} = await maps.findOne({gamemode: server, name: mapName})
		if (!zones) throw new Error(`Map not found ${mapName}`)
		let updated = false
		console.log(newZone)
		const newZones = zones.map((zone) => {
			if (zone.type === newZone.type) {
				updated = true
				return {...zone, ...newZone}
			} else {
				return zone
			}
		})
		if (!updated) newZones.push(newZone)
		await maps.findOneAndUpdate({gamemode: server, name: mapName}, {zones: newZones})
		res.status(200).json(newZones)
	} catch (err) {
		console.log(err)
		res.status(500).send(`Failed to set zone of type ${zone.type} on ${mapName}`)
	}
})

app.post("/:server/maps/:mapName/zones", loginToken, async (req, res) => {
	const {server, mapName} = req.params
	const newZone = req.body

	try {
		const {zones} = await maps.findOne({gamemode: server, name: mapName})
		if (!zones) throw new Error(`Map not found ${mapName}`)
		zones.push(newZone)
		await maps.findOneAndUpdate({gamemode: server, name: mapName}, {zones})
		res.status(201).json(zones)
	} catch (err) {
		console.log(err)
		res.status(500).send(`Failed to set zone of type ${zone.type} on ${mapName}`)
	}
})

app.delete("/:server/maps/:mapName/zones/:type", loginToken, async (req, res) => {
	const {server, mapName, type} = req.params

	try {
		const {zones} = await maps.findOne({gamemode: server, name: mapName})
		if (!zones) throw new Error(`Map not found ${mapName}`)
		const newZones = zones.filter(zone => zone.type !== parseInt(type))
		await maps.findOneAndUpdate({gamemode: server, name: mapName}, {zones: newZones})
		res.status(200).json(newZones)
	} catch (err) {
		console.log(err)
		res.status(500).send(`Failed to set zone of type ${zone.type} on ${mapName}`)
	}
})

app.post("/:server/downloadMap", loginToken, async (req, res) => {
	const {server} = req.params
	const {mapName} = req.body

	try {
		const map = new GmodMap(mapName)
		await map.download()
		await map.extractBz2()
		await map.uploadFile("bsp", server)
		await map.uploadFile("bz2", "fastdl")
		await map.deleteFile("bsp")
		await map.deleteFile("bz2")
		res.status(201).json({mapName})
	} catch(err) {
		console.error(err)
		res.status(500).send(`Failed to download ${mapName}`)
	}
})

app.get("/:server.png", (req, res) => {
	const gServer = req.params.server
	if (gServer != "bhop" && gServer != "surf" && gServer != "equinox") {
		res.status(404).send("Sorry, this server doesn't exist")
		return
	}

	res.sendFile(`${process.cwd()}/images/${gServer}.png`)
})

app.get("/:server/menu/:lang", async (req, res) => {
	const gServer = req.params.server
	const lang = req.params.lang
	res.sendFile(`${process.cwd()}/menus/${gServer}_${lang}.json`, (err) => {
		if (!err) return
		res.sendFile(`${process.cwd()}/menus/${gServer}_en.json`, (err) => {
			if (err) res.status(404).send("Unable to find menu properties for this server")
		})
	})
})

app.get("/player/schema", (req, res) => {
	res.json(bhopPlayer)
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
		const player = await bhopPlayers.create({SteamID64: steamID64, SteamID: id.getSteam2RenderedID(), Name: name})
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
})

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
		const data = row.vData && row.vData.split(" ")
		records.push({
			SteamID: row.szUID, 
			Name: name,
			Map: row.szMap,
			Mode: row.nStyle,
			Time: row.nTime,
			Date: row.szDate,
			Speed: data && {Max: data[0], Average: data[1]},
			Jumps: data && data[2],
			Sync: data && data[3]
		})
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
		res.send(`[${server}] Deleted recorder data for ${steamID64}`)
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

app.get("/:server/recorder/bots/:map", loginToken, async (req, res) => {
	const server = req.params.server
	const map = req.params.map
	const fsp = fs.promises
	const fetchStart = Date.now()

	const selectQuery = "SELECT nStyle, nTime, szDate, szPlayer, szSteam"
	const tabName = (server == "bhop") ? "game_bots" : "surf_bots"
	const timesTabName = (server == "bhop") ? "game_times" : "surf_times"
	
	const [recordBots] = await mysqlPool.execute(`${selectQuery} FROM ${tabName} WHERE szMap = ? ORDER BY nStyle ASC`, [map])
	
	try {
		await fsp.access(`./record_bots/${map}`)
	} catch {
		await fsp.mkdir(`./record_bots/${map}`)
	}

	const getRankingPositions = recordBots.map(async (recordBot) => {
		const [recordBotRankingPos] = await mysqlPool.execute(
			`SELECT COUNT(*) + 1 AS nRankingPos FROM ${timesTabName} WHERE szMap = ? AND nStyle = ? AND nTime < ?`,
			[map, recordBot.nStyle, recordBot.nTime]
		)
		recordBot.nRankingPos = recordBotRankingPos[0].nRankingPos
	})
	
	await Promise.all(getRankingPositions)

	try {
		for (const recordBot of recordBots) {
			recordBot.szRecord = await fsp.readFile(`./record_bots/${map}/${recordBot.nStyle}.csv`, {encoding: "utf8"})
		}
		console.log(`Found ${map} record bot data in record_bots files, took ${Math.floor(Date.now() - fetchStart)}ms`)
	} catch {
		const [recordBotsData] = await mysqlPool.execute(`SELECT nStyle, szRecord FROM ${tabName} WHERE szMap = ? ORDER BY nStyle ASC`, [map])
		for (const recordBotData of recordBotsData) {
			const recordBot = recordBots.find(testedRecordBot => recordBotData.nStyle === testedRecordBot.nStyle)
			recordBot.szRecord = recordBotData.szRecord
			await fsp.writeFile(`./record_bots/${map}/${recordBot.nStyle}.csv`, recordBot.szRecord, {encoding: "utf8"})
		}
		console.log(`Found ${map} record bot data in the slow database, took ${Math.floor(Date.now() - fetchStart)}ms`)
	}

	const jsonEncodingStart = Date.now()
	res.json(recordBots)
	console.log(`Took ${Math.floor(Date.now() - jsonEncodingStart)}ms to encode data`)
})

app.put("/:server/recorder/bots/:map/:style", loginToken, async (req, res) => {
	const server = req.params.server
	const map = req.params.map
	const style = req.params.style
	const recordBot = req.body
	
	const fsp = fs.promises
	const tabName = (server == "bhop") ? "game_bots" : "surf_bots"

	try {
		await fsp.access(`./record_bots/${map}`)
	} catch {
		await fsp.mkdir(`./record_bots/${map}`)
	}

	try {
		const [recordBotData] = await mysqlPool.execute(`SELECT nTime FROM ${tabName} WHERE szMap = ? AND nStyle = ?`, [map, style])
		
		if (recordBotData.length > 0 && typeof recordBotData[0].nTime === "number") {
			await mysqlPool.execute(
				`UPDATE ${tabName} SET szPlayer = ?, nTime = ?, szSteam = ?, szDate = ?, szRecord = ? WHERE szMap = ? AND nStyle = ?`,
				[recordBot.Name, recordBot.Time, recordBot.SteamID, recordBot.Date, "", map, recordBot.Style]
			)
		} else {
			await mysqlPool.execute(
				`INSERT INTO ${tabName} VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[map, recordBot.Name, recordBot.Time, recordBot.Style, recordBot.SteamID, recordBot.Date, ""]
			)
		}
		await fsp.writeFile(`./record_bots/${map}/${style}.csv`, recordBot.Record, {encoding: "utf8"})

		const name = Buffer.from(recordBot.Name, "base64").toString("utf8")
		res.send(`Saved the new record bot data for style ${style} on ${map} made by ${name}`)
	} catch (error) {
		console.error(error)
		res.status(500).json({})
	}
})

app.put("/maps/:mapName/screen", loginToken, async (req, res) => {
	const mapName = req.params.mapName
	const path = `${process.cwd()}/external_images/discord/${mapName}.jpg`
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
		await axios.get(`https://images.dotshark.dev/discord/${mapName}.jpg`)
	} catch {
		console.log("The screen can't be accessed publicly")
	}

	Object.entries(servers).forEach(async ([server, infos]) => {
		if (infos.map !== mapName) return
		try {
			await axios.post(`https://timerapi.dotshark.dev/${server}/infos`, infos, {
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


app.all("/testMethod", (req, res) => {
	res.json({method: req.method})
})

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

app.listen(process.env.API_PORT, () => {
	console.log(`DotShark's API listening at localhost:${process.env.API_PORT}`)
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