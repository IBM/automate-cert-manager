const express = require("express");
const app = express();

const callbackRoute = require("./routes/callback-godaddy");

app.use(require("body-parser").json());

app.use("/callback", callbackRoute);

let port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log("To view your app, open this link in your browser: http://localhost:" + port);
});

module.exports = app;
