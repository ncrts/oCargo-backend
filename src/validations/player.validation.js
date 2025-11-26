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

module.exports = {
    updatePlayerProfile,
    updatePlayerPicture,
    deletePlayerPicture
}