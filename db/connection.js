const mongoose = require('mongoose')

module.exports.connectDB = async () => {
    const res = await mongoose.connect(process.env.MONGO_URI, {
        dbName: process.env.DB_NAME,
    })
    if (res) {
        console.log('Connected to DB ✅')
    }
    else {
        console.log('Error connecting to DB ❌')
    }
}
