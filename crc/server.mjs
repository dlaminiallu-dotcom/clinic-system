import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { patients, doctors, appointments, records, prescriptions, bills, reminders } from "./data.ts";
import crypto from "node:crypto";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || "data.env" });

const app = express();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
  : null;

function getSupabase() {
  if (!supabase) {
    const error = new Error("Server configuration missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    error.status = 503;
    throw error;
  }
  return supabase;
}

const initialState = { patients, doctors, appointments, records, prescriptions, bills, reminders };
const authTokenLifetimeSeconds = 8 * 60 * 60;

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}

function passwordsMatch(password, user) {
  const { hash } = hashPassword(password, user.salt);
  const actualHash = Buffer.from(hash, "hex");
  const expectedHash = Buffer.from(user.hash, "hex");
  return actualHash.length === expectedHash.length && crypto.timingSafeEqual(actualHash, expectedHash);
}

function createAuthToken(user) {
  const payload = Buffer.from(JSON.stringify({
    sub: user.email,
    role: user.role,
    ver: user.auth_version,
    exp: Math.floor(Date.now() / 1000) + authTokenLifetimeSeconds,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", supabaseServiceRoleKey).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyAuthToken(token) {
  const [payload, signature, extra] = String(token || "").split(".");
  if (!payload || !signature || extra) return null;

  const expectedSignature = crypto.createHmac("sha256", supabaseServiceRoleKey).update(payload).digest();
  let actualSignature;
  try {
    actualSignature = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actualSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(actualSignature, expectedSignature)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims.sub !== "string" || typeof claims.ver !== "string" || claims.role !== "admin" || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

async function requireAdmin(request, response, next) {
  const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const claims = verifyAuthToken(token);
  if (!claims) return response.status(401).json({ error: "Authentication required" });

  const { data: user, error } = await supabase
    .from("clinic_users")
    .select("role, auth_version")
    .eq("email", claims.sub)
    .maybeSingle();
  if (error) return response.status(500).json({ error: "Unable to verify account access" });
  if (!user || user.role !== "admin" || user.auth_version !== claims.ver) {
    return response.status(403).json({ error: "Administrator access required" });
  }

  request.user = { email: claims.sub, role: user.role };
  next();
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (_request, response) => {
  response.json({ name: "Greenfield Medical Clinic API", status: "running", health: "/api/health" });
});

app.post("/api/auth/signup", async (request, response) => {
  const { name, email, password } = request.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!name?.trim() || !normalizedEmail || !password || password.length < 8) {
    return response.status(400).json({ error: "Name, email, and a password of at least 8 characters are required" });
  }
  const { data: existingUser, error: lookupError } = await getSupabase()
    .from("clinic_users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (lookupError) return response.status(500).json({ error: lookupError.message });
  if (existingUser) {
    return response.status(409).json({ error: "An account with this email already exists" });
  }
  const credentials = hashPassword(password);
  const { error: insertError } = await getSupabase().from("clinic_users").insert({
    name: name.trim(),
    email: normalizedEmail,
    password_hash: credentials.hash,
    password_salt: credentials.salt,
    role: "pending",
  });
  if (insertError) return response.status(500).json({ error: insertError.message });
  response.status(201).json({ ok: true, pendingApproval: true });
});

app.post("/api/auth/login", async (request, response) => {
  const { email, password } = request.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const { data: user, error } = await getSupabase()
    .from("clinic_users")
    .select("email, name, password_hash, password_salt, role")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (error) return response.status(500).json({ error: error.message });
  if (!user || !passwordsMatch(password || "", { hash: user.password_hash, salt: user.password_salt })) {
    return response.status(401).json({ error: "Invalid email or password" });
  }
  if (user.role !== "admin") return response.status(403).json({ error: "Your account is awaiting administrator approval" });
  const authVersion = crypto.randomBytes(16).toString("hex");
  const { error: updateError } = await getSupabase()
    .from("clinic_users")
    .update({ auth_version: authVersion })
    .eq("email", user.email);
  if (updateError) return response.status(500).json({ error: updateError.message });
  const token = createAuthToken({ ...user, auth_version: authVersion });
  response.json({ token, user: { email: user.email, name: user.name } });
});

app.post("/api/auth/logout", requireAdmin, async (request, response) => {
  const { error } = await getSupabase()
    .from("clinic_users")
    .update({ auth_version: crypto.randomBytes(16).toString("hex") })
    .eq("email", request.user.email);
  if (error) return response.status(500).json({ error: error.message });
  response.json({ ok: true });
});

app.get("/api/health", async (_request, response) => {
  try {
    const { error } = await getSupabase().from("clinic_state").select("state_key").limit(1);
    if (error) throw error;
    response.json({ ok: true, database: "supabase" });
  } catch (error) {
    response.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

app.get("/api/clinic-state", requireAdmin, async (_request, response) => {
  try {
    const { data: row, error } = await getSupabase().from("clinic_state").select("state").eq("state_key", "main").maybeSingle();
    if (error) throw error;
    if (!row) {
      const { error: insertError } = await getSupabase().from("clinic_state").insert({ state_key: "main", state: initialState });
      if (insertError) throw insertError;
      return response.json(initialState);
    }
    response.json(row.state);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.put("/api/clinic-state", requireAdmin, async (request, response) => {
  try {
    const { error } = await getSupabase().from("clinic_state").upsert({ state_key: "main", state: request.body });
    if (error) throw error;
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.use((error, _request, response, _next) => {
  console.error("API request failed:", error.message);
  response.status(error.status || 500).json({ error: error.status === 503 ? error.message : "Internal server error" });
});

export default app;
