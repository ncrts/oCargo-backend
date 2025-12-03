/**
 * Client Model (ÔCargo App)
 *
 * Represents a registered or guest client in the ÔCargo application.
 * 
 * Includes authentication details, linked profile and statistics references,
 * and communication preferences. Supports Google, Apple, Email/Password, and Guest logins.
 * 
 * A Client can play multiple quizzes across multiple franchises.
 * Their XP, badges, and leaderboard data are tracked separately.
 */

const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { toJSON, toJSONFilter, paginate } = require('./plugins');
const ErrorResponse = require('../utils/errorResponse');

const clientSchema = new mongoose.Schema({
    /**
     * 🔗 Reference to Franchisor Information
     * Used to associate the client with the franchisor entity (HQ or Franchise group).
     */
    franchisorInfoId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'FranchisorInfo',
        default: null,
        description: 'Reference to franchisor general information (HQ link).'
    },

    /**
     * 🔗 Reference to Client Communication Preferences
     * Stores communication settings like email notifications, push alerts, etc.
     */
    clientCommunicationId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'ClientCommunication',
        default: null,
        description: 'Reference to client communication and notification preferences.'
    },

    /**
     * 🔗 Reference to Client Profile
     * Holds user profile details such as avatar, favorite food, and demographic info.
     */
    clientProfileId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'ClientProfile',
        default: null,
        description: 'Reference to extended client profile details (avatar, food preferences, etc.).'
    },

    /**
     * 🔗 Reference to Client Statistics
     * Tracks XP, badges, leaderboard performance, and historical quiz stats.
     */
    clientStatId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'ClientStat',
        default: null,
        description: 'Reference to the client’s game statistics, XP, and achievements.'
    },

    /**
     * 🎭 Pseudo Name (Unique Identifier)
     * Display name used in games and leaderboards.
     * Must be unique across the entire platform (case insensitive).
     */
    pseudoName: {
        type: String,
        unique: true,
        default: null,
        description: 'Unique nickname chosen by the player, displayed in the game and leaderboards.'
    },

     /**
     * 🖼️ Profile Avatar
     * URL or image path representing the client’s chosen avatar.
     * Typically selected from the official avatar list (Navy, fun, or food-themed icons).
     */
    profileAvatar: {
        type: String,
        default: null,
        description: 'Image URL or file path for the client’s avatar icon.'
    },

    /**
     * 📧 Email Address
     * Optional for guest mode but required for registered clients.
     * Must follow proper email validation format.
     */
    email: {
        type: String,
        default: null,
        validate(value) {
            if (value && !validator.isEmail(value)) {
                throw new Error('Invalid email');
            }
        },
        description: 'Client email address, used for login and communication.'
    },

    /**
     * 📧 Email Verification Code
     * Temporary code sent for verifying client’s email address.
     */
    emailVerificationCode: {
        type: String,
        default: '',
        description: 'Verification code sent to email for confirmation.'
    },

    /**
     * ✅ Email Verification Status
     * True if the client’s email has been verified.
     */
    isEmailVerified: {
        type: Boolean,
        default: false,
        description: 'Flag indicating whether email verification is complete.'
    },

    /**
     * ☎️ Phone Number Prefix
     * Country code (e.g., +33 for France, +91 for India).
     */
    phonenoPrefix: {
        type: String,
        trim: true,
        default: null,
        description: 'Phone number country prefix (e.g. +33, +91).'
    },

    /**
     * ☎️ Phone Number
     * Client’s phone number for login and 2FA.
     */
    phoneno: {
        type: String,
        trim: true,
        default: null,
        description: 'Client phone number in E.164 format.'
    },

    /**
     * ☎️ Phone Verification Code
     * Temporary code sent for phone verification.
     */
    phonenoVerificationCode: {
        type: String,
        default: '',
        description: 'Verification code sent to phone number for confirmation.'
    },

    /**
     * ✅ Phone Verification Status
     * True if the phone number has been successfully verified.
     */
    isPhonenoVerified: {
        type: Boolean,
        default: false,
        description: 'Flag indicating whether phone verification is complete.'
    },

    /**
     * 🎂 Date of Birth
     * Required in guest and registered mode.
     * Used for legal age compliance and age-based reports.
     */
    dob: {
        type: Date,
        default: null,
        description: 'Client date of birth (used for eligibility checks and personalization).'
    },

    /**
     * 🔐 Password
     * Hashed password for authentication (if registered by email).
     * Must include at least one letter and one number.
     */
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
        private: true,
        description: 'Hashed password for authentication (not stored in plain text).'
    },

    /**
     * 👤 Role
     * Defines the user role type; default is 'client'.
     */
    role: {
        type: String,
        enum: [null, 'client'],
        default: 'client',
        description: 'User role in the system (default: client).'
    },

    /**
     * ⚙️ Mode
     * Defines whether user is in guest or registered mode.
     */
    mode: {
        type: String,
        enum: ['guest', 'client'],
        default: 'client',
        description: 'Specifies if the client is playing in guest mode or as a registered user.'
    },

    /**
     * 🔑 Sign-in Method
     * Indicates which method was used to log in.
     */
    signinWith: {
        type: String,
        enum: ['guest', 'phone', 'email', 'google', 'apple'],
        default: 'guest',
        description: 'Specifies authentication method used (guest, email, phone, Google, Apple).'
    },

    /**
     * 📱 Device Type
     * Indicates the platform: iOS, Android, or Web.
     */
    deviceType: {
        type: String,
        default: '',
        description: 'Device type from which the user accessed the app.'
    },

    /**
     * 🔔 Device Push Key
     * Used for sending push notifications.
     */
    devicePushKey: {
        type: String,
        default: '',
        description: 'Push notification key/token for this client’s device.'
    },

    /**
     * 🌐 Google ID
     * Used when signing in with Google.
     */
    google_id: {
        type: String,
        default: '',
        description: 'Google OAuth ID for Google login.'
    },

    /**
     * 🍏 Apple ID
     * Used when signing in with Apple.
     */
    apple_id: {
        type: String,
        default: '',
        description: 'Apple OAuth ID for Apple login.'
    },

    /**
     * 🔐 Authentication Token (JWT)
     * Used for maintaining client’s active session.
     */
    token: {
        type: String,
        default: null,
        description: 'Active JWT token for session authentication.'
    },

    /**
     * 🕒 Created Timestamp
     * Automatically set at client creation.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Record creation date.'
    },

    /**
     * 🕒 Updated Timestamp
     * Automatically updated when client data changes.
     */
    updatedAt: {
        type: Date,
        default: Date.now,
        description: 'Record last updated date.'
    },

    /**
     * ✅ Account Active Flag
     * Used to activate or deactivate client accounts.
     */
    isActive: {
        type: Boolean,
        default: true,
        description: 'Indicates whether the client account is currently active.'
    },

    /**
     * ❌ Account Deletion Flag
     * True when account is soft-deleted or disabled.
     */
    isDeleted: {
        type: Boolean,
        default: false,
        description: 'Flag to mark soft-deleted accounts (not visible to users).'
    }
});


// Plugins
clientSchema.plugin(toJSONFilter);
clientSchema.plugin(paginate);
 
// 🔑 Method: Generate JWT for Client Authentication
clientSchema.methods.generateAuthToken = async function () {
    const client = this;
    const token = jwt.sign(
        { _id: client._id.toString() },
        process.env.JWT_FOR_CLIENT,
        { expiresIn: `${30 * 24}h` } // 30 days
    );
    client.token = token;
    await client.save();
    return token;
};

// 🔍 Static Method: Find Client by Credentials
clientSchema.statics.findByCredentials = async (email, password, role) => {
    const client = await Client.findOne({ email, isDeleted: false, role });
    if (!client) throw new ErrorResponse('Email does not exist for this role', 200);

    const isMatch = await bcrypt.compare(password, client.password);
    if (!isMatch) throw new ErrorResponse('Invalid login credentials', 200);

    return client;
};

// 🔐 Pre-save Middleware: Hash Password Before Saving
clientSchema.pre('save', async function (next) {
    const client = this;
    if (client.isModified('password')) {
        client.password = await bcrypt.hash(client.password, 8);
    }
    next();
});

const Client = mongoose.model('Client', clientSchema);
module.exports = Client;
