import { useCallback } from "react";
import { Link } from "react-router-dom";
import { request, validStudentId } from "../api";
import type { MyHold } from "../api";
import { useSession } from "../Session";
import { useRemote } from "../useRemote";
import HoldStatus from "../components/HoldStatus";
import { ErrorNotice, Loading } from "../components/Feedback";

export default function MyApplications() {
  const { studentId } = useSession();
  const load = useCallback(
    (signal: AbortSignal) =>
      validStudentId(studentId)
        ? request<MyHold[]>("/me/holds", { signal }, studentId)
        : Promise.resolve([]),
    [studentId],
  );
  const { data, error, loading, refresh } = useRemote(load, 5000);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Student applications</p>
          <h1>My applications</h1>
          <p>Track your active applications and previous admissions here.</p>
        </div>
        {studentId && (
          <button className="secondary" onClick={refresh}>
            Refresh availability
          </button>
        )}
      </div>
      <ErrorNotice message={error} retry={refresh} />
      {!studentId ? (
        <div className="panel empty">
          <h2>Select a student</h2>
          <p>
            Set your birth registration number above to view your applications.
          </p>
        </div>
      ) : loading ? (
        <Loading />
      ) : !data?.length && !error ? (
        <div className="panel empty">
          <h2>No applications yet</h2>
          <p>Browse the class list to start your first application.</p>
          <Link className="button primary" to="/classes">
            Browse classes
          </Link>
        </div>
      ) : (
        !!data?.length && (
          <div className="panel table-wrap">
            <table>
              <caption className="sr-only">Student applications</caption>
              <thead>
                <tr>
                  <th>Class / shift</th>
                  <th>Status</th>
                  <th>Hold deadline</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((hold) => (
                  <tr key={hold.holdId}>
                    <td className="class-name">{hold.className}</td>
                    <td>
                      <HoldStatus status={hold.status} />
                    </td>
                    <td data-label="Hold deadline">
                      <time dateTime={hold.expiresAt}>
                        {new Date(hold.expiresAt).toLocaleString("en-GB")}
                      </time>
                    </td>
                    <td>
                      <Link to={`/applications/${hold.holdId}`}>
                        View application →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}
