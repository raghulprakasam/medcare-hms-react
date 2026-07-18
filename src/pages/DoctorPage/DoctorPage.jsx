import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import usePageStyles from "../../components/usePageStyles.js";
import { apiFetch, clearToken, decodeTokenSubject, getToken } from "../../api/client.js";
import cssText from "./DoctorPage.css?raw";

const COMMON_LAB_TESTS = [
  "Blood Sugar (F/PP)",
  "CBC",
  "Lipid Profile",
  "Thyroid Profile",
  "Urine Routine",
  "X-Ray Chest",
  "ECG",
  "MRI",
  "CT Scan",
];

function calculateAge(dobStr) {
  if (!dobStr) return "-";
  const birthDate = new Date(dobStr);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age + " yrs";
}

function getPatientDetails(appt) {
  let name = "Unknown";
  const phone = appt.patientPhone || "N/A";
  let age = "-";

  if (appt.patientFirstName) {
    name = `${appt.patientFirstName} ${appt.patientLastName || ""}`.trim();
  } else if (appt.patientName) {
    name = appt.patientName;
  }
  if (appt.patientDob) age = calculateAge(appt.patientDob);

  return { name, phone, age };
}

export default function DoctorPage() {
  usePageStyles(cssText, "doctorpage");
  const navigate = useNavigate();

  const [welcomeText, setWelcomeText] = useState("Welcome, Doctor");
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currentTab, setCurrentTab] = useState("waiting");
  const [modalApptId, setModalApptId] = useState(null);
  const [toasts, setToasts] = useState([]);

  const diagRef = useRef(null);
  const medRef = useRef(null);
  const customLabRef = useRef(null);
  const [checkedLabs, setCheckedLabs] = useState([]);

  function showToast(message, type = "success") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }

  function loadProfile() {
    const token = getToken();
    if (!token) {
      navigate("/");
      return;
    }
    const sub = decodeTokenSubject(token);
    if (sub) {
      const name = sub.split("@")[0];
      setWelcomeText("Welcome, Dr. " + name.charAt(0).toUpperCase() + name.slice(1));
    }
  }

  async function fetchAppointments() {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await apiFetch("/doctor/all-patients");
      if (!response.ok) throw new Error("Fetch failed");
      const data = await response.json();
      setAppointments(data);
    } catch (error) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    clearToken();
    navigate("/");
  }

  const filteredList = Array.isArray(appointments)
    ? appointments.filter((appt) => {
        const isCompleted = appt.status === "COMPLETED" || appt.status === "Consulted" || appt.status === "Paid";
        return currentTab === "waiting" ? !isCompleted : isCompleted;
      })
    : [];

  const modalAppt = Array.isArray(appointments)
    ? appointments.find((a) => (a.appointmentId || a.id) === modalApptId)
    : null;

  function openModal(id) {
    setModalApptId(id);
    const appt = (appointments || []).find((a) => (a.appointmentId || a.id) === id);
    if (!appt) return;
    const existingLabs = appt.labTests ? appt.labTests.split(",").map((s) => s.trim()) : [];
    setCheckedLabs(existingLabs.filter((t) => COMMON_LAB_TESTS.includes(t)));
  }

  function closeModal() {
    setModalApptId(null);
  }

  function toggleLab(test) {
    setCheckedLabs((prev) => (prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]));
  }

  async function submitPrescription() {
    if (!modalApptId) return;

    const diag = diagRef.current.value.trim();
    const meds = medRef.current.value.trim();
    const customLabs = customLabRef.current.value.trim();

    let finalLabTests = [...checkedLabs];
    if (customLabs) {
      const customArr = customLabs.split(",").map((s) => s.trim()).filter((s) => s !== "");
      finalLabTests = finalLabTests.concat(customArr);
    }
    const labsString = finalLabTests.join(", ");

    if (!diag && !meds && !labsString) {
      showToast("Please enter at least a Diagnosis, Medicine, or Lab Test.", "error");
      return;
    }

    const payload = { diagnosis: diag, prescribedMedicine: meds, labTests: labsString };

    try {
      const response = await apiFetch(`/doctor/update/${modalApptId}`, { method: "PUT", body: payload });

      if (response.ok) {
        showToast("Prescription Saved & Sent to Pharmacy!", "success");
        closeModal();
        setCurrentTab("consulted");
        await fetchAppointments();
      } else {
        showToast("Failed to update. Check backend connection.", "error");
      }
    } catch (error) {
      console.error("Update error:", error);
      showToast("Error connecting to server.", "error");
    }
  }

  const existingLabs = modalAppt && modalAppt.labTests ? modalAppt.labTests.split(",").map((s) => s.trim()) : [];
  const customTestsDefault = existingLabs.filter((t) => !COMMON_LAB_TESTS.includes(t)).join(", ");

  return (
    <div className="doctor-layout-wrapper">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🩺</div>
          <div>
            <div className="logo-text">MedCore</div>
            <div className="logo-sub">Doctor Portal</div>
          </div>
        </div>
        <div className="sidebar-footer">
          <a className="nav-item" onClick={logout} style={{ color: "var(--grey-200)", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", fontWeight: 600 }}>
            🚪 Sign Out
          </a>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <h1 style={{ fontSize: "16px", color: "var(--navy)" }} id="headerWelcomeText">{welcomeText}</h1>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--teal)" }} id="currentDate">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </header>

        <div className="content">
          <div className="tabs-container">
            <button className={`tab-btn${currentTab === "waiting" ? " active" : ""}`} onClick={() => setCurrentTab("waiting")}>⏳ Waiting / Unvisited</button>
            <button className={`tab-btn${currentTab === "consulted" ? " active" : ""}`} onClick={() => setCurrentTab("consulted")}>✅ Consulted / Visited</button>
          </div>

          <div className="table-card">
            <div className="panel-head">
              <span id="tableTitle">{currentTab === "waiting" ? "⏳ Waiting / Unvisited Patients" : "✅ Consulted / Visited Patients"}</span>
              <button onClick={fetchAppointments} style={{ background: "none", border: "none", color: "var(--teal)", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
                ↻ Refresh List
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Queue / Token</th>
                    <th>Patient Name</th>
                    <th>Age/DOB</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="patientTableBody">
                  {loading && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "20px" }}>Loading patients...</td></tr>
                  )}
                  {!loading && loadError && (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "red", padding: "20px" }}>Failed to load data. Is Backend running?</td></tr>
                  )}
                  {!loading && !loadError && filteredList.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "20px" }}>No patients in {currentTab} list.</td></tr>
                  )}
                  {!loading && !loadError && filteredList.map((appt) => {
                    const pDetails = getPatientDetails(appt);
                    const safeApptId = appt.id || appt.appointmentId;
                    const displayId = appt.tokenNumber ? appt.tokenNumber : safeApptId;
                    const isCompleted = appt.status === "COMPLETED" || appt.status === "Consulted" || appt.status === "Paid";
                    const statusBadge = isCompleted ? "badge-green" : "badge-amber";
                    const statusText = isCompleted ? "Consulted" : "Waiting";
                    const btnText = isCompleted ? "View/Edit Record" : "Consult Patient";
                    
                    return (
                      <tr key={safeApptId} onClick={() => openModal(safeApptId)}>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--teal)", fontWeight: 600, fontSize: "15px" }}>#{displayId}</td>
                        <td><strong>{pDetails.name}</strong><br /><small style={{ color: "var(--grey-400)" }}>Phone: {pDetails.phone}</small></td>
                        <td>{pDetails.age}</td>
                        <td><span className={`badge ${statusBadge}`}>{statusText}</span></td>
                        <td><span style={{ color: "var(--teal)", fontWeight: 600, fontSize: "12px", textDecoration: "underline", cursor: "pointer" }}>{btnText}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <div className="modal-overlay" id="clinicalModal" style={{ display: modalAppt ? "flex" : "none" }}>
        <div className="modal-content">
          <div className="modal-header">
            <h2>📝 Clinical Consultation Form</h2>
            <button className="close-btn" onClick={closeModal}>&times;</button>
          </div>

          <div className="modal-body" id="modalBodyContent">
            {modalAppt && (
              <>
                <div className="patient-banner">
                  <div>
                    <h3>{getPatientDetails(modalAppt).name} <span style={{ color: "var(--grey-600)", fontSize: "14px" }}>({getPatientDetails(modalAppt).age})</span></h3>
                    <p>Phone: <strong>{getPatientDetails(modalAppt).phone}</strong></p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p>Token/Queue: <strong style={{ fontSize: "18px", color: "var(--navy)" }}>#{modalAppt.tokenNumber || modalApptId}</strong></p>
                    <p>Appt ID: {modalApptId}</p>
                  </div>
                </div>

                <div className="form-section">
                  <div className="form-section-title">🩺 Diagnosis </div>
                  <input type="text" ref={diagRef} className="field-input" placeholder="Enter clinical diagnosis (e.g., Viral Fever, Hypertension)..." defaultValue={modalAppt.diagnosis || ""} />
                </div>

                <div className="form-section">
                  <div className="form-section-title">💊 Prescribe Medicines </div>
                  <textarea ref={medRef} className="field-input" placeholder={"Type medicines here... \nExample: \n1. Tab. Paracetamol 500mg - 1-1-1 (After Food) - 3 Days\n2. Syp. Gelusil 10ml - 1-0-1 - 5 Days"} defaultValue={modalAppt.prescribedMedicine || ""}></textarea>
                </div>

                <div className="form-section">
                  <div className="form-section-title">🔬 Lab Tests & Investigations </div>
                  <div className="checkbox-grid">
                    {COMMON_LAB_TESTS.map((test) => (
                      <label className="checkbox-label" key={test}>
                        <input type="checkbox" className="lab-cb" checked={checkedLabs.includes(test)} onChange={() => toggleLab(test)} /> {test}
                      </label>
                    ))}
                  </div>
                  <input type="text" ref={customLabRef} className="field-input" placeholder="Other tests (type comma separated)..." defaultValue={customTestsDefault} />
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" onClick={submitPrescription}>✅ Save &amp; Send to Pharmacy</button>
          </div>
        </div>
      </div>

      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "success" ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}