const OpenAI = require('openai')
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_SECRET,
});
module.exports.configureOpenAi = async function (message) {
    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        store: true,
        messages: [
            { role: "assistant", content: "You are a helpful assistant." },
            {
                role: "user",
                content: message
            },
        ],
    });
    const response = completion.choices[0].message
    return response;
}


// module.exports.configureAssistant = async function () {

   
//     console.log(assistant)

// }