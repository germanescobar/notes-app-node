const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const schema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    required: [true, "is required"],
    match: [/^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/, "invalid email"],
    validate: {
      validator(v) {
        return mongoose.model("User").findOne({ email: v }).then(u => !u);
      },
      message: "is already taken"
    }
  },
  password: {
    type: String,
    required: [true, "is required"]
  }
});

schema.pre("save", function(next) {
  bcrypt.hash(this.password, 10, (err, hash) => {
    if (err) {
      return next(err);
    }
    this.password = hash;
    next();
  });
});

schema.statics.authenticate = async (email, password) => {
  const user = await mongoose.model("User").findOne({ email: email });
  if (user) {
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, (err, result) => {
        if (err) reject(err);
        resolve(result === true ? user : null);
      });
    });
    return user;
  }

  return null;
}

module.exports = mongoose.model("User", schema);
