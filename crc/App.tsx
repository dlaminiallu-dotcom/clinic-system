import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { patients as initialPatients, doctors as initialDoctors, appointments as initialAppointments, records as initialRecords, prescriptions as initialPrescriptions, bills as initialBills, reminders as initialReminders } from "./data";

type View = "dashboard" | "patients" | "appointments" | "schedules" | "records" | "prescriptions" | "billing" | "reminders" | "approvals";

type ClinicState = {
  patients: typeof initialPatients;
  setPatients: Dispatch<SetStateAction<typeof initialPatients>>;
  doctors: typeof initialDoctors;
  appointments: typeof initialAppointments;
  setAppointments: Dispatch<SetStateAction<typeof initialAppointments>>;
  records: typeof initialRecords;
  setRecords: Dispatch<SetStateAction<typeof initialRecords>>;
  prescriptions: typeof initialPrescriptions;
  setPrescriptions: Dispatch<SetStateAction<typeof initialPrescriptions>>;
  bills: typeof initialBills;
  setBills: Dispatch<SetStateAction<typeof initialBills>>;
  reminders: typeof initialReminders;
  setReminders: Dispatch<SetStateAction<typeof initialReminders>>;
};

const ClinicContext = createContext<ClinicState | null>(null);
const API_URL = import.meta.env.VITE_API_URL || "";

function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) throw new Error("Clinic components must be rendered inside ClinicContext");
  return context;
}

function Login({ onLogin }: { onLogin: (token: string, name: string, role: "admin" | "doctor") => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<"admin" | "doctor">("doctor");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const body = await response.text();
      let result: { token?: string; error?: string; user?: { name?: string; role?: "admin" | "doctor" } };
      try {
        result = JSON.parse(body);
      } catch {
        const endpoint = `${API_URL || window.location.origin}/api/auth/${mode}`;
        const contentType = response.headers.get("content-type") || "unknown content type";
        throw new Error(`Authentication endpoint ${endpoint} returned HTTP ${response.status} (${contentType}), not JSON. Refresh the latest app or check the deployed /api route.`);
      }
      if (!response.ok) throw new Error(result.error || "Login failed");
      if (mode === "signup") {
        setMode("login");
        setPassword("");
        setError("Account created. An administrator must approve it before you can sign in.");
        return;
      }
      if (!result.token) throw new Error("Login response did not include a session token");
      const signedInName = result.user?.name || name;
      const signedInRole = result.user?.role || role;
      localStorage.setItem("clinic_admin_token", result.token);
      localStorage.setItem("clinic_admin_name", signedInName);
      localStorage.setItem("clinic_user_role", signedInRole);
      onLogin(result.token, signedInName, signedInRole);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#0a6e6e] flex items-center justify-center">
            <span className="text-white font-bold text-lg">+</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-xl text-[#0f1923]">Greenfield Medical Clinic</h1>
            <p className="text-sm text-[#5a6e7e]">{mode === "signup" ? "Request doctor access" : `${role === "admin" ? "Administrator" : "Doctor"} sign in`}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 border-b border-[#d1dce5] mb-5">
          <button type="button" onClick={() => { setMode("login"); setRole("admin"); setError(""); }} className={`pb-2 text-sm font-medium ${mode === "login" && role === "admin" ? "text-[#0a6e6e] border-b-2 border-[#0a6e6e]" : "text-[#5a6e7e]"}`}>Admin sign in</button>
          <button type="button" onClick={() => { setMode("login"); setRole("doctor"); setError(""); }} className={`pb-2 text-sm font-medium ${mode === "login" && role === "doctor" ? "text-[#0a6e6e] border-b-2 border-[#0a6e6e]" : "text-[#5a6e7e]"}`}>Doctor sign in</button>
        </div>
        {mode === "login" && <button type="button" onClick={() => { setMode("signup"); setRole("doctor"); setError(""); }} className="text-sm text-[#0a6e6e] font-medium mb-4">Request doctor access</button>}
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {mode === "signup" && <div>
            <label className="text-xs text-[#5a6e7e] font-medium block mb-1">Full name</label>
            <input required type="text" value={name} onChange={event => setName(event.target.value)} className="w-full border border-[#d1dce5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e]" />
          </div>}
          <div>
            <label className="text-xs text-[#5a6e7e] font-medium block mb-1">Email</label>
            <input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="w-full border border-[#d1dce5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e]" />
          </div>
          <div>
            <label className="text-xs text-[#5a6e7e] font-medium block mb-1">Password {mode === "signup" && "(minimum 8 characters)"}</label>
            <input required minLength={mode === "signup" ? 8 : undefined} type="password" value={password} onChange={event => setPassword(event.target.value)} className="w-full border border-[#d1dce5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e]" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-[#0a6e6e] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#085a5a] disabled:opacity-60">
            {loading ? "Please wait..." : mode === "signup" ? "Request doctor account" : `Sign in as ${role === "admin" ? "Admin" : "Doctor"}`}
          </button>
        </form>
      </Card>
    </div>
  );
}

function Approvals({ token }: { token: string }) {
  const [users, setUsers] = useState<{ id: string; name: string; email: string; created_at?: string }[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string; email: string; created_at?: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadPendingUsers = () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_URL}/api/admin/pending-users`, { headers }),
      fetch(`${API_URL}/api/admin/doctors`, { headers }),
    ])
      .then(async ([pendingResponse, doctorsResponse]) => {
        const [pending, activeDoctors] = await Promise.all([pendingResponse.json(), doctorsResponse.json()]);
        if (!pendingResponse.ok) throw new Error(pending.error || "Unable to load pending accounts");
        if (!doctorsResponse.ok) throw new Error(activeDoctors.error || "Unable to load doctors");
        setUsers(pending);
        setDoctors(activeDoctors);
        setError("");
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : "Unable to load pending accounts"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPendingUsers(); }, [token]);

  const approveUser = async (userId: string) => {
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(userId)}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to approve account");
      setUsers(current => current.filter(user => user.id !== userId));
      loadPendingUsers();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Unable to approve account");
    }
  };

  const removeDoctor = async (doctor: { id: string; name: string }) => {
    if (!window.confirm(`Remove ${doctor.name}'s doctor account? They will lose access immediately.`)) return;
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/admin/doctors/${encodeURIComponent(doctor.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to remove doctor account");
      setDoctors(current => current.filter(currentDoctor => currentDoctor.id !== doctor.id));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove doctor account");
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Doctor Accounts" action={<Btn variant="outline" onClick={loadPendingUsers}>Refresh</Btn>} />
      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
      {loading ? <p className="text-sm text-[#5a6e7e]">Loading doctor accounts...</p> : <>
        <section className="space-y-3">
          <h3 className="font-semibold text-[#0f1923]">Awaiting approval ({users.length})</h3>
          {users.length === 0 ? (
            <Card className="p-4"><p className="text-sm text-[#5a6e7e]">No doctor access requests are waiting.</p></Card>
          ) : users.map(user => (
            <Card key={user.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[#0f1923]">{user.name}</p>
                <p className="text-sm text-[#5a6e7e] break-all">{user.email}</p>
                {user.created_at && <p className="text-xs text-[#5a6e7e] mt-1">Requested {new Date(user.created_at).toLocaleDateString()}</p>}
              </div>
              <Btn onClick={() => approveUser(user.id)}>Approve doctor</Btn>
            </Card>
          ))}
        </section>
        <section className="space-y-3 pt-4">
          <h3 className="font-semibold text-[#0f1923]">Approved doctors ({doctors.length})</h3>
          {doctors.length === 0 ? (
            <Card className="p-4"><p className="text-sm text-[#5a6e7e]">No doctor accounts have been approved.</p></Card>
          ) : doctors.map(doctor => (
            <Card key={doctor.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[#0f1923]">{doctor.name}</p>
                <p className="text-sm text-[#5a6e7e] break-all">{doctor.email}</p>
              </div>
              <Btn variant="outline" onClick={() => removeDoctor(doctor)}>Remove doctor</Btn>
            </Card>
          ))}
        </section>
      </>}
    </div>
  );
}

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⬛" },
  { id: "patients", label: "Patients", icon: "👤" },
  { id: "appointments", label: "Appointments", icon: "📅" },
  { id: "schedules", label: "Doctor Schedules", icon: "🩺" },
  { id: "records", label: "Medical Records", icon: "📋" },
  { id: "prescriptions", label: "Prescriptions", icon: "💊" },
  { id: "billing", label: "Billing", icon: "💳" },
  { id: "reminders", label: "SMS / Email", icon: "🔔" },
  { id: "approvals", label: "Doctors", icon: "✓" },
];

function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    red: "bg-red-50 text-red-700 border border-red-200",
    yellow: "bg-amber-50 text-amber-700 border border-amber-200",
    blue: "bg-sky-50 text-sky-700 border border-sky-200",
    gray: "bg-gray-100 text-gray-600 border border-gray-200",
    teal: "bg-teal-50 text-teal-700 border border-teal-200",
  };
  return (
    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-medium ${colors[color] ?? colors.gray}`}>
      {label}
    </span>
  );
}

function statusColor(s: string) {
  if (["Active", "On Duty", "Confirmed", "Paid", "Sent"].includes(s)) return "green";
  if (["Inactive", "On Leave", "Cancelled", "Unpaid"].includes(s)) return "red";
  if (["Pending", "Scheduled", "Partial"].includes(s)) return "yellow";
  if (["Completed"].includes(s)) return "gray";
  return "blue";
}

function formatRand(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount);
}

function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return <div className={`bg-white rounded-xl border border-[#d1dce5] ${className}`} onClick={onClick}>{children}</div>;
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-lg font-semibold text-[#0f1923]">{title}</h2>
      {action}
    </div>
  );
}

function Btn({ children, variant = "primary", onClick, small }: { children: React.ReactNode; variant?: "primary" | "outline" | "ghost"; onClick?: () => void; small?: boolean }) {
  const base = `inline-flex items-center gap-1.5 font-medium rounded-lg transition-all cursor-pointer ${small ? "text-xs px-3 py-1.5" : "text-sm px-4 py-2"}`;
  const variants = {
    primary: "bg-[#0a6e6e] text-white hover:bg-[#085a5a]",
    outline: "border border-[#d1dce5] text-[#0f1923] hover:bg-[#f0f4f8]",
    ghost: "text-[#0a6e6e] hover:bg-[#e8f0ef]",
  };
  return <button className={`${base} ${variants[variant]}`} onClick={onClick}>{children}</button>;
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-[#5a6e7e] uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? "text-[#0a6e6e]" : "text-[#0f1923]"}`}>{value}</p>
      {sub && <p className="text-xs text-[#5a6e7e] mt-1">{sub}</p>}
    </Card>
  );
}

function Dashboard({ adminName, userRole }: { adminName: string; userRole: "admin" | "doctor" }) {
  const { patients, doctors, appointments, prescriptions, bills, reminders } = useClinic();
  const surname = adminName.trim().split(/\s+/).filter(Boolean).at(-1) || "Admin";
  const todayApts = appointments.filter(a => a.date === "2026-09-10");
  const outstanding = bills.reduce((total, bill) => total + (bill.total - bill.paid), 0);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0f1923]">Good morning, Dr. {surname}</h1>
        <p className="text-sm text-[#5a6e7e]">Thursday, September 10, 2026 · Greenfield Medical Clinic</p>
      </div>
      <div className={`grid grid-cols-2 ${userRole === "admin" ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}>
        <StatTile label="Patients" value={patients.length} sub="+1 this week" />
        <StatTile label="Today's Appointments" value={todayApts.length} sub="2 confirmed" accent />
        <StatTile label="Active Prescriptions" value={prescriptions.filter(p => p.status === "Active").length} sub="Across 3 patients" />
        {userRole === "admin" && <StatTile label="Pending Invoices" value={formatRand(outstanding)} sub={`${bills.filter(b => b.total > b.paid).length} bills outstanding`} />}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-semibold text-[#0f1923] mb-4">Today's Appointments</h3>
          <div className="overflow-x-auto">
          <table className="w-full min-w-155 text-sm">
            <thead>
              <tr className="text-left text-xs text-[#5a6e7e] border-b border-[#d1dce5]">
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Patient</th>
                <th className="pb-2 font-medium">Doctor</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {todayApts.map(a => (
                <tr key={a.id} className="border-b border-[#f0f4f8] last:border-0">
                  <td className="py-2.5 font-mono text-xs text-[#5a6e7e]">{a.time}</td>
                  <td className="py-2.5 font-medium">{a.patient}</td>
                  <td className="py-2.5 text-[#5a6e7e]">{a.doctor}</td>
                  <td className="py-2.5 text-[#5a6e7e]">{a.type}</td>
                  <td className="py-2.5"><Badge label={a.status} color={statusColor(a.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-[#0f1923] mb-4">Doctors on Duty</h3>
          <div className="space-y-3">
            {doctors.filter(d => d.status === "On Duty").map(d => (
              <div key={d.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#e8f0ef] flex items-center justify-center text-[#0a6e6e] text-xs font-bold">
                  {d.name.split(" ").filter((_, i) => i > 0).map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-[#5a6e7e]">{d.specialty}</p>
                </div>
                <Badge label="On Duty" color="green" />
              </div>
            ))}
            {doctors.filter(d => d.status === "On Leave").map(d => (
              <div key={d.id} className="flex items-center gap-3 opacity-60">
                <div className="w-8 h-8 rounded-full bg-[#e4eaef] flex items-center justify-center text-[#5a6e7e] text-xs font-bold">
                  {d.name.split(" ").filter((_, i) => i > 0).map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-[#5a6e7e]">{d.specialty}</p>
                </div>
                <Badge label="On Leave" color="red" />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className={`grid grid-cols-1 ${userRole === "admin" ? "lg:grid-cols-2" : ""} gap-4`}>
        {userRole === "admin" && <Card className="p-5">
          <h3 className="font-semibold text-[#0f1923] mb-4">Recent Billing Activity</h3>
          <div className="space-y-2">
            {bills.map(b => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-[#f0f4f8] last:border-0">
                <div>
                  <p className="text-sm font-medium">{b.patient}</p>
                  <p className="text-xs text-[#5a6e7e] font-mono">{b.id} · {b.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatRand(b.total)}</p>
                  <Badge label={b.status} color={statusColor(b.status)} />
                </div>
              </div>
            ))}
          </div>
        </Card>}
        <Card className="p-5">
          <h3 className="font-semibold text-[#0f1923] mb-4">Reminder Queue</h3>
          <div className="space-y-2">
            {reminders.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-[#f0f4f8] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">{r.type === "SMS" ? "📱" : "✉️"}</span>
                  <div>
                    <p className="text-sm font-medium">{r.recipient}</p>
                    <p className="text-xs text-[#5a6e7e]">{r.type} · {r.sentAt}</p>
                  </div>
                </div>
                <Badge label={r.status} color={statusColor(r.status)} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── PATIENTS ────────────────────────────────────────────────────────────────

function Patients() {
  const { patients, setPatients } = useClinic();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<typeof patients[0] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", dob: "", gender: "Female", phone: "", email: "", blood: "O+", address: "" });
  const [error, setError] = useState("");

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  const savePatient = () => {
    if (!form.name.trim() || !form.dob || !form.phone.trim()) {
      setError("Name, date of birth, and phone are required.");
      return;
    }
    const nextPatient = {
      id: `P-${String(41 + patients.length).padStart(4, "0")}`,
      ...form,
      registered: "2026-09-10",
      lastVisit: "—",
      status: "Active",
    };
    setPatients(current => [...current, nextPatient]);
    setSelected(nextPatient);
    setForm({ name: "", dob: "", gender: "Female", phone: "", email: "", blood: "O+", address: "" });
    setError("");
    setShowForm(false);
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Patient Registry" action={
        <Btn onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Register Patient"}</Btn>
      } />

      {showForm && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">New Patient Registration</h3>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Full Name", key: "name", type: "text" },
              { label: "Date of Birth", key: "dob", type: "date" },
              { label: "Phone", key: "phone", type: "tel" },
              { label: "Email", key: "email", type: "email" },
              { label: "Address", key: "address", type: "text" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-[#5a6e7e] font-medium block mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={(form as any)[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full border border-[#d1dce5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e]"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-[#5a6e7e] font-medium block mb-1">Gender</label>
              <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="w-full border border-[#d1dce5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e]">
                {["Female", "Male", "Non-binary", "Prefer not to say"].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#5a6e7e] font-medium block mb-1">Blood Type</label>
              <select value={form.blood} onChange={e => setForm({ ...form, blood: e.target.value })} className="w-full border border-[#d1dce5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e]">
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Btn onClick={savePatient}>Save Patient</Btn>
            <Btn variant="outline" onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by name or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-[#d1dce5] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e] bg-white"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-175 text-sm">
            <thead className="bg-[#f0f4f8]">
              <tr className="text-left text-xs text-[#5a6e7e]">
                {["ID", "Name", "DOB", "Blood", "Phone", "Last Visit", "Status"].map(h => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`border-t border-[#f0f4f8] cursor-pointer transition-colors hover:bg-[#f8fafc] ${selected?.id === p.id ? "bg-[#e8f0ef]" : ""}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-[#5a6e7e]">{p.id}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-[#5a6e7e]">{p.dob}</td>
                  <td className="px-4 py-3"><span className="font-mono text-xs bg-[#e8f0ef] text-[#0a6e6e] px-2 py-0.5 rounded">{p.blood}</span></td>
                  <td className="px-4 py-3 text-[#5a6e7e] text-xs">{p.phone}</td>
                  <td className="px-4 py-3 text-[#5a6e7e] text-xs">{p.lastVisit}</td>
                  <td className="px-4 py-3"><Badge label={p.status} color={statusColor(p.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>

        {selected ? (
          <Card className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="w-12 h-12 rounded-full bg-[#e8f0ef] flex items-center justify-center text-[#0a6e6e] font-bold text-lg mb-2">
                  {selected.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <h3 className="font-semibold text-[#0f1923]">{selected.name}</h3>
                <p className="text-xs text-[#5a6e7e] font-mono">{selected.id}</p>
              </div>
              <Badge label={selected.status} color={statusColor(selected.status)} />
            </div>
            <div className="space-y-3">
              {[
                { l: "Date of Birth", v: selected.dob },
                { l: "Gender", v: selected.gender },
                { l: "Blood Type", v: selected.blood },
                { l: "Phone", v: selected.phone },
                { l: "Email", v: selected.email },
                { l: "Address", v: selected.address },
                { l: "Registered", v: selected.registered },
                { l: "Last Visit", v: selected.lastVisit },
              ].map(({ l, v }) => (
                <div key={l} className="flex justify-between text-sm border-b border-[#f0f4f8] pb-2 last:border-0">
                  <span className="text-[#5a6e7e] text-xs">{l}</span>
                  <span className="font-medium text-right max-w-[55%]">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-5 flex items-center justify-center text-center">
            <div className="text-[#5a6e7e]">
              <p className="text-3xl mb-2">👤</p>
              <p className="text-sm">Select a patient to view details</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── APPOINTMENTS ────────────────────────────────────────────────────────────

function Appointments() {
  const { patients, doctors, appointments, setAppointments } = useClinic();
  const [filter, setFilter] = useState("All");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ patientId: patients[0]?.id ?? "", doctorId: doctors[0]?.id ?? "", date: "2026-09-15", time: "09:00", type: "Consultation", notes: "" });
  const [error, setError] = useState("");

  const filters = ["All", "Confirmed", "Pending", "Cancelled"];
  const filtered = filter === "All" ? appointments : appointments.filter(a => a.status === filter);

  const bookAppointment = () => {
    const patient = patients.find(p => p.id === form.patientId);
    const doctor = doctors.find(d => d.id === form.doctorId);
    if (!patient || !doctor || !form.date || !form.time) {
      setError("Patient, doctor, date, and time are required.");
      return;
    }
    setAppointments(current => [...current, {
      id: `APT-${1081 + current.length}`,
      patient: patient.name,
      patientId: patient.id,
      doctor: doctor.name,
      specialty: doctor.specialty,
      date: form.date,
      time: form.time,
      duration: 30,
      type: form.type,
      status: "Pending",
      notes: form.notes || "New appointment",
    }]);
    setShowNew(false);
    setError("");
  };
  const updateAppointmentStatus = (id: string, status: string) => {
    setAppointments(current => current.map(appointment => appointment.id === id ? { ...appointment, status } : appointment));
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Appointment Booking" action={
        <Btn onClick={() => setShowNew(!showNew)}>{showNew ? "Cancel" : "+ New Appointment"}</Btn>
      } />

      {showNew && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Book Appointment</h3>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#5a6e7e] font-medium block mb-1">Patient</label>
              <select value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })} className="w-full border border-[#d1dce5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e]">
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#5a6e7e] font-medium block mb-1">Doctor</label>
              <select value={form.doctorId} onChange={e => setForm({ ...form, doctorId: e.target.value })} className="w-full border border-[#d1dce5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e]">
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#5a6e7e] font-medium block mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border border-[#d1dce5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e]" />
            </div>
            <div>
              <label className="text-xs text-[#5a6e7e] font-medium block mb-1">Time</label>
              <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="w-full border border-[#d1dce5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e]" />
            </div>
            <div>
              <label className="text-xs text-[#5a6e7e] font-medium block mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-[#d1dce5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e]">
                {["Consultation", "Follow-up", "New Patient", "Procedure", "Emergency"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#5a6e7e] font-medium block mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Reason for visit…" className="w-full border border-[#d1dce5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6e6e]" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Btn onClick={bookAppointment}>Book Appointment</Btn>
            <Btn variant="outline" onClick={() => setShowNew(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all cursor-pointer ${filter === f ? "bg-[#0a6e6e] text-white border-[#0a6e6e]" : "bg-white text-[#5a6e7e] border-[#d1dce5] hover:border-[#0a6e6e]"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(a => (
          <Card key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="shrink-0">
              <div className="text-center bg-[#e8f0ef] rounded-xl p-3 w-16">
                <p className="text-xs text-[#0a6e6e] font-medium">{new Date(a.date).toLocaleDateString("en-US", { month: "short" })}</p>
                <p className="text-2xl font-bold text-[#0a6e6e]">{new Date(a.date).getDate()}</p>
                <p className="text-xs font-mono text-[#5a6e7e]">{a.time}</p>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-[#0f1923]">{a.patient}</p>
                <span className="text-[#5a6e7e] text-sm">→</span>
                <p className="text-sm text-[#5a6e7e]">{a.doctor}</p>
                <Badge label={a.type} color="blue" />
              </div>
              <p className="text-xs text-[#5a6e7e] mt-1">{a.specialty} · {a.duration} min · {a.notes}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge label={a.status} color={statusColor(a.status)} />
              {a.status === "Pending" && <Btn small onClick={() => updateAppointmentStatus(a.id, "Confirmed")}>Confirm</Btn>}
              {a.status !== "Cancelled" && <Btn variant="outline" small onClick={() => updateAppointmentStatus(a.id, "Cancelled")}>Cancel</Btn>}
              <span className="text-xs text-[#5a6e7e] font-mono">{a.id}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── DOCTOR SCHEDULES ────────────────────────────────────────────────────────

function Schedules() {
  const { doctors, appointments } = useClinic();
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div className="space-y-5">
      <SectionHeader title="Doctor Schedules" />
      <div className="grid grid-cols-1 gap-4">
        {doctors.map(d => (
          <Card key={d.id} className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-[#e8f0ef] flex items-center justify-center text-[#0a6e6e] font-bold">
                  {d.name.split(" ").filter((_, i) => i > 0).map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-xs text-[#5a6e7e]">{d.specialty} · {d.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {days.map(day => (
                    <span
                      key={day}
                      className={`w-9 text-center text-xs font-mono py-1 rounded ${d.availability.includes(day) ? "bg-[#0a6e6e] text-white" : "bg-[#e4eaef] text-[#5a6e7e]"}`}
                    >
                      {day}
                    </span>
                  ))}
                </div>
                <Badge label={d.status} color={statusColor(d.status)} />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#f0f4f8]">
              <p className="text-xs text-[#5a6e7e] mb-2 font-medium">Upcoming appointments</p>
              <div className="flex gap-2 flex-wrap">
                {appointments.filter(a => a.doctor === d.name).map(a => (
                  <div key={a.id} className="text-xs bg-[#f0f4f8] rounded-lg px-3 py-1.5 border border-[#d1dce5]">
                    <span className="font-medium">{a.patient}</span>
                    <span className="text-[#5a6e7e] ml-1">· {a.date} {a.time}</span>
                  </div>
                ))}
                {appointments.filter(a => a.doctor === d.name).length === 0 && (
                  <span className="text-xs text-[#5a6e7e]">No upcoming appointments</span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── MEDICAL RECORDS ─────────────────────────────────────────────────────────

function Records() {
  const { records, patients, doctors, setRecords } = useClinic();
  const [selected, setSelected] = useState<typeof records[0] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ patientId: patients[0]?.id ?? "", doctorId: doctors[0]?.id ?? "", diagnosis: "", icd: "", notes: "" });
  const [error, setError] = useState("");

  const saveRecord = () => {
    const patient = patients.find(p => p.id === form.patientId);
    const doctor = doctors.find(d => d.id === form.doctorId);
    if (!patient || !doctor || !form.diagnosis.trim()) {
      setError("Patient, doctor, and diagnosis are required.");
      return;
    }
    const nextRecord = {
      id: `MR-${2041 + records.length}`,
      patientId: patient.id,
      patient: patient.name,
      date: "2026-09-10",
      doctor: doctor.name,
      diagnosis: form.diagnosis,
      icd: form.icd || "N/A",
      bp: "—",
      hr: "—",
      weight: "—",
      notes: form.notes || "No clinical notes added.",
      vitals: { temp: "—", spo2: "—", rr: "—" },
    };
    setRecords(current => [...current, nextRecord]);
    setSelected(nextRecord);
    setForm({ patientId: patients[0]?.id ?? "", doctorId: doctors[0]?.id ?? "", diagnosis: "", icd: "", notes: "" });
    setError("");
    setShowNew(false);
  };
  return (
    <div className="space-y-5">
      <SectionHeader title="Medical Records" action={<Btn onClick={() => setShowNew(!showNew)}>{showNew ? "Cancel" : "+ New Record"}</Btn>} />
      {showNew && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Create Medical Record</h3>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })} className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm">
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={form.doctorId} onChange={e => setForm({ ...form, doctorId: e.target.value })} className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm">
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} placeholder="Diagnosis *" className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm" />
            <input value={form.icd} onChange={e => setForm({ ...form, icd: e.target.value })} placeholder="ICD-10 code" className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm" />
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Clinical notes" className="sm:col-span-2 border border-[#d1dce5] rounded-lg px-3 py-2 text-sm" rows={3} />
          </div>
          <div className="mt-4"><Btn onClick={saveRecord}>Save Record</Btn></div>
        </Card>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {records.map(r => (
            <Card
              key={r.id}
              className={`p-4 cursor-pointer transition-all hover:border-[#0a6e6e] ${selected?.id === r.id ? "border-[#0a6e6e] bg-[#e8f0ef]" : ""}`}
              onClick={() => setSelected(r)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-sm">{r.patient}</p>
                  <p className="text-xs text-[#5a6e7e] font-mono">{r.id} · {r.date}</p>
                </div>
                <span className="text-xs bg-[#e8f0ef] text-[#0a6e6e] px-2 py-0.5 rounded font-mono">{r.icd}</span>
              </div>
              <p className="text-sm mt-2 text-[#0f1923]">{r.diagnosis}</p>
              <p className="text-xs text-[#5a6e7e] mt-1">{r.doctor}</p>
            </Card>
          ))}
        </div>
        <div className="lg:col-span-3">
          {selected ? (
            <Card className="p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="text-lg font-semibold">{selected.patient}</h3>
                  <p className="text-xs text-[#5a6e7e] font-mono">{selected.patientId} · Record {selected.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#5a6e7e]">{selected.date}</p>
                  <p className="text-xs text-[#5a6e7e]">{selected.doctor}</p>
                </div>
              </div>
              <div className="bg-[#f0f4f8] rounded-xl p-4 mb-5">
                <p className="text-xs text-[#5a6e7e] font-medium mb-1">Diagnosis</p>
                <p className="font-semibold text-[#0f1923]">{selected.diagnosis}</p>
                <span className="text-xs font-mono text-[#0a6e6e]">ICD-10: {selected.icd}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                {[
                  { l: "Blood Pressure", v: selected.bp },
                  { l: "Heart Rate", v: selected.hr + " bpm" },
                  { l: "Weight", v: selected.weight },
                  { l: "Temperature", v: selected.vitals.temp },
                  { l: "SpO₂", v: selected.vitals.spo2 },
                  { l: "Resp. Rate", v: selected.vitals.rr + " /min" },
                ].map(({ l, v }) => (
                  <div key={l} className="bg-[#f0f4f8] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#5a6e7e] mb-1">{l}</p>
                    <p className="font-mono font-semibold text-[#0f1923]">{v}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-[#5a6e7e] font-medium mb-2">Clinical Notes</p>
                <p className="text-sm text-[#0f1923] leading-relaxed">{selected.notes}</p>
              </div>
            </Card>
          ) : (
            <Card className="p-5 h-full flex items-center justify-center text-center">
              <div className="text-[#5a6e7e]">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-sm">Select a record to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PRESCRIPTIONS ───────────────────────────────────────────────────────────

function Prescriptions() {
  const { prescriptions, patients, doctors, setPrescriptions } = useClinic();
  const [filter, setFilter] = useState("All");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ patientId: patients[0]?.id ?? "", doctorId: doctors[0]?.id ?? "", drug: "", dose: "", frequency: "Once daily", duration: "30 days", refills: "0" });
  const [error, setError] = useState("");
  const filtered = filter === "All" ? prescriptions : prescriptions.filter(p => p.status === filter);
  const savePrescription = () => {
    const patient = patients.find(p => p.id === form.patientId);
    const doctor = doctors.find(d => d.id === form.doctorId);
    if (!patient || !doctor || !form.drug.trim() || !form.dose.trim() || !form.duration.trim()) {
      setError("Patient, doctor, medication, dose, and duration are required.");
      return;
    }
    const nextPrescription = {
      id: `RX-${5501 + prescriptions.length}`,
      patientId: patient.id,
      patient: patient.name,
      doctor: doctor.name,
      date: "2026-09-14",
      drugs: [{ name: form.drug, dose: form.dose, freq: form.frequency, duration: form.duration }],
      status: "Active",
      refills: Math.max(0, Number(form.refills) || 0),
    };
    setPrescriptions(current => [...current, nextPrescription]);
    setForm({ patientId: patients[0]?.id ?? "", doctorId: doctors[0]?.id ?? "", drug: "", dose: "", frequency: "Once daily", duration: "30 days", refills: "0" });
    setError("");
    setShowNew(false);
  };
  const requestRefill = (id: string) => {
    setPrescriptions(current => current.map(rx => rx.id === id && rx.refills > 0 ? { ...rx, refills: rx.refills - 1 } : rx));
  };
  return (
    <div className="space-y-5">
      <SectionHeader title="Prescription Management" action={<Btn onClick={() => setShowNew(!showNew)}>{showNew ? "Cancel" : "+ New Prescription"}</Btn>} />
      {showNew && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Create Prescription</h3>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })} className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm">
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={form.doctorId} onChange={e => setForm({ ...form, doctorId: e.target.value })} className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm">
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input value={form.drug} onChange={e => setForm({ ...form, drug: e.target.value })} placeholder="Medication *" className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm" />
            <input value={form.dose} onChange={e => setForm({ ...form, dose: e.target.value })} placeholder="Dose *" className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm" />
            <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm">
              {["Once daily", "Twice daily", "Three times daily", "As needed"].map(frequency => <option key={frequency}>{frequency}</option>)}
            </select>
            <input value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="Duration *" className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm" />
            <input type="number" min="0" value={form.refills} onChange={e => setForm({ ...form, refills: e.target.value })} placeholder="Refills" className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="mt-4"><Btn onClick={savePrescription}>Save Prescription</Btn></div>
        </Card>
      )}
      <div className="flex gap-2">
        {["All", "Active", "Completed"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all cursor-pointer ${filter === f ? "bg-[#0a6e6e] text-white border-[#0a6e6e]" : "bg-white text-[#5a6e7e] border-[#d1dce5] hover:border-[#0a6e6e]"}`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {filtered.map(rx => (
          <Card key={rx.id} className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{rx.patient}</p>
                  <Badge label={rx.status} color={statusColor(rx.status)} />
                </div>
                <p className="text-xs text-[#5a6e7e] font-mono mt-0.5">{rx.id} · {rx.date} · {rx.doctor}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#5a6e7e]">Refills remaining</p>
                <p className="text-xl font-bold text-[#0a6e6e] font-mono">{rx.refills}</p>
              </div>
            </div>
            <div className="space-y-2">
              {rx.drugs.map((d, i) => (
                <div key={i} className="flex items-center gap-4 bg-[#f0f4f8] rounded-lg px-4 py-3">
                  <div className="w-6 h-6 rounded-full bg-[#0a6e6e] text-white text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{d.name}</p>
                    <p className="text-xs text-[#5a6e7e]">{d.dose} · {d.freq}</p>
                  </div>
                  <span className="text-xs font-mono text-[#5a6e7e] bg-white border border-[#d1dce5] px-2 py-1 rounded">{d.duration}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Btn variant="outline" small onClick={() => window.print()}>Print</Btn>
              {rx.refills > 0 && <Btn variant="ghost" small onClick={() => requestRefill(rx.id)}>Request Refill</Btn>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── BILLING ─────────────────────────────────────────────────────────────────

function Billing() {
  const { bills, patients, setBills } = useClinic();
  const [selected, setSelected] = useState<typeof bills[0] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ patientId: patients[0]?.id ?? "", description: "", amount: "", method: "Card" });
  const [error, setError] = useState("");
  const totalRevenue = bills.reduce((s, b) => s + b.paid, 0);
  const outstanding = bills.reduce((s, b) => s + (b.total - b.paid), 0);
  const recordPayment = (id: string) => {
    setBills(current => current.map(b => b.id === id ? { ...b, paid: b.total, status: "Paid", method: b.method === "—" ? "Card" : b.method } : b));
    setSelected(current => current ? { ...current, paid: current.total, status: "Paid", method: current.method === "—" ? "Card" : current.method } : current);
  };
  const saveInvoice = () => {
    const patient = patients.find(p => p.id === form.patientId);
    const amount = Number(form.amount);
    if (!patient || !form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Patient, description, and a positive amount are required.");
      return;
    }
    const nextBill = {
      id: `INV-${8801 + bills.length}`,
      patientId: patient.id,
      patient: patient.name,
      date: "2026-09-14",
      items: [{ desc: form.description, amount }],
      paid: 0,
      total: amount,
      method: form.method,
      status: "Unpaid",
    };
    setBills(current => [...current, nextBill]);
    setForm({ patientId: patients[0]?.id ?? "", description: "", amount: "", method: "Card" });
    setError("");
    setShowNew(false);
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Billing & Invoices" action={<Btn onClick={() => setShowNew(!showNew)}>{showNew ? "Cancel" : "+ New Invoice"}</Btn>} />
      {showNew && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Create Invoice</h3>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })} className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm">
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Service or item *" className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm" />
            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="Amount (R) *" className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm" />
            <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm">
              {["Card", "Cash", "Medical aid", "EFT"].map(method => <option key={method}>{method}</option>)}
            </select>
          </div>
          <div className="mt-4"><Btn onClick={saveInvoice}>Save Invoice</Btn></div>
        </Card>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Total Revenue" value={formatRand(totalRevenue)} />
        <StatTile label="Outstanding" value={formatRand(outstanding)} accent />
        <StatTile label="Invoices" value={bills.length} sub={`${bills.filter(b => b.status === "Paid").length} paid`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-150 text-sm">
              <thead className="bg-[#f0f4f8]">
                <tr className="text-left text-xs text-[#5a6e7e]">
                  {["Invoice", "Patient", "Date", "Total", "Paid", "Status"].map(h => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bills.map(b => (
                  <tr
                    key={b.id}
                    onClick={() => setSelected(b)}
                    className={`border-t border-[#f0f4f8] cursor-pointer transition-colors hover:bg-[#f8fafc] ${selected?.id === b.id ? "bg-[#e8f0ef]" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#5a6e7e]">{b.id}</td>
                    <td className="px-4 py-3 font-medium">{b.patient}</td>
                    <td className="px-4 py-3 text-[#5a6e7e]">{b.date}</td>
                    <td className="px-4 py-3 font-semibold">{formatRand(b.total)}</td>
                    <td className="px-4 py-3 text-[#0a6e6e] font-mono">{formatRand(b.paid)}</td>
                    <td className="px-4 py-3"><Badge label={b.status} color={statusColor(b.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
        <div className="lg:col-span-2">
          {selected ? (
            <Card className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-semibold font-mono text-[#0a6e6e]">{selected.id}</p>
                  <p className="font-semibold text-lg">{selected.patient}</p>
                  <p className="text-xs text-[#5a6e7e]">{selected.date} · {selected.method}</p>
                </div>
                <Badge label={selected.status} color={statusColor(selected.status)} />
              </div>
              <div className="space-y-2 mb-4">
                {selected.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-2 border-b border-[#f0f4f8]">
                    <span className="text-[#5a6e7e]">{item.desc}</span>
                    <span className="font-medium">{formatRand(item.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#f0f4f8] rounded-xl p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#5a6e7e]">Total</span>
                  <span className="font-bold text-lg">{formatRand(selected.total)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#5a6e7e]">Paid</span>
                  <span className="text-[#0a6e6e] font-semibold">{formatRand(selected.paid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#5a6e7e]">Balance</span>
                  <span className={`font-semibold ${selected.total - selected.paid > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {formatRand(selected.total - selected.paid)}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Btn small onClick={() => recordPayment(selected.id)}>Record Payment</Btn>
                <Btn variant="outline" small onClick={() => window.print()}>Print Invoice</Btn>
              </div>
            </Card>
          ) : (
            <Card className="p-5 h-full flex items-center justify-center text-center">
              <div className="text-[#5a6e7e]">
                <p className="text-4xl mb-3">💳</p>
                <p className="text-sm">Select an invoice to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── REMINDERS ───────────────────────────────────────────────────────────────

function Reminders() {
  const { reminders, patients, appointments, setReminders } = useClinic();
  const [type, setType] = useState("Both");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ appointmentId: appointments[0]?.id ?? "", type: "SMS", message: "" });
  const [error, setError] = useState("");
  const filtered = type === "Both" ? reminders : reminders.filter(r => r.type === type);
  const sent = reminders.filter(r => r.status === "Sent").length;
  const sendReminder = (id: string) => {
    setReminders(current => current.map(r => r.id === id ? { ...r, status: "Sent", sentAt: new Date().toISOString().slice(0, 16).replace("T", " ") } : r));
  };
  const saveReminder = () => {
    const appointment = appointments.find(item => item.id === form.appointmentId);
    const patient = patients.find(item => item.id === appointment?.patientId);
    if (!appointment || !patient || !form.message.trim()) {
      setError("Appointment and message are required.");
      return;
    }
    setReminders(current => [...current, {
      id: `REM-${301 + current.length}`,
      type: form.type,
      recipient: patient.name,
      phone: patient.phone,
      message: form.message,
      status: "Pending",
      sentAt: "—",
      appointmentId: appointment.id,
    }]);
    setForm({ appointmentId: appointments[0]?.id ?? "", type: "SMS", message: "" });
    setError("");
    setShowNew(false);
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="SMS / Email Reminders" action={<Btn onClick={() => setShowNew(!showNew)}>{showNew ? "Cancel" : "+ Send Reminder"}</Btn>} />
      {showNew && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Create Reminder</h3>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={form.appointmentId} onChange={e => setForm({ ...form, appointmentId: e.target.value })} className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm">
              {appointments.map(appointment => <option key={appointment.id} value={appointment.id}>{appointment.patient} · {appointment.date} {appointment.time}</option>)}
            </select>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="border border-[#d1dce5] rounded-lg px-3 py-2 text-sm">
              <option>SMS</option><option>Email</option>
            </select>
            <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Reminder message *" className="sm:col-span-2 border border-[#d1dce5] rounded-lg px-3 py-2 text-sm" rows={3} />
          </div>
          <div className="mt-4"><Btn onClick={saveReminder}>Queue Reminder</Btn></div>
        </Card>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Total Sent" value={sent} />
        <StatTile label="Scheduled" value={reminders.filter(r => r.status === "Scheduled").length} accent />
        <StatTile label="Pending" value={reminders.filter(r => r.status === "Pending").length} />
      </div>
      <div className="flex gap-2">
        {["Both", "SMS", "Email"].map(f => (
          <button
            key={f}
            onClick={() => setType(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all cursor-pointer ${type === f ? "bg-[#0a6e6e] text-white border-[#0a6e6e]" : "bg-white text-[#5a6e7e] border-[#d1dce5] hover:border-[#0a6e6e]"}`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map(r => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${r.type === "SMS" ? "bg-sky-50" : "bg-purple-50"}`}>
                {r.type === "SMS" ? "📱" : "✉️"}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-semibold text-sm">{r.recipient}</p>
                    <p className="text-xs text-[#5a6e7e] font-mono">{r.id} · {r.type} · Apt {r.appointmentId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#5a6e7e]">{r.sentAt}</span>
                    <Badge label={r.status} color={statusColor(r.status)} />
                  </div>
                </div>
                <p className="text-sm text-[#5a6e7e] mt-2 bg-[#f0f4f8] rounded-lg px-3 py-2 leading-relaxed">{r.message}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              {r.status === "Pending" && <Btn small onClick={() => sendReminder(r.id)}>Send Now</Btn>}
              <Btn variant="outline" small onClick={() => sendReminder(r.id)}>Resend</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── SHELL ───────────────────────────────────────────────────────────────────

export default function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("clinic_admin_token"));
  const [adminName, setAdminName] = useState(() => localStorage.getItem("clinic_admin_name") || "Admin");
  const [userRole, setUserRole] = useState<"admin" | "doctor">(() => localStorage.getItem("clinic_user_role") === "doctor" ? "doctor" : "admin");
  const [view, setView] = useState<View>("dashboard");
  const [patients, setPatients] = useState(initialPatients);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [records, setRecords] = useState(initialRecords);
  const [prescriptions, setPrescriptions] = useState(initialPrescriptions);
  const [bills, setBills] = useState(initialBills);
  const [reminders, setReminders] = useState(initialReminders);
  const [databaseReady, setDatabaseReady] = useState(false);
  const hasLoadedDatabase = useRef(false);

  const logout = async () => {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    }).catch(() => undefined);
    localStorage.removeItem("clinic_admin_token");
    localStorage.removeItem("clinic_admin_name");
    localStorage.removeItem("clinic_user_role");
    hasLoadedDatabase.current = false;
    setDatabaseReady(false);
    setAuthToken(null);
  };

  useEffect(() => {
    if (!authToken) {
      hasLoadedDatabase.current = false;
      setDatabaseReady(false);
      return;
    }

    fetch(`${API_URL}/api/clinic-state`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(response => {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("clinic_admin_token");
          localStorage.removeItem("clinic_admin_name");
          localStorage.removeItem("clinic_user_role");
          setAuthToken(null);
          throw new Error("Your session is not authorized. Sign in again.");
        }
        return response.ok ? response.json() : Promise.reject(new Error("Database API unavailable"));
      })
      .then(state => {
        const doctorNames = new Set(initialDoctors.map(doctor => doctor.name));
        const availableAppointments = state.appointments.filter((appointment: typeof initialAppointments[number]) => doctorNames.has(appointment.doctor));
        setPatients(state.patients);
        setAppointments(availableAppointments);
        setRecords(state.records.filter((record: typeof initialRecords[number]) => doctorNames.has(record.doctor)));
        setPrescriptions(state.prescriptions.filter((prescription: typeof initialPrescriptions[number]) => doctorNames.has(prescription.doctor)));
        setBills(state.bills);
        const appointmentIds = new Set(availableAppointments.map((appointment: typeof initialAppointments[number]) => appointment.id));
        setReminders(state.reminders.filter((reminder: typeof initialReminders[number]) => appointmentIds.has(reminder.appointmentId)));
        hasLoadedDatabase.current = true;
        setDatabaseReady(true);
      })
      .catch(() => setDatabaseReady(false));
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !hasLoadedDatabase.current) return;
    fetch(`${API_URL}/api/clinic-state`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ patients, doctors: initialDoctors, appointments, records, prescriptions, bills, reminders }),
    }).then(response => {
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("clinic_admin_token");
        localStorage.removeItem("clinic_admin_name");
        localStorage.removeItem("clinic_user_role");
        hasLoadedDatabase.current = false;
        setAuthToken(null);
      }
      if (!response.ok) setDatabaseReady(false);
    }).catch(() => setDatabaseReady(false));
  }, [authToken, patients, appointments, records, prescriptions, bills, reminders]);

  if (!authToken) return <Login onLogin={(token, name, role) => { setAuthToken(token); setAdminName(name); setUserRole(role); }} />;

  const views: Record<View, React.ReactNode> = {
    dashboard: <Dashboard adminName={adminName} userRole={userRole} />,
    patients: <Patients />,
    appointments: <Appointments />,
    schedules: <Schedules />,
    records: <Records />,
    prescriptions: <Prescriptions />,
    billing: <Billing />,
    reminders: <Reminders />,
    approvals: <Approvals token={authToken} />,
  };
  const doctorViews: View[] = ["dashboard", "patients", "appointments", "records", "prescriptions", "reminders"];
  const visibleNavItems = navItems.filter(item => userRole === "admin" || doctorViews.includes(item.id));

  return (
    <ClinicContext.Provider value={{ patients, setPatients, doctors: initialDoctors, appointments, setAppointments, records, setRecords, prescriptions, setPrescriptions, bills, setBills, reminders, setReminders }}>
      <div className="min-h-screen w-full flex flex-col md:h-screen md:flex-row bg-[#f0f4f8] overflow-hidden">
      <header className="md:hidden shrink-0 bg-[#0a6e6e] text-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 shrink-0 rounded-lg bg-[#1ab8a8] flex items-center justify-center">
              <span className="text-white font-bold text-sm">+</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight">Greenfield</p>
              <p className="text-[10px] text-[#7ec8c8]">Medical Clinic</p>
            </div>
          </div>
          <button onClick={logout} className="shrink-0 text-xs text-[#d3eeee] px-2 py-1 cursor-pointer">Sign out</button>
        </div>
        <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto px-3 pb-2">
          {visibleNavItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                view === item.id ? "bg-[#ffffff22] text-white" : "text-[#b7dddd] hover:bg-[#ffffff12]"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </header>
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 bg-[#0a6e6e] flex-col overflow-y-auto">
        <div className="px-5 py-6 border-b border-[#085a5a]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-[#1ab8a8] flex items-center justify-center">
              <span className="text-white font-bold text-sm">+</span>
            </div>
            <span className="font-bold text-white text-sm">Greenfield</span>
          </div>
          <p className="text-xs text-[#7ec8c8]">Medical Clinic</p>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {visibleNavItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer text-left ${
                view === item.id
                  ? "bg-[#ffffff18] text-white"
                  : "text-[#9fd4d4] hover:bg-[#ffffff10] hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-[#085a5a]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#1ab8a8] flex items-center justify-center text-white text-xs font-bold">AD</div>
            <div>
              <p className="text-xs text-white font-medium truncate max-w-28">{adminName}</p>
              <p className="text-[10px] text-[#7ec8c8]">{userRole === "admin" ? "administrator" : "doctor"}</p>
            </div>
          </div>
          <button onClick={logout} className="mt-3 text-xs text-[#9fd4d4] hover:text-white cursor-pointer">Sign out</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 w-full flex-1 overflow-y-auto">
        <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
          <div className="relative">
            {!databaseReady && <p className="absolute right-0 -top-5 text-[10px] text-amber-700">Local mode: start the API to save changes</p>}
            {views[view]}
          </div>
        </div>
      </main>
      </div>
    </ClinicContext.Provider>
  );
}
