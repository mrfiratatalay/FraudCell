import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RiskLevelSlice } from '@/shared/api/contract-pending';
import { RISK_LEVEL_LABEL, type RiskLevel } from '@/shared/api/enums';
import { Card, SectionTitle } from '@/shared/ui';

/** Risk seviyesi renkleri `shared/lib/risk.ts`'teki `riskTone` paletiyle tutarlı. */
const RISK_COLOR: Record<RiskLevel, string> = {
  DUSUK: '#43a047',
  ORTA: '#f5a623',
  YUKSEK: '#e53935',
  KRITIK: '#8e1414',
};

export function RiskLevelBar({ data }: { data: RiskLevelSlice[] }) {
  const chartData = data.map((slice) => ({
    name: RISK_LEVEL_LABEL[slice.riskLevel],
    count: slice.count,
    level: slice.riskLevel,
  }));

  return (
    <Card>
      <SectionTitle>Risk seviyesi dağılımı</SectionTitle>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.level} fill={RISK_COLOR[entry.level]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
