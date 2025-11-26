const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const foodSchema = mongoose.Schema(
  {
    name: {
      en_us: { type: String },
      fr_fr: { type: String }
    },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

foodSchema.plugin(toJSON);
foodSchema.plugin(paginate);

const Food = mongoose.model('Food', foodSchema);

module.exports = Food;
