const mongoose = require('mongoose');

/**
 * QuizCategory Model (ÔCargo App)
 */

const quizCategorySchema = new mongoose.Schema({

    /**
     * 🏷️ Multi-language Name
     */
    name: {
        en_us: { type: String, default: null },
        fr_fr: { type: String, default: null }
    },

    /**
     * 📝 Multi-language Description
     */
    description: {
        en_us: { type: String, default: null },
        fr_fr: { type: String, default: null }
    },

    /**
     * Active Status
     */
    isActive: {
        type: Boolean,
        default: true
    },

    /**
     * Created Timestamp
     */
    createdAt: {
        type: Date,
        default: Date.now
    },

    /**
     * Updated Timestamp
     */
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Auto update "updatedAt"
quizCategorySchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('QuizCategory', quizCategorySchema);
