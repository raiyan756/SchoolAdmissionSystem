export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  if (!message) return null;
  return <div className="notice error" role="alert"><span>{message}</span>
    {retry && <button className="text-button" onClick={retry}>আবার চেষ্টা করুন</button>}
  </div>;
}

export function Loading() {
  return <p className="empty" role="status">তথ্য লোড হচ্ছে…</p>;
}
