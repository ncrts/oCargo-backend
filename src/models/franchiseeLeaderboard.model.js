const mongoose = require('mongoose');

/**
 * Franchisee Leaderboard Model (ÔCargo App)
 *
 * Represents a player's XP and ranking at a specific franchise location.
 *
 * This model tracks:
 * - Player identification via clientId
 * - Specific franchise location via franchiseeInfoId
 * - XP earned at this franchise
 * - Total games played at this franchise
 * - Activity and deletion status
 * - Timestamps for creation and updates
 *
 * Used for displaying franchise-level leaderboards and rankings.
 */

const franchiseeLeaderboardSchema = new mongoose.Schema({
    // ------------------------------------------------
    // 🔹 Core Relationships
    // ------------------------------------------------

    /**
     * 👤 Client Reference
     * Identifies the player whose XP and ranking this record tracks at this franchise.
     */
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true,
        description: 'Reference to the client/player for this leaderboard entry.'
    },

    /**
     * 🏪 Franchisee Reference
     * Identifies the specific franchise location.
     */
    franchiseeInfoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FranchiseeInfo',
        required: true,
        description: 'Reference to the specific franchise location.'
    },

    // ------------------------------------------------
    // 🔹 XP & Performance Tracking
    // ------------------------------------------------

    /**
     * ⚡ Franchisee XP
     * Total experience points earned at this specific franchise location.
     */
    totalXp: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Total XP earned at this specific franchise location.'
    },

    /**
     * 🎮 Games Played at Franchisee
     * Total number of games played at this specific franchise.
     */
    totalGamesPlayed: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Total number of games played at this specific franchise.'
    },

    /**
     * 🥇 First Place Wins
     * Total number of 1st place finishes at this franchise.
     */
    totalFirstPlaceWins: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Number of 1st place finishes at this franchise.'
    },

    /**
     * 🥈 Second Place Wins
     * Total number of 2nd place finishes at this franchise.
     */
    totalSecondPlaceWins: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Number of 2nd place finishes at this franchise.'
    },

    /**
     * 🥉 Third Place Wins
     * Total number of 3rd place finishes at this franchise.
     */
    totalThirdPlaceWins: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Number of 3rd place finishes at this franchise.'
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
     * Indicates whether the player is actively participating at this franchise.
     */
    isActive: {
        type: Boolean,
        default: true,
        description: 'True if the player is actively participating at this franchise.'
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
 * Composite index for quick lookup by client and franchise
 */
franchiseeLeaderboardSchema.index({ clientId: 1, franchiseeInfoId: 1 }, { unique: true });

/**
 * Index for sorting by XP at a specific franchise
 */
franchiseeLeaderboardSchema.index({ franchiseeInfoId: 1, totalXp: -1 });

/**
 * Index for filtering active and non-deleted entries
 */
franchiseeLeaderboardSchema.index({ isActive: 1, isDeleted: 1 });

module.exports = mongoose.model('FranchiseeLeaderboard', franchiseeLeaderboardSchema);
