// A grouped-list row, macOS Settings style: the label (and its helper) on the left, the value on the right.
export default function ListRow({ label, helper = null, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-[14px]">{label}</p>
        {helper && <p className="subhead">{helper}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}
