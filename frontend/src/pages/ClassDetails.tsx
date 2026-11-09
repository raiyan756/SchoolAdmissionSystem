import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { request } from '../api';
import type { Hold, SchoolClass } from '../api';
import { useSession } from '../Session';
import { useAction } from '../useAction';
import { useRemote } from '../useRemote';
import { ErrorNotice, Loading } from '../components/Feedback';

export default function ClassDetails() {
  const { classId } = useParams();
  const { studentId, working } = useSession();
  const navigate = useNavigate();
  const action = useAction();
  const load = useCallback((signal: AbortSignal) => request<SchoolClass>(`/classes/${classId}`, { signal }), [classId]);
  const { data, error, loading, refresh } = useRemote(load, 5000);
  return <><Link className="back-link" to="/classes">← ক্লাস তালিকা</Link>
    <ErrorNotice message={error} retry={refresh} />
    <ErrorNotice message={action.error} />
    {loading ? <Loading /> : data && <section className="panel detail-panel"><p className="eyebrow">ক্লাসের তথ্য</p><h1>{data.name}</h1>
      <dl className="seat-summary"><div><dt>মোট আসন</dt><dd>{data.totalSeats}</dd></div><div><dt>সংরক্ষিত</dt><dd>{data.heldSeats}</dd></div><div><dt>ভর্তি নিশ্চিত</dt><dd>{data.confirmedSeats}</dd></div><div><dt>খালি আসন</dt><dd>{data.availableSeats}</dd></div></dl>
      <div className="actions"><button className="primary" disabled={!studentId || data.availableSeats === 0 || working || !!error}
        onClick={() => void action.run(() => request<Hold>(`/classes/${classId}/holds`, { method: 'POST' }, studentId), hold => navigate(`/applications/${hold.holdId}`), refresh)}>
        {action.pending ? 'আবেদন হচ্ছে…' : data.availableSeats === 0 ? 'আসন খালি নেই' : 'আবেদন করুন'}</button><Link to="/me/holds">আমার আবেদন দেখুন</Link></div>
      {!studentId && <p className="fine-print">আবেদন করতে উপরে শিক্ষার্থীর জন্মনিবন্ধন নম্বর সেট করুন।</p>}
      <p className="fine-print">আবেদনের পর নির্ধারিত সময়ের মধ্যে ভর্তি নিশ্চিত করতে হবে।</p>
    </section>}
  </>;
}
