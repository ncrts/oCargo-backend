// utils/perQuestionPoint.js
const fs = require('fs');
const path = require('path');

/**
 * Loads per question point values from config/perQuestionPoint.json
 * Returns an object: { Easy: number, Medium: number, Hard: number, VeryHard: number }
 */
function getPerQuestionPointConfig() {
  const configPath = path.resolve(__dirname, '../config/perQuestionPoint.json');
  try {
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    // Fallback to defaults if file not found or invalid
    return {
      Easy: 10,
      Medium: 20,
      Hard: 30,
      VeryHard: 50
    };
  }
}

module.exports = {
  getPerQuestionPointConfig
};
