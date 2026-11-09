import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api';
import type { SchoolClass } from '../api';
import { useRemote } from '../useRemote';
import { ErrorNotice, Loading } from '../components/Feedback';

export default function Classes() {
  const load = useCallback((signal: AbortSignal) => request<SchoolClass[]>('/classes', { signal }), []);
  const { data, error, loading, refresh } = useRemote(load, 5000);
  return <>
    <div className="page-heading"><div><p className="eyebrow">ভর্তি আবেদন</p><h1>ক্লাস ও খালি আসন</h1>
      <p>পছন্দের ক্লাস বেছে নিন। প্রতিটি শিফটের আসন আলাদাভাবে দেখানো হয়েছে।</p></div>
      <button className="secondary" onClick={refresh}>তথ্য হালনাগাদ করুন</button></div>
    <ErrorNotice message={error} retry={refresh} />
    {loading ? <Loading /> : data?.length === 0 ? <div className="panel empty"><h2>এখনও কোনো ক্লাস যুক্ত হয়নি</h2><p>স্কুল কর্তৃপক্ষ ক্লাস যুক্ত করলে এখানে দেখা যাবে।</p><Link to="/classes/new">নতুন ক্লাস তৈরি করুন</Link></div> : data &&
      <div className="panel table-wrap"><table><caption className="sr-only">ক্লাসভিত্তিক আসনের হিসাব</caption>
        <thead><tr><th>ক্লাস / শিফট</th><th>মোট আসন</th><th>সংরক্ষিত</th><th>ভর্তি নিশ্চিত</th><th>খালি আসন</th><th><span className="sr-only">করণীয়</span></th></tr></thead>
        <tbody>{data.map(item => <tr key={item.id}><td className="class-name">{item.name}</td><td>{item.totalSeats}</td><td>{item.heldSeats}</td><td>{item.confirmedSeats}</td>
          <td><span className={`seat-count ${item.availableSeats === 0 ? 'full' : ''}`}>{item.availableSeats}</span></td>
          <td><Link className={`button ${item.availableSeats > 0 ? 'primary' : 'secondary'} compact`} to={`/classes/${item.id}`}>{item.availableSeats > 0 ? 'আবেদন করুন' : 'বিস্তারিত দেখুন'}</Link>{item.availableSeats === 0 && <small className="sold-out">আসন পূর্ণ</small>}</td></tr>)}</tbody>
      </table></div>}
    <aside className="help-note"><strong>আবেদনের নিয়ম</strong><p>আবেদনের পর আসন সাময়িকভাবে সংরক্ষিত থাকবে। নির্ধারিত সময়ের মধ্যে ভর্তি ফি দিয়ে ভর্তি নিশ্চিত করুন। সময় শেষ হলে আসন আবার খালি হবে।</p></aside>
  </>;
}
