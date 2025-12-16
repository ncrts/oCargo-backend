const path = require('path');
const base64 = require('base-64')
const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const mongoose = require('mongoose');
const randomstring = require('randomstring');
const MailHelper = require('../../utils/mailHelper');
const { is18Plus } = require('../../utils/commonHelper');
const generateUniquePseudoName = require('../../utils/generateUniquePseudoName');
const { getPerQuestionPointConfig } = require('../../utils/perQuestionPoint');


const Player = require('../../models/client.model');
const PlayerProfile = require('../../models/clientProfile.model');
const PlayerStat = require('../../models/clientStat.model');
const PlayerCommunication = require('../../models/clientCommunication.model');

const QuizCategory = require('../../models/quizCategory.model');
const QuizQuestion = require('../../models/quizQuestion.model');
const Quiz = require('../../models/quiz.model');
const QuizGameSession = require('../../models/quizGameSession.model');
const QuizSessionPlayer = require('../../models/quizSessionPlayer.model');
const QuizFeedback = require('../../models/quizFeedback.model');
const LocalLeaderboard = require('../../models/localLeaderboard.model');
const NationalLeaderboard = require('../../models/nationalLeaderboard.model');
const FranchiseeLeaderboard = require('../../models/franchiseeLeaderboard.model');

const FranchiseeInfo = require('../../models/franchiseeInfo.model');
const Franchisee = require('../../models/franchisee.user.model');
const Franchisor = require('../../models/franchisor.user.model');
const FranchisorInfo = require('../../models/franchisorInfo.model');
const TalentShowSession = require('../../models/talentShowSession.model');
const TalentShowJoin = require('../../models/talentShowJoin.model');
const TalentShowVote = require('../../models/talentShowVote.model');

const { getMessage } = require("../../../config/languageLocalization")

const { firebaseDB } = require('../../../config/firebaseNotificationConfig');

const s3BaseUrl = process.env.S3_BUCKET_NAME && process.env.S3_REGION ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/` : '';


// ================================
// 📌 TALENT SHOW SESSION APIs
// ================================

// Helper: Generate random 8-digit PIN
function generate8DigitPin() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// Helper: Generate QR Code URL (using qr-server.com)
function generateQRCode(pin) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pin)}`;
}

/**
 * Creates a new talent show session.
 * POST /talent-show/session
 *
 * Request body:
 * {
 *   franchiseInfoId: ObjectId (required),
 *   name: String (required),
 *   description: String (optional),
 *   startTime: Number (timestamp, optional)
 * }
 *
 * createdBy is taken from req.user/franchiseeUser (login token)
 * status is default 'Schedule'
 * Generates audienceGamePin, audienceQrCode, juryJoinGamePin, juryJoinQrCode
 */
const createTalentShowSession = catchAsync(async (req, res) => {
    const { franchiseInfoId, name, description, startTime } = req.body;
    const language = res.locals.language;

    // Validation
    if (!franchiseInfoId) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("FRANCHISE_INFO_ID_REQUIRED", language),
            data: null
        });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_NAME_REQUIRED", language),
            data: null
        });
    }
    // createdBy from login token (franchisee user)
    let createdBy = null;
    if (req.franchiseeUser && req.franchiseeUser._id) {
        createdBy = req.franchiseeUser._id;
    } else if (req.user && req.user._id) {
        createdBy = req.user._id;
    }
    if (!createdBy) {
        return res.status(httpStatus.UNAUTHORIZED).json({
            success: false,
            message: getMessage("UNAUTHORIZED", language),
            data: null
        });
    }


    // Validate startTime is not in the past (if provided)
    if (startTime) {
        const now = Date.now();
        if (startTime < now) {
            return res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                message: getMessage("TALENT_SHOW_STARTTIME_IN_PAST", language),
                data: null
            });
        }
    }

    // Generate audience and jury pins and QR codes
    const audienceGamePin = generate8DigitPin();
    const audienceQrCode = generateQRCode(audienceGamePin);
    const juryJoinGamePin = generate8DigitPin();
    const juryJoinQrCode = generateQRCode(juryJoinGamePin);

    // Build session data
    const sessionData = {
        franchiseInfoId,
        name: name.trim(),
        description: description || '',
        createdBy,
        status: 'Schedule',
        startTime: startTime || null,
        audienceGamePin,
        audienceQrCode,
        juryJoinGamePin,
        juryJoinQrCode
    };

    // Save session
    const session = new TalentShowSession(sessionData);
    await session.save();

    return res.status(httpStatus.CREATED).json({
        success: true,
        message: getMessage("TALENT_SHOW_SESSION_CREATED_SUCCESS", language),
        data: session
    });
});


/**
 * Updates a talent show session's status (and startTime if moving to Lobby).
 * PATCH /talent-show/session/:id
 *
 * Request body:
 *   status: String (required)
 *
 * If status is set to 'Lobby' by a franchisee user, and startTime is in the future, set startTime to now.
 */
const updateTalentShowSession = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const language = res.locals.language;

    if (!status) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("STATUS_REQUIRED", language),
            data: null
        });
    }

    // Only allow valid status values
    const validStatuses = ['Schedule', 'Lobby', 'Start', 'Stop', 'Complete', 'Cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_STATUS_INVALID", language),
            data: null
        });
    }

    // Find session
    const session = await TalentShowSession.findById(id);
    if (!session) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_NOT_FOUND", language),
            data: null
        });
    }

    // Franchisee user logic: if moving to Lobby, update startTime to now
    let updateFields = { status };
    if (
        req.franchiseeUser &&
        status === 'Lobby' &&
        session.status !== 'Lobby'
    ) {
        updateFields.startTime = Date.now();
    }

    session.set(updateFields);
    await session.save();

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("TALENT_SHOW_SESSION_UPDATED_SUCCESS", language),
        data: session
    });
});


/**
     * Get list of Talent Show Sessions with filtering and pagination
     * GET /talent-show/sessions
     * Query parameters: id, name, startTime, franchiseInfoId, limit, skip
     * - If req.franchiseeUser: use their franchiseInfoId
     * - If req.franchisorUser: use req.query.franchiseInfoId (required)
     * - Filters: id (exact), name (regex), startTime (gte/lte)
     * - Pagination: limit, skip, totalCount, totalPages
     */
const getTalentShowSessionsList = catchAsync(async (req, res) => {
    let { id, name, startTimeFrom, startTimeTo, franchiseInfoId, limit = 20, skip = 0 } = req.query;
    const language = res.locals.language;

    // Determine franchiseInfoId based on user type
    if (req.franchiseeUser && req.franchiseeUser.franchiseeInfoId) {
        franchiseInfoId = req.franchiseeUser.franchiseeInfoId;
    } else if (req.franchisorUser) {
        if (!franchiseInfoId) {
            return res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                message: getMessage("FRANCHISE_INFO_ID_REQUIRED", language),
                data: null
            });
        }
    } else {
        return res.status(httpStatus.UNAUTHORIZED).json({
            success: false,
            message: getMessage("UNAUTHORIZED", language),
            data: null
        });
    }

    // Build filter
    const filter = {};
    if (franchiseInfoId) filter.franchiseInfoId = franchiseInfoId;
    if (id) filter._id = id;
    if (name) filter.name = { $regex: name, $options: 'i' };
    if (startTimeFrom || startTimeTo) {
        filter.startTime = {};
        if (startTimeFrom) filter.startTime.$gte = Number(startTimeFrom);
        if (startTimeTo) filter.startTime.$lte = Number(startTimeTo);
    }

    // Parse limit and skip as integers
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit) || 20));
    const pageSkip = Math.max(0, parseInt(skip) || 0);

    // Get total count for pagination info
    const totalCount = await TalentShowSession.countDocuments(filter);

    const sessions = await TalentShowSession.find(filter)
        .sort({ createdAt: -1 })
        .limit(pageLimit)
        .skip(pageSkip);

    res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("TALENT_SHOW_SESSION_LIST_FETCH_SUCCESS", language),
        data: sessions,
        count: sessions.length,
        totalCount: totalCount,
        pagination: {
            limit: pageLimit,
            skip: pageSkip,
            page: Math.floor(pageSkip / pageLimit) + 1,
            totalPages: Math.ceil(totalCount / pageLimit)
        }
    });
})
/**
     * Join a Talent Show Session as Jury, Audience, or Participant
     * POST /talent-show/session/:id/join
     *
     * Request body:
     *   joinType: 'Jury' | 'Audience' | 'Participant' (required)
     *   pin: string (required for Jury/Audience)
     *   joinedBy: franchiseeUserId (required for Participant, from token)
     *
     * - Jury/Audience: must provide correct pin (juryJoinGamePin/audienceGamePin)
     * - Participant: must be joined by franchisee user (joinedBy)
     * - All: must provide valid talentShowSession id (from URL)
     */
const joinTalentShowAsParticipant = catchAsync(async (req, res) => {
    const { id } = req.params; // talentShowSessionId
    const { joinType, franchiseeInfoId } = req.body;
    const language = res.locals.language;
    const now = Date.now();

    // Only allow Participant join for this implementation
    if (joinType !== 'Participant') {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_JOIN_TYPE_INVALID", language),
            data: null
        });
    }

    // Validate session
    const session = await TalentShowSession.findById(id);
    if (!session) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_NOT_FOUND", language),
            data: null
        });
    }

    // Determine franchiseeInfoId and joinedBy
    let usedFranchiseeInfoId = null;
    let joinedBy = null;
    if (req.franchiseeUser && req.franchiseeUser.franchiseeInfoId) {
        usedFranchiseeInfoId = req.franchiseeUser.franchiseeInfoId;
        joinedBy = req.franchiseeUser._id;
    } else if (req.franchisorUser) {
        if (!franchiseeInfoId) {
            return res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                message: getMessage("FRANCHISE_INFO_ID_REQUIRED", language),
                data: null
            });
        }
        usedFranchiseeInfoId = franchiseeInfoId;
        joinedBy = req.franchisorUser._id;
    } else {
        return res.status(httpStatus.UNAUTHORIZED).json({
            success: false,
            message: getMessage("UNAUTHORIZED", language),
            data: null
        });
    }


    // Get clientId from req.body and validate
    const clientId = req.body.clientId;
    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("CLIENTID_REQUIRED", language),
            data: null
        });
    }
    // Validate client exists and is not deleted
    const client = await Player.findOne({ _id: clientId, isDeleted: false });
    if (!client) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("PLAYER_NOT_FOUND", language),
            data: null
        });
    }

    // Prevent duplicate join
    const existing = await TalentShowJoin.findOne({ talentShowId: id, clientId, joinType, isDeleted: false, isRemoved: false });
    if (existing) {
        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage("TALENT_SHOW_ALREADY_JOINED", language),
            data: existing
        });
    }


    // Count current non-removed Participants for this session
    const participantCount = await TalentShowJoin.countDocuments({
        talentShowId: id,
        joinType: 'Participant',
        isDeleted: false,
        isRemoved: false
    });

    // Create join record with sequence
    const join = new TalentShowJoin({
        talentShowId: id,
        franchiseeInfoId: usedFranchiseeInfoId,
        clientId,
        joinType,
        currentRound: 1,
        joinedAt: now,
        isPerformed: false,
        joinedBy,
        isRemoved: false,
        sequence: participantCount + 1
    });
    await join.save();

    // Update totalPlayerCount in session
    session.totalPlayerCount = (session.totalPlayerCount || 0) + 1;
    await session.save();

    return res.status(httpStatus.CREATED).json({
        success: true,
        message: getMessage("TALENT_SHOW_JOIN_SUCCESS", language),
        data: join
    });
});

const joinTalentShowAsJuryFromWeb = catchAsync(async (req, res) => {
    const { id } = req.params; // talentShowSessionId
    const { joinType, franchiseeInfoId } = req.body;
    const language = res.locals.language;
    const now = Date.now();

    // Only allow Jury joinType
    if (joinType !== 'Jury') {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_JOIN_TYPE_INVALID", language),
            data: null
        });
    }

    // Determine franchiseeInfoId and joinedBy
    let usedFranchiseeInfoId = null;
    let joinedBy = null;
    if (req.franchiseeUser && req.franchiseeUser.franchiseeInfoId) {
        usedFranchiseeInfoId = req.franchiseeUser.franchiseeInfoId;
        joinedBy = req.franchiseeUser._id;
    } else if (req.franchisorUser) {
        if (!franchiseeInfoId) {
            return res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                message: getMessage("FRANCHISE_INFO_ID_REQUIRED", language),
                data: null
            });
        }
        usedFranchiseeInfoId = franchiseeInfoId;
        joinedBy = req.franchisorUser._id;
    } else {
        return res.status(httpStatus.UNAUTHORIZED).json({
            success: false,
            message: getMessage("UNAUTHORIZED", language),
            data: null
        });
    }

    // Validate session
    const session = await TalentShowSession.findById(id);
    if (!session) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_NOT_FOUND", language),
            data: null
        });
    }

    // Get clientId from req.body and validate
    const clientId = req.body.clientId;
    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("CLIENTID_REQUIRED", language),
            data: null
        });
    }
    // Validate client exists and is not deleted
    const client = await Player.findOne({ _id: clientId, isDeleted: false });
    if (!client) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("PLAYER_NOT_FOUND", language),
            data: null
        });
    }

    // Validate joinType against enum (from model)
    const validJoinTypes = ['Jury', 'Participant', 'Audience'];
    if (!validJoinTypes.includes(joinType)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_JOIN_TYPE_INVALID", language),
            data: null
        });
    }

    // Prevent duplicate join
    const existing = await TalentShowJoin.findOne({ talentShowId: id, clientId, joinType, isDeleted: false, isRemoved: false });
    if (existing) {
        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage("TALENT_SHOW_ALREADY_JOINED", language),
            data: existing
        });
    }

    // Get currentRound from session (currentRound or default 1)
    let currentRound = 1;
    if (session.currentRound && Number.isInteger(session.currentRound) && session.currentRound > 0) {
        currentRound = session.currentRound;
    }

    // Create join record for Jury
    const join = new TalentShowJoin({
        talentShowId: id,
        franchiseeInfoId: usedFranchiseeInfoId,
        clientId,
        joinType,
        currentRound,
        joinedAt: now,
        isPerformed: false,
        joinedBy,
        isRemoved: false,
        isConnectedJury: false // default for web admin
    });
    await join.save();

    // Optionally update totalJuryCount in session
    session.totalJuryCount = (session.totalJuryCount || 0) + 1;
    await session.save();

    return res.status(httpStatus.CREATED).json({
        success: true,
        message: getMessage("TALENT_SHOW_JURY_JOIN_SUCCESS", language),
        data: join
    });
});


/**
 * Join a Talent Show Session from mobile app using PIN or QR code
 * POST /v1/talent-show/session/join-mobile
 *
 * Request body:
 *   joinType: 'Audience' | 'Jury' (required)
 *   pin: string (required if using PIN)
 *   qrCode: string (required if using QR)
 *   clientId: ObjectId (required)
 *
 * - Audience: must provide correct audienceGamePin or audienceQrCode
 * - Jury: must provide correct juryJoinGamePin or juryJoinQrCode
 * - All: must provide valid talentShowSession
 * - Updates totalAudienceCount or totalJuryConnectCount as needed
 */

const joinTalentShowByPinOrQr = catchAsync(async (req, res) => {
    const { joinType, pin, qrCode } = req.body;
    let clientId = req.body.clientId;
    const language = res.locals.language;
    const now = Date.now();

    // Use req.player.id if clientId not provided
    if (!clientId && req.player && req.player.id) {
        clientId = req.player.id;
    }

    // Validate joinType
    if (!['Audience', 'Jury'].includes(joinType)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_JOIN_TYPE_INVALID", language),
            data: null
        });
    }

    // Validate clientId
    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("CLIENTID_REQUIRED", language),
            data: null
        });
    }
    // Validate client exists and is not deleted
    const client = await Player.findOne({ _id: clientId, isDeleted: false });
    if (!client) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("PLAYER_NOT_FOUND", language),
            data: null
        });
    }

    // Find session by pin or qrCode
    let session = null;
    if (joinType === 'Audience') {
        session = await TalentShowSession.findOne({
            $or: [
                { audienceGamePin: pin },
                { audienceQrCode: qrCode }
            ]
        });
    } else if (joinType === 'Jury') {
        session = await TalentShowSession.findOne({
            $or: [
                { juryJoinGamePin: pin },
                { juryJoinQrCode: qrCode }
            ]
        });
    }
    if (!session) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage(joinType === 'Audience' ? "TALENT_SHOW_AUDIENCE_PIN_INVALID" : "TALENT_SHOW_JURY_PIN_INVALID", language),
            data: null
        });
    }

    // Prevent duplicate join for this session, client, and joinType
    const existing = await TalentShowJoin.findOne({ talentShowId: session._id, clientId, joinType, isDeleted: false, isRemoved: false });
    if (existing) {
        // If Jury, update isConnectedJury to true if not already, do not create new
        if (joinType === 'Jury') {
            if (!existing.isConnectedJury) {
                existing.isConnectedJury = true;
                session.totalJuryConnectCount = (session.totalJuryConnectCount || 0) + 1;
                await existing.save();
                await session.save();
            }
            return res.status(httpStatus.OK).json({
                success: true,
                message: getMessage("TALENT_SHOW_ALREADY_JOINED", language),
                data: existing
            });
        }
        // For Audience, just return existing
        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage("TALENT_SHOW_ALREADY_JOINED", language),
            data: existing
        });
    }

    if (joinType === 'Jury') {
        // Create join record for Jury
        return res.status(httpStatus.CREATED).json({
            success: false,
            message: getMessage("NEW_JURY_WITH_OUT_ASSIGN_NOT_JOIN", language),
            data: null
        });
    }

    // Only create join record for Audience
    if (joinType === 'Audience') {
        // Get currentRound from session (totalSessionShowRound or default 1)
        let currentRound = 1;
        if (session.currentRound && Number.isInteger(session.currentRound) && session.currentRound > 0) {
            currentRound = session.currentRound;
        }

        // Create join record
        let joinData = {
            talentShowId: session._id,
            franchiseeInfoId: session.franchiseInfoId,
            clientId,
            joinType,
            currentRound,
            joinedAt: now,
            isRemoved: false,
            isPerformed: false
        };
        const join = new TalentShowJoin(joinData);
        await join.save();

        // Update session counts
        session.totalAudienceCount = (session.totalAudienceCount || 0) + 1;
        await session.save();

        return res.status(httpStatus.CREATED).json({
            success: true,
            message: getMessage("TALENT_SHOW_JOIN_SUCCESS", language),
            data: join
        });
    }

    
});

module.exports = {
    createTalentShowSession,
    updateTalentShowSession,
    getTalentShowSessionsList,
    joinTalentShowAsParticipant,
    joinTalentShowAsJuryFromWeb,
    joinTalentShowByPinOrQr
};