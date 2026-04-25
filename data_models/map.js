const mongoose = require("mongoose")

const MapSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    gamemode: String,
    type: Number,
    multiplier: Number,
    bonusMultiplier: Number,
    playable: Boolean, 
    plays: Number,
    tweaks: {brightness: Number, noSpeedLimit: Boolean},
    screenshot: {url: String, crc: String},
    zones: []
})

module.exports = mongoose.model("Map", MapSchema)