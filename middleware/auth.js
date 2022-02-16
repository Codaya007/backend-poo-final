const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const User = require('../models/User');

module.exports = async (req, res, next) => {

   req.error && next();

   // get token from header
   const token = req.header('x-auth-token');

   // check if no token
   if (!token) {
      req.error = {
         status: 401,
         message: 'No token, auth denied'
      };
      return next();
   }

   try {
      const decoded = jwt.verify(token, JWT_SECRET);

      let user = await User.findById(decoded.user.id);

      if (!user) return req.error = { status: 401, message: "Invalid user" };

      // set user id in req.user
      req.user = decoded.user;
      next();

   } catch (error) {
      console.log(error);

      req.error = {
         status: 401,
         message: 'Token is invalid'
      };
      next();
   }
}