import { useState } from 'react';
import type { FormEvent } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { validStudentId } from './api';
import Classes from './pages/Classes';
import CreateClass from './pages/CreateClass';
import ClassDetails from './pages/ClassDetails';

function readStudent() {
  try { return sessionStorage.getItem('admission.student.v1') ?? ''; } catch { return ''; }
}

export default function App() {
  const [studentId, setStudentId] = useState(readStudent);
  const [draft, setDraft] = useState(studentId);
  const [identityError, setIdentityError] = useState('');
  const location = useLocation();

  function saveStudent(event: FormEvent) {
    event.preventDefault();
    if (!validStudentId(draft)) { setIdentityError('ইংরেজি অঙ্কে ১৭ সংখ্যার জন্মনিবন্ধন নম্বর লিখুন।'); return; }
    setIdentityError('');
    setStudentId(draft);
    try { sessionStorage.setItem('admission.student.v1', draft); } catch { /* In-memory identity still works. */ }
  }

  return <>
    <a className="skip-link" href="#main">মূল অংশে যান</a>
    <header className="site-header"><div className="container header-inner">
      <NavLink to="/classes" className="brand" aria-label="স্কুল ভর্তি হোম">
        <span className="brand-mark" aria-hidden="true">শি</span>
        <span><strong>স্কুল ভর্তি</strong><small>অনলাইন ভর্তি সেবা</small></span>
      </NavLink>
      <nav aria-label="মূল মেনু">
        <NavLink to="/classes" end>ক্লাস তালিকা</NavLink>
        <NavLink to="/classes/new">ক্লাস তৈরি</NavLink>
      </nav>
    </div></header>
    <div className="container">
      <section className="identity" aria-label="শিক্ষার্থীর পরিচয়">
        <div><h2>শিক্ষার্থীর পরিচয়</h2><p>আবেদন করতে জন্মনিবন্ধন নম্বর ব্যবহার করুন।</p></div>
        <form onSubmit={saveStudent} noValidate>
          <div className="field"><label htmlFor="student-id">জন্মনিবন্ধন নম্বর <span>(১৭ সংখ্যা)</span></label>
            <input id="student-id" value={draft} onChange={event => { setDraft(event.target.value); setIdentityError(''); }}
              inputMode="numeric" autoComplete="off" maxLength={17} placeholder="যেমন: 00123456789012345"
              aria-invalid={!!identityError} aria-describedby={identityError ? 'identity-error' : 'identity-hint'} />
          </div>
          <button className="secondary" type="submit">{studentId ? 'পরিবর্তন করুন' : 'নম্বর সেট করুন'}</button>
        </form>
        {identityError ? <p id="identity-error" className="field-error" role="alert">{identityError}</p> :
          <p id="identity-hint" className="identity-hint" role="status">{studentId ? `নির্বাচিত শিক্ষার্থী: ${studentId}` : 'ক্লাসের আসন দেখতে নম্বর দেওয়া প্রয়োজন নেই।'}</p>}
      </section>
      <main id="main" key={`${studentId}:${location.pathname}`}>
        <Routes>
          <Route path="/" element={<Navigate to="/classes" replace />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/classes/new" element={<CreateClass />} />
          <Route path="/classes/:classId" element={<ClassDetails />} />
          <Route path="*" element={<div className="empty"><h1>পাতাটি পাওয়া যায়নি</h1><NavLink to="/classes">ক্লাস তালিকায় ফিরুন</NavLink></div>} />
        </Routes>
      </main>
      <footer className="site-footer"><span>স্কুল ভর্তি · অনলাইন আবেদন</span><span>সহজ আবেদন, পরিষ্কার তথ্য।</span></footer>
    </div>
  </>;
}
