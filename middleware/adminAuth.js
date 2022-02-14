const User = require('../models/User');

module.exports = async (req, res, next) => {

   req.error && next();

   try {
      const user = await User.findOne({
         _id: req.user.id
      });

      if (user.role === 0) {
         req.error = {
            status: 403,
            message: 'Admin resources access denied'
         }
         return next();
      }
      next();

   } catch (error) {
      console.log(error);

      req.error = {};
      next();
   }
}