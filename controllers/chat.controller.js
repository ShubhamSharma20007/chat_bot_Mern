
const ChatTabModel = require('../models/chat-tab.model');
const UserModel = require('../models/user.model');
const HandleResponses = require('../utils/handleResponses');
const mongoose = require('mongoose')
const OpenAI = require('openai')
const openai = new OpenAI({ apiKey: process.env.OPEN_AI_SECRET })
const { serpApiKey } = require('../config/serp.api');
const funcationTools = require('../data/tools.js');
const { calendarObject, createCalendarEvent } = require('../config/googleCalendar.js');
const {unsplashImages} = require('../config/unsplash.js')
const tools = require('../data/tools.js')
// Initialize assistant and thread
// Store both assistant and thread
let assistantId = null;
let threadId = null;


async function initializeAssistant() {
    if (!assistantId) {
        const assistant = await openai.beta.assistants.create({
            model: "gpt-4o-mini",
            name: "My Assistant",
            instructions: "You are a helpful assistant. Always remember previous context from the conversation and refer back to it when answering questions. Maintain information about the user throughout the conversation.",
        });
        assistantId = assistant.id;
    }

    if (!threadId) {
        const thread = await openai.beta.threads.create();
        threadId = thread.id;
    }

    return { assistantId, threadId };
}





// // First fix the serpAPI function to return a Promise

const generateChat = async (message, tabId, userId) => {
    try {
        // Find existing chat tab and user
        const findtab = await ChatTabModel.findById(tabId);
        const findUser = await UserModel.findById(userId);

        if (!findtab) {
            throw new Error('Chat tab not found');
        }

        let currentAssistantId = findtab.tabAssistantId;
        let currentThreadId = findtab.tabThreadId;
        let currentUserMessage = message

        // Check for and cancel any active runs first
        // openai.beta.threads.runs.list(threadId) → Retrieves a list of all active runs for a given thread (chat conversation).
        // Returns an array of runs that have been executed.

        if (findtab.isDuplicate) {
            const contextMessage = "This is a continuation of a previous conversation.We will be going to work on this conversation from where it left off.";
            currentUserMessage = `${contextMessage}\n\n${message}`;
        }

        try {
            const activeRuns = await openai.beta.threads.runs.list(currentThreadId);
            const runInProgress = activeRuns.data.find(run => {
                return ['in_progress', 'queued', 'requires_action'].includes(run.status)
            }
            );
            if (runInProgress) {
                await openai.beta.threads.runs.cancel(currentThreadId, runInProgress.id);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.warn('Error handling existing runs:', error);
        }



        // Create message in thread 
        // Adds a message to the conversation.
        await openai.beta.threads.messages.create(currentThreadId, {
            role: "user",
            content: currentUserMessage
        });


        // Create and monitor run
        // Starts an AI assistant run.
        
        const run = await openai.beta.threads.runs.create(currentThreadId, {
            assistant_id: currentAssistantId,
            tools:funcationTools.map(tool => ({
                type: "function",
                function: tool
            }))
        });

        const maxAttempts = 60;
        let attempts = 0;
        let runStatus;

        const getRunStatus = async () => {
            // Fetches the latest status of an AI run.
            return await openai.beta.threads.runs.retrieve(currentThreadId, run.id);
        };

        do {
            if (attempts >= maxAttempts) {
                throw new Error('Request timed out');
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await getRunStatus();
            attempts++;
        } while (runStatus.status === 'in_progress' || runStatus.status === 'queued');

        // Handle function calling
        if (runStatus.status === 'requires_action' &&
            runStatus.required_action?.type === 'submit_tool_outputs') {
            const toolCallPromises = runStatus.required_action.submit_tool_outputs.tool_calls
                .map(async (toolCall) => {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log('calling tool..............', toolCall)
                    switch (toolCall.function.name) {
                        case "get_news":
                            const result = await serpApiKey(args.input);
                            return {
                                tool_call_id: toolCall.id,
                                output: result
                            };
                        case "google_calendar":
                        const  googleCalendarResult = await calendarObject(args)
                        const userHasCalendarTokens = findUser.googleCalendarTokens && 
                        findUser.googleCalendarTokens.access_token;
                            if (!userHasCalendarTokens) {
                            return {
                            tool_call_id: toolCall.id,
                            output: googleCalendarResult 
                            };
                            }
                            else if(userHasCalendarTokens && findUser.googleCalendarTokens.expiry_date < new Date().getTime()){
                                console.log('TOKEN EXPIRED')
                            return{
                            tool_call_id: toolCall.id,
                            output: googleCalendarResult
                            }
                        }
                        
                            else {
                            const eventCreated = await createCalendarEvent(
                            findUser.googleCalendarTokens,
                            args
                            );
                            return {
                            tool_call_id: toolCall.id,
                            output: JSON.stringify(eventCreated)
                            };
                            }
                        
                        
                        default:
                            console.warn(`Unknown tool called: ${toolCall.function.name}`);
                            return null;
                    }

                });

            const toolOutputs = (await Promise.all(toolCallPromises)).filter(Boolean);
            console.log(toolOutputs,222);

            // openai.beta.threads.runs.submitToolOutputs(threadId, runId, { tool_outputs }) → Sends tool results back to OpenAI.
            await openai.beta.threads.runs.submitToolOutputs(currentThreadId, run.id, {
                tool_outputs: toolOutputs
            });

            // Wait for run to complete after submitting outputs
            attempts = 0;
            do {
                if (attempts >= maxAttempts) {
                    throw new Error('Request timed out waiting for tool output processing');
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                runStatus = await getRunStatus();
                attempts++;
            } while (runStatus.status === 'in_progress' || runStatus.status === 'queued');
        }

        // Check for failed run
        if (runStatus.status === 'failed') {
            throw new Error(`Run failed: ${runStatus.last_error?.message || 'Unknown error'}`);
        }

        // openai.beta.threads.messages.list(threadId) → Gets all messages in the chat thread.
        const messagesResponse = await openai.beta.threads.messages.list(currentThreadId);
        const assistantMessage = messagesResponse.data.find(msg =>
            msg.role === 'assistant' &&
            msg.run_id === run.id
        );

        if (!assistantMessage || !assistantMessage.content[0]?.text?.value) {
            throw new Error('No response received from assistant');
        }

        const responseMessage = assistantMessage.content[0].text.value;

        // Save to database
        const newResponse = {
            content: responseMessage,
            user_msg: message,
            chatTabId: tabId,
            role: 'assistant',
        };

        findUser.chats.push(newResponse);
        await findUser.save();

        return newResponse;
    } catch (error) {
        console.error('Chat generation error:', error);
        throw error;
    }
};





const generatePresentation = async (topic) => {
  
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: "system",
                    content: `Generate a structured presentation about ${topic} with 4 slides. 
                              For each slide provide: 
                              1. A clear, concise title
                              2. 3-4 bullet points with important information.`
                },
                {
                    role: 'user',
                    content: `Create a presentation about ${topic}. Return the result as a JSON object with this structure:
                    {
                      "title": "Main presentation title",
                      "slides": [
                        {
                          "title": "Slide title",
                          "bulletPoints": ["point 1", "point 2", "point 3"]
                        }
                      ]
                    }`
                }
            ],
            response_format: { type: "json_object" }
        });

        let presentationData;
        try {
            console.log("Parsing presentation content");
            const content = response.choices[0].message.content;
            if (!content) {
                throw new Error("Empty content from OpenAI");
            }
            presentationData = JSON.parse(content);
            
            // Validate the structure
            if (!presentationData.title) {
                presentationData.title = topic;
            }
            if (!Array.isArray(presentationData.slides)) {
                console.warn("No slides array in response, creating empty array");
                presentationData.slides = [];
            }
        } catch (e) {
            console.error("Error parsing presentation content:", e);
            // Create a default structure if parsing fails
            presentationData = { 
                title: `Presentation about ${topic}`, 
                slides: [] 
            };
        }

        // if (presentationData.slides.length === 0) {
        //     console.warn("Creating default slides");
        //     presentationData.slides = [
        //         {
        //             title: `Introduction to ${topic}`,
        //             bulletPoints: ["Overview", "Importance", "Key concepts"]
        //         },
        //         {
        //             title: `Key aspects of ${topic}`,
        //             bulletPoints: ["First aspect", "Second aspect", "Third aspect"]
        //         }
        //     ];
        // }

        console.log("Fetching images for slides");
        const slidesWithImages = await Promise.all(presentationData.slides.map(async (slide, index) => {
            const searchQuery = slide.title || topic;
            try {
                const images = await unsplashImages(searchQuery);
                if (images && images.length > 0) {
                    slide.image = images[0];
                    console.log(`Added image for slide ${index + 1}`);
                } else {
                    console.log(`No images found for "${searchQuery}", trying topic`);
                    const fallbackImages = await unsplashImages(topic);
                    slide.image = fallbackImages && fallbackImages.length > 0 ? fallbackImages[0] : null;
                }
                return slide;
            } catch (error) {
                console.error(`Error fetching image for slide "${slide.title}":`, error);
                slide.image = null;
                return slide;
            }
        }));

        presentationData.slides = slidesWithImages;
        


        return generatePresentationDesign(presentationData)
    } catch (error) {
        console.error("Error in generatePresentation:", error);
        return {
            title: `Simple Presentation on ${topic}`,
            slides: [
                {
                    title: `About ${topic}`,
                    bulletPoints: ["Basic information"],
                    image: null
                }
            ]
        };
    }
};




async function generatePresentationDesign(data) {
    return `function PresentationComponent() {
  const data = ${JSON.stringify(data, null, 2)};

  const layouts = [
    {
      container: "flex flex-col w-full max-w-7xl mx-auto md:flex-row rounded-2xl shadow-lg overflow-hidden",
      imageWrapper: "md:w-1/2 relative group", 
      contentWrapper: "md:w-1/2 p-8 space-y-6 backdrop-blur-sm bg-white/30"
    },
    {
      container: "relative w-full max-w-7xl mx-auto rounded-2xl shadow-2xl overflow-hidden min-h-[500px]",
      imageWrapper: "absolute inset-0 z-0",
      contentWrapper: "relative z-10 p-12 bg-gradient-to-r from-white/90 to-transparent text-white"
    },
    {
      container: "grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-7xl mx-auto rounded-2xl shadow-2xl p-8",
      imageWrapper: "relative aspect-square rounded-xl overflow-hidden",
      contentWrapper: "flex flex-col justify-center space-y-6"
    },
    {
      container: "flex flex-col items-center w-full max-w-7xl mx-auto rounded-2xl shadow-2xl p-12 text-center",
      imageWrapper: "w-64 h-64 rounded-full overflow-hidden mx-auto mb-8",
      contentWrapper: "max-w-2xl mx-auto space-y-6"
    }
  ];

  const gradients = [
    "bg-gradient-to-br from-rose-100 via-pink-100 to-teal-100",
    "bg-gradient-to-tr from-purple-100 via-violet-100 to-indigo-100", 
    "bg-gradient-to-bl from-blue-100 via-sky-100 to-emerald-100",
    "bg-gradient-to-tl from-amber-100 via-orange-100 to-yellow-100"
  ];

  return React.createElement('div',
    {
      className: "relative w-full min-h-screen flex flex-col items-center justify-center gap-12 py-16 "
    },
    React.createElement('h1',
      {
        className: "text-6xl text-center font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 [text-shadow:_0_1px_2px_rgb(0_0_0_/_20%)] animate-float"
      },
      data.title
    ),
    data.slides.map((slide, index) => {
      const layout = layouts[index % layouts.length];
      return React.createElement('div',
        {
          className: layout.container + " " + gradients[index % gradients.length] + " transform transition-all duration-500 hover:scale-[1.02] mb-12"
        },
        [
          React.createElement('div',
            {
              className: layout.imageWrapper
            },
            React.createElement('img',
              {
                src: slide.image,
                className: "w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              }
            )
          ),
          React.createElement('div',
            {
              className: layout.contentWrapper
            },
            [
              React.createElement('h2',
                {
                  className: "text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-400 to-gray-700 pb-2 border-b-2 border-gray-200/50"
                },
                slide.title
              ),
              React.createElement('ul',
                {
                  className: "space-y-4 pt-6"
                },
                slide.bulletPoints.map(point =>
                  React.createElement('li',
                    {
                      className: "flex items-center gap-4 text-gray-700 transform transition-all duration-300 hover:translate-x-2"
                    },
                    [
                      React.createElement('span',
                        {
                          className: "text-2xl text-gray-600 rotate-12"
                        },
                        "✦"
                      ),
                      React.createElement('span',
                        {
                          className: "font-medium leading-relaxed"
                        },
                        point
                      )
                    ]
                  )
                )
              )
            ]
          )
        ]
      );
    })
  );
}
return PresentationComponent;  
`;
}


const convertCodeIntoHTML = async (req, res) => {
    const { code } = req.body
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                // { role: "system", content: "You are a helpful assistant." },
                {
                    role: "user",
                    content: code,
                },
            ],
            store: true,
        });

        return res.status(200).json(completion?.choices[0]?.message?.content)
    } catch (error) {
        console.log(error, 13)
        return error

    }

}



const getChats = async (req, res) => {
    const user = req.user;
    const tabId = req.query.chatTabId;

    try {
        // Find user where a matching chatTabId exists in the chats array
        const findUser = await UserModel.findOne({
            _id: user._id,
        });

        if (findUser) {
            threadId = findUser.tabThreadId;
            assistantId = findUser.tabAssistantId;
            const findChat = findUser.chats.filter(chat => chat.chatTabId.toString() === tabId.toString());
            if (findChat.length > 0) {
                return new HandleResponses(res, 200, 'Chats found successfully', { chats: findChat }).sendResponse()
            } else {
                return new HandleResponses(res, 200, 'No Chats found', { chats: findChat }).sendResponse()
            }
        } else {
            res.status(404).json({
                message: "No matching chatTabId found for the user"
            });
        }
    } catch (error) {
        res.status(500).json({
            message: "Error finding user or chatTabId",
            error: error.message
        });
    }

};


const deleteChats = async (req, res) => {
    try {
        const user = req.user;
        const findUser = await UserModel.findById(user._id);
        if (!findUser) {
            return new HandleResponses(res, 404, 'User not found').sendResponse()
        }
        findUser.chats = [];
        await ChatTabModel.deleteMany({ userId: user._id });

        await findUser.save();
        return new HandleResponses(res, 200, 'Chat deleted successfully').sendResponse()
    } catch (err) {
        console.log(err);
        return new HandleResponses(res, 500, 'Something went wrong', err).sendResponse()
    }
}


//  chat tab model
const createChatTab = async (req, res) => {
    // firstly check if the chatId is already present in the user's chats array
    const allTabs = await ChatTabModel.find({}).select('_id');
    const { assistantId, threadId } = await initializeAssistant();
    const user = req.user;
    const findUser = await UserModel.findById(user._id);
    if (!findUser) {
        return new HandleResponses(res, 404, 'User not found').sendResponse()
    }
    const findChatTab = allTabs.find((tab) => {
        if (findUser.chats.includes(tab._id)) {
            return tab;
        }
    });

    if (findChatTab) {
        return new HandleResponses(res, 200, 'Chat tab already exists', { chatTab: findChatTab }).sendResponse()
    }
    const newChatTab = new ChatTabModel({
        userId: req.user._id,
        tabAssistantId: assistantId,
        tabThreadId: threadId
    })
    await newChatTab.populate('userId')
    await newChatTab.save();
    return new HandleResponses(res, 200, 'Chat tab created successfully', { chatTab: newChatTab }).sendResponse()
}

const getTabs = async (req, res) => {
    try {
        const user = req.user;
        const findTabs = await ChatTabModel.find({ userId: user._id }).populate('userId')
        return new HandleResponses(res, 200, 'Chat tabs fetched successfully', { chatTabs: findTabs }).sendResponse()
    } catch (err) {
        console.log(err);
        return new HandleResponses(res, 500, 'Something went wrong', err).sendResponse()
    }
}

const duplicateTab = async (req, res) => {
    try {
        const { id } = req.body;
        console.log(id, 12);
        const user = req.user;
        const originalTab = await ChatTabModel.findById(id);
        if (!originalTab) {
            return res.status(404).json({ message: 'Chat tab not found' });
        }

        const duplicatedTab = await ChatTabModel.create({
            userId: user._id,
            tabAssistantId: originalTab.tabAssistantId,
            tabThreadId: originalTab.tabThreadId,
            isDuplicate: true,
        });

        await duplicatedTab.save();
        return res.status(201).json({
            message: 'Tab duplicated successfully',
            duplicatedTab
        });
    } catch (error) {
        console.error('Error duplicating tab:', error);
        return res.status(500).json({
            message: 'Failed to duplicate tab',
            error: error.message
        });
    }
};

module.exports = {
    generateChat,
    getChats,
    deleteChats,
    createChatTab,
    getTabs,
    convertCodeIntoHTML,
    duplicateTab,
    generatePresentation,
}