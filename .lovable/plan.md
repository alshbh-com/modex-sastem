

# إصلاح خطأ "Could not find the 'governorate' column of 'orders'"

## المشكلة
في `src/pages/OfficePortal.tsx`، دالة `AddOfficeOrderDialog` بتحاول تدخل عمود `governorate` في جدول `orders`، لكن الجدول ده مفيهوش عمود اسمه `governorate`. العمود الموجود هو `address`.

## الحل
- شيل `governorate` من الـ insert في سطر 169
- حط قيمة المحافظة في عمود `address` (أو ادمجها مع العنوان)
- نضيف المحافظة للعنوان لو الاتنين موجودين

## التعديلات

### `src/pages/OfficePortal.tsx`
1. في الفورم، خلي حقل المحافظة زي ما هو (UX كويس)
2. في `handleSubmit`، بدل ما نبعت `governorate` كعمود منفصل، ندمجها مع `address`
3. شيل `governorate` من الـ insert object

مثال: لو المحافظة "القاهرة" والعنوان "شارع التحرير" → العنوان يبقى "القاهرة - شارع التحرير"

