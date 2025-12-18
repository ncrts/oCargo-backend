const mongoose = require('mongoose');

/**
 * TalentShowSession Model (ÔCargo App)
 *
 * Represents a live talent show session hosted by a franchisee.
 * Includes player, jury, and audience participation, voting, and podium results.
 */

const podiumSchema = new mongoose.Schema({
  joinedAt: { type: Number }, // timestamp
  playerId: { type: mongoose.SchemaTypes.ObjectId, ref: 'Client' },
  profileAvatar: { type: String },
  pseudoName: { type: String },
  totalVotingPoint: { type: Number, default: 0 },
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
}, { _id: false });

const talentShowSessionSchema = new mongoose.Schema({
  // Name of the talent show session
  name: {
    type: String,
    required: true,
    description: 'Name/title of the talent show session.'
  },
  // Description of the talent show session
  description: {
    type: String,
    default: '',
    description: 'Description/details about the talent show session.'
  },
  // Franchise reference (ÔCargo branch)
  franchiseInfoId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'FranchiseeInfo',
    required: true,
    description: 'Reference to the franchise location hosting the talent show.'
  },
  // Created by (franchisee user)
  createdBy: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'FranchiseeUser',
    required: true,
    description: 'Reference to the franchisee user who created the talent show.'
  },
  // Status // Schedule, 'Lobby', Live, 'Result awaited', "Completed", "Cancelled"
  status: {
    type: String,
    enum: ['Schedule', 'Lobby', 'Start', 'Stop', 'Completed', 'Cancelled'],
    default: 'Schedule',
    description: 'Current status of the talent show session.'
  },
  // Total number of show rounds in this session
  totalSessionShowRound: {
    type: Number,
    default: 2,
    description: 'Total number of show rounds in this session.'
  },
  // Current round number
  currentRound: {
    type: Number,
    default: 1,
    description: 'Current round number in the session.'
  },
  // Start date and time (timestamp in ms)
  startTime: {
    type: Number,
    default: null,
    description: 'Timestamp (ms) when the talent show starts.'
  },
  // End date and time (timestamp in ms)
  endTime: {
    type: Number,
    default: null,
    description: 'Timestamp (ms) when the talent show ends.'
  },
  // Duration (seconds, calculated at completion)
  duration: {
    type: Number,
    default: null,
    description: 'Total duration of the talent show in seconds.'
  },
  // Podium (top performers)
  podium: [podiumSchema],
  // Total player count (participants)
  totalPlayerCount: {
    type: Number,
    default: 0,
    description: 'Total number of players (participants) in the talent show.'
  },
  // Total jury members count
  totalJuryCount: {
    type: Number,
    default: 0,
    description: 'Total number of jury members in the talent show.'
  },

  // Total jury members to connect the talent show session count
  totalJuryConnectCount: {
    type: Number,
    default: 0,
    description: 'Total number of jury members in the talent show.'
  },

  // Total audience count
  totalAudienceCount: {
    type: Number,
    default: 0,
    description: 'Total number of audience members in the talent show.'
  },
  // Audience join PIN
  audienceGamePin: {
    type: String,
    default: null,
    description: 'Unique join code (PIN) for audience to join.'
  },
  // Audience QR code
  audienceQrCode: {
    type: String,
    default: null,
    description: 'QR code image or link for audience quick access.'
  },
  // Jury join PIN
  juryJoinGamePin: {
    type: String,
    default: null,
    description: 'Unique join code (PIN) for jury members to join.'
  },
  // Jury QR code
  juryJoinQrCode: {
    type: String,
    default: null,
    description: 'QR code image or link for jury quick access.'
  },

  // Created/updated timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    description: 'Timestamp when this talent show session was created.'
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    description: 'Timestamp when the talent show session was last modified.'
  }
});

talentShowSessionSchema.pre('save', function (next) {
  if (this.endTime && this.startTime && !this.duration) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

talentShowSessionSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.endTime && update.startTime && !update.duration) {
    update.duration = Math.floor((update.endTime - update.startTime) / 1000);
  }
  next();
});

module.exports = mongoose.model('TalentShowSession', talentShowSessionSchema);
