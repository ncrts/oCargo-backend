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
const joinTalentShow = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { joinType, pin } = req.body;
    const language = res.locals.language;

    // Validate joinType
    if (!joinType || !['Jury', 'Audience', 'Participant'].includes(joinType)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_JOIN_TYPE_INVALID", language),
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

    // Jury/Audience: validate pin
    if (joinType === 'Jury') {
        if (!pin || pin !== session.juryJoinGamePin) {
            return res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                message: getMessage("TALENT_SHOW_JURY_PIN_INVALID", language),
                data: null
            });
        }
    } else if (joinType === 'Audience') {
        if (!pin || pin !== session.audienceGamePin) {
            return res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                message: getMessage("TALENT_SHOW_AUDIENCE_PIN_INVALID", language),
                data: null
            });
        }
    }

    // Get clientId (user joining)
    let clientId = null;
    if (req.user && req.user._id) {
        clientId = req.user._id;
    } else if (req.franchiseeUser && req.franchiseeUser._id) {
        clientId = req.franchiseeUser._id;
    }
    if (!clientId) {
        return res.status(httpStatus.UNAUTHORIZED).json({
            success: false,
            message: getMessage("UNAUTHORIZED", language),
            data: null
        });
    }

    // Franchisee info (from session)
    const franchiseeInfoId = session.franchiseInfoId;

    // For Participant: must be joined by franchisee user
    let joinedBy = null;
    if (joinType === 'Participant') {
        if (req.franchiseeUser && req.franchiseeUser._id) {
            joinedBy = req.franchiseeUser._id;
        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({
                success: false,
                message: getMessage("TALENT_SHOW_PARTICIPANT_JOINEDBY_REQUIRED", language),
                data: null
            });
        }
    }

    // Prevent duplicate join for same client/session/type
    const existingJoin = await TalentShowJoin.findOne({
        talentShowId: id,
        clientId,
        joinType
    });
    if (existingJoin) {
        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage("TALENT_SHOW_ALREADY_JOINED", language),
            data: existingJoin
        });
    }

    // Create join record
    const joinData = {
        talentShowId: id,
        clientId,
        franchiseeInfoId,
        joinType,
        joinedBy: joinedBy || null
    };
    const join = new TalentShowJoin(joinData);
    await join.save();

    return res.status(httpStatus.CREATED).json({
        success: true,
        message: getMessage("TALENT_SHOW_JOIN_SUCCESS", language),
        data: join
    });
})

module.exports = {
    createTalentShowSession,
    updateTalentShowSession,
    getTalentShowSessionsList,
    joinTalentShow
};