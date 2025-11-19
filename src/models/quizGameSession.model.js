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
   * - Lobby: Waiting for players to join
   * - InProgress: Game is live
   * - Completed: Game has ended and results are available
   */
  status: { 
    type: String, 
    enum: ['Lobby', 'InProgress', 'Completed'], 
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
   * Stores the top performers of the session with their ranking positions.
   * Typically used for post-game display and XP updates.
   */
  podium: [{
    clientId: { 
      type: mongoose.SchemaTypes.ObjectId, 
      ref: 'Client',
      description: 'Reference to the player who achieved a podium position.'
    },
    position: { 
      type: Number,
      description: 'Numeric position on the podium (1 = 1st, 2 = 2nd, etc.).'
    }
  }],

  /**
   * 🎖️ Awards
   * Special recognitions or titles granted during or after the session.
   * Examples: “Fastest Answer”, “Highest Streak”, “Participation Award”
   */
  awards: [{
    type: { 
      type: String,
      description: 'Type of award (e.g., Fastest, HighestStreak, Accuracy, Participation).'
    },
    clientId: { 
      type: mongoose.SchemaTypes.ObjectId, 
      ref: 'Client',
      description: 'Reference to the player who received this award.'
    }
  }],

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
});

module.exports = mongoose.model('QuizGameSession', quizGameSessionSchema);
