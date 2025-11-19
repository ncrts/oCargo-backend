import mongoose from "mongoose";

const badgeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    description: "Badge name, e.g. 'Fast Starter', 'Quiz Master', 'Captain Level'."
  },

  description: {
    type: String,
    required: true,
    description: "What this badge represents or how it was earned."
  },

  type: {
    type: String,
    enum: ["local", "national"],
    default: "local",
    description: "Badge context — local events, national tournaments, or special events."
  },

  iconUrl: {
    type: String,
    description: "Image or icon representing this badge."
  },

  xpRequired: {
    type: Number,
    default: 0,
    description: "Minimum XP required to earn this badge."
  },

  rewardXP: {
    type: Number,
    default: 0,
    description: "Bonus XP awarded for unlocking this badge."
  },

  isActive: {
    type: Boolean,
    default: true,
    description: "Whether this badge is currently achievable."
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Badge", badgeSchema);
