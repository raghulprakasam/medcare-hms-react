import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import usePageStyles from "../../components/usePageStyles.js";
import { apiFetch, clearToken, getToken } from "../../api/client.js";
import cssText from "./AdminPage.css?raw";

function classifyRole(u) {
  const rStr = String(u.role || (u.roles ? u.roles[0] : "")).toUpperCase();
  if (rStr.includes("DOCTOR") || u.medicalLicense) return "DOCTOR";
  if (rStr.includes("ACCOUNT") || u.financialRole || u.employeeId) return "ACCOUNTS";
  if (rStr.includes("STAFF") || rStr.includes("NURSE") || u.assignedWard || u.staffRole) return "STAFF";
  return "PATIENT";
}

const ROLE_BADGE = {
  DOCTOR: { label: "Doctor", bg: "var(--accent-light)", fg: "var(--accent)" },
  ACCOUNTS: { label: "Accounts", bg: "var(--amber-light)", fg: "var(--amber)" },
  STAFF: { label: "Medical Staff", bg: "var(--success-light)", fg: "var(--success)" },
  PATIENT: { label: "Patient", bg: "#F1F5F9", fg: "#475569" },
};

export default function AdminPage() {
  usePageStyles(cssText, "adminpage");
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState("overview"); // overview | accounts | all-users
  const [accountTab, setAccountTab] = useState("doctor"); // doctor | staff | finance
  const [roleFilter, setRoleFilter] = useState("ALL"); // 'ALL' filter added for better view
  const [search, setSearch] = useState("");

  const [adminName, setAdminName] = useState("Loading...");
  const [stats, setStats] = useState({ doctors: 0, patients: 0, staff: 0 });
  const [users, setUsers] = useState([]);
  const [toasts, setToasts] = useState([]);

  const [editUser, setEditUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteAgree, setDeleteAgree] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);

  // Password visibility states
  const [showDocPwd, setShowDocPwd] = useState(false);
  const [showStaffPwd, setShowStaffPwd] = useState(false);
  const [showFinPwd, setShowFinPwd] = useState(false);

  function showToast(type, title, msg) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, title, msg }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3800);
  }

  function logout() {
    clearToken();
    navigate("/");
  }

  async function loadAdminProfile() {
    try {
      const res = await apiFetch("/auth/profile");
      if (res.ok) {
        const admin = await res.json();
        setAdminName(admin.firstName || "Admin");
      }
    } catch (err) {
      console.error("Profile Error:", err);
    }
  }

  async function loadDashboardStats(userList) {
    try {
      const pRes = await apiFetch("/admin/patients/count");
      const pCount = pRes.ok ? await pRes.json() : 0;
      let docCount = 0;
      let staffCount = 0;
      userList.forEach((u) => {
        const key = classifyRole(u);
        if (key === "DOCTOR") docCount++;
        else if (key === "STAFF" || key === "ACCOUNTS") staffCount++;
      });
      setStats({ doctors: docCount, patients: pCount, staff: staffCount });
    } catch (err) {
      console.error("Stats Error:", err);
    }
  }

  async function loadAllUsers() {
    try {
      const res = await apiFetch("/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        loadDashboardStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      navigate("/");
      return;
    }
    loadAdminProfile();
    loadAllUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  function goView(name) {
    setView(name);
    closeSidebar();
  }

  const filteredUsers = useMemo(() => {
    const term = search.toLowerCase();
    return users.filter((u) => {
      const roleKey = classifyRole(u);
      if (roleFilter !== "ALL" && roleKey !== roleFilter) return false;
      if (!term) return true;
      const nameStr = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
      const emailStr = (u.email || "").toLowerCase();
      return nameStr.includes(term) || emailStr.includes(term);
    });
  }, [users, roleFilter, search]);

  // ── Create account forms ──
  const docRefs = { fname: useRef(), lname: useRef(), gender: useRef(), dob: useRef(), email: useRef(), phone: useRef(), dept: useRef(), license: useRef(), pwd: useRef() };
  const staffRefs = { fname: useRef(), lname: useRef(), gender: useRef(), dob: useRef(), email: useRef(), phone: useRef(), ward: useRef(), role: useRef(), pwd: useRef() };
  const finRefs = { fname: useRef(), lname: useRef(), gender: useRef(), dob: useRef(), email: useRef(), phone: useRef(), dept: useRef(), empid: useRef(), pwd: useRef() };

  async function handleCreateAccount(e, type) {
    e.preventDefault();
    const formElement = e.target; // Used for easy form resetting
    setCreating(true);

    let payload = {};
    let refs;

    if (type === "Doctor") {
      refs = docRefs;
      payload = {
        firstName: refs.fname.current.value,
        lastName: refs.lname.current.value,
        gender: refs.gender.current.value,
        email: refs.email.current.value,
        mobile: refs.phone.current.value,
        dob: refs.dob.current.value,
        password: refs.pwd.current.value,
        role: "ROLE_DOCTOR",
        department: refs.dept.current.value,
        medicalLicense: refs.license.current.value,
      };
    } else if (type === "Medical Staff") {
      refs = staffRefs;
      payload = {
        firstName: refs.fname.current.value,
        lastName: refs.lname.current.value,
        gender: refs.gender.current.value,
        email: refs.email.current.value,
        mobile: refs.phone.current.value,
        dob: refs.dob.current.value,
        password: refs.pwd.current.value,
        role: "ROLE_STAFF",
        assignedWard: refs.ward.current.value,
        staffRole: refs.role.current.value,
      };
    } else if (type === "Accounts Staff") {
      refs = finRefs;
      payload = {
        firstName: refs.fname.current.value,
        lastName: refs.lname.current.value,
        gender: refs.gender.current.value,
        email: refs.email.current.value,
        mobile: refs.phone.current.value,
        dob: refs.dob.current.value,
        password: refs.pwd.current.value,
        role: "ROLE_ACCOUNTS",
        department: "Pharmacy",
        financialRole: refs.dept.current.value,
        employeeId: refs.empid.current.value,
      };
    }

    try {
      const response = await apiFetch("/auth/register-staff", { method: "POST", body: payload });
      if (response.ok) {
        showToast("success", "Success", type + " account created!");
        formElement.reset(); // This natively clears all inputs and select boxes perfectly!
        loadAllUsers();
      } else {
        const error = await response.json().catch(() => ({}));
        showToast("error", "Failed", error.message || "Could not create account");
      }
    } catch (err) {
      showToast("error", "Network Error", "Check your backend connection.");
    } finally {
      setCreating(false);
    }
  }

  // ── Edit user ──
  function openEditModal(id) {
    const user = users.find((u) => (u.id || u.userId || u.patientId) === id);
    if (!user) return;
    setEditUser({
      id,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.mobile || user.phone || "",
    });
  }
  
  function closeEditModal() {
    setEditUser(null);
  }

  async function handleSaveEditUser(e) {
    e.preventDefault();
    const payload = {
      firstName: editUser.firstName,
      lastName: editUser.lastName,
      email: editUser.email,
      mobile: editUser.phone,
    };
    try {
      const res = await apiFetch(`/admin/users/${editUser.id}`, { method: "PUT", body: payload });
      if (res.ok) {
        showToast("success", "Updated", "User details updated successfully!");
        closeEditModal();
        loadAllUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", "Update Failed", err.message || "Error updating user.");
      }
    } catch (err) {
      showToast("error", "Network Error", "Could not reach backend.");
    }
  }

  // ── Delete user ──
  function deleteUser(id, name) {
    setDeleteAgree(false);
    setDeleteTarget({ id, name: name || "this user" });
  }

  function closeDeleteModal() {
    setDeleteTarget(null);
  }

  async function executeDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Deleted", "User permanently removed!");
        closeDeleteModal();
        loadAllUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", "Delete Failed", err.message || "Error deleting user.");
        closeDeleteModal();
      }
    } catch (err) {
      showToast("error", "Network Error", "Could not reach backend.");
      closeDeleteModal();
    } finally {
      setDeleting(false);
    }
  }

  // Fixed Toggle Password Function (Pure React State)
  function togglePwd(setShowState) {
    setShowState((prev) => !prev);
  }

 return (
    <div className="admin-layout-wrapper">
      <div id="sidebar-overlay" className={sidebarOpen ? "open" : ""} onClick={closeSidebar}></div>

      <aside id="sidebar" className={sidebarOpen ? "open" : ""}>
        <div className="sidebar-brand">
          <a className="brand-logo" href="#/">
            <div className="brand-icon"><i className="fa-solid fa-heart-pulse"></i></div>
            <div className="brand-text">
              <span className="brand-name">MediCore</span>
              <span className="brand-sub">Hospital System</span>
            </div>
          </a>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Main</div>
          <a href="#/" className={`nav-item${view === "overview" ? " active" : ""}`} onClick={(e) => { e.preventDefault(); goView("overview"); }}>
            <i className="fa-solid fa-grid-2"></i> Overview
          </a>
          <a href="#/" className={`nav-item${view === "accounts" ? " active" : ""}`} onClick={(e) => { e.preventDefault(); goView("accounts"); }}>
            <i className="fa-solid fa-user-plus"></i> Create Accounts
          </a>

          <div className="nav-section-label">Management</div>
          <a href="#/" className={`nav-item${view === "all-users" ? " active" : ""}`} onClick={(e) => { e.preventDefault(); goView("all-users"); }}>
            <i className="fa-solid fa-users"></i> Patients &amp; Staff
          </a>
          <a href="#/" className="nav-item" onClick={(e) => { e.preventDefault(); goView("overview"); }}>
            <i className="fa-solid fa-chart-bar"></i> Reports
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar-sm" id="sidebarAvatar">{adminName ? adminName[0] : "--"}</div>
            <div className="user-info-sm">
              <div className="user-name" id="sidebarName">{adminName}</div>
              <div className="user-role">System Administrator</div>
            </div>
          </div>
        </div>
      </aside>

      <div id="app-shell">
        <header id="header">
          <button className="header-hamburger" onClick={() => setSidebarOpen(true)}>
            <i className="fa-solid fa-bars"></i>
          </button>
          <div className="header-breadcrumb">
            <span id="page-title" className="page-title">Admin Dashboard</span>
            <span id="page-sub" className="page-sub">Welcome back</span>
          </div>
          <div className="header-actions">
            <button className="header-icon-btn"><i className="fa-regular fa-bell"></i></button>
            <div className="header-divider"></div>
            <div className="header-profile">
              <div className="user-avatar" id="headerAvatar">{adminName ? adminName[0] : "--"}</div>
              <div className="profile-info">
                <div className="profile-name" id="headerName">{adminName}</div>
                <div className="profile-role">Administrator</div>
              </div>
            </div>
            <button className="btn-logout" onClick={logout}>
              <i className="fa-solid fa-right-from-bracket"></i> <span>Logout</span>
            </button>
          </div>
        </header>

        <main id="main-content">
          {view === "overview" && (
            <div id="view-overview" className="view active">
              <div className="section-eyebrow"><i className="fa-solid fa-grid-2"></i> Dashboard Overview</div>
              <h1 className="section-title">Control Panel</h1>
              <p className="section-desc">Hospital-wide summary and quick actions.</p>

              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-icon blue"><i className="fa-solid fa-user-doctor"></i></div>
                  <div className="stat-value" id="stat-doctors">{stats.doctors}</div>
                  <div className="stat-label">Active Doctors</div>
                  <div className="stat-trend up"><i className="fa-solid fa-arrow-trend-up"></i> Live API Data</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon green"><i className="fa-solid fa-bed-pulse"></i></div>
                  <div className="stat-value" id="stat-patients">{stats.patients}</div>
                  <div className="stat-label">Admitted Patients</div>
                  <div className="stat-trend up"><i className="fa-solid fa-arrow-trend-up"></i> Live API Data</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon amber"><i className="fa-solid fa-user-nurse"></i></div>
                  <div className="stat-value" id="stat-staff">{stats.staff}</div>
                  <div className="stat-label">Medical Staff</div>
                  <div className="stat-trend up"><i className="fa-solid fa-arrow-trend-up"></i> Live API Data</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap" }}>
                <button className="btn btn-success" onClick={() => goView("accounts")}>
                  <i className="fa-solid fa-user-plus"></i> Create New Account
                </button>
                <button className="btn btn-secondary" onClick={() => goView("all-users")}>
                  <i className="fa-solid fa-users"></i> View Patients &amp; Staff
                </button>
              </div>
            </div>
          )}

          {view === "accounts" && (
            <div id="view-accounts" className="view active">
              <div className="section-eyebrow"><i className="fa-solid fa-user-plus"></i> Section A</div>
              <h1 className="section-title">Create User Accounts</h1>
              <p className="section-desc">Register new doctors, medical staff, or accounts personnel into the system.</p>

              <div className="tab-bar">
                <button className={`tab-item${accountTab === "doctor" ? " active" : ""}`} onClick={() => setAccountTab("doctor")}><i className="fa-solid fa-user-doctor"></i> Doctor Account</button>
                <button className={`tab-item${accountTab === "staff" ? " active" : ""}`} onClick={() => setAccountTab("staff")}><i className="fa-solid fa-user-nurse"></i> Medical Staff</button>
                <button className={`tab-item${accountTab === "finance" ? " active" : ""}`} onClick={() => setAccountTab("finance")}><i className="fa-solid fa-user-tie"></i> Accounts Staff</button>
              </div>

              {accountTab === "doctor" && (
                <div id="tab-panel-doctor" className="tab-panel active">
                  <div className="card">
                    <div className="card-header"><div className="card-header-icon blue"><i className="fa-solid fa-user-doctor"></i></div><div className="card-header-text"><div className="card-title">New Doctor Account</div></div></div>
                    <div className="form-card-body">
                      <form id="form-doctor" onSubmit={(e) => handleCreateAccount(e, "Doctor")}>
                        <div className="form-grid">
                          <div className="form-group"><label className="form-label">First Name *</label><div className="input-group"><i className="fa-solid fa-user input-icon"></i><input type="text" ref={docRefs.fname} className="form-control" required /></div></div>
                          <div className="form-group"><label className="form-label">Last Name *</label><div className="input-group"><i className="fa-solid fa-user input-icon"></i><input type="text" ref={docRefs.lname} className="form-control" required /></div></div>

                          <div className="form-group">
                            <label className="form-label">Gender *</label>
                            <div className="input-group"><i className="fa-solid fa-venus-mars input-icon"></i>
                              <select ref={docRefs.gender} className="form-control" required defaultValue="">
                                <option value="" disabled>Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          </div>

                          <div className="form-group"><label className="form-label">Date of Birth *</label><div className="input-group"><i className="fa-regular fa-calendar input-icon"></i><input type="date" ref={docRefs.dob} className="form-control" required /></div></div>
                          <div className="form-group"><label className="form-label">Email Address *</label><div className="input-group"><i className="fa-regular fa-envelope input-icon"></i><input type="email" ref={docRefs.email} className="form-control" required /></div></div>
                          <div className="form-group"><label className="form-label">Phone Number *</label><div className="input-group"><i className="fa-solid fa-phone input-icon"></i><input type="tel" ref={docRefs.phone} className="form-control" required /></div></div>

                          <div className="form-group">
                            <label className="form-label">Department *</label>
                            <div className="input-group"><i className="fa-solid fa-stethoscope input-icon"></i>
                              <select ref={docRefs.dept} className="form-control" required defaultValue="Orthopedics">
                                <option value="Orthopedics">Orthopedics</option>
                                <option value="Cardiology">Cardiology</option>
                                <option value="Neurology">Neurology</option>
                                <option value="Pediatrics">Pediatrics</option>
                                <option value="General Medicine">General Medicine</option>
                              </select>
                            </div>
                          </div>
                          <div className="form-group"><label className="form-label">Medical License No *</label><div className="input-group"><i className="fa-solid fa-id-card input-icon"></i><input type="text" ref={docRefs.license} className="form-control" required /></div></div>

                          <div className="form-group" style={{ gridColumn: "span 2" }}>
                            <label className="form-label">Temporary Password * <span style={{ color: "var(--amber)", textTransform: "none", fontWeight: "normal", marginLeft: "5px" }}>(User must change this on first login)</span></label>
                            <div className="input-group pwd-wrap">
                              <i className="fa-solid fa-lock input-icon"></i>
                              <input type={showDocPwd ? "text" : "password"} ref={docRefs.pwd} className="form-control" placeholder="Set temporary password" required />
                              <button type="button" className="pwd-toggle" onClick={() => togglePwd(setShowDocPwd)}><i className={`fa-regular ${showDocPwd ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                            </div>
                          </div>
                        </div>
                        <div className="divider"></div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                          <button type="reset" className="btn btn-secondary">Clear</button>
                          <button type="submit" className="btn btn-primary btn-lg" disabled={creating}>{creating ? "Creating..." : "Create Doctor Account"}</button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {accountTab === "staff" && (
                <div id="tab-panel-staff" className="tab-panel active">
                  <div className="card">
                    <div className="card-header"><div className="card-header-icon green"><i className="fa-solid fa-user-nurse"></i></div><div className="card-header-text"><div className="card-title">New Medical Staff Account</div></div></div>
                    <div className="form-card-body">
                      <form id="form-staff" onSubmit={(e) => handleCreateAccount(e, "Medical Staff")}>
                        <div className="form-grid">
                          <div className="form-group"><label className="form-label">First Name *</label><div className="input-group"><i className="fa-solid fa-user input-icon"></i><input type="text" ref={staffRefs.fname} className="form-control" required /></div></div>
                          <div className="form-group"><label className="form-label">Last Name *</label><div className="input-group"><i className="fa-solid fa-user input-icon"></i><input type="text" ref={staffRefs.lname} className="form-control" required /></div></div>

                          <div className="form-group">
                            <label className="form-label">Gender *</label>
                            <div className="input-group"><i className="fa-solid fa-venus-mars input-icon"></i>
                              <select ref={staffRefs.gender} className="form-control" required defaultValue="">
                                <option value="" disabled>Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          </div>

                          <div className="form-group"><label className="form-label">Date of Birth *</label><div className="input-group"><i className="fa-regular fa-calendar input-icon"></i><input type="date" ref={staffRefs.dob} className="form-control" required /></div></div>
                          <div className="form-group"><label className="form-label">Email Address *</label><div className="input-group"><i className="fa-regular fa-envelope input-icon"></i><input type="email" ref={staffRefs.email} className="form-control" required /></div></div>
                          <div className="form-group"><label className="form-label">Phone Number *</label><div className="input-group"><i className="fa-solid fa-phone input-icon"></i><input type="tel" ref={staffRefs.phone} className="form-control" required /></div></div>

                          <div className="form-group">
                            <label className="form-label">Assigned Ward *</label>
                            <div className="input-group"><i className="fa-solid fa-bed-pulse input-icon"></i>
                              <select ref={staffRefs.ward} className="form-control" required defaultValue="ICU">
                                <option value="ICU">ICU</option>
                                <option value="Emergency">Emergency</option>
                              </select>
                            </div>
                          </div>
                          <div className="form-group"><label className="form-label">Staff Role *</label><div className="input-group"><i className="fa-solid fa-user-nurse input-icon"></i>
                            <select ref={staffRefs.role} className="form-control" defaultValue="Nurse">
                              <option>Nurse</option>
                              <option>Technician</option>
                            </select>
                          </div></div>

                          <div className="form-group" style={{ gridColumn: "span 2" }}>
                            <label className="form-label">Temporary Password * <span style={{ color: "var(--amber)", textTransform: "none", fontWeight: "normal", marginLeft: "5px" }}>(User must change this on first login)</span></label>
                            <div className="input-group pwd-wrap">
                              <i className="fa-solid fa-lock input-icon"></i>
                              <input type={showStaffPwd ? "text" : "password"} ref={staffRefs.pwd} className="form-control" placeholder="Set temporary password" required />
                              <button type="button" className="pwd-toggle" onClick={() => togglePwd(setShowStaffPwd)}><i className={`fa-regular ${showStaffPwd ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                            </div>
                          </div>
                        </div>
                        <div className="divider"></div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                          <button type="reset" className="btn btn-secondary">Clear</button>
                          <button type="submit" className="btn btn-success btn-lg" disabled={creating}>{creating ? "Creating..." : "Create Staff Account"}</button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {accountTab === "finance" && (
                <div id="tab-panel-finance" className="tab-panel active">
                  <div className="card">
                    <div className="card-header"><div className="card-header-icon amber"><i className="fa-solid fa-user-tie"></i></div><div className="card-header-text"><div className="card-title">New Accounts Staff Account</div></div></div>
                    <div className="form-card-body">
                      <form id="form-finance" onSubmit={(e) => handleCreateAccount(e, "Accounts Staff")}>
                        <div className="form-grid">
                          <div className="form-group"><label className="form-label">First Name *</label><div className="input-group"><i className="fa-solid fa-user input-icon"></i><input type="text" ref={finRefs.fname} className="form-control" required /></div></div>
                          <div className="form-group"><label className="form-label">Last Name *</label><div className="input-group"><i className="fa-solid fa-user input-icon"></i><input type="text" ref={finRefs.lname} className="form-control" required /></div></div>

                          <div className="form-group">
                            <label className="form-label">Gender *</label>
                            <div className="input-group"><i className="fa-solid fa-venus-mars input-icon"></i>
                              <select ref={finRefs.gender} className="form-control" required defaultValue="">
                                <option value="" disabled>Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          </div>

                          <div className="form-group"><label className="form-label">Date of Birth *</label><div className="input-group"><i className="fa-regular fa-calendar input-icon"></i><input type="date" ref={finRefs.dob} className="form-control" required /></div></div>
                          <div className="form-group"><label className="form-label">Email Address *</label><div className="input-group"><i className="fa-regular fa-envelope input-icon"></i><input type="email" ref={finRefs.email} className="form-control" required /></div></div>
                          <div className="form-group"><label className="form-label">Phone Number *</label><div className="input-group"><i className="fa-solid fa-phone input-icon"></i><input type="tel" ref={finRefs.phone} className="form-control" required /></div></div>

                          <div className="form-group">
                            <label className="form-label">Department / Branch *</label>
                            <div className="input-group"><i className="fa-solid fa-building input-icon"></i>
                              <select ref={finRefs.dept} className="form-control" required defaultValue="Pharmacy">
                                <option value="Pharmacy">Pharmacy</option>
                              </select>
                            </div>
                          </div>

                          <div className="form-group"><label className="form-label">Employee ID *</label><div className="input-group"><i className="fa-solid fa-id-badge input-icon"></i><input type="text" ref={finRefs.empid} className="form-control" required /></div></div>

                          <div className="form-group" style={{ gridColumn: "span 2" }}>
                            <label className="form-label">Temporary Password * <span style={{ color: "var(--amber)", textTransform: "none", fontWeight: "normal", marginLeft: "5px" }}>(User must change this on first login)</span></label>
                            <div className="input-group pwd-wrap">
                              <i className="fa-solid fa-lock input-icon"></i>
                              <input type={showFinPwd ? "text" : "password"} ref={finRefs.pwd} className="form-control" placeholder="Set temporary password" required />
                              <button type="button" className="pwd-toggle" onClick={() => togglePwd(setShowFinPwd)}><i className={`fa-regular ${showFinPwd ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                            </div>
                          </div>
                        </div>
                        <div className="divider"></div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                          <button type="reset" className="btn btn-secondary">Clear</button>
                          <button type="submit" className="btn btn-lg" style={{ background: "var(--amber)", color: "#fff" }} disabled={creating}>{creating ? "Creating..." : "Create Accounts Account"}</button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {view === "all-users" && (
            <div id="view-all-users" className="view active">
              <div className="section-eyebrow"><i className="fa-solid fa-users"></i> Directory</div>
              <h1 className="section-title">Patients &amp; Staff List</h1>

              <div className="card" style={{ marginTop: "20px" }}>
                <div className="card-header" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div className="table-filter-actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {[
                      ["ALL", "All Users"], // Added 'All Users' tab for better functionality
                      ["PATIENT", "Patients"],
                      ["DOCTOR", "Doctors"],
                      ["STAFF", "Medical Staff"],
                      ["ACCOUNTS", "Accounts"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        className={`btn btn-tab${roleFilter === key ? " btn-primary active" : " btn-secondary"}`}
                        onClick={() => setRoleFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="input-group" style={{ width: "250px", marginTop: "10px" }}>
                    <i className="fa-solid fa-magnifying-glass input-icon"></i>
                    <input type="text" id="staffSearch" className="form-control" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                </div>
                <div className="card-body" style={{ padding: 0, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "600px" }}>
                    <thead>
                      <tr style={{ background: "var(--bg-canvas)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "14px 22px", fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Name</th>
                        <th style={{ padding: "14px 22px", fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Role</th>
                        <th style={{ padding: "14px 22px", fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Email</th>
                        <th style={{ padding: "14px 22px", fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Phone</th>
                        <th style={{ padding: "14px 22px", fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody id="allUsersTbody">
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>No matching records found.</td></tr>
                      )}
                      {filteredUsers.map((u) => {
                        const roleKey = classifyRole(u);
                        const badge = ROLE_BADGE[roleKey];
                        const uId = u.id || u.userId || u.patientId;
                        return (
                          <tr className="user-row" data-role={roleKey} key={uId} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "14px 22px", fontSize: "14px", fontWeight: 600 }}>{u.firstName || "-"} {u.lastName || ""}</td>
                            <td style={{ padding: "14px 22px" }}>
                              <span style={{ background: badge.bg, color: badge.fg, padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>{badge.label}</span>
                            </td>
                            <td style={{ padding: "14px 22px", fontSize: "13px", color: "var(--text-secondary)" }}>{u.email || "-"}</td>
                            <td style={{ padding: "14px 22px", fontSize: "13px", color: "var(--text-secondary)" }}>{u.mobile || u.phone || "-"}</td>
                            <td style={{ padding: "14px 22px", whiteSpace: "nowrap" }}>
                              <button className="btn-action btn-edit" onClick={() => openEditModal(uId)} title="Edit"><i className="fa-solid fa-pen"></i></button>
                              <button className="btn-action btn-delete" onClick={() => deleteUser(uId, u.firstName)} title="Delete"><i className="fa-solid fa-trash"></i></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>

        <div id="editUserModal" className={`modal-bg${editUser ? " open" : ""}`}>
          <div className="modal-content">
            <div className="card-header" style={{ borderBottom: "1px solid var(--border)", padding: "16px 24px" }}>
              <div className="card-header-icon blue" style={{ width: "30px", height: "30px", fontSize: "14px" }}><i className="fa-solid fa-user-pen"></i></div>
              <div className="card-header-text">
                <div className="card-title" style={{ fontSize: "15px" }}>Edit User Details</div>
              </div>
              <button onClick={closeEditModal} style={{ position: "absolute", right: "20px", top: "20px", background: "none", border: "none", fontSize: "18px", color: "var(--text-muted)", cursor: "pointer" }}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="form-card-body" style={{ padding: "24px" }}>
              {editUser && (
                <form id="form-edit-user" onSubmit={handleSaveEditUser}>
                  <div className="form-group" style={{ marginBottom: "14px" }}>
                    <label className="form-label">First Name</label>
                    <input type="text" className="form-control" required value={editUser.firstName} onChange={(e) => setEditUser({ ...editUser, firstName: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: "14px" }}>
                    <label className="form-label">Last Name</label>
                    <input type="text" className="form-control" required value={editUser.lastName} onChange={(e) => setEditUser({ ...editUser, lastName: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: "14px" }}>
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" required value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: "24px" }}>
                    <label className="form-label">Phone</label>
                    <input type="text" className="form-control" required value={editUser.phone} onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <button type="button" className="btn btn-secondary" onClick={closeEditModal}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Save Changes</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        <div id="deleteUserModal" className={`modal-bg${deleteTarget ? " open" : ""}`}>
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="card-header" style={{ borderBottom: "1px solid var(--border)", padding: "16px 24px", justifyContent: "center", position: "relative" }}>
              <div className="card-header-icon" style={{ background: "var(--danger-light)", color: "var(--danger)", width: "40px", height: "40px", borderRadius: "50%" }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: "20px" }}></i>
              </div>
              <button onClick={closeDeleteModal} style={{ position: "absolute", right: "20px", top: "20px", background: "none", border: "none", fontSize: "18px", color: "var(--text-muted)", cursor: "pointer" }}><i className="fa-solid fa-xmark"></i></button>
            </div>

            <div className="form-card-body" style={{ padding: "24px", textAlign: "center" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "10px" }}>Delete Account?</h2>

              <div style={{ background: "var(--danger-light)", borderLeft: "4px solid var(--danger)", padding: "15px", marginBottom: "20px", fontSize: "13px", color: "var(--text-secondary)", textAlign: "left" }}>
                <p style={{ marginBottom: "8px" }}>You are about to permanently delete <b style={{ color: "var(--text-primary)" }}>{deleteTarget ? deleteTarget.name : ""}</b>.</p>
                <ul style={{ marginLeft: "20px", marginTop: "5px" }}>
                  <li>All data and records will be <b style={{ color: "var(--danger)" }}>permanently removed</b>.</li>
                  <li>This action cannot be undone.</li>
                  <li>To access the system again, they must open a <b>new account</b>.</li>
                </ul>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "24px", textAlign: "left" }}>
                <input type="checkbox" id="delete-agree-checkbox" checked={deleteAgree} onChange={(e) => setDeleteAgree(e.target.checked)} style={{ marginTop: "3px", cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--danger)" }} />
                <label htmlFor="delete-agree-checkbox" style={{ fontSize: "13px", color: "var(--text-secondary)", marginLeft: "10px", cursor: "pointer", lineHeight: 1.4 }}>
                  I understand that this deletion is permanent and all information will be lost.
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={closeDeleteModal}>Cancel</button>
                <button
                  type="button"
                  id="btn-confirm-delete"
                  className="btn btn-delete"
                  onClick={executeDelete}
                  disabled={!deleteAgree || deleting}
                  style={{ opacity: !deleteAgree || deleting ? 0.5 : 1, cursor: !deleteAgree || deleting ? "not-allowed" : "pointer", transition: "0.3s" }}
                >
                  {deleting ? <><i className="fa-solid fa-spinner fa-spin"></i> Deleting...</> : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <div className={`toast-icon ${t.type}`}><i className={`fa-solid fa-${t.type === "success" ? "check" : "circle-exclamation"}`}></i></div>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              <div className="toast-msg">{t.msg}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}