
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
const { getMessage } = require("../../../config/languageLocalization");


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
    // Validate age (must be 18+)
    let isValideAge = await is18Plus(req.body.dob);
    if (!isValideAge) {
        return res.status(httpStatus.OK).json({ success: false, message: getMessage("IN_VALIDEAGE", res.locals.language), data: null });
    }
    // Check for unique pseudoName
    if (req.body.pseudoName) {
        const existingPlayer = await Player.findOne({ pseudoName: req.body.pseudoName });
        if (existingPlayer) {
            return res.status(httpStatus.OK).json({ success: false, message: getMessage("EXISTED_PSEUDO_NAME", res.locals.language), data: null });
        }
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
    }
    // Create player and related documents
    let player = new Player(newPlayerData);
    let playerProfile = new PlayerProfile({ clientId: player._id, mode: newPlayerData.mode });
    let playerStat = new PlayerStat({ clientId: player._id, mode: newPlayerData.mode });
    let playerCommunication = new PlayerCommunication({ clientId: player._id });

    await player.save();
    await playerProfile.save();
    await playerStat.save();
    await playerCommunication.save();

    // Attach related document IDs to the player object for response
    const playerObj = player.toObject();
    playerObj.clientProfileId = playerProfile._id;
    playerObj.clientStatId = playerStat._id;
    playerObj.clientCommunicationId = playerCommunication._id;

    return res.status(httpStatus.CREATED).json({
        success: true,
        message: getMessage("PLAYER_SIGNUP_SUCCESS", res.locals.language),
        data: { player: playerObj }
    });
});



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
    // Authenticate player using credentials
    const player = await Player.findByCredentials(req.body.email, req.body.password, role = 'client');
    // Check if email is verified
    if (player.isEmailVerified === false) {
        return res.status(httpStatus.OK).json({ success: false, message: getMessage("EMAIL_NOT_VERIFIED", res.locals.language), data: null });
    }
    // Generate JWT token
    const token = await player.generateAuthToken();
    return res.status(httpStatus.OK).json({ success: true, message: getMessage("PLAYER_SIGNIN_SUCCESS", res.locals.language), data: { player, token } });
});



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
 * populates clientProfileId, and adds S3 bucket URL for profile picture.
 * @async
 * @function getPlayerProfile
 */
const getPlayerProfile = catchAsync(async (req, res) => {
    // Use clientId from query or fallback to authenticated user
    const clientId = req.query.clientId ? req.query.clientId : req.player._id;
    if (!clientId) {
        return res.status(httpStatus.OK).json({ status: false, message: "clientId is required", data: null });
    }

    // Find player and populate clientProfileId
    const player = await Player.findById(clientId).populate({
        path: 'clientProfileId'
    });
    if (!player) {
        return res.status(httpStatus.OK).json({
            status: false,
            message: "Player not found",
            data: null
        });
    }

    // S3 bucket base URL for profile pictures
    const s3BaseUrl = process.env.S3_BUCKET_NAME && process.env.S3_REGION ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/` : '';

    return res.status(httpStatus.OK).json({
        status: true,
        message: "Player profile fetched successfully",
        data: {
            s3BaseUrl,
            player: player
        }
    });
});


/**
 * Updates the player's profile with provided data and sets the updatedAt timestamp.
 * @async
 * @function updatePlayerProfile
 */
const updatePlayerProfile = catchAsync(async (req, res) => {
    const clientId = req.player._id;
    if (!clientId) {
        return res.status(httpStatus.OK).json({
            status: false,
            message: "clientId is required"
        });
    }
    // Set updatedAt timestamp
    req.body.updatedAt = Date.now();
    // Update player profile
    const profile = await PlayerProfile.findOneAndUpdate(
        { clientId, isDeleted: false },
        { $set: req.body },
        { new: true } // return updated document
    );
    if (!profile) {
        return res.status(httpStatus.OK).json({
            status: false,
            message: "Player profile not found"
        });
    }
    return res.status(httpStatus.OK).json({
        status: true,
        message: "Profile updated successfully",
        data: profile
    });
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

module.exports = {
    signup,
    signin,
    signout,
    generateFiveUniquePseudoNames,
    sendOTPforVerificationEmail,
    verifyEmailOTP,
    getPlayerProfile,
    updatePlayerProfile,
    updatePlayerProfilePicture,
    deletePlayerProfilePicture
};
