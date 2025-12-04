const Joi = require('joi');
const { objectId, password } = require('./custom.validation');

const updatePlayerProfile = {
    body: Joi.object({
        firstName: Joi.string().allow(''),
        lastName: Joi.string().allow(''),
        gender: Joi.string().allow(''),
        profileAvatar: Joi.string().allow(''),
        dob: Joi.string().allow('')
    })
}

const updatePlayerPicture = {
    params: Joi.object().keys({
        id: Joi.string().custom(objectId).required(),
    }),
    files: Joi.object().keys({
        picture: Joi.object().keys({
            _events: Joi.object(),
            _eventsCount: Joi.number(),
            _maxListeners: Joi.object(),
            hash: Joi.any(),
            _writeStream: Joi.object(),
            lastModifiedDate: Joi.date().required(),
            size: Joi.number().required(),
            type: Joi.string().required(),
            path: Joi.string().required(),
            name: Joi.string().required(),
        }),
    }),
}

const deletePlayerPicture = {
    params: Joi.object().keys({
        id: Joi.string().custom(objectId).required(),
    })
}

const submitQuizFeedback = {
    body: Joi.object().keys({
        quizGameSessionId: Joi.string().custom(objectId).required(),
        playerId: Joi.string().custom(objectId).required(),
        rating: Joi.number().min(1).max(5).required(),
        feedbackText: Joi.string().max(1000).trim().allow(''),
        franchiseId: Joi.string().custom(objectId).optional()
    })
}

module.exports = {
    updatePlayerProfile,
    updatePlayerPicture,
    deletePlayerPicture,
    submitQuizFeedback
}