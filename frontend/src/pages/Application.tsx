import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request, validStudentId } from '../api';
import type { Hold, MyHold, SchoolClass } from '../api';
import { useRemote } from '../useRemote';
import { useAction } from '../useAction';
import { useSession } from '../Session';
import { ErrorNotice, Loading } from '../components/Feedback';
import HoldStatus from '../components/HoldStatus';

function Countdown({ expiresAt, refresh }: { expiresAt: string; refresh: () => void }) {
  const remaining = () => Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => {
    const tick = () => setSeconds(remaining());
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  useEffect(() => { if (seconds === 0) refresh(); }, [seconds, refresh]);
  return <div className="countdown"><span>ভর্তি নিশ্চিত করার বাকি সময়</span>
    <strong role="timer" aria-label="বাকি সময়">{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</strong>
    {seconds === 0 && <small>সময় শেষ হয়েছে কি না যাচাই হচ্ছে…</small>}
  </div>;
}

export default function Application() {
  const { holdId } = useParams();
  const { studentId, working } = useSession();
  const [cancelPrompt, setCancelPrompt] = useState(false);
  const load = useCallback(async (signal: AbortSignal) => {
    const [hold, mine] = await Promise.all([
      request<Hold>(`/holds/${holdId}`, { signal }),
      validStudentId(studentId) ? request<MyHold[]>('/me/holds', { signal }, studentId) : Promise.resolve([]),
    ]);
    const schoolClass = await request<SchoolClass>(`/classes/${hold.classId}`, { signal });
    return { hold, schoolClass, owned: mine.some(item => item.holdId === holdId) };
  }, [holdId, studentId]);
  const { data, error, loading, refresh } = useRemote(load, 5000);
  const action = useAction();

  function changeStatus(cancel: boolean) {
    if (!data?.owned || data.hold.status !== 'HELD') return;
    void action.run(() => request(`/holds/${holdId}${cancel ? '' : '/confirm'}`, { method: cancel ? 'DELETE' : 'POST' }, studentId),
      () => setCancelPrompt(false), refresh);
  }

  return <><Link className="back-link" to="/me/holds">← আমার আবেদন</Link>
    <ErrorNotice message={error} retry={refresh} /><ErrorNotice message={action.error} />
    {loading ? <Loading /> : data && <>
      <div className="page-heading"><div><p className="eyebrow">আবেদনের বিস্তারিত</p><h1>{data.schoolClass.name}</h1><p className="reference">আবেদন নম্বর: {data.hold.holdId}</p></div><HoldStatus status={data.hold.status} /></div>
      <section className="panel detail-panel">
        {data.hold.status === 'HELD' ? <>
          <Countdown expiresAt={data.hold.expiresAt} refresh={refresh} />
          <p>আসনটি সাময়িকভাবে সংরক্ষিত আছে। সময়ের মধ্যে ভর্তি ফি দিয়ে ভর্তি নিশ্চিত করুন।</p>
          <p className="muted">শেষ সময়: <time dateTime={data.hold.expiresAt}>{new Date(data.hold.expiresAt).toLocaleString('bn-BD')}</time></p>
          {data.owned ? <>
            <div className="actions"><button className="primary" onClick={() => changeStatus(false)} disabled={working || !!error}>{action.pending ? 'অপেক্ষা করুন…' : 'ভর্তি ফি দিন'}</button>
              <button className="secondary" onClick={() => setCancelPrompt(true)} disabled={working || !!error}>আবেদন বাতিল</button></div>
            <p className="fine-print">এটি পরীক্ষামূলক পেমেন্ট। “ভর্তি ফি দিন” চাপলে ভর্তি নিশ্চিত হবে; কোনো টাকা কাটা হবে না।</p>
            {cancelPrompt && <div className="cancel-prompt"><p>আবেদন বাতিল করলে সংরক্ষিত আসনটি ছেড়ে দেওয়া হবে।</p><div className="actions"><button className="danger" disabled={working} onClick={() => changeStatus(true)}>হ্যাঁ, বাতিল করুন</button><button className="secondary" disabled={working} onClick={() => setCancelPrompt(false)}>আবেদন রাখুন</button></div></div>}
          </> : <div className="notice">এই আবেদনে কাজ করতে সংশ্লিষ্ট শিক্ষার্থীর জন্মনিবন্ধন নম্বর উপরে সেট করুন।</div>}
        </> : <div className="outcome" role="status"><h2>{data.hold.status === 'CONFIRMED' ? 'আপনার ভর্তি নিশ্চিত হয়েছে' : data.hold.status === 'CANCELLED' ? 'আবেদনটি বাতিল করা হয়েছে' : 'আবেদনের মেয়াদ শেষ হয়েছে'}</h2>
          <p>{data.hold.status === 'CONFIRMED' ? 'এই আসনটি এখন ভর্তির জন্য নিশ্চিত। আবার ফি দেওয়ার প্রয়োজন নেই।' : 'এই আবেদনের জন্য আর কোনো আসন সংরক্ষিত নেই। আসন খালি থাকলে নতুন করে আবেদন করতে পারেন।'}</p>
          <Link className="button secondary" to={`/classes/${data.hold.classId}`}>ক্লাসের আসন দেখুন</Link></div>}
      </section>
    </>}
  </>;
}
