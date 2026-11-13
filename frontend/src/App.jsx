import { NavLink, Route, Routes } from "react-router-dom";
import Intake from "./pages/Intake";
import Queue from "./pages/Queue";
import CaseReview from "./pages/CaseReview";
import Advisory from "./pages/Advisory";

export default function App() {
  return (
    <>
      <header className="nav">
        <strong>🌱 CropDesk</strong>
        <nav>
          <NavLink to="/" end>Farmer</NavLink>
          <NavLink to="/officer">Officer</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Intake />} />
          <Route path="/advisory/:id" element={<Advisory />} />
          <Route path="/officer" element={<Queue />} />
          <Route path="/officer/:id" element={<CaseReview />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
