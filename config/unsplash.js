const axios = require('axios')
module.exports.unsplashImages =async(query,limit=5)=>{
    try {
        const unsplash_url = `https://api.unsplash.com/search/photos?page=1&query=${encodeURIComponent(query)}&per_page=${limit}&client_id=${process.env.UNSPLASH_API_KEY}`;
        const response = await axios.get(unsplash_url);
        return response.data.results.map(item => item.urls.regular);
    } catch (err) {
        console.error(`Error fetching Unsplash images for query "${query}":`, err);
        return [];
    }
}