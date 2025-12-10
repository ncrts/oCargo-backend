const mongoose = require('mongoose');

/**
 * Quiz Model (ÔCargo App)
 *
 * Represents a single quiz entity within the ÔCargo game ecosystem.
 * A quiz includes its metadata, author information, moderation status,
 * usage history, and aggregated player feedback.
 *
 * This schema supports both Local and National quiz scopes, with
 * moderation workflows, performance logs, and rating statistics.
 */

const quizSchema = new mongoose.Schema({
    /**
     * 🏢 Franchise Reference
     * Associates the quiz with a specific franchise (for Local quizzes).
     */
    franchiseeInfoId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'FranchiseeInfo',
        default: null,
        description: 'Reference to the franchise this quiz belongs to (if Local).'
    },

    /**
     * 🏢 Franchisor Reference
     * Associates the quiz with a specific franchisor (for National quizzes).
     */
    franchisorInfoId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'FranchisorInfo',
        default: null,
        description: 'Reference to the franchisor this quiz belongs to (if National).'
    },

    // ------------------------------------------------
    // 🔹 Basic Quiz Information
    // ------------------------------------------------

    /**
     * 🏷️ Title
     * Display name of the quiz shown to players and staff during selection.
     */
    title: {
        type: String,
        default: null,
        description: 'Title of the quiz displayed in the app or dashboard.'
    },

    /**
     * 📝 Description
     * Short summary explaining the theme or purpose of the quiz.
     * Used in the quiz list preview and admin dashboards.
     */
    description: {
        type: String,
        default: null,
        description: 'Brief description or context for the quiz.'
    },


    /**
     * 🖼️ Background Image
     * Optional background image URL for the quiz.
     */
    backgroundImage: {
        type: String,
        default: null,
        description: 'URL to the background image used for the quiz.'
    },

    // ------------------------------------------------
    // 🔹 Author Information
    // ------------------------------------------------

    /**
     * 👤 Author
     * Identifies who created the quiz (Franchisee Staff or HQ Staff).
     * Contains both the ID and the model type for flexible reference.
     */
    author: {
        /**
         * 🆔 Author ID
         * The ObjectId of the quiz creator (either FranchisorUser or FranchiseeUser).
         */
        id: {
            type: mongoose.SchemaTypes.ObjectId,
            refPath: 'author.authorRole',
            default: null,
            description: 'Reference to the user who created this quiz.'
        },

        /**
         * 🏷️ Author Role
         * Defines whether the quiz author is a HQ-level user or a local franchise user.
         */
        authorRole: {
            type: String,
            enum: ['FranchisorUser', 'FranchiseeUser'],
            default: null,
            description: 'Model type of the quiz creator (FranchisorUser or FranchiseeUser).'
        }
    },

    // ------------------------------------------------
    // 🔹 Categorization
    // ------------------------------------------------

    /**
     * 🧩 Category
     * Reference to a category (e.g., Music, Sports, History, Logic) that this quiz belongs to.
     */
    category: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'QuizCategory',
        default: null,
        description: 'Reference to the quiz category.'
    },

    /**
     * 🌐 Language
     * Language code for this quiz (default: "en-US").
     * Enables future multilingual quiz support.
     */
    language: {
        type: String,
        enum: ['en_us', 'fr_fr'],
        default: 'en_us',
        description: 'Language code for the quiz (English US or French FR).'
    },

    /**
     * 🗺️ Visibility
     * Defines the reach of the quiz:
     * - Local: available only in a specific franchise
     * - National: available across all franchises
     */
    visibility: {
        type: String,
        enum: ['Local', 'National'],
        default: 'Local',
        description: 'Determines whether the quiz is local or national.'
    },

    // ------------------------------------------------
    // 🔹 Status and Moderation
    // ------------------------------------------------

    /**
     * ⚙️ Status
     * Tracks the quiz’s current lifecycle phase and moderation state.
     * Possible values:
     * - DraftLocal / DraftNational → not published yet
     * - ActiveLocal / ActiveNational → published and playable
     * - InModeration → waiting for HQ review
     * - ModeratedAccepted / ModeratedRejected → HQ reviewed outcome
     * - HiddenLocal / HiddenNational → temporarily hidden from players
     */
    status: {
        type: String,
        enum: [
            'DraftLocal', 'ActiveLocal', 'DraftNational', 'ActiveNational',
            'InModeration', 'ModeratedAccepted', 'ModeratedRejected',
            'HiddenLocal', 'HiddenNational'
        ],
        default: 'DraftLocal',
        description: 'Defines the quiz’s publishing and moderation state.'
    },


    /**
   * 💪 Difficulty Level
   * Indicates question complexity (used in XP calculation and analytics).
   */
    difficaltyLavel: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard', 'VeryHard'],
        default: 'Easy',
        description: 'Difficulty level of the question.'
    },

    // ------------------------------------------------
    // 🔹 Player Ratings & Feedback
    // ------------------------------------------------

    /**
     * ⭐ Client Rating
     * Stores aggregated player feedback scores and individual ratings.
     */
    clientRating: {
        /**
         * 📊 Average Rating
         * The computed mean value (1–5) from all client ratings.
         */
        avg: {
            type: Number,
            default: null,
            description: 'Average player rating score (5).'
        },

        /**
         * 🔽 Minimum Rating
         * The lowest rating value recorded for this quiz.
         */
        min: {
            type: Number,
            default: null,
            description: 'Minimum rating given by a player.'
        },

        /**
         * 🔼 Maximum Rating
         * The highest rating value received.
         */
        max: {
            type: Number,
            default: null,
            description: 'Maximum rating given by a player.'
        },
        /** 📈 Rating Count
         * Total number of ratings submitted by players.
         */
        count: {
            type: Number,
            default: 0,
            description: 'Total number of player ratings received.'
        }
    },

    // ------------------------------------------------
    // 🔹 Usage Tracking
    // ------------------------------------------------

    /**
     * 🕹️ Last Used
     * Tracks the last franchise where this quiz was hosted and the date.
     */
    lastUsed: {
        franchiseId: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'FranchiseeInfo',
            description: 'Franchise where the quiz was last played.'
        },
        date: {
            type: Date,
            default: null,
            description: 'Date of last usage.'
        }
    },

    /**
     * 📅 Usage Log
     * Historical records for every time the quiz was used in gameplay.
     * Useful for analytics and tracking engagement.
     */
    usageLog: [
        {
            date: { type: Date, description: 'Date when the quiz was played.' },
            time: { type: String, description: 'Time of day when the session occurred.' },
            numberOfPlayers: {
                type: Number,
                description: 'How many players participated in this session.'
            },
            rating: {
                type: Number,
                description: 'Average feedback rating for that specific session.'
            },
            franchiseId: {
                type: mongoose.SchemaTypes.ObjectId,
                ref: 'FranchiseeInfo',
                description: 'Franchise location where this session was hosted.'
            }
        }
    ],

    // ------------------------------------------------
    // 🔹 Questions & Settings
    // ------------------------------------------------

    /**
     * ❓ Questions
     * List of question ObjectIds linked to the `QuizQuestion` collection.
     * Maintains the order of questions in the quiz.
     */
    questions: [
        {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'QuizQuestion',
            description: 'References to question documents belonging to this quiz.'
        }
    ],

    /**
     * 🎵 Settings
     * Additional media and environment settings for the quiz.
     */
    settings: {
        /**
         * 🎶 Music Link
         * Optional background music URL used during gameplay.
         */
        musicLink: {
            type: String,
            default: null,
            description: 'Link to the music file used during the quiz.'
        },

        /**
         * ▶️ YouTube Link
         * Optional YouTube video used within the quiz or for introduction.
         */
        youtubeLink: {
            type: String,
            default: null,
            description: 'YouTube video link associated with the quiz.'
        }
    },

    // ------------------------------------------------
    // 🔹 Metadata
    // ------------------------------------------------

    /**
     * 🕒 Created Timestamp
     * Records when the quiz was first created.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Date and time when this quiz was created.'
    },

    /**
     * 🕒 Updated Timestamp
     * Tracks when the quiz was last modified (title, questions, status, etc.).
     */
    updatedAt: {
        type: Date,
        default: Date.now,
        description: 'Date and time when this quiz was last updated.'
    }
});


module.exports = mongoose.model('Quiz', quizSchema);
