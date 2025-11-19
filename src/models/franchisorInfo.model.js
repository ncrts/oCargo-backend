const mongoose = require('mongoose');

/**
 * FranchisorInfo Model (ÔCargo App)
 *
 * Represents the central (HQ) organization that manages all franchisees,
 * their users, and brand-level configuration across the ÔCargo network.
 *
 * This model contains high-level details such as brand name, logo,
 * contact information, CMS data, and operational status flags.
 *
 * It acts as the root reference for:
 * - FranchiseeInfo (local branches)
 * - FranchisorUser (HQ admins and staff)
 * - Global CMS and content control (through cmsInfo)
 */

const franchisorInfoSchema = new mongoose.Schema({
    /**
     * 🏢 Brand Name
     * The official name of the franchisor (HQ brand identity).
     * Used for display across apps, dashboards, and marketing materials.
     */
    brandName: {
        type: String,
        required: true,
        description: 'Official name of the franchisor or HQ brand (e.g., ÔCargo).'
    },

    /**
     * 🖼️ Logo
     * URL or file path pointing to the brand’s logo image.
     * Displayed across the player app, admin dashboards, and franchise portals.
     */
    logo: {
        type: String,
        default: null,
        description: 'URL of the franchisor’s official logo for display in all related apps.'
    },

    /**
     * ☎️ Contact Information
     * Stores the franchisor’s public contact details (phone number and email).
     * Used in client support, automated communications, and in-app contact sections.
     */
    contactInfo: {
        /**
         * 📞 Phone Number
         * The primary contact number of the franchisor HQ.
         * Used for internal communications, franchisee support, and client inquiries.
         */
        phoneno: {
            type: String,
            default: null,
            description: 'Official contact phone number of the franchisor HQ.'
        },

        /**
         * 📧 Email
         * Official email address for HQ correspondence and franchise communications.
         */
        email: {
            type: String,
            default: null,
            description: 'Official contact email address for the franchisor HQ.'
        }
    },

    /**
     * 🧩 CMS Information
     * Stores CMS-related content and configurations.
     * Flexible object allowing HQ to store dynamic data like:
     * - Home page text, banners, or layout preferences
     * - Promotional content
     * - Legal text (privacy policy, terms)
     * - Global settings for franchise apps
     */
    cmsInfo: {
        type: mongoose.Schema.Types.Mixed, // Allows for flexible data structure
        default: {},
        description: 'Flexible CMS data storage for HQ-managed content and app-wide settings.'
    },

    /**
     * 🕒 Created Timestamp
     * Automatically stores when this HQ record was created.
     * Useful for internal record-keeping and version control.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Date when the franchisor record was first created.'
    },

    /**
     * 🕒 Updated Timestamp
     * Automatically updated whenever franchisor information changes.
     */
    updatedAt: {
        type: Date,
        default: Date.now,
        description: 'Date when the franchisor information was last modified.'
    },

    /**
     * ✅ Active Status
     * Indicates whether the franchisor record is currently active.
     * Inactive franchisors are hidden from all live systems but kept for audit.
     */
    isActive: {
        type: Boolean,
        default: true,
        description: 'Flag marking whether this franchisor account is active.'
    },

    /**
     * ❌ Deletion Flag
     * Used for soft deletion — record remains in the database but inactive.
     * Helps maintain historical audit and data integrity (GDPR-compliant).
     */
    isDeleted: {
        type: Boolean,
        default: false,
        description: 'Marks the franchisor as deleted without permanently removing data.'
    }
});

module.exports = mongoose.model('FranchisorInfo', franchisorInfoSchema);
