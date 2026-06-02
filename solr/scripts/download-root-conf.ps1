$ErrorActionPreference = "Stop"
$base = "https://raw.githubusercontent.com/apache/solr/releases/solr/9.8.1/solr/server/solr/configsets/_default/conf"
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$names = @("stopwords.txt", "synonyms.txt", "protwords.txt")
foreach ($n in $names) {
  $url = "$base/$n"
  $out = Join-Path $root "solr/configsets/products/conf/$n"
  Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -TimeoutSec 120
  Copy-Item $out (Join-Path $root "solr/configsets/customers/conf/$n") -Force
  Write-Host "OK $n"
}
