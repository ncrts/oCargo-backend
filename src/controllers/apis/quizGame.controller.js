const path = require('path');
const base64 = require('base-64')
const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
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


const { getMessage } = require("../../../config/languageLocalization")

const { firebaseDB } = require('../../../config/firebaseNotificationConfig');

const s3BaseUrl = process.env.S3_BUCKET_NAME && process.env.S3_REGION ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/` : '';


/**
 * Helper: Return translated values
 */
const translate = (cat, lang = "en_us") => {
    return {
        _id: cat._id,
        name: cat.name?.[lang] || cat.name?.en_us || null,
        description: cat.description?.[lang] || cat.description?.en_us || null,
        isActive: cat.isActive,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt
    };
};

// ================================
// 📌 Create Multiple Categories
// ================================
const createMultipleCategories = catchAsync(async (req, res) => {
    if (req.body.adminData == true) {
        if (!Array.isArray(req.body.categories)) {
            return res.status(httpStatus.OK).json({ status: false, message: "Request body must be an array of categories." });
        }

        const categories = await QuizCategory.insertMany(req.body);
        return res.status(httpStatus.CREATED).json({ status: true, message: "Categories created successfully", data: categories });
    } else {
        return res.status(httpStatus.UNAUTHORIZED).json({ status: false, message: "Unauthorized access", data: null });
    }
});

/**
 * SINGLE API:
 * - GET ALL CATEGORIES
 * - GET SINGLE CATEGORY
 * 
 * Examples:
 * ✔ /category        → all categories
 * ✔ /category?id=123 → single category
 * Language is detected from request headers (via languageDetectionMiddleware)
 * ✔ /category with header: Accept-Language: fr_fr
 * ✔ /category?id=123 with header: Accept-Language: en_us
 */
const getCategory = catchAsync(async (req, res) => {
    const lang = res.locals.language || "en_us"; // Get language from headers via middleware
    const id = req.query.id;

    // If ID is provided → fetch single category
    if (id) {
        const category = await QuizCategory.findOne({ "_id": id, "isActive": true });

        if (!category) {
            return res.status(httpStatus.OK).json({
                status: false,
                message: getMessage("NO_CATEGORY_FOUND", res.locals.language),
                data: null
            });
        }

        return res.status(httpStatus.OK).json({
            status: true,
            message: getMessage("CATEGORY_FETCH_SUCCESS", res.locals.language),
            data: { categories: translate(category, lang), totalLength: 1 }
        });
    }


    const categories = await QuizCategory.find({ "isActive": true }).sort({ createdAt: -1 });

    return res.status(httpStatus.OK).json({
        status: true,
        message: getMessage("CATEGORY_LIST_FETCH_SUCCESS", res.locals.language),
        data: { categories: categories.map(cat => translate(cat, lang)), totalLength: categories.length }
    });
});


/**
 * Instantly creates a new quiz with comprehensive validation.
 * POST /quiz/instant
 * Input: franchiseeInfoId (required), title (required), description (required), 
 *        author.id (required), author.authorRole (required), category (required), 
 *        visibility (required), language (optional, default: en_us)
 * Returns: created quiz document with validated fields and populated references
 * 
 * Validation:
 * - franchiseeInfoId: Required and must exist in database
 * - title: Required non-empty string
 * - description: Required non-empty string
 * - author: Required object with id and authorRole properties
 * - author.id: Required, must be valid ObjectId
 * - author.authorRole: Required, must be "FranchisorUser" or "FranchiseeUser"
 * - category: Required and must exist in database
 * - visibility: Required, must be "Local" or "National"
 * - language: Optional, must be "en_us" or "fr_fr" if provided (default: en_us)
 * 
 * Response:
 * - 201 Created: Successfully created quiz with populated author and category
 * - 400 Bad Request: Validation failed with descriptive error message
 */
const createQuizInstant = catchAsync(async (req, res) => {

    const {
        franchiseeInfoId,
        franchisorInfoId,
        title,
        description,
        author,
        category,
        visibility,
        language,
        difficaltyLavel
    } = req.body;

    // ===== VALIDATION: franchiseeInfoId or franchisorInfoId =====
    if (!franchiseeInfoId && !franchisorInfoId) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("FRANCHISEE_OR_FRANCHISOR_INFO_ID_REQUIRED", res.locals.language),
            data: null
        });
    }
    let franchiseeExists = null;
    let franchisorExists = null;
    if (franchiseeInfoId) {
        franchiseeExists = await FranchiseeInfo.findById(franchiseeInfoId);
        if (!franchiseeExists) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("FRANCHISEE_INFO_NOT_FOUND_IN_DB", res.locals.language),
                data: null
            });
        }
    }
    if (franchisorInfoId) {
        franchisorExists = await FranchisorInfo.findById(franchisorInfoId);
        if (!franchisorExists) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("FRANCHISOR_INFO_NOT_FOUND_IN_DB", res.locals.language),
                data: null
            });
        }
    }

    // ===== VALIDATION: title =====
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("QUIZ_TITLE_REQUIRED", res.locals.language),
            data: null
        });
    }

    // ===== VALIDATION: description =====
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("QUIZ_DESCRIPTION_REQUIRED", res.locals.language),
            data: null
        });
    }

    // ===== VALIDATION: author object =====
    if (!author || typeof author !== 'object') {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("QUIZ_AUTHOR_REQUIRED", res.locals.language),
            data: null
        });
    }

    // ===== VALIDATION: author.id =====
    if (!author.id) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("QUIZ_AUTHOR_ID_REQUIRED", res.locals.language),
            data: null
        });
    }

    // ===== VALIDATION: author.authorRole =====
    if (!author.authorRole) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("QUIZ_AUTHOR_ROLE_REQUIRED", res.locals.language),
            data: null
        });
    }

    const validRoles = ['FranchisorUser', 'FranchiseeUser'];
    if (!validRoles.includes(author.authorRole)) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("QUIZ_AUTHOR_ROLE_INVALID", res.locals.language),
            data: null
        });
    }

    // ===== VALIDATION: category =====
    if (!category) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("QUIZ_CATEGORY_REQUIRED", res.locals.language),
            data: null
        });
    }

    // Check if category exists in database
    const categoryExists = await QuizCategory.findById(category);
    if (!categoryExists) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("QUIZ_CATEGORY_NOT_FOUND", res.locals.language),
            data: null
        });
    }

    // ===== VALIDATION: visibility =====
    if (!visibility) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("QUIZ_VISIBILITY_REQUIRED", res.locals.language),
            data: null
        });
    }

    const validVisibility = ['Local', 'National'];
    if (!validVisibility.includes(visibility)) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("QUIZ_VISIBILITY_INVALID", res.locals.language),
            data: null
        });
    }

    // ===== VALIDATION: language (optional) =====
    if (language) {
        const validLanguages = ['en_us', 'fr_fr'];
        if (!validLanguages.includes(language)) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_LANGUAGE_INVALID", res.locals.language),
                data: null
            });
        }
    }

    // ===== BUILD VALIDATED QUIZ DATA =====

    const quizData = {
        title: title.trim(),
        description: description.trim(),
        author: {
            id: author.id,
            authorRole: author.authorRole
        },
        category,
        visibility,
        language: language || 'en_us'
    };
    if (franchiseeInfoId) quizData.franchiseeInfoId = franchiseeInfoId;
    if (franchisorInfoId) quizData.franchisorInfoId = franchisorInfoId;
    if (difficaltyLavel) quizData.difficaltyLavel = difficaltyLavel;

    // Create and save quiz
    const quiz = new Quiz(quizData);
    await quiz.save();

    // Populate author and category for response
    const populatedQuiz = await Quiz.findById(quiz._id)
        .populate({ path: 'author.id', select: 'firstName lastName email role' })
        .populate({ path: 'category', select: 'name description' });

    return res.status(httpStatus.CREATED).json({
        success: true,
        message: getMessage("QUIZ_CREATED_SUCCESS", res.locals.language),
        data: populatedQuiz
    });
});

/**
 * Updates an existing quiz by ID with comprehensive validation.
 * PATCH /quiz/instant/:id
 * Input: quizId (required in URL), any updatable quiz fields
 * Updatable fields: title, description, author, category, visibility, language, status
 * Returns: updated quiz document with populated references
 * 
 * Validation:
 * - Quiz ID: Required and must exist in database
 * - At least one field must be provided for update
 * - title: Must be non-empty string if provided
 * - description: Must be non-empty string if provided
 * - author: Must contain id and authorRole if provided
 * - author.authorRole: Must be "FranchisorUser" or "FranchiseeUser" if provided
 * - category: Must exist in database if provided
 * - visibility: Must be "Local" or "National" if provided
 * - language: Must be "en_us" or "fr_fr" if provided
 * - status: Must be valid status enum value if provided
 * 
 * Response:
 * - 200 OK: Successfully updated quiz with populated references
 * - 400 Bad Request: Validation failed with descriptive error message
 * - 404 Not Found: Quiz ID not found
 */
const updateQuizInstant = catchAsync(async (req, res) => {
    const { id } = req.params;

    const {
        franchiseeInfoId,
        franchisorInfoId,
        title,
        description,
        author,
        category,
        visibility,
        language,
        status,
        difficaltyLavel
    } = req.body;

    // ===== VALIDATION: Quiz ID =====
    if (!id) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("QUIZ_ID_REQUIRED", res.locals.language),
            data: null
        });
    }

    // Check if quiz exists
    const existingQuiz = await Quiz.findById(id);
    if (!existingQuiz) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: getMessage("QUIZ_NOT_FOUND_FOR_UPDATE", res.locals.language),
            data: null
        });
    }

    // ===== VALIDATION: At least one field provided =====
    if (!title && !description && !author && !category && !visibility && !language && !status) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: getMessage("QUIZ_NO_FIELDS_PROVIDED", res.locals.language),
            data: null
        });
    }


    // ===== VALIDATION: franchiseeInfoId or franchisorInfoId if provided =====
    if (franchiseeInfoId) {
        const franchiseeExists = await FranchiseeInfo.findById(franchiseeInfoId);
        if (!franchiseeExists) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("FRANCHISEE_INFO_NOT_FOUND_IN_DB", res.locals.language),
                data: null
            });
        }
    }
    if (franchisorInfoId) {
        const franchisorExists = await FranchisorInfo.findById(franchisorInfoId);
        if (!franchisorExists) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("FRANCHISOR_INFO_NOT_FOUND_IN_DB", res.locals.language),
                data: null
            });
        }
    }

    // Build update fields with validation
    const updateFields = {};

    // ===== VALIDATION: title =====
    if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length === 0) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_TITLE_REQUIRED", res.locals.language),
                data: null
            });
        }
        updateFields.title = title.trim();
    }
    // Add franchiseeInfoId/franchisorInfoId if provided
    if (franchiseeInfoId) updateFields.franchiseeInfoId = franchiseeInfoId;
    if (franchisorInfoId) updateFields.franchisorInfoId = franchisorInfoId;
    if (difficaltyLavel) updateFields.difficaltyLavel = difficaltyLavel;

    // ===== VALIDATION: description =====
    if (description !== undefined) {
        if (typeof description !== 'string' || description.trim().length === 0) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_DESCRIPTION_REQUIRED", res.locals.language),
                data: null
            });
        }
        updateFields.description = description.trim();
    }

    // ===== VALIDATION: author =====
    if (author !== undefined) {
        if (!author || typeof author !== 'object') {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_AUTHOR_REQUIRED", res.locals.language),
                data: null
            });
        }

        // Validate author.id and author.authorRole
        if (!author.id || !author.authorRole) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_AUTHOR_NOT_VALID", res.locals.language),
                data: null
            });
        }

        const validRoles = ['FranchisorUser', 'FranchiseeUser'];
        if (!validRoles.includes(author.authorRole)) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_AUTHOR_ROLE_INVALID", res.locals.language),
                data: null
            });
        }

        updateFields.author = {
            id: author.id,
            authorRole: author.authorRole
        };
    }

    // ===== VALIDATION: category =====
    if (category !== undefined) {
        if (!category) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_CATEGORY_REQUIRED", res.locals.language),
                data: null
            });
        }

        // Check if category exists in database
        const categoryExists = await QuizCategory.findById(category);
        if (!categoryExists) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_CATEGORY_ID_INVALID", res.locals.language),
                data: null
            });
        }
        updateFields.category = category;
    }

    // ===== VALIDATION: visibility =====
    if (visibility !== undefined) {
        const validVisibility = ['Local', 'National'];
        if (!validVisibility.includes(visibility)) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_VISIBILITY_INVALID", res.locals.language),
                data: null
            });
        }
        updateFields.visibility = visibility;
    }

    // ===== VALIDATION: language =====
    if (language !== undefined) {
        const validLanguages = ['en_us', 'fr_fr'];
        if (!validLanguages.includes(language)) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_LANGUAGE_INVALID", res.locals.language),
                data: null
            });
        }
        updateFields.language = language;
    }

    // ===== VALIDATION: status =====
    if (status !== undefined) {
        const validStatus = ['DraftLocal', 'ActiveLocal', 'DraftNational', 'ActiveNational', 'InModeration', 'ModeratedAccepted', 'ModeratedRejected', 'HiddenLocal', 'HiddenNational'];
        if (!validStatus.includes(status)) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_STATUS_INVALID", res.locals.language),
                data: null
            });
        }
        updateFields.status = status;
    }

    // ===== PERFORM UPDATE =====
    const updatedQuiz = await Quiz.findByIdAndUpdate(id, { $set: updateFields }, { new: true })
        .populate({ path: 'author.id', select: 'firstName lastName email role' })
        .populate({ path: 'category', select: 'name description' });

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("QUIZ_UPDATED_SUCCESS", res.locals.language),
        data: updatedQuiz
    });
});


/**
 * Lists quizzes with comprehensive filters, validation, and search.
 * GET /quiz/instant/list
 * 
 * Query Parameters:
 * - id: Filter by quiz ID (exact match)
 * - franchiseeInfoId: Filter by franchiseeInfoId (exact match)
 * - title: Filter by title with regex search (case-insensitive)
 * - searchKey: Search by title (overrides title parameter if both provided)
 * - authorId: Filter by author ID (exact match)
 * - category: Filter by category ID or array of category IDs (comma-separated string or array)
 * - visibility: Filter by visibility (Local, National, or comma-separated array)
 * - status: Filter by status (or comma-separated array of statuses)
 * 
 * Validation:
 * - Validates category IDs exist in database
 * - Validates visibility values (Local, National)
 * - Validates status values (DraftLocal, ActiveLocal, DraftNational, ActiveNational, InModeration, ModeratedAccepted, ModeratedRejected, HiddenLocal, HiddenNational)
 * - Validates authorId exists in database
 * 
 * Returns: List of quizzes matching filters with populated author and category
 */
const getQuizInstantList = catchAsync(async (req, res) => {
    const {
        id,
        franchiseeInfoId,
        title,
        searchKey,
        authorId,
        category,
        visibility,
        status,
        limit = 20,
        skip = 0
    } = req.query;

    const filter = {};

    // ...existing code for filters...
    if (id) filter._id = id;
    if (franchiseeInfoId) filter.franchiseeInfoId = franchiseeInfoId;
    if (searchKey) {
        if (typeof searchKey !== 'string' || searchKey.trim().length === 0) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_TITLE_REQUIRED", res.locals.language),
                data: null
            });
        }
        filter.title = { $regex: searchKey.trim(), $options: 'i' };
    } else if (title) {
        if (typeof title !== 'string' || title.trim().length === 0) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("QUIZ_TITLE_REQUIRED", res.locals.language),
                data: null
            });
        }
        filter.title = { $regex: title.trim(), $options: 'i' };
    }
    if (authorId) filter['author.id'] = authorId;
    if (category) {
        let categoryArray = [];
        if (typeof category === 'string') {
            categoryArray = category.split(',').map(c => c.trim()).filter(c => c.length > 0);
        } else if (Array.isArray(category)) {
            categoryArray = category;
        }
        if (categoryArray.length > 0) {
            const validCategories = await QuizCategory.find({ _id: { $in: categoryArray } }).select('_id');
            if (validCategories.length !== categoryArray.length) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: getMessage("QUIZ_LIST_CATEGORY_INVALID", res.locals.language),
                    data: null
                });
            }
            if (categoryArray.length === 1) {
                filter.category = categoryArray[0];
            } else {
                filter.category = { $in: categoryArray };
            }
        }
    }
    if (visibility) {
        let visibilityArray = [];
        if (typeof visibility === 'string') {
            visibilityArray = visibility.split(',').map(v => v.trim()).filter(v => v.length > 0);
        } else if (Array.isArray(visibility)) {
            visibilityArray = visibility;
        }
        if (visibilityArray.length > 0) {
            const validVisibilities = ['Local', 'National'];
            const allValid = visibilityArray.every(v => validVisibilities.includes(v));
            if (!allValid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: getMessage("QUIZ_LIST_VISIBILITY_INVALID", res.locals.language),
                    data: null
                });
            }
            if (visibilityArray.length === 1) {
                filter.visibility = visibilityArray[0];
            } else {
                filter.visibility = { $in: visibilityArray };
            }
        }
    }
    if (status) {
        let statusArray = [];
        if (typeof status === 'string') {
            statusArray = status.split(',').map(s => s.trim()).filter(s => s.length > 0);
        } else if (Array.isArray(status)) {
            statusArray = status;
        }
        if (statusArray.length > 0) {
            const validStatus = ['DraftLocal', 'ActiveLocal', 'DraftNational', 'ActiveNational', 'InModeration', 'ModeratedAccepted', 'ModeratedRejected', 'HiddenLocal', 'HiddenNational'];
            const allValid = statusArray.every(s => validStatus.includes(s));
            if (!allValid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: getMessage("QUIZ_LIST_STATUS_INVALID", res.locals.language),
                    data: null
                });
            }
            if (statusArray.length === 1) {
                filter.status = statusArray[0];
            } else {
                filter.status = { $in: statusArray };
            }
        }
    }

    // Parse limit and skip as integers
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit) || 20)); // Max 100, default 20
    const pageSkip = Math.max(0, parseInt(skip) || 0);

    // Get total count for pagination info
    const totalCount = await Quiz.countDocuments(filter);

    // ===== EXECUTE QUERY WITH PAGINATION =====
    const quizzes = await Quiz.find(filter)
        .populate({ path: 'author.id', select: 'firstName lastName email role' })
        .populate({ path: 'category', select: 'name description' })
        .populate({ path: 'questions' })
        .sort({ createdAt: -1 })
        .limit(pageLimit)
        .skip(pageSkip);

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("QUIZ_LIST_FETCH_SUCCESS", res.locals.language),
        data: {
            quizzes,
            totalCount: totalCount,
            pagination: {
                limit: pageLimit,
                skip: pageSkip,
                page: Math.floor(pageSkip / pageLimit) + 1,
                totalPages: Math.ceil(totalCount / pageLimit)
            }
        }
    });
});




/**
 * Creates a quiz question with type-specific validation.
 * POST /quiz/question
 * 
 * Request body:
 * {
 *   quizId, categoryId, type (required)
 *   questionText, backgroundImage (optional), media (optional),
 *   options, multiSelect, trueAnswer, acceptedAnswers, puzzleOrder, slider, slideContent,
 *   explanation (optional), timeLimit, difficaltyLavel, imagePinFile, imagePinArrObj
 * }
 * 
 * Type-specific validation:
 * - Quiz: questionText, options (required); backgroundImage, media, multiSelect, explanation (optional)
 * - TrueFalse: questionText, trueAnswer (required); backgroundImage, media, explanation (optional)
 * - TypeAnswer: questionText, acceptedAnswers (required); backgroundImage, media, explanation (optional)
 * - Puzzle: questionText, puzzleOrder (required); backgroundImage, media, explanation (optional)
 * - Slider: questionText, slider (required); backgroundImage, media, explanation (optional)
 * - Slide: slideContent (required)
 * - imagePin: imagePinFile, imagePinArrObj (required); questionText, backgroundImage, media, explanation (optional)
 * 
 * Returns: created question with populated quizId and categoryId
 */
const createQuizQuestion = catchAsync(async (req, res) => {
    const {
        quizId,
        categoryId,
        type,
        questionText,
        backgroundImage,
        media,
        options,
        multiSelect,
        trueAnswer,
        acceptedAnswers,
        puzzleOrder,
        slider,
        slideContent,
        explanation,
        timeLimit,
        difficaltyLavel,
        imagePinFile,
        imagePinArrObj,
        maxScore
    } = req.body;

    let normalizedImagePins = null;

    // ===== BASIC VALIDATION =====
    if (!quizId || !categoryId || !type) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'quizId, categoryId, and type are required',
            data: null
        });
    }

    // Validate type is one of allowed types
    const validTypes = ['Quiz', 'TrueFalse', 'TypeAnswer', 'Puzzle', 'Slider', 'Slide', 'imagePin'];
    if (!validTypes.includes(type)) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: `Invalid question type. Allowed types: ${validTypes.join(', ')}`,
            data: null
        });
    }

    // Validate difficaltyLavel by type
    const validDifficultyLevels = ['Easy', 'Medium', 'Hard', 'VeryHard'];
    if (difficaltyLavel && !validDifficultyLevels.includes(difficaltyLavel)) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: `Invalid difficaltyLavel. Allowed values: ${validDifficultyLevels.join(', ')}`,
            data: null
        });
    }

    // ===== VALIDATION HELPERS =====

    // Media Validation Helper
    const validateMedia = (mediaObj) => {
        if (!mediaObj || typeof mediaObj !== 'object') {
            return { valid: true, error: null }; // Media is optional
        }

        const validMediaTypes = ['Image', 'YouTube', 'None'];
        const mediaType = mediaObj.type || 'None';

        if (!validMediaTypes.includes(mediaType)) {
            return { valid: false, error: `Media type must be one of: ${validMediaTypes.join(', ')}` };
        }

        if (mediaType === 'Image') {
            if (!mediaObj.image) {
                return { valid: false, error: 'For Image media type: image URL is required' };
            }
        } else if (mediaType === 'YouTube') {
            if (!mediaObj.youtubeId) {
                return { valid: false, error: 'For YouTube media type: youtubeId is required' };
            }
            // Validate youtubeStart if provided
            if (mediaObj.youtubeStart !== undefined && typeof mediaObj.youtubeStart !== 'number') {
                return { valid: false, error: 'For YouTube media type: youtubeStart must be a number (in seconds)' };
            }
            // Validate youtubeEnd if provided
            if (mediaObj.youtubeEnd !== undefined && typeof mediaObj.youtubeEnd !== 'number') {
                return { valid: false, error: 'For YouTube media type: youtubeEnd must be a number (in seconds)' };
            }
            // Validate that youtubeStart < youtubeEnd if both are provided
            if (mediaObj.youtubeStart !== undefined && mediaObj.youtubeEnd !== undefined) {
                if (mediaObj.youtubeStart >= mediaObj.youtubeEnd) {
                    return { valid: false, error: 'For YouTube media type: youtubeStart must be less than youtubeEnd' };
                }
            }
            // Validate that values are non-negative
            if (mediaObj.youtubeStart !== undefined && mediaObj.youtubeStart < 0) {
                return { valid: false, error: 'For YouTube media type: youtubeStart must be non-negative' };
            }
            if (mediaObj.youtubeEnd !== undefined && mediaObj.youtubeEnd < 0) {
                return { valid: false, error: 'For YouTube media type: youtubeEnd must be non-negative' };
            }
        }

        return { valid: true, error: null };
    };

    // Slider Validation Helper
    const validateSlider = (sliderObj) => {
        if (!sliderObj || typeof sliderObj !== 'object') {
            return { valid: false, error: 'Slider object is required for Slider type' };
        }

        // Validate min
        if (sliderObj.min === undefined || typeof sliderObj.min !== 'number') {
            return { valid: false, error: 'Slider.min is required and must be a number' };
        }

        // Validate max
        if (sliderObj.max === undefined || typeof sliderObj.max !== 'number') {
            return { valid: false, error: 'Slider.max is required and must be a number' };
        }

        // Validate min < max
        if (sliderObj.min >= sliderObj.max) {
            return { valid: false, error: 'Slider.min must be less than Slider.max' };
        }

        // Validate step
        if (sliderObj.step === undefined || typeof sliderObj.step !== 'number' || sliderObj.step <= 0) {
            return { valid: false, error: 'Slider.step is required and must be a positive number' };
        }

        // Validate step
        if (sliderObj.correctRange === undefined || typeof sliderObj.correctRange !== 'number' || sliderObj.correctRange <= sliderObj.min || sliderObj.correctRange >= sliderObj.max) {
            return { valid: false, error: 'Slider.correctRange is required and must be in range' };
        }

        return { valid: true, error: null };
    };

    // SlideContent Validation Helper
    const validateSlideContent = (slideContentObj) => {
        if (!slideContentObj || typeof slideContentObj !== 'object') {
            return { valid: false, error: 'SlideContent object is required for Slide type' };
        }

        // At least one of title, text, image, or video must be present
        if (!slideContentObj.title && !slideContentObj.text && !slideContentObj.image && !slideContentObj.video) {
            return { valid: false, error: 'SlideContent must have at least one of: title, text, image, or video' };
        }

        // Validate types
        if (slideContentObj.title !== undefined && slideContentObj.title !== null && typeof slideContentObj.title !== 'string') {
            return { valid: false, error: 'SlideContent.title must be a string' };
        }
        if (slideContentObj.text !== undefined && slideContentObj.text !== null && typeof slideContentObj.text !== 'string') {
            return { valid: false, error: 'SlideContent.text must be a string' };
        }
        if (slideContentObj.image !== undefined && slideContentObj.image !== null && typeof slideContentObj.image !== 'string') {
            return { valid: false, error: 'SlideContent.image must be a string (URL)' };
        }
        if (slideContentObj.video !== undefined && slideContentObj.video !== null && typeof slideContentObj.video !== 'string') {
            return { valid: false, error: 'SlideContent.video must be a string (URL)' };
        }

        // Validate duration if provided
        if (slideContentObj.duration !== undefined && slideContentObj.duration !== null) {
            if (typeof slideContentObj.duration !== 'number' || slideContentObj.duration <= 0) {
                return { valid: false, error: 'SlideContent.duration must be a positive number (in seconds)' };
            }
        }

        return { valid: true, error: null };
    };

    // Explanation Validation Helper
    const validateExplanation = (explanationObj) => {
        if (!explanationObj || typeof explanationObj !== 'object') {
            return { valid: true, error: null }; // Explanation is optional
        }

        // Validate text type
        if (explanationObj.text !== undefined && explanationObj.text !== null && typeof explanationObj.text !== 'string') {
            return { valid: false, error: 'Explanation.text must be a string' };
        }

        // Validate image type
        if (explanationObj.image !== undefined && explanationObj.image !== null && typeof explanationObj.image !== 'string') {
            return { valid: false, error: 'Explanation.image must be a string (URL)' };
        }

        // Validate youtubeId type
        if (explanationObj.youtubeId !== undefined && explanationObj.youtubeId !== null && typeof explanationObj.youtubeId !== 'string') {
            return { valid: false, error: 'Explanation.youtubeId must be a string' };
        }

        // Validate youtubeStart if provided
        if (explanationObj.youtubeStart !== undefined && explanationObj.youtubeStart !== null) {
            if (typeof explanationObj.youtubeStart !== 'number' || explanationObj.youtubeStart < 0) {
                return { valid: false, error: 'Explanation.youtubeStart must be a non-negative number (in seconds)' };
            }
        }

        // Validate youtubeEnd if provided
        if (explanationObj.youtubeEnd !== undefined && explanationObj.youtubeEnd !== null) {
            if (typeof explanationObj.youtubeEnd !== 'number' || explanationObj.youtubeEnd < 0) {
                return { valid: false, error: 'Explanation.youtubeEnd must be a non-negative number (in seconds)' };
            }
        }

        // Validate that youtubeStart < youtubeEnd if both are provided
        if (explanationObj.youtubeStart !== undefined && explanationObj.youtubeEnd !== undefined &&
            explanationObj.youtubeStart !== null && explanationObj.youtubeEnd !== null) {
            if (explanationObj.youtubeStart >= explanationObj.youtubeEnd) {
                return { valid: false, error: 'Explanation.youtubeStart must be less than youtubeEnd' };
            }
        }

        return { valid: true, error: null };
    };

    // ===== TYPE-SPECIFIC VALIDATION =====
    if (type === 'Quiz') {
        // Required: questionText, options
        if (!questionText) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For Quiz type: questionText is required',
                data: null
            });
        }
        if (!Array.isArray(options) || options.length === 0) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For Quiz type: options array is required and must contain at least one option',
                data: null
            });
        }
        // Validate options structure: each must have text and isCorrect
        const validOptions = options.every(opt => {
            // Required fields
            if (!opt.text || typeof opt.isCorrect !== 'boolean') {
                return false;
            }
            // If image is provided, it must be a string
            if (opt.image !== undefined && opt.image !== null && typeof opt.image !== 'string') {
                return false;
            }
            return true;
        });
        if (!validOptions) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For Quiz type: each option must have "text" (string, required), "isCorrect" (boolean, required), and optionally "image" (string)',
                data: null
            });
        }
        // Validate at least one option is marked as correct
        const hasCorrectOption = options.some(opt => opt.isCorrect === true);
        if (!hasCorrectOption) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For Quiz type: at least one option must be marked as correct (isCorrect: true)',
                data: null
            });
        }
        // Validate media if provided
        if (media) {
            const mediaValidation = validateMedia(media);
            if (!mediaValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: mediaValidation.error,
                    data: null
                });
            }
        }
        // Validate explanation if provided
        if (explanation) {
            const explanationValidation = validateExplanation(explanation);
            if (!explanationValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: explanationValidation.error,
                    data: null
                });
            }
        }
    } else if (type === 'TrueFalse') {
        // Required: questionText, trueAnswer
        if (!questionText) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For TrueFalse type: questionText is required',
                data: null
            });
        }
        if (trueAnswer === undefined || trueAnswer === null || typeof trueAnswer !== 'boolean') {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For TrueFalse type: trueAnswer is required and must be a boolean',
                data: null
            });
        }
        // Validate media if provided
        if (media) {
            const mediaValidation = validateMedia(media);
            if (!mediaValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: mediaValidation.error,
                    data: null
                });
            }
        }
        // Validate explanation if provided
        if (explanation) {
            const explanationValidation = validateExplanation(explanation);
            if (!explanationValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: explanationValidation.error,
                    data: null
                });
            }
        }
    } else if (type === 'TypeAnswer') {
        // Required: questionText, acceptedAnswers
        if (!questionText) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For TypeAnswer type: questionText is required',
                data: null
            });
        }
        if (!Array.isArray(acceptedAnswers) || acceptedAnswers.length === 0) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For TypeAnswer type: acceptedAnswers array is required and must contain at least one answer',
                data: null
            });
        }
        // Validate media if provided
        if (media) {
            const mediaValidation = validateMedia(media);
            if (!mediaValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: mediaValidation.error,
                    data: null
                });
            }
        }
        // Validate explanation if provided
        if (explanation) {
            const explanationValidation = validateExplanation(explanation);
            if (!explanationValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: explanationValidation.error,
                    data: null
                });
            }
        }
    } else if (type === 'Puzzle') {
        // Required: questionText, puzzleOrder
        if (!questionText) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For Puzzle type: questionText is required',
                data: null
            });
        }
        if (!Array.isArray(puzzleOrder) || puzzleOrder.length === 0) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For Puzzle type: puzzleOrder array is required and must contain at least one element',
                data: null
            });
        }
        // Validate media if provided
        if (media) {
            const mediaValidation = validateMedia(media);
            if (!mediaValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: mediaValidation.error,
                    data: null
                });
            }
        }
        // Validate explanation if provided
        if (explanation) {
            const explanationValidation = validateExplanation(explanation);
            if (!explanationValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: explanationValidation.error,
                    data: null
                });
            }
        }
    } else if (type === 'Slider') {
        // Required: questionText, slider
        if (!questionText) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For Slider type: questionText is required',
                data: null
            });
        }
        // Validate slider object
        const sliderValidation = validateSlider(slider);
        if (!sliderValidation.valid) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: `For Slider type: ${sliderValidation.error}`,
                data: null
            });
        }
        // Validate media if provided
        if (media) {
            const mediaValidation = validateMedia(media);
            if (!mediaValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: mediaValidation.error,
                    data: null
                });
            }
        }
        // Validate explanation if provided
        if (explanation) {
            const explanationValidation = validateExplanation(explanation);
            if (!explanationValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: explanationValidation.error,
                    data: null
                });
            }
        }
    } else if (type === 'Slide') {
        // Validate slideContent object
        const slideContentValidation = validateSlideContent(slideContent);
        if (!slideContentValidation.valid) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: `For Slide type: ${slideContentValidation.error}`,
                data: null
            });
        }
        // Validate explanation if provided (optional for Slide)
        if (explanation) {
            const explanationValidation = validateExplanation(explanation);
            if (!explanationValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: explanationValidation.error,
                    data: null
                });
            }
        }
    } else if (type === 'imagePin') {
        if (!imagePinFile || typeof imagePinFile !== 'string') {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For imagePin type: imagePinFile is required and must be a string',
                data: null
            });
        }
        if (!Array.isArray(imagePinArrObj) || imagePinArrObj.length === 0) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For imagePin type: imagePinArrObj must be a non-empty array',
                data: null
            });
        }

        const polygonsValid = imagePinArrObj.every(area => {
            if (!area || typeof area !== 'object') {
                return false;
            }
            if (!Array.isArray(area.polygonCoordinates) || area.polygonCoordinates.length === 0) {
                return false;
            }
            return area.polygonCoordinates.every(point => {
                if (!point || typeof point !== 'object') {
                    return false;
                }
                const { xAxis, yAxis } = point;
                return typeof xAxis === 'number' && typeof yAxis === 'number';
            });
        });

        if (!polygonsValid) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'For imagePin type: polygonCoordinates must contain numeric xAxis and yAxis values',
                data: null
            });
        }

        normalizedImagePins = imagePinArrObj.map(area => ({
            polygonCoordinates: area.polygonCoordinates.map(point => ({
                xAxis: point.xAxis,
                yAxis: point.yAxis
            }))
        }));

        if (media) {
            const mediaValidation = validateMedia(media);
            if (!mediaValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: mediaValidation.error,
                    data: null
                });
            }
        }

        if (explanation) {
            const explanationValidation = validateExplanation(explanation);
            if (!explanationValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: explanationValidation.error,
                    data: null
                });
            }
        }
    }

    // ===== BUILD QUESTION DATA =====
    const questionData = {
        quizId,
        categoryId,
        type,
        timeLimit: timeLimit || 30,
        difficaltyLavel: difficaltyLavel || 'Easy',
        maxScore: maxScore || parseInt(getPerQuestionPointConfig(difficaltyLavel || 'Easy')),
    };

    // Add type-specific fields
    if (type === 'Quiz') {
        questionData.questionText = questionText;
        questionData.options = options;
        if (backgroundImage) questionData.backgroundImage = backgroundImage;
        if (media) questionData.media = media;
        if (multiSelect !== undefined) questionData.multiSelect = multiSelect;
        if (explanation) questionData.explanation = explanation;
    } else if (type === 'TrueFalse') {
        questionData.questionText = questionText;
        questionData.trueAnswer = trueAnswer;
        if (backgroundImage) questionData.backgroundImage = backgroundImage;
        if (media) questionData.media = media;
        if (explanation) questionData.explanation = explanation;
    } else if (type === 'TypeAnswer') {
        questionData.questionText = questionText;
        questionData.acceptedAnswers = acceptedAnswers;
        if (backgroundImage) questionData.backgroundImage = backgroundImage;
        if (media) questionData.media = media;
        if (explanation) questionData.explanation = explanation;
    } else if (type === 'Puzzle') {
        questionData.questionText = questionText;
        questionData.puzzleOrder = puzzleOrder;
        if (backgroundImage) questionData.backgroundImage = backgroundImage;
        if (media) questionData.media = media;
        if (explanation) questionData.explanation = explanation;
    } else if (type === 'Slider') {
        questionData.questionText = questionText;
        questionData.slider = slider;
        if (backgroundImage) questionData.backgroundImage = backgroundImage;
        if (media) questionData.media = media;
        if (explanation) questionData.explanation = explanation;
    } else if (type === 'Slide') {
        questionData.slideContent = slideContent;
    } else if (type === 'imagePin') {
        questionData.imagePinFile = imagePinFile;
        questionData.imagePinArrObj = normalizedImagePins || [];
        if (questionText) questionData.questionText = questionText;
        if (backgroundImage) questionData.backgroundImage = backgroundImage;
        if (media) questionData.media = media;
        if (explanation) questionData.explanation = explanation;
    }

    // Create question instance
    const question = new QuizQuestion(questionData);
    await question.save();

    // Add question ID to quiz's questions array
    await Quiz.findByIdAndUpdate(quizId, { $push: { questions: question._id } });

    // Populate quizId and categoryId before returning
    const populatedQuestion = await QuizQuestion.findById(question._id)
        .populate({ path: 'quizId', select: 'title description category' })
        .populate({ path: 'categoryId', select: 'name description' });

    return res.status(httpStatus.CREATED).json({
        success: true,
        message: getMessage ? getMessage("QUIZ_QUESTION_CREATED_SUCCESS", res.locals.language) : "Quiz question created successfully",
        data: populatedQuestion
    });
});

/**
 * Updates a quiz question by questionId with comprehensive type-specific validation.
 * PATCH /quiz/question/:id
 * 
 * Validates all fields according to the question type, matching createQuizQuestion validation.
 * Supports partial updates - only provided fields are validated and updated.
 */
const updateQuizQuestion = catchAsync(async (req, res) => {
    const { id } = req.params;
    const {
        type,
        questionText,
        backgroundImage,
        media,
        options,
        multiSelect,
        trueAnswer,
        acceptedAnswers,
        puzzleOrder,
        slider,
        slideContent,
        explanation,
        timeLimit,
        difficaltyLavel,
        categoryId
    } = req.body;

    // Fetch existing question to validate type consistency
    const existingQuestion = await QuizQuestion.findById(id);
    if (!existingQuestion) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Quiz question not found',
            data: null
        });
    }

    const questionType = type || existingQuestion.type;

    // ===== VALIDATION HELPERS (same as createQuizQuestion) =====

    // Media Validation Helper
    const validateMedia = (mediaObj) => {
        if (!mediaObj || typeof mediaObj !== 'object') {
            return { valid: true, error: null }; // Media is optional
        }

        const validMediaTypes = ['Image', 'YouTube', 'None'];
        const mediaType = mediaObj.type || 'None';

        if (!validMediaTypes.includes(mediaType)) {
            return { valid: false, error: `Media type must be one of: ${validMediaTypes.join(', ')}` };
        }

        if (mediaType === 'Image') {
            if (!mediaObj.image) {
                return { valid: false, error: 'For Image media type: image URL is required' };
            }
        } else if (mediaType === 'YouTube') {
            if (!mediaObj.youtubeId) {
                return { valid: false, error: 'For YouTube media type: youtubeId is required' };
            }
            // Validate youtubeStart if provided
            if (mediaObj.youtubeStart !== undefined && typeof mediaObj.youtubeStart !== 'number') {
                return { valid: false, error: 'For YouTube media type: youtubeStart must be a number (in seconds)' };
            }
            // Validate youtubeEnd if provided
            if (mediaObj.youtubeEnd !== undefined && typeof mediaObj.youtubeEnd !== 'number') {
                return { valid: false, error: 'For YouTube media type: youtubeEnd must be a number (in seconds)' };
            }
            // Validate that youtubeStart < youtubeEnd if both are provided
            if (mediaObj.youtubeStart !== undefined && mediaObj.youtubeEnd !== undefined) {
                if (mediaObj.youtubeStart >= mediaObj.youtubeEnd) {
                    return { valid: false, error: 'For YouTube media type: youtubeStart must be less than youtubeEnd' };
                }
            }
            // Validate that values are non-negative
            if (mediaObj.youtubeStart !== undefined && mediaObj.youtubeStart < 0) {
                return { valid: false, error: 'For YouTube media type: youtubeStart must be non-negative' };
            }
            if (mediaObj.youtubeEnd !== undefined && mediaObj.youtubeEnd < 0) {
                return { valid: false, error: 'For YouTube media type: youtubeEnd must be non-negative' };
            }
        }

        return { valid: true, error: null };
    };

    // Slider Validation Helper
    const validateSlider = (sliderObj) => {
        if (!sliderObj || typeof sliderObj !== 'object') {
            return { valid: false, error: 'Slider object is required for Slider type' };
        }

        // Validate min
        if (sliderObj.min === undefined || typeof sliderObj.min !== 'number') {
            return { valid: false, error: 'Slider.min is required and must be a number' };
        }

        // Validate max
        if (sliderObj.max === undefined || typeof sliderObj.max !== 'number') {
            return { valid: false, error: 'Slider.max is required and must be a number' };
        }

        // Validate min < max
        if (sliderObj.min >= sliderObj.max) {
            return { valid: false, error: 'Slider.min must be less than Slider.max' };
        }

        // Validate correctRange
        if (!Array.isArray(sliderObj.correctRange) || sliderObj.correctRange.length !== 2) {
            return { valid: false, error: 'Slider.correctRange must be an array with exactly 2 numbers [min, max]' };
        }

        const [correctMin, correctMax] = sliderObj.correctRange;
        if (typeof correctMin !== 'number' || typeof correctMax !== 'number') {
            return { valid: false, error: 'Slider.correctRange must contain numeric values' };
        }

        if (correctMin >= correctMax) {
            return { valid: false, error: 'Slider.correctRange[0] must be less than correctRange[1]' };
        }

        // Validate correctRange is within min-max bounds
        if (correctMin < sliderObj.min || correctMax > sliderObj.max) {
            return { valid: false, error: `Slider.correctRange must be within [${sliderObj.min}, ${sliderObj.max}]` };
        }

        return { valid: true, error: null };
    };

    // SlideContent Validation Helper
    const validateSlideContent = (slideContentObj) => {
        if (!slideContentObj || typeof slideContentObj !== 'object') {
            return { valid: false, error: 'SlideContent object is required for Slide type' };
        }

        // At least one of title, text, image, or video must be present
        if (!slideContentObj.title && !slideContentObj.text && !slideContentObj.image && !slideContentObj.video) {
            return { valid: false, error: 'SlideContent must have at least one of: title, text, image, or video' };
        }

        // Validate types
        if (slideContentObj.title !== undefined && slideContentObj.title !== null && typeof slideContentObj.title !== 'string') {
            return { valid: false, error: 'SlideContent.title must be a string' };
        }
        if (slideContentObj.text !== undefined && slideContentObj.text !== null && typeof slideContentObj.text !== 'string') {
            return { valid: false, error: 'SlideContent.text must be a string' };
        }
        if (slideContentObj.image !== undefined && slideContentObj.image !== null && typeof slideContentObj.image !== 'string') {
            return { valid: false, error: 'SlideContent.image must be a string (URL)' };
        }
        if (slideContentObj.video !== undefined && slideContentObj.video !== null && typeof slideContentObj.video !== 'string') {
            return { valid: false, error: 'SlideContent.video must be a string (URL)' };
        }

        // Validate duration if provided
        if (slideContentObj.duration !== undefined && slideContentObj.duration !== null) {
            if (typeof slideContentObj.duration !== 'number' || slideContentObj.duration <= 0) {
                return { valid: false, error: 'SlideContent.duration must be a positive number (in seconds)' };
            }
        }

        return { valid: true, error: null };
    };

    // Explanation Validation Helper
    const validateExplanation = (explanationObj) => {
        if (!explanationObj || typeof explanationObj !== 'object') {
            return { valid: true, error: null }; // Explanation is optional
        }

        // Validate text type
        if (explanationObj.text !== undefined && explanationObj.text !== null && typeof explanationObj.text !== 'string') {
            return { valid: false, error: 'Explanation.text must be a string' };
        }

        // Validate image type
        if (explanationObj.image !== undefined && explanationObj.image !== null && typeof explanationObj.image !== 'string') {
            return { valid: false, error: 'Explanation.image must be a string (URL)' };
        }

        // Validate youtubeId type
        if (explanationObj.youtubeId !== undefined && explanationObj.youtubeId !== null && typeof explanationObj.youtubeId !== 'string') {
            return { valid: false, error: 'Explanation.youtubeId must be a string' };
        }

        // Validate youtubeStart if provided
        if (explanationObj.youtubeStart !== undefined && explanationObj.youtubeStart !== null) {
            if (typeof explanationObj.youtubeStart !== 'number' || explanationObj.youtubeStart < 0) {
                return { valid: false, error: 'Explanation.youtubeStart must be a non-negative number (in seconds)' };
            }
        }

        // Validate youtubeEnd if provided
        if (explanationObj.youtubeEnd !== undefined && explanationObj.youtubeEnd !== null) {
            if (typeof explanationObj.youtubeEnd !== 'number' || explanationObj.youtubeEnd < 0) {
                return { valid: false, error: 'Explanation.youtubeEnd must be a non-negative number (in seconds)' };
            }
        }

        // Validate that youtubeStart < youtubeEnd if both are provided
        if (explanationObj.youtubeStart !== undefined && explanationObj.youtubeEnd !== undefined &&
            explanationObj.youtubeStart !== null && explanationObj.youtubeEnd !== null) {
            if (explanationObj.youtubeStart >= explanationObj.youtubeEnd) {
                return { valid: false, error: 'Explanation.youtubeStart must be less than youtubeEnd' };
            }
        }

        return { valid: true, error: null };
    };

    // ===== BUILD UPDATE FIELDS WITH VALIDATION =====
    const updateFields = {};

    // Validate and add basic fields
    if (type !== undefined) {
        const validTypes = ['Quiz', 'TrueFalse', 'TypeAnswer', 'Puzzle', 'Slider', 'Slide'];
        if (!validTypes.includes(type)) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: `Invalid question type. Allowed types: ${validTypes.join(', ')}`,
                data: null
            });
        }
        updateFields.type = type;
    }

    // Validate difficaltyLavel if provided
    if (difficaltyLavel !== undefined) {
        const validDifficultyLevels = ['Easy', 'Medium', 'Hard', 'VeryHard'];
        if (!validDifficultyLevels.includes(difficaltyLavel)) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: `Invalid difficaltyLavel. Allowed values: ${validDifficultyLevels.join(', ')}`,
                data: null
            });
        }
        updateFields.difficaltyLavel = difficaltyLavel;
    }

    // Validate and add optional common fields
    if (questionText !== undefined) updateFields.questionText = questionText;
    if (backgroundImage !== undefined) updateFields.backgroundImage = backgroundImage;
    if (timeLimit !== undefined) updateFields.timeLimit = timeLimit;
    if (categoryId !== undefined) updateFields.categoryId = categoryId;

    // Validate media if provided
    if (media !== undefined) {
        const mediaValidation = validateMedia(media);
        if (!mediaValidation.valid) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: mediaValidation.error,
                data: null
            });
        }
        updateFields.media = media;
    }

    // Validate explanation if provided
    if (explanation !== undefined) {
        const explanationValidation = validateExplanation(explanation);
        if (!explanationValidation.valid) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: explanationValidation.error,
                data: null
            });
        }
        updateFields.explanation = explanation;
    }

    // ===== CHECK IF TYPE IS BEING CHANGED =====
    const isTypeChange = type !== undefined && type !== existingQuestion.type;

    // If type is being changed, clear all old type-specific fields
    if (isTypeChange) {
        // Clear all old type-specific fields
        const fieldsToUnset = {
            questionText: '',
            options: '',
            multiSelect: '',
            trueAnswer: '',
            acceptedAnswers: '',
            puzzleOrder: '',
            slider: '',
            slideContent: '',
            backgroundImage: ''
        };

        // Remove old fields from updateFields if they exist
        Object.keys(fieldsToUnset).forEach(field => {
            delete updateFields[field];
        });
    }

    // ===== TYPE-SPECIFIC VALIDATION AND FIELD UPDATES =====
    if (questionType === 'Quiz') {
        // If type change: require questionText and options
        // If no type change: allow partial updates

        if (isTypeChange) {
            // TYPE CHANGE TO QUIZ - All required fields must be provided
            if (!questionText) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Quiz type: questionText is required when changing to this type',
                    data: null
                });
            }
            if (!Array.isArray(options) || options.length === 0) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Quiz type: options array is required and must contain at least one option when changing to this type',
                    data: null
                });
            }
        } else {
            // NO TYPE CHANGE - Validate only if provided
            if (questionText !== undefined && !questionText) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Quiz type: questionText cannot be empty',
                    data: null
                });
            }
            if (options !== undefined && (!Array.isArray(options) || options.length === 0)) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Quiz type: options array must contain at least one option',
                    data: null
                });
            }
        }

        // Validate options structure if provided
        if (options !== undefined) {
            const validOptions = options.every(opt => {
                if (!opt.text || typeof opt.isCorrect !== 'boolean') {
                    return false;
                }
                if (opt.image !== undefined && opt.image !== null && typeof opt.image !== 'string') {
                    return false;
                }
                return true;
            });

            if (!validOptions) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Quiz type: each option must have "text" (string, required), "isCorrect" (boolean, required), and optionally "image" (string)',
                    data: null
                });
            }

            // Validate at least one correct option
            const hasCorrectOption = options.some(opt => opt.isCorrect === true);
            if (!hasCorrectOption) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Quiz type: at least one option must be marked as correct (isCorrect: true)',
                    data: null
                });
            }

            updateFields.options = options;
        }

        if (questionText !== undefined) updateFields.questionText = questionText;
        if (multiSelect !== undefined) updateFields.multiSelect = multiSelect;

    } else if (questionType === 'TrueFalse') {
        // If type change: require questionText and trueAnswer

        if (isTypeChange) {
            // TYPE CHANGE TO TRUEFALSE - All required fields must be provided
            if (!questionText) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For TrueFalse type: questionText is required when changing to this type',
                    data: null
                });
            }
            if (trueAnswer === undefined || trueAnswer === null || typeof trueAnswer !== 'boolean') {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For TrueFalse type: trueAnswer is required and must be a boolean when changing to this type',
                    data: null
                });
            }
        } else {
            // NO TYPE CHANGE - Validate only if provided
            if (questionText !== undefined && !questionText) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For TrueFalse type: questionText cannot be empty',
                    data: null
                });
            }
            if (trueAnswer !== undefined && typeof trueAnswer !== 'boolean') {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For TrueFalse type: trueAnswer must be a boolean',
                    data: null
                });
            }
        }

        if (questionText !== undefined) updateFields.questionText = questionText;
        if (trueAnswer !== undefined) updateFields.trueAnswer = trueAnswer;

    } else if (questionType === 'TypeAnswer') {
        // If type change: require questionText and acceptedAnswers

        if (isTypeChange) {
            // TYPE CHANGE TO TYPEANSWER - All required fields must be provided
            if (!questionText) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For TypeAnswer type: questionText is required when changing to this type',
                    data: null
                });
            }
            if (!Array.isArray(acceptedAnswers) || acceptedAnswers.length === 0) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For TypeAnswer type: acceptedAnswers array is required and must contain at least one answer when changing to this type',
                    data: null
                });
            }
        } else {
            // NO TYPE CHANGE - Validate only if provided
            if (questionText !== undefined && !questionText) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For TypeAnswer type: questionText cannot be empty',
                    data: null
                });
            }
            if (acceptedAnswers !== undefined && (!Array.isArray(acceptedAnswers) || acceptedAnswers.length === 0)) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For TypeAnswer type: acceptedAnswers array must contain at least one answer',
                    data: null
                });
            }
        }

        if (questionText !== undefined) updateFields.questionText = questionText;
        if (acceptedAnswers !== undefined) updateFields.acceptedAnswers = acceptedAnswers;

    } else if (questionType === 'Puzzle') {
        // If type change: require questionText and puzzleOrder

        if (isTypeChange) {
            // TYPE CHANGE TO PUZZLE - All required fields must be provided
            if (!questionText) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Puzzle type: questionText is required when changing to this type',
                    data: null
                });
            }
            if (!Array.isArray(puzzleOrder) || puzzleOrder.length === 0) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Puzzle type: puzzleOrder array is required and must contain at least one element when changing to this type',
                    data: null
                });
            }
        } else {
            // NO TYPE CHANGE - Validate only if provided
            if (questionText !== undefined && !questionText) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Puzzle type: questionText cannot be empty',
                    data: null
                });
            }
            if (puzzleOrder !== undefined && (!Array.isArray(puzzleOrder) || puzzleOrder.length === 0)) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Puzzle type: puzzleOrder array must contain at least one element',
                    data: null
                });
            }
        }

        if (questionText !== undefined) updateFields.questionText = questionText;
        if (puzzleOrder !== undefined) updateFields.puzzleOrder = puzzleOrder;

    } else if (questionType === 'Slider') {
        // If type change: require questionText and slider

        if (isTypeChange) {
            // TYPE CHANGE TO SLIDER - All required fields must be provided
            if (!questionText) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Slider type: questionText is required when changing to this type',
                    data: null
                });
            }
            if (!slider) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Slider type: slider object is required when changing to this type',
                    data: null
                });
            }

            // Validate slider object
            const sliderValidation = validateSlider(slider);
            if (!sliderValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: `For Slider type: ${sliderValidation.error}`,
                    data: null
                });
            }
            updateFields.slider = slider;
        } else {
            // NO TYPE CHANGE - Validate only if provided
            if (questionText !== undefined && !questionText) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Slider type: questionText cannot be empty',
                    data: null
                });
            }
            if (slider !== undefined) {
                const sliderValidation = validateSlider(slider);
                if (!sliderValidation.valid) {
                    return res.status(httpStatus.OK).json({
                        success: false,
                        message: `For Slider type: ${sliderValidation.error}`,
                        data: null
                    });
                }
                updateFields.slider = slider;
            }
        }

        if (questionText !== undefined) updateFields.questionText = questionText;

    } else if (questionType === 'Slide') {
        // If type change: require slideContent

        if (isTypeChange) {
            // TYPE CHANGE TO SLIDE - slideContent is required
            if (!slideContent) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: 'For Slide type: slideContent object is required when changing to this type',
                    data: null
                });
            }

            // Validate slideContent
            const slideContentValidation = validateSlideContent(slideContent);
            if (!slideContentValidation.valid) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: `For Slide type: ${slideContentValidation.error}`,
                    data: null
                });
            }
            updateFields.slideContent = slideContent;
        } else {
            // NO TYPE CHANGE - Validate only if provided
            if (slideContent !== undefined) {
                const slideContentValidation = validateSlideContent(slideContent);
                if (!slideContentValidation.valid) {
                    return res.status(httpStatus.OK).json({
                        success: false,
                        message: `For Slide type: ${slideContentValidation.error}`,
                        data: null
                    });
                }
                updateFields.slideContent = slideContent;
            }
        }
    }

    // Perform the update with validation
    const updatedQuestion = await QuizQuestion.findByIdAndUpdate(id, { $set: updateFields }, { new: true })
        .populate({ path: 'quizId', select: 'title description category' })
        .populate({ path: 'categoryId', select: 'name description' });

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage ? getMessage("QUIZ_QUESTION_UPDATED_SUCCESS", res.locals.language) : "Quiz question updated successfully",
        data: updatedQuestion
    });
});




/**
 * Get all questions for a quiz, with optional filters.
 * GET /quiz/questions?quizId=...&type=...&difficaltyLavel=...
 * Filters: quizId (required), type, difficaltyLavel, categoryId
 */
const getQuizQuestionsByQuizId = catchAsync(async (req, res) => {
    const { quizId, type, difficaltyLavel, categoryId } = req.query;

    if (!quizId) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'quizId is required',
            data: null
        });
    }

    const filter = { quizId };
    if (type) filter.type = type;
    if (difficaltyLavel) filter.difficaltyLavel = difficaltyLavel;
    if (categoryId) filter.categoryId = categoryId;

    const questions = await QuizQuestion.find(filter)
        .populate({ path: 'quizId', select: 'title description' })
        .populate({ path: 'categoryId', select: 'name description' })
        .sort({ createdAt: -1 });

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage ? getMessage("QUIZ_QUESTIONS_FETCH_SUCCESS", res.locals.language) : "Quiz questions fetched successfully",
        data: questions
    });
});

/**
 * Deletes a quiz question by ID and removes its reference from the parent quiz.
 * DELETE /quiz/question/:id
 * Input: question ID in URL params
 * Returns: success message
 */
const deleteQuizQuestion = catchAsync(async (req, res) => {
    const { id } = req.params;

    // Find the question to get its quizId before deletion
    const question = await QuizQuestion.findById(id);
    if (!question) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Quiz question not found',
            data: null
        });
    }

    // Delete the question
    await QuizQuestion.findByIdAndDelete(id);

    // Remove the question ID from the parent quiz's questions array
    if (question.quizId) {
        await Quiz.findByIdAndUpdate(question.quizId, { $pull: { questions: id } });
    }

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage ? getMessage("QUIZ_QUESTION_DELETED_SUCCESS", res.locals.language) : "Quiz question deleted successfully",
        data: null
    });
});

// ================================
// 📌 QUIZ GAME SESSION APIs
// ================================

/**
 * Helper: Generate random 8-digit game PIN
 */
const generateGamePin = () => {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
};

/**
 * Helper: Generate QR Code URL
 * Uses qr server API or can be customized
 */
const generateQRCode = (gamePin) => {
    // Using qr-server.com for QR code generation
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(gamePin)}`;
};

/**
 * Helper: Normalize imagePin polygons for safe RTDB storage
 */
const normalizeImagePinArrObj = (areas) => {
    if (!Array.isArray(areas)) {
        return [];
    }

    return areas.reduce((normalized, area) => {
        if (!area || typeof area !== 'object') {
            return normalized;
        }

        const polygonCoordinates = Array.isArray(area.polygonCoordinates)
            ? area.polygonCoordinates.reduce((coords, point) => {
                if (!point || typeof point !== 'object') {
                    return coords;
                }

                const xAxis = typeof point.xAxis === 'number' ? point.xAxis : null;
                const yAxis = typeof point.yAxis === 'number' ? point.yAxis : null;

                if (xAxis !== null && yAxis !== null) {
                    coords.push({ xAxis, yAxis });
                }

                return coords;
            }, [])
            : [];

        normalized.push({ polygonCoordinates });
        return normalized;
    }, []);
};

/**
 * Creates a new quiz game session.
 * POST /quiz/game-session
 * 
 * Request body:
 * {
 *   quizId (required),
 *   hostId (required - must be franchisee staff),
 *   franchiseId (required),
 *   status (optional - 'Scheduled' or 'Lobby', default: 'Lobby'),
 *   startTime (optional - unix timestamp in ms)
 * }
 * 
 * If status is 'Scheduled' and startTime is provided:
 *   - Saves the session to database only (no Firebase RTDB)
 * 
 * Otherwise (Lobby status or no startTime):
 *   - Saves to database AND creates Firebase RTDB with questions
 * 
 * Returns: created session with populated hostId, quizId, franchiseId
 */
const createQuizGameSession = catchAsync(async (req, res) => {
    const {
        quizId,
        hostId,
        franchiseId,
        status
    } = req.body;

    // ===== VALIDATION =====
    if (!quizId || !hostId || !franchiseId) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'quizId, hostId, franchiseId are required',
            data: null
        });
    }

    // Verify quiz exists
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Quiz not found',
            data: null
        });
    }

    // Verify franchise exists
    const franchise = await FranchiseeInfo.findById(franchiseId);
    if (!franchise) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Franchise not found',
            data: null
        });
    }

    // Fetch all quiz questions to calculate total duration
    const quizQuestions = await QuizQuestion.find({ quizId: quizId });

    // Calculate total duration (sum of all question time limits in seconds)
    const totalDurationSeconds = quizQuestions.reduce((sum, question) => {
        return sum + (question.timeLimit || 30); // Default 30 seconds per question
    }, 0);

    // Check if session is scheduled
    const isScheduled = status === 'Scheduled' && req.body.startTime;

    // Generate gamePin and QR code
    const gamePin = generateGamePin();
    const qrCode = generateQRCode(gamePin);

    // Calculate startTime and endTime
    const startTime = req.body.startTime ? req.body.startTime : Math.floor(Date.now() * 1000) + 15 * 60 * 1000; // startTime in ms
    const endTime = startTime + (totalDurationSeconds * 1000); // endTime = startTime + total duration in ms

    // Create game session
    const sessionData = {
        quizId,
        hostId,
        franchiseId,
        gamePin,
        qrCode,
        status: status || 'Lobby',
        startTime: startTime,
        endTime: endTime,
        duration: totalDurationSeconds,
        settings: {
            showQuestionsOnClient: true,
            showLeaderboardPerQuestion: true,
            allowRejoin: true,
            isPaused: false,
            hostControls: {
                canReplayMedia: true,
                canRestartQuestion: true
            },
            clientIds: []
        }
    };

    const session = new QuizGameSession(sessionData);
    await session.save();

    // Populate references
    const populatedSession = await QuizGameSession.findById(session._id)
        .populate({ path: 'hostId', select: 'firstName lastName email role franchiseeInfoId' })
        .populate({ path: 'quizId', select: 'title description category questions language' })
        .populate({ path: 'franchiseId', select: 'franchiseeName location' });

    // If session is scheduled, return without Firebase RTDB setup
    if (isScheduled) {
        return res.status(httpStatus.CREATED).json({
            success: true,
            message: 'Quiz game session scheduled successfully.',
            data: populatedSession
        });
    }

    // For non-scheduled sessions, setup Firebase RTDB
    const getQuetionOfTheQuiz = await QuizQuestion.find({ quizId: quizId })
        .populate({ path: 'categoryId', select: 'name description' })
        .populate({ path: 'quizId', select: 'title description category language' });

    // Convert questionList to object indexed by question ID
    let questionList = {};
    const imagePinAreasByQuestionId = {};
    getQuetionOfTheQuiz.forEach(question => {
        const questionId = question._id.toString();

        // Build base question data
        const questionData = {
            id: questionId,
            quizId: question.quizId._id.toString(),
            categoryId: question.categoryId._id.toString(),
            categoryName: question.categoryId.name[question.quizId.language],
            type: question.type,
            difficaltyLavel: question.difficaltyLavel,
            timeLimit: question.timeLimit,
            sessionStatus: "created",
            maxScore: question.maxScore || 100
        };

        // Add optional fields only if they exist
        if (question.backgroundImage) questionData.backgroundImage = question.backgroundImage;
        if (question.questionText) questionData.questionText = question.questionText;
        if (question.media) questionData.media = question.media;
        if (question.explanation) questionData.explanation = question.explanation;

        // Add type-specific fields
        if (question.type === 'Quiz') {
            questionData.options = question.options.map(option => ({
                id: option._id.toString(),
                text: option.text,
                image: option.image || null,
                isCorrect: option.isCorrect
            }));
            if (question.multiSelect !== undefined) questionData.multiSelect = question.multiSelect;
        }

        if (question.type === 'TrueFalse') {
            if (question.trueAnswer !== undefined) questionData.trueAnswer = question.trueAnswer;
        }

        if (question.type === 'TypeAnswer') {
            if (question.acceptedAnswers) questionData.acceptedAnswers = question.acceptedAnswers;
        }

        if (question.type === 'Puzzle') {
            if (question.puzzleOrder) {
                questionData.puzzleOrder = question.puzzleOrder;
                questionData.puzzleSuffleOrder = getShuffledArray(question.puzzleOrder);
            }
        }

        if (question.type === 'Slider') {
            if (question.slider) questionData.slider = question.slider;
        }

        if (question.type === 'Slide') {
            if (question.slideContent) questionData.slideContent = question.slideContent;
        }

        if (question.type === 'imagePin') {
            if (question.imagePinFile) {
                questionData.imagePinFile = question.imagePinFile;
            }

            const sanitizedImagePins = normalizeImagePinArrObj(question.imagePinArrObj);
            questionData.imagePinArrObj = sanitizedImagePins;

            if (sanitizedImagePins.length) {
                imagePinAreasByQuestionId[questionId] = sanitizedImagePins;
            }
        }

        questionList[questionId] = questionData;
    });

    /** add firebase realtime code start */
    // Create quizGameSessions node and set initial data in Firebase
    // Questions are indexed by questionId for efficient access
    const firebasePayload = {
        answers: null,
        scores: null,
        metaData: { ...populatedSession.settings },
        currentQuestionId: null,
        questionResults: null,
        leaderboard: null,
        finalResults: null,
        players: null,
        questions: questionList
    };

    await firebaseDB.ref(`quizGameSessions/${populatedSession._id}`).set(firebasePayload);
    /** add firebase realtime code end */

    return res.status(httpStatus.CREATED).json({
        success: true,
        message: 'Quiz game session created successfully',
        data: populatedSession
    });
});

const getShuffledArray = (array) => {
    if (!Array.isArray(array)) return [];
    const shuffled = array.slice(); // Create a copy of the array
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // Swap elements
    }
    return shuffled;
}

/**
 * Gets a single quiz game session by ID.
 * GET /quiz/game-session/:id
 * 
 * Returns: session data with populated references
 */
const getQuizGameSessionById = catchAsync(async (req, res) => {
    const { id } = req.params;

    const session = await QuizGameSession.findById(id)
        .populate({ path: 'hostId', select: 'firstName lastName email role franchiseeInfoId' })
        .populate({ path: 'quizId', select: 'title description category' })
        .populate({ path: 'franchiseId', select: 'franchiseeName location' });

    if (session && session.quizId) {
        const quiz = await Quiz.findById(session.quizId)
            .populate({ path: 'questions', populate: { path: 'categoryId', select: 'name description' } })
            .populate({ path: 'category', select: 'name description' });
        session.quizId = quiz;
    }

    if (!session) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Quiz game session not found',
            data: null
        });
    }

    return res.status(httpStatus.OK).json({
        success: true,
        message: 'Quiz game session fetched successfully',
        data: session
    });
});

/**
 * Lists quiz game sessions with optional filters and pagination.
 * GET /quiz/game-sessions
 * 
 * Query parameters:
 * - quizId: filter by quiz
 * - franchiseId: filter by franchise
 * - hostId: filter by host
 * - status: filter by status (Lobby, InProgress, Completed)
 * - startTime: filter sessions starting from this time
 * - endTime: filter sessions ending before this time
 * - time: filter sessions active at this specific time
 * - limit: number of records per page (default: 20, max: 100)
 * - skip: number of records to skip (default: 0)
 * 
 * Returns: array of sessions with populated references and pagination info
 */
const getQuizGameSessions = catchAsync(async (req, res) => {
    const { quizId, franchiseId, hostId, status, limit = 20, skip = 0 } = req.query;

    const filter = {};
    if (quizId) filter.quizId = quizId;
    if (franchiseId) filter.franchiseId = franchiseId;
    if (hostId) filter.hostId = hostId;
    if (status) filter.status = status;

    if (req.query.startTime) {
        const start = new Date(req.query.startTime);
        if (!isNaN(start.getTime())) {
            filter.startTime = { $gte: start.getTime() };
        }
    }
    if (req.query.endTime) {
        const end = new Date(req.query.endTime);
        if (!isNaN(end.getTime())) {
            filter.endTime = { $lte: end.getTime() };
        }
    }
    if (req.query.time) {
        // Filter sessions that are active at a specific time (timestamp)
        const time = new Date(req.query.time).getTime();
        if (!isNaN(time)) {
            filter.startTime = { ...(filter.startTime || {}), $lte: time };
            filter.endTime = { ...(filter.endTime || {}), $gte: time };
        }
    }

    // Parse limit and skip as integers
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit) || 20)); // Max 100, default 20
    const pageSkip = Math.max(0, parseInt(skip) || 0);

    // Get total count for pagination info
    const totalCount = await QuizGameSession.countDocuments(filter);

    const sessions = await QuizGameSession.find(filter)
        .populate({ path: 'hostId', select: 'firstName lastName email role franchiseeInfoId' })
        .populate({
            path: 'quizId',
            select: 'title description category questions'
        })
        .populate({ path: 'franchiseId', select: 'franchiseeName location' })
        .sort({ createdAt: -1 })
        .limit(pageLimit)
        .skip(pageSkip);

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("QUIZ_GAME_SESSIONS_FETCH_SUCCESS", res.locals.language),
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
});

/**
 * Updates a quiz game session.
 * PATCH /quiz/game-session/:id
 * 
 * Can update:
 * - hostId (before session starts)
 * - status ( Scheduled → Lobby → InProgress → Completed)
 * - startTime, endTime (before session starts)
 * - settings (host controls and options)
 * 
 * Special behavior:
 * - If status is updated to 'Lobby' and startTime is within 15 minutes from now,
 *   creates Firebase RTDB entry with questions (same as createQuizGameSession)
 * 
 * Returns: updated session with populated references
 */
const updateQuizGameSession = catchAsync(async (req, res) => {
    const { id } = req.params;
    const {
        hostId,
        status,
        startTime,
        endTime,
        settings
    } = req.body;

    // Fetch existing session
    const session = await QuizGameSession.findById(id);
    if (!session) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Quiz game session not found',
            data: null
        });
    }

    const updateFields = {};

    // Validate and update hostId (only before session starts)
    if (hostId !== undefined) {
        const host = await Franchisee.findById(hostId);
        if (!host || host.role !== 'staff' || !host.franchiseeInfoId || host.franchiseeInfoId.toString() !== session.franchiseId.toString()) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'hostId must be a valid franchisee staff user for this franchise',
                data: null
            });
        }
        if (session.status !== 'Lobby' && session.status !== 'InProgress') {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'Cannot change host after session has started',
                data: null
            });
        }
        updateFields.hostId = hostId;
    }

    // Check if status is being updated to Lobby for the FIRST TIME (from Scheduled to Lobby)
    const isFirstTimeUpdatingToLobby = status !== undefined && status === 'Lobby' && session.status === 'Scheduled';

    // Validate and update status
    if (status !== undefined) {
        const validStatuses = ['Lobby', 'InProgress', 'Completed', 'Scheduled'];
        if (!validStatuses.includes(status)) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: `Invalid status. Allowed values: ${validStatuses.join(', ')}`,
                data: null
            });
        }

        // Status transitions validation
        if (session.status === 'Completed') {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'Cannot change status of a completed session',
                data: null
            });
        }

        // If updating status FROM 'Scheduled', check if startTime is within 15 minutes
        if (session.status === 'Scheduled' && status !== 'Scheduled') {
            const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
            const sessionStartTime = Math.floor(session.startTime / 1000); // Session start time in seconds
            const fifteenMinutesInSeconds = 15 * 60; // 15 minutes in seconds

            // Check if startTime is within 15 minutes from now
            if (sessionStartTime > currentTime + fifteenMinutesInSeconds) {
                return res.status(httpStatus.OK).json({
                    success: false,
                    message: `Cannot update status yet. Session is scheduled for ${new Date(session.startTime).toISOString()}. Status can only be updated when within 15 minutes of start time.`,
                    data: null
                });
            }
        }

        updateFields.status = status;
    }

    // Validate and update startTime/endTime (only before session starts)
    if (startTime !== undefined || endTime !== undefined) {
        if (session.status !== 'Lobby' && session.status !== 'Scheduled') {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'Cannot change timing after session has started',
                data: null
            });
        }

        const newStartTime = startTime !== undefined ? startTime : session.startTime;

        if (typeof newStartTime !== 'number') {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'startTime must be a valid timestamp (number in milliseconds)',
                data: null
            });
        }

        // Fetch all quiz questions to calculate total duration
        const quizQuestions = await QuizQuestion.find({ quizId: session.quizId });

        // Calculate total duration (sum of all question time limits in seconds)
        const totalDurationSeconds = quizQuestions.reduce((sum, question) => {
            return sum + (question.timeLimit || 30); // Default 30 seconds per question
        }, 0);

        // Calculate new endTime = startTime + total duration
        const newEndTime = newStartTime + (totalDurationSeconds * 1000);

        if (newEndTime <= newStartTime) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'endTime must be greater than startTime (calculated from quiz duration)',
                data: null
            });
        }

        if (startTime !== undefined) updateFields.startTime = startTime;

        // Always update endTime and duration based on calculated values
        updateFields.endTime = newEndTime;
        updateFields.duration = totalDurationSeconds;
    }

    // Update settings
    if (settings !== undefined) {
        updateFields.settings = {
            ...session.settings,
            ...settings
        };
    }

    // Perform update
    const updatedSession = await QuizGameSession.findByIdAndUpdate(id, { $set: updateFields }, { new: true })
        .populate({ path: 'hostId', select: 'firstName lastName email role franchiseeInfoId' })
        .populate({ path: 'quizId', select: 'title description category questions language' })
        .populate({ path: 'franchiseId', select: 'franchiseeName location' });

    // Check if status was updated to Lobby for the FIRST TIME (only from Scheduled status)
    if (isFirstTimeUpdatingToLobby) {
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
        const sessionStartTime = Math.floor((startTime || updatedSession.startTime) / 1000); // Session start time in seconds
        const fifteenMinutesInSeconds = 15 * 60; // 15 minutes in seconds

        // Check if startTime is within 15 minutes from now
        if (sessionStartTime <= currentTime + fifteenMinutesInSeconds) {
            // Fetch quiz questions
            const getQuetionOfTheQuiz = await QuizQuestion.find({ quizId: updatedSession.quizId._id })
                .populate({ path: 'categoryId', select: 'name description' })
                .populate({ path: 'quizId', select: 'title description category language' });

            // Convert questionList to object indexed by question ID
            let questionList = {};
            const imagePinAreasByQuestionId = {};
            getQuetionOfTheQuiz.forEach(question => {
                const questionId = question._id.toString();

                // Build base question data
                const questionData = {
                    id: questionId,
                    quizId: question.quizId._id.toString(),
                    categoryId: question.categoryId._id.toString(),
                    categoryName: question.categoryId.name[question.quizId.language],
                    type: question.type,
                    difficaltyLavel: question.difficaltyLavel,
                    timeLimit: question.timeLimit,
                    sessionStatus: "created",
                    maxScore: question.maxScore || 100
                };

                // Add optional fields only if they exist
                if (question.backgroundImage) questionData.backgroundImage = question.backgroundImage;
                if (question.questionText) questionData.questionText = question.questionText;
                if (question.media) questionData.media = question.media;
                if (question.explanation) questionData.explanation = question.explanation;

                // Add type-specific fields
                if (question.type === 'Quiz') {
                    questionData.options = question.options.map(option => ({
                        id: option._id.toString(),
                        text: option.text,
                        image: option.image || null,
                        isCorrect: option.isCorrect
                    }));
                    if (question.multiSelect !== undefined) questionData.multiSelect = question.multiSelect;
                }

                if (question.type === 'TrueFalse') {
                    if (question.trueAnswer !== undefined) questionData.trueAnswer = question.trueAnswer;
                }

                if (question.type === 'TypeAnswer') {
                    if (question.acceptedAnswers) questionData.acceptedAnswers = question.acceptedAnswers;
                }

                if (question.type === 'Puzzle') {
                    if (question.puzzleOrder) {
                        questionData.puzzleOrder = question.puzzleOrder;
                        questionData.puzzleSuffleOrder = getShuffledArray(question.puzzleOrder);
                    }
                }

                if (question.type === 'Slider') {
                    if (question.slider) questionData.slider = question.slider;
                }

                if (question.type === 'Slide') {
                    if (question.slideContent) questionData.slideContent = question.slideContent;
                }

                if (question.type === 'imagePin') {
                    if (question.imagePinFile) {
                        questionData.imagePinFile = question.imagePinFile;
                    }

                    const sanitizedImagePins = normalizeImagePinArrObj(question.imagePinArrObj);
                    questionData.imagePinArrObj = sanitizedImagePins;

                    if (sanitizedImagePins.length) {
                        imagePinAreasByQuestionId[questionId] = sanitizedImagePins;
                    }
                }

                questionList[questionId] = questionData;
            });

            /** create firebase realtime code start */
            // Create quizGameSessions node and set initial data in Firebase
            // Questions are indexed by questionId for efficient access
            const firebasePayload = {
                answers: null,
                scores: null,
                metaData: { ...updatedSession.settings },
                currentQuestionId: null,
                questionResults: null,
                leaderboard: null,
                finalResults: null,
                players: null,
                questions: questionList
            };

            await firebaseDB.ref(`quizGameSessions/${updatedSession._id}`).set(firebasePayload);
            /** create firebase realtime code end */
        }
    }

    return res.status(httpStatus.OK).json({
        success: true,
        message: 'Quiz game session updated successfully',
        data: updatedSession
    });
});

/**
 * Deletes a quiz game session.
 * DELETE /quiz/game-session/:id
 * 
 * Only allows deletion if session is in Lobby status.
 * 
 * Returns: success message
 */
const deleteQuizGameSession = catchAsync(async (req, res) => {
    const { id } = req.params;

    const session = await QuizGameSession.findById(id);
    if (!session) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Quiz game session not found',
            data: null
        });
    }

    // Only allow deletion in Lobby status
    if (session.status !== 'Lobby') {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'Cannot delete a session that is in progress or completed',
            data: null
        });
    }

    await QuizGameSession.findByIdAndDelete(id);

    return res.status(httpStatus.OK).json({
        success: true,
        message: 'Quiz game session deleted successfully',
        data: null
    });
});

// ================================
// 📌 QUIZ GAME SESSION PLAYER APIs
// ================================

/**
 * Join a quiz game session using gamePin or QR code.
 * POST /quiz/game-session/join
 * 
 * Request body:
 * {
 *   clientId (required - player ID),
 *   gamePin (required - 8-digit PIN) OR qrCode (alternative validation)
 * }
 * 
 * Validates the PIN/QR code, checks session exists and is in Lobby status,
 * then creates a new QuizSessionPlayer record.
 * 
 * Returns: session player data with populated session details
 */
const joinQuizGameSession = catchAsync(async (req, res) => {
    try {
        const {
            clientId,
            gamePin
        } = req.body;

        // ===== VALIDATION =====
        if (!clientId || !gamePin) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'clientId and gamePin are required',
                data: null
            });
        }

        // Validate clientId exists
        const client = await Player.findById(clientId);
        if (!client) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: 'Client/Player not found',
                data: null
            });
        }

        // Find session by gamePin
        const session = await QuizGameSession.findOne({ gamePin: gamePin.toString() });
        if (!session) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: 'Invalid game PIN. Quiz session not found',
                data: null
            });
        }

        let statusToJoin = ['Lobby', 'InProgress'];
        // Check if session is in Lobby status (accepting players)
        if (!statusToJoin.includes(session.status)) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: `Cannot join session with status: ${session.status}. Session must be in Lobby status`,
                data: null
            });
        }

        // Check if player is already in this session
        // const existingPlayer = await QuizSessionPlayer.findOne({
        //     quizGameSessionId: session._id,
        //     clientId: clientId,
        //     isDeleted: false
        // });

        // if (existingPlayer && existingPlayer.isActive) {
        //     return res.status(httpStatus.OK).json({
        //         success: false,
        //         message: 'Player already joined this session',
        //         data: null
        //     });
        // }

        // Fetch quiz to get quizType from visibility
        const quiz = await Quiz.findById(session.quizId);
        if (!quiz) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: 'Quiz not found',
                data: null
            });
        }

        // Determine quizType from quiz visibility (local or national)
        const quizType = quiz.visibility === 'National' ? 'National' : 'Local';

        // Check if player session already exists for this game session
        let playerSession = await QuizSessionPlayer.findOne({
            quizGameSessionId: session._id,
            clientId: clientId,
            isDeleted: false
        });

        // Track if this is a new player session for counting purposes
        const isNewPlayerSession = !playerSession;

        if (playerSession) {
            // Update joinedAt time and set isActive to true
            playerSession.joinedAt = Date.now();
            playerSession.isActive = true;
            playerSession.leftAt = null;
            await playerSession.save();

            // Add clientId to session's settings.clientIds array (if not already present)
            await QuizGameSession.findByIdAndUpdate(
                session._id,
                { $addToSet: { 'settings.clientIds': clientId } }
            );
        } else {
            // Create player session record
            const playerSessionData = {
                quizGameSessionId: session._id,
                franchiseId: session.franchiseId,
                quizId: session.quizId,
                quizType: quizType, // Fetched from Quiz model visibility
                clientId: clientId,
                totalScore: 0,
                streak: 0,
                answers: [],
                finalRank: null,
                dateEarned: Date.now(),
                joinedAt: Date.now(),
                leftAt: null,
                isActive: true,
                isDeleted: false
            };

            playerSession = new QuizSessionPlayer(playerSessionData);
            await playerSession.save();

            // Add clientId to session's settings.clientIds array
            await QuizGameSession.findByIdAndUpdate(
                session._id,
                { $addToSet: { 'settings.clientIds': clientId } }
            );
        }

        // Count total games played by this player (all non-deleted sessions)
        let totalPlayedGamesCount = await QuizSessionPlayer.countDocuments({
            clientId: clientId,
            isDeleted: false
        });

        // If this is a new player session, count it as played game (increment by 1)
        if (isNewPlayerSession) {
            totalPlayedGamesCount = 1;
        }

        /** JOIN FIREBASE PLAYER */
        // Add player data to Firebase RTDB under quizGameSessions/{session._id}/players/{clientId}
        const playerData = {
            pseudoName: client.pseudoName,
            playerId: client._id.toString(),
            profileAvatar: client.profileAvatar ? `${s3BaseUrl}${client.profileAvatar}` : null,
            joinedAt: playerSession.joinedAt,
            totalPlayedGamesCount: totalPlayedGamesCount
        };
        await firebaseDB.ref(`quizGameSessions/${session._id}/players/${client._id}`).set(playerData);
        /** END FIREBASE PLAYER */


        // Populate references
        const populatedPlayerSession = await QuizSessionPlayer.findById(playerSession._id)
            .populate({ path: 'quizGameSessionId', select: 'gamePin status startTime endTime duration quizId hostId franchiseId' })
            .populate({ path: 'clientId', select: 'firstName lastName email phone profilePicture' })
            .populate({ path: 'franchiseId', select: 'name location' })
            .populate({ path: 'quizId', select: 'title description category' });

        return res.status(httpStatus.CREATED).json({
            success: true,
            message: 'Player successfully joined the quiz game session',
            data: populatedPlayerSession
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'An error occurred while joining the quiz game session',
            error: error.message,
            data: null
        });
    }
});

/**
 * Submit answer for a quiz question in an active game session.
 * POST /quiz/game-session/answer
 * 
 * Request body:
 * {
 *   playerSessionId (required - ID from joinQuizGameSession),
 *   questionId (required),
 *   answer (required - the player's submitted answer),
 *   timeTaken (required - time in seconds),
 *   isCorrect (required - boolean indicating if answer is correct),
 *   scoreAwarded (required - points for this question)
 * }
 * 
 * Stores the answer, updates totalScore and streak counter,
 * and validates question belongs to the session's quiz.
 * 
 * Returns: updated player session with new answer added
 */
const submitQuizAnswer = catchAsync(async (req, res) => {
    const {
        playerSessionId,
        questionId,
        answer,
        timeTaken,
        isCorrect,
        scoreAwarded
    } = req.body;

    // ===== VALIDATION =====
    if (!playerSessionId || !questionId || answer === undefined || timeTaken === undefined || isCorrect === undefined || scoreAwarded === undefined) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'playerSessionId, questionId, answer, timeTaken, isCorrect, and scoreAwarded are required',
            data: null
        });
    }

    // Validate timeTaken is a positive number
    if (typeof timeTaken !== 'number' || timeTaken < 0) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'timeTaken must be a positive number (in seconds)',
            data: null
        });
    }

    // Validate isCorrect is boolean
    if (typeof isCorrect !== 'boolean') {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'isCorrect must be a boolean value',
            data: null
        });
    }

    // Validate scoreAwarded is a non-negative number
    if (typeof scoreAwarded !== 'number' || scoreAwarded < 0) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'scoreAwarded must be a non-negative number',
            data: null
        });
    }

    // Fetch player session
    const playerSession = await QuizSessionPlayer.findById(playerSessionId);
    if (!playerSession) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Player session not found',
            data: null
        });
    }

    // Check if player is still active in session
    if (!playerSession.isActive) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'Player has left this session',
            data: null
        });
    }

    // Fetch the quiz game session to verify question belongs to quiz
    const gameSession = await QuizGameSession.findById(playerSession.quizGameSessionId);
    if (!gameSession) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Game session not found',
            data: null
        });
    }

    // Verify question exists and belongs to session's quiz
    const question = await QuizQuestion.findById(questionId);
    if (!question || question.quizId.toString() !== gameSession.quizId.toString()) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'Question does not belong to this quiz session',
            data: null
        });
    }

    // Check if answer already submitted for this question
    const existingAnswer = playerSession.answers.find(
        ans => ans.questionId.toString() === questionId
    );

    if (existingAnswer) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'Answer already submitted for this question',
            data: null
        });
    }

    // Create answer object
    const answerData = {
        questionId: questionId,
        answer: answer,
        timeTaken: timeTaken,
        isCorrect: isCorrect,
        scoreAwarded: scoreAwarded
    };

    // Calculate streak update
    let newStreak = playerSession.streak;
    if (isCorrect) {
        newStreak = playerSession.streak + 1;
    } else {
        newStreak = 0; // Reset streak on incorrect answer
    }

    // Update player session with new answer, score, and streak
    const updatedPlayerSession = await QuizSessionPlayer.findByIdAndUpdate(
        playerSessionId,
        {
            $push: { answers: answerData },
            $inc: { totalScore: scoreAwarded },
            $set: { streak: newStreak }
        },
        { new: true }
    )
        .populate({ path: 'quizGameSessionId', select: 'gamePin status startTime endTime duration quizId hostId franchiseId' })
        .populate({ path: 'clientId', select: 'firstName lastName email phone profilePicture' });

    return res.status(httpStatus.OK).json({
        success: true,
        message: 'Answer submitted successfully',
        data: {
            playerSession: updatedPlayerSession,
            answerData: answerData,
            totalScore: updatedPlayerSession.totalScore,
            streak: updatedPlayerSession.streak
        }
    });
});

/**
 * Leave a quiz game session.
 * POST /quiz/game-session/leave
 * 
 * Request body:
 * {
 *   playerSessionId (required)
 * }
 * 
 * Updates leftAt timestamp and marks player as inactive.
 * 
 * Returns: updated player session data
 */
const leaveQuizGameSession = catchAsync(async (req, res) => {
    const { playerSessionId } = req.body;

    // ===== VALIDATION =====
    if (!playerSessionId) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'playerSessionId is required',
            data: null
        });
    }

    // Fetch player session
    const playerSession = await QuizSessionPlayer.findById(playerSessionId);
    if (!playerSession) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Player session not found',
            data: null
        });
    }

    // Check if already left
    if (!playerSession.isActive) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'Player has already left this session',
            data: null
        });
    }

    // Update player session - set leftAt and isActive to false
    const updatedPlayerSession = await QuizSessionPlayer.findByIdAndUpdate(
        playerSessionId,
        {
            $set: {
                leftAt: Date.now(),
                isActive: false
            }
        },
        { new: true }
    )
        .populate({ path: 'quizGameSessionId', select: 'gamePin status startTime endTime duration quizId hostId franchiseId' })
        .populate({ path: 'clientId', select: 'firstName lastName email phone profilePicture' });

    return res.status(httpStatus.OK).json({
        success: true,
        message: 'Player successfully left the quiz game session',
        data: updatedPlayerSession
    });
});

/**
 * Get player's session data including score, answers, and streak.
 * GET /quiz/game-session/:sessionId/player/:clientId
 * 
 * Retrieves the player's session record with all answers and performance metrics.
 * 
 * Returns: player session data with populated references and all answers
 */
const getPlayerSessionData = catchAsync(async (req, res) => {
    const { sessionId, clientId } = req.params;

    // ===== VALIDATION =====
    if (!sessionId || !clientId) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'sessionId and clientId are required',
            data: null
        });
    }

    // Fetch player session
    const playerSession = await QuizSessionPlayer.findOne({
        quizGameSessionId: sessionId,
        clientId: clientId,
        isDeleted: false
    })
        .populate({ path: 'quizGameSessionId', select: 'gamePin status startTime endTime duration quizId hostId franchiseId' })
        .populate({ path: 'clientId', select: 'firstName lastName email phone profilePicture' })
        .populate({ path: 'franchiseId', select: 'name location' })
        .populate({ path: 'quizId', select: 'title description category visibility' })
        .populate({
            path: 'answers.questionId',
            select: 'questionText type options trueAnswer explanation'
        });

    if (!playerSession) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Player session not found',
            data: null
        });
    }

    // Calculate session duration for this player
    const sessionDuration = playerSession.leftAt
        ? (playerSession.leftAt - playerSession.joinedAt)
        : (Date.now() - playerSession.joinedAt);

    return res.status(httpStatus.OK).json({
        success: true,
        message: 'Player session data fetched successfully',
        data: {
            playerSession: playerSession,
            stats: {
                quizId: playerSession.quizId,
                franchiseId: playerSession.franchiseId,
                quizType: playerSession.quizType,
                finalRank: playerSession.finalRank,
                dateEarned: playerSession.dateEarned,
                totalScore: playerSession.totalScore,
                streak: playerSession.streak,
                answersSubmitted: playerSession.answers.length,
                correctAnswers: playerSession.answers.filter(a => a.isCorrect).length,
                accuracy: playerSession.answers.length > 0
                    ? ((playerSession.answers.filter(a => a.isCorrect).length / playerSession.answers.length) * 100).toFixed(2) + '%'
                    : '0%',
                sessionDuration: Math.floor(sessionDuration / 1000) + ' seconds',
                isActive: playerSession.isActive
            }
        }
    });
});

/**
 * Get all players in a quiz game session with their scores.
 * GET /quiz/game-session/:sessionId/players
 * 
 * Retrieves leaderboard/ranking data for all players in the session.
 * 
 * Returns: array of all players with their scores sorted by score descending
 */
const getSessionLeaderboard = catchAsync(async (req, res) => {
    const { sessionId } = req.params;

    // ===== VALIDATION =====
    if (!sessionId) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'sessionId is required',
            data: null
        });
    }

    // Verify session exists
    const session = await QuizGameSession.findById(sessionId);
    if (!session) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Game session not found',
            data: null
        });
    }

    // Fetch all players in the session sorted by totalScore descending
    const players = await QuizSessionPlayer.find({
        quizGameSessionId: sessionId,
        isDeleted: false
    })
        .populate({ path: 'clientId', select: 'firstName lastName email phone profilePicture' })
        .populate({ path: 'franchiseId', select: 'franchiseeName location' })
        .populate({ path: 'quizId', select: 'title description category visibility' })
        .sort({ totalScore: -1, streak: -1 });

    // Calculate ranking and additional stats
    const leaderboard = players.map((player, index) => {
        // Update finalRank for each player
        const playerRank = index + 1;
        QuizSessionPlayer.findByIdAndUpdate(player._id, { finalRank: playerRank }).catch(() => { });

        // Determine quizType from quiz visibility
        const quizType = player.quizId?.visibility === 'National' ? 'National' : 'Local';

        return {
            rank: playerRank,
            finalRank: player.finalRank || playerRank,
            playerInfo: {
                clientId: player.clientId._id,
                firstName: player.clientId.firstName,
                lastName: player.clientId.lastName,
                email: player.clientId.email,
                profilePicture: player.clientId.profilePicture
            },
            quizInfo: {
                quizId: player.quizId._id,
                title: player.quizId.title,
                quizType: quizType, // Fetched from quiz visibility
                visibility: player.quizId.visibility
            },
            franchiseInfo: {
                franchiseId: player.franchiseId._id,
                franchiseeName: player.franchiseId.franchiseeName,
                location: player.franchiseId.location
            },
            totalScore: player.totalScore,
            streak: player.streak,
            answersSubmitted: player.answers.length,
            correctAnswers: player.answers.filter(a => a.isCorrect).length,
            accuracy: player.answers.length > 0
                ? ((player.answers.filter(a => a.isCorrect).length / player.answers.length) * 100).toFixed(2) + '%'
                : '0%',
            dateEarned: player.dateEarned,
            isActive: player.isActive,
            joinedAt: player.joinedAt,
            leftAt: player.leftAt
        };
    });

    return res.status(httpStatus.OK).json({
        success: true,
        message: 'Session leaderboard fetched successfully',
        data: {
            sessionId: sessionId,
            totalPlayers: leaderboard.length,
            activePlayers: leaderboard.filter(p => p.isActive).length,
            leaderboard: leaderboard
        }
    });
});

// ================================
// 📌 SCORING & POINTS CALCULATION
// ================================

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 Calculate Points for Quiz Question Answer
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Calculate points earned by a player for answering a quiz question
 * Based on: Difficulty Level, Response Time, Correctness
 * 
 * Scoring Formula:
 * ────────────────────────────────────────────────────────────────────────────────
 * Base Points = 100
 * 
 * Difficulty Multiplier:
 *   - Easy: 1.0x (100 points max)
 *   - Medium: 1.5x (150 points max)
 *   - Hard: 2.0x (200 points max)
 *   - VeryHard: 2.5x (250 points max)
 * 
 * Time Bonus/Penalty (based on % of timeLimit):
 *   - Fast (0-30%): +20% bonus
 *   - Normal (30-70%): +10% bonus
 *   - Slow (70-100%): 0% (no bonus/penalty)
 *   - Timeout (>100%): -50% penalty (minimum 0)
 * 
 * Correctness:
 *   - Correct answer: Full points
 *   - Incorrect answer: 0 points (no partial credit)
 * 
 * Final Formula:
 * Points = (BasePoints × DifficultyMultiplier) × (1 + TimeBonus) × CorrectnessMultiplier
 * ────────────────────────────────────────────────────────────────────────────────
 * 
 * POST /quiz/calculate-points
 * 
 * Request Body:
 * {
 *   sessionId (required - quiz game session ID),
 *   quizId (required - quiz ID),
 *   questionId (required - question ID),
 *   playerId (required - player/client ID),
 *   answer (required - player's answer),
 *   responseTime (required - time taken in seconds),
 *   isCorrect (required - boolean, whether answer is correct)
 * }
 * 
 * Response Example:
 * {
 *   "success": true,
 *   "message": "Points calculated successfully",
 *   "data": {
 *     "basePoints": 100,
 *     "difficulty": "Medium",
 *     "difficultyMultiplier": 1.5,
 *     "responseTime": 25,
 *     "timeLimit": 40,
 *     "timePercentage": 62.5,
 *     "timeCategory": "Normal",
 *     "timeBonus": 0.1,
 *     "isCorrect": true,
 *     "correctnessMultiplier": 1,
 *     "finalPoints": 165,
 *     "breakdown": {
 *       "step1_basePoints": 100,
 *       "step2_afterDifficulty": 150,
 *       "step3_afterTimeBonus": 165,
 *       "step4_afterCorrectness": 165
 *     }
 *   }
 * }
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const calculateQuestionPoints = catchAsync(async (req, res) => {
    const {
        sessionId,
        quizId,
        questionId,
        playerId,
        answer,
        responseTime,
        isCorrect
    } = req.body;

    // ===== VALIDATION =====
    if (!sessionId || !quizId || !questionId || !playerId || answer === undefined || responseTime === undefined || isCorrect === undefined) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'Missing required fields: sessionId, quizId, questionId, playerId, answer, responseTime, isCorrect',
            data: null
        });
    }

    // Validate responseTime is a non-negative number
    if (typeof responseTime !== 'number' || responseTime < 0) {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'responseTime must be a non-negative number (in seconds)',
            data: null
        });
    }

    // Validate isCorrect is boolean
    if (typeof isCorrect !== 'boolean') {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'isCorrect must be a boolean',
            data: null
        });
    }

    try {
        // ===== FETCH DATA =====
        // Fetch quiz game session
        const session = await QuizGameSession.findById(sessionId);
        if (!session) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: 'Quiz game session not found',
                data: null
            });
        }

        // Verify quizId matches session
        if (session.quizId.toString() !== quizId) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'quizId does not match the session quiz',
                data: null
            });
        }

        // Fetch question
        const question = await QuizQuestion.findById(questionId);
        if (!question) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: 'Quiz question not found',
                data: null
            });
        }

        // Verify question belongs to quiz
        if (question.quizId.toString() !== quizId) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'questionId does not belong to the specified quiz',
                data: null
            });
        }

        // ===== SCORING CALCULATION =====
        const BASE_POINTS = 100;

        // STEP 1: Determine difficulty multiplier
        const difficultyMultipliers = {
            'Easy': 1.0,
            'Medium': 1.5,
            'Hard': 2.0,
            'VeryHard': 2.5
        };

        const difficulty = question.difficaltyLavel || 'Easy';
        const difficultyMultiplier = difficultyMultipliers[difficulty] || 1.0;

        // STEP 2: Calculate base points after difficulty
        const pointsAfterDifficulty = BASE_POINTS * difficultyMultiplier;

        // STEP 3: Calculate time bonus/penalty
        const timeLimit = question.timeLimit || 30; // Default 30 seconds if not set
        const timePercentage = (responseTime / timeLimit) * 100;

        let timeBonus = 0;
        let timeCategory = 'Normal';

        if (timePercentage <= 30) {
            // Fast: 0-30% of time limit = +20% bonus
            timeBonus = 0.20;
            timeCategory = 'Fast';
        } else if (timePercentage <= 70) {
            // Normal: 30-70% of time limit = +10% bonus
            timeBonus = 0.10;
            timeCategory = 'Normal';
        } else if (timePercentage <= 100) {
            // Slow: 70-100% of time limit = no bonus
            timeBonus = 0;
            timeCategory = 'Slow';
        } else {
            // Timeout: >100% of time limit = -50% penalty
            timeBonus = -0.50;
            timeCategory = 'Timeout';
        }

        // STEP 4: Calculate points after time bonus/penalty
        const pointsAfterTime = pointsAfterDifficulty * (1 + timeBonus);

        // STEP 5: Apply correctness multiplier
        const correctnessMultiplier = isCorrect ? 1 : 0;
        const finalPoints = pointsAfterTime * correctnessMultiplier;

        // ===== BUILD RESPONSE =====
        const pointsBreakdown = {
            basePoints: BASE_POINTS,
            difficulty: difficulty,
            difficultyMultiplier: difficultyMultiplier,
            responseTime: responseTime,
            timeLimit: timeLimit,
            timePercentage: parseFloat(timePercentage.toFixed(2)),
            timeCategory: timeCategory,
            timeBonus: timeBonus,
            isCorrect: isCorrect,
            correctnessMultiplier: correctnessMultiplier,
            finalPoints: Math.round(finalPoints),
            breakdown: {
                step1_basePoints: BASE_POINTS,
                step2_afterDifficulty: parseFloat(pointsAfterDifficulty.toFixed(2)),
                step3_afterTimeBonus: parseFloat(pointsAfterTime.toFixed(2)),
                step4_afterCorrectness: Math.round(finalPoints)
            }
        };

        return res.status(httpStatus.OK).json({
            success: true,
            message: 'Points calculated successfully',
            data: pointsBreakdown
        });

    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Error calculating points',
            error: error.message,
            data: null
        });
    }
});

const completeQuizGameSessionQuestionsData = catchAsync(async (req, res) => {

    // Extract data from req.body
    const { gameSessionId, leaderBoardData } = req.body;
    if (!gameSessionId || !leaderBoardData) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: 'Missing gameSessionId or leaderBoardData',
            data: null
        });
    }

    // Fetch the game session and quiz type
    const gameSession = await QuizGameSession.findById(gameSessionId).populate({ path: 'quizId', select: 'visibility' });
    if (!gameSession) {
        return res.status(httpStatus.NOT_FOUND).json({
            success: false,
            message: 'Game session not found',
            data: null
        });
    }
    // Check if session is already completed or cancelled
    if (gameSession.status === 'Completed' || gameSession.status === 'Cancelled') {
        return res.status(httpStatus.OK).json({
            success: false,
            message: 'Game session already completed',
            data: null
        });
    }

    // Map gameData
    if (leaderBoardData.gameData) {
        gameSession.totalNumberOfQuestions = leaderBoardData.gameData.totalNoOfQuestions;
        gameSession.totalPlayerCount = leaderBoardData.gameData.totalPlayers;
    }

    // Map specialAwards
    if (leaderBoardData.specialAwards) {
        const awardsArr = [];
        Object.keys(leaderBoardData.specialAwards).forEach(awardType => {
            leaderBoardData.specialAwards[awardType].forEach(player => {
                awardsArr.push({
                    awards: awardType,
                    ...player
                });
            });
        });
        gameSession.specialAwards = awardsArr;
    }

    // Map leaderBoard to podium
    if (Array.isArray(leaderBoardData.leaderBoard)) {
        gameSession.podium = leaderBoardData.leaderBoard.map(player => ({
            joinedAt: player.joinedAt,
            playerId: player.playerId,
            profileAvatar: player.profileAvatar,
            pseudoName: player.pseudoName,
            totalPlayedGamesCount: player.totalPlayedGamesCount,
            avgResponseTime: player.avgResponseTime,
            badAnswerCount: player.badAnswerCount,
            currentStreakCount: player.currentStreakCount,
            goodAnswerCount: player.goodAnswerCount,
            highestStreakCount: player.highestStreakCount,
            missedAnswerCount: player.missedAnswerCount,
            totalResponseTime: player.totalResponseTime,
            totalScore: player.totalScore,
            position: player.position || null,
            badges: Array.isArray(player.badges) ? player.badges.map(badge => ({
                id: badge.id,
                name: badge.name,
                iconUrl: badge.iconUrl
            })) : []
        }));
    }


    // Bulk update player stats and session records
    const quizType = gameSession.quizId?.visibility || 'Local';
    const leaderboard = leaderBoardData.leaderBoard || [];
    for (let i = 0; i < leaderboard.length; i++) {
        const player = leaderboard[i];
        // Update ClientStat
        const clientStat = await PlayerStat.findOne({ clientId: player.playerId });
        if (clientStat) {
            const statObj = quizType === 'National' ? clientStat.national : clientStat.local;
            statObj.totalXP += player.totalScore || 0;
            statObj.totalGamesPlayed += 1;
            if (i === 0) statObj.totalFirstPlaceWins += 1;
            if (i === 1) statObj.totalSecondPlaceWins += 1;
            if (i === 2) statObj.totalThirdPlaceWins += 1;
            if (i === leaderboard.length - 1) statObj.worstPosition = (leaderboard.length);
            if (!statObj.maxStreak || player.highestStreakCount > statObj.maxStreak) {
                statObj.maxStreak = player.highestStreakCount;
            }
            if (Array.isArray(player.badges)) {
                player.badges.forEach(badge => {
                    const existingBadge = statObj.badges.find(b => b.badgeId?.toString() === badge.id);
                    if (existingBadge) {
                        existingBadge.earnedCount = (existingBadge.earnedCount || 1) + 1;
                        existingBadge.earnedAt = new Date();
                    } else {
                        statObj.badges.push({
                            badgeId: badge.id,
                            badgeIcon: badge.iconUrl,
                            badgeName: badge.name?.en_us || '',
                            description: '',
                            earnedAt: new Date(),
                            earnedCount: 1
                        });
                    }
                });
            }
            clientStat.totalGamesPlayedAllTypes = (clientStat.local.totalGamesPlayed || 0) + (clientStat.national.totalGamesPlayed || 0);
            await clientStat.save();
        }

        // Update or create FranchiseeLeaderboard
        if (gameSession.franchiseId) {
            let franchiseeEntry = await FranchiseeLeaderboard.findOne({ clientId: player.playerId, franchiseeInfoId: gameSession.franchiseId });
            if (franchiseeEntry) {
                franchiseeEntry.totalXp += player.totalScore || 0;
                franchiseeEntry.totalGamesPlayed += 1;
                franchiseeEntry.updatedAt = new Date();
                await franchiseeEntry.save();
            } else {
                await FranchiseeLeaderboard.create({
                    clientId: player.playerId,
                    franchiseeInfoId: gameSession.franchiseId,
                    totalXp: player.totalScore || 0,
                    totalGamesPlayed: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                    isDeleted: false
                });
            }
        }

        // Update or create Local/National Leaderboard
        if (quizType === 'Local') {
            let localEntry = await LocalLeaderboard.findOne({ clientId: player.playerId });
            if (localEntry) {
                localEntry.totalXp += player.totalScore || 0;
                localEntry.totalGamesPlayed += 1;
                localEntry.updatedAt = new Date();
                await localEntry.save();
            } else {
                await LocalLeaderboard.create({
                    clientId: player.playerId,
                    totalXp: player.totalScore || 0,
                    totalGamesPlayed: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                    isDeleted: false
                });
            }
        } else if (quizType === 'National') {
            let nationalEntry = await NationalLeaderboard.findOne({ clientId: player.playerId });
            if (nationalEntry) {
                nationalEntry.totalXp += player.totalScore || 0;
                nationalEntry.totalGamesPlayed += 1;
                nationalEntry.updatedAt = new Date();
                await nationalEntry.save();
            } else {
                await NationalLeaderboard.create({
                    clientId: player.playerId,
                    totalXp: player.totalScore || 0,
                    totalGamesPlayed: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                    isDeleted: false
                });
            }
        }

        // Update QuizSessionPlayer
        const sessionPlayer = await QuizSessionPlayer.findOne({ quizGameSessionId: gameSessionId, clientId: player.playerId });
        if (sessionPlayer) {
            sessionPlayer.finalRank = i + 1;
            sessionPlayer.streak = player.currentStreakCount || 0;
            sessionPlayer.totalScore = player.totalScore || 0;
            await sessionPlayer.save();
        }
    }
    gameSession.status = 'Completed';
    await gameSession.save();

    res.status(httpStatus.OK).json({
        success: true,
        message: 'Quiz game session questions data completed and saved',
        data: {
            gameSessionId,
            totalNumberOfQuestions: gameSession.totalNumberOfQuestions,
            totalPlayerCount: gameSession.totalPlayerCount,
            podium: gameSession.podium,
            specialAwards: gameSession.specialAwards
        }
    });
})

const playerResponseAnswer = catchAsync(async (req, res) => {

    try {
        const {
            gameSessionId,
            playerId,
            answer,
            score,
            totalScore
        } = req.body;

        if (!gameSessionId || !playerId || !answer || !answer.questionId) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage("CLIENTID_REQUIRED", res.locals.language),
                data: null
            });
        }

        // Fetch game session and quiz info
        const gameSession = await QuizGameSession.findById(gameSessionId)
            .populate({ path: 'quizId', select: 'quizType' })
            .populate({ path: 'franchiseId', select: 'name location' });
        if (!gameSession) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: getMessage("QUIZ_GAME_SESSION_NOT_FOUND", res.locals.language),
                data: null
            });
        }

        // Find player session
        let playerSession = await QuizSessionPlayer.findOne({
            quizGameSessionId: gameSessionId,
            clientId: playerId,
            isDeleted: false
        });

        if (!playerSession) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: getMessage("PLAYER_NOT_FOUND_SIGNUP_FIRST", res.locals.language),
                data: null
            });
        }

        // Check if answer for this question already exists
        const answerIndex = playerSession.answers.findIndex(
            a => a.questionId.toString() === answer.questionId
        );

        const answerObj = {
            questionId: answer.questionId,
            questionType: answer.questionType,
            answerObj: answer.answerObj,
            timeTaken: answer.responseTime,
            isCorrect: answer.isAnsweredCorrect,
            scoreAwarded: score
        };

        if (answerIndex === -1) {
            // Add new answer
            playerSession.answers.push(answerObj);
        } else {
            // Update existing answer
            playerSession.answers[answerIndex] = answerObj;
        }

        // Update totalScore
        playerSession.totalScore = totalScore;

        await playerSession.save();

        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage("QUIZ_QUESTION_UPDATED_SUCCESS", res.locals.language),
            data: {
                quizGameSessionId: gameSessionId,
                clientId: playerId,
                quizId: gameSession.quizId?._id,
                franchiseId: gameSession.franchiseId?._id,
                quizType: gameSession.quizId?.quizType || null,
                answer: answerObj,
                score,
                totalScore
            }
        });
    } catch (err) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: getMessage("QUIZ_QUESTION_UPDATE_ERROR", res.locals.language),
            error: err.message,
            data: null
        });
    }
})


/**
 * Get player's quiz game session history
 * GET /quiz/game-session/history/:clientId
 * 
 * Query parameters:
 * - limit: number of records per page (default: 20, max: 100)
 * - skip: number of records to skip (default: 0)
 * 
 * Returns: array of player's previous game sessions with pagination info
 */
const getPlayerGameSessionHistory = catchAsync(async (req, res) => {
    try {
        const { clientId } = req.params;
        const { limit = 20, skip = 0 } = req.query;

        // ===== VALIDATION =====
        if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: 'clientId is required',
                data: null
            });
        }

        // Parse limit and skip as integers
        const pageLimit = Math.max(1, Math.min(100, parseInt(limit) || 20)); // Max 100, default 20
        const pageSkip = Math.max(0, parseInt(skip) || 0);

        // ===== FETCH DATA =====
        const filter = {
            clientId: clientId,
            isDeleted: false
        };

        // Get total count for pagination info
        const totalCount = await QuizSessionPlayer.countDocuments(filter);

        const playerSessions = await QuizSessionPlayer.find(filter)
            .populate({
                path: 'quizId',
                select: 'title description category visibility'
            })
            .populate({ path: 'clientId', select: 'firstName lastName email profilePicture' })
            .populate({ path: 'franchiseId', select: 'name location' })
            .sort({ joinedAt: -1 })
            .limit(pageLimit)
            .skip(pageSkip);

        // ===== FORMAT RESPONSE =====
        const formattedHistory = playerSessions.map(session => {
            return {
                sessionId: session._id,
                quizGameSessionId: session.quizGameSessionId,
                quizInfo: {
                    quizId: session.quizId._id,
                    title: session.quizId.title,
                    description: session.quizId.description,
                    category: session.quizId.category,
                    quizType: session.quizType,
                    visibility: session.quizId.visibility
                },
                playerInfo: {
                    clientId: session.clientId._id,
                    firstName: session.clientId.firstName,
                    lastName: session.clientId.lastName,
                    email: session.clientId.email
                },
                franchiseInfo: {
                    franchiseId: session.franchiseId._id,
                    name: session.franchiseId.name,
                },
                performance: {
                    totalScore: session.totalScore,
                    finalRank: session.finalRank,
                    streak: session.streak
                },
                sessionDates: {
                    joinedAt: session.joinedAt,
                    leftAt: session.leftAt,
                    dateEarned: session.dateEarned
                },
                isActive: session.isActive,
                quizType: session.quizType
            };
        });

        return res.status(httpStatus.OK).json({
            success: true,
            message: 'Player game session history fetched successfully',
            data: formattedHistory,
            count: formattedHistory.length,
            totalCount: totalCount,
            pagination: {
                limit: pageLimit,
                skip: pageSkip,
                page: Math.floor(pageSkip / pageLimit) + 1,
                totalPages: Math.ceil(totalCount / pageLimit)
            }
        });
    } catch (err) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Error fetching player game session history',
            error: err.message,
            data: null
        });
    }
});

// ================================
// 📌 LEADERBOARD APIs
// ================================

/**
 * Get local leaderboard with optional player position
 * GET /quiz/leaderboard/local
 * 
 * Query parameters:
 * - clientId: optional - get specific player's current position
 * - limit: number of records per page (default: 20, max: 100)
 * - skip: number of records to skip (default: 0)
 * 
 * Returns: leaderboard sorted by totalXp (descending)
 */
const getLocalLeaderboard = catchAsync(async (req, res) => {
    try {
        const { clientId, limit = 20, skip = 0 } = req.query;

        // ===== VALIDATION =====
        const pageLimit = Math.max(1, Math.min(100, parseInt(limit) || 20));
        const pageSkip = Math.max(0, parseInt(skip) || 0);

        // ===== BUILD FILTER =====
        const filter = {
            isDeleted: false,
            isActive: true
        };

        // ===== FETCH LEADERBOARD DATA =====
        const totalCount = await LocalLeaderboard.countDocuments(filter);

        const leaderboardData = await LocalLeaderboard.find(filter)
            .populate({ path: 'clientId', select: 'firstName lastName pseudoName profileAvatar' })
            .sort({ totalXp: -1 })
            .limit(pageLimit)
            .skip(pageSkip);

        // ===== FORMAT LEADERBOARD RESPONSE =====
        const formattedLeaderboard = leaderboardData.map((entry, index) => {
            const rank = pageSkip + index + 1;

            return {
                rank: rank,
                clientId: entry.clientId._id,
                firstName: entry.clientId.firstName,
                lastName: entry.clientId.lastName,
                pseudoName: entry.clientId.pseudoName,
                profileAvatar: entry.clientId.profileAvatar,
                xp: entry.totalXp,
                totalGamesPlayed: entry.totalGamesPlayed,
                totalFirstPlaceWins: entry.totalFirstPlaceWins,
                totalSecondPlaceWins: entry.totalSecondPlaceWins,
                totalThirdPlaceWins: entry.totalThirdPlaceWins,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt
            };
        });

        // ===== GET CLIENT'S POSITION (if clientId provided) =====
        let clientPosition = null;

        if (clientId && typeof clientId === 'string' && clientId.trim()) {
            const clientLeaderboardEntry = await LocalLeaderboard.findOne({
                clientId: clientId,
                isDeleted: false,
                isActive: true
            }).populate({ path: 'clientId', select: 'firstName lastName pseudoName profileAvatar' });

            if (clientLeaderboardEntry) {
                const higherXpCount = await LocalLeaderboard.countDocuments({
                    isDeleted: false,
                    isActive: true,
                    totalXp: { $gt: clientLeaderboardEntry.totalXp }
                });

                const clientRank = higherXpCount + 1;

                clientPosition = {
                    rank: clientRank,
                    clientId: clientLeaderboardEntry.clientId._id,
                    firstName: clientLeaderboardEntry.clientId.firstName,
                    lastName: clientLeaderboardEntry.clientId.lastName,
                    pseudoName: clientLeaderboardEntry.clientId.pseudoName,
                    profileAvatar: clientLeaderboardEntry.clientId.profileAvatar,
                    xp: clientLeaderboardEntry.totalXp,
                    totalGamesPlayed: clientLeaderboardEntry.totalGamesPlayed,
                    totalFirstPlaceWins: clientLeaderboardEntry.totalFirstPlaceWins,
                    totalSecondPlaceWins: clientLeaderboardEntry.totalSecondPlaceWins,
                    totalThirdPlaceWins: clientLeaderboardEntry.totalThirdPlaceWins,
                    createdAt: clientLeaderboardEntry.createdAt,
                    updatedAt: clientLeaderboardEntry.updatedAt
                };
            }
        }

        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage ? getMessage("LOCAL_LEADERBOARD_FETCHED_SUCCESS", res.locals.language) : "Local leaderboard fetched successfully",
            data: {
                s3BaseUrl,
                type: 'local',
                totalPlayers: totalCount,
                displayedPlayers: formattedLeaderboard.length,
                leaderboard: formattedLeaderboard,
                clientPosition: clientPosition,
                pagination: {
                    limit: pageLimit,
                    skip: pageSkip,
                    page: Math.floor(pageSkip / pageLimit) + 1,
                    totalPages: Math.ceil(totalCount / pageLimit)
                }
            }
        });
    } catch (err) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: getMessage ? getMessage("LOCAL_LEADERBOARD_FETCH_ERROR", res.locals.language) : "Error fetching local leaderboard",
            error: err.message,
            data: null
        });
    }
});

/**
 * Get national leaderboard with optional player position
 * GET /quiz/leaderboard/national
 * 
 * Query parameters:
 * - clientId: optional - get specific player's current position
 * - limit: number of records per page (default: 20, max: 100)
 * - skip: number of records to skip (default: 0)
 * 
 * Returns: leaderboard sorted by totalXp (descending)
 */
const getNationalLeaderboard = catchAsync(async (req, res) => {
    try {
        const { clientId, limit = 20, skip = 0 } = req.query;

        // ===== VALIDATION =====
        const pageLimit = Math.max(1, Math.min(100, parseInt(limit) || 20));
        const pageSkip = Math.max(0, parseInt(skip) || 0);

        // ===== BUILD FILTER =====
        const filter = {
            isDeleted: false,
            isActive: true
        };

        // ===== FETCH LEADERBOARD DATA =====
        const totalCount = await NationalLeaderboard.countDocuments(filter);

        const leaderboardData = await NationalLeaderboard.find(filter)
            .populate({ path: 'clientId', select: 'firstName lastName pseudoName profileAvatar' })
            .sort({ totalXp: -1 })
            .limit(pageLimit)
            .skip(pageSkip);

        // ===== FORMAT LEADERBOARD RESPONSE =====
        const formattedLeaderboard = leaderboardData.map((entry, index) => {
            const rank = pageSkip + index + 1;

            return {
                rank: rank,
                clientId: entry.clientId._id,
                firstName: entry.clientId.firstName,
                lastName: entry.clientId.lastName,
                pseudoName: entry.clientId.pseudoName,
                profileAvatar: entry.clientId.profileAvatar,
                xp: entry.totalXp,
                totalGamesPlayed: entry.totalGamesPlayed,
                totalFirstPlaceWins: entry.totalFirstPlaceWins,
                totalSecondPlaceWins: entry.totalSecondPlaceWins,
                totalThirdPlaceWins: entry.totalThirdPlaceWins,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt
            };
        });

        // ===== GET CLIENT'S POSITION (if clientId provided) =====
        let clientPosition = null;

        if (clientId && typeof clientId === 'string' && clientId.trim()) {
            const clientLeaderboardEntry = await NationalLeaderboard.findOne({
                clientId: clientId,
                isDeleted: false,
                isActive: true
            }).populate({ path: 'clientId', select: 'firstName lastName pseudoName profileAvatar' });

            if (clientLeaderboardEntry) {
                const higherXpCount = await NationalLeaderboard.countDocuments({
                    isDeleted: false,
                    isActive: true,
                    totalXp: { $gt: clientLeaderboardEntry.totalXp }
                });

                const clientRank = higherXpCount + 1;

                clientPosition = {
                    rank: clientRank,
                    clientId: clientLeaderboardEntry.clientId._id,
                    firstName: clientLeaderboardEntry.clientId.firstName,
                    lastName: clientLeaderboardEntry.clientId.lastName,
                    pseudoName: clientLeaderboardEntry.clientId.pseudoName,
                    profileAvatar: clientLeaderboardEntry.clientId.profileAvatar,
                    xp: clientLeaderboardEntry.totalXp,
                    totalGamesPlayed: clientLeaderboardEntry.totalGamesPlayed,
                    totalFirstPlaceWins: clientLeaderboardEntry.totalFirstPlaceWins,
                    totalSecondPlaceWins: clientLeaderboardEntry.totalSecondPlaceWins,
                    totalThirdPlaceWins: clientLeaderboardEntry.totalThirdPlaceWins,
                    createdAt: clientLeaderboardEntry.createdAt,
                    updatedAt: clientLeaderboardEntry.updatedAt
                };
            }
        }

        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage ? getMessage("NATIONAL_LEADERBOARD_FETCHED_SUCCESS", res.locals.language) : "National leaderboard fetched successfully",
            data: {
                s3BaseUrl,
                type: 'national',
                totalPlayers: totalCount,
                displayedPlayers: formattedLeaderboard.length,
                leaderboard: formattedLeaderboard,
                clientPosition: clientPosition,
                pagination: {
                    limit: pageLimit,
                    skip: pageSkip,
                    page: Math.floor(pageSkip / pageLimit) + 1,
                    totalPages: Math.ceil(totalCount / pageLimit)
                }
            }
        });
    } catch (err) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: getMessage ? getMessage("NATIONAL_LEADERBOARD_FETCH_ERROR", res.locals.language) : "Error fetching national leaderboard",
            error: err.message,
            data: null
        });
    }
});

/**
 * Get franchisee-specific leaderboard with optional player position
 * GET /quiz/leaderboard/franchisee/:franchiseeInfoId
 * 
 * Path parameters:
 * - franchiseeInfoId: ID of the franchise (required)
 * 
 * Query parameters:
 * - clientId: optional - get specific player's current position at this franchise
 * - limit: number of records per page (default: 20, max: 100)
 * - skip: number of records to skip (default: 0)
 * 
 * Returns: leaderboard sorted by totalXp (descending) for specific franchise
 */
const getFranchiseeLeaderboard = catchAsync(async (req, res) => {
    try {
        const { franchiseeInfoId } = req.params;
        const { clientId, limit = 20, skip = 0 } = req.query;

        // ===== VALIDATION =====
        if (!franchiseeInfoId || typeof franchiseeInfoId !== 'string' || !franchiseeInfoId.trim()) {
            return res.status(httpStatus.OK).json({
                success: false,
                message: getMessage ? getMessage("FRANCHISEE_ID_REQUIRED", res.locals.language) : "Franchisee ID is required",
                data: null
            });
        }

        // Verify franchisee exists
        const franchiseeExists = await FranchiseeInfo.findById(franchiseeInfoId);
        if (!franchiseeExists) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: getMessage ? getMessage("FRANCHISEE_NOT_FOUND", res.locals.language) : "Franchisee not found",
                data: null
            });
        }

        const pageLimit = Math.max(1, Math.min(100, parseInt(limit) || 20));
        const pageSkip = Math.max(0, parseInt(skip) || 0);

        // ===== BUILD FILTER =====
        const filter = {
            franchiseeInfoId: franchiseeInfoId,
            isDeleted: false,
            isActive: true
        };

        // ===== FETCH LEADERBOARD DATA =====
        const totalCount = await FranchiseeLeaderboard.countDocuments(filter);

        const leaderboardData = await FranchiseeLeaderboard.find(filter)
            .populate({ path: 'clientId', select: 'firstName lastName pseudoName profileAvatar' })
            .populate({ path: 'franchiseeInfoId', select: 'franchiseeName location' })
            .sort({ totalXp: -1 })
            .limit(pageLimit)
            .skip(pageSkip);

        // ===== FORMAT LEADERBOARD RESPONSE =====
        const formattedLeaderboard = leaderboardData.map((entry, index) => {
            const rank = pageSkip + index + 1;

            return {
                rank: rank,
                clientId: entry.clientId._id,
                firstName: entry.clientId.firstName,
                lastName: entry.clientId.lastName,
                pseudoName: entry.clientId.pseudoName,
                profileAvatar: entry.clientId.profileAvatar,
                xp: entry.totalXp,
                totalGamesPlayed: entry.totalGamesPlayed,
                totalFirstPlaceWins: entry.totalFirstPlaceWins,
                totalSecondPlaceWins: entry.totalSecondPlaceWins,
                totalThirdPlaceWins: entry.totalThirdPlaceWins,
                franchiseeInfo: {
                    franchiseeId: entry.franchiseeInfoId._id,
                    franchiseeName: entry.franchiseeInfoId.franchiseeName,
                    location: entry.franchiseeInfoId.location
                },
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt
            };
        });

        // ===== GET CLIENT'S POSITION (if clientId provided) =====
        let clientPosition = null;

        if (clientId && typeof clientId === 'string' && clientId.trim()) {
            const clientLeaderboardEntry = await FranchiseeLeaderboard.findOne({
                clientId: clientId,
                franchiseeInfoId: franchiseeInfoId,
                isDeleted: false,
                isActive: true
            }).populate({ path: 'clientId', select: 'firstName lastName pseudoName profileAvatar' })
                .populate({ path: 'franchiseeInfoId', select: 'franchiseeName location' });

            if (clientLeaderboardEntry) {
                const higherXpCount = await FranchiseeLeaderboard.countDocuments({
                    franchiseeInfoId: franchiseeInfoId,
                    isDeleted: false,
                    isActive: true,
                    totalXp: { $gt: clientLeaderboardEntry.totalXp }
                });

                const clientRank = higherXpCount + 1;

                clientPosition = {
                    rank: clientRank,
                    clientId: clientLeaderboardEntry.clientId._id,
                    firstName: clientLeaderboardEntry.clientId.firstName,
                    lastName: clientLeaderboardEntry.clientId.lastName,
                    pseudoName: clientLeaderboardEntry.clientId.pseudoName,
                    profileAvatar: clientLeaderboardEntry.clientId.profileAvatar,
                    xp: clientLeaderboardEntry.totalXp,
                    totalGamesPlayed: clientLeaderboardEntry.totalGamesPlayed,
                    totalFirstPlaceWins: clientLeaderboardEntry.totalFirstPlaceWins,
                    totalSecondPlaceWins: clientLeaderboardEntry.totalSecondPlaceWins,
                    totalThirdPlaceWins: clientLeaderboardEntry.totalThirdPlaceWins,
                    franchiseeInfo: {
                        franchiseeId: clientLeaderboardEntry.franchiseeInfoId._id,
                        franchiseeName: clientLeaderboardEntry.franchiseeInfoId.franchiseeName,
                        location: clientLeaderboardEntry.franchiseeInfoId.location
                    },
                    createdAt: clientLeaderboardEntry.createdAt,
                    updatedAt: clientLeaderboardEntry.updatedAt
                };
            }
        }

        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage ? getMessage("FRANCHISEE_LEADERBOARD_FETCHED_SUCCESS", res.locals.language) : "Franchisee leaderboard fetched successfully",
            data: {
                s3BaseUrl,
                type: 'franchisee',
                franchiseeId: franchiseeInfoId,
                totalPlayers: totalCount,
                displayedPlayers: formattedLeaderboard.length,
                leaderboard: formattedLeaderboard,
                clientPosition: clientPosition,
                pagination: {
                    limit: pageLimit,
                    skip: pageSkip,
                    page: Math.floor(pageSkip / pageLimit) + 1,
                    totalPages: Math.ceil(totalCount / pageLimit)
                }
            }
        });
    } catch (err) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: getMessage ? getMessage("FRANCHISEE_LEADERBOARD_FETCH_ERROR", res.locals.language) : "Error fetching franchisee leaderboard",
            error: err.message,
            data: null
        });
    }
});

let createBulkLocalLeaderboard = catchAsync(async (req, res) => {
    let localLeaderboard = await LocalLeaderboard.insertMany(req.body);
    res.status(httpStatus.OK).json({
        success: true,
        message: 'Bulk local leaderboard created successfully',
        data: localLeaderboard
    });
});

let createBulkNationalLeaderboard = catchAsync(async (req, res) => {
    let nationalLeaderboard = await NationalLeaderboard.insertMany(req.body);
    res.status(httpStatus.OK).json({
        success: true,
        message: 'Bulk national leaderboard created successfully',
        data: nationalLeaderboard
    });
});

let createBulkFranchiseeLeaderboard = catchAsync(async (req, res) => {
    let franchiseeLeaderboard = await FranchiseeLeaderboard.insertMany(req.body);
    res.status(httpStatus.OK).json({
        success: true,
        message: 'Bulk franchisee leaderboard created successfully',
        data: franchiseeLeaderboard
    });
});

module.exports = {
    createMultipleCategories,
    getCategory,
    createQuizInstant,
    updateQuizInstant,
    getQuizInstantList,
    getQuizQuestionsByQuizId,
    createQuizQuestion,
    updateQuizQuestion,
    deleteQuizQuestion,
    createQuizGameSession,
    getQuizGameSessionById,
    getQuizGameSessions,
    updateQuizGameSession,
    deleteQuizGameSession,
    joinQuizGameSession,
    submitQuizAnswer,
    leaveQuizGameSession,
    getPlayerSessionData,
    getSessionLeaderboard,
    calculateQuestionPoints,
    completeQuizGameSessionQuestionsData,
    playerResponseAnswer,
    getPlayerGameSessionHistory,
    getLocalLeaderboard,
    getNationalLeaderboard,
    getFranchiseeLeaderboard,
    createBulkLocalLeaderboard,
    createBulkNationalLeaderboard,
    createBulkFranchiseeLeaderboard
}