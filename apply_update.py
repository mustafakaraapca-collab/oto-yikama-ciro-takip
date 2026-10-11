#!/usr/bin/env python3
"""RUVA yönetim modülünü mevcut GitHub dosyalarına güvenli biçimde ekler.
Çalıştırmadan önce index.html, sw.js ve management.js aynı klasörde olmalı.
Orijinalleri .before-v24.bak dosyalarına yedekler.
"""
from pathlib import Path
import shutil,sys
root=Path(__file__).resolve().parent
index=root/'index.html'
sw=root/'sw.js'
module=root/'management.js'
for p in [index,sw,module]:
    if not p.exists():sys.exit(f'Eksik dosya: {p.name}. Mevcut GitHub index.html ve sw.js dosyalarını bu klasöre koyun.')
html=index.read_text(encoding='utf-8')
worker=sw.read_text(encoding='utf-8')
if 'id="ruvaManagementPage"' in html:
    print('Bu dosyada yönetim modülü kodu zaten var; otomatik işlem yapılmadı.')
    sys.exit(0)
if 'management.js' not in html:
    assert '</body>' in html,'index.html içinde </body> bulunamadı.'
    html=html.replace('</body>','<script src="./management.js?v=24"></script>\n</body>',1)
if 'management.js' not in worker:
    marker='"./quote-workorder.js"'
    assert marker in worker,'sw.js önbellek dosya listesi beklenenden farklı.'
    worker=worker.replace(marker,marker+',"./management.js"',1)
# SW cache versiyonunu arttırarak iPhone PWA eski sürümün kullanılmasını önler.
import re
worker=re.sub(r'const CACHE="[^"]+";', 'const CACHE="ruva-management-v24";', worker,count=1)
for path in [index,sw]:
    backup=path.with_name(path.name+'.before-v24.bak')
    if not backup.exists():shutil.copy2(path,backup)
index.write_text(html,encoding='utf-8')
sw.write_text(worker,encoding='utf-8')
print('Hazır: index.html, sw.js, management.js dosyalarını GitHub depoya yükleyin.')
print('Fotoğraflar için ruva-photo-storage.sql Supabase SQL Editor içinde çalıştırılmalıdır.')
