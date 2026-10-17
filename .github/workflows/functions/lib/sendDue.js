/**
 * 找出「到時間、還沒完成、還沒提醒過」的待辦，推播到該帳號登記過的每台裝置，
 * 然後標記為已提醒。勾選完成的事項不會被找到，所以完成後就不會再提醒。
 */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

async function sendDue({ db, messaging, now = Date.now(), appUrl = "", log = console }) {
  const snap = await db.collectionGroup("todos")
    .where("done", "==", false)
    .where("notified", "==", false)
    .where("remindAtMs", "<=", now)
    .limit(200)
    .get();

  const tokenCache = new Map();
  const result = { due: snap.size, sent: 0, failed: 0, removedTokens: 0 };

  for (const todo of snap.docs) {
    const userRef = todo.ref.parent.parent;
    if (!userRef) continue;
    const uid = userRef.id;

    if (!tokenCache.has(uid)) {
      const t = await userRef.collection("tokens").get();
      tokenCache.set(uid, t.docs.map(d => ({ token: d.get("token") || d.id, ref: d.ref })));
    }
    const devices = tokenCache.get(uid);
    const data = todo.data();

    if (devices.length) {
      const message = {
        tokens: devices.map(d => d.token),
        notification: { title: "待辦提醒", body: String(data.title || "").slice(0, 200) },
        data: { todoId: todo.id },
        webpush: {
          headers: { Urgency: "high", TTL: "86400" },
          notification: {
            icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: todo.id,
            requireInteraction: true,     // 電腦上停留在畫面，直到按掉
            vibrate: [200, 100, 200], lang: "zh-TW"   // 同 tag 已跳過時（App 開著先跳了）只會安靜取代，不重複響
          },
          ...(appUrl ? { fcmOptions: { link: appUrl } } : {}),
        },
      };
      const res = await messaging.sendEachForMulticast(message);
      result.sent += res.successCount;
      result.failed += res.failureCount;

      const dead = [];
      res.responses.forEach((r, i) => {
        if (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code)) dead.push(devices[i]);
      });
      for (const d of dead) { await d.ref.delete(); result.removedTokens++; }
      if (dead.length) tokenCache.set(uid, devices.filter(d => !dead.includes(d)));
    }

    await todo.ref.update({ notified: true, notifiedAt: now });
  }

  // 心跳：App 讀這筆資料，顯示「雲端提醒服務運作中」
  try { await db.doc("system/scheduler").set({ lastRun: now, lastDue: result.due, lastSent: result.sent }, { merge: true }); }
  catch (e) { (log.warn || log.log).call(log, "heartbeat failed", e && e.message); }

  if (result.due) log.info ? log.info("reminders", result) : log.log("reminders", result);
  return result;
}

module.exports = { sendDue };
