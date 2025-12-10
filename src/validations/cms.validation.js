const Joi = require('joi');
const { objectId, password } = require('./custom.validation');

const createCms = {
    body: Joi.object().keys({
        pageTitle: Joi.string().required(),
        pageContent: Joi.string().required(),
        contentType: Joi.number().required(),
        link: Joi.string().allow(),
        sequence: Joi.number().allow()
    })
}

const updateCms = {
    params: Joi.object().keys({
        id: Joi.string().required(),
    }),
    body: Joi.object().keys({
        pageTitle: Joi.string().required(),
        pageContent: Joi.string().required(),
        contentType: Joi.number()
    })
}
const getCms = {
    params: Joi.object().keys({
        slug: Joi.string().required(),
    })
}


module.exports = {
    createCms,
    updateCms,
    getCms
}