import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import usePageStyles from "../../components/usePageStyles.js";
import { apiFetch, setToken } from "../../api/client.js";
import cssText from "./MainPage.css?raw";
import logo from "../../assets/img/logo.png";
import aboutImg1 from "../../assets/img/about-2.jpg";
import aboutImg2 from "../../assets/img/about-1.jpg";
import heroBg from "../../assets/img/hero-bg.png";

const DEPARTMENTS_BY_ROLE = {
  Doctor: ["Orthopedics", "Cardiology", "Neurology", "Pediatrics", "General Medicine"],
  "Medical Staff": ["ICU", "Emergency", "Pharmacy"],
  Accounts: ["Pharmacy"],
};

const ROLE_MAP = {
  Doctor: "ROLE_DOCTOR",
  "Medical Staff": "ROLE_STAFF",
  Accounts: "ROLE_ACCOUNTS",
};

export default function MainPage() {
  usePageStyles(cssText, "mainpage");
  const navigate = useNavigate();

  // ── Toast ──
  const [toast, setToast] = useState({ show: false, msg: "", type: "success" });
  const toastTimer = useRef(null);
  function showToast(msg, type = "success") {
    setToast({ show: true, msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3200);
  }

  // ── Modals ──
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [adminForgotOpen, setAdminForgotOpen] = useState(false);
  const [patientTab, setPatientTab] = useState("login"); // login | register | forgot
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("Home");

  useEffect(() => {
    document.body.style.overflow = adminModalOpen || patientModalOpen ? "hidden" : "";
  }, [adminModalOpen, patientModalOpen]);

  // ── Font size / zoom controls ──
  const zoomRef = useRef(1);
  function adjustFont(step) {
    zoomRef.current = Math.max(0.9, Math.min(zoomRef.current + step * 0.05, 1.2));
    document.documentElement.style.zoom = zoomRef.current;
  }
  function resetFont() {
    zoomRef.current = 1;
    document.documentElement.style.zoom = 1;
  }

  // ── Scroll spy for nav links ──
  useEffect(() => {
    const sections = ["services", "about", "departments", "news", "admissions"];
    function onScroll() {
      const scrollY = window.scrollY + 100;
      sections.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const top = el.offsetTop;
        const h = el.offsetHeight;
        if (scrollY >= top && scrollY < top + h) {
          setActiveNav(id);
        }
      });
    }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Fade-in on scroll ──
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".fade-in").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // ── Admin (top navbar) login ──
  const adminUsernameRef = useRef(null);
  const adminPasswordRef = useRef(null);
  async function adminLogin() {
    const email = adminUsernameRef.current.value.trim();
    const password = adminPasswordRef.current.value;
    if (!email || !password) {
      showToast("Please fill all fields", "error");
      return;
    }
    showToast("Authenticating...", "info");
    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      const fullResponse = await response.json();
      const roles = fullResponse.data && fullResponse.data.roles ? fullResponse.data.roles : [];
      if (response.ok && roles.includes("ROLE_ADMIN")) {
        setToken(fullResponse.data.accessToken || "");
        showToast("Admin Login Success 🎉", "success");
        setTimeout(() => navigate("/admin"), 1000);
      } else {
        showToast("Invalid Credentials or Access Denied!", "error");
      }
    } catch (error) {
      showToast("Network Error: Could not connect to the server.", "error");
    }
  }

  // ── Patient login (hero form + modal form share this handler) ──
  const ptIdRef = useRef(null);
  const ptPwdRef = useRef(null);
  const ptModalIdRef = useRef(null);
  const ptModalPwdRef = useRef(null);
  function handlePatientLogin(isModal = false) {
    const emailEl = isModal ? ptModalIdRef.current : ptIdRef.current;
    const pwdEl = isModal ? ptModalPwdRef.current : ptPwdRef.current;
    const email = emailEl.value.trim();
    const pwd = pwdEl.value;

    if (!email || !pwd) {
      showToast("Enter Email & Password", "error");
      return;
    }
    showToast("Logging in...", "info");

    apiFetch("/auth/login", { method: "POST", body: { email, password: pwd } })
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok) {
          showToast(result.message || "Login Failed", "error");
          return;
        }
        if (result.success) {
          setToken(result.data.accessToken);
          showToast("Login Success 🎉", "success");
          setTimeout(() => navigate("/patient"), 1000);
        }
      })
      .catch((err) => {
        console.error(err);
        showToast("Server Error", "error");
      });
  }

  // ── Department (Doctor/Staff/Accounts) hero login ──
  const [adminRole, setAdminRole] = useState("");
  const [adminDept, setAdminDept] = useState("");
  const heroAdminIdRef = useRef(null);
  const heroAdminPwdRef = useRef(null);

  function updateDepartments(role) {
    setAdminRole(role);
    setAdminDept("");
  }

  async function handleHeroLogin(type) {
    const isPatient = type === "patient";
    const emailInput = heroAdminIdRef.current.value.trim();
    const passwordInput = heroAdminPwdRef.current.value.trim();

    const selectedRole = isPatient ? null : adminRole;
    const selectedDept = isPatient ? null : adminDept;

    if (isPatient ? !emailInput || !passwordInput : !emailInput || !passwordInput || !selectedRole || !selectedDept) {
      showToast("Please fill all required fields.", "error");
      return;
    }

    showToast("Logging in...", "info");

    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        body: { email: emailInput, password: passwordInput, department: selectedDept },
      });

      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({}));
        showToast("Login Failed: " + (errorResult.message || "Invalid credentials or Department mismatch!"), "error");
        return;
      }

      const result = await response.json();

      if (result.success || response.ok) {
        const data = result.data || result;
        const userRoles = data.roles || [];

        if (!isPatient) {
          if (!userRoles.includes(ROLE_MAP[selectedRole])) {
            showToast(`❌ Access Denied! You are not authorized as ${selectedRole}.`, "error");
            return;
          }
        }

        setToken(data.accessToken || data.token);
        localStorage.setItem("userEmail", data.email || emailInput);
        localStorage.setItem("userRole", selectedRole || "PATIENT");
        localStorage.setItem("userDept", selectedDept || "N/A");

        showToast("Login Success 🎉", "success");

        setTimeout(() => {
          if (isPatient) {
            navigate("/patient");
          } else if (selectedRole === "Doctor") {
            navigate("/doctor");
          } else if (selectedRole === "Accounts") {
            navigate("/pharmacy");
          } else if (selectedRole === "Medical Staff") {
            navigate("/staff");
          }
        }, 1000);
      } else {
        showToast("Login Failed: " + (result.message || "Invalid credentials"), "error");
      }
    } catch (error) {
      console.error("Login Error: ", error);
      showToast("Network Error: Could not connect to the server.", "error");
    }
  }

  // ── Patient registration ──
  const regRefs = {
    firstName: useRef(null),
    lastName: useRef(null),
    dob: useRef(null),
    mobile: useRef(null),
    email: useRef(null),
    password: useRef(null),
    confirmPassword: useRef(null),
    gender: useRef(null),
    address: useRef(null),
  };

  async function handlePatientRegister(e) {
    if (e) e.preventDefault();

    const firstName = regRefs.firstName.current.value.trim();
    const lastName = regRefs.lastName.current.value.trim();
    const dob = regRefs.dob.current.value;
    const mobile = regRefs.mobile.current.value.trim();
    const email = regRefs.email.current.value.trim();
    const password = regRefs.password.current.value;
    const confirmPassword = regRefs.confirmPassword.current.value;
    const gender = regRefs.gender.current.value;
    const address = regRefs.address.current.value.trim();

    if (!firstName || !lastName || !dob || !mobile || !email || !password || !gender) {
      showToast("Please fill all required fields", "error");
      return;
    }
    if (password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    const requestData = {
      firstName,
      lastName,
      dob,
      mobile,
      email,
      password,
      role: "ROLE_USER",
      gender,
      address,
    };

    try {
      showToast("Creating account...", "info");
      const response = await apiFetch("/auth/register", { method: "POST", body: requestData });
      const result = await response.json();

      if (response.ok) {
        showToast("Registration Success! Please login.", "success");
        Object.values(regRefs).forEach((r) => {
          if (r.current) r.current.value = "";
        });
        setTimeout(() => setPatientTab("login"), 1500);
      } else {
        showToast("Registration Failed: " + (result.message || "Invalid details"), "error");
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      showToast("Network Error: Could not connect to server.", "error");
    }
  }

  // ── Patient forgot password ──
  const forgotRefs = {
    firstName: useRef(null),
    lastName: useRef(null),
    email: useRef(null),
    mobile: useRef(null),
    dob: useRef(null),
    newPwd: useRef(null),
    confirmPwd: useRef(null),
  };

  async function handlePatientForgotPassword(e) {
    if (e) e.preventDefault();

    const firstName = forgotRefs.firstName.current.value.trim();
    const lastName = forgotRefs.lastName.current.value.trim();
    const email = forgotRefs.email.current.value.trim();
    const mobile = forgotRefs.mobile.current.value.trim();
    const dob = forgotRefs.dob.current.value;
    const newPassword = forgotRefs.newPwd.current.value;
    const confirmPassword = forgotRefs.confirmPwd.current.value;

    if (!firstName || !lastName || !email || !mobile || !dob || !newPassword || !confirmPassword) {
      showToast("Please fill all details to verify", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    const requestData = { firstName, lastName, email, mobile, dob, newPassword };

    try {
      showToast("Verifying your details...", "info");
      const response = await apiFetch("/auth/forgot-password", { method: "POST", body: requestData });

      if (response.ok) {
        showToast("Password Reset Successfully 🎉", "success");
        Object.values(forgotRefs).forEach((r) => {
          if (r.current) r.current.value = "";
        });
        setTimeout(() => setPatientTab("login"), 1500);
      } else {
        const error = await response.json().catch(() => ({}));
        showToast("Verification Failed: " + (error.message || "Details mismatched"), "error");
      }
    } catch (error) {
      console.error("Forgot Password Error:", error);
      showToast("Network Error: Could not connect to the server.", "error");
    }
  }

  function resetAdminPassword() {
    showToast("Password changed successfully", "gold");
    setAdminForgotOpen(false);
    setAdminModalOpen(true);
  }

  function openPatientRegister() {
    setPatientModalOpen(true);
    setPatientTab("register");
  }
  function openForgotPassword() {
    setPatientModalOpen(true);
    setPatientTab("forgot");
  }

  // ── 🚀 DYNAMIC ROUTING FUNCTION 🚀 ──

  function handleDynamicRedirect(e, title, type = "feature") {
    e.preventDefault();
    navigate("/coming-soon", { state: { title, type } });
  }

  const navLinks = [
    { label: "Home", id: "Home", href: "#" },
    { label: "Services", id: "services", href: "#services" },
    { label: "Departments", id: "departments", href: "#departments" },
    { label: "About", id: "about", href: "#about" },
    { label: "News", id: "news", href: "#news" },
    { label: "Admissions", id: "admissions", href: "#admissions" },
  ];

  return (
    <>
      <div className="top-bar">
        <div className="container">
          <div className="top-bar-links">
            <a href="#">📞 0416-2281000</a>
            <a href="#">✉ info@medcarehospital.ac.in</a>
            <a href="#">Emergency: 0416-2222102</a>
          </div>
          <div className="top-bar-right">
            <div className="font-size-ctrl">
              <button className="font-btn" onClick={() => adjustFont(1)} title="Increase font">A+</button>
              <button className="font-btn" onClick={() => adjustFont(-1)} title="Decrease font">A-</button>
              <button className="font-btn" onClick={resetFont} title="Reset font">A</button>
            </div>
            <div className="access-btns"></div>
          </div>
        </div>
      </div>

      {/* ── ADMIN LOGIN MODAL ── */}
      <div className={`modal-bg${adminModalOpen ? " open" : ""}`} onClick={(e) => e.target === e.currentTarget && setAdminModalOpen(false)}>
        <div className="modal">
          <div className="modal-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2>Admin Login</h2>
              <span className="modal-close" onClick={() => setAdminModalOpen(false)}>&times;</span>
            </div>
            <div className="form-group">
              <label>Username</label>
              <input type="text" className="form-input" ref={adminUsernameRef} placeholder="Enter Username" />
            </div>
            <div className="form-group">
              <label>Password</label>
           <input 
  type="password" 
  className="form-input" 
  ref={adminPasswordRef} 
  placeholder="Enter Password" 
  onKeyDown={(e) => e.key === 'Enter' && adminLogin()} 
/>
            </div>
            <button className="modal-submit gold" onClick={adminLogin}>Login</button>
          </div>
        </div>
      </div>

      <nav className="navbar">
        <div className="container">
          <a className="nav-logo" href="#">
            <img src={logo} alt="MedCare Logo" style={{ height: "70px", width: "auto", objectFit: "contain" }} />
          </a>
          <div className="nav-links">
            {navLinks.map((l) => (
              <a
                key={l.id}
                href={l.href}
                className={`nav-link${activeNav === l.id ? " active" : ""}`}
                onClick={() => setActiveNav(l.id)}
              >
                {l.label}
              </a>
            ))}
          </div>

          <button className="nav-book-btn" onClick={() => setAdminModalOpen(true)}>⚙ Admin Login</button>

          <div className="hamburger" onClick={() => setMobileOpen((v) => !v)}>
            <span></span><span></span><span></span>
          </div>
        </div>
      </nav>

      <div className={`mobile-menu${mobileOpen ? " open" : ""}`}>
        {navLinks.map((l) => (
          <a key={l.id} href={l.href} className="mobile-nav-link" onClick={() => setMobileOpen(false)}>{l.label}</a>
        ))}
        <div className="mobile-portal-btns">
          <button className="btn btn-primary" onClick={() => { setPatientModalOpen(true); setMobileOpen(false); }}>Patient Login</button>
          <button className="btn btn-gold" onClick={() => { setAdminModalOpen(true); setMobileOpen(false); }}>Admin Login</button>
        </div>
      </div>

      <section className="hero">
        <div className="hero-left" style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.85), rgba(1, 17, 16, 0.363)), url(${heroBg})` }}>
          <div className="hero-eyebrow">Est. 2026 · Premier Medical Institution</div>
          <h1>Transformative Care<br /><em>for over 50 Years</em></h1>
        </div>

        <div className="hero-right">
          <div className="hero-stat-band">
            <div className="hero-stat"><div className="hero-stat-num">1,000<sup>+</sup></div><div className="hero-stat-label">Daily Patients</div></div>
            <div className="hero-stat"><div className="hero-stat-num">50<sup>+</sup></div><div className="hero-stat-label">Years of Service</div></div>
            <div className="hero-stat"><div className="hero-stat-num">100<sup>+</sup></div><div className="hero-stat-label">Departments</div></div>
          </div>

          <div className="hero-portal-split">
            {/* ── PATIENT LOGIN HERO ── (No Changes) */}
            <div className="portal-half patient-half">
              <div className="portal-icon pi">
                <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              <h3 style={{ color: "var(--maroon)" }}>Patient Portal</h3>
              <p>Access records, reports, appointments &amp; billing securely.</p>
              <div className="portal-form">
                <div className="portal-row">
                  <div className="form-group">
                    <label>Patient ID / UHID</label>
                    <input type="text" className="form-input" placeholder="e.g. CMC-2024-001234" ref={ptIdRef} />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                  <input 
  type="password" 
  className="form-input" 
  placeholder="Enter your password" 
  ref={ptPwdRef} 
  onKeyDown={(e) => e.key === 'Enter' && handlePatientLogin(false)} 
/>
                  </div>
                </div>
                <button className="modal-submit maroon" onClick={() => handlePatientLogin(false)}>Sign In to Patient Portal</button>
                <div className="portal-link">
                  New patient?{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); openPatientRegister(); }}>Register here</a>
                  &nbsp;·&nbsp;
                  <a href="#" onClick={(e) => { e.preventDefault(); openForgotPassword(); }} style={{ color: "var(--slate-l)" }}>Forgot password?</a>
                </div>
              </div>
            </div>

            {/* ── DEPARTMENT LOGIN HERO ── (No Changes) */}
            <div className="portal-half admin-half">
              <div className="portal-icon ai">
                <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <h3 style={{ color: "#7a5e20" }}>Department Login</h3>
              <p>Hospital staff, doctors and accounts secure login.</p>

              <div className="portal-form">
                <div className="portal-row" style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Select Role</label>
                    <select
                      className="portal-input gold-focus"
                      value={adminRole}
                      onChange={(e) => updateDepartments(e.target.value)}
                      style={{ width: "100%", boxSizing: "border-box" }}
                    >
                      <option value="">-- Select Role --</option>
                      <option value="Doctor">Doctor</option>
                      <option value="Medical Staff">Medical Staff</option>
                      <option value="Accounts">Accounts</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Select Department</label>
                    <select
                      className="portal-input gold-focus"
                      value={adminDept}
                      onChange={(e) => setAdminDept(e.target.value)}
                      style={{ width: "100%", boxSizing: "border-box" }}
                    >
                      <option value="">-- Select Dept --</option>
                      {(DEPARTMENTS_BY_ROLE[adminRole] || []).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="portal-row">
                  <input type="text" className="portal-input gold-focus" placeholder="Employee ID / Email" ref={heroAdminIdRef} />
                 <input 
  type="password" 
  className="portal-input gold-focus" 
  placeholder="Password" 
  ref={heroAdminPwdRef} 
  onKeyDown={(e) => e.key === 'Enter' && handleHeroLogin("admin")} 
/>
                </div>

                <button className="portal-submit gold-btn" onClick={() => handleHeroLogin("admin")}>Sign In to Department Panel →</button>

                <div className="portal-link">
                  Need access?{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); setAdminModalOpen(true); }}>Contact IT helpdesk</a>
                  &nbsp;·&nbsp;
                  <a href="#" onClick={(e) => { e.preventDefault(); setAdminForgotOpen(true); }}>Forgot password?</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ADMIN FORGOT PASSWORD MODAL ── */}
      <div id="adminForgotModal" className="modal-bg" style={{ display: adminForgotOpen ? "flex" : "none" }}>
        <div className="modal">
          <div className="modal-body">
            <div className="form-group">
              <label>Mobile Number</label>
              <input type="tel" className="form-input" placeholder="+91 98765 43210" />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" className="form-input" placeholder="admin@email.com" />
            </div>
            <div className="form-group">
              <label>OTP Verification</label>
              <div style={{ display: "flex", gap: "15px" }}>
                <input type="text" className="form-input" placeholder="Enter OTP" />
                <button className="modal-submit gold">Get OTP</button>
              </div>
              <button className="modal-submit gold" style={{ marginTop: "15px" }}>Verify OTP</button>
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" className="form-input" placeholder="Enter New Password" />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input type="password" className="form-input" placeholder="Confirm Password" />
            </div>
            <button className="modal-submit gold" onClick={resetAdminPassword}>Submit</button>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setAdminForgotOpen(false); }}
              style={{ display: "block", textAlign: "center", marginTop: "15px", color: "var(--gold)", textDecoration: "none" }}
            >
              ← Cancel
            </a>
          </div>
        </div>
      </div>

      {/* ── PATIENT MODAL (login / register / forgot) ── */}
      <div className={`modal-bg${patientModalOpen ? " open" : ""}`} onClick={(e) => e.target === e.currentTarget && setPatientModalOpen(false)}>
        <div className="modal">
          <div className="modal-body">
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <span className="modal-close" onClick={() => setPatientModalOpen(false)}>&times;</span>
            </div>

            {patientTab === "login" && (
              <div id="ptLoginForm">
                <div className="form-group">
                  <label>Patient ID / UHID</label>
                  <input type="text" className="form-input" placeholder="e.g. CMC-2024-001234" ref={ptModalIdRef} />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input 
  type="password" 
  className="form-input" 
  placeholder="Enter your password" 
  ref={ptModalPwdRef} 
  onKeyDown={(e) => e.key === 'Enter' && handlePatientLogin(true)} 
/>
                </div>
                <a className="forgot-link" onClick={() => setPatientTab("forgot")}>Forgot password?</a>
                <button className="modal-submit maroon" onClick={() => handlePatientLogin(true)}>Sign In to Patient Portal</button>
              </div>
            )}

            {patientTab === "register" && (
              <div id="ptRegisterForm">
                <h3 style={{ marginBottom: "20px", textAlign: "center", color: "var(--maroon)" }}>Create Account</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input type="text" ref={regRefs.firstName} className="form-input" placeholder="First name" required />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input type="text" ref={regRefs.lastName} className="form-input" placeholder="Last name" required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input type="date" ref={regRefs.dob} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select ref={regRefs.gender} className="form-input" required defaultValue="">
                      <option value="" disabled>Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Mobile</label>
                    <input type="tel" ref={regRefs.mobile} className="form-input" placeholder="+91 98765 43210" required />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" ref={regRefs.email} className="form-input" placeholder="patient@email.com" required />
                  </div>
                </div>

                <div className="form-group">
                  <label>Full Address</label>
                  <textarea ref={regRefs.address} className="form-input" placeholder="Enter residential address" rows={2} required></textarea>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Password</label>
                    <input type="password" ref={regRefs.password} className="form-input" placeholder="Password" minLength={8} required />
                  </div>
                  <div className="form-group">
                    <label>Confirm</label>
                    <input type="password" ref={regRefs.confirmPassword} className="form-input" placeholder="Confirm" minLength={8} required />
                  </div>
                </div>

                <button className="modal-submit maroon" onClick={handlePatientRegister}>Create Account</button>

                <div style={{ textAlign: "center", marginTop: "15px" }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); setPatientTab("login"); }} style={{ color: "var(--maroon)", fontWeight: 600, textDecoration: "none" }}>
                    ← Back to Login
                  </a>
                </div>
              </div>
            )}

            {patientTab === "forgot" && (
              <div id="ptForgotForm">
                <h3 style={{ marginBottom: "20px", textAlign: "center", color: "var(--maroon)" }}>Reset Password</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input type="text" ref={forgotRefs.firstName} className="form-input" placeholder="First Name" />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input type="text" ref={forgotRefs.lastName} className="form-input" placeholder="Last Name" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" ref={forgotRefs.email} className="form-input" placeholder="patient@email.com" />
                  </div>
                  <div className="form-group">
                    <label>Mobile Number</label>
                    <input type="tel" ref={forgotRefs.mobile} className="form-input" placeholder="+91 98765 43210" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Date of Birth</label>
                  <input type="date" ref={forgotRefs.dob} className="form-input" />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>New Password</label>
                    <input type="password" ref={forgotRefs.newPwd} className="form-input" placeholder="New Password" />
                  </div>
                  <div className="form-group">
                    <label>Confirm Password</label>
                    <input type="password" ref={forgotRefs.confirmPwd} className="form-input" placeholder="Confirm Password" />
                  </div>
                </div>

                <button className="modal-submit maroon" onClick={handlePatientForgotPassword}>Update Password</button>

                <div style={{ textAlign: "center", marginTop: "15px" }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); setPatientTab("login"); }} style={{ color: "var(--maroon)", fontWeight: 600, textDecoration: "none" }}>
                    ← Back to Login
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ticker">
        <div className="ticker-inner" id="tickerInner">
          <span className="ticker-item"><span className="ticker-dot"></span>MedCare organises health awareness campaign in the city — The Hindu</span>
          <span className="ticker-item"><span className="ticker-dot"></span>New Community Clinic upgrade by MedCare Hospital Campus</span>
          <span className="ticker-item"><span className="ticker-dot"></span>Admissions open for MBBS, Nursing &amp; AHS Courses for 2026-2027</span>
          <span className="ticker-item"><span className="ticker-dot"></span>AHA-ACLS Provider Level Courses — Registration Open</span>
          <span className="ticker-item"><span className="ticker-dot"></span>CME on Autism: A 360° View across the Lifespan — Upcoming Seminar</span>
          <span className="ticker-item"><span className="ticker-dot"></span>Annual Heritage Lecture – Department of Neurological Sciences</span>
        </div>
      </div>

      {/* ── UPDATED DYNAMIC REDIRECT LINKS BELOW ── */}
      <section className="services" id="services">
        <div className="container">
          <div className="section-header fade-in">
            <span className="section-label">What We Offer</span>
            <h2>Our Core Services</h2>
            <p>Comprehensive care spanning medicine, education, and research — all under one roof.</p>
          </div>
          <div className="services-grid">
            {[
              { title: "Medical Services", desc: "World-class diagnostics, surgery, and specialist care across 300+ specialties.", path: "M22 12h-4l-3 9L9 3l-3 9H2", type: "service" },
              { title: "Education", desc: "MBBS, Nursing, allied health sciences, postgraduate and fellowship programmes.", path: "M22 10v6M2 10l10-5 10 5-10 5z", type: "academic" },
              { title: "Research", desc: "Cutting-edge biomedical research contributing to national and global health.", path: "m21 21-4.35-4.35M8 11h6M11 8v6", type: "research" },
              { title: "Our Campuses", desc: "Multiple campuses across Vellore, Ranipet, Chittoor and beyond.", path: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", type: "campus" },
            ].map((s) => (
              <div key={s.title} className="service-card fade-in" onClick={(e) => handleDynamicRedirect(e, s.title, s.type)}>
                <div className="service-icon-wrap">
                  <svg viewBox="0 0 24 24"><path d={s.path} /></svg>
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <span className="service-link">
                  Explore
                  <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-split" id="about">
        <div className="container">
          <div className="about-grid">
            <div className="about-visual fade-in">
              <div className="about-img-stack">
                <div className="about-img-main">
                  <img src={aboutImg1} alt="MedCare Compassionate Service" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div className="about-img-accent">
                  <img src={aboutImg2} alt="MedCare Medical Education" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div className="about-badge">
                  <strong>50+</strong>
                  <span>Years of Service</span>
                </div>
              </div>
            </div>
            <div className="about-content fade-in">
              <span className="section-label">Who We Are</span>
              <h2>A Legacy of Healing &amp; Excellence</h2>
              <p>For discerning patients seeking an expert medical opinion they can genuinely trust, MedCare Medical College and Hospital delivers a wide spectrum of healthcare services under one roof — with integrity, compassion and excellence.</p>
              <p>Every day, thousands of patients from diverse communities near and far visit MedCare, one of the region's leading healthcare destinations and premier medical institutions.</p>
              <a href="#" className="btn btn-primary" onClick={(e) => handleDynamicRedirect(e, "Our Story", "about")}>Read Our Story</a>
              <div className="values-row" style={{ marginTop: "28px" }}>
                <div className="value-item"><span className="value-icon">🤝</span><div className="value-label">Integrity</div></div>
                <div className="value-item"><span className="value-icon">❤</span><div className="value-label">Compassion</div></div>
                <div className="value-item"><span className="value-icon">⭐</span><div className="value-label">Excellence</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="news-events" id="news">
        <div className="container">
          <div className="section-header fade-in">
            <span className="section-label">Stay Informed</span>
            <h2>News &amp; Events</h2>
          </div>
          <div className="ne-grid">
            <div className="ne-col fade-in">
              <h3>Latest News <a href="#" onClick={(e) => handleDynamicRedirect(e, "Latest News", "news")}>View All →</a></h3>
              {[
                { day: "12", month: "Jun '26", title: "MedCare organises health awareness campaign", desc: "The Hindu — Community health outreach event organised across the city zones." },
                { day: "28", month: "May '26", title: "District Collector inaugurates new community clinic", desc: "The Hindu — Modern healthcare facility opened to serve regional suburban populations." },
                { day: "15", month: "May '26", title: "MedCare Community Clinic upgrade — collaborative initiative", desc: "MedCare Campus & District Administration joint press release." },
              ].map((n) => (
                <div className="news-item" key={n.title}>
                  <div className="news-date"><strong>{n.day}</strong><span>{n.month}</span></div>
                  <div className="news-body"><h4>{n.title}</h4><p>{n.desc}</p></div>
                </div>
              ))}
            </div>

            <div className="ne-col fade-in">
              <h3>Upcoming Events <a href="#" onClick={(e) => handleDynamicRedirect(e, "Upcoming Events", "events")}>View All →</a></h3>
              {[
                { title: "Annual Medical Ethics Symposium 2026", desc: "20 June 2026 · Centre for Bioethics and Patient Care" },
                { title: "Workshop on Robotic Surgery — Dept. of Urology", desc: "28 June 2026 · Hands-on training for postgraduate residents" },
                { title: "AHA-ACLS Provider Level Certification Course", desc: "12 July 2026 · Advanced Cardiovascular Life Support Training" },
              ].map((ev) => (
                <div className="event-item" key={ev.title}>
                  <div className="event-dot"></div>
                  <div className="event-body"><h4>{ev.title}</h4><p>{ev.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="departments" id="departments">
        <div className="container">
          <div className="section-header fade-in">
            <span className="section-label">Specialties</span>
            <h2>Our Departments</h2>
            <p>Over 300 specialties and subspecialties providing comprehensive care.</p>
          </div>
          <div className="dept-grid fade-in">
            {[
              "Cardiology & Cardiothoracic Surgery",
              "Neurological Sciences",
              "Oncology & Haematology",
              "Orthopaedics & Trauma",
              "Paediatrics & Neonatology",
              "Obstetrics & Gynaecology",
              "Radiology & Imaging Sciences",
              "Ophthalmology",
            ].map((d) => (
              <div className="dept-item" key={d} onClick={(e) => handleDynamicRedirect(e, d, "department")}>
                <div className="dept-dot"></div>
                <span>{d}</span>
                <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "32px" }}>
            <button className="btn btn-outline" onClick={(e) => handleDynamicRedirect(e, "All Departments", "department")}>View All Departments</button>
          </div>
        </div>
      </section>

      <section className="alumni">
        <div className="container">
          <div className="section-header fade-in">
            <span className="section-label">Distinguished Graduates</span>
            <h2 style={{ color: "#fff" }}>Notable Alumni</h2>
            <p>MedCare's alumni have gone on to shape medicine, public health, and healthcare research worldwide.</p>
          </div>
          <div className="alumni-grid fade-in">
            {[
              { initials: "AR", name: "Dr. Arvind Raghavan", role: "Pioneering Cardiologist & Healthcare Innovator" },
              { initials: "SH", name: "Dr. Sarah Hunter", role: "Global Public Health Specialist & Researcher" },
              { initials: "VK", name: "Dr. Vikram Kapoor", role: "Renowned Neurosurgeon & Academic Dean" },
              { initials: "MA", name: "Dr. Meera Alva", role: "Pediatrician & Rural Healthcare Advocate" },
              { initials: "DN", name: "Dr. David Norton", role: "Director of International Medical Research Corps" },
            ].map((a) => (
              <div className="alumni-card" key={a.initials}>
                <div className="alumni-avatar">{a.initials}</div>
                <h4>{a.name}</h4>
                <p>{a.role}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "32px" }}>
            <button className="btn btn-white" style={{ color: "var(--maroon)" }} onClick={(e) => handleDynamicRedirect(e, "Alumni Directory", "alumni")}>View All Alumni</button>
          </div>
        </div>
      </section>

      <section className="admissions-banner" id="admissions">
        <div className="container">
          <div className="ab-grid fade-in">
            <div>
              <span className="ab-badge">2026 Admissions Open</span>
              <h2>Over 100 Years of Medical Education</h2>
              <p>Extensive undergraduate, postgraduate and higher speciality courses in medicine, nursing, allied health sciences and related disciplines.</p>
            </div>
            <div className="ab-ctas">
              <button className="btn btn-primary" style={{ fontSize: "15px", padding: "13px 30px" }} onClick={(e) => handleDynamicRedirect(e, "2026 Admissions Application", "admission")}>Apply Now</button>
              <button className="btn btn-outline" onClick={(e) => handleDynamicRedirect(e, "Prospectus & Syllabus", "academic")}>Download Prospectus</button>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <img src={logo} alt="MedCare Footer Logo" className="footer-brand-logo" />
              <p>We seek to advance the art of healing and healthcare through excellence in education, compassionate service, and innovative research.</p>
            </div>
            <div className="footer-col">
              <h4>Quick Links</h4>
              <ul>
                {/* PATIENT PORTAL HAS NOT BEEN CHANGED */}
                <li><a href="#" onClick={(e) => { e.preventDefault(); setPatientModalOpen(true); setPatientTab("login"); }}>Patient Portal</a></li>
                <li><a href="#" onClick={(e) => handleDynamicRedirect(e, "Find a Doctor", "feature")}>Find a Doctor</a></li>
                <li><a href="#" onClick={(e) => handleDynamicRedirect(e, "Emergency Services", "service")}>Emergency Services</a></li>
                <li><a href="#" onClick={(e) => handleDynamicRedirect(e, "Support & Donations", "feature")}>Support MedCare</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Academic</h4>
              <ul>
                <li><a href="#" onClick={(e) => handleDynamicRedirect(e, "Admissions 2026", "admission")}>Admissions 2026</a></li>
                <li><a href="#" onClick={(e) => handleDynamicRedirect(e, "MBBS Programme", "academic")}>MBBS Programme</a></li>
                <li><a href="#" onClick={(e) => handleDynamicRedirect(e, "Nursing Courses", "academic")}>Nursing Courses</a></li>
                <li><a href="#" onClick={(e) => handleDynamicRedirect(e, "Postgraduate Degrees", "academic")}>Postgraduate</a></li>
                <li><a href="#" onClick={(e) => handleDynamicRedirect(e, "Research Innovations", "research")}>Research</a></li>
              </ul>
            </div>
            <div className="footer-contact">
              <h4 style={{ color: "#ffffff", fontWeight: 700, paddingBottom: "10px" }}>Contact Us</h4>
              <p>
                <span className="contact-icon"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg></span>
                MedCare Hospital, Campus Drive, City Tech Zone — 600 001
              </p>
              <p>
                <span className="contact-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.6a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg></span>
                044-23456789 &nbsp;|&nbsp; Emergency: 044-23456700
              </p>
              <p>
                <span className="contact-icon"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg></span>
                info@medcarehospital.com
              </p>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 MedCare Hospital. All rights reserved.</span>
            <div>
              <a href="#" onClick={(e) => handleDynamicRedirect(e, "Privacy Policy", "policy")}>Privacy Policy</a>
              <a href="#" onClick={(e) => handleDynamicRedirect(e, "Disclaimer", "policy")}>Disclaimer</a>
              <a href="#" onClick={(e) => handleDynamicRedirect(e, "Sitemap", "policy")}>Sitemap</a>
            </div>
          </div>
        </div>
      </footer>

      <div className={`toast ${toast.type === "gold" ? "gold" : toast.type}${toast.show ? " show" : ""}`} id="toast">
        <span className="toast-icon" id="toastIcon">{toast.type === "success" ? "✓" : toast.type === "gold" ? "★" : "ℹ"}</span>
        <span id="toastMsg">{toast.msg}</span>
      </div>
    </>
  );
}