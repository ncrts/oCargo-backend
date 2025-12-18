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
const TalentBadgeMaster = require('../../models/talentBadgeMaster.model');

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

    const validStatuses = ['Schedule', 'Lobby', 'Start', 'Stop', 'completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_STATUS_INVALID", language),
            data: null
        });
    }

    const session = await TalentShowSession.findById(id);
    if (!session) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_NOT_FOUND", language),
            data: null
        });
    }

    let updateFields = { status };
    let isLobbyTransition = false;
    let isStartTransition = false;

    if (
        req.franchiseeUser &&
        status === 'Lobby' &&
        session.status !== 'Lobby'
    ) {
        updateFields.startTime = Date.now();
        isLobbyTransition = true;
    }

    // Detect transition to Start
    if (status === 'Start' && session.status !== 'Start') {
        isStartTransition = true;
    }

    session.set(updateFields);
    await session.save();

    // If transitioning to Lobby, create RTDB entry for session and participants
    if (isLobbyTransition) {
        try {
            const participants = await TalentShowJoin.find({
                talentShowId: session._id,
                joinType: 'Participant',
                isDeleted: false,
                isRemoved: false
            }).populate({
                path: 'clientId',
                select: 'profileAvatar pseudoName profileImageCloudId'
            });

            const participantData = {};
            participants.forEach(p => {
                if (p.clientId && p.clientId._id) {
                    participantData[p.clientId._id] = {
                        participantId: p.clientId._id,
                        participantName: p.perfomerName ? p.perfomerName : (p.clientId.pseudoName || 'Anonymous'),
                        talent: p.performanceTitle || '',
                        talentDesc: p.performanceDescription || '',
                        participantProfilePic: (p.clientId.profileImageCloudId || '') ? (s3BaseUrl + p.clientId.profileImageCloudId) : '',
                        pseudoName: p.clientId.pseudoName ? p.clientId.pseudoName : '',
                        sequence: p.sequence || null
                    };
                }
            });

            const sessionInfo = {
                talentShowName: session.name,
                totalRounds: session.totalSessionShowRound || 2,
                currentRound: session.currentRound || 1,
                votingTimeInSec: 120,
                canVote: true,
                sessionStatus: 'Lobby',
                participants: participantData,
                currentParticipantId: Object.keys(participantData)[0] || ""
            };

            await firebaseDB.ref(`talentShowSession/${session._id}`).set(sessionInfo);
        } catch (err) {
            console.error('RTDB write error:', err);
        }
    }

    // If transitioning to Start, update sessionStatus in RTDB
    if (isStartTransition) {
        try {
            await firebaseDB.ref(`talentShowSession/${session._id}/sessionStatus`).set('Start');
        } catch (err) {
            console.error('RTDB update error (Start):', err);
        }
    }

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
        .populate({
            path: 'franchiseInfoId',
            select: 'name'
        })
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
    const performanceTitle = req.body.performanceTitle || '';
    const performanceDescription = req.body.performanceDescription || '';
    const perfomerName = req.body.perfomerName || '';

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
        sequence: participantCount + 1,
        performanceTitle: performanceTitle,
        performanceDescription: performanceDescription,
        perfomerName: perfomerName
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
    // PIN -> PIN OR CHECK 
    if (!req.body.pin) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_PIN_OR_QR_REQUIRED", language),
            data: null
        });
    }
    if (!req.body.clientId) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("CLIENTID_REQUIRED", language),
            data: null
        });
    }

    const now = Date.now();
    const language = res.locals.language;
    let clientId = req.body.clientId;
    let pin = req.body.pin || null;
    let joinType = null
    let session = null;

    let talentShowSessionAudiencePin = await TalentShowSession.findOne({ audienceGamePin: pin });
    if (talentShowSessionAudiencePin) {
        joinType = 'Audience';
        session = talentShowSessionAudiencePin;
    }

    let talentShowSessionJuryPin = await TalentShowSession.findOne({ juryJoinGamePin: pin });
    if (talentShowSessionJuryPin) {
        joinType = 'Jury';
        session = talentShowSessionJuryPin;
    }

    if (!talentShowSessionJuryPin && !talentShowSessionAudiencePin) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_PIN_INVALID", language),
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

    // Prevent duplicate join for this session, client, and joinType
    const existing = await TalentShowJoin.findOne({ talentShowId: session._id, clientId, isDeleted: false, isRemoved: false });
    if (existing) {
        // If Jury, update isConnectedJury to true if not already, do not create new
        if (existing.joinType === 'Jury') {
            if (!existing.isConnectedJury) {
                existing.isConnectedJury = true;
                session.totalJuryConnectCount = (session.totalJuryConnectCount || 0) + 1;
                await existing.save();
                await session.save();
            }
            return res.status(httpStatus.OK).json({
                success: true,
                message: getMessage("TALENT_SHOW_ALREADY_JOINED", language),
                data: { session, join: existing }
            });
        } else if (existing.joinType === 'Participant') {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("TALENT_SHOW_ALREADY_JOINED_AS_PARTICIPANT", language),
                data: { session, join: existing }
            });
        } else {
            return res.status(httpStatus.OK).json({
                success: true,
                message: getMessage("TALENT_SHOW_ALREADY_JOINED", language),
                data: { session, join: existing }
            });
        }
    } else {
        if (joinType === 'Jury') {
            // Create join record for Jury
            return res.status(httpStatus.CREATED).json({
                success: false,
                message: getMessage("NEW_JURY_WITH_OUT_ASSIGN_NOT_JOIN", language),
                data: null
            });
        } else if (joinType === 'Audience') {
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
                data: { join, session }
            });
        }
    }

});

// Placeholder for managing voters (to be implemented)
const manageVoteOnOffAftherCompleteRounds = catchAsync(async (req, res) => {
    // To be implemented
    let language = res.locals.language;
    if (!req.body.sessionId) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_ID_REQUIRED", language),
            data: null
        });
    }
    let sessionId = req.body.sessionId;

    const sessionRef = firebaseDB.ref(`talentShowSession/${sessionId}`);
    const snapshot = await sessionRef.once('value');
    const sessionData = snapshot.val();

    let talentShowSession = await TalentShowSession.findById(sessionId);
    if (!talentShowSession) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_NOT_FOUND", language),
            data: null
        });
    }
    // Manage voting for round 1
    // Convert RTDB score object to TalentShowVote model format
    const votes = [];
    const scoreObj = sessionData.score || {};
    const talentShowId = req.body.sessionId;
    // const franchiseeInfoId = sessionData.franchiseeInfoId || null; // update if available in RTDB
    const votedAt = Date.now();
    for (const performerId in scoreObj) {
        const performerVotes = scoreObj[performerId];
        for (const clientId in performerVotes) {
            const { isJury, rating } = performerVotes[clientId];
            
            // Validate rating exists before pushing
            if (rating === undefined || rating === null) {
                console.warn(`Missing rating for performer ${performerId}, voter ${clientId}`);
                continue; // Skip this vote
            }
            
            votes.push({
                talentShowId,
                participantId: performerId,
                votedId: clientId,
                franchiseeInfoId: talentShowSession.franchiseInfoId || null,
                voterType: isJury ? 'jury' : 'audience',
                takeVote: rating,
                votedAt,
                votingRound: sessionData.currentRound
            });
        }
    }

    // Check if we have any valid votes
    if (votes.length === 0) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_NO_VOTES_FOUND", language),
            data: null
        });
    }

    await updateRoundDataForParticipants(votes, sessionData.currentRound, talentShowId);

    await TalentShowVote.insertMany(votes);

    await firebaseDB.ref(`talentShowSession/${sessionId}/canVote`).set(false);
    await firebaseDB.ref(`talentShowSession/${sessionId}/score`).remove();
    await firebaseDB.ref(`talentShowSession/${sessionId}/alreadyPerformed`).remove();

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("TALENT_SHOW_SESSION_RDTB_FETCH_SUCCESS", language),
        data: votes
    });
});


// Utility: Calculate roundData from votes array and update TalentShowJoin
async function updateRoundDataForParticipants(votes, round = 1, talentShowId) {
    // Group votes by participantId
    const grouped = {};
    for (const v of votes) {
        if (!grouped[v.participantId]) grouped[v.participantId] = [];
        grouped[v.participantId].push(v);
    }

    // For each participant, calculate roundData and update TalentShowJoin
    for (const participantId in grouped) {
        const participantVotes = grouped[participantId];
        const juryVotes = participantVotes.filter(v => v.voterType === 'jury');
        const audienceVotes = participantVotes.filter(v => v.voterType === 'audience');
        const allVotes = participantVotes;

        const totalJuryCount = juryVotes.length;
        const totalJuryVotePoint = juryVotes.reduce((sum, v) => sum + v.takeVote, 0);
        const totalAvgOfVoteJury = totalJuryCount ? totalJuryVotePoint / totalJuryCount : 0;

        const totalAudience = audienceVotes.length;
        const totalAudienceVotePoint = audienceVotes.reduce((sum, v) => sum + v.takeVote, 0);
        const totalAvgVoteOfAudience = totalAudience ? totalAudienceVotePoint / totalAudience : 0;

        const totalVoterCount = allVotes.length;
        const totalVotePoint = allVotes.reduce((sum, v) => sum + v.takeVote, 0);
        const totalAvgVote = totalVoterCount ? totalVotePoint / totalVoterCount : 0;

        const roundData = {
            round,
            totalJuryCount,
            totalJuryVotePoint,
            totalAvgOfVoteJury,
            totalAudience,
            totalAudienceVotePoint,
            totalAvgVoteOfAudience,
            totalVoterCount,
            totalAvgVote,
            isQualified: false // Set as needed
        };

        // Update the participant's TalentShowJoin document
        await TalentShowJoin.updateOne(
            { clientId: participantId, talentShowId },
            { $push: { roundData } }
        );
    }
}


// Helper function to award special badges for final round
async function awardSpecialBadges(sessionId, finalRound) {
    // Get all participants with their final round data
    const participants = await TalentShowJoin.find({
        talentShowId: sessionId,
        joinType: 'Participant',
        isDeleted: false,
        isRemoved: false
    }).populate('clientId', 'pseudoName');

    let bestPerformer = null;
    let juryFavorite = null;
    let publicFavorite = null;

    let maxOverallScore = -1;
    let maxJuryScore = -1;
    let maxAudienceScore = -1;

    // Find winners for each category
    for (const participant of participants) {
        const finalRoundData = (participant.roundData || []).find(r => r.round === finalRound);
        
        if (!finalRoundData) continue;

        // Best Performer (highest overall average)
        if (finalRoundData.totalAvgVote > maxOverallScore) {
            maxOverallScore = finalRoundData.totalAvgVote;
            bestPerformer = {
                participantId: participant.clientId._id,
                name: participant.clientId.pseudoName,
                score: finalRoundData.totalAvgVote
            };
        }

        // Jury's Favorite (highest jury average)
        if (finalRoundData.totalAvgOfVoteJury > maxJuryScore) {
            maxJuryScore = finalRoundData.totalAvgOfVoteJury;
            juryFavorite = {
                participantId: participant.clientId._id,
                name: participant.clientId.pseudoName,
                score: finalRoundData.totalAvgOfVoteJury,
                juryVoteCount: finalRoundData.totalJuryCount
            };
        }

        // Public's Favorite (highest audience average)
        if (finalRoundData.totalAvgVoteOfAudience > maxAudienceScore) {
            maxAudienceScore = finalRoundData.totalAvgVoteOfAudience;
            publicFavorite = {
                participantId: participant.clientId._id,
                name: participant.clientId.pseudoName,
                score: finalRoundData.totalAvgVoteOfAudience,
                audienceVoteCount: finalRoundData.totalAudience
            };
        }
    }

    return {
        bestPerformer,
        juryFavorite,
        publicFavorite
    };
}

// Placeholder for qualifier board (to be implemented)
const scoreBoard = catchAsync(async (req, res) => {
    // Get sessionId from request
    const { sessionId } = req.body;
    const language = res.locals.language;
    if (!sessionId) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_ID_REQUIRED", language),
            data: null
        });
    }

    // Find all participants for this session
    const participants = await TalentShowJoin.find({
        talentShowId: sessionId,
        joinType: 'Participant',
        isDeleted: false,
        isRemoved: false
    }).populate({
        path: 'clientId',
        select: '-password' // all participant info except password
    });

    // Get current round from session
    const session = await TalentShowSession.findById(sessionId);
    if (!session) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_NOT_FOUND", language),
            data: null
        });
    }
    const currentRound = session.currentRound || 1;

    // Prepare new structure: { score, participantObj }
    let result = participants.map(p => {
        const roundData = (p.roundData || []).find(r => r.round === currentRound) || {};
        let participantObj = {};
        if (p.clientId) {
            participantObj = {
                participantId: p.clientId._id,
                participantName: p.perfomerName ? p.perfomerName : (p.clientId.pseudoName || 'Anonymous'),
                talent: p.performanceTitle || '',
                talentDesc: p.performanceDescription || '',
                participantProfilePic: (p.clientId.profileImageCloudId || '') ? (s3BaseUrl + p.clientId.profileImageCloudId) : '',
                pseudoName: p.clientId.pseudoName ? p.clientId.pseudoName : '',
                sequence: p.sequence || null
            };
        }
        return {
            _id: p._id,
            score: roundData.totalAvgVote || 0,
            participantObj,
            roundData: roundData,
        };
    });

    // Sort by score (descending)
    result.sort((a, b) => b.score - a.score);

    // Qualification logic
    if (currentRound === 1) {
        // Qualify top 50% (rounded up)
        const qualifyCount = Math.ceil(result.length / 2);
        const qualifiedIds = result.slice(0, qualifyCount).map(r => r._id.toString());
        // Update isQualified in DB for round 1
        await Promise.all(result.map(async (r, idx) => {
            if (qualifiedIds.includes(r._id.toString())) {
                await TalentShowJoin.updateOne(
                    { _id: r._id, 'roundData.round': 1 },
                    { $set: { 'roundData.$.isQualified': true } }
                );
                // Also update in-memory for response
                if (r.roundData && r.roundData.round === 1) r.roundData.isQualified = true;
            } else {
                await TalentShowJoin.updateOne(
                    { _id: r._id, 'roundData.round': 1 },
                    { $set: { 'roundData.$.isQualified': false } }
                );
                if (r.roundData && r.roundData.round === 1) r.roundData.isQualified = false;
            }
        }));
    } else if (currentRound === 2) {
        // Qualify top 3
        const qualifyCount = Math.min(3, result.length);
        const qualifiedIds = result.slice(0, qualifyCount).map(r => r._id.toString());
        await Promise.all(result.map(async (r, idx) => {
            if (qualifiedIds.includes(r._id.toString())) {
                await TalentShowJoin.updateOne(
                    { _id: r._id, 'roundData.round': 2 },
                    { $set: { 'roundData.$.isQualified': true } }
                );
                if (r.roundData && r.roundData.round === 2) r.roundData.isQualified = true;
            } else {
                await TalentShowJoin.updateOne(
                    { _id: r._id, 'roundData.round': 2 },
                    { $set: { 'roundData.$.isQualified': false } }
                );
                if (r.roundData && r.roundData.round === 2) r.roundData.isQualified = false;
            }
        }));
    }

    // Include isQualified in response
    result = result.map(r => ({
        score: r.score,
        participantObj: r.participantObj,
        isQualified: r.roundData?.isQualified || false
    }));

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("TALENT_SHOW_SCOREBOARD_FETCH_SUCCESS", language),
        data: result
    });
});

const changedTalentRound = catchAsync(async (req, res) => {
    const { sessionId } = req.body;
    const language = res.locals.language;

    // Validate sessionId
    if (!sessionId) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_ID_REQUIRED", language),
            data: null
        });
    }

    // Validate sessionId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_ID_INVALID", language),
            data: null
        });
    }

    // Get session from MongoDB
    const session = await TalentShowSession.findById(sessionId);
    if (!session) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_NOT_FOUND", language),
            data: null
        });
    }

    const currentRound = session.currentRound || 1;
    const totalRounds = session.totalSessionShowRound || 2;

    // Check if current round is the final round - mark session as completed
    if (currentRound === totalRounds) {
        try {
            // Calculate special badges for final round
            const specialBadges = await awardSpecialBadges(sessionId, currentRound);

            // Get all participants with their final round data for ranking
            const allParticipants = await TalentShowJoin.find({
                talentShowId: sessionId,
                joinType: 'Participant',
                isDeleted: false,
                isRemoved: false
            }).populate('clientId', 'pseudoName profileImageCloudId profileAvatar');

            // Create ranking array based on final round scores (sorted descending by score)
            const rankings = allParticipants.map(p => {
                const finalRoundData = (p.roundData || []).find(r => r.round === currentRound) || {};
                return {
                    clientId: p.clientId._id,
                    pseudoName: p.clientId.pseudoName || 'Anonymous',
                    profileAvatar: p.clientId.profileImageCloudId ? (s3BaseUrl + p.clientId.profileImageCloudId) : (p.clientId.profileAvatar || ''),
                    totalVotingPoint: finalRoundData.totalAvgVote || 0
                };
            }).sort((a, b) => b.totalVotingPoint - a.totalVotingPoint);

            // Map to store special badge winners
            const specialBadgeWinners = new Map();
            
            if (specialBadges.bestPerformer) {
                const pId = specialBadges.bestPerformer.participantId.toString();
                if (!specialBadgeWinners.has(pId)) specialBadgeWinners.set(pId, []);
                specialBadgeWinners.get(pId).push('BEST_PERFORMER');
            }
            
            if (specialBadges.juryFavorite) {
                const pId = specialBadges.juryFavorite.participantId.toString();
                if (!specialBadgeWinners.has(pId)) specialBadgeWinners.set(pId, []);
                specialBadgeWinners.get(pId).push('JURY_FAVORITE');
            }
            
            if (specialBadges.publicFavorite) {
                const pId = specialBadges.publicFavorite.participantId.toString();
                if (!specialBadgeWinners.has(pId)) specialBadgeWinners.set(pId, []);
                specialBadgeWinners.get(pId).push('PUBLIC_FAVORITE');
            }

            // Build podium with top 3 players
            const podium = [];
            const top3Players = rankings.slice(0, 3);

            // Fetch all required badges from TalentBadgeMaster
            const rankBadgeCodes = ['GOLD_MEDAL', 'SILVER_MEDAL', 'BRONZE_MEDAL'];
            const allBadgeCodes = [...rankBadgeCodes, 'BEST_PERFORMER', 'JURY_FAVORITE', 'PUBLIC_FAVORITE'];
            const badgeRecords = await TalentBadgeMaster.find({
                badgeCode: { $in: allBadgeCodes },
                isActive: true
            });

            // Create badge lookup map
            const badgeLookup = {};
            badgeRecords.forEach(badge => {
                badgeLookup[badge.badgeCode] = {
                    id: badge._id,
                    badgeCode: badge.badgeCode,
                    name: badge.name || { en_us: badge.badgeCode, fr_fr: badge.badgeCode },
                    iconUrl: badge.iconUrl ? (s3BaseUrl + badge.iconUrl) : ''
                };
            });

            // Build podium for top 3 players with all badges populated
            for (let i = 0; i < top3Players.length; i++) {
                const player = top3Players[i];
                const rank = i + 1;
                const playerId = player.clientId.toString();
                const badges = [];

                // Add ranking badge (Gold/Silver/Bronze)
                const rankBadgeCode = rankBadgeCodes[i];
                if (badgeLookup[rankBadgeCode]) {
                    badges.push(badgeLookup[rankBadgeCode]);
                }

                // Add special badges if this player won any
                const specialBadgeCodes = specialBadgeWinners.get(playerId) || [];
                specialBadgeCodes.forEach(badgeCode => {
                    if (badgeLookup[badgeCode]) {
                        badges.push(badgeLookup[badgeCode]);
                    }
                });

                podium.push({
                    playerId: player.clientId,
                    pseudoName: player.pseudoName,
                    profileAvatar: player.profileAvatar,
                    totalVotingPoint: player.totalVotingPoint,
                    rank: rank,
                    badges: badges,
                    joinedAt: Date.now()
                });
            }

            // Update MongoDB session status to completed with podium
            session.status = 'Completed';
            session.podium = podium;
            await session.save();

            // Update RTDB session status to Completed with badge info
            await firebaseDB.ref(`talentShowSession/${sessionId}`).update({
                sessionStatus: 'Completed',
                podium: podium,
                specialBadges: {
                    bestPerformer: specialBadges.bestPerformer,
                    juryFavorite: specialBadges.juryFavorite,
                    publicFavorite: specialBadges.publicFavorite
                }
            });

            return res.status(httpStatus.OK).json({
                success: true,
                message: getMessage("TALENT_SHOW_SESSION_COMPLETED_SUCCESS", language),
                data: {
                    sessionId: session._id,
                    status: 'completed',
                    finalRound: currentRound,
                    totalRounds: totalRounds,
                    podium: podium,
                    specialBadges: specialBadges
                }
            });
        } catch (err) {
            console.error('Error completing talent show session:', err);
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: getMessage("TALENT_SHOW_RTDB_UPDATE_FAILED", language),
                data: null
            });
        }
    }

    const newRound = currentRound + 1;

    // Check if we can advance to next round
    if (newRound > totalRounds) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_MAX_ROUNDS_REACHED", language),
            data: null
        });
    }

    // Get all participants with current round qualification status
    const allParticipants = await TalentShowJoin.find({
        talentShowId: sessionId,
        joinType: 'Participant',
        isDeleted: false,
        isRemoved: false
    }).populate({
        path: 'clientId',
        select: 'pseudoName profileAvatar talent talentDesc profileImageCloudId'
    });

    // Filter qualified participants for current round
    const qualifiedParticipants = allParticipants.filter(p => {
        const roundData = (p.roundData || []).find(r => r.round === currentRound);
        return roundData && roundData.isQualified === true;
    });

    if (qualifiedParticipants.length === 0) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_NO_QUALIFIED_PARTICIPANTS", language),
            data: null
        });
    }

    // Build participants object for RTDB
    const participantsData = {};
    qualifiedParticipants.forEach(p => {
        if (p.clientId && p.clientId._id) {
            participantsData[p.clientId._id.toString()] = {
                participantId: p.clientId._id,
                participantName: p.perfomerName ? p.perfomerName : (p.clientId.pseudoName || 'Anonymous'),
                talent: p.performanceTitle || '',
                talentDesc: p.performanceDescription || '',
                participantProfilePic: (p.clientId.profileImageCloudId || '') ? (s3BaseUrl + p.clientId.profileImageCloudId) : '',
                pseudoName: p.clientId.pseudoName ? p.clientId.pseudoName : '',
                sequence: p.sequence || null
            };
        }
    });

    // Get first qualified participant ID
    const firstQualifiedId = qualifiedParticipants.length > 0 && qualifiedParticipants[0].clientId
        ? qualifiedParticipants[0].clientId._id.toString()
        : '';

    // Update MongoDB session
    session.currentRound = newRound;
    await session.save();

    // Update TalentShowJoin currentRound for all qualified participants
    await TalentShowJoin.updateMany(
        {
            talentShowId: sessionId,
            joinType: 'Participant',
            clientId: { $in: qualifiedParticipants.map(p => p.clientId._id) },
            isDeleted: false,
            isRemoved: false
        },
        {
            $set: {
                currentRound: newRound,
                isPerformed: false
            }
        }
    );

    // Remove non-qualified participants (soft removal)
    const nonQualifiedIds = allParticipants
        .filter(p => !qualifiedParticipants.find(qp => qp._id.toString() === p._id.toString()))
        .map(p => p._id);

    if (nonQualifiedIds.length > 0) {
        await TalentShowJoin.updateMany(
            { _id: { $in: nonQualifiedIds } },
            { $set: { isRemoved: true } }
        );
    }

    // Update RTDB
    try {
        const rtdbUpdate = {
            participants: participantsData,
            currentParticipantId: firstQualifiedId,
            currentRound: newRound,
            totalRounds: session.totalSessionShowRound || 2,
            votingTimeInSec: 120,
            canVote: true,
            sessionStatus: session.status || 'Start',
            talentShowName: session.name || ''
        };

        // Update RTDB - set new data
        await firebaseDB.ref(`talentShowSession/${sessionId}`).update(rtdbUpdate);

        // Remove alreadyPerformed and score arrays
        await firebaseDB.ref(`talentShowSession/${sessionId}/alreadyPerformed`).remove();
        await firebaseDB.ref(`talentShowSession/${sessionId}/score`).remove();

    } catch (err) {
        console.error('RTDB update error:', err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: getMessage("TALENT_SHOW_RTDB_UPDATE_FAILED", language),
            data: null
        });
    }

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("TALENT_SHOW_ROUND_CHANGED_SUCCESS", language),
        data: {
            sessionId: session._id,
            previousRound: currentRound,
            currentRound: newRound,
            totalQualified: qualifiedParticipants.length,
            totalRemoved: nonQualifiedIds.length,
            qualifiedParticipants: qualifiedParticipants.map(p => ({
                clientId: p.clientId._id,
                pseudoName: p.clientId.pseudoName,
                sequence: p.sequence
            }))
        }
    });
});

const disqualifyParticipant = catchAsync(async (req, res) => {
    const { sessionId, clientId } = req.body;
    const language = res.locals.language;

    // Validate sessionId
    if (!sessionId) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_ID_REQUIRED", language),
            data: null
        });
    }

    // Validate clientId
    if (!clientId) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("CLIENTID_REQUIRED", language),
            data: null
        });
    }

    // Validate sessionId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_ID_INVALID", language),
            data: null
        });
    }

    // Validate clientId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("CLIENTID_INVALID", language),
            data: null
        });
    }

    // Get session from MongoDB
    const session = await TalentShowSession.findById(sessionId);
    if (!session) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("TALENT_SHOW_SESSION_NOT_FOUND", language),
            data: null
        });
    }

    // Find participant join record
    const participantJoin = await TalentShowJoin.findOne({
        talentShowId: sessionId,
        clientId: clientId,
        joinType: 'Participant',
        isDeleted: false,
        isRemoved: false
    }).populate({
        path: 'clientId',
        select: 'pseudoName profileAvatar talent talentDesc'
    });

    if (!participantJoin) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("TALENT_SHOW_PARTICIPANT_NOT_FOUND", language),
            data: null
        });
    }

    // Update MongoDB - set isRemoved to true
    participantJoin.isRemoved = true;
    await participantJoin.save();

    // Update RTDB
    try {
        const sessionRef = firebaseDB.ref(`talentShowSession/${sessionId}`);
        const snapshot = await sessionRef.once('value');
        const sessionData = snapshot.val();

        if (sessionData) {
            const participants = sessionData.participants || {};
            const score = sessionData.score || {};
            const disqualifiedParticipants = sessionData.disqualifiedParticipants || {};

            // Get participant data before removing
            const participantData = participants[clientId] || null;
            const participantScore = score[clientId] || null;

            // Create disqualified entry
            if (participantData || participantScore) {
                disqualifiedParticipants[clientId] = {
                    participantInfo: participantData,
                    score: participantScore,
                    disqualifiedAt: Date.now(),
                    reason: 'Manual disqualification'
                };
            }

            // Remove from participants and score
            if (participants[clientId]) {
                delete participants[clientId];
            }
            if (score[clientId]) {
                delete score[clientId];
            }

            // Update RTDB with new data
            await sessionRef.update({
                participants: participants,
                score: score,
                disqualifiedParticipants: disqualifiedParticipants
            });
        }
    } catch (err) {
        console.error('RTDB update error:', err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: getMessage("TALENT_SHOW_RTDB_UPDATE_FAILED", language),
            data: null
        });
    }

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("TALENT_SHOW_PARTICIPANT_DISQUALIFIED_SUCCESS", language),
        data: {
            sessionId: session._id,
            participantId: clientId,
            participantName: participantJoin.clientId?.pseudoName || 'Anonymous',
            disqualifiedAt: Date.now()
        }
    });
});

const talentShowPerformerHistory = catchAsync(async (req, res) => {
    const { clientId } = req.body;
    const language = res.locals.language;

    // Validate clientId is provided
    if (!clientId) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("CLIENTID_REQUIRED", language),
            data: null
        });
    }

    // Validate clientId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("CLIENTID_INVALID", language),
            data: null
        });
    }

    // Check if client exists and is not deleted
    const client = await Player.findOne({ _id: clientId, isDeleted: false });
    if (!client) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("PLAYER_NOT_FOUND", language),
            data: null
        });
    }

    // Find all talent show sessions where this client joined as participant
    const participantJoins = await TalentShowJoin.find({
        clientId,
        joinType: 'Participant',
        isDeleted: false,
        isRemoved: false
    })
        .populate({
            path: 'talentShowId',
            select: 'name description status startTime currentRound totalSessionShowRound franchiseInfoId podium createdAt',
            populate: {
                path: 'franchiseInfoId',
                select: 'name'
            }
        })
        .populate({
            path: 'franchiseeInfoId',
            select: 'name'
        })
        .sort({ joinedAt: -1 });

    // Filter out any joins where talentShowId was deleted/not found
    const validJoins = participantJoins.filter(join => join.talentShowId !== null);

    // Format response data with rank and badges
    const sessions = await Promise.all(validJoins.map(async (join) => {
        let rank = null;
        let badges = [];

        if (join.talentShowId && join.talentShowId._id) {
            // Get all participants for this session to calculate rank
            const allParticipants = await TalentShowJoin.find({
                talentShowId: join.talentShowId._id,
                joinType: 'Participant',
                isDeleted: false,
                isRemoved: false
            }).select('clientId roundData');

            // Determine which round to use for ranking (use the highest round available)
            const sessionRound = join.talentShowId.currentRound || 1;

            // Create ranking array based on final round performance
            const rankings = allParticipants.map(p => {
                const finalRoundData = (p.roundData || []).find(r => r.round === sessionRound) || {};
                return {
                    clientId: p.clientId.toString(),
                    score: finalRoundData.totalAvgVote || 0,
                    isQualified: finalRoundData.isQualified || false
                };
            });

            // Sort by score descending
            rankings.sort((a, b) => b.score - a.score);

            // Find current participant's rank
            const participantRanking = rankings.findIndex(r => r.clientId === clientId.toString());
            if (participantRanking !== -1) {
                rank = participantRanking + 1;
                const participantData = rankings[participantRanking];

                // Determine badges based on rank and qualification
                if (rank === 1) {
                    badges.push('Gold Medal', 'Winner');
                } else if (rank === 2) {
                    badges.push('Silver Medal', 'Runner-up');
                } else if (rank === 3) {
                    badges.push('Bronze Medal', 'Third Place');
                }

                // Check if qualified for next round (from round 1)
                const round1Data = (join.roundData || []).find(r => r.round === 1);
                if (round1Data && round1Data.isQualified) {
                    badges.push('Round 1 Qualifier');
                }

                // Check if qualified in round 2 (final)
                const round2Data = (join.roundData || []).find(r => r.round === 2);
                if (round2Data && round2Data.isQualified) {
                    badges.push('Finalist');
                }

                // Participation badge for all
                if (join.isPerformed) {
                    badges.push('Performer');
                }
            }

            // Check for special badges (only for completed sessions)
            if (join.talentShowId.status === 'Completed' && join.talentShowId.podium) {
                const podiumEntry = join.talentShowId.podium.find(
                    p => p.playerId && p.playerId.toString() === clientId.toString()
                );
                if (podiumEntry && podiumEntry.badges) {
                    podiumEntry.badges.forEach(badge => {
                        if (badge.badgeCode === 'BEST_PERFORMER') {
                            badges.push('Best Performer');
                        } else if (badge.badgeCode === 'JURY_FAVORITE') {
                            badges.push("Jury's Favorite");
                        } else if (badge.badgeCode === 'PUBLIC_FAVORITE') {
                            badges.push("Public's Favorite");
                        }
                    });
                }
            }
        }

        return {
            joinId: join._id,
            session: join.talentShowId,
            sequence: join.sequence,
            currentRound: join.currentRound,
            isPerformed: join.isPerformed,
            joinedAt: join.joinedAt,
            roundData: join.roundData || [],
            franchiseeInfo: join.franchiseeInfoId,
            rank: rank,
            badges: badges
        };
    }));

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("TALENT_SHOW_PERFORMER_HISTORY_FETCH_SUCCESS", language),
        data: sessions,
        count: sessions.length
    });
})

const talentShowFranchiseeHistory = catchAsync(async (req, res) => {
    const { franchiseeInfoId } = req.body;
    const language = res.locals.language;

    // Validate franchiseeInfoId is provided
    if (!franchiseeInfoId) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("FRANCHISE_INFO_ID_REQUIRED", language),
            data: null
        });
    }

    // Validate franchiseeInfoId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(franchiseeInfoId)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("FRANCHISE_INFO_ID_INVALID", language),
            data: null
        });
    }

    // Check if franchisee exists
    const franchisee = await FranchiseeInfo.findOne({ _id: franchiseeInfoId });
    if (!franchisee) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("FRANCHISE_INFO_NOT_FOUND", language),
            data: null
        });
    }

    // Find all talent show sessions for this franchisee
    const sessions = await TalentShowSession.find({
        franchiseInfoId: franchiseeInfoId
    })
        .populate({
            path: 'franchiseInfoId',
            select: 'name address'
        })
        .populate({
            path: 'createdBy',
            select: 'name email'
        })
        .sort({ createdAt: -1 });

    // Enrich each session with participant, jury, and audience counts
    const enrichedSessions = await Promise.all(sessions.map(async (session) => {
        // Get participant details
        const participants = await TalentShowJoin.find({
            talentShowId: session._id,
            joinType: 'Participant',
            isDeleted: false,
            isRemoved: false
        }).populate({
            path: 'clientId',
            select: 'pseudoName profileAvatar'
        });

        // Get jury details
        const jury = await TalentShowJoin.find({
            talentShowId: session._id,
            joinType: 'Jury',
            isDeleted: false,
            isRemoved: false
        }).populate({
            path: 'clientId',
            select: 'pseudoName profileAvatar'
        });

        // Get audience count
        const audienceCount = await TalentShowJoin.countDocuments({
            talentShowId: session._id,
            joinType: 'Audience',
            isDeleted: false,
            isRemoved: false
        });

        // Calculate all participants with scores based on current round
        const currentRound = session.currentRound || 1;
        const participantsWithScores = participants.map(p => {
            const roundData = (p.roundData || []).find(r => r.round === currentRound) || {};
            return {
                joinId: p._id,
                clientId: p.clientId?._id,
                pseudoName: p.clientId?.pseudoName || 'Anonymous',
                profileAvatar: p.clientId?.profileAvatar ? (s3BaseUrl + p.clientId.profileAvatar) : '',
                score: roundData.totalAvgVote || 0,
                sequence: p.sequence,
                isPerformed: p.isPerformed,
                currentRound: p.currentRound,
                joinedAt: p.joinedAt,
                roundData: p.roundData || []
            };
        });

        // Sort by score descending
        participantsWithScores.sort((a, b) => b.score - a.score);

        // Get top 3 for podium
        const topThree = participantsWithScores.slice(0, 3);

        // Get jury with full details
        const juryWithDetails = jury.map(j => ({
            joinId: j._id,
            clientId: j.clientId?._id,
            pseudoName: j.clientId?.pseudoName || 'Anonymous',
            profileAvatar: j.clientId?.profileAvatar ? (s3BaseUrl + j.clientId.profileAvatar) : '',
            isConnectedJury: j.isConnectedJury || false,
            joinedAt: j.joinedAt,
            currentRound: j.currentRound
        }));

        return {
            sessionId: session._id,
            name: session.name,
            description: session.description,
            status: session.status,
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            currentRound: session.currentRound,
            totalSessionShowRound: session.totalSessionShowRound,
            franchiseInfo: session.franchiseInfoId,
            createdBy: session.createdBy,
            totalParticipants: participants.length,
            totalJury: jury.length,
            totalAudience: audienceCount,
            participants: participantsWithScores,
            jury: juryWithDetails,
            topThreePerformers: topThree,
            audienceGamePin: session.audienceGamePin,
            juryJoinGamePin: session.juryJoinGamePin,
            podium: session.podium || [],
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
        };
    }));

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("TALENT_SHOW_FRANCHISEE_HISTORY_FETCH_SUCCESS", language),
        data: enrichedSessions,
        count: enrichedSessions.length
    });
});

/**
 * Bulk insert talent show badges
 * POST /talent-show/badges/bulk-insert
 * 
 * Request body:
 * {
 *   badges: [
 *     {
 *       badgeCode: String (required, uppercase),
 *       purpose: String (optional),
 *       name: { en_us: String, fr_fr: String },
 *       iconUrl: String (optional),
 *       priority: Number (optional, default: 1),
 *       isActive: Boolean (optional, default: true)
 *     }
 *   ]
 * }
 */
const bulkInsertTalentBadges = catchAsync(async (req, res) => {
    const { badges } = req.body;
    const language = res.locals.language;

    // Validate badges array
    if (!badges || !Array.isArray(badges) || badges.length === 0) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_BADGE_ARRAY_REQUIRED", language),
            data: null
        });
    }

    // Validate each badge has required badgeCode
    const invalidBadges = badges.filter(b => !b.badgeCode || typeof b.badgeCode !== 'string');
    if (invalidBadges.length > 0) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("TALENT_BADGE_CODE_REQUIRED", language),
            data: { invalidBadges }
        });
    }

    // Convert badgeCodes to uppercase
    const processedBadges = badges.map(badge => ({
        badgeCode: badge.badgeCode.toUpperCase(),
        purpose: badge.purpose || null,
        name: {
            en_us: badge.name?.en_us || null,
            fr_fr: badge.name?.fr_fr || null
        },
        iconUrl: badge.iconUrl || null,
        priority: badge.priority || 1,
        isActive: badge.isActive !== undefined ? badge.isActive : true
    }));

    try {
        // Use insertMany with ordered:false to continue on duplicate errors
        const result = await TalentBadgeMaster.insertMany(processedBadges, { 
            ordered: false,
            rawResult: true 
        });

        return res.status(httpStatus.CREATED).json({
            success: true,
            message: getMessage("TALENT_BADGE_BULK_INSERT_SUCCESS", language),
            data: {
                inserted: result.insertedCount || result.length,
                badges: result.ops || result
            }
        });
    } catch (error) {
        // Handle duplicate key errors
        if (error.code === 11000) {
            const insertedCount = error.result?.nInserted || 0;
            const duplicates = error.writeErrors?.map(e => {
                const match = e.errmsg.match(/dup key: { badgeCode: "([^"]+)" }/);
                return match ? match[1] : 'unknown';
            }) || [];

            return res.status(httpStatus.PARTIAL_CONTENT).json({
                success: true,
                message: getMessage("TALENT_BADGE_BULK_INSERT_PARTIAL_SUCCESS", language),
                data: {
                    inserted: insertedCount,
                    duplicates: duplicates,
                    error: 'Some badges already exist'
                }
            });
        }

        // Handle other errors
        console.error('Bulk insert error:', error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: getMessage("TALENT_BADGE_BULK_INSERT_FAILED", language),
            data: null
        });
    }
});



module.exports = {
    createTalentShowSession,
    updateTalentShowSession,
    getTalentShowSessionsList,
    joinTalentShowAsParticipant,
    joinTalentShowAsJuryFromWeb,
    joinTalentShowByPinOrQr,
    manageVoteOnOffAftherCompleteRounds,
    scoreBoard,
    changedTalentRound,
    disqualifyParticipant,
    talentShowPerformerHistory,
    talentShowFranchiseeHistory,
    bulkInsertTalentBadges
};