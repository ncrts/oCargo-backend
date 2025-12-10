
// Core dependencies and utilities
const path = require('path');
const base64 = require('base-64');
const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const randomstring = require('randomstring');
const MailHelper = require('../../utils/mailHelper');
const { is18Plus } = require('../../utils/commonHelper');
const generateUniquePseudoName = require('../../utils/generateUniquePseudoName');
const { DeleteObjectCommand, S3Client } = require('@aws-sdk/client-s3');

// Mongoose models
const Player = require('../../models/client.model');
const PlayerProfile = require('../../models/clientProfile.model');
const PlayerStat = require('../../models/clientStat.model');
const PlayerCommunication = require('../../models/clientCommunication.model');
const QuizGameSession = require('../../models/quizGameSession.model');
const QuizFeedback = require('../../models/quizFeedback.model');
const Quiz = require('../../models/quiz.model');

const { getMessage } = require("../../../config/languageLocalization");

const s3BaseUrl = process.env.S3_BUCKET_NAME && process.env.S3_REGION ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/` : '';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilloinstant = require('twilio')(accountSid, authToken);

const sendOtp = catchAsync(async (textBody, sendingNumber) => {
    console.log("textBody", textBody, "sendingNumber", sendingNumber)
    twilloinstant.messages.create({
        body: textBody,
        from: process.env.TWILIO_NUMBER,
        to: sendingNumber
    })
        .then(message => console.log(message.sid))
        .catch(err => {
            console.log("err", err)
        })
})

/**
 * Generates 10 unique pseudo-names for players.
 * @route GET /player/pseudo-names
 * @returns {Array<string>} List of unique pseudo-names
 */
const generateFiveUniquePseudoNames = catchAsync(async (req, res) => {
    const pseudoNamesSet = new Set();
    // Keep generating until we have 10 unique names
    while (pseudoNamesSet.size < 10) {
        const pseudoName = await generateUniquePseudoName();
        pseudoNamesSet.add(pseudoName);
    }
    return res.status(httpStatus.OK).json({ success: true, message: getMessage("GENERATED_PSEUDO", res.locals.language), data: { 'pseudoName': Array.from(pseudoNamesSet) } });
});


/**
 * Handles the player signup process.
 * Validates age, checks for unique pseudoName, and creates player and related documents.
 * For 'client' mode, generates an email verification OTP.
 * @function signup
 * @async
 * @param {import('express').Request} req - Express request object containing signup data.
 * @param {import('express').Response} res - Express response object used to send the result.
 * @returns {Promise<void>} Sends a response indicating the result of the signup operation.
 */
const signup = catchAsync(async (req, res) => {
    let newPlayerData = {};
    let isValideAge = await is18Plus(req.body.dob);

    if (!isValideAge) {
        return res.status(httpStatus.OK).json({ success: false, message: getMessage("IN_VALIDEAGE", res.locals.language), data: null });
    }
    if (req.body.pseudoName) {
        const existingPlayer = await Player.findOne({ pseudoName: req.body.pseudoName });
        if (existingPlayer) {
            return res.status(httpStatus.OK).json({ success: false, message: getMessage("EXISTED_PSEUDO_NAME", res.locals.language), data: null });
        }
    }
    if (!req.body.mode) {
        return res.status(httpStatus.OK).json({ success: false, message: getMessage("MODE_REQUIRED", res.locals.language), data: null });
    }

    // Handle signup for 'client' mode
    if (req.body.mode == "client") {
        const emailVerificationOtp = randomstring.generate({ length: 6, charset: 'numeric' });
        newPlayerData.pseudoName = req.body.pseudoName;
        newPlayerData.dob = req.body.dob;
        newPlayerData.email = req.body.email;
        newPlayerData.password = req.body.password;
        newPlayerData.signinWith = "email";
        newPlayerData.mode = "client";
        newPlayerData.emailVerificationCode = emailVerificationOtp;
        // Add optional device information
        if (req.body.deviceType) newPlayerData.deviceType = req.body.deviceType;
        if (req.body.devicePushKey) newPlayerData.devicePushKey = req.body.devicePushKey;
        // Add social login IDs if provided
        if (req.body.signupWith == 'google') {
            newPlayerData.google_id = req.body.socialId;
        }
        if (req.body.signupWith == 'apple') {
            newPlayerData.apple_id = req.body.socialId;
        }
        // Optionally send verification email (commented out)
        /*
        const mailOptions = {
            to: req.body.email,
            subject: 'Email Verification',
            text: `Your email verification code is: ${emailVerificationOtp}`
        };
        MailHelper.sendVerificationEmail(mailOptions);
        */
    }

    // Handle signup for 'guest' mode
    if (req.body.mode == "guest") {
        newPlayerData.pseudoName = req.body.pseudoName;
        newPlayerData.mode = "guest";
        newPlayerData.signinWith = "guest";
        newPlayerData.dob = req.body.dob;
        newPlayerData.password = 'guest@123'; // Default password for guest users
        // Add optional device information
        if (req.body.deviceType) newPlayerData.deviceType = req.body.deviceType;
        if (req.body.devicePushKey) newPlayerData.devicePushKey = req.body.devicePushKey;
    }

    // Create player and related documents
    let player = new Player(newPlayerData);
    let playerProfile = new PlayerProfile({ clientId: player._id, mode: newPlayerData.mode });
    let playerStat = new PlayerStat({ clientId: player._id, mode: newPlayerData.mode });
    let playerCommunication = new PlayerCommunication({ clientId: player._id });

    player.clientProfileId = playerProfile._id;
    player.clientStatId = playerStat._id;
    player.clientCommunicationId = playerCommunication._id;

    await player.save();
    await playerProfile.save();
    await playerStat.save();
    await playerCommunication.save();



    if (req.body.mode == "guest") {
        const token = await player.generateAuthToken();
        let dataIfo = { player: player, token: token }

        return res.status(httpStatus.CREATED).json({
            success: true,
            message: getMessage("PLAYER_SIGNUP_SUCCESS", res.locals.language),
            data: dataIfo
        });
    }

    return res.status(httpStatus.CREATED).json({
        success: true,
        message: getMessage("PLAYER_SIGNUP_SUCCESS_VERIFY_EMAIL_TO_CONTINUE", res.locals.language),
        data: { OTP: newPlayerData.emailVerificationCode }
    })

})



/**
 * Handles the player sign-in process.
 * Authenticates player and returns JWT token if successful.
 * @async
 * @function signin
 * @param {Object} req - The request object containing player sign-in data.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {Promise<void>} A promise that resolves when the response has been sent.
 */
const signin = catchAsync(async (req, res) => {
    let player = null
    if (req.body.pseudoName && req.body.dob) {
        let checkPseudoName = await Player.findOne({
            pseudoName: { $regex: `^${req.body.pseudoName}$`, $options: 'i' }
        });
        if (!checkPseudoName) {
            return res.status(httpStatus.OK).json({ success: false, message: getMessage("PLAYER_PSEUDO_NAME_NOT_FOUND", res.locals.language), data: null });
        }
        player = checkPseudoName;
    } else {
        player = await Player.findByCredentials(req.body.email, req.body.password, role = 'client');

        if (player.isEmailVerified === false) {
            return res.status(httpStatus.OK).json({ success: false, message: getMessage("EMAIL_NOT_VERIFIED", res.locals.language), data: null });
        }
    }

    // Update optional device information if provided
    if (req.body.deviceType) player.deviceType = req.body.deviceType;
    if (req.body.devicePushKey) player.devicePushKey = req.body.devicePushKey;

    // Save device updates if any were made
    if (req.body.deviceType || req.body.devicePushKey) {
        await player.save();
    }

    const token = await player.generateAuthToken();
    return res.status(httpStatus.OK).json({ success: true, message: getMessage("PLAYER_SIGNIN_SUCCESS", res.locals.language), data: { s3BaseUrl, player, token } });
});

/**
 * Handles social login for Google and Apple authentication.
 * Creates a new player account if social ID doesn't exist, or authenticates existing player.
 * Updates device information on login.
 * 
 * Request body:
 * {
 *   signupWith (required - 'google' or 'apple'),
 *   socialId (required - OAuth ID from provider),
 *   pseudoName (optional - auto-generated if not provided),
 *   email (optional for Apple, required for Google),
 *   dob (optional - date of birth),
 *   deviceType (optional - iOS, Android, Web),
 *   devicePushKey (optional - push notification token)
 * }
 * 
 * Returns: player data with JWT token and S3 base URL
 */
const socialLogin = catchAsync(async (req, res) => {
    // Validate required fields
    if (!req.body.signupWith || !req.body.socialId) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'Required fields are missing, please provide signupWith (google or apple) and socialId',
            data: null
        });
    }

    // Validate signupWith is either google or apple
    const validSocialProviders = ['google', 'apple'];
    if (!validSocialProviders.includes(req.body.signupWith)) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'Invalid social provider, please choose either "google" or "apple".',
            data: null
        });
    }

    let findCond = {};

    // Build find condition based on social provider
    if (req.body.signupWith === 'google') {
        findCond.google_id = req.body.socialId;
    } else if (req.body.signupWith === 'apple') {
        findCond.apple_id = req.body.socialId;
    }

    // Try to find existing player with this social ID
    let player = await Player.findOne(findCond);

    // If player exists, authenticate and return
    if (player) {
        // Update device information if provided
        if (req.body.deviceType) player.deviceType = req.body.deviceType;
        if (req.body.devicePushKey) player.devicePushKey = req.body.devicePushKey;

        // Update signinWith to reflect the social provider used
        player.signinWith = req.body.signupWith;

        // Save updates
        await player.save();

        // Generate authentication token
        const token = await player.generateAuthToken();

        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage("PLAYER_SIGNIN_SUCCESS", res.locals.language),
            data: {
                s3BaseUrl,
                player: player,
                token: token
            }
        });
    } else {
        if (req.body.isSignupOnly === true) {
            // Player doesn't exist, create new account
            let pseudoName = req.body.pseudoName;

            // Verify pseudo-name is unique
            const existingPlayer = await Player.findOne({ pseudoName: pseudoName });
            if (existingPlayer) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: getMessage("EXISTED_PSEUDO_NAME", res.locals.language),
                    details: 'This pseudo-name is already taken. Please choose another.'
                });
            }

            // Create new player data
            const newPlayerData = {
                pseudoName: pseudoName,
                mode: 'client',
                role: 'client',
                signinWith: req.body.signupWith,
                isEmailVerified: true, // Social logins skip email verification
                password: 'social@123' // Generate random password
            };

            // Add social IDs
            if (req.body.signupWith === 'google') {
                newPlayerData.google_id = req.body.socialId;
            } else if (req.body.signupWith === 'apple') {
                newPlayerData.apple_id = req.body.socialId;
            }

            // Add date of birth if provided
            if (req.body.dob) {
                const isValidAge = await is18Plus(req.body.dob);
                if (!isValidAge) {
                    return res.status(httpStatus.OK).json({
                        success: false,
                        message: getMessage("IN_VALIDEAGE", res.locals.language)
                    });
                }
                newPlayerData.dob = req.body.dob;
            }

            // Add email only if provided (required for Google)
            if (req.body.email) {
                const emailExists = await Player.findOne({ email: req.body.email });
                if (emailExists) {
                    return res.status(httpStatus.OK).json({
                        success: false,
                        message: getMessage("EXISTED_EMAIL", res.locals.language),
                        details: 'This email is already registered. Please use another email.'
                    });
                }
                newPlayerData.email = req.body.email;
            }

            // Add optional device information
            if (req.body.deviceType) newPlayerData.deviceType = req.body.deviceType;
            if (req.body.devicePushKey) newPlayerData.devicePushKey = req.body.devicePushKey;

            // Create player and related documents
            let newPlayer = new Player(newPlayerData);
            let playerProfile = new PlayerProfile({ clientId: newPlayer._id, mode: 'client' });
            let playerStat = new PlayerStat({ clientId: newPlayer._id, mode: 'client' });
            let playerCommunication = new PlayerCommunication({ clientId: newPlayer._id });

            newPlayer.clientProfileId = playerProfile._id;
            newPlayer.clientStatId = playerStat._id;
            newPlayer.clientCommunicationId = playerCommunication._id;

            await newPlayer.save();
            await playerProfile.save();
            await playerStat.save();
            await playerCommunication.save();

            // Generate authentication token
            const token = await newPlayer.generateAuthToken();

            return res.status(httpStatus.CREATED).json({
                success: true,
                message: 'Player account created and authenticated via ' + req.body.signupWith,
                data: {
                    s3BaseUrl,
                    player: newPlayer,
                    token: token,
                    isNewAccount: true
                }
            });

        } else {
            // If player does not exist, proceed to create a new account
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: getMessage("PLAYER_NOT_FOUND_SIGNUP_FIRST", res.locals.language),
                data: null
            });
        }
    }


})


const createFirebaseCustomToken = async (req, res) => {
    // Placeholder for Firebase custom token generation logic
    try {
        const admin = require("firebase-admin");
        let checkPseudoCode = await Player.findOne({ "pseudoName": req.body.pseudoName });
        if (!checkPseudoCode) {
            return res.status(httpStatus.OK).json({ success: false, message: getMessage("PLAYER_PSEUDO_NAME_NOT_FOUND", res.locals.language), data: null });
        }
        const uid = `${checkPseudoCode.pseudoName}`;

        try {
            await admin.auth().getUser(uid);
        } catch (e) {
            if (e.code === "auth/user-not-found") {
                await admin.auth().createUser({ uid }); // no email required
            } else throw e;
        }

        const customToken = await admin.auth().createCustomToken(uid);
        return res.status(httpStatus.OK).json({ success: true, message: getMessage("FIREBASE_CUSTOM_TOKEN_GENERATED_SUCCESS", res.locals.language), data: { customToken } });

    } catch (err) {
        console.error("Error generating Firebase custom token:", err);
    }
}

/**
 * Handles the Firebase custom token signout process.
 * Revokes all refresh tokens for the user and clears the player's token.
 * This ensures the user is logged out from Firebase and the application.
 * @async
 * @function singoutFirebaseCustomToken
 * @param {Object} req - The request object containing player info
 * @param {Object} res - The response object used to send back the result
 * @returns {Promise<void>} A promise that resolves when the response has been sent
 */
const singoutFirebaseCustomToken = async (req, res) => {
    try {
        const admin = require("firebase-admin");

        // Validate that player exists
        if (!req.player || !req.player.pseudoName) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("PLAYER_PSEUDO_NAME_NOT_FOUND", res.locals.language),
                data: null
            });
        }

        const uid = `${req.player.pseudoName}`;

        try {
            // Revoke all refresh tokens for the user
            // This invalidates all active sessions and tokens for this user
            await admin.auth().revokeRefreshTokens(uid);
        } catch (firebaseError) {
            // Log error but continue with local signout if user doesn't exist in Firebase
            if (firebaseError.code !== "auth/user-not-found") {
                // console.error("Error revoking Firebase tokens:", firebaseError);
                // throw firebaseError;
                return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                    success: false,
                    message: firebaseError,
                    data: null
                });
            }
        }

        // Clear the player's application token
        // req.player.token = '';
        // await req.player.save();

        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage("PLAYER_SIGNOUT_SUCCESS", res.locals.language),
            data: null
        });

    } catch (err) {
        console.error("Error during Firebase custom token signout:", err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Error during signout process",
            data: null
        });
    }
}


/**
 * Sends an OTP to the player's email for verification.
 * Generates a 6-digit OTP and updates the player's emailVerificationCode.
 * (Email sending logic is present but commented out.)
 * @async
 * @function sendOTPforVerificationEmail
 */
const sendOTPforVerificationEmail = catchAsync(async (req, res) => {
    const emailVerificationOtp = randomstring.generate({ length: 6, charset: 'numeric' });
    // Optionally send verification email (commented out)
    /*
    const mailOptions = {
        to: req.body.email,
        subject: 'Email Verification',
        text: `Your email verification code is: ${emailVerificationOtp}`
    };
    MailHelper.sendVerificationEmail(mailOptions);
    */
    // If the authenticated player's email matches, update directly
    if (req.player?.email === req.body.email) {
        req.player.emailVerificationCode = emailVerificationOtp;
        await req.player.save();
        return res.status(httpStatus.OK).json({ success: true, message: getMessage("VERIFICATION_EMAIL_SENT_SUCCESS", res.locals.language), data: { otp: emailVerificationOtp } });
    } else {
        // Otherwise, find the player by email and update
        let player = await Player.findOne({ email: req.body.email });
        if (!player) {
            return res.status(httpStatus.OK).json({ success: false, message: getMessage("PLAYER_EMAIL_NOT_FOUND", res.locals.language), data: null });
        }
        player.emailVerificationCode = emailVerificationOtp;
        await player.save();
        return res.status(httpStatus.OK).json({ success: false, message: getMessage("VERIFICATION_EMAIL_SENT_SUCCESS", res.locals.language), data: { otp: emailVerificationOtp } });
    }
});


/**
 * Verifies the OTP sent to the player's email.
 * If valid, marks the email as verified.
 * @async
 * @function verifyEmailOTP
 */
const verifyEmailOTP = catchAsync(async (req, res) => {
    const { email, code } = req.body;
    // Find player by email and verification code
    const player = await Player.findOne({ email: email, emailVerificationCode: code });
    if (!player) {
        return res.status(httpStatus.OK).json({ success: false, message: getMessage("IN_VALID_OTP", res.locals.language), data: null });
    }
    player.isEmailVerified = true;
    player.emailVerificationCode = '';
    await player.save();
    return res.status(httpStatus.OK).json({ success: true, message: getMessage("EMAIL_VERIFICATION_SUCCESS", res.locals.language), data: null });
});


/**
 * Handles the signout process for a player.
 * Clears the player's token and ends the session.
 * @async
 * @function signout
 */
const signout = catchAsync(async (req, res) => {
    req.player.token = '';
    await req.player.save();
    res.status(httpStatus.OK).json({ success: true, message: getMessage("PLAYER_SIGNOUT_SUCCESS", res.locals.language), data: null });
});




/**
 * Fetches the player's profile by clientId (from query or authenticated user),
 * populates clientProfileId, clientStatId, and adds S3 bucket URL for profile picture.
 * @async
 * @function getPlayerProfile
 */
const getPlayerProfile = catchAsync(async (req, res) => {
    const clientId = req.query.clientId ? req.query.clientId : req.player._id;
    if (!clientId) {
        return res.status(httpStatus.OK).json({ status: false, message: "clientId is required", data: null });
    }

    const player = await Player.findOne({ _id: clientId, isDeleted: false });
    const playerProfile = await PlayerProfile.findOne({ clientId: clientId, mode: 'client', isDeleted: false });
    const playerCommunication = await PlayerCommunication.findOne({ clientId: clientId, isDeleted: false });
    const playerStat = await PlayerStat.findOne({ clientId: clientId, isDeleted: false });

    if (!player) {
        return res.status(httpStatus.OK).json({
            status: false,
            message: getMessage("PLAYER_NOT_FOUND", res.locals.language),
            data: null
        });
    }

    return res.status(httpStatus.OK).json({
        status: true,
        message: getMessage("PLAYER_PROFILE_FETCHED_SUCCESS", res.locals.language),
        data: {
            s3BaseUrl,
            player: player,
            playerProfile: playerProfile,
            playerCommunication: playerCommunication,
            playerStat: playerStat || null
        }
    });
});


/**
 * Updates the player's profile with provided data and sets the updatedAt timestamp.
 * Supports updating: firstName, lastName, gender, profileAvatar, dob
 * quizCategoryInterests, favoriteFood, favoriteOCargoFoodCourt, currentOcargoFoodCourt
 * preferencesEmail, preferencesPush, preferencesSMS
 * @async
 * @function updatePlayerProfile
 */
const updatePlayerProfile = catchAsync(async (req, res) => {
    try {
        const clientId = req.player._id;

        if (!clientId) {
            return res.status(httpStatus.OK).json({
                status: false,
                message: getMessage("CLIENTID_REQUIRED", res.locals.language),
                data: null
            });
        }

        let player = await Player.findOne({ _id: clientId, isDeleted: false });
        let playerProfile = await PlayerProfile.findOne({ clientId: clientId, mode: 'client', isDeleted: false });
        let playerCommunication = await PlayerCommunication.findOne({ clientId: clientId, isDeleted: false });

        if (!player) {
            return res.status(httpStatus.OK).json({
                status: false,
                message: getMessage("PLAYER_NOT_FOUND", res.locals.language),
                data: null
            });
        }

        // Update firstName if provided
        if (req.body.firstName !== undefined && req.body.firstName !== null) {
            if (typeof req.body.firstName !== 'string' || !req.body.firstName.trim()) {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: 'First name must be a non-empty string',
                    data: null
                });
            }
            if (playerProfile) {
                playerProfile.firstName = req.body.firstName.trim();
            }
        }

        // Update lastName if provided
        if (req.body.lastName !== undefined && req.body.lastName !== null) {
            if (typeof req.body.lastName !== 'string' || !req.body.lastName.trim()) {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: 'Last name must be a non-empty string',
                    data: null
                });
            }
            if (playerProfile) {
                playerProfile.lastName = req.body.lastName.trim();
            }
        }

        // Update isDeleteRequested if provided
        if (req.body.isDeleteRequested !== undefined && req.body.isDeleteRequested !== null) {
            if (typeof req.body.isDeleteRequested !== 'boolean') {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: 'isDeleteRequested must be a boolean value (true or false)',
                    data: null
                });
            }
            player.isDeleteRequested = req.body.isDeleteRequested;
            // If isDeleteRequested is true, set deleteRequestedAt to current server time
            if (req.body.isDeleteRequested === true) {
                player.deleteRequestedAt = new Date();
            } else {
                player.deleteRequestedAt = null;
            }
        }

        // Update gender if provided
        if (req.body.gender !== undefined && req.body.gender !== null) {
            const validGenders = ['Male', 'Female', 'Prefer not to share'];
            if (!validGenders.includes(req.body.gender)) {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: 'Gender must be one of: Male, Female, Prefer not to share',
                    data: null
                });
            }
            if (playerProfile) {
                playerProfile.gender = req.body.gender;
            }
        }

        // Update profileAvatar if provided
        if (req.body.profileAvatar !== undefined && req.body.profileAvatar !== null) {
            if (typeof req.body.profileAvatar !== 'string' || !req.body.profileAvatar.trim()) {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: 'Profile avatar must be a non-empty string (URL)',
                    data: null
                });
            }
            player.profileAvatar = req.body.profileAvatar.trim();
        }

        // Update dob if provided
        if (req.body.dob !== undefined && req.body.dob !== null) {
            const isValideAge = await is18Plus(req.body.dob);
            if (!isValideAge) {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: getMessage("IN_VALIDEAGE", res.locals.language),
                    data: null
                });
            }
            player.dob = req.body.dob;
        }

        // Update quizCategoryInterests if provided
        if (req.body.quizCategoryInterests !== undefined && req.body.quizCategoryInterests !== null) {
            // Validate that it's an array
            if (!Array.isArray(req.body.quizCategoryInterests)) {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: 'quizCategoryInterests must be an array of category objects',
                    data: null
                });
            }

            // Validate each category object
            const validatedCategories = [];
            for (const category of req.body.quizCategoryInterests) {
                if (typeof category !== 'object' || category === null) {
                    return res.status(httpStatus.OK).json({
                        status: false,
                        message: 'Each quiz category must be an object with categoryIds and categoryName',
                        data: null
                    });
                }

                if (!category.categoryIds || typeof category.categoryIds !== 'string') {
                    return res.status(httpStatus.OK).json({
                        status: false,
                        message: 'Each category must have a valid categoryIds (ObjectId as string)',
                        data: null
                    });
                }

                if (!category.categoryName || typeof category.categoryName !== 'string' || !category.categoryName.trim()) {
                    return res.status(httpStatus.OK).json({
                        status: false,
                        message: 'Each category must have a non-empty categoryName',
                        data: null
                    });
                }

                validatedCategories.push({
                    categoryIds: category.categoryIds,
                    categoryName: category.categoryName.trim()
                });
            }

            if (playerProfile) {
                playerProfile.quizCategoryInterests = validatedCategories;
            }
        }

        // Update favoriteFood if provided
        if (req.body.favoriteFood !== undefined && req.body.favoriteFood !== null) {
            // Validate that it's an array
            if (!Array.isArray(req.body.favoriteFood)) {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: 'favoriteFood must be an array of food objects',
                    data: null
                });
            }

            // Validate each food object
            const validatedFoods = [];
            for (const food of req.body.favoriteFood) {
                if (typeof food !== 'object' || food === null) {
                    return res.status(httpStatus.OK).json({
                        status: false,
                        message: 'Each food item must be an object with foodId and foodName',
                        data: null
                    });
                }

                if (!food.foodId || typeof food.foodId !== 'string') {
                    return res.status(httpStatus.OK).json({
                        status: false,
                        message: 'Each food must have a valid foodId (ObjectId as string)',
                        data: null
                    });
                }

                if (!food.foodName || typeof food.foodName !== 'string' || !food.foodName.trim()) {
                    return res.status(httpStatus.OK).json({
                        status: false,
                        message: 'Each food must have a non-empty foodName',
                        data: null
                    });
                }

                validatedFoods.push({
                    foodId: food.foodId,
                    foodName: food.foodName.trim()
                });
            }

            if (playerProfile) {
                playerProfile.favoriteFood = validatedFoods;
            }
        }

        // Update favoriteOCargoFoodCourt if provided
        if (req.body.favoriteOCargoFoodCourt !== undefined && req.body.favoriteOCargoFoodCourt !== null) {
            if (typeof req.body.favoriteOCargoFoodCourt !== 'string' || !req.body.favoriteOCargoFoodCourt.trim()) {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: 'favoriteOCargoFoodCourt must be a valid ObjectId (string)',
                    data: null
                });
            }
            if (playerProfile) {
                playerProfile.favoriteOCargoFoodCourt = req.body.favoriteOCargoFoodCourt.trim();
            }
        }

        // Update currentOcargoFoodCourt if provided
        if (req.body.currentOcargoFoodCourt !== undefined && req.body.currentOcargoFoodCourt !== null) {
            if (typeof req.body.currentOcargoFoodCourt !== 'string' || !req.body.currentOcargoFoodCourt.trim()) {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: 'currentOcargoFoodCourt must be a valid ObjectId (string)',
                    data: null
                });
            }
            if (playerProfile) {
                playerProfile.currentOcargoFoodCourt = req.body.currentOcargoFoodCourt.trim();
            }
        }

        // Update preferencesEmail if provided
        if (req.body.preferencesEmail !== undefined && req.body.preferencesEmail !== null) {
            if (typeof req.body.preferencesEmail !== 'boolean') {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: 'preferencesEmail must be a boolean value (true or false)',
                    data: null
                });
            }
            if (playerCommunication) {
                playerCommunication.preferencesEmail = req.body.preferencesEmail;
            }
        }

        // Update preferencesPush if provided
        if (req.body.preferencesPush !== undefined && req.body.preferencesPush !== null) {
            if (typeof req.body.preferencesPush !== 'boolean') {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: 'preferencesPush must be a boolean value (true or false)',
                    data: null
                });
            }
            if (playerCommunication) {
                playerCommunication.preferencesPush = req.body.preferencesPush;
            }
        }

        // Update preferencesSMS if provided
        if (req.body.preferencesSMS !== undefined && req.body.preferencesSMS !== null) {
            if (typeof req.body.preferencesSMS !== 'boolean') {
                return res.status(httpStatus.OK).json({
                    status: false,
                    message: 'preferencesSMS must be a boolean value (true or false)',
                    data: null
                });
            }
            if (playerCommunication) {
                playerCommunication.preferencesSMS = req.body.preferencesSMS;
            }
        }

        // Save updates
        if (player) {
            player.updatedAt = Date.now();
            await player.save();
        }

        if (playerProfile) {
            playerProfile.updatedAt = Date.now();
            await playerProfile.save();
        }

        if (playerCommunication) {
            playerCommunication.updatedAt = Date.now();
            await playerCommunication.save();
        }

        return res.status(httpStatus.OK).json({
            status: true,
            message: "Profile updated successfully",
            data: {
                s3BaseUrl,
                player: player,
                playerProfile: playerProfile,
                playerCommunication: playerCommunication
            }
        });
    } catch (error) {
        console.error('Error updating player profile:', error);
        return res.status(httpStatus.OK).json({
            status: false,
            message: "An error occurred while updating profile",
            data: null
        });
    }
});


/**
 * Updates the player's profile picture.
 * Uploads the new picture to S3 and updates the profileAvatar field.
 * @async
 * @function updatePlayerProfilePicture
 */
const updatePlayerProfilePicture = catchAsync(async (req, res) => {
    // Construct S3 base URL
    const profilePicturePath = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/`;
    let staticUrl = {
        baseUrl: profilePicturePath
    };
    let id = req.params.id;
    let filter = { "_id": id, "isActive": true, "isDeleted": false };
    let update = null;
    // Check if file is uploaded
    if (!req.file) {
        return res.status(httpStatus.OK).json({
            status: false,
            message: "No file uploaded",
            data: null
        });
    }
    update = { profileAvatar: req.file.key };
    // Update player profile with new avatar
    const updatedPlayerProfile = await PlayerProfile.findOneAndUpdate(filter, update, { new: true });
    if (!updatedPlayerProfile) {
        return res.status(httpStatus.OK).json({
            status: false,
            message: "Player profile not found",
            data: null
        });
    }
    return res.status(httpStatus.OK).json({
        status: true,
        message: "Player profile picture updated successfully",
        data: { profilePictureUrl: staticUrl.baseUrl + req.file.key }
    });
});



/**
 * Deletes the player's profile picture from S3 and clears the profileAvatar field.
 * @async
 * @function deletePlayerProfilePicture
 */
const deletePlayerProfilePicture = catchAsync(async (req, res) => {
    let id = req.params.id;
    let filter = { "_id": id, "isActive": true, "isDeleted": false };
    let update = { profileAvatar: '' };
    // Find player profile
    const playerProfile = await PlayerProfile.findOne(filter);
    if (!playerProfile) {
        return res.status(httpStatus.OK).json({ status: false, message: "Player profile not found", data: null });
    }
    // Delete file from S3
    await globalFileDeleteWithS3(playerProfile.profileAvatar);
    // Update profile to clear avatar
    const updatedPlayerProfile = await PlayerProfile.findOneAndUpdate(filter, update, { new: true });
    if (!updatedPlayerProfile) {
        return res.status(httpStatus.OK).json({ status: false, message: "Player profile not found", data: null });
    }
    return res.status(httpStatus.OK).json({ status: true, message: "Player profile picture deleted successfully", data: null });
});


/**
 * Helper function to delete a file from AWS S3.
 * @param {string} key - S3 object key to delete
 * @returns {Promise<any>} Result of the S3 delete operation
 */
const globalFileDeleteWithS3 = async (key) => {
    const client = new S3Client({
        credentials: {
            secretAccessKey: process.env.S3_SECRET_KEY,
            accessKeyId: process.env.S3_ACCESS_KEY
        },
        region: process.env.S3_REGION
    });
    const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key
    });
    try {
        return await client.send(command);
    } catch (err) {
        return err;
    }
};

/**
 * Adds or updates the player's phone number and sends verification SMS.
 * @async
 * @function addOrUpdatePlayerPhoneNumber
 * @param {Object} req - Express request object containing phonenoPrefix and phoneno.
 * @param {Object} res - Express response object used to send the result.
 * @returns {Promise<void>} Sends a response indicating the result of the operation.
 */
const addOrUpdatePlayerPhoneNumber = catchAsync(async (req, res) => {
    const { phonenoPrefix, phoneno } = req.body;
    if (!phonenoPrefix || !phoneno) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage('PHONE_NUMBER_AND_PREFIX_REQUIRED', res.locals.language),
            data: null
        });
    }

    // Check if phone number exists for another player
    const existingPlayer = await Player.findOne({ phonenoPrefix, phoneno, isDeleted: false });
    const verificationCode = randomstring.generate({ length: 6, charset: 'numeric' });

    if (existingPlayer && existingPlayer._id.toString() !== req.player._id.toString()) {
        // Phone number exists for another player, send verification SMS
        existingPlayer.phonenoVerificationCode = verificationCode;
        await existingPlayer.save();
        sendOtp(`${getMessage('PHONE_VERIFICATION_CODE_MESSAGE', res.locals.language)} ${verificationCode}`, `${phonenoPrefix}${phoneno}`);
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage('PHONE_NUMBER_EXISTS_FOR_OTHER_PLAYER', res.locals.language),
            data: { otp: verificationCode }
        });
    } else {
        // Phone number is new or belongs to this player, set and send verification SMS
        let player = await Player.findOne({ _id: req.player._id, isDeleted: false });
        if (!player) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage('PLAYER_NOT_FOUND', res.locals.language),
                data: null
            });
        }
        player.phonenoPrefix = phonenoPrefix;
        player.phoneno = phoneno;
        player.phonenoVerificationCode = verificationCode;
        player.isPhonenoVerified = false;
        await player.save();
        sendOtp(`${getMessage('PHONE_VERIFICATION_CODE_MESSAGE', res.locals.language)} ${verificationCode}`, `Sent by MyOCargo`);
        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage('PHONE_NUMBER_SET_VERIFICATION_SMS_SENT', res.locals.language),
            data: { otp: verificationCode }
        });
    }
});

/**
 * Verifies the player's phone number using OTP, phoneno, and phonenoPrefix.
 * If verified and phone number exists for another player, transfer to current player.
 * @async
 * @function verifyPlayerPhoneNumber
 * @param {Object} req - Express request object containing phonenoPrefix, phoneno, and otp.
 * @param {Object} res - Express response object used to send the result.
 * @returns {Promise<void>} Sends a response indicating the result of the operation.
 */
const verifyPlayerPhoneNumber = catchAsync(async (req, res) => {
    const { phonenoPrefix, phoneno, otp } = req.body;
    if (!phonenoPrefix || !phoneno || !otp) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage('PHONE_OTP_PREFIX_REQUIRED', res.locals.language),
            data: null
        });
    }

    // Find player with this phone and OTP
    const playerWithPhone = await Player.findOne({ phonenoPrefix, phoneno, phonenoVerificationCode: otp, isDeleted: false });
    if (!playerWithPhone) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage('PHONE_VERIFICATION_INVALID_OTP', res.locals.language),
            data: null
        });
    }

    // If phone belongs to another player, remove from them and assign to current player
    if (playerWithPhone._id.toString() !== req.player._id.toString()) {
        // Remove phone from the other player
        playerWithPhone.phonenoPrefix = null;
        playerWithPhone.phoneno = null;
        playerWithPhone.phonenoVerificationCode = '';
        playerWithPhone.isPhonenoVerified = false;
        await playerWithPhone.save();

        // Assign phone to current player
        let currentPlayer = await Player.findOne({ _id: req.player._id, isDeleted: false });
        currentPlayer.phonenoPrefix = phonenoPrefix;
        currentPlayer.phoneno = phoneno;
        currentPlayer.phonenoVerificationCode = '';
        currentPlayer.isPhonenoVerified = true;
        await currentPlayer.save();

        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage('PHONE_VERIFIED_AND_TRANSFERRED', res.locals.language),
            data: null
        });
    } else {
        // Phone belongs to this player, verify it
        playerWithPhone.phonenoVerificationCode = '';
        playerWithPhone.isPhonenoVerified = true;
        await playerWithPhone.save();
        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage('PHONE_VERIFICATION_SUCCESSFUL', res.locals.language),
            data: null
        });
    }
});

/**
 * Submits feedback and rating for a quiz game session by a player
 * @route POST /quiz/game-session/feedback
 * @param {Object} req - Express request object
 * @param {string} req.body.quizGameSessionId - ID of the quiz game session (required)
 * @param {string} req.body.playerId - ID of the player (required)
 * @param {number} req.body.rating - Rating from 1 to 5 (required)
 * @param {string} req.body.feedbackText - Optional feedback text (optional, max 1000 chars)
 * @param {string} req.body.franchiseId - ID of franchise (optional)
 * @returns {Object} Success response with feedback details
 */
const submitQuizFeedback = catchAsync(async (req, res) => {
    const { quizGameSessionId, playerId, rating, feedbackText, franchiseId } = req.body;

    // Validate rating value
    if (rating < 1 || rating > 5) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage('INVALID_RATING_VALUE', res.locals.language)
        });
    }

    // Check if quiz game session exists
    const quizGameSession = await QuizGameSession.findById(quizGameSessionId);
    if (!quizGameSession) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage('QUIZ_GAME_SESSION_NOT_FOUND', res.locals.language)
        });
    }

    // Verify quiz ID exists in the session
    if (!quizGameSession.quizId) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage('QUIZ_ID_NOT_FOUND', res.locals.language)
        });
    }

    // Check if feedback already exists for this player and session (unique constraint)
    const existingFeedback = await QuizFeedback.findOne({
        playerId,
        quizGameSessionId
    });

    if (existingFeedback) {
        return res.status(httpStatus.CONFLICT).json({
            success: false,
            message: getMessage('QUIZ_FEEDBACK_ALREADY_SUBMITTED', res.locals.language)
        });
    }

    // Create new feedback record
    const newFeedback = new QuizFeedback({
        quizGameSessionId,
        quizId: quizGameSession.quizId,
        playerId,
        rating,
        feedbackText: feedbackText || '',
        franchiseId: franchiseId || quizGameSession.franchiseId,
        status: 'accepted',
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
    });

    // Save feedback to database
    await newFeedback.save();

    // --- Update Quiz clientRating stats ---
    const quiz = await Quiz.findById(quizGameSession.quizId);
    if (quiz) {
        // Get all feedback ratings for this quiz
        const allFeedbacks = await QuizFeedback.find({ quizId: quiz._id });
        const ratingsArr = allFeedbacks.map(fb => fb.rating);
        const min = ratingsArr.length ? Math.min(...ratingsArr) : null;
        const max = ratingsArr.length ? Math.max(...ratingsArr) : null;
        const avg = ratingsArr.length ? (ratingsArr.reduce((a, b) => a + b, 0) / ratingsArr.length) : null;
        
        // Build ratings array for quiz model
        quiz.clientRating = quiz.clientRating || {};
        quiz.clientRating.avg = avg;
        quiz.clientRating.min = min;
        quiz.clientRating.max = max;
        quiz.clientRating.count = ratingsArr.length;
        await quiz.save();
    }

    return res.status(httpStatus.CREATED).json({
        success: true,
        message: getMessage('QUIZ_FEEDBACK_SUBMITTED_SUCCESS', res.locals.language),
        data: {
            feedbackId: newFeedback._id,
            quizGameSessionId: newFeedback.quizGameSessionId,
            quizId: newFeedback.quizId,
            playerId: newFeedback.playerId,
            rating: newFeedback.rating,
            feedbackText: newFeedback.feedbackText,
            status: newFeedback.status,
            submittedAt: newFeedback.submittedAt,
            clientRating: quiz ? quiz.clientRating : null
        }
    });
});

const sendForgotPasswordOtp = catchAsync(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("EMAIL_REQUIRED", res.locals.language),
            data: null
        });
    }
    const player = await Player.findOne({ email, isDeleted: false });
    if (!player) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("PLAYER_EMAIL_NOT_FOUND", res.locals.language),
            data: null
        });
    }
    const otp = randomstring.generate({ length: 6, charset: 'numeric' });
    player.forgotPasswordCode = otp;
    player.forgotPasswordCodeVerified = false;
    player.forgotPasswordAttemptCount = 0;
    player.forgotPasswordCodeExpiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
    await player.save();
    // Optionally send OTP via email here
    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("FORGOT_PASSWORD_OTP_SENT", res.locals.language),
        data: { otp }
    });
});

const verifyForgotPasswordOtp = catchAsync(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("EMAIL_AND_OTP_REQUIRED", res.locals.language),
            data: null
        });
    }
    const player = await Player.findOne({ email, isDeleted: false });
    if (!player) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("PLAYER_EMAIL_NOT_FOUND", res.locals.language),
            data: null
        });
    }
    if (player.forgotPasswordAttemptCount >= 5) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("FORGOT_PASSWORD_ATTEMPT_LIMIT", res.locals.language),
            data: null
        });
    }
    if (!player.forgotPasswordCodeExpiresAt || player.forgotPasswordCodeExpiresAt < new Date()) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("FORGOT_PASSWORD_OTP_EXPIRED", res.locals.language),
            data: null
        });
    }
    if (player.forgotPasswordCode !== otp) {
        player.forgotPasswordAttemptCount += 1;
        await player.save();
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("FORGOT_PASSWORD_OTP_INVALID", res.locals.language),
            data: null
        });
    }
    player.forgotPasswordCodeVerified = true;
    player.forgotPasswordCode = '';
    player.forgotPasswordCodeExpiresAt = null;
    await player.save();
    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("FORGOT_PASSWORD_OTP_VERIFIED", res.locals.language),
        data: null
    });
});

const resetPassword = catchAsync(async (req, res) => {
    const { email, newPassword, confirmNewPassword } = req.body;
    if (!email || !newPassword || !confirmNewPassword) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("EMAIL_AND_PASSWORD_REQUIRED", res.locals.language),
            data: null
        });
    }
    if (newPassword !== confirmNewPassword) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("PASSWORDS_DO_NOT_MATCH", res.locals.language),
            data: null
        });
    }
    const player = await Player.findOne({ email, isDeleted: false });
    if (!player) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("PLAYER_EMAIL_NOT_FOUND", res.locals.language),
            data: null
        });
    }
    if (!player.forgotPasswordCodeVerified) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("FORGOT_PASSWORD_OTP_NOT_VERIFIED", res.locals.language),
            data: null
        });
    }
    player.password = newPassword;
    player.forgotPasswordCodeVerified = false;
    await player.save();
    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("PASSWORD_RESET_SUCCESS", res.locals.language),
        data: null
    });
});

module.exports = {
    signup,
    signin,
    socialLogin,
    signout,
    generateFiveUniquePseudoNames,
    sendOTPforVerificationEmail,
    verifyEmailOTP,
    getPlayerProfile,
    updatePlayerProfile,
    updatePlayerProfilePicture,
    deletePlayerProfilePicture,
    createFirebaseCustomToken,
    singoutFirebaseCustomToken,
    submitQuizFeedback,
    addOrUpdatePlayerPhoneNumber,
    verifyPlayerPhoneNumber,
    sendForgotPasswordOtp,
    verifyForgotPasswordOtp,
    resetPassword
};
