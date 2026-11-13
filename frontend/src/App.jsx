import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Intake from "./pages/Intake";
import Queue from "./pages/Queue";
import CaseReview from "./pages/CaseReview";
import Advisory from "./pages/Advisory";
import Login from "./pages/Login";
import { session } from "./api";

function RequireOfficer({ children }) {
  return session.token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const nav = useNavigate();
  return (
    <>
      <header className="nav">
        <strong>🌱 CropDesk</strong>
        <nav>
          <NavLink to="/" end>Farmer</NavLink>
          <NavLink to="/officer">Officer</NavLink>
          {session.token && <a href="#out" onClick={(e) => { e.preventDefault(); session.clear(); nav("/login"); }}>Sign out</a>}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Intake />} />
          <Route path="/advisory/:id" element={<Advisory />} />
          <Route path="/login" element={<Login />} />
          <Route path="/officer" element={<RequireOfficer><Queue /></RequireOfficer>} />
          <Route path="/officer/:id" element={<RequireOfficer><CaseReview /></RequireOfficer>} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
