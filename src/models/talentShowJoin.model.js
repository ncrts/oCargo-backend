const mongoose = require('mongoose');

/**
 * TalentShowJoin Model (ÔCargo App)
 *
 * Represents a join record for a talent show session, including participants, jury, and audience.
 */

const talentShowJoinSchema = new mongoose.Schema({
  // Reference to the talent show session
  talentShowId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'TalentShowSession',
    required: true,
    description: 'Reference to the talent show session.'
  },
  // Reference to the client (user joining)
  clientId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Client',
    required: true,
    description: 'Reference to the client who joined.'
  },
  // Franchisee info (where the show is played)
  franchiseeInfoId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'FranchiseeInfo',
    required: true,
    description: 'Reference to the franchise location.'
  },
  // Join type: Participant, Jury, Audience
  joinType: {
    type: String,
    enum: ['Participant', 'Jury', 'Audience'],
    required: true,
    description: 'Type of join: Participant, Jury, or Audience.'
  },
  // Total vote average (for participants)
  totalVoteAvg: {
    type: Number,
    default: 0,
    description: 'Average vote received by the participant.'
  },
  // Total vote count (for participants)
  totalVoteCount: {
    type: Number,
    default: 0,
    description: 'Total number of votes received by the participant.'
  },
  // join by franchisee user
  joinedBy: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'FranchiseeUser',
    default: null,
    description: 'Reference to the franchisee user who facilitated the join.'
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TalentShowJoin', talentShowJoinSchema);
