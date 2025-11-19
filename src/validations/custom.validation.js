// const { notificationSettings, twoFASettings } = require('../config/constants');

const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message('"{{#label}}" must be a valid mongo id');
  }
  return value;
};

const password = (value, helpers) => {
  if (value.length < 8) {
    return helpers.message('password must be at least 8 characters');
  }
  if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
    return helpers.message('password must contain at least 1 letter and 1 number');
  }
  return value;
};

const arrayLength = (value, helpers) => {
  const key = helpers.state.path;
  let length;

  switch (key[1]) {
    case 'return1y':
      length = 12;
      break;
    case 'return1m':
      length = 4;
      break;
    case 'return1w':
      length = 7;
      break;
    default:
      length = 0;
  }

  if (length && value.length !== length) {
    return helpers.message(`{{#label}} array must be of length ${length}`);
  }

  return value;
};

const isDatePassed = (value, helpers) => {
  const timeNow = new Date().getTime();
  const timeGiven = new Date(value).getTime();
  if (timeNow > timeGiven) {
    return helpers.message(`{{#label}} given date is aleardy passed`);
  }

  return value;
}

// const notification = (value, helpers) => {
//   const validValues = Object.values(notificationSettings);

//   if (validValues.includes(value)) {
//     return value;
//   }

//   return helpers.message(`{{#label}} given values are not valid`);
// }

// const twoFA = (value, helpers) => {
//   const validValues = Object.values(twoFASettings);

//   if (validValues.includes(value)) {
//     return value;
//   }

//   return helpers.message(`{{#label}} given values are not valid`);
// }

module.exports = {
  objectId,
  password,
  arrayLength,
  isDatePassed
};
