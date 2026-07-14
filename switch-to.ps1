param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("chrome", "firefox")]
    [string]$Browser
)

$cwd = $PSScriptRoot
if (-not $cwd) { $cwd = Get-Location }

Write-Host "Chuyển đổi manifest cho trình duyệt: $Browser" -ForegroundColor Green

if ($Browser -eq "chrome") {
    if (Test-Path "$cwd\manifest-chrome.json") {
        Copy-Item "$cwd\manifest-chrome.json" "$cwd\manifest.json" -Force
        Write-Host "Đã chuyển đổi manifest.json sang phiên bản Chrome/Edge!" -ForegroundColor Cyan
    } else {
        Write-Error "Không tìm thấy file manifest-chrome.json!"
    }
} elseif ($Browser -eq "firefox") {
    if (Test-Path "$cwd\manifest-firefox.json") {
        Copy-Item "$cwd\manifest-firefox.json" "$cwd\manifest.json" -Force
        Write-Host "Đã chuyển đổi manifest.json sang phiên bản Firefox!" -ForegroundColor Yellow
    } else {
        Write-Error "Không tìm thấy file manifest-firefox.json!"
    }
}
