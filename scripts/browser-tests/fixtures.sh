#!/bin/bash
# Makes the files the tests upload: small.png, mid.png, big.png, huge.png, manual.pdf, pack.zip
# and photo.jpg (4000 by 3000, stored on its side, EXIF orientation 6). The photo needs the
# Docker board to be running, because PHP with GD makes it there.
set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$dir/../.." && pwd)"

python3 - "$dir" <<'PY'
import os, struct, sys, zipfile, zlib

out = sys.argv[1]

def png(width, height, name):
    raw = b''.join(b'\x00' + os.urandom(width * 3) for _ in range(height))
    def chunk(kind, data):
        body = struct.pack('>I', len(data)) + kind + data
        return body + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 1)) + chunk(b'IEND', b'')
    open(os.path.join(out, name), 'wb').write(data)

png(100, 100, 'small.png')
png(200, 200, 'mid.png')
png(600, 600, 'big.png')
png(1200, 1000, 'huge.png')
open(os.path.join(out, 'manual.pdf'), 'w').write('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
with zipfile.ZipFile(os.path.join(out, 'pack.zip'), 'w') as archive:
    archive.writestr('a.txt', 'hello')
PY

cd "$root/docker"
docker compose exec -T web php -r '
$w=4000;$h=3000;$im=imagecreatetruecolor($w,$h);
for($i=0;$i<5000;$i++){imagefilledrectangle($im,random_int(0,$w),random_int(0,$h),random_int(0,$w),random_int(0,$h),random_int(0,0xFFFFFF));}
imagefilledrectangle($im,0,0,59,59,0xFF0000);
ob_start();imagejpeg($im,null,95);$d=ob_get_clean();
$t="II".pack("v",42).pack("V",8).pack("v",1).pack("v",0x0112).pack("v",3).pack("V",1).pack("v",6).pack("v",0).pack("V",0);
$e="Exif\0\0".$t;$d=substr($d,0,2)."\xFF\xE1".pack("n",strlen($e)+2).$e.substr($d,2);
file_put_contents("/tmp/photo.jpg",$d);'
docker compose cp web:/tmp/photo.jpg "$dir/photo.jpg"
ls -la "$dir"/*.png "$dir"/photo.jpg "$dir"/manual.pdf "$dir"/pack.zip
