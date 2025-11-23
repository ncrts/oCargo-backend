const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Badge Model (ÔCargo Gamification System)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 🎖️ **Purpose:**
 * Master configuration schema for achievement badges that recognize and reward 
 * player accomplishments within the ÔCargo gamification ecosystem. Badges provide 
 * visible recognition of milestone achievements, encouraging continued engagement 
 * and progression through the game system.
 *
 * 🏆 **How It Works:**
 * When a player achieves a specific milestone (reaches a level, completes N quizzes,
 * maintains a streak, etc.), the system:
 * 1. Checks the Badge criteria (xpRequired, type)
 * 2. Verifies player eligibility (sufficient XP, active badge)
 * 3. Awards the badge with timestamp
 * 4. Displays badge on player profile and leaderboards
 * 5. Contributes to overall player progression metrics
 *
 * 🎯 **Badge Categories:**
 * Badges can represent various achievements:
 * - **Level Badges:** Awarded when reaching specific XP thresholds
 * - **Achievement Badges:** Earned through special accomplishments
 * - **Participation Badges:** Recognition for consistent engagement
 * - **Challenge Badges:** Earned by completing difficult tasks
 * - **Time-Limited Badges:** Seasonal or event-specific achievements
 *
 * 🔗 **Key Relationships:**
 * - Displayed on: Client profile, Leaderboards, Quiz results
 * - Earned by: Clients/Players based on XP thresholds and achievements
 * - Referenced by: Client profile, Achievement tracking systems
 * - Used in: Gamification metrics, Player engagement analytics
 *
 * 📊 **Badge System Hierarchy:**
 * Badge (Master Badge Definition)
 *   ├── Used by: Client (earned badges)
 *   │   └── Displayed in: Profile, Leaderboard, Achievement screens
 *   ├── Referenced by: Badge earning logic
 *   │   └── Triggered on: XP threshold, quiz completion, streak
 *   └── Used in: Gamification analytics
 *       └── Measures: Player engagement, Progression rate
 *
 * 💡 **Example Badges:**
 * - "First Quiz Completed" - Awarded on first quiz participation
 * - "Quiz Master" - Awarded when reaching 100 quiz completions
 * - "Level 10 Reached" - Awarded upon reaching merchant navy level 10
 * - "Streak Champion" - Awarded for maintaining 7-day quiz streak
 * - "Perfect Score" - Awarded for 100% correct answers
 * - "Captain Grade" - Awarded when reaching Captain level (Level 13+)
 *
 * 🔐 **Badge Management:**
 * - Badges are created/managed by HQ administrators
 * - Badge criteria changes may affect future awards but not past earnings
 * - Soft deletion preserves badge history for earned badges
 * - Multi-language support for international player base
 *
 * ⚡ **Performance Optimization:**
 * - Badges are typically cached on app startup for quick lookup
 * - Badge validation occurs at quiz completion, not in real-time
 * - Batch processing for bulk badge awards (e.g., daily/weekly)
 * - Index recommendations for efficient criteria matching
 */

const badgeSchema = new mongoose.Schema({
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔹 BADGE IDENTIFICATION & NAMING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🏷️ Badge Name (Multi-Language)
   *
   * Display name of the badge shown to players on profiles, achievement screens,
   * and in notifications. This is the human-readable identifier that players see
   * and interact with.
   *
   * **Supported Languages:**
   * - en_us: English (US) badge name
   * - fr_fr: French (France) badge name
   *
   * **Naming Guidelines:**
   * - Should be concise (2-4 words maximum)
   * - Should reflect the achievement clearly
   * - Avoid jargon; use player-friendly language
   * - Examples: "Quiz Master", "Level 10 Reached", "Streak Champion"
   *
   * **Storage Example:**
   * ```json
   * {
   *   "name": {
   *     "en_us": "Quiz Master",
   *     "fr_fr": "Maître du Quiz"
   *   }
   * }
   * ```
   *
   * **Usage:**
   * - Displayed on player profile badge list
   * - Shown in achievement notifications
   * - Included in leaderboard achievements section
   * - Referenced in badge earning logic
   */
  name: {
    en_us: {
      type: String,
      default: null,
      description: "Badge name in English (US). Example: 'Quiz Master', 'Level 10 Reached', 'Streak Champion'."
    },
    fr_fr: {
      type: String,
      default: null,
      description: "Badge name in French. Example: 'Maître du Quiz', 'Niveau 10 Atteint', 'Champion de Série'."
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 📝 DESCRIPTION & DOCUMENTATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 📄 Badge Description (Multi-Language)
   *
   * Detailed explanation of what the badge represents, how it's earned, and
   * its significance. This context-rich description is displayed when players
   * view badge details or hover over badges for more information.
   *
   * **Supported Languages:**
   * - en_us: English explanation of the badge criteria
   * - fr_fr: French explanation of the badge criteria
   *
   * **Description Guidelines:**
   * 1. **Be Specific:** Explain exact criteria (e.g., "Earned after completing 100 quizzes")
   * 2. **Be Clear:** Use simple, player-friendly language
   * 3. **Provide Context:** Explain why this achievement matters
   * 4. **Include Rewards:** Mention XP or other benefits if applicable
   * 5. **Be Encouraging:** Use motivational language
   *
   * **Example Descriptions:**
   * - "Earned by completing your first quiz. Welcome aboard!"
   * - "Unlock by reaching 100 correct answers across all quizzes."
   * - "Master of knowledge! Complete 50 quizzes successfully."
   * - "Achieved Captain rank! You've mastered the seas."
   *
   * **Storage Example:**
   * ```json
   * {
   *   "description": {
   *     "en_us": "Award achieved by completing 100 quizzes. You've become a quiz master!",
   *     "fr_fr": "Prix obtenu en complétant 100 quiz. Vous êtes devenu un maître du quiz!"
   *   }
   * }
   * ```
   *
   * **Usage:**
   * - Displayed in badge detail view
   * - Shown in tooltip on hover
   * - Included in achievement notifications
   * - Used in onboarding badge education
   */
  description: {
    en_us: {
      type: String,
      default: null,
      description: "English description of the badge, including criteria and significance."
    },
    fr_fr: {
      type: String,
      default: null,
      description: "French description of the badge, including criteria and significance."
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 VISUAL REPRESENTATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🖼️ Badge Icon/Image URL
   *
   * Visual representation of the badge displayed throughout the app. This is
   * the primary visual element that players associate with the badge achievement.
   *
   * **Icon Storage Options:**
   * 1. **Emoji:** "🎖️", "🏆", "⭐", "🔥" (instant load, simple)
   * 2. **CDN URL:** "https://cdn.ocargoapp.com/badges/quiz-master.svg" (high quality)
   * 3. **Data URL:** Base64-encoded SVG (self-contained, no external deps)
   *
   * **Icon Design Guidelines:**
   * - Should be recognizable at 64x64px and 128x128px sizes
   * - Should work on both light and dark backgrounds
   * - Should convey the badge's meaning visually
   * - Should maintain consistency with game aesthetic
   * - Should work well in grayscale (for locked/inactive badges)
   *
   * **Icon Library Suggestions:**
   * - Achievement/Milestone: 🏆, 🥇, 🎯, ⭐
   * - Level/Progression: 📈, 🪜, 🔝, 👑
   * - Challenge/Quest: 🎮, 🗝️, 🎪, 🎭
   * - Streak/Consistency: 🔥, ⚡, 💪, 🚀
   * - Knowledge: 📚, 🧠, 💡, 🎓
   * - Social/Community: 🤝, 👥, 💬, 🌟
   *
   * **Storage Example:**
   * ```json
   * {
   *   "iconUrl": "🏆"  // Emoji approach
   *   // OR
   *   "iconUrl": "https://cdn.ocargoapp.com/badges/quiz-master.svg"  // URL approach
   * }
   * ```
   *
   * **Usage:**
   * - Profile badge display (locked and unlocked states)
   * - Achievement notification popup
   * - Leaderboard achievement section
   * - Badge collection view
   * - In-app achievement browser
   */
  iconUrl: {
    type: String,
    default: null,
    description: "Icon/image URL representing this badge visually. Can be emoji or CDN URL."
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎯 BADGE EARNING CRITERIA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 💯 XP Threshold Required
   *
   * The minimum XP (Experience Points) a player must accumulate to earn this badge.
   * This is the primary metric used to determine badge eligibility, typically tied
   * to merchant navy level progression.
   *
   * **XP Value Guidelines:**
   * - 0: Starter badge (awarded to all new players immediately)
   * - 0-1,000: Early game badges (first few levels)
   * - 1,000-10,000: Mid-game badges (intermediate progression)
   * - 10,000-50,000: Late-game badges (advanced progression)
   * - 50,000+: End-game/legendary badges (highest achievement)
   *
   * **Common XP Thresholds:**
   * - 0: "First Quiz" (immediate award)
   * - 100: "Novice" (Level 2: Bridge Novice)
   * - 500: "Skilled" (Level 4: Experienced Sailor)
   * - 1,000: "Competent" (Level 5: Quartermaster)
   * - 5,000: "Expert" (Level 9: Second Master)
   * - 10,000: "Master" (Level 11: Lieutenant)
   * - 50,000: "Legend" (Level 17: Admiral)
   * - 100,000: "Eternal Master" (Level 20: Master of Oceans)
   *
   * **Calculation Example:**
   * ```
   * IF player.totalXP >= badge.xpRequired THEN award badge
   * 
   * Example:
   * - Player achieves 10,500 total XP
   * - "Expert Badge" requires 10,000 XP
   * - Result: Badge earned and displayed
   * ```
   *
   * **Storage Example:**
   * ```json
   * {
   *   "xpRequired": 10000,  // Badge earned at 10,000 XP
   *   "isActive": true      // Currently achievable
   * }
   * ```
   *
   * **Usage:**
   * - Badge eligibility checks during XP award
   * - Badge progress display (e.g., "10,500/10,000 XP")
   * - Leaderboard sorting by badge count
   * - Achievement milestone notifications
   */
  xpRequired: {
    type: Number,
    default: 0,
    description: "Minimum XP required for a player to earn this badge. Use 0 for starter badges."
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚙️ BADGE STATUS & CONTROL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * ✅ Active Status
   *
   * Controls whether this badge is currently achievable by players. Active badges
   * are eligible for earning, while inactive badges may be:
   * - Under development or testing
   * - Temporarily disabled during maintenance
   * - Disabled due to unbalanced rewards
   * - Reserved for seasonal/event use
   *
   * **Behavior Based on Status:**
   * - **isActive: true** → Players can earn this badge, eligible for awards
   * - **isActive: false** → Badge not awarded, not displayed as achievable
   *                      → Already-earned badges remain on player profiles
   *                      → Useful for seasonal/limited-time badges
   *
   * **Use Cases:**
   * 1. **Development:** Set to false while designing badge criteria
   * 2. **Testing:** Set to false during beta testing
   * 3. **Balancing:** Disable if rewards are too generous
   * 4. **Seasonal:** Disable after seasonal event ends (keep earned badges)
   * 5. **Maintenance:** Disable during system updates if needed
   *
   * **Storage Example:**
   * ```json
   * {
   *   "isActive": true,      // Badge currently achievable
   *   "isDeleted": false     // Badge system record preserved
   * }
   * ```
   *
   * **Important Notes:**
   * - Disabling a badge does NOT remove it from players who earned it
   * - Historical badge records are preserved for audit trails
   * - Active status is checked at award time, not retroactively
   * - Admins can re-enable badges without affecting earned badges
   *
   * **Usage:**
   * - Badge eligibility checks
   * - Admin dashboard badge list filtering
   * - Player progress/achievement calculations
   * - Leaderboard badge count calculations
   */
  isActive: {
    type: Boolean,
    default: true,
    description: "Whether this badge is currently achievable. Inactive badges won't be awarded but remain in earned collections."
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 📊 AUDIT & MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 📅 Creation Timestamp
   *
   * Records when this badge definition was created in the system. Used for:
   * - Audit trail and history tracking
   * - Badge release date information
   * - System timeline reconstruction
   * - Badge age/tenure analysis
   *
   * **Storage & Format:**
   * - Automatically set to current date/time on creation
   * - Stored as ISO 8601 timestamp
   * - Not updated on subsequent changes (see updatedAt for changes)
   * - Immutable after creation
   *
   * **Example Value:**
   * "2025-11-20T10:30:00.000Z"
   *
   * **Usage:**
   * - Timeline of badge introduction
   * - Sorting badges by release date
   * - Determining badge age
   * - Audit trail reconstruction
   */
  createdAt: {
    type: Date,
    default: Date.now,
    description: "Timestamp when this badge was created in the system."
  },

  /**
   * 📅 Last Update Timestamp
   *
   * Records when this badge definition was last modified. Tracks all changes:
   * - Name or description edits
   * - Icon/image updates
   * - XP requirement changes
   * - Status toggling (active/inactive)
   *
   * **Storage & Format:**
   * - Automatically set on creation and updated on each modification
   * - Stored as ISO 8601 timestamp
   * - Useful for determining if badge criteria recently changed
   * - Helps identify recently modified badges in dashboards
   *
   * **Example Value:**
   * "2025-11-21T15:45:30.000Z"
   *
   * **Behavior on Changes:**
   * - Updated when any field is modified via PATCH/PUT
   * - NOT updated when badges are earned by players
   * - Updated when admin disables/enables badge
   *
   * **Usage:**
   * - Recent changes identification
   * - Sorting by modification date
   * - Detecting recently updated badge criteria
   * - Change notification triggers
   */
  updatedAt: {
    type: Date,
    default: Date.now,
    description: "Timestamp when this badge was last updated."
  },

  /**
   * 🗑️ Soft Deletion Flag
   *
   * Soft-delete marker for GDPR compliance and data retention. Instead of
   * permanently removing badge definitions, they are marked as deleted but
   * preserved in the database for audit trail and historical analysis.
   *
   * **Deletion Behavior:**
   * - **isDeleted: false** → Badge is active and visible/queryable
   * - **isDeleted: true** → Badge is hidden from normal queries
   *                       → Existing earned badges remain valid
   *                       → Preserved for audit and analytics
   *                       → Can be restored by setting flag to false
   *
   * **Why Soft Deletion?**
   * 1. **Audit Trail:** Preserve complete history of all badges
   * 2. **GDPR Compliance:** Data retention while respecting privacy
   * 3. **Restore Capability:** Re-enable deleted badges without data loss
   * 4. **Analytics:** Analyze badge effectiveness even after deletion
   * 5. **Referential Integrity:** Earned badges remain linked to definition
   *
   * **Queries with Soft Delete:**
   * ```javascript
   * // Get active badges only
   * const activeBadges = await Badge.find({ isDeleted: false });
   * 
   * // Get all badges including deleted (admin audit)
   * const allBadges = await Badge.find({});
   * ```
   *
   * **Storage Example:**
   * ```json
   * {
   *   "isDeleted": false,        // Badge is active
   *   "createdAt": "2025-11-20T10:00:00.000Z",
   *   "updatedAt": "2025-11-20T10:00:00.000Z"
   * }
   * ```
   *
   * **Usage:**
   * - Filtering queries (exclude deleted badges)
   * - Archive/restore operations
   * - Audit trail reconstruction
   * - GDPR data management
   * - Admin dashboard filters
   */
  isDeleted: {
    type: Boolean,
    default: false,
    description: "Soft-deletion flag. Set to true for GDPR-compliant archival without losing historical data."
  }
});

const Badge = mongoose.model('Badge', badgeSchema);
module.exports = Badge;
