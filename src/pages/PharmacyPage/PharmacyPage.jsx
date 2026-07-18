import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import html2pdf from "html2pdf.js";
import usePageStyles from "../../components/usePageStyles.js";
import { apiFetch, clearToken, decodeTokenSubject, getToken } from "../../api/client.js";
import cssText from "./PharmacyPage.css?raw";

function fmtDate(d) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtMoney(v) {
  return "₹" + Math.round(v).toLocaleString("en-IN");
}

// ── HELPER: EXTRACT PATIENT DETAILS SAFELY ──
function getPatientDetails(app) {
  let name = "Unknown Patient";
  let phone = "N/A";
  if (!app) return { name, phone };

  if (app.patientFirstName) {
    name = `${app.patientFirstName} ${app.patientLastName || ""}`.trim();
    phone = app.patientPhone || "N/A";
  } else if (app.patient && app.patient.user && app.patient.user.firstName) {
    name = `${app.patient.user.firstName} ${app.patient.user.lastName || ""}`.trim();
    phone = app.patient.user.mobile || app.patient.user.phone || "N/A";
  } else if (app.patient && app.patient.firstName) {
    name = `${app.patient.firstName} ${app.patient.lastName || ""}`.trim();
    phone = app.patient.phone || app.patient.mobile || "N/A";
  } else if (app.patientName) {
    name = app.patientName;
  }

  return { name, phone };
}

// ── HELPER: EXTRACT DOCTOR NAME SAFELY ──
function extractDoctorName(app) {
  if (!app) return "Duty Doctor";
  if (app.doctor && typeof app.doctor === "object") {
    const fName = app.doctor.firstName;
    if (fName && String(fName).toLowerCase() !== "null") {
      return "Dr. " + fName + " " + (app.doctor.lastName || "").trim();
    }
  }
  if (app.doctorEmail) {
    const namePart = app.doctorEmail.split("@")[0];
    return "Dr. " + namePart.charAt(0).toUpperCase() + namePart.slice(1);
  }
  return "Duty Doctor";
}

export default function PharmacyPage() {
  usePageStyles(cssText, "pharmacypage");
  const navigate = useNavigate();

  const [welcomeText, setWelcomeText] = useState("Welcome, Staff");
  const [pendingList, setPendingList] = useState([]);
  const [completedList, setCompletedList] = useState([]);
  const [currentTab, setCurrentTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [invData, setInvData] = useState(null); 
  const [amounts, setAmounts] = useState({}); 
  const [toasts, setToasts] = useState([]);
  const now = useRef(new Date());
  const printableRef = useRef(null);

  function showToast(message, type = "info") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }

  function logout() {
    clearToken();
    navigate("/");
  }

  function loadProfile() {
    const token = getToken();
    if (!token) {
      showToast("Session expired. Please login again.", "error");
      setTimeout(() => navigate("/"), 1500);
      return;
    }
    const sub = decodeTokenSubject(token);
    if (sub) {
      const name = sub.split("@")[0];
      setWelcomeText("Welcome, " + name.charAt(0).toUpperCase() + name.slice(1) + " (Pharmacy)");
    }
  }

  async function fetchData() {
    try {
      const token = getToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        setTimeout(() => navigate("/"), 1500);
        return;
      }
      const resPending = await apiFetch("/pharmacy/pending");
      if (resPending.ok) setPendingList(await resPending.json());

      const resCompleted = await apiFetch("/pharmacy/issued");
      if (resCompleted.ok) setCompletedList(await resCompleted.json());
    } catch (error) {
      console.error("Fetch Error:", error);
      showToast("Network Error: Could not fetch data.", "error");
    }
  }

  useEffect(() => {
    loadProfile();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchTab(tab) {
    setCurrentTab(tab);
    setSearch("");
    closeInvoice();
  }

  const sourceList = currentTab === "pending" ? pendingList : completedList;

  const filteredList = useMemo(() => {
    const query = search.toLowerCase();
    if (!query) return sourceList;
    return sourceList.filter((p) => {
      const app = p.appointment || {};
      const appId = app.id || p.id;
      const pDetails = getPatientDetails(app);
      return String(appId).includes(query) || pDetails.name.toLowerCase().includes(query);
    });
  }, [sourceList, search]);

  function openBill(idToFind) {
    const prescription = sourceList.find((p) => {
      const app = p.appointment || {};
      return String(app.appointmentId || app.id || p.id) === String(idToFind);
    });
    if (!prescription) return;

    const app = prescription.appointment || {};
    const appId = app.appointmentId || app.id || prescription.id;
    const pDetails = getPatientDetails(app);
    const doctorName = extractDoctorName(app);

    const items = [];
    items.push({ desc: `Consultation (${app.department || "General"})`, cat: "Doctor Fees", qty: 1 });
    if (prescription.medicines) items.push({ desc: prescription.medicines, cat: "Pharmacy", qty: 1 });
    if (prescription.labTests) items.push({ desc: prescription.labTests, cat: "Lab Tests", qty: 1 });

    let savedAmounts = {};
    try {
    
      const localAmounts = localStorage.getItem(`bill_${prescription.id}`);
      
      if (localAmounts) {
        savedAmounts = JSON.parse(localAmounts);
      } else if (prescription.billDetails) {
        savedAmounts = JSON.parse(prescription.billDetails);
      } else if (prescription.totalAmount) {
        savedAmounts[0] = prescription.totalAmount;
      }
    } catch (e) {
      console.error("Error parsing amounts", e);
    }

    setAmounts(savedAmounts);
    setInvData({
      prescriptionId: prescription.id,
      invNo: "INV-" + String(Math.floor(Math.random() * 9000) + 1000),
      name: pDetails.name,
      reg: `REG-${appId}`,
      mob: pDetails.phone,
      doctor: doctorName,
      diagnosis: app.diagnosis || "Routine Checkup",
      items,
      isIssued: currentTab === "completed",
    });

    setTimeout(() => {
      const el = document.getElementById("invoiceSection");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 0);
  }

  function closeInvoice() {
    setInvData(null);
    setAmounts({});
  }

  const totals = useMemo(() => {
    if (!invData) return { subtotal: 0, gst: 0, grand: 0 };
    let subtotal = 0;
    invData.items.forEach((_, idx) => {
      subtotal += parseFloat(amounts[idx]) || 0;
    });
    const gst = subtotal * 0.05;
    return { subtotal, gst, grand: subtotal + gst };
  }, [invData, amounts]);

  async function submitBill() {
    if (!invData || !invData.prescriptionId) return;

    const payload = {
      totalAmount: totals.grand,
      billDetails: JSON.stringify(amounts) 
    };

   
    localStorage.setItem(`bill_${invData.prescriptionId}`, JSON.stringify(amounts));

    try {
      const response = await apiFetch(`/pharmacy/issue/${invData.prescriptionId}`, { 
        method: "PUT",
        body: payload
      });
      
      if (response.ok) {
        showToast("Bill Paid! Downloading Slip...", "success");
        downloadSlip(); 
        
        setTimeout(() => {
          closeInvoice();
          fetchData();
        }, 1500);
      } else {
        showToast("Failed to update bill.", "error");
      }
    } catch (error) {
      showToast("Connection Error.", "error");
    }
  }

  function downloadSlip() {
    const element = printableRef.current;
    if (!element) return;

    element.classList.add("pdf-mode");

    const opt = {
      margin: [10, 10, 10, 10],
      filename: "Invoice_" + (invData ? invData.reg : "Slip") + ".pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        element.classList.remove("pdf-mode");
      });
  }

  return (
    <div className="pharmacy-layout-wrapper">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">💊</div>
          <div>
            <div className="logo-text">MedCare</div>
            <div className="logo-sub">Pharmacy &amp; Billing</div>
          </div>
        </div>
        <div className="nav-section">
          <a className={`nav-item${currentTab === "pending" ? " active" : ""}`} onClick={() => switchTab("pending")}>🛒 Pending Bills</a>
          <a className={`nav-item${currentTab === "completed" ? " active" : ""}`} onClick={() => switchTab("completed")}>✅ Completed Bills</a>
        </div>
        <div className="sidebar-footer">
          <a className="nav-item" onClick={logout} style={{ color: "var(--grey-200)", cursor: "pointer" }}>🚪 Sign Out</a>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <h1 style={{ fontSize: "16px", color: "var(--navy)" }} id="headerWelcomeText">{welcomeText}</h1>
        </header>

        <div className="content">
          <div className="card" id="queueCard">
            <div className="card-head">
              <span id="queueTitle">{currentTab === "pending" ? "⏳ Patients Waiting for Billing" : "✅ Processed / Completed Bills"}</span>
              <div className="header-controls">
                <input
                  type="text"
                  id="searchBar"
                  className="search-box"
                  placeholder="Search Patient Name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button className="btn btn-outline" onClick={fetchData}>↻ Refresh List</button>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Appt ID</th>
                    <th>Patient Name</th>
                    <th>Ref Doctor</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="pharmacyQueueBody">
                  {filteredList.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "20px" }}>No records found.</td></tr>
                  )}
                  {filteredList.map((p) => {
                    const app = p.appointment || {};
                    const appId = app.appointmentId || app.id || p.id;
                    const pDetails = getPatientDetails(app);
                    const doctorName = extractDoctorName(app);
                    return (
                      <tr key={appId}>
                        <td><span style={{ color: "var(--teal)", fontWeight: 600 }}>#{appId}</span></td>
                        <td><strong>{pDetails.name}</strong></td>
                        <td>{doctorName}</td>
                        <td>{currentTab === "pending" ? <span className="badge-amber">PENDING</span> : <span className="badge-green">ISSUED</span>}</td>
                        <td>
                          {currentTab === "pending" ? (
                            <button className="btn btn-primary" onClick={() => openBill(appId)}>Process Bill</button>
                          ) : (
                            <button className="btn btn-outline" onClick={() => openBill(appId)}>View Slip</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" id="invoiceSection" style={{ display: invData ? "block" : "none" }}>
            <div className="card-head">
              <span>🧾 Generate Bill &amp; Slip</span>
              <button className="btn btn-outline" onClick={closeInvoice}>❌ Close</button>
            </div>

            <div className="card-body">
              {invData && (
                <div className="invoice-wrap" id="printableSlip" ref={printableRef}>
                  <div className="inv-header">
                    <div>
                      <div className="inv-logo">
                        Med<span>Care</span> Pharmacy
                        <small>MedCare Hospital &amp; Research Centre</small>
                      </div>
                    </div>
                    <div className="inv-meta">
                      <strong>MEDICAL INVOICE</strong>
                      <div className="inv-no" id="invNo">{invData.invNo}</div>
                      <div style={{ marginTop: "4px" }}>Date: <span id="invDate">{fmtDate(now.current)}</span></div>
                    </div>
                  </div>

                  <div className="inv-patient">
                    <div className="inv-pt-half">
                      <div className="inv-section-title">Patient Details</div>
                      <div className="inv-detail-row"><span className="k">Name</span><span className="v" id="invPatName">{invData.name}</span></div>
                      <div className="inv-detail-row"><span className="k">Reg No.</span><span className="v" id="invPatReg">{invData.reg}</span></div>
                      <div className="inv-detail-row"><span className="k">Contact</span><span className="v" id="invPatMob">{invData.mob}</span></div>
                    </div>
                    <div className="inv-pt-half">
                      <div className="inv-section-title">Prescription Summary</div>
                      <div className="inv-detail-row"><span className="k">Doctor</span><span className="v" id="invDoc">{invData.doctor}</span></div>
                      <div className="inv-detail-row"><span className="k">Diagnosis</span><span className="v" id="invDiag">{invData.diagnosis}</span></div>
                      <div className="inv-detail-row">
                        <span className="k">Status</span>
                        <span className="v" id="invStatus" style={{ color: invData.isIssued ? "var(--green)" : "var(--amber)" }}>
                          {invData.isIssued ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <table>
                      <thead>
                        <tr>
                          <th>Description (Tablets / Tests)</th>
                          <th>Category</th>
                          <th>Qty</th>
                          <th style={{ textAlign: "right" }}>Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody id="invItems">
                        {invData.items.map((i, idx) => (
                          <tr key={idx}>
                            <td>{i.desc}</td>
                            <td><span style={{ fontSize: "11px", background: "var(--grey-100)", padding: "3px 8px", borderRadius: "4px" }}>{i.cat}</span></td>
                            <td>{i.qty}</td>
                            <td style={{ textAlign: "right" }}>
                              <span style={{ fontWeight: 600, color: "var(--grey-400)" }}>₹</span>
                              <input
                                type="number"
                                className="amount-input-box"
                                placeholder="0"
                                min="0"
                                value={amounts[idx] || ""}
                                onChange={(e) => setAmounts((a) => ({ ...a, [idx]: e.target.value }))}
                                disabled={invData.isIssued}
                                style={{ 
                                  background: invData.isIssued ? "transparent" : "#fff", 
                                  border: invData.isIssued ? "none" : "1.5px solid var(--grey-200)",
                                  color: invData.isIssued ? "var(--grey-800)" : "var(--navy)"
                                }}
                              />
                              {invData.isIssued && <span style={{ fontSize: "11px", color: "var(--green)", marginLeft: "5px", fontWeight: "bold" }}>(Paid)</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="inv-totals">
                    <div className="inv-totals-table">
                      <div className="total-row"><span className="lbl">Subtotal</span><span className="val" id="tSubtotal">{fmtMoney(totals.subtotal)}</span></div>
                      <div className="total-row"><span className="lbl">GST (5%)</span><span className="val" id="tGst" style={{ color: "var(--amber)" }}>+ {fmtMoney(totals.gst)}</span></div>
                      <div className="total-row grand"><span className="lbl">NET PAYABLE</span><span className="val" id="tGrand">{fmtMoney(totals.grand)}</span></div>
                    </div>
                  </div>

                  <div className="inv-actions">
                    {!invData.isIssued && (
                      <button className="btn btn-green" id="btnSubmitPay" onClick={submitBill}>✅ Submit &amp; Pay</button>
                    )}
                    <button className="btn btn-amber" onClick={downloadSlip}>📥 Download Slip (PDF)</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

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