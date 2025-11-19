const path = require('path');
const bodyParser = require('body-parser');
const express = require('express');
const http = require('http');
const cors = require('cors');
const expressLayouts = require('express-ejs-layouts');
const dotenv = require('dotenv');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('passport');
const errorHandler = require('./middleware/error');
const connectDB = require('../config/connection');

dotenv.config({ path: './config/config.env' });
// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);
// Passport Config
require('../config/passport')(passport);

// Define paths for Express config
const publicDirPath = path.join(__dirname, '../public');
const viewsPath = path.join(__dirname, '../templates');

const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

const options = {
  verify: rawBodySaver,
};

app.use(cors({ origin: '*' }));
app.use(bodyParser.json(options));

app.enable('trust proxy');

// EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', viewsPath);
app.set('view options', { layout: false });
// Set Public folder
app.use(express.static(publicDirPath));
app.use(express.json());

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Express Session
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true,
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Connect Flash
app.use(flash());

// Global Variable
app.use((req, res, next) => {
  res.locals.successMsg = req.flash('successMsg')
  res.locals.errorMsg = req.flash('errorMsg')
  res.locals.error = req.flash('error')
  res.locals.language = 'en_us'
  next();
});

app.locals.moment = require('moment');

// v1 use for declines apis routes
app.use('/v1', require('./routes/v1'));
app.use('/admin', require('./routes/admin'));
// app.use('/reset-password', require('./routes/admin'));
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
