const path = require('path');
const admin = require('firebase-admin');
const filePath = path.resolve(__dirname, '../../firebase_services.json');

admin.initializeApp({
  credential: admin.credential.cert(filePath),
  /* databaseURL: "https://buildup-2428d.firebaseio.com" */
});

const sendPush = async (deviceKey, pushMessage, tag = null) => {
  let notifyTag = '';
  if (tag) {
    notifyTag = tag;
  }
  try {
    const payload = {
      data: {
        body: pushMessage,
        title: 'Ocargo Application',
        tag: notifyTag,
        sound: 'mysound', /* Default sound */
      },
      notification: {
        body: pushMessage,
        title: 'Ocargo Application',
        tag: notifyTag,
        sound: 'mysound', /* Default sound */
      },
    };
    const option = {
      priority: 'high',
      timeToLive: 60 * 60 * 24,
    };
    const response = await admin.messaging().sendToDevice(deviceKey, payload, option);
    // console.log(JSON.stringify(response))
    if (response.successCount == 1) {
      console.log(`Mesage with text ${pushMessage} Delivered SUccessfully`);
    }
    if (response.failureCount == 1) {
      console.log(response.results);
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  sendPush,
};
