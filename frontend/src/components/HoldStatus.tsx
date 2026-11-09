import type { HoldStatus as Status } from "../api";

const labels: Record<Status, string> = {
  HELD: "Seat reserved",
  CONFIRMED: "Confirmed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export default function HoldStatus({ status }: { status: Status }) {
  return (
    <span className={`status status-${status.toLowerCase()}`}>
      {labels[status]}
    </span>
  );
}
