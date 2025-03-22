const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { google } = require('googleapis');
const session = require('express-session');
const cors = require('cors'); // 新增 cors

const app = express();

// 配置 CORS 中間件
app.use(cors({
    origin: 'https://localhost', // 允許來自 https://localhost 的請求
    methods: ['GET', 'POST'], // 允許的 HTTP 方法
    allowedHeaders: ['Content-Type', 'Authorization'] // 允許的頭部
}));

// 配置 express-session 中間件
app.use(session({
    secret: 'your-secret-key', // 替換為一個安全的密鑰
    resave: false,
    saveUninitialized: false
}));

// 配置 Passport
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'https://my-booking-app-backend.onrender.com/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
    console.log('Google OAuth callback - accessToken:', accessToken);
    return done(null, { profile, accessToken });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use(passport.initialize());
app.use(passport.session());

// 簡單的 /ping 端點，支持 GET 和 HEAD 請求，供 UptimeRobot 監控
app.get('/ping', (req, res) => {
    res.status(200).send('OK');
});

app.head('/ping', (req, res) => {
    res.status(200).send('OK');
});

// 處理 /auth/google 的 HEAD 請求，供 UptimeRobot 監控
app.head('/auth/google', (req, res) => {
    res.status(200).send('OK');
});

// 登入路由
app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'https://www.googleapis.com/auth/calendar.readonly']
}));

// 回調路由
app.get('/auth/google/callback', passport.authenticate('google'), (req, res) => {
    console.log('Handling /auth/google/callback - req.user:', req.user);
    if (!req.user || !req.user.accessToken) {
        console.error('No accessToken found in req.user');
        return res.status(500).send('Authentication failed: No access token');
    }
    res.redirect('/booking?token=' + req.user.accessToken);
});

// /booking 路由，返回 token 給前端應用
app.get('/booking', (req, res) => {
    const token = req.query.token;
    console.log('Handling /booking - token:', token);
    if (!token) {
        console.error('Missing token in /booking');
        return res.status(400).send('Missing token');
    }
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Booking</title>
        </head>
        <body>
            <script>
                console.log('Redirecting to mybookingapp://booking?token=${token}');
                window.location.href = 'mybookingapp://booking?token=${token}';
            </script>
        </body>
        </html>
    `);
});

// 日歷事件 API
app.get('/calendar', async (req, res) => {
    const token = req.query.token;
    console.log('Handling /calendar - token:', token);
    if (!token) {
        console.error('Missing token in /calendar request');
        return res.status(400).json({ error: 'Missing token' });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });

    const calendar = google.calendar({ version: 'v3', auth });
    try {
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });
        console.log('Successfully fetched calendar events:', response.data.items);
        res.json(response.data.items);
    } catch (error) {
        console.error('Error fetching calendar events:', error.message);
        console.error('Error details:', error);
        res.status(500).json({ error: error.message, details: error });
    }
});

// 錯誤處理中間件，防止未處理的錯誤導致服務崩潰
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).send('Something broke!');
});

// 啟動服務器
app.listen(process.env.PORT || 10000, () => console.log('Server running on port ' + (process.env.PORT || 10000)));