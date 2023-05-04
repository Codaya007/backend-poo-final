const mongoose = require("mongoose");
const {
  DB: { MONGO_URL },
} = require("./config");
const loadData = require("./helpers/loadData");

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${connection.connection.host}`);
    await loadData();
  } catch (err) {
    console.log("No ha sido posible realizar una conexión con la BBDD");
    console.log(`Error: ${err.message}`);
  }
};

module.exports = connectDB;
