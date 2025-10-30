import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

// ✅ Check if Firebase is already initialized (important for Vercel hot reload)
if (!admin.apps.length) {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // ✅ For Vercel / Deployment: read JSON from environment variable
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (err) {
      console.error("❌ Invalid FIREBASE_SERVICE_ACCOUNT JSON in environment variable:", err);
      process.exit(1);
    }
  } else {
    // ✅ For local development: read serviceAccountKey.json
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

    try {
      const rawData = fs.readFileSync(serviceAccountPath, "utf8");
      serviceAccount = JSON.parse(rawData);
    } catch (err) {
      console.error("❌ Error reading or parsing serviceAccountKey.json:", err);
      process.exit(1);
    }
  }

  // ✅ Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("🔥 Firebase connected successfully!");
}

const db = admin.firestore();
export default db;
