const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * XpRule Model (ÔCargo Quiz Management System)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 📚 **Purpose:**
 * Master configuration schema for Experience Point (XP) rules that govern how
 * players earn XP across the gamification system. Provides a centralized, 
 * reusable rule set that can be applied to any quiz game session.
 *
 * 🎮 **How It Works:**
 * When a player completes a quiz or achieves a milestone (e.g., correct answer,
 * winning a game, streak achievement), the system:
 * 1. Identifies the achievement type (rankName)
 * 2. Looks up the corresponding XpRule
 * 3. Retrieves the xpValue and applies it to the player's XP total
 * 4. Stores the transaction in the XP model with context (local/national)
 *
 * 🌍 **Multi-Context Support:**
 * Rules can differ based on quiz type:
 * - `local` quizzes → Franchise-level competitions (single location)
 * - `national` quizzes → Nationwide competitions (HQ-organized, higher stakes)
 * - Multipliers can be applied per context (e.g., 1x for local, 1.5x for national)
 *
 * 🔗 **Key Relationships:**
 * - Referenced by: XP model (per transaction), QuizSessionPlayer (rank/milestone tracking)
 * - Used in: Leaderboard calculations, Player progression, Badge earning logic
 * - Consumption: Admin API for rule management, Player stats endpoints
 *
 * 📊 **Data Model Hierarchy:**
 * XpRule (Master Rules)
 *   ├── Used by: XP (Transaction Records)
 *   │   ├── quizGameSessionId → QuizGameSession
 *   │   └── clientId → Client/Player
 *   └── Used by: QuizSessionPlayer (Player Stats)
 *       ├── finalRank, dateEarned
 *       └── XP rewards earned during participation
 *
 * 💡 **Example Rules:**
 * - answer_correct: +10 XP per correct answer (local), +15 XP (national)
 * - streak_bonus: +5 XP × streak count (maintaining momentum)
 * - win_game: +50 XP (1st place), +30 XP (2nd place), +10 XP (3rd place)
 * - participation: +5 XP (completing a quiz, regardless of score)
 *
 * 🔐 **Immutability Notes:**
 * - Rules are created/managed by admin only
 * - Changes to existing rules DO NOT affect historical XP transactions
 * - Player progression uses snapshot values at the time of achievement
 *
 * ⚡ **Performance Optimization:**
 * - Rules are typically cached in memory for quick lookup
 * - Indexed by rankName and type for O(1) retrieval
 * - Used during session completion to batch-calculate player rewards
 */

const xpRuleSchema = new mongoose.Schema({
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔹 ACHIEVEMENT IDENTIFIER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🎯 rankName
   * 
   * A unique, machine-readable identifier for the achievement or milestone 
   * that triggers XP gain. Acts as the primary lookup key when determining 
   * how much XP to award.
   *
   * **Supported Languages:**
   * - en_us: English (US) name for the achievement
   * - fr_fr: French (France) name for the achievement
   *
   * **Standard Achievement Types:**
   * - `answer_correct` → Awarded per correct quiz answer (base XP: 10-15)
   * - `answer_incorrect` → Penalty or reduced XP (base XP: 0-2)
   * - `streak_3` → Maintaining 3 consecutive correct answers (base XP: 5-10)
   * - `streak_5` → Maintaining 5 consecutive correct answers (base XP: 15-20)
   * - `streak_10` → Maintaining 10+ consecutive correct answers (base XP: 30-50)
   * - `win_game` → Winning the quiz (1st place overall) (base XP: 50-100)
   * - `second_place` → 2nd place finish (base XP: 30-50)
   * - `third_place` → 3rd place finish (base XP: 10-30)
   * - `participation` → Completing a quiz, regardless of score (base XP: 5-10)
   * - `first_time_quiz` → First attempt at a specific quiz (base XP: 10-20)
   * - `perfect_score` → Answering all questions correctly (base XP: 100-200)
   * - `speed_bonus` → Completing quiz within time limit (base XP: 5-15)
   *
   * **Usage in Code:**
   * When a player achieves an outcome, the system queries: 
   * `XpRule.findOne({ rankName: { en_us: 'answer_correct' }, type: 'local' })`
   *
   * **Storage Example:**
   * ```json
   * {
   *   "_id": "60d5ec49c1234567890abc12",
   *   "rankName": {
   *     "en_us": "answer_correct",
   *     "fr_fr": "réponse_correcte"
   *   },
   *   ...
   * }
   * ```
   */
  rankName: {
    en_us: {
      type: String,
      default: null,
      description: "English (US) machine-readable identifier for achievement"
    },
    fr_fr: {
      type: String,
      default: null,
      description: "French (France) machine-readable identifier for achievement"
    }
  },

  /**
   * 🏅 roleInspiration
   * 
   * A human-readable, inspirational description of the achievement or role
   * that can be displayed to players in-game (achievements screen, badges, etc.).
   * Different from rankName as it's meant for UI presentation, not logic.
   *
   * **Supported Languages:**
   * - en_us: English inspirational message
   * - fr_fr: French inspirational message
   *
   * **Example Inspirations:**
   * - "You're on fire! 🔥" (for streak bonuses)
   * - "Perfect Score Achieved! ⭐" (for perfect games)
   * - "National Champion! 🏆" (for 1st place in national)
   * - "Quiz Master! 📚" (for participation)
   *
   * **UI Presentation:**
   * Displayed in achievement notifications, popups, leaderboard highlights.
   * Motivates players to pursue specific achievements.
   *
   * **Storage Example:**
   * ```json
   * {
   *   "roleInspiration": {
   *     "en_us": "Perfect Streak!",
   *     "fr_fr": "Série Parfaite!"
   *   }
   * }
   * ```
   */
  roleInspiration: {
    en_us: {
      type: String,
      default: null,
      description: "English inspirational description for UI display"
    },
    fr_fr: {
      type: String,
      default: null,
      description: "French inspirational description for UI display"
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 📝 METADATA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 📄 description
   * 
   * A detailed, human-readable explanation of what this rule does, when it applies,
   * and how it contributes to player progression. Used for documentation, admin
   * dashboards, configuration management interfaces, and player education.
   *
   * **Supported Languages:**
   * - en_us: English explanation
   * - fr_fr: French explanation
   *
   * **Guidelines for Description:**
   * 1. Clear: Describe the exact condition that triggers the XP award
   * 2. Context: Explain how this rule affects player progression
   * 3. Examples: Provide concrete examples when possible
   * 4. Scope: Clarify if rule applies to local, national, or both contexts
   *
   * **Example Descriptions:**
   * - "Award 10 XP for each correct answer. Encourages accuracy and knowledge."
   * - "Bonus 20 XP for answering 5 consecutive questions correctly. Rewards consistency."
   * - "Award 100 XP to the quiz winner (1st place). Highlights top performers."
   * - "Award 50 XP for participating in a quiz, regardless of score. Builds engagement."
   *
   * **Storage Example:**
   * ```json
   * {
   *   "description": {
   *     "en_us": "Awarded for each correct answer in a quiz. Builds base XP.",
   *     "fr_fr": "Accordé pour chaque bonne réponse dans un quiz. Construit XP de base."
   *   }
   * }
   * ```
   */
  description: {
    en_us: {
      type: String,
      default: null,
      description: "English detailed explanation of the rule"
    },
    fr_fr: {
      type: String,
      default: null,
      description: "French detailed explanation of the rule"
    }
  },

  /**
   * 🎨 icon
   * 
   * A visual icon URL or emoji that represents this achievement visually.
   * Used in:
   * - Achievement notifications
   * - Badge displays on player profiles
   * - Leaderboard highlights
   * - Admin dashboards for rule management
   *
   * **Icon Storage Options:**
   * 1. Emoji: "🎯", "⭐", "🔥", "🏆", "📚", etc. (simple, loaded instantly)
   * 2. URL: "https://cdn.ocargoapp.com/icons/streak-5.svg" (high quality, hosted)
   * 3. Font Awesome: "fas fa-fire", "fas fa-star", etc. (if using Font Awesome)
   *
   * **Icon Library Suggestions:**
   * - Correct Answer: 📍, ✅, 💚, 🎯
   * - Streak Bonus: 🔥, ⚡, 🚀, 💪
   * - Winning: 🏆, 👑, 🥇, ⭐
   * - Participation: 📚, 🎓, 🎮, 💎
   *
   * **Storage Example:**
   * ```json
   * {
   *   "iconUrl": "🔥" // emoji for streak bonus
   *   // OR
   *   "iconUrl": "https://cdn.ocargoapp.com/icons/streak.svg"
   * }
   * ```
   */
  iconUrl: {
    type: String,
    default: null,
    description: "Emoji or icon URL representing the achievement visually"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 💰 XP REWARD CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 💯 xpValue
   * 
   * The base amount of Experience Points (XP) awarded when a player achieves 
   * this specific rank or milestone. This is the **primary reward metric** 
   * that determines player progression and leaderboard positioning.
   *
   * **Calculation Rules:**
   * - Base Value: Defined in this field (e.g., 10 XP for correct answer)
   * - Multipliers: Can be applied based on context (e.g., 1.5x for national)
   * - Final XP = xpValue × context_multiplier × difficulty_modifier
   *
   * **XP Award Ranges (Typical Guideline):**
   * ┌──────────────────────────────┬────────────┐
   * │ Achievement Type             │ Typical XP │
   * ├──────────────────────────────┼────────────┤
   * │ Single correct answer        │ 10-15      │
   * │ 3-streak bonus               │ 5-10       │
   * │ 5-streak bonus               │ 15-20      │
   * │ 10+ streak bonus             │ 30-50      │
   * │ 3rd place (top 3)            │ 10-30      │
   * │ 2nd place                    │ 30-50      │
   * │ 1st place (winner)           │ 50-100     │
   * │ Perfect score (100% correct) │ 100-200    │
   * │ Participation (completing)   │ 5-10       │
   * │ Speed bonus (time limit)     │ 5-15       │
   * └──────────────────────────────┴────────────┘
   *
   * **Storage Example:**
   * ```json
   * {
   *   "rankName": { "en_us": "answer_correct" },
   *   "xpValue": 10,  // 10 XP per correct answer
   *   "type": "local"
   * }
   * ```
   *
   * **Real-world XP Calculation Example:**
   * Player answers correctly in a NATIONAL quiz with difficulty modifier 1.2:
   * Final XP = 10 (base) × 1.5 (national multiplier) × 1.2 (difficulty) = 18 XP
   *
   * **Validation:**
   * - Must be a positive integer (> 0)
   * - Recommended range: 5-200 (to maintain progression balance)
   * - Can be 0 for "tracking-only" rules (no XP awarded)
   *
   * **Admin Considerations:**
   * - Adjust values if progression is too slow/fast
   * - Higher values for rare achievements (perfect score)
   * - Lower values for common achievements (each correct answer)
   */
  xpValue: {
    type: Number,
    required: true,
    description: "Base XP points awarded for this achievement. Can be multiplied per context."
  },

  createdAt: {
    type: Date,
    default: Date.now,
    description: "Timestamp when this XP rule was created."
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    description: "Timestamp when this XP rule was last updated."
  },
  isDeleted: {
    type: Boolean,
    default: false,
    description: "Soft deletion flag for GDPR compliance."
  }
});

module.exports = mongoose.model('XpRule', xpRuleSchema);
