import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { validStudentId } from "./api";
import Classes from "./pages/Classes";
import CreateClass from "./pages/CreateClass";
import ClassDetails from "./pages/ClassDetails";
import MyApplications from "./pages/MyApplications";
import Application from "./pages/Application";
import { SessionContext } from "./Session";

function readStudent() {
  try {
    const saved = sessionStorage.getItem("admission.student.v1") ?? "";
    return validStudentId(saved) ? saved : "";
  } catch {
    return "";
  }
}

export default function App() {
  const [studentId, setStudentId] = useState(readStudent);
  const [draft, setDraft] = useState(studentId);
  const [identityError, setIdentityError] = useState("");
  const [working, setWorking] = useState(false);
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname]);

  function saveStudent(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    if (!validStudentId(draft)) {
      setIdentityError(
        "Enter a 17-digit birth registration number using digits 0-9.",
      );
      return;
    }
    setIdentityError("");
    setStudentId(draft);
    try {
      sessionStorage.setItem("admission.student.v1", draft);
    } catch {
      /* In-memory identity still works. */
    }
  }

  return (
    <SessionContext.Provider value={{ studentId, working, setWorking }}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <NavLink
            to="/classes"
            className="brand"
            aria-label="School Admission home"
          >
            <span className="brand-mark" aria-hidden="true">
              SA
            </span>
            <span>
              <strong>School Admission</strong>
              <small>Online admission portal</small>
            </span>
          </NavLink>
          <nav aria-label="Main navigation">
            <NavLink to="/classes" end>
              Classes
            </NavLink>
            <NavLink to="/me/holds">My applications</NavLink>
            <NavLink to="/classes/new">Create class</NavLink>
          </nav>
        </div>
      </header>
      <div className="container">
        <section className="identity" aria-label="Student details">
          <div>
            <h2>Student details</h2>
            <p>Use your birth registration number to apply.</p>
          </div>
          <form onSubmit={saveStudent} noValidate>
            <div className="field">
              <label htmlFor="student-id">
                Birth registration number <span>(17 digits)</span>
              </label>
              <input
                id="student-id"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setIdentityError("");
                }}
                inputMode="numeric"
                autoComplete="off"
                maxLength={32}
                placeholder="e.g. 00123456789012345"
                disabled={working}
                aria-invalid={!!identityError}
                aria-describedby={
                  identityError ? "identity-error" : "identity-hint"
                }
              />
            </div>
            <button className="secondary" type="submit" disabled={working}>
              {studentId ? "Change student" : "Set student ID"}
            </button>
          </form>
          {identityError ? (
            <p id="identity-error" className="field-error" role="alert">
              {identityError}
            </p>
          ) : (
            <p id="identity-hint" className="identity-hint" role="status">
              {studentId
                ? `Selected student: ${studentId}`
                : "You can browse classes without setting a student ID."}
            </p>
          )}
        </section>
        <main id="main" tabIndex={-1} key={`${studentId}:${location.pathname}`}>
          <Routes>
            <Route path="/" element={<Navigate to="/classes" replace />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/classes/new" element={<CreateClass />} />
            <Route path="/classes/:classId" element={<ClassDetails />} />
            <Route path="/me/holds" element={<MyApplications />} />
            <Route path="/applications/:holdId" element={<Application />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Page not found</h1>
                  <NavLink to="/classes">Back to classes</NavLink>
                </div>
              }
            />
          </Routes>
        </main>
        <footer className="site-footer">
          <span>School Admission · Online applications</span>
          <span>Simple applications. Clear information.</span>
        </footer>
      </div>
    </SessionContext.Provider>
  );
}
