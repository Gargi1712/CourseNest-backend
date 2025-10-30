import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import verifyToken from './middleware/auth.js';
import db from "./firebase.js";

dotenv.config();
const app = express();

// ✅ For Firestore status
await db.collection("status").doc("server").set({
  server: "online",
  time: Date.now(),
});

// For __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------
// Middleware
// ------------------------
app.use(express.json());

// ✅ Allow both local and deployed frontend
const allowedOrigins = [
  "http://localhost:3000",
  "https://course-nest-frontend.vercel.app",
  "https://course-nest-frontend-i6mwpidfu-gargi-jains-projects-4e7a38ae.vercel.app" // ✅ new Vercel deploy URL
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));



// Optional EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ------------------------
//  Home
// ------------------------
app.get('/', (req, res) => {
  res.render('index', { title: 'Welcome to CourseNest Backend' });
});

// ------------------------
// Fetch Courses
// ------------------------
app.get('/courses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courses');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error fetching courses' });
  }
});

// ------------------------
// Register
// ------------------------
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  console.log("➡️ Register request received:", req.body);

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
      [name, email, hashedPassword]
    );

    res.status(201).json({ message: 'User registered', user: result.rows[0] });
  } catch (err) {
    console.error("❌ DB Error:", err.message);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

// ------------------------
//  Login
// ------------------------
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log("➡️ Login request:", req.body);

  if (!email || !password) {
    return res.status(400).json({ message: 'Both fields required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({ message: 'Login successful', token, user });
  } catch (err) {
    console.error("❌ Login Error:", err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ------------------------
//  Payment (Protected)
// ------------------------
app.post('/payment', verifyToken, async (req, res) => {
  const { courseId, paymentMethod } = req.body;

  if (!req.user?.id) {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  const userId = req.user.id;

  try {
    const existing = await pool.query(
      'SELECT * FROM payments WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'You have already purchased this course.' });
    }

    await pool.query(
      'INSERT INTO payments (user_id, course_id, payment_method) VALUES ($1, $2, $3)',
      [userId, courseId, paymentMethod]
    );

    console.log(`✅ Payment recorded for user ${userId}, course ${courseId}`);
    res.json({ message: 'Payment successful', courseId });
  } catch (err) {
    console.error('❌ Payment error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------
// My Courses (Protected)
// ------------------------
app.get('/my-courses', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(`
      SELECT c.* FROM courses c
      JOIN payments p ON p.course_id = c.id
      WHERE p.user_id = $1
    `, [userId]);

    res.json({ purchasedCourses: result.rows });
  } catch (err) {
    console.error("❌ Error fetching purchased courses:", err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------
// Course Videos (Protected)
// ------------------------
app.get("/course/:id/videos", verifyToken, async (req, res) => {
  if (!req.user?.id) {
    return res.status(403).json({ message: "Unauthorized" }); 
  }

  const { id } = req.params;

  try {
    const purchased = await pool.query(
      "SELECT 1 FROM payments WHERE user_id = $1 AND course_id = $2",
      [req.user.id, id]
    );
    if (purchased.rows.length === 0) {
      return res.status(403).json({ message: "Access denied. You have not purchased this course." });
    }

    const videos = await pool.query("SELECT * FROM videos WHERE course_id = $1", [id]);
    res.json(videos.rows);
  } catch (err) {
    console.error("❌ Failed to fetch videos:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------
// 🚀 Start Server
// ------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server started at http://localhost:${PORT}`);
});
