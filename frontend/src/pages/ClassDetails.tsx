import { useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { request } from "../api";
import type { Hold, SchoolClass } from "../api";
import { useSession } from "../Session";
import { useAction } from "../useAction";
import { useRemote } from "../useRemote";
import { ErrorNotice, Loading } from "../components/Feedback";

export default function ClassDetails() {
  const { classId } = useParams();
  const { studentId, working } = useSession();
  const navigate = useNavigate();
  const action = useAction();
  const load = useCallback(
    (signal: AbortSignal) =>
      request<SchoolClass>(`/classes/${classId}`, { signal }),
    [classId],
  );
  const { data, error, loading, refresh } = useRemote(load, 5000);
  return (
    <>
      <Link className="back-link" to="/classes">
        ← Classes
      </Link>
      <ErrorNotice message={error} retry={refresh} />
      <ErrorNotice message={action.error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <section className="panel detail-panel">
            <p className="eyebrow">Class details</p>
            <h1>{data.name}</h1>
            <dl className="seat-summary">
              <div>
                <dt>Total seats</dt>
                <dd>{data.totalSeats}</dd>
              </div>
              <div>
                <dt>Held</dt>
                <dd>{data.heldSeats}</dd>
              </div>
              <div>
                <dt>Confirmed</dt>
                <dd>{data.confirmedSeats}</dd>
              </div>
              <div>
                <dt>Available</dt>
                <dd>{data.availableSeats}</dd>
              </div>
            </dl>
            <div className="actions">
              <button
                className="primary"
                disabled={
                  !studentId || data.availableSeats === 0 || working || !!error
                }
                onClick={() =>
                  void action.run(
                    () =>
                      request<Hold>(
                        `/classes/${classId}/holds`,
                        { method: "POST" },
                        studentId,
                      ),
                    (hold) => navigate(`/applications/${hold.holdId}`),
                    refresh,
                  )
                }
              >
                {action.pending
                  ? "Applying…"
                  : data.availableSeats === 0
                    ? "No seats available"
                    : "Apply now"}
              </button>
              <Link to="/me/holds">View my applications</Link>
            </div>
            {!studentId && (
              <p className="fine-print">
                Set the student birth registration number above to apply.
              </p>
            )}
            <p className="fine-print">
              After applying, confirm your admission before the hold expires.
            </p>
          </section>
        )
      )}
    </>
  );
}
