const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { google } = require('googleapis');

const app = express();

// 配置 Passport
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'https://my-booking-app-backend.onrender.com/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
    return done(null, { profile, accessToken });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use(passport.initialize());

// 登入路由
app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'https://www.googleapis.com/auth/calendar.readonly']
}));

// 回調路由
app.get('/auth/google/callback', passport.authenticate('google', {
    failureRedirect: '/login'
}), (req, res) => {
    res.redirect('/booking?token=' + req.user.accessToken);
});

// 日歷事件 API
app.get('/calendar', async (req, res) => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: req.query.token });

    const calendar = google.calendar({ version: 'v3', auth });
    try {
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });
        res.json(response.data.items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 啟動服務器
app.listen(process.env.PORT || 3000, () => console.log('Server running on port ' + (process.env.PORT || 3000)));