const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { toJSON, toJSONFilter, paginate } = require('./plugins');
const ErrorResponse = require('../utils/errorResponse');

/**
 * FranchiseeUser Model (ÔCargo App)
 *
 * Represents a user (Manager or Staff) working for a Franchisee location.
 *
 * This model manages all user accounts at the franchise level — including managers and staff
 * who can create, host, or moderate quizzes locally.
 *
 * It supports secure authentication, email/phone verification, and role-based permissions.
 */

const franchiseeUserSchema = new mongoose.Schema({
    /**
     * 🏪 Franchisee Reference
     * Links this user account to a specific OCargo franchise location.
     */
    franchiseeInfoId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'FranchiseeInfo',
        default: null,
        description: 'Reference to the franchise (OCargo branch) this user belongs to.'
    },

    /**
     * 🧍 First Name
     * The user’s given name, used for display and identification.
     */
    firstName: {
        type: String,
        default: null,
        description: 'First name of the franchisee user.'
    },

    /**
     * 🧍 Last Name
     * The user’s family name or surname.
     */
    lastName: {
        type: String,
        default: null,
        description: 'Last name of the franchisee user.'
    },

    /**
     * 📧 Email
     * The user’s email address, used for login and communication.
     * Must pass validation if provided.
     */
    email: {
        type: String,
        default: null,
        validate(value) {
            if (value && !validator.isEmail(value)) {
                throw new Error('Invalid email');
            }
        },
        description: 'Email address of the user. Used for authentication and notifications.'
    },

    /**
     * 📩 Email Verification Code
     * Code sent to verify ownership of the email address.
     */
    emailVerificationCode: {
        type: String,
        default: '',
        description: 'Verification code sent to user’s email address for confirmation.'
    },

    /**
     * ✅ Email Verification Status
     * Indicates whether the user’s email has been verified successfully.
     */
    isEmailVerified: {
        type: Boolean,
        default: false,
        description: 'True if the user’s email has been verified.'
    },

    /**
     * ☎️ Phone Prefix
     * Country code (e.g., +33, +91) for the user’s mobile number.
     */
    phonenoPrefix: {
        type: String,
        trim: true,
        default: null,
        description: 'Phone number country code prefix (e.g. +33 for France).'
    },

    /**
     * ☎️ Phone Number
     * User’s phone number used for 2FA and internal communication.
     */
    phoneno: {
        type: String,
        trim: true,
        default: null,
        description: 'User’s phone number in E.164 format.'
    },

    /**
     * 🔢 Phone Verification Code
     * Code sent via SMS to confirm phone ownership.
     */
    phonenoVerificationCode: {
        type: String,
        default: '',
        description: 'Verification code sent to phone number for confirmation.'
    },

    /**
     * ✅ Phone Verification Status
     * Indicates if the user’s phone number has been verified.
     */
    isPhonenoVerified: {
        type: Boolean,
        default: false,
        description: 'True if the phone number has been successfully verified.'
    },

    /**
     * 🔐 Password
     * User’s password, stored securely as a bcrypt hash.
     * Must include at least one number and one letter.
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
        private: true, // Excluded from JSON output by plugin
        description: 'Hashed password for authentication.'
    },

    /**
     * 🧑‍💼 Role
     * Defines the user’s role within the franchise.
     * - Manager: Has full control over quizzes, staff, and reports.
     * - Staff: Limited to quiz creation and hosting.
     */
    role: {
        type: String,
        enum: [null, 'manager', 'staff'],
        default: null,
        description: 'User role defining access level (manager or staff).'
    },

    /**
     * 📱 Device Type
     * Indicates the platform used by this user (e.g., Web, iOS, Android).
     * Mainly for push notification management and analytics.
     */
    deviceType: {
        type: String,
        default: '',
        description: 'Type of device used by the user (Web, iOS, Android).'
    },

    /**
     * 🔔 Device Push Key
     * Token used for sending push notifications to this device.
     */
    devicePushKey: {
        type: String,
        default: '',
        description: 'Push notification key/token for this user’s device.'
    },

    /**
     * 👤 Creator Object
     * Stores information about who created this user account.
     * Used for hierarchical account management (e.g., created by HQ or another manager).
     */
    creatorObj: {
        /**
         * 🆔 Creator ID
         * References the user (FranchiseeUser or FranchisorUser) who created this account.
         */
        creatorId: {
            type: mongoose.SchemaTypes.ObjectId,
            refPath: 'creatorObj.creatorRole', // Dynamically references the model based on role
            default: null,
            description: 'ID of the creator (could be a FranchiseeUser or FranchisorUser).'
        },

        /**
         * 🏷️ Creator Role
         * Indicates whether the creator was a FranchiseeUser or a FranchisorUser.
         */
        creatorRole: {
            type: String,
            enum: ['FranchiseeUser', 'FranchisorUser'],
            default: null,
            description: 'Role of the account creator (FranchiseeUser or FranchisorUser).'
        }
    },

    /**
     * 🔑 Authentication Token
     * Stores the JWT used for user authentication in active sessions.
     */
    token: {
        type: String,
        default: null,
        description: 'JWT authentication token assigned to the user.'
    },

    /**
     * 🕒 Created Timestamp
     * Automatically set when the account is created.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Date and time when this user account was created.'
    },

    /**
     * 🕒 Updated Timestamp
     * Automatically updated when user information changes.
     */
    updatedAt: {
        type: Date,
        default: Date.now,
        description: 'Date and time when this user account was last updated.'
    },

    /**
     * ✅ Active Status
     * Indicates whether the user account is active and can log in.
     * Can be toggled by a manager or HQ admin.
     */
    isActive: {
        type: Boolean,
        default: true,
        description: 'Marks the user account as active or inactive.'
    },

    /**
     * ❌ Deletion Flag
     * Used for soft deletion — account hidden but retained for records and audits.
     */
    isDeleted: {
        type: Boolean,
        default: false,
        description: 'Marks the user account as deleted without permanent removal.'
    }
});

// 🔌 Plugins
franchiseeUserSchema.plugin(toJSONFilter);
franchiseeUserSchema.plugin(paginate);

/**
 * 🔐 Method: Generate JWT Authentication Token
 * Creates a new JWT for this user (valid for 30 days)
 * and saves it to the database for session management.
 */
franchiseeUserSchema.methods.generateAuthToken = async function () {
    const franchiseeUser = this;
    const token = jwt.sign(
        { _id: franchiseeUser._id.toString() },
        process.env.JWT_FOR_FRANCHISEE_USER,
        { expiresIn: `${30 * 24}h` } // 30 days
    );
    franchiseeUser.token = token;
    await franchiseeUser.save();
    return token;
};

/**
 * 🔍 Static Method: Find by Credentials
 * Authenticates a franchisee user based on email, password, and role.
 * Returns the user if credentials are valid, otherwise throws an error.
 */
franchiseeUserSchema.statics.findByCredentials = async (email, password) => {
    const findCond = { email, isDeleted: false };
    const franchiseeUser = await FranchiseeUser.findOne(findCond);

    if (!franchiseeUser) {
        throw new ErrorResponse('Email does not exist for this user role', 200);
    }

    const isMatch = await bcrypt.compare(password, franchiseeUser.password);
    if (!isMatch) {
        throw new ErrorResponse('Invalid login credentials', 200);
    }

    return franchiseeUser;
};

/**
 * 🔒 Middleware: Hash Password Before Saving
 * Automatically hashes password if it has been modified or newly set.
 */
franchiseeUserSchema.pre('save', async function (next) {
    const franchiseeUser = this;
    if (franchiseeUser.isModified('password')) {
        franchiseeUser.password = await bcrypt.hash(franchiseeUser.password, 8);
    }
    next();
});

const FranchiseeUser = mongoose.model('FranchiseeUser', franchiseeUserSchema);
module.exports = FranchiseeUser;
