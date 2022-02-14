const SERVER_ERROR = {
   status: 500,
   message: 'Server Error :('
}

module.exports = (req, res, next) => {
   const status = req.error.status || SERVER_ERROR.status;
   const message = req.error.message || SERVER_ERROR.message;

   req.error.errors &&
      res.status(status).json(errors);

   res.status(status).json(message);
}