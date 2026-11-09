import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { request, validStudentId } from '../api';
import type { MyHold } from '../api';
import { useSession } from '../Session';
import { useRemote } from '../useRemote';
import HoldStatus from '../components/HoldStatus';
import { ErrorNotice, Loading } from '../components/Feedback';

export default function MyApplications() {
  const { studentId } = useSession();
  const load = useCallback((signal: AbortSignal) => validStudentId(studentId)
    ? request<MyHold[]>('/me/holds', { signal }, studentId) : Promise.resolve([]), [studentId]);
  const { data, error, loading, refresh } = useRemote(load, 5000);
  return <>
    <div className="page-heading"><div><p className="eyebrow">শিক্ষার্থীর আবেদন</p><h1>আমার আবেদন</h1><p>আপনার চলমান ও আগের সব আবেদনের অবস্থা এখানে দেখুন।</p></div>
      {studentId && <button className="secondary" onClick={refresh}>তথ্য হালনাগাদ করুন</button>}</div>
    <ErrorNotice message={error} retry={refresh} />
    {!studentId ? <div className="panel empty"><h2>শিক্ষার্থী নির্বাচন করুন</h2><p>উপরে জন্মনিবন্ধন নম্বর সেট করলে আপনার আবেদনগুলো দেখতে পাবেন।</p></div> : loading ? <Loading /> : !data?.length && !error ?
      <div className="panel empty"><h2>আপনার কোনো আবেদন নেই</h2><p>ক্লাস তালিকা থেকে পছন্দের ক্লাসে আবেদন করুন।</p><Link className="button primary" to="/classes">ক্লাস দেখুন</Link></div> : !!data?.length &&
      <div className="panel table-wrap"><table><caption className="sr-only">শিক্ষার্থীর আবেদনের তালিকা</caption><thead><tr><th>ক্লাস / শিফট</th><th>আবেদনের অবস্থা</th><th>সংরক্ষণের শেষ সময়</th><th><span className="sr-only">করণীয়</span></th></tr></thead>
        <tbody>{data.map(hold => <tr key={hold.holdId}><td className="class-name">{hold.className}</td><td><HoldStatus status={hold.status} /></td>
          <td><time dateTime={hold.expiresAt}>{new Date(hold.expiresAt).toLocaleString('bn-BD')}</time></td><td><Link to={`/applications/${hold.holdId}`}>আবেদন দেখুন →</Link></td></tr>)}</tbody></table></div>}
  </>;
}
