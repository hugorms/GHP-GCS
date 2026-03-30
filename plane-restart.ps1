$key = "C:\Users\roberthp\.ssh\id_ed25519"
$remote = "rober@10.51.16.19"
$docker = "C:\PROGRA~1\Docker\Docker\RESOUR~1\bin\docker.exe"
$compose = "C:\Users\Rober\plane\docker-compose-community.yml"

Write-Host "Apagando Plane..."
ssh -i $key $remote "cmd /c `"$docker compose -f $compose down`""

Write-Host "Iniciando Plane..."
ssh -i $key $remote "cmd /c `"$docker compose -f $compose up -d`""

Write-Host "Listo."
