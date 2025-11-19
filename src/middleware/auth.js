const jwt = require('jsonwebtoken')
// const User = require('../models/users.model')
const Player = require('../models/client.model')
const FranchisorUser = require('../models/franchisor.user.model')
const FranchiseeUser = require('../models/franchisee.user.model')

const asyncHandler = require('./async')
const ErrorResponse = require('../utils/errorResponse')

exports.protect = asyncHandler(async(req,res,next)=>{
    let token
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1]
    }
    if(!token){
        return next(new ErrorResponse('Not authorize to access this route',401))
    }
    try{
        const decoded = jwt.verify(token,process.env.JWT_SECRET)
        const user = await User.findOne({_id:decoded._id, 'token': token, isUserDeleted:false })
        if (!user) {
            throw next(new ErrorResponse('Authorization failed',401))
        }
        req.user = user
        next()
    }catch(err){
        return next(new ErrorResponse('Not authorize to access this route',401))
    }
})

exports.optionalProtect = asyncHandler(async(req,res,next)=>{
    let token
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1]
    }
    if(!token){
        return next()
    }
    try{
        const decoded = jwt.verify(token,process.env.JWT_SECRET)
        const user = await User.findOne({_id:decoded._id, 'token': token})
        if (!user) {
            throw next(new ErrorResponse('Authorization failed',401))
        }
        req.user = user
        next()
    }catch(err){
        return next(new ErrorResponse('Not authorize to access this route',401))
    }
})

exports.playerProtect = asyncHandler(async(req,res,next)=>{
    let token
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1]
    }
    if(!token){
        return next(new ErrorResponse('Not authorize to access this route',401))
    }
    try{
        const decoded = jwt.verify(token,process.env.JWT_FOR_CLIENT)
        const player = await Player.findOne({_id:decoded._id, 'token': token, isDeleted:false })
        if (!player) {
            throw next(new ErrorResponse('Authorization failed',401))
        }
        req.player = player
        next()
    }catch(err){
        return next(new ErrorResponse('Not authorize to access this route',401))
    }
})

exports.playerOptionalProtect = asyncHandler(async(req,res,next)=>{
    let token
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1]
    }
    if(!token){
        return next()
    }
    try{
        const decoded = jwt.verify(token,process.env.JWT_FOR_CLIENT)
        const player = await Player.findOne({_id:decoded._id, 'token': token})
        if (!player) {
            throw next(new ErrorResponse('Authorization failed',401))
        }
        req.player = player
        next()
    }catch(err){
        return next(new ErrorResponse('Not authorize to access this route',401))
    }
})


exports.franchisorProtect = asyncHandler(async(req,res,next)=>{
    let token
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1]
    }
    if(!token){
        return next(new ErrorResponse('Not authorize to access this route',401))
    }
    try{
        const decoded = jwt.verify(token,process.env.JWT_FOR_FRANCHISOR_USER)
        const franchisorUser = await FranchisorUser.findOne({_id:decoded._id, 'token': token, isDeleted:false })
        if (!franchisorUser) {
            throw next(new ErrorResponse('Authorization failed',401))
        }
        req.franchisorUser = franchisorUser
        next()
    }catch(err){
        return next(new ErrorResponse('Not authorize to access this route',401))
    }
})


exports.franchisorOptionalProtect = asyncHandler(async(req,res,next)=>{
    let token
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1]
    }
    if(!token){
        return next()
    }
    try{
        const decoded = jwt.verify(token,process.env.JWT_FOR_FRANCHISOR_USER)
        const franchisorUser = await FranchisorUser.findOne({_id:decoded._id, 'token': token})
        if (!franchisorUser) {
            throw next(new ErrorResponse('Authorization failed',401))
        }
        req.franchisorUser = franchisorUser
        next()
    }catch(err){
        return next(new ErrorResponse('Not authorize to access this route',401))
    }
})



exports.franchiseeProtect = asyncHandler(async(req,res,next)=>{
    let token
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1]
    }
    if(!token){
        return next(new ErrorResponse('Not authorize to access this route',401))
    }
    try{
        const decoded = jwt.verify(token,process.env.JWT_FOR_FRANCHISEE_USER)
        const franchiseeUser = await FranchiseeUser.findOne({_id:decoded._id, 'token': token, isDeleted:false })
        if (!franchiseeUser) {
            throw next(new ErrorResponse('Authorization failed',401))
        }
        req.franchiseeUser = franchiseeUser
        next()
    }catch(err){
        return next(new ErrorResponse('Not authorize to access this route',401))
    }
})


exports.franchiseeOptionalProtect = asyncHandler(async(req,res,next)=>{
    let token
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1]
    }
    if(!token){
        return next()
    }
    try{
        const decoded = jwt.verify(token,process.env.JWT_FOR_FRANCHISEE_USER)
        const franchiseeUser = await FranchiseeUser.findOne({_id:decoded._id, 'token': token})
        if (!franchiseeUser) {
            throw next(new ErrorResponse('Authorization failed',401))
        }
        req.franchiseeUser = franchiseeUser
        next()
    }catch(err){
        return next(new ErrorResponse('Not authorize to access this route',401))
    }
})

/**
 * Common protection middleware to check for any of the following tokens:
 * JWT_FOR_FRANCHISEE_USER, JWT_FOR_FRANCHISOR_USER, JWT_FOR_CLIENT
 * Sets req.franchiseeUser, req.franchisorUser, or req.player accordingly.
 */
exports.commonProtect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return next(new ErrorResponse('Not authorize to access this route', 401));
    }

    // Try each token type in order
    try {
        // Try Franchisee
        let decoded = jwt.verify(token, process.env.JWT_FOR_FRANCHISEE_USER);
        const franchiseeUser = await FranchiseeUser.findOne({ _id: decoded._id, token, isDeleted: false });
        if (franchiseeUser) {
            req.franchiseeUser = franchiseeUser;
            return next();
        }
    } catch (e) {}

    try {
        // Try Franchisor
        let decoded = jwt.verify(token, process.env.JWT_FOR_FRANCHISOR_USER);
        const franchisorUser = await FranchisorUser.findOne({ _id: decoded._id, token, isDeleted: false });
        if (franchisorUser) {
            req.franchisorUser = franchisorUser;
            return next();
        }
    } catch (e) {}

    try {
        // Try Player
        let decoded = jwt.verify(token, process.env.JWT_FOR_CLIENT);
        const player = await Player.findOne({ _id: decoded._id, token, isDeleted: false });
        if (player) {
            req.player = player;
            return next();
        }
    } catch (e) {}

    return next(new ErrorResponse('Not authorize to access this route', 401));
});
