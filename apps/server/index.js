require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("connected:", socket.id);
  socket.on("disconnect", () => console.log("disconnected:", socket.id));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running on :${PORT}`));
app.get('/', (_, res) => res.send('MixMatch server is up'));
