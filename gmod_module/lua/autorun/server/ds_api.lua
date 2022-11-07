-- Config
local serverID = GM.FolderName
local customID = CreateConVar("ds_custom_id", "", FCVAR_ARCHIVE)
local mustUpdate = false
local baseURL = "https://api.dotshark.ovh/" -- Set the API URL here
local accessToken = "" -- Set the access token here

local function checkCustomID()
	local id = customID:GetString()
	if id != "" then serverID = id end
end
checkCustomID()
cvars.AddChangeCallback("ds_custom_id", checkCustomID)


-- Server status
local function updateServerStatus(executeNow)
	if serverID == "dev" then return end

	if executeNow != true then
		mustUpdate = true
		return
	end

	mustUpdate = false
	local humans, bots = player.GetHumans(), player.GetBots()
	local playersList = {}
	for k, ply in pairs(humans) do
		playersList[k] = {name = ply:Name(), style = Core:StyleName(ply.Style), time = ply.Record, rank = ply.SpecialRank}
	end

	HTTP {
		url = baseURL .. serverID .. "/infos",
		method = "PUT",
		headers = {Authorization = "Bearer " .. accessToken},
		type = "application/json",
		body = util.TableToJSON{map = game.GetMap(), points = Timer.Multiplier, slots = game.MaxPlayers() - #bots, nPlayers = #humans, playersList = playersList},
		success = function() end,
		failed = function() end
	}
end

local function apiQueue()
	if mustUpdate then updateServerStatus(true) end
end

local multiplier = 1
local function updateOnChange()
	if Timer.Multiplier != multiplier then
		multiplier = Timer.Multiplier
		updateServerStatus()
		return
	end
	
	local humans = player.GetHumans()
	for _, ply in pairs(humans) do
		if (ply.Record != ply.OldRecord) or (ply.Style != ply.OldStyle) or (ply.SpecialRank != ply.OldSpecialRank) then 
			updateServerStatus()
		end
		ply.OldRecord, ply.OldStyle, ply.OldSpecialRank = ply.Record, ply.Style, ply.SpecialRank
	end
end

hook.Add("Think", "APIQueue", apiQueue)
hook.Add("Think", "UpdateAPI", updateOnChange)
hook.Add("PlayerInitialSpawn", "UpdateAPI", updateServerStatus)
hook.Add("PlayerDisconnected", "UpdateAPI", updateServerStatus)
hook.Add("ShutDown", "UpdateAPI", updateServerStatus)


-- Discord logs
local mapChangeSended = false
local function logMapChange()
	if mapChangeSended then return end
	HTTP {
		url = baseURL .. "discord/message",
		method = "POST",
		headers = {Authorization = "Bearer " .. accessToken},
		type = "application/json",
		body = util.TableToJSON{
			type = "log", server = serverID, event = "mapChange",
			map = {name = game.GetMap(), points = Timer.Multiplier}
		},
		success = function(body) end,
		failed = function(err) end
	}
	mapChangeSended = true 
end

local function notifyNewMap(ply)
	if Admin:GetAccess(ply) < Admin.Level.Super then return end
	local stages = 1
	for _, zone in pairs( Zones.Cache ) do
		if zone.Type == Zones.Type["Stage"] then stages = stages + 1 end
	end

	HTTP {
		url = baseURL .. "discord/message",
		method = "POST",
		headers = {Authorization = "Bearer " .. accessToken},
		type = "application/json",
		body = util.TableToJSON{
			type = "newMap", server = serverID,
			map = {name = game.GetMap(), points = Timer.Multiplier, stages = stages}
		},
		success = function(body) end,
		failed = function(err) end
	}
end

local function logPlayer(ply, disconnected)
	if ply:IsBot() then return end
	
	HTTP {
		url = baseURL .. "discord/message",
		method = "POST",
		headers = {Authorization = "Bearer " .. accessToken},
		type = "application/json",
		body = util.TableToJSON{
			type = "log", server = serverID,
			event = disconnected and "playerDisconnected" or "playerConnected",
			player = {name = ply:Name(), id = ply:SteamID(), id64 = ply:SteamID64(), ownerID64 = ply:OwnerSteamID64(), ip = ply:IPAddress()}
		},
		success = function() end,
		failed = function() end
	}
end 

local function logChatMessage(ply, txt)
	HTTP {
		url = baseURL .. "discord/message",
		method = "POST",
		headers = {Authorization = "Bearer " .. accessToken},
		type = "application/json",
		body = util.TableToJSON{
			type = "log", server = serverID, event = "playerMessage",
			player = {name = ply:Name(), rank = _C.Ranks[ply.Rank][1]},
			message = txt
		},
		success = function() end,
		failed = function() end
	}
end

local function logRecord(ply, time, ranking, jumps, sync, speedData)
	HTTP {
		url = baseURL .. "discord/message",
		method = "POST",
		headers = {Authorization = "Bearer " .. accessToken},
		type = "application/json",
		body = util.TableToJSON{
			type = "log", server = serverID, event = "playerRecord",
			player = {name = ply:Name(), id = ply:SteamID(), id64 = ply:SteamID64()},
			map = {name = game.GetMap(), points = Timer.Multiplier},
			record = {
				style = Core:StyleName(ply.LastRecordStyle), time = time, ranking = ranking, jumps = jumps, sync = sync,
				speed = {max = speedData.Max, average = speedData.Total / speedData.Ticks}
			}
		},
		success = function() end,
		failed = function() end
	}
end

local function logFreeze(freezeTime)
	HTTP {
		url = baseURL .. "discord/message",
		method = "POST",
		headers = {Authorization = "Bearer " .. accessToken},
		type = "application/json",
		body = util.TableToJSON{type = "log", server = serverID, event = "serverFreeze", freezeTime = freezeTime},
		success = function(body) end,
		failed = function(err) end
	}
end

hook.Add("Think", "TrackFreezes", trackFreezes)
hook.Add("RecordsLoaded", "DiscordLog", logMapChange)
hook.Add("NewMapAdded", "DiscordLog", notifyNewMap)
hook.Add("PlayerInitialSpawn", "DiscordLog", logPlayer)
hook.Add("PlayerDisconnected", "DiscordLog", function(ply) logPlayer(ply, true) end)
hook.Add("PlayerSay", "LogDiscord", logChatMessage)
hook.Add("TimerAddRecord", "LogDiscord", logRecord)


-- Server freezes tracking
local maxTickTime = 0.1
local lastTickTime = 0
local function trackFreezes()
	local ct = SysTime()
	local ellapsed = ct - lastTickTime
	lastTickTime = ct
	if lastTickTime > 0 and ellapsed > maxTickTime and player.GetCount() > 0 then logFreeze(ellapsed) end
end


-- Player data
local Player = FindMetaTable("Player")
local dataSchema = {
	Data = {},
	Settings = {}
}

timer.Simple(0, function()
	http.Fetch(baseURL .. "pouf/player/schema", function(json)
		dataSchema = util.JSONToTable(json) or dataSchema
	end)
end)

hook.Add("PlayerInitialSpawn", "LoadPlayerData", function(ply)
	if ply:IsBot() then return end
	http.Fetch(baseURL .. "pouf/player/" .. ply:SteamID64(), function(json)
		local data = util.JSONToTable(json)
		if data then hook.Call("PlayerDataLoaded", nil, ply, data) end
	end)
end)

function Player:UpdateData(data)
	HTTP {
		url = baseURL .. "pouf/player/" .. self:SteamID64(),
		method = "PATCH",
		headers = {Authorization = "Bearer " .. accessToken},
		type = "application/json",
		body = util.TableToJSON(data),
		success = function() end,
		failed = function() end
	}
end

util.AddNetworkString("SavePlayerSetting")
net.Receive("SavePlayerSetting", function(len, ply) 
	if not IsValid(ply) then return end
	local k, v = net.ReadString(), net.ReadType()
	if dataSchema.Settings[k] then
		ply:UpdateData({[k] = v})
	else 
		print( "[Warning] " .. ply:Name() .. " tried to corrupt the database" )
	end
end)