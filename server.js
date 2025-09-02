const mysql = require('mysql');
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

// MySQL DATABASE CONNECTION
const db = mysql.createConnection({
  host: "ENTER HOST NAME",
  user: "ENTER ROOT NAME",
  password: "ENTER PASSWORD",
  database: "ENTER DATABASE NAME" // 🛠️ change to your actual database name
});

// Directories
const uploadDir = path.join(__dirname, 'uploads');
const tempDir = path.join(__dirname, 'temp');

// Ensure folders exist
[uploadDir, tempDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Unified Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Clear previous resume
    fs.readdir(uploadDir, (err, files) => {
      if (err) return cb(err);
      files.forEach((f) => fs.unlinkSync(path.join(uploadDir, f)));
      cb(null, uploadDir);
    });
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Preserve original name
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' || ext === '.doc' || ext === '.docx') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  },
});

// ===================================authentication-start=================================================================
// 📩 Email setup
let currentOtp = null;
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "ENTER YOUR MAIL", // 🔑 replace with your Gmail
    pass: "ENTER YOUR APP PASSWORD"     // 🔑 use app password (not regular Gmail password)
  }
});

// 🧠 Signup
app.post("/signup", (req, res) => {
  const { username, email, password } = req.body;
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (results.length) return res.json({ exists: true });
    db.query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, password],
      (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
      }
    );
  });
});

// 🔐 Login
app.post("/login", (req, res) => {
  const { username, email, password } = req.body;
  db.query("SELECT * FROM users WHERE email = ? AND username = ? AND password = ?",
    [email, username, password],
    (err, results) => {
      if (results.length) res.json({ success: true });
      else res.json({ success: false, error: "Invalid credentials" });
    }
  );
});
 

// 🔑 Forgot Password → Send OTP
app.post("/Forgot-Password", (req, res) => {
  const { email } = req.body;
  otpEmail = email; // ✅ Store email globally or in session
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (!results.length) return res.json({ success: false, error: "Email not found" });
    currentOtp = Math.floor(100000 + Math.random() * 900000);
    transporter.sendMail({
      from: "your-email@gmail.com",
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is ${currentOtp}`
    }, (err, info) => {
      if (err) return res.json({ success: false, error: "Email sending failed" });
      res.json({ success: true });
    });
  });
});

// 📩 OTP Verification
app.post("/OTP-Verification", (req, res) => {
  const { otp } = req.body;
  if (parseInt(otp) === currentOtp) res.json({ success: true });
  else res.json({ success: false, error: "Invalid OTP" });
});

// 🔁 Resend OTP
app.post("/resend-otp", (req, res) => {
  if (!currentOtp) return res.json({ success: false, error: "OTP not initialized" });
  transporter.sendMail({
    from: "your-email@gmail.com",
    to: req.body.email,
    subject: "Resent OTP Code",
    text: `Your OTP code is ${currentOtp}`
  }, (err) => {
    if (err) return res.json({ success: false, error: "Resend failed" });
    res.json({ success: true });
  });
});

// 🔒 Set New Password
app.post("/reset-password", (req, res) => {
  const email = req.body.email;
  console.log("🔐 Reset request for email:",email);
  console.log("Resetting password for:", email);

  const { newPassword } = req.body;
  db.query("UPDATE users SET password = ? WHERE email = ?",
    [newPassword, req.body.email],
    (err) => {
      if (err) return res.json({ success: false });
      res.json({ success: true });
    }
  );
});
// ==============================authentication-end===================================================

// ===================== Container 1 Endpoints ========================

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
  python.stdout.on('data', (data) => {
    dataBuffer += data.toString();
  });

  python.stderr.on('data', (err) => {
    console.error('Python error:', err.toString());
  });

  python.on('close', () => {
    fs.unlink(jobDescriptionPath, (err) => {
      if (err) console.warn('Failed to delete temp file:', jobDescriptionPath);
    });

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

// ===================== Container 2 Endpoint ========================

//Analyze resume and match jobs
app.post('/analyze-resume', upload.single('resume'), async (req, res) => {
  try {
    const resumePath = req.file.path;
    const resumeText = await extractText(resumePath);
    const keywords = extractKeywords(resumeText);

    const jobPosts = await fetchLiveJobs();
    const scoredJobs = scoreJobs(jobPosts, keywords);

    fs.unlinkSync(resumePath);
    res.json({ jobs: scoredJobs });
  } catch (err) {
    console.error('Error analyzing resume:', err);
    res.status(500).json({ error: 'Failed to analyze resume' });
  }
});

// Resume text extraction (mocked)
async function extractText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Keyword extraction
function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
}

// Added helper function to sanitize logo URLs
function sanitizeLogo(url) {
  const fallback = 'https://yourdomain.com/default-logo.png'; // Replace with your actual fallback logo URL
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `https://remoteok.com${trimmed}`;
  return fallback;
}

// Fetch jobs from APIs
async function fetchLiveJobs() {
  const arbeitnowURL = 'https://www.arbeitnow.com/api/job-board-api';
  const remoteOkURL = 'https://remoteok.com/api';

  const [arbeitRes, remoteRes] = await Promise.all([
    axios.get(arbeitnowURL),
    axios.get(remoteOkURL),
  ]);

  const arbeitJobs = arbeitRes.data.data.map(job => ({
    role: job.title || 'N/A',
    company: job.company_name || 'N/A',
    location: job.location || 'Remote',
    posted: job.created_at || 'N/A',
    logo: sanitizeLogo(job.company_logo),
    description: job.description || '',
    requirements: job.tags?.join(', ') || '',
    email: job.contact_email || '',
    applyLink: job.url || '#',
  }));

  const remoteJobs = remoteRes.data
    .filter(job => job.position && job.description)
    .map(job => ({
      role: job.position || 'N/A',
      company: job.company || 'N/A',
      location: job.location || 'Remote',
      posted: job.date || 'N/A',
      logo: sanitizeLogo(job.logo),
      description: job.description || '',
      requirements: job.tags?.join(', ') || '',
      email: job.email || '',
      applyLink: job.url || '#',
    }));

  return [...arbeitJobs, ...remoteJobs];
}

// Score jobs
function scoreJobs(jobs, keywords) {
  return jobs
    .map(job => {
      const matchCount = keywords.filter(k =>
        job.description.toLowerCase().includes(k)
      ).length;
      const matchScore = Math.round((matchCount / keywords.length) * 100);
      return { ...job, matchScore };
    })
    .filter(job => job.matchScore > 0);
}



// ===================== Start Server ========================
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

