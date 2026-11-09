import { Button } from "@/components/ui/button";
import { orderStatuses } from "../types";
export function DateRangeForm({
  action,
  from,
  to,
  status,
}: {
  action: string;
  from?: string;
  to?: string;
  status?: string;
}) {
  return (
    <form
      action={action}
      className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div>
        <label className="field-label" htmlFor="from_date">
          From date (UTC)
        </label>
        <input
          className="field"
          id="from_date"
          name="from_date"
          type="date"
          defaultValue={from}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="to_date">
          To date (UTC, inclusive)
        </label>
        <input
          className="field"
          id="to_date"
          name="to_date"
          type="date"
          defaultValue={to}
        />
      </div>
      {status !== undefined && (
        <div>
          <label className="field-label" htmlFor="status">
            Order status
          </label>
          <select
            className="field"
            id="status"
            name="status"
            defaultValue={status}
          >
            <option value="">All statuses</option>
            {orderStatuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      )}
      <Button type="submit">Apply filters</Button>
    </form>
  );
}
