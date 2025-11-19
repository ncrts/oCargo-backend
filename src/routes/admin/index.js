const express = require('express')
const { ensureAuthenticated } = require('../../middleware/adminauth')

const validate = require('../../middleware/validate');
const authToken = require('../../middleware/auth')
const authValidation = require('../../validations/auth.validation');

const adminController = require('../../controllers/admin/admin.controller');

const router = express.Router();

/*
router.get('/', (req, res)=>{ res.redirect("/admin/login") });
router.get('/login', adminController.getLoginPage);
router.post('/login', adminController.login);
router.get("/logout", (req, res) => {
    req.logout();
    req.flash("errorMsg", "You are logged out");
    res.redirect("/admin/login")
});

*/

module.exports = router;