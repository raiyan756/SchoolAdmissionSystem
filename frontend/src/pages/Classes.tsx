import { useCallback } from "react";
import { Link } from "react-router-dom";
import { request } from "../api";
import type { SchoolClass } from "../api";
import { useRemote } from "../useRemote";
import { ErrorNotice, Loading } from "../components/Feedback";

export default function Classes() {
  const load = useCallback(
    (signal: AbortSignal) => request<SchoolClass[]>("/classes", { signal }),
    [],
  );
  const { data, error, loading, refresh } = useRemote(load, 5000);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Admissions</p>
          <h1>Classes & available seats</h1>
          <p>Choose a class. Each shift has its own seat allocation.</p>
        </div>
        <button className="secondary" onClick={refresh}>
          Refresh availability
        </button>
      </div>
      <ErrorNotice message={error} retry={refresh} />
      {loading ? (
        <Loading />
      ) : data?.length === 0 ? (
        <div className="panel empty">
          <h2>No classes yet</h2>
          <p>Classes will appear here once the school adds them.</p>
          <Link to="/classes/new">Create a class</Link>
        </div>
      ) : (
        data && (
          <div className="panel table-wrap">
            <table>
              <caption className="sr-only">Seat availability by class</caption>
              <thead>
                <tr>
                  <th>Class / shift</th>
                  <th>Total seats</th>
                  <th>Held</th>
                  <th>Confirmed</th>
                  <th>Available</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td className="class-name">{item.name}</td>
                    <td data-label="Total seats">{item.totalSeats}</td>
                    <td data-label="Held">{item.heldSeats}</td>
                    <td data-label="Confirmed">{item.confirmedSeats}</td>
                    <td data-label="Available">
                      <span
                        className={`seat-count ${item.availableSeats === 0 ? "full" : ""}`}
                      >
                        {item.availableSeats}
                      </span>
                    </td>
                    <td>
                      <Link
                        className={`button ${item.availableSeats > 0 ? "primary" : "secondary"} compact`}
                        to={`/classes/${item.id}`}
                      >
                        {item.availableSeats > 0 ? "Apply now" : "View details"}
                      </Link>
                      {item.availableSeats === 0 && (
                        <small className="sold-out">Fully booked</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      <aside className="help-note">
        <strong>How admission works</strong>
        <p>
          Applying reserves a seat temporarily. Confirm your admission by paying
          the fee before the deadline. Unconfirmed seats become available again
          when the hold expires.
        </p>
      </aside>
    </>
  );
}
