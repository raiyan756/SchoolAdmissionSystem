import { useRef, useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { request, errorMessage } from '../api';
import { ErrorNotice } from '../components/Feedback';

export default function CreateClass() {
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ id: string; name: string }>();
  const active = useRef(true);
  const submitting = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setCreated(undefined);
    if (!name.trim() || name.length > 200 || !/^\d+$/.test(seats) || Number(seats) < 1 || Number(seats) > 2147483647) {
      setError('ক্লাসের নাম (সর্বোচ্চ ২০০ অক্ষর) ও শূন্যের চেয়ে বড় পূর্ণসংখ্যায় আসন লিখুন।'); return;
    }
    submitting.current = true;
    setPending(true); setError('');
    try {
      const result = await request<{ id: string; name: string }>('/classes', { method: 'POST', body: JSON.stringify({ name: name.trim(), totalSeats: Number(seats) }) });
      if (active.current) { setCreated(result); setName(''); setSeats(''); }
    } catch (error) { if (active.current) setError(errorMessage(error)); }
    finally { submitting.current = false; if (active.current) setPending(false); }
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">স্কুল কর্তৃপক্ষ</p><h1>নতুন ক্লাস তৈরি</h1><p>প্রতিটি শিফটের জন্য আলাদা ক্লাস তৈরি করুন।</p></div></div>
    <div className="form-layout"><section className="panel form-panel"><h2>ক্লাসের তথ্য</h2>
      <ErrorNotice message={error} />
      {created && <div className="notice success" role="status">“{created.name}” তৈরি হয়েছে। <Link to={`/classes/${created.id}`}>ক্লাসটি দেখুন</Link></div>}
      <form onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="class-name">ক্লাসের নাম ও শিফট</label><input id="class-name" value={name} onChange={e => setName(e.target.value)} maxLength={200} placeholder="যেমন: Class 6 - Morning Shift" required disabled={pending} /></div>
        <div className="field"><label htmlFor="total-seats">মোট আসন</label><input id="total-seats" inputMode="numeric" value={seats} onChange={e => setSeats(e.target.value)} placeholder="যেমন: 120" required disabled={pending} /></div>
        <div className="actions"><button className="primary" disabled={pending}>{pending ? 'তৈরি হচ্ছে…' : 'ক্লাস তৈরি করুন'}</button><Link to="/classes">তালিকায় ফিরুন</Link></div>
      </form>
    </section><aside className="side-note"><h2>ক্লাস ও শিফট</h2><p>“Class 6 - Morning Shift” এবং “Class 6 - Day Shift” দুটি আলাদা ক্লাস। প্রতিটির আসনের হিসাব আলাদা থাকবে।</p><p>এই ফর্মটি স্কুল কর্তৃপক্ষের ব্যবহারের জন্য।</p></aside></div>
  </>;
}
