const SERVER_ERROR = {
   status: 500,
   message: 'Server Error :('
}

module.exports = (req, res) => {
   req.error.errors &&
      res.status(400).json({ message: "Validation error", errors: req.error.errors });

   const status = req.error.status || SERVER_ERROR.status;
   const message = req.error.message || SERVER_ERROR.message;

   req.error.errors &&
      res.status(status).json(errors);

   res.status(status).json(message);
}