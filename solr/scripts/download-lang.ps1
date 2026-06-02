$ErrorActionPreference = "Stop"
$base = "https://raw.githubusercontent.com/apache/solr/releases/solr/9.8.1/solr/server/solr/configsets/_default/conf"
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
# Curated list (regex on managed-schema also picks up commented examples like userdict_ja.txt)
$files = @(
  "contractions_ca.txt","contractions_fr.txt","contractions_ga.txt","contractions_it.txt",
  "hyphenations_ga.txt","stemdict_nl.txt","stoptags_ja.txt",
  "stopwords_ar.txt","stopwords_bg.txt","stopwords_ca.txt","stopwords_cz.txt","stopwords_da.txt",
  "stopwords_de.txt","stopwords_el.txt","stopwords_en.txt","stopwords_es.txt","stopwords_et.txt",
  "stopwords_eu.txt","stopwords_fa.txt","stopwords_fi.txt","stopwords_fr.txt","stopwords_ga.txt",
  "stopwords_gl.txt","stopwords_hi.txt","stopwords_hu.txt","stopwords_hy.txt","stopwords_id.txt",
  "stopwords_it.txt","stopwords_ja.txt","stopwords_lv.txt","stopwords_nl.txt","stopwords_no.txt",
  "stopwords_pt.txt","stopwords_ro.txt","stopwords_ru.txt","stopwords_sv.txt","stopwords_th.txt",
  "stopwords_tr.txt"
)

$targets = @(
  (Join-Path $root "solr/configsets/products/conf/lang"),
  (Join-Path $root "solr/configsets/customers/conf/lang")
)
foreach ($dir in $targets) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

foreach ($f in $files) {
  $url = "$base/lang/$f"
  foreach ($dir in $targets) {
    $out = Join-Path $dir $f
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -TimeoutSec 120
  }
  Write-Host "OK lang/$f"
}
