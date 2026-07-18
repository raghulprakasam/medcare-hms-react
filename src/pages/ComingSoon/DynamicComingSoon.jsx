import { useLocation, useNavigate } from "react-router-dom";
import "./DynamicComingSoon.css"; 

export default function DynamicComingSoon() {
  const location = useLocation();
  const navigate = useNavigate();

  // ஹோம் பேஜில் இருந்து வரும் தரவுகளை எடுக்கிறோம். (Title & Type)
  const { title = "This Feature", type = "feature" } = location.state || {};

  // கிளிக் செய்த வகைக்கு ஏற்ப மெசேஜை மாற்றும் Logic:
  const getContext = () => {
    switch (type) {
      case "department":
        return "Our clinical team is setting up the dedicated portal for this department. You'll soon be able to book appointments and view specialists.";
      case "academic":
      case "admission":
        return "The academic and admission portals for 2026 are being finalized. Detailed syllabus, eligibility criteria, and application forms will be available shortly.";
      case "research":
        return "We are updating our research publications and ongoing projects. Stay tuned for exciting breakthroughs.";
      case "news":
      case "events":
        return "Our press team is currently compiling the latest updates and scheduled events. Check back soon!";
      default:
        return "We are actively working on bringing this feature to our platform to enhance your experience.";
    }
  };

  return (
    <div className="coming-soon-wrapper">
      <div className="coming-soon-card">
        <div className="coming-soon-icon-wrap">
          <span className="coming-soon-icon">🚀</span>
        </div>
        
        <h1 className="coming-soon-title">{title}</h1>
        <h3 className="coming-soon-subtitle">Coming Soon to MedCare</h3>
        
        <p className="coming-soon-description">
          {getContext()}
        </p>

        <div className="coming-soon-contact-box">
          <p className="contact-box-title">Looking to join or need urgent info?</p>
          <p className="contact-box-text">
            Please get in touch with our support team: <br/>
            <strong>📧 admissions@medcare.ac.in | 📞 0416-2281000</strong>
          </p>
        </div>

        <div className="coming-soon-action-row">
          
          <button className="coming-soon-back-btn" onClick={() => navigate("/")}>
            ← Go to Home
          </button>
          
          <button className="coming-soon-contact-btn" onClick={() => window.location.href = "mailto:admissions@medcare.ac.in"}>
            Get in Touch
          </button>
        </div>
      </div>
    </div>
  );
}