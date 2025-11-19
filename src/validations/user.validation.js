const Joi = require('joi');
const { objectId, password } = require('./custom.validation');

const getUser = {
    params: Joi.object({
        userId: Joi.required().custom(objectId),
    })
}

const createUser = {
    body: Joi.object({
        email: Joi.string().required(),
        password: Joi.string().required(),
        role: Joi.string().required(),
        phonenoPrefix: Joi.string(),
        phoneno: Joi.string(),
        firstname: Joi.string(),
        lastname: Joi.string(),
    })
}

const updateUser = {
    params: Joi.object({
        userId: Joi.required().custom(objectId),
    }),

    body: Joi.object({
        email: Joi.string(),
        phonenoPrefix: Joi.string(),
        phoneno: Joi.string(),
        firstname: Joi.string(),
        lastname: Joi.string(),
        assignedDesigner: Joi.array(),
        gender: Joi.string(),
        isUserActive: Joi.string(),
        dob: Joi.date()
    })
};

const getUserProfilePicture = {
    params: Joi.object().keys({
        userId: Joi.string().custom(objectId).required(),
    }),
};

const updateUserProfilePicture = {
    fields: Joi.object().keys({
        userId: Joi.string().custom(objectId).required(),
        profilePictureType: Joi.string().required(),
        userAvatarId: Joi.string().custom(objectId),
    }),
    files: Joi.object().keys({
        profilePicture: Joi.object().keys({
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

const deleteUserProfilePicture = {
    params: Joi.object().keys({
        userId: Joi.string().custom(objectId).required(),
    }),
}

const deleteUser = {
    params: Joi.object().keys({
        userId: Joi.string().custom(objectId).required(),
    })
}

const createUserConnect = {
    body: Joi.object({
        email: Joi.string().required()
    })
}

const updatePlayerProfile = {
    body: Joi.object({
        firstName: Joi.string().allow(''),
        lastName: Joi.string().allow(''),
        gender: Joi.string().allow('')
    })
}


module.exports = {
    getUser,
    createUser,
    updateUser,
    getUserProfilePicture,
    updateUserProfilePicture,
    deleteUserProfilePicture,
    deleteUser,
    createUserConnect,
    updatePlayerProfile
}