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
const localSigningSecret = process.env.LOCAL_AUTH_SECRET || "clinic-local-dev-secret";
const authTokenLifetimeSeconds = 8 * 60 * 60;
let useLocalFallback = false;
let localState = JSON.parse(JSON.stringify(initialState));
const localUsers = new Map();

function getSigningSecret() {
  return supabaseServiceRoleKey || localSigningSecret;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getLocalUser(email) {
  const normalizedEmail = normalizeEmail(email);
  return normalizedEmail ? localUsers.get(normalizedEmail) || null : null;
}

function upsertLocalUser(user) {
  if (!user?.email) return null;
  const normalizedEmail = normalizeEmail(user.email);
  const existingUser = localUsers.get(normalizedEmail) || {};
  const mergedUser = { ...existingUser, ...user, email: normalizedEmail };
  localUsers.set(normalizedEmail, mergedUser);
  return mergedUser;
}

function isNetworkFailure(error) {
  const message = String(error?.message || "");
  return /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|network/i.test(message);
}

function canUseLocalFallback() {
  return process.env.NODE_ENV !== "production";
}

function normalizeDoctorName(name) {
  return String(name || "").trim().replace(/^dr\.?\s*/i, "").toLowerCase().replace(/\s+/g, " ");
}

function doctorProfileForUser(state, user) {
  return (state?.doctors || []).find(doctor => normalizeEmail(doctor.email) === normalizeEmail(user.email))
    || (state?.doctors || []).find(doctor => normalizeDoctorName(doctor.name) === normalizeDoctorName(user.name));
}

function isOwnedByDoctor(record, user) {
  return normalizeDoctorName(record?.doctor) === normalizeDoctorName(user.doctorName || user.name);
}

function doctorProfileForAccount(state, user) {
  const currentDoctors = state.doctors || [];
  if (currentDoctors.some(doctor => normalizeDoctorName(doctor.name) === normalizeDoctorName(user.name) || normalizeEmail(doctor.email) === normalizeEmail(user.email))) {
    return state;
  }
  const displayName = /^dr\.?\s/i.test(user.name) ? user.name : `Dr. ${user.name}`;
  return {
    ...state,
    doctors: [...currentDoctors, {
      id: `D-${crypto.randomUUID().slice(0, 8)}`,
      name: displayName,
      specialty: "General Practice",
      phone: "",
      email: user.email,
      availability: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      status: "On Duty",
    }],
  };
}

function assignedPatientIds(state, user) {
  return new Set([
    ...(state.patients || []).filter(patient => normalizeDoctorName(patient.assignedDoctor) === normalizeDoctorName(user.doctorName || user.name)).map(patient => patient.id),
    ...(state.appointments || []).filter(appointment => isOwnedByDoctor(appointment, user)).map(appointment => appointment.patientId),
    ...(state.records || []).filter(record => isOwnedByDoctor(record, user)).map(record => record.patientId),
    ...(state.prescriptions || []).filter(prescription => isOwnedByDoctor(prescription, user)).map(prescription => prescription.patientId),
  ]);
}

function mergeOwnedRows(currentRows = [], submittedRows = [], user, patientIds) {
  const owned = new Map(currentRows.filter(row => isOwnedByDoctor(row, user)).map(row => [row.id, row]));
  const submitted = submittedRows.filter(row => isOwnedByDoctor(row, user) && patientIds.has(row.patientId));
  for (const row of submitted) owned.set(row.id, row);
  const submittedIds = new Set(submitted.map(row => row.id));
  const currentOwnedIds = new Set(currentRows.filter(row => isOwnedByDoctor(row, user)).map(row => row.id));
  return [
    ...currentRows.filter(row => !isOwnedByDoctor(row, user)),
    ...[...owned.values()].filter(row => submittedIds.has(row.id) || !currentOwnedIds.has(row.id)),
  ];
}

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
  const signature = crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyAuthToken(token) {
  const [payload, signature, extra] = String(token || "").split(".");
  if (!payload || !signature || extra) return null;

  const expectedSignature = crypto.createHmac("sha256", getSigningSecret()).update(payload).digest();
  let actualSignature;
  try {
    actualSignature = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actualSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(actualSignature, expectedSignature)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims.sub !== "string" || typeof claims.ver !== "string" || !["admin", "doctor"].includes(claims.role) || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

function requireRole(...allowedRoles) {
  return async (request, response, next) => {
  const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const claims = verifyAuthToken(token);
  if (!claims) return response.status(401).json({ error: "Authentication required" });

  if (useLocalFallback) {
    const user = getLocalUser(claims.sub);
    if (!user || !allowedRoles.includes(user.role) || user.role !== claims.role || user.auth_version !== claims.ver) {
      return response.status(403).json({ error: "This account does not have access to this area" });
    }
    const doctorProfile = user.role === "doctor" ? doctorProfileForUser(localState, user) : null;
    request.user = { email: claims.sub, name: user.name, doctorName: doctorProfile?.name, role: user.role };
    return next();
  }

  if (!supabase) return response.status(503).json({ error: "Server configuration missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY" });

  const { data: user, error } = await supabase
    .from("clinic_users")
    .select("name, role, auth_version")
    .eq("email", claims.sub)
    .maybeSingle();
  if (error) return response.status(500).json({ error: "Unable to verify account access" });
  if (!user || !allowedRoles.includes(user.role) || user.role !== claims.role || user.auth_version !== claims.ver) {
    return response.status(403).json({ error: "This account does not have access to this area" });
  }

  let doctorName;
  if (user.role === "doctor") {
    const { data: stateRow, error: stateError } = await supabase
      .from("clinic_state")
      .select("state")
      .eq("state_key", "main")
      .maybeSingle();
    if (stateError) return response.status(500).json({ error: "Unable to verify doctor profile" });
    doctorName = doctorProfileForUser(stateRow?.state || initialState, { email: claims.sub, name: user.name })?.name;
  }
  request.user = { email: claims.sub, name: user.name, doctorName, role: user.role };
  next();
  };
}

const requireAuth = requireRole("admin", "doctor");
const requireAdmin = requireRole("admin");

function clinicStateForRole(state, user) {
  if (user.role === "admin") {
    return {
      ...state,
      patients: (state.patients || []).map(({ dob, gender, blood, address, ...patient }) => ({ ...patient, dob: "", gender: "", blood: "", address: "" })),
      appointments: (state.appointments || []).map(appointment => ({ ...appointment, notes: "" })),
      records: [],
      prescriptions: [],
      reminders: (state.reminders || []).map(reminder => ({ ...reminder, message: "" })),
    };
  }

  const patientIds = assignedPatientIds(state, user);
  return {
    ...state,
    patients: (state.patients || []).filter(patient => patientIds.has(patient.id)),
    doctors: (state.doctors || []).filter(doctor => normalizeEmail(doctor.email) === normalizeEmail(user.email) || normalizeDoctorName(doctor.name) === normalizeDoctorName(user.doctorName || user.name)),
    appointments: (state.appointments || []).filter(appointment => isOwnedByDoctor(appointment, user)),
    records: (state.records || []).filter(record => isOwnedByDoctor(record, user)),
    prescriptions: (state.prescriptions || []).filter(prescription => isOwnedByDoctor(prescription, user)),
    bills: [],
    reminders: (state.reminders || []).filter(reminder => {
      const appointment = (state.appointments || []).find(candidate => candidate.id === reminder.appointmentId);
      return appointment && isOwnedByDoctor(appointment, user);
    }),
  };
}

function appointmentForRole(appointment, user) {
  return user.role === "admin" ? { ...appointment, notes: "" } : appointment;
}

function mergeClinicState(currentState, submittedState, user) {
  const nextState = { ...currentState, ...submittedState };
  if (user.role === "admin") {
    nextState.records = currentState.records || initialState.records;
    nextState.prescriptions = currentState.prescriptions || initialState.prescriptions;
    nextState.patients = (submittedState.patients || currentState.patients || []).map(patient => {
      const existing = (currentState.patients || []).find(candidate => candidate.id === patient.id);
      return existing
        ? { ...patient, dob: existing.dob, gender: existing.gender, blood: existing.blood, address: existing.address }
        : { ...patient, dob: "", gender: "", blood: "", address: "" };
    });
    nextState.appointments = (submittedState.appointments || currentState.appointments || []).map(appointment => {
      const existing = (currentState.appointments || []).find(candidate => candidate.id === appointment.id);
      return existing ? { ...appointment, notes: existing.notes } : appointment;
    });
    nextState.reminders = currentState.reminders || initialState.reminders;
    nextState.doctors = currentState.doctors || initialState.doctors;
    return nextState;
  }

  const patientIds = assignedPatientIds(currentState, user);
  const currentPatients = currentState.patients || [];
  const submittedPatients = submittedState.patients || [];
  nextState.patients = [
    ...currentPatients.map(patient => {
      if (!patientIds.has(patient.id)) return patient;
      const submittedPatient = submittedPatients.find(candidate => candidate.id === patient.id);
      return submittedPatient
        ? { ...submittedPatient, assignedDoctor: patient.assignedDoctor || user.doctorName || user.name }
        : patient;
    }),
    ...submittedPatients
      .filter(patient => !currentPatients.some(current => current.id === patient.id))
      .map(patient => ({ ...patient, assignedDoctor: user.doctorName || user.name })),
  ];
  nextState.records = mergeOwnedRows(currentState.records, submittedState.records, user, patientIds);
  nextState.prescriptions = mergeOwnedRows(currentState.prescriptions, submittedState.prescriptions, user, patientIds);
  nextState.reminders = currentState.reminders || [];
  nextState.appointments = currentState.appointments || [];
  nextState.doctors = currentState.doctors || initialState.doctors;
  if (user.role === "doctor") {
    nextState.bills = currentState.bills || [];
  }
  return nextState;
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (_request, response) => {
  response.json({ name: "Greenfield Medical Clinic API", status: "running", health: "/api/health" });
});

app.post("/api/auth/signup", async (request, response) => {
  const { name, email, password } = request.body;
  const normalizedEmail = normalizeEmail(email);
  if (!name?.trim() || !normalizedEmail || !password || password.length < 8) {
    return response.status(400).json({ error: "Name, email, and a password of at least 8 characters are required" });
  }

  if (useLocalFallback) {
    const existingUser = getLocalUser(normalizedEmail);
    if (existingUser) {
      return response.status(409).json({ error: "An account with this email already exists" });
    }
    const credentials = hashPassword(password);
    upsertLocalUser({
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      password_hash: credentials.hash,
      password_salt: credentials.salt,
      role: "pending",
      auth_version: "",
    });
    return response.status(201).json({ ok: true, pendingApproval: true });
  }

  try {
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
  } catch (error) {
    if (isNetworkFailure(error)) {
      if (!canUseLocalFallback()) return response.status(503).json({ error: "Database unavailable" });
      useLocalFallback = true;
      const existingUser = getLocalUser(normalizedEmail);
      if (existingUser) {
        return response.status(409).json({ error: "An account with this email already exists" });
      }
      const credentials = hashPassword(password);
      upsertLocalUser({
        id: crypto.randomUUID(),
        name: name.trim(),
        email: normalizedEmail,
        password_hash: credentials.hash,
        password_salt: credentials.salt,
        role: "pending",
        auth_version: "",
      });
      return response.status(201).json({ ok: true, pendingApproval: true });
    }
    response.status(500).json({ error: error.message || "Unable to create account" });
  }
});

app.post("/api/auth/login", async (request, response) => {
  const { email, password } = request.body;
  const requestedRole = request.body.role === "admin" ? "admin" : "doctor";
  const normalizedEmail = normalizeEmail(email);

  if (useLocalFallback) {
    const user = getLocalUser(normalizedEmail);
    if (!user || !passwordsMatch(password || "", { hash: user.password_hash, salt: user.password_salt })) {
      return response.status(401).json({ error: "Invalid email or password" });
    }
    if (user.role === "pending") return response.status(403).json({ error: "Your doctor account is awaiting administrator approval" });
    if (user.role !== requestedRole) return response.status(403).json({ error: `This account is registered for ${user.role} sign-in` });
    const authVersion = crypto.randomBytes(16).toString("hex");
    user.auth_version = authVersion;
    const token = createAuthToken({ ...user, auth_version: authVersion });
    return response.json({ token, user: { email: user.email, name: user.name, role: user.role } });
  }

  try {
    const { data: user, error } = await getSupabase()
      .from("clinic_users")
      .select("email, name, password_hash, password_salt, role")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (error) return response.status(500).json({ error: error.message });
    if (!user || !passwordsMatch(password || "", { hash: user.password_hash, salt: user.password_salt })) {
      return response.status(401).json({ error: "Invalid email or password" });
    }
    if (user.role === "pending") return response.status(403).json({ error: "Your doctor account is awaiting administrator approval" });
    if (user.role !== requestedRole) return response.status(403).json({ error: `This account is registered for ${user.role} sign-in` });
    const authVersion = crypto.randomBytes(16).toString("hex");
    const { error: updateError } = await getSupabase()
      .from("clinic_users")
      .update({ auth_version: authVersion })
      .eq("email", user.email);
    if (updateError) return response.status(500).json({ error: updateError.message });
    const token = createAuthToken({ ...user, auth_version: authVersion });
    response.json({ token, user: { email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    if (isNetworkFailure(error)) {
      if (!canUseLocalFallback()) return response.status(503).json({ error: "Database unavailable" });
      useLocalFallback = true;
      const user = getLocalUser(normalizedEmail);
      if (!user || !passwordsMatch(password || "", { hash: user.password_hash, salt: user.password_salt })) {
        return response.status(401).json({ error: "Invalid email or password" });
      }
      if (user.role === "pending") return response.status(403).json({ error: "Your doctor account is awaiting administrator approval" });
      if (user.role !== requestedRole) return response.status(403).json({ error: `This account is registered for ${user.role} sign-in` });
      const authVersion = crypto.randomBytes(16).toString("hex");
      user.auth_version = authVersion;
      const token = createAuthToken({ ...user, auth_version: authVersion });
      return response.json({ token, user: { email: user.email, name: user.name, role: user.role } });
    }
    response.status(500).json({ error: error.message || "Unable to sign in" });
  }
});

app.post("/api/auth/logout", requireAuth, async (request, response) => {
  if (useLocalFallback) {
    const user = getLocalUser(request.user.email);
    if (user) {
      user.auth_version = crypto.randomBytes(16).toString("hex");
    }
    return response.json({ ok: true });
  }

  try {
    const { error } = await getSupabase()
      .from("clinic_users")
      .update({ auth_version: crypto.randomBytes(16).toString("hex") })
      .eq("email", request.user.email);
    if (error) return response.status(500).json({ error: error.message });
    response.json({ ok: true });
  } catch (error) {
    if (isNetworkFailure(error)) {
      if (!canUseLocalFallback()) return response.status(503).json({ error: "Database unavailable" });
      useLocalFallback = true;
      const user = getLocalUser(request.user.email);
      if (user) user.auth_version = crypto.randomBytes(16).toString("hex");
      return response.json({ ok: true });
    }
    response.status(500).json({ error: error.message || "Logout failed" });
  }
});

app.get("/api/admin/pending-users", requireAdmin, async (_request, response) => {
  if (useLocalFallback) {
    return response.json([...localUsers.values()]
      .filter(user => user.role === "pending")
      .map(({ id, name, email }) => ({ id, name, email })));
  }

  try {
    const { data, error } = await getSupabase()
      .from("clinic_users")
      .select("id, name, email, created_at")
      .eq("role", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    response.json(data || []);
  } catch (error) {
    if (isNetworkFailure(error) && canUseLocalFallback()) {
      useLocalFallback = true;
      return response.json([...localUsers.values()]
        .filter(user => user.role === "pending")
        .map(({ id, name, email }) => ({ id, name, email })));
    }
    response.status(error.status || 500).json({ error: error.message || "Unable to load pending accounts" });
  }
});

app.post("/api/admin/users/:id/approve", requireAdmin, async (request, response) => {
  if (useLocalFallback) {
    const user = [...localUsers.values()].find(candidate => candidate.id === request.params.id && candidate.role === "pending");
    if (!user) return response.status(404).json({ error: "Pending account not found" });
    localState = doctorProfileForAccount(localState, user);
    user.role = "doctor";
    user.auth_version = "";
    const doctor = localState.doctors.find(profile => normalizeEmail(profile.email) === normalizeEmail(user.email));
    return response.json({ ok: true, doctor });
  }

  try {
    const { data, error } = await getSupabase()
      .from("clinic_users")
      .update({ role: "doctor", auth_version: "" })
      .eq("id", request.params.id)
      .eq("role", "pending")
      .select("id, name, email")
      .maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: "Pending account not found" });
    const { data: stateRow, error: stateReadError } = await getSupabase()
      .from("clinic_state")
      .select("state")
      .eq("state_key", "main")
      .maybeSingle();
    if (stateReadError) throw stateReadError;
    const nextState = doctorProfileForAccount(stateRow?.state || initialState, data);
    const { error: stateWriteError } = await getSupabase()
      .from("clinic_state")
      .upsert({ state_key: "main", state: nextState });
    if (stateWriteError) throw stateWriteError;
    const doctor = nextState.doctors.find(profile => normalizeEmail(profile.email) === normalizeEmail(data.email));
    response.json({ ok: true, doctor });
  } catch (error) {
    if (isNetworkFailure(error) && !canUseLocalFallback()) return response.status(503).json({ error: "Database unavailable" });
    response.status(error.status || 500).json({ error: error.message || "Unable to approve account" });
  }
});

app.get("/api/admin/doctors", requireAdmin, async (_request, response) => {
  if (useLocalFallback) {
    return response.json([...localUsers.values()]
      .filter(user => user.role === "doctor")
      .map(({ id, name, email }) => ({ id, name, email })));
  }

  try {
    const { data, error } = await getSupabase()
      .from("clinic_users")
      .select("id, name, email, created_at")
      .eq("role", "doctor")
      .order("name", { ascending: true });
    if (error) throw error;
    response.json(data || []);
  } catch (error) {
    if (isNetworkFailure(error) && canUseLocalFallback()) {
      useLocalFallback = true;
      return response.json([...localUsers.values()]
        .filter(user => user.role === "doctor")
        .map(({ id, name, email }) => ({ id, name, email })));
    }
    response.status(error.status || 500).json({ error: error.message || "Unable to load doctors" });
  }
});

app.delete("/api/admin/doctors/:id", requireAdmin, async (request, response) => {
  if (useLocalFallback) {
    const entry = [...localUsers.entries()].find(([, user]) => user.id === request.params.id && user.role === "doctor");
    if (!entry) return response.status(404).json({ error: "Doctor account not found" });
    localState.doctors = (localState.doctors || []).filter(doctor => normalizeEmail(doctor.email) !== normalizeEmail(entry[1].email) && normalizeDoctorName(doctor.name) !== normalizeDoctorName(entry[1].name));
    localUsers.delete(entry[0]);
    return response.json({ ok: true, email: entry[1].email });
  }

  try {
    const { data, error } = await getSupabase()
      .from("clinic_users")
      .delete()
      .eq("id", request.params.id)
      .eq("role", "doctor")
      .select("id, name, email")
      .maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: "Doctor account not found" });
    const { data: stateRow, error: stateReadError } = await getSupabase()
      .from("clinic_state")
      .select("state")
      .eq("state_key", "main")
      .maybeSingle();
    if (stateReadError) throw stateReadError;
    if (stateRow?.state) {
      const nextState = {
        ...stateRow.state,
        doctors: (stateRow.state.doctors || []).filter(doctor => normalizeEmail(doctor.email) !== normalizeEmail(data.email) && normalizeDoctorName(doctor.name) !== normalizeDoctorName(data.name)),
      };
      const { error: stateWriteError } = await getSupabase()
        .from("clinic_state")
        .upsert({ state_key: "main", state: nextState });
      if (stateWriteError) throw stateWriteError;
    }
    response.json({ ok: true, email: data.email });
  } catch (error) {
    if (isNetworkFailure(error) && !canUseLocalFallback()) return response.status(503).json({ error: "Database unavailable" });
    response.status(error.status || 500).json({ error: error.message || "Unable to remove doctor account" });
  }
});

app.patch("/api/appointments/:id/cancel", requireAuth, async (request, response) => {
  const cancelForUser = state => {
    const appointment = (state.appointments || []).find(candidate => candidate.id === request.params.id);
    if (!appointment) return { error: "Appointment not found", status: 404 };
    if (request.user.role === "doctor" && !isOwnedByDoctor(appointment, request.user)) {
      return { error: "You can only cancel your own appointments", status: 403 };
    }
    if (appointment.status === "Cancelled") return { state, appointment };
    const updatedAppointment = { ...appointment, status: "Cancelled" };
    return {
      state: { ...state, appointments: state.appointments.map(candidate => candidate.id === appointment.id ? updatedAppointment : candidate) },
      appointment: updatedAppointment,
    };
  };

  if (useLocalFallback) {
    const result = cancelForUser(localState);
    if (result.error) return response.status(result.status).json({ error: result.error });
    localState = result.state;
    return response.json({ ok: true, appointment: appointmentForRole(result.appointment, request.user) });
  }

  try {
    const { data: row, error: readError } = await getSupabase()
      .from("clinic_state")
      .select("state")
      .eq("state_key", "main")
      .maybeSingle();
    if (readError) throw readError;
    if (!row?.state) return response.status(404).json({ error: "Appointment not found" });
    const result = cancelForUser(row.state);
    if (result.error) return response.status(result.status).json({ error: result.error });
    const { error: saveError } = await getSupabase()
      .from("clinic_state")
      .upsert({ state_key: "main", state: result.state });
    if (saveError) throw saveError;
    response.json({ ok: true, appointment: appointmentForRole(result.appointment, request.user) });
  } catch (error) {
    if (isNetworkFailure(error) && !canUseLocalFallback()) return response.status(503).json({ error: "Database unavailable" });
    response.status(error.status || 500).json({ error: error.message || "Unable to cancel appointment" });
  }
});

app.get("/api/health", async (_request, response) => {
  if (useLocalFallback) {
    return response.json({ ok: true, database: "local-memory" });
  }

  try {
    const { error } = await getSupabase().from("clinic_state").select("state_key").limit(1);
    if (error) throw error;
    response.json({ ok: true, database: "supabase" });
  } catch (error) {
    if (isNetworkFailure(error)) {
      if (!canUseLocalFallback()) return response.status(503).json({ ok: false, database: "unavailable" });
      useLocalFallback = true;
      return response.json({ ok: true, database: "local-memory" });
    }
    response.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

app.get("/api/clinic-state", requireAuth, async (request, response) => {
  if (useLocalFallback) return response.json(clinicStateForRole(localState, request.user));

  try {
    const { data: row, error } = await getSupabase().from("clinic_state").select("state").eq("state_key", "main").maybeSingle();
    if (error) throw error;
    if (!row) {
      const { error: insertError } = await getSupabase().from("clinic_state").insert({ state_key: "main", state: initialState });
      if (insertError) throw insertError;
      return response.json(clinicStateForRole(initialState, request.user));
    }
    response.json(clinicStateForRole(row.state, request.user));
  } catch (error) {
    if (isNetworkFailure(error)) {
      if (!canUseLocalFallback()) return response.status(503).json({ error: "Database unavailable" });
      useLocalFallback = true;
      return response.json(clinicStateForRole(localState, request.user));
    }
    response.status(500).json({ error: error.message });
  }
});

app.put("/api/clinic-state", requireAuth, async (request, response) => {
  if (useLocalFallback) {
    localState = JSON.parse(JSON.stringify(mergeClinicState(localState, request.body, request.user)));
    return response.json({ ok: true });
  }

  try {
    let nextState = request.body;
    if (request.user.role !== "admin") {
      const { data: row, error: readError } = await getSupabase()
        .from("clinic_state")
        .select("state")
        .eq("state_key", "main")
        .maybeSingle();
      if (readError) throw readError;
      nextState = mergeClinicState(row?.state || initialState, request.body, request.user);
    }
    const { error } = await getSupabase().from("clinic_state").upsert({ state_key: "main", state: nextState });
    if (error) throw error;
    response.json({ ok: true });
  } catch (error) {
    if (isNetworkFailure(error)) {
      if (!canUseLocalFallback()) return response.status(503).json({ error: "Database unavailable" });
      useLocalFallback = true;
      localState = JSON.parse(JSON.stringify(mergeClinicState(localState, request.body, request.user)));
      return response.json({ ok: true });
    }
    response.status(500).json({ error: error.message });
  }
});

app.use((error, _request, response, _next) => {
  console.error("API request failed:", error.message);
  response.status(error.status || 500).json({ error: error.status === 503 ? error.message : "Internal server error" });
});

export default app;
