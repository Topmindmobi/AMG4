$ErrorActionPreference = "Continue"
$outDir = Join-Path $PSScriptRoot "..\public\products"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Extra gallery angles per product (2, 3, 4) — Unsplash + picsum fallback
$gallery = [ordered]@{
  "hp-15-laptop-2" = "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80"
  "hp-15-laptop-3" = "https://images.unsplash.com/photo-1525547716970-5f6f772c1e8b?auto=format&fit=crop&w=900&q=80"
  "hp-15-laptop-4" = "https://images.unsplash.com/photo-1484788984921-03950022c9ef?auto=format&fit=crop&w=900&q=80"
  "wireless-mouse-keyboard-2" = "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=900&q=80"
  "wireless-mouse-keyboard-3" = "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=900&q=80"
  "wireless-mouse-keyboard-4" = "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80"
  "samsung-a15-2" = "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80"
  "samsung-a15-3" = "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=900&q=80"
  "samsung-a15-4" = "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=900&q=80"
  "type-c-fast-charger-2" = "https://images.unsplash.com/photo-1615526675150-e493b2b840a7?auto=format&fit=crop&w=900&q=80"
  "type-c-fast-charger-3" = "https://images.unsplash.com/photo-1625948515291-69613efd103f?auto=format&fit=crop&w=900&q=80"
  "type-c-fast-charger-4" = "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=900&q=80"
  "epson-l3250-2" = "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=900&q=80"
  "epson-l3250-3" = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80"
  "epson-l3250-4" = "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=900&q=80"
  "smart-led-tv-32-2" = "https://images.unsplash.com/photo-1461151304267-38535e780c79?auto=format&fit=crop&w=900&q=80"
  "smart-led-tv-32-3" = "https://images.unsplash.com/photo-1593784991095-a222548ba3db?auto=format&fit=crop&w=900&q=80"
  "smart-led-tv-32-4" = "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=900&q=80"
  "gas-cooker-2b-2" = "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80"
  "gas-cooker-2b-3" = "https://images.unsplash.com/photo-1556912173-46c336c7fd55?auto=format&fit=crop&w=900&q=80"
  "gas-cooker-2b-4" = "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80"
  "electric-iron-box-2" = "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=900&q=80"
  "electric-iron-box-3" = "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=900&q=80"
  "electric-iron-box-4" = "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=900&q=80"
  "mini-fridge-90l-2" = "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=900&q=80"
  "mini-fridge-90l-3" = "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=80"
  "mini-fridge-90l-4" = "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=900&q=80"
  "mens-casual-shirt-2" = "https://images.unsplash.com/photo-1602810318383-e386cc2a7ce2?auto=format&fit=crop&w=900&q=80"
  "mens-casual-shirt-3" = "https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?auto=format&fit=crop&w=900&q=80"
  "mens-casual-shirt-4" = "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=900&q=80"
  "ladies-ankara-dress-2" = "https://images.unsplash.com/photo-1515372039744-b8f0229c17a7?auto=format&fit=crop&w=900&q=80"
  "ladies-ankara-dress-3" = "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80"
  "ladies-ankara-dress-4" = "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=80"
  "shea-body-lotion-2" = "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=900&q=80"
  "shea-body-lotion-3" = "https://images.unsplash.com/photo-1620916566667-1c6b0d0e0b0b?auto=format&fit=crop&w=900&q=80"
  "shea-body-lotion-4" = "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=900&q=80"
  "plastic-armchair-2" = "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80"
  "plastic-armchair-3" = "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=80"
  "plastic-armchair-4" = "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?auto=format&fit=crop&w=900&q=80"
  "wooden-coffee-table-2" = "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80"
  "wooden-coffee-table-3" = "https://images.unsplash.com/photo-1615066390971-03e4dbf4e8c9?auto=format&fit=crop&w=900&q=80"
  "wooden-coffee-table-4" = "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=900&q=80"
  "wall-mirror-frame-2" = "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=900&q=80"
  "wall-mirror-frame-3" = "https://images.unsplash.com/photo-1615874959471-d45abb72bfeb?auto=format&fit=crop&w=900&q=80"
  "wall-mirror-frame-4" = "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=80"
  "jembe-hoe-2" = "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=900&q=80"
  "jembe-hoe-3" = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80"
  "jembe-hoe-4" = "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80"
  "knapsack-sprayer-2" = "https://images.unsplash.com/photo-1466692476866-a811ad97394d?auto=format&fit=crop&w=900&q=80"
  "knapsack-sprayer-3" = "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=900&q=80"
  "knapsack-sprayer-4" = "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=80"
  "cotton-bedsheet-6x6-2" = "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=900&q=80"
  "cotton-bedsheet-6x6-3" = "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80"
  "cotton-bedsheet-6x6-4" = "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=900&q=80"
  "cooking-pot-set-2" = "https://images.unsplash.com/photo-1584990347449-a5d9f800a783?auto=format&fit=crop&w=900&q=80"
  "cooking-pot-set-3" = "https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=900&q=80"
  "cooking-pot-set-4" = "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80"
  "kids-learning-tablet-2" = "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=900&q=80"
  "kids-learning-tablet-3" = "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=900&q=80"
  "kids-learning-tablet-4" = "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=900&q=80"
  "football-size-5-2" = "https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=900&q=80"
  "football-size-5-3" = "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=900&q=80"
  "football-size-5-4" = "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80"
  "kcpe-revision-bundle-2" = "https://images.unsplash.com/photo-14565130808af0f85fed6b2b2?auto=format&fit=crop&w=900&q=80"
  "kcpe-revision-bundle-3" = "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=900&q=80"
  "kcpe-revision-bundle-4" = "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=900&q=80"
  "fresh-eggs-tray-2" = "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=900&q=80"
  "fresh-eggs-tray-3" = "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=900&q=80"
  "fresh-eggs-tray-4" = "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=900&q=80"
  "tilapia-1kg-2" = "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=80"
  "tilapia-1kg-3" = "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80"
  "tilapia-1kg-4" = "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0cd?auto=format&fit=crop&w=900&q=80"
  "maize-flour-2kg-2" = "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=900&q=80"
  "maize-flour-2kg-3" = "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80"
  "maize-flour-2kg-4" = "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=900&q=80"
  "green-grams-1kg-2" = "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=900&q=80"
  "green-grams-1kg-3" = "https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&w=900&q=80"
  "green-grams-1kg-4" = "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=900&q=80"
  "ripe-bananas-bunch-2" = "https://images.unsplash.com/photo-1603833665858-e61d17a86224?auto=format&fit=crop&w=900&q=80"
  "ripe-bananas-bunch-3" = "https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=900&q=80"
  "ripe-bananas-bunch-4" = "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=900&q=80"
  "cement-50kg-2" = "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=900&q=80"
  "cement-50kg-3" = "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80"
  "cement-50kg-4" = "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80"
  "iron-sheet-28-2" = "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80"
  "iron-sheet-28-3" = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80"
  "iron-sheet-28-4" = "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80"
  "emulsion-paint-4l-2" = "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=900&q=80"
  "emulsion-paint-4l-3" = "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=900&q=80"
  "emulsion-paint-4l-4" = "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=900&q=80"
}

foreach ($name in $gallery.Keys) {
  $dest = Join-Path $outDir "$name.jpg"
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 5000)) {
    Write-Host "skip $name"
    continue
  }
  $urls = @($gallery[$name], "https://picsum.photos/seed/$name/900/700.jpg")
  $ok = $false
  foreach ($url in $urls) {
    try {
      Write-Host "download $name"
      Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -MaximumRedirection 5
      if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 2000)) { $ok = $true; break }
    } catch {
      Write-Host "  fail $($_.Exception.Message)"
    }
  }
  if (-not $ok) { Write-Host "FAILED $name" }
}

Write-Host "Gallery files:" ((Get-ChildItem $outDir -Filter "*-*.jpg").Count)
