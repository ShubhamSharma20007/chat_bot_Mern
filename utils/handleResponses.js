class HandleResponses {
    constructor(res, status, message, data = null) {
        this.res = res;
        this.status = status;
        this.message = message;
        this.data = data;
    }
    sendResponse() {
        this.res.status(this.status).json({
            message: this.message,
            data: this.data,
            success: true
        })
    }
}
module.exports = HandleResponses;