import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request } from '../api';
import type { SchoolClass } from '../api';
import { useRemote } from '../useRemote';
import { ErrorNotice, Loading } from '../components/Feedback';

export default function ClassDetails() {
  const { classId } = useParams();
  const load = useCallback((signal: AbortSignal) => request<SchoolClass>(`/classes/${classId}`, { signal }), [classId]);
  const { data, error, loading, refresh } = useRemote(load, 5000);
  return <><Link className="back-link" to="/classes">← ক্লাস তালিকা</Link>
    <ErrorNotice message={error} retry={refresh} />
    {loading ? <Loading /> : data && <section className="panel detail-panel"><p className="eyebrow">ক্লাসের তথ্য</p><h1>{data.name}</h1>
      <dl className="seat-summary"><div><dt>মোট আসন</dt><dd>{data.totalSeats}</dd></div><div><dt>সংরক্ষিত</dt><dd>{data.heldSeats}</dd></div><div><dt>ভর্তি নিশ্চিত</dt><dd>{data.confirmedSeats}</dd></div><div><dt>খালি আসন</dt><dd>{data.availableSeats}</dd></div></dl>
    </section>}
  </>;
}
