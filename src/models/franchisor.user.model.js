const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { toJSON, toJSONFilter, paginate } = require('./plugins');
const ErrorResponse = require('../utils/errorResponse');

/**
 * FranchisorUser Model (ÔCargo App)
 *
 * Represents users who belong to the franchisor (HQ) organization.
 *
 * These users include:
 * - **Admin:** Superuser with complete control over all franchises, users, and national quizzes.
 * - **HQ Staff:** Users with delegated roles (content moderation, analytics, or national event management).
 *
 * Each franchisor user can create and manage franchisee users and monitor activities across all branches.
 */

const franchisorUserSchema = new mongoose.Schema({
    /**
     * 🏢 Franchisor Info Reference
     * Links this user account to the franchisor organization (HQ).
     */
    franchisorInfoId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'FranchisorInfo',
        default: null,
        description: 'Reference to the franchisor (HQ) this user belongs to.'
    },

    /**
     * 🧍 First Name
     * User’s given name.
     */
    firstName: {
        type: String,
        default: null,
        description: 'First name of the franchisor user.'
    },

    /**
     * 🧍 Last Name
     * User’s family name or surname.
     */
    lastName: {
        type: String,
        default: null,
        description: 'Last name or surname of the franchisor user.'
    },

    /**
     * 📧 Email Address
     * Used for login, communication, and identity verification.
     */
    email: {
        type: String,
        default: null,
        validate(value) {
            if (value && !validator.isEmail(value)) {
                throw new Error('Invalid email');
            }
        },
        description: 'Official email used for authentication and system access.'
    },

    /**
     * 📩 Email Verification Code
     * Temporary code used to verify the user’s email during account setup or recovery.
     */
    emailVerificationCode: {
        type: String,
        default: '',
        description: 'Email verification code for confirming the user’s email address.'
    },

    /**
     * ✅ Email Verification Status
     * Indicates whether the email has been successfully verified.
     */
    isEmailVerified: {
        type: Boolean,
        default: false,
        description: 'True if the franchisor user’s email has been verified.'
    },

    /**
     * ☎️ Phone Number Prefix
     * Country code used for phone-based verification and communication.
     */
    phonenoPrefix: {
        type: String,
        trim: true,
        default: null,
        description: 'Phone number country code prefix (e.g., +33 for France).'
    },

    /**
     * ☎️ Phone Number
     * Contact phone number for the franchisor user.
     */
    phoneno: {
        type: String,
        trim: true,
        default: null,
        description: 'User’s phone number in E.164 format.'
    },

    /**
     * 🔢 Phone Verification Code
     * Used for SMS-based verification and 2FA.
     */
    phonenoVerificationCode: {
        type: String,
        default: '',
        description: 'Verification code sent via SMS for confirming the phone number.'
    },

    /**
     * ✅ Phone Verification Status
     * Indicates if the phone number has been confirmed.
     */
    isPhonenoVerified: {
        type: Boolean,
        default: false,
        description: 'True if the franchisor user’s phone number has been verified.'
    },

    /**
     * 🔐 Password
     * Encrypted (hashed) password for secure authentication.
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
        description: 'Hashed password for secure login authentication.'
    },

    /**
     * 🧑‍💼 Role
     * Defines the user’s role within the franchisor organization.
     * - **admin:** Full access and control.
     * - **HqStaff:** Limited administrative privileges under HQ supervision.
     */
    role: {
        type: String,
        enum: [null, 'admin', 'HqStaff'],
        default: null,
        description: 'Role defining access permissions (admin or HQ staff).'
    },

    /**
     * 📱 Device Type
     * Specifies the platform the user last logged in from (e.g., Web, iOS, Android).
     */
    deviceType: {
        type: String,
        default: '',
        description: 'Type of device used by the user (e.g., Web, iOS, Android).'
    },

    /**
     * 🔔 Device Push Key
     * Used for sending push notifications to the device (for alerts, reports, etc.).
     */
    devicePushKey: {
        type: String,
        default: '',
        description: 'Push notification token for the franchisor user’s device.'
    },

    /**
     * 🔑 JWT Token
     * Stores the current authentication token for session management.
     */
    token: {
        type: String,
        default: null,
        description: 'JWT authentication token for active sessions.'
    },

    /**
         * 🆔 Creator ID
         * The ID of the franchisor user who created this account.
         */
    creatorId: {
        type: mongoose.SchemaTypes.ObjectId,
        refPath: 'creatorObj.creatorRole',
        default: null,
        description: 'Reference to the user (admin) who created this franchisor user account.'
    },

    /**
     * 🕒 Created Timestamp
     * Records when the franchisor user account was first created.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp of when this franchisor user account was created.'
    },

    /**
     * 🕒 Updated Timestamp
     * Updated whenever profile or credentials are modified.
     */
    updatedAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp of the most recent update to this account.'
    },

    /**
     * ✅ Active Status
     * Indicates whether the user account is currently active.
     * Used to control login access without deleting the record.
     */
    isActive: {
        type: Boolean,
        default: true,
        description: 'True if the franchisor user account is active and allowed to log in.'
    },

    /**
     * ❌ Deletion Flag
     * Used for soft deletion — the account remains stored but inactive.
     * Useful for audits and GDPR compliance.
     */
    isDeleted: {
        type: Boolean,
        default: false,
        description: 'Marks the franchisor user account as soft-deleted.'
    }
});

// 🔌 Plugins
franchisorUserSchema.plugin(toJSONFilter);
franchisorUserSchema.plugin(paginate);

/**
 * 🔐 Method: Generate JWT Authentication Token
 * Creates a new signed token (valid for 30 days) for user authentication.
 */
franchisorUserSchema.methods.generateAuthToken = async function () {
    const franchisorUser = this;
    const token = jwt.sign(
        { _id: franchisorUser._id.toString() },
        process.env.JWT_FOR_FRANCHISOR_USER,
        { expiresIn: `${30 * 24}h` } // 30 days
    );
    franchisorUser.token = token;
    await franchisorUser.save();
    return token;
};

/**
 * 🔍 Static Method: Find by Credentials
 * Authenticates a franchisor user using email, password, and role.
 * Returns the user if credentials are valid; otherwise throws an error.
 */
franchisorUserSchema.statics.findByCredentials = async (email, password, role) => {
    const findCond = { email, isDeleted: false, role };
    const franchisorUser = await FranchisorUser.findOne(findCond);

    if (!franchisorUser) {
        throw new ErrorResponse('Email does not exist for this user role', 200);
    }

    const isMatch = await bcrypt.compare(password, franchisorUser.password);
    if (!isMatch) {
        throw new ErrorResponse('Invalid login credentials', 200);
    }

    return franchisorUser;
};

/**
 * 🔒 Middleware: Hash Password Before Saving
 * Automatically hashes password before saving it to the database.
 */
franchisorUserSchema.pre('save', async function (next) {
    const franchisorUser = this;
    if (franchisorUser.isModified('password')) {
        franchisorUser.password = await bcrypt.hash(franchisorUser.password, 8);
    }
    next();
});

const FranchisorUser = mongoose.model('FranchisorUser', franchisorUserSchema);
module.exports = FranchisorUser;
