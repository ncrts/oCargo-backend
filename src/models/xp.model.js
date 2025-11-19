import mongoose from "mongoose";

/**
 * XP Model (ÔCargo App)
 *
 * Tracks **experience points (XP)** earned by a player for each completed quiz.
 * Used to calculate player progression, levels, and leaderboard positions.
 *
 * Each XP record corresponds to a single **quiz participation** by a player.
 * XP is broken down into base points and several types of bonuses.
 *
 * Bonus breakdown:
 * - Base XP → awarded for correct answers
 * - Speed Bonus XP → based on how fast the player answers
 * - Streak Bonus XP → for consecutive correct answers
 * - Rank Bonus XP → for top-ranking finishes (1st–3rd place)
 */

const xpSchema = new mongoose.Schema({
  // ------------------------------------------------
  // 🔹 Core References
  // ------------------------------------------------

  /**
   * 👤 Player Reference
   * Identifies which player this XP entry belongs to.
   * Used for tracking progression and aggregating totals in leaderboards.
   */
  playerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Player",
    required: true,
    index: true,
    description: "Reference to the player who earned the XP."
  },

  /**
   * 🧩 Quiz Reference
   * The specific quiz that generated this XP transaction.
   */
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Quiz",
    required: true,
    description: "Reference to the quiz where XP was earned."
  },

  /**
   * 🏢 Franchise Reference
   * Identifies the franchise location (ÔCargo branch) where the player played.
   * Helps aggregate XP locally and nationally.
   */
  franchiseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Franchise",
    required: true,
    description: "Reference to the franchise (location) where XP was earned."
  },

  /**
   * 🏠 Franchise Name
   * Readable name of the franchise, stored for fast reporting and exports.
   */
  franchiseName: {
    type: String,
    required: true,
    description: "Name of the franchise where the XP was earned."
  },

  // ------------------------------------------------
  // 🔹 Quiz Type Context
  // ------------------------------------------------

  /**
   * 🌍 Quiz Type
   * Defines whether this XP was earned in a local franchise game or a national event.
   * - local → Played in one franchise only
   * - national → Global HQ-led national event
   */
  quizType: {
    type: String,
    enum: ["local", "national"],
    default: "local",
    description: "Type of quiz: local (franchise-level) or national (HQ event)."
  },

  // ------------------------------------------------
  // 🔹 XP Breakdown
  // ------------------------------------------------

  /**
   * ⚡ Base XP
   * XP from correct answers only, without any bonus multipliers.
   * Represents player accuracy performance.
   */
  baseXP: {
    type: Number,
    required: true,
    description: "XP awarded for correct answers only (before applying bonuses)."
  },

  /**
   * ⏱️ Speed Bonus XP
   * Bonus XP for answering quickly relative to other players.
   * Determined by the time-based multiplier (1.0 → 0.3).
   */
  speedBonusXP: {
    type: Number,
    default: 0,
    description: "Extra XP awarded for fast responses (time-based bonus)."
  },

  /**
   * 🔥 Streak Bonus XP
   * Bonus XP awarded for consecutive correct answers (e.g., 3+ correct in a row).
   */
  streakBonusXP: {
    type: Number,
    default: 0,
    description: "XP bonus for maintaining streaks of correct answers."
  },

  /**
   * 🏆 Rank Bonus XP
   * Extra XP given to players finishing in top positions (1st, 2nd, 3rd).
   * Helps reward competitive placements.
   */
  rankBonusXP: {
    type: Number,
    default: 0,
    description: "XP awarded for ranking among the top positions in the game."
  },

  /**
   * 💯 Total Earned XP
   * Final XP sum earned in this quiz (baseXP + all bonuses).
   * Stored for analytics, leaderboard updates, and player progression.
   */
  totalEarnedXP: {
    type: Number,
    required: true,
    description: "Total XP earned in this quiz (base + speed + streak + rank bonuses)."
  },

  /**
   * 🎚️ Multiplier Used
   * The time-based multiplier used to calculate XP (1.0 → 0.3 linear decay).
   * Reflects the player’s response speed factor.
   */
  multiplierUsed: {
    type: Number,
    default: 1.0,
    description: "Speed multiplier applied for XP calculation (based on response time)."
  },

  // ------------------------------------------------
  // 🔹 Performance Metrics
  // ------------------------------------------------

  /**
   * ❓ Question Count
   * Total number of questions played by the player in this quiz.
   */
  questionCount: {
    type: Number,
    default: 0,
    description: "Total number of questions played in this quiz."
  },

  /**
   * ✅ Correct Answers
   * Number of questions answered correctly by the player.
   */
  correctAnswers: {
    type: Number,
    default: 0,
    description: "Number of correct answers by the player in this quiz."
  },

  /**
   * 🎯 Accuracy Rate
   * Player’s percentage accuracy = (correctAnswers / questionCount) * 100.
   */
  accuracyRate: {
    type: Number,
    default: 0,
    description: "Percentage of correct answers achieved by the player."
  },

  /**
   * 🏅 Final Rank
   * The player’s final position in the game leaderboard (1 = winner).
   */
  finalRank: {
    type: Number,
    default: null,
    description: "Final rank achieved in this quiz session."
  },

  // ------------------------------------------------
  // 🔹 Progression Tracking
  // ------------------------------------------------

  /**
   * 📈 XP Level Before
   * Player’s XP total before participating in this quiz.
   * Used to calculate progression difference after the game.
   */
  xpLevelBefore: {
    type: Number,
    default: 0,
    description: "Player's total XP before playing this quiz."
  },

  /**
   * 📊 XP Level After
   * Player’s XP total after adding the newly earned XP.
   * Used to update level badges and progress bars.
   */
  xpLevelAfter: {
    type: Number,
    default: 0,
    description: "Player's total XP after this quiz was completed."
  },

  // ------------------------------------------------
  // 🔹 Meta Information
  // ------------------------------------------------

  /**
   * 🕒 Date Earned
   * Timestamp for when this XP record was generated.
   */
  dateEarned: {
    type: Date,
    default: Date.now,
    description: "Date and time when the XP was earned."
  },

  /**
   * ⚙️ Processed Flag
   * Indicates whether this XP entry has been aggregated into the player’s
   * total leaderboard and XP stats (used in batch updates).
   */
  processed: {
    type: Boolean,
    default: false,
    description: "True if this XP record has been integrated into player totals."
  }
});

// ------------------------------------------------
// 🔹 Indexes for Performance
// ------------------------------------------------

/**
 * Combines player and franchise to optimize lookups for local leaderboards.
 */
xpSchema.index({ playerId: 1, franchiseId: 1 });

/**
 * Optimizes filtering by quiz type (local/national) and sorting by date earned.
 */
xpSchema.index({ quizType: 1, dateEarned: -1 });

export default mongoose.model("XP", xpSchema);
