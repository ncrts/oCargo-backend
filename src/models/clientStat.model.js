const mongoose = require('mongoose');

/**
 * ClientStat Model (ÔCargo App)
 *
 * Represents the statistical and activity data of a client related to quiz participation.
 * 
 * This model aggregates a client's quiz performance into two categories:
 * - Local: Games played at specific franchise locations
 * - National: Games played at national or cross-franchise level
 * 
 * Each category tracks XP, game counts, accuracy, placements, streaks, and earned badges.
 * It connects directly to the `Client` model via `clientId`
 * and helps generate leaderboards, XP progression, and reports.
 */

const clientStatSchema = new mongoose.Schema({
    // ================================================
    // 🔹 CORE CLIENT INFORMATION
    // ================================================

    /**
     * 🔗 Client Reference
     * Links this statistics record to a specific client.
     * Every client has one ClientStat document summarizing their overall quiz performance.
     */
    clientId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Client',
        required: true,
        description: 'Reference to the client whose statistics are being tracked.'
    },

    /**
     * ⚙️ Mode
     * Defines whether user is in guest or registered mode.
     * - 'guest': Playing without registration
     * - 'client': Registered user with profile
     */
    mode: {
        type: String,
        enum: ['guest', 'client'],
        default: 'client',
        description: 'Specifies if the client is playing in guest mode or as a registered user.'
    },

    // ================================================
    // 🔹 LOCAL STATISTICS
    // ================================================

    /**
     * 📍 Local Gaming Statistics
     * Contains all performance metrics for games played at specific franchise locations.
     */
    local: {
        /**
         * ⚡ Local XP Points
         * Experience points earned from participating in games at franchise locations (cumulative across all franchises).
         */
        totalXP: {
            type: Number,
            default: 0,
            description: 'Total XP earned from all local (franchise-specific) games across all franchises.'
        },

        /**
         * 🎮 Total Games Played (Local)
         * Total number of quizzes participated in at franchise locations (cumulative across all franchises).
         */
        totalGamesPlayed: {
            type: Number,
            default: 0,
            description: 'Total number of games played at all local franchise locations combined.'
        },

        /**
         * 🎯 Total Accuracy Percentage (Local)
         * Average answer accuracy across all local games (0-100%).
         */
        totalAccuracyPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
            description: 'Overall accuracy percentage for answers in local games.'
        },

        /**
         * 🥇 First Place Wins (Local)
         * Total number of times the player ranked 1st in local games.
         */
        totalFirstPlaceWins: {
            type: Number,
            default: 0,
            description: 'Number of 1st place finishes in local games.'
        },

        /**
         * 🥈 Second Place Wins (Local)
         * Total number of times the player ranked 2nd in local games.
         */
        totalSecondPlaceWins: {
            type: Number,
            default: 0,
            description: 'Number of 2nd place finishes in local games.'
        },

        /**
         * 🥉 Third Place Wins (Local)
         * Total number of times the player ranked 3rd in local games.
         */
        totalThirdPlaceWins: {
            type: Number,
            default: 0,
            description: 'Number of 3rd place finishes in local games.'
        },

        /**
         * 📊 Average Position (Local)
         * Average ranking position across all local games (lower is better).
         */
        averagePosition: {
            type: Number,
            default: null,
            description: 'Average rank position in local games.'
        },

        /**
         * ⛔ Worst Position (Local)
         * Lowest (worst) position ever achieved in any local game.
         */
        worstPosition: {
            type: Number,
            default: null,
            description: 'Worst rank position ever achieved in local games.'
        },

        /**
         * 🔥 Maximum Streak (Local)
         * Longest consecutive winning streak in local games.
         */
        maxStreak: {
            type: Number,
            default: 0,
            description: 'Longest consecutive wins in local games.'
        },

        /**
         * 🏅 Badges (Local)
         * Collection of badges earned through local game achievements.
         */
        badges: [
            {
                badgeId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Badge',
                    description: 'Reference to the earned badge.'
                },
                badgeIcon: {
                    type: String,
                    description: 'URL or path to the badge icon/image.'
                },
                badgeName: {
                    type: String,
                    description: 'Display name of the badge earned.'
                },
                earnedAt: {
                    type: Date,
                    description: 'Timestamp when the badge was earned.'
                },
                earnedCount: {
                    type: Number,
                    default: 1,
                    description: 'Number of times this badge has been earned.'
                }
            }
        ]
    },

    // ================================================
    // 🔹 NATIONAL STATISTICS
    // ================================================

    /**
     * 🌍 National Gaming Statistics
     * Contains all performance metrics for games played in nationwide or cross-franchise events.
     */
    national: {
        /**
         * ⚡ National XP Points
         * Experience points earned from participating in nationwide games.
         */
        totalXP: {
            type: Number,
            default: 0,
            description: 'Total XP earned from all national games.'
        },

        /**
         * 🎮 Total Games Played (National)
         * Total number of quizzes participated in at national level.
         */
        totalGamesPlayed: {
            type: Number,
            default: 0,
            description: 'Total number of games played at national level.'
        },

        /**
         * 🎯 Total Accuracy Percentage (National)
         * Average answer accuracy across all national games (0-100%).
         */
        totalAccuracyPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
            description: 'Overall accuracy percentage for answers in national games.'
        },

        /**
         * 🥇 First Place Wins (National)
         * Total number of times the player ranked 1st in national games.
         */
        totalFirstPlaceWins: {
            type: Number,
            default: 0,
            description: 'Number of 1st place finishes in national games.'
        },

        /**
         * 🥈 Second Place Wins (National)
         * Total number of times the player ranked 2nd in national games.
         */
        totalSecondPlaceWins: {
            type: Number,
            default: 0,
            description: 'Number of 2nd place finishes in national games.'
        },

        /**
         * 🥉 Third Place Wins (National)
         * Total number of times the player ranked 3rd in national games.
         */
        totalThirdPlaceWins: {
            type: Number,
            default: 0,
            description: 'Number of 3rd place finishes in national games.'
        },

        /**
         * 📊 Average Position (National)
         * Average ranking position across all national games (lower is better).
         */
        averagePosition: {
            type: Number,
            default: null,
            description: 'Average rank position in national games.'
        },

        /**
         * ⛔ Worst Position (National)
         * Lowest (worst) position ever achieved in any national game.
         */
        worstPosition: {
            type: Number,
            default: null,
            description: 'Worst rank position ever achieved in national games.'
        },

        /**
         * 🔥 Maximum Streak (National)
         * Longest consecutive winning streak in national games.
         */
        maxStreak: {
            type: Number,
            default: 0,
            description: 'Longest consecutive wins in national games.'
        },

        /**
         * 🏅 Badges (National)
         * Collection of badges earned through national game achievements.
         */
        badges: [
            {
                badgeId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Badge',
                    description: 'Reference to the earned badge.'
                },
                badgeIcon: {
                    type: String,
                    description: 'URL or path to the badge icon/image.'
                },
                badgeName: {
                    type: String,
                    description: 'Display name of the badge earned.'
                },
                earnedAt: {
                    type: Date,
                    description: 'Timestamp when the badge was earned.'
                },
                earnedCount: {
                    type: Number,
                    default: 1,
                    description: 'Number of times this badge has been earned.'
                }
            }
        ]
    },

    // ================================================
    // 🔹 FRANCHISEE-LEVEL STATISTICS
    // ================================================

    /**
     * 🏪 Franchisee Gaming Statistics
     * Contains performance metrics broken down by individual franchise locations.
     * Tracks XP and game counts for each specific franchise separately.
     */
    franchisee: [
        {
            /**
             * 🔗 Franchisee Reference
             * Reference to the specific franchise location.
             */
            franchiseeInfoId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'FranchiseeInfo',
                required: true,
                description: 'Reference to the specific franchise location.'
            },

            /**
             * ⚡ Franchisee-Specific Total XP
             * Total XP earned only at this specific franchise location.
             */
            totalXp: {
                type: Number,
                default: 0,
                description: 'Total XP earned at this specific franchise.'
            },

            /**
             * 🎮 Games Played at Franchisee
             * Total number of games played at this specific franchise.
             */
            totalGamesPlayed: {
                type: Number,
                default: 0,
                description: 'Total number of games played at this specific franchise.'
            },

            /**
             * 📅 Last Updated
             * Timestamp of the last stats update for this franchise.
             */
            updatedAt: {
                type: Date,
                default: Date.now,
                description: 'Timestamp when this franchisee stats were last updated.'
            }
        }
    ],

    // ================================================
    // 🔹 AGGREGATE STATISTICS (All Types)
    // ================================================

    /**
     * 📈 Total Games Played (All Types)
     * Combined count of all games played across local and national levels.
     * This is the sum of local.totalGamesPlayed + national.totalGamesPlayed
     */
    totalGamesPlayedAllTypes: {
        type: Number,
        default: 0,
        description: 'Total games played across all types (local + national).'
    },

    // ================================================
    // 🔹 AUDIT & TIMESTAMPS
    // ================================================

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
