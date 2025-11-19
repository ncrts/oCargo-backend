const mongoose = require('mongoose');

/**
 * FranchiseeInfo Model (ÔCargo App)
 *
 * Represents detailed information about each franchisee (local OCargo branch or food court).
 * 
 * Each franchisee operates independently under a franchisor (HQ) but participates in
 * local and national ÔCargo Quiz games, reports, and data management.
 *
 * This model stores franchise identity, contact details, geolocation,
 * and status information for internal management and reporting.
 */

const franchiseeInfoSchema = new mongoose.Schema({
    /**
     * 🏢 Franchisor Reference
     * References the franchisor (HQ) this franchise belongs to.
     * Ensures hierarchical control and central data association.
     */
    franchisorInfoId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'FranchisorInfo',
        default: null,
        description: 'Reference to the franchisor (HQ) under which this franchisee operates.'
    },

    /**
     * 🏪 Franchisee Name
     * The official name of the franchise location (e.g., "ÔCargo Paris La Défense").
     * Used for display, reporting, and leaderboard tagging.
     */
    name: {
        type: String,
        default: null,
        description: 'Name of the OCargo franchisee location.'
    },

    /**
     * ☎️ Phone Prefix
     * Country calling code (e.g., +33 for France).
     * Used for formatting and validation of contact numbers.
     */
    phonePrefix: {
        type: String,
        default: null,
        description: 'Phone country prefix (e.g. +33, +91).'
    },

    /**
     * ☎️ Phone Number
     * Contact phone number of the franchise.
     * Used by HQ or customers to reach the local branch.
     */
    phone: {
        type: String,
        default: null,
        description: 'Contact phone number of the franchise location.'
    },

    /**
     * 📧 Email
     * Official email address for franchise communication.
     * Used for system notifications, reports, and client interactions.
     */
    email: {
        type: String,
        default: null,
        description: 'Official contact email for the franchise.'
    },

    /**
     * 📍 Address
     * Physical address details of the franchise location.
     * Used for reports, mapping, and client location tagging.
     */
    address: {
        /**
         * 🏠 Line 1
         * Primary address line (e.g., street name and number).
         */
        line1: { 
            type: String, 
            default: null,
            description: 'Street address or first address line.'
        },

        /**
         * 🏙️ City
         * City where the franchise is located.
         */
        city: { 
            type: String, 
            default: null,
            description: 'City name where the franchise is located.'
        },

        /**
         * 🗺️ State / Region
         * State or province of the franchise location.
         */
        state: { 
            type: String, 
            default: null,
            description: 'State, province, or region of the franchise location.'
        },

        /**
         * 🔢 Postal Code
         * Postal or ZIP code for the franchise location.
         */
        postalCode: { 
            type: String, 
            default: null,
            description: 'Postal or ZIP code for the franchise address.'
        },

        /**
         * 🌍 Country
         * Country where the franchise operates.
         */
        country: { 
            type: String, 
            default: null,
            description: 'Country where the franchise is located.'
        }
    },

    /**
     * 📌 Location Data
     * Geographical information used for mapping, reports, and geo-based features.
     */
    location: {
        /**
         * 🗺️ Place ID
         * Google Maps or internal ID for the location, if integrated with APIs.
         */
        placeId: { 
            type: String, 
            default: null,
            description: 'External place identifier (e.g., Google Maps Place ID).'
        },

        /**
         * 🧭 Coordinates
         * Geographical coordinates (latitude, longitude) for map-based features.
         */
        coordinates: {
            /**
             * 📍 Latitude
             * North/South coordinate for the franchise’s exact position.
             */
            latitude: { 
                type: Number, 
                default: null,
                description: 'Latitude coordinate of the franchise location.'
            },

            /**
             * 📍 Longitude
             * East/West coordinate for the franchise’s exact position.
             */
            longitude: { 
                type: Number, 
                default: null,
                description: 'Longitude coordinate of the franchise location.'
            }
        }
    },

    /**
     * 🕒 Created Timestamp
     * Automatically records when the franchise record was created in the system.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Date and time when this franchise record was created.'
    },

    /**
     * 🕒 Updated Timestamp
     * Automatically updated whenever franchise information changes.
     */
    updatedAt: {
        type: Date,
        default: Date.now,
        description: 'Date and time when this record was last updated.'
    },

    /**
     * ✅ Active Status
     * Indicates if the franchise is currently active and operational.
     * Can be toggled off by HQ in case of closure or temporary suspension.
     */
    isActive: {
        type: Boolean,
        default: true,
        description: 'Flag indicating whether the franchise is currently active.'
    },

    /**
     * ❌ Deletion Flag
     * Used for soft deletion; record remains in the database but hidden from active operations.
     * Useful for audit and regulatory compliance.
     */
    isDeleted: {
        type: Boolean,
        default: false,
        description: 'Marks the franchise as deleted (soft delete) without removing it from the database.'
    }
});

module.exports = mongoose.model('FranchiseeInfo', franchiseeInfoSchema);
