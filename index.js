require('dotenv').config()
const express = require('express');
const cors = require('cors');
const cookieParse = require('cookie-parser');
const { connectDB } = require('./db/connection.js');
const authRoute = require('./routes/auth.route');
const chatRoute = require('./routes/chat.route');
const morgan = require('morgan')
const { intializeSocket } = require('./config/socket.js')
const app = express();
const OpenAI = require('openai')
const openai = new OpenAI({ apiKey: process.env.OPEN_AI_SECRET })
const server = require('http').createServer(app);
const io = intializeSocket(server);
const { google } = require('googleapis');
const { serpAPI } = require('./config/serp.api.js');
const UserModel = require('./models/user.model.js');
const {auth : AuthMiddleware} = require('./middleware/auth.middleware.js');
require('./config/chat-connection.js')(io);

connectDB();

app.use(cors({
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));
app.use(cookieParse(process.env.COOKIE_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'))
app.use((req, res, next) => {
    req.io = io;
    next()
})
app.use('/api/v1/auth', authRoute);
app.use('/api/v1/chat', chatRoute);

//  google calendar
const scopes = ['https://www.googleapis.com/auth/calendar'];
const CLIENT_ID = process.env.CALENDAR_ID
const CLIENT_SECRET = process.env.CALENDAR_SECRET
const REDIRECT_URI = 'http://localhost:4001/auth/redirect'
const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
)


app.get('/',(req,res)=>{
    res.send('Index Working')
})

app.get('/auth', (req, res) => {
    const url = oauth2Client.generateAuthUrl
        ({
            access_type: 'offline',
            scope: scopes
        });
    res.redirect(url);
}
);

// after the succesfully redirect on authentication

app.get('/auth/redirect', AuthMiddleware, async (req, res) => {
    try {
        console.log(req.query.code);
        const user = req.user;

        if (!req.query.code) {
            return res.status(400).json({ error: "Authorization code is missing" });
        }

        const { tokens } = await oauth2Client.getToken(req.query.code);
        console.log(tokens)
        oauth2Client.setCredentials(tokens);

        // Set the tokens into user session
        if (tokens && tokens.access_token) {
            await UserModel.findOneAndUpdate(
                { _id: user._id }, 
                {
                    $set: {
                        'googleCalendarTokens.access_token': tokens.access_token,
                        'googleCalendarTokens.refresh_token': tokens.refresh_token,
                        'googleCalendarTokens.expiry_date': tokens.expiry_date
                    }
                },
                { new: true } // Return updated document
            );
        }
        return res.json({ message: "Authorization successful" });
        // return res.redirect(`/create-event`);
    } catch (error) {
        console.error("Error during authentication redirect:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});



// intialize  events on google calendar

const calendar = google.calendar({
    version: 'v3',
    auth: oauth2Client
})

const event = {
    'summary': 'Interview with master union student',
    'location': '800 Howard St., San Francisco, CA 94103',
    'description': 'A chance to hear more about Google\'s developer products.',
    'start': {
        'dateTime': '2025-05-28T09:00:00-07:00',
        'timeZone': 'Asia/Kolkata',
    },
    'end': {
        'dateTime': '2025-05-28T17:00:00-07:00',
        'timeZone': 'Asia/Kolkata',
    },
    'recurrence': [
        'RRULE:FREQ=DAILY;COUNT=2'
    ],
    'attendees': [
        { 'email': 'lpage@example.com' },
        { 'email': 'sbrin@example.com' },
    ],
    'reminders': {
        'useDefault': false,
        'overrides': [
            // after minutes later send email
            { 'method': 'email', 'minutes': 1 },
            { 'method': 'popup', 'minutes': 2 },
        ],
    },
};



// create a new event on google calendar

app.get('/create-event', async (req, res) => {
    try {
        await calendar.events.insert({
            calendarId: 'primary',
            auth: oauth2Client,
            requestBody: event
        })
        res.send({
            status: 200,
            message: 'Event created',
        });
    } catch (error) {
        console.log(error);
        res.send(error);
    }
})




const PORT = 4001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} 🚀`);
});