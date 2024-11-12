const mongoose = require("mongoose");

const notificationSchema = mongoose.Schema({
  // lead: {
  //   type: mongoose.Types.ObjectId,
  //   required: [true, "lead is a required field"],
  // },
  // leadtype: {
  //   type: String,
  //   required: [true, "leadtype is a required field"],
  // },
  author: {
    type: mongoose.Types.ObjectId,
    ref: "Admin",
    required: [true, "author is a required field"],
  },
  message: {
    type: String,
    required: [true, "message is a required field"],
  },
  seen:{
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    expires: "1d",
    default: Date.now,
  },
});

const notificationModel = mongoose.model("Notification", notificationSchema);

module.exports = notificationModel;
