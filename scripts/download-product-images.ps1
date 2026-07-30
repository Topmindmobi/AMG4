$ErrorActionPreference = "Continue"
$outDir = Join-Path $PSScriptRoot "..\public\products"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Primary Unsplash URLs + picsum seed fallback
$images = [ordered]@{
  "hp-15-laptop"            = "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80"
  "wireless-mouse-keyboard" = "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=80"
  "samsung-a15"             = "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80"
  "type-c-fast-charger"     = "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=900&q=80"
  "epson-l3250"             = "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=900&q=80"
  "smart-led-tv-32"         = "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=900&q=80"
  "gas-cooker-2b"           = "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80"
  "electric-iron-box"       = "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=900&q=80"
  "mini-fridge-90l"         = "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=900&q=80"
  "mens-casual-shirt"       = "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=900&q=80"
  "ladies-ankara-dress"     = "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=80"
  "shea-body-lotion"        = "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=900&q=80"
  "plastic-armchair"        = "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?auto=format&fit=crop&w=900&q=80"
  "wooden-coffee-table"     = "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=900&q=80"
  "wall-mirror-frame"       = "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=80"
  "jembe-hoe"               = "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80"
  "knapsack-sprayer"        = "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=80"
  "cotton-bedsheet-6x6"     = "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=900&q=80"
  "cooking-pot-set"         = "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80"
  "kids-learning-tablet"    = "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=900&q=80"
  "football-size-5"         = "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80"
  "kcpe-revision-bundle"    = "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=900&q=80"
  "fresh-eggs-tray"         = "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=900&q=80"
  "tilapia-1kg"             = "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=80"
  "maize-flour-2kg"         = "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=900&q=80"
  "green-grams-1kg"         = "https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&w=900&q=80"
  "ripe-bananas-bunch"      = "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=900&q=80"
  "cement-50kg"             = "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80"
  "iron-sheet-28"           = "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80"
  "emulsion-paint-4l"       = "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=900&q=80"
}

foreach ($slug in $images.Keys) {
  $dest = Join-Path $outDir "$slug.jpg"
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 5000)) {
    Write-Host "skip $slug"
    continue
  }

  $urls = @(
    $images[$slug],
    "https://picsum.photos/seed/$slug/900/700.jpg"
  )

  $ok = $false
  foreach ($url in $urls) {
    try {
      Write-Host "download $slug <- $url"
      Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -MaximumRedirection 5
      if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 2000)) {
        $ok = $true
        break
      }
    } catch {
      Write-Host "  failed: $($_.Exception.Message)"
    }
  }

  if (-not $ok) {
    Write-Host "FAILED $slug"
  }
}

Write-Host ""
Write-Host "Done. Count:" ((Get-ChildItem $outDir -File).Count)
