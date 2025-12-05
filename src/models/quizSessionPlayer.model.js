const mongoose = require('mongoose');

/**
 * QuizSessionPlayer Model (ÔCargo App)
 *
 * Represents an **individual player’s participation record** within a specific quiz game session.
 *
 * Each document corresponds to a single player's gameplay instance — including:
 * - Their connection to a quiz session
 * - Real-time progress (score, streak, answers)
 * - Join/leave timestamps
 *
 * This schema is critical for real-time tracking, scoring logic, and post-game analytics.
 */

const quizSessionPlayerSchema = new mongoose.Schema({
    // ------------------------------------------------
    // 🔹 Core Relationships
    // ------------------------------------------------

    /**
     * 🧩 Quiz Game Session Reference
     * Links this player’s record to the specific quiz session they joined.
     * Used to group all players under a single ongoing or completed game session.
     */
    quizGameSessionId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'QuizGameSession',
        required: true,
        description: 'Reference to the quiz game session this player belongs to.'
    },

    /**
       * 🏢 Franchise Reference
       * Identifies the franchise location (ÔCargo branch) where the player played.
       * Helps aggregate XP locally and nationally.
       */
    franchiseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FranchiseeInfo",
        required: true,
        description: "Reference to the franchise (location) where XP was earned."
    },


    /**
     * 👤 Client Reference
     * Identifies the actual user (player) participating in this session.
     * Can be a registered or guest client.
     */
    clientId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Client',
        required: true,
        description: 'Reference to the client/player participating in the session.'
    },

    // ------------------------------------------------
    // 🔹 Player Performance
    // ------------------------------------------------

    /**
     * ⚡ Total Score
     * The cumulative score earned by the player across all questions in this session.
     * Automatically updated as the player answers questions.
     */
    totalScore: {
        type: Number,
        default: 0,
        description: 'Total score accumulated by the player during this session.'
    },

    /**
     * 🔥 Streak Counter
     * Tracks consecutive correct answers given by the player.
     * Used for streak bonuses and achievements.
     */
    streak: {
        type: Number,
        default: 0,
        description: 'Current streak of consecutive correct answers.'
    },

    // ------------------------------------------------
    // 🔹 Player Answers (Per Question)
    // ------------------------------------------------

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
   * 🌍 Quiz Type
   * Defines whether this XP was earned in a local franchise game or a national event.
   * - local → Played in one franchise only
   * - national → Global HQ-led national event
   */
    quizType: {
        type: String,
        enum: ["Local", "National"],
        default: "Local",
        description: "Type of quiz: local (franchise-level) or national (HQ event)."
    },

    /**
     * 🧠 Answers Array
     * Stores each question attempted by the player, including correctness and time metrics.
     */
    answers: [
        {
            /**
             * ❓ Question Reference
             * Identifies which quiz question this answer belongs to.
             */
            questionId: {
                type: mongoose.SchemaTypes.ObjectId,
                ref: 'QuizQuestion',
                required: true,
                description: 'Reference to the question answered by the player.'
            },

            questionType: {
                type: String,
                enum: ['Quiz', 'TrueFalse', 'TypeAnswer', 'Puzzle', 'Slider', 'Slide', 'imagePin'],
                required: true,
                description: 'Type of the question answered.'
            },

            /**
             * ✏️ Answer
             * The player’s submitted answer.
             * Supports multiple types — text, multiple choice, boolean, slider, etc.
             */
            answerObj: {
               type: Object,
               default: {},
               description: 'The player’s submitted answer object.'
            },

            /**
             * ⏱️ Time Taken
             * Duration (in seconds) between question start and the player’s response.
             */
            timeTaken: {
                type: Number,
                default: null,
                description: 'Time taken by the player to answer the question (in seconds).'
            },

            /**
             * ✅ Correctness
             * Indicates whether the submitted answer was correct.
             */
            isCorrect: {
                type: Boolean,
                default: null,
                description: 'True if the player’s answer was correct, otherwise false.'
            },

            /**
             * 🪙 Score Awarded
             * The score assigned for this specific question.
             * Depends on accuracy, speed, and XP rules.
             */
            scoreAwarded: {
                type: Number,
                default: 0,
                description: 'Score points earned for this specific question.'
            }
        }
    ],

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
    // 🔹 Session Lifecycle
    // ------------------------------------------------

    /**
     * 🕓 Joined At
     * Timestamp of when the player joined the quiz session.
     * Useful for identifying late joiners or disconnections.
     */
    joinedAt: {
        type: Number, // Store as Unix timestamp (milliseconds since epoch)
        default: () => Date.now(),
        description: 'Timestamp marking when the player joined the session (milliseconds since epoch).'
    },

    /**
     * 🚪 Left At
     * Timestamp of when the player left or disconnected from the quiz session.
     * Remains null if the player is still active in the session.
     */
    leftAt: {
        type: Number, // Store as Unix timestamp (milliseconds since epoch)
        default: null,
        description: 'Timestamp when the player left or disconnected from the session (milliseconds since epoch).'
    },

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
     * 🕒 Created Timestamp
     * Automatically records when this player’s session record was created.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp when this player session record was created.'
    },

    // ------------------------------------------------
    // 🔹 Status Flags
    // ------------------------------------------------

    /**
     * ✅ Active Status
     * Indicates whether the player is currently participating in the session.
     * Automatically set to false when they leave or disconnect.
     */
    isActive: {
        type: Boolean,
        default: true,
        description: 'True if the player is currently active in the session.'
    },

    /**
     * ❌ Deletion Flag
     * Soft-delete indicator — allows hiding records while retaining history.
     */
    isDeleted: {
        type: Boolean,
        default: false,
        description: 'Marks this player session record as deleted (soft delete).'
    }
});

// ------------------------------------------------
// 🔹 Indexes (for optimized performance)
// ------------------------------------------------

/**
 * Ensures efficient lookups for all players in a specific session.
 */
quizSessionPlayerSchema.index({ quizGameSessionId: 1, clientId: 1 });

module.exports = mongoose.model('QuizSessionPlayer', quizSessionPlayerSchema);
