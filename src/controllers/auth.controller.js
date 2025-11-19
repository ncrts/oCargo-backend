const path = require('path');
const base64 = require('base-64')
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const randomstring = require('randomstring');
const MailHelper = require('../utils/mailHelper');

const User = require('../models/users.model');


const register = catchAsync(async (req, res) => {
    const profilePicturePath = req.protocol + '://' + req.get('host') + '/uploads/profile-picture/';
    let isUserExist = await User.findOne({ email: req.body.email });
    if (isUserExist) {
        return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ success: false, message: "Your email is already registered. Please login." })
    } else {
        let newUserObj = null;
        const OTP = "1234"
        // await randomstring.generate({ length: 4, charset: 'numeric' })

        if (req.body.signupWith == 'local') {
            newUserObj = {
                email: req.body.email,
                phonenoPrefix: req.body.phonenoPrefix,
                phoneno: req.body.phoneno,
                signupWith: req.body.signupWith,
                password: req.body.password,
                verificationCode: OTP
            }
            // let emailData = { email: req.body.email, code: OTP }
            // MailHelper.sendVerificationEmail(emailData);
        }

        if (req.body.signupWith == 'facebook' || req.body.signupWith == "apple") {
            if (!req.body.socialId) {
                return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ result: false, message: 'Required field is missing.', details: "Please provide socialId" })
            }

            let generatePass = await randomstring.generate({ length: 6, charset: 'numeric' })
            if (req.body.isVerified == 1) {

                newUserObj = {
                    email: req.body.email,
                    phonenoPrefix: req.body.phonenoPrefix,
                    phoneno: req.body.phoneno,
                    signupWith: req.body.signupWith,
                    password: `${req.body.email?.split("@")[0]}@${generatePass}`,
                    verificationCode: "",
                    isVerified: 1,
                    username: req.body.email?.split("@")[0],
                    deviceType: req.body.deviceType !== '' ? req.body.deviceType : "",
                    devicePushKey: req.body.devicePushKey !== '' ? req.body.devicePushKey : ""
                }

                if (req.body.signupWith == 'facebook') {
                    newUserObj.facebook_id = req.body.socialId
                }

                if (req.body.signupWith == 'apple') {
                    newUserObj.apple_id = req.body.socialId
                }

                let user = new User(newUserObj);
                await user.save();
                const token = await user.generateAuthToken()
                let staticUrl = {
                    profilePicturePath
                }
                return res.status(httpStatus.CREATED).json({ success: true, message: 'Registration successful', data: { user, token, staticUrl, totalCart: 0 } })

            } else {
                newUserObj = {
                    email: req.body.email,
                    phonenoPrefix: req.body.phonenoPrefix,
                    phoneno: req.body.phoneno,
                    signupWith: req.body.signupWith,
                    password: `${req.body.email?.split("@")[0]}@123`,
                    verificationCode: OTP
                }

                if (req.body.signupWith == 'facebook') {
                    newUserObj.facebook_id = req.body.socialId
                }

                if (req.body.signupWith == 'apple') {
                    newUserObj.apple_id = req.body.socialId
                }

                // let emailData = { email: req.body.email, code: OTP }
                // MailHelper.sendVerificationEmail(emailData);
            }
        }

        let user = new User(newUserObj);
        await user.save();

        return res.status(httpStatus.CREATED).json({ success: true, message: 'Registration successful. OTP sent successfully to your registered email address.', data: { user, totalCart: 0 } })
    }
});

const login = catchAsync(async (req, res) => {
    const profilePicturePath = req.protocol + '://' + req.get('host') + '/uploads/profile-picture/';
    const user = await User.findByCredentials(req.body.email, req.body.password, req.body.role);

    if (user.isVerified == 1) {
        user.deviceType = req.body.deviceType !== '' ? req.body.deviceType : user.deviceType
        user.devicePushKey = req.body.devicePushKey !== '' ? req.body.devicePushKey : user.devicePushKey
        const token = await user.generateAuthToken()
        await user.save()

        let staticUrl = {
            profilePicturePath
        }
        let totalAddtoCart = await UserAddToCart.count({ "buyerId": user.id, "isRemoved": false })
        return res.status(httpStatus.OK).json({ success: true, message: 'Logged in successfully', data: { user, token, staticUrl, totalCart: totalAddtoCart } })
    } else {
        return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ success: true, message: "Your email is already registered! But verification failed.", data: { user } })
    }

})

const logout = catchAsync(async (req, res) => {
    req.user.token = ''
    await req.user.save()
    res.status(httpStatus.OK).json({ success: true, message: 'Logged out successfully' })
})

const sendVerificationEmail = catchAsync(async (req, res) => {
    const OTP = "1234"
    // await randomstring.generate({ length: 4, charset: 'numeric' })

    if (req.user) {
        await UserEmailVerification.findOneAndUpdate({ userId: req.user._id, email: req.body.email }, { verificationCode: OTP })
    } else {
        await User.findOneAndUpdate({ email: req.body.email }, { verificationCode: OTP })
    }

    let emailData = { email: req.body.email, code: OTP }
    // MailHelper.sendVerificationEmail(emailData);

    if (req.body.action == "web") {
        return res.status(httpStatus.OK).json({ success: true, message: "otp sent successfully." })
    }
    return res.status(httpStatus.NO_CONTENT).send();
})

const resendVerificationEmail = catchAsync(async (req, res) => {
    const OTP = "1234"
    // await randomstring.generate({ length: 4, charset: 'numeric' })
    let isUserExist = await User.findOne({ email: req.body.email });
    let isUserEmailVerification = await UserEmailVerification.findOne({ email: req.body.email });

    if (req.user) {
        if (!isUserEmailVerification) {
            return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "Email verification failed." })
        }
        await UserEmailVerification.findOneAndUpdate({ userId: req.user._id, email: req.body.email }, { verificationCode: OTP })
    }
    else {
        if (!isUserExist) {
            return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "Email verification failed." })
        }
        await User.findOneAndUpdate({ email: req.body.email }, { verificationCode: OTP })
    }

    let emailData = { email: req.body.email, code: OTP }
    MailHelper.sendVerificationEmail(emailData);

    if (req.body.action == "web") {
        return res.status(httpStatus.OK).json({ success: true, message: "otp sent successfully." })
    }
    return res.status(httpStatus.NO_CONTENT).send();
})

const verifyOTP = catchAsync(async (req, res) => {
    let userData = null

    if (req.user) {
        let userEmailVerification = await UserEmailVerification.findOne({ userId: req.user._id, email: req.body.email, verificationCode: req.body.otp })

        if (!userEmailVerification) {
            return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "Email verification failed." })
        }

        let updateUser = await User.findOne({ _id: req.user._id })
        let isEmailExisted = await User.findOne({ email: req.body.email })

        if (!updateUser || isEmailExisted) {
            let existedUser = !updateUser ? 'user does not exist. ' : ''
            let existedEmail = isEmailExisted ? 'email is already registered with another user. ' : ' '
            return res.status(httpStatus.NOT_FOUND).json({ success: false, message: `Email verification failed. ${existedUser} ${existedEmail}` })
        }

        userEmailVerification.verificationCode = ""
        userEmailVerification.isVerified = 1
        updateUser.email = req.body.email

        await userEmailVerification.save()
        userData = await updateUser.save()

    } else {
        let user = await User.findOne({ email: req.body.email, verificationCode: req.body.otp })
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "Email verification failed." })
        }
        let email = req.body.email
        user.username = email.split("@")[0]
        user.verificationCode = ""
        user.isVerified = 1
        userData = await user.save()
    }

    return res.status(httpStatus.OK).json({ success: true, message: 'User verification successful', data: { user: userData } })
})

const resetPassword = catchAsync(async (req, res) => {
    let { old_password, password } = req.body;
    await User.checkOldPassword(req.user._id, old_password)
    req.user.password = password
    await req.user.save()
    res.status(httpStatus.OK).send({ success: true, message: 'Password updated successfully' })
})

/*THIS FUNCTION ARE NOT USED */
const forgotPassword = catchAsync(async (req, res) => {
    let { email, otp, password } = req.body;
    let user = await User.findOne({ email: email, verificationCode: otp })
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "Email verification failed." })
    }
    user.verificationCode = ""
    user.password = password
    await user.save()
    res.status(httpStatus.OK).send({ success: true, message: 'Password updated successfully' })
})

const createForgotPasswordLink = catchAsync(async (req, res) => {
    let user = await User.findOne({ email: req.body.email })
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "Email not found." })
    }
    if (user.signupWith !== "local") {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "You were logged in with social media login, you can't reset your password." })
    }
    const OTP = randomstring.generate({ length: 4, charset: 'numeric' })

    let base64Email = base64.encode(req.body.email)
    let base64Otp = base64.encode(OTP)
    let forgotPasswordLink = req.protocol + '://' + req.get('host') + `/admin/reset-password/${base64Email}-${base64Otp}`;
    user.resetPasswordOtp = OTP
    await user.save()

    let emailData = { email: req.body.email, link: forgotPasswordLink }
    MailHelper.sendForgotPasswordLink(emailData)

    res.status(httpStatus.CREATED).send({ success: true, message: 'Password reset link has been sent successfully to your registered email address.' })
})

const socialLogin = catchAsync(async (req, res, next) => {
    if (!req.body.signupWith && !req.body.socialId) {
        return res.status(httpStatus.OK).json({ result: false, message: 'Required field is missing.', details: "Please provide signupWith & socialId" })
    }

    const profilePicturePath = req.protocol + '://' + req.get('host') + '/uploads/profile-picture/';
    let findCond = {};

    if (req.body.signupWith == "facebook") {
        findCond.facebook_id = req.body.socialId
    }

    if (req.body.signupWith == "apple") {
        findCond.apple_id = req.body.socialId
    }

    let user = await User.findOne(findCond);

    if (user) {
        let token = await user.generateAuthToken();
        user.signupWith = req.body.signupWith
        user.deviceType = req.body.deviceType !== '' ? req.body.deviceType : user.deviceType
        user.devicePushKey = req.body.devicePushKey !== '' ? req.body.devicePushKey : user.devicePushKey
        userDetails = await user.save();

        let staticUrl = {
            profilePicturePath
        }

        let totalAddtoCart = await UserAddToCart.count({ "buyerId": user.id, "isRemoved": false })

        return res.status(httpStatus.OK).json({
            success: true,
            message: 'You have logged in successfully.',
            data: { user: userDetails, token, staticUrl, totalCart: totalAddtoCart }
        });

    } else {
        return res.status(httpStatus.OK).json({ result: false, message: 'Social ID Not Found!' })
    }
})

module.exports = {
    register,
    sendVerificationEmail,
    resendVerificationEmail,
    verifyOTP,
    login,
    logout,
    socialLogin,
    resetPassword,
    forgotPassword,
    createForgotPasswordLink
};
