/* eslint-disable */
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting: 10 requests/min per IP for the contact endpoint
const contactLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});

// Serve static files
const staticDir = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : path.join(__dirname, 'public');
app.use(express.static(staticDir));

// Root route to serve index.html
app.get('/', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
});

// Healthcheck
app.get('/health', (_req, res) => {
    res.json({ ok: true, env: process.env.NODE_ENV || 'production' });
});

function sanitizeHeader(value) {
    return (value || '').toString().replace(/[\r\n]+/g, ' ').trim();
}

function sanitizeMessage(value) {
    const raw = (value || '').toString();
    return raw.replace(/<[^>]*>?/gm, '').trim();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function createTransporter() {
    if (process.env.SMTP_URL) {
        return nodemailer.createTransport(process.env.SMTP_URL);
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        throw new Error('SMTP configuration missing. Set SMTP_HOST, SMTP_USER, SMTP_PASS');
    }

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
    });
}

app.post('/api/contact', contactLimiter, async (req, res) => {
    try {
        const name = sanitizeHeader(req.body.name);
        const email = sanitizeHeader(req.body.email);
        const subject = sanitizeHeader(req.body.subject || 'No subject');
        const message = sanitizeMessage(req.body.message);

        if (!name || !email || !message) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, error: 'Invalid email address' });
        }

        const toAddress = sanitizeHeader(process.env.MAIL_TO || process.env.SMTP_USER || '');
        const fromAddress = sanitizeHeader(process.env.MAIL_FROM || `"VideoPro Portfolio" <no-reply@${req.hostname || 'example.com'}>`);

        const mailOptions = {
            from: fromAddress,
            to: toAddress,
            replyTo: email,
            subject: `[Portfolio] ${subject} — from ${name}`,
            text: `You have a new contact form submission.\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}\n\n— Portfolio contact form`,
        };

        const isDryRun = String(process.env.EMAIL_DRY_RUN || '').toLowerCase() === 'true';

        if (isDryRun) {
            console.log('[DRY RUN] Would send email:', mailOptions);
            return res.json({ success: true, dryRun: true });
        }

        const transporter = await createTransporter();

        // Optional: verify transporter in development to fail fast
        if ((process.env.NODE_ENV || '').toLowerCase() === 'development') {
            await transporter.verify();
        }

        await transporter.sendMail(mailOptions);
        return res.json({ success: true });
    } catch (error) {
        console.error('Error sending contact email:', error);
        return res.status(500).json({ success: false, error: 'Failed to send message' });
    }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});