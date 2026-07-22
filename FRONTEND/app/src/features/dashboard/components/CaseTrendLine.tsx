import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CaseTrendPoint } from '@/shared/api/contract-pending';
import { Card, SectionTitle } from '@/shared/ui';
import { formatDate } from '@/shared/lib/format';

export function CaseTrendLine({ data }: { data: CaseTrendPoint[] }) {
  const chartData = data.map((point) => ({ ...point, date: formatDate(point.date) }));

  return (
    <Card>
      <SectionTitle>7 günlük eğilim</SectionTitle>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="opened" name="Açılan" stroke="#1e88e5" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="closed" name="Kapanan" stroke="#43a047" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="slaBreached" name="SLA aşımı" stroke="#e53935" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
