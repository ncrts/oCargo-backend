const mongoose = require('mongoose');

/**
 * TalentShowJoin Model (ÔCargo App)
 *
 * Represents a join record for a talent show session, including participants, jury, and audience.
 */


const roundDataSchema = new mongoose.Schema({
  round: { type: Number, default: 1 },
  totalJuryCount: { type: Number, default: 0 },
  totalJuryVotePoint: { type: Number, default: 0 },
  totalAvgOfVoteJury: { type: Number, default: 0 },
  totalAudience: { type: Number, default: 0 },
  totalAudienceVotePoint: { type: Number, default: 0 },
  totalAvgVoteOfAudience: { type: Number, default: 0 },
  totalVoterCount: { type: Number, default: 0 },
  totalAvgVote: { type: Number, default: 0 },
  isQualified: { type: Boolean, default: false }
}, { _id: false });

const talentShowJoinSchema = new mongoose.Schema({
  // Reference to the talent show session
  talentShowId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'TalentShowSession',
    required: true,
    description: 'Reference to the talent show session.'
  },

  // Franchisee info (where the show is played)
  franchiseeInfoId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'FranchiseeInfo',
    required: true,
    description: 'Reference to the franchise location.'
  },

  // Reference to the client (user joining)
  clientId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Client',
    required: true,
    description: 'Reference to the client who joined.'
  },


  // Join type: Participant, Jury, Audience
  joinType: {
    type: String,
    enum: ['Participant', 'Jury', 'Audience'],
    required: true,
    description: 'Type of join: Participant, Jury, or Audience.'
  },

  // Sequence for Participant (order of performance), default null
  sequence: {
    type: Number,
    default: null,
    description: 'Performance sequence/order for Participant. Null if not set.'
  },

  // Current round for this join (1 or 2)
  currentRound: {
    type: Number,
    default: 1,
    description: 'Current round number for this join.'
  },

  // Per-round voting and qualification data
  roundData: {
    type: [roundDataSchema],
    default: [],
    description: 'Array of round-specific voting and qualification data.'
  },

  // Is connected currently (for jury)
  isConnectedJury: {
    type: Boolean,
    default: false,
    description: 'Indicates if the user is currently connected to the talent show session.'
  },
  
  // join by franchisee user
  joinedBy: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'FranchiseeUser',
    default: null,
    description: 'Reference to the franchisee user who facilitated the join.'
  },

  // Has performed (for participants)
  isPerformed: {
    type: Boolean,
    default: false,
    description: 'Indicates if the participant has performed.'
  },

  // Timestamp when joined
  joinedAt: {
    type: Number,
    required: true,
    description: 'Timestamp (ms) when the client joined the talent show session.'
  },

  // Is removed from session (soft flag)
  isRemoved: {
    type: Boolean,
    default: false,
    description: 'Indicates if the join record is removed from the session.'
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },

  // Updated timestamp
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Soft delete flag
  isDeleted: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('TalentShowJoin', talentShowJoinSchema);
