const mongoose = require('mongoose');

/**
 * National Leaderboard Model (ÔCargo App)
 *
 * Represents a player's aggregated XP and ranking across all national (HQ-led) games.
 *
 * This model tracks:
 * - Player identification via clientId
 * - Total XP earned from all national games
 * - Total games played at national level
 * - Activity and deletion status
 * - Timestamps for creation and updates
 *
 * Used for displaying national-level leaderboards and global rankings.
 */

const nationalLeaderboardSchema = new mongoose.Schema({
    // ------------------------------------------------
    // 🔹 Core Relationships
    // ------------------------------------------------

    /**
     * 👤 Client Reference
     * Identifies the player whose XP and ranking this record tracks for national games.
     */
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true,
        unique: true,
        description: 'Reference to the client/player for this leaderboard entry.'
    },

    // ------------------------------------------------
    // 🔹 XP & Performance Tracking
    // ------------------------------------------------

    /**
     * ⚡ Total National XP
     * Cumulative experience points earned from all national (HQ-led) games.
     */
    totalXp: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Total XP earned from all national games.'
    },

    /**
     * 🎮 Total Games Played
     * Total number of games played at national level.
     */
    totalGamesPlayed: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Total number of games played at national level.'
    },

    /**
     * 🥇 First Place Wins
     * Total number of 1st place finishes in all national games.
     */
    totalFirstPlaceWins: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Number of 1st place finishes in all national games.'
    },

    /**
     * 🥈 Second Place Wins
     * Total number of 2nd place finishes in all national games.
     */
    totalSecondPlaceWins: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Number of 2nd place finishes in all national games.'
    },

    /**
     * 🥉 Third Place Wins
     * Total number of 3rd place finishes in all national games.
     */
    totalThirdPlaceWins: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Number of 3rd place finishes in all national games.'
    },

    // ------------------------------------------------
    // 🔹 Timestamps
    // ------------------------------------------------

    /**
     * 🕒 Created At
     * Timestamp marking when this leaderboard entry was created.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp when this leaderboard entry was created.'
    },

    /**
     * 🔄 Updated At
     * Timestamp marking the last update to XP or stats.
     */
    updatedAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp when this leaderboard entry was last updated.'
    },

    // ------------------------------------------------
    // 🔹 Status Flags
    // ------------------------------------------------

    /**
     * ✅ Active Status
     * Indicates whether the player is actively participating in national games.
     * Inactive players may be excluded from leaderboard displays.
     */
    isActive: {
        type: Boolean,
        default: true,
        description: 'True if the player is actively participating in national games.'
    },

    /**
     * ❌ Deletion Flag
     * Soft-delete indicator — allows hiding records while retaining history.
     */
    isDeleted: {
        type: Boolean,
        default: false,
        description: 'Marks this leaderboard entry as deleted (soft delete).'
    }
});

// ------------------------------------------------
// 🔹 Indexes (for optimized performance)
// ------------------------------------------------

/**
 * Note: clientId already has unique index from schema definition
 * No need to add duplicate index here
 */

/**
 * Compound index for sorting by total XP
 */
nationalLeaderboardSchema.index({ totalXp: -1 });

/**
 * Index for filtering active and non-deleted entries
 */
nationalLeaderboardSchema.index({ isActive: 1, isDeleted: 1 });

module.exports = mongoose.model('NationalLeaderboard', nationalLeaderboardSchema);
