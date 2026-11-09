import type { HoldStatus as Status } from '../api';

const labels: Record<Status, string> = {
  HELD: 'আসন সংরক্ষিত', CONFIRMED: 'ভর্তি নিশ্চিত', EXPIRED: 'মেয়াদ শেষ', CANCELLED: 'বাতিল',
};

export default function HoldStatus({ status }: { status: Status }) {
  return <span className={`status status-${status.toLowerCase()}`}>{labels[status]}</span>;
}
