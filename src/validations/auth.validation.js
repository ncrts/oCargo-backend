const Joi = require('joi');
const { password } = require('./custom.validation');

const register = {
  body: Joi.object({
    email: Joi.string().required().email(),
    firstname: Joi.string().optional().allow(""),
    lastname: Joi.string().optional().allow(""),
    phonenoPrefix: Joi.string().required(),
    phoneno: Joi.string().required(),
    signupWith: Joi.string().required(),
    password: Joi.string(),
    isVerified: Joi.number(),
    deviceType: Joi.string(),
    devicePushKey:  Joi.string(),
    socialId: Joi.string()
  }),
};

const sendVerificationOtp = {
  body: Joi.object().keys({
    action: Joi.string(),
    email: Joi.string().required().email(),
  }),
}

const verifyOtp = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    otp: Joi.string().required(),
  }),
}

const login = {
  body: Joi.object().keys({
    email: Joi.string().required(),
    password: Joi.string().required(),
    role: Joi.string().required(),
    deviceType: Joi.string().optional().allow(""),
    devicePushKey: Joi.string().optional().allow(""),
  }),
};

const resetPassword = {
  body: Joi.object().keys({
    old_password: Joi.string().required(),
    password: Joi.string().required().custom(password),
  }),
};


const forgotPassword = {
  body: Joi.object().keys({
    email: Joi.string().email().required()
  }),
};

const verifyEmail = {
  query: Joi.object().keys({
    token: Joi.string().required(),
  }),
};

module.exports = {
  register,
  login,
  sendVerificationOtp,
  verifyOtp,
  resetPassword,
  forgotPassword,
  verifyEmail,
};
