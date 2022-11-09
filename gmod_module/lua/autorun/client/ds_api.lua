-- Player data
hook.Add("HUDPaint", "LoadPlayerData", function()
	hook.Remove("HUDPaint", "LoadPlayerData")
	http.Fetch("https://api.dotshark.ovh/player/" .. LocalPlayer():SteamID64(), function(json)
		local data = util.JSONToTable(json)
		if data then hook.Call("PlayerDataLoaded", nil, data) end
	end)
end)

function Core:SaveSetting(key, value)
	if not isstring(key) then return end 
	net.Start("SavePlayerSetting")
		net.WriteString(key)
		net.WriteType(value)
	net.SendToServer()
end