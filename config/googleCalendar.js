const { google } = require('googleapis');

// Google calendar setup
const scopes = ['https://www.googleapis.com/auth/calendar'];
const CLIENT_ID = process.env.CALENDAR_ID;
const CLIENT_SECRET = process.env.CALENDAR_SECRET;
const REDIRECT_URI = 'http://localhost:4001/auth/redirect';

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

// Generate auth URL for Google Calendar
const generateTokenURL = async () => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
    });
    return url;
};


const calendarObject = async function(str) {
    try {
        const authUrl = await generateTokenURL();
        return JSON.stringify({
            status: 'auth_required',
            message: 'Google Calendar authorization required. Please click the link below to authorize:',
            auth_url: authUrl
        })
        
        // Note: After implementing token storage, you'd parse the event
        // and create it if the user is authenticated
    } catch (error) {
        console.error('Error in calendarObject:', error);
        return JSON.stringify({
            status: 'error',
            message: 'Failed to process calendar request: ' + error.message
        });
    }
};

// Handle OAuth callback
const handleAuthCallback = async (code) => {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log(tokens,1212)
        
        return tokens;
    } catch (error) {
        console.error('Error getting tokens:', error);
        throw error;
    }
};



const createCalendarEvent = async (tokens, eventData) => {
    try {
        oauth2Client.setCredentials(tokens);
        const calendarEvent = parseEventData(eventData);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        try {
            const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: calendarEvent
            });
            
            return {
                status: 'success',
                message: 'Event created successfully',
                eventLink: response.data.htmlLink
            };
        } catch (error) {
            // Check if error is invalid_grant
            if (error.message.includes('invalid_grant')) {
              
                const authUrl = await generateTokenURL();
                return {
                    status: 'reauth_required',
                    message: 'Your authorization has expired. Please reauthorize:',
                    auth_url: authUrl
                };
            }
            throw error;
        }
    } catch (error) {
        console.error('Error creating calendar event:', error);
        return {
            status: 'error',
            message: 'Failed to create event: ' + error.message
        };
    }
};


function parseEventData(obj) {
    console.log(obj)
    // const cleanText = str.replace(/^Add the following event:\s*/i, '');
    const calendarObject = {
        'summary': 'summary' in  obj && obj.summary,
        'location': 'location' in  obj && obj.location,
        'description': 'description:' in  obj && obj.description,
        'start': {
            'dateTime': 'date' in obj && obj.date,
            'timeZone': 'Asia/Kolkata',
        },
        'end': {
            'dateTime': 'end' in obj && obj.end,
            'timeZone': 'Asia/Kolkata',
        },
        'recurrence': [
            'RRULE:FREQ=DAILY;COUNT=2'
        ],
        'attendees':obj['attendees'].split(',').map(email => ({ email: email.trim()})),
       
    };

   

    return calendarObject
}

module.exports = {
    generateTokenURL,
    calendarObject,
    handleAuthCallback,
    createCalendarEvent
};