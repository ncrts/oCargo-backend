const mongoose = require('mongoose');

/**
 * Local Leaderboard Model (ÔCargo App)
 *
 * Represents a player's aggregated XP and ranking across all local (franchise-level) games.
 *
 * This model tracks:
 * - Player identification via clientId
 * - Total XP earned from all local games (cumulative across all franchises)
 * - Total games played at all franchises combined
 * - Activity and deletion status
 * - Timestamps for creation and updates
 *
 * Used for displaying local-level leaderboards and rankings across all franchise locations.
 */

const localLeaderboardSchema = new mongoose.Schema({
    // ------------------------------------------------
    // 🔹 Core Relationships
    // ------------------------------------------------

    /**
     * 👤 Client Reference
     * Identifies the player whose XP and ranking this record tracks for local games.
     */
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        description: 'Reference to the client/player for this leaderboard entry.'
    },

    // ------------------------------------------------
    // 🔹 XP & Performance Tracking
    // ------------------------------------------------

    /**
     * ⚡ Total Local XP
     * Cumulative experience points earned from all local (franchise-specific) games.
     * Aggregates XP across all franchise locations.
     */
    totalXp: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Total XP earned from all local games across all franchises.'
    },

    /**
     * 🎮 Total Games Played
     * Total number of games played at all franchise locations combined.
     */
    totalGamesPlayed: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Total number of games played at all local franchise locations.'
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
     * Indicates whether the player is actively participating in local games.
     * Inactive players may be excluded from leaderboard displays.
     */
    isActive: {
        type: Boolean,
        default: true,
        description: 'True if the player is actively participating in local games.'
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
localLeaderboardSchema.index({ totalXp: -1 });

/**
 * Index for filtering active and non-deleted entries
 */
localLeaderboardSchema.index({ isActive: 1, isDeleted: 1 });

module.exports = mongoose.model('LocalLeaderboard', localLeaderboardSchema);
