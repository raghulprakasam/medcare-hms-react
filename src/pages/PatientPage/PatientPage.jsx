import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import html2pdf from "html2pdf.js";
import usePageStyles from "../../components/usePageStyles.js";
import { apiFetch, clearToken, getToken } from "../../api/client.js";
import cssText from "./PatientPage.css?raw";
import patientLogo from "../../assets/img/patient-logo.png";

function calculateAge(dob) {
  if (!dob) return "N/A";
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

const SECTION_TITLES = {
  overview: ["Dashboard Overview", "Your health at a glance"],
  appointments: ["My Appointments", "View, manage & download booking slips"],
  records: ["Medical History", "Prescriptions & lab test results"],
};

export default function PatientPage() {
  usePageStyles(cssText, "patientpage");
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [section, setSection] = useState("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [payMode, setPayMode] = useState("");
  const [toasts, setToasts] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);

  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const patientDataRef = useRef(null);

  // Form Refs
  const deptRef = useRef(null);
  const dateRef = useRef(null);
  const reasonRef = useRef(null);
  const upiIdRef = useRef(null);
  const cardNumRef = useRef(null);
  const cardExpRef = useRef(null);
  const cardCvvRef = useRef(null);
  const bookBtnRef = useRef(null);
  const [booking, setBooking] = useState(false);

  // Get Today's Date in YYYY-MM-DD format for min date restriction
  const todayDateString = new Date().toISOString().split('T')[0];

  function showToast(message, type = "info") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }

  function logout() {
    clearToken();
    navigate("/");
  }

  async function loadPatientProfile() {
    try {
      const token = getToken();
      if (!token) {
        navigate("/");
        return;
      }

      const response = await apiFetch(`/patient/profile?timestamp=${new Date().getTime()}`);
      if (!response.ok) throw new Error("Failed to load profile");

      const data = await response.json();
      patientDataRef.current = data;

      const fName = data.firstName || (data.user && data.user.firstName) || "Patient";
      const lName = data.lastName || (data.user && data.user.lastName) || "";
      const fullName = (fName + " " + lName).trim();
      const initials = fName.charAt(0).toUpperCase() + (lName ? lName.charAt(0).toUpperCase() : "");
      const pId = data.patientId || data.id || (data.user && data.user.id) || "--";
      const pMobile = data.mobile || data.phone || (data.user && (data.user.mobile || data.user.phone)) || "--";
      const pEmail = data.email || (data.user && data.user.email) || "--";
      const pDob = data.dob || (data.user && data.user.dob) || null;

      const today = new Date();
      const hour = today.getHours();
      const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

      setProfile({
        fName,
        fullName,
        initials,
        pId,
        pMobile,
        pEmail,
        age: calculateAge(pDob),
        gender: data.gender || "Not Specified",
        address: data.address || "Address not provided",
        greeting: greeting + ", " + fName,
        currentDate: today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      });

      await loadMyUpcomingAppointments();
    } catch (error) {
      console.error("Profile Load Error:", error);
      showToast("Session Expired or Server Error. Please Login Again.", "error");
      setTimeout(() => {
        clearToken();
        navigate("/");
      }, 1500);
    }
  }

  async function loadMyUpcomingAppointments(isAfterBooking = false) {
    try {
      const token = getToken();
      if (!token) return;
      const response = await apiFetch(`/patient/appointments?timestamp=${new Date().getTime()}`);
      if (!response.ok) throw new Error("Backend Error");
      const myAppts = await response.json();
      console.log("API-ல இருந்து வர்ற டேட்டா:", myAppts);
      setAppointments(myAppts);
      if (isAfterBooking) setSection("overview");
    } catch (err) {
      console.error("Fetch Appointments Error:", err);
    }
  }

  useEffect(() => {
    loadPatientProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

function switchSection(s) {
    setSection(s);
   
    if (s === "appointments" || s === "records") {
        loadMyUpcomingAppointments();
    }
    setSidebarOpen(false);
  }

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  function computeStatus(app) {
    const dateObj = new Date(app.date);
    dateObj.setHours(0, 0, 0, 0);
    if (app.status === "Consulted" || app.status === "Completed" || app.diagnosis || app.prescribedMedicine) {
      return { text: "Completed", cls: "badge-grey" };
    }
    if (dateObj < today) return { text: "Not Visited", cls: "badge-danger" };
    if (dateObj.getTime() === today.getTime()) return { text: "Today", cls: "badge-amber" };
    return { text: "Scheduled", cls: "scheduled" };
  }

  const upcomingOnly = useMemo(() => {
    return appointments
      .filter((app) => {
        if (app.status === "Consulted" || app.status === "Completed" || app.diagnosis || app.prescribedMedicine) return false;
        const appDate = new Date(app.date);
        appDate.setHours(0, 0, 0, 0);
        return appDate >= today;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [appointments, today]);

  const nextAppt = upcomingOnly[0];

  const sortedAppts = useMemo(() => {
    return [...appointments].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [appointments]);

  const completedAppts = useMemo(() => {
    return appointments
     .filter((app) => app.status === "Consulted" || app.status === "Completed" || app.diagnosis || app.prescribedMedicine)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [appointments]);

  function extractDoctorName(app) {
    if (app.doctor && typeof app.doctor === "object" && app.doctor.firstName) {
      return `${app.doctor.firstName} ${app.doctor.lastName || ""}`.trim();
    }
    if (app.doctorName && app.doctorName !== "null") return app.doctorName;
    if (app.doctorEmail) {
      const namePart = app.doctorEmail.split("@")[0];
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    if (typeof app.doctor === "string") return app.doctor;
    return "Duty Doctor";
  }

  async function handleBookingSubmit(e) {
    e.preventDefault();
    const selectedDate = dateRef.current.value;
    const department = deptRef.current ? deptRef.current.value : "General";
    const reason = reasonRef.current ? reasonRef.current.value : "";

    const alreadyBooked = appointments.some((app) => app.date === selectedDate);
    if (alreadyBooked) {
      showToast(`You already have an appointment booked for ${selectedDate}.`, "error");
      return;
    }

    if (!payMode) {
      showToast("Please select a payment method.", "error");
      return;
    }

    const newAppointment = {
      department,
      date: selectedDate,
      paymentMode: payMode,
      status: "Scheduled",
      doctor: null,
      reason: reason
    };

    setBooking(true);
    try {
      const token = getToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        setTimeout(() => navigate("/"), 1500);
        return;
      }

      const response = await apiFetch("/patient/appointments/book", { method: "POST", body: newAppointment });

     if (response.ok) {
        showToast(`Appointment Confirmed! ₹500 ${payMode === "cash" ? "Pending" : "Received"}.`, "success");
        setModalOpen(false);
        setPayMode("");
        e.target.reset();
        
        // இந்த வரிதான் முக்கியம்: டேட்டாவை ரீஃப்ரெஷ் செய்துவிட்டு, உடனே 'appointments' டேப்பிற்கு மாறவும்
        await loadMyUpcomingAppointments(); 
        setSection("appointments"); 
      }
    } catch (error) {
      console.error("Booking Error:", error);
      showToast("Error connecting to server. Is Spring Boot running?", "error");
    } finally {
      setBooking(false);
    }
  }

  async function downloadRealSlip(appId) {
    const app = appointments.find((a) => (a.appointmentId || a.id || "").toString() === String(appId));
    if (!app) {
      showToast("Appointment not found!", "error");
      return;
    }

    const safeAppId = app.appointmentId || app.id || appId;
    const pGender = (patientDataRef.current && patientDataRef.current.gender) || "Not Specified";
    const pAddress = (patientDataRef.current && patientDataRef.current.address) || "Address not provided";
    const patientName = profile ? profile.fullName : "N/A";
    const patientUHID = profile ? profile.pId : safeAppId;
    const appTime = app.time || "10:00 AM - 01:00 PM";
    const isCash = app.paymentMode === "cash" || app.paymentMode === "Cash";

    setDownloadingId(appId);

    const tempDiv = document.createElement("div");
    tempDiv.style.background = "#fff";
    tempDiv.innerHTML = `
      <div style="padding: 25px; font-family: 'Arial', sans-serif; color: #000; font-weight: 700; border: 2px solid #000; width: 100%; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
          <div style="text-align: center;">
              <img src="${patientLogo}" style="width: 70px;" />
          </div>
          <div style="text-align: center; flex: 1;">
            <h1 style="margin: 0; font-size: 22px;">MedCare Hospital</h1>
            <p style="margin: 5px 0; font-size: 16px;">Out Patient Department</p>
            <div style="text-decoration: underline; font-size: 14px;">e-OPD Card</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px;">UHID: ${patientUHID}</div>
            <div style="border: 1px solid #000; padding: 6px; margin-top: 5px; text-align: center; font-size: 13px;">
              ${isCash ? "PAY AT COUNTER" : "PAID ONLINE"}
            </div>
          </div>
        </div>

        <div style="margin-bottom: 20px; font-size: 15px;">
          <div>Clinic: ${app.department}</div>
          <div>Dept: ${app.department}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr>
            <td style="border: 1px solid #000; padding: 12px;"><strong>Name of Patient:</strong> ${patientName}</td>
            <td style="border: 1px solid #000; padding: 12px;"><strong>Patient ID:</strong> ${patientUHID}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 12px;"><strong>Gender:</strong> ${pGender}</td>
            <td style="border: 1px solid #000; padding: 12px;"><strong>Age:</strong> ${calculateAge(app.patientDob)} years</td>
          </tr>
          <tr>
            <td colspan="2" style="border: 1px solid #000; padding: 12px;"><strong>Address:</strong> ${pAddress}</td>
          </tr>
        </table>

        <div style="margin-bottom: 20px; font-size: 14px; line-height: 2.2;">
          <div><strong>Reporting Time:</strong> ${appTime}</div>
          <div><strong>Date:</strong> ${app.date}</div>
          <div><strong>Room No:</strong> Main Building, Ground Floor - ${app.department}</div>
          <div><strong>Queue No:</strong> ${safeAppId}</div>
        </div>

        <div style="text-align: center; margin-top: 30px; font-family: monospace; font-size: 24px; letter-spacing: 6px;">
          |||||||||||||||||||||||||||
        </div>

        <div style="text-align: center; font-size: 11px; margin-top: 30px; border-top: 1px solid #000; padding-top: 10px;">
          Disclaimer: YOU HAVE TO CONFIRM APPOINTMENT AT DESIGNATED COUNTER AT MEDCARE.
        </div>
      </div>
    `;

    document.body.appendChild(tempDiv);

    const opt = {
      margin: 0.2,
      filename: `Appointment_${safeAppId}.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 3, useCORS: true },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    };

    try {
      await html2pdf().set(opt).from(tempDiv).save();
      showToast("PDF Downloaded Successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to generate PDF.", "error");
    } finally {
      document.body.removeChild(tempDiv);
      setDownloadingId(null);
    }
  }

  const titleInfo = SECTION_TITLES[section] || ["Dashboard", ""];

  return (
    <div className="patient-layout-wrapper">
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`} id="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>
          </div>
          <div className="sidebar-logo-text">
            MedCare
            <span>Patient Portal</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">Main</div>
          <div className={`nav-item${section === "overview" ? " active" : ""}`} onClick={() => switchSection("overview")}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /></svg>
            Dashboard
          </div>
          <div className={`nav-item${section === "appointments" ? " active" : ""}`} onClick={() => switchSection("appointments")}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" /></svg>
            My Appointments
          </div>
          <div className={`nav-item${section === "records" ? " active" : ""}`} onClick={() => switchSection("records")}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" /></svg>
            Medical History
          </div>

          <div className="nav-label">Support</div>
          <div className="nav-item">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" /></svg>
            Help &amp; Support
          </div>
          <div className="nav-item" onClick={logout}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" /></svg>
            Sign Out
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" id="sidebarAvatar">{profile ? profile.initials : "--"}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name" id="sidebarName">{profile ? profile.fullName : "Loading..."}</div>
              <div className="sidebar-user-role" id="sidebarPatientId">{profile ? `Patient #${profile.pId}` : "Patient"}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className={`sidebar-overlay${sidebarOpen ? " show" : ""}`} id="sidebarOverlay" onClick={() => setSidebarOpen(false)}></div>

      <div className="main">
        <header className="topbar">
          <button className="topbar-hamburger" id="hamburger" onClick={() => setSidebarOpen((v) => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="topbar-title">
            {section === "overview" ? (profile ? profile.greeting : "Good Morning") : titleInfo[0]}
            <span id="currentDate">{section === "overview" ? (profile ? profile.currentDate : "Loading...") : titleInfo[1]}</span>
          </div>
          <div className="topbar-actions">
            <button className="topbar-btn" title="Notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              <span className="topbar-badge"></span>
            </button>
          </div>
        </header>

        <main className="page-content">
          <div className="section-tabs" id="sectionTabs">
            <button className={`tab-btn${section === "overview" ? " active" : ""}`} onClick={() => switchSection("overview")}>Overview</button>
            <button className={`tab-btn${section === "appointments" ? " active" : ""}`} onClick={() => switchSection("appointments")}>Appointments</button>
            <button className={`tab-btn${section === "records" ? " active" : ""}`} onClick={() => switchSection("records")}>Records</button>
          </div>

          <div className="dashboard-sections">
            <div className="profile-card" style={{ marginBottom: 0 }}>
              <div className="profile-avatar" id="avatar">{profile ? profile.initials : "--"}</div>
              <div className="profile-info">
                <div className="profile-name" id="name">{profile ? profile.fullName : "Loading..."}</div>
                <div className="profile-meta">
                  <span className="profile-meta-item">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" /></svg>
                    Patient ID: <strong id="patientId">{profile ? profile.pId : "---"}</strong>
                  </span>
                  <span className="profile-meta-item">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" /></svg>
                    <strong id="age">{profile ? profile.age : "--"} yrs</strong>
                  </span>
                  <span className="profile-meta-item">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
                    <span id="mobile">{profile ? profile.pMobile : "---"}</span>
                  </span>
                  <span className="profile-meta-item">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
                    <span id="email">{profile ? profile.pEmail : "---"}</span>
                  </span>
                  <span className="profile-meta-item">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /></svg>
                    Gender: <strong id="gender">{profile ? profile.gender : "---"}</strong>
                  </span>
                  <span className="profile-meta-item">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                    Address: <strong id="address">{profile ? profile.address : "---"}</strong>
                  </span>
                </div>
              </div>
         <div className="profile-widgets" style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
                <div className="profile-widget">
                  <div className="profile-widget-label">Next Appointment</div>
                  <div className="profile-widget-value" id="nextApptDate">
                    {nextAppt ? new Date(nextAppt.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No Upcoming"}
                  </div>
                  <div className="profile-widget-sub" id="nextApptDetails">{nextAppt ? `${nextAppt.department} Dept` : "Book an appointment"}</div>
                </div>

                {/* Dashboard-ல் நேரடியாக புக் செய்யும் பட்டன் */}
                <button 
                  onClick={() => setModalOpen(true)}
                  style={{ backgroundColor: "#fff", color: "#1a73e8", border: "none", padding: "12px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "18px", height: "18px" }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Book Appointment
                </button>
              </div>
            </div>

            <div className="tab-content active" id="tab-overview" style={{ display: section === "overview" ? undefined : "none" }}>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" /></svg>
                    Upcoming Appointments
                    <span className="card-title-badge" id="apptCountBadge">{appointments.length}</span>
                  </div>
                  <button className="card-action" onClick={() => switchSection("appointments")}>
                    View all
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                </div>
                <div className="card-body">
                  <div className="appt-list" id="upcomingAppointmentsList">
                    {appointments.length === 0 && (
                      <p style={{ padding: "15px", color: "#666", textAlign: "center" }}>No upcoming appointments found. Book a new one!</p>
                    )}
                    {sortedAppts.map((app) => {
                      const dateObj = new Date(app.date);
                      const day = dateObj.getDate() || "--";
                      const month = dateObj.toLocaleString("default", { month: "short" }) || "--";
                      const status = computeStatus(app);
                      const appTime = app.time || "09:00 AM - 01:00 PM";
                      const safeId = app.appointmentId || app.id || `APP-${Math.floor(Math.random() * 1000)}`;
                      return (
                        <div className="appt-item" key={safeId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #eee" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                            <div className="appt-date-block" style={{ background: "#f1f5f9", padding: "8px 12px", borderRadius: "8px", textAlign: "center" }}>
                              <div className="appt-date-day" style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>{day}</div>
                              <div className="appt-date-month" style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{month}</div>
                            </div>
                            <div className="appt-details">
                              <div className="appt-doctor" style={{ fontWeight: 600, color: "#1e293b" }}>Dept: {app.department}</div>
                              <div className="appt-dept" style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>Booking ID: {safeId}</div>
                              <div className="appt-time" style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>⏰ {appTime}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                            <span className={`badge ${status.cls}`} style={{ fontSize: "11px" }}>{status.text}</span>
                            <button className="btn btn-outline btn-sm" onClick={() => downloadRealSlip(safeId)} style={{ fontSize: "11px", padding: "4px 8px" }} disabled={downloadingId === safeId}>
                              <span className="btn-text">{downloadingId === safeId ? "Generating..." : "Download Slip"}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="tab-content" id="tab-appointments" style={{ display: section === "appointments" ? "block" : "none" }}>
  <div className="card">
    <div className="card-header">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" /></svg>
        All Appointments
      </div>
      <button
        id="openFormBtn"
        className="btn btn-primary btn-sm"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", backgroundColor: "#0d6efd", color: "white", border: "none", padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500, borderRadius: "4px", cursor: "pointer" }}
        onClick={() => setModalOpen(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        Book New Appointment
      </button>
    </div>
    <div className="card-body" style={{ padding: 0 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Date &amp; Time</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="allAppointmentsTableBody">
            {sortedAppts.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "#888" }}>
                  No appointments booked yet.
                </td>
              </tr>
            ) : (
              sortedAppts.map((app) => {
                const dateObj = new Date(app.date);
                const day = dateObj.getDate() || "--";
                const month = dateObj.toLocaleString("default", { month: "short" }) || "--";
                const year = dateObj.getFullYear();
                const status = computeStatus(app);
                const appTime = app.time || "09:00 AM - 01:00 PM";
                const safeId = app.appointmentId || app.id || `APP-${Math.floor(Math.random() * 1000)}`;
                return (
                  <tr key={safeId}>
                    <td className="td-primary" style={{ fontWeight: 600 }}>{safeId}</td>
                    <td>{day} {month} {year}<br /><span className="td-muted" style={{ fontSize: "12px" }}>{appTime}</span></td>
                    <td style={{ fontWeight: 500 }}>{app.department}</td>
                    <td><span className={`badge ${status.cls}`}>{status.text}</span></td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => downloadRealSlip(safeId)} disabled={downloadingId === safeId}>
                        <span className="btn-text">{downloadingId === safeId ? "Generating..." : "Slip PDF"}</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

            <div className="tab-content" id="tab-records" style={{ display: section === "records" ? "block" : "none" }}>
  <div className="card">
    <div className="card-header">
      <div className="card-title">Medical History</div>
    </div>
    <div className="card-body">
   
      {!appointments ? (
        <p style={{ textAlign: "center", padding: "20px" }}>Loading records...</p>
      ) : completedAppts && completedAppts.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {completedAppts.map((app, idx) => (
            <div key={idx} style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "8px" }}>
              <p><strong>Dept:</strong> {app.department}</p>
              <p><strong>Diagnosis:</strong> {app.diagnosis || "Not Updated"}</p>
              <p><strong>Prescription:</strong> {app.prescribedMedicine || "Not Updated"}</p>
            </div>
          ))}
        </div>
      ) : (
       
        <div style={{ padding: "30px", textAlign: "center", color: "#888" }}>
          <p style={{ margin: 0, fontSize: "15px", fontWeight: 500 }}>No Medical Records Found</p>
          <p style={{ fontSize: "13px" }}>You haven't visited any doctors yet or records are pending.</p>
        </div>
      )}
    </div>
  </div>
</div>
          </div>
        </main>
      </div>

      {modalOpen && (
        <div id="appointmentModal" style={{ display: "flex", position: "fixed", zIndex: 9999, left: 0, top: 0, width: "100%", height: "100%", backgroundColor: "rgba(0, 0, 0, 0.5)", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }} onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)", width: "100%", maxWidth: "600px", maxHeight: "90vh", overflowY: "auto", position: "relative", boxSizing: "border-box", color: "#212529" }}>
            <span id="closeModalBtn" style={{ position: "absolute", right: "1.5rem", top: "1.25rem", fontSize: "1.5rem", fontWeight: "bold", color: "#aaa", cursor: "pointer" }} onClick={() => setModalOpen(false)}>&times;</span>

            <h2 style={{ marginTop: 0, marginBottom: "1.5rem", fontSize: "1.5rem", fontWeight: 600, color: "#1a1d20", borderBottom: "2px solid #f8f9fa", paddingBottom: "0.5rem" }}>Book New Appointment</h2>

            <form id="appointmentForm" onSubmit={handleBookingSubmit}>
              
              {/* Added Full Name & ID Group */}
              <div style={{ marginBottom: "1.25rem", display: "flex", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 500 }}>Patient Name</label>
                  <input type="text" readOnly value={profile ? profile.fullName : ""} style={{ width: "100%", padding: "0.575rem 0.75rem", fontSize: "0.95rem", border: "1px solid #dee2e6", borderRadius: "6px", boxSizing: "border-box", backgroundColor: "#e9ecef" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="patientName" style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 500 }}>Patient ID (UHID)</label>
                  <input type="text" id="patientName" required readOnly value={profile ? profile.pId : ""} style={{ width: "100%", padding: "0.575rem 0.75rem", fontSize: "0.95rem", border: "1px solid #dee2e6", borderRadius: "6px", boxSizing: "border-box", backgroundColor: "#e9ecef" }} />
                </div>
              </div>

              <div style={{ marginBottom: "1.25rem", display: "flex", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="patientEmail" style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 500 }}>Email Address</label>
                  <input type="email" id="patientEmail" required readOnly value={profile ? profile.pEmail : ""} style={{ width: "100%", padding: "0.575rem 0.75rem", fontSize: "0.95rem", border: "1px solid #dee2e6", borderRadius: "6px", boxSizing: "border-box", backgroundColor: "#e9ecef" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="patientPhone" style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 500 }}>Phone Number</label>
                  <input type="tel" id="patientPhone" required readOnly value={profile ? profile.pMobile : ""} style={{ width: "100%", padding: "0.575rem 0.75rem", fontSize: "0.95rem", border: "1px solid #dee2e6", borderRadius: "6px", boxSizing: "border-box", backgroundColor: "#e9ecef" }} />
                </div>
              </div>

              <div style={{ marginBottom: "1.25rem", display: "flex", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="department" style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 500 }}>Department *</label>
                  <select id="department" ref={deptRef} required defaultValue="" style={{ width: "100%", padding: "0.575rem 0.75rem", fontSize: "0.95rem", border: "1px solid #dee2e6", borderRadius: "6px", boxSizing: "border-box", backgroundColor: "#fff" }}>
                    <option value="" disabled>Select Department</option>
                    <option value="General Medicine">General Medicine</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="Oncology">Oncology</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="appointmentDate" style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 500 }}>Preferred Date *</label>
                  <input type="date" id="appointmentDate" ref={dateRef} required min={todayDateString} style={{ width: "100%", padding: "0.575rem 0.75rem", fontSize: "0.95rem", border: "1px solid #dee2e6", borderRadius: "6px", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Added Reason for Visit */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 500 }}>Reason for Visit (Optional)</label>
                <textarea ref={reasonRef} rows="2" placeholder="Briefly describe your symptoms..." style={{ width: "100%", padding: "0.575rem 0.75rem", fontSize: "0.95rem", border: "1px solid #dee2e6", borderRadius: "6px", boxSizing: "border-box", fontFamily: "inherit" }}></textarea>
              </div>

              <div style={{ marginBottom: "1.5rem", padding: "1.5rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontWeight: 700, color: "#1e293b", borderBottom: "1px solid #cbd5e1", paddingBottom: "0.5rem" }}>
                  Select Payment Method (₹500)
                </h4>

                <div className="payment-grid">
                  <label className="payment-card">
                    <input type="radio" name="payMode" value="upi" required checked={payMode === "upi"} onChange={() => setPayMode("upi")} />
                    <div className="pay-content">
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#3b82f6" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><path d="M12 8v8m-4-4h8" /></svg>
                      <span>UPI / GPay</span>
                    </div>
                  </label>

                  <label className="payment-card">
                    <input type="radio" name="payMode" value="card" required checked={payMode === "card"} onChange={() => setPayMode("card")} />
                    <div className="pay-content">
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#8b5cf6" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                      <span>Credit Card</span>
                    </div>
                  </label>

                  <label className="payment-card">
                    <input type="radio" name="payMode" value="cash" required checked={payMode === "cash"} onChange={() => setPayMode("cash")} />
                    <div className="pay-content">
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#10b981" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /></svg>
                      <span>Counter</span>
                    </div>
                  </label>
                </div>

                {payMode === "upi" && (
                  <div style={{ marginTop: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: 600, color: "#4a5568" }}>Enter UPI ID</label>
                    <input type="text" ref={upiIdRef} placeholder="username@okhdfcbank" style={{ width: "100%", padding: "0.6rem", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                  </div>
                )}

                {payMode === "card" && (
                  <div style={{ marginTop: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: 600, color: "#4a5568" }}>Card Number</label>
                    <input type="text" ref={cardNumRef} placeholder="1234 5678 9101 1121" style={{ width: "100%", padding: "0.6rem", border: "1px solid #cbd5e1", borderRadius: "6px", marginBottom: "0.5rem" }} />
                    <div style={{ display: "flex", gap: "10px" }}>
                      <input type="text" ref={cardExpRef} placeholder="MM/YY" style={{ width: "50%", padding: "0.6rem", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                      <input type="password" ref={cardCvvRef} placeholder="CVV" maxLength={3} style={{ width: "50%", padding: "0.6rem", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                    </div>
                  </div>
                )}

                {payMode === "cash" && (
                  <div style={{ marginTop: "1rem", padding: "10px", background: "#d1fae5", borderRadius: "6px", color: "#065f46", fontSize: "13px", fontWeight: 600, textAlign: "center" }}>
                    Please pay ₹500 directly at the hospital reception desk on your appointment date.
                  </div>
                )}
              </div>

              <button
                type="submit"
                ref={bookBtnRef}
                disabled={booking}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", backgroundColor: "#0d6efd", color: "white", border: "none", padding: "0.625rem 1.25rem", fontSize: "0.95rem", fontWeight: 500, borderRadius: "6px", cursor: "pointer", width: "100%" }}
              >
                {booking ? "Booking..." : "Confirm Booking"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div id="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast"
            style={{
              backgroundColor: t.type === "error" ? "#f44336" : "#4CAF50",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: "8px",
              marginTop: "10px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}