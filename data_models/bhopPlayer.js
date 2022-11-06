const mongoose = require("mongoose")

let bhopPlayer = {
	Data: {
		SteamID64: {type: String, index: true},
		SteamID: String,
		Name: String,
		BhopNormalPoints: Number,
		BhopAngledPoints: Number,
		SurfNormalPoints: Number,
		SurfAngledPoints: Number,
	},
	Settings: {
		SSJEnabled: Boolean,
		JHUDEnabled: Boolean,
		JHUDOpacity: Number,
		JHUDOffset: Number,
		StrafeTrainerEnabled: Boolean,
		StrafeTrainerDynColor: Boolean,
		StrafeTrainerRefreshRate: Number,
		StrafeTrainerW: Number,
		StrafeTrainerH: Number,
		StrafeTrainerOffset: Number,
		PlayAmbientSound: Boolean,
		DisableRecoil: Boolean,
		ShowPlayerClips: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowWallBrushes: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowLadders: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowNoDrawBrushes: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowSkyBoxBrushes: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowTeleports: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowFilteredTeleports: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowPushBoosters: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowBaseVLBoosters: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowGravityBoosters: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowPreSpeedPreventers: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowBhopPlatforms: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowOtherTriggers: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} },
		ShowPropsCollisions: { Enabled: Boolean, Material: Number, Color: {r: Number, g: Number, b: Number, a: Number} }
	}
}

let bhopPlayerSchema = {}
Object.entries(bhopPlayer.Data).forEach(([key, value]) => {
	bhopPlayerSchema[key] = value
})
Object.entries(bhopPlayer.Settings).forEach(([key, value]) => {
	bhopPlayerSchema[key] = value
})
bhopPlayerSchema = new mongoose.Schema(bhopPlayerSchema)

Object.entries(bhopPlayer.Data).forEach(([key, value]) => {
	bhopPlayer.Data[key] = value.type ? value.type.name : value.name
})
Object.entries(bhopPlayer.Settings).forEach(([key, value]) => {
	if (typeof(value) === "object") {
		Object.entries(value).forEach(([key2, value2]) => {
			value[key2] = value2.name
		})
		bhopPlayer.Settings[key] = value
	} else {
		bhopPlayer.Settings[key] = value.name
	}
})

module.exports = {
	bhopPlayer: bhopPlayer,
	bhopPlayers: mongoose.model("bhopPlayer", bhopPlayerSchema)
}