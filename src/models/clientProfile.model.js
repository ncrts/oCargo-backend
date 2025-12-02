/**
 * ClientProfile Model (ÔCargo App)
 *
 * Represents personal and preference information for a registered or guest client.
 *
 * This model stores client identity details, avatar selection, gender, and personal
 * preferences related to their favorite OCargo locations and foods.
 *
 * Linked directly to the `Client` model via `clientId`.
 */

const mongoose = require('mongoose');

const clientProfileSchema = new mongoose.Schema({
    /**
     * 🔗 Client Reference
     * Associates this profile record with a specific client account.
     * Each client has one profile entry that stores their identity and preferences.
     */
    clientId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Client',
        default: null,
        description: 'Reference to the client this profile belongs to.'
    },

    /**
     * ⚙️ Mode
     * Defines whether user is in guest or registered mode.
     */
    mode: {
        type: String,
        enum: ['guest', 'client'],
        default: 'client',
        description: 'Specifies if the client is playing in guest mode or as a registered user.'
    },

    /**
     * 🧍 First Name
     * Client’s first name as entered during registration or imported via Google/Apple login.
     */
    firstName: {
        type: String,
        default: null,
        description: 'Client’s first name.'
    },

    /**
     * 🧍 Last Name
     * Client’s last name or family name.
     */
    lastName: {
        type: String,
        default: null,
        description: 'Client’s last name or surname.'
    },

    /**
     * ⚧ Gender
     * Optional field for demographic insights or personalization.
     * The default value is “Prefer not to share” to comply with privacy standards.
     */
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Prefer not to share'],
        default: 'Prefer not to share',
        description: 'Gender information provided by the client.'
    },

    /**
     * 🧩 Quiz Category Interests
     * Stores categories that the client prefers or frequently plays.
     * Helps tailor personalized quizzes or recommendations.
     * Examples: ["Music", "Movies", "Sports", "Culture"]
     */
    quizCategoryInterests: [{
        categoryIds: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "QuizCategory",
            description: "Reference to the quiz category."
        },
        categoryName: {
            type: String,
            description: "Category name (e.g., Movies, Sports, History)."
        }
    }],

    /**
     * 🍕 Favorite Food List
     * Array containing the client’s preferred food items.
     * Used for personalization, menu suggestions, and survey insights.
     */
    favoriteFood: [{
        foodId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Food',
            description: 'Reference to the food item.'
        },
        foodName: {
            type: String,
            description: 'Name of the food item.'
        }
    }],

    /**
     * 🍴 Favorite OCargo Food Court
     * Stores the client’s favorite OCargo branch (franchise name or ID) for local engagement,
     * leaderboards, and quiz participation tagging.
     */
    favoriteOCargoFoodCourt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FranchiseeInfo',
        description: 'Name or identifier of the client’s favorite OCargo food court location.'
    },

    /**
     * 🍴 Current OCargo Food Court
     * Stores the OCargo branch (franchise) where the client is currently active.
     * Used for location-based services, offers, and engagement tracking.
     */
    currentOcargoFoodCourt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FranchiseeInfo',
        default: null,
        description: 'Reference to the OCargo food court location where the client is currently active.'
    },

    /**
     * 🕒 Created Timestamp
     * Automatically records the date when this profile was created.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp of when this profile record was created.'
    },

    /**
     * 🕒 Updated Timestamp
     * Automatically records the date when this profile was last updated.
     * Used to track profile changes such as new avatar or preferences.
     */
    updatedAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp of the last modification to this profile record.'
    },

    /**
     * ✅ Active Status Flag
     * Indicates if the profile is currently active and visible in the system.
     * Set to false when the account is deactivated or archived.
     */
    isActive: {
        type: Boolean,
        default: true,
        description: 'Marks the profile as active or inactive.'
    },

    /**
     * ❌ Deletion Flag
     * Used for soft deletion (GDPR compliance).
     * Keeps profile data hidden but retained for audit until permanently purged.
     */
    isDeleted: {
        type: Boolean,
        default: false,
        description: 'Soft deletion flag for profile data (used for GDPR compliance).'
    }
});

const ClientProfile = mongoose.model('ClientProfile', clientProfileSchema);

module.exports = ClientProfile;
