import { useEffect, useState } from "react";
import { listRecords } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

type RecordItem = Record<string, any>;

function getRecordName(record: RecordItem) {
  return record.company_name || record.title || record.name || "Untitled";
}

export default function DataPage() {
  const [table, setTable] = useState("hub");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<RecordItem | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRecords({ table, limit, offset });
      setRecords(data.items || []);
      setTotal(data.total || 0);
      setSelected(null);
    } catch (err: any) {
      if (err?.status === 412) {
        setError("SmartSuite isn't connected for this workspace. Add credentials in Settings → Integrations.");
      } else {
        setError(err.message || "Failed to load records");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [table, offset]);

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-heading">Data Explorer</h1>
          <p className="text-muted-foreground">Browse SmartSuite records for both source customers and the Intelligence Hub.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={table} onValueChange={(value) => { setOffset(0); setTable(value); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select table" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hub">Intelligence Hub</SelectItem>
              <SelectItem value="customers">Source Customers</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchRecords} disabled={loading}>
            Refresh
          </Button>
        </div>
      </header>

      <Card className="panel">
        <CardHeader>
          <CardTitle>{table === "hub" ? "Intelligence Hub" : "Source Customers"}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading records...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="py-2 text-left font-medium">Name</th>
                  <th className="py-2 text-left font-medium">Type</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Priority</th>
                  <th className="py-2 text-left font-medium">Research</th>
                  <th className="py-2 text-left font-medium">View</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 font-medium">{getRecordName(record)}</td>
                    <td className="py-2 text-muted-foreground">
                      {record.record_type || record.customer_type || record.sf17aef823 || "-"}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {record.lead_status || record.status || "-"}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {record.priority_tier || record.s4b7a3f28a || "-"}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {record.research_status || "-"}
                    </td>
                    <td className="py-2">
                      <Button size="sm" variant="outline" onClick={() => setSelected(record)}>
                        Raw
                      </Button>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No records returned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {records.length} of {total} records
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => setOffset(Math.max(0, offset - limit))}>
                Prev
              </Button>
              <Button variant="outline" size="sm" disabled={!canNext} onClick={() => setOffset(offset + limit)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="panel">
        <CardHeader>
          <CardTitle>Record Detail</CardTitle>
        </CardHeader>
        <CardContent>
          {selected ? (
            <ScrollArea className="h-[320px] rounded-lg border border-border/60 bg-background/70 p-4 text-xs font-mono">
              {JSON.stringify(selected, null, 2)}
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">Select a record to inspect the raw SmartSuite payload.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
