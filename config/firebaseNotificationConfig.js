let admin = require("firebase-admin");
// Fetch the service account key JSON file contents
let serviceAccount = require("./ocargoFirebaseAdminSDK.json");

// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // The database URL depends on the location of the database
    databaseURL: "https://ocargo-cb097-default-rtdb.europe-west1.firebasedatabase.app"
});

// As an admin, the app has access to read and write all data, regardless of Security Rules
let firebaseDB = admin.database();

const sendPush = async (deviceKey, pushMessage, tag = null) => {
    try {
        const message = {
            token: deviceKey,
            notification: {
                title: 'Ocargo Application',
                body: pushMessage,
            },
            android: {
                notification: {
                    sound: 'default',
                    tag: tag || '',
                },
            },
            data: {
                title: 'Ocargo Application',
                body: pushMessage,
                tag: tag || '',
            },
        };
        const response = await admin.messaging().send(message);
        if (response.successCount > 0) {
            console.log(`Message "${pushMessage}" delivered successfully to ${response.successCount} device(s).`);
        }
        if (response.failureCount > 0) {
            console.error('Failed to deliver to some devices:', response.results);
        }
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
};

module.exports = { firebaseDB, sendPush } 