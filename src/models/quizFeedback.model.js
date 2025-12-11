const mongoose = require('mongoose');

/**
 * QuizFeedback Model (ÔCargo App)
 *
 * Stores player-submitted feedback and ratings for a quiz session.
 *
 * This model enables:
 * - Collection of quiz ratings (1–5 stars)
 * - Optional text feedback from players
 * - Moderation and audit tracking
 * - Aggregation of average ratings into the Quiz model
 *
 * Each record represents **one feedback entry per player per game instance**.
 */

const FeedbackStatusEnum = ['pending', 'reviewed', 'accepted', 'hidden'];

const quizFeedbackSchema = new mongoose.Schema({
    // ------------------------------------------------
    // 🔹 Reference Fields (Relationships)
    // ------------------------------------------------

    /**
     * 🧩 Quiz Reference
     * Links this feedback entry to the specific quiz that was rated.
     * Enables backward aggregation of average ratings into the Quiz model.
     */
    quizId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        default: null,
        description: 'Reference to the quiz being rated.'
    },

    /**
     * 🎮 Game Instance Reference
     * Identifies the unique quiz game session in which the player participated.
     * Used to ensure only one feedback submission per player per session.
     */
    quizGameSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QuizGameSession',
        default: null,
        description: 'Reference to the specific quiz game session played.'
    },

    /**
     * 👤 Player Reference
     * The player (user) who submitted the feedback.
     * Can be a guest or registered player.
     */
    playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        default: null,
        description: 'Reference to the player (client) submitting feedback.'
    },

    /**
     * 🏢 Franchise Reference
     * Indicates the franchise (ÔCargo branch) where this game was played.
     * Useful for local analytics and filtering of feedback by branch.
     */
    franchiseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FranchiseeInfo',
        default: null,
        description: 'Reference to the FranchiseeInfo where the quiz session occurred.'
    },

    // ------------------------------------------------
    // 🔹 Feedback Data
    // ------------------------------------------------

    /**
     * ⭐ Rating
     * Numeric rating value submitted by the player (1 to 5 stars).
     * Aggregated into the `Quiz.clientRating` statistics.
     */
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
        description: 'Star rating given by the player (1–5).'
    },

    /**
     * 💬 Feedback Text
     * Optional open-ended comment from the player.
     * Provides qualitative feedback to HQ or local managers.
     */
    feedbackText: {
        type: String,
        maxlength: 1000,
        trim: true,
        description: 'Free-text feedback message from the player (max 1000 chars).'
    },

    // ------------------------------------------------
    // 🔹 Moderation Fields
    // ------------------------------------------------
    // (Temporarily commented out but ready for integration when moderation system goes live)

    /**
     * 🧾 Feedback Status
     * Defines the moderation status of the feedback.
     * Possible values:
     * - pending: Awaiting review
     * - reviewed: Approved and visible
     * - flagged: Marked for inappropriate content
     * - hidden: Hidden from public display
     */
    status: { 
        type: String, 
        enum: FeedbackStatusEnum, 
        default: 'accepted',
        description: 'Moderation status for this feedback entry.'
    },

    /**
     * 👮 Moderated By
     * Reference to the HQ or franchise moderator who reviewed this feedback.
     */
    moderatedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'FranchisorUser',
        description: 'Reference to the Franchisor User (HQ staff) who moderated the feedback.'
    },

    /**
     * 🕵️ Moderated At
     * Timestamp when moderation action was taken.
     */
    moderatedAt: { 
        type: Date, 
        description: 'Timestamp when the feedback was moderated.'
    },

    // ------------------------------------------------
    // 🔹 Audit & Timestamps
    // ------------------------------------------------

    /**
     * 🕒 Submitted At
     * The exact timestamp when the player submitted the feedback.
     */
    submittedAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp when the player submitted feedback.'
    },

    /**
     * 🕒 Created Timestamp
     * Automatically set when the feedback record is created.
     */
    createdAt: { 
        type: Date, 
        default: Date.now,
        description: 'Timestamp when the feedback document was created.'
    },

    /**
     * 🕒 Updated Timestamp
     * Automatically updated whenever the feedback record is modified.
     */
    updatedAt: { 
        type: Date, 
        default: Date.now,
        description: 'Timestamp of the last update to this feedback document.'
    }
});

// ------------------------------------------------
// 🔹 Indexes (Performance Optimization)
// ------------------------------------------------

/**
 * Index for quick lookup of ratings by quiz for analytics and averages.
 */
quizFeedbackSchema.index({ quizId: 1, rating: 1 });

/**
 * Enforces one feedback per player per quiz session.
 * Prevents multiple ratings for the same game instance by the same user.
 */
quizFeedbackSchema.index({ playerId: 1, quizGameSessionId: 1 }, { unique: true });

// ------------------------------------------------
// 🔹 Static Methods
// ------------------------------------------------

/**
 * 📊 Static Method: updateQuizRatingStats
 *
 * Recalculates the average, min, max, and total count of ratings for a quiz
 * based on all submitted feedback entries.
 *
 * Automatically updates the related `Quiz.clientRating` fields:
 *  - avg
 *  - min
 *  - max
 *  - count
 *
 * Called after new feedback is created, updated, or deleted.
 */
quizFeedbackSchema.statics.updateQuizRatingStats = async function (quizId) {
    const result = await this.aggregate([
        { $match: { quizId: new mongoose.Types.ObjectId(quizId) } },
        {
            $group: {
                _id: '$quizId',
                avgRating: { $avg: '$rating' },
                minRating: { $min: '$rating' },
                maxRating: { $max: '$rating' },
                count: { $sum: 1 }
            }
        }
    ]);

    if (result.length > 0) {
        const { avgRating, minRating, maxRating, count } = result[0];
        const Quiz = mongoose.model('Quiz');
        await Quiz.findByIdAndUpdate(quizId, {
            'clientRating.avg': avgRating ? Number(avgRating.toFixed(2)) : null,
            'clientRating.min': minRating,
            'clientRating.max': maxRating,
            'clientRating.count': count
        });
    }
};

module.exports = mongoose.model('QuizFeedback', quizFeedbackSchema);
