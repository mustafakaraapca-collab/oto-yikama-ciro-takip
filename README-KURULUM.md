# RUVA Detailing Yönetim Sistemi — V24.0

Bu paket, GitHub'daki mevcut `mustafakaraapca-collab/oto-yikama-ciro-takip` uygulaması için hazırlanmış **ek bir yönetim modülüdür**. Mevcut randevu, ciro, stok, teklif, iş emri, müşteri ve PWA özelliklerini silmez; `sync_items` tablosunda kendine ait `ruva_job` kayıtlarını tutar.

## İçerik

- `management.js` — İş panosu ve fotoğraflı araç kabul modülü (mevcut `index.html` sonuna eklenir).
- `ruva-photo-storage.sql` — Supabase Storage için **özel (public olmayan)** fotoğraf alanı ve kullanıcıya özel güvenlik politikaları.
- `apply_update.py` — Bilgisayarda mevcut iki dosyayı güncelleyip orijinallerin yedeğini alan yardımcı script.
- `onizleme.html` — Gerçek müşteri verisi kullanmayan, **yalnızca tanıtım amaçlı** örnek ekran.

## iPhone veya GitHub web arayüzüyle kurulum

1. Mevcut GitHub deposunun `main` dalında **`management.js`** adında yeni bir dosya oluştur; paketteki `management.js` içeriğini olduğu gibi koy.
2. `index.html` dosyasında, en sondaki `</body>` satırının **hemen önüne** şunu ekle:

   ```html
   <script src="./management.js?v=24"></script>
   ```

3. `sw.js` dosyasında en baştaki `const CACHE=...` satırını aşağıdakiyle değiştir:

   ```js
   const CACHE="ruva-management-v24";
   ```

   Aynı dosyadaki `const ASSETS=[...]` listesine `"./management.js"` ekle. Başka dosyaları çıkartma.
4. Supabase Dashboard > SQL Editor sayfasında `ruva-photo-storage.sql` dosyasının içeriğini çalıştır. Bu adım yapılmadan araç kayıtları çalışır; **fotoğraf yükleme çalışmaz**.
5. GitHub Pages yayını açıldığında uygulamayı yenile (iPhone ana ekrana eklenen PWA'yı tamamen kapatıp tekrar açmak gerekebilir). Alttaki yeni **İşler** sekmesine girip test amaçlı bir araç oluştur.

## Bilgisayardan tek komutla index.html + sw.js hazırlama

`index.html` ile `sw.js` dosyalarını mevcut GitHub deposundan indirip bu klasöre koy. Sonra:

```bash
python apply_update.py
```

Yardımcı program **orijinal dosyaları yedekler**. Hazırlanan `index.html`, `sw.js`, `management.js` dosyalarını GitHub'a yükle; Storage SQL'i Supabase'de uygula.

## V24 kapsamı

- 6 aşamalı iş panosu: Araç Kabul, Onay Bekliyor, İşlemde, Kalite Kontrol, Teslime Hazır, Teslim Edildi
- Her araç için plaka, model, müşteri, telefon, hizmet türü, sorumlu personel, teslim zamanı, kilometre, yakıt, hasar ve kalite kontrol notu
- Mevcut Teklif/İş Emri modülündeki iş emirlerine bağlantı
- En fazla 8 adet fotoğraf; araç kabul, hasar, işlem ve işlem sonrası olarak sınıflandırma
- Kişi bazlı özel Supabase depolama; fotoğraflar paylaşım için 10 dakikalık imzalı URL ile görüntülenir
- İş kayıtları mevcut `sync_items` tablosuna ayrı tip olarak yazılır; ciroya otomatik eklenmez ve çift satış kaydı riski oluşturmaz

## Özellikle henüz *yok*

- Personelin ayrı kullanıcı hesabıyla sisteme giriş yapması / yetkilendirme
- Teklif onayını müşterinin dijital imzayla vermesi
- Otomatik stok düşümü, tahsilat, e-fatura veya garanti belgesi üretimi
- Gerçek zamanlı çok kullanıcılı eş zamanlı düzenleme ve çatışma çözümü
- Çevrimdışı yeni iş kaydı. Kayıt oluştururken **internet ve Supabase oturumu şart**.

Bunlar sonraki geliştirme fazlarında işlenecektir. Müşteri onayı veya ödeme gerçekleşmeden yalnızca iş aşamasını değiştirmek **ödeme ya da hukuki onay kanıtı oluşturmaz**.

## Güvenlik / uygulama notları

- Fotoğraf depolama alanı `public=false` açılır. `storage.objects` RLS politikaları yalnızca kullanıcının kendi UUID klasörüne erişim sağlar. `service_role` anahtarını hiçbir HTML veya JS dosyasına koyma.
- Müşteriye ait fotoğrafları izinli ve iş amaçlı kaydet; gizlilik bildirimi, saklama süresi ve silme prosedürü işletmede ayrıca belirlenmelidir.
- Ana uygulamanın Supabase tablosu için gerekli erişim yetkileri daha önce tanımlanmış olmalıdır. Yeni tablolar açılmaz; mevcut `sync_items` kullanılır.
- Gerçek verilerle kullanmadan önce: yeni kayıt → ekran yenileme → ikinci cihaz → fotoğraf yükleme/açma/silme → mevcut eski ciro kayıtları test edilmelidir.
- Var olan HTML/JS sürümü 11 Ekim 2026 itibarıyla GitHub'dan okunan dosyalara göre analiz edildi. GitHub erişimi bu oturumda *okuma ile sınırlı* olduğundan dosyalar otomatik depoya gönderilemedi.
