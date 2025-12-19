const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const talentBadgeMasterSchema = new mongoose.Schema({
    badgeCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        description: 'Unique code identifier for the badge (e.g., BEST_PERFORMER, JURY_FAVORITE, PUBLIC_FAVORITE)'
    },
    purpose: {
        type: String,
        default: null,
        description: 'Purpose or criteria for earning this badge (e.g., "Highest Overall Score")'
    },
    name: {
        en_us: {
            type: String,
            default: null,
            description: 'Badge name in English (US). Example: "Best Performer", "Jury\'s Favorite"'
        },
        fr_fr: {
            type: String,
            default: null,
            description: 'Badge name in French. Example: "Meilleur Interprète", "Favori du Jury"'
        }
    },
    iconUrl: {
        type: String,
        default: null,
        description: 'URL or path to badge icon image'
    },
    priority: {
        type: Number,
        default: 1,
        description: 'Display priority (lower = more important badge)'
    },
    isActive: {
        type: Boolean,
        default: true,
        description: 'Whether this badge is currently active and can be awarded'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes
// talentBadgeMasterSchema.index({ badgeCode: 1 });
// talentBadgeMasterSchema.index({ isActive: 1 });

// Add plugins
talentBadgeMasterSchema.plugin(toJSON);
talentBadgeMasterSchema.plugin(paginate);

const TalentBadgeMaster = mongoose.model('TalentBadgeMaster', talentBadgeMasterSchema);

module.exports = TalentBadgeMaster;
