// tools.js
module.exports = [
    {
        name: 'get_news',
        description: 'Get news from a specific source',
        parameters: {
            type: 'object',
            properties: {
                input: {
                    type: 'string',
                    description: 'The query to search for news'
                }
            },
            required: ['input']
        }
    },
    {
        name: 'google_calendar',
        description: 'Add event to calendar with: summary, location, description, date/time, attendees, and reminders. Updates default template values with user input'
        ,
        parameters: {
            type: 'object',
            properties: {
                summary:{
                    type: 'string',
                    description: 'The summary of the event'
                },
                location:{
                    type: 'string',
                    description: 'The location of the event'
                },
                description:{
                    type: 'string',
                    description: 'The description of the event'
                },
                date:{
                    type: 'string',
                    description: 'The date of the event'
                },
                end:{
                    type: 'string',
                    description: 'The time of the event'
                },
                attendees:{
                    type: 'string',
                    description: 'The attendees of the event'
                },
              
            },
            required: ['summary', 'location', 'description', 'date', 'end', 'attendees']
        }
    },
    {
        name: 'get_image_category',
        description: 'Get image category',
        parameters: {
            type: 'object',
            properties: {
                input: {
                    type: 'string',
                    description: 'The query to search for image category ex. "cat", "dog", "flower"'
                }
            },
            required: ['input']
        }
    },
];