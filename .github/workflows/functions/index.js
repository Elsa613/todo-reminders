// 方案 A：Firebase 雲端排程，每分鐘檢查一次提醒（需要 Blaze 隨用隨付方案，個人用量通常在免費額度內）
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { sendDue } = require("./lib/sendDue");

initializeApp();

exports.sendReminders = onSchedule(
  { schedule: "every 1 minutes", timeZone: "Asia/Taipei", region: "asia-east1", retryCount: 0, maxInstances: 1 },
  async () => {
    const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    const appUrl = process.env.APP_URL || (project ? `https://${project}.web.app/` : "");
    await sendDue({ db: getFirestore(), messaging: getMessaging(), appUrl });
  }
);
