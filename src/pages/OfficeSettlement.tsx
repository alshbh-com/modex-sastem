import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface SettlementRow {
  id: string;
  count: string;
  amount: string;
  shipping: string;
  arrived: string;
}

const newRow = (): SettlementRow => ({
  id: crypto.randomUUID(),
  count: '',
  amount: '',
  shipping: '',
  arrived: '',
});

export default function OfficeSettlement() {
  const [rows, setRows] = useState<SettlementRow[]>([newRow()]);
  const [pickupRate, setPickupRate] = useState('');

  const addRow = () => setRows(prev => [...prev, newRow()]);

  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof SettlementRow, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // Totals
  const totalCount = rows.filter(r => r.count.trim() !== '').length;
  const totalAmount = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const totalShipping = rows.reduce((sum, r) => sum + (parseFloat(r.shipping) || 0), 0);
  const totalArrived = rows.reduce((sum, r) => sum + (parseFloat(r.arrived) || 0), 0);

  const pickupRateNum = parseFloat(pickupRate) || 0;
  const pickupTotal = totalCount * pickupRateNum;
  const due = totalAmount - (pickupTotal + totalShipping + totalArrived);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">تقفيلة المكاتب</h1>
        <Button size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 ml-1" />إضافة صف
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right w-10">#</TableHead>
                  <TableHead className="text-right">العدد</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">الشحن</TableHead>
                  <TableHead className="text-right">الواصل</TableHead>
                  <TableHead className="text-right w-10">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.id} className="border-border">
                    <TableCell className="text-sm text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <Input
                        value={row.count}
                        onChange={e => updateRow(row.id, 'count', e.target.value)}
                        className="bg-secondary border-border h-8 w-24"
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.amount}
                        onChange={e => updateRow(row.id, 'amount', e.target.value)}
                        className="bg-secondary border-border h-8 w-28"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.shipping}
                        onChange={e => updateRow(row.id, 'shipping', e.target.value)}
                        className="bg-secondary border-border h-8 w-28"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.arrived}
                        onChange={e => updateRow(row.id, 'arrived', e.target.value)}
                        className="bg-secondary border-border h-8 w-28"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive h-8 w-8"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="border-border bg-muted/50">
                  <TableCell className="font-bold text-sm">الإجمالي</TableCell>
                  <TableCell className="font-bold text-sm">{totalCount}</TableCell>
                  <TableCell className="font-bold text-sm">{totalAmount}</TableCell>
                  <TableCell className="font-bold text-sm">{totalShipping}</TableCell>
                  <TableCell className="font-bold text-sm">{totalArrived}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pickup calculation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm text-muted-foreground">سعر البيك اب للأوردر</p>
            <Input
              type="number"
              value={pickupRate}
              onChange={e => setPickupRate(e.target.value)}
              className="bg-secondary border-border"
              placeholder="0"
            />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">البيك اب</p>
            <p className="text-xl font-bold text-amber-500">{pickupTotal} ج.م</p>
            <p className="text-xs text-muted-foreground mt-1">{totalCount} أوردر × {pickupRateNum} ج.م</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">المستحق</p>
            <p className={`text-2xl font-bold ${due >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>{due} ج.م</p>
            <p className="text-xs text-muted-foreground mt-1">المبلغ - (البيك اب + الشحن + الواصل)</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-3">
          <p className="text-sm text-muted-foreground text-center">
            المعادلة: {totalAmount} - ({pickupTotal} + {totalShipping} + {totalArrived}) = <strong className={due >= 0 ? 'text-emerald-500' : 'text-destructive'}>{due} ج.م</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
