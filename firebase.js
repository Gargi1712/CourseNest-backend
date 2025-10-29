import admin from "firebase-admin";

// ✅ Check if Firebase is already initialized (important for Vercel hot reload)
if (!admin.apps.length) {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // ✅ For Vercel (read JSON from environment variable)
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // ✅ For local development
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

    if (!fs.existsSync(serviceAccountPath)) {
      console.error("❌ serviceAccountKey.json not found at:", serviceAccountPath);
      process.exit(1);
    }

    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  }

  // ✅ Initialize Firebase Admin
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("🔥 Firebase connected successfully!");
}

const db = admin.firestore();
export default db;
