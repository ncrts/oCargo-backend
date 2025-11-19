const path = require('path');
const httpStatus = require('http-status');
const Razorpay = require('razorpay');
const catchAsync = require('../utils/catchAsync');
const unlinkFile = require('../utils/unlinkFile');

const User = require('../models/users.model');


const CommonHelper = require('../utils/commonHelper');

const getUser = catchAsync(async (req, res) => {
    const profilePicturePath = req.protocol + '://' + req.get('host') + '/uploads/profile-picture/';
    let user = await User.findOne({ _id: req.params.userId, isUserDeleted: false })
        .populate({
            "path": "memberType"
        })
    let staticUrl = {
        profilePicturePath
    }
    return res.status(httpStatus.OK).json({ success: true, message: 'User data fetched successfully', data: { user, staticUrl } })
})

const getUsers = catchAsync(async (req, res) => {
    const profilePicturePath = req.protocol + '://' + req.get('host') + '/uploads/profile-picture/';
    let findCond = {
        isUserDeleted: false
    }
    if (req.params.role) {
        findCond.role = req.params.role
    }
    if (req.params.firstname) {
        findCond.firstname = { '$regex': req.params.firstname, '$options': 'i' }
    }
    if (req.params.email) {
        findCond.email = { '$regex': req.params.email, '$options': 'i' }
    }
    if (req.params.phoneno) {
        findCond.phoneno = req.params.phoneno
    }
    if (req.params.isUserActive) {
        findCond.isUserActive = req.params.isUserActive
    }
    if (req.params.isMember) {
        findCond.isMember = req.params.isMember
    }

    let users = await User.find(findCond)
        .populate({
            "path": "memberType"
        })

    let staticUrl = {
        profilePicturePath
    }
    return res.status(httpStatus.OK).json({ success: true, message: 'User data fetched successfully', data: { users, staticUrl } })
})

const createUser = catchAsync(async (req, res) => {
    let isUserExist = await User.findOne({ email: req.body.email });
    if (isUserExist) {
        return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ success: false, message: "Your email is already registered" })
    } else {
        let newUserObj = null;
        newUserObj = {
            email: req.body.email,
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            phonenoPrefix: req.body.phonenoPrefix,
            phoneno: req.body.phoneno,
            signupWith: 'local',
            role: req.body.role,
            password: req.body.password,
            username: req.body.email.split("@")[0],
            verificationCode: "",
            isVerified: 1
        }
        let user = new User(newUserObj);
        await user.save();
        res.status(httpStatus.CREATED).json({ success: true, message: 'user created successfully', data: { user } })
    }
})

const updateUser = catchAsync(async (req, res) => {
    const profilePicturePath = req.protocol + '://' + req.get('host') + '/uploads/profile-picture/';

    let user = await User.findOne({ _id: req.params.userId })

    if (req.body.email) {
        let isEmailExisted = await User.findOne({ email: req.body.email })
        if (isEmailExisted) {
            return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ success: false, message: "This email already registered with another user." })
        }

        let userEmailVerification = await UserEmailVerification.findOne({ userId: req.params.userId, email: req.body.email })

        if (!userEmailVerification) {
            let newUserEmailVerification = new UserEmailVerification({
                userId: req.params.userId,
                email: req.body.email
            })
            // console.log("OK", newUserEmailVerification)
            await newUserEmailVerification.save()
        }
        return res.status(httpStatus.OK).json({ success: true, message: 'user email started processing for verification' })
    }

    if (req.body.isUserActive) {
        user.isUserActive = req.body.isUserActive;
        await user.save()
        return res.status(httpStatus.OK).json({ success: true, message: 'user status changed successfully' })
    }

    user.assignedDesigner = req.body.assignedDesigner ? req.body.assignedDesigner : user.assignedDesigner
    user.phonenoPrefix = req.body.phonenoPrefix ? req.body.phonenoPrefix : user.phonenoPrefix
    user.phoneno = req.body.phoneno ? req.body.phoneno : user.phoneno
    user.firstname = req.body.firstname ? req.body.firstname : user.firstname
    user.lastname = req.body.lastname ? req.body.lastname : user.lastname
    user.gender = req.body.gender ? req.body.gender : user.gender
    user.dob = req.body.dob ? new Date(req.body.dob) : user.dob

    let userUpate = await user.save();
    let staticUrl = {
        profilePicturePath
    }
    return res.status(httpStatus.OK).json({ success: true, message: 'user data updated successfully', data: { user: userUpate, staticUrl } })
})

const deleteUser = catchAsync(async (req, res) => {
    let user = await User.findOne({ _id: req.params.userId })
    if (!user) {
        return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ success: false, message: "user not found!" })
    }
    user.isUserDeleted = true;
    user.token = "";
    await user.save();
    return res.status(httpStatus.OK).json({ success: true, message: 'user deleted successfully' })
})

const getProfilePicture = catchAsync(async (req, res) => {
    const user = await User.findOne({ _id: req.params.userId });
    const path = user.profilePicture ? req.protocol + '://' + req.get('host') + '/uploads/profile-picture/' + user.profilePicture : null;
    return res.status(httpStatus.OK).json({ success: true, message: 'profile picture fetched successfully', data: { path } })
});

const updateProfilePicture = catchAsync(async (req, res) => {

    let updateObj = {}
    if (!req.body.userId) {
        return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ success: false, message: "userId required." })
    }

    if (req.body.profilePictureType != "avatar" && req.body.profilePictureType != "custom") {
        return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ success: false, message: "Please check picture type. Only (png, jpg, heif, heic) allowed." })
    }

    if (req.body.profilePictureType == "avatar" && req.body.userAvatarId) {
        let userAvatar = await UserAvatar.findOne({ _id: req.body.userAvatarId })
        updateObj = {
            profilePictureType: req.body.profilePictureType,
            profilePicture: userAvatar.avatarPicture
        }
    }

    if (req.body.profilePictureType == "custom") {
        updateObj = {
            profilePictureType: req.body.profilePictureType,
            profilePicture: req.file ? req.file.filename : null
        }
    }

    if (updateObj.profilePicture) {
        await User.findOneAndUpdate({ _id: req.body.userId }, updateObj)
        let profilePicture = req.protocol + '://' + req.get('host') + '/uploads/profile-picture/' + updateObj.profilePicture
        return res.status(httpStatus.OK).json({ success: true, message: 'profile picture updated successfully', data: { profilePicture } })
    } else {
        return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ success: false, message: "please check required fields. Only (png, jpg, heif, heic) allowed." })
    }

});

const deleteProfilePicture = catchAsync(async (req, res) => {
    const user = await User.findOne({ _id: req.params.userId })
    const unLinkpath = `/profile-picture/${user.profilePicture}`
    if (user.profilePictureType == "custom") {
        unlinkFile(unLinkpath)
    }
    await User.findOneAndUpdate({ _id: req.params.userId }, { profilePicture: null })
    return res.status(httpStatus.OK).json({ success: true, message: 'profile picture removed successfully' })
});

const getUserAddressBook = catchAsync(async (req, res) => {
    let findCond = { userId: req.user._id, isDeleted: false }
    if (req.query.addressBookId) {
        findCond._id = req.query.addressBookId
    }
    const userAddressBook = await UserAddressBook.find(findCond).sort({ "createdAt": -1 })
    return res.status(httpStatus.OK).json({ success: true, message: 'address book fetched successfully', data: { userAddressBook } })
})

const createUserAddressBook = catchAsync(async (req, res) => {
    let newAddressBook = new UserAddressBook({
        userId: req.body.userId,
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        companyname: req.body.companyname,
        address: req.body.address,
        suity: req.body.suity,
        city: req.body.city,
        state: req.body.state,
        country: req.body.country,
        zipCode: req.body.zipCode,
        phonenoPrefix: req.body.phonenoPrefix,
        phoneno: req.body.phoneno
    })
    await UserAddressBook.updateMany({ "userId": req.body.userId }, { "$set": { "isActive": false } }, { "multi": true }, (err, writeResult) => { });
    await newAddressBook.save()
    return res.status(httpStatus.CREATED).json({ success: true, message: 'address book created successfully', data: { userAddressBook: newAddressBook } })
})

const updateDefaultUserAddressBook = catchAsync(async (req, res) => {
    await UserAddressBook.updateMany({ "userId": req.user._id }, { "$set": { "isActive": false } }, { "multi": true }, (err, writeResult) => { });
    await UserAddressBook.findOneAndUpdate({ _id: req.params.addressBookId }, { isActive: true });
    return res.status(httpStatus.OK).json({ success: true, message: 'address book default address updated successfully' })
})

const updateUserAddressBook = catchAsync(async (req, res) => {
    let userAddressBook = await UserAddressBook.findOne({ _id: req.params.addressBookId })

    userAddressBook.userId = req.body.userId ? req.body.userId : userAddressBook.userId
    userAddressBook.firstname = req.body.firstname ? req.body.firstname : userAddressBook.userId
    userAddressBook.lastname = req.body.lastname ? req.body.lastname : userAddressBook.userId
    userAddressBook.companyname = req.body.companyname ? req.body.companyname : userAddressBook.companyname
    userAddressBook.address = req.body.address ? req.body.address : userAddressBook.address
    userAddressBook.suity = req.body.suity ? req.body.suity : userAddressBook.suity
    userAddressBook.city = req.body.city ? req.body.city : userAddressBook.city
    userAddressBook.state = req.body.state ? req.body.state : userAddressBook.state
    userAddressBook.country = req.body.country ? req.body.country : userAddressBook.country
    userAddressBook.zipCode = req.body.zipCode ? req.body.zipCode : userAddressBook.zipCode
    userAddressBook.phonenoPrefix = req.body.phonenoPrefix ? req.body.phonenoPrefix : userAddressBook.phonenoPrefix
    userAddressBook.phoneno = req.body.phoneno ? req.body.phoneno : userAddressBook.phoneno

    await userAddressBook.save()
    return res.status(httpStatus.OK).json({ success: true, message: 'address book updated successfully' })
})

const deleteUserAddressBook = catchAsync(async (req, res) => {
    await UserAddressBook.findOneAndUpdate({ _id: req.params.addressBookId, isDeleted: false }, { isDeleted: true })
    return res.status(httpStatus.OK).json({ success: true, message: 'address book deleted successfully' })
})

const getCard = catchAsync(async (req, res) => {

})

const createCard = catchAsync(async (req, res) => {

})

const updateCard = catchAsync(async (req, res) => {

})

const createOrder = catchAsync(async (req, res) => {
    let currency = { currency: "₹" }
    const userId = req.user._id;
    let orderDisplayId = await CommonHelper.orderDisplayIdGenerator();

    let orderObj = new UserOrder()

    let shippingAddress = await UserAddressBook.findOne({ _id: req.body.userAddressBookId, userId: userId });
    let shippingMethod = await ShippingMethod.findOne({ _id: req.body.shippingMethodId });
    let couponCode = await CouponCode.findOne({ _id: req.body.couponCodeId })

    orderObj.orderDisplayId = orderDisplayId
    orderObj.shippingAddress = shippingAddress
    orderObj.billingAddress = shippingAddress
    orderObj.shippingMethod = shippingMethod
    orderObj.buyerId = userId

    if (couponCode) {
        orderObj.copuonCode = couponCode
    }

    let findCond = { "buyerId": userId, "isRemoved": false }

    let userAddToCart = await UserAddToCart.find(findCond)
        .populate({
            "path": "productId",
            "populate": [
                {
                    "path": "designerId",
                    "select": { "name": 1, "banner": 1 }
                },
                {
                    "path": "cataloguesIds",
                    "populate": {
                        "path": 'id',
                        "select": { "name": 1 }
                    }
                },
                {
                    "path": "categoriesIds",
                    "populate": {
                        "path": 'id',
                        "select": { "parentId": 1, "name": 1 }
                    }
                },
                {
                    "path": "deliveryAndReturns",
                    "select": { "slug": 1, "contentType": 1, "pageTitle": 1, "returnDays": 1 }
                }
            ],
            "select": {
                "title": 1,
                "designerId": 1,
                "cataloguesIds": 1,
                "categoriesIds": 1,
                "image": 1,
                "options": 1,
                "sellPercent": 1,
                "isMemberSpecialProduct": 1,
                "rating": 1,
                "ratingCount": 1
            }
        })
        .populate({
            "path": "membershipId",
        });

    if (!userAddToCart) {
        return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ success: false, message: "cart is empty!" })
    }

    if (userAddToCart[0].cartType == "membership") {
        let userOrderItems = []
        let deliveryDate = new Date();
        let shippingDate = new Date();

        deliveryDate.setHours(0, 0, 0, 0)
        shippingDate.setHours(0, 0, 0, 0)

        shippingDate.setDate(shippingDate.getDate() + 1)
        deliveryDate.setDate(deliveryDate.getDate() + 1)

        let subTotal = 0;
        let discountAmount = 0;

        userAddToCart.forEach(item => {
            let itemObj = {
                buyerId: userId,
                orderType: "membership",
                designerId: null,
                orderDisplayId: orderDisplayId,
                orderId: orderObj.id,
                productId: null,
                membershipId: item.membershipId.id,
                productVarientId: null,
                productVarient: null,
                shippingMethodObj: shippingMethod,
                qty: item.qty,
                unitPrice: item.membershipId.amount,
                subTotalPrice: item.membershipId.amount * item.qty,
                tax: 0,
                subTotalTax: 0,
                productTotalPrice: (item.membershipId.amount * item.qty) - 0,
                deliveryDate: deliveryDate,
                shippingDate: shippingDate
            }

            subTotal = subTotal + itemObj.productTotalPrice
            userOrderItems.push(itemObj)
        });

        // if (couponCode) {
        //     if (couponCode.amount) {
        //         discountAmount = 0;
        //         if (couponCode.couponType == 2) {
        //             const discountPercent = parseInt(couponCode.discount)
        //             discountAmount = parseInt(subTotal) * (discountPercent / 100);
        //         }
        //         if (couponCode.couponType == 1) {
        //             discountAmount = parseInt(couponCode.discount)
        //         }
        //         discountAmount = parseInt(discountAmount.toFixed(2))
        //     }
        // }
        // paymentInitiated


        let userOrderItemsIds = await UserOrderItems.insertMany(userOrderItems);

        let orderItemsIds = [];
        userOrderItemsIds.forEach(item => {
            orderItemsIds.push(item.id)
        })

        orderObj.orderType = "membership"
        orderObj.subTotalPrice = subTotal
        orderObj.shippingCharges = shippingMethod.price
        orderObj.discount = discountAmount
        orderObj.tax = 0
        orderObj.grandTotal = (subTotal - discountAmount) + shippingMethod.price + orderObj.tax
        orderObj.orderItems = orderItemsIds
        orderObj.paymentStatus = "pending"

        let instance = new Razorpay({ key_id: process.env.RAZORPAY_KRY, key_secret: process.env.RAZORPAY_SECRET_KRY })
        let options = {
            amount: orderObj.grandTotal * 100,
            currency: "INR",
            receipt: orderObj.id
        };

        instance.orders.create(options, async function (err, order) {
            if (err) {
                return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ success: false, message: err })
            }
            const logo = req.protocol + '://' + req.get('host') + '/assets/images/logo-dark.png';
            let paymentInstance = { RAZORPAY_KRY: process.env.RAZORPAY_KRY, logo, ...order }
            orderObj.paymentInitiated = paymentInstance.id
            let orderData = await orderObj.save()
            return res.status(httpStatus.CREATED).json({ success: true, message: "Order created successfully", data: { orderData, orderItemsData: userOrderItemsIds, paymentInstance, currency } })
        });
    }

    if (userAddToCart[0].cartType == "product") {
        let userOrderItems = [];
        let deliveryDate = new Date();
        let shippingDate = new Date();

        deliveryDate.setHours(0, 0, 0, 0)
        shippingDate.setHours(0, 0, 0, 0)

        shippingDate.setDate(shippingDate.getDate() + 1)
        deliveryDate.setDate(shippingDate.getDate() + 4)

        let subTotal = 0;
        let discountAmount = 0;
        let retuenableTillDate = new Date()
        retuenableTillDate.setHours(0, 0, 0, 0)

        userAddToCart.forEach(item => {
            let tax = 0;

            let itemObj = {
                buyerId: userId,
                orderType: "product",
                designerId: item.productId.designerId.id,
                orderDisplayId: orderDisplayId,
                orderId: orderObj.id,
                productId: item.productId.id,
                productVarientId: item.productVarientId,
                productVarient: item.productVarient,
                shippingMethodObj: shippingMethod,
                qty: item.qty,
                unitPrice: item.productVarient.sellingPrice,
                subTotalPrice: item.productVarient.sellingPrice * item.qty,
                tax: 0,
                subTotalTax: 0,
                productTotalPrice: (item.productVarient.sellingPrice * item.qty) - tax,
                deliveryDate: deliveryDate,
                shippingDate: shippingDate
            }

            if (item.productId.deliveryAndReturns) {
                itemObj.isReturnable = true;
                itemObj.retuenableTill = retuenableTillDate.setDate(retuenableTillDate.getDate() + item.productId.deliveryAndReturns.returnDays)
            }

            subTotal = subTotal + itemObj.productTotalPrice
            userOrderItems.push(itemObj)
        });

        if (couponCode) {
            if (couponCode.amount) {
                discountAmount = 0;
                if (couponCode.couponType == 2) {
                    const discountPercent = couponCode.discount
                    discountAmount = subTotal * (discountPercent / 100);
                }
                if (couponCode.couponType == 1) {
                    discountAmount = couponCode.discount
                }
                discountAmount = discountAmount
            }
        }

        let userOrderItemsIds = await UserOrderItems.insertMany(userOrderItems);

        let orderItemsIds = [];
        userOrderItemsIds.forEach(item => {
            orderItemsIds.push(item.id)
        })

        orderObj.subTotalPrice = subTotal
        orderObj.shippingCharges = shippingMethod.price
        orderObj.discount = discountAmount
        orderObj.tax = 0
        orderObj.grandTotal = (subTotal - discountAmount) + (shippingMethod.price + orderObj.tax)
        orderObj.orderType = "product"
        orderObj.orderItems = orderItemsIds
        orderObj.paymentStatus = "pending"

        let instance = new Razorpay({ key_id: process.env.RAZORPAY_KRY, key_secret: process.env.RAZORPAY_SECRET_KRY })
        let options = {
            amount: orderObj.grandTotal * 100,
            currency: "INR",
            receipt: orderObj.id
        };

        instance.orders.create(options, async function (err, order) {
            if (err) {
                return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ success: false, message: err })
            }
            const logo = req.protocol + '://' + req.get('host') + '/assets/images/logo-dark.png';
            let paymentInstance = { RAZORPAY_KRY: process.env.RAZORPAY_KRY, logo, ...order }
            orderObj.paymentInitiated = paymentInstance.id
            let orderData = await orderObj.save()
            return res.status(httpStatus.CREATED).json({ success: true, message: "Order created successfully", data: { orderData, orderItemsData: userOrderItemsIds, paymentInstance, currency } })
        });
    }
})

const productPaymentCapture = catchAsync(async (req, res) => {
    res.status(200).send({ "status": "ok" });
    const crypto = require('crypto')
    const secret_key = '12345678'
    const data = crypto.createHmac('sha256', secret_key)
    data.update(JSON.stringify(req.body))
    const digest = data.digest('hex')

    if (digest === req.headers['x-razorpay-signature']) {
        let userOrderId = req.body.payload?.payment?.entity?.notes?.userOrderId
        let orderData = await UserOrder.findOne({ _id: userOrderId }).populate({ path:"orderItems"})
        if (orderData.orderType == "product") {
            orderData.transactionObject = req.body;
            orderData.transactionId = req.body.payload?.payment?.entity?.id
            orderData.paymentStatus = "complete"
            orderData.orderStatus = "confirm"

            await UserAddToCart.deleteMany({ "buyerId": orderData.buyerId });
            await UserOrderItems.updateMany({ "orderId": userOrderId }, { "$set": { "orderStatus": "confirm" } }, { "multi": true }, (err, writeResult) => { });
            await orderData.save();
            return true
        }

        if (orderData.orderType == "membership") {
            let userData = await User.findOne({ _id: orderData.buyerId })
            userData.isMember = true
            userData.memberType = orderData.orderItems[0]?.membershipId
            userData.memberCreatedAt = new Date()
            await userData.save()
            
            orderData.transactionObject = req.body;
            orderData.transactionId = req.body.payload?.payment?.entity?.id
            orderData.paymentStatus = "complete"
            orderData.orderStatus = "complete"

            await UserAddToCart.deleteMany({ "buyerId": orderData.buyerId });
            await UserOrderItems.updateMany({ "orderId": userOrderId }, { "$set": { "orderStatus": "complete" } }, { "multi": true }, (err, writeResult) => { });
            await orderData.save();
            return true
        }

    } else {
        res.status(400).send('Invalid signature');
    }
})

const getOrder = catchAsync(async (req, res) => {
    let currency = { currency: "₹" }
    let userId = req.user._id;
    let filter = { _id: req.query.orderId, "buyerId": userId, "orderStatus": { $in: ["confirm", "shipping", "complete", "cancel"] }, "paymentStatus": { $in: ["complete"] } }
    let userOrder = await UserOrder.findOne(filter).populate({
        "path": "orderItems",
        "populate": [
            {
                "path": "membershipId",
            },
            {
                "path": "productRating",
                "select": { "productId": 1, "userId": 1, "title": 1, "content": 1, "rating": 1 }
            },
            {
                "path": "productId",
                "populate": [
                    {
                        "path": "designerId",
                        "select": { "name": 1, "banner": 1 }
                    },
                    {
                        "path": "cataloguesIds",
                        "populate": {
                            "path": 'id',
                            "select": { "name": 1 }
                        }
                    },
                    {
                        "path": "categoriesIds",
                        "populate": {
                            "path": 'id',
                            "select": { "parentId": 1, "name": 1 }
                        }
                    }
                ],
                "select": {
                    "title": 1,
                    "designerId": 1,
                    "cataloguesIds": 1,
                    "categoriesIds": 1,
                    "image": 1,
                    "options": 1,
                    "sellPercent": 1,
                    "isMemberSpecialProduct": 1,
                    "rating": 1,
                    "ratingCount": 1
                }
            }
        ]
    }).sort({ "createdAt": -1 })

    return res.status(httpStatus.OK).json({ success: true, message: `order details fetched successfully`, data: { orderData: userOrder, currency } })
})

const getOrderItms = catchAsync(async (req, res) => {
    let skip = 0,
        limit = 20;

    let currency = { currency: "₹" }
    let userId = req.user._id;
    let filter = { "buyerId": userId, "orderStatus": { $in: ["confirm", "shipping", "complete", "cancel", "return initiated", "returned"] } }

    if (req.query.page && req.query.page > 0) {
        var page = req.query.page
        skip = parseInt(page - 1) * limit
    }

    let userOrderItems = await UserOrderItems.find(filter)
        .populate({
            "path": "membershipId"
        })
        .populate({
            "path": "designerId",
            "select": { "name": 1, "banner": 1 }
        })
        .populate({
            "path": "productRating",
            "select": { "productId": 1, "userId": 1, "title": 1, "content": 1, "rating": 1 }
        }).populate({
            "path": "productId",
            "populate": [
                {
                    "path": "designerId",
                    "select": { "name": 1, "banner": 1 }
                },
                {
                    "path": "cataloguesIds",
                    "populate": {
                        "path": 'id',
                        "select": { "name": 1 }
                    }
                },
                {
                    "path": "categoriesIds",
                    "populate": {
                        "path": 'id',
                        "select": { "parentId": 1, "name": 1 }
                    }
                }
            ],
            "select": {
                "title": 1,
                "designerId": 1,
                "cataloguesIds": 1,
                "categoriesIds": 1,
                "image": 1,
                "options": 1,
                "sellPercent": 1,
                "isMemberSpecialProduct": 1,
                "rating": 1,
                "ratingCount": 1
            }
        }).limit(limit).skip(skip).sort({ "createdAt": -1 })

    return res.status(httpStatus.OK).json({ success: true, message: `order items fetched successfully`, data: { orderItms: userOrderItems, currency } })
})

const updateOrderItems = catchAsync(async (req, res) => {

    if (req.body.action == "update-user-order-status") {
        let userOrder = await UserOrder.findOne({ _id: req.body.id })
        userOrder.orderStatus = req.body.orderStatus;
        await userOrder.save()
        return res.status(httpStatus.OK).json({ success: true, message: `Order status updated successfully!` })
    }

    let userOrderItems = await UserOrderItems.findOne({ _id: req.body.id })

    if (req.body.action == "update-order-status") {
        userOrderItems.orderStatus = req.body.orderStatus;

        if (req.body.orderStatus == "returned") {
            userOrderItems.returnStatus = "complete"
            userOrderItems.returnCompletion = new Date()
        }

        if (req.body.orderStatus == "complete") {
            userOrderItems.deliveryDate = new Date()
        }

        if (req.body.trackingLink) {
            userOrderItems.trackingLink = req.body.trackingLink
        }
    }

    if (req.body.action == "update-return-status") {
        if (req.body.returnStatus == "initiated") {

            let returnInitiated = new Date();
            let returnCompletion = new Date();

            returnCompletion.setHours(0, 0, 0, 0)
            returnCompletion.setDate(returnCompletion.getDate() + 5)

            userOrderItems.orderStatus = "return initiated"
            userOrderItems.returnStatus = req.body.returnStatus
            userOrderItems.returnInitiated = returnInitiated
            userOrderItems.returnCompletion = returnCompletion

        } else {
            userOrderItems.returnStatus = req.body.returnStatus
        }
    }

    if (req.body.action == "update-tracking-link") {
        userOrderItems.trackingLink = req.body.trackingLink !== "null" ? req.body.trackingLink : ""
    }

    await userOrderItems.save()
    return res.status(httpStatus.OK).json({ success: true, message: `order items updated successfully!` })
})
const getMembership = catchAsync(async (req, res) => {
    let currency = { currency: "₹" }
    let findCond = { isActive: true, isDeleted: false }
    let membership = await Membership.findOne(findCond)
    return res.status(httpStatus.OK).json({ success: true, message: `membership fetched successfully`, data: { membership, currency } })
})

const createMembership = catchAsync(async (req, res) => {
    let membership = {}

    membership.name = req.body.name
    membership.description = req.body.description
    membership.banner = req.body.banner
    membership.type = req.body.type
    membership.amount = req.body.amount
    membership.createdBy = req.user._id

    let newMembership = new Membership(membership)
    await newMembership.save()

    return res.status(httpStatus.CREATED).json({ success: true, message: `membership created successfully` })
})

const updateMembership = catchAsync(async (req, res) => {

})

const getSearchHistory = catchAsync(async (req, res) => {
    let userSearchHistory = await UserSearchHistory.findOne({ userId: req.user.id, isDeleted: false, isActive: true })
    return res.status(httpStatus.OK).json({ success: true, message: `search history fetched successfully`, data: { searchHistory: userSearchHistory } })
})

const removedSearchHistory = catchAsync(async (req, res) => {
    if (!req.body.searchTerm) {
        return res.status(httpStatus.NON_AUTHORITATIVE_INFORMATION).json({ success: false, message: "searchTerm required." })
    }

    await UserSearchHistory.findOneAndUpdate(
        { userId: req.user.id, isDeleted: false, isActive: true },
        { $pull: { searchData: req.body.searchTerm } }
    )
    return res.status(httpStatus.OK).json({ success: true, message: `search history data removed successfully` })
})

module.exports = {
    getUser,
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    getProfilePicture,
    updateProfilePicture,
    deleteProfilePicture,
    getUserAddressBook,
    createUserAddressBook,
    updateUserAddressBook,
    updateDefaultUserAddressBook,
    deleteUserAddressBook,
    createOrder,
    getOrder,
    getOrderItms,
    updateOrderItems,
    getMembership,
    createMembership,
    updateMembership,
    productPaymentCapture,
    getSearchHistory,
    removedSearchHistory
}