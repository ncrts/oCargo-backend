const mongoose = require('mongoose');

/**
 * ClientCommunication Model (ÔCargo App)
 *
 * Represents the communication and notification preferences of a client.
 *
 * This model allows users to control how they receive communications from ÔCargo —
 * such as quiz updates, franchise events, promotional offers, and reminders.
 *
 * Linked to the main Client model via `clientId`.
 */

const clientCommunicationSchema = new mongoose.Schema({
    /**
     * 🔗 Client Reference
     * Links this communication preference record to a specific client.
     * Used to identify which client's preferences are being managed.
     */
    clientId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Client',
        default: null,
        description: 'Reference to the client associated with these communication preferences.'
    },

    /**
     * 📧 Email Communication Preference
     * Indicates whether the client has opted in to receive emails.
     * Example: newsletters, event invitations, or quiz results.
     */
    preferencesEmail: {
        type: Boolean,
        default: true,
        description: 'True if the client agrees to receive email communications.'
    },

    /**
     * 🔔 Push Notification Preference
     * Indicates whether the client has opted in to receive push notifications on their device.
     * Example: quiz reminders, new game alerts, or reward notifications.
     */
    preferencesPush: {
        type: Boolean,
        default: true,
        description: 'True if the client agrees to receive push notifications through the app.'
    },

    /**
     * 📱 SMS Communication Preference
     * Indicates whether the client has opted in to receive SMS/text messages.
     * Example: verification codes, special offers, or local franchise announcements.
     */
    preferencesSMS: {
        type: Boolean,
        default: true,
        description: 'True if the client agrees to receive SMS communications.'
    },

    /**
     * 🕒 Created Timestamp
     * Automatically stores the date and time when the record was created.
     * Useful for tracking preference history or data audit.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        description: 'Date when the communication preferences record was first created.'
    },

    /**
     * 🕒 Updated Timestamp
     * Automatically updated whenever any preference setting changes.
     */
    updatedAt: {
        type: Date,
        default: Date.now,
        description: 'Date when the communication preferences record was last updated.'
    },

    /**
     * ✅ Active Status Flag
     * True if the preference record is currently valid and in use.
     * Set to false when deactivating a client or migrating to a new record.
     */
    isActive: {
        type: Boolean,
        default: true,
        description: 'Indicates whether the client communication preferences are currently active.'
    },

    /**
     * ❌ Deletion Flag
     * Soft delete indicator — marks the record as deleted without removing it from the database.
     * Useful for audit trails and GDPR compliance.
     */
    isDeleted: {
        type: Boolean,
        default: false,
        description: 'Marks this communication preference record as deleted (soft delete).'
    }
});

module.exports = mongoose.model('ClientCommunication', clientCommunicationSchema);
