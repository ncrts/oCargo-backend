/* eslint-disable eqeqeq */
const fs = require('fs');
const randomstring = require('randomstring');
const base64 = require('base-64');

const unlinkFile = async (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const is18Plus = async (dob) => {
    const birthDate = new Date(dob);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    // Adjust age if birthday hasn't occurred yet this year
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
    }

    return age >= 18;
}


module.exports = {
  unlinkFile,
  is18Plus
  
};
