import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { MapPin, Package, Truck, CheckCircle, XCircle, Clock, Search, Phone, User, Navigation } from 'lucide-react';

// Egypt governorate approximate center coordinates
const GOVERNORATE_COORDS: Record<string, [number, number]> = {
  'القاهرة': [30.0444, 31.2357],
  'الجيزة': [30.0131, 31.2089],
  'الإسكندرية': [31.2001, 29.9187],
  'الدقهلية': [31.0409, 31.3785],
  'الشرقية': [30.7327, 31.7195],
  'القليوبية': [30.3293, 31.2165],
  'المنوفية': [30.5972, 30.9876],
  'الغربية': [30.8754, 31.0297],
  'كفر الشيخ': [31.3085, 30.9404],
  'البحيرة': [30.8481, 30.3436],
  'المنيا': [28.1099, 30.7503],
  'أسيوط': [27.1783, 31.1859],
  'سوهاج': [26.5591, 31.6948],
  'قنا': [26.1551, 32.7160],
  'الأقصر': [25.6872, 32.6396],
  'أسوان': [24.0889, 32.8998],
  'الفيوم': [29.3084, 30.8428],
  'بني سويف': [29.0661, 31.0994],
  'بورسعيد': [31.2653, 32.3019],
  'الإسماعيلية': [30.5965, 32.2715],
  'السويس': [29.9668, 32.5498],
  'دمياط': [31.4175, 31.8144],
  'شمال سيناء': [31.1343, 33.7982],
  'جنوب سيناء': [28.4927, 33.9176],
  'الوادي الجديد': [25.4409, 30.5464],
  'مطروح': [31.3543, 27.2373],
  'البحر الأحمر': [25.6731, 34.1537],
};

interface CourierInfo {
  id: string;
  name: string;
  phone: string;
  coverageAreas: string;
  totalOrders: number;
  delivered: number;
  returned: number;
  pending: number;
  successRate: number;
  totalCollection: number;
  orders: any[];
}

export default function CourierTracking() {
  const [couriers, setCouriers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourier, setSelectedCourier] = useState<string>('all');
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [rolesRes, ordersRes, statusRes, officesRes] = await Promise.all([
      supabase.from('user_roles').select('user_id').eq('role', 'courier'),
      supabase.from('orders').select('*').not('courier_id', 'is', null).eq('is_closed', false),
      supabase.from('order_statuses').select('*'),
      supabase.from('offices').select('id, name'),
    ]);

    const courierIds = (rolesRes.data || []).map(r => r.user_id);
    if (courierIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone, coverage_areas').in('id', courierIds);
      setCouriers(profiles || []);
    }
    setOrders(ordersRes.data || []);
    setStatuses(statusRes.data || []);
    setOffices(officesRes.data || []);
  };

  const deliveredStatusIds = useMemo(() => 
    statuses.filter(s => s.name === 'تم التسليم' || s.name === 'تسليم جزئي').map(s => s.id), [statuses]);
  const returnedStatusIds = useMemo(() => 
    statuses.filter(s => ['رفض ولم يدفع شحن', 'رفض ودفع شحن', 'تهرب', 'ملغي', 'لم يرد'].includes(s.name)).map(s => s.id), [statuses]);

  const courierData: CourierInfo[] = useMemo(() => {
    return couriers.map(c => {
      const courierOrders = orders.filter(o => o.courier_id === c.id);
      const delivered = courierOrders.filter(o => deliveredStatusIds.includes(o.status_id));
      const returned = courierOrders.filter(o => returnedStatusIds.includes(o.status_id));
      const pending = courierOrders.length - delivered.length - returned.length;
      const totalCollection = delivered.reduce((s, o) => s + Number(o.price) + Number(o.delivery_price), 0);
      const successRate = courierOrders.length > 0 ? Math.round((delivered.length / courierOrders.length) * 100) : 0;
      return {
        id: c.id,
        name: c.full_name || 'بدون اسم',
        phone: c.phone || '-',
        coverageAreas: c.coverage_areas || '',
        totalOrders: courierOrders.length,
        delivered: delivered.length,
        returned: returned.length,
        pending,
        successRate,
        totalCollection,
        orders: courierOrders,
      };
    }).sort((a, b) => b.pending - a.pending);
  }, [couriers, orders, deliveredStatusIds, returnedStatusIds]);

  const filteredCouriers = useMemo(() => {
    let data = courierData;
    if (searchTerm) {
      data = data.filter(c => c.name.includes(searchTerm) || c.phone.includes(searchTerm));
    }
    if (selectedCourier !== 'all') {
      data = data.filter(c => c.id === selectedCourier);
    }
    return data;
  }, [courierData, searchTerm, selectedCourier]);

  // Map markers data
  const mapMarkers = useMemo(() => {
    const targetOrders = selectedCourier === 'all' 
      ? orders 
      : orders.filter(o => o.courier_id === selectedCourier);
    
    const govCounts: Record<string, { total: number; delivered: number; pending: number; returned: number }> = {};
    targetOrders.forEach(o => {
      const gov = o.governorate || 'غير محدد';
      if (!govCounts[gov]) govCounts[gov] = { total: 0, delivered: 0, pending: 0, returned: 0 };
      govCounts[gov].total++;
      if (deliveredStatusIds.includes(o.status_id)) govCounts[gov].delivered++;
      else if (returnedStatusIds.includes(o.status_id)) govCounts[gov].returned++;
      else govCounts[gov].pending++;
    });
    return govCounts;
  }, [orders, selectedCourier, deliveredStatusIds, returnedStatusIds]);

  // Leaflet map
  useEffect(() => {
    if (!mapContainer) return;
    let map: any;
    
    const initMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      
      if (mapInstance) {
        mapInstance.remove();
      }

      map = L.map(mapContainer).setView([27.5, 30.8], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      Object.entries(mapMarkers).forEach(([gov, counts]) => {
        const coords = GOVERNORATE_COORDS[gov];
        if (!coords) return;
        
        const color = counts.pending > 0 ? '#f59e0b' : counts.delivered > 0 ? '#22c55e' : '#ef4444';
        const radius = Math.max(8, Math.min(25, counts.total * 3));
        
        const circle = L.circleMarker(coords, {
          radius,
          fillColor: color,
          color: '#1e293b',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.7,
        }).addTo(map);

        circle.bindPopup(`
          <div style="text-align:right;font-family:sans-serif;min-width:120px">
            <strong>${gov}</strong><br/>
            📦 إجمالي: ${counts.total}<br/>
            ✅ تسليم: ${counts.delivered}<br/>
            ⏳ معلق: ${counts.pending}<br/>
            ❌ مرتجع: ${counts.returned}
          </div>
        `);
      });

      setMapInstance(map);
    };

    initMap();

    return () => {
      if (map) map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapContainer, mapMarkers]);

  const totalPending = courierData.reduce((s, c) => s + c.pending, 0);
  const totalDelivered = courierData.reduce((s, c) => s + c.delivered, 0);
  const totalReturned = courierData.reduce((s, c) => s + c.returned, 0);
  const totalOrders = courierData.reduce((s, c) => s + c.totalOrders, 0);

  const getOfficeName = (officeId: string) => offices.find(o => o.id === officeId)?.name || '-';
  const getStatusName = (statusId: string) => statuses.find(s => s.id === statusId)?.name || '-';
  const getStatusColor = (statusId: string) => statuses.find(s => s.id === statusId)?.color || '#6b7280';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Navigation className="h-6 w-6 text-primary" />
          تتبع المناديب
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full p-2 bg-primary/10">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مناديب نشطين</p>
              <p className="text-xl font-bold">{courierData.filter(c => c.totalOrders > 0).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full p-2 bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">أوردرات معلقة</p>
              <p className="text-xl font-bold">{totalPending}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full p-2 bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">تم التسليم</p>
              <p className="text-xl font-bold">{totalDelivered}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full p-2 bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مرتجع</p>
              <p className="text-xl font-bold">{totalReturned}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الهاتف..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={selectedCourier} onValueChange={setSelectedCourier}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="كل المناديب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المناديب</SelectItem>
            {courierData.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Map */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            خريطة توزيع الأوردرات
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div 
            ref={el => setMapContainer(el)} 
            className="h-[350px] sm:h-[400px] rounded-lg overflow-hidden border border-border"
            style={{ direction: 'ltr' }}
          />
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground justify-center">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#f59e0b] inline-block" /> معلق</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#22c55e] inline-block" /> تم التسليم</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block" /> مرتجع</span>
          </div>
        </CardContent>
      </Card>

      {/* Courier Progress Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCouriers.map(c => (
          <Card key={c.id} className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full p-2 bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1" dir="ltr">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </p>
                  </div>
                </div>
                <Badge variant={c.successRate >= 70 ? 'default' : c.successRate >= 40 ? 'secondary' : 'destructive'} className="text-xs">
                  {c.successRate}%
                </Badge>
              </div>

              {c.coverageAreas && (
                <p className="text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 inline ml-1" />
                  {c.coverageAreas}
                </p>
              )}

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>التقدم ({c.delivered + c.returned}/{c.totalOrders})</span>
                  <span>{c.totalOrders > 0 ? Math.round(((c.delivered + c.returned) / c.totalOrders) * 100) : 0}%</span>
                </div>
                <Progress 
                  value={c.totalOrders > 0 ? ((c.delivered + c.returned) / c.totalOrders) * 100 : 0} 
                  className="h-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-warning/10 rounded p-1.5">
                  <p className="font-bold text-warning">{c.pending}</p>
                  <p className="text-muted-foreground">معلق</p>
                </div>
                <div className="bg-success/10 rounded p-1.5">
                  <p className="font-bold text-success">{c.delivered}</p>
                  <p className="text-muted-foreground">تسليم</p>
                </div>
                <div className="bg-destructive/10 rounded p-1.5">
                  <p className="font-bold text-destructive">{c.returned}</p>
                  <p className="text-muted-foreground">مرتجع</p>
                </div>
              </div>

              <p className="text-xs font-bold text-primary text-center">
                التحصيل: {c.totalCollection.toLocaleString()} ج.م
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Orders per courier */}
      {selectedCourier !== 'all' && filteredCouriers.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              أوردرات {filteredCouriers[0]?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-right">الباركود</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">الهاتف</TableHead>
                    <TableHead className="text-right">المحافظة</TableHead>
                    <TableHead className="text-right">المكتب</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCouriers[0]?.orders.map((o: any) => (
                    <TableRow key={o.id} className="border-border">
                      <TableCell className="font-mono text-xs">{o.barcode || o.tracking_id}</TableCell>
                      <TableCell>{o.customer_name}</TableCell>
                      <TableCell dir="ltr" className="text-xs">{o.customer_phone}</TableCell>
                      <TableCell>{o.governorate || '-'}</TableCell>
                      <TableCell>{getOfficeName(o.office_id)}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          className="text-xs text-white"
                          style={{ backgroundColor: getStatusColor(o.status_id) }}
                        >
                          {getStatusName(o.status_id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold">{Number(o.price).toLocaleString()} ج.م</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
