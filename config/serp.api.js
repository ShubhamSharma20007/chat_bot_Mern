const { getJson } = require("serpapi");
module.exports.serpApiKey = (query, engine) => {

    return new Promise((resolve, reject) => {
        getJson({
            engine: engine || 'google',
            num: 5,
            api_key: process.env.SERPAPI_API_KEY,
            q: query,
        }, (json) => {
            try {
                const results = json?.organic_results;
                const formattedResults = results.map(result => ({
                    title: result.title,
                    link: result.link,
                    snippet: result.snippet,
                }));
                resolve(JSON.stringify(formattedResults));
            } catch (error) {
                reject(error);
            }
        });
    });
};