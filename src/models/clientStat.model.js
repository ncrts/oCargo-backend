const mongoose = require('mongoose');

/**
 * ClientStat Model (ÔCargo App)
 *
 * Represents the statistical and activity data of a client related to quiz participation.
 * 
 * This model aggregates a client’s quiz performance across multiple franchises,
 * tracking number of games played, wins, positions, best categories, and franchise visits.
 * 
 * It connects directly to the `Client` model via `clientId`
 * and helps generate leaderboards, XP progression, and reports.
 */

const clientStatSchema = new mongoose.Schema({
    /**
     * 🔗 Client Reference
     * Links this statistics record to a specific client.
     * Every client has one ClientStat document summarizing their overall quiz performance.
     */
    clientId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Client',
        default: null,
        description: 'Reference to the client whose statistics are being tracked.'
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

    // ------------------------------------------------
    // 🔹 Multi-Franchise Participation
    // ------------------------------------------------

    /**
     * 🏪 Franchises Array
     * Stores performance stats for each franchise location where the player has participated.
     */
    franchises: [
        {
            /**
             * 🆔 Franchise Reference
             * The branch (ÔCargo location) where the player participated.
             */
            franchisorInfoId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "FranchisorInfo",
                default: null,
                description: "The franchise (ÔCargo branch) where this player played."
            },

            /**
             * 🏠 Franchise Name
             * Readable name of the location (used in leaderboards and UI displays).
             */
            franchiseName: {
                type: String,
                default: null,
                description: "Readable name of the franchise."
            },

            /**
             * ⚡ Local XP
             * XP earned from quizzes played at this specific franchise location.
             */
            localXP: {
                type: Number,
                default: 0,
                description: "XP earned from games played at this specific franchise."
            },

            /**
             * 🎮 Total Games Played (Local)
             * Total number of quizzes participated in at this franchise.
             */
            totalGamesPlayed: {
                type: Number,
                default: 0,
                description: "Total quizzes played at this franchise."
            },

            /**
             * 🥇 Wins, 🥈 2nd, 🥉 3rd
             * Counts the number of times the player placed in each position locally.
             */
            totalWins: {
                type: Number,
                default: 0,
                description: "Number of 1st place wins at this franchise."
            },
            secondPlaces: {
                type: Number,
                default: 0,
                description: "Number of 2nd place finishes at this franchise."
            },
            thirdPlaces: {
                type: Number,
                default: 0,
                description: "Number of 3rd place finishes at this franchise."
            },

            /**
             * 📊 Rank Statistics
             * Average, best, and worst rank across all local games at this franchise.
             */
            averageRank: {
                type: Number,
                default: 0,
                description: "Average ranking across all games at this franchise."
            },
            bestRank: {
                type: Number,
                description: "Best (highest) rank achieved locally."
            },
            worstRank: {
                type: Number,
                description: "Worst (lowest) rank achieved locally."
            },

            /**
             * 🕓 Last Played At
             * Timestamp when the player last participated in a game at this franchise.
             */
            lastPlayedAt: {
                type: Date,
                description: "Date when the player last played at this specific franchise."
            }
        }
    ],

    /**
       * ⭐ Favorite Franchise Reference
       * The player’s preferred or most-played franchise.
       * Used for highlighting in local leaderboards.
       */
    favoriteFranchiseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FranchisorInfo",
        description: "Player’s selected favorite franchise."
    },

    /**
     * ⭐ Favorite Franchise Name
     * Display name for the player’s favorite franchise.
     */
    favoriteFranchiseName: {
        type: String,
        description: "Readable name of the favorite franchise."
    },


    // ------------------------------------------------
    // 🔹 Category Stats
    // ------------------------------------------------

    /**
   * 🎯 Top Categories
   * Categories where the player performs best, based on accuracy rate.
   */

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
     * 📈 Top Categories by Accuracy
     * Identifies the categories where the player has the highest answer accuracy.
     * Used for personalized feedback and recommendations.
     */

    topCategories: [
        {
            category: { type: String, description: "Category name (e.g., Movies, Sports, History)." },
            accuracy: { type: Number, description: "Average answer accuracy percentage (0–100)." }
        }
    ],

    /**
     * 🧠 Best Question Type
     * Identifies which format (text, image, video, mixed) the player performs best in.
     */
    bestQuestionType: {
        type: String,
        enum: ["text", "image", "video", "mixed"],
        description: "Which question format the player performs best at."
    },

    /**
     * 🎮 Number of Quizzes Played
     * Tracks the total number of quizzes the client has participated in (local + national).
     * This value increases after each game session.
     */
    numberOfQuizzesPlayed: {
        type: Number,
        default: 0,
        immutable: true,
        description: 'Total number of quizzes the client has played.'
    },

    /**
     * 🥇 Number of Quizzes Won (1st Place)
     * Counts how many times the client ranked first in quizzes.
     */
    numberOfQuizzesWon1stPlace: {
        type: Number,
        default: 0,
        immutable: true,
        description: 'Total number of quizzes the client has won with 1st place.'
    },

    /**
     * 🥈 Number of Quizzes Won (2nd Place)
     * Counts how many times the client finished second.
     */
    numberOfQuizzesWon2ndPlace: {
        type: Number,
        default: 0,
        immutable: true,
        description: 'Total number of quizzes the client finished in 2nd place.'
    },

    /**
     * 🥉 Number of Quizzes Won (3rd Place)
     * Counts how many times the client finished third.
     */
    numberOfQuizzesWon3rdPlace: {
        type: Number,
        default: 0,
        immutable: true,
        description: 'Total number of quizzes the client finished in 3rd place.'
    },

    /**
     * 📊 Average Position in Quizzes
     * Calculates the client’s average ranking position across all quizzes played.
     * A lower value means better average performance.
     */
    averagePositionInQuizzes: {
        type: Number,
        default: null,
        immutable: true,
        description: 'Average rank position across all quizzes played by the client.'
    },

    /**
     * ⛔ Worst Position in a Quiz
     * Records the lowest (worst) position ever obtained in any quiz.
     * Used to track consistency and improvement.
     */
    worstPositionInQuiz: {
        type: Number,
        default: null,
        immutable: true,
        description: 'Worst ranking position ever achieved by the client in a quiz.'
    },


    // ------------------------------------------------
    // 🔹 National & Local & Aggregated Stats
    // ------------------------------------------------

    /**
     * ⚡ Local XP
     *  XP earned from participating in quizzes at local franchise locations.
     * Used to track progression within specific branches.
     */
    localXP: {
        type: Number,
        default: 0,
        description: "XP accumulated from all local quizzes (franchise-specific)."
    },
    /**
     * 🏆 National XP
     * XP earned from participating in nationwide or cross-franchise events.
     */
    nationalXP: {
        type: Number,
        default: 0,
        description: "XP accumulated from all national quizzes (cross-franchise)."
    },

    /**
     * ⚡ Total XP
     * Combined XP from all franchises and national games.
     * Used to calculate rank, level, and progression.
     */
    totalXP: {
        type: Number,
        default: 0,
        description: "Cumulative XP across ALL franchises + national quizzes."
    },

    /**
     * 🎮 Total Games Played
     * Aggregated number of all quizzes participated in (local + national).
     */
    totalGamesPlayed: {
        type: Number,
        default: 0,
        description: "Total games played across all franchises."
    },

    /**
     * 🥇 Total Wins (National + Local)
     * Total count of first-place wins across all franchise locations.
     */
    totalWins: {
        type: Number,
        default: 0,
        description: "Number of 1st place wins across all franchises."
    },

    /**
     * 🧭 National Rank
     * Overall rank position in the national leaderboard.
     */
    nationalRank: {
        type: Number,
        default: 0,
        description: "Rank position in the national leaderboard."
    },


    // ------------------------------------------------
    // 🔹 Player Level & Badges
    // ------------------------------------------------

    /**
     * ⛵ Level Name
     * Player’s current level title based on XP thresholds (e.g., Sailor → Captain → Admiral).
     */
    levelName: {
        type: String,
        description: "Level title based on XP thresholds (e.g. Sailor, Captain, Admiral)."
    },

    /**
     * 🏅 Badges
     * List of earned badges with references, metadata, and timestamps.
     */
    badges: [
        {
            badgeId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Badge",
                description: "Reference to the earned badge."
            },
            type: {
                type: String,
                enum: ["local", "national"],
                description: "Badge context — local or national."
            },
            name: {
                type: String,
                description: "Display name of the badge earned."
            },
            earnedAt: {
                type: Date,
                description: "Timestamp when the badge was earned."
            },
            description: {
                type: String,
                description: "Short explanation or achievement condition for the badge."
            }
        }
    ],


    /**
     * ⚓ My ÔCargo Activity Log
     * Tracks the client’s gameplay history across multiple OCargo franchise locations.
     * Each object records:
     * - franchiseeInfoId: Which franchise they played at
     * - timestamp: When they played
     * - quizId: The quiz they participated in
     */
    myOcargo: [
        {
            /**
             * 🏪 Franchisee Reference
             * The franchise or OCargo food court where the quiz was played.
             */
            franchiseeInfoId: {
                type: mongoose.SchemaTypes.ObjectId,
                ref: 'FranchiseeInfo',
                default: null,
                description: 'Reference to the franchise (OCargo branch) where the quiz was played.'
            },

            /**
             * 🕓 Timestamp
             * Date and time of when the player participated in a quiz at that location.
             */
            timestamp: {
                type: Date,
                default: null,
                description: 'Timestamp of when the quiz session took place.'
            },

            /**
             * ❓ Quiz Reference
             * Identifies which quiz was played at that session.
             */
            quizId: {
                type: mongoose.SchemaTypes.ObjectId,
                ref: 'Quiz',
                default: null,
                description: 'Reference to the quiz that the client participated in.'
            }
        }
    ],

    /**
     * 🕒 Created Timestamp
     * Automatically records the creation date of this statistics record.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Date when this client statistics record was first created.'
    },

    /**
     * 🕒 Updated Timestamp
     * Automatically updated when statistics change (e.g., after new quiz results).
     */
    updatedAt: {
        type: Date,
        default: Date.now,
        description: 'Date when this client statistics record was last updated.'
    },

    /**
     * ✅ Active Status Flag
     * Indicates if this statistics record is currently active and visible.
     */
    isActive: {
        type: Boolean,
        default: true,
        description: 'Marks whether the client statistics record is active.'
    },

    /**
     * ❌ Deletion Flag
     * Used for soft-deletion. Marks the record as deleted but keeps it in the database
     * for audit and data retention compliance.
     */
    isDeleted: {
        type: Boolean,
        default: false,
        description: 'Indicates whether the record has been soft-deleted (not permanently removed).'
    }
});

module.exports = mongoose.model('ClientStat', clientStatSchema);
