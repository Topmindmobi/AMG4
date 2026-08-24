# Renders the AMG triangle mark (from public/amg-logo.svg) as raster icons
# at the sizes needed for the PWA manifest and the Android TWA launcher icon.
# No SVG rasterizer available locally, so the three flat polygons are redrawn
# directly with GDI+ at each target resolution instead.

Add-Type -AssemblyName System.Drawing

$root = "C:\Users\Frednj\Documents\AMG-2\AMG-2"
$pwaIconsDir = Join-Path $root "public\icons"
$androidResDir = Join-Path $root "android\app\src\main\res"

# Mark geometry from public/amg-logo.svg, normalized to a 0..110 square viewBox
# (source polygons live in x:8-105, y:10-100 of the original 360x110 viewBox).
$orange = [System.Drawing.Color]::FromArgb(255, 0xFF, 0x74, 0x17)
$red    = [System.Drawing.Color]::FromArgb(255, 0xC8, 0x10, 0x2E)
$white  = [System.Drawing.Color]::FromArgb(255, 0xFF, 0xFF, 0xFF)

function New-MarkPoints($scale, $offsetX, $offsetY) {
    # returns a hashtable of PointF[] per polygon, scaled+offset into the target canvas
    function P($x, $y) { New-Object System.Drawing.PointF(($x * $scale + $offsetX), ($y * $scale + $offsetY)) }
    return @{
        orange = @( (P 8 10), (P 95 10), (P 48 58), (P 8 58) )
        red    = @( (P 8 68), (P 55 68), (P 8 100) )
        white  = @( (P 62 10), (P 105 10), (P 30 100), (P 8 100), (P 48 58), (P 95 10) )
    }
}

function Render-Icon {
    param(
        [string]$path,
        [int]$size,
        [double]$contentFraction = 1.0,   # fraction of canvas the 0..110 mark occupies (for padding)
        [System.Drawing.Color]$bg = [System.Drawing.Color]::Transparent
    )
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear($bg)

    $markSize = $size * $contentFraction
    $offset = ($size - $markSize) / 2.0
    $scale = $markSize / 110.0
    $pts = New-MarkPoints -scale $scale -offsetX $offset -offsetY $offset

    $g.FillPolygon((New-Object System.Drawing.SolidBrush($orange)), $pts.orange)
    $g.FillPolygon((New-Object System.Drawing.SolidBrush($red)), $pts.red)
    $g.FillPolygon((New-Object System.Drawing.SolidBrush($white)), $pts.white)

    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Wrote $path ($size x $size)"
}

New-Item -ItemType Directory -Force -Path $pwaIconsDir | Out-Null

# --- PWA manifest icons (white background, full-bleed mark with small padding) ---
Render-Icon -path (Join-Path $pwaIconsDir "icon-192.png") -size 192 -contentFraction 0.82 -bg $white
Render-Icon -path (Join-Path $pwaIconsDir "icon-512.png") -size 512 -contentFraction 0.82 -bg $white
# Maskable variants need the mark inside the ~80% safe zone since OS may crop to a shape
Render-Icon -path (Join-Path $pwaIconsDir "icon-maskable-192.png") -size 192 -contentFraction 0.6 -bg $white
Render-Icon -path (Join-Path $pwaIconsDir "icon-maskable-512.png") -size 512 -contentFraction 0.6 -bg $white
Render-Icon -path (Join-Path $pwaIconsDir "apple-touch-icon.png") -size 180 -contentFraction 0.78 -bg $white

# --- Android legacy launcher icons (per-density, white bg, slight padding) ---
$densities = @{ "mdpi" = 48; "hdpi" = 72; "xhdpi" = 96; "xxhdpi" = 144; "xxxhdpi" = 192 }
foreach ($d in $densities.Keys) {
    $dir = Join-Path $androidResDir "mipmap-$d"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Render-Icon -path (Join-Path $dir "ic_launcher.png") -size $densities[$d] -contentFraction 0.82 -bg $white
    Render-Icon -path (Join-Path $dir "ic_launcher_round.png") -size $densities[$d] -contentFraction 0.72 -bg $white
    # Adaptive icon foreground: transparent bg, mark confined to the ~66% inner safe zone
    Render-Icon -path (Join-Path $dir "ic_launcher_foreground.png") -size $densities[$d] -contentFraction 0.5 -bg ([System.Drawing.Color]::Transparent)
}

Write-Host "Done."
