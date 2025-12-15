const mongoose = require('mongoose');

/**
 * TalentShowVote Model (ÔCargo App)
 *
 * Represents a vote cast for a participant in a talent show session by a jury or audience member.
 */

const talentShowVoteSchema = new mongoose.Schema({
  // Reference to the talent show session
  talentShowId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'TalentShowSession',
    required: true,
    description: 'Reference to the talent show session.'
  },
  // Reference to the participant (client)
  participantId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Client',
    required: true,
    description: 'Reference to the participant (client) being voted for.'
  },
  // Reference to the voter (client)
  votedId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Client',
    required: true,
    description: 'Reference to the client who cast the vote.'
  },
  // Reference to the franchisee info (location)
  franchiseeInfoId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'FranchiseeInfo',
    required: true,
    description: 'Reference to the franchise location where the vote was cast.'
  },
  // Voter type: jury or audience
  voterType: {
    type: String,
    enum: ['jury', 'audience'],
    required: true,
    description: 'Type of voter: jury or audience.'
  },
  // Vote value (1-10)
  takeVote: {
    type: Number,
    min: 1,
    max: 10,
    required: true,
    description: 'Vote value (1-10) given to the participant.'
  },
  // When the vote was cast (timestamp)
  votedAt: {
    type: Number,
    required: true,
    description: 'Timestamp (ms) when the vote was cast.'
  },
  // Created timestamp
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

module.exports = mongoose.model('TalentShowVote', talentShowVoteSchema);
