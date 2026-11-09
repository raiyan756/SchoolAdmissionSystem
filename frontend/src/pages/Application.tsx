import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { request, validStudentId } from "../api";
import type { Hold, MyHold, SchoolClass } from "../api";
import { useRemote } from "../useRemote";
import { useAction } from "../useAction";
import { useSession } from "../Session";
import { ErrorNotice, Loading } from "../components/Feedback";
import HoldStatus from "../components/HoldStatus";

function Countdown({
  expiresAt,
  refresh,
}: {
  expiresAt: string;
  refresh: () => void;
}) {
  const remaining = () =>
    Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => {
    const tick = () =>
      setSeconds(
        Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)),
      );
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  useEffect(() => {
    if (seconds === 0) refresh();
  }, [seconds, refresh]);
  return (
    <div className="countdown">
      <span>Time remaining to confirm</span>
      <strong role="timer" aria-label="Time remaining">
        {Math.floor(seconds / 60)
          .toString()
          .padStart(2, "0")}
        :{(seconds % 60).toString().padStart(2, "0")}
      </strong>
      {seconds === 0 && <small>Checking the latest application status…</small>}
    </div>
  );
}

export default function Application() {
  const { holdId } = useParams();
  const { studentId, working } = useSession();
  const [cancelPrompt, setCancelPrompt] = useState(false);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [hold, mine] = await Promise.all([
        request<Hold>(`/holds/${holdId}`, { signal }),
        validStudentId(studentId)
          ? request<MyHold[]>("/me/holds", { signal }, studentId)
          : Promise.resolve([]),
      ]);
      const schoolClass = await request<SchoolClass>(
        `/classes/${hold.classId}`,
        { signal },
      );
      return {
        hold,
        schoolClass,
        owned: mine.some((item) => item.holdId === holdId),
      };
    },
    [holdId, studentId],
  );
  const { data, error, loading, refresh } = useRemote(load, 5000);
  const action = useAction();

  function changeStatus(cancel: boolean) {
    if (!data?.owned || data.hold.status !== "HELD") return;
    void action.run(
      () =>
        request(
          `/holds/${holdId}${cancel ? "" : "/confirm"}`,
          { method: cancel ? "DELETE" : "POST" },
          studentId,
        ),
      () => setCancelPrompt(false),
      refresh,
    );
  }

  return (
    <>
      <Link className="back-link" to="/me/holds">
        ← My applications
      </Link>
      <ErrorNotice message={error} retry={refresh} />
      <ErrorNotice message={action.error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">Application details</p>
                <h1>{data.schoolClass.name}</h1>
                <p className="reference">
                  Application reference: {data.hold.holdId}
                </p>
              </div>
              <HoldStatus status={data.hold.status} />
            </div>
            <section className="panel detail-panel">
              {data.hold.status === "HELD" ? (
                <>
                  <Countdown
                    expiresAt={data.hold.expiresAt}
                    refresh={refresh}
                  />
                  <p>
                    Your seat is temporarily reserved. Pay the admission fee
                    before the deadline to confirm it.
                  </p>
                  <p className="muted">
                    Hold deadline:{" "}
                    <time dateTime={data.hold.expiresAt}>
                      {new Date(data.hold.expiresAt).toLocaleString("en-GB")}
                    </time>
                  </p>
                  {data.owned ? (
                    <>
                      <div className="actions">
                        <button
                          className="primary"
                          onClick={() => changeStatus(false)}
                          disabled={working || !!error}
                        >
                          {action.pending
                            ? "Please wait…"
                            : "Pay admission fee"}
                        </button>
                        <button
                          className="secondary"
                          onClick={() => setCancelPrompt(true)}
                          disabled={working || !!error}
                        >
                          Cancel application
                        </button>
                      </div>
                      <p className="fine-print">
                        Payment is simulated. Selecting “Pay admission fee”
                        confirms your admission. No money will be charged.
                      </p>
                      {cancelPrompt && (
                        <div className="cancel-prompt">
                          <p>
                            Cancelling this application will release your
                            reserved seat.
                          </p>
                          <div className="actions">
                            <button
                              className="danger"
                              disabled={working}
                              onClick={() => changeStatus(true)}
                            >
                              Yes, cancel application
                            </button>
                            <button
                              className="secondary"
                              disabled={working}
                              onClick={() => setCancelPrompt(false)}
                            >
                              Keep application
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="notice">
                      Set the matching student birth registration number above
                      to manage this application.
                    </div>
                  )}
                </>
              ) : (
                <div className="outcome" role="status">
                  <h2>
                    {data.hold.status === "CONFIRMED"
                      ? "Your admission is confirmed"
                      : data.hold.status === "CANCELLED"
                        ? "Application cancelled"
                        : "Application expired"}
                  </h2>
                  <p>
                    {data.hold.status === "CONFIRMED"
                      ? "Your seat is confirmed. No further payment is needed."
                      : "No seat is reserved for this application. You can apply again if a seat is available."}
                  </p>
                  <Link
                    className="button secondary"
                    to={`/classes/${data.hold.classId}`}
                  >
                    View class availability
                  </Link>
                </div>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
