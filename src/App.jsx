import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainPage from "./pages/MainPage/MainPage.jsx";
import AdminPage from "./pages/AdminPage/AdminPage.jsx";
import DoctorPage from "./pages/DoctorPage/DoctorPage.jsx";
import PharmacyPage from "./pages/PharmacyPage/PharmacyPage.jsx";
import PatientPage from "./pages/PatientPage/PatientPage.jsx";
import StaffPage from "./pages/StaffPage/StaffPage.jsx";


import DynamicComingSoon from "./pages/ComingSoon/DynamicComingSoon.jsx";

// Route map (mirrors the original relative-path navigation):
//   Mainpage/index.html            -> "/"
//   PatientPage/index.html         -> "/patient"
//   AdminPage/admin.html           -> "/admin"
//   DoctorPage/doctor.html         -> "/doctor"
//   PharmacyDashboard/*.html       -> "/pharmacy"
//   StaffPage/staff-dashboard.html -> "/staff" 
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/patient" element={<PatientPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/doctor" element={<DoctorPage />} />
        <Route path="/pharmacy" element={<PharmacyPage />} />
        <Route path="/staff" element={<StaffPage />} />
        
    
        <Route path="/coming-soon" element={<DynamicComingSoon />} />
        
     
        <Route path="*" element={<MainPage />} />
      </Routes>
    </BrowserRouter>
  );
}