// models/BadgeMaster.js
const mongoose = require('mongoose');
const { toJSON, toJSONFilter, paginate } = require('./plugins');


const badgeMasterSchema = new mongoose.Schema({
    badgeCode: {
        type: String,
        default: null,
        unique: true,   // e.g. "RIPTIDE", "SHARPSAIL"
        uppercase: true
    },
    purpose: {
        type: String,
        default: null, // e.g. "Fastest Response"
    },
    name: {
        en_us: {
            type: String,
            default: null,
            description: "Badge name in English (US). Example: 'Quiz Master', 'Level 10 Reached', 'Streak Champion'."
        },
        fr_fr: {
            type: String,
            default: null,
            description: "Badge name in French. Example: 'Maître du Quiz', 'Niveau 10 Atteint', 'Champion de Série'."
        }
    },

    iconUrl: {
        type: String,   // optional: URL to badge icon
        default: null
    },

    priority: {
        type: Number,     // lower = more important badge
        default: 1
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add plugins
badgeMasterSchema.plugin(toJSON);
badgeMasterSchema.plugin(paginate);

module.exports = mongoose.model('BadgeMaster', badgeMasterSchema);