const mongoose = require('mongoose');

/**
 * QuizGameSession Model (ÔCargo App)
 *
 * Represents a **live multiplayer quiz game session**, including:
 * - Game setup and lobby details
 * - Real-time player tracking (scores, answers, streaks)
 * - Game flow status
 * - Podium results and awards
 * - Post-game feedback and analytics
 *
 * Each session is tied to a specific `Quiz` and hosted by a `FranchiseeUser`
 * within a given franchise location.
 */

const quizGameSessionSchema = new mongoose.Schema({
  // ------------------------------------------------
  // 🔹 Core Session References
  // ------------------------------------------------

  /**
   * 🧩 Quiz Reference
   * The quiz being played in this live session.
   * Used to load questions, structure, and metadata.
   */
  quizId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Quiz',
    default: null,
    description: 'Reference to the quiz being played in this session.'
  },

  /**
   * 👨‍💼 Host (Franchisee User)
   * The staff member managing or launching the live quiz session.
   */
  hostId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'FranchiseeUser',
    description: 'Reference to the franchisee user who is hosting the game.'
  },

  /**
   * 🏢 Franchise Reference
   * Identifies the franchise (ÔCargo branch) where this game is being conducted.
   */
  franchiseId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'FranchiseeInfo',
    description: 'Reference to the franchise location hosting the session.'
  },

  // ------------------------------------------------
  // 🔹 Access & Join Details
  // ------------------------------------------------

  /**
   * 🔢 Game PIN
   * Unique alphanumeric code used by players to join the session.
   * Required for joining via app or on-site kiosk.
   */
  gamePin: {
    type: String,
    default: null,
    description: 'Unique join code (PIN) for accessing this quiz session.'
  },

  /**
   * 🧾 QR Code
   * Optional URL or image link to a QR code for quick access to the session.
   */
  qrCode: {
    type: String,
    default: null,
    description: 'QR code image or link for quick player access.'
  },

  // ------------------------------------------------
  // 🔹 Game State & Timing
  // ------------------------------------------------

  /**
   * 🎮 Status
   * Indicates the current phase of the game session:
   * - Scheduled: Session is planned but not yet started
   * - Lobby: Waiting for players to join
   * - InProgress: Game is live
   * - Completed: Game has ended and results are available
   */
  status: {
    type: String,
    enum: ['Scheduled', 'Lobby', 'InProgress', 'Completed', 'Cancelled'],
    default: 'Lobby',
    description: 'Defines the current lifecycle state of the game session.'
  },

  /**
   * 🕒 Start Time
   * Unix timestamp (in milliseconds) marking when the quiz session officially begins.
   */
  startTime: {
    type: Number,
    default: null,
    description: 'Unix timestamp (ms) when the quiz session officially started.'
  },

  /**
   * 🕔 End Time
   * Unix timestamp (in milliseconds) marking when the quiz session officially ends.
   */
  endTime: {
    type: Number,
    default: null,
    description: 'Unix timestamp (ms) when the quiz session officially ended.'
  },

  /**
   * ⏱️ Duration
   * Total length of the game session in seconds (computed at end).
   */
  duration: {
    type: Number,
    default: null,
    description: 'Total duration of the session in seconds (calculated when completed).'
  },

  // ------------------------------------------------
  // 🔹 Results & Achievements
  // ------------------------------------------------

  /**
   * 🏆 Podium
   * Stores the top performers of the session with their ranking positions and detailed stats.
   * Each object includes player details and an array of earned badges.
   * - playerId: ref to Client
   * - badges: array of badge objects (ref to BadgeMaster)
   */
  podium: [
    {
      joinedAt: { type: Number },
      playerId: { type: mongoose.SchemaTypes.ObjectId, ref: 'Client' },
      profileAvatar: { type: String },
      pseudoName: { type: String },
      totalPlayedGamesCount: { type: Number },
      avgResponseTime: { type: Number },
      badAnswerCount: { type: Number },
      currentStreakCount: { type: Number },
      goodAnswerCount: { type: Number },
      highestStreakCount: { type: Number },
      missedAnswerCount: { type: Number },
      totalResponseTime: { type: Number },
      totalScore: { type: Number },
      badges: [
        {
          id: { type: mongoose.SchemaTypes.ObjectId, ref: 'BadgeMaster' },
          name: {
            en_us: { type: String },
            fr_fr: { type: String }
          },
          iconUrl: { type: String }
        }
      ]
    }
  ],


  /**
   * 🏅 Special Awards (Dynamic)
   * Stores detailed award information for each award type as dynamic keys.
   * Each key is an award type (e.g., fastestPlayer, highestStreak, etc.),
   * and the value is an array of player objects with all relevant stats.
   * Each player object includes:
   *   - joinedAt: Number (timestamp)
   *   - playerId: ObjectId (ref: 'Client')
   *   - profileAvatar: String
   *   - pseudoName: String
   *   - totalPlayedGamesCount: Number
   *   - avgResponseTime: Number
   *   - badAnswerCount: Number
   *   - currentStreakCount: Number
   *   - goodAnswerCount: Number
   *   - highestStreakCount: Number
   *   - missedAnswerCount: Number
   *   - score: Number
   *   - totalResponseTime: Number
   *   - totalScore: Number
   * Example:
   * {
   *   fastestPlayer: [ {...player details...} ],
   *   highestStreak: [ {...player details...} ],
   *   ...
   * }
   */
  /**
   * 🏅 Special Awards (Map of Arrays)
   * Stores detailed award information for each award type as a Map.
   * Each key is an award type (e.g., fastestPlayer, highestStreak, etc.),
   * and the value is an array of player objects with all relevant stats.
   * Each player object includes:
   *   - joinedAt: Number (timestamp)
   *   - playerId: ObjectId (ref: 'Client')
   *   - profileAvatar: String
   *   - pseudoName: String
   *   - totalPlayedGamesCount: Number
   *   - avgResponseTime: Number
   *   - badAnswerCount: Number
   *   - currentStreakCount: Number
   *   - goodAnswerCount: Number
   *   - highestStreakCount: Number
   *   - missedAnswerCount: Number
   *   - score: Number
   *   - totalResponseTime: Number
   *   - totalScore: Number
   */
  /**
   * 🏅 Special Awards (Array of Objects)
   * Each object has an 'awards' key (award type name), and other keys for player details.
   * Example:
   * [
   *   {
   *     awards: 'fastestPlayer',
   *     joinedAt: Number,
   *     playerId: ObjectId (ref: 'Client'),
   *     profileAvatar: String,
   *     pseudoName: String,
   *     totalPlayedGamesCount: Number,
   *     avgResponseTime: Number,
   *     badAnswerCount: Number,
   *     currentStreakCount: Number,
   *     goodAnswerCount: Number,
   *     highestStreakCount: Number,
   *     missedAnswerCount: Number,
   *     score: Number,
   *     totalResponseTime: Number,
   *     totalScore: Number
   *   },
   *   ...
   * ]
   */
  specialAwards: [
    {
      awards: { type: String, default: null },
      joinedAt: { type: Number },
      playerId: { type: mongoose.SchemaTypes.ObjectId, ref: 'Client' },
      profileAvatar: { type: String },
      pseudoName: { type: String },
      totalPlayedGamesCount: { type: Number },
      avgResponseTime: { type: Number },
      badAnswerCount: { type: Number },
      currentStreakCount: { type: Number },
      goodAnswerCount: { type: Number },
      highestStreakCount: { type: Number },
      missedAnswerCount: { type: Number },
      score: { type: Number },
      totalResponseTime: { type: Number },
      totalScore: { type: Number }
    }
  ],

  // ------------------------------------------------
  // 🔹 Feedback Collection
  // ------------------------------------------------


  // ------------------------------------------------
  // 🔹 Metadata
  // ------------------------------------------------

  /**
   * 🕒 Created Timestamp
   * Automatically records when the session was created (lobby opened).
   */
  createdAt: {
    type: Date,
    default: Date.now,
    description: 'Timestamp when this game session was created.'
  },

  /**
   * 🕒 Updated Timestamp
   * Automatically refreshed on every game state or score update.
   */
  updatedAt: {
    type: Date,
    default: Date.now,
    description: 'Timestamp when the game session was last modified.'
  },

  /**
   * Session Settings and Host Controls
   */
  settings: {
    showQuestionsOnClient: {
      type: Boolean,
      default: true
    },
    showLeaderboardPerQuestion: {
      type: Boolean,
      default: true
    },
    allowRejoin: {
      type: Boolean,
      default: true
    },
    isPaused: {
      type: Boolean,
      default: false
    },
    hostControls: {
      canReplayMedia: {
        type: Boolean,
        default: true
      },
      canRestartQuestion: {
        type: Boolean,
        default: true
      }
    },
    clientIds: [{
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Client',
      default: []
    }]
  }
  ,
  /**
   * Total Player Count
   * Number of players who have joined this quiz session.
   */
  totalPlayerCount: {
    type: Number,
    default: 0,
    description: 'Total number of players who have joined this quiz session.'
  },

  /**
   * Total Number of Questions
   * Number of questions to play in this quiz session.
   */
  totalNumberOfQuestions: {
    type: Number,
    default: 0,
    description: 'Total number of questions to play in this quiz session.'
  }


});

module.exports = mongoose.model('QuizGameSession', quizGameSessionSchema);
