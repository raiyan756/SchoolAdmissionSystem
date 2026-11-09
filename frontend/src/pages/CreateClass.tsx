import { useRef, useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { request, errorMessage, ApiError } from "../api";
import { ErrorNotice } from "../components/Feedback";

export default function CreateClass() {
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id: string; name: string }>();
  const active = useRef(true);
  const submitting = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setCreated(undefined);
    if (
      !name.trim() ||
      name.length > 200 ||
      !/^\d+$/.test(seats) ||
      Number(seats) < 1 ||
      Number(seats) > 2147483647
    ) {
      setError(
        "Enter a class name (up to 200 characters) and a positive whole number of seats.",
      );
      return;
    }
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const result = await request<{ id: string; name: string }>("/classes", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), totalSeats: Number(seats) }),
      });
      if (active.current) {
        setCreated(result);
        setName("");
        setSeats("");
      }
    } catch (error) {
      if (active.current)
        setError(
          error instanceof ApiError
            ? errorMessage(error)
            : "The server did not respond. The class may have been created. Check the class list before trying again.",
        );
    } finally {
      submitting.current = false;
      if (active.current) setPending(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">School administration</p>
          <h1>Create a new class</h1>
          <p>Create a separate class for each shift.</p>
        </div>
      </div>
      <div className="form-layout">
        <section className="panel form-panel">
          <h2>Class details</h2>
          <ErrorNotice message={error} />
          {created && (
            <div className="notice success" role="status">
              “{created.name}” has been created.{" "}
              <Link to={`/classes/${created.id}`}>View class</Link>
            </div>
          )}
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="class-name">Class name and shift</label>
              <input
                id="class-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                placeholder="e.g. Class 6 - Morning Shift"
                required
                disabled={pending}
              />
            </div>
            <div className="field">
              <label htmlFor="total-seats">Total seats</label>
              <input
                id="total-seats"
                inputMode="numeric"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                placeholder="e.g. 120"
                required
                disabled={pending}
              />
            </div>
            <div className="actions">
              <button className="primary" disabled={pending}>
                {pending ? "Creating…" : "Create class"}
              </button>
              <Link to="/classes">Back to classes</Link>
            </div>
          </form>
        </section>
        <aside className="side-note">
          <h2>Classes and shifts</h2>
          <p>
            “Class 6 - Morning Shift” and “Class 6 - Day Shift” are separate
            classes, each with its own seat allocation.
          </p>
          <p>This form is intended for school staff.</p>
        </aside>
      </div>
    </>
  );
}
