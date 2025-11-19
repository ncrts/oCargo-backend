const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { toJSON, toJSONFilter, paginate } = require('./plugins');
const ErrorResponse = require('../utils/errorResponse');

const userSchema = new mongoose.Schema({
    country: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Countries',
        default: null
    },
    assignedDesigner: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Designer'
    }],
    firstname: {
        type: String,
        trim: true,
        maxlength: 100,
        default: null
    },
    lastname: {
        type: String,
        trim: true,
        maxlength: 50,
        default: null
    },
    username: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate(value) {
            if (!validator.isEmail(value)) {
                throw new Error('Invalid email');
            }
        },
    },
    password: {
        type: String,
        required: true,
        trim: true,
        minlength: 8,
        maxlength: 100,
        validate(value) {
            if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
                throw new Error('Password must contain at least one letter and one number');
            }
        },
        private: true, // used by the toJSON plugin
    },
    phonenoPrefix: {
        type: String,
        trim: true,
        required: true,
    },
    phoneno: {
        type: String,
        trim: true,
        required: true,
    },
    profilePictureType: {
        type: String,
        enum: ["", 'avatar', 'custom'],
        default: ""
    },
    profilePicture: {
        type: String,
        default: null,
    },
    dob: {
        type: Date,
        default: null
    },
    gender: {
        type: String,
        enum: ['', 'Male', 'Female', 'Other'],
        default: 'Male'
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    signupWith: {
        type: String,
        enum: ['local', 'facebook', 'google', 'apple'],
        default: 'local'
    },
    resetPasswordOtp: {
        type: String,
        default: ''
    },
    verificationCode: {
        type: String,
        default: '',
    },
    isVerified: {
        type: Number,
        enum: [0, 1], // initiated = 0, verified = 1, complete verified = 2
        default: 0,
    },
    token: {
        type: String,
        default: ''
    },
    deviceType: {
        type: String,
        default: ''
    },
    devicePushKey: {
        type: String,
        default: ''
    },
    isMember: {
        type: Boolean,
        default: false
    },
    memberType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Membership',
        default: null
    },
    memberCreatedAt: {
        type: Date,
        default: null
    },
    facebook_id: {
        type: String,
        default: ''
    },
    google_id: {
        type: String,
        default: ''
    },
    apple_id: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    isUserActive: {
        type: Boolean,
        default: true
    },
    isUserDeleted: {
        type: Boolean,
        default: false
    },

});

// add plugin that converts mongoose to json
userSchema.plugin(toJSONFilter);
userSchema.plugin(paginate);

userSchema.methods.generateAuthToken = async function () {
    const user = this;
    const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: `${30 * 24}h` });
    user.token = token;
    await user.save();
    return token;
};

userSchema.statics.findByCredentials = async (email, password, role) => {
    let userRoleArray = [role];
    let findCond = { email, isUserDeleted: false, role: { $in: userRoleArray } };
    const user = await User.findOne(findCond)
    if (!user) {
        throw new ErrorResponse('Email does not exist for this user role', 200)
    }
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
        throw new ErrorResponse('Invalid login credentials', 200)
    }
    return user
}

userSchema.statics.checkOldPassword = async (userId, oldPassword) => {
    const user = await User.findOne({ _id: userId });
    if (!user) {
        throw new ErrorResponse('User does not exist', 200);
    }
    const isMatchpass = await bcrypt.compare(oldPassword, user.password);
    if (!isMatchpass) {
        throw new ErrorResponse('Invalid Old Password', 200);
    }
    return user;
};

userSchema.pre('save', async function (next) {
    const user = this
    if (user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 8)
    }
    next()
})

const User = mongoose.model('User', userSchema);
module.exports = User;
