export const patients = [
  { id: "P-0041", name: "Margaret Osei", dob: "1978-03-14", gender: "Female", phone: "+1 (555) 204-8812", email: "m.osei@email.com", blood: "O+", address: "24 Elmwood Ave, Boston MA", registered: "2024-01-15", lastVisit: "2026-08-22", status: "Active" },
  { id: "P-0042", name: "Carlos Reyna", dob: "1992-07-29", gender: "Male", phone: "+1 (555) 317-0044", email: "c.reyna@email.com", blood: "A-", address: "11 Birch St, Cambridge MA", registered: "2024-03-08", lastVisit: "2026-09-01", status: "Active" },
  { id: "P-0043", name: "Priya Nair", dob: "1965-11-02", gender: "Female", phone: "+1 (555) 489-2231", email: "priya.nair@email.com", blood: "B+", address: "88 Cedar Rd, Somerville MA", registered: "2023-11-20", lastVisit: "2026-07-14", status: "Active" },
  { id: "P-0044", name: "James Whitmore", dob: "1955-05-17", gender: "Male", phone: "+1 (555) 632-9910", email: "j.whitmore@email.com", blood: "AB+", address: "5 Oak Lane, Brookline MA", registered: "2022-06-30", lastVisit: "2026-06-30", status: "Inactive" },
  { id: "P-0045", name: "Aisha Kamara", dob: "2001-09-08", gender: "Female", phone: "+1 (555) 781-3344", email: "a.kamara@email.com", blood: "O-", address: "200 Maple Dr, Newton MA", registered: "2025-02-11", lastVisit: "2026-09-08", status: "Active" },
  { id: "P-0046", name: "Thomas Bergmann", dob: "1988-12-25", gender: "Male", phone: "+1 (555) 903-6672", email: "t.bergmann@email.com", blood: "A+", address: "33 Willow Way, Waltham MA", registered: "2024-09-05", lastVisit: "2026-08-15", status: "Active" },
];

export const doctors = [
  { id: "D-01", name: "Dr. Elena Vasquez", specialty: "Internal Medicine", phone: "+1 (555) 100-2001", email: "e.vasquez@clinic.com", availability: ["Mon", "Tue", "Thu", "Fri"], status: "On Duty" },
];

export const appointments = [
  { id: "APT-1081", patient: "Margaret Osei", patientId: "P-0041", doctor: "Dr. Elena Vasquez", specialty: "Internal Medicine", date: "2026-09-10", time: "09:00", duration: 30, type: "Follow-up", status: "Confirmed", notes: "Blood pressure monitoring" },
  { id: "APT-1085", patient: "Thomas Bergmann", patientId: "P-0046", doctor: "Dr. Elena Vasquez", specialty: "Internal Medicine", date: "2026-09-11", time: "15:30", duration: 45, type: "Consultation", status: "Confirmed", notes: "Diabetes management" },
];

export const records = [
  { id: "MR-2041", patientId: "P-0041", patient: "Margaret Osei", date: "2026-08-22", doctor: "Dr. Elena Vasquez", diagnosis: "Essential Hypertension", icd: "I10", bp: "148/92", hr: "78", weight: "71 kg", notes: "Increased lisinopril to 10mg. Diet counselling provided. Follow-up in 3 weeks.", vitals: { temp: "36.6°C", spo2: "98%", rr: "16" } },
];

export const prescriptions = [
  { id: "RX-5501", patientId: "P-0041", patient: "Margaret Osei", doctor: "Dr. Elena Vasquez", date: "2026-08-22", drugs: [{ name: "Lisinopril", dose: "10mg", freq: "Once daily", duration: "90 days" }, { name: "Amlodipine", dose: "5mg", freq: "Once daily", duration: "90 days" }], status: "Active", refills: 2 },
];

export const bills = [
  { id: "INV-8801", patientId: "P-0041", patient: "Margaret Osei", date: "2026-08-22", items: [{ desc: "Consultation - Internal Medicine", amount: 150 }, { desc: "Blood Pressure Monitoring", amount: 40 }], paid: 190, total: 190, method: "Insurance", status: "Paid" },
  { id: "INV-8802", patientId: "P-0042", patient: "Carlos Reyna", date: "2026-09-01", items: [{ desc: "Cardiology Consultation", amount: 220 }, { desc: "ECG", amount: 85 }, { desc: "Holter Monitor", amount: 310 }], paid: 220, total: 615, method: "Insurance / OOP", status: "Partial" },
  { id: "INV-8803", patientId: "P-0045", patient: "Aisha Kamara", date: "2026-09-08", items: [{ desc: "Dermatology Consultation", amount: 180 }, { desc: "Skin Patch Testing", amount: 95 }], paid: 0, total: 275, method: "—", status: "Unpaid" },
  { id: "INV-8804", patientId: "P-0046", patient: "Thomas Bergmann", date: "2026-08-15", items: [{ desc: "Consultation - Internal Medicine", amount: 150 }, { desc: "HbA1c Lab Test", amount: 65 }], paid: 215, total: 215, method: "Card", status: "Paid" },
];

export const reminders = [
  { id: "REM-301", type: "SMS", recipient: "Margaret Osei", phone: "+1 (555) 204-8812", message: "Reminder: Your appointment with Dr. Vasquez is tomorrow at 9:00 AM. Reply CONFIRM or CANCEL.", status: "Sent", sentAt: "2026-09-09 08:00", appointmentId: "APT-1081" },
];
