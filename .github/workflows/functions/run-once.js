// 方案 B（免費）：由 GitHub Actions 每 5 分鐘執行一次這支程式
// 需要環境變數 FIREBASE_SERVICE_ACCOUNT（服務帳戶金鑰 JSON 全文），APP_URL 選填
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { sendDue } = require("./lib/sendDue");

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error("缺少 FIREBASE_SERVICE_ACCOUNT"); process.exit(1); }
const sa = JSON.parse(raw);
initializeApp({ credential: cert(sa) });

sendDue({
  db: getFirestore(),
  messaging: getMessaging(),
  appUrl: process.env.APP_URL || `https://${sa.project_id}.web.app/`,
}).then(r => { console.log(JSON.stringify(r)); })
  .catch(e => { console.error(e); process.exit(1); });
