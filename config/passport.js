const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');

//Load User Model
// const User = require('../src/models/users.model')

module.exports = function (passport) {
    passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
        User.findOne({ email: email })
            .then(user => {
                if (!user) {
                    return done(null, false, { message: 'No user exist with this email' })
                }
                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if (err) throw err;
                    if (isMatch) {
                        const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: `${30 * 24}h` });
                        user.token = token;
                        user.save().then(user => {
                            return done(null, user)
                        }).catch(err => console.log(err))
                    } else {
                        return done(null, false, { message: 'Incorrect Password' })
                    }
                })
            })
            .catch(err => console.log(err))
    })
    );
    passport.serializeUser((user, done) => {
        done(null, user.id)
    })
    passport.deserializeUser((id, done) => {
        User.findById(id, (err, user) => {
            done(err, user)
        })
    })
}

