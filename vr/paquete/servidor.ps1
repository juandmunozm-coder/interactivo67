# Free Frequency VR - servidor local minimo (no hay que instalar nada: usa PowerShell, que ya viene con Windows).
# Lo abre "Abrir Free Frequency VR.bat". Sirve la carpeta en http://localhost:PUERTO/ y abre el navegador en la version VR.
# Solo escucha en este computador (localhost). Atiende varios pedidos a la vez y pedidos por partes (el audio de la radio).
# Para cerrarlo, cierra esta ventana.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$listener = $null
foreach ($p in 5190..5220) {
  try { $l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$p/"); $l.Start(); $listener = $l; $port = $p; break } catch { }
}
if (-not $listener) { Write-Host "No se encontro un puerto libre (5190-5220)."; Read-Host "Presiona Enter para salir"; exit 1 }

# cada pedido se atiende en su propio hilo: un archivo grande (o el audio) no detiene a los demas
$handler = {
  param($ctx, $root)
  $types = @{ ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"; ".css" = "text/css"; ".svg" = "image/svg+xml";
    ".png" = "image/png"; ".jpg" = "image/jpeg"; ".webp" = "image/webp"; ".glb" = "model/gltf-binary"; ".mp3" = "audio/mpeg"; ".json" = "application/json"; ".txt" = "text/plain; charset=utf-8" }
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path.EndsWith("/")) { $path += "index.html" }
    $file = [IO.Path]::GetFullPath([IO.Path]::Combine($root, ($path.TrimStart("/") -replace "/", "\")))
    if (-not $file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($file)) {
      $res.StatusCode = 404; $b = [Text.Encoding]::UTF8.GetBytes("404"); $res.OutputStream.Write($b, 0, $b.Length); return
    }
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" })
    $res.Headers.Add("Cache-Control", "no-store"); $res.Headers.Add("Accept-Ranges", "bytes")
    $fs = [IO.File]::OpenRead($file)
    try {
      $size = $fs.Length; $a = 0; $z = $size - 1
      $range = $ctx.Request.Headers["Range"]
      if ($range -and $range -match '^bytes=(\d*)-(\d*)$') {
        if ($matches[1] -eq "") { $a = [Math]::Max(0, $size - [long]$matches[2]) } else { $a = [long]$matches[1]; if ($matches[2] -ne "") { $z = [Math]::Min([long]$matches[2], $size - 1) } }
        if ($a -ge $size -or $a -gt $z) { $res.StatusCode = 416; $res.Headers.Add("Content-Range", "bytes */$size"); return }
        $res.StatusCode = 206; $res.Headers.Add("Content-Range", "bytes $a-$z/$size")
      }
      $len = $z - $a + 1; $res.ContentLength64 = $len; [void]$fs.Seek($a, 'Begin')
      $buf = New-Object byte[] 65536
      while ($len -gt 0) { $n = $fs.Read($buf, 0, [int][Math]::Min($buf.Length, $len)); if ($n -le 0) { break }; $res.OutputStream.Write($buf, 0, $n); $len -= $n }
    } finally { $fs.Dispose() }
  } catch { } finally { try { $res.OutputStream.Close() } catch { } }
}

$pool = [RunspaceFactory]::CreateRunspacePool(1, 16); $pool.Open()
$jobs = New-Object System.Collections.ArrayList

$url = "http://localhost:$port/vr/"
Write-Host ""
Write-Host "  Free Frequency VR esta abierto en: $url" -ForegroundColor Yellow
Write-Host "  (No cierres esta ventana mientras lo usas. Para terminar, cierrala.)"
Write-Host ""
Start-Process $url

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $ps = [PowerShell]::Create(); $ps.RunspacePool = $pool
  [void]$ps.AddScript($handler).AddArgument($ctx).AddArgument($root)
  [void]$jobs.Add(@{ ps = $ps; h = $ps.BeginInvoke() })
  # limpia los hilos que ya terminaron
  for ($i = $jobs.Count - 1; $i -ge 0; $i--) { $j = $jobs[$i]; if ($j.h.IsCompleted) { try { $j.ps.EndInvoke($j.h) } catch { }; $j.ps.Dispose(); $jobs.RemoveAt($i) } }
}
