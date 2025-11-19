const mongoose = require('mongoose');

/**
 * XpRule Model (ÔCargo App)
 *
 * Represents a master configuration for **XP (Experience Point) rules**.
 * Each rule defines how much XP is awarded for a specific Name, 
 * such as answering correctly, winning a quiz, or maintaining a streak.
 *
 * XP rules can differ depending on the **context**:
 * - `local` quizzes (within a single franchise)
 * - `national` events (organized by HQ)
 *
 * This schema acts as the **base reference** for XP calculation in:
 * - `XP` transNames (per game)
 * - `Leaderboard` updates
 * - `Player progression` logic
 */

const xpRuleSchema = new mongoose.Schema({
  // ------------------------------------------------
  // 🔹 Name Key
  // ------------------------------------------------

  /**
   * ⚙️ Name
   * A unique identifier representing the player Name or achievement that triggers XP gain.
   * Examples:
   * - `win_game` → awarded when the player wins 1st place
   * - `answer_correct` → awarded per correct answer
   * - `streak_bonus` → awarded for maintaining a correct answer streak
   * - `participation` → awarded for completing a quiz
   */
  name: { 
    type: String, 
    required: true,
    description: "Unique key representing the type of player Name triggering XP (e.g., 'win_game', 'answer_correct')."
  },

  // ------------------------------------------------
  // 🔹 XP Value
  // ------------------------------------------------

  /**
   * 💯 XP Value
   * The number of XP points awarded for the specified Name.
   * Can be static (e.g., 100 XP for winning) or combined dynamically 
   * with multipliers in the XP calculation logic.
   */
  xpValue: { 
    type: Number, 
    required: true,
    description: "Base amount of XP to be awarded for this Name."
  },

  // ------------------------------------------------
  // 🔹 XP Context (Local/National)
  // ------------------------------------------------

  /**
   * 🌍 Type
   * Specifies whether the XP rule applies to local franchise quizzes or national events.
   * Helps in differentiating reward scaling between contexts.
   * Enum values:
   * - `local` → Franchise-level events
   * - `national` → HQ-organized nationwide competitions
   */
  type: { 
    type: String, 
    enum: ['local', 'national'], 
    required: true,
    description: "Defines the game context where this XP rule applies ('local' or 'national')."
  },

  // ------------------------------------------------
  // 🔹 Description (Optional)
  // ------------------------------------------------

  /**
   * 📝 Description
   * A human-readable explanation of what this rule does.
   * Useful for admin dashboards, configuration UIs, or rule management tools.
   */
  description: { 
    type: String,
    default: null,
    description: "Optional description of the rule for documentation or admin UI."
  }
});

module.exports = mongoose.model('XpRule', xpRuleSchema);
