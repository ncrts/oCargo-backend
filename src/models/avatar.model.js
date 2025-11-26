const mongoose = require('mongoose');

const avatarMasterSchema = new mongoose.Schema({ 
    name:{
        type: String,
        description: 'Name of the avatar'
    },
    imageUrl:{
        type: String,
        description: 'URL of the avatar image'
    },
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp when the avatar was created'
    },
    updatedAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp when the avatar was last updated'
    },
    isDeleted: {
        type: Boolean,
        default: false,
        description: 'Flag to indicate if the avatar is deleted'
    }
})

module.exports = mongoose.model('Avatar', avatarMasterSchema);