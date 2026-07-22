import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FraudTypeSlice } from '@/shared/api/contract-pending';
import { FRAUD_TYPE_LABEL } from '@/shared/api/enums';
import { Card, SectionTitle } from '@/shared/ui';

export function FraudTypeBar({ data }: { data: FraudTypeSlice[] }) {
  const chartData = data.map((slice) => ({ name: FRAUD_TYPE_LABEL[slice.fraudType], count: slice.count }));

  return (
    <Card>
      <SectionTitle>Fraud türü dağılımı</SectionTitle>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#1e88e5" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
