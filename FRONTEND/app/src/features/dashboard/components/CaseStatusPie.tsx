import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CaseStatusSlice } from '@/shared/api/contract-pending';
import { CASE_STATUS_LABEL } from '@/shared/api/enums';
import { Card, SectionTitle } from '@/shared/ui';

const COLORS = ['#5f6b7a', '#1e88e5', '#0f6fd1', '#f5a623', '#43a047', '#e53935', '#8e1414'];

export function CaseStatusPie({ data }: { data: CaseStatusSlice[] }) {
  const chartData = data.map((slice) => ({ name: CASE_STATUS_LABEL[slice.status], value: slice.count }));

  return (
    <Card>
      <SectionTitle>Durum dağılımı</SectionTitle>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {chartData.map((entry, i) => (
                <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
