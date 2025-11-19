const ErrorResponse = require('../utils/errorResponse')
const errorHandler = (err,req,res,next)=>{
    let error = {...err}
    error.message = err.message
	//console.log(err)
    //console.log(err.stack)
    //console.log(err.name)
    //console.log(err.code)
    //Mongoose bad ObjectId
    
    if(err.name === 'CastError'){
        const message = `Resource not found with id ${err.value}`
        error = new ErrorResponse(message,404)
    }
    //Mogoose duplicate key
    if(err.code === 11000){
        const message = `Duplicate field value entered`
        error = new ErrorResponse(message,200)
    }
    if((err.name === 'ValidatorError') || (err.name === 'ValidationError')){
        const message = Object.values(err.errors).map(val=>val.message)
        error = new ErrorResponse(message,200)
    }
    res.status(error.statusCode || 500).send({
        status:0,
        success:false,
        message: error.message,
        error: error.message || 'Server Error'
    })
}

module.exports = errorHandler