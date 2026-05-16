const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/api/health", (req, res) => {
  res.json({ status: "Server running" });
});

app.post("/api/login", (req, res) => {
  res.json({
    success: true,
    token: "demo-admin-token"
  });
});

module.exports = app;
module.exports.default = app;