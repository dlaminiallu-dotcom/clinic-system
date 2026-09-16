import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import { patients, doctors, appointments, records, prescriptions, bills, reminders } from "./data.ts";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || "data.env" });

const app = express();
const port = Number(process.env.API_PORT || 3001);
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "clinic_system",
  waitForConnections: true,
  connectionLimit: 10,
});

const initialState = { patients, doctors, appointments, records, prescriptions, bills, reminders };
const sessions = new Set();
const usersPath = path.resolve("auth-users.json");

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersPath, "utf8"));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}

function passwordsMatch(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.hash, "hex"));
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (_request, response) => {
  response.json({ name: "Greenfield Medical Clinic API", status: "running", health: "/api/health" });
});

app.post("/api/auth/signup", (request, response) => {
  const { name, email, password } = request.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!name?.trim() || !normalizedEmail || !password || password.length < 8) {
    return response.status(400).json({ error: "Name, email, and a password of at least 8 characters are required" });
  }
  const users = loadUsers();
  if (users.some(user => user.email === normalizedEmail)) {
    return response.status(409).json({ error: "An account with this email already exists" });
  }
  const credentials = hashPassword(password);
  users.push({ name: name.trim(), email: normalizedEmail, ...credentials });
  saveUsers(users);
  response.status(201).json({ ok: true });
});

app.post("/api/auth/login", (request, response) => {
  const { email, password } = request.body;
  const user = loadUsers().find(candidate => candidate.email === String(email || "").trim().toLowerCase());
  if (!user || !passwordsMatch(password || "", user)) {
    return response.status(401).json({ error: "Invalid email or password" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  sessions.add(token);
  response.json({ token, user: { email: user.email, name: user.name } });
});

app.post("/api/auth/logout", (request, response) => {
  const token = request.headers.authorization?.replace("Bearer ", "");
  if (token) sessions.delete(token);
  response.json({ ok: true });
});

app.get("/api/health", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ ok: true, database: process.env.MYSQL_DATABASE || "clinic_system" });
  } catch (error) {
    response.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/clinic-state", async (_request, response) => {
  try {
    const [rows] = await pool.query("SELECT state FROM clinic_state WHERE state_key = 'main'");
    if (!rows.length) {
      await pool.execute("INSERT INTO clinic_state (state_key, state) VALUES ('main', ?)", [JSON.stringify(initialState)]);
      return response.json(initialState);
    }
    response.json(typeof rows[0].state === "string" ? JSON.parse(rows[0].state) : rows[0].state);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.put("/api/clinic-state", async (request, response) => {
  try {
    await pool.execute(
      "INSERT INTO clinic_state (state_key, state) VALUES ('main', ?) ON DUPLICATE KEY UPDATE state = VALUES(state)",
      [JSON.stringify(request.body)],
    );
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.listen(port, () => console.log(`Clinic API running at http://localhost:${port}`));
