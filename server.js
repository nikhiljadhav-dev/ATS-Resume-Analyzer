// const mysql = require('mysql');
// const nodemailer = require('nodemailer');
// const express = require('express');
// const multer = require('multer');
// const fs = require('fs');
// const path = require('path');
// const { spawn } = require('child_process');
// const cors = require('cors');
// const axios = require('axios');

// const app = express();
// const PORT = process.env.PORT || 3000;

// app.use(cors());
// app.use(express.static(path.join(__dirname, 'public')));
// app.use(express.json());

// // MySQL DATABASE CONNECTION (use env vars)
// const db = mysql.createConnection({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME
// });

// // Directories
// const uploadDir = path.join(__dirname, 'uploads');
// const tempDir = path.join(__dirname, 'temp');
// [uploadDir, tempDir].forEach((dir) => {
//   if (!fs.existsSync(dir)) fs.mkdirSync(dir);
// });

// // Multer setup
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     fs.readdir(uploadDir, (err, files) => {
//       if (err) return cb(err);
//       files.forEach((f) => fs.unlinkSync(path.join(uploadDir, f)));
//       cb(null, uploadDir);
//     });
//   },
//   filename: (req, file, cb) => {
//     cb(null, file.originalname);
//   },
// });
// const upload = multer({
//   storage,
//   limits: { fileSize: 2 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     const ext = path.extname(file.originalname).toLowerCase();
//     if (ext === '.pdf' || ext === '.doc' || ext === '.docx') cb(null, true);
//     else cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
//   },
// });

// // =================================== Authentication ===================================
// let currentOtp = null;
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   }
// });

// // Signup
// app.post("/signup", (req, res) => {
//   const { username, email, password } = req.body;
//   db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
//     if (results.length) return res.json({ exists: true });
//     db.query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
//       [username, email, password], (err) => {
//         if (err) return res.json({ success: false });
//         res.json({ success: true });
//       });
//   });
// });

// // Login
// app.post("/login", (req, res) => {
//   const { username, email, password } = req.body;
//   db.query("SELECT * FROM users WHERE email = ? AND username = ? AND password = ?",
//     [email, username, password], (err, results) => {
//       if (results.length) res.json({ success: true });
//       else res.json({ success: false, error: "Invalid credentials" });
//     });
// });

// // Forgot Password → Send OTP
// app.post("/Forgot-Password", (req, res) => {
//   const { email } = req.body;
//   db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
//     if (!results.length) return res.json({ success: false, error: "Email not found" });
//     currentOtp = Math.floor(100000 + Math.random() * 900000);
//     transporter.sendMail({
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: "Your OTP Code",
//       text: `Your OTP code is ${currentOtp}`
//     }, (err) => {
//       if (err) return res.json({ success: false, error: "Email sending failed" });
//       res.json({ success: true });
//     });
//   });
// });

// // OTP Verification
// app.post("/OTP-Verification", (req, res) => {
//   const { otp } = req.body;
//   if (parseInt(otp) === currentOtp) res.json({ success: true });
//   else res.json({ success: false, error: "Invalid OTP" });
// });

// // Resend OTP
// app.post("/resend-otp", (req, res) => {
//   if (!currentOtp) return res.json({ success: false, error: "OTP not initialized" });
//   transporter.sendMail({
//     from: process.env.EMAIL_USER,
//     to: req.body.email,
//     subject: "Resent OTP Code",
//     text: `Your OTP code is ${currentOtp}`
//   }, (err) => {
//     if (err) return res.json({ success: false, error: "Resend failed" });
//     res.json({ success: true });
//   });
// });

// // Reset Password
// app.post("/reset-password", (req, res) => {
//   const { email, newPassword } = req.body;
//   db.query("UPDATE users SET password = ? WHERE email = ?", [newPassword, email], (err) => {
//     if (err) return res.json({ success: false });
//     res.json({ success: true });
//   });
// });

// // =================================== Resume Analysis ===================================
// // Upload resume
// app.post('/upload', upload.single('resume'), (req, res) => {
//   if (!req.file) return res.status(400).send('No file uploaded');
//   res.status(200).send('File uploaded');
// });

// // Analyze job description with Python
// app.post('/analyze-text', (req, res) => {
//   const files = fs.readdirSync(uploadDir);
//   if (files.length === 0) return res.status(400).send('No resume found');
//   const resumePath = path.join(uploadDir, files[0]);
//   const jobDescription = req.body.jobDescription;
//   const tempFileName = `job_${Date.now()}.txt`;
//   const jobDescriptionPath = path.join(tempDir, tempFileName);
//   fs.writeFileSync(jobDescriptionPath, jobDescription, 'utf-8');

//   const python = spawn('python', ['ats.py', resumePath, jobDescriptionPath]);
//   let dataBuffer = '';
//   python.stdout.on('data', (data) => { dataBuffer += data.toString(); });
//   python.stderr.on('data', (err) => { console.error('Python error:', err.toString()); });
//   python.on('close', () => {
//     fs.unlink(jobDescriptionPath, () => {});
//     try {
//       const result = JSON.parse(dataBuffer);
//       res.json(result);
//     } catch (err) {
//       console.error('Failed to parse Python output:', err);
//       res.status(500).send('Analysis failed');
//     }
//   });
// });

// // Reset uploads and temp
// app.post('/reset', (req, res) => {
//   [uploadDir, tempDir].forEach((dir) => {
//     fs.readdir(dir, (err, files) => {
//       if (err) return res.status(500).send(`Error reading ${dir}`);
//       files.forEach((f) => fs.unlinkSync(path.join(dir, f)));
//     });
//   });
//   res.status(200).send('Reset complete');
// });

// // Start Server
// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });



const { Pool } = require('pg');   // ✅ use pg instead of mysql
const nodemailer = require('nodemailer');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ================== DATABASE CONNECTION (Postgres) ==================
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432
});

// Directories
const uploadDir = path.join(__dirname, 'uploads');
const tempDir = path.join(__dirname, 'temp');
[uploadDir, tempDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.readdir(uploadDir, (err, files) => {
      if (err) return cb(err);
      files.forEach((f) => fs.unlinkSync(path.join(uploadDir, f)));
      cb(null, uploadDir);
    });
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' || ext === '.doc' || ext === '.docx') cb(null, true);
    else cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
  },
});

// ================== Authentication ==================
let currentOtp = null;
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Signup
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length) return res.json({ exists: true });

    await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3)",
      [username, email, password]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND username = $2 AND password = $3",
      [email, username, password]
    );
    if (result.rows.length) res.json({ success: true });
    else res.json({ success: false, error: "Invalid credentials" });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

// Forgot Password → Send OTP
app.post("/Forgot-Password", async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!result.rows.length) return res.json({ success: false, error: "Email not found" });

    currentOtp = Math.floor(100000 + Math.random() * 900000);
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is ${currentOtp}`
    }, (err) => {
      if (err) return res.json({ success: false, error: "Email sending failed" });
      res.json({ success: true });
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

// OTP Verification
app.post("/OTP-Verification", (req, res) => {
  const { otp } = req.body;
  if (parseInt(otp) === currentOtp) res.json({ success: true });
  else res.json({ success: false, error: "Invalid OTP" });
});

// Resend OTP
app.post("/resend-otp", (req, res) => {
  if (!currentOtp) return res.json({ success: false, error: "OTP not initialized" });
  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: req.body.email,
    subject: "Resent OTP Code",
    text: `Your OTP code is ${currentOtp}`
  }, (err) => {
    if (err) return res.json({ success: false, error: "Resend failed" });
    res.json({ success: true });
  });
});

// Reset Password
app.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;
  try {
    await pool.query("UPDATE users SET password = $1 WHERE email = $2", [newPassword, email]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

// ================== Resume Analysis ==================
// Upload resume
app.post('/upload', upload.single('resume'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  res.status(200).send('File uploaded');
});

// Analyze job description with Python
app.post('/analyze-text', (req, res) => {
  const files = fs.readdirSync(uploadDir);
  if (files.length === 0) return res.status(400).send('No resume found');
  const resumePath = path.join(uploadDir, files[0]);
  const jobDescription = req.body.jobDescription;
  const tempFileName = `job_${Date.now()}.txt`;
  const jobDescriptionPath = path.join(tempDir, tempFileName);
  fs.writeFileSync(jobDescriptionPath, jobDescription, 'utf-8');

  const python = spawn('python', ['ats.py', resumePath, jobDescriptionPath]);
  let dataBuffer = '';
  python.stdout.on('data', (data) => { dataBuffer += data.toString(); });
  python.stderr.on('data', (err) => { console.error('Python error:', err.toString()); });
  python.on('close', () => {
    fs.unlink(jobDescriptionPath, () => {});
    try {
      const result = JSON.parse(dataBuffer);
      res.json(result);
    } catch (err) {
      console.error('Failed to parse Python output:', err);
      res.status(500).send('Analysis failed');
    }
  });
});

// Reset uploads and temp
app.post('/reset', (req, res) => {
  [uploadDir, tempDir].forEach((dir) => {
    fs.readdir(dir, (err, files) => {
      if (err) return res.status(500).send(`Error reading ${dir}`);
      files.forEach((f) => fs.unlinkSync(path.join(dir, f)));
    });
  });
  res.status(200).send('Reset complete');
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
