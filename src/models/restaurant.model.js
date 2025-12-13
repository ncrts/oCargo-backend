const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
    franchiseeInfoId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'FranchiseeInfo',
        default: null,
        description: 'Reference to the franchisee this restaurant belongs'
    },
    name: {
        type: String,
        default: null,
        description: 'Name of the restaurant'
    },
    description: {
        type: String,
        default: '',
        description: 'Description of the restaurant'
    },
    backgroundImage: {
        type: String,
        default: null,
        description: 'Background image URL for the restaurant'
    },
    type: {
        type: String,
        description: 'Type of the restaurant (e.g., Italian, Fast Food, etc.)'
    },
    menuCardS3Key: {
        type: String,
        default: null,
        description: 'S3 key for the uploaded menu card PDF'
    },
    openingHours: {
        Monday: {
            status: { type: String, enum: ['open', 'close'], default: 'close' },
            openTime: { type: String, default: null },
            closeTime: { type: String, default: null }
        },
        Tuesday: {
            status: { type: String, enum: ['open', 'close'], default: 'close' },
            openTime: { type: String, default: null },
            closeTime: { type: String, default: null }
        },
        Wednesday: {
            status: { type: String, enum: ['open', 'close'], default: 'close' },
            openTime: { type: String, default: null },
            closeTime: { type: String, default: null }
        },
        Thursday: {
            status: { type: String, enum: ['open', 'close'], default: 'close' },
            openTime: { type: String, default: null },
            closeTime: { type: String, default: null }
        },
        Friday: {
            status: { type: String, enum: ['open', 'close'], default: 'close' },
            openTime: { type: String, default: null },
            closeTime: { type: String, default: null }
        },
        Saturday: {
            status: { type: String, enum: ['open', 'close'], default: 'close' },
            openTime: { type: String, default: null },
            closeTime: { type: String, default: null }
        },
        Sunday: {
            status: { type: String, enum: ['open', 'close'], default: 'close' },
            openTime: { type: String, default: null },
            closeTime: { type: String, default: null }
        }
    },
    address: {
        line1: { type: String, default: null, description: 'Street address or first address line.' },
        city: { type: String, default: null, description: 'City name where the restaurant is located.' },
        state: { type: String, default: null, description: 'State, province, or region of the restaurant location.' },
        postalCode: { type: String, default: null, description: 'Postal or ZIP code for the restaurant address.' },
        country: { type: String, default: null, description: 'Country where the restaurant is located.' }
    },
    location: {
        placeId: { type: String, default: null, description: 'External place identifier (e.g., Google Maps Place ID).' },
        coordinates: {
            latitude: { type: Number, default: null, description: 'Latitude coordinate of the restaurant location.' },
            longitude: { type: Number, default: null, description: 'Longitude coordinate of the restaurant location.' }
        }
    },
    isActive: {
        type: Boolean,
        default: true,
        description: 'Indicates if the restaurant is active'
    },
    isDeleted: {
        type: Boolean,
        default: false,
        description: 'Indicates if the restaurant is deleted'
    },
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp when the restaurant was created'
    },
    updatedAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp when the restaurant was last updated'
    }
});

module.exports = mongoose.model('Restaurant', restaurantSchema);
