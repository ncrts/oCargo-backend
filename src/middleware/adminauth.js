exports.ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    if (req.hasOwnProperty('user')) {
      if (req.user.role === "admin") {
        return next();
      }
    }
  }
  req.flash('errorMsg', 'Incorrect login credentials');
  res.redirect('/admin/login');
};

/*
exports.ensureVendorAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    if (req.hasOwnProperty('user')) {
      if (req.user.role === "user") {
        return next();
      }
    }
  }
  req.flash('errorMsg', 'Please login to view this resource');
  res.redirect('/user/login');
};
*/